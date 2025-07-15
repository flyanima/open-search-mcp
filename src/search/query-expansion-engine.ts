/**
 * Query Expansion Engine - 查询扩展引擎
 * 
 * 核心功能：
 * - 智能查询扩展
 * - 同义词和相关词生成
 * - 上下文感知扩展
 * - 多语言支持
 * - 领域特定扩展
 */

import { Logger } from '../utils/logger.js';

/**
 * 扩展策略枚举
 */
export enum ExpansionStrategy {
  SYNONYMS = 'synonyms',           // 同义词扩展
  RELATED_TERMS = 'related_terms', // 相关词扩展
  CONTEXTUAL = 'contextual',       // 上下文扩展
  SEMANTIC = 'semantic',           // 语义扩展
  DOMAIN_SPECIFIC = 'domain_specific', // 领域特定扩展
  TEMPORAL = 'temporal',           // 时间相关扩展
  GEOGRAPHICAL = 'geographical'    // 地理相关扩展
}

/**
 * 扩展配置接口
 */
export interface ExpansionConfig {
  strategies: ExpansionStrategy[];
  maxExpansions: number;
  confidenceThreshold: number;
  preserveOriginal: boolean;
  language: string;
  domain?: string;
  context?: string;
  timeframe?: {
    start?: Date;
    end?: Date;
  };
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

/**
 * 扩展结果接口
 */
export interface ExpansionResult {
  originalQuery: string;
  expandedQueries: ExpandedQuery[];
  metadata: {
    totalExpansions: number;
    strategiesUsed: ExpansionStrategy[];
    processingTime: number;
    confidence: number;
  };
}

/**
 * 扩展查询接口
 */
export interface ExpandedQuery {
  query: string;
  strategy: ExpansionStrategy;
  confidence: number;
  source: string;
  weight: number;
  metadata?: {
    synonyms?: string[];
    relatedTerms?: string[];
    context?: string;
  };
}

/**
 * 查询扩展引擎类
 */
export class QueryExpansionEngine {
  private logger: Logger;
  private synonymDatabase: Map<string, string[]> = new Map();
  private relatedTermsDatabase: Map<string, string[]> = new Map();
  private domainKnowledge: Map<string, Map<string, string[]>> = new Map();

  constructor() {
    this.logger = new Logger('QueryExpansionEngine');
    this.initializeDatabases();
  }

  /**
   * 扩展查询
   */
  async expandQuery(query: string, config: Partial<ExpansionConfig> = {}): Promise<ExpansionResult> {
    const startTime = Date.now();
    
    const fullConfig: ExpansionConfig = {
      strategies: [ExpansionStrategy.SYNONYMS, ExpansionStrategy.RELATED_TERMS],
      maxExpansions: 10,
      confidenceThreshold: 0.6,
      preserveOriginal: true,
      language: 'zh-CN',
      ...config
    };

    this.logger.info(`Expanding query: "${query}" with strategies: ${fullConfig.strategies.join(', ')}`);

    const expandedQueries: ExpandedQuery[] = [];

    // 添加原始查询
    if (fullConfig.preserveOriginal) {
      expandedQueries.push({
        query,
        strategy: ExpansionStrategy.SYNONYMS,
        confidence: 1.0,
        source: 'original',
        weight: 1.0
      });
    }

    // 应用各种扩展策略
    for (const strategy of fullConfig.strategies) {
      const strategyResults = await this.applyStrategy(query, strategy, fullConfig);
      expandedQueries.push(...strategyResults);
    }

    // 过滤和排序结果
    const filteredQueries = this.filterAndRankQueries(expandedQueries, fullConfig);
    
    const processingTime = Date.now() - startTime;
    const avgConfidence = filteredQueries.reduce((sum, q) => sum + q.confidence, 0) / filteredQueries.length;

    return {
      originalQuery: query,
      expandedQueries: filteredQueries,
      metadata: {
        totalExpansions: filteredQueries.length,
        strategiesUsed: fullConfig.strategies,
        processingTime,
        confidence: avgConfidence
      }
    };
  }

