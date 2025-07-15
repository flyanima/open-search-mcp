/**
 * Logger Utility
 * 
 * Provides structured logging for the Open Search MCP server
 * with support for different log levels and output formats.
 */

import winston from 'winston';
import { LogLevel } from '../types.js';

export class Logger {
  private winston: winston.Logger;
  private context: string;

  constructor(context: string = 'OpenSearchMCP') {
    this.context = context;
    this.winston = this.createWinstonLogger();
  }

  private createWinstonLogger(): winston.Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isMCPMode = process.env.SERVER_MODE === 'mcp' || !process.env.SERVER_MODE;

    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ];

    if (isDevelopment) {
      formats.push(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}] [${context || this.context}]: ${message} ${metaStr}`;
        })
      );
    }

    const transports: winston.transport[] = [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ];

    // Only add console transport if NOT in MCP mode
    // MCP mode requires clean stdio communication without any console output
    if (!isMCPMode) {
      transports.push(
        new winston.transports.Console({
          stderrLevels: ['error', 'warn', 'info', 'debug'], // Force all logs to stderr
          handleExceptions: false, // Don't handle exceptions to avoid multiple listeners
          handleRejections: false, // Don't handle rejections to avoid multiple listeners
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(...formats),
      defaultMeta: { context: this.context },
      transports,
      exitOnError: false,
    });
  }

  debug(message: string, meta?: any): void {
    this.winston.debug(message, { context: this.context, ...meta });
  }

  info(message: string, meta?: any): void {
    this.winston.info(message, { context: this.context, ...meta });
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(message, { context: this.context, ...meta });
  }

  error(message: string, error?: any, meta?: any): void {
    const errorMeta = error instanceof Error 
      ? { 
          error: error.message, 
          stack: error.stack,
          name: error.name,
          ...meta 
        }
      : { error, ...meta };
    
    this.winston.error(message, { context: this.context, ...errorMeta });
  }

  /**
   * Log tool execution metrics
   */
  logToolExecution(toolName: string, executionTime: number, success: boolean, meta?: any): void {
    const logData = {
      tool: toolName,
      executionTime,
      success,
      context: this.context,
      ...meta,
    };

    if (success) {
      this.info(`Tool executed successfully: ${toolName} (${executionTime}ms)`, logData);
    } else {
      this.error(`Tool execution failed: ${toolName} (${executionTime}ms)`, logData);
    }
  }

  /**
   * Log search metrics
   */
  logSearchMetrics(query: string, source: string, resultCount: number, executionTime: number, cached: boolean = false): void {
    this.info(`Search completed: ${source}`, {
      query,
      source,
      resultCount,
      executionTime,
      cached,
      context: this.context,
    });
  }

  /**
   * Log rate limit events
   */
  logRateLimit(source: string, limit: number, current: number): void {
    this.warn(`Rate limit approached: ${source}`, {
      source,
      limit,
      current,
      utilization: (current / limit * 100).toFixed(1) + '%',
      context: this.context,
    });
  }

  /**
   * Log cache events
   */
  logCacheEvent(event: 'hit' | 'miss' | 'set' | 'evict', key: string, meta?: any): void {
    this.debug(`Cache ${event}: ${key}`, {
      event,
      key,
      context: this.context,
      ...meta,
    });
  }

  /**
   * Log Function Calling metrics
   */
  logFunctionCalling(totalTools: number, concurrentCalls: number, totalTime: number, successRate: number): void {
    this.info('Function Calling execution completed', {
      totalTools,
      concurrentCalls,
      totalTime,
      successRate: (successRate * 100).toFixed(1) + '%',
      averageTimePerTool: (totalTime / totalTools).toFixed(1) + 'ms',
      context: this.context,
    });
  }

  /**
   * Log saturated search events
   */
  logSaturatedSearch(query: string, totalSources: number, saturatedAt: number, confidence: number): void {
    this.info('Saturated search completed', {
      query,
      totalSources,
      saturatedAt,
      confidence: (confidence * 100).toFixed(1) + '%',
      saturationRate: (saturatedAt / totalSources * 100).toFixed(1) + '%',
      context: this.context,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: string): Logger {
    const childLogger = new Logger(`${this.context}:${additionalContext}`);
    return childLogger;
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.winston.level = level;
    this.info(`Log level changed to: ${level}`);
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.winston.level;
  }

  /**
   * Flush all log transports
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.on('finish', resolve);
      this.winston.end();
    });
  }
}

/**
 * Create a logger instance with context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger('OpenSearchMCP');
