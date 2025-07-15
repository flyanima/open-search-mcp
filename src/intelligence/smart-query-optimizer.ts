/**
 * 智能查询优化器
 * 实现基于平台特点的查询优化、实体提取和语义理解
 */

import { Logger } from '../utils/logger.js';
import { getConfigManager } from '../config/enhanced-config-manager.js';

export interface QueryContext {
  originalQuery: string;
  userIntent: QueryIntent;
  entities: ExtractedEntity[];
  keywords: string[];
  language: string;
  domain: QueryDomain;
  complexity: QueryComplexity;
  timestamp: number;
}

export interface QueryIntent {
  type: 'search' | 'research' | 'comparison' | 'factual' | 'trending' | 'analysis';
  confidence: number;
  subtype?: string;
  timeframe?: 'recent' | 'historical' | 'realtime' | 'any';
  scope?: 'broad' | 'specific' | 'deep';
}

export interface ExtractedEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'technology' | 'concept' | 'product' | 'event';
  confidence: number;
  aliases?: string[];
  context?: string;
}

export interface QueryDomain {
  primary: string;
  secondary?: string[];
  confidence: number;
}

export interface QueryComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'expert';
  factors: string[];
  score: number;
}

export interface OptimizedQuery {
  platform: string;
  query: string;
  parameters: Record<string, any>;
  reasoning: string;
  confidence: number;
  expectedResults: number;
}

export interface PlatformProfile {
  name: string;
  strengths: string[];
  weaknesses: string[];
  queryPatterns: QueryPattern[];
  parameters: PlatformParameter[];
  resultTypes: string[];
}

export interface QueryPattern {
  pattern: RegExp;
  transformation: (match: RegExpMatchArray, context: QueryContext) => string;
  description: string;
}

export interface PlatformParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  values?: string[];
  default?: any;
  description: string;
}

export class SmartQueryOptimizer {
  private logger: Logger;
  private platformProfiles: Map<string, PlatformProfile> = new Map();
  private entityPatterns: Map<string, RegExp> = new Map();
  private domainKeywords: Map<string, string[]> = new Map();
  private intentClassifiers: Map<string, RegExp> = new Map();

  constructor() {
    this.logger = new Logger('SmartQueryOptimizer');
    this.initializePlatformProfiles();
    this.initializeEntityPatterns();
    this.initializeDomainKeywords();
    this.initializeIntentClassifiers();
    
    this.logger.info('Smart query optimizer initialized');
  }

  /**
   * 分析查询上下文
   */
  public async analyzeQuery(query: string): Promise<QueryContext> {
    const startTime = Date.now();
    
    try {
      // 检测语言
      const language = this.detectLanguage(query);
      
      // 提取实体
      const entities = this.extractEntities(query);
      
      // 提取关键词
      const keywords = this.extractKeywords(query);
      
      // 识别用户意图
      const userIntent = this.classifyIntent(query, entities, keywords);
      
      // 确定查询域
      const domain = this.identifyDomain(query, entities, keywords);
      
      // 评估复杂度
      const complexity = this.assessComplexity(query, entities, keywords);

      const context: QueryContext = {
        originalQuery: query,
        userIntent,
        entities,
        keywords,
        language,
        domain,
        complexity,
        timestamp: Date.now()
      };

      this.logger.debug('Query analysis completed', {
        query: query.substring(0, 50),
        intent: userIntent.type,
        entities: entities.length,
        domain: domain.primary,
        complexity: complexity.level,
        processingTime: Date.now() - startTime
      });

      return context;
    } catch (error) {
      this.logger.error('Query analysis failed:', error);
      throw error;
    }
  }

