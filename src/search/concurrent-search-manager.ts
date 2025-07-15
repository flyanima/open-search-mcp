/**
 * Concurrent Search Manager - 并发搜索管理器
 * 
 * 核心功能：
 * - 多搜索引擎并发查询
 * - 结果聚合和去重
 * - 负载均衡和故障转移
 * - 性能监控和优化
 * - 缓存管理
 */

import { Logger } from '../utils/logger.js';
import { QueryExpansionEngine, ExpansionResult } from './query-expansion-engine.js';
import { EventEmitter } from 'events';

/**
 * 搜索引擎类型枚举
 */
export enum SearchEngineType {
  ACADEMIC = 'academic',
  WEB = 'web',
  NEWS = 'news',
  SOCIAL = 'social',
  TECHNICAL = 'technical',
  MULTIMEDIA = 'multimedia'
}

/**
 * 搜索引擎配置接口
 */
export interface SearchEngineConfig {
  id: string;
  name: string;
  type: SearchEngineType;
  endpoint?: string;
  priority: number;
  timeout: number;
  maxRetries: number;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  isEnabled: boolean;
  healthCheck: {
    url?: string;
    interval: number;
    timeout: number;
  };
}

/**
 * 搜索请求接口
 */
export interface SearchRequest {
  id: string;
  query: string;
  engines: string[];
  options: {
    maxResults: number;
    timeout: number;
    enableExpansion: boolean;
    expansionConfig?: any;
    filters?: {
      dateRange?: { start: Date; end: Date };
      language?: string;
      domain?: string;
      type?: string;
    };
  };
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  engine: string;
  score: number;
  timestamp: Date;
  metadata: {
    type?: string;
    author?: string;
    publishDate?: Date;
    language?: string;
    domain?: string;
  };
}

/**
 * 聚合搜索结果接口
 */
export interface AggregatedSearchResult {
  requestId: string;
  originalQuery: string;
  expandedQueries?: string[];
  results: SearchResult[];
  metadata: {
    totalResults: number;
    enginesUsed: string[];
    processingTime: number;
    cacheHit: boolean;
    duplicatesRemoved: number;
    averageScore: number;
  };
  performance: {
    engineTimes: Record<string, number>;
    slowestEngine: string;
    fastestEngine: string;
    failedEngines: string[];
  };
}

/**
 * 并发搜索管理器类
 */
export class ConcurrentSearchManager extends EventEmitter {
  private logger: Logger;
  private engines: Map<string, SearchEngineConfig> = new Map();
  private queryExpansion: QueryExpansionEngine;
  private cache: Map<string, AggregatedSearchResult> = new Map();
  private rateLimiters: Map<string, { requests: number; resetTime: number }> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private activeRequests: Map<string, AbortController> = new Map();

  constructor() {
    super();
    this.logger = new Logger('ConcurrentSearchManager');
    this.queryExpansion = new QueryExpansionEngine();
    this.initializeEngines();
    this.startHealthChecks();
  }

  /**
   * 执行并发搜索
   */
  async search(request: SearchRequest): Promise<AggregatedSearchResult> {
    const startTime = Date.now();
    this.logger.info(`Starting concurrent search for: "${request.query}"`);

    // 检查缓存
    const cacheKey = this.generateCacheKey(request);
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      this.logger.debug(`Cache hit for query: ${request.query}`);
      return { ...cachedResult, metadata: { ...cachedResult.metadata, cacheHit: true } };
    }

    // 查询扩展
    let expandedQueries: string[] = [request.query];
    if (request.options.enableExpansion) {
      const expansionResult = await this.queryExpansion.expandQuery(
        request.query,
        request.options.expansionConfig
      );
      expandedQueries = expansionResult.expandedQueries.map(eq => eq.query);
    }

    // 选择可用的搜索引擎
    const availableEngines = this.selectAvailableEngines(request.engines);
    if (availableEngines.length === 0) {
      throw new Error('No available search engines');
    }

