/**
 * 智能缓存系统 - 多层缓存架构
 */

import NodeCache from 'node-cache';
import { SearchResult } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  local?: {
    enabled: boolean;
    maxKeys: number;
    ttl: number;
  };
  redis?: {
    enabled: boolean;
    host: string;
    port: number;
    ttl: number;
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

export class IntelligentCache {
  private config: CacheConfig;
  private logger: Logger;
  private localCache: NodeCache;
  private stats: CacheStats;

  constructor(config: CacheConfig) {
    this.config = config;
    this.logger = new Logger('IntelligentCache');
    
    // 初始化本地缓存
    this.localCache = new NodeCache({
      stdTTL: config.local?.ttl || config.ttl,
      maxKeys: config.local?.maxKeys || config.maxSize,
      checkperiod: 120, // 每2分钟检查过期键
      useClones: false // 提高性能
    });

    // 初始化统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0
    };

    this.setupCacheEvents();
    this.logger.info('Intelligent cache initialized');
  }

  /**
   * 获取缓存数据
   */
  async get(key: string): Promise<SearchResult[] | null> {
    if (!this.config.enabled) return null;

    try {
      // 1. 尝试本地缓存
      const localResult = this.localCache.get<SearchResult[]>(key);
      if (localResult) {
        this.recordHit();
        this.logger.debug(`Local cache hit for key: ${key}`);
        return localResult;
      }

      // 2. 如果启用了Redis，尝试Redis缓存
      if (this.config.redis?.enabled) {
        const redisResult = await this.getFromRedis(key);
        if (redisResult) {
          // 回填本地缓存
          this.localCache.set(key, redisResult);
          this.recordHit();
          this.logger.debug(`Redis cache hit for key: ${key}`);
          return redisResult;
        }
      }

      this.recordMiss();
      return null;

    } catch (error) {
      this.logger.error('Cache get error:', error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  async set(key: string, value: SearchResult[]): Promise<void> {
    if (!this.config.enabled || !value || value.length === 0) return;

    try {
      // 计算TTL
      const ttl = this.calculateTTL(key, value);

      // 1. 设置本地缓存
      this.localCache.set(key, value, ttl.local);

      // 2. 如果启用了Redis，设置Redis缓存
      if (this.config.redis?.enabled) {
        await this.setToRedis(key, value, ttl.redis);
      }

      this.updateStats();
      this.logger.debug(`Cached ${value.length} results for key: ${key}`);

    } catch (error) {
      this.logger.error('Cache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      this.localCache.del(key);
      
      if (this.config.redis?.enabled) {
        await this.deleteFromRedis(key);
      }

      this.logger.debug(`Deleted cache for key: ${key}`);
    } catch (error) {
      this.logger.error('Cache delete error:', error);
    }
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    try {
      this.localCache.flushAll();
      
      if (this.config.redis?.enabled) {
        await this.clearRedis();
      }

      this.resetStats();
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  /**
   * 计算TTL
   */
  private calculateTTL(key: string, value: SearchResult[]): { local: number; redis: number } {
    let baseTTL = this.config.ttl;

    // 根据内容类型调整TTL
    const hasNews = value.some(result => 
      result.source?.includes('news') || 
      result.url?.includes('news')
    );

    const hasAcademic = value.some(result => 
      result.source?.includes('arxiv') || 
      result.source?.includes('pubmed')
    );

    if (hasNews) {
      baseTTL = Math.min(baseTTL, 1800); // 新闻内容30分钟
    } else if (hasAcademic) {
      baseTTL = Math.max(baseTTL, 7200); // 学术内容2小时
    }

    return {
      local: baseTTL,
      redis: baseTTL * 2 // Redis缓存时间更长
    };
  }

  /**
   * Redis操作方法（占位符）
   */
  private async getFromRedis(key: string): Promise<SearchResult[] | null> {
    // TODO: 实现Redis获取逻辑
    return null;
  }

  private async setToRedis(key: string, value: SearchResult[], ttl: number): Promise<void> {
    // TODO: 实现Redis设置逻辑
  }

  private async deleteFromRedis(key: string): Promise<void> {
    // TODO: 实现Redis删除逻辑
  }

  private async clearRedis(): Promise<void> {
    // TODO: 实现Redis清空逻辑
  }

  /**
   * 设置缓存事件监听
   */
  private setupCacheEvents(): void {
    this.localCache.on('expired', (key, value) => {
      this.logger.debug(`Cache key expired: ${key}`);
    });

    this.localCache.on('del', (key, value) => {
      this.logger.debug(`Cache key deleted: ${key}`);
    });
  }

  /**
   * 记录缓存命中
   */
  private recordHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  /**
   * 记录缓存未命中
   */
  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalKeys = this.localCache.keys().length;
    this.stats.memoryUsage = process.memoryUsage().heapUsed;
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0
    };
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取缓存键列表
   */
  getKeys(): string[] {
    return this.localCache.keys();
  }

  /**
   * 关闭缓存
   */
  async close(): Promise<void> {
    this.localCache.close();
    // TODO: 关闭Redis连接
    this.logger.info('Cache closed');
  }
}
