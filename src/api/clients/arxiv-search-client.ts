import axios, { AxiosInstance } from 'axios';
// Note: xml2js will be imported dynamically to handle ES modules
import { Logger } from '../../utils/logger.js';

/**
 * arXiv 搜索客户端 - 专注于学术论文搜索场景
 * 支持论文搜索、作者搜索、分类浏览、论文详情获取
 */

interface SearchOptions {
  start?: number;
  maxResults?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
}

interface AuthorOptions extends SearchOptions {
  exactMatch?: boolean;
}

interface CategoryOptions extends SearchOptions {
  subcategories?: boolean;
}

interface ArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  categories: string[];
  published: string;
  updated: string;
  pdfUrl: string;
  abstractUrl: string;
  doi?: string;
  journalRef?: string;
  comments?: string;
}

interface SearchResult {
  query: string;
  papers: ArxivPaper[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
}

export class ArxivSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 3000; // 3秒延迟，遵循arXiv建议

  // arXiv主要学科分类
  private readonly ARXIV_CATEGORIES = {
    'cs': 'Computer Science',
    'math': 'Mathematics',
    'physics': 'Physics',
    'astro-ph': 'Astrophysics',
    'cond-mat': 'Condensed Matter',
    'gr-qc': 'General Relativity and Quantum Cosmology',
    'hep-ex': 'High Energy Physics - Experiment',
    'hep-lat': 'High Energy Physics - Lattice',
    'hep-ph': 'High Energy Physics - Phenomenology',
    'hep-th': 'High Energy Physics - Theory',
    'math-ph': 'Mathematical Physics',
    'nlin': 'Nonlinear Sciences',
    'nucl-ex': 'Nuclear Experiment',
    'nucl-th': 'Nuclear Theory',
    'q-bio': 'Quantitative Biology',
    'q-fin': 'Quantitative Finance',
    'quant-ph': 'Quantum Physics',
    'stat': 'Statistics'
  };

