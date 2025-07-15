/**
 * Research Query Decomposer - 智能研究查询分解器
 * 将复杂的研究问题分解为可执行的子查询
 */

import { Logger } from '../utils/logger.js';

export interface ResearchQuery {
  id: string;
  originalQuery: string;
  domain: ResearchDomain;
  complexity: QueryComplexity;
  timeframe?: string;
  language: string;
  priority: number;
  metadata: QueryMetadata;
}

export interface DecomposedQuery {
  id: string;
  parentQueryId: string;
  subQuery: string;
  type: SubQueryType;
  priority: number;
  dependencies: string[];
  estimatedTime: number;
  searchStrategy: SearchStrategy;
  expectedResultType: ResultType;
  metadata: SubQueryMetadata;
}

export interface QueryMetadata {
  createdAt: string;
  source: string;
  context?: string;
  userIntent: UserIntent;
  requiredDepth: 'surface' | 'moderate' | 'deep' | 'comprehensive';
  expectedOutputFormat: 'summary' | 'detailed' | 'academic' | 'practical' | 'executive' | 'technical';
}

export interface SubQueryMetadata {
  createdAt: string;
  decompositionReason: string;
  expectedContribution: string;
  qualityThreshold: number;
  maxResults: number;
}

export type ResearchDomain = 
  | 'technology' 
  | 'science' 
  | 'business' 
  | 'academic' 
  | 'news' 
  | 'general'
  | 'medical'
  | 'legal'
  | 'finance';

export type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'multi-faceted';

export type SubQueryType = 
  | 'factual'           // 事实查询
  | 'analytical'        // 分析性查询
  | 'comparative'       // 比较性查询
  | 'temporal'          // 时间相关查询
  | 'causal'           // 因果关系查询
  | 'definitional'     // 定义性查询
  | 'procedural'       // 程序性查询
  | 'evaluative';      // 评估性查询

export type SearchStrategy = 
  | 'broad_search'      // 广泛搜索
  | 'specific_search'   // 精确搜索
  | 'academic_search'   // 学术搜索
  | 'news_search'       // 新闻搜索
  | 'expert_search'     // 专家观点搜索
  | 'data_search';      // 数据搜索

export type ResultType = 
  | 'facts'
  | 'opinions'
  | 'data'
  | 'analysis'
  | 'examples'
  | 'definitions'
  | 'procedures'
  | 'comparisons';

export type UserIntent = 
  | 'learn'             // 学习了解
  | 'research'          // 深度研究
  | 'compare'           // 比较分析
  | 'solve'             // 解决问题
  | 'decide'            // 决策支持
  | 'create';           // 创作创新

export interface DecompositionResult {
  originalQuery: ResearchQuery;
  subQueries: DecomposedQuery[];
  executionPlan: ExecutionPlan;
  estimatedTotalTime: number;
  confidence: number;
  decompositionStrategy: string;
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  parallelGroups: string[][];
  dependencies: Map<string, string[]>;
  criticalPath: string[];
}

export interface ExecutionPhase {
  id: string;
  name: string;
  description: string;
  subQueryIds: string[];
  estimatedTime: number;
  canRunInParallel: boolean;
}

export class ResearchQueryDecomposer {
  private logger: Logger;
  private decompositionStrategies: Map<QueryComplexity, DecompositionStrategy>;

  constructor() {
    this.logger = new Logger('ResearchQueryDecomposer');
    this.decompositionStrategies = this.initializeStrategies();
  }

