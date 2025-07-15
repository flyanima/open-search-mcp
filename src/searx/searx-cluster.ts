/**
 * Searx集群管理器 - 自部署Searx集群的管理和负载均衡
 */

import axios, { AxiosInstance } from 'axios';
import { SearchResult, SearchOptions } from '../types.js';
import { Logger } from '../utils/logger.js';

export interface SearxNode {
  id: string;
  url: string;
  isHealthy: boolean;
  responseTime: number;
  lastCheck: Date;
  errorCount: number;
  totalRequests: number;
}

export interface SearxClusterConfig {
  nodes: Array<{
    url: string;
    weight?: number;
  }>;
  healthCheck: {
    interval: number;
    timeout: number;
    retries: number;
  };
  loadBalancing: {
    strategy: 'round-robin' | 'least-connections' | 'response-time';
  };
  deployment?: {
    dockerCompose?: boolean;
    autoScale?: boolean;
    minNodes?: number;
    maxNodes?: number;
  };
}

export interface SearxSearchOptions extends SearchOptions {
  engines?: string[];
  categories?: string[];
  language?: string;
  timeRange?: string;
  safeSearch?: 'strict' | 'moderate' | 'none';
  format?: 'json' | 'rss' | 'csv';
}

export class SearxCluster {
  private config: SearxClusterConfig;
  private logger: Logger;
  private nodes: Map<string, SearxNode> = new Map();
  private currentNodeIndex: number = 0;
  private httpClient: AxiosInstance;

  constructor(config: SearxClusterConfig) {
    this.config = config;
    this.logger = new Logger('SearxCluster');
    
    this.httpClient = axios.create({
      timeout: config.healthCheck.timeout,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0'
      }
    });

