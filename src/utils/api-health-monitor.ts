/**
 * API健康监控系统
 * 监控API状态、性能指标和自动故障检测
 */

import { Logger } from './logger.js';
import { ErrorHandler } from './error-handler.js';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: number;
  error?: string;
  metadata?: any;
}

export interface ServiceMetrics {
  service: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastHealthCheck: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  errorRate: number;
}

export interface HealthCheckConfig {
  service: string;
  endpoint?: string;
  interval: number; // 检查间隔（毫秒）
  timeout: number; // 超时时间（毫秒）
  healthyThreshold: number; // 连续成功次数阈值
  unhealthyThreshold: number; // 连续失败次数阈值
  customCheck?: () => Promise<boolean>;
}

export class ApiHealthMonitor {
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private healthChecks: Map<string, HealthCheckConfig> = new Map();
  private metrics: Map<string, ServiceMetrics> = new Map();
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private consecutiveSuccesses: Map<string, number> = new Map();
  
  constructor(logger: Logger, errorHandler: ErrorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }
  
  /**
   * 注册服务健康检查
   */
  registerService(config: HealthCheckConfig): void {
    this.healthChecks.set(config.service, config);
    
    // 初始化指标
    this.metrics.set(config.service, {
      service: config.service,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastHealthCheck: 0,
      status: 'healthy',
      uptime: 100,
      errorRate: 0
    });
    
    this.healthHistory.set(config.service, []);
    this.consecutiveFailures.set(config.service, 0);
    this.consecutiveSuccesses.set(config.service, 0);
    
    this.logger.info(`Registered health check for service: ${config.service}`);
  }
  
  /**
   * 开始监控所有注册的服务
   */
  startMonitoring(): void {
    for (const [service, config] of this.healthChecks.entries()) {
      this.startServiceMonitoring(service, config);
    }
    
    this.logger.info('Started API health monitoring');
  }
  
  /**
   * 停止监控
   */
  stopMonitoring(): void {
    for (const [service, interval] of this.intervals.entries()) {
      clearInterval(interval);
      this.logger.info(`Stopped monitoring service: ${service}`);
    }
    
    this.intervals.clear();
    this.logger.info('Stopped API health monitoring');
  }
  
  /**
   * 开始监控特定服务
   */
  private startServiceMonitoring(service: string, config: HealthCheckConfig): void {
    // 立即执行一次健康检查
    this.performHealthCheck(service, config);
    
    // 设置定期检查
    const interval = setInterval(() => {
      this.performHealthCheck(service, config);
    }, config.interval);
    
    this.intervals.set(service, interval);
  }
  
