/**
 * Reddit API管理器 - 解决403错误，统一Reddit搜索
 * 支持多种认证方式和备选策略
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('RedditAPIManager');

interface RedditPost {
  id: string;
  title: string;
  url: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  selftext?: string;
  permalink: string;
}

interface RedditSearchResult {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  subreddit: string;
  author: string;
  score: number;
  comments: number;
  publishedAt: string;
  summary?: string;
}

export class RedditAPIManager {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Open-Search-MCP/2.0 (Educational Research Tool)',
    'RedditBot/1.0 (by /u/researcher)'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 主要搜索方法 - 多策略搜索
   */
  async searchReddit(
    query: string, 
    maxResults: number = 10, 
    subreddit?: string,
    sortBy: string = 'relevance',
    timeFilter: string = 'all'
  ): Promise<RedditSearchResult[]> {
    logger.info(`Searching Reddit for: ${query} ${subreddit ? `in r/${subreddit}` : ''}`);

    // 策略1: 使用Reddit公共JSON API
    try {
      const results = await this.searchWithPublicAPI(query, maxResults, subreddit, sortBy, timeFilter);
      if (results.length > 0) {
        logger.info(`Public API search successful: ${results.length} results`);
        return results;
      }
    } catch (error) {
      logger.warn('Public API search failed:', error);
    }

    // 策略2: 使用Reddit OAuth API (如果配置了)
    try {
      const results = await this.searchWithOAuthAPI(query, maxResults, subreddit, sortBy, timeFilter);
      if (results.length > 0) {
        logger.info(`OAuth API search successful: ${results.length} results`);
        return results;
      }
    } catch (error) {
      logger.warn('OAuth API search failed:', error);
    }

    // 策略3: 使用搜索引擎备选方案
    try {
      const results = await this.searchWithSearchEngines(query, maxResults, subreddit);
      logger.info(`Search engine fallback: ${results.length} results`);
      return results;
    } catch (error) {
      logger.error('All Reddit search strategies failed:', error);
      return [];
    }
  }

  /**
   * 策略1: Reddit公共JSON API
   */
  private async searchWithPublicAPI(
    query: string,
    maxResults: number,
    subreddit?: string,
    sortBy: string = 'relevance',
    timeFilter: string = 'all'
  ): Promise<RedditSearchResult[]> {
    let searchUrl = 'https://www.reddit.com/search.json';
    const params: Record<string, string> = {
      q: query,
      limit: Math.min(maxResults, 25).toString(),
      sort: sortBy === 'relevance' ? 'relevance' : sortBy,
      t: timeFilter,
      type: 'link',
      raw_json: '1'
    };

    // 如果指定了subreddit
    if (subreddit) {
      searchUrl = `https://www.reddit.com/r/${subreddit}/search.json`;
      params.restrict_sr = 'on';
    }

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${searchUrl}?${queryString}`;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Reddit API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data.children) {
      throw new Error('Invalid Reddit API response format');
    }

    return this.parseRedditPosts(data.data.children);
  }

  /**
   * 策略2: Reddit OAuth API (需要配置)
   */
  private async searchWithOAuthAPI(
    query: string,
    maxResults: number,
    subreddit?: string,
    sortBy: string = 'relevance',
    timeFilter: string = 'all'
  ): Promise<RedditSearchResult[]> {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Reddit OAuth credentials not configured');
    }

    // 获取访问令牌
    const accessToken = await this.getOAuthAccessToken(clientId, clientSecret);
    
    let searchUrl = 'https://oauth.reddit.com/search';
    const params: Record<string, string> = {
      q: query,
      limit: Math.min(maxResults, 25).toString(),
      sort: sortBy,
      t: timeFilter,
      type: 'link'
    };

    if (subreddit) {
      searchUrl = `https://oauth.reddit.com/r/${subreddit}/search`;
      params.restrict_sr = 'true';
    }

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${searchUrl}?${queryString}`;

    const response = await fetch(fullUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Open-Search-MCP/2.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Reddit OAuth API failed: ${response.status}`);
    }

    const data = await response.json();
    return this.parseRedditPosts(data.data.children);
  }

  /**
   * 获取OAuth访问令牌
   */
  private async getOAuthAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'Open-Search-MCP/2.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`OAuth token request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * 策略3: 搜索引擎备选方案
   */
  private async searchWithSearchEngines(
    query: string,
    maxResults: number,
    subreddit?: string
  ): Promise<RedditSearchResult[]> {
    const searchQuery = subreddit 
      ? `site:reddit.com/r/${subreddit} "${query}"`
      : `site:reddit.com "${query}"`;

    const searchEngines = [
      'https://duckduckgo.com/html/?q=',
      'https://www.bing.com/search?q='
    ];

    for (const engine of searchEngines) {
      try {
        const searchUrl = `${engine}${encodeURIComponent(searchQuery)}`;
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          signal: AbortSignal.timeout(12000)
        });

        if (response.ok) {
          const html = await response.text();
          const results = this.extractRedditResultsFromHTML(html);
          if (results.length > 0) {
            return results.slice(0, maxResults);
          }
        }

        await this.delay(2000);
      } catch (error) {
        logger.warn(`Search engine ${engine} failed:`, error);
        continue;
      }
    }

    return [];
  }

  /**
   * 解析Reddit帖子数据
   */
  private parseRedditPosts(children: any[]): RedditSearchResult[] {
    const results: RedditSearchResult[] = [];

    for (const child of children) {
      try {
        const post = child.data as RedditPost;
        
        results.push({
          id: post.id,
          title: post.title,
          url: post.url.startsWith('/') ? `https://reddit.com${post.url}` : post.url,
          source: 'Reddit',
          type: 'discussion',
          subreddit: post.subreddit,
          author: post.author,
          score: post.score,
          comments: post.num_comments,
          publishedAt: new Date(post.created_utc * 1000).toISOString(),
          summary: post.selftext ? post.selftext.substring(0, 200) + '...' : undefined
        });
      } catch (error) {
        logger.warn('Failed to parse Reddit post:', error);
        continue;
      }
    }

    return results;
  }

  /**
   * 从HTML搜索结果提取Reddit链接
   */
  private extractRedditResultsFromHTML(html: string): RedditSearchResult[] {
    const results: RedditSearchResult[] = [];
    const redditUrlPattern = /https?:\/\/(?:www\.)?reddit\.com\/r\/([^\/]+)\/comments\/([^\/]+)\/([^\/\s"<>]+)/gi;
    
    let match;
    while ((match = redditUrlPattern.exec(html)) !== null) {
      const [fullUrl, subreddit, postId, titleSlug] = match;
      
      // 尝试从HTML中提取标题
      const titleMatch = html.substring(match.index - 200, match.index + 200)
        .match(/<[^>]*title[^>]*>([^<]+)</i) || 
        html.substring(match.index - 200, match.index + 200)
        .match(/title="([^"]+)"/i);
      
      const title = titleMatch ? titleMatch[1].trim() : titleSlug.replace(/_/g, ' ');
      
      results.push({
        id: postId,
        title: title,
        url: fullUrl,
        source: 'Reddit',
        type: 'discussion',
        subreddit: subreddit,
        author: 'unknown',
        score: 0,
        comments: 0,
        publishedAt: new Date().toISOString()
      });
    }

    return results;
  }
}

export default RedditAPIManager;