    // 创建并发搜索任务
    const searchTasks = this.createSearchTasks(request, expandedQueries, availableEngines);
    
    // 执行并发搜索
    const searchResults = await this.executeSearchTasks(searchTasks, request.options.timeout);
    
    // 聚合和处理结果
    const aggregatedResult = this.aggregateResults(
      request,
      expandedQueries,
      searchResults,
      startTime
    );

    // 缓存结果
    this.cache.set(cacheKey, aggregatedResult);
    
    // 清理过期缓存
    this.cleanupCache();

    this.logger.info(`Concurrent search completed in ${aggregatedResult.metadata.processingTime}ms`);
    this.emit('searchCompleted', aggregatedResult);

    return aggregatedResult;
  }

  /**
   * 选择可用的搜索引擎
   */
  private selectAvailableEngines(requestedEngines: string[]): SearchEngineConfig[] {
    const available: SearchEngineConfig[] = [];
    
    for (const engineId of requestedEngines) {
      const engine = this.engines.get(engineId);
      if (engine && engine.isEnabled && this.healthStatus.get(engineId)) {
        if (this.checkRateLimit(engineId)) {
          available.push(engine);
        }
      }
    }
    
    // 按优先级排序
    return available.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 创建搜索任务
   */
  private createSearchTasks(
    request: SearchRequest,
    queries: string[],
    engines: SearchEngineConfig[]
  ): Array<{ engine: SearchEngineConfig; query: string; controller: AbortController }> {
    const tasks: Array<{ engine: SearchEngineConfig; query: string; controller: AbortController }> = [];
    
    for (const engine of engines) {
      for (const query of queries.slice(0, 3)) { // 限制每个引擎最多3个查询
        const controller = new AbortController();
        tasks.push({ engine, query, controller });
      }
    }
    
    return tasks;
  }

  /**
   * 执行搜索任务
   */
  private async executeSearchTasks(
    tasks: Array<{ engine: SearchEngineConfig; query: string; controller: AbortController }>,
    timeout: number
  ): Promise<Array<{ engine: string; query: string; results: SearchResult[]; time: number; error?: string }>> {
    const results: Array<{ engine: string; query: string; results: SearchResult[]; time: number; error?: string }> = [];
    
    // 设置全局超时
    const globalTimeout = setTimeout(() => {
      tasks.forEach(task => task.controller.abort());
    }, timeout);

    try {
      const promises = tasks.map(async (task) => {
        const startTime = Date.now();
        
        try {
          const searchResults = await this.executeEngineSearch(
            task.engine,
            task.query,
            task.controller.signal
          );
          
          const executionTime = Date.now() - startTime;
          this.updateRateLimit(task.engine.id);
          
          return {
            engine: task.engine.id,
            query: task.query,
            results: searchResults,
            time: executionTime
          };
        } catch (error) {
          const executionTime = Date.now() - startTime;
          this.logger.warn(`Search failed for engine ${task.engine.id}: ${error}`);
          
          return {
            engine: task.engine.id,
            query: task.query,
            results: [],
            time: executionTime,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const settledResults = await Promise.allSettled(promises);
      
      for (const result of settledResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    } finally {
      clearTimeout(globalTimeout);
    }

    return results;
  }

  /**
   * 执行单个引擎搜索
   */
  private async executeEngineSearch(
    engine: SearchEngineConfig,
    query: string,
    signal: AbortSignal
  ): Promise<SearchResult[]> {
    // 模拟搜索引擎调用
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const mockResults: SearchResult[] = [
          {
            id: `${engine.id}_${Date.now()}_1`,
            title: `${query} - 搜索结果1`,
            url: `https://example.com/result1?q=${encodeURIComponent(query)}`,
            snippet: `这是关于"${query}"的详细信息和分析...`,
            source: engine.name,
            engine: engine.id,
            score: Math.random() * 0.3 + 0.7, // 0.7-1.0
            timestamp: new Date(),
            metadata: {
              type: engine.type,
              language: 'zh-CN',
              domain: 'example.com'
            }
          },
          {
            id: `${engine.id}_${Date.now()}_2`,
            title: `${query} - 深度分析`,
            url: `https://example.com/result2?q=${encodeURIComponent(query)}`,
            snippet: `深入探讨"${query}"的各个方面和应用...`,
            source: engine.name,
            engine: engine.id,
            score: Math.random() * 0.3 + 0.6, // 0.6-0.9
            timestamp: new Date(),
            metadata: {
              type: engine.type,
              language: 'zh-CN',
              domain: 'example.com'
            }
          }
        ];
        
        resolve(mockResults);
      }, Math.random() * 1000 + 500); // 500-1500ms 模拟网络延迟

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Search aborted'));
      });
    });
  }

  /**
   * 聚合搜索结果
   */
  private aggregateResults(
    request: SearchRequest,
    expandedQueries: string[],
    searchResults: Array<{ engine: string; query: string; results: SearchResult[]; time: number; error?: string }>,
    startTime: number
  ): AggregatedSearchResult {
    // 合并所有结果
    const allResults: SearchResult[] = [];
    const engineTimes: Record<string, number> = {};
    const enginesUsed: string[] = [];
    const failedEngines: string[] = [];

    for (const result of searchResults) {
      if (result.error) {
        failedEngines.push(result.engine);
      } else {
        allResults.push(...result.results);
        if (!enginesUsed.includes(result.engine)) {
          enginesUsed.push(result.engine);
        }
      }
      
      engineTimes[result.engine] = (engineTimes[result.engine] || 0) + result.time;
    }

    // 去重
    const uniqueResults = this.deduplicateResults(allResults);
    const duplicatesRemoved = allResults.length - uniqueResults.length;

    // 排序和限制结果数量
    const sortedResults = uniqueResults
      .sort((a, b) => b.score - a.score)
      .slice(0, request.options.maxResults);

    // 计算性能指标
    const processingTime = Date.now() - startTime;
    const averageScore = sortedResults.reduce((sum, r) => sum + r.score, 0) / sortedResults.length;
    
    const engineTimeEntries = Object.entries(engineTimes);
    const slowestEngine = engineTimeEntries.reduce((max, [engine, time]) => 
      time > engineTimes[max] ? engine : max, engineTimeEntries[0]?.[0] || ''
    );
    const fastestEngine = engineTimeEntries.reduce((min, [engine, time]) => 
      time < engineTimes[min] ? engine : min, engineTimeEntries[0]?.[0] || ''
    );

    return {
      requestId: request.id,
      originalQuery: request.query,
      expandedQueries: expandedQueries.length > 1 ? expandedQueries : undefined,
      results: sortedResults,
      metadata: {
        totalResults: sortedResults.length,
        enginesUsed,
        processingTime,
        cacheHit: false,
        duplicatesRemoved,
        averageScore
      },
      performance: {
        engineTimes,
        slowestEngine,
        fastestEngine,
        failedEngines
      }
    };
  }

  /**
   * 去重搜索结果
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      // 使用URL和标题的组合作为去重键
      const key = `${result.url}|${result.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(engineId: string): boolean {
    const engine = this.engines.get(engineId);
    if (!engine) return false;

    const now = Date.now();
    const limiter = this.rateLimiters.get(engineId);

    if (!limiter || now > limiter.resetTime) {
      this.rateLimiters.set(engineId, {
        requests: 0,
        resetTime: now + 60000 // 1分钟
      });
      return true;
    }

    return limiter.requests < engine.rateLimit.requestsPerMinute;
  }

  /**
   * 更新速率限制
   */
  private updateRateLimit(engineId: string): void {
    const limiter = this.rateLimiters.get(engineId);
    if (limiter) {
      limiter.requests++;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: SearchRequest): string {
    const key = {
      query: request.query,
      engines: request.engines.sort(),
      options: request.options
    };
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const maxAge = 30 * 60 * 1000; // 30分钟
    const now = Date.now();

    for (const [key, result] of this.cache.entries()) {
      if (now - result.metadata.processingTime > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 初始化搜索引擎
   */
  private initializeEngines(): void {
    const engines: SearchEngineConfig[] = [
      {
        id: 'duckduckgo',
        name: 'DuckDuckGo',
        type: SearchEngineType.WEB,
        priority: 8,
        timeout: 5000,
        maxRetries: 2,
        rateLimit: { requestsPerMinute: 60, burstLimit: 10 },
        isEnabled: true,
        healthCheck: { interval: 60000, timeout: 3000 }
      },
      {
        id: 'arxiv',
        name: 'arXiv',
        type: SearchEngineType.ACADEMIC,
        priority: 9,
        timeout: 8000,
        maxRetries: 3,
        rateLimit: { requestsPerMinute: 30, burstLimit: 5 },
        isEnabled: true,
        healthCheck: { interval: 120000, timeout: 5000 }
      },
      {
        id: 'github',
        name: 'GitHub',
        type: SearchEngineType.TECHNICAL,
        priority: 7,
        timeout: 6000,
        maxRetries: 2,
        rateLimit: { requestsPerMinute: 40, burstLimit: 8 },
        isEnabled: true,
        healthCheck: { interval: 90000, timeout: 4000 }
      },
      {
        id: 'techcrunch',
        name: 'TechCrunch',
        type: SearchEngineType.NEWS,
        priority: 6,
        timeout: 4000,
        maxRetries: 2,
        rateLimit: { requestsPerMinute: 50, burstLimit: 10 },
        isEnabled: true,
        healthCheck: { interval: 60000, timeout: 3000 }
      }
    ];

    for (const engine of engines) {
      this.engines.set(engine.id, engine);
      this.healthStatus.set(engine.id, true); // 假设初始状态健康
    }

    this.logger.info(`Initialized ${engines.length} search engines`);
  }

  /**
   * 启动健康检查
   */
  private startHealthChecks(): void {
    for (const [engineId, engine] of this.engines.entries()) {
      setInterval(() => {
        this.performHealthCheck(engineId, engine);
      }, engine.healthCheck.interval);
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(engineId: string, engine: SearchEngineConfig): Promise<void> {
    try {
      // 模拟健康检查
      const isHealthy = Math.random() > 0.1; // 90% 健康率
      this.healthStatus.set(engineId, isHealthy);
      
      if (!isHealthy) {
        this.logger.warn(`Health check failed for engine: ${engineId}`);
        this.emit('engineUnhealthy', engineId);
      }
    } catch (error) {
      this.healthStatus.set(engineId, false);
      this.logger.error(`Health check error for engine ${engineId}:`, error);
    }
  }

  /**
   * 获取引擎状态
   */
  getEngineStatus(): Record<string, { enabled: boolean; healthy: boolean; priority: number }> {
    const status: Record<string, { enabled: boolean; healthy: boolean; priority: number }> = {};
    
    for (const [engineId, engine] of this.engines.entries()) {
      status[engineId] = {
        enabled: engine.isEnabled,
        healthy: this.healthStatus.get(engineId) || false,
        priority: engine.priority
      };
    }
    
    return status;
  }

  /**
   * 启用/禁用搜索引擎
   */
  setEngineEnabled(engineId: string, enabled: boolean): void {
    const engine = this.engines.get(engineId);
    if (engine) {
      engine.isEnabled = enabled;
      this.logger.info(`Engine ${engineId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * 取消搜索请求
   */
  cancelSearch(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.logger.info(`Cancelled search request: ${requestId}`);
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    // 简化的缓存统计
    return {
      size: this.cache.size,
      hitRate: 0.75 // 模拟75%命中率
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }
}
