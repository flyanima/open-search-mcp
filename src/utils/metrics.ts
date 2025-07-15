/**
 * Metrics Collector
 * 
 * Collects and tracks performance metrics for Function Calling
 * and search operations to optimize the MCP server.
 */

import { Logger } from './logger.js';

export interface ToolMetrics {
  name: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastUsed: Date;
  successRate: number;
}

export interface FunctionCallingMetrics {
  totalBatches: number;
  averageBatchSize: number;
  averageBatchTime: number;
  concurrentCallsMax: number;
  concurrentCallsAverage: number;
  successRate: number;
  saturatedSearches: number;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  cacheHitRate: number;
  rateLimitHits: number;
}

export class MetricsCollector {
  private toolMetrics: Map<string, ToolMetrics> = new Map();
  private functionCallingMetrics: FunctionCallingMetrics;
  private systemMetrics: SystemMetrics;
  private logger: Logger;
  private startTime: number;
  private metricsInterval: NodeJS.Timeout;

  constructor() {
    this.logger = new Logger('MetricsCollector');
    this.startTime = Date.now();
    
    this.functionCallingMetrics = {
      totalBatches: 0,
      averageBatchSize: 0,
      averageBatchTime: 0,
      concurrentCallsMax: 0,
      concurrentCallsAverage: 0,
      successRate: 0,
      saturatedSearches: 0,
    };

    this.systemMetrics = {
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0,
      activeConnections: 0,
      cacheHitRate: 0,
      rateLimitHits: 0,
    };

    // Update system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);
  }

  /**
   * Record tool execution
   */
  recordToolExecution(toolName: string, executionTime: number, success: boolean): void {
    let metrics = this.toolMetrics.get(toolName);
    
    if (!metrics) {
      metrics = {
        name: toolName,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        lastUsed: new Date(),
        successRate: 0,
      };
      this.toolMetrics.set(toolName, metrics);
    }

    // Update metrics
    metrics.totalCalls++;
    metrics.lastUsed = new Date();
    
    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }

