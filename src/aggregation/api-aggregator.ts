/**
 * 多API聚合器 - Open Search MCP v2.0 阶段一核心组件
 * 实现智能API调度、负载均衡、故障转移
 */

import { SearchAPI, SearchOptions, SearchResult, APIHealthMetrics } from '../types.js';
import { Logger } from '../utils/logger.js';
import { LoadBalancer } from './load-balancer.js';
import { APIHealthMonitor } from './api-health-monitor.js';
import { IntelligentCache } from './intelligent-cache.js';
import { createHash } from 'crypto';

export interface APIAggregatorConfig {
  apis: {
    [key: string]: {
      enabled: boolean;
      priority: number;
      rateLimit: number;
      timeout: number;
      retryAttempts: number;
    };
  };
  loadBalancing: {
    strategy: 'round-robin' | 'weighted' | 'least-connections' | 'health-based';
    healthCheckInterval: number;
    failoverThreshold: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  fallback: {
    enabled: boolean;
    maxFallbackAttempts: number;
    fallbackDelay: number;
  };
}

export class APIAggregator {
  private apis: Map<string, SearchAPI> = new Map();
  private config: APIAggregatorConfig;
  private healthMonitor: APIHealthMonitor;
  private loadBalancer: LoadBalancer;
  private cache: IntelligentCache;
  private logger: Logger;

  constructor(config: APIAggregatorConfig) {
    this.config = config;
    this.logger = new Logger('APIAggregator');
    this.healthMonitor = new APIHealthMonitor(config.loadBalancing);
    this.loadBalancer = new LoadBalancer(config.loadBalancing);
    this.cache = new IntelligentCache(config.cache);
    
    this.initializeAPIs();
    this.startHealthMonitoring();
  }

  /**
   * 主搜索方法 - 智能聚合多个API的搜索结果
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      // 1. 检查缓存 (Simplified - cache not implemented)
      const cacheKey = this.generateCacheKey(query, options);
      // if (this.config.cache.enabled) {
      //   const cachedResults = await this.cache.get(cacheKey);
      //   if (cachedResults) {
      //     this.logger.info(`Cache hit for query: ${query}`);
      //     return cachedResults;
      //   }
      // }

      // 2. 获取健康的API
      const healthyAPIs = await this.healthMonitor.getHealthyAPIs();
      if (healthyAPIs.length === 0) {
        throw new Error('No healthy APIs available');
      }

      // 3. 负载均衡选择API
      const selectedAPIs = this.loadBalancer.selectAPIs(healthyAPIs, options);
      this.logger.info(`Selected ${selectedAPIs.length} APIs for query: ${query}`);

      // 4. 并发执行搜索
      const searchPromises = selectedAPIs.map(api => 
        this.executeSearchWithFallback(api, query, options)
      );

      // 5. 等待所有搜索完成
      const results = await Promise.allSettled(searchPromises);
      
      // 6. 聚合和去重结果
      const aggregatedResults = this.aggregateResults(results, query);

      // 7. 缓存结果 (Simplified - cache not implemented)
      // if (this.config.cache.enabled && aggregatedResults.length > 0) {
      //   await this.cache.set(cacheKey, aggregatedResults);
      // }

      // 8. 记录性能指标
      const duration = Date.now() - startTime;
      this.logger.info(`Search completed in ${duration}ms, found ${aggregatedResults.length} results`);

      return aggregatedResults;

    } catch (error) {
      this.logger.error('Search aggregation failed:', error);
      throw error;
    }
  }

  /**
   * 带故障转移的搜索执行
   */
  private async executeSearchWithFallback(
    api: SearchAPI, 
    query: string, 
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const apiConfig = this.config.apis[api.name];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < apiConfig.retryAttempts; attempt++) {
      try {
        // 设置超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('API timeout')), apiConfig.timeout);
        });

        const searchPromise = api.search(query, options);
        const results = await Promise.race([searchPromise, timeoutPromise]);

        // 记录成功
        this.healthMonitor.recordSuccess(api.name);
        return results;

      } catch (error) {
        lastError = error as Error;
        this.healthMonitor.recordError(api.name, error as Error);
        
        // 如果不是最后一次尝试，等待后重试
        if (attempt < apiConfig.retryAttempts - 1) {
          await this.delay(1000 * (attempt + 1)); // 指数退避
        }
      }
    }

    // 尝试故障转移
    if (this.config.fallback.enabled) {
      const fallbackAPI = this.loadBalancer.getFallbackAPI(api);
      if (fallbackAPI && fallbackAPI !== api) {
        this.logger.warn(`Attempting fallback from ${api.name} to ${fallbackAPI.name}`);
        await this.delay(this.config.fallback.fallbackDelay);
        return await this.executeSearchWithFallback(fallbackAPI, query, options);
      }
    }

    this.logger.error(`All attempts failed for API ${api.name}:`, lastError);
    return [];
  }

  /**
   * 聚合和去重搜索结果
   */
  private aggregateResults(
    results: PromiseSettledResult<SearchResult[]>[], 
    query: string
  ): SearchResult[] {
    const allResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        for (const searchResult of result.value) {
          // 简单去重：基于URL
          if (!seenUrls.has(searchResult.url)) {
            seenUrls.add(searchResult.url);
            allResults.push({
              ...searchResult,
              // 添加聚合元数据
              aggregationMetadata: {
                aggregatedAt: new Date().toISOString(),
                query: query,
                source: 'api-aggregator'
              }
            });
          }
        }
      }
    }

    // 按相关性排序
    return allResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(query: string, options: SearchOptions): string {
    const keyData = {
      query: query.toLowerCase().trim(),
      options: {
        maxResults: options.maxResults,
        language: options.language,
        timeRange: options.timeRange,
        sources: options.sources?.sort()
      }
    };
    
    return createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * 初始化API实例
   */
  private initializeAPIs(): void {
    // 这里会根据配置初始化各种API
    // 具体的API实现将在后续添加
    this.logger.info('Initializing APIs...');
    
    for (const [apiName, apiConfig] of Object.entries(this.config.apis)) {
      if (apiConfig.enabled) {
        this.logger.info(`API ${apiName} enabled with priority ${apiConfig.priority}`);
      }
    }
  }

  /**
   * 启动健康监控
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.healthMonitor.performHealthCheck();
    }, this.config.loadBalancing.healthCheckInterval);
  }

  /**
   * 延迟工具函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取聚合器状态
   */
  public getStatus(): {
    totalAPIs: number;
    healthyAPIs: number;
    cacheStats: any;
    healthMetrics: Map<string, APIHealthMetrics>;
  } {
    return {
      totalAPIs: this.apis.size,
      healthyAPIs: this.healthMonitor.getHealthyAPIs().length,
      // cacheStats: this.cache.getStats(), // Simplified - cache not implemented
      cacheStats: { hits: 0, misses: 0, size: 0 },
      healthMetrics: this.healthMonitor.getHealthMetrics()
    };
  }

  /**
   * 优雅关闭
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down API Aggregator...');
    // await this.cache.close(); // Simplified - cache not implemented
    // 清理其他资源
  }
}
