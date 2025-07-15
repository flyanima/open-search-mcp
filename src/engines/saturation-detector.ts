/**
 * 智能饱和检测引擎
 * 实时检测搜索饱和度，智能停止无效搜索
 */

export interface SaturationMetrics {
  duplicateRate: number;             // 重复率 (0-1)
  noveltyScore: number;              // 新颖性评分 (0-1)
  sourceOverlapRate: number;         // 信息源重叠率 (0-1)
  informationGainRate: number;       // 信息增益率 (0-1)
  searchEfficiency: number;          // 搜索效率 (0-1)
}

export interface SaturationCriteria {
  duplicateThreshold: number;        // 重复阈值 (默认0.8)
  noveltyThreshold: number;          // 新颖性阈值 (默认0.2)
  sourceOverlapLimit: number;        // 源重叠限制 (默认0.7)
  minSearchCount: number;            // 最少搜索数量
  maxSearchCount: number;            // 最大搜索数量
  informationGainThreshold: number;  // 信息增益阈值 (默认0.1)
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  content: string;
  source: string;
  timestamp: number;
  relevanceScore: number;
  noveltyScore?: number;
  contentHash?: string;
}

export interface SaturationReport {
  isSaturated: boolean;
  saturationLevel: number;           // 饱和度 (0-1)
  metrics: SaturationMetrics;
  recommendation: 'continue' | 'stop' | 'adjust_strategy';
  reasoning: string;
  nextActions: string[];
}

export class SaturationDetector {
  private criteria: SaturationCriteria;
  private seenUrls: Set<string> = new Set();
  private seenContentHashes: Set<string> = new Set();
  private seenSources: Set<string> = new Set();
  private searchHistory: SearchResult[] = [];
  private recentResults: SearchResult[] = [];

  constructor(criteria: SaturationCriteria) {
    this.criteria = criteria;
  }

  /**
   * 检测当前搜索是否达到饱和
   */
  async detectSaturation(
    newResults: SearchResult[],
    branchTarget: string
  ): Promise<SaturationReport> {
    // 更新搜索历史
    this.updateSearchHistory(newResults);
    
    // 计算饱和度指标
    const metrics = await this.calculateSaturationMetrics(newResults, branchTarget);
    
    // 判断是否饱和
    const isSaturated = this.isSaturated(metrics);
    
    // 计算整体饱和度
    const saturationLevel = this.calculateSaturationLevel(metrics);
    
    // 生成建议
    const recommendation = this.generateRecommendation(metrics, isSaturated);
    
    // 生成推理说明
    const reasoning = this.generateReasoning(metrics, isSaturated);
    
    // 生成下一步行动建议
    const nextActions = this.generateNextActions(metrics, recommendation);

    return {
      isSaturated,
      saturationLevel,
      metrics,
      recommendation,
      reasoning,
      nextActions
    };
  }

  /**
   * 更新搜索历史
   */
  private updateSearchHistory(newResults: SearchResult[]): void {
    for (const result of newResults) {
      // 计算内容哈希
      result.contentHash = this.calculateContentHash(result.content);
      
      // 更新集合
      this.seenUrls.add(result.url);
      this.seenContentHashes.add(result.contentHash);
      this.seenSources.add(result.source);
      
      // 添加到历史
      this.searchHistory.push(result);
      this.recentResults.push(result);
    }
    
    // 保持最近结果的窗口大小
    if (this.recentResults.length > 50) {
      this.recentResults = this.recentResults.slice(-50);
    }
  }

  /**
   * 计算饱和度指标
   */
  private async calculateSaturationMetrics(
    newResults: SearchResult[],
    branchTarget: string
  ): Promise<SaturationMetrics> {
    // 1. 计算重复率
    const duplicateRate = this.calculateDuplicateRate(newResults);
    
    // 2. 计算新颖性评分
    const noveltyScore = await this.calculateNoveltyScore(newResults, branchTarget);
    
    // 3. 计算源重叠率
    const sourceOverlapRate = this.calculateSourceOverlapRate(newResults);
    
    // 4. 计算信息增益率
    const informationGainRate = this.calculateInformationGainRate(newResults);
    
    // 5. 计算搜索效率
    const searchEfficiency = this.calculateSearchEfficiency(newResults);

    return {
      duplicateRate,
      noveltyScore,
      sourceOverlapRate,
      informationGainRate,
      searchEfficiency
    };
  }

