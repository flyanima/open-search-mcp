import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * Wikipedia 搜索客户端 - 专注于知识搜索场景
 * 支持多语言维基百科搜索、内容获取、摘要生成
 */

interface SearchOptions {
  limit?: number;
  namespace?: number;
  language?: string;
}

interface ContentOptions {
  section?: number;
  language?: string;
  format?: 'text' | 'html';
}

interface SearchResult {
  query: string;
  results: Array<{
    title: string;
    description: string;
    url: string;
    extract?: string;
  }>;
  language: string;
  totalResults: number;
}

interface PageSummary {
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
  language: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
}

interface PageContent {
  title: string;
  content: string;
  sections: Array<{
    title: string;
    content: string;
    level: number;
  }>;
  url: string;
  language: string;
}

export class WikipediaSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;

  // 支持的语言版本
  private readonly SUPPORTED_LANGUAGES = {
    'zh': 'zh.wikipedia.org',
    'en': 'en.wikipedia.org',
    'ja': 'ja.wikipedia.org',
    'fr': 'fr.wikipedia.org',
    'de': 'de.wikipedia.org',
    'es': 'es.wikipedia.org',
    'it': 'it.wikipedia.org',
    'pt': 'pt.wikipedia.org',
    'ru': 'ru.wikipedia.org',
    'ar': 'ar.wikipedia.org'
  };

  constructor() {
    this.logger = new Logger('WikipediaSearch');
    
    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0 (https://github.com/open-search-mcp)',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * 通用API请求方法
   */
  private async makeRequest(url: string, params: Record<string, any> = {}): Promise<any> {
    this.requestCount++;
    
    try {
      const response = await this.httpClient.get(url, { params });
      return response.data;
    } catch (error) {
      this.logger.error('Wikipedia API request failed:', error);
      throw error;
    }
  }

  /**
   * 检测查询语言
   */
  private detectLanguage(query: string): string {
    // 检测中文
    if (/[\u4e00-\u9fff]/.test(query)) {
      return 'zh';
    }
    
    // 检测日文
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(query)) {
      return 'ja';
    }
    
    // 检测阿拉伯文
    if (/[\u0600-\u06ff]/.test(query)) {
      return 'ar';
    }
    
    // 默认英文
    return 'en';
  }

  /**
   * 获取语言对应的API基础URL
   */
  private getAPIBaseURL(language: string): string {
    const domain = this.SUPPORTED_LANGUAGES[language as keyof typeof this.SUPPORTED_LANGUAGES] || 'en.wikipedia.org';
    return `https://${domain}/w/api.php`;
  }

  /**
   * 获取REST API基础URL
   */
  private getRestAPIBaseURL(language: string): string {
    const domain = this.SUPPORTED_LANGUAGES[language as keyof typeof this.SUPPORTED_LANGUAGES] || 'en.wikipedia.org';
    return `https://${domain}/api/rest_v1`;
  }

  /**
   * 搜索维基百科页面 (OpenSearch API)
   */
  async searchPages(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const language = options.language || this.detectLanguage(query);
    const limit = options.limit || 10;
    
    this.logger.info(`Searching Wikipedia: ${query} (${language})`);
    
    const baseURL = this.getAPIBaseURL(language);
    const params = {
      action: 'opensearch',
      search: query,
      limit: Math.min(limit, 50),
      namespace: options.namespace || 0,
      format: 'json',
      redirects: 'resolve'
    };
    
    const data = await this.makeRequest(baseURL, params);
    
    // OpenSearch返回格式: [query, titles, descriptions, urls]
    const [searchQuery, titles, descriptions, urls] = data;
    
    const results = titles.map((title: string, index: number) => ({
      title,
      description: descriptions[index] || '',
      url: urls[index] || '',
      extract: descriptions[index] || ''
    }));

    return {
      query: searchQuery,
      results,
      language,
      totalResults: results.length
    };
  }

  /**
   * 获取页面摘要 (REST API)
   */
  async getPageSummary(title: string, language?: string): Promise<PageSummary> {
    const lang = language || this.detectLanguage(title);
    
    this.logger.info(`Getting summary for: ${title} (${lang})`);
    
    const baseURL = this.getRestAPIBaseURL(lang);
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `${baseURL}/page/summary/${encodedTitle}`;
    
    try {
      const data = await this.makeRequest(url);
      
      return {
        title: data.title,
        extract: data.extract || data.description || '',
        url: data.content_urls?.desktop?.page || '',
        thumbnail: data.thumbnail?.source,
        language: lang,
        coordinates: data.coordinates ? {
          lat: data.coordinates.lat,
          lon: data.coordinates.lon
        } : undefined
      };
    } catch (error) {
      // 如果REST API失败，尝试使用传统API
      return await this.getPageSummaryFallback(title, lang);
    }
  }

  /**
   * 获取页面摘要的备用方法 (传统API)
   */
  private async getPageSummaryFallback(title: string, language: string): Promise<PageSummary> {
    const baseURL = this.getAPIBaseURL(language);
    const params = {
      action: 'query',
      format: 'json',
      titles: title,
      prop: 'extracts|pageimages|info',
      exintro: true,
      explaintext: true,
      exsectionformat: 'plain',
      piprop: 'thumbnail',
      pithumbsize: 300,
      inprop: 'url'
    };
    
    const data = await this.makeRequest(baseURL, params);
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    
    if (!page || page.missing) {
      throw new Error(`Page not found: ${title}`);
    }
    
    return {
      title: page.title,
      extract: page.extract || '',
      url: page.fullurl || '',
      thumbnail: page.thumbnail?.source,
      language
    };
  }

  /**
   * 获取页面完整内容
   */
  async getPageContent(title: string, options: ContentOptions = {}): Promise<PageContent> {
    const language = options.language || this.detectLanguage(title);
    
    this.logger.info(`Getting content for: ${title} (${language})`);
    
    const baseURL = this.getAPIBaseURL(language);
    const params = {
      action: 'parse',
      format: 'json',
      page: title,
      prop: 'text|sections',
      section: options.section,
      redirects: true
    };
    
    const data = await this.makeRequest(baseURL, params);
    
    if (data.error) {
      throw new Error(data.error.info || 'Failed to get page content');
    }
    
    const parseData = data.parse;
    const sections = parseData.sections || [];
    
    // 提取纯文本内容
    let content = parseData.text?.['*'] || '';
    if (options.format === 'text') {
      content = this.extractTextFromHTML(content);
    }
    
    return {
      title: parseData.title,
      content,
      sections: sections.map((section: any) => ({
        title: section.line,
        content: '', // 需要单独获取每个章节的内容
        level: parseInt(section.level)
      })),
      url: `https://${this.SUPPORTED_LANGUAGES[language as keyof typeof this.SUPPORTED_LANGUAGES]}/${parseData.title}`,
      language
    };
  }

  /**
   * 获取相关页面
   */
  async getRelatedPages(title: string, language?: string): Promise<Array<{ title: string; description: string; url: string }>> {
    const lang = language || this.detectLanguage(title);
    
    this.logger.info(`Getting related pages for: ${title} (${lang})`);
    
    // 尝试使用REST API获取相关页面
    try {
      const baseURL = this.getRestAPIBaseURL(lang);
      const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
      const url = `${baseURL}/page/related/${encodedTitle}`;
      
      const data = await this.makeRequest(url);
      
      return (data.pages || []).slice(0, 10).map((page: any) => ({
        title: page.title,
        description: page.description || page.extract || '',
        url: page.content_urls?.desktop?.page || ''
      }));
    } catch (error) {
      // 如果REST API失败，使用链接页面作为相关页面
      return await this.getLinkedPages(title, lang);
    }
  }

  /**
   * 获取链接页面作为相关页面的备用方法
   */
  private async getLinkedPages(title: string, language: string): Promise<Array<{ title: string; description: string; url: string }>> {
    const baseURL = this.getAPIBaseURL(language);
    const params = {
      action: 'query',
      format: 'json',
      titles: title,
      prop: 'links',
      pllimit: 10,
      plnamespace: 0
    };
    
    const data = await this.makeRequest(baseURL, params);
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    
    if (!page || !page.links) {
      return [];
    }
    
    const domain = this.SUPPORTED_LANGUAGES[language as keyof typeof this.SUPPORTED_LANGUAGES];
    
    return page.links.map((link: any) => ({
      title: link.title,
      description: '',
      url: `https://${domain}/wiki/${encodeURIComponent(link.title.replace(/ /g, '_'))}`
    }));
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳方法
   */
  async smartSearch(query: string, options: any = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    switch (intent.type) {
      case 'summary':
        const summaryResult = await this.getPageSummary(intent.title || query, intent.language);
        return {
          type: 'summary',
          query,
          result: summaryResult
        };
        
      case 'content':
        const contentResult = await this.getPageContent(intent.title || query, { language: intent.language });
        return {
          type: 'content',
          query,
          result: contentResult
        };
        
      case 'related':
        const relatedResult = await this.getRelatedPages(intent.title || query, intent.language);
        return {
          type: 'related',
          query,
          result: relatedResult
        };
        
      default: // 'search'
        const searchResult = await this.searchPages(query, { language: intent.language, ...options });
        return {
          type: 'search',
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
    
    // 摘要查询
    if (normalizedQuery.includes('摘要') || normalizedQuery.includes('summary') || 
        normalizedQuery.includes('简介') || normalizedQuery.includes('介绍')) {
      return {
        type: 'summary',
        title: this.extractTitle(query),
        language: this.detectLanguage(query)
      };
    }
    
    // 相关查询
    if (normalizedQuery.includes('相关') || normalizedQuery.includes('related')) {
      return {
        type: 'related',
        title: this.extractTitle(query),
        language: this.detectLanguage(query)
      };
    }
    
    // 内容查询
    if (normalizedQuery.includes('内容') || normalizedQuery.includes('content') || 
        normalizedQuery.includes('详细') || normalizedQuery.includes('详情')) {
      return {
        type: 'content',
        title: this.extractTitle(query),
        language: this.detectLanguage(query)
      };
    }
    
    // 默认：搜索
    return {
      type: 'search',
      language: this.detectLanguage(query)
    };
  }

  /**
   * 从查询中提取标题
   */
  private extractTitle(query: string): string {
    const stopWords = ['摘要', 'summary', '简介', '介绍', '相关', 'related', '内容', 'content', '详细', '详情'];
    let title = query;
    
    stopWords.forEach(word => {
      title = title.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    return title || query;
  }

  /**
   * 从HTML中提取纯文本
   */
  private extractTextFromHTML(html: string): string {
    // 简单的HTML标签移除
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      supportedLanguages: Object.keys(this.SUPPORTED_LANGUAGES),
      features: ['search', 'summary', 'content', 'related'],
      rateLimits: 'None (reasonable use expected)'
    };
  }


}
