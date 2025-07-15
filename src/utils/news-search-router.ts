/**
 * 新闻搜索路由器 - 智能识别搜索意图并路由到合适的NewsAPI端点
 */

export interface NewsSearchRoute {
  tool: 'news_search' | 'headlines_search' | 'sources_search';
  endpoint: 'everything' | 'top-headlines' | 'sources';
  params: Record<string, any>;
  intent: string;
}

export class NewsSearchRouter {
  
  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): NewsSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 新闻来源查询
    if (this.isSourcesQuery(normalizedQuery)) {
      return {
        tool: 'sources_search',
        endpoint: 'sources',
        params: this.extractSourcesParams(query),
        intent: 'sources'
      };
    }
    
    // 头条新闻查询
    if (this.isHeadlinesQuery(normalizedQuery)) {
      return {
        tool: 'headlines_search',
        endpoint: 'top-headlines',
        params: this.extractHeadlinesParams(query),
        intent: 'headlines'
      };
    }
    
    // 默认：新闻搜索
    return {
      tool: 'news_search',
      endpoint: 'everything',
      params: this.extractEverythingParams(query),
      intent: 'news_search'
    };
  }

  /**
   * 判断是否为新闻来源查询
   */
  private isSourcesQuery(query: string): boolean {
    const sourceKeywords = [
      '新闻来源', '媒体来源', '新闻源', '媒体', 'sources', 'media sources', 
      'news sources', '来源列表', 'source list', '新闻网站', 'news sites'
    ];
    
    return sourceKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为头条新闻查询
   */
  private isHeadlinesQuery(query: string): boolean {
    const headlineKeywords = [
      '头条', '今日头条', '最新头条', 'headlines', 'top headlines', 'breaking news',
      '今日新闻', 'today news', '最新新闻', 'latest news', '热点新闻', 'trending news',
      '突发新闻', 'breaking', '实时新闻', 'live news'
    ];
    
    return headlineKeywords.some(kw => query.includes(kw));
  }

  /**
   * 提取新闻来源查询参数
   */
  private extractSourcesParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取类别
    const category = this.extractCategory(query);
    if (category) params.category = category;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    // 提取国家
    const country = this.extractCountry(query);
    if (country) params.country = country;
    
    return params;
  }

  /**
   * 提取头条新闻查询参数
   */
  private extractHeadlinesParams(query: string): Record<string, any> {
    const params: Record<string, any> = {
      pageSize: 20
    };
    
    // 提取关键词
    const keywords = this.extractKeywords(query);
    if (keywords) params.q = keywords;
    
    // 提取类别
    const category = this.extractCategory(query);
    if (category) params.category = category;
    
    // 提取国家
    const country = this.extractCountry(query);
    if (country) params.country = country;
    
    // 如果没有指定国家但有中文，默认中国
    if (!country && this.isChinese(query)) {
      params.country = 'cn';
    }
    
    return params;
  }

  /**
   * 提取新闻搜索查询参数
   */
  private extractEverythingParams(query: string): Record<string, any> {
    const params: Record<string, any> = {
      pageSize: 20,
      sortBy: 'publishedAt'
    };
    
    // 提取关键词
    const keywords = this.extractKeywords(query);
    if (keywords) params.q = keywords;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    // 提取日期范围
    const dateRange = this.extractDateRange(query);
    if (dateRange.from) params.from = dateRange.from;
    if (dateRange.to) params.to = dateRange.to;
    
    // 提取排序方式
    const sortBy = this.extractSortBy(query);
    if (sortBy) params.sortBy = sortBy;
    
    return params;
  }

  /**
   * 提取类别
   */
  private extractCategory(query: string): string | undefined {
    const categoryMap: Record<string, string> = {
      '科技': 'technology',
      '技术': 'technology',
      'tech': 'technology',
      'technology': 'technology',
      '商业': 'business',
      '财经': 'business',
      'business': 'business',
      '体育': 'sports',
      'sports': 'sports',
      '娱乐': 'entertainment',
      'entertainment': 'entertainment',
      '健康': 'health',
      'health': 'health',
      '科学': 'science',
      'science': 'science',
      '政治': 'general',
      'politics': 'general'
    };
    
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (query.toLowerCase().includes(keyword)) {
        return category;
      }
    }
    
    return undefined;
  }

  /**
   * 提取语言
   */
  private extractLanguage(query: string): string | undefined {
    if (query.includes('中文') || query.includes('中国')) {
      return 'zh';
    }
    
    if (query.includes('英文') || query.includes('english')) {
      return 'en';
    }
    
    // 根据查询内容自动检测
    if (this.isChinese(query)) {
      return 'zh';
    }
    
    return 'en'; // 默认英文
  }

  /**
   * 提取国家
   */
  private extractCountry(query: string): string | undefined {
    const countryMap: Record<string, string> = {
      '中国': 'cn',
      'china': 'cn',
      '美国': 'us',
      'usa': 'us',
      'america': 'us',
      'united states': 'us',
      '英国': 'gb',
      'uk': 'gb',
      'britain': 'gb',
      'united kingdom': 'gb',
      '日本': 'jp',
      'japan': 'jp',
      '德国': 'de',
      'germany': 'de',
      '法国': 'fr',
      'france': 'fr',
      '加拿大': 'ca',
      'canada': 'ca',
      '澳大利亚': 'au',
      'australia': 'au'
    };
    
    for (const [keyword, country] of Object.entries(countryMap)) {
      if (query.toLowerCase().includes(keyword)) {
        return country;
      }
    }
    
    return undefined;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string | undefined {
    // 移除意图词汇和修饰词
    const stopWords = [
      '新闻', 'news', '头条', 'headlines', '最新', 'latest', '今日', 'today',
      '搜索', 'search', '查找', 'find', '关于', 'about', '的', 'of', 'the',
      '来源', 'sources', '媒体', 'media', '网站', 'sites'
    ];
    
    let keywords = query;
    
    // 移除类别词汇
    const categories = ['科技', '商业', '体育', '娱乐', '健康', '科学', 'tech', 'business', 'sports', 'entertainment', 'health', 'science'];
    categories.forEach(cat => {
      keywords = keywords.replace(new RegExp(cat, 'gi'), '');
    });
    
    // 移除国家词汇
    const countries = ['中国', '美国', '英国', '日本', 'china', 'usa', 'uk', 'japan'];
    countries.forEach(country => {
      keywords = keywords.replace(new RegExp(country, 'gi'), '');
    });
    
    // 移除停用词
    stopWords.forEach(word => {
      keywords = keywords.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    });
    
    keywords = keywords.trim().replace(/\s+/g, ' ');
    
    return keywords || undefined;
  }

  /**
   * 提取日期范围
   */
  private extractDateRange(query: string): { from?: string; to?: string } {
    const today = new Date();
    const result: { from?: string; to?: string } = {};
    
    if (query.includes('今日') || query.includes('today')) {
      result.from = today.toISOString().split('T')[0];
    } else if (query.includes('昨日') || query.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      result.from = yesterday.toISOString().split('T')[0];
      result.to = yesterday.toISOString().split('T')[0];
    } else if (query.includes('本周') || query.includes('this week')) {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      result.from = weekAgo.toISOString().split('T')[0];
    } else if (query.includes('本月') || query.includes('this month')) {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      result.from = monthAgo.toISOString().split('T')[0];
    }
    
    return result;
  }

  /**
   * 提取排序方式
   */
  private extractSortBy(query: string): string | undefined {
    if (query.includes('最新') || query.includes('latest') || query.includes('时间')) {
      return 'publishedAt';
    }
    
    if (query.includes('热门') || query.includes('popular') || query.includes('流行')) {
      return 'popularity';
    }
    
    if (query.includes('相关') || query.includes('relevant')) {
      return 'relevancy';
    }
    
    return 'publishedAt'; // 默认按时间排序
  }

  /**
   * 判断是否包含中文
   */
  private isChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
  }

  /**
   * 获取查询建议
   */
  getSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    if (this.isChinese(query)) {
      suggestions.push(
        '今日科技新闻',
        '美国头条新闻',
        '中文新闻来源',
        '最新财经新闻',
        '本周体育新闻'
      );
    } else {
      suggestions.push(
        'tech news today',
        'US headlines',
        'business news sources',
        'latest science news',
        'breaking news'
      );
    }
    
    return suggestions;
  }

  /**
   * 验证查询参数
   */
  validateQuery(query: string): { valid: boolean; message?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, message: 'Query cannot be empty' };
    }
    
    if (query.length > 500) {
      return { valid: false, message: 'Query too long (max 500 characters)' };
    }
    
    return { valid: true };
  }
}
