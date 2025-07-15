/**
 * Intelligent Search Result Ranking System
 * 智能搜索结果排序系统
 * 
 * 实现基于多维度评分的智能排序算法：
 * - 相关性评分 (Relevance Scoring)
 * - 权威性评分 (Authority Scoring) 
 * - 时效性评分 (Freshness Scoring)
 * - 质量评分 (Quality Scoring)
 * - 多样性优化 (Diversity Optimization)
 */

import { SearchResult, EnhancedSearchResult } from '../types';
import { Logger } from '../utils/logger.js';

export interface RankingConfig {
  // 权重配置
  weights: {
    relevance: number;      // 相关性权重 (0-1)
    authority: number;      // 权威性权重 (0-1)
    freshness: number;      // 时效性权重 (0-1)
    quality: number;        // 质量权重 (0-1)
    diversity: number;      // 多样性权重 (0-1)
  };
  
  // 排序配置
  maxResults: number;       // 最大结果数
  diversityThreshold: number; // 多样性阈值
  qualityThreshold: number;   // 质量阈值
  
  // 特殊处理
  boostAcademic: boolean;   // 提升学术来源
  boostRecent: boolean;     // 提升最新内容
  penalizeDuplicates: boolean; // 惩罚重复内容
}

export interface RankingMetrics {
  relevanceScore: number;
  authorityScore: number;
  freshnessScore: number;
  qualityScore: number;
  diversityScore: number;
  finalScore: number;
  rankingFactors: string[];
}

export class IntelligentRanker {
  private logger: Logger;
  private config: RankingConfig;
  
  // 权威域名列表
  private authorityDomains = new Set([
    'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com',
    'ieee.org', 'acm.org', 'nature.com', 'science.org',
    'github.com', 'stackoverflow.com', 'wikipedia.org',
    'reuters.com', 'bbc.com', 'techcrunch.com', 'wired.com'
  ]);
  
  // 学术域名列表
  private academicDomains = new Set([
    'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com',
    'ieee.org', 'acm.org', 'nature.com', 'science.org',
    'springer.com', 'elsevier.com', 'wiley.com'
  ]);

  constructor(config?: Partial<RankingConfig>) {
    this.logger = new Logger('IntelligentRanker');
    this.config = {
      weights: {
        relevance: 0.35,
        authority: 0.25,
        freshness: 0.15,
        quality: 0.15,
        diversity: 0.10
      },
      maxResults: 50,
      diversityThreshold: 0.7,
      qualityThreshold: 0.6,
      boostAcademic: true,
      boostRecent: true,
      penalizeDuplicates: true,
      ...config
    };
  }

  /**
   * 智能排序搜索结果
   */
  async rankResults(
    results: SearchResult[], 
    query: string,
    context?: { topic?: string; domain?: string; timeRange?: string }
  ): Promise<EnhancedSearchResult[]> {
    this.logger.info(`Starting intelligent ranking for ${results.length} results`);
    
    // 1. 预处理和增强结果
    const enhancedResults = await this.enhanceResults(results, query, context);
    
    // 2. 计算多维度评分
    const scoredResults = await this.calculateScores(enhancedResults, query, context);
    
    // 3. 应用排序算法
    const rankedResults = this.applyRanking(scoredResults);
    
    // 4. 多样性优化
    const diversifiedResults = this.optimizeDiversity(rankedResults);
    
    // 5. 最终筛选和限制
    const finalResults = this.finalizeResults(diversifiedResults);
    
    this.logger.info(`Ranking completed: ${finalResults.length} results returned`);
    return finalResults;
  }

