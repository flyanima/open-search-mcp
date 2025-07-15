import { APIConfig } from './http-server.js';
import { defaultLogger as logger } from '../utils/logger.js';

export class APIConfigManager {
  private static instance: APIConfigManager;
  private config: APIConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): APIConfigManager {
    if (!APIConfigManager.instance) {
      APIConfigManager.instance = new APIConfigManager();
    }
    return APIConfigManager.instance;
  }

  private loadConfig(): APIConfig {
    const defaultConfig: APIConfig = {
      port: parseInt(process.env.API_PORT || '3000'),
      host: process.env.API_HOST || '0.0.0.0',
      apiKeys: this.loadAPIKeys(),
      enableCors: process.env.API_ENABLE_CORS !== 'false',
      rateLimit: {
        windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        max: parseInt(process.env.API_RATE_LIMIT_MAX || '100') // 100 requests per window
      }
    };

    logger.info('API Configuration loaded:', {
      port: defaultConfig.port,
      host: defaultConfig.host,
      apiKeysCount: defaultConfig.apiKeys.length,
      enableCors: defaultConfig.enableCors,
      rateLimit: defaultConfig.rateLimit
    });

    return defaultConfig;
  }

  private loadAPIKeys(): string[] {
    const apiKeysEnv = process.env.API_KEYS;
    
    if (!apiKeysEnv) {
      // Generate a default API key for development
      const defaultKey = 'dev-key-' + Math.random().toString(36).substring(2, 15);
      logger.warn('No API keys configured. Generated development key:', defaultKey);
      return [defaultKey];
    }

    const keys = apiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
    
    if (keys.length === 0) {
      throw new Error('API_KEYS environment variable is empty');
    }

    logger.info(`Loaded ${keys.length} API key(s)`);
    return keys;
  }

  public getConfig(): APIConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<APIConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('API Configuration updated');
  }

  public addAPIKey(key: string): void {
    if (!this.config.apiKeys.includes(key)) {
      this.config.apiKeys.push(key);
      logger.info('API key added');
    }
  }

  public removeAPIKey(key: string): void {
    const index = this.config.apiKeys.indexOf(key);
    if (index > -1) {
      this.config.apiKeys.splice(index, 1);
      logger.info('API key removed');
    }
  }

  public validateAPIKey(key: string): boolean {
    return this.config.apiKeys.includes(key);
  }
}

// Environment variable documentation
export const API_ENV_DOCS = {
  API_PORT: 'Port for HTTP API server (default: 3000)',
  API_HOST: 'Host for HTTP API server (default: 0.0.0.0)',
  API_KEYS: 'Comma-separated list of valid API keys',
  API_ENABLE_CORS: 'Enable CORS (default: true)',
  API_RATE_LIMIT_WINDOW: 'Rate limit window in milliseconds (default: 900000 = 15 minutes)',
  API_RATE_LIMIT_MAX: 'Maximum requests per window (default: 100)'
};
