/**
 * 增强的配置管理系统
 * 支持多环境配置、动态重载、配置验证和加密存储
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from '../utils/logger.js';

export interface ConfigSchema {
  api: {
    keys: Record<string, string>;
    endpoints: Record<string, string>;
    timeouts: Record<string, number>;
    retries: Record<string, number>;
  };
  cache: {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
    cleanupInterval: number;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'simple';
    file?: string;
    maxSize?: string;
    maxFiles?: number;
  };
  security: {
    encryptionKey?: string;
    allowedOrigins: string[];
    corsEnabled: boolean;
  };
  performance: {
    maxConcurrentRequests: number;
    requestTimeout: number;
    enableMetrics: boolean;
  };
  features: {
    enableAdvancedSearch: boolean;
    enableCaching: boolean;
    enableRateLimit: boolean;
    enableMetrics: boolean;
  };
}

export interface EnvironmentConfig {
  development: Partial<ConfigSchema>;
  production: Partial<ConfigSchema>;
  test: Partial<ConfigSchema>;
}

export class EnhancedConfigManager {
  private config: ConfigSchema;
  private environment: string;
  private configPath: string;
  private logger: Logger;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private encryptionKey: string;

  constructor(environment: string = process.env.NODE_ENV || 'development') {
    this.environment = environment;
    this.configPath = path.join(process.cwd(), 'config');
    this.logger = new Logger('ConfigManager');
    this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    this.config = this.loadConfiguration();
    this.setupConfigWatching();
  }

  /**
   * 加载配置
   */
  private loadConfiguration(): ConfigSchema {
    try {
      // 加载默认配置
      const defaultConfig = this.loadDefaultConfig();
      
      // 加载环境特定配置
      const envConfig = this.loadEnvironmentConfig();
      
      // 加载用户自定义配置
      const userConfig = this.loadUserConfig();
      
      // 合并配置
      const mergedConfig = this.mergeConfigs(defaultConfig, envConfig, userConfig);
      
      // 验证配置
      this.validateConfig(mergedConfig);
      
      this.logger.info(`Configuration loaded for environment: ${this.environment}`);
      return mergedConfig;
      
    } catch (error) {
      this.logger.error('Failed to load configuration:', error);
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 加载默认配置
   */
  private loadDefaultConfig(): ConfigSchema {
    return {
      api: {
        keys: {},
        endpoints: {
          google: 'https://www.googleapis.com/customsearch/v1',
          newsapi: 'https://newsapi.org/v2',
          alphavantage: 'https://www.alphavantage.co/query',
          openweather: 'https://api.openweathermap.org/data/2.5',
          github: 'https://api.github.com',
          reddit: 'https://www.reddit.com/api/v1',
          coingecko: 'https://api.coingecko.com/api/v3',
          huggingface: 'https://api-inference.huggingface.co'
        },
        timeouts: {
          default: 10000,
          search: 15000,
          download: 30000
        },
        retries: {
          default: 3,
          search: 2,
          critical: 5
        }
      },
      cache: {
        enabled: true,
        defaultTTL: 3600,
        maxSize: 1000,
        cleanupInterval: 300
      },
      rateLimit: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 100,
        skipSuccessfulRequests: false
      },
      logging: {
        level: 'info',
        format: 'json'
      },
      security: {
        allowedOrigins: ['*'],
        corsEnabled: true
      },
      performance: {
        maxConcurrentRequests: 10,
        requestTimeout: 30000,
        enableMetrics: true
      },
      features: {
        enableAdvancedSearch: true,
        enableCaching: true,
        enableRateLimit: true,
        enableMetrics: true
      }
    };
  }

  /**
   * 加载环境配置
   */
  private loadEnvironmentConfig(): Partial<ConfigSchema> {
    const envConfigPath = path.join(this.configPath, `${this.environment}.json`);
    
    if (fs.existsSync(envConfigPath)) {
      try {
        const envConfigContent = fs.readFileSync(envConfigPath, 'utf8');
        return JSON.parse(envConfigContent);
      } catch (error) {
        this.logger.warn(`Failed to load environment config: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {};
  }

  /**
   * 加载用户自定义配置
   */
  private loadUserConfig(): Partial<ConfigSchema> {
    const userConfigPath = path.join(this.configPath, 'user.json');
    
    if (fs.existsSync(userConfigPath)) {
      try {
        const userConfigContent = fs.readFileSync(userConfigPath, 'utf8');
        const encryptedConfig = JSON.parse(userConfigContent);
        
        // 如果配置是加密的，解密它
        if (encryptedConfig.encrypted) {
          return this.decryptConfig(encryptedConfig.data);
        }
        
        return encryptedConfig;
      } catch (error) {
        this.logger.warn(`Failed to load user config: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {};
  }

  /**
   * 合并配置
   */
  private mergeConfigs(...configs: Partial<ConfigSchema>[]): ConfigSchema {
    let merged = this.loadDefaultConfig();

    for (const config of configs) {
      merged = this.deepMerge(merged, config) as ConfigSchema;
    }

    return merged;
  }

  /**
   * 深度合并对象
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * 验证配置
   */
  private validateConfig(config: ConfigSchema): void {
    const requiredPaths = [
      'api.endpoints',
      'cache.enabled',
      'logging.level',
      'performance.maxConcurrentRequests'
    ];
    
    for (const path of requiredPaths) {
      if (!this.getNestedValue(config, path)) {
        throw new Error(`Required configuration path missing: ${path}`);
      }
    }
    
    // 验证日志级别
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logging.level)) {
      throw new Error(`Invalid log level: ${config.logging.level}`);
    }
    
    // 验证数值范围
    if (config.performance.maxConcurrentRequests <= 0) {
      throw new Error('maxConcurrentRequests must be greater than 0');
    }
    
    if (config.cache.defaultTTL <= 0) {
      throw new Error('cache.defaultTTL must be greater than 0');
    }
  }

  /**
   * 获取嵌套值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 设置配置监听
   */
  private setupConfigWatching(): void {
    if (this.environment === 'development') {
      const configFiles = [
        path.join(this.configPath, `${this.environment}.json`),
        path.join(this.configPath, 'user.json')
      ];
      
      configFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
              this.logger.info(`Configuration file changed: ${filePath}`);
              this.reloadConfiguration();
            }
          });
          
          this.watchers.set(filePath, watcher);
        }
      });
    }
  }

  /**
   * 重新加载配置
   */
  public reloadConfiguration(): void {
    try {
      const newConfig = this.loadConfiguration();
      this.config = newConfig;
      this.logger.info('Configuration reloaded successfully');
    } catch (error) {
      this.logger.error('Failed to reload configuration:', error);
    }
  }

  /**
   * 获取配置值
   */
  public get<T = any>(path: string, defaultValue?: T): T {
    const value = this.getNestedValue(this.config, path);
    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * 设置配置值
   */
  public set(path: string, value: any): void {
    this.setNestedValue(this.config, path, value);
    this.logger.debug(`Configuration updated: ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * 设置嵌套值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  /**
   * 获取完整配置
   */
  public getConfig(): ConfigSchema {
    return { ...this.config };
  }

  /**
   * 保存用户配置
   */
  public async saveUserConfig(config: Partial<ConfigSchema>, encrypt: boolean = true): Promise<void> {
    try {
      const userConfigPath = path.join(this.configPath, 'user.json');
      
      // 确保配置目录存在
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }
      
      let configToSave: any = config;
      
      if (encrypt) {
        configToSave = {
          encrypted: true,
          data: this.encryptConfig(config)
        };
      }
      
      fs.writeFileSync(userConfigPath, JSON.stringify(configToSave, null, 2));
      this.logger.info('User configuration saved');
      
    } catch (error) {
      this.logger.error('Failed to save user configuration:', error);
      throw error;
    }
  }

  /**
   * 加密配置
   */
  private encryptConfig(config: any): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * 解密配置
   */
  private decryptConfig(encryptedData: string): any {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  /**
   * 生成加密密钥
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 获取API密钥
   */
  public getAPIKey(service: string): string | undefined {
    // 首先检查环境变量
    const envKey = process.env[`${service.toUpperCase()}_API_KEY`];
    if (envKey) return envKey;
    
    // 然后检查配置文件
    return this.get(`api.keys.${service}`);
  }

  /**
   * 设置API密钥
   */
  public setAPIKey(service: string, key: string): void {
    this.set(`api.keys.${service}`, key);
  }

  /**
   * 获取环境信息
   */
  public getEnvironment(): string {
    return this.environment;
  }

  /**
   * 检查功能是否启用
   */
  public isFeatureEnabled(feature: string): boolean {
    return this.get(`features.${feature}`, false);
  }

  /**
   * 获取配置摘要
   */
  public getConfigSummary(): any {
    return {
      environment: this.environment,
      apiKeysConfigured: Object.keys(this.config.api.keys).length,
      cacheEnabled: this.config.cache.enabled,
      rateLimitEnabled: this.config.rateLimit.enabled,
      logLevel: this.config.logging.level,
      featuresEnabled: Object.entries(this.config.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature)
    };
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
    this.logger.info('Configuration manager cleaned up');
  }
}

// 单例实例
let configManagerInstance: EnhancedConfigManager | null = null;

export function getConfigManager(): EnhancedConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new EnhancedConfigManager();
  }
  return configManagerInstance;
}

export function resetConfigManager(): void {
  if (configManagerInstance) {
    configManagerInstance.cleanup();
    configManagerInstance = null;
  }
}
