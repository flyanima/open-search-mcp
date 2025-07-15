/**
 * API Key Manager
 * Securely manages and validates API keys, supports environment variables and config files
 *
 * SECURITY NOTICE:
 * - All API keys must be stored in environment variables
 * - Never hardcode API keys in source code
 * - Regularly rotate API keys
 * - Monitor API key usage for suspicious activity
 */

import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';

/**
 * API Key Configuration Interface
 */
export interface APIKeyConfig {
  /** Google Search API Key */
  googleApiKey?: string;
  /** Google Search Engine ID */
  googleSearchEngineId?: string;
  /** Alpha Vantage API Key */
  alphaVantageApiKey?: string;
  /** NewsAPI Key */
  newsApiKey?: string;
  /** GitHub Token */
  githubToken?: string;
  /** Reddit Client ID */
  redditClientId?: string;
  /** Reddit Client Secret */
  redditClientSecret?: string;
  /** OpenWeather API Key */
  openWeatherApiKey?: string;
  /** Hugging Face API Key */
  huggingFaceApiKey?: string;
  /** CoinGecko API Key */
  coinGeckoApiKey?: string;
  /** YouTube API Key */
  youtubeApiKey?: string;
  /** Twitter Bearer Token */
  twitterBearerToken?: string;
}

/**
 * API Key Validation Result
 */
export interface APIKeyValidation {
  /** Key name */
  keyName: string;
  /** Is valid */
  isValid: boolean;
  /** Key source */
  source: 'environment' | 'config' | 'hardcoded' | 'missing';
  /** Validation message */
  message: string;
  /** Is test key */
  isTestKey?: boolean;
}

/**
 * API Key Manager
 *
 * SECURITY FEATURES:
 * - Environment variable priority
 * - Input validation and sanitization
 * - Test key detection
 * - Secure key format validation
 * - No hardcoded keys in production
 */
export class APIKeyManager {
  private logger: Logger;
  private config: APIKeyConfig;
  private configFilePath: string;

  constructor() {
    this.logger = new Logger('APIKeyManager');
    this.configFilePath = path.join(process.cwd(), '.env');
    this.config = {};
    this.loadConfiguration();
  }

  /**
   * Load configuration with security priority
   */
  private loadConfiguration(): void {
    this.logger.info('Loading API key configuration...');

    // 1. Load from environment variables (highest priority)
    this.loadFromEnvironment();

    // 2. Load from .env file if exists (fallback)
    this.loadFromEnvFile();

    // 3. Security: No hardcoded keys in production
    this.loadHardcodedKeys();

    // 4. Validate configuration security
    this.validateConfigurationSecurity();

    this.logger.info('API key configuration loaded');
  }

  /**
   * 从环境变量加载
   */
  private loadFromEnvironment(): void {
    this.config = {
      googleApiKey: process.env.GOOGLE_API_KEY,
      googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
      alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
      newsApiKey: process.env.NEWSAPI_API_KEY,
      githubToken: process.env.GITHUB_TOKEN,
      redditClientId: process.env.REDDIT_CLIENT_ID,
      redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
      openWeatherApiKey: process.env.OPENWEATHER_API_KEY,
      huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY,
      coinGeckoApiKey: process.env.COINGECKO_API_KEY,
      youtubeApiKey: process.env.YOUTUBE_API_KEY,
      twitterBearerToken: process.env.TWITTER_BEARER_TOKEN
    };
  }

