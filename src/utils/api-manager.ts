/**
 * 统一API管理框架
 * 提供重试机制、缓存、错误处理和监控功能
 */

import { Logger } from './logger.js';

interface APICallOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
}

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  retryCount?: number;
  responseTime?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

/**
 * API管理器类
 */
export class APIManager {
  private logger: Logger;
  private cache: Map<string, CacheEntry> = new Map();
  private rateLimits: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor() {
    this.logger = new Logger('APIManager');
    
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60000); // 每分钟清理一次
  }

  /**
   * 执行API调用，带重试和缓存机制
   */
  async callAPI<T>(
    apiFunction: () => Promise<T>,
    cacheKey: string,
    options: APICallOptions = {}
  ): Promise<APIResponse<T>> {
    const startTime = Date.now();
    const {
      retries = 3,
      retryDelay = 1000,
      timeout = 10000,
      cache = true,
      cacheTTL = 300000 // 5分钟默认缓存
    } = options;

    // 检查缓存
    if (cache) {
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return {
          success: true,
          data: cachedResult,
          cached: true,
          responseTime: Date.now() - startTime
        };
      }
    }

    // 检查速率限制
    if (this.isRateLimited(cacheKey)) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        responseTime: Date.now() - startTime
      };
    }

    let lastError: Error | null = null;
    let retryCount = 0;

    // 重试循环
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        const result = await Promise.race([
          apiFunction(),
          timeoutPromise
        ]);

        // 成功，缓存结果
        if (cache) {
          this.setCache(cacheKey, result, cacheTTL);
        }

        // 重置错误计数
        this.errorCounts.delete(cacheKey);

        return {
          success: true,
          data: result,
          cached: false,
          retryCount: attempt,
          responseTime: Date.now() - startTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        this.logger.warn(`API call failed (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`);

        // 记录错误
        this.incrementErrorCount(cacheKey);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < retries) {
          await this.delay(retryDelay * Math.pow(2, attempt)); // 指数退避
        }
      }
    }

    // 所有重试都失败了
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      retryCount,
      responseTime: Date.now() - startTime
    };
  }

  /**
   * 批量API调用
   */
  async callMultipleAPIs<T>(
    apiCalls: Array<{
      function: () => Promise<T>;
      cacheKey: string;
      options?: APICallOptions;
    }>,
    concurrent: boolean = true
  ): Promise<APIResponse<T>[]> {
    if (concurrent) {
      // 并发执行
      return await Promise.all(
        apiCalls.map(call => 
          this.callAPI(call.function, call.cacheKey, call.options)
        )
      );
    } else {
      // 顺序执行
      const results: APIResponse<T>[] = [];
      for (const call of apiCalls) {
        const result = await this.callAPI(call.function, call.cacheKey, call.options);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * 获取API健康状态
   */
  getAPIHealth(apiKey: string): {
    errorRate: number;
    lastError: number;
    isHealthy: boolean;
  } {
    const errorCount = this.errorCounts.get(apiKey) || 0;
    const lastError = this.rateLimits.get(apiKey) || 0;
    const errorRate = errorCount / 100; // 假设基于最近100次调用

    return {
      errorRate,
      lastError,
      isHealthy: errorRate < 0.1 && (Date.now() - lastError) > 60000 // 错误率<10%且最后错误>1分钟前
    };
  }

  /**
   * 清理所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('All cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // 需要实现命中率统计
      entries: Array.from(this.cache.keys())
    };
  }

  // 私有方法

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  private isRateLimited(key: string): boolean {
    const lastCall = this.rateLimits.get(key) || 0;
    const minInterval = 1000; // 最小间隔1秒

    if (Date.now() - lastCall < minInterval) {
      return true;
    }

    this.rateLimits.set(key, Date.now());
    return false;
  }

  private incrementErrorCount(key: string): void {
    const current = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, current + 1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 全局API管理器实例
export const apiManager = new APIManager();
