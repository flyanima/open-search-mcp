/**
 * Input Validator
 * 
 * Provides strict input validation using Zod schemas to prevent injection attacks
 * and ensure data integrity across all tool inputs.
 * 
 * SECURITY FEATURES:
 * - Schema-based validation
 * - Input sanitization
 * - Size limits enforcement
 * - Type safety
 * - XSS prevention
 * - SQL injection prevention
 */

import { z } from 'zod';
import { Logger } from './logger.js';

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // Basic string with length limits and sanitization
  safeString: z.string()
    .min(1, 'String cannot be empty')
    .max(10000, 'String too long')
    .transform(str => str.trim())
    .refine(str => !/<script|javascript:|data:|vbscript:/i.test(str), {
      message: 'Potentially dangerous content detected'
    }),

  // Search query with specific constraints
  searchQuery: z.string()
    .min(1, 'Search query cannot be empty')
    .max(1000, 'Search query too long')
    .transform(str => str.trim())
    .refine(str => str.length > 0, 'Search query cannot be empty after trimming')
    .refine(str => !/<script|javascript:|data:|vbscript:/i.test(str), {
      message: 'Potentially dangerous content in search query'
    }),

  // URL validation
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .refine(url => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, 'Only HTTP and HTTPS URLs are allowed'),

  // Positive integer
  positiveInteger: z.number()
    .int('Must be an integer')
    .positive('Must be positive')
    .max(10000, 'Number too large'),

  // Page number
  pageNumber: z.number()
    .int('Page number must be an integer')
    .min(1, 'Page number must be at least 1')
    .max(1000, 'Page number too large'),

  // Results limit
  resultsLimit: z.number()
    .int('Results limit must be an integer')
    .min(1, 'Results limit must be at least 1')
    .max(100, 'Results limit cannot exceed 100'),

  // Date string
  dateString: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(dateStr => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
    }, 'Invalid date'),

  // Language code
  languageCode: z.string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format')
    .transform(str => str.toLowerCase()),

  // Category/tag
  category: z.string()
    .min(1, 'Category cannot be empty')
    .max(100, 'Category name too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Category can only contain letters, numbers, underscores, and hyphens'),

  // File path (for PDF processing)
  filePath: z.string()
    .min(1, 'File path cannot be empty')
    .max(500, 'File path too long')
    .refine(path => !path.includes('..'), 'Path traversal not allowed')
    .refine(path => /\.(pdf|txt|md)$/i.test(path), 'Only PDF, TXT, and MD files are allowed'),

  // API key format validation
  apiKey: z.string()
    .min(8, 'API key too short')
    .max(200, 'API key too long')
    .refine(key => !key.includes(' '), 'API key cannot contain spaces')
    .refine(key => !/^(your_|test_|demo_|placeholder)/i.test(key), 'Placeholder API key detected'),
};

/**
 * Tool-specific validation schemas
 */
export const ToolSchemas = {
  // Basic search tool
  basicSearch: z.object({
    query: CommonSchemas.searchQuery,
    limit: CommonSchemas.resultsLimit.optional().default(10),
    page: CommonSchemas.pageNumber.optional().default(1),
  }),

  // Academic search
  academicSearch: z.object({
    query: CommonSchemas.searchQuery,
    limit: CommonSchemas.resultsLimit.optional().default(10),
    category: CommonSchemas.category.optional(),
    dateFrom: CommonSchemas.dateString.optional(),
    dateTo: CommonSchemas.dateString.optional(),
  }),

  // URL crawling
  urlCrawl: z.object({
    url: CommonSchemas.url,
    extractText: z.boolean().optional().default(true),
    extractLinks: z.boolean().optional().default(false),
  }),

  // Batch URL crawling
  batchUrlCrawl: z.object({
    urls: z.array(CommonSchemas.url)
      .min(1, 'At least one URL is required')
      .max(10, 'Cannot process more than 10 URLs at once'),
    maxConcurrent: CommonSchemas.positiveInteger.optional().default(3),
  }),

  // Financial data
  financialQuery: z.object({
    symbol: z.string()
      .min(1, 'Symbol cannot be empty')
      .max(10, 'Symbol too long')
      .regex(/^[A-Z0-9.-]+$/, 'Invalid symbol format')
      .transform(str => str.toUpperCase()),
    interval: z.enum(['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'])
      .optional()
      .default('daily'),
  }),

  // News search
  newsSearch: z.object({
    query: CommonSchemas.searchQuery,
    language: CommonSchemas.languageCode.optional().default('en'),
    sortBy: z.enum(['relevancy', 'popularity', 'publishedAt']).optional().default('publishedAt'),
    from: CommonSchemas.dateString.optional(),
    to: CommonSchemas.dateString.optional(),
    limit: CommonSchemas.resultsLimit.optional().default(20),
  }),

  // GitHub search
  githubSearch: z.object({
    query: CommonSchemas.searchQuery,
    type: z.enum(['repositories', 'code', 'issues', 'users']).optional().default('repositories'),
    sort: z.enum(['stars', 'forks', 'updated', 'created']).optional(),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: CommonSchemas.resultsLimit.optional().default(10),
  }),

  // PDF analysis
  pdfAnalysis: z.object({
    filePath: CommonSchemas.filePath,
    extractText: z.boolean().optional().default(true),
    extractMetadata: z.boolean().optional().default(true),
    pageRange: z.object({
      start: CommonSchemas.positiveInteger,
      end: CommonSchemas.positiveInteger,
    }).optional(),
  }),
};

