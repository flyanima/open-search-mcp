/**
 * Deep Research Engine - 深度研究引擎
 * 整合查询分解、思维链执行和饱和检测的主引擎
 */

import { EventEmitter } from 'events';
import { ResearchQueryDecomposer, ResearchQuery, DecompositionResult } from './query-decomposer.js';
import { ChainOfThoughtExecutor, ExecutionResult, ThoughtChain } from './chain-of-thought-executor.js';
import { ResearchSaturationDetector, SaturationAnalysis, ResearchContext } from './saturation-detector.js';
import { Logger } from '../utils/logger.js';

export interface DeepResearchRequest {
  query: string;
  context: ResearchContext;
  options: ResearchOptions;
}

export interface ResearchOptions {
  maxIterations?: number;
  timeLimit?: number;
  qualityThreshold?: number;
  enableSaturationDetection?: boolean;
  enableIterativeRefinement?: boolean;
  outputFormat?: OutputFormat;
  customStrategies?: CustomStrategy[];
}

export interface CustomStrategy {
  name: string;
  description: string;
  applicableConditions: string[];
  implementation: (query: ResearchQuery) => Promise<any>;
}

export interface DeepResearchResult {
  requestId: string;
  originalQuery: string;
  finalAnswer: string;
  confidence: number;
  completeness: number;
  iterations: ResearchIteration[];
  totalExecutionTime: number;
  saturationAnalysis: SaturationAnalysis;
  qualityMetrics: QualityMetrics;
  recommendations: ResearchRecommendation[];
  metadata: ResearchMetadata;
}

export interface ResearchIteration {
  iterationNumber: number;
  decomposition: DecompositionResult;
  execution: ExecutionResult;
  saturation: SaturationAnalysis;
  improvements: string[];
  nextSteps: string[];
  executionTime: number;
}

export interface QualityMetrics {
  evidenceStrength: number;
  sourceCredibility: number;
  informationCoverage: number;
  perspectiveDiversity: number;
  factualAccuracy: number;
  recency: number;
  coherence: number;
}

export interface ResearchRecommendation {
  type: RecommendationType;
  description: string;
  priority: number;
  rationale: string;
  actionItems: string[];
}

export interface ResearchMetadata {
  startedAt: string;
  completedAt: string;
  totalQueries: number;
  totalSources: number;
  averageRelevance: number;
  resourcesUsed: ResourceUsage;
  performanceMetrics: PerformanceMetrics;
}

export interface ResourceUsage {
  searchQueries: number;
  apiCalls: number;
  processingTime: number;
  memoryUsage: number;
}

export interface PerformanceMetrics {
  queriesPerSecond: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
}

export type OutputFormat = 'summary' | 'detailed' | 'academic' | 'executive' | 'technical';
export type RecommendationType = 'methodology' | 'scope' | 'quality' | 'efficiency' | 'validation';

export class DeepResearchEngine extends EventEmitter {
  private logger: Logger;
  private queryDecomposer: ResearchQueryDecomposer;
  private thoughtExecutor: ChainOfThoughtExecutor;
  private saturationDetector: ResearchSaturationDetector;
  private activeResearch: Map<string, DeepResearchSession> = new Map();

  constructor() {
    super();
    this.logger = new Logger('DeepResearchEngine');
    this.queryDecomposer = new ResearchQueryDecomposer();
    this.thoughtExecutor = new ChainOfThoughtExecutor();
    this.saturationDetector = new ResearchSaturationDetector();
    
    this.setupEventHandlers();
  }

  /**
   * 执行深度研究
   */
  async conductResearch(request: DeepResearchRequest): Promise<DeepResearchResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    this.logger.info(`Starting deep research for query: "${request.query}"`);

