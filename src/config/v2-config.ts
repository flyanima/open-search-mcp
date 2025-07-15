/**
 * Open Search MCP v2.0 配置文件
 * 阶段一：多API聚合与智能调度配置
 */

import { APIAggregatorConfig } from '../aggregation/api-aggregator.js';
import { SearxClusterConfig } from '../searx/searx-cluster.js';

export interface V2Config {
  // 阶段一配置
  phase1: {
    apiAggregator: APIAggregatorConfig;
    searxCluster: SearxClusterConfig;
    monitoring: MonitoringConfig;
  };
  
  // 全局配置
  global: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    environment: 'development' | 'production' | 'test';
    version: string;
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  port: number;
  path: string;
  collectInterval: number;
  retentionDays: number;
}

/**
 * 默认v2.0配置
 */
export const defaultV2Config: V2Config = {
  phase1: {
    // API聚合器配置
    apiAggregator: {
      apis: {
        duckduckgo: {
          enabled: true,
          priority: 10,
          rateLimit: 100, // 每分钟请求数
          timeout: 5000,  // 5秒超时
          retryAttempts: 3
        },
        searx_primary: {
          enabled: true,
          priority: 9,
          rateLimit: 200,
          timeout: 3000,
          retryAttempts: 2
        },
        searx_backup: {
          enabled: true,
          priority: 8,
          rateLimit: 150,
          timeout: 4000,
          retryAttempts: 2
        },
        bing: {
          enabled: false, // 需要API密钥
          priority: 7,
          rateLimit: 50,
          timeout: 5000,
          retryAttempts: 3
        },
        yandex: {
          enabled: false, // 需要API密钥
          priority: 6,
          rateLimit: 80,
          timeout: 6000,
          retryAttempts: 2
        },
        brave: {
          enabled: false, // 需要API密钥
          priority: 5,
          rateLimit: 60,
          timeout: 5000,
          retryAttempts: 2
        }
      },
      loadBalancing: {
        strategy: 'health-based',
        healthCheckInterval: 30000, // 30秒
        failoverThreshold: 3 // 连续失败3次后标记为不健康
      },
      cache: {
        enabled: true,
        ttl: 3600, // 1小时
        maxSize: 1000 // 最大缓存条目数
      },
      fallback: {
        enabled: true,
        maxFallbackAttempts: 2,
        fallbackDelay: 1000 // 1秒延迟
      }
    },

    // Searx集群配置
    searxCluster: {
      nodes: [
        {
          url: 'http://localhost:8080',
          weight: 10
        },
        {
          url: 'http://localhost:8081',
          weight: 8
        },
        {
          url: 'http://localhost:8082',
          weight: 6
        }
      ],
      healthCheck: {
        interval: 30000, // 30秒
        timeout: 5000,   // 5秒
        retries: 3
      },
      loadBalancing: {
        strategy: 'response-time'
      },
      deployment: {
        dockerCompose: true,
        autoScale: false,
        minNodes: 2,
        maxNodes: 5
      }
    },

    // 监控配置
    monitoring: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectInterval: 10000, // 10秒
      retentionDays: 7
    }
  },

  // 全局配置
  global: {
    logLevel: 'info',
    environment: 'development',
    version: '2.0.0'
  }
};

/**
 * 生产环境配置
 */
export const productionV2Config: Partial<V2Config> = {
  phase1: {
    apiAggregator: {
      ...defaultV2Config.phase1.apiAggregator,
      cache: {
        enabled: true,
        ttl: 7200, // 2小时
        maxSize: 5000
      },
      loadBalancing: {
        strategy: 'health-based',
        healthCheckInterval: 60000, // 1分钟
        failoverThreshold: 5
      }
    },
    searxCluster: {
      ...defaultV2Config.phase1.searxCluster,
      deployment: {
        dockerCompose: true,
        autoScale: true,
        minNodes: 3,
        maxNodes: 10
      }
    },
    monitoring: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectInterval: 30000, // 30秒
      retentionDays: 30
    }
  },
  global: {
    logLevel: 'warn',
    environment: 'production',
    version: '2.0.0'
  }
};

/**
 * 开发环境配置
 */
export const developmentV2Config: Partial<V2Config> = {
  phase1: {
    apiAggregator: {
      ...defaultV2Config.phase1.apiAggregator,
      cache: {
        enabled: true,
        ttl: 1800, // 30分钟
        maxSize: 500
      }
    },
    searxCluster: {
      ...defaultV2Config.phase1.searxCluster
    },
    monitoring: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectInterval: 5000, // 5秒
      retentionDays: 1
    }
  },
  global: {
    logLevel: 'debug',
    environment: 'development',
    version: '2.0.0-dev'
  }
};

