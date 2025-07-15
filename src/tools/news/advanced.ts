/**
 * Advanced News Media Search Tools
 * Implements TechCrunch, BBC Tech, and Reuters Tech news search
 */

import { ToolInput, ToolOutput } from '../../types.js';
import { createTool } from '../tool-registry.js';
import type { ToolRegistry } from '../tool-registry.js';
import { Logger } from '../../utils/logger.js';
import NewsSearchOptimizer from '../../engines/news-search-optimizer.js';
import RobustErrorHandler from '../../engines/robust-error-handler.js';

const logger = new Logger('AdvancedNewsTools');
const newsOptimizer = new NewsSearchOptimizer();
const errorHandler = new RobustErrorHandler();

/**
 * Search TechCrunch for technology news and startup coverage
 */
async function searchTechCrunch(args: ToolInput): Promise<ToolOutput> {
  const { query, maxResults = 10, category, dateFilter } = args;
  
  try {
    logger.info(`Searching TechCrunch for: ${query}`);

    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }

    // 使用强化错误处理执行搜索
    const results = await errorHandler.executeWithRetry(
      () => newsOptimizer.searchNews('techcrunch', query, maxResults),
      {
        operation: 'techcrunch_search',
        service: 'news',
        metadata: { query, maxResults, category, dateFilter }
      },
      {
        maxRetries: 3,
        baseDelay: 2000,
        retryableErrors: ['NETWORK_ERROR', 'RATE_LIMIT', 'SERVICE_UNAVAILABLE', 'ECONNRESET']
      },
      {
        type: 'empty',
        value: []
      }
    );

    // 应用分类和日期过滤
    let filteredResults = results;

    if (category) {
      filteredResults = results.filter(result =>
        result.title.toLowerCase().includes(category.toLowerCase()) ||
        result.url.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (dateFilter) {
      // 简单的日期过滤逻辑
      const filterDate = new Date(dateFilter);
      filteredResults = filteredResults.filter(result => {
        if (!result.publishedAt) return true;
        const publishDate = new Date(result.publishedAt);
        return publishDate >= filterDate;
      });
    }

    const finalResults = filteredResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        results: finalResults,
        totalFound: finalResults.length,
        source: 'TechCrunch',
        searchedAt: new Date().toISOString(),
        filters: {
          category,
          dateFilter
        }
      },
      metadata: {
        sources: ['techcrunch'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} TechCrunch articles for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search TechCrunch for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to search TechCrunch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['techcrunch'],
        cached: false
      }
    };
  }
}

/**
 * Search BBC Technology section for tech news
 */
async function searchBBCTech(args: ToolInput): Promise<ToolOutput> {
  const { query, maxResults = 10, region = 'global', dateFilter } = args;
  
  try {
    logger.info(`Searching BBC Tech for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    // 使用优化的新闻搜索器
    const results = await newsOptimizer.searchNews('bbc', query, maxResults);

    // 应用地区和日期过滤
    let filteredResults = results;

    if (region && region !== 'global') {
      filteredResults = results.filter(result =>
        result.url.includes(region) ||
        result.title.toLowerCase().includes(region.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filteredResults = filteredResults.filter(result => {
        if (!result.publishedAt) return true;
        const publishDate = new Date(result.publishedAt);
        return publishDate >= filterDate;
      });
    }

    const finalResults = filteredResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        results: finalResults,
        totalFound: finalResults.length,
        source: 'BBC Technology',
        searchedAt: new Date().toISOString(),
        filters: {
          region,
          dateFilter
        }
      },
      metadata: {
        sources: ['bbc-tech'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} BBC Tech articles for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search BBC Tech for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to search BBC Tech: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['bbc-tech'],
        cached: false
      }
    };
  }
}

/**
 * Search Reuters Technology section for tech news
 */
async function searchReutersTech(args: ToolInput): Promise<ToolOutput> {
  const { query, maxResults = 10, region = 'global', dateFilter } = args;
  
  try {
    logger.info(`Searching Reuters Tech for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    // 使用优化的新闻搜索器
    const results = await newsOptimizer.searchNews('reuters', query, maxResults);

    // 应用地区和日期过滤
    let filteredResults = results;

    if (region && region !== 'global') {
      filteredResults = results.filter(result =>
        result.url.includes(region) ||
        result.title.toLowerCase().includes(region.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filteredResults = filteredResults.filter(result => {
        if (!result.publishedAt) return true;
        const publishDate = new Date(result.publishedAt);
        return publishDate >= filterDate;
      });
    }

    const finalResults = filteredResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        results: finalResults,
        totalFound: finalResults.length,
        source: 'Reuters Technology',
        searchedAt: new Date().toISOString(),
        filters: {
          region,
          dateFilter
        }
      },
      metadata: {
        sources: ['reuters-tech'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} Reuters Tech articles for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search Reuters Tech for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to search Reuters Tech: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['reuters-tech'],
        cached: false
      }
    };
  }
}

/**
 * Extract TechCrunch results from search engine results
 */
function extractTechCrunchResultsFromSearch(html: string): any[] {
  const results = [];
  
  // Extract TechCrunch URLs from search results
  const techcrunchUrlPattern = /https?:\/\/techcrunch\.com\/[^\s"<>]+/gi;
  const urls = html.match(techcrunchUrlPattern) || [];
  
  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      if (!cleanUrl.includes('/tag/') && !cleanUrl.includes('/author/')) {
        results.push({
          id: extractIdFromUrl(cleanUrl),
          title: extractTitleFromSearchResult(html, cleanUrl),
          url: cleanUrl,
          source: 'TechCrunch',
          type: 'news-article'
        });
      }
    } catch (error) {
      // Skip invalid URLs
    }
  }
  
  return results;
}

