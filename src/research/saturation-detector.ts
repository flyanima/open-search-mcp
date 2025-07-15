/**
 * Research Saturation Detector - 研究饱和检测器
 * 检测研究是否已达到饱和状态，避免过度搜索
 */

import { Logger } from '../utils/logger.js';
import { SearchResult, ThoughtChain, ExecutionResult } from './chain-of-thought-executor.js';

export interface SaturationAnalysis {
  isSaturated: boolean;
  saturationLevel: number;
  confidence: number;
  reasons: SaturationReason[];
  recommendations: SaturationRecommendation[];
  metrics: SaturationMetrics;
  nextActions: NextAction[];
}

export interface SaturationReason {
  type: SaturationReasonType;
  description: string;
  weight: number;
  evidence: string[];
}

export interface SaturationRecommendation {
  action: RecommendedAction;
  priority: number;
  description: string;
  expectedBenefit: string;
  estimatedEffort: number;
}

export interface SaturationMetrics {
  informationDiversity: number;
  sourceVariety: number;
  contentNovelty: number;
  evidenceConvergence: number;
  qualityStability: number;
  diminishingReturns: number;
  temporalCoverage: number;
  perspectiveBreadth: number;
}

export interface NextAction {
  type: ActionType;
  description: string;
  priority: number;
  estimatedTime: number;
  expectedValue: number;
}

export type SaturationReasonType = 
  | 'information_repetition'
  | 'source_exhaustion'
  | 'quality_plateau'
  | 'diminishing_returns'
  | 'evidence_convergence'
  | 'time_constraint'
  | 'cost_threshold';

export type RecommendedAction = 
  | 'continue_search'
  | 'stop_search'
  | 'refine_query'
  | 'expand_scope'
  | 'narrow_focus'
  | 'change_strategy'
  | 'seek_expert_input';

export type ActionType = 
  | 'search_more'
  | 'analyze_deeper'
  | 'synthesize_results'
  | 'validate_findings'
  | 'explore_alternatives'
  | 'conclude_research';

export interface ResearchContext {
  domain: string;
  complexity: string;
  timeConstraints?: number;
  qualityRequirements: number;
  resourceLimits?: ResourceLimits;
  userPreferences: UserPreferences;
}

export interface ResourceLimits {
  maxSearchTime: number;
  maxQueries: number;
  maxSources: number;
  budgetConstraints?: number;
}

export interface UserPreferences {
  preferredDepth: 'surface' | 'moderate' | 'deep' | 'comprehensive';
  riskTolerance: 'low' | 'medium' | 'high';
  timePreference: 'fast' | 'balanced' | 'thorough';
  qualityThreshold: number;
}

export class ResearchSaturationDetector {
  private logger: Logger;
  private saturationThresholds: SaturationThresholds;
  private analysisHistory: Map<string, SaturationAnalysis[]> = new Map();

  constructor() {
    this.logger = new Logger('ResearchSaturationDetector');
    this.saturationThresholds = this.initializeSaturationThresholds();
  }

