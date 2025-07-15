/**
 * Alpha Vantage 性能监控系统
 * 监控API使用情况、响应时间、错误率等关键指标
 */

import { Logger } from './logger.js';

interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
  requestsPerMinute: number;
  requestsToday: number;
}

interface RequestLog {
  timestamp: number;
  apiFunction: string;
  responseTime: number;
  success: boolean;
  error?: string;
  cacheHit?: boolean;
}

interface DailyUsage {
  date: string;
  requests: number;
  errors: number;
  averageResponseTime: number;
}

export class AlphaVantageMonitor {
  private logger: Logger;
  private metrics: APIMetrics;
  private requestLogs: RequestLog[] = [];
  private dailyUsage: Map<string, DailyUsage> = new Map();
  private readonly MAX_LOGS = 1000; // 保留最近1000条请求日志

  // API限制配置
  private readonly RATE_LIMITS = {
    FREE_TIER: {
      perMinute: 5,
      perDay: 500
    },
    PREMIUM: {
      perMinute: 75,
      perDay: 75000
    }
  };

  constructor() {
    this.logger = new Logger('AlphaVantageMonitor');
    this.metrics = this.initializeMetrics();
    
    // 定期重置每分钟计数器
    setInterval(() => this.resetMinuteCounter(), 60000);
    
    // 每小时保存统计数据
    setInterval(() => this.saveHourlyStats(), 3600000);
  }

