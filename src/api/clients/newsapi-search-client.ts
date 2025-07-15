import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * NewsAPI 搜索客户端 - 专注于新闻搜索场景
 * 支持新闻搜索、头条新闻、新闻来源查询
 */

interface EverythingParams {
  q?: string;
  sources?: string;
  domains?: string;
  from?: string;
  to?: string;
  language?: string;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  pageSize?: number;
  page?: number;
}

interface HeadlinesParams {
  country?: string;
  category?: string;
  sources?: string;
  q?: string;
  pageSize?: number;
  page?: number;
}

interface SourcesParams {
  category?: string;
  language?: string;
  country?: string;
}

export class NewsAPISearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private apiKey: string;
  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger = new Logger('NewsAPISearch');
    
    this.httpClient = axios.create({
      baseURL: 'https://newsapi.org/v2',
      timeout: 15000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0',
        'X-Api-Key': this.apiKey
      }
    });
  }

  /**
   * 速率限制检查 (每天1000次)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // 重置计数器 (每天)
    if (now - this.lastResetTime >= 86400000) { // 24小时
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    // 检查限制
    if (this.requestCount >= 1000) {
      const waitTime = 86400000 - (now - this.lastResetTime);
      this.logger.warn(`Daily rate limit reached, waiting ${Math.round(waitTime / 3600000)}h`);
      throw new Error('Daily rate limit exceeded. Please try again tomorrow.');
    }
    
    this.requestCount++;
  }

  /**
   * 通用API请求方法
   */
  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    await this.checkRateLimit();
    
    try {
      const response = await this.httpClient.get(endpoint, { params });
      const data = response.data;
      
      // 检查API错误
      if (data.status === 'error') {
        throw new Error(data.message || 'NewsAPI request failed');
      }
      
      return data;
    } catch (error) {
      this.logger.error('NewsAPI request failed:', error);
      throw error;
    }
  }

  /**
   * 搜索所有新闻 (Everything端点)
   */
  async searchEverything(params: EverythingParams): Promise<any> {
    this.logger.info(`Searching news: ${params.q || 'all'}`);
    
    // 设置默认参数
    const searchParams = {
      pageSize: 20,
      sortBy: 'publishedAt',
      language: 'en',
      ...params
    };
    
    const data = await this.makeRequest('/everything', searchParams);
    
    return {
      query: params.q || 'all news',
      totalResults: data.totalResults,
      articles: data.articles.map((article: any) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.urlToImage,
        publishedAt: article.publishedAt,
        source: {
          id: article.source.id,
          name: article.source.name
        },
        author: article.author,
        content: article.content
      })),
      source: 'NewsAPI',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取头条新闻 (Top Headlines端点)
   */
  async getTopHeadlines(params: HeadlinesParams): Promise<any> {
    this.logger.info(`Getting headlines: ${params.country || params.category || 'general'}`);
    
    // 设置默认参数
    const searchParams = {
      pageSize: 20,
      ...params
    };
    
    const data = await this.makeRequest('/top-headlines', searchParams);
    
    return {
      query: params.q || `${params.country || 'global'} headlines`,
      totalResults: data.totalResults,
      articles: data.articles.map((article: any) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.urlToImage,
        publishedAt: article.publishedAt,
        source: {
          id: article.source.id,
          name: article.source.name
        },
        author: article.author,
        content: article.content
      })),
      source: 'NewsAPI',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取新闻来源 (Sources端点)
   */
  async getSources(params: SourcesParams = {}): Promise<any> {
    this.logger.info(`Getting sources: ${params.category || params.language || 'all'}`);
    
    const data = await this.makeRequest('/sources', params);
    
    return {
      query: `sources ${params.category || params.language || 'all'}`,
      totalResults: data.sources.length,
      sources: data.sources.map((source: any) => ({
        id: source.id,
        name: source.name,
        description: source.description,
        url: source.url,
        category: source.category,
        language: source.language,
        country: source.country
      })),
      source: 'NewsAPI',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 智能新闻搜索 - 根据查询自动选择最佳端点
   */
  async smartSearch(query: string, options: any = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    // 分析查询意图
    const intent = this.analyzeSearchIntent(query);
    
    switch (intent.type) {
      case 'headlines':
        return await this.getTopHeadlines({
          q: intent.keywords,
          country: intent.country,
          category: intent.category,
          ...options
        });
        
      case 'sources':
        return await this.getSources({
          category: intent.category,
          language: intent.language,
          country: intent.country,
          ...options
        });
        
      default: // 'everything'
        return await this.searchEverything({
          q: intent.keywords,
          language: intent.language,
          from: intent.dateFrom,
          to: intent.dateTo,
          sortBy: intent.sortBy,
          ...options
        });
    }
  }

  /**
   * 分析搜索意图
   */
  private analyzeSearchIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 头条新闻关键词
    const headlineKeywords = ['头条', 'headlines', '今日', 'today', '最新', 'latest', 'breaking'];
    const isHeadlines = headlineKeywords.some(kw => normalizedQuery.includes(kw));
    
    // 来源查询关键词
    const sourceKeywords = ['来源', 'sources', '媒体', 'media', '新闻源'];
    const isSources = sourceKeywords.some(kw => normalizedQuery.includes(kw));
    
    // 提取国家
    const countryMap: Record<string, string> = {
      '中国': 'cn', '美国': 'us', '英国': 'gb', '日本': 'jp',
      'china': 'cn', 'usa': 'us', 'america': 'us', 'uk': 'gb', 'japan': 'jp'
    };
    
    let country = undefined;
    for (const [name, code] of Object.entries(countryMap)) {
      if (normalizedQuery.includes(name)) {
        country = code;
        break;
      }
    }
    
    // 提取类别
    const categoryMap: Record<string, string> = {
      '科技': 'technology', '商业': 'business', '体育': 'sports', 
      '娱乐': 'entertainment', '健康': 'health', '科学': 'science',
      'tech': 'technology', 'business': 'business', 'sports': 'sports',
      'entertainment': 'entertainment', 'health': 'health', 'science': 'science'
    };
    
    let category = undefined;
    for (const [name, cat] of Object.entries(categoryMap)) {
      if (normalizedQuery.includes(name)) {
        category = cat;
        break;
      }
    }
    
    // 提取语言
    const language = normalizedQuery.includes('中文') || /[\u4e00-\u9fff]/.test(query) ? 'zh' : 'en';
    
    // 提取日期范围
    let dateFrom = undefined;
    let dateTo = undefined;
    
    if (normalizedQuery.includes('今日') || normalizedQuery.includes('today')) {
      dateFrom = new Date().toISOString().split('T')[0];
    } else if (normalizedQuery.includes('本周') || normalizedQuery.includes('this week')) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFrom = weekAgo.toISOString().split('T')[0];
    }
    
    // 确定搜索类型
    let type = 'everything';
    if (isSources) {
      type = 'sources';
    } else if (isHeadlines) {
      type = 'headlines';
    }
    
    // 提取关键词 (移除意图词汇)
    let keywords = query;
    const removeWords = [...headlineKeywords, ...sourceKeywords, ...Object.keys(countryMap), ...Object.keys(categoryMap)];
    removeWords.forEach(word => {
      keywords = keywords.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    return {
      type,
      keywords: keywords || undefined,
      country,
      category,
      language,
      dateFrom,
      dateTo,
      sortBy: isHeadlines ? 'publishedAt' : 'relevancy'
    };
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsToday: this.requestCount,
      dailyLimit: 1000,
      remainingRequests: Math.max(0, 1000 - this.requestCount),
      usagePercentage: (this.requestCount / 1000) * 100,
      resetTime: new Date(this.lastResetTime + 86400000).toISOString()
    };
  }


}
