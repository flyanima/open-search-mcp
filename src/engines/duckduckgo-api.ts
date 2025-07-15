/**
 * DuckDuckGo搜索API实现 - 免费搜索引擎
 */

import axios, { AxiosInstance } from 'axios';
import { SearchAPI, SearchOptions, SearchResult, APIMetrics } from '../types.js';
import { Logger } from '../utils/logger.js';

export class DuckDuckGoAPI implements SearchAPI {
  name = 'duckduckgo';
  priority = 10;
  reliability = 0.9;

  private httpClient: AxiosInstance;
  private logger: Logger;
  private metrics: APIMetrics;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 1秒最小间隔

  constructor() {
    this.logger = new Logger('DuckDuckGoAPI');
    
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0 (https://github.com/open-search-mcp)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastUsed: new Date(),
      rateLimitHits: 0,
      errorRate: 0
    };
  }

  /**
   * 执行搜索
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      // 速率限制
      await this.enforceRateLimit();
      
      this.metrics.totalRequests++;
      this.metrics.lastUsed = new Date();

      // 构建搜索参数
      const searchParams = {
        q: query,
        format: 'json',
        no_html: '1',
        skip_disambig: '1',
        no_redirect: '1',
        safe_search: 'moderate'
      };

      this.logger.debug(`Searching DuckDuckGo for: "${query}"`);

      // 执行搜索请求
      const response = await this.httpClient.get('https://api.duckduckgo.com/', {
        params: searchParams
      });

      // 解析结果
      const results = this.parseResults(response.data, query);
      
      // 更新指标
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);
      
      this.logger.info(`DuckDuckGo search completed: ${results.length} results in ${responseTime}ms`);
      
      return results.slice(0, options.maxResults || 20);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      
      this.logger.error('DuckDuckGo search failed:', error);
      throw new Error(`DuckDuckGo search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 解析DuckDuckGo搜索结果
   */
  private parseResults(data: any, query: string): SearchResult[] {
    const results: SearchResult[] = [];

    // 处理即时答案
    if (data.Answer) {
      results.push({
        title: 'Instant Answer',
        url: data.AbstractURL || '',
        snippet: data.Answer,
        source: this.name,
        score: 0.95,
        type: 'web',
        timestamp: new Date().toISOString(),
        relevanceScore: 0.95,
        metadata: {
          type: 'instant_answer',
          answerType: data.AnswerType
        }
      });
    }

    // 处理摘要
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Abstract',
        url: data.AbstractURL || '',
        snippet: data.Abstract,
        source: this.name,
        score: 0.9,
        type: 'web',
        timestamp: new Date().toISOString(),
        relevanceScore: 0.9,
        metadata: {
          type: 'abstract',
          source: data.AbstractSource
        }
      });
    }

    // 处理相关主题
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.forEach((topic: any, index: number) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: this.extractTitle(topic.Text),
            url: topic.FirstURL,
            snippet: topic.Text,
            source: this.name,
            score: Math.max(0.8 - (index * 0.05), 0.3),
            type: 'web',
            timestamp: new Date().toISOString(),
            relevanceScore: Math.max(0.8 - (index * 0.05), 0.3),
            metadata: {
              type: 'related_topic',
              icon: topic.Icon?.URL
            }
          });
        }
      });
    }

    // 处理结果
    if (data.Results && Array.isArray(data.Results)) {
      data.Results.forEach((result: any, index: number) => {
        if (result.Text && result.FirstURL) {
          results.push({
            title: this.extractTitle(result.Text),
            url: result.FirstURL,
            snippet: result.Text,
            source: this.name,
            score: Math.max(0.85 - (index * 0.05), 0.4),
            type: 'web',
            timestamp: new Date().toISOString(),
            relevanceScore: Math.max(0.85 - (index * 0.05), 0.4),
            metadata: {
              type: 'search_result'
            }
          });
        }
      });
    }

    return results;
  }

  /**
   * 从文本中提取标题
   */
  private extractTitle(text: string): string {
    // 尝试提取第一句话作为标题
    const sentences = text.split(/[.!?]/);
    if (sentences.length > 0 && sentences[0].length > 0) {
      return sentences[0].trim();
    }
    
    // 如果没有句号，取前50个字符
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }

  /**
   * 强制执行速率限制
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均响应时间
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // 更新错误率
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests;
  }

  /**
   * 检查API健康状态
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('https://api.duckduckgo.com/', {
        params: { q: 'test', format: 'json' },
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      this.logger.warn('DuckDuckGo health check failed:', error);
      return false;
    }
  }

  /**
   * 获取API指标
   */
  getMetrics(): APIMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastUsed: new Date(),
      rateLimitHits: 0,
      errorRate: 0
    };
  }
}
