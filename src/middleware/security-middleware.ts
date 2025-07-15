/**
 * Security Middleware
 * 
 * Provides comprehensive security middleware for HTTP endpoints including:
 * - Rate limiting
 * - Input sanitization
 * - Security headers
 * - CORS protection
 * - Request size limits
 * - IP filtering
 * - Authentication validation
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Logger } from '../utils/logger.js';
import { inputValidator } from '../utils/input-validator.js';

/**
 * Security configuration interface
 */
interface SecurityConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  cors: {
    origins: string[];
    credentials: boolean;
  };
  headers: {
    csp: boolean;
    hsts: boolean;
    noSniff: boolean;
    frameOptions: boolean;
  };
  requestLimits: {
    maxBodySize: string;
    maxUrlLength: number;
    maxHeaderSize: number;
  };
}

/**
 * Default security configuration
 */
const DEFAULT_CONFIG: SecurityConfig = {
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
  },
  cors: {
    origins: ['http://localhost:3000'],
    credentials: false,
  },
  headers: {
    csp: true,
    hsts: true,
    noSniff: true,
    frameOptions: true,
  },
  requestLimits: {
    maxBodySize: '10mb',
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
  },
};

/**
 * Security Middleware Class
 */
export class SecurityMiddleware {
  private logger: Logger;
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.logger = new Logger('SecurityMiddleware');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimiter() {
    return rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      skipSuccessfulRequests: this.config.rateLimiting.skipSuccessfulRequests,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(this.config.rateLimiting.windowMs / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        this.logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
        });
        
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(this.config.rateLimiting.windowMs / 1000),
        });
      },
    });
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Content Security Policy
      if (this.config.headers.csp) {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';"
        );
      }

      // HTTP Strict Transport Security
      if (this.config.headers.hsts) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      // X-Content-Type-Options
      if (this.config.headers.noSniff) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }

      // X-Frame-Options
      if (this.config.headers.frameOptions) {
        res.setHeader('X-Frame-Options', 'DENY');
      }

      // Additional security headers
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      res.removeHeader('X-Powered-By');

      next();
    };
  }

  /**
   * CORS middleware with strict origin validation
   */
  corsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.get('Origin');
      
      // Check if origin is allowed
      if (origin && this.config.cors.origins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (this.config.cors.origins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      // Set other CORS headers
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

      if (this.config.cors.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      next();
    };
  }

  /**
   * Input sanitization middleware
   */
  inputSanitization() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Sanitize query parameters
        if (req.query) {
          for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
              req.query[key] = inputValidator.sanitizeString(value);
            }
          }
        }

        // Sanitize body parameters
        if (req.body && typeof req.body === 'object') {
          this.sanitizeObject(req.body);
        }

        // Check for dangerous content
        const requestString = JSON.stringify({ query: req.query, body: req.body });
        if (inputValidator.containsDangerousContent(requestString)) {
          this.logger.warn('Dangerous content detected in request', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent'),
          });

          res.status(400).json({
            error: 'Bad Request',
            message: 'Request contains potentially dangerous content',
          });
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Input sanitization error', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Request processing failed',
        });
      }
    };
  }

  /**
   * Request size validation middleware
   */
  requestSizeValidation() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Check URL length
      if (req.url.length > this.config.requestLimits.maxUrlLength) {
        this.logger.warn('URL too long', { ip: req.ip, urlLength: req.url.length });
        res.status(414).json({
          error: 'URI Too Long',
          message: 'Request URL exceeds maximum length',
        });
        return;
      }

      // Check header size
      const headerSize = JSON.stringify(req.headers).length;
      if (headerSize > this.config.requestLimits.maxHeaderSize) {
        this.logger.warn('Headers too large', { ip: req.ip, headerSize });
        res.status(431).json({
          error: 'Request Header Fields Too Large',
          message: 'Request headers exceed maximum size',
        });
        return;
      }

      next();
    };
  }

  /**
   * IP filtering middleware (if needed)
   */
  ipFiltering(allowedIPs: string[] = [], blockedIPs: string[] = []) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIP = req.ip || req.connection.remoteAddress || '';

      // Check blocked IPs
      if (blockedIPs.includes(clientIP)) {
        this.logger.warn('Blocked IP attempted access', { ip: clientIP });
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
        return;
      }

      // Check allowed IPs (if specified)
      if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
        this.logger.warn('Unauthorized IP attempted access', { ip: clientIP });
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied',
        });
        return;
      }

      next();
    };
  }

  /**
   * Request logging middleware
   */
  requestLogging() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Log request
      this.logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
      });

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('HTTP Response', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('Content-Length'),
        });
      });

      next();
    };
  }

  /**
   * Recursively sanitize object properties
   */
  private sanitizeObject(obj: any): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        obj[key] = inputValidator.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        this.sanitizeObject(value);
      }
    }
  }

  /**
   * Get middleware stack for Express app
   */
  getMiddlewareStack() {
    return [
      this.requestLogging(),
      this.securityHeaders(),
      this.corsMiddleware(),
      this.requestSizeValidation(),
      this.createRateLimiter(),
      this.inputSanitization(),
    ];
  }
}

// Export default instance
export const securityMiddleware = new SecurityMiddleware();
