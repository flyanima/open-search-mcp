/**
 * 全局错误处理中间件
 * 统一处理所有工具的错误，提供一致的错误响应格式
 */

import { Logger } from '../utils/logger.js';
import { ToolInput, ToolOutput } from '../types.js';
import RobustErrorHandler from '../engines/robust-error-handler.js';

const logger = new Logger('ErrorMiddleware');
const globalErrorHandler = new RobustErrorHandler();

interface ToolFunction {
  (args: ToolInput): Promise<ToolOutput>;
}

interface ErrorMetadata {
  toolName: string;
  timestamp: number;
  duration?: number;
  inputSize?: number;
  errorType?: string;
}

export class ErrorMiddleware {
  private static instance: ErrorMiddleware;
  private errorStats = new Map<string, {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
    lastError?: string;
    lastErrorTime?: number;
  }>();

  private constructor() {}

  static getInstance(): ErrorMiddleware {
    if (!ErrorMiddleware.instance) {
      ErrorMiddleware.instance = new ErrorMiddleware();
    }
    return ErrorMiddleware.instance;
  }

  /**
   * 包装工具函数，添加错误处理
   */
  wrapTool(toolName: string, toolFunction: ToolFunction): ToolFunction {
    return async (args: ToolInput): Promise<ToolOutput> => {
      const startTime = Date.now();
      const metadata: ErrorMetadata = {
        toolName,
        timestamp: startTime,
        inputSize: JSON.stringify(args).length
      };

      // 更新调用统计
      this.updateCallStats(toolName, 'total');

      try {
        // 使用强化错误处理执行工具函数
        const result = await globalErrorHandler.executeWithRetry(
          () => toolFunction(args),
          {
            operation: toolName,
            service: 'mcp-tool',
            metadata: { args, toolName }
          },
          {
            maxRetries: 2, // 工具级别的重试次数较少
            baseDelay: 1000,
            timeout: 45000, // 45秒超时
            retryableErrors: [
              'NETWORK_ERROR',
              'RATE_LIMIT', 
              'SERVICE_UNAVAILABLE',
              'ECONNRESET',
              'ETIMEDOUT',
              'ENOTFOUND'
            ]
          },
          {
            type: 'default',
            value: this.createErrorFallbackResponse(toolName, 'Service temporarily unavailable')
          }
        );

        // 记录成功
        const duration = Date.now() - startTime;
        metadata.duration = duration;
        this.updateCallStats(toolName, 'success', duration);
        
        logger.debug(`Tool ${toolName} completed successfully in ${duration}ms`);
        return result;

      } catch (error) {
        // 记录失败
        const duration = Date.now() - startTime;
        metadata.duration = duration;
        metadata.errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
        
        this.updateCallStats(toolName, 'error', duration, error);
        
        logger.error(`Tool ${toolName} failed after ${duration}ms:`, error);
        
        // 返回用户友好的错误响应
        return this.createUserFriendlyErrorResponse(toolName, error, metadata);
      }
    };
  }

  /**
   * 更新调用统计
   */
  private updateCallStats(
    toolName: string, 
    type: 'total' | 'success' | 'error', 
    duration?: number,
    error?: any
  ): void {
    let stats = this.errorStats.get(toolName);
    if (!stats) {
      stats = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageResponseTime: 0
      };
      this.errorStats.set(toolName, stats);
    }