  /**
   * 从.env文件加载
   */
  private loadFromEnvFile(): void {
    if (fs.existsSync(this.configFilePath)) {
      try {
        const envContent = fs.readFileSync(this.configFilePath, 'utf8');
        const envLines = envContent.split('\n');

        for (const line of envLines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, value] = trimmedLine.split('=');
            if (key && value) {
              const cleanKey = key.trim();
              const cleanValue = value.trim().replace(/^["']|["']$/g, '');
              
              // 映射到配置对象
              switch (cleanKey) {
                case 'GOOGLE_API_KEY':
                  this.config.googleApiKey = this.config.googleApiKey || cleanValue;
                  break;
                case 'GOOGLE_SEARCH_ENGINE_ID':
                  this.config.googleSearchEngineId = this.config.googleSearchEngineId || cleanValue;
                  break;
                case 'ALPHA_VANTAGE_API_KEY':
                  this.config.alphaVantageApiKey = this.config.alphaVantageApiKey || cleanValue;
                  break;
                case 'NEWSAPI_API_KEY':
                  this.config.newsApiKey = this.config.newsApiKey || cleanValue;
                  break;
                case 'GITHUB_TOKEN':
                  this.config.githubToken = this.config.githubToken || cleanValue;
                  break;
                case 'REDDIT_CLIENT_ID':
                  this.config.redditClientId = this.config.redditClientId || cleanValue;
                  break;
                case 'REDDIT_CLIENT_SECRET':
                  this.config.redditClientSecret = this.config.redditClientSecret || cleanValue;
                  break;
                case 'OPENWEATHER_API_KEY':
                  this.config.openWeatherApiKey = this.config.openWeatherApiKey || cleanValue;
                  break;
                case 'HUGGINGFACE_API_KEY':
                  this.config.huggingFaceApiKey = this.config.huggingFaceApiKey || cleanValue;
                  break;
                case 'COINGECKO_API_KEY':
                  this.config.coinGeckoApiKey = this.config.coinGeckoApiKey || cleanValue;
                  break;
                case 'YOUTUBE_API_KEY':
                  this.config.youtubeApiKey = this.config.youtubeApiKey || cleanValue;
                  break;
                case 'TWITTER_BEARER_TOKEN':
                  this.config.twitterBearerToken = this.config.twitterBearerToken || cleanValue;
                  break;
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to load .env file:', error);
      }
    }
  }

  /**
   * Load hardcoded keys as fallback (development only)
   * SECURITY: Hardcoded keys removed for security - use environment variables instead
   */
  private loadHardcodedKeys(): void {
    // Security: No hardcoded keys in open source version
    // Users must configure API keys via environment variables or config files
    this.logger.info('Hardcoded keys disabled for security. Please configure API keys via environment variables.');

    // Example of how to set environment variables:
    // GOOGLE_API_KEY=your_key_here
    // ALPHA_VANTAGE_API_KEY=your_key_here
    // etc.
  }

  /**
   * Validate configuration security
   */
  private validateConfigurationSecurity(): void {
    const validations = this.validateAllKeys();
    const testKeys = validations.filter(v => v.isTestKey);
    const hardcodedKeys = validations.filter(v => v.source === 'hardcoded');

    if (testKeys.length > 0) {
      this.logger.warn(`Found ${testKeys.length} test/placeholder keys. Replace with real API keys.`);
    }

    if (hardcodedKeys.length > 0) {
      this.logger.warn(`Found ${hardcodedKeys.length} hardcoded keys. Use environment variables instead.`);
    }

    // Log security summary
    const envKeys = validations.filter(v => v.source === 'environment').length;
    this.logger.info(`Security summary: ${envKeys} keys from environment, ${testKeys.length} test keys, ${hardcodedKeys.length} hardcoded keys`);
  }

  /**
   * 获取API密钥
   */
  getAPIKey(service: keyof APIKeyConfig): string | undefined {
    return this.config[service];
  }

  /**
   * 验证所有API密钥
   */
  validateAllKeys(): APIKeyValidation[] {
    const validations: APIKeyValidation[] = [];

    const keyMappings: Array<{ key: keyof APIKeyConfig; name: string; required: boolean }> = [
      { key: 'googleApiKey', name: 'Google API Key', required: true },
      { key: 'googleSearchEngineId', name: 'Google Search Engine ID', required: true },
      { key: 'alphaVantageApiKey', name: 'Alpha Vantage API Key', required: false },
      { key: 'newsApiKey', name: 'NewsAPI Key', required: false },
      { key: 'githubToken', name: 'GitHub Token', required: false },
      { key: 'redditClientId', name: 'Reddit Client ID', required: false },
      { key: 'redditClientSecret', name: 'Reddit Client Secret', required: false },
      { key: 'openWeatherApiKey', name: 'OpenWeather API Key', required: false },
      { key: 'huggingFaceApiKey', name: 'Hugging Face API Key', required: false },
      { key: 'coinGeckoApiKey', name: 'CoinGecko API Key', required: false },
      { key: 'youtubeApiKey', name: 'YouTube API Key', required: false },
      { key: 'twitterBearerToken', name: 'Twitter Bearer Token', required: false }
    ];

    for (const mapping of keyMappings) {
      const validation = this.validateKey(mapping.key, mapping.name, mapping.required);
      validations.push(validation);
    }

    return validations;
  }

  /**
   * 验证单个API密钥
   */
  private validateKey(key: keyof APIKeyConfig, name: string, required: boolean): APIKeyValidation {
    const value = this.config[key];

    if (!value) {
      return {
        keyName: name,
        isValid: !required,
        source: 'missing',
        message: required ? 'Required API key is missing' : 'Optional API key is missing'
      };
    }

    // 检查是否为环境变量
    const envValue = process.env[this.getEnvKeyName(key)];
    const source = envValue ? 'environment' : 'hardcoded';

    // 基本格式验证
    const isValidFormat = this.validateKeyFormat(key, value);

    return {
      keyName: name,
      isValid: isValidFormat,
      source,
      message: isValidFormat ? 'API key is valid' : 'API key format is invalid',
      isTestKey: this.isTestKey(value)
    };
  }

  /**
   * 获取环境变量名称
   */
  private getEnvKeyName(key: keyof APIKeyConfig): string {
    const mapping: Record<keyof APIKeyConfig, string> = {
      googleApiKey: 'GOOGLE_API_KEY',
      googleSearchEngineId: 'GOOGLE_SEARCH_ENGINE_ID',
      alphaVantageApiKey: 'ALPHA_VANTAGE_API_KEY',
      newsApiKey: 'NEWSAPI_API_KEY',
      githubToken: 'GITHUB_TOKEN',
      redditClientId: 'REDDIT_CLIENT_ID',
      redditClientSecret: 'REDDIT_CLIENT_SECRET',
      openWeatherApiKey: 'OPENWEATHER_API_KEY',
      huggingFaceApiKey: 'HUGGINGFACE_API_KEY',
      coinGeckoApiKey: 'COINGECKO_API_KEY',
      youtubeApiKey: 'YOUTUBE_API_KEY',
      twitterBearerToken: 'TWITTER_BEARER_TOKEN'
    };

    return mapping[key] || '';
  }

  /**
   * 验证密钥格式
   */
  private validateKeyFormat(key: keyof APIKeyConfig, value: string): boolean {
    switch (key) {
      case 'googleApiKey':
        return value.startsWith('AIza') && value.length === 39;
      case 'alphaVantageApiKey':
        return value.length >= 8 && /^[A-Z0-9]+$/.test(value);
      case 'newsApiKey':
        return value.length === 32 && /^[a-f0-9]+$/.test(value);
      case 'githubToken':
        return value.startsWith('ghp_') || value.startsWith('github_pat_');
      case 'openWeatherApiKey':
        return value.length === 32 && /^[a-f0-9]+$/.test(value);
      case 'coinGeckoApiKey':
        return value.startsWith('CG-');
      default:
        return value.length > 0;
    }
  }

  /**
   * Check if key is a test/placeholder key
   */
  private isTestKey(value: string): boolean {
    // Security: Test key patterns removed for open source version
    // Users should use real API keys, not test/placeholder keys
    const testPatterns = [
      'your_key_here',
      'your_api_key_here',
      'your_token_here',
      'test_key',
      'demo_key'
    ];

    return testPatterns.some(pattern => value.includes(pattern));
  }

  /**
   * 创建.env文件模板
   */
  createEnvTemplate(): void {
    const template = `# Open-Search-MCP API Keys Configuration
# Copy this file to .env and fill in your API keys

# Google Custom Search API
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# Financial Data APIs
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# News APIs
NEWSAPI_API_KEY=your_newsapi_key_here

# Development APIs
GITHUB_TOKEN=your_github_token_here

# Social Media APIs
REDDIT_CLIENT_ID=your_reddit_client_id_here
REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Weather APIs
OPENWEATHER_API_KEY=your_openweather_key_here

# AI/ML APIs
HUGGINGFACE_API_KEY=your_huggingface_key_here
YOUTUBE_API_KEY=your_youtube_key_here

# Cryptocurrency APIs
COINGECKO_API_KEY=your_coingecko_key_here

# Note: Some APIs work without keys but have rate limits
# For production use, obtain your own API keys from respective services
`;

    const templatePath = path.join(process.cwd(), '.env.template');
    fs.writeFileSync(templatePath, template);
    this.logger.info(`Created .env template at ${templatePath}`);
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary(): { configured: number; missing: number; hardcoded: number; total: number } {
    const validations = this.validateAllKeys();
    
    return {
      configured: validations.filter(v => v.isValid && v.source === 'environment').length,
      missing: validations.filter(v => !v.isValid && v.source === 'missing').length,
      hardcoded: validations.filter(v => v.isValid && v.source === 'hardcoded').length,
      total: validations.length
    };
  }
}

// 导出单例实例
export const apiKeyManager = new APIKeyManager();
