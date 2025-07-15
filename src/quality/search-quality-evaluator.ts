/**
 * Search Quality Evaluation System
 * 搜索质量评估系统
 *
 * 功能：
 * - 搜索结果质量评分
 * - 用户反馈收集
 * - 持续优化机制
 * - 质量趋势分析
 * - A/B测试支持
 */

import { Logger } from '../utils/logger.js';
import { SearchResult, EnhancedSearchResult } from '../types.js';

export interface QualityMetrics {
  // 相关性指标
  relevanceScore: number;        // 相关性评分 (0-1)
  precisionAtK: number[];        // P@K 指标
  recallAtK: number[];           // R@K 指标

  // 多样性指标
  diversityScore: number;        // 多样性评分 (0-1)
  sourceDiversity: number;       // 来源多样性
  topicCoverage: number;         // 主题覆盖度

  // 质量指标
  averageQualityScore: number;   // 平均质量分
  authorityScore: number;        // 权威性评分
  freshnessScore: number;        // 时效性评分

  // 用户体验指标
  userSatisfaction: number;      // 用户满意度
  clickThroughRate: number;      // 点击率
  dwellTime: number;             // 停留时间

  // 系统指标
  responseTime: number;          // 响应时间
  resultCount: number;           // 结果数量
  errorRate: number;             // 错误率
}

export interface UserFeedback {
  queryId: string;
  query: string;
  resultId: string;
  feedbackType: 'relevant' | 'irrelevant' | 'spam' | 'outdated' | 'excellent';
  rating: number; // 1-5 星评分
  comment?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface QualityReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  overallScore: number;
  metrics: QualityMetrics;
  trends: {
    relevance: number[];
    diversity: number[];
    quality: number[];
    satisfaction: number[];
    timestamps: Date[];
  };
  topQueries: {
    query: string;
    count: number;
    averageScore: number;
  }[];
  problemAreas: {
    area: string;
    score: number;
    description: string;
    recommendations: string[];
  }[];
}

export class SearchQualityEvaluator {
  private logger: Logger;
  private feedbackHistory: UserFeedback[] = [];
  private qualityHistory: { timestamp: Date; metrics: QualityMetrics; query: string }[] = [];

  // 质量阈值配置
  private qualityThresholds = {
    relevance: {
      excellent: 0.9,
      good: 0.7,
      acceptable: 0.5,
      poor: 0.3
    },
    diversity: {
      excellent: 0.8,
      good: 0.6,
      acceptable: 0.4,
      poor: 0.2
    },
    quality: {
      excellent: 0.85,
      good: 0.7,
      acceptable: 0.55,
      poor: 0.4
    }
  };

  constructor() {
    this.logger = new Logger('SearchQualityEvaluator');
  }

  /**
   * 评估搜索结果质量
   */
  async evaluateSearchResults(
    query: string,
    results: EnhancedSearchResult[],
    context?: {
      responseTime: number;
      totalSources: number;
      errorCount: number;
    }
  ): Promise<QualityMetrics> {
    this.logger.debug(`Evaluating quality for query: ${query} (${results.length} results)`);

    const metrics: QualityMetrics = {
      // 相关性指标
      relevanceScore: this.calculateRelevanceScore(results),
      precisionAtK: this.calculatePrecisionAtK(results, [1, 3, 5, 10]),
      recallAtK: this.calculateRecallAtK(results, [1, 3, 5, 10]),

      // 多样性指标
      diversityScore: this.calculateDiversityScore(results),
      sourceDiversity: this.calculateSourceDiversity(results),
      topicCoverage: this.calculateTopicCoverage(results, query),

      // 质量指标
      averageQualityScore: this.calculateAverageQuality(results),
      authorityScore: this.calculateAuthorityScore(results),
      freshnessScore: this.calculateFreshnessScore(results),

      // 用户体验指标（基于历史数据估算）
      userSatisfaction: this.estimateUserSatisfaction(query, results),
      clickThroughRate: this.estimateClickThroughRate(results),
      dwellTime: this.estimateDwellTime(results),

      // 系统指标
      responseTime: context?.responseTime || 0,
      resultCount: results.length,
      errorRate: context?.errorCount ? context.errorCount / (context.totalSources || 1) : 0
    };

    // 记录质量历史
    this.qualityHistory.push({
      timestamp: new Date(),
      metrics,
      query
    });

    // 限制历史记录数量
    if (this.qualityHistory.length > 10000) {
      this.qualityHistory = this.qualityHistory.slice(-5000);
    }

    return metrics;
  }