  /**
   * 应用扩展策略
   */
  private async applyStrategy(
    query: string,
    strategy: ExpansionStrategy,
    config: ExpansionConfig
  ): Promise<ExpandedQuery[]> {
    switch (strategy) {
      case ExpansionStrategy.SYNONYMS:
        return this.applySynonymExpansion(query, config);
      case ExpansionStrategy.RELATED_TERMS:
        return this.applyRelatedTermsExpansion(query, config);
      case ExpansionStrategy.CONTEXTUAL:
        return this.applyContextualExpansion(query, config);
      case ExpansionStrategy.SEMANTIC:
        return this.applySemanticExpansion(query, config);
      case ExpansionStrategy.DOMAIN_SPECIFIC:
        return this.applyDomainSpecificExpansion(query, config);
      case ExpansionStrategy.TEMPORAL:
        return this.applyTemporalExpansion(query, config);
      case ExpansionStrategy.GEOGRAPHICAL:
        return this.applyGeographicalExpansion(query, config);
      default:
        return [];
    }
  }

  /**
   * 同义词扩展
   */
  private applySynonymExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    const words = this.tokenizeQuery(query);
    
    for (const word of words) {
      const synonyms = this.synonymDatabase.get(word.toLowerCase()) || [];
      
      for (const synonym of synonyms) {
        const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
        if (expandedQuery !== query) {
          results.push({
            query: expandedQuery,
            strategy: ExpansionStrategy.SYNONYMS,
            confidence: 0.8,
            source: 'synonym_database',
            weight: 0.9,
            metadata: {
              synonyms: [synonym]
            }
          });
        }
      }
    }
    
    return results;
  }

  /**
   * 相关词扩展
   */
  private applyRelatedTermsExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    const words = this.tokenizeQuery(query);
    
