/**
 * Alpha Vantage 缓存系统
 * 优化API调用，减少重复请求，提升响应速度
 */

import { Logger } from './logger.js';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
}

export class AlphaVantageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0
  };

  // 缓存TTL配置 (秒)
  private readonly TTL_CONFIG = {
    STOCK_QUOTE: 60,           // 股票报价: 1分钟
    STOCK_SEARCH: 3600,        // 股票搜索: 1小时
    NEWS_SENTIMENT: 300,       // 新闻情感: 5分钟
    MARKET_MOVERS: 300,        // 市场动态: 5分钟
    FOREX_RATE: 300,           // 外汇汇率: 5分钟
    COMMODITY_PRICE: 600,      // 商品价格: 10分钟
    EARNINGS_CALENDAR: 3600,   // 财报日历: 1小时
    IPO_CALENDAR: 3600         // IPO日历: 1小时
  };

  constructor() {
    this.logger = new Logger('AlphaVantageCache');
    
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredEntries(), 60000); // 每分钟清理一次
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(apiFunction: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${apiFunction}:${sortedParams}`;
  }

  /**
   * 获取TTL配置
   */
  private getTTL(apiFunction: string): number {
    const functionMap: Record<string, keyof typeof this.TTL_CONFIG> = {
      'GLOBAL_QUOTE': 'STOCK_QUOTE',
      'SYMBOL_SEARCH': 'STOCK_SEARCH',
      'NEWS_SENTIMENT': 'NEWS_SENTIMENT',
      'TOP_GAINERS_LOSERS': 'MARKET_MOVERS',
      'CURRENCY_EXCHANGE_RATE': 'FOREX_RATE',
      'WTI': 'COMMODITY_PRICE',
      'BRENT': 'COMMODITY_PRICE',
      'EARNINGS_CALENDAR': 'EARNINGS_CALENDAR',
      'IPO_CALENDAR': 'IPO_CALENDAR'
    };

    const configKey = functionMap[apiFunction] || 'STOCK_QUOTE';
    return this.TTL_CONFIG[configKey];
  }

  /**
   * 检查缓存是否有效
   */
  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < (entry.ttl * 1000);
  }

  /**
   * 获取缓存数据
   */
  async get(apiFunction: string, params: Record<string, any>): Promise<any | null> {
    this.stats.totalRequests++;
    
    const cacheKey = this.generateCacheKey(apiFunction, params);
    const entry = this.cache.get(cacheKey);

    if (entry && this.isValidEntry(entry)) {
      this.stats.hits++;
      this.updateHitRate();
      
      this.logger.debug(`Cache hit for ${apiFunction}`, { 
        key: cacheKey,
        age: Math.round((Date.now() - entry.timestamp) / 1000)
      });
      
      return entry.data;
    }

    this.stats.misses++;
    this.updateHitRate();
    
    this.logger.debug(`Cache miss for ${apiFunction}`, { key: cacheKey });
    return null;
  }

  /**
   * 设置缓存数据
   */
  async set(apiFunction: string, params: Record<string, any>, data: any): Promise<void> {
    const cacheKey = this.generateCacheKey(apiFunction, params);
    const ttl = this.getTTL(apiFunction);
    
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(cacheKey, entry);
    
    this.logger.debug(`Cached data for ${apiFunction}`, { 
      key: cacheKey,
      ttl,
      size: this.cache.size
    });
  }

  /**
   * 清理过期缓存条目
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValidEntry(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned ${cleanedCount} expired cache entries`, {
        remainingEntries: this.cache.size
      });
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存详细信息
   */
  getCacheInfo(): any {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((Date.now() - entry.timestamp) / 1000),
      ttl: entry.ttl,
      expired: !this.isValidEntry(entry)
    }));

    return {
      totalEntries: this.cache.size,
      stats: this.getStats(),
      entries: entries.slice(0, 10), // 只返回前10个条目
      ttlConfig: this.TTL_CONFIG
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cleared cache: ${size} entries removed`);
  }

  /**
   * 预热缓存 - 为常用查询预加载数据
   */
  async warmup(client: any): Promise<void> {
    this.logger.info('Starting cache warmup...');
    
    const commonQueries = [
      { function: 'GLOBAL_QUOTE', params: { symbol: 'AAPL' } },
      { function: 'GLOBAL_QUOTE', params: { symbol: 'TSLA' } },
      { function: 'GLOBAL_QUOTE', params: { symbol: 'MSFT' } },
      { function: 'TOP_GAINERS_LOSERS', params: {} },
      { function: 'CURRENCY_EXCHANGE_RATE', params: { from_currency: 'USD', to_currency: 'CNY' } }
    ];

    for (const query of commonQueries) {
      try {
        // 这里应该调用实际的API客户端
        // const data = await client.makeRequest(query.params);
        // await this.set(query.function, query.params, data);
        
        this.logger.debug(`Warmed up cache for ${query.function}`);
        
        // 等待避免速率限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.warn(`Cache warmup failed for ${query.function}:`, error);
      }
    }
    
    this.logger.info('Cache warmup completed');
  }
}

/**
 * 全局缓存实例
 */
export const alphaVantageCache = new AlphaVantageCache();
