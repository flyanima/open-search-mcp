/**
 * 负载均衡器 - 智能API选择和流量分发
 */

import { SearchAPI, SearchOptions } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface LoadBalancingConfig {
  strategy: 'round-robin' | 'weighted' | 'least-connections' | 'health-based';
  healthCheckInterval: number;
  failoverThreshold: number;
}

export class LoadBalancer {
  private config: LoadBalancingConfig;
  private logger: Logger;
  private roundRobinIndex: number = 0;
  private connectionCounts: Map<string, number> = new Map();
  private lastUsed: Map<string, number> = new Map();

  constructor(config: LoadBalancingConfig) {
    this.config = config;
    this.logger = new Logger('LoadBalancer');
  }

  /**
   * 根据策略选择API
   */
  selectAPIs(availableAPIs: SearchAPI[], options: SearchOptions): SearchAPI[] {
    if (availableAPIs.length === 0) {
      return [];
    }

    // 如果用户指定了特定的源，优先使用
    if (options.sources && options.sources.length > 0) {
      const filteredAPIs = availableAPIs.filter(api => 
        options.sources!.includes(api.name)
      );
      if (filteredAPIs.length > 0) {
        return this.applyStrategy(filteredAPIs, options);
      }
    }

    return this.applyStrategy(availableAPIs, options);
  }

  /**
   * 应用负载均衡策略
   */
  private applyStrategy(apis: SearchAPI[], options: SearchOptions): SearchAPI[] {
    switch (this.config.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(apis, options);
      
      case 'weighted':
        return this.weightedSelection(apis, options);
      
      case 'least-connections':
        return this.leastConnectionsSelection(apis, options);
      
      case 'health-based':
        return this.healthBasedSelection(apis, options);
      
      default:
        return this.roundRobinSelection(apis, options);
    }
  }

  /**
   * 轮询选择
   */
  private roundRobinSelection(apis: SearchAPI[], options: SearchOptions): SearchAPI[] {
    const maxAPIs = Math.min(options.maxSources || 3, apis.length);
    const selected: SearchAPI[] = [];

    for (let i = 0; i < maxAPIs; i++) {
      const index = (this.roundRobinIndex + i) % apis.length;
      selected.push(apis[index]);
    }

    this.roundRobinIndex = (this.roundRobinIndex + maxAPIs) % apis.length;
    return selected;
  }

  /**
   * 加权选择
   */
  private weightedSelection(apis: SearchAPI[], options: SearchOptions): SearchAPI[] {
    // 根据API的优先级和性能指标进行加权选择
    const weightedAPIs = apis.map(api => ({
      api,
      weight: this.calculateWeight(api)
    })).sort((a, b) => b.weight - a.weight);

    const maxAPIs = Math.min(options.maxSources || 3, apis.length);
    return weightedAPIs.slice(0, maxAPIs).map(item => item.api);
  }

  /**
   * 最少连接选择
   */
  private leastConnectionsSelection(apis: SearchAPI[], options: SearchOptions): SearchAPI[] {
    const sortedAPIs = apis.sort((a, b) => {
      const connectionsA = this.connectionCounts.get(a.name) || 0;
      const connectionsB = this.connectionCounts.get(b.name) || 0;
      return connectionsA - connectionsB;
    });

    const maxAPIs = Math.min(options.maxSources || 3, apis.length);
    return sortedAPIs.slice(0, maxAPIs);
  }

  /**
   * 基于健康度选择
   */
  private healthBasedSelection(apis: SearchAPI[], options: SearchOptions): SearchAPI[] {
    // 根据健康度和响应时间选择最佳API
    const healthSortedAPIs = apis.sort((a, b) => {
      const healthA = this.getAPIHealth(a);
      const healthB = this.getAPIHealth(b);
      return healthB - healthA;
    });

    const maxAPIs = Math.min(options.maxSources || 3, apis.length);
    return healthSortedAPIs.slice(0, maxAPIs);
  }

  /**
   * 计算API权重
   */
  private calculateWeight(api: SearchAPI): number {
    let weight = api.priority || 1;
    
    // 根据最近的使用情况调整权重
    const lastUsedTime = this.lastUsed.get(api.name) || 0;
    const timeSinceLastUse = Date.now() - lastUsedTime;
    
    // 如果最近没有使用，增加权重
    if (timeSinceLastUse > 60000) { // 1分钟
      weight *= 1.2;
    }

    // 根据连接数调整权重
    const connections = this.connectionCounts.get(api.name) || 0;
    if (connections > 10) {
      weight *= 0.8;
    }

    return weight;
  }

  /**
   * 获取API健康度评分
   */
  private getAPIHealth(api: SearchAPI): number {
    // 这里应该从健康监控器获取实际的健康度数据
    // 暂时返回基础评分
    return api.reliability || 0.8;
  }

  /**
   * 获取故障转移API
   */
  getFallbackAPI(failedAPI: SearchAPI): SearchAPI | null {
    // 实现故障转移逻辑
    // 这里需要从可用API中选择一个作为备用
    this.logger.warn(`Looking for fallback API for ${failedAPI.name}`);
    return null; // 暂时返回null，后续实现
  }

  /**
   * 记录API连接
   */
  recordConnection(apiName: string): void {
    const current = this.connectionCounts.get(apiName) || 0;
    this.connectionCounts.set(apiName, current + 1);
    this.lastUsed.set(apiName, Date.now());
  }

  /**
   * 释放API连接
   */
  releaseConnection(apiName: string): void {
    const current = this.connectionCounts.get(apiName) || 0;
    if (current > 0) {
      this.connectionCounts.set(apiName, current - 1);
    }
  }

  /**
   * 获取负载均衡统计信息
   */
  getStats(): {
    strategy: string;
    connectionCounts: Record<string, number>;
    lastUsed: Record<string, number>;
  } {
    return {
      strategy: this.config.strategy,
      connectionCounts: Object.fromEntries(this.connectionCounts),
      lastUsed: Object.fromEntries(this.lastUsed)
    };
  }
}
