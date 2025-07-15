/**
 * Open Search MCP - Type Definitions
 * 
 * This file contains all the TypeScript type definitions used throughout
 * the Open Search MCP server. These types ensure type safety and provide
 * clear interfaces for all components.
 */

// =============================================================================
// Core Search Types
// =============================================================================

export interface SearchOptions {
  numResults?: number;
  maxCharacters?: number;
  includeContent?: boolean;
  includeImages?: boolean;
  waitForJs?: boolean;
  timeout?: number;
  retries?: number;
  [key: string]: any;
}

// =============================================================================
// Deep Research Types
// =============================================================================

export interface DeepResearchOptions extends SearchOptions {
  topic: string;
  depth: 'shallow' | 'medium' | 'deep';
  maxSources?: number;
  includeAcademic?: boolean;
  includePDF?: boolean;
  language?: string;
  aiModel?: string;
  useLocalAI?: boolean;
  confidenceThreshold?: number;
}

export interface ResearchResult {
  topic: string;
  summary: string;
  keyFindings: string[];
  sources: EnhancedSearchResult[];
  relatedTopics: string[];
  confidence: number;
  searchStats: {
    totalSources: number;
    processedSources: number;
    pdfDocuments: number;
    academicPapers: number;
    searchTime: number;
    aiProcessingTime: number;
  };
  methodology: {
    searchStrategy: string;
    aiModelsUsed: string[];
    qualityFilters: string[];
    sourceDiversity: number;
  };
}

export interface EnhancedSearchResult extends SearchResult {
  relevanceScore: number;
  qualityScore: number;
  summary: string;
  keyPoints: string[];
  extractedEntities: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  credibilityScore: number;
  lastUpdated?: string;
  wordCount?: number;
  readingTime?: number;
}

// =============================================================================
// AI Processing Types
// =============================================================================

export interface AIProcessingOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  useLocalModel?: boolean;
  enableSummarization?: boolean;
  enableEntityExtraction?: boolean;
  enableSentimentAnalysis?: boolean;
}

export interface QueryOptimization {
  originalQuery: string;
  optimizedQueries: string[];
  expandedKeywords: string[];
  synonyms: string[];
  relatedTerms: string[];
  searchStrategy: string;
  confidence: number;
}

export interface ContentAnalysis {
  summary: string;
  keyPoints: string[];
  entities: {
    persons: string[];
    organizations: string[];
    locations: string[];
    dates: string[];
    topics: string[];
  };
  sentiment: {
    overall: 'positive' | 'negative' | 'neutral';
    confidence: number;
    aspects: Array<{
      aspect: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
    }>;
  };
  readability: {
    score: number;
    level: string;
    estimatedReadingTime: number;
  };
  credibility: {
    score: number;
    factors: string[];
    warnings: string[];
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
  score: number;
  source: string;
  type: 'web' | 'academic' | 'social' | 'company';
  metadata?: Record<string, any>;
  // v2.0 new fields
  timestamp?: string;
  relevanceScore?: number;
  aggregationMetadata?: {
    aggregatedAt: string;
    query: string;
    source: string;
  };
}

export interface SearchResponse {
  success: boolean;
  data: SearchResult[];
  metadata: {
    totalResults: number;
    searchTime: number;
    sources: string[];
    cached: boolean;
    query: string;
  };
  error?: string;
}

// =============================================================================
// Search Engine Types
// =============================================================================

export interface SearchEngineConfig {
  enabled: boolean;
  priority: number;
  apiKey?: string;
  rateLimit: number; // requests per minute
  maxResults: number;
  timeout: number;
  retries: number;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  rateLimitHits: number;
}

export abstract class BaseSearchEngine {
  abstract readonly name: string;
  abstract readonly rateLimit: number;
  abstract readonly maxResults: number;
  
