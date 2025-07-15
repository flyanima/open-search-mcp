import { Logger } from './logger.js';

/**
 * Stack Exchange 搜索路由器 - 智能分析用户查询并路由到最佳Stack Exchange搜索方法
 * 支持问题搜索、用户搜索、标签搜索、热门内容等
 */

export interface StackExchangeRoute {
  searchType: 'questions' | 'advanced' | 'tags' | 'users' | 'answers' | 'hot';
  query: string;
  originalQuery: string;
  site?: string;
  tag?: string;
  userId?: number;
  questionId?: number;
  sort?: 'relevance' | 'votes' | 'activity' | 'creation' | 'hot' | 'reputation';
  order?: 'desc' | 'asc';
  confidence: number;
  reasoning: string;
  suggestions?: string[];
}

export class StackExchangeRouter {
  private logger: Logger;

  // 搜索类型关键词映射
  private readonly SEARCH_TYPE_KEYWORDS = {
    tags: ['tag:', '[', ']', 'tagged', 'category'],
    users: ['user:', 'by ', 'author:', 'asked by', 'answered by'],
    answers: ['answer', 'solution', 'how to solve', 'fix'],
    hot: ['hot', 'trending', 'popular', 'viral', 'top'],
    advanced: ['AND', 'OR', 'NOT', '"', 'complex']
  };

  // Stack Exchange 网站映射
  private readonly STACK_SITES = {
    'stackoverflow': ['programming', 'code', 'coding', 'development', 'software', 'algorithm'],
    'superuser': ['computer', 'windows', 'mac', 'linux', 'hardware', 'software'],
    'serverfault': ['server', 'network', 'admin', 'infrastructure', 'devops'],
    'askubuntu': ['ubuntu', 'linux', 'unix'],
    'mathoverflow.net': ['math', 'mathematics', 'equation', 'formula'],
    'tex': ['latex', 'tex', 'typesetting', 'document'],
    'dba': ['database', 'sql', 'mysql', 'postgresql', 'oracle'],
    'webmasters': ['seo', 'website', 'domain', 'hosting'],
    'gamedev': ['game', 'unity', 'unreal', 'graphics'],
    'security': ['security', 'encryption', 'vulnerability', 'hack']
  };

  // 编程语言和技术标签
  private readonly PROGRAMMING_TAGS = {
    'javascript': ['js', 'javascript', 'node', 'react', 'vue', 'angular'],
    'python': ['python', 'django', 'flask', 'pandas', 'numpy'],
    'java': ['java', 'spring', 'hibernate', 'maven'],
    'csharp': ['c#', 'csharp', '.net', 'asp.net'],
    'cpp': ['c++', 'cpp', 'c plus plus'],
    'php': ['php', 'laravel', 'symfony', 'wordpress'],
    'ruby': ['ruby', 'rails', 'ruby on rails'],
    'go': ['golang', 'go'],
    'rust': ['rust'],
    'swift': ['swift', 'ios'],
    'kotlin': ['kotlin', 'android'],
    'typescript': ['typescript', 'ts']
  };

