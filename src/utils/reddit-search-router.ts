import { Logger } from './logger.js';

/**
 * Reddit 搜索路由器 - 智能分析用户查询并路由到最佳Reddit搜索方法
 * 支持帖子搜索、用户搜索、subreddit搜索、热门内容等
 */

export interface RedditSearchRoute {
  searchType: 'posts' | 'users' | 'subreddits' | 'hot' | 'top' | 'specific_subreddit';
  query: string;
  subreddit?: string;
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  sortBy?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  confidence: number;
  reasoning: string;
  suggestions?: string[];
}

export class RedditSearchRouter {
  private logger: Logger;

  // Reddit社区分类映射
  private readonly SUBREDDIT_CATEGORIES = {
    // 技术类
    'programming': ['programming', 'webdev', 'javascript', 'python', 'MachineLearning'],
    'technology': ['technology', 'gadgets', 'apple', 'android', 'tech'],
    'ai': ['artificial', 'MachineLearning', 'deeplearning', 'ChatGPT', 'singularity'],
    
    // 科学类
    'science': ['science', 'askscience', 'Physics', 'chemistry', 'biology'],
    'space': ['space', 'SpaceX', 'nasa', 'astronomy', 'astrophysics'],
    'medicine': ['medicine', 'medical', 'Health', 'mentalhealth', 'nutrition'],
    
    // 新闻类
    'news': ['news', 'worldnews', 'politics', 'Economics', 'business'],
    'finance': ['investing', 'personalfinance', 'stocks', 'cryptocurrency', 'wallstreetbets'],
    
    // 娱乐类
    'gaming': ['gaming', 'Games', 'pcgaming', 'nintendo', 'playstation'],
    'movies': ['movies', 'television', 'netflix', 'MarvelStudios', 'StarWars'],
    'music': ['Music', 'WeAreTheMusicMakers', 'spotify', 'hiphopheads', 'popheads'],
    
    // 生活类
    'lifestyle': ['LifeProTips', 'todayilearned', 'explainlikeimfive', 'coolguides', 'YouShouldKnow'],
    'fitness': ['fitness', 'bodybuilding', 'running', 'yoga', 'nutrition'],
    'food': ['food', 'Cooking', 'recipes', 'MealPrepSunday', 'AskCulinary'],
    
    // 教育类
    'education': ['AskAcademia', 'GradSchool', 'college', 'GetStudying', 'HomeworkHelp'],
    'language': ['languagelearning', 'duolingo', 'French', 'Spanish', 'German'],
    
    // 问答类
    'questions': ['AskReddit', 'NoStupidQuestions', 'explainlikeimfive', 'OutOfTheLoop', 'tipofmytongue'],
    'advice': ['relationship_advice', 'legaladvice', 'personalfinance', 'careerguidance', 'LifeProTips'],
    
    // 创意类
    'art': ['Art', 'drawing', 'photography', 'design', 'crafts'],
    'writing': ['writing', 'WritingPrompts', 'books', 'Fantasy', 'scifi']
  };

  // 热门关键词映射
  private readonly TRENDING_KEYWORDS = {
    'hot': ['hot', 'trending', 'popular', 'viral', 'front page'],
    'top': ['top', 'best', 'highest rated', 'most upvoted', 'all time'],
    'new': ['new', 'latest', 'recent', 'fresh', 'just posted'],
    'controversial': ['controversial', 'debated', 'disputed', 'polarizing']
  };