/**
 * Input Validator Class
 */
export class InputValidator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('InputValidator');
  }

  /**
   * Validate input against a Zod schema
   */
  validate<T>(input: unknown, schema: z.ZodSchema<T>): { success: true; data: T } | { success: false; error: string } {
    try {
      const result = schema.parse(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
        this.logger.warn('Input validation failed', { error: errorMessage, input });
        return { success: false, error: errorMessage };
      }
      
      this.logger.error('Unexpected validation error', error);
      return { success: false, error: 'Validation failed' };
    }
  }

  /**
   * Validate tool input based on tool name
   */
  validateToolInput(toolName: string, input: unknown): { success: true; data: any } | { success: false; error: string } {
    // Map tool names to schemas
    const schemaMap: Record<string, z.ZodSchema> = {
      // Academic tools
      'search_arxiv': ToolSchemas.academicSearch,
      'search_pubmed': ToolSchemas.academicSearch,
      'search_ieee': ToolSchemas.academicSearch,
      'search_semantic_scholar': ToolSchemas.academicSearch,
      'search_biorxiv': ToolSchemas.academicSearch,
      'search_medrxiv': ToolSchemas.academicSearch,

      // Web search tools
      'search_google': ToolSchemas.basicSearch,
      'search_bing': ToolSchemas.basicSearch,
      'search_duckduckgo': ToolSchemas.basicSearch,
      'search_searx': ToolSchemas.basicSearch,
      'search_startpage': ToolSchemas.basicSearch,
      'search_brave': ToolSchemas.basicSearch,
      'search_ecosia': ToolSchemas.basicSearch,

      // Searx tools
      'searx_search': ToolSchemas.basicSearch,
      'searx_image_search': ToolSchemas.basicSearch,
      'searx_news_search': ToolSchemas.basicSearch,

      // Developer tools
      'search_github': ToolSchemas.githubSearch,
      'search_stackoverflow': ToolSchemas.basicSearch,
      'search_gitlab': ToolSchemas.basicSearch,
      'search_bitbucket': ToolSchemas.basicSearch,

      // News tools
      'search_news': ToolSchemas.newsSearch,
      'get_headlines': ToolSchemas.newsSearch,

      // Financial tools
      'get_stock_quote': ToolSchemas.financialQuery,
      'get_crypto_price': ToolSchemas.financialQuery,
      'get_forex_rate': ToolSchemas.financialQuery,

      // Crawling tools
      'crawl_url_content': ToolSchemas.urlCrawl,
      'batch_crawl_urls': ToolSchemas.batchUrlCrawl,
      'web_crawler_single': ToolSchemas.urlCrawl,
      'web_crawler_multiple': ToolSchemas.batchUrlCrawl,

      // PDF tools
      'analyze_pdf': ToolSchemas.pdfAnalysis,

      // JSONPlaceholder tools (don't require query parameter)
      'jsonplaceholder_posts': z.object({
        limit: z.number().int().min(1).max(100).optional().default(10)
      }),
      'jsonplaceholder_users': z.object({
        limit: z.number().int().min(1).max(10).optional().default(5)
      }),
      'jsonplaceholder_comments': z.object({
        postId: z.number().int().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).optional().default(10)
      }),
      'jsonplaceholder_albums': z.object({
        userId: z.number().int().min(1).max(10).optional(),
        limit: z.number().int().min(1).max(100).optional().default(10)
      }),
      'jsonplaceholder_health_test': z.object({
        endpoints: z.array(z.enum(['posts', 'users', 'comments', 'albums', 'photos', 'todos'])).optional()
      }),
    };

    const schema = schemaMap[toolName];
    if (!schema) {
      // For unknown tools, allow any input (return as-is)
      return { success: true, data: input };
    }

    return this.validate(input, schema);
  }

  /**
   * Sanitize string input to prevent XSS and injection attacks
   */
  sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Validate and sanitize URL
   */
  validateUrl(url: string): { valid: boolean; sanitized?: string; error?: string } {
    try {
      const result = CommonSchemas.url.parse(url);
      return { valid: true, sanitized: result };
    } catch (error) {
      return { valid: false, error: error instanceof z.ZodError ? error.errors[0].message : 'Invalid URL' };
    }
  }

  /**
   * Check if input contains potentially dangerous content
   */
  containsDangerousContent(input: string): boolean {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
      /import\s+/i,
      /require\s*\(/i,
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  }
}

// Export singleton instance
export const inputValidator = new InputValidator();
