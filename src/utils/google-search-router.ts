import { Logger } from './logger.js';

/**
 * Google 搜索路由器 - 智能分析用户查询并路由到最佳Google搜索方法
 * 支持网页搜索、图片搜索、新闻搜索、学术搜索等
 */

export interface GoogleSearchRoute {
  searchType: 'web' | 'image' | 'news' | 'academic' | 'site' | 'filetype';
  query: string;
  originalQuery: string;
  site?: string;
  fileType?: string;
  language?: string;
  country?: string;
  dateRestrict?: string;
  confidence: number;
  reasoning: string;
  suggestions?: string[];
}

export class GoogleSearchRouter {
  private logger: Logger;

  // 搜索类型关键词映射
  private readonly SEARCH_TYPE_KEYWORDS = {
    image: ['image', 'photo', 'picture', 'pic', 'img', '图片', '照片', '图像', 'visual'],
    news: ['news', 'breaking', 'latest', 'headline', '新闻', '最新', '头条', 'current events'],
    academic: ['paper', 'research', 'study', 'academic', 'scholar', '论文', '研究', '学术', 'pdf', 'journal'],
    site: ['site:', 'in site', 'from site', '站内搜索', 'within'],
    filetype: ['filetype:', 'file type', 'pdf', 'doc', 'ppt', 'xls', '文件类型']
  };

  // 常用网站映射
  private readonly POPULAR_SITES = {
    'github': 'github.com',
    'stackoverflow': 'stackoverflow.com',
    'wikipedia': 'wikipedia.org',
    'reddit': 'reddit.com',
    'youtube': 'youtube.com',
    'twitter': 'twitter.com',
    'facebook': 'facebook.com',
    'linkedin': 'linkedin.com',
    'medium': 'medium.com',
    'quora': 'quora.com',
    'amazon': 'amazon.com',
    'google': 'google.com',
    'microsoft': 'microsoft.com',
    'apple': 'apple.com',
    'netflix': 'netflix.com'
  };

  // 文件类型映射
  private readonly FILE_TYPES = {
    'pdf': 'PDF documents',
    'doc': 'Word documents',
    'docx': 'Word documents',
    'ppt': 'PowerPoint presentations',
    'pptx': 'PowerPoint presentations',
    'xls': 'Excel spreadsheets',
    'xlsx': 'Excel spreadsheets',
    'txt': 'Text files',
    'csv': 'CSV files',
    'json': 'JSON files',
    'xml': 'XML files',
    'zip': 'ZIP archives',
    'mp3': 'Audio files',
    'mp4': 'Video files',
    'jpg': 'JPEG images',
    'png': 'PNG images',
    'gif': 'GIF images'
  };

  // 语言检测关键词
  private readonly LANGUAGE_INDICATORS = {
    'zh': ['中文', '中国', '汉语', '普通话'],
    'ja': ['日本', '日语', 'japanese'],
    'ko': ['韩国', '韩语', 'korean'],
    'es': ['español', 'spanish', '西班牙'],
    'fr': ['français', 'french', '法语'],
    'de': ['deutsch', 'german', '德语'],
    'ru': ['русский', 'russian', '俄语'],
    'ar': ['عربي', 'arabic', '阿拉伯']
  };