  constructor() {
    this.logger = new Logger('ArxivSearch');
    
    this.httpClient = axios.create({
      baseURL: 'http://export.arxiv.org/api',
      timeout: 30000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0 (https://github.com/open-search-mcp)'
      }
    });
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
      return response.data;
    } catch (error) {
      this.logger.error('arXiv API request failed:', error);
      throw error;
    }
  }

  /**
   * 解析arXiv XML响应
   */
  private async parseArxivXML(xmlData: string): Promise<any> {
    try {
      // 动态导入xml2js以处理ES模块
      const { parseStringPromise } = await import('xml2js');

      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true
      });

      return result;
    } catch (error) {
      this.logger.error('XML parsing failed:', error);
      throw new Error('Failed to parse arXiv response');
    }
  }

  /**
   * 格式化论文数据
   */
  private formatPaper(entry: any): ArxivPaper {
    // 处理作者信息
    let authors: string[] = [];
    if (entry.author) {
      if (Array.isArray(entry.author)) {
        authors = entry.author.map((author: any) => author.name || author);
      } else {
        authors = [entry.author.name || entry.author];
      }
    }

    // 处理分类信息
    let categories: string[] = [];
    if (entry.category) {
      if (Array.isArray(entry.category)) {
        categories = entry.category.map((cat: any) => cat.term || cat);
      } else {
        categories = [entry.category.term || entry.category];
      }
    }

    // 提取链接
    let pdfUrl = '';
    let abstractUrl = '';
    
    if (entry.link) {
      const links = Array.isArray(entry.link) ? entry.link : [entry.link];
      
      for (const link of links) {
        if (link.type === 'application/pdf') {
          pdfUrl = link.href;
        } else if (link.type === 'text/html') {
          abstractUrl = link.href;
        }
      }
    }

    // 提取arXiv ID
    const id = entry.id ? entry.id.split('/').pop() : '';

    return {
      id,
      title: entry.title || '',
      summary: entry.summary || '',
      authors,
      categories,
      published: entry.published || '',
      updated: entry.updated || '',
      pdfUrl,
      abstractUrl,
      doi: entry['arxiv:doi'] || undefined,
      journalRef: entry['arxiv:journal_ref'] || undefined,
      comments: entry['arxiv:comment'] || undefined
    };
  }

  /**
   * 搜索arXiv论文
   */
  async searchPapers(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const start = options.start || 0;
    const maxResults = Math.min(options.maxResults || 10, 100); // 限制最大结果数
    
    this.logger.info(`Searching arXiv: ${query}`);
    
    const params = {
      search_query: query,
      start,
      max_results: maxResults,
      sortBy: options.sortBy || 'relevance',
      sortOrder: options.sortOrder || 'descending'
    };
    
    const xmlData = await this.makeRequest('/query', params);
    const parsed = await this.parseArxivXML(xmlData);
    
    if (!parsed.feed) {
      throw new Error('Invalid arXiv response format');
    }
    
    const feed = parsed.feed;
    const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
    
    const papers = entries.map((entry: any) => this.formatPaper(entry));
    
    // 提取总结果数
    const totalResults = parseInt(feed['opensearch:totalResults']) || papers.length;
    const startIndex = parseInt(feed['opensearch:startIndex']) || start;
    const itemsPerPage = parseInt(feed['opensearch:itemsPerPage']) || papers.length;
    
    return {
      query,
      papers,
      totalResults,
      startIndex,
      itemsPerPage
    };
  }

  /**
   * 根据arXiv ID获取论文详情
   */
  async getPaperDetails(id: string): Promise<ArxivPaper> {
    this.logger.info(`Getting paper details: ${id}`);
    
    // 清理ID格式
    const cleanId = id.replace(/^(arXiv:|arxiv:)/i, '');
    
    const params = {
      id_list: cleanId
    };
    
    const xmlData = await this.makeRequest('/query', params);
    const parsed = await this.parseArxivXML(xmlData);
    
    if (!parsed.feed || !parsed.feed.entry) {
      throw new Error(`Paper not found: ${id}`);
    }
    
    const entry = Array.isArray(parsed.feed.entry) ? parsed.feed.entry[0] : parsed.feed.entry;
    return this.formatPaper(entry);
  }

  /**
   * 按作者搜索论文
   */
  async searchByAuthor(author: string, options: AuthorOptions = {}): Promise<SearchResult> {
    this.logger.info(`Searching papers by author: ${author}`);
    
    // 构建作者查询
    const authorQuery = options.exactMatch 
      ? `au:"${author}"` 
      : `au:${author}`;
    
    return await this.searchPapers(authorQuery, options);
  }

  /**
   * 按分类搜索论文
   */
  async searchByCategory(category: string, options: CategoryOptions = {}): Promise<SearchResult> {
    this.logger.info(`Searching papers by category: ${category}`);
    
    // 构建分类查询
    let categoryQuery = `cat:${category}`;
    
    // 如果启用子分类搜索
    if (options.subcategories && !category.includes('*')) {
      categoryQuery = `cat:${category}*`;
    }
    
    return await this.searchPapers(categoryQuery, options);
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳方法
   */
  async smartSearch(query: string, options: any = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    switch (intent.type) {
      case 'paper_id':
        const paperDetails = await this.getPaperDetails(intent.id!);
        return {
          type: 'paper_details',
          query,
          result: paperDetails
        };
        
      case 'author':
        const authorResult = await this.searchByAuthor(intent.author!, options);
        return {
          type: 'author_search',
          query,
          result: authorResult
        };
        
      case 'category':
        const categoryResult = await this.searchByCategory(intent.category!, options);
        return {
          type: 'category_search',
          query,
          result: categoryResult
        };
        
      default: // 'general'
        const searchResult = await this.searchPapers(query, options);
        return {
          type: 'general_search',
          query,
          result: searchResult
        };
    }
  }

  /**
   * 分析搜索意图
   */
  private analyzeSearchIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // arXiv ID查询
    const arxivIdPattern = /(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)/i;
    const idMatch = query.match(arxivIdPattern);
    if (idMatch) {
      return {
        type: 'paper_id',
        id: idMatch[1]
      };
    }
    
    // 作者查询
    if (normalizedQuery.includes('papers by') || normalizedQuery.includes('author:') || 
        normalizedQuery.includes('by ') || normalizedQuery.includes('researcher')) {
      const author = this.extractAuthor(query);
      if (author) {
        return {
          type: 'author',
          author
        };
      }
    }
    
    // 分类查询
    if (normalizedQuery.includes('cat:') || normalizedQuery.includes('category:')) {
      const category = this.extractCategory(query);
      if (category) {
        return {
          type: 'category',
          category
        };
      }
    }
    
    // 检查是否为已知分类
    for (const [catCode, catName] of Object.entries(this.ARXIV_CATEGORIES)) {
      if (normalizedQuery.includes(catCode) || normalizedQuery.includes(catName.toLowerCase())) {
        return {
          type: 'category',
          category: catCode
        };
      }
    }
    
    // 默认：一般搜索
    return {
      type: 'general'
    };
  }

  /**
   * 从查询中提取作者名
   */
  private extractAuthor(query: string): string | undefined {
    // 移除常见的作者查询词汇
    const authorWords = ['papers by', 'author:', 'by ', 'researcher', 'author'];
    let author = query;
    
    authorWords.forEach(word => {
      author = author.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    return author || undefined;
  }

  /**
   * 从查询中提取分类
   */
  private extractCategory(query: string): string | undefined {
    const catMatch = query.match(/(?:cat:|category:)\s*([a-z-]+(?:\.[A-Z]{2})?)/i);
    return catMatch ? catMatch[1] : undefined;
  }

  /**
   * 获取支持的分类列表
   */
  getSupportedCategories(): Record<string, string> {
    return { ...this.ARXIV_CATEGORIES };
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '1 request per 3 seconds (recommended)',
      features: ['search', 'paper_details', 'author_search', 'category_search'],
      supportedCategories: Object.keys(this.ARXIV_CATEGORIES).length,
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * 验证arXiv ID格式
   */
  validateArxivId(id: string): boolean {
    const arxivIdPattern = /^\d{4}\.\d{4,5}(?:v\d+)?$/;
    const cleanId = id.replace(/^(arXiv:|arxiv:)/i, '');
    return arxivIdPattern.test(cleanId);
  }


}
