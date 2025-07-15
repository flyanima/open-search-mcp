import { defaultLogger as logger } from './logger.js';

export interface QueuedRequest {
  id: string;
  toolName: string;
  priority: number;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  executor: () => Promise<any>;
}

export interface ConcurrencyStats {
  activeRequests: number;
  queuedRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughput: number; // requests per second
}

export interface ConcurrencyConfig {
  maxConcurrentRequests: number;
  maxQueueSize: number;
  requestTimeout: number;
  priorityLevels: number;
  enablePrioritization: boolean;
}

/**
 * Concurrency Manager for controlling parallel tool executions
 * Implements request queuing, prioritization, and rate limiting
 */
export class ConcurrencyManager {
  private activeRequests: Map<string, { startTime: number; toolName: string }> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private config: ConcurrencyConfig;
  private stats = {
    completed: 0,
    failed: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
    startTime: Date.now()
  };

  constructor(config?: Partial<ConcurrencyConfig>) {
    this.config = {
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5'),
      maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '100'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      priorityLevels: 5,
      enablePrioritization: true,
      ...config
    };
  }

  /**
   * Execute a tool with concurrency control
   */
  public async execute<T>(
    toolName: string,
    executor: () => Promise<T>,
    options: {
      priority?: number;
      timeout?: number;
      id?: string;
    } = {}
  ): Promise<T> {
    const requestId = options.id || this.generateRequestId();
    const priority = options.priority || 0;
    const timeout = options.timeout || this.config.requestTimeout;

    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        toolName,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        executor
      };

