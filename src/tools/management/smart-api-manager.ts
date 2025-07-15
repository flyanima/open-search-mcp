/**
 * 智能API管理工具
 * 提供API健康度评分、自动管理和优化建议
 */

import { ToolRegistry } from '../tool-registry.js';

/**
 * API健康度管理器
 */
class APIHealthManager {
  private healthScores: Map<string, number> = new Map();
  private lastChecked: Map<string, number> = new Map();
  private failureCount: Map<string, number> = new Map();
  private responseTimeHistory: Map<string, number[]> = new Map();

  updateAPIHealth(toolName: string, success: boolean, responseTime: number) {
    const currentScore = this.healthScores.get(toolName) || 100;
    const failures = this.failureCount.get(toolName) || 0;
    
    if (success) {
      // 成功时提升健康度
      const newScore = Math.min(100, currentScore + 2);
      this.healthScores.set(toolName, newScore);
      this.failureCount.set(toolName, Math.max(0, failures - 1));
    } else {
      // 失败时降低健康度
      const newScore = Math.max(0, currentScore - 10);
      this.healthScores.set(toolName, newScore);
      this.failureCount.set(toolName, failures + 1);
    }

    // 记录响应时间
    const times = this.responseTimeHistory.get(toolName) || [];
    times.push(responseTime);
    if (times.length > 10) times.shift(); // 只保留最近10次
    this.responseTimeHistory.set(toolName, times);
    
    this.lastChecked.set(toolName, Date.now());
  }

  getAPIHealth(toolName: string) {
    return {
      score: this.healthScores.get(toolName) || 100,
      lastChecked: this.lastChecked.get(toolName),
      failures: this.failureCount.get(toolName) || 0,
      averageResponseTime: this.getAverageResponseTime(toolName)
    };
  }

  private getAverageResponseTime(toolName: string): number {
    const times = this.responseTimeHistory.get(toolName) || [];
    if (times.length === 0) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  getAllHealthScores() {
    const scores: Record<string, any> = {};
    for (const [toolName, score] of this.healthScores.entries()) {
      scores[toolName] = this.getAPIHealth(toolName);
    }
    return scores;
  }

  getRecommendations() {
    const recommendations: string[] = [];
    const unhealthyAPIs: string[] = [];
    
    for (const [toolName, score] of this.healthScores.entries()) {
      if (score < 50) {
        unhealthyAPIs.push(toolName);
        recommendations.push(`${toolName}: 健康度过低 (${score}%), 建议检查API配置或暂时禁用`);
      } else if (score < 80) {
        recommendations.push(`${toolName}: 健康度一般 (${score}%), 建议监控并优化`);
      }
    }

    if (unhealthyAPIs.length === 0) {
      recommendations.push('所有API健康状况良好！');
    }

    return {
      recommendations,
      unhealthyAPIs,
      totalAPIs: this.healthScores.size
    };
  }
}

// 全局健康管理器实例
const healthManager = new APIHealthManager();

/**
 * 注册智能API管理工具
 */
export function registerSmartAPIManager(registry: ToolRegistry): void {
  // 1. API健康度评分
  registry.registerTool({
    name: 'api_health_scoring',
    description: 'Get health scores and performance metrics for all APIs',
    category: 'management',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        includeHistory: {
          type: 'boolean',
          description: 'Include historical performance data',
          default: false
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const allScores = healthManager.getAllHealthScores();
        const recommendations = healthManager.getRecommendations();
        
        const healthReport = {
          timestamp: new Date().toISOString(),
          total_apis: Object.keys(allScores).length,
          health_scores: allScores,
          recommendations: recommendations.recommendations,
          unhealthy_apis: recommendations.unhealthyAPIs,
          overall_health: calculateOverallHealth(allScores),
          performance_summary: generatePerformanceSummary(allScores)
        };

        return {
          success: true,
          data: healthReport
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get health scores'
        };
      }
    }
  });