  /**
   * 计算重复率
   */
  private calculateDuplicateRate(newResults: SearchResult[]): number {
    if (newResults.length === 0) return 0;
    
    let duplicateCount = 0;
    
    for (const result of newResults) {
      const contentHash = this.calculateContentHash(result.content);
      if (this.seenContentHashes.has(contentHash) || this.seenUrls.has(result.url)) {
        duplicateCount++;
      }
    }
    
    return duplicateCount / newResults.length;
  }

  /**
   * 计算新颖性评分
   */
  private async calculateNoveltyScore(
    newResults: SearchResult[],
    branchTarget: string
  ): Promise<number> {
    if (newResults.length === 0) return 0;
    
    let totalNovelty = 0;
    
    for (const result of newResults) {
      // 简单的新颖性评估：基于内容长度、关键词匹配等
      const novelty = this.assessContentNovelty(result, branchTarget);
      result.noveltyScore = novelty;
      totalNovelty += novelty;
    }
    
    return totalNovelty / newResults.length;
  }

  /**
   * 计算源重叠率
   */
  private calculateSourceOverlapRate(newResults: SearchResult[]): number {
    if (newResults.length === 0) return 0;
    
    const newSources = new Set(newResults.map(r => r.source));
    const overlapCount = Array.from(newSources).filter(source => 
      this.seenSources.has(source)
    ).length;
    
    return newSources.size > 0 ? overlapCount / newSources.size : 0;
  }

  /**
   * 计算信息增益率
   */
  private calculateInformationGainRate(newResults: SearchResult[]): number {
    if (this.searchHistory.length < 10) return 1; // 初期阶段认为增益率高
    
    // 比较最近结果与历史结果的相似度
    const recentAvgRelevance = this.recentResults
      .slice(-10)
      .reduce((sum, r) => sum + r.relevanceScore, 0) / 10;
    
    const historicalAvgRelevance = this.searchHistory
      .slice(0, -10)
      .reduce((sum, r) => sum + r.relevanceScore, 0) / (this.searchHistory.length - 10);
    
    // 如果最近结果的平均相关性明显低于历史平均，说明信息增益在下降
    return Math.max(0, (recentAvgRelevance - historicalAvgRelevance + 1) / 2);
  }

  /**
   * 计算搜索效率
   */
  private calculateSearchEfficiency(newResults: SearchResult[]): number {
    if (newResults.length === 0) return 0;
    
    // 效率 = 高质量结果数 / 总结果数
    const highQualityCount = newResults.filter(r => 
      r.relevanceScore > 0.7 && (r.noveltyScore || 0) > 0.5
    ).length;
    
    return highQualityCount / newResults.length;
  }

  /**
   * 判断是否饱和
   */
  private isSaturated(metrics: SaturationMetrics): boolean {
    const conditions = [
      metrics.duplicateRate >= this.criteria.duplicateThreshold,
      metrics.noveltyScore <= this.criteria.noveltyThreshold,
      metrics.sourceOverlapRate >= this.criteria.sourceOverlapLimit,
      metrics.informationGainRate <= this.criteria.informationGainThreshold,
      this.searchHistory.length >= this.criteria.maxSearchCount
    ];
    
    // 如果满足多个饱和条件，则认为已饱和
    const satisfiedConditions = conditions.filter(Boolean).length;
    return satisfiedConditions >= 2 && this.searchHistory.length >= this.criteria.minSearchCount;
  }

  /**
   * 计算整体饱和度
   */
  private calculateSaturationLevel(metrics: SaturationMetrics): number {
    const weights = {
      duplicateRate: 0.3,
      noveltyScore: 0.25,
      sourceOverlapRate: 0.2,
      informationGainRate: 0.15,
      searchEfficiency: 0.1
    };
    
    return (
      metrics.duplicateRate * weights.duplicateRate +
      (1 - metrics.noveltyScore) * weights.noveltyScore +
      metrics.sourceOverlapRate * weights.sourceOverlapRate +
      (1 - metrics.informationGainRate) * weights.informationGainRate +
      (1 - metrics.searchEfficiency) * weights.searchEfficiency
    );
  }