  private initializeMetrics(): APIMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      errorRate: 0,
      successRate: 0,
      requestsPerMinute: 0,
      requestsToday: 0
    };
  }

  /**
   * 记录API请求开始
   */
  startRequest(apiFunction: string): { requestId: string; startTime: number } {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.logger.debug(`API request started: ${apiFunction}`, { requestId });
    
    return { requestId, startTime };
  }

  /**
   * 记录API请求完成
   */
  endRequest(
    requestId: string,
    startTime: number,
    apiFunction: string,
    success: boolean,
    error?: string,
    cacheHit: boolean = false
  ): void {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // 更新指标
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.successRate = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
    this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;

    // 记录请求日志
    const logEntry: RequestLog = {
      timestamp: endTime,
      apiFunction,
      responseTime,
      success,
      error,
      cacheHit
    };

    this.requestLogs.push(logEntry);
    
    // 保持日志数量在限制内
    if (this.requestLogs.length > this.MAX_LOGS) {
      this.requestLogs.shift();
    }

    // 更新每日使用统计
    this.updateDailyUsage(responseTime, success);

    // 记录日志
    const logLevel = success ? 'debug' : 'warn';
    this.logger[logLevel](`API request completed: ${apiFunction}`, {
      requestId,
      responseTime,
      success,
      error,
      cacheHit
    });

    // 检查速率限制警告
    this.checkRateLimitWarnings();
  }

  /**
   * 更新每日使用统计
   */
  private updateDailyUsage(responseTime: number, success: boolean): void {
    const today = new Date().toISOString().split('T')[0];
    
    let usage = this.dailyUsage.get(today);
    if (!usage) {
      usage = {
        date: today,
        requests: 0,
        errors: 0,
        averageResponseTime: 0
      };
      this.dailyUsage.set(today, usage);
    }

    usage.requests++;
    if (!success) {
      usage.errors++;
    }
    
    // 更新平均响应时间
    usage.averageResponseTime = (usage.averageResponseTime * (usage.requests - 1) + responseTime) / usage.requests;
    
    this.metrics.requestsToday = usage.requests;
  }

  /**
   * 检查速率限制警告
   */
  private checkRateLimitWarnings(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 计算最近一分钟的请求数
    const recentRequests = this.requestLogs.filter(log => log.timestamp > oneMinuteAgo);
    this.metrics.requestsPerMinute = recentRequests.length;

    // 检查每分钟限制
    if (this.metrics.requestsPerMinute >= this.RATE_LIMITS.FREE_TIER.perMinute) {
      this.logger.warn('Approaching per-minute rate limit', {
        current: this.metrics.requestsPerMinute,
        limit: this.RATE_LIMITS.FREE_TIER.perMinute
      });
    }

    // 检查每日限制
    if (this.metrics.requestsToday >= this.RATE_LIMITS.FREE_TIER.perDay * 0.9) {
      this.logger.warn('Approaching daily rate limit', {
        current: this.metrics.requestsToday,
        limit: this.RATE_LIMITS.FREE_TIER.perDay
      });
    }
  }

  /**
   * 重置每分钟计数器
   */
  private resetMinuteCounter(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.requestLogs.filter(log => log.timestamp > oneMinuteAgo);
    this.metrics.requestsPerMinute = recentRequests.length;
  }

  /**
   * 保存每小时统计数据
   */
  private saveHourlyStats(): void {
    const stats = this.getMetrics();
    this.logger.info('Hourly Alpha Vantage stats', stats);
  }

  /**
   * 获取当前指标
   */
  getMetrics(): APIMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取详细报告
   */
  getDetailedReport(): any {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const recentLogs = this.requestLogs.filter(log => log.timestamp > oneHourAgo);
    const dailyLogs = this.requestLogs.filter(log => log.timestamp > oneDayAgo);

    // 按API函数分组统计
    const apiStats = new Map<string, any>();
    this.requestLogs.forEach(log => {
      if (!apiStats.has(log.apiFunction)) {
        apiStats.set(log.apiFunction, {
          totalRequests: 0,
          successfulRequests: 0,
          totalResponseTime: 0,
          averageResponseTime: 0
        });
      }
      
      const stats = apiStats.get(log.apiFunction)!;
      stats.totalRequests++;
      stats.totalResponseTime += log.responseTime;
      
      if (log.success) {
        stats.successfulRequests++;
      }
      
      stats.averageResponseTime = stats.totalResponseTime / stats.totalRequests;
    });

    return {
      overview: this.getMetrics(),
      rateLimits: {
        current: {
          perMinute: this.metrics.requestsPerMinute,
          today: this.metrics.requestsToday
        },
        limits: this.RATE_LIMITS.FREE_TIER,
        utilizationPercentage: {
          perMinute: (this.metrics.requestsPerMinute / this.RATE_LIMITS.FREE_TIER.perMinute) * 100,
          daily: (this.metrics.requestsToday / this.RATE_LIMITS.FREE_TIER.perDay) * 100
        }
      },
      recentActivity: {
        lastHour: {
          requests: recentLogs.length,
          averageResponseTime: recentLogs.length > 0 
            ? recentLogs.reduce((sum, log) => sum + log.responseTime, 0) / recentLogs.length 
            : 0,
          errorRate: recentLogs.length > 0 
            ? (recentLogs.filter(log => !log.success).length / recentLogs.length) * 100 
            : 0
        },
        last24Hours: {
          requests: dailyLogs.length,
          averageResponseTime: dailyLogs.length > 0 
            ? dailyLogs.reduce((sum, log) => sum + log.responseTime, 0) / dailyLogs.length 
            : 0,
          errorRate: dailyLogs.length > 0 
            ? (dailyLogs.filter(log => !log.success).length / dailyLogs.length) * 100 
            : 0
        }
      },
      apiBreakdown: Object.fromEntries(apiStats),
      dailyUsage: Array.from(this.dailyUsage.values()).slice(-7) // 最近7天
    };
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.errorRate > 5) {
      recommendations.push('错误率较高，建议检查API调用参数和网络连接');
    }

    if (metrics.averageResponseTime > 3000) {
      recommendations.push('平均响应时间较长，建议启用缓存或优化查询');
    }

    if (this.metrics.requestsToday > this.RATE_LIMITS.FREE_TIER.perDay * 0.8) {
      recommendations.push('接近每日API限制，建议考虑升级到Premium版本');
    }

    if (this.metrics.requestsPerMinute > this.RATE_LIMITS.FREE_TIER.perMinute * 0.8) {
      recommendations.push('接近每分钟API限制，建议增加请求间隔');
    }

    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate < 30) {
      recommendations.push('缓存命中率较低，建议优化缓存策略');
    }

    return recommendations;
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    const recentLogs = this.requestLogs.slice(-100); // 最近100次请求
    if (recentLogs.length === 0) return 0;
    
    const cacheHits = recentLogs.filter(log => log.cacheHit).length;
    return (cacheHits / recentLogs.length) * 100;
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.metrics = this.initializeMetrics();
    this.requestLogs = [];
    this.logger.info('Alpha Vantage monitor statistics reset');
  }
}

/**
 * 全局监控实例
 */
export const alphaVantageMonitor = new AlphaVantageMonitor();
