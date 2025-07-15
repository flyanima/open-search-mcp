/**
 * Reddit API Tools Registration
 * 注册Reddit API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Reddit API客户端
 */
class RedditAPIClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Open-Search-MCP/2.0'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 提前1分钟过期

      return this.accessToken || '';
    } catch (error) {throw new Error('Failed to get Reddit access token');
    }
  }

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`https://oauth.reddit.com${endpoint}`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Open-Search-MCP/2.0'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchPosts(query: string, options: any = {}) {
    return await this.makeRequest('/search', {
      q: query,
      type: 'link',
      sort: options.sort || 'relevance',
      t: options.time || 'all',
      limit: options.limit || 25,
      restrict_sr: options.subreddit ? true : false,
      sr: options.subreddit
    });
  }

  async getHotPosts(subreddit: string = 'all', limit: number = 25) {
    return await this.makeRequest(`/r/${subreddit}/hot`, {
      limit
    });
  }

  async getTopPosts(subreddit: string = 'all', time: string = 'day', limit: number = 25) {
    return await this.makeRequest(`/r/${subreddit}/top`, {
      t: time,
      limit
    });
  }

  async getSubredditInfo(subreddit: string) {
    return await this.makeRequest(`/r/${subreddit}/about`);
  }

  async searchSubreddits(query: string, limit: number = 25) {
    return await this.makeRequest('/subreddits/search', {
      q: query,
      limit
    });
  }
}

/**
 * 注册所有Reddit API工具
 */
export function registerRedditAPITools(registry: ToolRegistry): void {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {return;
  }

  const client = new RedditAPIClient(clientId, clientSecret);

  // 1. Reddit帖子搜索
  registry.registerTool({
    name: 'reddit_post_search',
    description: 'Search Reddit posts and discussions',
    category: 'social',
    source: 'reddit.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Reddit posts (e.g., "artificial intelligence", "programming tips")'
        },
        subreddit: {
          type: 'string',
          description: 'Specific subreddit to search in (optional)'
        },
        sort: {
          type: 'string',
          description: 'Sort by: relevance, hot, top, new, comments',
          default: 'relevance'
        },
        time: {
          type: 'string',
          description: 'Time period: hour, day, week, month, year, all',
          default: 'all'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 25,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchPosts(args.query, {
          subreddit: args.subreddit,
          sort: args.sort,
          time: args.time,
          limit: args.maxResults || 25
        });
        
        const posts = data.data?.children?.map((child: any) => ({
          title: child.data.title,
          url: child.data.url,
          permalink: `https://reddit.com${child.data.permalink}`,
          subreddit: child.data.subreddit,
          author: child.data.author,
          score: child.data.score,
          num_comments: child.data.num_comments,
          created_utc: child.data.created_utc,
          selftext: child.data.selftext?.substring(0, 200) + (child.data.selftext?.length > 200 ? '...' : ''),
          is_video: child.data.is_video,
          domain: child.data.domain
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit API',
            query: args.query,
            subreddit: args.subreddit,
            results: posts,
            totalResults: posts.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search Reddit posts'
        };
      }
    }
  });

  // 2. Reddit热门帖子
  registry.registerTool({
    name: 'reddit_hot_posts',
    description: 'Get hot posts from Reddit subreddits',
    category: 'social',
    source: 'reddit.com',
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: {
          type: 'string',
          description: 'Subreddit name (e.g., "programming", "technology", "all")',
          default: 'all'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 25,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const subreddit = args.subreddit || 'all';
        const data = await client.getHotPosts(subreddit, args.maxResults || 25);
        
        const posts = data.data?.children?.map((child: any) => ({
          title: child.data.title,
          url: child.data.url,
          permalink: `https://reddit.com${child.data.permalink}`,
          subreddit: child.data.subreddit,
          author: child.data.author,
          score: child.data.score,
          num_comments: child.data.num_comments,
          created_utc: child.data.created_utc,
          selftext: child.data.selftext?.substring(0, 200) + (child.data.selftext?.length > 200 ? '...' : ''),
          domain: child.data.domain
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit API',
            subreddit,
            type: 'hot',
            results: posts,
            totalResults: posts.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get hot posts'
        };
      }
    }
  });

  // 3. Reddit顶级帖子
  registry.registerTool({
    name: 'reddit_top_posts',
    description: 'Get top posts from Reddit subreddits by time period',
    category: 'social',
    source: 'reddit.com',
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: {
          type: 'string',
          description: 'Subreddit name (e.g., "programming", "technology", "all")',
          default: 'all'
        },
        time: {
          type: 'string',
          description: 'Time period: hour, day, week, month, year, all',
          default: 'day'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 25,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const subreddit = args.subreddit || 'all';
        const time = args.time || 'day';
        const data = await client.getTopPosts(subreddit, time, args.maxResults || 25);
        
        const posts = data.data?.children?.map((child: any) => ({
          title: child.data.title,
          url: child.data.url,
          permalink: `https://reddit.com${child.data.permalink}`,
          subreddit: child.data.subreddit,
          author: child.data.author,
          score: child.data.score,
          num_comments: child.data.num_comments,
          created_utc: child.data.created_utc,
          selftext: child.data.selftext?.substring(0, 200) + (child.data.selftext?.length > 200 ? '...' : ''),
          domain: child.data.domain
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit API',
            subreddit,
            type: 'top',
            time,
            results: posts,
            totalResults: posts.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get top posts'
        };
      }
    }
  });

  // 4. Subreddit搜索
  registry.registerTool({
    name: 'reddit_subreddit_search',
    description: 'Search for subreddits by topic or name',
    category: 'social',
    source: 'reddit.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for subreddits (e.g., "programming", "cooking", "science")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 25,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchSubreddits(args.query, args.maxResults || 25);
        
        const subreddits = data.data?.children?.map((child: any) => ({
          name: child.data.display_name,
          title: child.data.title,
          description: child.data.public_description,
          subscribers: child.data.subscribers,
          created_utc: child.data.created_utc,
          url: `https://reddit.com/r/${child.data.display_name}`,
          over18: child.data.over18,
          lang: child.data.lang,
          subreddit_type: child.data.subreddit_type
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit API',
            query: args.query,
            results: subreddits,
            totalResults: subreddits.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search subreddits'
        };
      }
    }
  });

}
