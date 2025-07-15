import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * Google Custom Search API 客户端 - 专注于通用网页搜索
 * 支持网页搜索、图片搜索、新闻搜索、学术搜索等
 */

interface SearchOptions {
  searchType?: 'web' | 'image' | 'news' | 'academic';
  language?: string;
  country?: string;
  dateRestrict?: string; // d[number], w[number], m[number], y[number]
  fileType?: string;
  siteSearch?: string;
  excludeTerms?: string;
  exactTerms?: string;
  orTerms?: string;
  start?: number;
  num?: number;
  safe?: 'active' | 'off';
  sort?: string;
}

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  formattedUrl: string;
  htmlTitle: string;
  htmlSnippet: string;
  cacheId?: string;
  pagemap?: any;
  mime?: string;
  fileFormat?: string;
  image?: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

interface SearchResponse {
  kind: string;
  url: any;
  queries: any;
  context: any;
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items: GoogleSearchResult[];
  spelling?: any;
  promotions?: any;
}

export class GoogleSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 1000; // 1秒延迟，Google API速率限制
  private readonly API_KEY: string;
  private readonly SEARCH_ENGINE_ID: string;

  constructor() {
    this.logger = new Logger('GoogleSearch');
    
    // 从环境变量获取API密钥
    this.API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || '017576662512468239146:omuauf_lfve'; // 默认搜索引擎ID
    
    this.httpClient = axios.create({
      baseURL: 'https://www.googleapis.com/customsearch/v1',
      timeout: 30000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0'
      }
    });

    // 添加响应拦截器处理速率限制
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          this.logger.warn('Rate limit exceeded for Google Search API');
        } else if (error.response?.status === 403) {
          this.logger.warn('API quota exceeded or invalid API key');
        }
        throw error;
      }
    );
  }

  /**
   * 通用API请求方法（带速率限制）
   */
  private async makeRequest(params: Record<string, any>): Promise<SearchResponse> {
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
      const requestParams = {
        key: this.API_KEY,
        cx: this.SEARCH_ENGINE_ID,
        ...params
      };
      
      const response = await this.httpClient.get('', { params: requestParams });
      
      return response.data;
    } catch (error) {
      this.logger.error('Google Search API request failed:', error);
      throw error;
    }
  }

  /**
   * 速率限制检查
   */
  private async rateLimitCheck(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // 确保请求间隔至少1秒
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 网页搜索
   */
  async searchWeb(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    await this.rateLimitCheck();
    this.logger.info(`Searching web: ${query}`);

    try {
      const params = {
        q: query,
        num: Math.min(options.num || 10, 10), // Google API限制每次最多10个结果
        start: options.start || 1,
        safe: options.safe || 'active',
        lr: options.language ? `lang_${options.language}` : undefined,
        gl: options.country || undefined,
        dateRestrict: options.dateRestrict || undefined,
        fileType: options.fileType || undefined,
        siteSearch: options.siteSearch || undefined,
        excludeTerms: options.excludeTerms || undefined,
        exactTerms: options.exactTerms || undefined,
        orTerms: options.orTerms || undefined,
        sort: options.sort || undefined
      };

      // 移除undefined值
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] === undefined) {
          delete params[key as keyof typeof params];
        }
      });

      return await this.makeRequest(params);
    } catch (error) {
      this.logger.error('Google search failed:', error);
      throw error;
    }
  }

  /**
   * 图片搜索
   */
  async searchImages(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    this.logger.info(`Searching images: ${query}`);
    
    const params = {
      q: query,
      searchType: 'image',
      num: Math.min(options.num || 10, 10),
      start: options.start || 1,
      safe: options.safe || 'active',
      imgSize: 'medium',
      imgType: 'photo',
      lr: options.language ? `lang_${options.language}` : undefined,
      gl: options.country || undefined
    };
    
    // 移除undefined值
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });
    
    return await this.makeRequest(params);
  }

  /**
   * 新闻搜索（通过站点限制）
   */
  async searchNews(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    this.logger.info(`Searching news: ${query}`);
    
    // 使用新闻网站进行搜索
    const newsSites = [
      'site:news.google.com OR site:bbc.com OR site:cnn.com OR site:reuters.com OR site:ap.org',
      'site:nytimes.com OR site:washingtonpost.com OR site:theguardian.com OR site:wsj.com'
    ];
    
    const params = {
      q: `${query} (${newsSites[0]})`,
      num: Math.min(options.num || 10, 10),
      start: options.start || 1,
      safe: options.safe || 'active',
      dateRestrict: options.dateRestrict || 'w1', // 默认搜索最近一周的新闻
      lr: options.language ? `lang_${options.language}` : undefined,
      gl: options.country || undefined,
      sort: 'date' // 按日期排序
    };
    
    // 移除undefined值
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });
    
    return await this.makeRequest(params);
  }

  /**
   * 学术搜索（通过站点限制）
   */
  async searchAcademic(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    this.logger.info(`Searching academic: ${query}`);
    
    // 使用学术网站进行搜索
    const academicSites = [
      'site:scholar.google.com OR site:arxiv.org OR site:pubmed.ncbi.nlm.nih.gov',
      'site:researchgate.net OR site:academia.edu OR site:jstor.org'
    ];
    
    const params = {
      q: `${query} (${academicSites[0]})`,
      num: Math.min(options.num || 10, 10),
      start: options.start || 1,
      safe: options.safe || 'active',
      lr: options.language ? `lang_${options.language}` : undefined,
      gl: options.country || undefined,
      fileType: options.fileType || 'pdf' // 优先搜索PDF文件
    };
    
    // 移除undefined值
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });
    
    return await this.makeRequest(params);
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳搜索类型
   */
  async smartSearch(query: string, options: SearchOptions = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    let searchResult: SearchResponse;
    
    switch (intent.type) {
      case 'image':
        searchResult = await this.searchImages(intent.query, options);
        break;
        
      case 'news':
        searchResult = await this.searchNews(intent.query, options);
        break;
        
      case 'academic':
        searchResult = await this.searchAcademic(intent.query, options);
        break;
        
      default: // 'web'
        searchResult = await this.searchWeb(query, options);
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
    
    // 图片搜索意图
    if (normalizedQuery.includes('image') || normalizedQuery.includes('photo') || 
        normalizedQuery.includes('picture') || normalizedQuery.includes('图片') ||
        normalizedQuery.includes('照片') || normalizedQuery.includes('图像')) {
      return {
        type: 'image',
        query: normalizedQuery.replace(/image|photo|picture|图片|照片|图像/g, '').trim(),
        confidence: 0.9
      };
    }
    
    // 新闻搜索意图
    if (normalizedQuery.includes('news') || normalizedQuery.includes('breaking') ||
        normalizedQuery.includes('latest') || normalizedQuery.includes('新闻') ||
        normalizedQuery.includes('最新') || normalizedQuery.includes('头条')) {
      return {
        type: 'news',
        query: normalizedQuery.replace(/news|breaking|latest|新闻|最新|头条/g, '').trim(),
        confidence: 0.85
      };
    }
    
    // 学术搜索意图
    if (normalizedQuery.includes('paper') || normalizedQuery.includes('research') ||
        normalizedQuery.includes('study') || normalizedQuery.includes('论文') ||
        normalizedQuery.includes('研究') || normalizedQuery.includes('学术') ||
        normalizedQuery.includes('pdf')) {
      return {
        type: 'academic',
        query: normalizedQuery.replace(/paper|research|study|论文|研究|学术|pdf/g, '').trim(),
        confidence: 0.8
      };
    }
    
    // 默认：网页搜索
    return {
      type: 'web',
      query: normalizedQuery,
      confidence: 0.7
    };
  }

  /**
   * 站点内搜索
   */
  async searchSite(query: string, site: string, options: SearchOptions = {}): Promise<SearchResponse> {
    this.logger.info(`Searching site ${site}: ${query}`);
    
    return await this.searchWeb(query, {
      ...options,
      siteSearch: site
    });
  }

  /**
   * 文件类型搜索
   */
  async searchFileType(query: string, fileType: string, options: SearchOptions = {}): Promise<SearchResponse> {
    this.logger.info(`Searching ${fileType} files: ${query}`);
    
    return await this.searchWeb(query, {
      ...options,
      fileType: fileType
    });
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '100 requests per day (free tier)',
      features: ['web_search', 'image_search', 'news_search', 'academic_search', 'site_search'],
      lastRequestTime: this.lastRequestTime,
      apiKey: this.API_KEY ? 'configured' : 'missing'
    };
  }

  /**
   * 验证API配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const testResult = await this.searchWeb('test', { num: 1 });
      return testResult.items && testResult.items.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取支持的搜索类型
   */
  getSupportedSearchTypes(): Record<string, string> {
    return {
      'web': 'General web search across all websites',
      'image': 'Image search with visual content',
      'news': 'News articles from major news sources',
      'academic': 'Academic papers and research content',
      'site': 'Search within specific websites',
      'filetype': 'Search for specific file types (PDF, DOC, etc.)'
    };
  }

  /**
   * 获取支持的语言
   */
  getSupportedLanguages(): Record<string, string> {
    return {
      'en': 'English',
      'zh': 'Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ru': 'Russian',
      'ar': 'Arabic',
      'pt': 'Portuguese'
    };
  }

  /**
   * 获取支持的国家/地区
   */
  getSupportedCountries(): Record<string, string> {
    return {
      'us': 'United States',
      'cn': 'China',
      'uk': 'United Kingdom',
      'ca': 'Canada',
      'au': 'Australia',
      'de': 'Germany',
      'fr': 'France',
      'jp': 'Japan',
      'kr': 'South Korea',
      'in': 'India'
    };
  }
}
