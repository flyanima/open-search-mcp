/**
 * 智能API路由工具
 * 自动选择最佳API，实现故障转移和负载均衡
 */

import { ToolRegistry } from '../tool-registry.js';

/**
 * 注册智能API路由工具
 */
export function registerSmartAPIRouter(registry: ToolRegistry): void {
  // 1. 智能搜索路由
  registry.registerTool({
    name: 'smart_search_router',
    description: 'Intelligently route search queries to the best available API with automatic fallback',
    category: 'routing',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to execute'
        },
        searchType: {
          type: 'string',
          description: 'Type of search: web, news, academic, social, tech, auto',
          default: 'auto'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        },
        enableFallback: {
          type: 'boolean',
          description: 'Enable automatic fallback to alternative APIs',
          default: true
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const startTime = Date.now();
        const searchType = args.searchType || 'auto';
        const maxResults = args.maxResults || 10;
        
        // 根据查询内容自动判断搜索类型
        const detectedType = searchType === 'auto' ? detectSearchType(args.query) : searchType;
        
        // 定义API优先级
        const apiPriorities = {
          web: ['google_web_search', 'search_wikipedia'],
          news: ['newsapi_search', 'newsapi_tech_news'],
          academic: ['search_arxiv', 'huggingface_model_search'],
          social: ['reddit_enhanced_search', 'reddit_enhanced_hot'],
          tech: ['github_repository_search', 'github_code_search'],
          financial: ['alpha_vantage_symbol_search', 'coingecko_coin_search']
        };

        const apis = apiPriorities[detectedType as keyof typeof apiPriorities] || apiPriorities.web;
        
        let result = null;
        let usedAPI = null;
        let attempts = [];

        // 尝试使用优先级API
        for (const apiName of apis) {
          const tool = registry.getTool(apiName);
          if (!tool) {
            attempts.push({ api: apiName, status: 'not_found', error: 'Tool not registered' });
            continue;
          }

          try {
            const apiResult = await executeAPIWithTimeout(tool, args.query, maxResults, detectedType);
            
            if (apiResult.success && apiResult.data) {
              result = apiResult;
              usedAPI = apiName;
              attempts.push({ api: apiName, status: 'success', response_time: Date.now() - startTime });
              break;
            } else {
              attempts.push({ api: apiName, status: 'failed', error: apiResult.error });
            }
          } catch (error) {
            attempts.push({ 
              api: apiName, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }

        // 如果主要API都失败，尝试备用方案
        if (!result && args.enableFallback) {
          const fallbackAPIs = ['search_wikipedia', 'reddit_enhanced_search'];
          
          for (const apiName of fallbackAPIs) {
            if (apis.includes(apiName)) continue; // 已经尝试过
            
            const tool = registry.getTool(apiName);
            if (!tool) continue;

            try {
              const apiResult = await executeAPIWithTimeout(tool, args.query, maxResults, 'fallback');
              
              if (apiResult.success && apiResult.data) {
                result = apiResult;
                usedAPI = apiName;
                attempts.push({ api: apiName, status: 'fallback_success', response_time: Date.now() - startTime });
                break;
              }
            } catch (error) {
              attempts.push({ 
                api: apiName, 
                status: 'fallback_failed', 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
            }
          }
        }

        const totalTime = Date.now() - startTime;

        if (result) {
          return {
            success: true,
            data: {
              ...result.data,
              routing_info: {
                query: args.query,
                detected_type: detectedType,
                used_api: usedAPI,
                total_response_time: totalTime,
                attempts: attempts,
                fallback_used: !apis.includes(usedAPI || ''),
                timestamp: Date.now()
              }
            }
          };
        } else {
          return {
            success: false,
            error: 'All APIs failed',
            routing_info: {
              query: args.query,
              detected_type: detectedType,
              total_response_time: totalTime,
              attempts: attempts,
              timestamp: Date.now()
            }
          };
        }

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Smart routing failed'
        };
      }
    }
  });

  // 2. 智能数据聚合路由
  registry.registerTool({
    name: 'smart_data_aggregator',
    description: 'Intelligently aggregate data from multiple APIs based on query context',
    category: 'routing',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query for data aggregation'
        },
        domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Data domains to include: financial, news, social, tech, weather, ai',
          default: ['news', 'social', 'tech']
        },
        maxPerDomain: {
          type: 'number',
          description: 'Maximum results per domain (1-20)',
          default: 5,
          minimum: 1,
          maximum: 20
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const startTime = Date.now();
        const domains = args.domains || ['news', 'social', 'tech'];
        const maxPerDomain = args.maxPerDomain || 5;
        
        const aggregatedData = {
          query: args.query,
          domains_requested: domains,
          results_by_domain: {} as Record<string, any>,
          aggregated_insights: {},
          metadata: {
            total_apis_called: 0,
            successful_apis: 0,
            total_results: 0,
            response_time: 0
          }
        };

        // 定义域到API的映射
        const domainAPIs = {
          financial: ['alpha_vantage_symbol_search', 'coingecko_coin_search'],
          news: ['newsapi_search', 'newsapi_tech_news'],
          social: ['reddit_enhanced_search', 'reddit_enhanced_hot'],
          tech: ['github_repository_search', 'huggingface_model_search'],
          weather: ['openweather_current_weather'],
          ai: ['huggingface_model_search', 'huggingface_sentiment_analysis']
        };

        const promises = [];

        // 为每个域创建API调用
        for (const domain of domains) {
          const apis = domainAPIs[domain as keyof typeof domainAPIs];
          if (!apis) continue;

          const domainPromise = executeDomainSearch(registry, domain, apis, args.query, maxPerDomain)
            .then((result: any) => ({ domain, result }))
            .catch((error: any) => ({ domain, error: error.message }));
          
          promises.push(domainPromise);
        }

        // 等待所有域的结果
        const domainResults = await Promise.all(promises);

        // 处理结果
        for (const domainResult of domainResults) {
          aggregatedData.metadata.total_apis_called++;
          
          if ('error' in domainResult) {
            aggregatedData.results_by_domain[domainResult.domain] = {
              status: 'failed',
              error: domainResult.error
            };
          } else {
            aggregatedData.results_by_domain[domainResult.domain] = {
              status: 'success',
              ...domainResult.result
            };
            aggregatedData.metadata.successful_apis++;
            aggregatedData.metadata.total_results += domainResult.result.results?.length || 0;
          }
        }

        // 生成聚合洞察
        aggregatedData.aggregated_insights = generateAggregatedInsights(aggregatedData, args.query);
        aggregatedData.metadata.response_time = Date.now() - startTime;

        return {
          success: true,
          data: aggregatedData
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Data aggregation failed'
        };
      }
    }
  });

}