  constructor() {
    this.logger = new Logger('RedditSearchRouter');
  }

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): RedditSearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 1. 检查用户搜索
    const userRoute = this.checkUserSearch(normalizedQuery);
    if (userRoute) return userRoute;
    
    // 2. 检查subreddit搜索
    const subredditRoute = this.checkSubredditSearch(normalizedQuery);
    if (subredditRoute) return subredditRoute;
    
    // 3. 检查热门内容搜索
    const hotRoute = this.checkHotContentSearch(normalizedQuery);
    if (hotRoute) return hotRoute;
    
    // 4. 检查顶级内容搜索
    const topRoute = this.checkTopContentSearch(normalizedQuery);
    if (topRoute) return topRoute;
    
    // 5. 检查特定subreddit内搜索
    const specificRoute = this.checkSpecificSubredditSearch(normalizedQuery);
    if (specificRoute) return specificRoute;
    
    // 6. 默认：通用帖子搜索
    return this.createPostsSearchRoute(query, normalizedQuery);
  }

  /**
   * 检查用户搜索
   */
  private checkUserSearch(query: string): RedditSearchRoute | null {
    const userPatterns = [
      /user[:\s]+([^\s]+)/i,
      /u\/([^\s]+)/i,
      /redditor[:\s]+([^\s]+)/i,
      /reddit user[:\s]+([^\s]+)/i
    ];
    
    for (const pattern of userPatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          searchType: 'users',
          query: match[1],
          confidence: 0.95,
          reasoning: `Detected user search pattern: ${match[0]}`,
          suggestions: [
            'Try searching for specific usernames',
            'Use "u/username" format for exact matches',
            'Search for users by their activity or karma'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查subreddit搜索
   */
  private checkSubredditSearch(query: string): RedditSearchRoute | null {
    const subredditPatterns = [
      /r\/([^\s]+)/i,
      /subreddit[:\s]+([^\s]+)/i,
      /community[:\s]+([^\s]+)/i,
      /find subreddit/i,
      /reddit community/i
    ];
    
    for (const pattern of subredditPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return {
          searchType: 'subreddits',
          query: match[1],
          confidence: 0.9,
          reasoning: `Detected subreddit search pattern: ${match[0]}`,
          suggestions: [
            'Try searching for subreddit topics or names',
            'Use "r/subredditname" for exact matches',
            'Search by community description or rules'
          ]
        };
      }
    }
    
    // 检查是否在寻找subreddit
    if (query.includes('find') && (query.includes('subreddit') || query.includes('community'))) {
      const topicMatch = query.replace(/find|subreddit|community|for|about/g, '').trim();
      return {
        searchType: 'subreddits',
        query: topicMatch,
        confidence: 0.8,
        reasoning: 'Detected subreddit discovery intent',
        suggestions: [
          'Search for communities by topic',
          'Try specific interest keywords',
          'Look for active communities with good moderation'
        ]
      };
    }
    
    return null;
  }

  /**
   * 检查热门内容搜索
   */
  private checkHotContentSearch(query: string): RedditSearchRoute | null {
    const hotKeywords = this.TRENDING_KEYWORDS.hot;
    
    for (const keyword of hotKeywords) {
      if (query.includes(keyword)) {
        // 检查是否指定了subreddit
        const subredditMatch = query.match(/r\/(\w+)/i);
        
        return {
          searchType: 'hot',
          query: query,
          subreddit: subredditMatch ? subredditMatch[1] : undefined,
          confidence: 0.85,
          reasoning: `Detected hot content search with keyword: ${keyword}`,
          suggestions: [
            'Hot posts are currently trending on Reddit',
            'Try specifying a subreddit for focused results',
            'Hot content changes frequently throughout the day'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查顶级内容搜索
   */
  private checkTopContentSearch(query: string): RedditSearchRoute | null {
    const topKeywords = this.TRENDING_KEYWORDS.top;
    
    for (const keyword of topKeywords) {
      if (query.includes(keyword)) {
        // 检查时间范围
        const timeMatch = query.match(/\b(hour|day|week|month|year|all time)\b/i);
        const subredditMatch = query.match(/r\/(\w+)/i);
        
        return {
          searchType: 'top',
          query: query,
          subreddit: subredditMatch ? subredditMatch[1] : undefined,
          timeframe: this.normalizeTimeframe(timeMatch ? timeMatch[1] : 'day'),
          confidence: 0.85,
          reasoning: `Detected top content search with keyword: ${keyword}`,
          suggestions: [
            'Top posts are highest rated in the timeframe',
            'Try different time periods: day, week, month, year, all',
            'Specify a subreddit for focused results'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查特定subreddit内搜索
   */
  private checkSpecificSubredditSearch(query: string): RedditSearchRoute | null {
    // 检查 "in r/subreddit" 模式
    const inSubredditMatch = query.match(/(.+)\s+in\s+r\/(\w+)/i);
    if (inSubredditMatch) {
      return {
        searchType: 'specific_subreddit',
        query: inSubredditMatch[1].trim(),
        subreddit: inSubredditMatch[2],
        confidence: 0.9,
        reasoning: `Detected search within specific subreddit: r/${inSubredditMatch[2]}`,
        suggestions: [
          'Searching within a specific community',
          'Results will be limited to this subreddit',
          'Try different sort options for better results'
        ]
      };
    }
    
    // 检查主题是否匹配已知subreddit分类
    for (const [category, subreddits] of Object.entries(this.SUBREDDIT_CATEGORIES)) {
      if (query.includes(category)) {
        return {
          searchType: 'specific_subreddit',
          query: query,
          subreddit: subreddits[0], // 使用该分类的主要subreddit
          confidence: 0.7,
          reasoning: `Matched topic "${category}" to relevant subreddit`,
          suggestions: [
            `Try searching in r/${subreddits[0]} for ${category} content`,
            `Other relevant subreddits: ${subreddits.slice(1, 3).map(s => `r/${s}`).join(', ')}`,
            'Consider broadening search to all of Reddit'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 创建通用帖子搜索路由
   */
  private createPostsSearchRoute(originalQuery: string, normalizedQuery: string): RedditSearchRoute {
    // 分析查询以确定最佳排序方式
    let sortBy: 'relevance' | 'hot' | 'top' | 'new' | 'comments' = 'relevance';
    let confidence = 0.6;
    
    if (normalizedQuery.includes('recent') || normalizedQuery.includes('new')) {
      sortBy = 'new';
      confidence = 0.7;
    } else if (normalizedQuery.includes('popular') || normalizedQuery.includes('best')) {
      sortBy = 'top';
      confidence = 0.7;
    } else if (normalizedQuery.includes('discussion') || normalizedQuery.includes('comments')) {
      sortBy = 'comments';
      confidence = 0.7;
    }
    
    // 检查是否有相关的subreddit建议
    const suggestions = this.generateSearchSuggestions(normalizedQuery);
    
    return {
      searchType: 'posts',
      query: originalQuery,
      sortBy,
      confidence,
      reasoning: 'General post search with intelligent sorting',
      suggestions
    };
  }

  /**
   * 生成搜索建议
   */
  private generateSearchSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // 基于查询内容提供相关subreddit建议
    for (const [category, subreddits] of Object.entries(this.SUBREDDIT_CATEGORIES)) {
      if (query.includes(category) || subreddits.some(sub => query.includes(sub.toLowerCase()))) {
        suggestions.push(`Try searching in r/${subreddits[0]} for ${category} content`);
        break;
      }
    }
    
    // 通用建议
    suggestions.push(
      'Use specific keywords for better results',
      'Try sorting by "hot" for trending content',
      'Add "in r/subreddit" to search within specific communities'
    );
    
    return suggestions.slice(0, 3); // 限制为3个建议
  }

  /**
   * 标准化时间范围
   */
  private normalizeTimeframe(timeframe: string): 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' {
    const normalized = timeframe.toLowerCase();
    
    if (normalized.includes('hour')) return 'hour';
    if (normalized.includes('day')) return 'day';
    if (normalized.includes('week')) return 'week';
    if (normalized.includes('month')) return 'month';
    if (normalized.includes('year')) return 'year';
    if (normalized.includes('all')) return 'all';
    
    return 'day'; // 默认
  }

  /**
   * 验证查询
   */
  validateQuery(query: string): { valid: boolean; message?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, message: 'Query cannot be empty' };
    }
    
    if (query.length > 500) {
      return { valid: false, message: 'Query too long (max 500 characters)' };
    }
    
    // 检查是否包含不当内容标识
    const inappropriatePatterns = [
      /\b(nsfw|porn|xxx)\b/i,
      /\b(illegal|piracy|drugs)\b/i
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(query)) {
        return { valid: false, message: 'Query contains inappropriate content' };
      }
    }
    
    return { valid: true };
  }

  /**
   * 获取推荐的subreddit分类
   */
  getRecommendedCategories(): Record<string, string[]> {
    return this.SUBREDDIT_CATEGORIES;
  }

  /**
   * 获取搜索统计
   */
  getSearchStats(): any {
    return {
      supportedSearchTypes: ['posts', 'users', 'subreddits', 'hot', 'top', 'specific_subreddit'],
      subredditCategories: Object.keys(this.SUBREDDIT_CATEGORIES).length,
      totalSubreddits: Object.values(this.SUBREDDIT_CATEGORIES).flat().length,
      features: [
        'Intelligent query routing',
        'Subreddit category mapping',
        'User and community search',
        'Hot and top content discovery',
        'Time-based filtering',
        'Content type detection'
      ]
    };
  }
}
