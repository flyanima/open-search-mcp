import { defaultLogger as logger } from './logger.js';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: number;
  newestEntry: number;
  averageAccessCount: number;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  evictionPolicy: 'lru' | 'lfu' | 'ttl'; // Eviction policy
}

/**
 * Advanced Cache Manager with multiple eviction policies and performance optimization
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      defaultTTL: 3600000, // 1 hour
      cleanupInterval: 300000, // 5 minutes
      evictionPolicy: 'lru',
      ...config
    };

    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  public set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;
    const size = this.calculateSize(value);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 1,
      lastAccessed: now,
      size
    };

    // Check if we need to evict entries
    this.ensureCapacity(size);

    this.cache.set(key, entry);
    
    logger.debug(`Cache set: ${key} (size: ${size} bytes, TTL: ${entryTTL}ms)`);
  }

  /**
   * Delete entry from cache
   */
  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache delete: ${key}`);
    }
    return deleted;
  }

  /**
   * Check if key exists in cache
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      evictionCount: this.stats.evictions,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0,
      averageAccessCount: entries.length > 0 ? entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length : 0
    };
  }

  /**
   * Get cache entries for debugging
   */
  public getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Optimize cache by removing expired entries and applying eviction policy
   */
  public optimize(): void {
    const beforeSize = this.cache.size;
    
    // Remove expired entries
    this.removeExpiredEntries();
    
    // Apply eviction policy if still over capacity
    this.applyEvictionPolicy();
    
    const afterSize = this.cache.size;
    const removed = beforeSize - afterSize;
    
    if (removed > 0) {
      logger.info(`Cache optimized: removed ${removed} entries`);
    }
  }

  /**
   * Generate cache key from parameters
   */
  public static generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    
    return `${prefix}:${Buffer.from(sortedParams).toString('base64')}`;
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Calculate size of value in bytes
   */
  private calculateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      // Fallback for non-serializable values
      return 1024; // 1KB estimate
    }
  }

  /**
   * Ensure cache has capacity for new entry
   */
  private ensureCapacity(newEntrySize: number): void {
    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries) {
      this.evictOne();
    }

    // Check size limit
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    while (currentSize + newEntrySize > this.config.maxSize && this.cache.size > 0) {
      this.evictOne();
    }
  }

  /**
   * Evict one entry based on eviction policy
   */
  private evictOne(): void {
    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.findLRUKey();
        break;
      case 'lfu':
        keyToEvict = this.findLFUKey();
        break;
      case 'ttl':
        keyToEvict = this.findOldestKey();
        break;
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.stats.evictions++;
      logger.debug(`Cache evicted: ${keyToEvict} (policy: ${this.config.evictionPolicy})`);
    }
  }

  /**
   * Find least recently used key
   */
  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Find least frequently used key
   */
  private findLFUKey(): string | null {
    let leastUsedKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  /**
   * Find oldest key by timestamp
   */
  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Remove expired entries
   */
  private removeExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      logger.debug(`Cache expired: ${key}`);
    });
  }

  /**
   * Apply eviction policy to maintain cache limits
   */
  private applyEvictionPolicy(): void {
    // Apply size-based eviction
    const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    
    while (currentSize > this.config.maxSize && this.cache.size > 0) {
      this.evictOne();
    }

    // Apply count-based eviction
    while (this.cache.size > this.config.maxEntries) {
      this.evictOne();
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.optimize();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Get cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  public updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.startCleanupTimer();
    }
    
    // Apply new limits immediately
    this.optimize();
    
    logger.info('Cache configuration updated', newConfig);
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager({
  maxSize: parseInt(process.env.CACHE_MAX_SIZE || '104857600'), // 100MB
  maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '10000'),
  defaultTTL: parseInt(process.env.CACHE_TTL || '3600000'), // 1 hour
  cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '300000'), // 5 minutes
  evictionPolicy: (process.env.CACHE_EVICTION_POLICY as 'lru' | 'lfu' | 'ttl') || 'lru'
});
