/**
 * Wikipedia 搜索路由器 - 智能识别搜索意图并路由到合适的Wikipedia API端点
 */

export interface WikipediaSearchRoute {
  tool: 'wikipedia_search' | 'wikipedia_summary' | 'wikipedia_related';
  endpoint: 'search' | 'summary' | 'content' | 'related';
  params: Record<string, any>;
  intent: string;
}

export class WikipediaSearchRouter {
  
  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): WikipediaSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 摘要查询
    if (this.isSummaryQuery(normalizedQuery)) {
      return {
        tool: 'wikipedia_summary',
        endpoint: 'summary',
        params: this.extractSummaryParams(query),
        intent: 'summary'
      };
    }
    
    // 相关条目查询
    if (this.isRelatedQuery(normalizedQuery)) {
      return {
        tool: 'wikipedia_related',
        endpoint: 'related',
        params: this.extractRelatedParams(query),
        intent: 'related'
      };
    }
    
    // 默认：搜索查询
    return {
      tool: 'wikipedia_search',
      endpoint: 'search',
      params: this.extractSearchParams(query),
      intent: 'search'
    };
  }

  /**
   * 判断是否为摘要查询
   */
  private isSummaryQuery(query: string): boolean {
    const summaryKeywords = [
      '摘要', '简介', '介绍', '概述', '概要', '简述',
      'summary', 'intro', 'introduction', 'overview', 'brief',
      'what is', 'who is', 'what are', 'define', 'definition'
    ];
    
    return summaryKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为相关条目查询
   */
  private isRelatedQuery(query: string): boolean {
    const relatedKeywords = [
      '相关', '相关的', '类似', '相似', '关联',
      'related', 'similar', 'like', 'associated', 'connected',
      'more about', 'also', 'see also'
    ];
    
    return relatedKeywords.some(kw => query.includes(kw));
  }

  /**
   * 提取摘要查询参数
   */
  private extractSummaryParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取主题
    const title = this.extractTitle(query);
    if (title) params.title = title;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    return params;
  }

  /**
   * 提取相关条目查询参数
   */
  private extractRelatedParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取主题
    const title = this.extractTitle(query);
    if (title) params.title = title;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    return params;
  }

  /**
   * 提取搜索查询参数
   */
  private extractSearchParams(query: string): Record<string, any> {
    const params: Record<string, any> = {
      limit: 10
    };
    
    // 提取关键词
    const keywords = this.extractKeywords(query);
    if (keywords) params.query = keywords;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    // 提取结果数量
    const limit = this.extractLimit(query);
    if (limit) params.limit = limit;
    
    return params;
  }

  /**
   * 提取标题/主题
   */
  private extractTitle(query: string): string | undefined {
    // 移除意图词汇
    const intentWords = [
      '摘要', '简介', '介绍', '概述', '概要', '简述', '相关', '相关的', '类似', '相似',
      'summary', 'intro', 'introduction', 'overview', 'brief', 'related', 'similar',
      'what is', 'who is', 'what are', 'define', 'definition', 'more about'
    ];
    
    let title = query;
    intentWords.forEach(word => {
      title = title.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除多余的空格
    title = title.replace(/\s+/g, ' ').trim();
    
    return title || undefined;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string | undefined {
    // 移除搜索修饰词
    const stopWords = [
      '搜索', '查找', '找', '寻找', '关于', '有关',
      'search', 'find', 'look for', 'about', 'on', 'regarding'
    ];
    
    let keywords = query;
    stopWords.forEach(word => {
      keywords = keywords.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    keywords = keywords.replace(/\s+/g, ' ').trim();
    
    return keywords || undefined;
  }

  /**
   * 提取语言
   */
  private extractLanguage(query: string): string | undefined {
    // 显式语言指定
    const languageMap: Record<string, string> = {
      '中文': 'zh', 'chinese': 'zh',
      '英文': 'en', 'english': 'en',
      '日文': 'ja', 'japanese': 'ja',
      '法文': 'fr', 'french': 'fr',
      '德文': 'de', 'german': 'de',
      '西班牙文': 'es', 'spanish': 'es'
    };
    
    for (const [name, code] of Object.entries(languageMap)) {
      if (query.toLowerCase().includes(name)) {
        return code;
      }
    }
    
    // 自动语言检测
    return this.detectLanguage(query);
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
   * 提取结果数量限制
   */
  private extractLimit(query: string): number | undefined {
    // 查找数字
    const numberMatch = query.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 0 && num <= 50) {
        return num;
      }
    }
    
    // 查找文字描述
    if (query.includes('更多') || query.includes('many') || query.includes('all')) {
      return 20;
    }
    
    if (query.includes('几个') || query.includes('few') || query.includes('some')) {
      return 5;
    }
    
    return undefined;
  }

  /**
   * 获取查询建议
   */
  getSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const language = this.detectLanguage(query);
    
    if (language === 'zh') {
      suggestions.push(
        '人工智能摘要',
        '量子计算相关',
        '爱因斯坦简介',
        'COVID-19概述',
        '机器学习'
      );
    } else {
      suggestions.push(
        'artificial intelligence summary',
        'quantum computing related',
        'Einstein introduction',
        'COVID-19 overview',
        'machine learning'
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
    
    if (query.length > 200) {
      return { valid: false, message: 'Query too long (max 200 characters)' };
    }
    
    // 检查是否包含有效字符
    if (!/[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0600-\u06ff]/.test(query)) {
      return { valid: false, message: 'Query must contain valid text characters' };
    }
    
    return { valid: true };
  }

  /**
   * 优化查询
   */
  optimizeQuery(query: string): string {
    let optimized = query.trim();
    
    // 移除多余的空格
    optimized = optimized.replace(/\s+/g, ' ');
    
    // 移除特殊字符（保留基本标点）
    optimized = optimized.replace(/[^\w\s\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0600-\u06ff.,!?-]/g, '');
    
    // 首字母大写（英文）
    if (/^[a-zA-Z]/.test(optimized)) {
      optimized = optimized.charAt(0).toUpperCase() + optimized.slice(1);
    }
    
    return optimized;
  }

  /**
   * 分析查询复杂度
   */
  analyzeQueryComplexity(query: string): 'simple' | 'medium' | 'complex' {
    const words = query.trim().split(/\s+/);
    
    if (words.length <= 2) {
      return 'simple';
    } else if (words.length <= 5) {
      return 'medium';
    } else {
      return 'complex';
    }
  }

  /**
   * 生成搜索策略
   */
  generateSearchStrategy(query: string): any {
    const route = this.routeSearch(query);
    const complexity = this.analyzeQueryComplexity(query);
    const language = this.detectLanguage(query);
    
    return {
      route,
      complexity,
      language,
      optimizedQuery: this.optimizeQuery(query),
      suggestions: this.getSuggestions(query),
      strategy: {
        useCache: complexity === 'simple',
        expandResults: complexity === 'complex',
        multiLanguage: language !== 'en'
      }
    };
  }
}