  // 2. API性能优化建议
  registry.registerTool({
    name: 'api_optimization_advisor',
    description: 'Get intelligent optimization suggestions for API performance',
    category: 'management',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        focusArea: {
          type: 'string',
          description: 'Focus area: performance, reliability, cost, all',
          default: 'all'
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const focusArea = args.focusArea || 'all';
        const allScores = healthManager.getAllHealthScores();
        
        const optimizations = {
          timestamp: new Date().toISOString(),
          focus_area: focusArea,
          performance_optimizations: [] as string[],
          reliability_optimizations: [] as string[],
          cost_optimizations: [] as string[],
          general_recommendations: [] as string[]
        };

        // 性能优化建议
        if (focusArea === 'performance' || focusArea === 'all') {
          for (const [toolName, health] of Object.entries(allScores)) {
            if (health.averageResponseTime > 5000) {
              optimizations.performance_optimizations.push(
                `${toolName}: 响应时间过长 (${health.averageResponseTime}ms), 建议增加超时设置或使用缓存`
              );
            }
          }
        }

        // 可靠性优化建议
        if (focusArea === 'reliability' || focusArea === 'all') {
          for (const [toolName, health] of Object.entries(allScores)) {
            if (health.failures > 3) {
              optimizations.reliability_optimizations.push(
                `${toolName}: 失败次数过多 (${health.failures}次), 建议实现重试机制或故障转移`
              );
            }
          }
        }

        // 成本优化建议
        if (focusArea === 'cost' || focusArea === 'all') {
          optimizations.cost_optimizations.push(
            '考虑实现智能缓存以减少API调用次数',
            '对于低频使用的API，考虑按需加载',
            '监控API配额使用情况，避免超额费用'
          );
        }

        // 通用建议
        optimizations.general_recommendations.push(
          '定期监控API健康状况',
          '实现API调用日志记录',
          '设置API性能告警阈值',
          '考虑实现API负载均衡'
        );

        return {
          success: true,
          data: optimizations
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate optimization advice'
        };
      }
    }
  });

  // 3. API配置验证器
  registry.registerTool({
    name: 'api_configuration_validator',
    description: 'Validate API configurations and suggest improvements',
    category: 'management',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        checkSecrets: {
          type: 'boolean',
          description: 'Check if API secrets are properly configured',
          default: true
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const validation = {
          timestamp: new Date().toISOString(),
          configuration_status: 'checking',
          api_keys_status: {} as Record<string, any>,
          environment_issues: [] as string[],
          security_recommendations: [] as string[],
          configuration_score: 0
        };

        // 检查API密钥配置
        const requiredKeys = [
          'ALPHA_VANTAGE_API_KEY',
          'NEWSAPI_API_KEY',
          'GITHUB_TOKEN',
          'GOOGLE_API_KEY',
          'GOOGLE_SEARCH_API_KEY',
          'OPENWEATHER_API_KEY',
          'COINGECKO_API_KEY',
          'HUGGINGFACE_API_KEY'
        ];

        let configuredKeys = 0;
        for (const key of requiredKeys) {
          const isConfigured = !!process.env[key];
          validation.api_keys_status[key] = {
            configured: isConfigured,
            length: isConfigured ? process.env[key]!.length : 0
          };
          if (isConfigured) configuredKeys++;
        }

        // 计算配置分数
        validation.configuration_score = Math.round((configuredKeys / requiredKeys.length) * 100);

        // 环境问题检查
        if (configuredKeys < requiredKeys.length) {
          validation.environment_issues.push(
            `${requiredKeys.length - configuredKeys} API密钥未配置，这将影响相关功能`
          );
        }

        // 安全建议
        validation.security_recommendations.push(
          '确保API密钥存储在安全的环境变量中',
          '定期轮换API密钥',
          '监控API密钥使用情况',
          '不要在代码中硬编码API密钥'
        );

        validation.configuration_status = validation.configuration_score >= 80 ? 'good' : 
                                        validation.configuration_score >= 60 ? 'fair' : 'poor';

        return {
          success: true,
          data: validation
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to validate configuration'
        };
      }
    }
  });

  // 4. 智能API选择器
  registry.registerTool({
    name: 'smart_api_selector',
    description: 'Intelligently select the best API for a given task',
    category: 'management',
    source: 'internal',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Task description (e.g., "search for news", "get weather", "find code")'
        },
        priority: {
          type: 'string',
          description: 'Priority: speed, reliability, accuracy, cost',
          default: 'reliability'
        }
      },
      required: ['task']
    },
    execute: async (args: any) => {
      try {
        const task = args.task.toLowerCase();
        const priority = args.priority || 'reliability';
        
        // API分类映射
        const apiCategories = {
          news: ['newsapi_search', 'google_news_search'],
          weather: ['openweather_current_weather'],
          search: ['google_web_search', 'wikipedia_article_search'],
          code: ['github_repository_search', 'github_code_search'],
          financial: ['alpha_vantage_stock_quote', 'coingecko_coin_price'],
          books: ['openlibrary_book_search'],
          ai: ['huggingface_model_search', 'huggingface_sentiment_analysis'],
          test: ['jsonplaceholder_posts', 'jsonplaceholder_users']
        };

        // 根据任务找到相关API
        let relevantAPIs: string[] = [];
        for (const [category, apis] of Object.entries(apiCategories)) {
          if (task.includes(category)) {
            relevantAPIs.push(...apis);
          }
        }

        // 如果没有找到特定API，提供通用搜索
        if (relevantAPIs.length === 0) {
          relevantAPIs = ['google_web_search', 'wikipedia_article_search'];
        }

        // 根据优先级和健康度排序
        const rankedAPIs = relevantAPIs.map(api => {
          const health = healthManager.getAPIHealth(api);
          let score = health.score;
          
          // 根据优先级调整分数
          switch (priority) {
            case 'speed':
              score += health.averageResponseTime < 2000 ? 20 : -10;
              break;
            case 'reliability':
              score += health.failures === 0 ? 20 : -health.failures * 5;
              break;
            case 'accuracy':
              // 某些API在准确性上有优势
              if (api.includes('google') || api.includes('wikipedia')) score += 15;
              break;
            case 'cost':
              // 免费API优先
              if (api.includes('wikipedia') || api.includes('jsonplaceholder')) score += 25;
              break;
          }
          
          return { api, score, health };
        }).sort((a, b) => b.score - a.score);

        const selection = {
          task: args.task,
          priority,
          recommended_api: rankedAPIs[0]?.api,
          alternatives: rankedAPIs.slice(1, 3).map(item => item.api),
          ranking_details: rankedAPIs,
          reasoning: generateSelectionReasoning(rankedAPIs[0], priority)
        };

        return {
          success: true,
          data: {
            source: 'Smart API Selector',
            selection,
            timestamp: Date.now()
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to select API'
        };
      }
    }
  });

}

// 辅助函数
function calculateOverallHealth(scores: Record<string, any>): number {
  const values = Object.values(scores).map((s: any) => s.score);
  if (values.length === 0) return 100;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function generatePerformanceSummary(scores: Record<string, any>) {
  const responseTimes = Object.values(scores).map((s: any) => s.averageResponseTime).filter(t => t > 0);
  const failures = Object.values(scores).map((s: any) => s.failures);
  
  return {
    average_response_time: responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0,
    total_failures: failures.reduce((a, b) => a + b, 0),
    apis_with_issues: failures.filter(f => f > 0).length
  };
}

function generateSelectionReasoning(topChoice: any, priority: string): string {
  if (!topChoice) return 'No suitable API found';
  
  const reasons = [
    `${topChoice.api} 被选择因为:`,
    `- 健康度评分: ${topChoice.health.score}/100`,
    `- 平均响应时间: ${topChoice.health.averageResponseTime}ms`,
    `- 失败次数: ${topChoice.health.failures}`,
    `- 优先级匹配: ${priority}`
  ];
  
  return reasons.join('\n');
}

// 导出健康管理器供其他模块使用
export { healthManager };
