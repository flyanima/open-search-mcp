/**
 * Error Handler
 * 
 * Centralized error handling for the Open Search MCP server
 * with proper error classification and recovery strategies.
 */

import { SearchError, RateLimitError, CrawlerError, ConfigurationError } from '../types.js';
import { Logger } from './logger.js';

export interface ErrorContext {
  tool?: string;
  source?: string;
  query?: string;
  url?: string;
  args?: any;
  timestamp?: number;
}

export interface HandledError {
  message: string;
  code: string;
  type: string;
  recoverable: boolean;
  retryAfter?: number;
  suggestions?: string[];
  context?: ErrorContext;
}

export class ErrorHandler {
  private logger: Logger;
  private errorCounts: Map<string, number> = new Map();
  private lastErrors: Map<string, number> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handle and classify errors
   */
  handleError(error: any, context: ErrorContext = {}): HandledError {
    const timestamp = Date.now();
    const enhancedContext = { ...context, timestamp };

    // Increment error count
    const errorKey = this.getErrorKey(error, context);
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    this.lastErrors.set(errorKey, timestamp);

    // Handle different error types
    if (error instanceof SearchError) {
      return this.handleSearchError(error, enhancedContext);
    }

    if (error instanceof RateLimitError) {
      return this.handleRateLimitError(error, enhancedContext);
    }

    if (error instanceof CrawlerError) {
      return this.handleCrawlerError(error, enhancedContext);
    }

    if (error instanceof ConfigurationError) {
      return this.handleConfigurationError(error, enhancedContext);
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return this.handleNetworkError(error, enhancedContext);
    }

    // Handle timeout errors
    if (this.isTimeoutError(error)) {
      return this.handleTimeoutError(error, enhancedContext);
    }

    // Handle validation errors
    if (this.isValidationError(error)) {
      return this.handleValidationError(error, enhancedContext);
    }

    // Handle generic errors
    return this.handleGenericError(error, enhancedContext);
  }

  private handleSearchError(error: SearchError, context: ErrorContext): HandledError {
    const suggestions: string[] = [];

    switch (error.code) {
      case 'RATE_LIMIT_EXCEEDED':
        suggestions.push('Wait before retrying');
        suggestions.push('Use fewer concurrent requests');
        break;
      case 'INVALID_QUERY':
        suggestions.push('Check query syntax');
        suggestions.push('Try a different search term');
        break;
      case 'NO_RESULTS':
        suggestions.push('Try broader search terms');
        suggestions.push('Check spelling');
        break;
      default:
        suggestions.push('Try again later');
    }

    return {
      message: error.message,
      code: error.code,
      type: 'SearchError',
      recoverable: error.code !== 'INVALID_QUERY',
      retryAfter: error.code === 'RATE_LIMIT_EXCEEDED' ? 60 : undefined,
      suggestions,
      context,
    };
  }

  private handleRateLimitError(error: RateLimitError, context: ErrorContext): HandledError {
    return {
      message: error.message,
      code: error.code,
      type: 'RateLimitError',
      recoverable: true,
      retryAfter: error.details?.retryAfter || 60,
      suggestions: [
        'Wait for rate limit to reset',
        'Use fewer concurrent requests',
        'Implement exponential backoff',
      ],
      context,
    };
  }

  private handleCrawlerError(error: CrawlerError, context: ErrorContext): HandledError {
    const suggestions: string[] = [];

    if (error.message.includes('timeout')) {
      suggestions.push('Increase timeout value');
      suggestions.push('Check network connectivity');
    } else if (error.message.includes('blocked')) {
      suggestions.push('Use different user agent');
      suggestions.push('Add delay between requests');
    } else if (error.message.includes('404')) {
      suggestions.push('Check URL validity');
      suggestions.push('Try alternative sources');
    }

    return {
      message: error.message,
      code: error.code,
      type: 'CrawlerError',
      recoverable: !error.message.includes('404'),
      suggestions,
      context,
    };
  }

  private handleConfigurationError(error: ConfigurationError, context: ErrorContext): HandledError {
    return {
      message: error.message,
      code: error.code,
      type: 'ConfigurationError',
      recoverable: false,
      suggestions: [
        'Check configuration file',
        'Verify environment variables',
        'Review API keys',
      ],
      context,
    };
  }