  /**
   * 为特定平台优化查询
   */
  public optimizeForPlatform(context: QueryContext, platform: string): OptimizedQuery {
    const profile = this.platformProfiles.get(platform);
    
    if (!profile) {
      // 返回基本优化
      return {
        platform,
        query: context.originalQuery,
        parameters: {},
        reasoning: 'No platform profile available, using original query',
        confidence: 0.5,
        expectedResults: 10
      };
    }

    // 应用平台特定的查询模式
    let optimizedQuery = context.originalQuery;
    let reasoning = 'Applied optimizations: ';
    const appliedOptimizations: string[] = [];

    // 1. 应用查询模式转换
    for (const pattern of profile.queryPatterns) {
      const match = optimizedQuery.match(pattern.pattern);
      if (match) {
        const transformed = pattern.transformation(match, context);
        if (transformed !== optimizedQuery) {
          optimizedQuery = transformed;
          appliedOptimizations.push(pattern.description);
        }
      }
    }

    // 2. 基于实体优化
    optimizedQuery = this.optimizeWithEntities(optimizedQuery, context.entities, platform);
    
    // 3. 基于意图优化
    optimizedQuery = this.optimizeWithIntent(optimizedQuery, context.userIntent, platform);
    
    // 4. 基于域优化
    optimizedQuery = this.optimizeWithDomain(optimizedQuery, context.domain, platform);

    // 5. 生成平台参数
    const parameters = this.generatePlatformParameters(context, profile);

    // 6. 估算期望结果数
    const expectedResults = this.estimateResultCount(context, platform);

    // 7. 计算置信度
    const confidence = this.calculateOptimizationConfidence(context, profile, appliedOptimizations);

    reasoning += appliedOptimizations.join(', ') || 'basic query normalization';

    return {
      platform,
      query: optimizedQuery,
      parameters,
      reasoning,
      confidence,
      expectedResults
    };
  }

  /**
   * 批量优化查询
   */
  public async optimizeForMultiplePlatforms(
    query: string, 
    platforms: string[]
  ): Promise<Map<string, OptimizedQuery>> {
    const context = await this.analyzeQuery(query);
    const results = new Map<string, OptimizedQuery>();

    for (const platform of platforms) {
      try {
        const optimized = this.optimizeForPlatform(context, platform);
        results.set(platform, optimized);
      } catch (error) {
        this.logger.warn(`Failed to optimize for platform ${platform}:`, error);
      }
    }

    return results;
  }

  /**
   * 初始化平台配置
   */
  private initializePlatformProfiles(): void {
    // Google搜索优化
    this.platformProfiles.set('google', {
      name: 'Google Search',
      strengths: ['comprehensive', 'recent', 'authoritative'],
      weaknesses: ['commercial bias', 'filter bubble'],
      queryPatterns: [
        {
          pattern: /^(.+)\s+最新$/,
          transformation: (match) => `${match[1]} after:2024`,
          description: 'temporal query optimization'
        },
        {
          pattern: /^(.+)\s+教程$/,
          transformation: (match) => `${match[1]} tutorial OR guide OR "how to"`,
          description: 'tutorial query expansion'
        }
      ],
      parameters: [
        { name: 'lr', type: 'string', description: 'Language restriction' },
        { name: 'cr', type: 'string', description: 'Country restriction' },
        { name: 'dateRestrict', type: 'string', description: 'Date restriction' }
      ],
      resultTypes: ['web', 'news', 'images', 'videos']
    });

    // 学术搜索优化
    this.platformProfiles.set('arxiv', {
      name: 'arXiv',
      strengths: ['academic', 'preprints', 'technical'],
      weaknesses: ['limited scope', 'no peer review'],
      queryPatterns: [
        {
          pattern: /^(.+)\s+论文$/,
          transformation: (match) => match[1],
          description: 'academic query normalization'
        },
        {
          pattern: /机器学习|人工智能/,
          transformation: () => 'machine learning OR artificial intelligence',
          description: 'ML/AI term standardization'
        }
      ],
      parameters: [
        { name: 'searchtype', type: 'enum', values: ['all', 'title', 'author'], default: 'all', description: 'Search type for arXiv' },
        { name: 'classification-physics', type: 'boolean', default: false, description: 'Include physics classification' }
      ],
      resultTypes: ['papers', 'preprints']
    });

    // 新闻搜索优化
    this.platformProfiles.set('newsapi', {
      name: 'NewsAPI',
      strengths: ['realtime', 'diverse sources', 'categorized'],
      weaknesses: ['limited history', 'source quality varies'],
      queryPatterns: [
        {
          pattern: /^(.+)\s+新闻$/,
          transformation: (match) => match[1],
          description: 'news query normalization'
        }
      ],
      parameters: [
        { name: 'sortBy', type: 'enum', values: ['relevancy', 'popularity', 'publishedAt'], default: 'publishedAt', description: 'Sort order for news results' },
        { name: 'language', type: 'string', default: 'zh', description: 'Language for news results' }
      ],
      resultTypes: ['articles', 'headlines']
    });

    this.logger.debug(`Initialized ${this.platformProfiles.size} platform profiles`);
  }

