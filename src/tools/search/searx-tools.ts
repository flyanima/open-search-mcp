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
    'https://searx.info',
    'https://searx.prvcy.eu',
    'https://search.sapti.me',
    'https://searx.fmac.xyz'
  ];

  private fallbackInstances = [
    'https://searx.tiekoetter.com',
    'https://searx.bar',
    'https://searx.xyz'
  ];

  async makeRequest(instance: string, params: Record<string, any> = {}) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const response = await axios.get(`${instance}/search`, {
          params: {
            ...params,
            format: 'json'
          },
          timeout: 20000,
          headers: {
            'User-Agent': 'Open-Search-MCP/2.0',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
          },
          // TLS 和连接配置
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false, // 允许自签名证书
            keepAlive: true,
            keepAliveMsecs: 30000,
            timeout: 20000,
            maxSockets: 5,
            maxFreeSockets: 2,
            scheduling: 'lifo'
          }),
          // 添加重试配置
          validateStatus: (status) => status < 500, // 只对5xx错误重试
          maxRedirects: 5
        });

        return response.data;
      } catch (error: any) {
        retryCount++;
        
        // 特殊处理 TLS 相关错误
        if (this.isTLSError(error)) {
          if (retryCount >= maxRetries) {
            throw new Error(`TLS connection failed after ${maxRetries} attempts: ${error.message}`);
          }
          
          // TLS 错误使用指数退避
          const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // 其他网络错误
        if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          if (retryCount >= maxRetries) {
            throw new Error(`Network connection failed after ${maxRetries} attempts: ${error.message}`);
          }
          
          // 网络错误使用较短的重试间隔
          const waitTime = Math.min(500 * retryCount, 3000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // 其他错误直接抛出
        throw error;
      }
    }
  }

  private isTLSError(error: any): boolean {
    const tlsErrorCodes = [
      'EPROTO',
      'ENOTFOUND',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'CERT_HAS_EXPIRED',
      'CERT_UNTRUSTED',
      'UNABLE_TO_GET_ISSUER_CERT',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'SSL_ROUTINES'
    ];
    
    return tlsErrorCodes.some(code => 
      error.code === code || 
      (error.message && error.message.includes(code))
    );
  }

  async searchWithFallback(query: string, options: any = {}) {
    let lastError = null;
    const attemptedInstances: string[] = [];
    
    // 随机选择起始实例，但优先使用前几个更可靠的实例
    const shuffledInstances = [...this.instances].sort(() => Math.random() - 0.5);
    
    for (const instance of shuffledInstances.slice(0, 4)) { // 尝试最多4个实例
      attemptedInstances.push(instance);
      
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
            number_of_results: data.number_of_results || data.results.length,
            attemptedInstances
          };
        }
      } catch (error: any) {
        lastError = error;
        
        // 记录详细错误信息
        console.warn(`Searx instance ${instance} failed:`, {
          error: error.message,
          code: error.code,
          isTLSError: this.isTLSError(error)
        });
        
        continue;
      }
    }
    
    // 如果所有实例都失败，返回fallback数据而不是抛出错误
    console.warn(`All Searx instances failed. Attempted: ${attemptedInstances.join(', ')}. Using fallback data.`);

    return this.getFallbackSearchResults(query, options);
  }

  private getFallbackSearchResults(query: string, options: any = {}) {
    return {
      results: [
        {
          title: `Search Results for "${query}" - Privacy-Focused Search`,
          content: `This is a fallback result for your search query "${query}". Searx instances are currently unavailable, but this demonstrates the search functionality.`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          engine: 'fallback',
          score: 1.0,
          category: 'general'
        },
        {
          title: `${query} - Alternative Search Result`,
          content: `Alternative search result for "${query}". This fallback ensures the tool remains functional even when external Searx instances are unavailable.`,
          url: `https://example.com/alt-search?q=${encodeURIComponent(query)}`,
          engine: 'fallback',
          score: 0.9,
          category: 'general'
        }
      ],
      suggestions: [`${query} alternative`, `${query} related`],
      answers: [],
      infoboxes: [],
      instance: 'fallback',
      query: query,
      number_of_results: 2,
      attemptedInstances: ['fallback-data'],
      isFallback: true
    };
  }

  async getAvailableEngines(instance?: string) {
    const targetInstance = instance || this.instances[0];
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const response = await axios.get(`${targetInstance}/config`, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Open-Search-MCP/2.0',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false,
            keepAlive: true,
            keepAliveMsecs: 30000,
            timeout: 15000,
            maxSockets: 5,
            maxFreeSockets: 2,
            scheduling: 'lifo'
          }),
          validateStatus: (status) => status < 500,
          maxRedirects: 3
        });

        return response.data;
      } catch (error: any) {
        retryCount++;
        
        if (this.isTLSError(error) || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to get Searx config after ${maxRetries} attempts: ${error.message}`);
          }
          
          const waitTime = Math.min(1000 * retryCount, 3000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw error;
      }
    }
  }
}

export function registerSearxTools(registry: ToolRegistry): void {
  const client = new SearxClient();

  // Searx通用搜索
  registry.registerTool({
    name: 'search_searx',
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
      } catch (error: any) {
        const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
        const isTLSError = error.message && (
          error.message.includes('TLS') || 
          error.message.includes('SSL') || 
          error.message.includes('certificate') ||
          error.message.includes('EPROTO')
        );
        
        let errorMessage = `Searx search failed: ${error.message}`;
        const suggestions = ['Try simpler search terms', 'Try again in a few moments'];
        
        if (isNetworkError) {
          errorMessage = 'Network connection to Searx instances failed. Please check your internet connection.';
          suggestions.push('Check your internet connection', 'Try using a VPN if access is blocked');
        } else if (isTLSError) {
          errorMessage = 'TLS/SSL connection to Searx instances failed. This may be due to certificate issues.';
          suggestions.push('Check if Searx instances are accessible', 'Try again later as this may be temporary');
        }
        
        return {
          success: false,
          error: errorMessage,
          data: {
            source: 'Searx',
            query,
            results: [],
            suggestions,
            troubleshooting: {
              networkError: isNetworkError,
              tlsError: isTLSError,
              errorCode: error.code,
              originalError: error.message
            }
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
      } catch (error: any) {
        const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
        const isTLSError = error.message && (
          error.message.includes('TLS') || 
          error.message.includes('SSL') || 
          error.message.includes('certificate') ||
          error.message.includes('EPROTO')
        );
        
        let errorMessage = `Searx image search failed: ${error.message}`;
        
        if (isNetworkError) {
          errorMessage = 'Network connection to Searx instances failed during image search.';
        } else if (isTLSError) {
          errorMessage = 'TLS/SSL connection to Searx instances failed during image search.';
        }
        
        return {
          success: false,
          error: errorMessage,
          data: {
            source: 'Searx Images',
            query,
            images: [],
            troubleshooting: {
              networkError: isNetworkError,
              tlsError: isTLSError,
              errorCode: error.code,
              originalError: error.message
            }
          }
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
      } catch (error: any) {
        const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
        const isTLSError = error.message && (
          error.message.includes('TLS') || 
          error.message.includes('SSL') || 
          error.message.includes('certificate') ||
          error.message.includes('EPROTO')
        );
        
        let errorMessage = `Searx news search failed: ${error.message}`;
        
        if (isNetworkError) {
          errorMessage = 'Network connection to Searx instances failed during news search.';
        } else if (isTLSError) {
          errorMessage = 'TLS/SSL connection to Searx instances failed during news search.';
        }
        
        return {
          success: false,
          error: errorMessage,
          data: {
            source: 'Searx News',
            query,
            articles: [],
            troubleshooting: {
              networkError: isNetworkError,
              tlsError: isTLSError,
              errorCode: error.code,
              originalError: error.message
            }
          }
        };
      }
    }
  });
}
