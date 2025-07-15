import { ToolInput, ToolOutput } from '../../types.js';
import { Logger } from '../../utils/logger.js';
import { NewsAPISearchClient } from '../../api/clients/newsapi-search-client.js';

/**
 * NewsAPI 管理面板工具
 * 提供API使用情况监控、性能分析、配置管理等功能
 */

const logger = new Logger('NewsAPIAdminDashboard');

export async function newsAPIAdminDashboard(args: ToolInput): Promise<ToolOutput> {
  try {
    const action = args.action || 'overview';
    
    switch (action) {
      case 'overview':
        return await getOverview();
      case 'usage':
        return await getUsageStats();
      case 'test':
        return await testConnection();
      case 'sources':
        return await getSourcesInfo();
      case 'recommendations':
        return await getRecommendations();
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Available actions: overview, usage, test, sources, recommendations`
        };
    }
  } catch (error) {
    logger.error('NewsAPI admin dashboard error:', error);
    return {
      success: false,
      error: `Admin dashboard failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 获取总览信息
 */
async function getOverview(): Promise<ToolOutput> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  const overview = {
    status: apiKey ? 'configured' : 'not_configured',
    apiKey: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'missing',
    
    // API配置
    configuration: {
      baseURL: 'https://newsapi.org/v2',
      version: 'v2',
      tier: 'Free',
      dailyLimit: 1000,
      endpoints: ['everything', 'top-headlines', 'sources']
    },
    
    // 功能状态
    features: {
      newsSearch: apiKey ? 'available' : 'disabled',
      headlinesSearch: apiKey ? 'available' : 'disabled',
      sourcesSearch: apiKey ? 'available' : 'disabled',
      smartRouting: 'enabled',
      multiLanguage: 'enabled'
    },
    
    // 支持的查询类型
    supportedQueries: {
      newsSearch: [
        '"AI news today" → 今日AI新闻',
        '"Tesla latest news" → Tesla最新新闻',
        '"COVID-19 updates" → COVID-19更新'
      ],
      headlines: [
        '"US tech headlines" → 美国科技头条',
        '"breaking news" → 突发新闻',
        '"今日头条" → 今日头条新闻'
      ],
      sources: [
        '"tech news sources" → 科技新闻来源',
        '"Chinese news sources" → 中文新闻来源',
        '"business media" → 商业媒体'
      ]
    }
  };
  
  return {
    success: true,
    data: {
      title: 'NewsAPI 管理面板 - 总览',
      overview,
      summary: generateOverviewSummary(overview),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 获取使用统计
 */
async function getUsageStats(): Promise<ToolOutput> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'NewsAPI API key not configured'
    };
  }

  try {
    const client = new NewsAPISearchClient(apiKey);
    const stats = client.getUsageStats();
    
    const usageAnalysis = {
      current: stats,
      limits: {
        daily: 1000,
        perSecond: 1,
        tier: 'Free'
      },
      utilization: {
        dailyPercentage: (stats.requestsUsed / 1000) * 100,
        remainingRequests: stats.remainingRequests,
        resetTime: stats.resetTime
      },
      recommendations: generateUsageRecommendations(stats)
    };
    
    return {
      success: true,
      data: {
        title: 'NewsAPI 使用统计',
        usage: usageAnalysis,
        summary: generateUsageSummary(usageAnalysis),
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to get usage stats: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 测试API连接
 */
async function testConnection(): Promise<ToolOutput> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'NewsAPI API key not configured'
    };
  }

  try {
    const client = new NewsAPISearchClient(apiKey);
    
    // 测试所有端点
    const tests = [
      {
        name: 'Everything Endpoint',
        test: async () => {
          const result = await client.searchEverything({ q: 'test', pageSize: 1 });
          return { success: true, totalResults: result.totalResults };
        }
      },
      {
        name: 'Headlines Endpoint',
        test: async () => {
          const result = await client.getTopHeadlines({ country: 'us', pageSize: 1 });
          return { success: true, totalResults: result.totalResults };
        }
      },
      {
        name: 'Sources Endpoint',
        test: async () => {
          const result = await client.getSources({ category: 'technology' });
          return { success: true, totalResults: result.totalResults };
        }
      }
    ];

    const testResults = [];
    
    for (const test of tests) {
      try {
        const result = await test.test();
        testResults.push({
          name: test.name,
          status: 'success',
          ...result
        });
      } catch (error) {
        testResults.push({
          name: test.name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // 等待避免速率限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = testResults.filter(r => r.status === 'success').length;
    const overallStatus = successCount === tests.length ? 'healthy' : 'partial';
    
    return {
      success: true,
      data: {
        title: 'NewsAPI 连接测试',
        testResults,
        overallStatus,
        summary: `${successCount}/${tests.length} endpoints working properly`,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Connection test failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 获取新闻来源信息
 */
async function getSourcesInfo(): Promise<ToolOutput> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'NewsAPI API key not configured'
    };
  }

  try {
    const client = new NewsAPISearchClient(apiKey);
    const sourcesData = await client.getSources();
    
    // 分析来源分布
    const analysis = {
      totalSources: sourcesData.totalResults,
      byCategory: {} as Record<string, number>,
      byLanguage: {} as Record<string, number>,
      byCountry: {} as Record<string, number>,
      topSources: sourcesData.sources.slice(0, 10)
    };

    sourcesData.sources.forEach((source: any) => {
      // 按类别统计
      const category = source.category || 'general';
      analysis.byCategory[category] = (analysis.byCategory[category] || 0) + 1;
      
      // 按语言统计
      const language = source.language || 'unknown';
      analysis.byLanguage[language] = (analysis.byLanguage[language] || 0) + 1;
      
      // 按国家统计
      const country = source.country || 'unknown';
      analysis.byCountry[country] = (analysis.byCountry[country] || 0) + 1;
    });
    
    return {
      success: true,
      data: {
        title: 'NewsAPI 新闻来源信息',
        sources: analysis,
        summary: generateSourcesSummary(analysis),
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to get sources info: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 获取使用建议
 */
async function getRecommendations(): Promise<ToolOutput> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  const recommendations = {
    setup: [] as string[],
    usage: [] as string[],
    optimization: [] as string[],
    security: [] as string[]
  };

  // 设置建议
  if (!apiKey) {
    recommendations.setup.push('Configure NewsAPI API key in environment variables');
    recommendations.setup.push('Register for free account at https://newsapi.org/register');
  } else {
    recommendations.setup.push('API key is properly configured');
  }

  // 使用建议
  recommendations.usage.push('Use specific keywords for better search results');
  recommendations.usage.push('Leverage country and category filters for targeted news');
  recommendations.usage.push('Monitor daily API usage to stay within limits');
  recommendations.usage.push('Use smart routing for optimal endpoint selection');

  // 优化建议
  recommendations.optimization.push('Implement caching for frequently requested news');
  recommendations.optimization.push('Use pageSize parameter to limit response size');
  recommendations.optimization.push('Consider upgrading to Developer plan for higher limits');
  recommendations.optimization.push('Batch similar requests to reduce API calls');

  // 安全建议
  recommendations.security.push('Store API key securely in environment variables');
  recommendations.security.push('Never expose API key in client-side code');
  recommendations.security.push('Monitor API usage for unusual patterns');
  recommendations.security.push('Rotate API key periodically for security');

  return {
    success: true,
    data: {
      title: 'NewsAPI 使用建议',
      recommendations,
      summary: generateRecommendationsSummary(recommendations),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 生成总览摘要
 */
function generateOverviewSummary(overview: any): string {
  const status = overview.status === 'configured' ? '已配置' : '未配置';
  const featuresCount = Object.values(overview.features).filter(f => f === 'available' || f === 'enabled').length;
  
  return `NewsAPI状态: ${status}, 可用功能: ${featuresCount}/5, 支持3个核心端点和智能路由`;
}

/**
 * 生成使用统计摘要
 */
function generateUsageSummary(usage: any): string {
  const percentage = usage.utilization.dailyPercentage.toFixed(1);
  const remaining = usage.utilization.remainingRequests;
  
  return `今日使用: ${usage.current.requestsUsed}/1000次 (${percentage}%), 剩余: ${remaining}次`;
}

/**
 * 生成来源信息摘要
 */
function generateSourcesSummary(analysis: any): string {
  const categories = Object.keys(analysis.byCategory).length;
  const languages = Object.keys(analysis.byLanguage).length;
  const countries = Object.keys(analysis.byCountry).length;
  
  return `总计${analysis.totalSources}个新闻来源, 覆盖${categories}个类别, ${languages}种语言, ${countries}个国家`;
}

/**
 * 生成建议摘要
 */
function generateRecommendationsSummary(recommendations: any): string {
  const totalRecommendations = Object.values(recommendations).reduce((sum: number, arr: any) => sum + arr.length, 0);
  return `提供${totalRecommendations}条建议, 涵盖设置、使用、优化和安全4个方面`;
}

/**
 * 生成使用建议
 */
function generateUsageRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.usagePercentage > 80) {
    recommendations.push('Daily usage is high, consider upgrading to Developer plan');
  } else if (stats.usagePercentage > 50) {
    recommendations.push('Monitor usage closely to avoid hitting daily limit');
  } else {
    recommendations.push('Usage is within normal range');
  }
  
  if (stats.remainingRequests < 100) {
    recommendations.push('Low remaining requests, implement caching to reduce API calls');
  }
  
  return recommendations;
}

/**
 * 工具注册信息
 */
export const newsAPIAdminDashboardTool = {
  name: 'newsapi_admin_dashboard',
  description: 'NewsAPI administration dashboard for monitoring usage, testing connections, and managing configuration',
  category: 'admin',
  source: 'newsapi.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        description: 'Dashboard action to perform',
        enum: ['overview', 'usage', 'test', 'sources', 'recommendations'],
        default: 'overview'
      }
    },
    required: []
  },
  execute: newsAPIAdminDashboard,
  examples: [
    {
      action: 'overview',
      description: 'Get NewsAPI system overview'
    },
    {
      action: 'usage',
      description: 'Get API usage statistics'
    },
    {
      action: 'test',
      description: 'Test API connection and endpoints'
    },
    {
      action: 'sources',
      description: 'Get news sources information'
    },
    {
      action: 'recommendations',
      description: 'Get usage and optimization recommendations'
    }
  ]
};
