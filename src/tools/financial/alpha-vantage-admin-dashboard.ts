import { ToolInput, ToolOutput } from '../../types.js';
import { Logger } from '../../utils/logger.js';
import { alphaVantageCache } from '../../utils/alpha-vantage-cache.js';
import { alphaVantageMonitor } from '../../utils/alpha-vantage-monitor.js';

/**
 * Alpha Vantage 管理面板工具
 * 提供API使用情况监控、缓存管理、性能分析等功能
 */

const logger = new Logger('AlphaVantageAdminDashboard');

export async function alphaVantageAdminDashboard(args: ToolInput): Promise<ToolOutput> {
  try {
    const action = args.action || 'overview';
    
    switch (action) {
      case 'overview':
        return await getOverview();
      case 'metrics':
        return await getMetrics();
      case 'cache':
        return await getCacheInfo();
      case 'recommendations':
        return await getRecommendations();
      case 'clear-cache':
        return await clearCache();
      case 'reset-stats':
        return await resetStats();
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Available actions: overview, metrics, cache, recommendations, clear-cache, reset-stats`
        };
    }
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    return {
      success: false,
      error: `Admin dashboard failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 获取总览信息
 */
async function getOverview(): Promise<ToolOutput> {
  const metrics = alphaVantageMonitor.getMetrics();
  const cacheStats = alphaVantageCache.getStats();
  const detailedReport = alphaVantageMonitor.getDetailedReport();
  
  const overview = {
    status: 'operational',
    apiKey: process.env.ALPHA_VANTAGE_API_KEY ? 'configured' : 'missing',
    
    // API使用情况
    usage: {
      totalRequests: metrics.totalRequests,
      requestsToday: metrics.requestsToday,
      requestsPerMinute: metrics.requestsPerMinute,
      dailyLimitUsage: `${metrics.requestsToday}/500 (${((metrics.requestsToday / 500) * 100).toFixed(1)}%)`,
      minuteLimitUsage: `${metrics.requestsPerMinute}/5 (${((metrics.requestsPerMinute / 5) * 100).toFixed(1)}%)`
    },
    
    // 性能指标
    performance: {
      successRate: `${metrics.successRate.toFixed(1)}%`,
      errorRate: `${metrics.errorRate.toFixed(1)}%`,
      averageResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`,
      cacheHitRate: `${cacheStats.hitRate.toFixed(1)}%`
    },
    
    // 缓存状态
    cache: {
      totalEntries: cacheStats.totalRequests > 0 ? 'active' : 'empty',
      hitRate: `${cacheStats.hitRate.toFixed(1)}%`,
      totalHits: cacheStats.hits,
      totalMisses: cacheStats.misses
    },
    
    // 最近活动
    recentActivity: detailedReport.recentActivity
  };
  
  return {
    success: true,
    data: {
      title: 'Alpha Vantage 管理面板 - 总览',
      overview,
      summary: generateOverviewSummary(overview),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 获取详细指标
 */
async function getMetrics(): Promise<ToolOutput> {
  const detailedReport = alphaVantageMonitor.getDetailedReport();
  
  return {
    success: true,
    data: {
      title: 'Alpha Vantage 详细指标',
      report: detailedReport,
      summary: generateMetricsSummary(detailedReport),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 获取缓存信息
 */
async function getCacheInfo(): Promise<ToolOutput> {
  const cacheInfo = alphaVantageCache.getCacheInfo();
  
  return {
    success: true,
    data: {
      title: 'Alpha Vantage 缓存状态',
      cache: cacheInfo,
      summary: generateCacheSummary(cacheInfo),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 获取性能建议
 */
async function getRecommendations(): Promise<ToolOutput> {
  const recommendations = alphaVantageMonitor.getPerformanceRecommendations();
  const metrics = alphaVantageMonitor.getMetrics();
  const cacheStats = alphaVantageCache.getStats();
  
  const analysis = {
    performance: analyzePerformance(metrics),
    usage: analyzeUsage(metrics),
    cache: analyzeCache(cacheStats),
    recommendations
  };
  
  return {
    success: true,
    data: {
      title: 'Alpha Vantage 性能分析与建议',
      analysis,
      summary: generateRecommendationsSummary(analysis),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 清空缓存
 */
async function clearCache(): Promise<ToolOutput> {
  alphaVantageCache.clear();
  
  return {
    success: true,
    data: {
      title: 'Alpha Vantage 缓存管理',
      action: 'clear-cache',
      result: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 重置统计数据
 */
async function resetStats(): Promise<ToolOutput> {
  alphaVantageMonitor.reset();
  
  return {
    success: true,
    data: {
      title: 'Alpha Vantage 统计管理',
      action: 'reset-stats',
      result: 'Statistics reset successfully',
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 生成总览摘要
 */
function generateOverviewSummary(overview: any): string {
  const status = overview.usage.requestsToday < 450 ? '正常' : '接近限制';
  const performance = overview.performance.errorRate < 5 ? '良好' : '需要关注';
  
  return `API状态: ${status}, 今日使用: ${overview.usage.requestsToday}/500次, 性能: ${performance}, 缓存命中率: ${overview.performance.cacheHitRate}`;
}

/**
 * 生成指标摘要
 */
function generateMetricsSummary(report: any): string {
  const overview = report.overview;
  return `总请求: ${overview.totalRequests}, 成功率: ${overview.successRate.toFixed(1)}%, 平均响应时间: ${overview.averageResponseTime.toFixed(0)}ms`;
}

/**
 * 生成缓存摘要
 */
function generateCacheSummary(cacheInfo: any): string {
  return `缓存条目: ${cacheInfo.totalEntries}, 命中率: ${cacheInfo.stats.hitRate.toFixed(1)}%, 总命中: ${cacheInfo.stats.hits}次`;
}

/**
 * 生成建议摘要
 */
function generateRecommendationsSummary(analysis: any): string {
  const recommendationCount = analysis.recommendations.length;
  const performanceLevel = analysis.performance.level;
  
  return `性能等级: ${performanceLevel}, ${recommendationCount}条优化建议`;
}

/**
 * 分析性能
 */
function analyzePerformance(metrics: any): any {
  let level = 'excellent';
  let score = 100;
  
  if (metrics.errorRate > 10) {
    level = 'poor';
    score -= 40;
  } else if (metrics.errorRate > 5) {
    level = 'fair';
    score -= 20;
  }
  
  if (metrics.averageResponseTime > 5000) {
    level = 'poor';
    score -= 30;
  } else if (metrics.averageResponseTime > 3000) {
    level = 'fair';
    score -= 15;
  }
  
  return {
    level,
    score,
    errorRate: metrics.errorRate,
    responseTime: metrics.averageResponseTime,
    successRate: metrics.successRate
  };
}

/**
 * 分析使用情况
 */
function analyzeUsage(metrics: any): any {
  const dailyUsagePercent = (metrics.requestsToday / 500) * 100;
  const minuteUsagePercent = (metrics.requestsPerMinute / 5) * 100;
  
  let status = 'normal';
  if (dailyUsagePercent > 90 || minuteUsagePercent > 80) {
    status = 'critical';
  } else if (dailyUsagePercent > 70 || minuteUsagePercent > 60) {
    status = 'warning';
  }
  
  return {
    status,
    dailyUsage: {
      current: metrics.requestsToday,
      limit: 500,
      percentage: dailyUsagePercent
    },
    minuteUsage: {
      current: metrics.requestsPerMinute,
      limit: 5,
      percentage: minuteUsagePercent
    }
  };
}

/**
 * 分析缓存
 */
function analyzeCache(cacheStats: any): any {
  let efficiency = 'excellent';
  
  if (cacheStats.hitRate < 20) {
    efficiency = 'poor';
  } else if (cacheStats.hitRate < 40) {
    efficiency = 'fair';
  } else if (cacheStats.hitRate < 60) {
    efficiency = 'good';
  }
  
  return {
    efficiency,
    hitRate: cacheStats.hitRate,
    totalRequests: cacheStats.totalRequests,
    hits: cacheStats.hits,
    misses: cacheStats.misses
  };
}

/**
 * 工具注册信息
 */
export const alphaVantageAdminDashboardTool = {
  name: 'alpha_vantage_admin_dashboard',
  description: 'Alpha Vantage administration dashboard for monitoring API usage, cache management, and performance analysis',
  category: 'admin',
  source: 'alphavantage.co',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: 'Dashboard action to perform',
        enum: ['overview', 'metrics', 'cache', 'recommendations', 'clear-cache', 'reset-stats'],
        default: 'overview'
      }
    },
    required: []
  },
  execute: alphaVantageAdminDashboard,
  examples: [
    {
      action: 'overview',
      description: 'Get Alpha Vantage system overview'
    },
    {
      action: 'metrics',
      description: 'Get detailed performance metrics'
    },
    {
      action: 'cache',
      description: 'Get cache status and information'
    },
    {
      action: 'recommendations',
      description: 'Get performance recommendations'
    }
  ]
};