  /**
   * 生成建议
   */
  private generateRecommendation(
    metrics: SaturationMetrics,
    isSaturated: boolean
  ): 'continue' | 'stop' | 'adjust_strategy' {
    if (isSaturated) {
      return 'stop';
    }
    
    if (metrics.searchEfficiency < 0.3 || metrics.informationGainRate < 0.2) {
      return 'adjust_strategy';
    }
    
    return 'continue';
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(metrics: SaturationMetrics, isSaturated: boolean): string {
    const reasons = [];
    
    if (metrics.duplicateRate >= this.criteria.duplicateThreshold) {
      reasons.push(`重复率过高 (${(metrics.duplicateRate * 100).toFixed(1)}%)`);
    }
    
    if (metrics.noveltyScore <= this.criteria.noveltyThreshold) {
      reasons.push(`新颖性过低 (${(metrics.noveltyScore * 100).toFixed(1)}%)`);
    }
    
    if (metrics.sourceOverlapRate >= this.criteria.sourceOverlapLimit) {
      reasons.push(`信息源重叠过多 (${(metrics.sourceOverlapRate * 100).toFixed(1)}%)`);
    }
    
    if (isSaturated) {
      return `搜索已饱和: ${reasons.join(', ')}`;
    } else {
      return `搜索可继续: 仍有信息增益空间`;
    }
  }

  /**
   * 生成下一步行动建议
   */
  private generateNextActions(
    metrics: SaturationMetrics,
    recommendation: string
  ): string[] {
    const actions = [];
    
    switch (recommendation) {
      case 'stop':
        actions.push('停止当前分支搜索');
        actions.push('整理和分析已收集的信息');
        actions.push('转向下一个搜索分支');
        break;
        
      case 'adjust_strategy':
        if (metrics.duplicateRate > 0.5) {
          actions.push('调整搜索查询，避免重复源');
        }
        if (metrics.noveltyScore < 0.3) {
          actions.push('扩展搜索范围，寻找新的信息源');
        }
        if (metrics.searchEfficiency < 0.3) {
          actions.push('优化搜索关键词，提高结果质量');
        }
        break;
        
      case 'continue':
        actions.push('继续当前搜索策略');
        actions.push('监控搜索质量和效率');
        break;
    }
    
    return actions;
  }

  /**
   * 评估内容新颖性
   */
  private assessContentNovelty(result: SearchResult, branchTarget: string): number {
    // 简单的新颖性评估算法
    let novelty = 0.5; // 基础分数
    
    // 基于内容长度
    if (result.content.length > 1000) novelty += 0.1;
    if (result.content.length > 3000) novelty += 0.1;
    
    // 基于目标关键词匹配
    const targetKeywords = branchTarget.toLowerCase().split(' ');
    const contentLower = result.content.toLowerCase();
    const matchCount = targetKeywords.filter(keyword => 
      contentLower.includes(keyword)
    ).length;
    novelty += (matchCount / targetKeywords.length) * 0.3;
    
    return Math.min(1, novelty);
  }

  /**
   * 计算内容哈希
   */
  private calculateContentHash(content: string): string {
    // 简单的哈希算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  /**
   * 重置检测器状态
   */
  reset(): void {
    this.seenUrls.clear();
    this.seenContentHashes.clear();
    this.seenSources.clear();
    this.searchHistory = [];
    this.recentResults = [];
  }

  /**
   * 获取搜索统计信息
   */
  getSearchStats(): {
    totalSearches: number;
    uniqueUrls: number;
    uniqueSources: number;
    averageRelevance: number;
  } {
    return {
      totalSearches: this.searchHistory.length,
      uniqueUrls: this.seenUrls.size,
      uniqueSources: this.seenSources.size,
      averageRelevance: this.searchHistory.length > 0 
        ? this.searchHistory.reduce((sum, r) => sum + r.relevanceScore, 0) / this.searchHistory.length
        : 0
    };
  }
}
