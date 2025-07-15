/**
 * 思维链分解引擎
 * 将复杂问题分解为多个有明确目标的搜索分支
 */

export interface SearchBranch {
  id: string;
  name: string;
  description: string;
  target: string;                    // Clear search target
  priority: number;                  // 优先级 (1-10)
  searchQueries: string[];           // 目标导向的搜索查询
  expectedResults: string[];         // 期望的结果类型
  successCriteria: string[];         // 成功标准
  dependencies: string[];            // 依赖的其他分支
  estimatedSearchCount: number;      // 预估搜索数量
  maxSearchCount: number;            // 最大搜索数量
  minSearchCount: number;            // 最少搜索数量
}

export interface ThinkingMap {
  rootQuestion: string;
  branches: SearchBranch[];
  totalSearchBudget: number;
  executionOrder: string[];          // Execution order
  parallelGroups: string[][];        // 可并行执行的分组
}

export interface DecompositionConfig {
  maxBranches: number;               // Maximum number of branches
  branchDepth: number;               // Branch depth
  targetClarification: boolean;      // Target clarification
  priorityWeights: number[];         // Priority weights
}

export class ThinkingChainDecomposer {
  private config: DecompositionConfig;

  constructor(config: DecompositionConfig) {
    this.config = config;
  }

  /**
   * Decompose complex problem into thinking chain branches
   */
  async decomposeQuery(query: string): Promise<ThinkingMap> {
    // 1. Analyze multiple dimensions of the problem
    const dimensions = await this.analyzeQueryDimensions(query);

    // 2. Generate search branches
    const branches = await this.generateSearchBranches(query, dimensions);

    // 3. Set branch priorities
    const prioritizedBranches = await this.prioritizeBranches(branches);

    // 4. Allocate search budget
    const budgetAllocatedBranches = this.allocateSearchBudget(prioritizedBranches);

    // 5. Determine execution order
    const executionPlan = this.planExecution(budgetAllocatedBranches);
    
    return {
      rootQuestion: query,
      branches: budgetAllocatedBranches,
      totalSearchBudget: budgetAllocatedBranches.reduce((sum, b) => sum + b.estimatedSearchCount, 0),
      executionOrder: executionPlan.sequence,
      parallelGroups: executionPlan.parallelGroups
    };
  }

  /**
   * Analyze multiple dimensions of the problem
   */
  private async analyzeQueryDimensions(query: string): Promise<string[]> {
    // Identify different dimensions of the problem: concepts, technology, applications, cases, trends, etc.
    const dimensions = [];

    // Basic conceptual dimension
    if (this.needsConceptualUnderstanding(query)) {
      dimensions.push('conceptual');
    }

    // Technical implementation dimension
    if (this.needsTechnicalDetails(query)) {
      dimensions.push('technical');
    }

    // Practical application dimension
    if (this.needsApplicationExamples(query)) {
      dimensions.push('application');
    }

    // Latest development dimension
    if (this.needsLatestDevelopments(query)) {
      dimensions.push('trends');
    }

    // Comparative analysis dimension
    if (this.needsComparison(query)) {
      dimensions.push('comparison');
    }

    return dimensions;
  }

  /**
   * 生成搜索分支
   */
  private async generateSearchBranches(query: string, dimensions: string[]): Promise<SearchBranch[]> {
    const branches: SearchBranch[] = [];
    
    for (const dimension of dimensions) {
      const branch = await this.createBranchForDimension(query, dimension);
      branches.push(branch);
    }
    
    return branches.slice(0, this.config.maxBranches);
  }

