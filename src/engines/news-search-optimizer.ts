/**
 * 新闻搜索优化器 - 解决TechCrunch、BBC、Reuters搜索问题
 * 实现智能搜索策略、User-Agent轮换、备选数据源
 */

import { Logger } from '../utils/logger.js';
import { ToolOutput } from '../types.js';

const logger = new Logger('NewsSearchOptimizer');

interface NewsResult {
  id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  publishedAt?: string;
  summary?: string;
  author?: string;
}

interface SearchStrategy {
  baseUrl?: string;
  queryParams?: (query: string) => Record<string, any>;
  headers?: Record<string, string>;
  parser?: (response: any) => NewsResult[];
  searchQueries?: (query: string) => string[];
}

export class NewsSearchOptimizer {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];

  private searchStrategies: Record<string, SearchStrategy> = {
    techcrunch: {
      // 尝试多种搜索策略
      searchQueries: (query: string) => [
        `site:techcrunch.com "${query}"`,
        `"${query}" site:techcrunch.com startup`,
        `site:techcrunch.com ${query} technology`,
        `techcrunch.com "${query}" news`,
        `"${query}" techcrunch startup tech`
      ]
    },
    bbc: {
      searchQueries: (query: string) => [
        `site:bbc.com/news/technology "${query}"`,
        `site:bbc.co.uk/news/technology "${query}"`,
        `"${query}" site:bbc.com technology`,
        `bbc technology "${query}"`,
        `"${query}" bbc tech news`
      ]
    },
    reuters: {
      searchQueries: (query: string) => [
        `site:reuters.com/technology "${query}"`,
        `"${query}" site:reuters.com technology`,
        `site:reuters.com/business/technology "${query}"`,
        `reuters technology "${query}"`,
        `"${query}" reuters tech business`
      ]
    }
  };

  private alternativeSources: Record<string, string[]> = {
    techcrunch: [
      'venturebeat.com',
      'techradar.com',
      'theverge.com',
      'engadget.com'
    ],
    bbc: [
      'cnn.com/business/tech',
      'theguardian.com/technology',
      'independent.co.uk/tech'
    ],
    reuters: [
      'bloomberg.com/technology',
      'wsj.com/tech',
      'ft.com/technology'
    ]
  };

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 主要搜索方法
   */
  async searchNews(platform: string, query: string, maxResults: number = 10): Promise<NewsResult[]> {
    const strategy = this.searchStrategies[platform];
    if (!strategy) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    logger.info(`Starting optimized search for ${platform}: ${query}`);

    try {
      // 尝试主要搜索策略
      const results = await this.primarySearch(platform, query, maxResults);
      
      if (results.length > 0) {
        logger.info(`Primary search successful for ${platform}: ${results.length} results`);
        return results;
      }

      // 如果主要搜索失败，尝试备选方案
      logger.warn(`Primary search failed for ${platform}, trying fallback`);
      return await this.fallbackSearch(platform, query, maxResults);

    } catch (error) {
      logger.error(`Search failed for ${platform}:`, error);
      
      // 最后尝试备选数据源
      return await this.fallbackSearch(platform, query, maxResults);
    }
  }

  /**
   * 主要搜索策略 - 使用Google Custom Search API
   */
  private async primarySearch(platform: string, query: string, maxResults: number): Promise<NewsResult[]> {
    const strategy = this.searchStrategies[platform];
    const searchQueries = strategy.searchQueries!(query);
    const results: NewsResult[] = [];

    // 首先尝试Google Custom Search API
    try {
      const googleResults = await this.googleCustomSearch(platform, query, maxResults);
      if (googleResults.length > 0) {
        logger.info(`Google Custom Search found ${googleResults.length} results for ${platform}`);
        return googleResults;
      }
    } catch (error) {
      logger.warn(`Google Custom Search failed for ${platform}:`, error);
    }

    // 如果Google搜索失败，使用传统搜索引擎
    const searchEngines = [
      'https://duckduckgo.com/html/?q=',
      'https://www.bing.com/search?q=',
      'https://search.yahoo.com/search?p='
    ];

    for (const searchQuery of searchQueries.slice(0, 2)) { // 减少查询数量
      for (const engine of searchEngines.slice(0, 2)) { // 只使用前两个引擎
        try {
          const searchUrl = `${engine}${encodeURIComponent(searchQuery)}`;
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': this.getRandomUserAgent(),
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            signal: AbortSignal.timeout(10000)
          });

          if (response.ok) {
            const html = await response.text();
            const extractedResults = this.extractResultsFromSearch(html, platform);
            results.push(...extractedResults);

            // 如果获得足够结果，提前返回
            if (results.length >= maxResults) {
              return results.slice(0, maxResults);
            }
          }

          // 添加延迟避免被限制
          await this.delay(2000 + Math.random() * 3000);

        } catch (error) {
          logger.warn(`Search engine ${engine} failed for ${platform}:`, error);
          continue;
        }
      }
    }

    return this.deduplicateResults(results).slice(0, maxResults);
  }

  /**
   * Google Custom Search API搜索
   */
  private async googleCustomSearch(platform: string, query: string, maxResults: number): Promise<NewsResult[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new Error('Google API credentials not configured');
    }

    const siteRestriction = this.getSiteRestriction(platform);
    const searchQuery = `${query} ${siteRestriction}`;

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=${Math.min(maxResults, 10)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Google Custom Search API failed: ${response.status}`);
    }

    const data = await response.json();
    const results: NewsResult[] = [];

    if (data.items) {
      for (const item of data.items) {
        if (this.isValidNewsUrl(item.link, platform)) {
          results.push({
            id: this.extractIdFromUrl(item.link),
            title: item.title || 'News Article',
            url: item.link,
            source: this.getSourceName(platform),
            type: 'news-article',
            summary: item.snippet || undefined,
            publishedAt: this.extractDateFromSnippet(item.snippet)
          });
        }
      }
    }

    return results;
  }

  /**
   * 获取平台的站点限制
   */
  private getSiteRestriction(platform: string): string {
    switch (platform) {
      case 'techcrunch':
        return 'site:techcrunch.com';
      case 'bbc':
        return 'site:bbc.com/news/technology OR site:bbc.co.uk/news/technology';
      case 'reuters':
        return 'site:reuters.com/technology OR site:reuters.com/business/technology';
      default:
        return '';
    }
  }

  /**
   * 获取源名称
   */
  private getSourceName(platform: string): string {
    switch (platform) {
      case 'techcrunch':
        return 'TechCrunch';
      case 'bbc':
        return 'BBC Technology';
      case 'reuters':
        return 'Reuters Technology';
      default:
        return platform;
    }
  }

  /**
   * 从摘要中提取日期
   */
  private extractDateFromSnippet(snippet: string): string | undefined {
    if (!snippet) return undefined;

    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /(\w+ \d{1,2}, \d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2} \w+ \d{4})/
    ];

    for (const pattern of datePatterns) {
      const match = snippet.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * 备选搜索策略
   */
  private async fallbackSearch(platform: string, query: string, maxResults: number): Promise<NewsResult[]> {
    const alternativeSources = this.alternativeSources[platform] || [];
    const results: NewsResult[] = [];

    logger.info(`Trying fallback search for ${platform} with ${alternativeSources.length} alternative sources`);

    for (const source of alternativeSources) {
      try {
        const searchQuery = `site:${source} "${query}"`;
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://duckduckgo.com/'
          },
          signal: AbortSignal.timeout(8000)
        });

        if (response.ok) {
          const html = await response.text();
          const extractedResults = this.extractAlternativeResults(html, source);
          results.push(...extractedResults);

          if (results.length >= maxResults) {
            break;
          }
        }

        await this.delay(1500);

      } catch (error) {
        logger.warn(`Fallback search failed for ${source}:`, error);
        continue;
      }
    }

    return this.deduplicateResults(results).slice(0, maxResults);
  }

  /**
   * 从搜索结果中提取新闻链接
   */
  private extractResultsFromSearch(html: string, platform: string): NewsResult[] {
    const results: NewsResult[] = [];
    
    let urlPattern: RegExp;
    let sourceName: string;

    switch (platform) {
      case 'techcrunch':
        urlPattern = /https?:\/\/techcrunch\.com\/[^\s"<>]+/gi;
        sourceName = 'TechCrunch';
        break;
      case 'bbc':
        urlPattern = /https?:\/\/(?:www\.)?bbc\.co(?:m|\.uk)\/news\/technology\/[^\s"<>]+/gi;
        sourceName = 'BBC Technology';
        break;
      case 'reuters':
        urlPattern = /https?:\/\/(?:www\.)?reuters\.com\/(?:technology|business\/technology)\/[^\s"<>]+/gi;
        sourceName = 'Reuters Technology';
        break;
      default:
        return results;
    }

    const urls = html.match(urlPattern) || [];
    
    for (const url of urls) {
      try {
        const cleanUrl = url.replace(/['"<>]/g, '');
        
        // 过滤掉不需要的URL
        if (this.isValidNewsUrl(cleanUrl, platform)) {
          results.push({
            id: this.extractIdFromUrl(cleanUrl),
            title: this.extractTitleFromSearchResult(html, cleanUrl),
            url: cleanUrl,
            source: sourceName,
            type: 'news-article',
            publishedAt: this.extractDateFromSearchResult(html, cleanUrl)
          });
        }
      } catch (error) {
        // 跳过无效URL
        continue;
      }
    }

    return results;
  }

  /**
   * 从备选源提取结果
   */
  private extractAlternativeResults(html: string, source: string): NewsResult[] {
    const results: NewsResult[] = [];
    const urlPattern = new RegExp(`https?:\\/\\/(?:www\\.)?${source.replace('.', '\\.')}\/[^\\s"<>]+`, 'gi');
    const urls = html.match(urlPattern) || [];

    for (const url of urls) {
      try {
        const cleanUrl = url.replace(/['"<>]/g, '');
        results.push({
          id: this.extractIdFromUrl(cleanUrl),
          title: this.extractTitleFromSearchResult(html, cleanUrl),
          url: cleanUrl,
          source: source,
          type: 'news-article'
        });
      } catch (error) {
        continue;
      }
    }

    return results;
  }

  /**
   * 验证新闻URL是否有效
   */
  private isValidNewsUrl(url: string, platform: string): boolean {
    // 排除标签页、作者页等
    const excludePatterns = [
      '/tag/', '/author/', '/category/', '/search/',
      '/about', '/contact', '/privacy', '/terms'
    ];

    for (const pattern of excludePatterns) {
      if (url.includes(pattern)) {
        return false;
      }
    }

    // 确保是文章URL
    switch (platform) {
      case 'techcrunch':
        return url.includes('techcrunch.com/') && url.split('/').length >= 5;
      case 'bbc':
        return url.includes('/news/technology/') && /\d{8}/.test(url);
      case 'reuters':
        return (url.includes('/technology/') || url.includes('/business/technology/')) && 
               url.split('/').length >= 6;
      default:
        return true;
    }
  }

  /**
   * 去重结果
   */
  private deduplicateResults(results: NewsResult[]): NewsResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.url.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 从URL提取ID
   */
  private extractIdFromUrl(url: string): string {
    return Buffer.from(url).toString('base64').substring(0, 16);
  }

  /**
   * 从搜索结果提取标题
   */
  private extractTitleFromSearchResult(html: string, url: string): string {
    // 简单的标题提取逻辑
    const urlIndex = html.indexOf(url);
    if (urlIndex === -1) return 'News Article';

    // 查找附近的标题标签
    const beforeUrl = html.substring(Math.max(0, urlIndex - 500), urlIndex);
    const afterUrl = html.substring(urlIndex, urlIndex + 500);
    
    const titleMatch = (beforeUrl + afterUrl).match(/<[^>]*title[^>]*>([^<]+)</i) ||
                      (beforeUrl + afterUrl).match(/title="([^"]+)"/i) ||
                      (beforeUrl + afterUrl).match(/>([^<]{10,100})</);
    
    return titleMatch ? titleMatch[1].trim() : 'News Article';
  }

  /**
   * 从搜索结果提取日期
   */
  private extractDateFromSearchResult(html: string, url: string): string | undefined {
    const urlIndex = html.indexOf(url);
    if (urlIndex === -1) return undefined;

    const context = html.substring(Math.max(0, urlIndex - 200), urlIndex + 200);
    const dateMatch = context.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\w+ \d{1,2}, \d{4})/);
    
    return dateMatch ? dateMatch[1] : undefined;
  }
}

export default NewsSearchOptimizer;