  /**
   * 分解研究查询
   */
  async decomposeQuery(query: ResearchQuery): Promise<DecompositionResult> {
    this.logger.info(`Decomposing research query: ${query.originalQuery}`);

    try {
      // 1. 分析查询复杂度和领域
      const analysis = await this.analyzeQuery(query);
      
      // 2. 选择分解策略
      const strategy = this.selectDecompositionStrategy(analysis);
      
      // 3. 执行分解
      const subQueries = await this.executeDecomposition(query, strategy);
      
      // 4. 生成执行计划
      const executionPlan = this.generateExecutionPlan(subQueries);
      
      // 5. 计算总体指标
      const estimatedTotalTime = this.calculateTotalTime(executionPlan);
      const confidence = this.calculateConfidence(query, subQueries);

      const result: DecompositionResult = {
        originalQuery: query,
        subQueries,
        executionPlan,
        estimatedTotalTime,
        confidence,
        decompositionStrategy: strategy.name
      };

      this.logger.info(`Query decomposed into ${subQueries.length} sub-queries`);
      return result;

    } catch (error) {
      this.logger.error('Query decomposition failed:', error);
      throw new Error(`Failed to decompose query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 分析查询
   */
  private async analyzeQuery(query: ResearchQuery): Promise<QueryAnalysis> {
    const analysis: QueryAnalysis = {
      complexity: this.assessComplexity(query.originalQuery),
      domain: this.detectDomain(query.originalQuery),
      intent: this.detectIntent(query.originalQuery),
      keyEntities: this.extractKeyEntities(query.originalQuery),
      temporalAspects: this.detectTemporalAspects(query.originalQuery),
      requiredPerspectives: this.identifyPerspectives(query.originalQuery)
    };

    return analysis;
  }

  /**
   * 选择分解策略
   */
  private selectDecompositionStrategy(analysis: QueryAnalysis): DecompositionStrategy {
    const strategy = this.decompositionStrategies.get(analysis.complexity);
    
    if (!strategy) {
      return this.decompositionStrategies.get('moderate')!;
    }

    return strategy;
  }

  /**
   * 执行分解
   */
  private async executeDecomposition(
    query: ResearchQuery, 
    strategy: DecompositionStrategy
  ): Promise<DecomposedQuery[]> {
    const subQueries: DecomposedQuery[] = [];

    // 根据策略生成子查询
    for (const template of strategy.templates) {
      const subQuery = this.generateSubQuery(query, template);
      if (subQuery) {
        subQueries.push(subQuery);
      }
    }

    // 添加领域特定的子查询
    const domainSpecificQueries = this.generateDomainSpecificQueries(query);
    subQueries.push(...domainSpecificQueries);

    // 优化和去重
    return this.optimizeSubQueries(subQueries);
  }

  /**
   * 生成子查询
   */
  private generateSubQuery(
    parentQuery: ResearchQuery, 
    template: SubQueryTemplate
  ): DecomposedQuery | null {
    try {
      const subQuery: DecomposedQuery = {
        id: this.generateId(),
        parentQueryId: parentQuery.id,
        subQuery: this.applyTemplate(parentQuery.originalQuery, template),
        type: template.type,
        priority: template.priority,
        dependencies: [],
        estimatedTime: template.estimatedTime,
        searchStrategy: template.searchStrategy,
        expectedResultType: template.expectedResultType,
        metadata: {
          createdAt: new Date().toISOString(),
          decompositionReason: template.reason,
          expectedContribution: template.contribution,
          qualityThreshold: template.qualityThreshold,
          maxResults: template.maxResults
        }
      };

      return subQuery;
    } catch (error) {
      this.logger.warn(`Failed to generate sub-query from template:`, error);
      return null;
    }
  }

  /**
   * 生成执行计划
   */
  private generateExecutionPlan(subQueries: DecomposedQuery[]): ExecutionPlan {
    // 按优先级和依赖关系组织执行计划
    const phases = this.organizePhasesbyPriority(subQueries);
    const parallelGroups = this.identifyParallelGroups(subQueries);
    const dependencies = this.buildDependencyMap(subQueries);
    const criticalPath = this.calculateCriticalPath(subQueries, dependencies);

    return {
      phases,
      parallelGroups,
      dependencies,
      criticalPath
    };
  }

  /**
   * 工具方法
   */
  private assessComplexity(query: string): QueryComplexity {
    const words = query.split(' ').length;
    const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1;
    const hasConjunctions = /\b(and|or|but|however|moreover|furthermore)\b/i.test(query);
    const hasComparisons = /\b(compare|versus|vs|difference|similar|unlike)\b/i.test(query);

    if (words > 20 || hasMultipleQuestions || (hasConjunctions && hasComparisons)) {
      return 'multi-faceted';
    } else if (words > 12 || hasConjunctions || hasComparisons) {
      return 'complex';
    } else if (words > 6) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  private detectDomain(query: string): ResearchDomain {
    const domainKeywords = {
      technology: ['AI', 'software', 'programming', 'tech', 'digital', 'computer'],
      science: ['research', 'study', 'experiment', 'theory', 'scientific'],
      business: ['market', 'company', 'business', 'revenue', 'profit', 'strategy'],
      academic: ['paper', 'journal', 'academic', 'university', 'scholar'],
      medical: ['health', 'medical', 'disease', 'treatment', 'patient'],
      legal: ['law', 'legal', 'court', 'regulation', 'compliance'],
      finance: ['finance', 'investment', 'stock', 'economy', 'financial']
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => query.toLowerCase().includes(keyword.toLowerCase()))) {
        return domain as ResearchDomain;
      }
    }

    return 'general';
  }

  private detectIntent(query: string): UserIntent {
    const intentPatterns = {
      learn: /\b(what is|explain|understand|learn about|tell me about)\b/i,
      research: /\b(research|investigate|analyze|study|examine)\b/i,
      compare: /\b(compare|versus|vs|difference|better|worse)\b/i,
      solve: /\b(how to|solve|fix|resolve|solution)\b/i,
      decide: /\b(should|choose|decide|recommend|best)\b/i,
      create: /\b(create|build|make|develop|design)\b/i
    };

    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(query)) {
        return intent as UserIntent;
      }
    }

    return 'learn';
  }

  private extractKeyEntities(query: string): string[] {
    // 简单的实体提取 - 在实际应用中应该使用NLP库
    const words = query.split(' ');
    const entities = words.filter(word => 
      word.length > 3 && 
      /^[A-Z]/.test(word) && 
      !/^(The|This|That|What|How|Why|When|Where)$/.test(word)
    );
    
    return entities;
  }

  private detectTemporalAspects(query: string): string[] {
    const temporalPatterns = [
      /\b(recent|latest|current|today|now)\b/i,
      /\b(historical|past|previous|before)\b/i,
      /\b(future|upcoming|next|will)\b/i,
      /\b(2020|2021|2022|2023|2024|2025)\b/i
    ];

    const aspects: string[] = [];
    temporalPatterns.forEach((pattern, index) => {
      if (pattern.test(query)) {
        aspects.push(['recent', 'historical', 'future', 'specific_year'][index]);
      }
    });

    return aspects;
  }

  private identifyPerspectives(query: string): string[] {
    // 识别需要的观点类型
    const perspectives = [];
    
    if (/\b(expert|professional|specialist)\b/i.test(query)) {
      perspectives.push('expert');
    }
    if (/\b(user|customer|consumer)\b/i.test(query)) {
      perspectives.push('user');
    }
    if (/\b(academic|scholarly|research)\b/i.test(query)) {
      perspectives.push('academic');
    }
    if (/\b(industry|commercial|business)\b/i.test(query)) {
      perspectives.push('industry');
    }

    return perspectives.length > 0 ? perspectives : ['general'];
  }

  private generateDomainSpecificQueries(query: ResearchQuery): DecomposedQuery[] {
    // 根据领域生成特定的子查询
    const domainQueries: DecomposedQuery[] = [];

    switch (query.domain) {
      case 'technology':
        domainQueries.push(this.createTechQuery(query));
        break;
      case 'academic':
        domainQueries.push(this.createAcademicQuery(query));
        break;
      case 'business':
        domainQueries.push(this.createBusinessQuery(query));
        break;
    }

    return domainQueries.filter(q => q !== null) as DecomposedQuery[];
  }

  private createTechQuery(query: ResearchQuery): DecomposedQuery {
    return {
      id: this.generateId(),
      parentQueryId: query.id,
      subQuery: `Latest technical developments in ${query.originalQuery}`,
      type: 'factual',
      priority: 2,
      dependencies: [],
      estimatedTime: 30000,
      searchStrategy: 'specific_search',
      expectedResultType: 'facts',
      metadata: {
        createdAt: new Date().toISOString(),
        decompositionReason: 'Technology domain specific query',
        expectedContribution: 'Technical context and recent developments',
        qualityThreshold: 0.8,
        maxResults: 10
      }
    };
  }

  private createAcademicQuery(query: ResearchQuery): DecomposedQuery {
    return {
      id: this.generateId(),
      parentQueryId: query.id,
      subQuery: `Academic research papers about ${query.originalQuery}`,
      type: 'analytical',
      priority: 1,
      dependencies: [],
      estimatedTime: 45000,
      searchStrategy: 'academic_search',
      expectedResultType: 'analysis',
      metadata: {
        createdAt: new Date().toISOString(),
        decompositionReason: 'Academic domain specific query',
        expectedContribution: 'Scholarly perspective and research findings',
        qualityThreshold: 0.9,
        maxResults: 15
      }
    };
  }

  private createBusinessQuery(query: ResearchQuery): DecomposedQuery {
    return {
      id: this.generateId(),
      parentQueryId: query.id,
      subQuery: `Business implications and market analysis of ${query.originalQuery}`,
      type: 'analytical',
      priority: 2,
      dependencies: [],
      estimatedTime: 35000,
      searchStrategy: 'expert_search',
      expectedResultType: 'analysis',
      metadata: {
        createdAt: new Date().toISOString(),
        decompositionReason: 'Business domain specific query',
        expectedContribution: 'Market perspective and business impact',
        qualityThreshold: 0.8,
        maxResults: 12
      }
    };
  }

  private optimizeSubQueries(subQueries: DecomposedQuery[]): DecomposedQuery[] {
    // 去重和优化子查询
    const uniqueQueries = new Map<string, DecomposedQuery>();
    
    subQueries.forEach(query => {
      const key = query.subQuery.toLowerCase().trim();
      if (!uniqueQueries.has(key) || uniqueQueries.get(key)!.priority < query.priority) {
        uniqueQueries.set(key, query);
      }
    });

    return Array.from(uniqueQueries.values()).sort((a, b) => a.priority - b.priority);
  }

  private organizePhasesbyPriority(subQueries: DecomposedQuery[]): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];
    const priorityGroups = new Map<number, DecomposedQuery[]>();

    // 按优先级分组
    subQueries.forEach(query => {
      if (!priorityGroups.has(query.priority)) {
        priorityGroups.set(query.priority, []);
      }
      priorityGroups.get(query.priority)!.push(query);
    });

    // 创建执行阶段
    Array.from(priorityGroups.keys()).sort().forEach((priority, index) => {
      const queries = priorityGroups.get(priority)!;
      phases.push({
        id: `phase-${index + 1}`,
        name: `Priority ${priority} Queries`,
        description: `Execute queries with priority ${priority}`,
        subQueryIds: queries.map(q => q.id),
        estimatedTime: Math.max(...queries.map(q => q.estimatedTime)),
        canRunInParallel: queries.length > 1
      });
    });

    return phases;
  }

  private identifyParallelGroups(subQueries: DecomposedQuery[]): string[][] {
    // 识别可以并行执行的查询组
    const groups: string[][] = [];
    const priorityGroups = new Map<number, string[]>();

    subQueries.forEach(query => {
      if (!priorityGroups.has(query.priority)) {
        priorityGroups.set(query.priority, []);
      }
      priorityGroups.get(query.priority)!.push(query.id);
    });

    priorityGroups.forEach(group => {
      if (group.length > 1) {
        groups.push(group);
      }
    });

    return groups;
  }

  private buildDependencyMap(subQueries: DecomposedQuery[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    
    subQueries.forEach(query => {
      dependencies.set(query.id, query.dependencies);
    });

    return dependencies;
  }

  private calculateCriticalPath(
    subQueries: DecomposedQuery[], 
    dependencies: Map<string, string[]>
  ): string[] {
    // 简化的关键路径计算
    const sortedQueries = subQueries.sort((a, b) => b.estimatedTime - a.estimatedTime);
    return sortedQueries.slice(0, Math.ceil(sortedQueries.length / 2)).map(q => q.id);
  }

  private calculateTotalTime(executionPlan: ExecutionPlan): number {
    return executionPlan.phases.reduce((total, phase) => total + phase.estimatedTime, 0);
  }

  private calculateConfidence(query: ResearchQuery, subQueries: DecomposedQuery[]): number {
    let confidence = 0.7; // 基础置信度

    // 根据子查询数量调整
    if (subQueries.length >= 3 && subQueries.length <= 8) {
      confidence += 0.1;
    }

    // 根据查询复杂度调整
    if (query.complexity === 'simple') {
      confidence += 0.1;
    } else if (query.complexity === 'multi-faceted') {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private applyTemplate(originalQuery: string, template: SubQueryTemplate): string {
    return template.pattern.replace('{query}', originalQuery);
  }

  private generateId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeStrategies(): Map<QueryComplexity, DecompositionStrategy> {
    const strategies = new Map<QueryComplexity, DecompositionStrategy>();

    strategies.set('simple', {
      name: 'Simple Query Strategy',
      templates: [
        {
          type: 'definitional',
          pattern: 'What is {query}?',
          priority: 1,
          estimatedTime: 15000,
          searchStrategy: 'broad_search',
          expectedResultType: 'definitions',
          reason: 'Basic definition needed',
          contribution: 'Foundational understanding',
          qualityThreshold: 0.7,
          maxResults: 5
        }
      ]
    });

    strategies.set('moderate', {
      name: 'Moderate Query Strategy',
      templates: [
        {
          type: 'definitional',
          pattern: 'What is {query}?',
          priority: 1,
          estimatedTime: 20000,
          searchStrategy: 'broad_search',
          expectedResultType: 'definitions',
          reason: 'Basic definition needed',
          contribution: 'Foundational understanding',
          qualityThreshold: 0.7,
          maxResults: 8
        },
        {
          type: 'analytical',
          pattern: 'How does {query} work?',
          priority: 2,
          estimatedTime: 30000,
          searchStrategy: 'specific_search',
          expectedResultType: 'analysis',
          reason: 'Mechanism understanding needed',
          contribution: 'Operational knowledge',
          qualityThreshold: 0.8,
          maxResults: 10
        }
      ]
    });

    strategies.set('complex', {
      name: 'Complex Query Strategy',
      templates: [
        {
          type: 'definitional',
          pattern: 'What is {query}?',
          priority: 1,
          estimatedTime: 25000,
          searchStrategy: 'broad_search',
          expectedResultType: 'definitions',
          reason: 'Basic definition needed',
          contribution: 'Foundational understanding',
          qualityThreshold: 0.8,
          maxResults: 10
        },
        {
          type: 'analytical',
          pattern: 'How does {query} work?',
          priority: 2,
          estimatedTime: 35000,
          searchStrategy: 'specific_search',
          expectedResultType: 'analysis',
          reason: 'Mechanism understanding needed',
          contribution: 'Operational knowledge',
          qualityThreshold: 0.8,
          maxResults: 12
        },
        {
          type: 'comparative',
          pattern: 'What are the advantages and disadvantages of {query}?',
          priority: 3,
          estimatedTime: 40000,
          searchStrategy: 'expert_search',
          expectedResultType: 'comparisons',
          reason: 'Balanced perspective needed',
          contribution: 'Critical evaluation',
          qualityThreshold: 0.8,
          maxResults: 15
        }
      ]
    });

    strategies.set('multi-faceted', {
      name: 'Multi-faceted Query Strategy',
      templates: [
        {
          type: 'definitional',
          pattern: 'What is {query}?',
          priority: 1,
          estimatedTime: 30000,
          searchStrategy: 'broad_search',
          expectedResultType: 'definitions',
          reason: 'Basic definition needed',
          contribution: 'Foundational understanding',
          qualityThreshold: 0.8,
          maxResults: 12
        },
        {
          type: 'analytical',
          pattern: 'How does {query} work?',
          priority: 2,
          estimatedTime: 40000,
          searchStrategy: 'specific_search',
          expectedResultType: 'analysis',
          reason: 'Mechanism understanding needed',
          contribution: 'Operational knowledge',
          qualityThreshold: 0.8,
          maxResults: 15
        },
        {
          type: 'comparative',
          pattern: 'What are the advantages and disadvantages of {query}?',
          priority: 3,
          estimatedTime: 45000,
          searchStrategy: 'expert_search',
          expectedResultType: 'comparisons',
          reason: 'Balanced perspective needed',
          contribution: 'Critical evaluation',
          qualityThreshold: 0.8,
          maxResults: 18
        },
        {
          type: 'temporal',
          pattern: 'What is the current state and future of {query}?',
          priority: 4,
          estimatedTime: 50000,
          searchStrategy: 'news_search',
          expectedResultType: 'analysis',
          reason: 'Temporal context needed',
          contribution: 'Current and future perspective',
          qualityThreshold: 0.7,
          maxResults: 20
        }
      ]
    });

    return strategies;
  }
}

// 内部接口
interface QueryAnalysis {
  complexity: QueryComplexity;
  domain: ResearchDomain;
  intent: UserIntent;
  keyEntities: string[];
  temporalAspects: string[];
  requiredPerspectives: string[];
}

interface DecompositionStrategy {
  name: string;
  templates: SubQueryTemplate[];
}

interface SubQueryTemplate {
  type: SubQueryType;
  pattern: string;
  priority: number;
  estimatedTime: number;
  searchStrategy: SearchStrategy;
  expectedResultType: ResultType;
  reason: string;
  contribution: string;
  qualityThreshold: number;
  maxResults: number;
}
