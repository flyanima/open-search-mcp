/**
 * Secure Logger
 * 
 * Enhanced logging system with security features:
 * - Sensitive data filtering
 * - Log sanitization
 * - Structured logging
 * - Log rotation
 * - Security event tracking
 * - Audit trail
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

/**
 * Sensitive data patterns to filter from logs
 */
const SENSITIVE_PATTERNS = [
  // API Keys
  /api[_-]?key['":\s]*['"]\w{8,}['"]/gi,
  /key['":\s]*['"]\w{16,}['"]/gi,
  
  // Passwords
  /password['":\s]*['"]\w{4,}['"]/gi,
  /passwd['":\s]*['"]\w{4,}['"]/gi,
  
  // Tokens
  /token['":\s]*['"]\w{16,}['"]/gi,
  /bearer['":\s]*['"]\w{16,}['"]/gi,
  
  // Secrets
  /secret['":\s]*['"]\w{8,}['"]/gi,
  /private[_-]?key['":\s]*['"]\w{8,}['"]/gi,
  
  // Common API key formats
  /AIza[0-9A-Za-z_-]{35}/g,  // Google API keys
  /sk-[0-9A-Za-z]{48}/g,     // OpenAI API keys
  /ghp_[0-9A-Za-z]{36}/g,    // GitHub tokens
  /xoxb-[0-9A-Za-z-]{50,}/g, // Slack tokens
];

/**
 * Security event types
 */
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INPUT_VALIDATION_FAILED = 'input_validation_failed',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  API_KEY_USAGE = 'api_key_usage',
  CONTAINER_SECURITY_EVENT = 'container_security_event',
  NETWORK_ANOMALY = 'network_anomaly',
  DATA_ACCESS = 'data_access',
  CONFIGURATION_CHANGE = 'config_change',
  ERROR_THRESHOLD_EXCEEDED = 'error_threshold_exceeded'
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  ip?: string;
  userAgent?: string;
  timestamp?: Date;
}

/**
 * Log sanitization options
 */
interface SanitizationOptions {
  filterSensitiveData: boolean;
  maxFieldLength: number;
  allowedFields: string[];
  blockedFields: string[];
}

/**
 * Secure Logger Class
 */
export class SecureLogger {
  private logger: winston.Logger;
  private securityLogger: winston.Logger;
  private auditLogger: winston.Logger;
  private sanitizationOptions: SanitizationOptions;

