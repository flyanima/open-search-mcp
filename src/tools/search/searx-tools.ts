/**
 * Searx Search Tools
 * 提供Searx开源搜索引擎功能
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Searx搜索客户端
 */
class SearxClient {
  private instances = [
    'https://searx.be',
    'https://search.sapti.me',
    'https://searx.info',
    'https://searx.xyz',
    'https://searx.prvcy.eu',
    'https://searx.tiekoetter.com',
    'https://searx.fmac.xyz',
    'https://searx.bar'
  ];

  async makeRequest(instance: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${instance}/search`, {
        params: {
          ...params,
          format: 'json'
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'Open-Search-MCP/2.0',
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchWithFallback(query: string, options: any = {}) {
    let lastError = null;
    
    // 随机选择起始实例
    const shuffledInstances = [...this.instances].sort(() => Math.random() - 0.5);
    
    for (const instance of shuffledInstances.slice(0, 3)) { // 尝试最多3个实例
      try {
        const params = {
          q: query,
          categories: options.categories || 'general',
          engines: options.engines || '',
          language: options.language || 'en',
          time_range: options.timeRange || '',
          safesearch: options.safeSearch || '1',
          pageno: options.page || 1
        };

        const data = await this.makeRequest(instance, params);
        
        if (data && data.results && data.results.length > 0) {
          return {
            results: data.results,
            suggestions: data.suggestions || [],
            answers: data.answers || [],
            infoboxes: data.infoboxes || [],
            instance: instance,
            query: data.query || query,
            number_of_results: data.number_of_results || data.results.length
          };
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    throw lastError || new Error('All Searx instances failed');
  }

  async getAvailableEngines(instance?: string) {
    const targetInstance = instance || this.instances[0];
    
    try {
      const response = await axios.get(`${targetInstance}/config`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Open-Search-MCP/2.0',
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export function registerSearxTools(registry: ToolRegistry): void {
  const client = new SearxClient();

  // Searx通用搜索
  registry.registerTool({
    name: 'searx_search',
    description: 'Search using Searx open-source search engine with privacy protection',
    category: 'search',
    source: 'Searx',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        categories: {
          type: 'string',
          description: 'Search categories: general, images, videos, news, music, files, science, social',
          default: 'general',
          enum: ['general', 'images', 'videos', 'news', 'music', 'files', 'science', 'social']
        },
        engines: {
          type: 'string',
          description: 'Specific search engines to use (comma-separated, e.g., "google,bing,duckduckgo")'
        },
        language: {
          type: 'string',
          description: 'Search language (e.g., "en", "zh", "es", "fr")',
          default: 'en'
        },
        timeRange: {
          type: 'string',
          description: 'Time range filter: day, week, month, year',
          enum: ['', 'day', 'week', 'month', 'year']
        },
        safeSearch: {
          type: 'string',
          description: 'Safe search level: 0 (off), 1 (moderate), 2 (strict)',
          default: '1',
          enum: ['0', '1', '2']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { 
        query, 
        categories = 'general', 
        engines, 
        language = 'en', 
        timeRange, 
        safeSearch = '1',
        maxResults = 10 
      } = args;

      try {
        const startTime = Date.now();
        
        const searchResult = await client.searchWithFallback(query, {
          categories,
          engines,
          language,
          timeRange,
          safeSearch
        });

        const searchTime = Date.now() - startTime;
        
        // 处理搜索结果
        const results = (searchResult.results || []).slice(0, maxResults).map((result: any) => ({
          title: result.title || 'No title',
          url: result.url || '',
          content: result.content || 'No content available',
          engine: result.engine || 'unknown',
          category: result.category || categories,
          score: result.score || 0,
          publishedDate: result.publishedDate || null,
          thumbnail: result.img_src || null
        }));

        return {
          success: true,
          data: {
            source: 'Searx',
            instance: searchResult.instance,
            query: searchResult.query,
            categories,
            language,
            timeRange: timeRange || 'all',
            safeSearch,
            totalResults: searchResult.number_of_results || results.length,
            results,
            suggestions: searchResult.suggestions || [],
            answers: searchResult.answers || [],
            infoboxes: searchResult.infoboxes || [],
            searchTime,
            timestamp: Date.now(),
            metadata: {
              privacy: 'Protected by Searx',
              engines: engines || 'auto-selected',
              instanceUsed: searchResult.instance
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Searx search failed: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            source: 'Searx',
            query,
            results: [],
            suggestions: [
              'Try simpler search terms',
              'Check your internet connection',
              'Try again in a few moments',
              'Use different search categories'
            ]
          }
        };
      }
    }
  });

  // Searx图片搜索
  registry.registerTool({
    name: 'searx_image_search',
    description: 'Search for images using Searx with privacy protection',
    category: 'search',
    source: 'Searx',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Image search query'
        },
        safeSearch: {
          type: 'string',
          description: 'Safe search level: 0 (off), 1 (moderate), 2 (strict)',
          default: '1',
          enum: ['0', '1', '2']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of images to return',
          default: 20,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, safeSearch = '1', maxResults = 20 } = args;

      try {
        const startTime = Date.now();
        
        const searchResult = await client.searchWithFallback(query, {
          categories: 'images',
          safeSearch
        });

        const searchTime = Date.now() - startTime;
        
        // 处理图片搜索结果
        const images = (searchResult.results || []).slice(0, maxResults).map((result: any) => ({
          title: result.title || 'No title',
          url: result.url || '',
          thumbnailUrl: result.thumbnail_src || result.img_src || '',
          imageUrl: result.img_src || result.url || '',
          width: result.resolution ? result.resolution.split('x')[0] : null,
          height: result.resolution ? result.resolution.split('x')[1] : null,
          source: result.engine || 'unknown',
          publishedDate: result.publishedDate || null
        }));

        return {
          success: true,
          data: {
            source: 'Searx Images',
            instance: searchResult.instance,
            query: searchResult.query,
            safeSearch,
            totalResults: searchResult.number_of_results || images.length,
            images,
            searchTime,
            timestamp: Date.now(),
            metadata: {
              privacy: 'Protected by Searx',
              category: 'images',
              instanceUsed: searchResult.instance
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Searx image search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });

  // Searx新闻搜索
  registry.registerTool({
    name: 'searx_news_search',
    description: 'Search for news using Searx with privacy protection',
    category: 'search',
    source: 'Searx',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'News search query'
        },
        timeRange: {
          type: 'string',
          description: 'Time range filter: day, week, month, year',
          default: 'week',
          enum: ['day', 'week', 'month', 'year']
        },
        language: {
          type: 'string',
          description: 'News language (e.g., "en", "zh", "es", "fr")',
          default: 'en'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of news articles to return',
          default: 15,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, timeRange = 'week', language = 'en', maxResults = 15 } = args;

      try {
        const startTime = Date.now();
        
        const searchResult = await client.searchWithFallback(query, {
          categories: 'news',
          timeRange,
          language
        });

        const searchTime = Date.now() - startTime;
        
        // 处理新闻搜索结果
        const articles = (searchResult.results || []).slice(0, maxResults).map((result: any) => ({
          title: result.title || 'No title',
          url: result.url || '',
          content: result.content || 'No content available',
          publishedDate: result.publishedDate || null,
          source: result.engine || 'unknown',
          thumbnail: result.img_src || null
        }));

        return {
          success: true,
          data: {
            source: 'Searx News',
            instance: searchResult.instance,
            query: searchResult.query,
            timeRange,
            language,
            totalResults: searchResult.number_of_results || articles.length,
            articles,
            searchTime,
            timestamp: Date.now(),
            metadata: {
              privacy: 'Protected by Searx',
              category: 'news',
              instanceUsed: searchResult.instance
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Searx news search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