  /**
   * 为特定维度创建搜索分支
   */
  private async createBranchForDimension(query: string, dimension: string): Promise<SearchBranch> {
    const branchTemplates = {
      conceptual: {
        name: 'Conceptual Understanding Branch',
        description: 'Understand core concepts, definitions and basic theories',
        target: 'Obtain clear concept definitions and theoretical foundations',
        searchQueries: [
          `${query} definition concept`,
          `${query} basic principles`,
          `what is ${query}`,
          `${query} fundamentals`
        ],
        expectedResults: ['Definitions', 'Principles', 'Basic concepts'],
        successCriteria: ['Obtain clear definitions', 'Understand basic principles', 'Master core concepts'],
        estimatedSearchCount: 25
      },
      technical: {
        name: 'Technical Implementation Branch',
        description: 'Explore technical implementation solutions and specific methods',
        target: 'Find specific technical implementation solutions and best practices',
        searchQueries: [
          `${query} implementation`,
          `${query} technical solution`,
          `how to implement ${query}`,
          `${query} best practices`
        ],
        expectedResults: ['Implementation solutions', 'Technical details', 'Code examples'],
        successCriteria: ['Find feasible solutions', 'Obtain technical details', 'Have specific examples'],
        estimatedSearchCount: 40
      },
      application: {
        name: 'Application Case Branch',
        description: 'Collect practical application cases and successful experiences',
        target: 'Collect real application cases and practical experiences',
        searchQueries: [
          `${query} use cases`,
          `${query} real world examples`,
          `${query} case study`,
          `${query} success stories`
        ],
        expectedResults: ['Application cases', 'Success stories', 'Practical experiences'],
        successCriteria: ['Collect multiple cases', 'Analyze success factors', 'Summarize lessons learned'],
        estimatedSearchCount: 35
      },
      trends: {
        name: 'Development Trends Branch',
        description: 'Track latest developments and future trends',
        target: 'Understand latest developments and future directions',
        searchQueries: [
          `${query} latest developments`,
          `${query} future trends`,
          `${query} 2024 updates`,
          `${query} recent advances`
        ],
        expectedResults: ['Latest developments', 'Development trends', 'Future directions'],
        successCriteria: ['Obtain latest information', 'Identify development trends', 'Predict future directions'],
        estimatedSearchCount: 30
      },
      comparison: {
        name: 'Comparative Analysis Branch',
        description: 'Compare different solutions and alternative choices',
        target: 'Compare pros and cons of different solutions and applicable scenarios',
        searchQueries: [
          `${query} vs alternatives`,
          `${query} comparison`,
          `${query} pros and cons`,
          `${query} alternatives`
        ],
        expectedResults: ['Comparative analysis', 'Pros and cons', 'Selection recommendations'],
        successCriteria: ['Complete comprehensive comparison', 'Analyze pros and cons', 'Provide selection recommendations'],
        estimatedSearchCount: 30
      }
    };

    const template = branchTemplates[dimension as keyof typeof branchTemplates];
    
    return {
      id: `branch_${dimension}_${Date.now()}`,
      name: template.name,
      description: template.description,
      target: template.target,
      priority: this.calculatePriority(dimension),
      searchQueries: template.searchQueries,
      expectedResults: template.expectedResults,
      successCriteria: template.successCriteria,
      dependencies: [],
      estimatedSearchCount: template.estimatedSearchCount,
      maxSearchCount: Math.floor(template.estimatedSearchCount * 1.5),
      minSearchCount: Math.floor(template.estimatedSearchCount * 0.6)
    };
  }

  /**
   * 设定分支优先级
   */
  private async prioritizeBranches(branches: SearchBranch[]): Promise<SearchBranch[]> {
    return branches.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 分配搜索预算
   */
  private allocateSearchBudget(branches: SearchBranch[]): SearchBranch[] {
    const totalBudget = 200; // 总搜索预算
    const totalEstimated = branches.reduce((sum, b) => sum + b.estimatedSearchCount, 0);
    
    // 按比例分配预算
    return branches.map(branch => ({
      ...branch,
      estimatedSearchCount: Math.floor((branch.estimatedSearchCount / totalEstimated) * totalBudget)
    }));
  }

  /**
   * 规划执行顺序
   */
  private planExecution(branches: SearchBranch[]): { sequence: string[], parallelGroups: string[][] } {
    // 简单实现：按优先级排序，高优先级的可以并行执行
    const sequence = branches.map(b => b.id);
    const parallelGroups = [branches.map(b => b.id)]; // 所有分支可以并行执行
    
    return { sequence, parallelGroups };
  }

  // 辅助方法
  private needsConceptualUnderstanding(query: string): boolean {
    const conceptualKeywords = ['what is', 'definition', 'concept', 'theory', 'principle'];
    return conceptualKeywords.some(keyword => query.toLowerCase().includes(keyword)) || 
           query.split(' ').length <= 3; // 简短查询通常需要概念理解
  }

  private needsTechnicalDetails(query: string): boolean {
    const technicalKeywords = ['how to', 'implement', 'build', 'create', 'develop', 'code'];
    return technicalKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private needsApplicationExamples(query: string): boolean {
    const applicationKeywords = ['example', 'case', 'use', 'application', 'practice'];
    return applicationKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private needsLatestDevelopments(query: string): boolean {
    const trendKeywords = ['latest', 'new', 'recent', 'current', '2024', 'trend'];
    return trendKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private needsComparison(query: string): boolean {
    const comparisonKeywords = ['vs', 'versus', 'compare', 'difference', 'alternative'];
    return comparisonKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private calculatePriority(dimension: string): number {
    const priorityMap = {
      conceptual: 9,    // Conceptual understanding is most important
      technical: 8,     // Technical implementation is second
      application: 7,   // Application cases
      trends: 6,        // Development trends
      comparison: 5     // Comparative analysis
    };
    
    return priorityMap[dimension as keyof typeof priorityMap] || 5;
  }
}
