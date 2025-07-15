/**
 * API健康监控器 - 实时监控API状态和性能
 */

import { SearchAPI, APIHealthMetrics } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface HealthMonitorConfig {
  healthCheckInterval: number;
  failoverThreshold: number;
}

export class APIHealthMonitor {
  private config: HealthMonitorConfig;
  private logger: Logger;
  private healthMetrics: Map<string, APIHealthMetrics> = new Map();
  private apis: SearchAPI[] = [];
  private isMonitoring: boolean = false;

  constructor(config: HealthMonitorConfig) {
    this.config = config;
    this.logger = new Logger('APIHealthMonitor');
  }

  /**
   * 注册API进行监控
   */
  registerAPI(api: SearchAPI): void {
    this.apis.push(api);
    this.initializeHealthMetrics(api.name);
    this.logger.info(`Registered API for monitoring: ${api.name}`);
  }

  /**
   * 初始化API健康指标
   */
  private initializeHealthMetrics(apiName: string): void {
    this.healthMetrics.set(apiName, {
      isHealthy: true,
      responseTime: 0,
      successRate: 1.0,
      errorCount: 0,
      totalRequests: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      averageResponseTime: 0,
      uptime: 1.0
    });
  }

  /**
   * 记录成功请求
   */
  recordSuccess(apiName: string, responseTime?: number): void {
    const metrics = this.healthMetrics.get(apiName);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.consecutiveFailures = 0;
    
    if (responseTime) {
      metrics.responseTime = responseTime;
      metrics.averageResponseTime = this.calculateAverageResponseTime(apiName, responseTime);
    }

    metrics.successRate = this.calculateSuccessRate(apiName);
    metrics.lastCheck = new Date();
    
    // 如果之前不健康，现在恢复健康
    if (!metrics.isHealthy) {
      metrics.isHealthy = true;
      this.logger.info(`API ${apiName} recovered and is now healthy`);
    }
  }

  /**
   * 记录错误请求
   */
  recordError(apiName: string, error: Error): void {
    const metrics = this.healthMetrics.get(apiName);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.errorCount++;
    metrics.consecutiveFailures++;
    metrics.successRate = this.calculateSuccessRate(apiName);
    metrics.lastCheck = new Date();

    this.logger.warn(`API ${apiName} error:`, error.message);

    // 检查是否需要标记为不健康
    if (metrics.consecutiveFailures >= this.config.failoverThreshold) {
      metrics.isHealthy = false;
      this.logger.error(`API ${apiName} marked as unhealthy after ${metrics.consecutiveFailures} consecutive failures`);
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<void> {
    if (this.apis.length === 0) return;

    this.logger.debug('Performing health check for all APIs');

    const healthCheckPromises = this.apis.map(api => this.checkAPIHealth(api));
    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 检查单个API健康状态
   */
  private async checkAPIHealth(api: SearchAPI): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 执行简单的健康检查查询
      await api.search('health check', { maxResults: 1 });
      
      const responseTime = Date.now() - startTime;
      this.recordSuccess(api.name, responseTime);
      
    } catch (error) {
      this.recordError(api.name, error as Error);
    }
  }

  /**
   * 获取健康的API列表
   */
  getHealthyAPIs(): SearchAPI[] {
    return this.apis.filter(api => {
      const metrics = this.healthMetrics.get(api.name);
      return metrics?.isHealthy ?? false;
    });
  }

  /**
   * 获取所有健康指标
   */
  getHealthMetrics(): Map<string, APIHealthMetrics> {
    return new Map(this.healthMetrics);
  }

  /**
   * 获取特定API的健康指标
   */
  getAPIHealthMetrics(apiName: string): APIHealthMetrics | undefined {
    return this.healthMetrics.get(apiName);
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(apiName: string): number {
    const metrics = this.healthMetrics.get(apiName);
    if (!metrics || metrics.totalRequests === 0) return 1.0;

    const successCount = metrics.totalRequests - metrics.errorCount;
    return successCount / metrics.totalRequests;
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(apiName: string, newResponseTime: number): number {
    const metrics = this.healthMetrics.get(apiName);
    if (!metrics) return newResponseTime;

    // 使用指数移动平均
    const alpha = 0.1; // 平滑因子
    return metrics.averageResponseTime * (1 - alpha) + newResponseTime * alpha;
  }

  /**
   * 重置API健康状态
   */
  resetAPIHealth(apiName: string): void {
    const metrics = this.healthMetrics.get(apiName);
    if (metrics) {
      metrics.isHealthy = true;
      metrics.consecutiveFailures = 0;
      metrics.errorCount = 0;
      metrics.totalRequests = 0;
      metrics.successRate = 1.0;
      this.logger.info(`Reset health status for API: ${apiName}`);
    }
  }

  /**
   * 获取监控统计信息
   */
  getMonitoringStats(): {
    totalAPIs: number;
    healthyAPIs: number;
    unhealthyAPIs: number;
    averageResponseTime: number;
    overallSuccessRate: number;
  } {
    const totalAPIs = this.apis.length;
    const healthyAPIs = this.getHealthyAPIs().length;
    const unhealthyAPIs = totalAPIs - healthyAPIs;

    let totalResponseTime = 0;
    let totalRequests = 0;
    let totalSuccessfulRequests = 0;

    for (const metrics of this.healthMetrics.values()) {
      totalResponseTime += metrics.averageResponseTime * metrics.totalRequests;
      totalRequests += metrics.totalRequests;
      totalSuccessfulRequests += (metrics.totalRequests - metrics.errorCount);
    }

    return {
      totalAPIs,
      healthyAPIs,
      unhealthyAPIs,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      overallSuccessRate: totalRequests > 0 ? totalSuccessfulRequests / totalRequests : 1.0
    };
  }

  /**
   * 启动监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.logger.info('Starting API health monitoring');

    // 定期执行健康检查
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.logger.info('Stopped API health monitoring');
  }
}
