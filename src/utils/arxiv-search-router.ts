/**
 * arXiv 搜索路由器 - 智能识别学术搜索意图并路由到合适的arXiv API端点
 */

export interface ArxivSearchRoute {
  tool: 'arxiv_search' | 'arxiv_paper_details' | 'arxiv_author_search';
  endpoint: 'search' | 'paper_details' | 'author_search' | 'category_search';
  params: Record<string, any>;
  intent: string;
}

export class ArxivSearchRouter {
  
  // arXiv学科分类映射
  private readonly CATEGORY_MAPPING: Record<string, string> = {
    // 计算机科学
    'computer science': 'cs',
    'cs': 'cs',
    'artificial intelligence': 'cs.AI',
    'machine learning': 'cs.LG',
    'computer vision': 'cs.CV',
    'natural language processing': 'cs.CL',
    'robotics': 'cs.RO',
    'cryptography': 'cs.CR',
    
    // 数学
    'mathematics': 'math',
    'math': 'math',
    'statistics': 'stat',
    'probability': 'math.PR',
    'optimization': 'math.OC',
    
    // 物理
    'physics': 'physics',
    'quantum physics': 'quant-ph',
    'quantum computing': 'quant-ph',
    'astrophysics': 'astro-ph',
    'condensed matter': 'cond-mat',
    
    // 生物和金融
    'biology': 'q-bio',
    'quantitative biology': 'q-bio',
    'finance': 'q-fin',
    'quantitative finance': 'q-fin'
  };

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): ArxivSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // arXiv ID查询
    if (this.isPaperIdQuery(normalizedQuery)) {
      return {
        tool: 'arxiv_paper_details',
        endpoint: 'paper_details',
        params: this.extractPaperIdParams(query),
        intent: 'paper_details'
      };
    }
    
    // 作者查询
    if (this.isAuthorQuery(normalizedQuery)) {
      return {
        tool: 'arxiv_author_search',
        endpoint: 'author_search',
        params: this.extractAuthorParams(query),
        intent: 'author_search'
      };
    }
    
    // 分类查询
    if (this.isCategoryQuery(normalizedQuery)) {
      return {
        tool: 'arxiv_search',
        endpoint: 'category_search',
        params: this.extractCategoryParams(query),
        intent: 'category_search'
      };
    }
    
    // 默认：一般搜索
    return {
      tool: 'arxiv_search',
      endpoint: 'search',
      params: this.extractSearchParams(query),
      intent: 'general_search'
    };
  }

  /**
   * 判断是否为论文ID查询
   */
  private isPaperIdQuery(query: string): boolean {
    // arXiv ID格式: YYMM.NNNN[vN] 或 subject-class/YYMMnnn
    const arxivIdPattern = /(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+\/\d{7})/i;
    return arxivIdPattern.test(query) || query.includes('paper details') || query.includes('abstract');
  }

  /**
   * 判断是否为作者查询
   */
  private isAuthorQuery(query: string): boolean {
    const authorKeywords = [
      'papers by', 'author:', 'by ', 'researcher', 'author',
      'publications by', 'works by', 'written by'
    ];
    
    return authorKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为分类查询
   */
  private isCategoryQuery(query: string): boolean {
    // 显式分类查询
    if (query.includes('cat:') || query.includes('category:')) {
      return true;
    }
    
    // 检查是否包含已知分类关键词
    for (const [keyword, category] of Object.entries(this.CATEGORY_MAPPING)) {
      if (query.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 提取论文ID查询参数
   */
  private extractPaperIdParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取arXiv ID
    const arxivIdPattern = /(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+\/\d{7})/i;
    const idMatch = query.match(arxivIdPattern);
    
    if (idMatch) {
      params.id = idMatch[1];
    } else {
      // 如果没有找到ID，尝试从查询中提取
      const cleanQuery = query.replace(/paper details|abstract|details/gi, '').trim();
      params.id = cleanQuery;
    }
    
    return params;
  }

  /**
   * 提取作者查询参数
   */
  private extractAuthorParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取作者名
    const author = this.extractAuthor(query);
    if (author) params.author = author;
    
    // 提取其他参数
    const limit = this.extractLimit(query);
    if (limit) params.limit = limit;
    
    const year = this.extractYear(query);
    if (year) params.year = year;
    
    // 检查是否需要精确匹配
    if (query.includes('"') || query.includes('exact')) {
      params.exactMatch = true;
    }
    
    return params;
  }

  /**
   * 提取分类查询参数
   */
  private extractCategoryParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取分类
    const category = this.extractCategory(query);
    if (category) params.category = category;
    
    // 提取其他参数
    const limit = this.extractLimit(query);
    if (limit) params.limit = limit;
    
    const year = this.extractYear(query);
    if (year) params.year = year;
    
    // 检查是否包含子分类
    if (query.includes('all') || query.includes('subcategories')) {
      params.subcategories = true;
    }
    
    return params;
  }

  /**
   * 提取一般搜索参数
   */
  private extractSearchParams(query: string): Record<string, any> {
    const params: Record<string, any> = {
      limit: 10
    };
    
    // 提取关键词
    const keywords = this.extractKeywords(query);
    if (keywords) params.query = keywords;
    
    // 提取结果数量
    const limit = this.extractLimit(query);
    if (limit) params.limit = limit;
    
    // 提取年份
    const year = this.extractYear(query);
    if (year) params.year = year;
    
    // 提取排序方式
    const sortBy = this.extractSortBy(query);
    if (sortBy) params.sortBy = sortBy;
    
    return params;
  }

  /**
   * 提取作者名
   */
  private extractAuthor(query: string): string | undefined {
    const authorWords = ['papers by', 'author:', 'by ', 'researcher', 'author', 'publications by', 'works by', 'written by'];
    
    let author = query;
    authorWords.forEach(word => {
      author = author.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除引号
    author = author.replace(/['"]/g, '').trim();
    
    return author || undefined;
  }

  /**
   * 提取分类
   */
  private extractCategory(query: string): string | undefined {
    // 显式分类指定
    const catMatch = query.match(/(?:cat:|category:)\s*([a-z-]+(?:\.[A-Z]{2})?)/i);
    if (catMatch) {
      return catMatch[1];
    }
    
    // 从关键词映射中查找
    for (const [keyword, category] of Object.entries(this.CATEGORY_MAPPING)) {
      if (query.toLowerCase().includes(keyword)) {
        return category;
      }
    }
    
    return undefined;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string | undefined {
    // 移除搜索修饰词
    const stopWords = [
      'papers', 'research', 'articles', 'studies', 'about', 'on', 'regarding',
      'search', 'find', 'look for', 'arxiv', 'paper'
    ];
    
    let keywords = query;
    stopWords.forEach(word => {
      keywords = keywords.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    keywords = keywords.replace(/\s+/g, ' ').trim();
    
    return keywords || undefined;
  }

  /**
   * 提取年份
   */
  private extractYear(query: string): string | undefined {
    // 查找4位数年份
    const yearMatch = query.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      return yearMatch[1];
    }
    
    // 查找年份范围
    const rangeMatch = query.match(/\b(20\d{2})[-–](20\d{2})\b/);
    if (rangeMatch) {
      return `${rangeMatch[1]}-${rangeMatch[2]}`;
    }
    
    return undefined;
  }

  /**
   * 提取结果数量限制
   */
  private extractLimit(query: string): number | undefined {
    // 查找数字
    const numberMatch = query.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 0 && num <= 100) {
        return num;
      }
    }
    
    // 查找文字描述
    if (query.includes('many') || query.includes('all')) {
      return 50;
    }
    
    if (query.includes('few') || query.includes('some')) {
      return 5;
    }
    
    return undefined;
  }

  /**
   * 提取排序方式
   */
  private extractSortBy(query: string): string | undefined {
    if (query.includes('latest') || query.includes('recent') || query.includes('new')) {
      return 'submittedDate';
    }
    
    if (query.includes('updated') || query.includes('modified')) {
      return 'lastUpdatedDate';
    }
    
    if (query.includes('relevant') || query.includes('relevance')) {
      return 'relevance';
    }
    
    return undefined;
  }

  /**
   * 获取查询建议
   */
  getSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // 基于查询类型提供建议
    if (this.isPaperIdQuery(query)) {
      suggestions.push(
        'arXiv:2301.12345',
        'paper details 2301.12345',
        'abstract 2301.12345'
      );
    } else if (this.isAuthorQuery(query)) {
      suggestions.push(
        'papers by Hinton',
        'author:LeCun',
        'researcher Smith'
      );
    } else if (this.isCategoryQuery(query)) {
      suggestions.push(
        'cs.AI papers',
        'machine learning',
        'quantum physics'
      );
    } else {
      suggestions.push(
        'machine learning',
        'quantum computing',
        'deep learning 2024',
        'neural networks',
        'artificial intelligence'
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

  /**
   * 优化查询
   */
  optimizeQuery(query: string): string {
    let optimized = query.trim();
    
    // 移除多余的空格
    optimized = optimized.replace(/\s+/g, ' ');
    
    // 标准化学术术语
    const termMapping: Record<string, string> = {
      'ai': 'artificial intelligence',
      'ml': 'machine learning',
      'dl': 'deep learning',
      'nlp': 'natural language processing',
      'cv': 'computer vision'
    };
    
    for (const [abbrev, full] of Object.entries(termMapping)) {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      optimized = optimized.replace(regex, full);
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
    
    return {
      route,
      complexity,
      optimizedQuery: this.optimizeQuery(query),
      suggestions: this.getSuggestions(query),
      strategy: {
        useCache: complexity === 'simple',
        expandResults: complexity === 'complex',
        enableFiltering: route.intent === 'general_search'
      }
    };
  }
}