  constructor() {
    this.logger = new Logger('StackExchangeRouter');
  }

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): StackExchangeRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 1. 检查标签搜索
    const tagRoute = this.checkTagSearch(normalizedQuery, query);
    if (tagRoute) return tagRoute;
    
    // 2. 检查用户搜索
    const userRoute = this.checkUserSearch(normalizedQuery, query);
    if (userRoute) return userRoute;
    
    // 3. 检查热门内容搜索
    const hotRoute = this.checkHotSearch(normalizedQuery, query);
    if (hotRoute) return hotRoute;
    
    // 4. 检查高级搜索
    const advancedRoute = this.checkAdvancedSearch(normalizedQuery, query);
    if (advancedRoute) return advancedRoute;
    
    // 5. 检查答案搜索
    const answerRoute = this.checkAnswerSearch(normalizedQuery, query);
    if (answerRoute) return answerRoute;
    
    // 6. 默认：问题搜索
    return this.createQuestionSearchRoute(query, normalizedQuery);
  }

  /**
   * 检查标签搜索
   */
  private checkTagSearch(normalizedQuery: string, originalQuery: string): StackExchangeRoute | null {
    // 检查 [tag] 语法
    const tagMatch = normalizedQuery.match(/\[([^\]]+)\]/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const cleanQuery = normalizedQuery.replace(/\[[^\]]+\]/g, '').trim();
      
      return {
        searchType: 'tags',
        query: cleanQuery || tag,
        originalQuery,
        tag,
        site: this.detectSite(normalizedQuery),
        sort: 'votes',
        order: 'desc',
        confidence: 0.95,
        reasoning: `Detected tag search syntax: [${tag}]`,
        suggestions: [
          'Use [tag] syntax for specific technology searches',
          'Combine tags like [javascript][react] for more specific results',
          'Try popular tags like [python], [java], [javascript]'
        ]
      };
    }
    
    // 检查 tag: 语法
    const tagColonMatch = normalizedQuery.match(/tag:([^\s]+)/);
    if (tagColonMatch) {
      const tag = tagColonMatch[1];
      const cleanQuery = normalizedQuery.replace(/tag:[^\s]+/g, '').trim();
      
      return {
        searchType: 'tags',
        query: cleanQuery || tag,
        originalQuery,
        tag,
        site: this.detectSite(normalizedQuery),
        sort: 'votes',
        order: 'desc',
        confidence: 0.9,
        reasoning: `Detected tag search syntax: tag:${tag}`,
        suggestions: [
          'Use tag: syntax for technology-specific searches',
          'Try programming languages like tag:python or tag:javascript',
          'Combine with other keywords for better results'
        ]
      };
    }
    
    // 检查编程语言关键词
    for (const [tag, keywords] of Object.entries(this.PROGRAMMING_TAGS)) {
      if (keywords.some(keyword => normalizedQuery.includes(keyword))) {
        return {
          searchType: 'tags',
          query: normalizedQuery,
          originalQuery,
          tag,
          site: 'stackoverflow',
          sort: 'votes',
          order: 'desc',
          confidence: 0.8,
          reasoning: `Detected programming language: ${tag}`,
          suggestions: [
            `Searching in ${tag} tag for relevant questions`,
            'Try more specific keywords for better results',
            'Use [tag] syntax for exact tag searches'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查用户搜索
   */
  private checkUserSearch(normalizedQuery: string, originalQuery: string): StackExchangeRoute | null {
    // 检查 user: 语法
    const userMatch = normalizedQuery.match(/user:([^\s]+)/);
    if (userMatch) {
      const username = userMatch[1];
      
      return {
        searchType: 'users',
        query: username,
        originalQuery,
        site: this.detectSite(normalizedQuery),
        sort: 'reputation',
        order: 'desc',
        confidence: 0.95,
        reasoning: `Detected user search syntax: user:${username}`,
        suggestions: [
          'Use user: syntax to find specific users',
          'Search by username or display name',
          'Check user reputation and contributions'
        ]
      };
    }
    
    // 检查 "by username" 模式
    const byUserMatch = normalizedQuery.match(/by\s+([^\s]+)/);
    if (byUserMatch) {
      const username = byUserMatch[1];
      
      return {
        searchType: 'users',
        query: username,
        originalQuery,
        site: this.detectSite(normalizedQuery),
        sort: 'reputation',
        order: 'desc',
        confidence: 0.8,
        reasoning: `Detected user search pattern: by ${username}`,
        suggestions: [
          'Searching for user contributions',
          'Try exact username for better results',
          'Use user: syntax for more precise searches'
        ]
      };
    }
    
    return null;
  }

  /**
   * 检查热门内容搜索
   */
  private checkHotSearch(normalizedQuery: string, originalQuery: string): StackExchangeRoute | null {
    const hotKeywords = this.SEARCH_TYPE_KEYWORDS.hot;
    
    for (const keyword of hotKeywords) {
      if (normalizedQuery.includes(keyword)) {
        return {
          searchType: 'hot',
          query: normalizedQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '').trim() || 'hot questions',
          originalQuery,
          site: this.detectSite(normalizedQuery),
          sort: 'hot',
          order: 'desc',
          confidence: 0.85,
          reasoning: `Detected hot content search keyword: ${keyword}`,
          suggestions: [
            'Hot questions are currently trending',
            'Try specific sites for targeted hot content',
            'Check back regularly for new trending topics'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查高级搜索
   */
  private checkAdvancedSearch(normalizedQuery: string, originalQuery: string): StackExchangeRoute | null {
    const advancedKeywords = this.SEARCH_TYPE_KEYWORDS.advanced;
    
    // 检查高级搜索操作符
    if (advancedKeywords.some(keyword => normalizedQuery.includes(keyword))) {
      return {
        searchType: 'advanced',
        query: originalQuery,
        originalQuery,
        site: this.detectSite(normalizedQuery),
        sort: 'relevance',
        order: 'desc',
        confidence: 0.8,
        reasoning: 'Detected advanced search operators (AND, OR, quotes)',
        suggestions: [
          'Use AND/OR for complex queries',
          'Use quotes for exact phrases',
          'Combine with tags for better results'
        ]
      };
    }
    
    // 检查复杂查询（多个关键词）
    if (normalizedQuery.split(' ').length > 4) {
      return {
        searchType: 'advanced',
        query: originalQuery,
        originalQuery,
        site: this.detectSite(normalizedQuery),
        sort: 'relevance',
        order: 'desc',
        confidence: 0.7,
        reasoning: 'Complex query with multiple keywords',
        suggestions: [
          'Complex queries use advanced search',
          'Try breaking into simpler terms',
          'Use tags to narrow down results'
        ]
      };
    }
    
    return null;
  }

  /**
   * 检查答案搜索
   */
  private checkAnswerSearch(normalizedQuery: string, originalQuery: string): StackExchangeRoute | null {
    const answerKeywords = this.SEARCH_TYPE_KEYWORDS.answers;
    
    for (const keyword of answerKeywords) {
      if (normalizedQuery.includes(keyword)) {
        return {
          searchType: 'questions', // 搜索问题但重点关注有答案的
          query: normalizedQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '').trim() || originalQuery,
          originalQuery,
          site: this.detectSite(normalizedQuery),
          sort: 'votes',
          order: 'desc',
          confidence: 0.75,
          reasoning: `Detected answer-focused search keyword: ${keyword}`,
          suggestions: [
            'Focusing on questions with good answers',
            'Check accepted answers for solutions',
            'Sort by votes for best answers'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 创建问题搜索路由
   */
  private createQuestionSearchRoute(originalQuery: string, normalizedQuery: string): StackExchangeRoute {
    const site = this.detectSite(normalizedQuery);
    const sort = this.detectSortPreference(normalizedQuery);
    
    return {
      searchType: 'questions',
      query: originalQuery,
      originalQuery,
      site,
      sort,
      order: 'desc',
      confidence: 0.6,
      reasoning: 'General question search with site and sort detection',
      suggestions: this.generateQuestionSearchSuggestions(normalizedQuery)
    };
  }

  /**
   * 检测最适合的Stack Exchange网站
   */
  private detectSite(query: string): string {
    for (const [site, keywords] of Object.entries(this.STACK_SITES)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return site;
      }
    }
    
    // 默认返回Stack Overflow（最大的编程社区）
    return 'stackoverflow';
  }

  /**
   * 检测排序偏好
   */
  private detectSortPreference(query: string): 'relevance' | 'votes' | 'activity' | 'creation' | 'hot' | 'reputation' {
    if (query.includes('recent') || query.includes('new') || query.includes('latest')) {
      return 'creation';
    }
    
    if (query.includes('popular') || query.includes('best') || query.includes('top')) {
      return 'votes';
    }
    
    if (query.includes('active') || query.includes('updated')) {
      return 'activity';
    }
    
    if (query.includes('hot') || query.includes('trending')) {
      return 'hot';
    }
    
    return 'relevance';
  }

  /**
   * 生成问题搜索建议
   */
  private generateQuestionSearchSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // 基于查询内容提供建议
    if (query.length < 3) {
      suggestions.push('Try using more specific keywords');
    }
    
    if (!query.includes(' ')) {
      suggestions.push('Consider adding more descriptive terms');
    }
    
    suggestions.push(
      'Use [tag] syntax for technology-specific searches',
      'Add programming language for better results',
      'Try user: to find specific contributors',
      'Use quotes for exact phrase searches'
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
    
    if (query.length > 240) {
      return { valid: false, message: 'Query too long (max 240 characters)' };
    }
    
    return { valid: true };
  }

  /**
   * 获取推荐的搜索类型
   */
  getRecommendedSearchTypes(): Record<string, string[]> {
    return {
      questions: ['Programming problems', 'Error solutions', 'How-to guides', 'Best practices'],
      tags: ['Technology-specific searches', 'Programming languages', 'Frameworks', 'Tools'],
      users: ['Expert contributors', 'High reputation users', 'Specific authors'],
      hot: ['Trending topics', 'Popular discussions', 'Current issues'],
      advanced: ['Complex queries', 'Multiple criteria', 'Boolean searches']
    };
  }

  /**
   * 获取搜索统计
   */
  getSearchStats(): any {
    return {
      supportedSearchTypes: Object.keys(this.SEARCH_TYPE_KEYWORDS).concat(['questions', 'hot']),
      supportedSites: Object.keys(this.STACK_SITES).length,
      programmingLanguages: Object.keys(this.PROGRAMMING_TAGS).length,
      features: [
        'Intelligent query routing',
        'Multi-site detection',
        'Tag-based search',
        'User search',
        'Hot content discovery',
        'Advanced search operators'
      ]
    };
  }
}
