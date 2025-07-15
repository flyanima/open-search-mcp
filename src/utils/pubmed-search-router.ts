/**
 * PubMed 搜索路由器 - 智能识别医学搜索意图并路由到合适的PubMed API端点
 */

export interface PubmedSearchRoute {
  tool: 'pubmed_search' | 'pubmed_paper_details' | 'pubmed_author_search';
  endpoint: 'search' | 'paper_details' | 'author_search' | 'mesh_search';
  params: Record<string, any>;
  intent: string;
}

export class PubmedSearchRouter {
  
  // 医学主题分类映射
  private readonly MEDICAL_CATEGORIES: Record<string, string> = {
    // 疾病类
    'cancer': 'Neoplasms',
    'tumor': 'Neoplasms',
    'diabetes': 'Diabetes Mellitus',
    'hypertension': 'Hypertension',
    'covid': 'COVID-19',
    'coronavirus': 'Coronavirus',
    'heart disease': 'Heart Diseases',
    'stroke': 'Stroke',
    'alzheimer': 'Alzheimer Disease',
    'depression': 'Depression',
    'anxiety': 'Anxiety',
    
    // 治疗类
    'treatment': 'Therapeutics',
    'therapy': 'Therapy',
    'surgery': 'Surgery',
    'medication': 'Drug Therapy',
    'drug': 'Pharmaceutical Preparations',
    'vaccine': 'Vaccines',
    'immunotherapy': 'Immunotherapy',
    'chemotherapy': 'Drug Therapy',
    
    // 诊断类
    'diagnosis': 'Diagnosis',
    'screening': 'Mass Screening',
    'biomarker': 'Biomarkers',
    'imaging': 'Diagnostic Imaging',
    'mri': 'Magnetic Resonance Imaging',
    'ct scan': 'Tomography, X-Ray Computed',
    
    // 专科类
    'cardiology': 'Cardiology',
    'oncology': 'Medical Oncology',
    'neurology': 'Neurology',
    'psychiatry': 'Psychiatry',
    'pediatrics': 'Pediatrics',
    'radiology': 'Radiology'
  };

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): PubmedSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // PMID查询
    if (this.isPMIDQuery(normalizedQuery)) {
      return {
        tool: 'pubmed_paper_details',
        endpoint: 'paper_details',
        params: this.extractPMIDParams(query),
        intent: 'paper_details'
      };
    }
    
    // 作者查询
    if (this.isAuthorQuery(normalizedQuery)) {
      return {
        tool: 'pubmed_author_search',
        endpoint: 'author_search',
        params: this.extractAuthorParams(query),
        intent: 'author_search'
      };
    }
    
    // MeSH术语查询
    if (this.isMeSHQuery(normalizedQuery)) {
      return {
        tool: 'pubmed_search',
        endpoint: 'mesh_search',
        params: this.extractMeSHParams(query),
        intent: 'mesh_search'
      };
    }
    
    // 默认：一般医学搜索
    return {
      tool: 'pubmed_search',
      endpoint: 'search',
      params: this.extractSearchParams(query),
      intent: 'general_search'
    };
  }

  /**
   * 判断是否为PMID查询
   */
  private isPMIDQuery(query: string): boolean {
    // PMID格式: 8位或更多数字
    const pmidPattern = /(?:pmid:)?(\d{8,})/i;
    return pmidPattern.test(query) || query.includes('paper details') || query.includes('abstract');
  }

  /**
   * 判断是否为作者查询
   */
  private isAuthorQuery(query: string): boolean {
    const authorKeywords = [
      'papers by', 'author:', 'by ', 'researcher', 'author',
      'publications by', 'works by', 'written by', 'studies by'
    ];
    
    return authorKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为MeSH查询
   */
  private isMeSHQuery(query: string): boolean {
    // 显式MeSH查询
    if (query.includes('mesh:') || query.includes('mesh terms')) {
      return true;
    }
    
    // 检查是否包含已知医学分类关键词
    for (const [keyword, category] of Object.entries(this.MEDICAL_CATEGORIES)) {
      if (query.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 提取PMID查询参数
   */
  private extractPMIDParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取PMID
    const pmidPattern = /(?:pmid:)?(\d{8,})/i;
    const pmidMatch = query.match(pmidPattern);
    
    if (pmidMatch) {
      params.pmid = pmidMatch[1];
    } else {
      // 如果没有找到PMID，尝试从查询中提取
      const cleanQuery = query.replace(/paper details|abstract|details/gi, '').trim();
      params.pmid = cleanQuery;
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
   * 提取MeSH查询参数
   */
  private extractMeSHParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取MeSH术语
    const meshTerm = this.extractMeSHTerm(query);
    if (meshTerm) params.meshTerm = meshTerm;
    
    // 提取其他参数
    const limit = this.extractLimit(query);
    if (limit) params.limit = limit;
    
    const year = this.extractYear(query);
    if (year) params.year = year;
    
    // 检查是否为主要主题
    if (query.includes('major topic') || query.includes('主要主题')) {
      params.majorTopic = true;
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
    
    // 检查文章类型
    const articleType = this.extractArticleType(query);
    if (articleType) params.articleType = articleType;
    
    return params;
  }

  /**
   * 提取作者名
   */
  private extractAuthor(query: string): string | undefined {
    const authorWords = ['papers by', 'author:', 'by ', 'researcher', 'author', 'publications by', 'works by', 'written by', 'studies by'];
    
    let author = query;
    authorWords.forEach(word => {
      author = author.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除引号
    author = author.replace(/['"]/g, '').trim();
    
    return author || undefined;
  }

  /**
   * 提取MeSH术语
   */
  private extractMeSHTerm(query: string): string | undefined {
    // 显式MeSH指定
    const meshMatch = query.match(/mesh:\s*([^,]+)/i);
    if (meshMatch) {
      return meshMatch[1].trim();
    }
    
    // 从医学分类映射中查找
    for (const [keyword, category] of Object.entries(this.MEDICAL_CATEGORIES)) {
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
      'search', 'find', 'look for', 'pubmed', 'paper', 'medical', 'clinical'
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
      return 'pub_date';
    }
    
    if (query.includes('author') && query.includes('sort')) {
      return 'author';
    }
    
    if (query.includes('relevant') || query.includes('relevance')) {
      return 'relevance';
    }
    
    return undefined;
  }

  /**
   * 提取文章类型
   */
  private extractArticleType(query: string): string | undefined {
    const articleTypes = [
      'review', 'meta-analysis', 'clinical trial', 'case report', 
      'systematic review', 'randomized controlled trial', 'cohort study'
    ];
    
    for (const type of articleTypes) {
      if (query.toLowerCase().includes(type)) {
        return type;
      }
    }
    
    return undefined;
  }

  /**
   * 获取查询建议
   */
  getSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // 基于查询类型提供建议
    if (this.isPMIDQuery(query)) {
      suggestions.push(
        'PMID:12345678',
        'paper details 12345678',
        'abstract 12345678'
      );
    } else if (this.isAuthorQuery(query)) {
      suggestions.push(
        'papers by Smith',
        'author:Johnson',
        'researcher Brown'
      );
    } else if (this.isMeSHQuery(query)) {
      suggestions.push(
        'cancer treatment',
        'diabetes therapy',
        'COVID-19 vaccine'
      );
    } else {
      suggestions.push(
        'COVID-19',
        'cancer treatment',
        'diabetes',
        'hypertension',
        'Alzheimer disease'
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
    
    // 标准化医学术语
    const termMapping: Record<string, string> = {
      'covid': 'COVID-19',
      'coronavirus': 'COVID-19',
      'heart attack': 'myocardial infarction',
      'high blood pressure': 'hypertension',
      'diabetes': 'diabetes mellitus'
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
        enableFiltering: route.intent === 'general_search',
        useMeSH: this.isMeSHQuery(query)
      }
    };
  }

  /**
   * 获取医学分类信息
   */
  getMedicalCategories(): Record<string, string> {
    return { ...this.MEDICAL_CATEGORIES };
  }
}