  /**
   * 执行健康检查
   */
  private async performHealthCheck(service: string, config: HealthCheckConfig): Promise<void> {
    const startTime = Date.now();
    
    try {
      let isHealthy = false;
      
      if (config.customCheck) {
        // 使用自定义检查函数
        isHealthy = await this.executeWithTimeout(config.customCheck(), config.timeout);
      } else if (config.endpoint) {
        // 使用HTTP端点检查
        isHealthy = await this.checkHttpEndpoint(config.endpoint, config.timeout);
      } else {
        // 默认认为健康（如果没有配置检查方法）
        isHealthy = true;
      }
      
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        service,
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: Date.now()
      };
      
      this.recordHealthCheck(service, result, true);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        service,
        status: 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.recordHealthCheck(service, result, false);
      
      this.logger.warn(`Health check failed for service ${service}`, {
        error: result.error,
        responseTime
      });
    }
  }
  
  /**
   * 检查HTTP端点
   */
  private async checkHttpEndpoint(endpoint: string, timeout: number): Promise<boolean> {
    const axios = await import('axios');
    
    try {
      const response = await axios.default.get(endpoint, {
        timeout,
        validateStatus: (status) => status < 500 // 4xx也认为是可用的
      });
      
      return response.status < 500;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 记录健康检查结果
   */
  private recordHealthCheck(service: string, result: HealthCheckResult, success: boolean): void {
    // 更新历史记录
    const history = this.healthHistory.get(service) || [];
    history.push(result);
    
    // 保留最近100次检查记录
    if (history.length > 100) {
      history.shift();
    }
    
    this.healthHistory.set(service, history);
    
    // 更新连续成功/失败计数
    if (success) {
      this.consecutiveSuccesses.set(service, (this.consecutiveSuccesses.get(service) || 0) + 1);
      this.consecutiveFailures.set(service, 0);
    } else {
      this.consecutiveFailures.set(service, (this.consecutiveFailures.get(service) || 0) + 1);
      this.consecutiveSuccesses.set(service, 0);
    }
    
    // 更新指标
    this.updateMetrics(service, result, success);
    
    // 检查状态变化
    this.checkStatusChange(service);
  }
  
  /**
   * 更新服务指标
   */
  private updateMetrics(service: string, result: HealthCheckResult, success: boolean): void {
    const metrics = this.metrics.get(service);
    if (!metrics) return;
    
    metrics.totalRequests++;
    metrics.lastHealthCheck = result.timestamp;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    // 更新平均响应时间
    const totalResponseTime = metrics.averageResponseTime * (metrics.totalRequests - 1) + result.responseTime;
    metrics.averageResponseTime = Math.round(totalResponseTime / metrics.totalRequests);
    
    // 计算错误率
    metrics.errorRate = Math.round((metrics.failedRequests / metrics.totalRequests) * 100);
    
    // 计算正常运行时间
    metrics.uptime = Math.round((metrics.successfulRequests / metrics.totalRequests) * 100);
    
    this.metrics.set(service, metrics);
  }
  
  /**
   * 检查服务状态变化
   */
  private checkStatusChange(service: string): void {
    const config = this.healthChecks.get(service);
    const metrics = this.metrics.get(service);
    if (!config || !metrics) return;
    
    const consecutiveFailures = this.consecutiveFailures.get(service) || 0;
    const consecutiveSuccesses = this.consecutiveSuccesses.get(service) || 0;
    
    let newStatus = metrics.status;
    
    // 检查是否应该标记为不健康
    if (consecutiveFailures >= config.unhealthyThreshold && metrics.status !== 'unhealthy') {
      newStatus = 'unhealthy';
      this.logger.error(`Service ${service} marked as UNHEALTHY after ${consecutiveFailures} consecutive failures`);
    }
    // 检查是否应该标记为健康
    else if (consecutiveSuccesses >= config.healthyThreshold && metrics.status !== 'healthy') {
      newStatus = 'healthy';
      this.logger.info(`Service ${service} marked as HEALTHY after ${consecutiveSuccesses} consecutive successes`);
    }
    // 检查是否应该标记为降级
    else if (metrics.errorRate > 20 && metrics.errorRate < 50 && metrics.status === 'healthy') {
      newStatus = 'degraded';
      this.logger.warn(`Service ${service} marked as DEGRADED due to high error rate: ${metrics.errorRate}%`);
    }
    
    if (newStatus !== metrics.status) {
      metrics.status = newStatus;
      this.metrics.set(service, metrics);
    }
  }
  
  /**
   * 获取服务健康状态
   */
  getServiceHealth(service: string): ServiceMetrics | null {
    return this.metrics.get(service) || null;
  }
  
  /**
   * 获取所有服务健康状态
   */
  getAllServicesHealth(): ServiceMetrics[] {
    return Array.from(this.metrics.values());
  }
  
  /**
   * 获取服务健康历史
   */
  getServiceHistory(service: string, limit?: number): HealthCheckResult[] {
    const history = this.healthHistory.get(service) || [];
    return limit ? history.slice(-limit) : history;
  }
  
  /**
   * 获取系统整体健康状态
   */
  getSystemHealth(): {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    averageResponseTime: number;
    overallUptime: number;
  } {
    const services = Array.from(this.metrics.values());
    
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }
    
    const averageResponseTime = services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.averageResponseTime, 0) / services.length)
      : 0;
    
    const overallUptime = services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.uptime, 0) / services.length)
      : 100;
    
    return {
      overallStatus,
      totalServices: services.length,
      healthyServices: healthyCount,
      degradedServices: degradedCount,
      unhealthyServices: unhealthyCount,
      averageResponseTime,
      overallUptime
    };
  }
  
  /**
   * 使用超时执行操作
   */
  private executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      promise
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
