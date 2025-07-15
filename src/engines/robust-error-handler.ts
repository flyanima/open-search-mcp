/**
 * 强化错误处理引擎 - 智能重试和优雅降级
 * 提升系统稳定性和用户体验
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('RobustErrorHandler');

interface RetryConfig {
  maxRetries: number;
  backoffFactor: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
  retryableErrors: string[];
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

interface ErrorContext {
  operation: string;
  service: string;
  attempt?: number;
  metadata?: Record<string, any>;
}

interface FallbackStrategy {
  type: 'default' | 'alternative' | 'cached' | 'empty';
  value?: any;
  alternativeFunction?: () => Promise<any>;
}

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export class RobustErrorHandler {
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    backoffFactor: 2,
    baseDelay: 1000,
    maxDelay: 30000,
    timeout: 30000,
    retryableErrors: [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NETWORK_ERROR',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'INTERNAL_SERVER_ERROR'
    ]
  };

  private circuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringWindow: 300000
  };

  private circuitBreakers = new Map<string, {
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
    nextAttemptTime: number;
  }>();

  private errorStats = new Map<string, {
    count: number;
    lastOccurrence: number;
    pattern: string;
  }>();

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customConfig?: Partial<RetryConfig>,
    fallback?: FallbackStrategy
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customConfig };
    const circuitKey = `${context.service}:${context.operation}`;
    
    // 检查熔断器状态
    if (this.isCircuitOpen(circuitKey)) {
      logger.warn(`Circuit breaker is open for ${circuitKey}, using fallback`);
      return this.executeFallback(fallback, context);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const enhancedContext = { ...context, attempt };
        logger.debug(`Executing ${context.operation} (attempt ${attempt}/${config.maxRetries})`);
        
        // 执行操作，带超时控制
        const result = await this.executeWithTimeout(operation, config.timeout);
        
        // 成功时重置熔断器
        this.recordSuccess(circuitKey);
        
        if (attempt > 1) {
          logger.info(`Operation ${context.operation} succeeded on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const enhancedContext = { ...context, attempt };

        // 记录错误统计
        this.recordError(lastError, enhancedContext);
        
        // 检查是否应该重试
        if (!this.shouldRetry(lastError, attempt, config)) {
          logger.error(`Operation ${context.operation} failed permanently:`, lastError);
          this.recordFailure(circuitKey);
          break;
        }
        
        // 计算延迟时间
        const delay = this.calculateDelay(attempt, config);
        logger.warn(`Attempt ${attempt} failed for ${context.operation}, retrying in ${delay}ms:`, lastError.message);
        
        // 等待后重试
        await this.delay(delay);
      }
    }
    
    // 所有重试都失败，记录熔断器失败并执行降级
    this.recordFailure(circuitKey);
    return this.executeFallback(fallback, context, lastError);
  }

  /**
   * 带超时的操作执行
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error, attempt: number, config: RetryConfig): boolean {
    if (attempt >= config.maxRetries) {
      return false;
    }

    // 检查错误类型是否可重试
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;
    
    return config.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase()) ||
      errorCode === retryableError
    );
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // 添加抖动
    return Math.min(jitteredDelay, config.maxDelay);
  }

  /**
   * 延迟函数
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查熔断器是否开启
   */
  private isCircuitOpen(circuitKey: string): boolean {
    const circuit = this.circuitBreakers.get(circuitKey);
    if (!circuit) return false;

    const now = Date.now();
    
    switch (circuit.state) {
      case CircuitState.OPEN:
        if (now >= circuit.nextAttemptTime) {
          circuit.state = CircuitState.HALF_OPEN;
          logger.info(`Circuit breaker ${circuitKey} moved to HALF_OPEN state`);
          return false;
        }
        return true;
        
      case CircuitState.HALF_OPEN:
        return false;
        
      case CircuitState.CLOSED:
      default:
        return false;
    }
  }

  /**
   * 记录成功，重置熔断器
   */
  private recordSuccess(circuitKey: string): void {
    const circuit = this.circuitBreakers.get(circuitKey);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = CircuitState.CLOSED;
      logger.debug(`Circuit breaker ${circuitKey} reset to CLOSED state`);
    }
  }

  /**
   * 记录失败，更新熔断器状态
   */
  private recordFailure(circuitKey: string): void {
    const now = Date.now();
    let circuit = this.circuitBreakers.get(circuitKey);
    
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failures: 0,
        lastFailureTime: now,
        nextAttemptTime: 0
      };
      this.circuitBreakers.set(circuitKey, circuit);
    }
    
    circuit.failures++;
    circuit.lastFailureTime = now;
    
    if (circuit.failures >= this.circuitBreakerConfig.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = now + this.circuitBreakerConfig.resetTimeout;
      logger.warn(`Circuit breaker ${circuitKey} opened due to ${circuit.failures} failures`);
    }
  }

  /**
   * 记录错误统计
   */
  private recordError(error: Error, context: ErrorContext): void {
    const errorKey = `${context.service}:${error.name}:${error.message}`;
    const now = Date.now();
    
    let stats = this.errorStats.get(errorKey);
    if (!stats) {
      stats = {
        count: 0,
        lastOccurrence: now,
        pattern: this.extractErrorPattern(error)
      };
      this.errorStats.set(errorKey, stats);
    }
    
    stats.count++;
    stats.lastOccurrence = now;
    
    // 清理旧的错误统计
    this.cleanupOldStats();
  }

  /**
   * 提取错误模式
   */
  private extractErrorPattern(error: Error): string {
    const message = error.message;
    // 移除具体的数值、URL等，保留错误模式
    return message
      .replace(/\d+/g, 'N')
      .replace(/https?:\/\/[^\s]+/g, 'URL')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID');
  }

  /**
   * 清理旧的错误统计
   */
  private cleanupOldStats(): void {
    const now = Date.now();
    const maxAge = this.circuitBreakerConfig.monitoringWindow;
    
    for (const [key, stats] of this.errorStats.entries()) {
      if (now - stats.lastOccurrence > maxAge) {
        this.errorStats.delete(key);
      }
    }
  }

  /**
   * 执行降级策略
   */
  private async executeFallback<T>(
    fallback: FallbackStrategy | undefined,
    context: ErrorContext,
    error?: Error | null
  ): Promise<T> {
    if (!fallback) {
      const fallbackError = new Error(`Operation ${context.operation} failed and no fallback provided`);
      if (error) {
        fallbackError.cause = error;
      }
      throw fallbackError;
    }

    logger.info(`Executing fallback strategy (${fallback.type}) for ${context.operation}`);

    switch (fallback.type) {
      case 'default':
        return fallback.value as T;
        
      case 'alternative':
        if (fallback.alternativeFunction) {
          try {
            return await fallback.alternativeFunction();
          } catch (altError) {
            logger.error('Alternative function also failed:', altError);
            return fallback.value as T;
          }
        }
        return fallback.value as T;
        
      case 'cached':
        // 这里可以集成缓存系统
        logger.warn('Cached fallback not implemented, using default value');
        return fallback.value as T;
        
      case 'empty':
        return (fallback.value !== undefined ? fallback.value : null) as T;
        
      default:
        throw new Error(`Unknown fallback type: ${(fallback as any).type}`);
    }
  }

  /**
   * 获取错误统计报告
   */
  getErrorStats(): any {
    const now = Date.now();
    const stats = {
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([key, circuit]) => ({
        service: key,
        state: circuit.state,
        failures: circuit.failures,
        lastFailureTime: circuit.lastFailureTime,
        nextAttemptTime: circuit.nextAttemptTime
      })),
      errorPatterns: Array.from(this.errorStats.entries()).map(([key, stats]) => ({
        pattern: stats.pattern,
        count: stats.count,
        lastOccurrence: stats.lastOccurrence,
        ageMinutes: Math.round((now - stats.lastOccurrence) / 60000)
      })).sort((a, b) => b.count - a.count)
    };
    
    return stats;
  }

  /**
   * 重置所有熔断器
   */
  resetAllCircuitBreakers(): void {
    for (const [key, circuit] of this.circuitBreakers.entries()) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.nextAttemptTime = 0;
      logger.info(`Circuit breaker ${key} manually reset`);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(retryConfig?: Partial<RetryConfig>, circuitConfig?: Partial<CircuitBreakerConfig>): void {
    if (retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...retryConfig };
      logger.info('Retry configuration updated');
    }
    
    if (circuitConfig) {
      this.circuitBreakerConfig = { ...this.circuitBreakerConfig, ...circuitConfig };
      logger.info('Circuit breaker configuration updated');
    }
  }
}

export default RobustErrorHandler;