    // Update execution time statistics
    metrics.averageExecutionTime = (
      (metrics.averageExecutionTime * (metrics.totalCalls - 1) + executionTime) / 
      metrics.totalCalls
    );
    metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime);
    metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime);
    metrics.successRate = metrics.successfulCalls / metrics.totalCalls;

    this.logger.logToolExecution(toolName, executionTime, success, {
      totalCalls: metrics.totalCalls,
      successRate: metrics.successRate,
    });
  }

  /**
   * Record Function Calling batch execution
   */
  recordFunctionCallingBatch(
    batchSize: number, 
    executionTime: number, 
    concurrentCalls: number, 
    successCount: number
  ): void {
    const metrics = this.functionCallingMetrics;
    
    metrics.totalBatches++;
    metrics.averageBatchSize = (
      (metrics.averageBatchSize * (metrics.totalBatches - 1) + batchSize) / 
      metrics.totalBatches
    );
    metrics.averageBatchTime = (
      (metrics.averageBatchTime * (metrics.totalBatches - 1) + executionTime) / 
      metrics.totalBatches
    );
    metrics.concurrentCallsMax = Math.max(metrics.concurrentCallsMax, concurrentCalls);
    metrics.concurrentCallsAverage = (
      (metrics.concurrentCallsAverage * (metrics.totalBatches - 1) + concurrentCalls) / 
      metrics.totalBatches
    );
    metrics.successRate = (
      (metrics.successRate * (metrics.totalBatches - 1) + (successCount / batchSize)) / 
      metrics.totalBatches
    );

    this.logger.logFunctionCalling(batchSize, concurrentCalls, executionTime, successCount / batchSize);
  }

  /**
   * Record saturated search completion
   */
  recordSaturatedSearch(
    query: string, 
    totalSources: number, 
    saturatedAt: number, 
    confidence: number
  ): void {
    this.functionCallingMetrics.saturatedSearches++;
    
    this.logger.logSaturatedSearch(query, totalSources, saturatedAt, confidence);
  }

  /**
   * Increment tool call counter
   */
  incrementToolCall(toolName: string): void {
    // This is called when a tool call starts, before execution
    // Used for tracking call frequency
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(): void {
    this.systemMetrics.rateLimitHits++;
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(hitRate: number): void {
    this.systemMetrics.cacheHitRate = hitRate;
  }

  /**
   * Get tool metrics
   */
  getToolMetrics(toolName?: string): ToolMetrics | ToolMetrics[] {
    if (toolName) {
      return this.toolMetrics.get(toolName) || this.createEmptyToolMetrics(toolName);
    }
    
    return Array.from(this.toolMetrics.values());
  }

  /**
   * Get Function Calling metrics
   */
  getFunctionCallingMetrics(): FunctionCallingMetrics {
    return { ...this.functionCallingMetrics };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    this.updateSystemMetrics();
    return { ...this.systemMetrics };
  }

  /**
   * Get top performing tools
   */
  getTopPerformingTools(limit: number = 10): ToolMetrics[] {
    return Array.from(this.toolMetrics.values())
      .sort((a, b) => {
        // Sort by success rate first, then by average execution time
        if (Math.abs(a.successRate - b.successRate) > 0.1) {
          return b.successRate - a.successRate;
        }
        return a.averageExecutionTime - b.averageExecutionTime;
      })
      .slice(0, limit);
  }

  /**
   * Get tools with issues
   */
  getProblematicTools(): ToolMetrics[] {
    return Array.from(this.toolMetrics.values())
      .filter(metrics => 
        metrics.successRate < 0.8 || 
        metrics.averageExecutionTime > 10000 ||
        metrics.totalCalls > 10
      )
      .sort((a, b) => a.successRate - b.successRate);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalTools: number;
    activeTools: number;
    averageSuccessRate: number;
    averageExecutionTime: number;
    functionCalling: FunctionCallingMetrics;
    system: SystemMetrics;
    recommendations: string[];
  } {
    const tools = Array.from(this.toolMetrics.values());
    const activeTools = tools.filter(t => t.totalCalls > 0);
    
    const averageSuccessRate = activeTools.length > 0 
      ? activeTools.reduce((sum, t) => sum + t.successRate, 0) / activeTools.length 
      : 0;
    
    const averageExecutionTime = activeTools.length > 0
      ? activeTools.reduce((sum, t) => sum + t.averageExecutionTime, 0) / activeTools.length
      : 0;

    const recommendations = this.generateRecommendations();

    return {
      totalTools: tools.length,
      activeTools: activeTools.length,
      averageSuccessRate,
      averageExecutionTime,
      functionCalling: this.getFunctionCallingMetrics(),
      system: this.getSystemMetrics(),
      recommendations,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const tools = Array.from(this.toolMetrics.values());
    const activeTools = tools.filter(t => t.totalCalls > 0);
    
    if (activeTools.length === 0) {
      return ['No tool usage data available'];
    }

    const averageSuccessRate = activeTools.reduce((sum, t) => sum + t.successRate, 0) / activeTools.length;
    const averageExecutionTime = activeTools.reduce((sum, t) => sum + t.averageExecutionTime, 0) / activeTools.length;
    
    // Success rate recommendations
    if (averageSuccessRate < 0.8) {
      recommendations.push('Overall success rate is low. Check error logs and improve error handling.');
    }
    
    // Performance recommendations
    if (averageExecutionTime > 5000) {
      recommendations.push('Average execution time is high. Consider optimizing slow tools or increasing timeouts.');
    }
    
    // Function Calling recommendations
    if (this.functionCallingMetrics.concurrentCallsMax < 50) {
      recommendations.push('Low concurrency detected. Consider increasing batch sizes for better Function Calling performance.');
    }
    
    if (this.functionCallingMetrics.averageBatchTime > 15000) {
      recommendations.push('Batch execution time is high. Consider optimizing tool performance or reducing batch sizes.');
    }
    
    // System recommendations
    if (this.systemMetrics.memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      recommendations.push('High memory usage detected. Consider implementing memory optimization strategies.');
    }
    
    if (this.systemMetrics.cacheHitRate < 0.4) {
      recommendations.push('Low cache hit rate. Consider adjusting cache TTL or improving cache key strategies.');
    }

    return recommendations;
  }

  private updateSystemMetrics(): void {
    this.systemMetrics.uptime = Date.now() - this.startTime;
    this.systemMetrics.memoryUsage = process.memoryUsage();
    
    // Note: CPU usage calculation would require additional libraries
    // For now, we'll use a placeholder
    this.systemMetrics.cpuUsage = 0;
  }

  private createEmptyToolMetrics(toolName: string): ToolMetrics {
    return {
      name: toolName,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      minExecutionTime: 0,
      maxExecutionTime: 0,
      lastUsed: new Date(),
      successRate: 0,
    };
  }

  /**
   * Export metrics data
   */
  exportMetrics(): {
    tools: ToolMetrics[];
    functionCalling: FunctionCallingMetrics;
    system: SystemMetrics;
    summary: any;
    exportTime: Date;
  } {
    return {
      tools: Array.from(this.toolMetrics.values()),
      functionCalling: this.getFunctionCallingMetrics(),
      system: this.getSystemMetrics(),
      summary: this.getPerformanceSummary(),
      exportTime: new Date(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.toolMetrics.clear();
    this.functionCallingMetrics = {
      totalBatches: 0,
      averageBatchSize: 0,
      averageBatchTime: 0,
      concurrentCallsMax: 0,
      concurrentCallsAverage: 0,
      successRate: 0,
      saturatedSearches: 0,
    };
    this.startTime = Date.now();
    this.logger.info('Metrics reset');
  }

  /**
   * Flush metrics (for shutdown)
   */
  async flush(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Export final metrics
    const finalMetrics = this.exportMetrics();
    this.logger.info('Final metrics', finalMetrics.summary);
  }
}
