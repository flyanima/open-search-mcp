/**
 * 系统完整性检查工具
 * 验证API配置、环境设置和系统依赖
 */

import { ToolRegistry } from '../tool-registry.js';
import fs from 'fs';
import path from 'path';

/**
 * 注册系统完整性检查工具
 */
export function registerIntegrityCheckTools(registry: ToolRegistry): void {
  // 1. 环境配置检查
  registry.registerTool({
    name: 'system_environment_check',
    description: 'Comprehensive check of environment configuration and API keys',
    category: 'system',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        includeSecrets: {
          type: 'boolean',
          description: 'Include partial API key values in output (for debugging)',
          default: false
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const envCheck = {
          timestamp: new Date().toISOString(),
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
          api_keys: {} as Record<string, any>,
          file_system: {} as Record<string, any>,
          recommendations: [] as string[]
        };

        // 检查API密钥
        const apiKeys = [
          'ALPHA_VANTAGE_API_KEY',
          'NEWSAPI_API_KEY',
          'GITHUB_TOKEN',
          'GOOGLE_API_KEY',
          'GOOGLE_SEARCH_API_KEY',
          'GOOGLE_SEARCH_ENGINE_ID',
          'OPENWEATHER_API_KEY',
          'REDDIT_CLIENT_ID',
          'REDDIT_CLIENT_SECRET',
          'COINGECKO_API_KEY',
          'HUGGINGFACE_API_KEY'
        ];

        for (const key of apiKeys) {
          const value = process.env[key];
          envCheck.api_keys[key] = {
            configured: !!value,
            length: value ? value.length : 0,
            partial_value: args.includeSecrets && value ? 
              `${value.substring(0, 6)}...${value.substring(value.length - 4)}` : 
              undefined
          };
        }

        // 检查文件系统
        const importantFiles = [
          '.env',
          'package.json',
          'tsconfig.json',
          'dist/index.js',
          'src/index.ts'
        ];

        for (const file of importantFiles) {
          try {
            const stats = fs.statSync(file);
            envCheck.file_system[file] = {
              exists: true,
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
          } catch (error) {
            envCheck.file_system[file] = {
              exists: false,
              error: 'File not found'
            };
          }
        }

        // 生成建议
        const configuredKeys = Object.values(envCheck.api_keys).filter(k => k.configured).length;
        const totalKeys = apiKeys.length;
        
        if (configuredKeys < totalKeys) {
          envCheck.recommendations.push(`${totalKeys - configuredKeys} API keys are missing. Configure them for full functionality.`);
        }

        if (!envCheck.file_system['.env']?.exists) {
          envCheck.recommendations.push('Create .env file for environment variables');
        }

        if (!envCheck.file_system['dist/index.js']?.exists) {
          envCheck.recommendations.push('Run "npm run build" to compile TypeScript');
        }

        if (envCheck.recommendations.length === 0) {
          envCheck.recommendations.push('Environment configuration looks good!');
        }

        return {
          success: true,
          data: envCheck
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Environment check failed'
        };
      }
    }
  });

  // 2. API连接测试
  registry.registerTool({
    name: 'system_api_connectivity_test',
    description: 'Test connectivity to all configured APIs',
    category: 'system',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: {
          type: 'number',
          description: 'Timeout for each API test in milliseconds',
          default: 10000,
          minimum: 1000,
          maximum: 30000
        },
        includeDetails: {
          type: 'boolean',
          description: 'Include detailed response information',
          default: false
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const timeout = args.timeout || 10000;
        const connectivityTest = {
          timestamp: new Date().toISOString(),
          timeout_ms: timeout,
          api_tests: {} as Record<string, any>,
          summary: {
            total_apis: 0,
            successful: 0,
            failed: 0,
            success_rate: 0
          }
        };

        // 定义API测试
        const apiTests = [
          {
            name: 'Alpha Vantage',
            test: async () => {
              if (!process.env.ALPHA_VANTAGE_API_KEY) throw new Error('API key not configured');
              const tool = registry.getTool('alpha_vantage_symbol_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ keywords: 'test' });
            }
          },
          {
            name: 'NewsAPI',
            test: async () => {
              if (!process.env.NEWSAPI_API_KEY) throw new Error('API key not configured');
              const tool = registry.getTool('newsapi_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ query: 'test', maxResults: 1 });
            }
          },
          {
            name: 'GitHub',
            test: async () => {
              if (!process.env.GITHUB_TOKEN) throw new Error('Token not configured');
              const tool = registry.getTool('github_repository_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ query: 'test', maxResults: 1 });
            }
          },
          {
            name: 'OpenWeather',
            test: async () => {
              if (!process.env.OPENWEATHER_API_KEY) throw new Error('API key not configured');
              const tool = registry.getTool('openweather_current_weather');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ location: 'London' });
            }
          },
          {
            name: 'CoinGecko',
            test: async () => {
              if (!process.env.COINGECKO_API_KEY) throw new Error('API key not configured');
              const tool = registry.getTool('coingecko_coin_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ query: 'bitcoin' });
            }
          },
          {
            name: 'Hugging Face',
            test: async () => {
              if (!process.env.HUGGINGFACE_API_KEY) throw new Error('API key not configured');
              const tool = registry.getTool('huggingface_model_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ query: 'gpt', maxResults: 1 });
            }
          },
          {
            name: 'Reddit Enhanced',
            test: async () => {
              const tool = registry.getTool('reddit_enhanced_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ query: 'test', maxResults: 1 });
            }
          },
          {
            name: 'Google Search',
            test: async () => {
              if (!process.env.GOOGLE_SEARCH_API_KEY) throw new Error('API key not configured');
              const tool = registry.getTool('google_web_search');
              if (!tool) throw new Error('Tool not registered');
              return await tool.execute({ query: 'test', limit: 1 });
            }
          }
        ];

        connectivityTest.summary.total_apis = apiTests.length;

        // 执行API测试
        for (const apiTest of apiTests) {
          const startTime = Date.now();
          try {
            const result = await Promise.race([
              apiTest.test(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
              )
            ]);

            const responseTime = Date.now() - startTime;
            const success = result && (result as any).success;

            connectivityTest.api_tests[apiTest.name] = {
              status: success ? 'success' : 'failed',
              response_time: responseTime,
              error: success ? null : (result as any)?.error || 'Unknown error',
              details: args.includeDetails ? result : undefined
            };

            if (success) {
              connectivityTest.summary.successful++;
            } else {
              connectivityTest.summary.failed++;
            }

          } catch (error) {
            const responseTime = Date.now() - startTime;
            connectivityTest.api_tests[apiTest.name] = {
              status: 'failed',
              response_time: responseTime,
              error: error instanceof Error ? error.message : 'Unknown error',
              details: null
            };
            connectivityTest.summary.failed++;
          }
        }

        connectivityTest.summary.success_rate = 
          (connectivityTest.summary.successful / connectivityTest.summary.total_apis) * 100;

        return {
          success: true,
          data: connectivityTest
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Connectivity test failed'
        };
      }
    }
  });

  // 3. 系统性能检查
  registry.registerTool({
    name: 'system_performance_check',
    description: 'Check system performance and resource usage',
    category: 'system',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async (args: any) => {
      try {
        const performanceCheck = {
          timestamp: new Date().toISOString(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
          },
          uptime: {
            process: Math.round(process.uptime()),
            system: Math.round(require('os').uptime())
          },
          cpu: {
            load_average: require('os').loadavg(),
            cpu_count: require('os').cpus().length
          },
          tools: {
            total_registered: registry.getToolCount(),
            categories: getToolCategories(registry)
          },
          recommendations: [] as string[]
        };

        // 生成性能建议
        if (performanceCheck.memory.used > 500) {
          performanceCheck.recommendations.push('High memory usage detected. Consider restarting the service.');
        }

        if (performanceCheck.tools.total_registered < 30) {
          performanceCheck.recommendations.push('Some tools may not be registered. Check tool registration.');
        }

        if (performanceCheck.recommendations.length === 0) {
          performanceCheck.recommendations.push('System performance looks good!');
        }

        return {
          success: true,
          data: performanceCheck
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Performance check failed'
        };
      }
    }
  });

}

// 辅助函数
function getToolCategories(registry: ToolRegistry): Record<string, number> {
  const tools = registry.getAllTools();
  const categories: Record<string, number> = {};
  
  for (const tool of tools) {
    const category = tool.category || 'unknown';
    categories[category] = (categories[category] || 0) + 1;
  }
  
  return categories;
}