  constructor(
    serviceName: string,
    options: {
      logLevel?: string;
      logDir?: string;
      enableConsole?: boolean;
      enableFile?: boolean;
      enableSecurity?: boolean;
      enableAudit?: boolean;
    } = {}
  ) {
    const {
      logLevel = 'info',
      logDir = './logs',
      enableConsole = true,
      enableFile = true,
      enableSecurity = true,
      enableAudit = true
    } = options;

    // Ensure log directory exists
    if (enableFile && !fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Sanitization options
    this.sanitizationOptions = {
      filterSensitiveData: true,
      maxFieldLength: 1000,
      allowedFields: ['timestamp', 'level', 'message', 'service', 'method', 'path', 'statusCode', 'duration'],
      blockedFields: ['password', 'secret', 'token', 'key', 'auth', 'authorization']
    };

    // Main application logger
    this.logger = this.createLogger(serviceName, {
      level: logLevel,
      filename: enableFile ? path.join(logDir, `${serviceName}.log`) : undefined,
      enableConsole
    });

    // Security events logger
    this.securityLogger = enableSecurity ? this.createLogger(`${serviceName}-security`, {
      level: 'info',
      filename: enableFile ? path.join(logDir, `${serviceName}-security.log`) : undefined,
      enableConsole: false
    }) : this.logger;

    // Audit trail logger
    this.auditLogger = enableAudit ? this.createLogger(`${serviceName}-audit`, {
      level: 'info',
      filename: enableFile ? path.join(logDir, `${serviceName}-audit.log`) : undefined,
      enableConsole: false
    }) : this.logger;
  }

  /**
   * Create Winston logger instance
   */
  private createLogger(name: string, options: {
    level: string;
    filename?: string;
    enableConsole: boolean;
  }): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (options.enableConsole) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${name}] ${level}: ${message} ${metaStr}`;
          })
        )
      }));
    }

    // File transport
    if (options.filename) {
      transports.push(new winston.transports.File({
        filename: options.filename,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }

    return winston.createLogger({
      level: options.level,
      transports,
      defaultMeta: { service: name },
      exitOnError: false
    });
  }

  /**
   * Sanitize log data to remove sensitive information
   */
  private sanitizeData(data: any): any {
    if (!this.sanitizationOptions.filterSensitiveData) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip blocked fields
        if (this.sanitizationOptions.blockedFields.some(blocked => 
          key.toLowerCase().includes(blocked.toLowerCase())
        )) {
          sanitized[key] = '[REDACTED]';
          continue;
        }

        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeData(value);

        // Truncate long fields
        if (typeof sanitized[key] === 'string' && 
            sanitized[key].length > this.sanitizationOptions.maxFieldLength) {
          sanitized[key] = sanitized[key].substring(0, this.sanitizationOptions.maxFieldLength) + '...[TRUNCATED]';
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    // Remove sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, this.sanitizeData(meta));
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, this.sanitizeData(meta));
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };

    this.logger.error(message, this.sanitizeData(errorMeta));
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, this.sanitizeData(meta));
  }

  /**
   * Log security event
   */
  security(event: SecurityEvent): void {
    const securityEvent = {
      ...event,
      timestamp: event.timestamp || new Date(),
      service: 'open-search-mcp'
    };

    this.securityLogger.info('Security Event', this.sanitizeData(securityEvent));

    // Also log to main logger if severity is high or critical
    if (event.severity === 'high' || event.severity === 'critical') {
      this.logger.warn(`Security Event: ${event.message}`, {
        type: event.type,
        severity: event.severity,
        metadata: this.sanitizeData(event.metadata)
      });
    }
  }

  /**
   * Log audit event
   */
  audit(action: string, details: {
    userId?: string;
    resource?: string;
    result: 'success' | 'failure';
    metadata?: any;
    ip?: string;
    userAgent?: string;
  }): void {
    const auditEvent = {
      action,
      ...details,
      timestamp: new Date(),
      service: 'open-search-mcp'
    };

    this.auditLogger.info('Audit Event', this.sanitizeData(auditEvent));
  }

  /**
   * Log HTTP request
   */
  httpRequest(req: {
    method: string;
    path: string;
    ip?: string;
    userAgent?: string;
    contentLength?: string;
  }): void {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.userAgent,
      contentLength: req.contentLength
    });
  }

  /**
   * Log HTTP response
   */
  httpResponse(res: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    contentLength?: string;
  }): void {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    this.logger.log(level, 'HTTP Response', {
      method: res.method,
      path: res.path,
      statusCode: res.statusCode,
      duration: res.duration,
      contentLength: res.contentLength
    });
  }

  /**
   * Log API key usage
   */
  apiKeyUsage(keyName: string, usage: {
    tool?: string;
    success: boolean;
    rateLimited?: boolean;
    ip?: string;
  }): void {
    this.security({
      type: SecurityEventType.API_KEY_USAGE,
      severity: 'low',
      message: `API key used: ${keyName}`,
      metadata: {
        keyName,
        ...usage
      }
    });
  }

  /**
   * Log rate limit event
   */
  rateLimitExceeded(details: {
    ip?: string;
    userAgent?: string;
    path?: string;
    limit: number;
    window: number;
  }): void {
    this.security({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: 'medium',
      message: 'Rate limit exceeded',
      metadata: details,
      ip: details.ip
    });
  }

  /**
   * Log input validation failure
   */
  inputValidationFailed(details: {
    tool?: string;
    error: string;
    input?: any;
    ip?: string;
  }): void {
    this.security({
      type: SecurityEventType.INPUT_VALIDATION_FAILED,
      severity: 'medium',
      message: 'Input validation failed',
      metadata: {
        tool: details.tool,
        error: details.error,
        input: this.sanitizeData(details.input)
      },
      ip: details.ip
    });
  }

  /**
   * Get logger instance for direct use
   */
  getLogger(): winston.Logger {
    return this.logger;
  }

  /**
   * Close all loggers
   */
  close(): void {
    this.logger.close();
    if (this.securityLogger !== this.logger) {
      this.securityLogger.close();
    }
    if (this.auditLogger !== this.logger) {
      this.auditLogger.close();
    }
  }
}

// Export default instance
export const secureLogger = new SecureLogger('open-search-mcp');