  private handleNetworkError(error: any, context: ErrorContext): HandledError {
    const suggestions = [
      'Check internet connectivity',
      'Verify target server is accessible',
      'Try again later',
    ];

    if (error.code === 'ENOTFOUND') {
      suggestions.unshift('Check DNS resolution');
    } else if (error.code === 'ECONNREFUSED') {
      suggestions.unshift('Target server may be down');
    }

    return {
      message: error.message || 'Network error occurred',
      code: error.code || 'NETWORK_ERROR',
      type: 'NetworkError',
      recoverable: true,
      retryAfter: 30,
      suggestions,
      context,
    };
  }

  private handleTimeoutError(error: any, context: ErrorContext): HandledError {
    return {
      message: error.message || 'Request timeout',
      code: 'TIMEOUT',
      type: 'TimeoutError',
      recoverable: true,
      retryAfter: 10,
      suggestions: [
        'Increase timeout value',
        'Check network speed',
        'Try simpler queries',
      ],
      context,
    };
  }

  private handleValidationError(error: any, context: ErrorContext): HandledError {
    return {
      message: error.message || 'Validation error',
      code: 'VALIDATION_ERROR',
      type: 'ValidationError',
      recoverable: false,
      suggestions: [
        'Check input parameters',
        'Verify data format',
        'Review API documentation',
      ],
      context,
    };
  }

  private handleGenericError(error: any, context: ErrorContext): HandledError {
    return {
      message: error.message || 'Unknown error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      type: 'GenericError',
      recoverable: true,
      retryAfter: 60,
      suggestions: [
        'Try again later',
        'Check logs for more details',
        'Contact support if issue persists',
      ],
      context,
    };
  }

  private isNetworkError(error: any): boolean {
    return error.code && ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code);
  }

  private isTimeoutError(error: any): boolean {
    return error.message && error.message.toLowerCase().includes('timeout');
  }

  private isValidationError(error: any): boolean {
    return error.name === 'ValidationError' || 
           (error.message && error.message.toLowerCase().includes('validation'));
  }

  private getErrorKey(error: any, context: ErrorContext): string {
    const parts = [
      error.constructor.name,
      error.code || 'unknown',
      context.tool || 'unknown',
      context.source || 'unknown',
    ];
    return parts.join(':');
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: Array<{ key: string; count: number; lastOccurred: Date }>;
  } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    const errorsByType: Record<string, number> = {};
    for (const [key, count] of this.errorCounts.entries()) {
      const type = key.split(':')[0];
      errorsByType[type] = (errorsByType[type] || 0) + count;
    }

    const recentErrors = Array.from(this.errorCounts.entries())
      .map(([key, count]) => ({
        key,
        count,
        lastOccurred: new Date(this.lastErrors.get(key) || 0),
      }))
      .sort((a, b) => b.lastOccurred.getTime() - a.lastOccurred.getTime())
      .slice(0, 10);

    return {
      totalErrors,
      errorsByType,
      recentErrors,
    };
  }

  /**
   * Check if error should trigger circuit breaker
   */
  shouldTriggerCircuitBreaker(error: any, context: ErrorContext): boolean {
    const errorKey = this.getErrorKey(error, context);
    const count = this.errorCounts.get(errorKey) || 0;
    const lastError = this.lastErrors.get(errorKey) || 0;
    const timeSinceLastError = Date.now() - lastError;

    // Trigger circuit breaker if:
    // - More than 5 errors in the last 5 minutes
    // - Or more than 10 errors in the last hour
    if (count >= 5 && timeSinceLastError < 5 * 60 * 1000) {
      return true;
    }

    if (count >= 10 && timeSinceLastError < 60 * 60 * 1000) {
      return true;
    }

    return false;
  }

  /**
   * Reset error counts
   */
  reset(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.logger.info('Error handler reset');
  }

  /**
   * Clean up old error records
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, timestamp] of this.lastErrors.entries()) {
      if (now - timestamp > maxAge) {
        this.errorCounts.delete(key);
        this.lastErrors.delete(key);
      }
    }
  }
}