  constructor() {
    this.logger = new Logger('GoogleSearchRouter');
  }

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): GoogleSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 1. 检查站点搜索
    const siteRoute = this.checkSiteSearch(normalizedQuery, query);
    if (siteRoute) return siteRoute;
    
    // 2. 检查文件类型搜索
    const fileTypeRoute = this.checkFileTypeSearch(normalizedQuery, query);
    if (fileTypeRoute) return fileTypeRoute;
    
    // 3. 检查图片搜索
    const imageRoute = this.checkImageSearch(normalizedQuery, query);
    if (imageRoute) return imageRoute;
    
    // 4. 检查新闻搜索
    const newsRoute = this.checkNewsSearch(normalizedQuery, query);
    if (newsRoute) return newsRoute;
    
    // 5. 检查学术搜索
    const academicRoute = this.checkAcademicSearch(normalizedQuery, query);
    if (academicRoute) return academicRoute;
    
    // 6. 默认：通用网页搜索
    return this.createWebSearchRoute(query, normalizedQuery);
  }

  /**
   * 检查站点搜索
   */
  private checkSiteSearch(normalizedQuery: string, originalQuery: string): GoogleSearchRoute | null {
    // 检查 site: 语法
    const siteMatch = normalizedQuery.match(/site:([^\s]+)/);
    if (siteMatch) {
      const site = siteMatch[1];
      const cleanQuery = normalizedQuery.replace(/site:[^\s]+/g, '').trim();
      
      return {
        searchType: 'site',
        query: cleanQuery,
        originalQuery,
        site,
        confidence: 0.95,
        reasoning: `Detected site search syntax: site:${site}`,
        suggestions: [
          'Use site: syntax for specific website searches',
          'Try popular sites like site:github.com or site:stackoverflow.com',
          'Combine with other search terms for better results'
        ]
      };
    }
    
    // 检查常用网站名称
    for (const [siteName, siteUrl] of Object.entries(this.POPULAR_SITES)) {
      if (normalizedQuery.includes(siteName) && 
          (normalizedQuery.includes('in') || normalizedQuery.includes('from') || 
           normalizedQuery.includes('on') || normalizedQuery.includes('站内'))) {
        const cleanQuery = normalizedQuery.replace(new RegExp(`\\b(in|from|on|站内)\\s*${siteName}\\b`, 'g'), '').trim();
        
        return {
          searchType: 'site',
          query: cleanQuery,
          originalQuery,
          site: siteUrl,
          confidence: 0.8,
          reasoning: `Detected site search intent for ${siteName}`,
          suggestions: [
            `Searching within ${siteUrl}`,
            'Try more specific keywords for better results',
            'Use site: syntax for exact site searches'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查文件类型搜索
   */
  private checkFileTypeSearch(normalizedQuery: string, originalQuery: string): GoogleSearchRoute | null {
    // 检查 filetype: 语法
    const fileTypeMatch = normalizedQuery.match(/filetype:([^\s]+)/);
    if (fileTypeMatch) {
      const fileType = fileTypeMatch[1];
      const cleanQuery = normalizedQuery.replace(/filetype:[^\s]+/g, '').trim();
      
      return {
        searchType: 'filetype',
        query: cleanQuery,
        originalQuery,
        fileType,
        confidence: 0.95,
        reasoning: `Detected filetype search syntax: filetype:${fileType}`,
        suggestions: [
          'Use filetype: syntax for specific file format searches',
          'Popular file types: pdf, doc, ppt, xls',
          'Combine with keywords for targeted results'
        ]
      };
    }
    
    // 检查文件类型关键词
    for (const [fileType, description] of Object.entries(this.FILE_TYPES)) {
      if (normalizedQuery.includes(fileType) && 
          (normalizedQuery.includes('file') || normalizedQuery.includes('document') || 
           normalizedQuery.includes('文件') || normalizedQuery.includes('文档'))) {
        const cleanQuery = normalizedQuery.replace(new RegExp(`\\b(file|document|文件|文档)\\s*${fileType}\\b`, 'g'), '').trim();
        
        return {
          searchType: 'filetype',
          query: cleanQuery,
          originalQuery,
          fileType,
          confidence: 0.75,
          reasoning: `Detected file type search intent for ${fileType}`,
          suggestions: [
            `Searching for ${description}`,
            'Use filetype: syntax for more precise results',
            'Try specific keywords related to your topic'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查图片搜索
   */
  private checkImageSearch(normalizedQuery: string, originalQuery: string): GoogleSearchRoute | null {
    const imageKeywords = this.SEARCH_TYPE_KEYWORDS.image;
    
    for (const keyword of imageKeywords) {
      if (normalizedQuery.includes(keyword)) {
        const cleanQuery = normalizedQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '').trim();
        
        return {
          searchType: 'image',
          query: cleanQuery || originalQuery,
          originalQuery,
          confidence: 0.85,
          reasoning: `Detected image search keyword: ${keyword}`,
          suggestions: [
            'Image search will return visual content',
            'Try specific descriptive terms',
            'Use color, style, or object keywords'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查新闻搜索
   */
  private checkNewsSearch(normalizedQuery: string, originalQuery: string): GoogleSearchRoute | null {
    const newsKeywords = this.SEARCH_TYPE_KEYWORDS.news;
    
    for (const keyword of newsKeywords) {
      if (normalizedQuery.includes(keyword)) {
        const cleanQuery = normalizedQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '').trim();
        
        // 设置时间限制为最近一周
        return {
          searchType: 'news',
          query: cleanQuery || originalQuery,
          originalQuery,
          dateRestrict: 'w1',
          confidence: 0.8,
          reasoning: `Detected news search keyword: ${keyword}`,
          suggestions: [
            'News search focuses on recent articles',
            'Try current event keywords',
            'Results are sorted by date'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查学术搜索
   */
  private checkAcademicSearch(normalizedQuery: string, originalQuery: string): GoogleSearchRoute | null {
    const academicKeywords = this.SEARCH_TYPE_KEYWORDS.academic;
    
    for (const keyword of academicKeywords) {
      if (normalizedQuery.includes(keyword)) {
        const cleanQuery = normalizedQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '').trim();
        
        return {
          searchType: 'academic',
          query: cleanQuery || originalQuery,
          originalQuery,
          fileType: 'pdf', // 优先搜索PDF文件
          confidence: 0.75,
          reasoning: `Detected academic search keyword: ${keyword}`,
          suggestions: [
            'Academic search focuses on research content',
            'Results prioritize PDF documents',
            'Try author names or specific topics'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 创建通用网页搜索路由
   */
  private createWebSearchRoute(originalQuery: string, normalizedQuery: string): GoogleSearchRoute {
    // 检测语言
    const language = this.detectLanguage(normalizedQuery);
    
    // 检测地区
    const country = this.detectCountry(normalizedQuery);
    
    return {
      searchType: 'web',
      query: originalQuery,
      originalQuery,
      language,
      country,
      confidence: 0.6,
      reasoning: 'General web search with language and region detection',
      suggestions: this.generateWebSearchSuggestions(normalizedQuery)
    };
  }

  /**
   * 检测语言
   */
  private detectLanguage(query: string): string | undefined {
    for (const [langCode, indicators] of Object.entries(this.LANGUAGE_INDICATORS)) {
      if (indicators.some(indicator => query.includes(indicator))) {
        return langCode;
      }
    }
    
    // 检测中文字符
    if (/[\u4e00-\u9fff]/.test(query)) {
      return 'zh';
    }
    
    // 检测日文字符
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(query)) {
      return 'ja';
    }
    
    // 检测韩文字符
    if (/[\uac00-\ud7af]/.test(query)) {
      return 'ko';
    }
    
    return undefined; // 默认英文
  }

  /**
   * 检测国家/地区
   */
  private detectCountry(query: string): string | undefined {
    const countryIndicators = {
      'us': ['america', 'usa', 'united states', '美国'],
      'cn': ['china', 'chinese', '中国', '中文'],
      'uk': ['britain', 'uk', 'england', '英国'],
      'ca': ['canada', 'canadian', '加拿大'],
      'au': ['australia', 'australian', '澳大利亚'],
      'de': ['germany', 'german', '德国'],
      'fr': ['france', 'french', '法国'],
      'jp': ['japan', 'japanese', '日本'],
      'kr': ['korea', 'korean', '韩国'],
      'in': ['india', 'indian', '印度']
    };
    
    for (const [countryCode, indicators] of Object.entries(countryIndicators)) {
      if (indicators.some(indicator => query.includes(indicator))) {
        return countryCode;
      }
    }
    
    return undefined;
  }

  /**
   * 生成网页搜索建议
   */
  private generateWebSearchSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // 基于查询内容提供建议
    if (query.length < 3) {
      suggestions.push('Try using more specific keywords');
    }
    
    if (!query.includes(' ')) {
      suggestions.push('Consider adding more descriptive terms');
    }
    
    suggestions.push(
      'Use quotes for exact phrase searches',
      'Add site: to search within specific websites',
      'Use filetype: to find specific document types',
      'Try different keyword combinations'
    );
    
    return suggestions.slice(0, 4); // 限制为4个建议
  }

  /**
   * 验证查询
   */
  validateQuery(query: string): { valid: boolean; message?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, message: 'Query cannot be empty' };
    }
    
    if (query.length > 2048) {
      return { valid: false, message: 'Query too long (max 2048 characters)' };
    }
    
    // 检查是否包含不当内容
    const inappropriatePatterns = [
      /\b(illegal|piracy|hack|crack)\b/i
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(query)) {
        return { valid: false, message: 'Query contains inappropriate content' };
      }
    }
    
    return { valid: true };
  }

  /**
   * 获取推荐的搜索类型
   */
  getRecommendedSearchTypes(): Record<string, string[]> {
    return {
      web: ['General information', 'Company websites', 'Product reviews', 'How-to guides'],
      image: ['Visual content', 'Photos', 'Diagrams', 'Infographics'],
      news: ['Current events', 'Breaking news', 'Recent developments', 'Headlines'],
      academic: ['Research papers', 'Academic articles', 'Scientific studies', 'Journals'],
      site: ['Specific website content', 'GitHub repositories', 'Stack Overflow answers'],
      filetype: ['PDF documents', 'Presentations', 'Spreadsheets', 'Reports']
    };
  }

  /**
   * 获取搜索统计
   */
  getSearchStats(): any {
    return {
      supportedSearchTypes: Object.keys(this.SEARCH_TYPE_KEYWORDS).concat(['web', 'site', 'filetype']),
      popularSites: Object.keys(this.POPULAR_SITES).length,
      supportedFileTypes: Object.keys(this.FILE_TYPES).length,
      supportedLanguages: Object.keys(this.LANGUAGE_INDICATORS).length,
      features: [
        'Intelligent query routing',
        'Multi-language detection',
        'Site-specific search',
        'File type filtering',
        'News and academic search',
        'Image search optimization'
      ]
    };
  }
}