      // Check if we can execute immediately
      if (this.activeRequests.size < this.config.maxConcurrentRequests) {
        this.executeRequest(queuedRequest, timeout);
      } else {
        this.queueRequest(queuedRequest, timeout);
      }
    });
  }

  /**
   * Queue a request for later execution
   */
  private queueRequest(request: QueuedRequest, timeout: number): void {
    // Check queue size limit
    if (this.requestQueue.length >= this.config.maxQueueSize) {
      request.reject(new Error(`Queue is full (${this.config.maxQueueSize} requests)`));
      this.stats.failed++;
      return;
    }

    // Add to queue with prioritization
    if (this.config.enablePrioritization) {
      this.insertByPriority(request);
    } else {
      this.requestQueue.push(request);
    }

    // Set timeout for queued request
    setTimeout(() => {
      const index = this.requestQueue.findIndex(r => r.id === request.id);
      if (index !== -1) {
        this.requestQueue.splice(index, 1);
        request.reject(new Error(`Request timeout while queued (${timeout}ms)`));
        this.stats.failed++;
      }
    }, timeout);

    logger.debug(`Request queued: ${request.toolName} (priority: ${request.priority}, queue size: ${this.requestQueue.length})`);
  }

  /**
   * Insert request into queue by priority
   */
  private insertByPriority(request: QueuedRequest): void {
    let insertIndex = this.requestQueue.length;
    
    // Find insertion point (higher priority = lower number = earlier execution)
    for (let i = 0; i < this.requestQueue.length; i++) {
      if (request.priority < this.requestQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, request);
  }

  /**
   * Execute a request immediately
   */
  private async executeRequest(request: QueuedRequest, timeout: number): Promise<void> {
    const startTime = Date.now();
    const waitTime = startTime - request.timestamp;
    
    this.activeRequests.set(request.id, {
      startTime,
      toolName: request.toolName
    });

    // Set execution timeout
    const timeoutHandle = setTimeout(() => {
      this.activeRequests.delete(request.id);
      request.reject(new Error(`Request execution timeout (${timeout}ms)`));
      this.stats.failed++;
      this.processQueue();
    }, timeout);

    try {
      logger.debug(`Executing request: ${request.toolName} (wait time: ${waitTime}ms)`);
      
      const result = await request.executor();
      
      clearTimeout(timeoutHandle);
      this.activeRequests.delete(request.id);
      
      const executionTime = Date.now() - startTime;
      this.updateStats(waitTime, executionTime, true);
      
      request.resolve(result);
      
      logger.debug(`Request completed: ${request.toolName} (execution time: ${executionTime}ms)`);
    } catch (error) {
      clearTimeout(timeoutHandle);
      this.activeRequests.delete(request.id);
      
      const executionTime = Date.now() - startTime;
      this.updateStats(waitTime, executionTime, false);
      
      request.reject(error instanceof Error ? error : new Error(String(error)));
      
      logger.error(`Request failed: ${request.toolName} (execution time: ${executionTime}ms)`, error);
    } finally {
      // Process next request in queue
      this.processQueue();
    }
  }

  /**
   * Process the next request in queue
   */
  private processQueue(): void {
    if (this.requestQueue.length === 0 || this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }

    const nextRequest = this.requestQueue.shift();
    if (nextRequest) {
      this.executeRequest(nextRequest, this.config.requestTimeout);
    }
  }

  /**
   * Update performance statistics
   */
  private updateStats(waitTime: number, executionTime: number, success: boolean): void {
    this.stats.totalWaitTime += waitTime;
    this.stats.totalExecutionTime += executionTime;
    
    if (success) {
      this.stats.completed++;
    } else {
      this.stats.failed++;
    }
  }

  /**
   * Get current concurrency statistics
   */
  public getStats(): ConcurrencyStats {
    const totalRequests = this.stats.completed + this.stats.failed;
    const uptime = (Date.now() - this.stats.startTime) / 1000; // seconds
    
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      completedRequests: this.stats.completed,
      failedRequests: this.stats.failed,
      averageWaitTime: totalRequests > 0 ? this.stats.totalWaitTime / totalRequests : 0,
      averageExecutionTime: totalRequests > 0 ? this.stats.totalExecutionTime / totalRequests : 0,
      throughput: uptime > 0 ? totalRequests / uptime : 0
    };
  }

  /**
   * Get active requests information
   */
  public getActiveRequests(): Array<{ id: string; toolName: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeRequests.entries()).map(([id, info]) => ({
      id,
      toolName: info.toolName,
      duration: now - info.startTime
    }));
  }

  /**
   * Get queued requests information
   */
  public getQueuedRequests(): Array<{ id: string; toolName: string; priority: number; waitTime: number }> {
    const now = Date.now();
    return this.requestQueue.map(request => ({
      id: request.id,
      toolName: request.toolName,
      priority: request.priority,
      waitTime: now - request.timestamp
    }));
  }

  /**
   * Cancel a specific request
   */
  public cancelRequest(requestId: string): boolean {
    // Check if it's an active request
    if (this.activeRequests.has(requestId)) {
      // Cannot cancel active requests directly
      return false;
    }

    // Check if it's in the queue
    const queueIndex = this.requestQueue.findIndex(r => r.id === requestId);
    if (queueIndex !== -1) {
      const request = this.requestQueue.splice(queueIndex, 1)[0];
      request.reject(new Error('Request cancelled'));
      this.stats.failed++;
      logger.debug(`Request cancelled: ${request.toolName}`);
      return true;
    }

    return false;
  }

  /**
   * Clear all queued requests
   */
  public clearQueue(): number {
    const clearedCount = this.requestQueue.length;
    
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue cleared'));
      this.stats.failed++;
    });
    
    this.requestQueue = [];
    
    if (clearedCount > 0) {
      logger.info(`Cleared ${clearedCount} queued requests`);
    }
    
    return clearedCount;
  }

  /**
   * Update concurrency configuration
   */
  public updateConfig(newConfig: Partial<ConcurrencyConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // If max concurrent requests increased, process more from queue
    if (newConfig.maxConcurrentRequests && newConfig.maxConcurrentRequests > oldConfig.maxConcurrentRequests) {
      this.processQueue();
    }
    
    // If queue size decreased, remove excess requests
    if (newConfig.maxQueueSize && newConfig.maxQueueSize < this.requestQueue.length) {
      const excessRequests = this.requestQueue.splice(newConfig.maxQueueSize);
      excessRequests.forEach(request => {
        request.reject(new Error('Queue size reduced'));
        this.stats.failed++;
      });
    }
    
    logger.info('Concurrency configuration updated', newConfig);
  }

  /**
   * Get current configuration
   */
  public getConfig(): ConcurrencyConfig {
    return { ...this.config };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      completed: 0,
      failed: 0,
      totalWaitTime: 0,
      totalExecutionTime: 0,
      startTime: Date.now()
    };
    logger.info('Concurrency statistics reset');
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check queue size
    if (stats.queuedRequests > this.config.maxQueueSize * 0.8) {
      issues.push(`Queue is ${((stats.queuedRequests / this.config.maxQueueSize) * 100).toFixed(1)}% full`);
      recommendations.push('Consider increasing maxConcurrentRequests or maxQueueSize');
    }

    // Check failure rate
    const totalRequests = stats.completedRequests + stats.failedRequests;
    if (totalRequests > 0) {
      const failureRate = stats.failedRequests / totalRequests;
      if (failureRate > 0.1) { // 10% failure rate
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
        recommendations.push('Check for timeout issues or increase request timeout');
      }
    }

    // Check average wait time
    if (stats.averageWaitTime > 5000) { // 5 seconds
      issues.push(`High average wait time: ${stats.averageWaitTime.toFixed(0)}ms`);
      recommendations.push('Consider increasing maxConcurrentRequests');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }
}

// Global concurrency manager instance
export const concurrencyManager = new ConcurrencyManager();