  /**
   * 收集用户反馈
   */
  collectUserFeedback(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback);

    // 限制反馈历史数量
    if (this.feedbackHistory.length > 50000) {
      this.feedbackHistory = this.feedbackHistory.slice(-25000);
    }

    this.logger.debug(`User feedback collected: ${feedback.feedbackType} for query ${feedback.query}`);
  }

  /**
   * 生成质量报告
   */
  generateQualityReport(
    timeRange: { start: Date; end: Date }
  ): QualityReport {
    const relevantHistory = this.qualityHistory.filter(
      h => h.timestamp >= timeRange.start && h.timestamp <= timeRange.end
    );

    const relevantFeedback = this.feedbackHistory.filter(
      f => f.timestamp >= timeRange.start && f.timestamp <= timeRange.end
    );

    // 计算总体指标
    const overallMetrics = this.calculateOverallMetrics(relevantHistory);

    // 计算趋势
    const trends = this.calculateTrends(relevantHistory);

    // 分析热门查询
    const topQueries = this.analyzeTopQueries(relevantHistory, relevantFeedback);

    // 识别问题区域
    const problemAreas = this.identifyProblemAreas(overallMetrics, relevantFeedback);

    return {
      timeRange,
      overallScore: this.calculateOverallScore(overallMetrics),
      metrics: overallMetrics,
      trends,
      topQueries,
      problemAreas
    };
  }

  /**
   * 获取实时质量指标
   */
  getCurrentQualityMetrics(): QualityMetrics | null {
    if (this.qualityHistory.length === 0) return null;

    // 返回最近的质量指标
    return this.qualityHistory[this.qualityHistory.length - 1].metrics;
  }

  /**
   * 获取质量趋势
   */
  getQualityTrends(hours: number = 24): {
    timestamps: Date[];
    relevance: number[];
    diversity: number[];
    quality: number[];
    satisfaction: number[];
  } {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentHistory = this.qualityHistory.filter(h => h.timestamp >= cutoffTime);

    return this.calculateTrends(recentHistory);
  }

  // 私有方法

  private calculateRelevanceScore(results: EnhancedSearchResult[]): number {
    if (results.length === 0) return 0;

    const relevanceScores = results.map(r => r.relevanceScore || 0);
    return relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length;
  }

  private calculatePrecisionAtK(results: EnhancedSearchResult[], kValues: number[]): number[] {
    return kValues.map(k => {
      const topK = results.slice(0, k);
      const relevantCount = topK.filter(r => (r.relevanceScore || 0) > 0.5).length;
      return topK.length > 0 ? relevantCount / topK.length : 0;
    });
  }

  private calculateRecallAtK(results: EnhancedSearchResult[], kValues: number[]): number[] {
    const totalRelevant = results.filter(r => (r.relevanceScore || 0) > 0.5).length;

    return kValues.map(k => {
      const topK = results.slice(0, k);
      const relevantInTopK = topK.filter(r => (r.relevanceScore || 0) > 0.5).length;
      return totalRelevant > 0 ? relevantInTopK / totalRelevant : 0;
    });
  }

  private calculateDiversityScore(results: EnhancedSearchResult[]): number {
    if (results.length <= 1) return 1;

    // 计算内容相似度的倒数作为多样性分数
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const similarity = this.calculateContentSimilarity(results[i], results[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    const averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
    return Math.max(0, 1 - averageSimilarity);
  }

  private calculateSourceDiversity(results: EnhancedSearchResult[]): number {
    if (results.length === 0) return 0;

    const sources = new Set(results.map(r => r.source));
    return sources.size / results.length;
  }

  private calculateTopicCoverage(results: EnhancedSearchResult[], query: string): number {
    // 简化的主题覆盖度计算
    const queryTerms = query.toLowerCase().split(/\s+/);
    let coverage = 0;

    for (const term of queryTerms) {
      const hasTermInResults = results.some(r =>
        r.title.toLowerCase().includes(term) ||
        (r.content && r.content.toLowerCase().includes(term))
      );
      if (hasTermInResults) coverage++;
    }

    return queryTerms.length > 0 ? coverage / queryTerms.length : 0;
  }

  private calculateAverageQuality(results: EnhancedSearchResult[]): number {
    if (results.length === 0) return 0;

    const qualityScores = results.map(r => r.qualityScore || 0);
    return qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  }

  private calculateAuthorityScore(results: EnhancedSearchResult[]): number {
    if (results.length === 0) return 0;

    const authorityScores = results.map(r => r.credibilityScore || 0);
    return authorityScores.reduce((sum, score) => sum + score, 0) / authorityScores.length;
  }

  private calculateFreshnessScore(results: EnhancedSearchResult[]): number {
    if (results.length === 0) return 0;

    const now = new Date();
    const freshnessScores = results.map(r => {
      if (!r.lastUpdated) return 0.5;

      const daysDiff = (now.getTime() - new Date(r.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return Math.exp(-daysDiff / 365); // 一年后衰减到 1/e
    });

    return freshnessScores.reduce((sum, score) => sum + score, 0) / freshnessScores.length;
  }

  private estimateUserSatisfaction(query: string, results: EnhancedSearchResult[]): number {
    // 基于历史反馈估算用户满意度
    const relevantFeedback = this.feedbackHistory.filter(f =>
      f.query.toLowerCase().includes(query.toLowerCase()) ||
      query.toLowerCase().includes(f.query.toLowerCase())
    );

    if (relevantFeedback.length === 0) {
      // 基于结果质量估算
      const avgQuality = this.calculateAverageQuality(results);
      const avgRelevance = this.calculateRelevanceScore(results);
      return (avgQuality + avgRelevance) / 2;
    }

    const avgRating = relevantFeedback.reduce((sum, f) => sum + f.rating, 0) / relevantFeedback.length;
    return avgRating / 5; // 转换为 0-1 范围
  }

  private estimateClickThroughRate(results: EnhancedSearchResult[]): number {
    // 基于结果质量和位置估算点击率
    let estimatedCTR = 0;

    results.forEach((result, index) => {
      const positionFactor = Math.exp(-index * 0.3); // 位置衰减
      const qualityFactor = (result.relevanceScore || 0) * (result.qualityScore || 0);
      estimatedCTR += positionFactor * qualityFactor * 0.3; // 基础CTR 30%
    });

    return Math.min(estimatedCTR, 1);
  }

  private estimateDwellTime(results: EnhancedSearchResult[]): number {
    // 基于内容长度和质量估算停留时间
    const avgWordCount = results.reduce((sum, r) => sum + (r.wordCount || 0), 0) / results.length;
    const avgQuality = this.calculateAverageQuality(results);

    // 基础停留时间 + 内容长度因子 + 质量因子
    return 30 + (avgWordCount / 100) * 10 + avgQuality * 60; // 秒
  }

  private calculateContentSimilarity(result1: EnhancedSearchResult, result2: EnhancedSearchResult): number {
    // 简化的内容相似度计算
    const text1 = (result1.title + ' ' + result1.content).toLowerCase();
    const text2 = (result2.title + ' ' + result2.content).toLowerCase();

    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateOverallMetrics(history: { timestamp: Date; metrics: QualityMetrics; query: string }[]): QualityMetrics {
    if (history.length === 0) {
      return {
        relevanceScore: 0, precisionAtK: [], recallAtK: [],
        diversityScore: 0, sourceDiversity: 0, topicCoverage: 0,
        averageQualityScore: 0, authorityScore: 0, freshnessScore: 0,
        userSatisfaction: 0, clickThroughRate: 0, dwellTime: 0,
        responseTime: 0, resultCount: 0, errorRate: 0
      };
    }

    const metrics = history.map(h => h.metrics);

    return {
      relevanceScore: this.average(metrics.map(m => m.relevanceScore)),
      precisionAtK: this.averageArrays(metrics.map(m => m.precisionAtK)),
      recallAtK: this.averageArrays(metrics.map(m => m.recallAtK)),
      diversityScore: this.average(metrics.map(m => m.diversityScore)),
      sourceDiversity: this.average(metrics.map(m => m.sourceDiversity)),
      topicCoverage: this.average(metrics.map(m => m.topicCoverage)),
      averageQualityScore: this.average(metrics.map(m => m.averageQualityScore)),
      authorityScore: this.average(metrics.map(m => m.authorityScore)),
      freshnessScore: this.average(metrics.map(m => m.freshnessScore)),
      userSatisfaction: this.average(metrics.map(m => m.userSatisfaction)),
      clickThroughRate: this.average(metrics.map(m => m.clickThroughRate)),
      dwellTime: this.average(metrics.map(m => m.dwellTime)),
      responseTime: this.average(metrics.map(m => m.responseTime)),
      resultCount: this.average(metrics.map(m => m.resultCount)),
      errorRate: this.average(metrics.map(m => m.errorRate))
    };
  }

  private calculateTrends(history: { timestamp: Date; metrics: QualityMetrics; query: string }[]): {
    timestamps: Date[];
    relevance: number[];
    diversity: number[];
    quality: number[];
    satisfaction: number[];
  } {
    return {
      timestamps: history.map(h => h.timestamp),
      relevance: history.map(h => h.metrics.relevanceScore),
      diversity: history.map(h => h.metrics.diversityScore),
      quality: history.map(h => h.metrics.averageQualityScore),
      satisfaction: history.map(h => h.metrics.userSatisfaction)
    };
  }

  private analyzeTopQueries(
    history: { timestamp: Date; metrics: QualityMetrics; query: string }[],
    feedback: UserFeedback[]
  ): { query: string; count: number; averageScore: number }[] {
    const queryStats = new Map<string, { count: number; totalScore: number }>();

    history.forEach(h => {
      const existing = queryStats.get(h.query) || { count: 0, totalScore: 0 };
      queryStats.set(h.query, {
        count: existing.count + 1,
        totalScore: existing.totalScore + h.metrics.relevanceScore
      });
    });

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageScore: stats.totalScore / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private identifyProblemAreas(
    metrics: QualityMetrics,
    feedback: UserFeedback[]
  ): { area: string; score: number; description: string; recommendations: string[] }[] {
    const problems: { area: string; score: number; description: string; recommendations: string[] }[] = [];

    // 检查相关性问题
    if (metrics.relevanceScore < this.qualityThresholds.relevance.acceptable) {
      problems.push({
        area: 'Relevance',
        score: metrics.relevanceScore,
        description: 'Search results have low relevance to user queries',
        recommendations: [
          'Improve query understanding algorithms',
          'Enhance semantic matching capabilities',
          'Review and update ranking algorithms'
        ]
      });
    }

    // 检查多样性问题
    if (metrics.diversityScore < this.qualityThresholds.diversity.acceptable) {
      problems.push({
        area: 'Diversity',
        score: metrics.diversityScore,
        description: 'Search results lack diversity in sources and content',
        recommendations: [
          'Implement diversity optimization in ranking',
          'Expand search source coverage',
          'Add content deduplication mechanisms'
        ]
      });
    }

    // 检查质量问题
    if (metrics.averageQualityScore < this.qualityThresholds.quality.acceptable) {
      problems.push({
        area: 'Quality',
        score: metrics.averageQualityScore,
        description: 'Overall content quality is below acceptable standards',
        recommendations: [
          'Implement stricter quality filters',
          'Improve source authority scoring',
          'Add content quality assessment algorithms'
        ]
      });
    }

    return problems.sort((a, b) => a.score - b.score);
  }

  private calculateOverallScore(metrics: QualityMetrics): number {
    // 加权计算总体质量分数
    return (
      metrics.relevanceScore * 0.3 +
      metrics.diversityScore * 0.2 +
      metrics.averageQualityScore * 0.2 +
      metrics.userSatisfaction * 0.2 +
      (1 - metrics.errorRate) * 0.1
    );
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  private averageArrays(arrays: number[][]): number[] {
    if (arrays.length === 0) return [];

    const maxLength = Math.max(...arrays.map(arr => arr.length));
    const result: number[] = [];

    for (let i = 0; i < maxLength; i++) {
      const values = arrays.map(arr => arr[i] || 0);
      result.push(this.average(values));
    }

    return result;
  }
}