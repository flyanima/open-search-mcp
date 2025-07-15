/**
 * Configuration Manager
 * 
 * Manages all configuration for the Open Search MCP server,
 * including search engines, rate limits, caching, and tool settings.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
import { AppConfig, CacheConfig, SearchEngineConfig } from '../types.js';
import { Logger } from '../utils/logger.js';

export class ConfigManager {
  private config: AppConfig;
  private logger: Logger;
  private configPath: string;

  constructor(configPath?: string) {
    this.logger = new Logger('ConfigManager');
    this.configPath = configPath || join(process.cwd(), 'config', 'default.json');
    
    // Load environment variables
    dotenv.config();
    
    // Initialize with default configuration
    this.config = this.getDefaultConfig();
  }

  async initialize(): Promise<void> {
    try {
      // Load configuration from file if it exists
      if (existsSync(this.configPath)) {
        const fileConfig = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        this.config = this.mergeConfigs(this.config, fileConfig);
        this.logger.info(`Loaded configuration from: ${this.configPath}`);
      } else {
        this.logger.info('Using default configuration');
      }

      // Override with environment variables
      this.applyEnvironmentOverrides();
      
      // Validate configuration
      this.validateConfig();
      
      this.logger.info('Configuration initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize configuration', error);
      throw error;
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getCacheConfig(): CacheConfig {
    return this.config.cache;
  }

  getRateLimitConfig() {
    return this.config.rateLimit;
  }

  getEngineConfig(engineName: string): SearchEngineConfig | undefined {
    return this.config.engines[engineName];
  }

  getAllEngineConfigs(): Record<string, SearchEngineConfig> {
    return this.config.engines;
  }

  private getDefaultConfig(): AppConfig {
    return {
      engines: {
        // Academic Sources
        arxiv: {
          enabled: true,
          priority: 10,
          rateLimit: 60, // requests per minute
          maxResults: 50,
          timeout: 10000,
          retries: 3,
        },
        pubmed: {
          enabled: true,
          priority: 10,
          rateLimit: 60,
          maxResults: 50,
          timeout: 10000,
          retries: 3,
        },
        crossref: {
          enabled: true,
          priority: 8,
          rateLimit: 50,
          maxResults: 30,
          timeout: 15000,
          retries: 3,
        },
        
        // Web Sources
        wikipedia: {
          enabled: true,
          priority: 9,
          rateLimit: 100,
          maxResults: 20,
          timeout: 8000,
          retries: 2,
        },
        duckduckgo: {
          enabled: true,
          priority: 7,
          rateLimit: 30,
          maxResults: 20,
          timeout: 12000,
          retries: 3,
        },
        
        // Tech Sources
        github: {
          enabled: true,
          priority: 9,
          apiKey: process.env.GITHUB_TOKEN,
          rateLimit: 5000, // GitHub API limit
          maxResults: 30,
          timeout: 10000,
          retries: 3,
        },
        stackoverflow: {
          enabled: true,
          priority: 8,
          rateLimit: 300, // Stack Exchange API limit
          maxResults: 30,
          timeout: 10000,
          retries: 3,
        },
        
        // Social Sources
        reddit: {
          enabled: true,
          priority: 6,
          rateLimit: 60,
          maxResults: 25,
          timeout: 12000,
          retries: 2,
        },
        hackernews: {
          enabled: true,
          priority: 7,
          rateLimit: 100,
          maxResults: 20,
          timeout: 8000,
          retries: 2,
        },
        
        // News Sources
        newsapi: {
          enabled: !!process.env.NEWS_API_KEY,
          priority: 6,
          apiKey: process.env.NEWS_API_KEY,
          rateLimit: 1000, // NewsAPI limit
          maxResults: 20,
          timeout: 10000,
          retries: 3,
        },
      },
      
      crawler: {
        userAgent: 'OpenSearchMCP/1.0 (+https://github.com/open-search-mcp)',
        timeout: 15000,
        retries: 3,
        delay: 1000, // 1 second delay between requests
        stealth: true,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        javascript: true,
        images: false,
        maxRedirects: 5,
      },
      
      cache: {
        memory: {
          maxSize: '100MB',
          ttl: 3600, // 1 hour
        },
        file: {
          maxSize: '500MB',
          ttl: 86400, // 24 hours
          directory: './cache',
        },
        enabled: true,
      },
      
      rateLimit: {
        global: 1000, // requests per minute globally
        perEngine: 100, // requests per minute per engine
        perUser: 60, // requests per minute per user/session
      },
      
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        enableMetrics: true,
        enableRequestLogging: true,
      },
      
      security: {
        enableSanitization: true,
        enableFiltering: true,
        maxRequestSize: 1024 * 1024, // 1MB
        allowedDomains: [], // Empty means all domains allowed
        blockedDomains: [
          'malware.com',
          'phishing.com',
          // Add known malicious domains
        ],
      },
    };
  }

  private mergeConfigs(defaultConfig: AppConfig, fileConfig: Partial<AppConfig>): AppConfig {
    return {
      engines: { ...defaultConfig.engines, ...fileConfig.engines },
      crawler: { ...defaultConfig.crawler, ...fileConfig.crawler },
      cache: { ...defaultConfig.cache, ...fileConfig.cache },
      rateLimit: { ...defaultConfig.rateLimit, ...fileConfig.rateLimit },
      logging: { ...defaultConfig.logging, ...fileConfig.logging },
      security: { ...defaultConfig.security, ...fileConfig.security },
    };
  }

  private applyEnvironmentOverrides(): void {
    // Rate limits
    if (process.env.RATE_LIMIT_GLOBAL) {
      this.config.rateLimit.global = parseInt(process.env.RATE_LIMIT_GLOBAL);
    }
    
    // Cache settings
    if (process.env.CACHE_ENABLED) {
      this.config.cache.enabled = process.env.CACHE_ENABLED === 'true';
    }
    
    // Logging level
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL as any;
    }
    
    // API Keys
    if (process.env.GITHUB_TOKEN) {
      this.config.engines.github.apiKey = process.env.GITHUB_TOKEN;
    }
    
    if (process.env.NEWS_API_KEY) {
      this.config.engines.newsapi.apiKey = process.env.NEWS_API_KEY;
      this.config.engines.newsapi.enabled = true;
    }
    
    this.logger.debug('Applied environment variable overrides');
  }

  private validateConfig(): void {
    // Validate rate limits
    if (this.config.rateLimit.global <= 0) {
      throw new Error('Global rate limit must be positive');
    }
    
    // Validate cache settings
    if (this.config.cache.enabled) {
      if (this.config.cache.memory.ttl <= 0) {
        throw new Error('Memory cache TTL must be positive');
      }
      if (this.config.cache.file.ttl <= 0) {
        throw new Error('File cache TTL must be positive');
      }
    }
    
    // Validate engine configurations
    for (const [name, engine] of Object.entries(this.config.engines)) {
      if (engine.enabled) {
        if (engine.rateLimit <= 0) {
          throw new Error(`Rate limit for engine ${name} must be positive`);
        }
        if (engine.timeout <= 0) {
          throw new Error(`Timeout for engine ${name} must be positive`);
        }
        if (engine.maxResults <= 0) {
          throw new Error(`Max results for engine ${name} must be positive`);
        }
      }
    }
    
    this.logger.debug('Configuration validation passed');
  }

  /**
   * Get enabled engines sorted by priority
   */
  getEnabledEngines(): Array<{ name: string; config: SearchEngineConfig }> {
    return Object.entries(this.config.engines)
      .filter(([_, config]) => config.enabled)
      .sort(([_, a], [__, b]) => b.priority - a.priority)
      .map(([name, config]) => ({ name, config }));
  }

  /**
   * Check if an engine is enabled and configured
   */
  isEngineEnabled(engineName: string): boolean {
    const engine = this.config.engines[engineName];
    return engine?.enabled === true;
  }

  /**
   * Get configuration for Function Calling optimization
   */
  getFunctionCallingConfig() {
    return {
      maxConcurrentTools: 200, // Support for 200+ concurrent Function Calls
      toolTimeout: 3000, // 3 seconds per tool for fast response
      batchSize: 50, // Process tools in batches of 50
      retryAttempts: 2,
      enableCaching: this.config.cache.enabled,
      enableRateLimiting: true,
    };
  }
}