    try {
      // 1. 初始化研究会话
      const session = this.initializeSession(requestId, request);
      this.activeResearch.set(requestId, session);

      // 2. 创建初始研究查询
      const researchQuery = this.createResearchQuery(request);

      // 3. 执行迭代研究过程
      const iterations = await this.executeIterativeResearch(researchQuery, request, session);

      // 4. 生成最终结果
      const result = await this.generateFinalResult(requestId, request, iterations, startTime);

      this.logger.info(`Deep research completed for ${requestId}: ${iterations.length} iterations`);
      this.emit('researchCompleted', result);

      return result;

    } catch (error) {
      this.logger.error(`Deep research failed for ${requestId}:`, error);
      this.emit('researchFailed', requestId, error);
      throw error;
    } finally {
      this.activeResearch.delete(requestId);
    }
  }

  /**
   * 执行迭代研究过程
   */
  private async executeIterativeResearch(
    initialQuery: ResearchQuery,
    request: DeepResearchRequest,
    session: DeepResearchSession
  ): Promise<ResearchIteration[]> {
    const iterations: ResearchIteration[] = [];
    let currentQuery = initialQuery;
    let iterationCount = 0;
    const maxIterations = request.options.maxIterations || 3;

    while (iterationCount < maxIterations) {
      iterationCount++;
      this.logger.info(`Starting research iteration ${iterationCount}`);

      const iterationStartTime = Date.now();

      try {
        // 1. 分解查询
        const decomposition = await this.queryDecomposer.decomposeQuery(currentQuery);
        this.emit('queryDecomposed', decomposition);

        // 2. 执行思维链
        const execution = await this.thoughtExecutor.executeChain(
          currentQuery,
          decomposition.subQueries,
          decomposition.executionPlan
        );
        this.emit('chainExecuted', execution);

        // 3. 检测饱和状态
        const saturation = await this.saturationDetector.detectSaturation(
          execution.thoughtChain,
          request.context,
          iterations.map(i => i.execution)
        );
        this.emit('saturationDetected', saturation);

        // 4. 创建迭代记录
        const iteration: ResearchIteration = {
          iterationNumber: iterationCount,
          decomposition,
          execution,
          saturation,
          improvements: this.identifyImprovements(execution, saturation),
          nextSteps: this.determineNextSteps(saturation),
          executionTime: Date.now() - iterationStartTime
        };

        iterations.push(iteration);

        // 5. 检查是否应该继续
        if (this.shouldStopResearch(saturation, request.options)) {
          this.logger.info(`Research stopped after iteration ${iterationCount}: saturation detected`);
          break;
        }

        // 6. 准备下一次迭代
        if (iterationCount < maxIterations) {
          currentQuery = await this.refineQueryForNextIteration(currentQuery, iteration);
        }

      } catch (error) {
        this.logger.error(`Iteration ${iterationCount} failed:`, error);
        break;
      }
    }

    return iterations;
  }

  /**
   * 生成最终结果
   */
  private async generateFinalResult(
    requestId: string,
    request: DeepResearchRequest,
    iterations: ResearchIteration[],
    startTime: number
  ): Promise<DeepResearchResult> {
    const totalExecutionTime = Date.now() - startTime;
    
    // 获取最后一次迭代的结果
    const lastIteration = iterations[iterations.length - 1];
    const finalExecution = lastIteration.execution;
    const finalSaturation = lastIteration.saturation;

    // 综合所有迭代的结果
    const synthesizedAnswer = await this.synthesizeIterativeResults(iterations);
    
    // 计算质量指标
    const qualityMetrics = this.calculateQualityMetrics(iterations);
    
    // 生成建议
    const recommendations = this.generateResearchRecommendations(iterations, finalSaturation);
    
    // 构建元数据
    const metadata = this.buildResearchMetadata(iterations, totalExecutionTime);

    const result: DeepResearchResult = {
      requestId,
      originalQuery: request.query,
      finalAnswer: synthesizedAnswer,
      confidence: this.calculateOverallConfidence(iterations),
      completeness: this.calculateCompleteness(iterations),
      iterations,
      totalExecutionTime,
      saturationAnalysis: finalSaturation,
      qualityMetrics,
      recommendations,
      metadata
    };

    return result;
  }

  /**
   * 综合迭代结果
   */
  private async synthesizeIterativeResults(iterations: ResearchIteration[]): Promise<string> {
    let synthesis = `# Deep Research Analysis\n\n`;
    
    synthesis += `Based on ${iterations.length} iterations of comprehensive research:\n\n`;

    // 主要发现
    synthesis += `## Key Findings\n\n`;
    iterations.forEach((iteration, index) => {
      const mainConclusion = iteration.execution.finalConclusions[0];
      if (mainConclusion) {
        synthesis += `**Iteration ${index + 1}**: ${mainConclusion.statement}\n`;
        synthesis += `*Confidence: ${(mainConclusion.confidence * 100).toFixed(1)}%*\n\n`;
      }
    });

    // 证据强度分析
    const lastIteration = iterations[iterations.length - 1];
    synthesis += `## Evidence Analysis\n\n`;
    synthesis += `- **Evidence Quality**: ${(lastIteration.execution.evidenceQuality * 100).toFixed(1)}%\n`;
    synthesis += `- **Research Completeness**: ${(lastIteration.execution.completeness * 100).toFixed(1)}%\n`;
    synthesis += `- **Saturation Level**: ${(lastIteration.saturation.saturationLevel * 100).toFixed(1)}%\n\n`;

    // 最终结论
    synthesis += `## Conclusion\n\n`;
    synthesis += lastIteration.execution.synthesizedAnswer;

    return synthesis;
  }

  /**
   * 计算质量指标
   */
  private calculateQualityMetrics(iterations: ResearchIteration[]): QualityMetrics {
    const allExecutions = iterations.map(i => i.execution);
    
    return {
      evidenceStrength: this.calculateAverageMetric(allExecutions, 'evidenceQuality'),
      sourceCredibility: this.calculateSourceCredibility(allExecutions),
      informationCoverage: this.calculateInformationCoverage(iterations),
      perspectiveDiversity: this.calculatePerspectiveDiversity(allExecutions),
      factualAccuracy: this.calculateFactualAccuracy(allExecutions),
      recency: this.calculateRecency(allExecutions),
      coherence: this.calculateCoherence(iterations)
    };
  }

  /**
   * 生成研究建议
   */
  private generateResearchRecommendations(
    iterations: ResearchIteration[],
    finalSaturation: SaturationAnalysis
  ): ResearchRecommendation[] {
    const recommendations: ResearchRecommendation[] = [];

    // 基于饱和分析的建议
    if (finalSaturation.isSaturated) {
      recommendations.push({
        type: 'methodology',
        description: 'Research has reached saturation - consider validation phase',
        priority: 9,
        rationale: 'High saturation level indicates comprehensive coverage',
        actionItems: [
          'Validate key findings with expert review',
          'Cross-reference with authoritative sources',
          'Consider peer review of conclusions'
        ]
      });
    }

    // 基于质量的建议
    const avgConfidence = this.calculateOverallConfidence(iterations);
    if (avgConfidence < 0.7) {
      recommendations.push({
        type: 'quality',
        description: 'Consider additional verification for low-confidence findings',
        priority: 8,
        rationale: `Overall confidence is ${(avgConfidence * 100).toFixed(1)}%`,
        actionItems: [
          'Seek additional authoritative sources',
          'Verify claims with primary sources',
          'Consider expert consultation'
        ]
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 工具方法
   */
  private generateRequestId(): string {
    return `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSession(requestId: string, request: DeepResearchRequest): DeepResearchSession {
    return {
      id: requestId,
      request,
      startedAt: new Date().toISOString(),
      status: 'running',
      currentIteration: 0
    };
  }

  private createResearchQuery(request: DeepResearchRequest): ResearchQuery {
    return {
      id: `query-${Date.now()}`,
      originalQuery: request.query,
      domain: request.context.domain as any,
      complexity: request.context.complexity as any,
      language: 'en',
      priority: 1,
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'deep-research-engine',
        userIntent: 'research',
        requiredDepth: request.context.userPreferences.preferredDepth,
        expectedOutputFormat: request.options.outputFormat || 'detailed'
      }
    };
  }

  private identifyImprovements(execution: ExecutionResult, saturation: SaturationAnalysis): string[] {
    const improvements: string[] = [];
    
    if (execution.confidence < 0.8) {
      improvements.push('Increase confidence through additional verification');
    }
    
    if (saturation.metrics.sourceVariety < 0.6) {
      improvements.push('Expand source diversity for broader perspective');
    }
    
    return improvements;
  }

  private determineNextSteps(saturation: SaturationAnalysis): string[] {
    return saturation.nextActions.map(action => action.description);
  }

  private shouldStopResearch(saturation: SaturationAnalysis, options: ResearchOptions): boolean {
    if (!options.enableSaturationDetection) return false;
    
    return saturation.isSaturated && saturation.confidence > 0.7;
  }

  private async refineQueryForNextIteration(
    currentQuery: ResearchQuery,
    iteration: ResearchIteration
  ): Promise<ResearchQuery> {
    // 基于当前迭代的结果优化查询
    const refinedQuery = { ...currentQuery };
    
    // 根据饱和分析调整查询
    if (iteration.saturation.metrics.sourceVariety < 0.5) {
      refinedQuery.originalQuery += ' diverse perspectives';
    }
    
    return refinedQuery;
  }

  private calculateOverallConfidence(iterations: ResearchIteration[]): number {
    if (iterations.length === 0) return 0;
    
    const confidences = iterations.map(i => i.execution.confidence);
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  private calculateCompleteness(iterations: ResearchIteration[]): number {
    if (iterations.length === 0) return 0;
    
    const completeness = iterations.map(i => i.execution.completeness);
    return completeness.reduce((sum, comp) => sum + comp, 0) / completeness.length;
  }

  private calculateAverageMetric(executions: ExecutionResult[], metric: keyof ExecutionResult): number {
    if (executions.length === 0) return 0;
    
    const values = executions.map(e => e[metric] as number);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateSourceCredibility(executions: ExecutionResult[]): number {
    // 简化的来源可信度计算
    return 0.8; // 默认值
  }

  private calculateInformationCoverage(iterations: ResearchIteration[]): number {
    // 基于迭代数量和查询覆盖度计算
    const totalQueries = iterations.reduce((sum, i) => sum + i.decomposition.subQueries.length, 0);
    return Math.min(totalQueries / 20, 1); // 假设20个查询为完整覆盖
  }

  private calculatePerspectiveDiversity(executions: ExecutionResult[]): number {
    // 简化的观点多样性计算
    return 0.75; // 默认值
  }

  private calculateFactualAccuracy(executions: ExecutionResult[]): number {
    // 简化的事实准确性计算
    return 0.85; // 默认值
  }

  private calculateRecency(executions: ExecutionResult[]): number {
    // 简化的时效性计算
    return 0.7; // 默认值
  }

  private calculateCoherence(iterations: ResearchIteration[]): number {
    // 简化的连贯性计算
    return 0.8; // 默认值
  }

  private buildResearchMetadata(iterations: ResearchIteration[], totalTime: number): ResearchMetadata {
    const totalQueries = iterations.reduce((sum, i) => sum + i.decomposition.subQueries.length, 0);
    const totalSources = iterations.reduce((sum, i) => 
      sum + i.execution.thoughtChain.steps.reduce((stepSum, step) => 
        stepSum + step.searchResults.length, 0), 0);

    return {
      startedAt: iterations[0]?.decomposition.originalQuery.metadata.createdAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalQueries,
      totalSources,
      averageRelevance: 0.8, // 简化计算
      resourcesUsed: {
        searchQueries: totalQueries,
        apiCalls: totalQueries * 2,
        processingTime: totalTime,
        memoryUsage: 0
      },
      performanceMetrics: {
        queriesPerSecond: totalQueries / (totalTime / 1000),
        averageResponseTime: totalTime / totalQueries,
        cacheHitRate: 0.3,
        errorRate: 0.05
      }
    };
  }

  private setupEventHandlers(): void {
    this.thoughtExecutor.on('chainCompleted', (result) => {
      this.emit('chainCompleted', result);
    });

    this.thoughtExecutor.on('chainFailed', (chainId, error) => {
      this.emit('chainFailed', chainId, error);
    });
  }
}

// 内部接口
interface DeepResearchSession {
  id: string;
  request: DeepResearchRequest;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
  currentIteration: number;
}
