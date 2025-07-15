import { defaultLogger as logger } from './logger.js';

export interface PerformanceMetrics {
  toolName: string;
  executionTime: number;
  success: boolean;
  errorType?: string;
  cacheHit: boolean;
  requestSize: number;
  responseSize: number;
  timestamp: Date;
  platform?: string;
  userId?: string;
}

export interface PerformanceStats {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorsByType: Record<string, number>;
  slowestTools: Array<{ tool: string; avgTime: number }>;
  fastestTools: Array<{ tool: string; avgTime: number }>;
  platformStats: Record<string, {
    requests: number;
    avgTime: number;
    successRate: number;
  }>;
}

export interface PerformanceThresholds {
  maxResponseTime: number;
  minSuccessRate: number;
  maxConcurrentRequests: number;
  cacheHitRateTarget: number;
}

/**
 * Performance Monitor for Open-Search-MCP
 * Tracks and analyzes tool performance across platforms
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private activeRequests: Map<string, { startTime: number; toolName: string }> = new Map();
  private thresholds: PerformanceThresholds;
  private maxMetricsHistory: number = 10000;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      maxResponseTime: 30000, // 30 seconds
      minSuccessRate: 0.95, // 95%
      maxConcurrentRequests: 10,
      cacheHitRateTarget: 0.6, // 60%
      ...thresholds
    };
  }

  /**
   * Start tracking a tool execution
   */
  public startTracking(requestId: string, toolName: string, platform?: string): void {
    this.activeRequests.set(requestId, {
      startTime: Date.now(),
      toolName
    });

    // Check concurrent request limit
    if (this.activeRequests.size > this.thresholds.maxConcurrentRequests) {
      logger.warn(`High concurrent requests: ${this.activeRequests.size}/${this.thresholds.maxConcurrentRequests}`);
    }
  }

  /**
   * End tracking and record metrics
   */
  public endTracking(
    requestId: string,
    success: boolean,
    options: {
      errorType?: string;
      cacheHit?: boolean;
      requestSize?: number;
      responseSize?: number;
      platform?: string;
      userId?: string;
    } = {}
  ): void {
    const activeRequest = this.activeRequests.get(requestId);
    if (!activeRequest) {
      logger.warn(`No active request found for ID: ${requestId}`);
      return;
    }

    const executionTime = Date.now() - activeRequest.startTime;
    
    const metric: PerformanceMetrics = {
      toolName: activeRequest.toolName,
      executionTime,
      success,
      errorType: options.errorType,
      cacheHit: options.cacheHit || false,
      requestSize: options.requestSize || 0,
      responseSize: options.responseSize || 0,
      timestamp: new Date(),
      platform: options.platform,
      userId: options.userId
    };

    this.recordMetric(metric);
    this.activeRequests.delete(requestId);

    // Check performance thresholds
    this.checkThresholds(metric);
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Maintain history limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log slow requests
    if (metric.executionTime > this.thresholds.maxResponseTime) {
      logger.warn(`Slow tool execution: ${metric.toolName} took ${metric.executionTime}ms`);
    }

    // Log errors
    if (!metric.success) {
      logger.error(`Tool execution failed: ${metric.toolName} - ${metric.errorType}`);
    }
  }

  /**
   * Check performance against thresholds
   */
  private checkThresholds(metric: PerformanceMetrics): void {
    // Check response time
    if (metric.executionTime > this.thresholds.maxResponseTime) {
      logger.warn(`Performance threshold exceeded: ${metric.toolName} response time ${metric.executionTime}ms > ${this.thresholds.maxResponseTime}ms`);
    }

    // Check overall success rate (last 100 requests)
    const recentMetrics = this.metrics.slice(-100);
    const successRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
    
    if (successRate < this.thresholds.minSuccessRate) {
      logger.warn(`Performance threshold exceeded: Success rate ${(successRate * 100).toFixed(1)}% < ${(this.thresholds.minSuccessRate * 100)}%`);
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  public getStats(timeWindow?: { start: Date; end: Date }): PerformanceStats {
    let metricsToAnalyze = this.metrics;

    // Filter by time window if provided
    if (timeWindow) {
      metricsToAnalyze = this.metrics.filter(m => 
        m.timestamp >= timeWindow.start && m.timestamp <= timeWindow.end
      );
    }

    if (metricsToAnalyze.length === 0) {
      return this.getEmptyStats();
    }

    const totalRequests = metricsToAnalyze.length;
    const successfulRequests = metricsToAnalyze.filter(m => m.success).length;
    const successRate = successfulRequests / totalRequests;
    
    const totalResponseTime = metricsToAnalyze.reduce((sum, m) => sum + m.executionTime, 0);
    const averageResponseTime = totalResponseTime / totalRequests;

    const cacheHits = metricsToAnalyze.filter(m => m.cacheHit).length;
    const cacheHitRate = cacheHits / totalRequests;

    // Error analysis
    const errorsByType: Record<string, number> = {};
    metricsToAnalyze.filter(m => !m.success).forEach(m => {
      const errorType = m.errorType || 'Unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    // Tool performance analysis
    const toolStats = this.analyzeToolPerformance(metricsToAnalyze);
    const platformStats = this.analyzePlatformPerformance(metricsToAnalyze);

    return {
      totalRequests,
      successRate,
      averageResponseTime,
      cacheHitRate,
      errorsByType,
      slowestTools: toolStats.slowest,
      fastestTools: toolStats.fastest,
      platformStats
    };
  }

  /**
   * Analyze tool-specific performance
   */
  private analyzeToolPerformance(metrics: PerformanceMetrics[]) {
    const toolMetrics: Record<string, { times: number[]; successes: number; total: number }> = {};

    metrics.forEach(m => {
      if (!toolMetrics[m.toolName]) {
        toolMetrics[m.toolName] = { times: [], successes: 0, total: 0 };
      }
      
      toolMetrics[m.toolName].times.push(m.executionTime);
      toolMetrics[m.toolName].total++;
      if (m.success) {
        toolMetrics[m.toolName].successes++;
      }
    });

    const toolPerformance = Object.entries(toolMetrics).map(([tool, stats]) => ({
      tool,
      avgTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
      successRate: stats.successes / stats.total
    }));

    return {
      slowest: toolPerformance
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 5)
        .map(({ tool, avgTime }) => ({ tool, avgTime })),
      fastest: toolPerformance
        .sort((a, b) => a.avgTime - b.avgTime)
        .slice(0, 5)
        .map(({ tool, avgTime }) => ({ tool, avgTime }))
    };
  }

  /**
   * Analyze platform-specific performance
   */
  private analyzePlatformPerformance(metrics: PerformanceMetrics[]): Record<string, any> {
    const platformMetrics: Record<string, { times: number[]; successes: number; total: number }> = {};

    metrics.forEach(m => {
      const platform = m.platform || 'unknown';
      if (!platformMetrics[platform]) {
        platformMetrics[platform] = { times: [], successes: 0, total: 0 };
      }
      
      platformMetrics[platform].times.push(m.executionTime);
      platformMetrics[platform].total++;
      if (m.success) {
        platformMetrics[platform].successes++;
      }
    });

    const result: Record<string, any> = {};
    Object.entries(platformMetrics).forEach(([platform, stats]) => {
      result[platform] = {
        requests: stats.total,
        avgTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
        successRate: stats.successes / stats.total
      };
    });

    return result;
  }

  /**
   * Get empty stats structure
   */
  private getEmptyStats(): PerformanceStats {
    return {
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorsByType: {},
      slowestTools: [],
      fastestTools: [],
      platformStats: {}
    };
  }

  /**
   * Get current active requests count
   */
  public getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get performance recommendations
   */
  public getRecommendations(): string[] {
    const stats = this.getStats();
    const recommendations: string[] = [];

    // Response time recommendations
    if (stats.averageResponseTime > this.thresholds.maxResponseTime * 0.8) {
      recommendations.push(`Average response time (${stats.averageResponseTime.toFixed(0)}ms) is approaching threshold. Consider optimizing slow tools.`);
    }

    // Success rate recommendations
    if (stats.successRate < this.thresholds.minSuccessRate) {
      recommendations.push(`Success rate (${(stats.successRate * 100).toFixed(1)}%) is below target. Check error logs and API configurations.`);
    }

    // Cache hit rate recommendations
    if (stats.cacheHitRate < this.thresholds.cacheHitRateTarget) {
      recommendations.push(`Cache hit rate (${(stats.cacheHitRate * 100).toFixed(1)}%) is below target. Consider increasing cache TTL or improving query patterns.`);
    }

    // Concurrent requests recommendations
    if (this.activeRequests.size > this.thresholds.maxConcurrentRequests * 0.8) {
      recommendations.push(`High concurrent request load (${this.activeRequests.size}/${this.thresholds.maxConcurrentRequests}). Consider implementing request queuing.`);
    }

    // Tool-specific recommendations
    if (stats.slowestTools.length > 0) {
      const slowestTool = stats.slowestTools[0];
      if (slowestTool.avgTime > this.thresholds.maxResponseTime * 0.5) {
        recommendations.push(`Tool '${slowestTool.tool}' is consistently slow (${slowestTool.avgTime.toFixed(0)}ms avg). Consider optimization or caching.`);
      }
    }

    return recommendations;
  }

  /**
   * Export metrics for analysis
   */
  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'toolName', 'executionTime', 'success', 'errorType', 'cacheHit', 'platform'];
      const rows = this.metrics.map(m => [
        m.timestamp.toISOString(),
        m.toolName,
        m.executionTime.toString(),
        m.success.toString(),
        m.errorType || '',
        m.cacheHit.toString(),
        m.platform || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Clear metrics history
   */
  public clearMetrics(): void {
    this.metrics = [];
    logger.info('Performance metrics cleared');
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();