/**
 * Extract BBC results from search engine results
 */
function extractBBCResultsFromSearch(html: string): any[] {
  const results = [];
  
  // Extract BBC URLs from search results
  const bbcUrlPattern = /https?:\/\/(?:www\.)?bbc\.co(?:m|\.uk)\/news\/technology\/[^\s"<>]+/gi;
  const urls = html.match(bbcUrlPattern) || [];
  
  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      results.push({
        id: extractIdFromUrl(cleanUrl),
        title: extractTitleFromSearchResult(html, cleanUrl),
        url: cleanUrl,
        source: 'BBC Technology',
        type: 'news-article'
      });
    } catch (error) {
      // Skip invalid URLs
    }
  }
  
  return results;
}

/**
 * Extract Reuters results from search engine results
 */
function extractReutersResultsFromSearch(html: string): any[] {
  const results = [];
  
  // Extract Reuters URLs from search results
  const reutersUrlPattern = /https?:\/\/(?:www\.)?reuters\.com\/[^\s"<>]+/gi;
  const urls = html.match(reutersUrlPattern) || [];
  
  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      if (cleanUrl.includes('/technology/') || cleanUrl.includes('/business/technology/')) {
        results.push({
          id: extractIdFromUrl(cleanUrl),
          title: extractTitleFromSearchResult(html, cleanUrl),
          url: cleanUrl,
          source: 'Reuters Technology',
          type: 'news-article'
        });
      }
    } catch (error) {
      // Skip invalid URLs
    }
  }
  
  return results;
}

/**
 * Extract ID from URL
 */
function extractIdFromUrl(url: string): string {
  const match = url.match(/\/([^\/]+)\/?$/);
  return match ? match[1] : 'unknown';
}

/**
 * Extract title from search result context
 */
function extractTitleFromSearchResult(html: string, url: string): string {
  const urlIndex = html.indexOf(url);
  if (urlIndex > -1) {
    const beforeUrl = html.substring(Math.max(0, urlIndex - 200), urlIndex);
    const titleMatch = beforeUrl.match(/<[^>]*>([^<]+)<\/[^>]*>$/);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }
  return 'News Article';
}

/**
 * Remove duplicate results based on a key
 */
function removeDuplicateResults(results: any[], key: string): any[] {
  const seen = new Set();
  return results.filter(result => {
    const value = result[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Register all advanced news media search tools
 */
export function registerAdvancedNewsTools(registry: ToolRegistry): void {
  logger.info('Registering advanced news media search tools...');

  // TechCrunch search tool
  const techCrunchTool = createTool(
    'search_techcrunch',
    'Search TechCrunch for technology news, startup coverage, and industry analysis',
    'news',
    'techcrunch-search',
    searchTechCrunch,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 20,  // 20 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'category', 'dateFilter']
    }
  );

  techCrunchTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for TechCrunch articles'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      },
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "startup", "AI", "fintech")'
      },
      dateFilter: {
        type: 'string',
        description: 'Date filter (e.g., "last-week", "last-month")'
      }
    },
    required: ['query']
  };

  registry.registerTool(techCrunchTool);

  // BBC Technology search tool
  const bbcTechTool = createTool(
    'search_bbc_tech',
    'Search BBC Technology section for technology news and analysis',
    'news',
    'bbc-tech-search',
    searchBBCTech,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 25,  // 25 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'region', 'dateFilter']
    }
  );

  bbcTechTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for BBC Technology articles'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      },
      region: {
        type: 'string',
        description: 'Regional focus (global, uk, us)',
        enum: ['global', 'uk', 'us']
      },
      dateFilter: {
        type: 'string',
        description: 'Date filter (e.g., "today", "this-week")'
      }
    },
    required: ['query']
  };

  registry.registerTool(bbcTechTool);

  // Reuters Technology search tool
  const reutersTechTool = createTool(
    'search_reuters_tech',
    'Search Reuters Technology section for business technology news and market analysis',
    'news',
    'reuters-tech-search',
    searchReutersTech,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 25,  // 25 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'region', 'dateFilter']
    }
  );

  reutersTechTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Reuters Technology articles'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      },
      region: {
        type: 'string',
        description: 'Regional focus (global, us, europe, asia)',
        enum: ['global', 'us', 'europe', 'asia']
      },
      dateFilter: {
        type: 'string',
        description: 'Date filter (e.g., "today", "this-week")'
      }
    },
    required: ['query']
  };

  registry.registerTool(reutersTechTool);

  logger.info('Advanced news media search tools registered successfully');
}