  /**
   * 初始化实体识别模式
   */
  private initializeEntityPatterns(): void {
    this.entityPatterns.set('person', /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
    this.entityPatterns.set('organization', /\b[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*(?:\s+(?:Inc|Corp|Ltd|LLC|Co)\.?)\b/g);
    this.entityPatterns.set('technology', /\b(?:AI|ML|JavaScript|Python|React|Vue|Angular|Docker|Kubernetes)\b/gi);
    this.entityPatterns.set('location', /\b(?:北京|上海|深圳|广州|杭州|成都|武汉|西安|南京|苏州)\b/g);
  }

  /**
   * 初始化领域关键词
   */
  private initializeDomainKeywords(): void {
    this.domainKeywords.set('technology', ['编程', '开发', '软件', '算法', '数据库', 'API', '框架']);
    this.domainKeywords.set('science', ['研究', '实验', '理论', '发现', '科学', '学术']);
    this.domainKeywords.set('business', ['公司', '市场', '投资', '经济', '商业', '财务']);
    this.domainKeywords.set('education', ['学习', '教育', '课程', '培训', '知识', '技能']);
    this.domainKeywords.set('health', ['健康', '医疗', '疾病', '治疗', '药物', '症状']);
  }

  /**
   * Initialize intent classifiers
   */
  private initializeIntentClassifiers(): void {
    this.intentClassifiers.set('search', /^(?:search|find|look|locate)/);
    this.intentClassifiers.set('research', /^(?:research|analyze|investigate|explore)/);
    this.intentClassifiers.set('comparison', /^(?:compare|contrast|difference|versus)/);
    this.intentClassifiers.set('factual', /^(?:what is|how|why|when)/);
    this.intentClassifiers.set('trending', /^(?:latest|trending|popular|current)/);
  }

  /**
   * Detect query language
   */
  private detectLanguage(query: string): string {
    const chinesePattern = /[\u4e00-\u9fff]/;
    return chinesePattern.test(query) ? 'zh' : 'en';
  }

  /**
   * 提取实体
   */
  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    for (const [type, pattern] of this.entityPatterns.entries()) {
      const matches = query.match(pattern);
      if (matches) {
        for (const match of matches) {
          entities.push({
            text: match,
            type: type as any,
            confidence: 0.8,
            context: query
          });
        }
      }
    }
    
    return entities;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 简单的关键词提取
    const stopWords = new Set(['的', '是', '在', '有', '和', '与', '或', '但', '如果', 'the', 'is', 'in', 'and', 'or', 'but', 'if']);
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word))
      .slice(0, 10); // 限制关键词数量
  }

  /**
   * 分类用户意图
   */
  private classifyIntent(query: string, entities: ExtractedEntity[], keywords: string[]): QueryIntent {
    for (const [type, pattern] of this.intentClassifiers.entries()) {
      if (pattern.test(query)) {
        return {
          type: type as any,
          confidence: 0.8,
          timeframe: this.detectTimeframe(query),
          scope: this.detectScope(query, entities)
        };
      }
    }
    
    // 默认意图
    return {
      type: 'search',
      confidence: 0.6,
      timeframe: 'any',
      scope: 'broad'
    };
  }

  /**
   * 识别查询域
   */
  private identifyDomain(query: string, entities: ExtractedEntity[], keywords: string[]): QueryDomain {
    let maxScore = 0;
    let primaryDomain = 'general';
    
    for (const [domain, domainKeywords] of this.domainKeywords.entries()) {
      const score = keywords.filter(keyword => 
        domainKeywords.some(dk => keyword.includes(dk) || dk.includes(keyword))
      ).length;
      
      if (score > maxScore) {
        maxScore = score;
        primaryDomain = domain;
      }
    }
    
    return {
      primary: primaryDomain,
      confidence: maxScore > 0 ? Math.min(maxScore / keywords.length, 1) : 0.3
    };
  }

  /**
   * 评估查询复杂度
   */
  private assessComplexity(query: string, entities: ExtractedEntity[], keywords: string[]): QueryComplexity {
    const factors: string[] = [];
    let score = 0;
    
    // 查询长度
    if (query.length > 100) {
      factors.push('long query');
      score += 2;
    }
    
    // 实体数量
    if (entities.length > 3) {
      factors.push('multiple entities');
      score += 2;
    }
    
    // 关键词数量
    if (keywords.length > 5) {
      factors.push('many keywords');
      score += 1;
    }
    
    // 复杂操作符
    if (/AND|OR|NOT|\+|\-|"/.test(query)) {
      factors.push('boolean operators');
      score += 3;
    }
    
    let level: QueryComplexity['level'];
    if (score >= 6) level = 'expert';
    else if (score >= 4) level = 'complex';
    else if (score >= 2) level = 'moderate';
    else level = 'simple';
    
    return { level, factors, score };
  }

  /**
   * 检测时间范围
   */
  private detectTimeframe(query: string): QueryIntent['timeframe'] {
    if (/最新|最近|今天|昨天|本周|本月/.test(query)) return 'recent';
    if (/历史|过去|以前|曾经/.test(query)) return 'historical';
    if (/实时|现在|当前|正在/.test(query)) return 'realtime';
    return 'any';
  }

  /**
   * 检测查询范围
   */
  private detectScope(query: string, entities: ExtractedEntity[]): QueryIntent['scope'] {
    if (entities.length > 2 || query.length > 50) return 'broad';
    if (/具体|详细|深入|专业/.test(query)) return 'deep';
    return 'specific';
  }

  /**
   * 基于实体优化查询
   */
  private optimizeWithEntities(query: string, entities: ExtractedEntity[], platform: string): string {
    // 为不同平台优化实体表示
    if (platform === 'arxiv' && entities.some(e => e.type === 'technology')) {
      // 学术平台使用英文技术术语
      return query.replace(/机器学习/g, 'machine learning')
                  .replace(/人工智能/g, 'artificial intelligence');
    }
    
    return query;
  }

  /**
   * 基于意图优化查询
   */
  private optimizeWithIntent(query: string, intent: QueryIntent, platform: string): string {
    if (intent.type === 'trending' && platform === 'newsapi') {
      // 新闻平台的趋势查询
      return query + ' 2024';
    }
    
    if (intent.type === 'research' && platform === 'arxiv') {
      // 学术平台的研究查询
      return query.replace(/研究/, 'research OR study OR analysis');
    }
    
    return query;
  }

  /**
   * 基于域优化查询
   */
  private optimizeWithDomain(query: string, domain: QueryDomain, platform: string): string {
    if (domain.primary === 'technology' && platform === 'github') {
      // GitHub平台的技术查询
      return query + ' language:javascript OR language:python OR language:typescript';
    }
    
    return query;
  }

  /**
   * 生成平台参数
   */
  private generatePlatformParameters(context: QueryContext, profile: PlatformProfile): Record<string, any> {
    const params: Record<string, any> = {};
    
    for (const param of profile.parameters) {
      if (param.name === 'language' || param.name === 'lr') {
        params[param.name] = context.language;
      } else if (param.name === 'sortBy' && context.userIntent.type === 'trending') {
        params[param.name] = 'publishedAt';
      } else if (param.default !== undefined) {
        params[param.name] = param.default;
      }
    }
    
    return params;
  }

  /**
   * 估算结果数量
   */
  private estimateResultCount(context: QueryContext, platform: string): number {
    let baseCount = 10;
    
    // 基于复杂度调整
    if (context.complexity.level === 'simple') baseCount = 15;
    else if (context.complexity.level === 'complex') baseCount = 5;
    
    // 基于平台调整
    if (platform === 'arxiv') baseCount = Math.min(baseCount, 8);
    else if (platform === 'newsapi') baseCount = Math.min(baseCount, 20);
    
    return baseCount;
  }

  /**
   * 计算优化置信度
   */
  private calculateOptimizationConfidence(
    context: QueryContext, 
    profile: PlatformProfile, 
    appliedOptimizations: string[]
  ): number {
    let confidence = 0.5; // 基础置信度
    
    // 基于应用的优化数量
    confidence += appliedOptimizations.length * 0.1;
    
    // 基于实体识别质量
    const avgEntityConfidence = context.entities.length > 0 
      ? context.entities.reduce((sum, e) => sum + e.confidence, 0) / context.entities.length
      : 0;
    confidence += avgEntityConfidence * 0.2;
    
    // 基于意图识别置信度
    confidence += context.userIntent.confidence * 0.2;
    
    // 基于域识别置信度
    confidence += context.domain.confidence * 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 获取优化统计
   */
  public getOptimizationStats(): any {
    return {
      platformProfiles: this.platformProfiles.size,
      entityPatterns: this.entityPatterns.size,
      domainKeywords: this.domainKeywords.size,
      intentClassifiers: this.intentClassifiers.size
    };
  }
}

