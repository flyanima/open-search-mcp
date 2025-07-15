/**
 * 工具包装器
 * 为所有工具提供统一的错误处理、输出格式和日志记录
 */

import { Logger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { 
  UnifiedToolOutput, 
  UnifiedSearchResultItem, 
  OutputFormatConverter,
  QualityAssessment 
} from '../types/unified-output-format.js';
import { apiKeyManager } from '../config/api-key-manager.js';

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  toolName: string;
  platform: string;
  startTime: number;
  args: any;
  logger: Logger;
  errorHandler: ErrorHandler;
}

/**
 * 工具包装器类
 */
export class ToolWrapper {
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor() {
    this.logger = new Logger('ToolWrapper');
    this.errorHandler = new ErrorHandler(this.logger);
  }

  /**
   * 包装工具执行
   */
  async wrapToolExecution<T>(
    toolName: string,
    platform: string,
    args: any,
    executor: (context: ToolExecutionContext) => Promise<T>
  ): Promise<UnifiedToolOutput> {
    const startTime = Date.now();
    const context: ToolExecutionContext = {
      toolName,
      platform,
      startTime,
      args,
      logger: this.logger,
      errorHandler: this.errorHandler
    };

    try {
      // 验证API密钥（如果需要）
      this.validateAPIKeys(platform);

      // 验证输入参数
      this.validateInput(args, toolName);

      // 执行工具
      this.logger.info(`Executing tool: ${toolName}`, { platform, args });
      const result = await executor(context);

      // 转换为统一格式
      const unifiedOutput = this.convertToUnifiedFormat(
        result,
        args.query || args.topic || '',
        platform,
        startTime
      );

      // 计算质量指标
      if (unifiedOutput.results.length > 0) {
        unifiedOutput.qualityMetrics = QualityAssessment.calculateQualityMetrics(
          unifiedOutput.results,
          unifiedOutput.query
        );
      }

      this.logger.info(`Tool execution completed: ${toolName}`, {
        resultCount: unifiedOutput.results.length,
        executionTime: unifiedOutput.metadata.executionTimeMs
      });

      return unifiedOutput;

    } catch (error) {
      return this.handleToolError(error as Error, toolName, platform, args, startTime);
    }
  }

  /**
   * 验证API密钥
   */
  private validateAPIKeys(platform: string): void {
    const keyMappings: Record<string, string> = {
      'google': 'googleApiKey',
      'alpha_vantage': 'alphaVantageApiKey',
      'newsapi': 'newsApiKey',
      'github': 'githubToken',
      'reddit': 'redditClientId',
      'openweather': 'openWeatherApiKey',
      'huggingface': 'huggingFaceApiKey',
      'coingecko': 'coinGeckoApiKey',
      'youtube': 'youtubeApiKey'
    };

    const keyName = keyMappings[platform.toLowerCase()];
    if (keyName) {
      const apiKey = apiKeyManager.getAPIKey(keyName as any);
      if (!apiKey) {
        throw new Error(`API key missing for ${platform}: Required API key '${keyName}' is not configured`);
      }
    }
  }

  /**
   * 验证输入参数
   */
  private validateInput(args: any, toolName: string): void {
    if (!args) {
      throw new Error(`Missing input arguments: Tool ${toolName} requires input arguments`);
    }

    // 验证查询参数（如果需要）
    if (toolName.includes('search') && !args.query && !args.topic) {
      throw new Error('Missing search query: Search tools require a query parameter');
    }

    // 验证查询长度
    const query = args.query || args.topic || '';
    if (query && query.length > 1000) {
      throw new Error('Query too long: Search query exceeds maximum length of 1000 characters');
    }
  }

