import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * Stack Exchange API 客户端 - 专注于编程问答和技术支持
 * 支持Stack Overflow、Super User、Ask Ubuntu等技术社区搜索
 */

interface SearchOptions {
  site?: string;
  sort?: 'activity' | 'votes' | 'creation' | 'relevance' | 'hot' | 'reputation';
  order?: 'desc' | 'asc';
  tagged?: string;
  nottagged?: string;
  intitle?: string;
  user?: string;
  min?: number;
  max?: number;
  fromdate?: number;
  todate?: number;
  page?: number;
  pagesize?: number;
}

interface StackExchangeQuestion {
  question_id: number;
  title: string;
  body?: string;
  link: string;
  score: number;
  view_count: number;
  answer_count: number;
  comment_count: number;
  creation_date: number;
  last_activity_date: number;
  last_edit_date?: number;
  is_answered: boolean;
  accepted_answer_id?: number;
  tags: string[];
  owner: {
    user_id?: number;
    display_name?: string;
    reputation?: number;
    user_type?: string;
    profile_image?: string;
    link?: string;
  };
  closed_date?: number;
  closed_reason?: string;
}

interface StackExchangeAnswer {
  answer_id: number;
  question_id: number;
  body?: string;
  link?: string;
  score: number;
  is_accepted: boolean;
  creation_date: number;
  last_activity_date: number;
  last_edit_date?: number;
  comment_count: number;
  owner: {
    user_id?: number;
    display_name?: string;
    reputation?: number;
    user_type?: string;
    profile_image?: string;
    link?: string;
  };
}

interface StackExchangeUser {
  user_id: number;
  display_name: string;
  reputation: number;
  user_type: string;
  profile_image?: string;
  website_url?: string;
  location?: string;
  about_me?: string;
  view_count: number;
  up_vote_count: number;
  down_vote_count: number;
  question_count: number;
  answer_count: number;
  creation_date: number;
  last_access_date: number;
  link: string;
  badge_counts?: {
    bronze: number;
    silver: number;
    gold: number;
  };
}

interface SearchResponse<T> {
  items: T[];
  has_more: boolean;
  quota_max: number;
  quota_remaining: number;
  page?: number;
  page_size?: number;
  total?: number;
  type?: string;
}