    for (const word of words) {
      const relatedTerms = this.relatedTermsDatabase.get(word.toLowerCase()) || [];
      
      for (const term of relatedTerms) {
        const expandedQuery = `${query} ${term}`;
        results.push({
          query: expandedQuery,
          strategy: ExpansionStrategy.RELATED_TERMS,
          confidence: 0.7,
          source: 'related_terms_database',
          weight: 0.8,
          metadata: {
            relatedTerms: [term]
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 上下文扩展
   */
  private applyContextualExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    
    if (config.context) {
      const contextWords = this.extractKeywords(config.context);
      
      for (const keyword of contextWords.slice(0, 3)) {
        const expandedQuery = `${query} ${keyword}`;
        results.push({
          query: expandedQuery,
          strategy: ExpansionStrategy.CONTEXTUAL,
          confidence: 0.75,
          source: 'context_analysis',
          weight: 0.85,
          metadata: {
            context: config.context
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 语义扩展
   */
  private applySemanticExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    
    // 模拟语义扩展
    const semanticVariations = this.generateSemanticVariations(query);
    
    for (const variation of semanticVariations) {
      results.push({
        query: variation,
        strategy: ExpansionStrategy.SEMANTIC,
        confidence: 0.65,
        source: 'semantic_model',
        weight: 0.7
      });
    }
    
    return results;
  }

  /**
   * 领域特定扩展
   */
  private applyDomainSpecificExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    
    if (config.domain) {
      const domainTerms = this.domainKnowledge.get(config.domain);
      if (domainTerms) {
        const words = this.tokenizeQuery(query);
        
        for (const word of words) {
          const domainSpecificTerms = domainTerms.get(word.toLowerCase()) || [];
          
          for (const term of domainSpecificTerms) {
            const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), term);
            if (expandedQuery !== query) {
              results.push({
                query: expandedQuery,
                strategy: ExpansionStrategy.DOMAIN_SPECIFIC,
                confidence: 0.85,
                source: `domain_${config.domain}`,
                weight: 0.9
              });
            }
          }
        }
      }
    }
    
    return results;
  }

  /**
   * 时间相关扩展
   */
  private applyTemporalExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    
    if (config.timeframe) {
      const timeTerms = this.generateTimeTerms(config.timeframe);
      
      for (const timeTerm of timeTerms) {
        const expandedQuery = `${query} ${timeTerm}`;
        results.push({
          query: expandedQuery,
          strategy: ExpansionStrategy.TEMPORAL,
          confidence: 0.7,
          source: 'temporal_analysis',
          weight: 0.75
        });
      }
    }
    
    return results;
  }

  /**
   * 地理相关扩展
   */
  private applyGeographicalExpansion(query: string, config: ExpansionConfig): ExpandedQuery[] {
    const results: ExpandedQuery[] = [];
    
    if (config.location) {
      const locationTerms = this.generateLocationTerms(config.location);
      
      for (const locationTerm of locationTerms) {
        const expandedQuery = `${query} ${locationTerm}`;
        results.push({
          query: expandedQuery,
          strategy: ExpansionStrategy.GEOGRAPHICAL,
          confidence: 0.8,
          source: 'geographical_analysis',
          weight: 0.8
        });
      }
    }
    
    return results;
  }

  /**
   * 过滤和排序查询
   */
  private filterAndRankQueries(queries: ExpandedQuery[], config: ExpansionConfig): ExpandedQuery[] {
    // 去重
    const uniqueQueries = queries.filter((query, index, self) => 
      index === self.findIndex(q => q.query === query.query)
    );
    
    // 过滤低置信度查询
    const filteredQueries = uniqueQueries.filter(q => q.confidence >= config.confidenceThreshold);
    
    // 按权重和置信度排序
    const sortedQueries = filteredQueries.sort((a, b) => {
      const scoreA = a.confidence * a.weight;
      const scoreB = b.confidence * b.weight;
      return scoreB - scoreA;
    });
    
    // 限制数量
    return sortedQueries.slice(0, config.maxExpansions);
  }

  /**
   * 工具方法
   */
  private tokenizeQuery(query: string): string[] {
    return query.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  private extractKeywords(text: string): string[] {
    const words = this.tokenizeQuery(text);
    // 简单的关键词提取，实际应用中可以使用更复杂的算法
    return words.filter(word => word.length > 3).slice(0, 5);
  }

  private generateSemanticVariations(query: string): string[] {
    // 模拟语义变化生成
    const variations = [
      `${query} 相关`,
      `${query} 研究`,
      `${query} 分析`,
      `${query} 发展`,
      `${query} 应用`
    ];
    
    return variations;
  }

  private generateTimeTerms(timeframe: ExpansionConfig['timeframe']): string[] {
    const terms: string[] = [];
    
    if (timeframe?.start) {
      const year = timeframe.start.getFullYear();
      terms.push(`${year}年`, `自${year}年`);
    }
    
    if (timeframe?.end) {
      const year = timeframe.end.getFullYear();
      terms.push(`${year}年前`, `截至${year}年`);
    }
    
    // 添加通用时间词
    terms.push('最新', '近期', '当前', '历史');
    
    return terms;
  }

  private generateLocationTerms(location: ExpansionConfig['location']): string[] {
    const terms: string[] = [];
    
    if (location?.country) {
      terms.push(location.country, `${location.country}地区`);
    }
    
    if (location?.region) {
      terms.push(location.region, `${location.region}省`);
    }
    
    if (location?.city) {
      terms.push(location.city, `${location.city}市`);
    }
    
    return terms;
  }

  /**
   * 初始化数据库
   */
  private initializeDatabases(): void {
    // 初始化同义词数据库
    this.synonymDatabase.set('人工智能', ['AI', '机器智能', '智能系统', '认知计算']);
    this.synonymDatabase.set('机器学习', ['ML', '机器训练', '自动学习', '算法学习']);
    this.synonymDatabase.set('深度学习', ['DL', '神经网络', '深层网络', '深度神经网络']);
    this.synonymDatabase.set('研究', ['调研', '分析', '探索', '考察', '研讨']);
    this.synonymDatabase.set('发展', ['进展', '演进', '发育', '成长', '进步']);
    this.synonymDatabase.set('技术', ['科技', '工艺', '技能', '方法', '手段']);
    
    // 初始化相关词数据库
    this.relatedTermsDatabase.set('人工智能', ['算法', '数据', '计算', '自动化', '智能化']);
    this.relatedTermsDatabase.set('机器学习', ['训练数据', '模型', '预测', '分类', '回归']);
    this.relatedTermsDatabase.set('深度学习', ['卷积', '循环', '注意力', '变换器', 'GPU']);
    this.relatedTermsDatabase.set('区块链', ['加密', '去中心化', '共识', '智能合约', '数字货币']);
    this.relatedTermsDatabase.set('云计算', ['虚拟化', '分布式', '弹性', '服务', '存储']);
    
    // 初始化领域知识
    const aiDomain = new Map<string, string[]>();
    aiDomain.set('算法', ['神经网络', '决策树', '支持向量机', '随机森林']);
    aiDomain.set('应用', ['计算机视觉', '自然语言处理', '语音识别', '推荐系统']);
    this.domainKnowledge.set('ai', aiDomain);
    
    const medicalDomain = new Map<string, string[]>();
    medicalDomain.set('诊断', ['影像学', '病理学', '实验室检查', '临床表现']);
    medicalDomain.set('治疗', ['药物治疗', '手术治疗', '物理治疗', '心理治疗']);
    this.domainKnowledge.set('medical', medicalDomain);
    
    this.logger.info('Query expansion databases initialized');
  }

  /**
   * 添加同义词
   */
  addSynonym(word: string, synonyms: string[]): void {
    const existing = this.synonymDatabase.get(word.toLowerCase()) || [];
    this.synonymDatabase.set(word.toLowerCase(), [...existing, ...synonyms]);
  }

  /**
   * 添加相关词
   */
  addRelatedTerms(word: string, terms: string[]): void {
    const existing = this.relatedTermsDatabase.get(word.toLowerCase()) || [];
    this.relatedTermsDatabase.set(word.toLowerCase(), [...existing, ...terms]);
  }

  /**
   * 获取扩展统计
   */
  getExpansionStats(): {
    synonymsCount: number;
    relatedTermsCount: number;
    domainsCount: number;
  } {
    return {
      synonymsCount: this.synonymDatabase.size,
      relatedTermsCount: this.relatedTermsDatabase.size,
      domainsCount: this.domainKnowledge.size
    };
  }

  /**
   * 批量扩展查询
   */
  async expandQueries(queries: string[], config: Partial<ExpansionConfig> = {}): Promise<ExpansionResult[]> {
    const results: ExpansionResult[] = [];
    
    for (const query of queries) {
      const result = await this.expandQuery(query, config);
      results.push(result);
    }
    
    return results;
  }

  /**
   * 导出扩展结果
   */
  exportExpansionResult(result: ExpansionResult, format: 'json' | 'csv' | 'txt' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'csv':
        const headers = ['Original Query', 'Expanded Query', 'Strategy', 'Confidence', 'Weight'];
        const rows = result.expandedQueries.map(eq => [
          result.originalQuery,
          eq.query,
          eq.strategy,
          eq.confidence.toString(),
          eq.weight.toString()
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
      case 'txt':
        let output = `Original Query: ${result.originalQuery}\n\n`;
        output += 'Expanded Queries:\n';
        result.expandedQueries.forEach((eq, i) => {
          output += `${i + 1}. ${eq.query} (${eq.strategy}, confidence: ${eq.confidence})\n`;
        });
        return output;
      default:
        return JSON.stringify(result, null, 2);
    }
  }
}