// 辅助函数
function detectSearchType(query: string): string {
  const queryLower = query.toLowerCase();
  
  // 学术关键词
  if (queryLower.includes('paper') || queryLower.includes('research') || 
      queryLower.includes('study') || queryLower.includes('arxiv')) {
    return 'academic';
  }
  
  // 技术关键词
  if (queryLower.includes('code') || queryLower.includes('github') || 
      queryLower.includes('programming') || queryLower.includes('api')) {
    return 'tech';
  }
  
  // 金融关键词
  if (queryLower.includes('stock') || queryLower.includes('price') || 
      queryLower.includes('bitcoin') || queryLower.includes('crypto')) {
    return 'financial';
  }
  
  // 新闻关键词
  if (queryLower.includes('news') || queryLower.includes('breaking') || 
      queryLower.includes('latest') || queryLower.includes('today')) {
    return 'news';
  }
  
  // 社交关键词
  if (queryLower.includes('discussion') || queryLower.includes('opinion') || 
      queryLower.includes('reddit') || queryLower.includes('community')) {
    return 'social';
  }
  
  return 'web'; // 默认为网页搜索
}

async function executeAPIWithTimeout(tool: any, query: string, maxResults: number, searchType: string): Promise<any> {
  const timeout = 15000; // 15秒超时
  
  // 根据工具类型构造参数
  let args: any = {};
  
  if (tool.name.includes('google') || tool.name.includes('search')) {
    args = { query, limit: maxResults };
  } else if (tool.name.includes('github')) {
    args = { query, maxResults };
  } else if (tool.name.includes('reddit')) {
    args = { query, maxResults };
  } else if (tool.name.includes('newsapi')) {
    args = { query, maxResults };
  } else if (tool.name.includes('alpha_vantage')) {
    args = { keywords: query };
  } else if (tool.name.includes('coingecko')) {
    args = { query };
  } else if (tool.name.includes('huggingface')) {
    args = { query, maxResults };
  } else {
    args = { query, maxResults };
  }

  return await Promise.race([
    tool.execute(args),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API timeout')), timeout)
    )
  ]);
}

async function executeDomainSearch(registry: ToolRegistry, domain: string, apis: string[], query: string, maxResults: number): Promise<any> {
  for (const apiName of apis) {
    const tool = registry.getTool(apiName);
    if (!tool) continue;

    try {
      const result = await executeAPIWithTimeout(tool, query, maxResults, domain);
      if (result.success && result.data) {
        return {
          api_used: apiName,
          results: result.data.results || result.data.coins || result.data,
          source: result.data.source || apiName
        };
      }
    } catch (error) {
      continue; // 尝试下一个API
    }
  }
  
  throw new Error(`All APIs failed for domain: ${domain}`);
}

function generateAggregatedInsights(data: any, query: string): any {
  const insights = {
    query_analysis: `Aggregated search for "${query}" across ${data.domains_requested.length} domains`,
    domain_performance: [] as any[],
    cross_domain_patterns: [],
    recommendations: [] as string[]
  };

  // 分析各域性能
  for (const [domain, result] of Object.entries(data.results_by_domain)) {
    insights.domain_performance.push({
      domain,
      status: (result as any).status,
      result_count: (result as any).results?.length || 0
    });
  }

  // 生成建议
  const successfulDomains = insights.domain_performance.filter(d => d.status === 'success').length;
  if (successfulDomains < data.domains_requested.length) {
    insights.recommendations.push('Some domains failed. Consider checking API configurations.');
  }

  if (data.metadata.total_results > 50) {
    insights.recommendations.push('Large result set. Consider filtering or narrowing the query.');
  }

  return insights;
}