  /**
   * 检测研究饱和状态
   */
  async detectSaturation(
    thoughtChain: ThoughtChain,
    context: ResearchContext,
    previousResults?: ExecutionResult[]
  ): Promise<SaturationAnalysis> {
    this.logger.info(`Analyzing saturation for chain: ${thoughtChain.id}`);

    try {
      // 1. 计算饱和指标
      const metrics = await this.calculateSaturationMetrics(thoughtChain, previousResults);
      
      // 2. 分析饱和原因
      const reasons = this.analyzeSaturationReasons(metrics, context);
      
      // 3. 计算整体饱和水平
      const saturationLevel = this.calculateSaturationLevel(metrics, reasons);
      
      // 4. 判断是否饱和
      const isSaturated = this.determineSaturationStatus(saturationLevel, context);
      
      // 5. 生成建议
      const recommendations = this.generateRecommendations(metrics, reasons, context);
      
      // 6. 确定下一步行动
      const nextActions = this.determineNextActions(metrics, isSaturated, context);
      
      // 7. 计算置信度
      const confidence = this.calculateConfidence(metrics, reasons);

      const analysis: SaturationAnalysis = {
        isSaturated,
        saturationLevel,
        confidence,
        reasons,
        recommendations,
        metrics,
        nextActions
      };

      // 记录分析历史
      this.recordAnalysis(thoughtChain.id, analysis);

      this.logger.info(`Saturation analysis completed: ${isSaturated ? 'SATURATED' : 'NOT_SATURATED'} (${(saturationLevel * 100).toFixed(1)}%)`);
      
      return analysis;

    } catch (error) {
      this.logger.error('Saturation detection failed:', error);
      throw new Error(`Failed to detect saturation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 计算饱和指标
   */
  private async calculateSaturationMetrics(
    thoughtChain: ThoughtChain,
    previousResults?: ExecutionResult[]
  ): Promise<SaturationMetrics> {
    const allResults = this.extractAllResults(thoughtChain);
    
    const metrics: SaturationMetrics = {
      informationDiversity: this.calculateInformationDiversity(allResults),
      sourceVariety: this.calculateSourceVariety(allResults),
      contentNovelty: this.calculateContentNovelty(allResults),
      evidenceConvergence: this.calculateEvidenceConvergence(thoughtChain),
      qualityStability: this.calculateQualityStability(thoughtChain),
      diminishingReturns: this.calculateDiminishingReturns(thoughtChain),
      temporalCoverage: this.calculateTemporalCoverage(allResults),
      perspectiveBreadth: this.calculatePerspectiveBreadth(allResults)
    };

    return metrics;
  }

  /**
   * 分析饱和原因
   */
  private analyzeSaturationReasons(
    metrics: SaturationMetrics,
    context: ResearchContext
  ): SaturationReason[] {
    const reasons: SaturationReason[] = [];

    // 信息重复检测
    if (metrics.contentNovelty < this.saturationThresholds.contentNovelty) {
      reasons.push({
        type: 'information_repetition',
        description: 'High level of information repetition detected across sources',
        weight: 0.8,
        evidence: [`Content novelty: ${(metrics.contentNovelty * 100).toFixed(1)}%`]
      });
    }

    // 来源枯竭检测
    if (metrics.sourceVariety < this.saturationThresholds.sourceVariety) {
      reasons.push({
        type: 'source_exhaustion',
        description: 'Limited variety in information sources',
        weight: 0.7,
        evidence: [`Source variety: ${(metrics.sourceVariety * 100).toFixed(1)}%`]
      });
    }

    // 质量平台期检测
    if (metrics.qualityStability > this.saturationThresholds.qualityStability) {
      reasons.push({
        type: 'quality_plateau',
        description: 'Information quality has reached a stable plateau',
        weight: 0.6,
        evidence: [`Quality stability: ${(metrics.qualityStability * 100).toFixed(1)}%`]
      });
    }

    // 收益递减检测
    if (metrics.diminishingReturns > this.saturationThresholds.diminishingReturns) {
      reasons.push({
        type: 'diminishing_returns',
        description: 'Diminishing returns from additional searches',
        weight: 0.9,
        evidence: [`Diminishing returns: ${(metrics.diminishingReturns * 100).toFixed(1)}%`]
      });
    }

    // 证据收敛检测
    if (metrics.evidenceConvergence > this.saturationThresholds.evidenceConvergence) {
      reasons.push({
        type: 'evidence_convergence',
        description: 'Evidence from multiple sources is converging',
        weight: 0.8,
        evidence: [`Evidence convergence: ${(metrics.evidenceConvergence * 100).toFixed(1)}%`]
      });
    }

    return reasons;
  }

  /**
   * 计算饱和水平
   */
  private calculateSaturationLevel(
    metrics: SaturationMetrics,
    reasons: SaturationReason[]
  ): number {
    // 基于指标的饱和度计算
    const metricSaturation = (
      (1 - metrics.contentNovelty) * 0.25 +
      (1 - metrics.sourceVariety) * 0.2 +
      metrics.evidenceConvergence * 0.2 +
      metrics.qualityStability * 0.15 +
      metrics.diminishingReturns * 0.2
    );

    // 基于原因的饱和度调整
    const reasonWeight = reasons.reduce((sum, reason) => sum + reason.weight, 0);
    const reasonSaturation = Math.min(reasonWeight / 3, 1); // 标准化到0-1

    // 综合计算
    return (metricSaturation * 0.7 + reasonSaturation * 0.3);
  }

  /**
   * 判断饱和状态
   */
  private determineSaturationStatus(
    saturationLevel: number,
    context: ResearchContext
  ): boolean {
    let threshold = this.saturationThresholds.overall;

    // 根据用户偏好调整阈值
    switch (context.userPreferences.preferredDepth) {
      case 'surface':
        threshold *= 0.7;
        break;
      case 'deep':
        threshold *= 1.2;
        break;
      case 'comprehensive':
        threshold *= 1.4;
        break;
    }

    // 根据质量要求调整
    threshold *= context.qualityRequirements;

    return saturationLevel >= Math.min(threshold, 0.95);
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    metrics: SaturationMetrics,
    reasons: SaturationReason[],
    context: ResearchContext
  ): SaturationRecommendation[] {
    const recommendations: SaturationRecommendation[] = [];

    // 基于饱和原因生成建议
    reasons.forEach(reason => {
      switch (reason.type) {
        case 'information_repetition':
          recommendations.push({
            action: 'refine_query',
            priority: 8,
            description: 'Refine search queries to find more diverse information',
            expectedBenefit: 'Discover new perspectives and reduce repetition',
            estimatedEffort: 30
          });
          break;

        case 'source_exhaustion':
          recommendations.push({
            action: 'expand_scope',
            priority: 7,
            description: 'Expand search scope to include more diverse sources',
            expectedBenefit: 'Access to broader range of information sources',
            estimatedEffort: 45
          });
          break;

        case 'diminishing_returns':
          recommendations.push({
            action: 'stop_search',
            priority: 9,
            description: 'Consider stopping search as additional queries yield minimal new information',
            expectedBenefit: 'Save time and resources while maintaining quality',
            estimatedEffort: 0
          });
          break;

        case 'evidence_convergence':
          recommendations.push({
            action: 'seek_expert_input',
            priority: 6,
            description: 'Seek expert opinions to validate converged evidence',
            expectedBenefit: 'Expert validation of research findings',
            estimatedEffort: 60
          });
          break;
      }
    });

    // 基于指标生成建议
    if (metrics.perspectiveBreadth < 0.6) {
      recommendations.push({
        action: 'change_strategy',
        priority: 7,
        description: 'Change search strategy to capture more diverse perspectives',
        expectedBenefit: 'Broader understanding of the topic',
        estimatedEffort: 40
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 确定下一步行动
   */
  private determineNextActions(
    metrics: SaturationMetrics,
    isSaturated: boolean,
    context: ResearchContext
  ): NextAction[] {
    const actions: NextAction[] = [];

    if (isSaturated) {
      actions.push({
        type: 'synthesize_results',
        description: 'Synthesize and analyze collected information',
        priority: 10,
        estimatedTime: 600, // 10 minutes
        expectedValue: 0.9
      });

      actions.push({
        type: 'validate_findings',
        description: 'Validate key findings with additional verification',
        priority: 8,
        estimatedTime: 300, // 5 minutes
        expectedValue: 0.7
      });
    } else {
      if (metrics.contentNovelty > 0.5) {
        actions.push({
          type: 'search_more',
          description: 'Continue searching for additional information',
          priority: 8,
          estimatedTime: 900, // 15 minutes
          expectedValue: 0.6
        });
      }

      if (metrics.perspectiveBreadth < 0.7) {
        actions.push({
          type: 'explore_alternatives',
          description: 'Explore alternative perspectives and viewpoints',
          priority: 7,
          estimatedTime: 720, // 12 minutes
          expectedValue: 0.8
        });
      }
    }

    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    metrics: SaturationMetrics,
    reasons: SaturationReason[]
  ): number {
    // 基于指标的置信度
    const metricConfidence = (
      metrics.evidenceConvergence * 0.3 +
      metrics.qualityStability * 0.3 +
      (1 - metrics.contentNovelty) * 0.2 +
      metrics.diminishingReturns * 0.2
    );

    // 基于原因数量的置信度
    const reasonConfidence = Math.min(reasons.length / 3, 1);

    return (metricConfidence * 0.7 + reasonConfidence * 0.3);
  }

  /**
   * 指标计算方法
   */
  private extractAllResults(thoughtChain: ThoughtChain): SearchResult[] {
    return thoughtChain.steps.flatMap(step => step.searchResults);
  }

  private calculateInformationDiversity(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    // 简化的信息多样性计算
    const uniqueSnippets = new Set(results.map(r => r.snippet.toLowerCase()));
    return uniqueSnippets.size / results.length;
  }

  private calculateSourceVariety(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    const uniqueSources = new Set(results.map(r => r.source));
    return Math.min(uniqueSources.size / 10, 1); // 假设10个不同来源为满分
  }

  private calculateContentNovelty(results: SearchResult[]): number {
    if (results.length === 0) return 1;
    
    // 简化的内容新颖性计算
    const recentResults = results.filter(r => {
      const resultDate = new Date(r.timestamp);
      const daysDiff = (Date.now() - resultDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30; // 30天内的内容认为是新的
    });
    
    return recentResults.length / results.length;
  }

  private calculateEvidenceConvergence(thoughtChain: ThoughtChain): number {
    // 简化的证据收敛计算
    const conclusions = thoughtChain.steps.flatMap(step => step.conclusions);
    if (conclusions.length === 0) return 0;
    
    // 检查结论的相似性
    const similarityThreshold = 0.7;
    let convergentPairs = 0;
    let totalPairs = 0;
    
    for (let i = 0; i < conclusions.length; i++) {
      for (let j = i + 1; j < conclusions.length; j++) {
        totalPairs++;
        // 简化的相似性检查
        if (this.calculateTextSimilarity(conclusions[i], conclusions[j]) > similarityThreshold) {
          convergentPairs++;
        }
      }
    }
    
    return totalPairs > 0 ? convergentPairs / totalPairs : 0;
  }

  private calculateQualityStability(thoughtChain: ThoughtChain): number {
    const qualityScores = thoughtChain.steps.map(step => step.analysis.qualityScore);
    if (qualityScores.length < 2) return 0;
    
    // 计算质量分数的标准差
    const mean = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    const variance = qualityScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / qualityScores.length;
    const stdDev = Math.sqrt(variance);
    
    // 标准差越小，稳定性越高
    return Math.max(0, 1 - stdDev);
  }

  private calculateDiminishingReturns(thoughtChain: ThoughtChain): number {
    if (thoughtChain.steps.length < 3) return 0;
    
    // 计算后续步骤的信息增益递减
    const gains = [];
    for (let i = 1; i < thoughtChain.steps.length; i++) {
      const currentStep = thoughtChain.steps[i];
      const previousStep = thoughtChain.steps[i - 1];
      
      const gain = currentStep.analysis.relevanceScore - previousStep.analysis.relevanceScore;
      gains.push(Math.max(0, gain));
    }
    
    // 检查增益是否递减
    let decreasingCount = 0;
    for (let i = 1; i < gains.length; i++) {
      if (gains[i] < gains[i - 1]) {
        decreasingCount++;
      }
    }
    
    return gains.length > 0 ? decreasingCount / gains.length : 0;
  }

  private calculateTemporalCoverage(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    const timestamps = results.map(r => new Date(r.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    
    // 时间跨度越大，覆盖度越高
    const timeSpan = maxTime - minTime;
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    
    return Math.min(timeSpan / oneYear, 1);
  }

  private calculatePerspectiveBreadth(results: SearchResult[]): number {
    // 简化的观点广度计算
    const sources = new Set(results.map(r => r.source));
    const domains = new Set(results.map(r => this.extractDomain(r.url)));
    
    return Math.min((sources.size + domains.size) / 20, 1);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // 简化的文本相似性计算
    const words1 = new Set(text1.toLowerCase().split(' '));
    const words2 = new Set(text2.toLowerCase().split(' '));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private recordAnalysis(chainId: string, analysis: SaturationAnalysis): void {
    if (!this.analysisHistory.has(chainId)) {
      this.analysisHistory.set(chainId, []);
    }
    this.analysisHistory.get(chainId)!.push(analysis);
  }

  private initializeSaturationThresholds(): SaturationThresholds {
    return {
      overall: 0.75,
      contentNovelty: 0.3,
      sourceVariety: 0.4,
      evidenceConvergence: 0.7,
      qualityStability: 0.8,
      diminishingReturns: 0.6
    };
  }
}

interface SaturationThresholds {
  overall: number;
  contentNovelty: number;
  sourceVariety: number;
  evidenceConvergence: number;
  qualityStability: number;
  diminishingReturns: number;
}
