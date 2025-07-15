/**
 * NewsAPI Tools Registration
 * 注册NewsAPI新闻工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * NewsAPI客户端
 */
class NewsAPIClient {
  private apiKey: string;
  private baseURL = 'https://newsapi.org/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint: string, params: Record<string, any>) {
    try {
      const response = await axios.get(`${this.baseURL}/${endpoint}`, {
        params,
        headers: {
          'X-API-Key': this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message || 'NewsAPI error');
      }

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchEverything(query: string, options: any = {}) {
    return await this.makeRequest('everything', {
      q: query,
      sortBy: options.sortBy || 'publishedAt',
      language: options.language || 'en',
      pageSize: options.pageSize || 20,
      ...options
    });
  }

  async getTopHeadlines(options: any = {}) {
    return await this.makeRequest('top-headlines', {
      country: options.country || 'us',
      category: options.category,
      pageSize: options.pageSize || 20,
      ...options
    });
  }

  async getSources(options: any = {}) {
    return await this.makeRequest('sources', {
      category: options.category,
      language: options.language || 'en',
      country: options.country,
      ...options
    });
  }
}

/**
 * 注册所有NewsAPI工具
 */
export function registerNewsAPITools(registry: ToolRegistry): void {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  if (!apiKey) {return;
  }

  const client = new NewsAPIClient(apiKey);

  // 1. 新闻搜索
  registry.registerTool({
    name: 'newsapi_search',
    description: 'Search for news articles from thousands of sources using NewsAPI',
    category: 'news',
    source: 'newsapi.org',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for news articles (e.g., "artificial intelligence", "climate change")'
        },
        sortBy: {
          type: 'string',
          description: 'Sort order: relevancy, popularity, publishedAt',
          default: 'publishedAt'
        },
        language: {
          type: 'string',
          description: 'Language code (e.g., "en", "zh", "es")',
          default: 'en'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of articles to return (1-100)',
          default: 20,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchEverything(args.query as string, {
          sortBy: args.sortBy,
          language: args.language,
          pageSize: args.maxResults || 20
        });
        
        return {
          success: true,
          data: {
            source: 'NewsAPI',
            query: args.query,
            results: data.articles || [],
            totalResults: data.totalResults || 0,
            searchTime: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search news'
        };
      }
    }
  });

  // 2. 头条新闻
  registry.registerTool({
    name: 'newsapi_top_headlines',
    description: 'Get top headlines from major news sources',
    category: 'news',
    source: 'newsapi.org',
    inputSchema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          description: 'Country code (e.g., "us", "gb", "cn")',
          default: 'us'
        },
        category: {
          type: 'string',
          description: 'News category: business, entertainment, general, health, science, sports, technology'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of headlines to return (1-100)',
          default: 20,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args) => {
      try {
        const data = await client.getTopHeadlines({
          country: args.country,
          category: args.category,
          pageSize: args.maxResults || 20
        });
        
        return {
          success: true,
          data: {
            source: 'NewsAPI',
            country: args.country || 'us',
            category: args.category || 'general',
            results: data.articles || [],
            totalResults: data.totalResults || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get top headlines'
        };
      }
    }
  });

  // 3. 科技新闻
  registry.registerTool({
    name: 'newsapi_tech_news',
    description: 'Get latest technology news and updates',
    category: 'news',
    source: 'newsapi.org',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of articles to return (1-100)',
          default: 20,
          minimum: 1,
          maximum: 100
        },
        country: {
          type: 'string',
          description: 'Country code (e.g., "us", "gb")',
          default: 'us'
        }
      },
      required: []
    },
    execute: async (args) => {
      try {
        const data = await client.getTopHeadlines({
          category: 'technology',
          country: args.country || 'us',
          pageSize: args.maxResults || 20
        });
        
        return {
          success: true,
          data: {
            source: 'NewsAPI',
            category: 'technology',
            country: args.country || 'us',
            results: data.articles || [],
            totalResults: data.totalResults || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get tech news'
        };
      }
    }
  });

  // 4. 商业新闻
  registry.registerTool({
    name: 'newsapi_business_news',
    description: 'Get latest business and financial news',
    category: 'news',
    source: 'newsapi.org',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of articles to return (1-100)',
          default: 20,
          minimum: 1,
          maximum: 100
        },
        country: {
          type: 'string',
          description: 'Country code (e.g., "us", "gb")',
          default: 'us'
        }
      },
      required: []
    },
    execute: async (args) => {
      try {
        const data = await client.getTopHeadlines({
          category: 'business',
          country: args.country || 'us',
          pageSize: args.maxResults || 20
        });
        
        return {
          success: true,
          data: {
            source: 'NewsAPI',
            category: 'business',
            country: args.country || 'us',
            results: data.articles || [],
            totalResults: data.totalResults || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get business news'
        };
      }
    }
  });
}
