import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * Reddit 搜索客户端 - 专注于社区讨论、问答、热门内容搜索
 * 支持帖子搜索、用户搜索、subreddit搜索、评论搜索
 */

interface SearchOptions {
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  time?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour';
  limit?: number;
  subreddit?: string;
  type?: 'link' | 'user' | 'sr';
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  url: string;
  permalink: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  thumbnail: string;
  is_video: boolean;
  over_18: boolean;
  stickied: boolean;
  locked: boolean;
  distinguished: string | null;
  gilded: number;
  awards_received: number;
}

interface RedditUser {
  name: string;
  id: string;
  comment_karma: number;
  link_karma: number;
  total_karma: number;
  created_utc: number;
  is_gold: boolean;
  is_mod: boolean;
  verified: boolean;
  has_verified_email: boolean;
  icon_img: string;
  subreddit?: {
    display_name: string;
    subscribers: number;
    title: string;
    public_description: string;
  };
}

interface RedditSubreddit {
  display_name: string;
  id: string;
  title: string;
  public_description: string;
  description: string;
  subscribers: number;
  active_user_count: number;
  created_utc: number;
  over18: boolean;
  lang: string;
  url: string;
  icon_img: string;
  banner_img: string;
  community_icon: string;
}

interface SearchResult<T> {
  data: {
    children: Array<{ data: T }>;
    after: string | null;
    before: string | null;
    dist: number;
  };
}

