/**
 * 智能搜索聚合工具
 * 整合多个API的搜索结果，提供智能分析和排序
 */

import { ToolRegistry } from '../tool-registry.js';

// 辅助函数
function extractResults(data: any, source: string): any[] {
  switch (source) {
    case 'web':
      return data.result?.results || data.results || [];
    case 'news':
      return data.results || [];
    case 'academic':
      return data.papers || data.results || [];
    case 'social':
      return data.results || [];
    case 'tech':
      return data.results || [];
    default:
      return [];
  }
}

function calculateRelevance(result: any, query: string): number {
  const text = (result.title || result.name || '') + ' ' + (result.description || result.selftext || '');
  const queryWords = query.toLowerCase().split(' ');
  let score = 0;

  for (const word of queryWords) {
    if (text.toLowerCase().includes(word)) {
      score += 1;
    }
  }

  return score;
}

function rankAndDeduplicateResults(results: any[], query: string): any[] {
  const seen = new Set();
  const unique = results.filter(result => {
    const key = result.title || result.name || result.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => {
    const aRelevance = calculateRelevance(a, query);
    const bRelevance = calculateRelevance(b, query);
    return bRelevance - aRelevance;
  });
}

/**
 * 注册智能搜索聚合工具
 */
export function registerSmartSearchTools(registry: ToolRegistry): void {
  // 1. 智能综合搜索
  registry.registerTool({
    name: 'intelligent_research',
    description: 'Intelligent search across multiple sources with smart ranking and deduplication',
    category: 'aggregation',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to execute across multiple sources'
        },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sources to search: web, news, academic, social, tech',
          default: ['web', 'news', 'academic', 'social']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results per source (1-20)',
          default: 5,
          minimum: 1,
          maximum: 20
        },
        includeAnalysis: {
          type: 'boolean',
          description: 'Include intelligent analysis of results',
          default: true
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const startTime = Date.now();
        const sources = args.sources || ['web', 'news', 'academic', 'social'];
        const maxResults = args.maxResults || 5;
        const results: any = {
          query: args.query,
          sources_searched: [],
          results_by_source: {},
          aggregated_results: [],
          analysis: {},
          metadata: {
            search_time: 0,
            total_results: 0,
            sources_count: 0
          }
        };

        // 并行搜索多个源
        const searchPromises = [];

        // Web搜索 (Google)
        if (sources.includes('web')) {
          const webTool = registry.getTool('google_web_search');
          if (webTool) {
            searchPromises.push(
              webTool.execute({ query: args.query, limit: maxResults })
                .then(result => ({ source: 'web', data: result }))
                .catch(error => ({ source: 'web', error: error.message }))
            );
          }
        }

        // 新闻搜索 (NewsAPI)
        if (sources.includes('news')) {
          const newsTool = registry.getTool('newsapi_search');
          if (newsTool) {
            searchPromises.push(
              newsTool.execute({ query: args.query, maxResults })
                .then(result => ({ source: 'news', data: result }))
                .catch(error => ({ source: 'news', error: error.message }))
            );
          }
        }

        // 学术搜索 (arXiv)
        if (sources.includes('academic')) {
          const academicTool = registry.getTool('search_arxiv');
          if (academicTool) {
            searchPromises.push(
              academicTool.execute({ query: args.query, max_results: maxResults })
                .then(result => ({ source: 'academic', data: result }))
                .catch(error => ({ source: 'academic', error: error.message }))
            );
          }
        }

        // 社交媒体搜索 (Reddit)
        if (sources.includes('social')) {
          const socialTool = registry.getTool('reddit_post_search');
          if (socialTool) {
            searchPromises.push(
              socialTool.execute({ query: args.query, maxResults })
                .then(result => ({ source: 'social', data: result }))
                .catch(error => ({ source: 'social', error: error.message }))
            );
          }
        }

        // 技术搜索 (GitHub)
        if (sources.includes('tech')) {
          const techTool = registry.getTool('github_repository_search');
          if (techTool) {
            searchPromises.push(
              techTool.execute({ query: args.query, maxResults })
                .then(result => ({ source: 'tech', data: result }))
                .catch(error => ({ source: 'tech', error: error.message }))
            );
          }
        }

        // 等待所有搜索完成
        const searchResults = await Promise.all(searchPromises);

        // 处理搜索结果
        let totalResults = 0;
        const allResults: any[] = [];

        for (const searchResult of searchResults) {
          if ('error' in searchResult) {
            results.results_by_source[searchResult.source] = {
              status: 'error',
              error: searchResult.error
            };
            continue;
          }

          const sourceData = searchResult.data;
          if (sourceData.success && sourceData.data) {
            const sourceResults = extractResults(sourceData.data, searchResult.source);
            results.results_by_source[searchResult.source] = {
              status: 'success',
              count: sourceResults.length,
              results: sourceResults
            };
            results.sources_searched.push(searchResult.source);
            totalResults += sourceResults.length;
            allResults.push(...sourceResults.map((r: any) => ({ ...r, source: searchResult.source })));
          } else {
            results.results_by_source[searchResult.source] = {
              status: 'no_results',
              error: sourceData.error || 'No results found'
            };
          }
        }

        // 智能排序和去重
        const rankedResults = rankAndDeduplicateResults(allResults, args.query);
        results.aggregated_results = rankedResults.slice(0, maxResults * 2); // 返回更多聚合结果

        // 生成分析
        if (args.includeAnalysis) {
          results.analysis = {
            query_analysis: `Search for "${args.query}" across ${results.sources_searched.length} sources`,
            source_performance: results.sources_searched.map((source: string) => ({
              source,
              status: results.results_by_source[source].status,
              result_count: results.results_by_source[source].count || 0
            })),
            recommendations: ['Consider searching more sources for comprehensive results']
          };
        }

        // 设置元数据
        results.metadata = {
          search_time: Date.now() - startTime,
          total_results: totalResults,
          sources_count: results.sources_searched.length,
          aggregated_count: results.aggregated_results.length
        };

        return {
          success: true,
          data: results
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Smart search failed'
        };
      }
    }
  });

  // 2. 市场情报聚合
  registry.registerTool({
    name: 'market_intelligence_aggregator',
    description: 'Aggregate market intelligence from financial, news, and social sources',
    category: 'aggregation',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Market topic or company to analyze (e.g., "Apple", "AI market", "cryptocurrency")'
        },
        includeStock: {
          type: 'boolean',
          description: 'Include stock/financial data',
          default: true
        },
        includeNews: {
          type: 'boolean',
          description: 'Include news analysis',
          default: true
        },
        includeSocial: {
          type: 'boolean',
          description: 'Include social media sentiment',
          default: true
        },
        includeCrypto: {
          type: 'boolean',
          description: 'Include cryptocurrency data if relevant',
          default: false
        }
      },
      required: ['topic']
    },
    execute: async (args: any) => {
      try {
        const startTime = Date.now();
        const intelligence: any = {
          topic: args.topic,
          timestamp: new Date().toISOString(),
          financial_data: null,
          news_analysis: null,
          social_sentiment: null,
          crypto_data: null,
          summary: {},
          metadata: {}
        };

        const promises = [];

        // 金融数据
        if (args.includeStock) {
          const stockTool = registry.getTool('alpha_vantage_symbol_search');
          if (stockTool) {
            promises.push(
              stockTool.execute({ keywords: args.topic })
                .then(result => ({ type: 'financial', data: result }))
                .catch(error => ({ type: 'financial', error: error.message }))
            );
          }
        }

        // 新闻分析
        if (args.includeNews) {
          const newsTool = registry.getTool('newsapi_search');
          if (newsTool) {
            promises.push(
              newsTool.execute({ query: args.topic, maxResults: 10 })
                .then(result => ({ type: 'news', data: result }))
                .catch(error => ({ type: 'news', error: error.message }))
            );
          }
        }

        // 社交媒体情感
        if (args.includeSocial) {
          const socialTool = registry.getTool('reddit_post_search');
          if (socialTool) {
            promises.push(
              socialTool.execute({ query: args.topic, maxResults: 10 })
                .then(result => ({ type: 'social', data: result }))
                .catch(error => ({ type: 'social', error: error.message }))
            );
          }
        }

        // 加密货币数据
        if (args.includeCrypto) {
          const cryptoTool = registry.getTool('coingecko_coin_search');
          if (cryptoTool) {
            promises.push(
              cryptoTool.execute({ query: args.topic })
                .then(result => ({ type: 'crypto', data: result }))
                .catch(error => ({ type: 'crypto', error: error.message }))
            );
          }
        }

        // 等待所有数据收集完成
        const results = await Promise.all(promises);

        // 处理结果
        for (const result of results) {
          if ('error' in result) {
            intelligence[`${result.type}_data`] = { error: result.error };
            continue;
          }

          if (result.data.success) {
            intelligence[`${result.type}_data`] = result.data.data;
          } else {
            intelligence[`${result.type}_data`] = { error: result.data.error };
          }
        }

        // 生成摘要
        intelligence.summary = {
          topic: intelligence.topic,
          data_availability: {
            financial: !!intelligence.financial_data && !intelligence.financial_data.error,
            news: !!intelligence.news_data && !intelligence.news_data.error,
            social: !!intelligence.social_data && !intelligence.social_data.error,
            crypto: !!intelligence.crypto_data && !intelligence.crypto_data.error
          },
          key_insights: ['Market intelligence aggregated from multiple sources']
        };
        intelligence.metadata = {
          analysis_time: Date.now() - startTime,
          data_sources: results.filter(r => !('error' in r)).length,
          timestamp: Date.now()
        };

        return {
          success: true,
          data: intelligence
        };

      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Market intelligence aggregation failed'
        };
      }
    }
  });

}
