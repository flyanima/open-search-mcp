/**
 * Rate Limiter
 * 
 * Manages rate limiting for Function Calling to ensure optimal
 * performance while respecting API limits and preventing abuse.
 */

import { Logger } from './logger.js';

interface RateLimitConfig {
  global: number;
  perEngine: number;
  perUser: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimitManager {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private logger: Logger;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.logger = new Logger('RateLimiter');
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async initialize(): Promise<void> {
    this.logger.info('Rate limiter initialized', {
      global: this.config.global,
      perEngine: this.config.perEngine,
      perUser: this.config.perUser,
    });
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(key: string, limit?: number): Promise<boolean> {
    const effectiveLimit = limit || this.getDefaultLimit(key);
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    
    let entry = this.limits.get(key);
    
    if (!entry) {
      // First request for this key
      entry = {
        count: 1,
        resetTime: now + windowMs,
        firstRequest: now,
      };
      this.limits.set(key, entry);
      return true;
    }

    // Check if window has expired
    if (now >= entry.resetTime) {
      // Reset the window
      entry.count = 1;
      entry.resetTime = now + windowMs;
      entry.firstRequest = now;
      return true;
    }

    // Check if under limit
    if (entry.count < effectiveLimit) {
      entry.count++;
      return true;
    }

    // Rate limit exceeded
    this.logger.logRateLimit(key, effectiveLimit, entry.count);
    return false;
  }

  /**
   * Get remaining requests for a key
   */
  async getRemainingRequests(key: string, limit?: number): Promise<number> {
    const effectiveLimit = limit || this.getDefaultLimit(key);
    const entry = this.limits.get(key);
    
    if (!entry) {
      return effectiveLimit;
    }

    const now = Date.now();
    if (now >= entry.resetTime) {
      return effectiveLimit;
    }

    return Math.max(0, effectiveLimit - entry.count);
  }

  /**
   * Get reset time for a key
   */
  async getResetTime(key: string): Promise<Date> {
    const entry = this.limits.get(key);
    
    if (!entry) {
      return new Date(Date.now() + 60000);
    }

    return new Date(entry.resetTime);
  }

  /**
   * Get current usage for a key
   */
  getCurrentUsage(key: string): { count: number; limit: number; remaining: number; resetTime: Date } {
    const limit = this.getDefaultLimit(key);
    const entry = this.limits.get(key);
    
    if (!entry) {
      return {
        count: 0,
        limit,
        remaining: limit,
        resetTime: new Date(Date.now() + 60000),
      };
    }

    const now = Date.now();
    if (now >= entry.resetTime) {
      return {
        count: 0,
        limit,
        remaining: limit,
        resetTime: new Date(now + 60000),
      };
    }

    return {
      count: entry.count,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetTime: new Date(entry.resetTime),
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key);
    this.logger.debug(`Rate limit reset for key: ${key}`);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.limits.clear();
    this.logger.info('All rate limits reset');
  }

  /**
   * Get all current rate limit states
   */
  getAllStates(): Record<string, { count: number; limit: number; remaining: number; resetTime: Date }> {
    const states: Record<string, any> = {};
    
    for (const key of this.limits.keys()) {
      states[key] = this.getCurrentUsage(key);
    }
    
    return states;
  }

  /**
   * Check if Function Calling batch is allowed
   */
  async checkBatchLimit(toolNames: string[], batchSize: number = 50): Promise<{
    allowed: boolean;
    allowedTools: string[];
    blockedTools: string[];
    retryAfter?: number;
  }> {
    const allowedTools: string[] = [];
    const blockedTools: string[] = [];
    let minRetryAfter = Infinity;

    // Check global limit first
    const globalAllowed = await this.checkLimit('global', this.config.global);
    if (!globalAllowed) {
      const resetTime = await this.getResetTime('global');
      return {
        allowed: false,
        allowedTools: [],
        blockedTools: toolNames,
        retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000),
      };
    }

    // Check each tool individually
    for (const toolName of toolNames.slice(0, batchSize)) {
      const engineKey = `engine:${this.extractEngine(toolName)}`;
      const toolKey = `tool:${toolName}`;
      
      const engineAllowed = await this.checkLimit(engineKey, this.config.perEngine);
      const toolAllowed = await this.checkLimit(toolKey, 10); // 10 requests per minute per tool
      
      if (engineAllowed && toolAllowed) {
        allowedTools.push(toolName);
      } else {
        blockedTools.push(toolName);
        
        // Calculate retry time
        const engineResetTime = await this.getResetTime(engineKey);
        const toolResetTime = await this.getResetTime(toolKey);
        const retryTime = Math.max(engineResetTime.getTime(), toolResetTime.getTime());
        minRetryAfter = Math.min(minRetryAfter, Math.ceil((retryTime - Date.now()) / 1000));
      }
    }

    return {
      allowed: allowedTools.length > 0,
      allowedTools,
      blockedTools,
      retryAfter: blockedTools.length > 0 ? minRetryAfter : undefined,
    };
  }

  /**
   * Optimize Function Calling for rate limits
   */
  optimizeFunctionCalling(toolNames: string[]): {
    batches: string[][];
    estimatedTime: number;
    recommendations: string[];
  } {
    const batches: string[][] = [];
    const recommendations: string[] = [];
    
    // Group tools by engine to distribute load
    const toolsByEngine = new Map<string, string[]>();
    for (const toolName of toolNames) {
      const engine = this.extractEngine(toolName);
      if (!toolsByEngine.has(engine)) {
        toolsByEngine.set(engine, []);
      }
      toolsByEngine.get(engine)!.push(toolName);
    }

    // Create balanced batches
    const batchSize = 50; // Optimal batch size for Function Calling
    let currentBatch: string[] = [];
    
    for (const [engine, tools] of toolsByEngine) {
      for (const tool of tools) {
        currentBatch.push(tool);
        
        if (currentBatch.length >= batchSize) {
          batches.push([...currentBatch]);
          currentBatch = [];
        }
      }
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Estimate execution time
    const estimatedTime = batches.length * 3; // 3 seconds per batch
    
    // Generate recommendations
    if (batches.length > 4) {
      recommendations.push('Consider reducing the number of tools for faster response');
    }
    
    if (toolsByEngine.size < 5) {
      recommendations.push('Consider using more diverse sources for better coverage');
    }

    return {
      batches,
      estimatedTime,
      recommendations,
    };
  }

  private getDefaultLimit(key: string): number {
    if (key === 'global') {
      return this.config.global;
    }
    
    if (key.startsWith('engine:')) {
      return this.config.perEngine;
    }
    
    if (key.startsWith('user:')) {
      return this.config.perUser;
    }
    
    if (key.startsWith('tool:')) {
      return 10; // Default tool limit
    }
    
    return 60; // Default fallback
  }

  private extractEngine(toolName: string): string {
    // Extract engine name from tool name
    // e.g., "search_arxiv_ai" -> "arxiv"
    const parts = toolName.split('_');
    if (parts.length >= 2) {
      return parts[1];
    }
    return 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit entries`);
    }
  }

  /**
   * Close rate limiter
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.limits.clear();
    this.logger.info('Rate limiter closed');
  }
}
