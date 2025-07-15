/**
 * 增强的速率限制管理器
 * 支持多种限制策略、自适应限制、重试机制和优先级队列
 */

import { Logger } from './logger.js';
import { getConfigManager } from '../config/enhanced-config-manager.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (identifier: string) => string;
  onLimitReached?: (identifier: string) => void;
  enableAdaptive: boolean;
  adaptiveThreshold: number;
  burstAllowance: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastRequest: number;
  successCount: number;
  failureCount: number;
  adaptiveMultiplier: number;
  burstUsed: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: any, attempt: number) => boolean;
}

export interface QueuedRequest {
  id: string;
  identifier: string;
  priority: number;
  timestamp: number;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
}

export class EnhancedRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private processingQueue: boolean = false;
  private config: RateLimitConfig;
  private logger: Logger;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<RateLimitConfig>) {
    this.logger = new Logger('RateLimiter');
    
    const configManager = getConfigManager();
    const defaultConfig: RateLimitConfig = {
      windowMs: configManager.get('rateLimit.windowMs', 60000),
      maxRequests: configManager.get('rateLimit.maxRequests', 100),
      skipSuccessfulRequests: configManager.get('rateLimit.skipSuccessfulRequests', false),
      skipFailedRequests: false,
      enableAdaptive: true,
      adaptiveThreshold: 0.8, // 80%成功率阈值
      burstAllowance: 10 // 允许突发10个请求
    };

    this.config = { ...defaultConfig, ...config };
    this.startCleanupTimer();
    
    this.logger.info('Enhanced rate limiter initialized', {
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
      enableAdaptive: this.config.enableAdaptive
    });
  }

  /**
   * 检查是否允许请求
   */
  public async checkLimit(identifier: string, priority: number = 1): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      // 添加到队列
      this.requestQueue.push({
        id: requestId,
        identifier,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      });

      // 按优先级排序队列
      this.requestQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

      // 处理队列
      this.processQueue();
    });
  }

  /**
   * 处理请求队列
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        const allowed = await this.checkLimitInternal(request.identifier);
        request.resolve(allowed);
        
        if (!allowed) {
          // 如果被限制，延迟一段时间再处理下一个请求
          await this.sleep(100);
        }
      } catch (error) {
        request.reject(error as Error);
      }
    }

    this.processingQueue = false;
  }

  /**
   * 内部限制检查
   */
  private async checkLimitInternal(identifier: string): Promise<boolean> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    let entry = this.limits.get(key);
    
    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        lastRequest: now,
        successCount: 0,
        failureCount: 0,
        adaptiveMultiplier: 1.0,
        burstUsed: 0
      };
      this.limits.set(key, entry);
    }

    // 检查是否需要重置窗口
    if (now >= entry.resetTime) {
      this.resetWindow(entry, now);
    }

    // 计算当前限制
    const currentLimit = this.calculateCurrentLimit(entry);
    
    // 检查是否可以使用突发配额
    const canUseBurst = entry.burstUsed < this.config.burstAllowance;

    if (entry.count >= currentLimit) {
      if (canUseBurst) {
        entry.burstUsed++;
        entry.count++; // 突发请求也要计数
        entry.lastRequest = now;
        this.logger.debug(`Burst allowance used for ${identifier}`, {
          burstUsed: entry.burstUsed,
          burstAllowance: this.config.burstAllowance
        });
        return true;
      } else {
        this.logger.warn(`Rate limit exceeded for ${identifier}`, {
          count: entry.count,
          limit: currentLimit,
          window: this.config.windowMs
        });

        if (this.config.onLimitReached) {
          this.config.onLimitReached(identifier);
        }

        return false;
      }
    }

    entry.count++;
    entry.lastRequest = now;
    
    return true;
  }

  /**
   * 记录请求结果
   */
  public recordResult(identifier: string, success: boolean): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.limits.get(key);
    
    if (!entry) return;

    if (success) {
      entry.successCount++;
      if (this.config.skipSuccessfulRequests) {
        entry.count = Math.max(0, entry.count - 1);
      }
    } else {
      entry.failureCount++;
      if (this.config.skipFailedRequests) {
        entry.count = Math.max(0, entry.count - 1);
      }
    }

    // 更新自适应乘数
    if (this.config.enableAdaptive) {
      this.updateAdaptiveMultiplier(entry);
    }
  }

  /**
   * 计算当前限制
   */
  private calculateCurrentLimit(entry: RateLimitEntry): number {
    let limit = this.config.maxRequests;
    
    if (this.config.enableAdaptive) {
      limit = Math.floor(limit * entry.adaptiveMultiplier);
    }
    
    return Math.max(1, limit); // 至少允许1个请求
  }

  /**
   * 更新自适应乘数
   */
  private updateAdaptiveMultiplier(entry: RateLimitEntry): void {
    const totalRequests = entry.successCount + entry.failureCount;
    
    if (totalRequests < 10) return; // 需要足够的样本

    const successRate = entry.successCount / totalRequests;
    
    if (successRate >= this.config.adaptiveThreshold) {
      // 成功率高，可以适当放宽限制
      entry.adaptiveMultiplier = Math.min(2.0, entry.adaptiveMultiplier * 1.1);
    } else {
      // 成功率低，收紧限制
      entry.adaptiveMultiplier = Math.max(0.5, entry.adaptiveMultiplier * 0.9);
    }
  }

  /**
   * 重置窗口
   */
  private resetWindow(entry: RateLimitEntry, now: number): void {
    entry.count = 0;
    entry.resetTime = now + this.config.windowMs;
    entry.burstUsed = 0;
    
    // 重置统计（保留一些历史信息）
    entry.successCount = Math.floor(entry.successCount * 0.8);
    entry.failureCount = Math.floor(entry.failureCount * 0.8);
  }

  /**
   * 获取剩余请求数
   */
  public getRemainingRequests(identifier: string): number {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.limits.get(key);

    if (!entry) {
      return this.config.maxRequests + this.config.burstAllowance;
    }

    const now = Date.now();
    if (now >= entry.resetTime) {
      return this.config.maxRequests + this.config.burstAllowance;
    }

    const currentLimit = this.calculateCurrentLimit(entry);
    const remainingNormal = Math.max(0, currentLimit - entry.count);
    const remainingBurst = Math.max(0, this.config.burstAllowance - entry.burstUsed);

    return remainingNormal + remainingBurst;
  }

  /**
   * 获取重置时间
   */
  public getResetTime(identifier: string): number {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.limits.get(key);
    
    return entry ? entry.resetTime : Date.now();
  }

  /**
   * 获取统计信息
   */
  public getStats(identifier?: string): any {
    if (identifier) {
      const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
      const entry = this.limits.get(key);
      
      if (!entry) {
        return null;
      }

      return {
        identifier,
        count: entry.count,
        remaining: this.getRemainingRequests(identifier),
        resetTime: entry.resetTime,
        successRate: entry.successCount / Math.max(1, entry.successCount + entry.failureCount),
        adaptiveMultiplier: entry.adaptiveMultiplier,
        burstUsed: entry.burstUsed
      };
    }

    // 全局统计
    const totalEntries = this.limits.size;
    const totalRequests = Array.from(this.limits.values())
      .reduce((sum, entry) => sum + entry.count, 0);
    
    return {
      totalEntries,
      totalRequests,
      queueLength: this.requestQueue.length,
      averageSuccessRate: this.calculateAverageSuccessRate()
    };
  }

  /**
   * 计算平均成功率
   */
  private calculateAverageSuccessRate(): number {
    const entries = Array.from(this.limits.values());
    if (entries.length === 0) return 1.0;

    const totalSuccess = entries.reduce((sum, entry) => sum + entry.successCount, 0);
    const totalRequests = entries.reduce((sum, entry) => sum + entry.successCount + entry.failureCount, 0);
    
    return totalRequests > 0 ? totalSuccess / totalRequests : 1.0;
  }

  /**
   * 清理过期条目
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.limits.entries()) {
      // 如果条目超过2个窗口期没有活动，则删除
      if (now - entry.lastRequest > this.config.windowMs * 2) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.limits.delete(key);
    });

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.windowMs);
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.limits.clear();
    this.requestQueue.length = 0;
    this.logger.info('Enhanced rate limiter cleaned up');
  }
}

/**
 * 重试机制管理器
 */