export class RedditSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 2000; // 2秒延迟，Reddit API速率限制较严格
  private readonly CLIENT_ID: string;
  private readonly CLIENT_SECRET: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.logger = new Logger('RedditSearch');
    
    // 从环境变量获取API密钥
    this.CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'Opposite_Sentence673';
    this.CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '95lF663TWW4YoANL4DzzTUi6ZrQHZQ';
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0 by OpenSearchMCP'
      }
    });

    // 添加响应拦截器处理速率限制
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          this.logger.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
        }
        throw error;
      }
    );
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
    // 检查现有令牌是否仍然有效
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.CLIENT_ID}:${this.CLIENT_SECRET}`).toString('base64');
      
      const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Open-Search-MCP/2.0 by OpenSearchMCP'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 提前1分钟过期
      
      this.logger.info('Reddit access token obtained successfully');
      return this.accessToken!;
      
    } catch (error) {
      this.logger.error('Failed to get Reddit access token:', error);
      throw new Error('Reddit authentication failed');
    }
  }

  /**
   * 通用API请求方法（带速率限制和认证）
   */
  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    // 实施速率限制
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest;
      this.logger.info(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    try {
      const token = await this.getAccessToken();
      
      const response = await this.httpClient.get(`https://oauth.reddit.com${endpoint}`, {
        params,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('Reddit API request failed:', error);
      throw error;
    }
  }

  /**
   * 搜索Reddit帖子
   */
  async searchPosts(query: string, options: SearchOptions = {}): Promise<SearchResult<RedditPost>> {
    this.logger.info(`Searching Reddit posts: ${query}`);
    
    const params = {
      q: query,
      sort: options.sort || 'relevance',
      t: options.time || 'all',
      limit: Math.min(options.limit || 25, 100),
      type: 'link',
      include_over_18: 'off'
    };
    
    // 如果指定了subreddit，使用subreddit搜索
    if (options.subreddit) {
      const endpoint = `/r/${options.subreddit}/search`;
      (params as any).restrict_sr = 'on';
      return await this.makeRequest(endpoint, params);
    } else {
      return await this.makeRequest('/search', params);
    }
  }

  /**
   * 搜索Reddit用户
   */
  async searchUsers(query: string, options: SearchOptions = {}): Promise<SearchResult<RedditUser>> {
    this.logger.info(`Searching Reddit users: ${query}`);
    
    const params = {
      q: query,
      sort: options.sort || 'relevance',
      t: options.time || 'all',
      limit: Math.min(options.limit || 25, 100),
      type: 'user'
    };
    
    return await this.makeRequest('/search', params);
  }

  /**
   * 搜索Subreddit
   */
  async searchSubreddits(query: string, options: SearchOptions = {}): Promise<SearchResult<RedditSubreddit>> {
    this.logger.info(`Searching subreddits: ${query}`);
    
    const params = {
      q: query,
      sort: options.sort || 'relevance',
      limit: Math.min(options.limit || 25, 100),
      type: 'sr',
      include_over_18: 'off'
    };
    
    return await this.makeRequest('/search', params);
  }

  /**
   * 获取热门帖子
   */
  async getHotPosts(subreddit?: string, limit: number = 25): Promise<SearchResult<RedditPost>> {
    this.logger.info(`Getting hot posts${subreddit ? ` from r/${subreddit}` : ''}`);
    
    const endpoint = subreddit ? `/r/${subreddit}/hot` : '/hot';
    const params = {
      limit: Math.min(limit, 100)
    };
    
    return await this.makeRequest(endpoint, params);
  }

  /**
   * 获取顶级帖子
   */
  async getTopPosts(subreddit?: string, time: string = 'day', limit: number = 25): Promise<SearchResult<RedditPost>> {
    this.logger.info(`Getting top posts${subreddit ? ` from r/${subreddit}` : ''} for ${time}`);
    
    const endpoint = subreddit ? `/r/${subreddit}/top` : '/top';
    const params = {
      t: time,
      limit: Math.min(limit, 100)
    };
    
    return await this.makeRequest(endpoint, params);
  }

  /**
   * 获取用户详情
   */
  async getUserDetails(username: string): Promise<RedditUser> {
    this.logger.info(`Getting user details: ${username}`);
    
    const response = await this.makeRequest(`/user/${username}/about`);
    return response.data;
  }

  /**
   * 获取subreddit详情
   */
  async getSubredditDetails(subreddit: string): Promise<RedditSubreddit> {
    this.logger.info(`Getting subreddit details: ${subreddit}`);
    
    const response = await this.makeRequest(`/r/${subreddit}/about`);
    return response.data;
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳方法
   */
  async smartSearch(query: string, options: SearchOptions = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    switch (intent.type) {
      case 'user':
        const userResult = await this.searchUsers(intent.query!, options);
        return {
          type: 'user_search',
          query,
          result: userResult
        };
        
      case 'subreddit':
        const subredditResult = await this.searchSubreddits(intent.query!, options);
        return {
          type: 'subreddit_search',
          query,
          result: subredditResult
        };
        
      case 'hot':
        const hotResult = await this.getHotPosts(intent.subreddit, options.limit);
        return {
          type: 'hot_posts',
          query,
          result: hotResult
        };
        
      case 'top':
        const topResult = await this.getTopPosts(intent.subreddit, intent.time, options.limit);
        return {
          type: 'top_posts',
          query,
          result: topResult
        };
        
      default: // 'posts'
        const postsResult = await this.searchPosts(query, options);
        return {
          type: 'post_search',
          query,
          result: postsResult
        };
    }
  }

  /**
   * 分析搜索意图
   */
  private analyzeSearchIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 用户搜索
    if (normalizedQuery.includes('user:') || normalizedQuery.includes('u/') || 
        normalizedQuery.includes('redditor')) {
      return {
        type: 'user',
        query: normalizedQuery.replace(/user:|u\/|redditor/g, '').trim()
      };
    }
    
    // Subreddit搜索
    if (normalizedQuery.includes('r/') || normalizedQuery.includes('subreddit')) {
      return {
        type: 'subreddit',
        query: normalizedQuery.replace(/r\/|subreddit/g, '').trim()
      };
    }
    
    // 热门内容
    if (normalizedQuery.includes('hot') || normalizedQuery.includes('trending')) {
      const subredditMatch = normalizedQuery.match(/r\/(\w+)/);
      return {
        type: 'hot',
        subreddit: subredditMatch ? subredditMatch[1] : undefined
      };
    }
    
    // 顶级内容
    if (normalizedQuery.includes('top') || normalizedQuery.includes('best')) {
      const subredditMatch = normalizedQuery.match(/r\/(\w+)/);
      const timeMatch = normalizedQuery.match(/\b(day|week|month|year|all)\b/);
      return {
        type: 'top',
        subreddit: subredditMatch ? subredditMatch[1] : undefined,
        time: timeMatch ? timeMatch[1] : 'day'
      };
    }
    
    // 默认：帖子搜索
    return {
      type: 'posts',
      query: normalizedQuery
    };
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '60 requests per minute (authenticated)',
      features: ['post_search', 'user_search', 'subreddit_search', 'hot_posts', 'top_posts'],
      lastRequestTime: this.lastRequestTime,
      hasValidToken: this.accessToken !== null && Date.now() < this.tokenExpiry
    };
  }

  /**
   * 验证API配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取支持的subreddit分类
   */
  getSupportedCategories(): Record<string, string[]> {
    return {
      'Technology': ['programming', 'technology', 'MachineLearning', 'artificial', 'webdev'],
      'Science': ['science', 'askscience', 'Physics', 'chemistry', 'biology'],
      'News': ['news', 'worldnews', 'politics', 'Economics', 'business'],
      'Entertainment': ['movies', 'television', 'Music', 'gaming', 'books'],
      'Lifestyle': ['LifeProTips', 'todayilearned', 'explainlikeimfive', 'AskReddit', 'IAmA'],
      'Education': ['AskAcademia', 'GradSchool', 'college', 'GetStudying', 'HomeworkHelp'],
      'Health': ['Health', 'fitness', 'nutrition', 'mentalhealth', 'medical'],
      'Finance': ['investing', 'personalfinance', 'stocks', 'cryptocurrency', 'financialindependence']
    };
  }
}