  /**
   * 转换为统一格式
   */
  private convertToUnifiedFormat(
    result: any,
    query: string,
    platform: string,
    startTime: number
  ): UnifiedToolOutput {
    const executionTime = Date.now() - startTime;

    // 如果结果已经是统一格式，直接返回
    if (result && typeof result === 'object' && 'status' in result && 'results' in result) {
      return {
        ...result,
        timestamp: new Date().toISOString(),
        metadata: {
          ...result.metadata,
          executionTimeMs: executionTime
        }
      };
    }

    // 使用转换器转换旧格式
    if (result && typeof result === 'object') {
      return OutputFormatConverter.convertLegacyFormat(result, platform);
    }

    // 处理字符串结果
    if (typeof result === 'string') {
      return {
        status: 'success',
        query,
        platform,
        results: [{
          id: `${platform}_text_result`,
          title: `${platform} Result`,
          url: '',
          summary: result,
          relevanceScore: 50,
          source: platform,
          contentType: 'article'
        }],
        metadata: {
          totalResults: 1,
          page: 1,
          pageSize: 1,
          executionTimeMs: executionTime,
          apiQuotaUsed: 1,
          sources: [platform],
          cached: false
        },
        timestamp: new Date().toISOString()
      };
    }

    // 默认空结果
    return {
      status: 'success',
      query,
      platform,
      results: [],
      metadata: {
        totalResults: 0,
        page: 1,
        pageSize: 0,
        executionTimeMs: executionTime,
        apiQuotaUsed: 1,
        sources: [platform],
        cached: false
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 处理工具错误
   */
  private handleToolError(
    error: Error,
    toolName: string,
    platform: string,
    args: any,
    startTime: number
  ): UnifiedToolOutput {
    const executionTime = Date.now() - startTime;
    this.errorHandler.handleError(error, { tool: toolName, source: platform });

    const errorInfo = {
      code: 'TOOL_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      source: platform
    };

    return {
      status: 'error',
      query: args.query || args.topic || '',
      platform,
      results: [],
      metadata: {
        totalResults: 0,
        page: 1,
        pageSize: 0,
        executionTimeMs: executionTime,
        apiQuotaUsed: 0,
        sources: [platform],
        cached: false
      },
      error: errorInfo,
      suggestions: this.generateErrorSuggestions(error, platform),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成错误建议
   */
  private generateErrorSuggestions(error: Error, platform: string): string[] {
    const suggestions: string[] = [];
    const message = error.message.toLowerCase();

    if (message.includes('api key') || message.includes('unauthorized')) {
      suggestions.push(`Check ${platform} API key configuration`);
      suggestions.push('Verify API key permissions and validity');
      suggestions.push('Ensure API key is properly set in .env file');
    }

    if (message.includes('rate limit') || message.includes('quota')) {
      suggestions.push('Wait before making more requests');
      suggestions.push('Consider upgrading API plan for higher limits');
      suggestions.push('Implement request throttling');
    }

    if (message.includes('network') || message.includes('connection')) {
      suggestions.push('Check internet connection');
      suggestions.push('Verify API endpoint availability');
      suggestions.push('Try again later');
    }

    if (message.includes('timeout')) {
      suggestions.push('Increase request timeout');
      suggestions.push('Check network stability');
      suggestions.push('Simplify the search query');
    }

    if (suggestions.length === 0) {
      suggestions.push('Check logs for more details');
      suggestions.push('Try again with different parameters');
      suggestions.push('Contact support if issue persists');
    }

    return suggestions;
  }

  /**
   * 创建成功响应
   */
  static createSuccessResponse(
    query: string,
    platform: string,
    results: UnifiedSearchResultItem[],
    executionTime: number,
    additionalMetadata?: any
  ): UnifiedToolOutput {
    return {
      status: 'success',
      query,
      platform,
      results,
      metadata: {
        totalResults: results.length,
        page: 1,
        pageSize: results.length,
        executionTimeMs: executionTime,
        apiQuotaUsed: 1,
        sources: [platform],
        cached: false,
        ...additionalMetadata
      },
      qualityMetrics: QualityAssessment.calculateQualityMetrics(results, query),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建部分成功响应
   */
  static createPartialResponse(
    query: string,
    platform: string,
    results: UnifiedSearchResultItem[],
    warnings: string[],
    executionTime: number
  ): UnifiedToolOutput {
    return {
      status: 'partial',
      query,
      platform,
      results,
      metadata: {
        totalResults: results.length,
        page: 1,
        pageSize: results.length,
        executionTimeMs: executionTime,
        apiQuotaUsed: 1,
        sources: [platform],
        cached: false
      },
      warnings,
      qualityMetrics: results.length > 0 ? QualityAssessment.calculateQualityMetrics(results, query) : undefined,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建错误响应
   */
  static createErrorResponse(
    query: string,
    platform: string,
    error: Error,
    executionTime: number
  ): UnifiedToolOutput {
    return {
      status: 'error',
      query,
      platform,
      results: [],
      metadata: {
        totalResults: 0,
        page: 1,
        pageSize: 0,
        executionTimeMs: executionTime,
        apiQuotaUsed: 0,
        sources: [platform],
        cached: false
      },
      error: {
        code: 'TOOL_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        source: platform
      },
      timestamp: new Date().toISOString()
    };
  }
}

// 导出单例实例
export const toolWrapper = new ToolWrapper();