    switch (type) {
      case 'total':
        stats.totalCalls++;
        break;
      case 'success':
        stats.successfulCalls++;
        if (duration) {
          stats.averageResponseTime = (stats.averageResponseTime * (stats.successfulCalls - 1) + duration) / stats.successfulCalls;
        }
        break;
      case 'error':
        stats.failedCalls++;
        if (error) {
          stats.lastError = error instanceof Error ? error.message : String(error);
          stats.lastErrorTime = Date.now();
        }
        break;
    }
  }

  /**
   * 创建错误降级响应
   */
  private createErrorFallbackResponse(toolName: string, message: string): ToolOutput {
    return {
      success: false,
      error: message,
      data: null,
      metadata: {
        toolName,
        fallback: true,
        timestamp: new Date().toISOString(),
        suggestion: this.getErrorSuggestion(toolName)
      }
    };
  }

  /**
   * 创建用户友好的错误响应
   */
  private createUserFriendlyErrorResponse(
    toolName: string, 
    error: any, 
    metadata: ErrorMetadata
  ): ToolOutput {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const userFriendlyMessage = this.translateErrorMessage(errorMessage, toolName);
    
    return {
      success: false,
      error: userFriendlyMessage,
      data: null,
      metadata: {
        toolName,
        originalError: errorMessage,
        errorType: metadata.errorType,
        duration: metadata.duration,
        timestamp: new Date().toISOString(),
        suggestion: this.getErrorSuggestion(toolName, errorMessage),
        retryable: this.isRetryableError(errorMessage)
      }
    };
  }

  /**
   * 翻译错误消息为用户友好的格式
   */
  private translateErrorMessage(errorMessage: string, toolName: string): string {
    const lowerMessage = errorMessage.toLowerCase();
    
    // 网络相关错误
    if (lowerMessage.includes('network') || lowerMessage.includes('econnreset') || lowerMessage.includes('enotfound')) {
      return `网络连接问题，请检查网络连接后重试`;
    }
    
    // 超时错误
    if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
      return `请求超时，服务响应较慢，请稍后重试`;
    }
    
    // 权限错误
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden') || lowerMessage.includes('unauthorized')) {
      return `访问权限不足，请检查API配置或联系管理员`;
    }
    
    // 速率限制
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      return `请求过于频繁，请稍后重试`;
    }
    
    // 服务不可用
    if (lowerMessage.includes('service unavailable') || lowerMessage.includes('502') || lowerMessage.includes('503')) {
      return `服务暂时不可用，请稍后重试`;
    }
    
    // API配置问题
    if (lowerMessage.includes('api key') || lowerMessage.includes('credentials')) {
      return `API配置问题，请检查相关API密钥配置`;
    }
    
    // 工具特定错误
    if (toolName.includes('reddit') && lowerMessage.includes('403')) {
      return `Reddit访问受限，建议配置Reddit API凭证以获得更好的搜索结果`;
    }
    
    if (toolName.includes('news') && lowerMessage.includes('no results')) {
      return `未找到相关新闻，请尝试使用不同的关键词`;
    }
    
    // 默认错误消息
    return `${toolName}执行遇到问题: ${errorMessage}`;
  }

  /**
   * 获取错误建议
   */
  private getErrorSuggestion(toolName: string, errorMessage?: string): string {
    if (errorMessage) {
      const lowerMessage = errorMessage.toLowerCase();
      
      if (lowerMessage.includes('network') || lowerMessage.includes('timeout')) {
        return '建议检查网络连接，或稍后重试';
      }
      
      if (lowerMessage.includes('api') || lowerMessage.includes('credentials')) {
        return '建议检查API配置文档，确保相关API密钥正确配置';
      }
      
      if (lowerMessage.includes('rate limit')) {
        return '建议降低请求频率，或升级API计划';
      }
    }
    
    // 工具特定建议
    if (toolName.includes('reddit')) {
      return '建议配置Reddit API凭证以获得更稳定的搜索结果';
    }
    
    if (toolName.includes('news')) {
      return '建议尝试不同的搜索关键词，或检查新闻源配置';
    }
    
    return '建议查看日志获取更多详细信息，或联系技术支持';
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(errorMessage: string): boolean {
    const lowerMessage = errorMessage.toLowerCase();
    const retryablePatterns = [
      'network', 'timeout', 'rate limit', 'service unavailable',
      'econnreset', 'etimedout', '502', '503', '429'
    ];
    
    return retryablePatterns.some(pattern => lowerMessage.includes(pattern));
  }

  /**
   * 获取工具统计信息
   */
  getToolStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [toolName, toolStats] of this.errorStats.entries()) {
      const successRate = toolStats.totalCalls > 0 
        ? (toolStats.successfulCalls / toolStats.totalCalls * 100).toFixed(1)
        : '0.0';
      
      stats[toolName] = {
        totalCalls: toolStats.totalCalls,
        successfulCalls: toolStats.successfulCalls,
        failedCalls: toolStats.failedCalls,
        successRate: `${successRate}%`,
        averageResponseTime: `${toolStats.averageResponseTime.toFixed(0)}ms`,
        lastError: toolStats.lastError,
        lastErrorTime: toolStats.lastErrorTime ? new Date(toolStats.lastErrorTime).toISOString() : undefined
      };
    }
    
    return stats;
  }

  /**
   * 获取系统健康状态
   */
  getSystemHealth(): any {
    const now = Date.now();
    const stats = Array.from(this.errorStats.values());
    
    const totalCalls = stats.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalSuccessful = stats.reduce((sum, s) => sum + s.successfulCalls, 0);
    const totalFailed = stats.reduce((sum, s) => sum + s.failedCalls, 0);
    
    const overallSuccessRate = totalCalls > 0 ? (totalSuccessful / totalCalls * 100) : 100;
    const averageResponseTime = stats.length > 0 
      ? stats.reduce((sum, s) => sum + s.averageResponseTime, 0) / stats.length 
      : 0;
    
    // 获取错误处理器统计
    const errorHandlerStats = globalErrorHandler.getErrorStats();
    
    return {
      timestamp: new Date().toISOString(),
      overallHealth: overallSuccessRate >= 90 ? 'healthy' : overallSuccessRate >= 70 ? 'degraded' : 'unhealthy',
      metrics: {
        totalCalls,
        successfulCalls: totalSuccessful,
        failedCalls: totalFailed,
        successRate: `${overallSuccessRate.toFixed(1)}%`,
        averageResponseTime: `${averageResponseTime.toFixed(0)}ms`
      },
      circuitBreakers: errorHandlerStats.circuitBreakers,
      topErrors: errorHandlerStats.errorPatterns.slice(0, 5)
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.errorStats.clear();
    globalErrorHandler.resetAllCircuitBreakers();
    logger.info('Error statistics and circuit breakers reset');
  }
}

export default ErrorMiddleware;