  abstract search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  abstract isAvailable(): Promise<boolean>;
  abstract getUsageStats(): UsageStats;
  abstract validateConfig(): boolean;
}

// =============================================================================
// Academic Search Types
// =============================================================================

export interface AcademicSearchOptions extends SearchOptions {
  sources?: ('arxiv' | 'pubmed' | 'crossref' | 'biorxiv')[];
  dateRange?: string;
  authors?: string[];
  categories?: string[];
  includeFullText?: boolean;
}

export interface AcademicResult extends SearchResult {
  type: 'academic';
  authors: string[];
  abstract: string;
  doi?: string;
  arxivId?: string;
  pubmedId?: string;
  categories: string[];
  citationCount?: number;
  publishedDate: string;
  journal?: string;
  pdfUrl?: string;
}

// =============================================================================
// Company Research Types
// =============================================================================

export interface CompanySearchOptions extends SearchOptions {
  companyUrl?: string;
  includeNews?: boolean;
  includeFinancials?: boolean;
  includeCompetitors?: boolean;
  industry?: string;
}

export interface CompanyResult extends SearchResult {
  type: 'company';
  industry?: string;
  description?: string;
  website?: string;
  founded?: string;
  employees?: string;
  revenue?: string;
  headquarters?: string;
  competitors?: string[];
  news?: NewsItem[];
}

export interface NewsItem {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string;
  source: string;
}

// =============================================================================
// Web Crawler Types
// =============================================================================

export interface CrawlerConfig {
  userAgent: string;
  timeout: number;
  retries: number;
  delay: number;
  stealth: boolean;
  proxy?: ProxyConfig;
  headers: Record<string, string>;
  javascript: boolean;
  images: boolean;
  maxRedirects: number;
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  html?: string;
  images?: ImageInfo[];
  links?: LinkInfo[];
  metadata: {
    contentType: string;
    contentLength: number;
    lastModified?: string;
    language?: string;
    encoding: string;
    crawlTime: number;
  };
}

export interface ImageInfo {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface LinkInfo {
  href: string;
  text: string;
  title?: string;
  rel?: string;
}

// =============================================================================
// PDF Processing Types
// =============================================================================

export interface PDFSearchOptions extends SearchOptions {
  documentType: 'academic' | 'report' | 'manual' | 'any';
  maxDocuments?: number;
  includeOCR?: boolean;
  extractImages?: boolean;
  extractTables?: boolean;
  languages?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  fileSize?: {
    min?: number; // MB
    max?: number; // MB
  };
}

export interface PDFDocument {
  url: string;
  title: string;
  authors?: string[];
  abstract?: string;
  content: string;
  metadata: {
    pages: number;
    fileSize: number; // bytes
    creationDate?: string;
    modificationDate?: string;
    producer?: string;
    creator?: string;
    subject?: string;
    keywords?: string[];
    language?: string;
  };
  structure: {
    sections: PDFSection[];
    tables: PDFTable[];
    images: PDFImage[];
    references: string[];
    footnotes: string[];
  };
  analysis: {
    summary: string;
    keyFindings: string[];
    topics: string[];
    entities: string[];
    readabilityScore: number;
    academicLevel: string;
    citationCount?: number;
  };
  source: {
    database: string;
    doi?: string;
    arxivId?: string;
    pubmedId?: string;
    downloadDate: string;
  };
}

export interface PDFSection {
  title: string;
  level: number;
  content: string;
  pageStart: number;
  pageEnd: number;
  wordCount: number;
}

export interface PDFTable {
  caption?: string;
  data: string[][];
  page: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PDFImage {
  caption?: string;
  page: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  extractedText?: string; // OCR result
  description?: string; // AI-generated description
}

export interface OCROptions {
  language: string;
  engineMode: number;
  pageSegMode: number;
  preserveInterwordSpaces: boolean;
  enableConfidenceScores: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  lines: Array<{
    text: string;
    confidence: number;
    words: number[];
  }>;
  paragraphs: Array<{
    text: string;
    confidence: number;
    lines: number[];
  }>;
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CacheConfig {
  memory: {
    maxSize: string;
    ttl: number; // seconds
  };
  file: {
    maxSize: string;
    ttl: number; // seconds
    directory: string;
  };
  enabled: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface AppConfig {
  engines: Record<string, SearchEngineConfig>;
  crawler: CrawlerConfig;
  cache: CacheConfig;
  rateLimit: {
    global: number;
    perEngine: number;
    perUser: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    enableRequestLogging: boolean;
  };
  security: {
    enableSanitization: boolean;
    enableFiltering: boolean;
    maxRequestSize: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
}

// =============================================================================
// MCP Tool Types
// =============================================================================

export interface ToolInput {
  query?: string;
  maxResults?: number;
  [key: string]: any;
}

export interface ToolOutput {
  success: boolean;
  data?: any;
  metadata?: {
    totalResults?: number;
    searchTime?: number;
    sources?: string[];
    cached?: boolean;
    toolName?: string;
    fallback?: boolean;
    timestamp?: string;
    suggestion?: string;
    originalError?: string;
    errorType?: string;
    duration?: number;
    retryable?: boolean;
    [key: string]: any;
  };
  error?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly source?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export class RateLimitError extends SearchError {
  constructor(source: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${source}`, 'RATE_LIMIT_EXCEEDED', source, { retryAfter });
  }
}

export class CrawlerError extends SearchError {
  constructor(message: string, url: string, details?: any) {
    super(message, 'CRAWLER_ERROR', url, details);
  }
}

export class ConfigurationError extends SearchError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIGURATION_ERROR', undefined, details);
  }
}

// =============================================================================
// Utility Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

export interface RateLimiter {
  checkLimit(key: string): Promise<boolean>;
  getRemainingRequests(key: string): Promise<number>;
  getResetTime(key: string): Promise<Date>;
}

export interface Validator {
  validateSearchQuery(query: string): boolean;
  validateUrl(url: string): boolean;
  sanitizeInput(input: string): string;
  validateSearchOptions(options: SearchOptions): boolean;
}

// =============================================================================
// Open Search MCP v2.0 Types - Phase 1: Multi-API Aggregation and Intelligent Scheduling
// =============================================================================

/**
 * Search API Interface - Unified search API abstraction
 */
export interface SearchAPI {
  name: string;
  priority: number;
  reliability: number;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  isHealthy(): Promise<boolean>;
  getMetrics(): APIMetrics;
}

/**
 * API Health Metrics
 */
export interface APIHealthMetrics {
  isHealthy: boolean;
  responseTime: number;
  successRate: number;
  errorCount: number;
  totalRequests: number;
  lastCheck: Date;
  consecutiveFailures: number;
  averageResponseTime: number;
  uptime: number;
}

/**
 * API Performance Metrics
 */
export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  rateLimitHits: number;
  errorRate: number;
}

/**
 * Extended Search Options - v2.0
 */
export interface SearchOptions {
  maxResults?: number;
  maxSources?: number;
  sources?: string[];
  language?: string;
  timeRange?: string;
  qualityThreshold?: number;
  // Original fields maintained for compatibility
  numResults?: number;
  maxCharacters?: number;
  includeContent?: boolean;
  includeImages?: boolean;
  waitForJs?: boolean;
  timeout?: number;
  retries?: number;
}
