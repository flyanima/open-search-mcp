/**
 * 增强的重试机制
 * 提供可配置的重试策略，支持指数退避、自定义条件和超时
 */

import { ErrorHandler } from './error-handler.js';
import { Logger } from './logger.js';

export interface RetryOptions {
  // 最大重试次数
  maxRetries?: number;
  
  // 初始重试延迟（毫秒）
  initialDelay?: number;
  
  // 退避乘数（每次重试后延迟时间乘以此值）
  backoffMultiplier?: number;
  
  // 最大延迟时间（毫秒）
  maxDelay?: number;
  
  // 操作超时时间（毫秒）
  timeout?: number;
  
  // 自定义重试条件
  retryCondition?: (error: any) => boolean;
  
  // 是否记录重试日志
  logRetries?: boolean;
  
  // 重试前回调函数
  onRetry?: (attempt: number, delay: number, error: any) => void;
}

export interface RetryContext {
  // 操作名称
  operation: string;
  
  // 数据源
  source: string;
  
  // 操作参数
  args?: any;
  
  // 操作开始时间
  startTime?: number;
}

export class RetryMechanism {
  private logger: Logger;
  private errorHandler: ErrorHandler;
  
  constructor(logger: Logger, errorHandler: ErrorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
  }
  
  /**
   * 使用重试机制执行操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      backoffMultiplier = 2,
      maxDelay = 30000,
      timeout,
      retryCondition = this.defaultRetryCondition,
      logRetries = true,
      onRetry
    } = options;
    
    let attempt = 0;
    let lastError: any;
    let delay = initialDelay;
    
    const startTime = Date.now();
    context.startTime = startTime;
    
    while (attempt <= maxRetries) {
      try {
        // 如果设置了超时，使用超时包装操作
        const result = timeout
          ? await this.executeWithTimeout(operation, timeout)
          : await operation();
        
        // 如果不是第一次尝试，记录成功重试
        if (attempt > 0 && logRetries) {
          this.logger.info(
            `Operation '${context.operation}' succeeded after ${attempt} retries`,
            { source: context.source, attempt, duration: Date.now() - startTime }
          );
        }
        
        return result;
      } catch (error) {
        lastError = error;
        attempt++;
        
        // 如果达到最大重试次数，抛出错误
        if (attempt > maxRetries) {
          if (logRetries) {
            this.logger.error(
              `Operation '${context.operation}' failed after ${maxRetries} retries`,
              { 
                source: context.source, 
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime
              }
            );
          }
          throw error;
        }
        
        // 检查是否应该重试
        if (!retryCondition(error)) {
          if (logRetries) {
            this.logger.warn(
              `Operation '${context.operation}' failed with non-retryable error`,
              { 
                source: context.source, 
                error: error instanceof Error ? error.message : String(error),
                attempt
              }
            );
          }
          throw error;
        }
        
        // 计算下一次重试延迟
        delay = Math.min(delay * backoffMultiplier, maxDelay);
        
        // 记录重试信息
        if (logRetries) {
          this.logger.warn(
            `Retrying operation '${context.operation}' (attempt ${attempt}/${maxRetries}) after ${delay}ms`,
            { 
              source: context.source, 
              error: error instanceof Error ? error.message : String(error),
              attempt,
              delay
            }
          );
        }
        
        // 执行重试回调
        if (onRetry) {
          onRetry(attempt, delay, error);
        }
        
        // 等待后重试
        await this.delay(delay);
      }
    }
    
    // 这里不应该到达，但为了类型安全
    throw lastError;
  }
  
  /**
   * 使用超时执行操作
   */
  private executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      operation()
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
  
  /**
   * 默认重试条件
   */
  private defaultRetryCondition(error: any): boolean {
    // 网络错误应该重试
    if (error.code && ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) {
      return true;
    }
    
    // 超时错误应该重试
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }
    
    // HTTP 5xx 错误应该重试
    if (error.response && error.response.status >= 500 && error.response.status < 600) {
      return true;
    }
    
    // 429 Too Many Requests 应该重试
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    // 其他错误不重试
    return false;
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 创建针对特定API的重试配置
   */
  createApiRetryConfig(apiName: string): RetryOptions {
    // 为不同API定制重试策略
    switch (apiName.toLowerCase()) {
      case 'arxiv':
        return {
          maxRetries: 5,
          initialDelay: 2000,
          backoffMultiplier: 2,
          maxDelay: 30000,
          timeout: 20000
        };
        
      case 'pubmed':
        return {
          maxRetries: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 10000,
          timeout: 15000
        };
        
      case 'github':
        return {
          maxRetries: 2,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 5000,
          timeout: 10000,
          // GitHub API有特定的重试条件
          retryCondition: (error) => {
            // 对于GitHub API，只有5xx错误和429错误才重试
            if (error.response) {
              return error.response.status >= 500 || error.response.status === 429;
            }
            return this.defaultRetryCondition(error);
          }
        };
        
      case 'searx':
        return {
          maxRetries: 4,
          initialDelay: 1000,
          backoffMultiplier: 1.5,
          maxDelay: 10000,
          timeout: 20000
        };
        
      // 默认配置
      default:
        return {
          maxRetries: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 15000,
          timeout: 15000
        };
    }
  }
}