export class StackExchangeClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 100; // 100ms延迟，Stack Exchange API相对宽松
  private readonly DEFAULT_SITE = 'stackoverflow';

  constructor() {
    this.logger = new Logger('StackExchange');
    
    this.httpClient = axios.create({
      baseURL: 'https://api.stackexchange.com/2.3',
      timeout: 30000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0'
      }
    });

    // 添加响应拦截器处理压缩和错误
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          this.logger.warn('Rate limit exceeded for Stack Exchange API');
        } else if (error.response?.status === 400) {
          this.logger.warn('Bad request to Stack Exchange API');
        }
        throw error;
      }
    );
  }

  /**
   * 通用API请求方法（带速率限制）
   */
  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    // 实施速率限制
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    try {
      const requestParams = {
        site: this.DEFAULT_SITE,
        pagesize: 30,
        ...params
      };
      
      const response = await this.httpClient.get(endpoint, { params: requestParams });
      
      return response.data;
    } catch (error) {
      this.logger.error('Stack Exchange API request failed:', error);
      throw error;
    }
  }

  /**
   * 搜索问题
   */
  async searchQuestions(query: string, options: SearchOptions = {}): Promise<SearchResponse<StackExchangeQuestion>> {
    this.logger.info(`Searching questions: ${query}`);
    
    const params = {
      order: 'desc',
      sort: 'relevance',
      intitle: query,
      site: options.site || this.DEFAULT_SITE,
      pagesize: Math.min(options.pagesize || 30, 100),
      page: options.page || 1,
      tagged: options.tagged,
      nottagged: options.nottagged,
      min: options.min,
      max: options.max,
      fromdate: options.fromdate,
      todate: options.todate,
      filter: 'withbody' // 包含问题内容
    };
    
    // 移除undefined值
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });
    
    return await this.makeRequest('/search', params);
  }

  /**
   * 高级搜索问题
   */
  async advancedSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse<StackExchangeQuestion>> {
    this.logger.info(`Advanced search: ${query}`);
    
    const params = {
      order: options.order || 'desc',
      sort: options.sort || 'relevance',
      q: query,
      site: options.site || this.DEFAULT_SITE,
      pagesize: Math.min(options.pagesize || 30, 100),
      page: options.page || 1,
      tagged: options.tagged,
      nottagged: options.nottagged,
      min: options.min,
      max: options.max,
      fromdate: options.fromdate,
      todate: options.todate,
      filter: 'withbody'
    };
    
    // 移除undefined值
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });
    
    return await this.makeRequest('/search/advanced', params);
  }

  /**
   * 获取问题详情
   */
  async getQuestion(questionId: number, site: string = this.DEFAULT_SITE): Promise<StackExchangeQuestion | null> {
    this.logger.info(`Getting question: ${questionId}`);
    
    const params = {
      site,
      filter: 'withbody'
    };
    
    const response = await this.makeRequest(`/questions/${questionId}`, params);
    return response.items?.[0] || null;
  }

  /**
   * 获取问题的答案
   */
  async getAnswers(questionId: number, site: string = this.DEFAULT_SITE): Promise<SearchResponse<StackExchangeAnswer>> {
    this.logger.info(`Getting answers for question: ${questionId}`);
    
    const params = {
      site,
      order: 'desc',
      sort: 'votes',
      filter: 'withbody',
      pagesize: 30
    };
    
    return await this.makeRequest(`/questions/${questionId}/answers`, params);
  }

  /**
   * 搜索用户
   */
  async searchUsers(query: string, site: string = this.DEFAULT_SITE): Promise<SearchResponse<StackExchangeUser>> {
    this.logger.info(`Searching users: ${query}`);
    
    const params = {
      inname: query,
      site,
      order: 'desc',
      sort: 'reputation',
      pagesize: 30
    };
    
    return await this.makeRequest('/users', params);
  }

  /**
   * 获取用户详情
   */
  async getUser(userId: number, site: string = this.DEFAULT_SITE): Promise<StackExchangeUser | null> {
    this.logger.info(`Getting user: ${userId}`);
    
    const params = {
      site
    };
    
    const response = await this.makeRequest(`/users/${userId}`, params);
    return response.items?.[0] || null;
  }

  /**
   * 获取热门问题
   */
  async getHotQuestions(site: string = this.DEFAULT_SITE): Promise<SearchResponse<StackExchangeQuestion>> {
    this.logger.info(`Getting hot questions from: ${site}`);
    
    const params = {
      site,
      order: 'desc',
      sort: 'hot',
      pagesize: 30,
      filter: 'withbody'
    };
    
    return await this.makeRequest('/questions', params);
  }

  /**
   * 按标签搜索
   */
  async searchByTag(tag: string, site: string = this.DEFAULT_SITE, options: SearchOptions = {}): Promise<SearchResponse<StackExchangeQuestion>> {
    this.logger.info(`Searching by tag: ${tag}`);
    
    const params = {
      site,
      order: options.order || 'desc',
      sort: options.sort || 'votes',
      tagged: tag,
      pagesize: Math.min(options.pagesize || 30, 100),
      page: options.page || 1,
      filter: 'withbody'
    };
    
    return await this.makeRequest('/questions', params);
  }

  /**
   * 获取网站信息
   */
  async getSites(): Promise<any> {
    this.logger.info('Getting Stack Exchange sites');
    
    const params = {
      pagesize: 100,
      filter: 'default'
    };
    
    return await this.makeRequest('/sites', params);
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳搜索方法
   */
  async smartSearch(query: string, options: SearchOptions = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    let searchResult: SearchResponse<StackExchangeQuestion>;
    
    switch (intent.type) {
      case 'tag':
        searchResult = await this.searchByTag(intent.tag!, options.site, options);
        break;
        
      case 'user':
        const userResult = await this.searchUsers(intent.query, options.site);
        return {
          type: intent.type,
          query,
          originalQuery: query,
          intent: intent,
          result: userResult
        };
        
      case 'advanced':
        searchResult = await this.advancedSearch(intent.query, options);
        break;
        
      default: // 'simple'
        searchResult = await this.searchQuestions(query, options);
        break;
    }
    
    return {
      type: intent.type,
      query,
      originalQuery: query,
      processedQuery: intent.query,
      intent: intent,
      result: searchResult
    };
  }

  /**
   * 分析搜索意图
   */
  private analyzeSearchIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 标签搜索意图
    if (normalizedQuery.startsWith('[') && normalizedQuery.includes(']')) {
      const tagMatch = normalizedQuery.match(/\[([^\]]+)\]/);
      if (tagMatch) {
        return {
          type: 'tag',
          tag: tagMatch[1],
          query: normalizedQuery.replace(/\[[^\]]+\]/g, '').trim(),
          confidence: 0.9
        };
      }
    }
    
    // 用户搜索意图
    if (normalizedQuery.includes('user:') || normalizedQuery.includes('by ')) {
      const userQuery = normalizedQuery.replace(/user:|by /g, '').trim();
      return {
        type: 'user',
        query: userQuery,
        confidence: 0.85
      };
    }
    
    // 高级搜索意图（包含多个关键词或特殊字符）
    if (normalizedQuery.includes(' AND ') || normalizedQuery.includes(' OR ') || 
        normalizedQuery.includes('"') || normalizedQuery.split(' ').length > 3) {
      return {
        type: 'advanced',
        query: normalizedQuery,
        confidence: 0.8
      };
    }
    
    // 默认：简单搜索
    return {
      type: 'simple',
      query: normalizedQuery,
      confidence: 0.7
    };
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '10,000 requests per day (no key required)',
      features: ['question_search', 'answer_search', 'user_search', 'tag_search', 'hot_questions'],
      lastRequestTime: this.lastRequestTime,
      defaultSite: this.DEFAULT_SITE
    };
  }

  /**
   * 验证API配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const testResult = await this.searchQuestions('test', { pagesize: 1 });
      return testResult.items && testResult.items.length >= 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取支持的网站
   */
  getSupportedSites(): Record<string, string> {
    return {
      'stackoverflow': 'Stack Overflow - Programming Q&A',
      'superuser': 'Super User - Computer enthusiasts and power users',
      'serverfault': 'Server Fault - System and network administrators',
      'askubuntu': 'Ask Ubuntu - Ubuntu users and developers',
      'mathoverflow.net': 'MathOverflow - Professional mathematicians',
      'tex': 'TeX - LaTeX Stack Exchange',
      'dba': 'Database Administrators Stack Exchange',
      'webmasters': 'Webmasters Stack Exchange',
      'gamedev': 'Game Development Stack Exchange',
      'security': 'Information Security Stack Exchange'
    };
  }

  /**
   * 获取支持的搜索类型
   */
  getSupportedSearchTypes(): Record<string, string> {
    return {
      'questions': 'Search questions by title and content',
      'advanced': 'Advanced search with multiple criteria',
      'tags': 'Search questions by specific tags',
      'users': 'Search users by name and reputation',
      'answers': 'Search answers for specific questions',
      'hot': 'Get currently trending questions'
    };
  }

  /**
   * 获取支持的排序选项
   */
  getSupportedSortOptions(): Record<string, string> {
    return {
      'relevance': 'Most relevant to search query',
      'votes': 'Highest voted first',
      'activity': 'Most recently active',
      'creation': 'Most recently created',
      'hot': 'Currently trending'
    };
  }


}