  /**
   * 增强搜索结果
   */
  private async enhanceResults(
    results: SearchResult[], 
    query: string,
    context?: any
  ): Promise<EnhancedSearchResult[]> {
    return results.map(result => ({
      ...result,
      relevanceScore: 0,
      qualityScore: 0,
      summary: result.content ? result.content.substring(0, 200) + '...' : result.title,
      keyPoints: this.extractKeyPoints(result.content || ''),
      extractedEntities: this.extractEntities(result.content || '', query),
      credibilityScore: 0,
      wordCount: result.content ? result.content.split(' ').length : 0,
      readingTime: result.content ? Math.ceil(result.content.split(' ').length / 200) : 1
    }));
  }

  /**
   * 计算多维度评分
   */
  private async calculateScores(
    results: EnhancedSearchResult[], 
    query: string,
    context?: any
  ): Promise<(EnhancedSearchResult & { metrics: RankingMetrics })[]> {
    const queryTerms = this.tokenizeQuery(query);
    
    return results.map(result => {
      const metrics: RankingMetrics = {
        relevanceScore: this.calculateRelevanceScore(result, queryTerms),
        authorityScore: this.calculateAuthorityScore(result),
        freshnessScore: this.calculateFreshnessScore(result),
        qualityScore: this.calculateQualityScore(result),
        diversityScore: 0, // 将在多样性优化中计算
        finalScore: 0,
        rankingFactors: []
      };
      
      // 计算最终评分
      metrics.finalScore = this.calculateFinalScore(metrics);
      
      // 记录排序因子
      metrics.rankingFactors = this.identifyRankingFactors(metrics, result);
      
      return {
        ...result,
        relevanceScore: metrics.relevanceScore,
        qualityScore: metrics.qualityScore,
        credibilityScore: metrics.authorityScore,
        metrics
      };
    });
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevanceScore(result: EnhancedSearchResult, queryTerms: string[]): number {
    let score = 0;
    const content = (result.title + ' ' + result.content).toLowerCase();
    
    // TF-IDF 简化版本
    for (const term of queryTerms) {
      const termFreq = (content.match(new RegExp(term, 'g')) || []).length;
      const titleBoost = result.title.toLowerCase().includes(term) ? 2 : 1;
      score += (termFreq * titleBoost) / queryTerms.length;
    }
    
    // 标题匹配加权
    const titleMatches = queryTerms.filter(term => 
      result.title.toLowerCase().includes(term)
    ).length;
    score += (titleMatches / queryTerms.length) * 0.5;
    
    return Math.min(score / 10, 1); // 归一化到 0-1
  }

  /**
   * 计算权威性评分
   */
  private calculateAuthorityScore(result: EnhancedSearchResult): number {
    let score = 0.5; // 基础分
    
    try {
      const domain = new URL(result.url).hostname.toLowerCase();
      
      // 权威域名加分
      if (this.authorityDomains.has(domain)) {
        score += 0.3;
      }
      
      // 学术域名额外加分
      if (this.academicDomains.has(domain) && this.config.boostAcademic) {
        score += 0.2;
      }
      
      // HTTPS 加分
      if (result.url.startsWith('https://')) {
        score += 0.1;
      }
      
    } catch (error) {
      // URL 解析失败，使用默认分数
    }
    
    return Math.min(score, 1);
  }

  /**
   * 计算时效性评分
   */
  private calculateFreshnessScore(result: EnhancedSearchResult): number {
    if (!result.lastUpdated) return 0.5;
    
    const now = new Date();
    const resultDate = new Date(result.lastUpdated);
    const daysDiff = (now.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // 时效性衰减函数
    let score = Math.exp(-daysDiff / 365); // 一年后衰减到 1/e
    
    // 最近内容加权
    if (this.config.boostRecent && daysDiff < 30) {
      score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(result: EnhancedSearchResult): number {
    let score = 0.5; // 基础分
    
    // 内容长度评分
    const contentLength = result.content ? result.content.length : 0;
    if (contentLength > 500) score += 0.2;
    if (contentLength > 1000) score += 0.1;
    
    // 标题质量评分
    const titleLength = result.title.length;
    if (titleLength > 10 && titleLength < 100) score += 0.1;
    
    // 结构化内容加分
    if (result.content && (result.content.includes('\n') || result.content.includes('•'))) {
      score += 0.1;
    }
    
    return Math.min(score, 1);
  }

  /**
   * 计算最终评分
   */
  private calculateFinalScore(metrics: RankingMetrics): number {
    const { weights } = this.config;
    
    return (
      metrics.relevanceScore * weights.relevance +
      metrics.authorityScore * weights.authority +
      metrics.freshnessScore * weights.freshness +
      metrics.qualityScore * weights.quality
    );
  }

  /**
   * 应用排序算法
   */
  private applyRanking(results: (EnhancedSearchResult & { metrics: RankingMetrics })[]): (EnhancedSearchResult & { metrics: RankingMetrics })[] {
    return results.sort((a, b) => b.metrics.finalScore - a.metrics.finalScore);
  }

  /**
   * 多样性优化
   */
  private optimizeDiversity(results: (EnhancedSearchResult & { metrics: RankingMetrics })[]): (EnhancedSearchResult & { metrics: RankingMetrics })[] {
    const diversified: (EnhancedSearchResult & { metrics: RankingMetrics })[] = [];
    const seenDomains = new Set<string>();
    const seenContent = new Set<string>();
    
    for (const result of results) {
      try {
        const domain = new URL(result.url).hostname;
        const contentHash = this.hashContent(result.content || '');
        
        // 检查域名多样性
        const domainCount = Array.from(seenDomains).filter(d => d === domain).length;
        if (domainCount >= 3) continue; // 同一域名最多3个结果
        
        // 检查内容重复
        if (this.config.penalizeDuplicates && seenContent.has(contentHash)) {
          continue;
        }
        
        seenDomains.add(domain);
        seenContent.add(contentHash);
        diversified.push(result);
        
      } catch (error) {
        // URL 解析失败，仍然包含结果
        diversified.push(result);
      }
    }
    
    return diversified;
  }

  /**
   * 最终结果处理
   */
  private finalizeResults(results: (EnhancedSearchResult & { metrics: RankingMetrics })[]): EnhancedSearchResult[] {
    return results
      .filter(result => result.metrics.finalScore >= this.config.qualityThreshold)
      .slice(0, this.config.maxResults)
      .map(({ metrics, ...result }) => result);
  }

  // 辅助方法
  private tokenizeQuery(query: string): string[] {
    return query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2);
  }

  private extractKeyPoints(content: string): string[] {
    // 简单的关键点提取
    return content.split(/[.!?]/)
      .filter(sentence => sentence.trim().length > 20)
      .slice(0, 3)
      .map(sentence => sentence.trim());
  }

  private extractEntities(content: string, query: string): string[] {
    // 简单的实体提取
    const entities = new Set<string>();
    const words = content.split(/\s+/);
    
    // 提取大写开头的词组（可能是实体）
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (/^[A-Z][a-z]+/.test(word)) {
        entities.add(word);
      }
    }
    
    return Array.from(entities).slice(0, 10);
  }

  private identifyRankingFactors(metrics: RankingMetrics, result: EnhancedSearchResult): string[] {
    const factors: string[] = [];
    
    if (metrics.relevanceScore > 0.8) factors.push('High Relevance');
    if (metrics.authorityScore > 0.8) factors.push('Authoritative Source');
    if (metrics.freshnessScore > 0.8) factors.push('Recent Content');
    if (metrics.qualityScore > 0.8) factors.push('High Quality');
    
    try {
      const domain = new URL(result.url).hostname;
      if (this.academicDomains.has(domain)) factors.push('Academic Source');
      if (this.authorityDomains.has(domain)) factors.push('Trusted Domain');
    } catch (error) {
      // URL 解析失败
    }
    
    return factors;
  }

  private hashContent(content: string): string {
    // 简单的内容哈希
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }
}