    this.initializeNodes();
    this.startHealthMonitoring();
  }

  /**
   * 执行搜索
   */
  async search(query: string, options: SearxSearchOptions = {}): Promise<SearchResult[]> {
    const availableNodes = this.getHealthyNodes();
    
    if (availableNodes.length === 0) {
      throw new Error('No healthy Searx nodes available');
    }

    const selectedNode = this.selectNode(availableNodes);
    
    try {
      const results = await this.searchOnNode(selectedNode, query, options);
      this.recordSuccess(selectedNode.id);
      return results;
    } catch (error) {
      this.recordError(selectedNode.id, error as Error);
      
      // 尝试故障转移到其他节点
      const fallbackNodes = availableNodes.filter(node => node.id !== selectedNode.id);
      if (fallbackNodes.length > 0) {
        const fallbackNode = fallbackNodes[0];
        this.logger.warn(`Falling back to node ${fallbackNode.id}`);
        return await this.searchOnNode(fallbackNode, query, options);
      }
      
      throw error;
    }
  }

  /**
   * 在指定节点上执行搜索
   */
  private async searchOnNode(
    node: SearxNode, 
    query: string, 
    options: SearxSearchOptions
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    const searchParams = {
      q: query,
      format: options.format || 'json',
      engines: options.engines?.join(','),
      categories: options.categories?.join(','),
      language: options.language || 'en',
      time_range: options.timeRange,
      safesearch: options.safeSearch || 'moderate'
    };

    // 过滤掉undefined值
    const filteredParams = Object.fromEntries(
      Object.entries(searchParams).filter(([_, value]) => value !== undefined)
    );

    try {
      const response = await this.httpClient.get(`${node.url}/search`, {
        params: filteredParams
      });

      const responseTime = Date.now() - startTime;
      node.responseTime = responseTime;
      node.totalRequests++;

      return this.parseSearxResults(response.data, node.url);
    } catch (error) {
      node.errorCount++;
      throw error;
    }
  }

  /**
   * 解析Searx搜索结果
   */
  private parseSearxResults(data: any, nodeUrl: string): SearchResult[] {
    if (!data || !data.results) {
      return [];
    }

    return data.results.map((result: any) => ({
      title: result.title || '',
      url: result.url || '',
      snippet: result.content || result.description || '',
      source: 'searx',
      timestamp: new Date().toISOString(),
      relevanceScore: this.calculateRelevanceScore(result),
      metadata: {
        engine: result.engine,
        category: result.category,
        nodeUrl: nodeUrl,
        publishedDate: result.publishedDate
      }
    }));
  }

  /**
   * 计算相关性评分
   */
  private calculateRelevanceScore(result: any): number {
    let score = 0.5; // 基础分数

    // 根据引擎类型调整分数
    if (result.engine === 'google' || result.engine === 'bing') {
      score += 0.2;
    }

    // 根据内容长度调整分数
    if (result.content && result.content.length > 100) {
      score += 0.1;
    }

    // 根据是否有发布日期调整分数
    if (result.publishedDate) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 选择节点
   */
  selectNode(availableNodes: SearxNode[]): SearxNode {
    switch (this.config.loadBalancing.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(availableNodes);
      
      case 'least-connections':
        return this.leastConnectionsSelection(availableNodes);
      
      case 'response-time':
        return this.responseTimeSelection(availableNodes);
      
      default:
        return availableNodes[0];
    }
  }

  /**
   * 轮询选择
   */
  private roundRobinSelection(nodes: SearxNode[]): SearxNode {
    const node = nodes[this.currentNodeIndex % nodes.length];
    this.currentNodeIndex++;
    return node;
  }

  /**
   * 最少连接选择
   */
  private leastConnectionsSelection(nodes: SearxNode[]): SearxNode {
    return nodes.reduce((min, current) => 
      current.totalRequests < min.totalRequests ? current : min
    );
  }

  /**
   * 响应时间选择
   */
  private responseTimeSelection(nodes: SearxNode[]): SearxNode {
    return nodes.reduce((fastest, current) => 
      current.responseTime < fastest.responseTime ? current : fastest
    );
  }

  /**
   * 初始化节点
   */
  private initializeNodes(): void {
    this.config.nodes.forEach((nodeConfig, index) => {
      const node: SearxNode = {
        id: `searx-node-${index}`,
        url: nodeConfig.url,
        isHealthy: true,
        responseTime: 0,
        lastCheck: new Date(),
        errorCount: 0,
        totalRequests: 0
      };
      
      this.nodes.set(node.id, node);
      this.logger.info(`Initialized Searx node: ${node.id} at ${node.url}`);
    });
  }

  /**
   * 获取健康节点
   */
  getHealthyNodes(): SearxNode[] {
    return Array.from(this.nodes.values()).filter(node => node.isHealthy);
  }

  /**
   * 启动健康监控
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheck.interval);

    this.logger.info('Started Searx cluster health monitoring');
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.nodes.values()).map(node => 
      this.checkNodeHealth(node)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 检查单个节点健康状态
   */
  private async checkNodeHealth(node: SearxNode): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.get(`${node.url}/stats`, {
        timeout: this.config.healthCheck.timeout
      });

      if (response.status === 200) {
        node.isHealthy = true;
        node.responseTime = Date.now() - startTime;
        node.lastCheck = new Date();
      }
    } catch (error) {
      node.isHealthy = false;
      node.errorCount++;
      node.lastCheck = new Date();
      
      this.logger.warn(`Health check failed for node ${node.id}:`, error);
    }
  }

  /**
   * 记录成功请求
   */
  private recordSuccess(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.isHealthy = true;
    }
  }

  /**
   * 记录错误请求
   */
  private recordError(nodeId: string, error: Error): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.errorCount++;
      
      // 如果错误率过高，标记为不健康
      if (node.errorCount > 5) {
        node.isHealthy = false;
      }
    }
    
    this.logger.error(`Error on Searx node ${nodeId}:`, error);
  }

  /**
   * 获取集群状态
   */
  getClusterStatus(): {
    totalNodes: number;
    healthyNodes: number;
    nodes: SearxNode[];
  } {
    const nodes = Array.from(this.nodes.values());
    
    return {
      totalNodes: nodes.length,
      healthyNodes: nodes.filter(node => node.isHealthy).length,
      nodes: nodes
    };
  }

  /**
   * 部署集群（Docker Compose）
   */
  async deployCluster(): Promise<void> {
    if (!this.config.deployment?.dockerCompose) {
      throw new Error('Docker Compose deployment not configured');
    }

    // TODO: 实现Docker Compose部署逻辑
    this.logger.info('Deploying Searx cluster with Docker Compose...');
  }
}
