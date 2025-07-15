/**
 * 增强的Reddit API工具
 * 包含官方API和备用公开API两种方案
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Reddit公开API客户端（备用方案）
 */
class RedditPublicAPIClient {
  private baseURL = 'https://www.reddit.com';

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}.json`, {
        params,
        headers: {
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
      restrict_sr: options.subreddit ? 'on' : 'off',
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
}

/**
 * 注册增强的Reddit API工具
 */
export function registerEnhancedRedditTools(registry: ToolRegistry): void {
  const publicClient = new RedditPublicAPIClient();

  // 1. Reddit帖子搜索（增强版）
  registry.registerTool({
    name: 'reddit_enhanced_search',
    description: 'Enhanced Reddit post search with fallback to public API',
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
        // 使用公开API
        const data = await publicClient.searchPosts(args.query, {
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
          domain: child.data.domain,
          thumbnail: child.data.thumbnail
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit Public API',
            query: args.query,
            subreddit: args.subreddit,
            results: posts,
            totalResults: posts.length,
            method: 'public_api',
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

  // 2. Reddit热门帖子（增强版）
  registry.registerTool({
    name: 'reddit_enhanced_hot',
    description: 'Get hot posts from Reddit subreddits using public API',
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
        const data = await publicClient.getHotPosts(subreddit, args.maxResults || 25);
        
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
          domain: child.data.domain,
          thumbnail: child.data.thumbnail
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit Public API',
            subreddit,
            type: 'hot',
            results: posts,
            totalResults: posts.length,
            method: 'public_api',
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

  // 3. Reddit顶级帖子（增强版）
  registry.registerTool({
    name: 'reddit_enhanced_top',
    description: 'Get top posts from Reddit subreddits by time period using public API',
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
        const data = await publicClient.getTopPosts(subreddit, time, args.maxResults || 25);
        
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
          domain: child.data.domain,
          thumbnail: child.data.thumbnail
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Reddit Public API',
            subreddit,
            type: 'top',
            time,
            results: posts,
            totalResults: posts.length,
            method: 'public_api',
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

  // 4. 特定主题热门讨论
  registry.registerTool({
    name: 'reddit_topic_discussions',
    description: 'Get popular discussions about specific topics from relevant subreddits',
    category: 'social',
    source: 'reddit.com',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic to search for (e.g., "artificial intelligence", "programming", "climate change")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['topic']
    },
    execute: async (args: any) => {
      try {
        // 根据主题选择相关的subreddit
        const topicSubreddits: Record<string, string[]> = {
          'artificial intelligence': ['MachineLearning', 'artificial', 'singularity', 'technology'],
          'programming': ['programming', 'learnprogramming', 'coding', 'webdev'],
          'technology': ['technology', 'gadgets', 'tech', 'futurology'],
          'science': ['science', 'askscience', 'EverythingScience'],
          'business': ['business', 'entrepreneur', 'startups', 'investing'],
          'finance': ['investing', 'personalfinance', 'stocks', 'cryptocurrency']
        };

        const topic = args.topic.toLowerCase();
        let subreddits = ['all']; // 默认搜索全部

        // 查找匹配的subreddit
        for (const [key, subs] of Object.entries(topicSubreddits)) {
          if (topic.includes(key) || key.includes(topic)) {
            subreddits = subs;
            break;
          }
        }

        const allPosts: any[] = [];
        const maxPerSubreddit = Math.ceil((args.maxResults || 10) / subreddits.length);

        // 从相关subreddit获取热门帖子
        for (const subreddit of subreddits.slice(0, 3)) { // 限制最多3个subreddit
          try {
            const data = await publicClient.getHotPosts(subreddit, maxPerSubreddit);
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
              domain: child.data.domain,
              relevance_score: calculateTopicRelevance(child.data.title + ' ' + (child.data.selftext || ''), args.topic)
            })) || [];

            allPosts.push(...posts);
          } catch (error) {}
        }

        // 按相关性和热度排序
        allPosts.sort((a, b) => {
          const scoreA = a.relevance_score * Math.log(a.score + 1);
          const scoreB = b.relevance_score * Math.log(b.score + 1);
          return scoreB - scoreA;
        });

        const topPosts = allPosts.slice(0, args.maxResults || 10);

        return {
          success: true,
          data: {
            source: 'Reddit Public API',
            topic: args.topic,
            searched_subreddits: subreddits,
            results: topPosts,
            totalResults: topPosts.length,
            method: 'topic_analysis',
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get topic discussions'
        };
      }
    }
  });

}

// 辅助函数
function calculateTopicRelevance(text: string, topic: string): number {
  const textLower = text.toLowerCase();
  const topicWords = topic.toLowerCase().split(' ');
  let score = 0;
  
  for (const word of topicWords) {
    if (textLower.includes(word)) {
      score += 1;
    }
  }
  
  return score / topicWords.length;
}