export class RetryManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RetryManager');
  }

  /**
   * 执行带重试的操作
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const defaultConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error, attempt) => {
        // 默认重试条件：网络错误、超时、5xx错误
        if (error.code === 'ECONNRESET' || 
            error.code === 'ETIMEDOUT' || 
            error.code === 'ENOTFOUND') {
          return true;
        }
        
        if (error.response && error.response.status >= 500) {
          return true;
        }
        
        // 429 Too Many Requests - 速率限制
        if (error.response && error.response.status === 429) {
          return true;
        }
        
        return false;
      }
    };

    const finalConfig = { ...defaultConfig, ...config };
    let lastError: any;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          this.logger.info(`Operation succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === finalConfig.maxRetries) {
          this.logger.error(`Operation failed after ${finalConfig.maxRetries} retries:`, error);
          break;
        }

        if (finalConfig.retryCondition && !finalConfig.retryCondition(error, attempt)) {
          this.logger.warn('Retry condition not met, stopping retries:', error);
          break;
        }

        const delay = this.calculateDelay(attempt, finalConfig);
        this.logger.warn(`Operation failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error);
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    
    // 应用最大延迟限制
    delay = Math.min(delay, config.maxDelay);
    
    // 添加抖动
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 单例实例
let rateLimiterInstance: EnhancedRateLimiter | null = null;
let retryManagerInstance: RetryManager | null = null;

export function getRateLimiter(): EnhancedRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new EnhancedRateLimiter();
  }
  return rateLimiterInstance;
}

export function getRetryManager(): RetryManager {
  if (!retryManagerInstance) {
    retryManagerInstance = new RetryManager();
  }
  return retryManagerInstance;
}

export function resetRateLimiter(): void {
  if (rateLimiterInstance) {
    rateLimiterInstance.cleanup();
    rateLimiterInstance = null;
  }
}
