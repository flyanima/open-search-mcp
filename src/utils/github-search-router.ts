/**
 * GitHub 搜索路由器 - 智能识别开发搜索意图并路由到合适的GitHub API端点
 */

export interface GitHubSearchRoute {
  tool: 'github_search' | 'github_code_search' | 'github_user_search';
  endpoint: 'repositories' | 'code' | 'users' | 'repository_details' | 'user_details';
  params: Record<string, any>;
  intent: string;
}

export class GitHubSearchRouter {
  
  // 编程语言映射
  private readonly PROGRAMMING_LANGUAGES: Record<string, string> = {
    'js': 'JavaScript',
    'javascript': 'JavaScript',
    'ts': 'TypeScript',
    'typescript': 'TypeScript',
    'py': 'Python',
    'python': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c++': 'C++',
    'csharp': 'C#',
    'c#': 'C#',
    'go': 'Go',
    'rust': 'Rust',
    'php': 'PHP',
    'ruby': 'Ruby',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'dart': 'Dart',
    'scala': 'Scala',
    'r': 'R',
    'matlab': 'MATLAB',
    'shell': 'Shell',
    'bash': 'Shell',
    'html': 'HTML',
    'css': 'CSS',
    'sql': 'SQL'
  };

  // 项目类型关键词
  private readonly PROJECT_TYPES: Record<string, string[]> = {
    'web': ['website', 'webapp', 'frontend', 'backend', 'fullstack'],
    'mobile': ['android', 'ios', 'mobile', 'app', 'react-native', 'flutter'],
    'ai': ['machine learning', 'deep learning', 'neural network', 'ai', 'ml', 'nlp'],
    'game': ['game', 'unity', 'unreal', 'gaming', 'gamedev'],
    'tool': ['cli', 'tool', 'utility', 'script', 'automation'],
    'library': ['library', 'framework', 'package', 'module', 'sdk'],
    'api': ['api', 'rest', 'graphql', 'microservice', 'service']
  };

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): GitHubSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 用户搜索
    if (this.isUserQuery(normalizedQuery)) {
      return {
        tool: 'github_user_search',
        endpoint: 'users',
        params: this.extractUserParams(query),
        intent: 'user_search'
      };
    }
    
    // 代码搜索
    if (this.isCodeQuery(normalizedQuery)) {
      return {
        tool: 'github_code_search',
        endpoint: 'code',
        params: this.extractCodeParams(query),
        intent: 'code_search'
      };
    }
    
    // 仓库详情
    if (this.isRepositoryDetailsQuery(normalizedQuery)) {
      return {
        tool: 'github_search',
        endpoint: 'repository_details',
        params: this.extractRepositoryDetailsParams(query),
        intent: 'repository_details'
      };
    }
    
    // 默认：仓库搜索
    return {
      tool: 'github_search',
      endpoint: 'repositories',
      params: this.extractRepositoryParams(query),
      intent: 'repository_search'
    };
  }

  /**
   * 判断是否为用户搜索查询
   */
  private isUserQuery(query: string): boolean {
    const userKeywords = [
      'user:', 'author:', 'developer', 'profile', 'github user',
      'programmer', 'contributor', 'maintainer', 'creator'
    ];
    
    return userKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为代码搜索查询
   */
  private isCodeQuery(query: string): boolean {
    const codeKeywords = [
      'code:', 'function', 'class', 'method', 'filename:', 'extension:',
      'in:file', 'path:', 'implementation', 'source code', 'algorithm'
    ];
    
    return codeKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为仓库详情查询
   */
  private isRepositoryDetailsQuery(query: string): boolean {
    // 检查是否为 owner/repo 格式
    const repoPattern = /^[\w\-\.]+\/[\w\-\.]+$/;
    return repoPattern.test(query.trim());
  }

  /**
   * 提取用户搜索参数
   */
  private extractUserParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取用户名
    const username = this.extractUsername(query);
    if (username) params.query = username;
    
    // 提取位置
    const location = this.extractLocation(query);
    if (location) params.location = location;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    // 提取类型
    if (query.includes('organization') || query.includes('org')) {
      params.type = 'org';
    } else {
      params.type = 'user';
    }
    
    // 提取其他参数
    const limit = this.extractLimit(query);
    if (limit) params.per_page = limit;
    
    const sort = this.extractSort(query);
    if (sort) params.sort = sort;
    
    return params;
  }

  /**
   * 提取代码搜索参数
   */
  private extractCodeParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取搜索关键词
    const keywords = this.extractCodeKeywords(query);
    if (keywords) params.query = keywords;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    // 提取文件名
    const filename = this.extractFilename(query);
    if (filename) params.filename = filename;
    
    // 提取扩展名
    const extension = this.extractExtension(query);
    if (extension) params.extension = extension;
    
    // 提取其他参数
    const limit = this.extractLimit(query);
    if (limit) params.per_page = limit;
    
    return params;
  }

  /**
   * 提取仓库搜索参数
   */
  private extractRepositoryParams(query: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取关键词
    const keywords = this.extractRepositoryKeywords(query);
    if (keywords) params.query = keywords;
    
    // 提取语言
    const language = this.extractLanguage(query);
    if (language) params.language = language;
    
    // 提取项目类型
    const projectType = this.extractProjectType(query);
    if (projectType) {
      params.query = `${params.query || ''} ${projectType}`.trim();
    }
    
    // 提取排序方式
    const sort = this.extractSort(query);
    if (sort) params.sort = sort;
    
    // 提取其他参数
    const limit = this.extractLimit(query);
    if (limit) params.per_page = limit;
    
    const license = this.extractLicense(query);
    if (license) params.license = license;
    
    const size = this.extractSize(query);
    if (size) params.size = size;
    
    return params;
  }

  /**
   * 提取仓库详情参数
   */
  private extractRepositoryDetailsParams(query: string): Record<string, any> {
    const parts = query.trim().split('/');
    return {
      owner: parts[0],
      repo: parts[1]
    };
  }

  /**
   * 提取用户名
   */
  private extractUsername(query: string): string | undefined {
    const userWords = ['user:', 'author:', 'developer', 'profile', 'github user', 'programmer'];
    
    let username = query;
    userWords.forEach(word => {
      username = username.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除引号
    username = username.replace(/['"]/g, '').trim();
    
    return username || undefined;
  }

  /**
   * 提取编程语言
   */
  private extractLanguage(query: string): string | undefined {
    // 显式语言指定
    const langMatch = query.match(/language:\s*([^\s]+)/i);
    if (langMatch) {
      return this.PROGRAMMING_LANGUAGES[langMatch[1].toLowerCase()] || langMatch[1];
    }
    
    // 从查询中识别语言
    for (const [key, value] of Object.entries(this.PROGRAMMING_LANGUAGES)) {
      if (query.toLowerCase().includes(key)) {
        return value;
      }
    }
    
    return undefined;
  }

  /**
   * 提取位置
   */
  private extractLocation(query: string): string | undefined {
    const locationMatch = query.match(/location:\s*([^,]+)/i);
    if (locationMatch) {
      return locationMatch[1].trim();
    }
    
    // 常见位置关键词
    const locations = ['china', 'usa', 'japan', 'germany', 'uk', 'canada', 'australia'];
    for (const location of locations) {
      if (query.toLowerCase().includes(location)) {
        return location;
      }
    }
    
    return undefined;
  }

  /**
   * 提取文件名
   */
  private extractFilename(query: string): string | undefined {
    const filenameMatch = query.match(/filename:\s*([^\s]+)/i);
    return filenameMatch ? filenameMatch[1] : undefined;
  }

  /**
   * 提取扩展名
   */
  private extractExtension(query: string): string | undefined {
    const extensionMatch = query.match(/extension:\s*([^\s]+)/i);
    return extensionMatch ? extensionMatch[1] : undefined;
  }

  /**
   * 提取项目类型
   */
  private extractProjectType(query: string): string | undefined {
    for (const [type, keywords] of Object.entries(this.PROJECT_TYPES)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return type;
      }
    }
    return undefined;
  }

  /**
   * 提取许可证
   */
  private extractLicense(query: string): string | undefined {
    const licenseMatch = query.match(/license:\s*([^\s]+)/i);
    if (licenseMatch) {
      return licenseMatch[1];
    }
    
    const licenses = ['mit', 'apache', 'gpl', 'bsd', 'mozilla'];
    for (const license of licenses) {
      if (query.toLowerCase().includes(license)) {
        return license;
      }
    }
    
    return undefined;
  }

  /**
   * 提取大小
   */
  private extractSize(query: string): string | undefined {
    const sizeMatch = query.match(/size:\s*([^\s]+)/i);
    return sizeMatch ? sizeMatch[1] : undefined;
  }

  /**
   * 提取排序方式
   */
  private extractSort(query: string): string | undefined {
    if (query.includes('popular') || query.includes('stars')) {
      return 'stars';
    }
    
    if (query.includes('recent') || query.includes('updated')) {
      return 'updated';
    }
    
    if (query.includes('forks')) {
      return 'forks';
    }
    
    if (query.includes('created')) {
      return 'created';
    }
    
    return undefined;
  }

  /**
   * 提取结果数量限制
   */
  private extractLimit(query: string): number | undefined {
    const numberMatch = query.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 0 && num <= 100) {
        return num;
      }
    }
    
    if (query.includes('many') || query.includes('all')) {
      return 50;
    }
    
    if (query.includes('few') || query.includes('some')) {
      return 5;
    }
    
    return undefined;
  }

  /**
   * 提取代码关键词
   */
  private extractCodeKeywords(query: string): string | undefined {
    const codeWords = ['code:', 'function', 'class', 'method', 'implementation', 'source code', 'algorithm'];
    
    let keywords = query;
    codeWords.forEach(word => {
      keywords = keywords.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除技术修饰词
    const techWords = ['filename:', 'extension:', 'language:', 'in:file', 'path:'];
    techWords.forEach(word => {
      keywords = keywords.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    keywords = keywords.replace(/\s+/g, ' ').trim();
    
    return keywords || undefined;
  }

  /**
   * 提取仓库关键词
   */
  private extractRepositoryKeywords(query: string): string | undefined {
    const repoWords = ['repo:', 'repository', 'project', 'github', 'search'];
    
    let keywords = query;
    repoWords.forEach(word => {
      keywords = keywords.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
    });
    
    // 移除技术修饰词
    const techWords = ['language:', 'license:', 'size:', 'sort:', 'popular', 'recent'];
    techWords.forEach(word => {
      keywords = keywords.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    keywords = keywords.replace(/\s+/g, ' ').trim();
    
    return keywords || undefined;
  }

  /**
   * 获取查询建议
   */
  getSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // 基于查询类型提供建议
    if (this.isUserQuery(query)) {
      suggestions.push(
        'user:octocat',
        'developer torvalds',
        'programmer location:china'
      );
    } else if (this.isCodeQuery(query)) {
      suggestions.push(
        'function language:javascript',
        'class language:python',
        'filename:package.json'
      );
    } else {
      suggestions.push(
        'react language:javascript',
        'machine learning python',
        'web framework',
        'mobile app flutter'
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
    
    if (query.length > 256) {
      return { valid: false, message: 'Query too long (max 256 characters)' };
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
    
    // 标准化语言名称
    const langMapping: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python'
    };
    
    for (const [abbrev, full] of Object.entries(langMapping)) {
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
    const hasFilters = /language:|filename:|extension:|user:|license:/.test(query);
    
    if (words.length <= 2 && !hasFilters) {
      return 'simple';
    } else if (words.length <= 5 || hasFilters) {
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
        enableFiltering: route.intent === 'repository_search',
        prioritizePopular: route.intent === 'repository_search'
      }
    };
  }

  /**
   * 获取编程语言信息
   */
  getProgrammingLanguages(): Record<string, string> {
    return { ...this.PROGRAMMING_LANGUAGES };
  }

  /**
   * 获取项目类型信息
   */
  getProjectTypes(): Record<string, string[]> {
    return { ...this.PROJECT_TYPES };
  }
}
