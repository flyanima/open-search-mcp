/**
 * Wikipedia API Tools Registration
 * 注册Wikipedia知识API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Wikipedia API客户端
 */
class WikipediaAPIClient {
  private baseURL = 'https://en.wikipedia.org/api/rest_v1';
  private searchURL = 'https://en.wikipedia.org/w/api.php';

  async makeRequest(url: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': 'Open-Search-MCP/2.0 (https://github.com/open-search-mcp)'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchArticles(query: string, limit: number = 10) {
    return await this.makeRequest(this.searchURL, {
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srlimit: limit,
      srprop: 'snippet|titlesnippet|size|wordcount|timestamp'
    });
  }

  async getPageSummary(title: string) {
    const encodedTitle = encodeURIComponent(title);
    return await this.makeRequest(`${this.baseURL}/page/summary/${encodedTitle}`);
  }

  async getPageContent(title: string) {
    return await this.makeRequest(this.searchURL, {
      action: 'query',
      format: 'json',
      prop: 'extracts|info|pageimages',
      exintro: true,
      explaintext: true,
      exsectionformat: 'plain',
      titles: title,
      inprop: 'url',
      piprop: 'original'
    });
  }

  async getRandomArticles(limit: number = 10) {
    return await this.makeRequest(this.searchURL, {
      action: 'query',
      format: 'json',
      list: 'random',
      rnnamespace: 0,
      rnlimit: limit
    });
  }

  async searchCategories(query: string, limit: number = 10) {
    return await this.makeRequest(this.searchURL, {
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srnamespace: 14, // Category namespace
      srlimit: limit
    });
  }
}

/**
 * 注册所有Wikipedia API工具
 */
export function registerWikipediaTools(registry: ToolRegistry): void {
  const client = new WikipediaAPIClient();

  // 1. Wikipedia文章搜索
  registry.registerTool({
    name: 'wikipedia_article_search',
    description: 'Search Wikipedia articles with detailed information',
    category: 'knowledge',
    source: 'wikipedia.org',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Wikipedia articles (e.g., "artificial intelligence", "climate change")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchArticles(args.query, args.maxResults || 10);
        
        const articles = data.query?.search?.map((article: any) => ({
          title: article.title,
          snippet: article.snippet?.replace(/<[^>]*>/g, ''), // Remove HTML tags
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`,
          wordcount: article.wordcount,
          size: article.size,
          timestamp: article.timestamp
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Wikipedia API',
            query: args.query,
            results: articles,
            totalResults: articles.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search Wikipedia articles'
        };
      }
    }
  });

  // 2. Wikipedia页面摘要
  registry.registerTool({
    name: 'wikipedia_page_summary',
    description: 'Get summary of a specific Wikipedia page',
    category: 'knowledge',
    source: 'wikipedia.org',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Wikipedia page title (e.g., "Artificial intelligence", "Python (programming language)")'
        }
      },
      required: ['title']
    },
    execute: async (args: any) => {
      try {
        const data = await client.getPageSummary(args.title);
        
        return {
          success: true,
          data: {
            source: 'Wikipedia API',
            title: data.title,
            summary: {
              extract: data.extract,
              description: data.description,
              url: data.content_urls?.desktop?.page,
              thumbnail: data.thumbnail?.source,
              coordinates: data.coordinates,
              lang: data.lang,
              timestamp: data.timestamp
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get Wikipedia page summary'
        };
      }
    }
  });

  // 3. Wikipedia页面完整内容
  registry.registerTool({
    name: 'wikipedia_page_content',
    description: 'Get full content of a Wikipedia page',
    category: 'knowledge',
    source: 'wikipedia.org',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Wikipedia page title'
        },
        maxLength: {
          type: 'number',
          description: 'Maximum content length in characters (100-5000)',
          default: 1000,
          minimum: 100,
          maximum: 5000
        }
      },
      required: ['title']
    },
    execute: async (args: any) => {
      try {
        const data = await client.getPageContent(args.title);
        const pages = data.query?.pages;
        
        if (!pages) {
          throw new Error('Page not found');
        }
        
        const page = Object.values(pages)[0] as any;
        if (page.missing) {
          throw new Error('Page does not exist');
        }
        
        const maxLength = args.maxLength || 1000;
        const extract = page.extract || '';
        const truncatedExtract = extract.length > maxLength 
          ? extract.substring(0, maxLength) + '...' 
          : extract;
        
        return {
          success: true,
          data: {
            source: 'Wikipedia API',
            title: page.title,
            content: {
              extract: truncatedExtract,
              full_url: page.fullurl,
              page_id: page.pageid,
              image: page.original?.source,
              length: extract.length,
              truncated: extract.length > maxLength
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get Wikipedia page content'
        };
      }
    }
  });

  // 4. Wikipedia随机文章
  registry.registerTool({
    name: 'wikipedia_random_articles',
    description: 'Get random Wikipedia articles for discovery',
    category: 'knowledge',
    source: 'wikipedia.org',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of random articles (1-20)',
          default: 5,
          minimum: 1,
          maximum: 20
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const count = args.count || 5;
        const data = await client.getRandomArticles(count);
        
        const articles = data.query?.random?.map((article: any) => ({
          title: article.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`,
          id: article.id
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'Wikipedia API',
            results: articles,
            count: articles.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get random Wikipedia articles'
        };
      }
    }
  });

  // 5. Wikipedia知识探索
  registry.registerTool({
    name: 'wikipedia_knowledge_explorer',
    description: 'Explore knowledge on Wikipedia with intelligent suggestions',
    category: 'knowledge',
    source: 'wikipedia.org',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic to explore (e.g., "space exploration", "renewable energy")'
        },
        depth: {
          type: 'string',
          description: 'Exploration depth: basic, detailed, comprehensive',
          default: 'basic'
        }
      },
      required: ['topic']
    },
    execute: async (args: any) => {
      try {
        const depth = args.depth || 'basic';
        const maxResults = depth === 'comprehensive' ? 15 : depth === 'detailed' ? 10 : 5;
        
        // 搜索主要文章
        const searchData = await client.searchArticles(args.topic, maxResults);
        const articles = searchData.query?.search || [];
        
        // 获取第一篇文章的摘要
        let mainSummary = null;
        if (articles.length > 0) {
          try {
            mainSummary = await client.getPageSummary(articles[0].title);
          } catch (error) {}
        }
        
        const exploration = {
          topic: args.topic,
          depth,
          main_article: mainSummary ? {
            title: mainSummary.title,
            description: mainSummary.description,
            extract: mainSummary.extract?.substring(0, 500) + '...',
            url: mainSummary.content_urls?.desktop?.page
          } : null,
          related_articles: articles.slice(1).map((article: any) => ({
            title: article.title,
            snippet: article.snippet?.replace(/<[^>]*>/g, ''),
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}`
          })),
          exploration_suggestions: generateExplorationSuggestions(args.topic)
        };
        
        return {
          success: true,
          data: {
            source: 'Wikipedia API',
            exploration,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to explore Wikipedia knowledge'
        };
      }
    }
  });

}

// 辅助函数
function generateExplorationSuggestions(topic: string): string[] {
  const suggestions = [
    `History of ${topic}`,
    `${topic} technology`,
    `${topic} applications`,
    `Future of ${topic}`,
    `${topic} research`
  ];
  
  return suggestions;
}
