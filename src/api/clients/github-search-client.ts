import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * GitHub 搜索客户端 - 专注于代码、仓库、用户搜索场景
 * 支持仓库搜索、代码搜索、用户搜索、问题搜索
 */

interface SearchOptions {
  sort?: 'stars' | 'forks' | 'updated' | 'created' | 'best-match';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

interface RepositorySearchOptions extends SearchOptions {
  language?: string;
  size?: string;
  license?: string;
}

interface CodeSearchOptions extends SearchOptions {
  language?: string;
  filename?: string;
  extension?: string;
}

interface UserSearchOptions extends SearchOptions {
  type?: 'user' | 'org';
  location?: string;
  language?: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  size: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  topics: string[];
  license?: {
    name: string;
    spdx_id: string;
  };
}

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio: string;
  company: string;
  location: string;
  email: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

interface GitHubCodeResult {
  name: string;
  path: string;
  sha: string;
  url: string;
  html_url: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string;
    language: string;
    stargazers_count: number;
  };
  score: number;
}

interface SearchResult<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
}

export class GitHubSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 1000; // 1秒延迟，避免速率限制
  private readonly API_TOKEN: string;

  constructor() {
    this.logger = new Logger('GitHubSearch');
    
    // 从环境变量获取API密钥
    this.API_TOKEN = process.env.GITHUB_API_KEY || process.env.GITHUB_TOKEN || '';
    
    this.httpClient = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.API_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Open-Search-MCP/2.0'
      }
    });

    // 添加响应拦截器处理速率限制
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = error.response.headers['x-ratelimit-reset'];
          const waitTime = (parseInt(resetTime) * 1000) - Date.now();
          this.logger.warn(`Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`);
        }
        throw error;
      }
    );
  }

  /**
   * 通用API请求方法（带速率限制）
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
      const response = await this.httpClient.get(endpoint, { params });
      
      // 记录速率限制信息
      const remaining = response.headers['x-ratelimit-remaining'];
      const limit = response.headers['x-ratelimit-limit'];
      this.logger.info(`Rate limit: ${remaining}/${limit} remaining`);
      
      return response.data;
    } catch (error) {
      this.logger.error('GitHub API request failed:', error);
      throw error;
    }
  }

  /**
   * 搜索GitHub仓库
   */
  async searchRepositories(query: string, options: RepositorySearchOptions = {}): Promise<SearchResult<GitHubRepository>> {
    this.logger.info(`Searching repositories: ${query}`);
    
    // 构建搜索查询
    let searchQuery = query;
    
    // 添加语言过滤
    if (options.language) {
      searchQuery += ` language:${options.language}`;
    }
    
    // 添加大小过滤
    if (options.size) {
      searchQuery += ` size:${options.size}`;
    }
    
    // 添加许可证过滤
    if (options.license) {
      searchQuery += ` license:${options.license}`;
    }
    
    const params = {
      q: searchQuery,
      sort: options.sort || 'best-match',
      order: options.order || 'desc',
      per_page: Math.min(options.per_page || 10, 100),
      page: options.page || 1
    };
    
    const result = await this.makeRequest('/search/repositories', params);
    
    // 增强仓库信息
    const enhancedItems = result.items.map((repo: GitHubRepository) => ({
      ...repo,
      popularity_score: this.calculatePopularityScore(repo),
      activity_level: this.assessActivityLevel(repo),
      maintenance_status: this.assessMaintenanceStatus(repo)
    }));
    
    return {
      ...result,
      items: enhancedItems
    };
  }

  /**
   * 搜索GitHub代码
   */
  async searchCode(query: string, options: CodeSearchOptions = {}): Promise<SearchResult<GitHubCodeResult>> {
    this.logger.info(`Searching code: ${query}`);
    
    // 构建搜索查询
    let searchQuery = query;
    
    // 添加语言过滤
    if (options.language) {
      searchQuery += ` language:${options.language}`;
    }
    
    // 添加文件名过滤
    if (options.filename) {
      searchQuery += ` filename:${options.filename}`;
    }
    
    // 添加扩展名过滤
    if (options.extension) {
      searchQuery += ` extension:${options.extension}`;
    }
    
    const params = {
      q: searchQuery,
      sort: options.sort || 'best-match',
      order: options.order || 'desc',
      per_page: Math.min(options.per_page || 10, 100),
      page: options.page || 1
    };
    
    const result = await this.makeRequest('/search/code', params);
    
    return result;
  }

  /**
   * 搜索GitHub用户
   */
  async searchUsers(query: string, options: UserSearchOptions = {}): Promise<SearchResult<GitHubUser>> {
    this.logger.info(`Searching users: ${query}`);
    
    // 构建搜索查询
    let searchQuery = query;
    
    // 添加类型过滤
    if (options.type) {
      searchQuery += ` type:${options.type}`;
    }
    
    // 添加位置过滤
    if (options.location) {
      searchQuery += ` location:${options.location}`;
    }
    
    // 添加语言过滤
    if (options.language) {
      searchQuery += ` language:${options.language}`;
    }
    
    const params = {
      q: searchQuery,
      sort: options.sort || 'best-match',
      order: options.order || 'desc',
      per_page: Math.min(options.per_page || 10, 100),
      page: options.page || 1
    };
    
    const result = await this.makeRequest('/search/users', params);
    
    // 增强用户信息
    const enhancedItems = result.items.map((user: GitHubUser) => ({
      ...user,
      influence_score: this.calculateInfluenceScore(user),
      activity_level: this.assessUserActivity(user)
    }));
    
    return {
      ...result,
      items: enhancedItems
    };
  }

  /**
   * 获取仓库详情
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    this.logger.info(`Getting repository: ${owner}/${repo}`);
    
    const result = await this.makeRequest(`/repos/${owner}/${repo}`);
    
    return {
      ...result,
      popularity_score: this.calculatePopularityScore(result),
      activity_level: this.assessActivityLevel(result),
      maintenance_status: this.assessMaintenanceStatus(result)
    };
  }

  /**
   * 获取用户详情
   */
  async getUser(username: string): Promise<GitHubUser> {
    this.logger.info(`Getting user: ${username}`);
    
    const result = await this.makeRequest(`/users/${username}`);
    
    return {
      ...result,
      influence_score: this.calculateInfluenceScore(result),
      activity_level: this.assessUserActivity(result)
    };
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳方法
   */
  async smartSearch(query: string, options: any = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    switch (intent.type) {
      case 'repository':
        const repoResult = await this.searchRepositories(intent.query!, options);
        return {
          type: 'repository_search',
          query,
          result: repoResult
        };
        
      case 'code':
        const codeResult = await this.searchCode(intent.query!, options);
        return {
          type: 'code_search',
          query,
          result: codeResult
        };
        
      case 'user':
        const userResult = await this.searchUsers(intent.query!, options);
        return {
          type: 'user_search',
          query,
          result: userResult
        };
        
      default: // 'general'
        // 默认搜索仓库
        const generalResult = await this.searchRepositories(query, options);
        return {
          type: 'general_search',
          query,
          result: generalResult
        };
    }
  }

  /**
   * 分析搜索意图
   */
  private analyzeSearchIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 用户搜索
    if (normalizedQuery.includes('user:') || normalizedQuery.includes('author:') || 
        normalizedQuery.includes('developer') || normalizedQuery.includes('profile')) {
      return {
        type: 'user',
        query: normalizedQuery.replace(/user:|author:|developer|profile/g, '').trim()
      };
    }
    
    // 代码搜索
    if (normalizedQuery.includes('code:') || normalizedQuery.includes('function') || 
        normalizedQuery.includes('class') || normalizedQuery.includes('method') ||
        normalizedQuery.includes('filename:') || normalizedQuery.includes('extension:')) {
      return {
        type: 'code',
        query: normalizedQuery
      };
    }
    
    // 仓库搜索
    if (normalizedQuery.includes('repo:') || normalizedQuery.includes('repository') || 
        normalizedQuery.includes('project')) {
      return {
        type: 'repository',
        query: normalizedQuery.replace(/repo:|repository|project/g, '').trim()
      };
    }
    
    // 默认：仓库搜索
    return {
      type: 'repository',
      query: normalizedQuery
    };
  }

  /**
   * 计算仓库流行度分数
   */
  private calculatePopularityScore(repo: GitHubRepository): number {
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const watchers = repo.watchers_count || 0;
    
    // 加权计算流行度
    return Math.round((stars * 0.5 + forks * 0.3 + watchers * 0.2) / 10);
  }

  /**
   * 评估仓库活跃度
   */
  private assessActivityLevel(repo: GitHubRepository): 'high' | 'medium' | 'low' {
    const lastPush = new Date(repo.pushed_at);
    const daysSinceLastPush = (Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastPush <= 7) return 'high';
    if (daysSinceLastPush <= 30) return 'medium';
    return 'low';
  }

  /**
   * 评估仓库维护状态
   */
  private assessMaintenanceStatus(repo: GitHubRepository): 'active' | 'maintained' | 'stale' {
    const lastUpdate = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate <= 30) return 'active';
    if (daysSinceUpdate <= 180) return 'maintained';
    return 'stale';
  }

  /**
   * 计算用户影响力分数
   */
  private calculateInfluenceScore(user: GitHubUser): number {
    const repos = user.public_repos || 0;
    const followers = user.followers || 0;
    const following = user.following || 0;
    
    // 加权计算影响力
    return Math.round((followers * 0.4 + repos * 0.3 + (followers / Math.max(following, 1)) * 0.3) / 10);
  }

  /**
   * 评估用户活跃度
   */
  private assessUserActivity(user: GitHubUser): 'high' | 'medium' | 'low' {
    const repos = user.public_repos || 0;
    const followers = user.followers || 0;
    
    if (repos > 50 && followers > 100) return 'high';
    if (repos > 10 && followers > 10) return 'medium';
    return 'low';
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '5000 requests per hour (authenticated)',
      features: ['repository_search', 'code_search', 'user_search', 'smart_search'],
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.makeRequest('/user');
      return true;
    } catch (error) {
      return false;
    }
  }


}