// 单例实例
let optimizerInstance: SmartQueryOptimizer | null = null;

export function getSmartQueryOptimizer(): SmartQueryOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new SmartQueryOptimizer();
  }
  return optimizerInstance;
}

/**
 * 查询优化服务
 * 提供高级查询优化功能的统一接口
 */
export class QueryOptimizationService {
  private optimizer: SmartQueryOptimizer;
  private logger: Logger;

  constructor() {
    this.optimizer = getSmartQueryOptimizer();
    this.logger = new Logger('QueryOptimizationService');
  }

  /**
   * 智能搜索路由
   * 根据查询内容自动选择最佳平台组合
   */
  public async smartRoute(query: string): Promise<{
    primary: string;
    secondary: string[];
    reasoning: string;
  }> {
    const context = await this.optimizer.analyzeQuery(query);

    let primary = 'google'; // 默认主要平台
    const secondary: string[] = [];
    const reasons: string[] = [];

    // 基于域选择主要平台
    switch (context.domain.primary) {
      case 'technology':
        primary = 'github';
        secondary.push('stackoverflow', 'google');
        reasons.push('Technology domain detected, using GitHub as primary');
        break;
      case 'science':
        primary = 'arxiv';
        secondary.push('pubmed', 'google');
        reasons.push('Science domain detected, using arXiv as primary');
        break;
      case 'business':
        primary = 'google';
        secondary.push('newsapi', 'reddit');
        reasons.push('Business domain detected, using Google with news sources');
        break;
      default:
        secondary.push('wikipedia', 'reddit');
        reasons.push('General query, using Google with knowledge sources');
    }

    // 基于意图调整
    if (context.userIntent.type === 'trending') {
      if (!secondary.includes('newsapi')) secondary.unshift('newsapi');
      reasons.push('Trending intent detected, prioritizing news sources');
    }

    if (context.userIntent.type === 'research') {
      if (!secondary.includes('arxiv')) secondary.unshift('arxiv');
      reasons.push('Research intent detected, including academic sources');
    }

    return {
      primary,
      secondary: secondary.slice(0, 3), // 限制辅助平台数量
      reasoning: reasons.join('; ')
    };
  }

  /**
   * 批量优化查询
   */
  public async batchOptimize(queries: string[]): Promise<Map<string, QueryContext>> {
    const results = new Map<string, QueryContext>();

    for (const query of queries) {
      try {
        const context = await this.optimizer.analyzeQuery(query);
        results.set(query, context);
      } catch (error) {
        this.logger.warn(`Failed to analyze query: ${query}`, error);
      }
    }

    return results;
  }
}

export function getQueryOptimizationService(): QueryOptimizationService {
  return new QueryOptimizationService();
}