/**
 * 获取配置
 */
export function getV2Config(): V2Config {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return mergeConfig(defaultV2Config, productionV2Config);
    case 'development':
      return mergeConfig(defaultV2Config, developmentV2Config);
    default:
      return defaultV2Config;
  }
}

/**
 * 合并配置
 */
function mergeConfig(base: V2Config, override: Partial<V2Config>): V2Config {
  return {
    phase1: {
      apiAggregator: {
        ...base.phase1.apiAggregator,
        ...override.phase1?.apiAggregator
      },
      searxCluster: {
        ...base.phase1.searxCluster,
        ...override.phase1?.searxCluster
      },
      monitoring: {
        ...base.phase1.monitoring,
        ...override.phase1?.monitoring
      }
    },
    global: {
      ...base.global,
      ...override.global
    }
  };
}

/**
 * 验证配置
 */
export function validateV2Config(config: V2Config): boolean {
  try {
    // 验证API聚合器配置
    if (!config.phase1.apiAggregator.apis) {
      throw new Error('API aggregator configuration is missing');
    }

    // 验证至少有一个启用的API
    const enabledAPIs = Object.values(config.phase1.apiAggregator.apis)
      .filter(api => api.enabled);
    
    if (enabledAPIs.length === 0) {
      throw new Error('At least one API must be enabled');
    }

    // 验证Searx集群配置
    if (!config.phase1.searxCluster.nodes || config.phase1.searxCluster.nodes.length === 0) {
      throw new Error('Searx cluster must have at least one node');
    }

    return true;
  } catch (error) {return false;
  }
}

/**
 * 从环境变量加载配置
 */
export function loadConfigFromEnv(): Partial<V2Config> {
  return {
    phase1: {
      apiAggregator: {
        apis: {
          duckduckgo: {
            enabled: process.env.DUCKDUCKGO_ENABLED !== 'false',
            priority: parseInt(process.env.DUCKDUCKGO_PRIORITY || '10'),
            rateLimit: parseInt(process.env.DUCKDUCKGO_RATE_LIMIT || '100'),
            timeout: parseInt(process.env.DUCKDUCKGO_TIMEOUT || '5000'),
            retryAttempts: parseInt(process.env.DUCKDUCKGO_RETRY_ATTEMPTS || '3')
          }
          // 可以添加更多API的环境变量配置
        },
        loadBalancing: {
          strategy: (process.env.V2_LOAD_BALANCING_STRATEGY as any) || 'health-based',
          healthCheckInterval: parseInt(process.env.V2_HEALTH_CHECK_INTERVAL || '30000'),
          failoverThreshold: parseInt(process.env.V2_FAILOVER_THRESHOLD || '3')
        },
        cache: {
          enabled: process.env.CACHE_ENABLED !== 'false',
          ttl: parseInt(process.env.CACHE_TTL || '3600'),
          maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
        },
        fallback: {
          enabled: true,
          maxFallbackAttempts: parseInt(process.env.V2_MAX_FALLBACK_ATTEMPTS || '2'),
          fallbackDelay: parseInt(process.env.V2_FALLBACK_DELAY || '1000')
        }
      },
      searxCluster: {
        nodes: process.env.SEARX_NODES ?
          process.env.SEARX_NODES.split(',').map(url => ({ url: url.trim() })) :
          [{ url: 'http://localhost:8080' }],
        healthCheck: {
          interval: parseInt(process.env.V2_SEARX_HEALTH_CHECK_INTERVAL || '30000'),
          timeout: parseInt(process.env.V2_SEARX_HEALTH_CHECK_TIMEOUT || '5000'),
          retries: parseInt(process.env.V2_SEARX_HEALTH_CHECK_RETRIES || '3')
        },
        loadBalancing: {
          strategy: (process.env.V2_SEARX_LOAD_BALANCING_STRATEGY as any) || 'response-time'
        }
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        port: parseInt(process.env.MONITORING_PORT || '9090'),
        path: process.env.MONITORING_PATH || '/metrics',
        collectInterval: parseInt(process.env.MONITORING_COLLECT_INTERVAL || '10000'),
        retentionDays: parseInt(process.env.MONITORING_RETENTION_DAYS || '7')
      }
    },
    global: {
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      environment: (process.env.NODE_ENV as any) || 'development',
      version: process.env.APP_VERSION || '2.0.0'
    }
  };
}
