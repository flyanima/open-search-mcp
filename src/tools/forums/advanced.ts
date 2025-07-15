/**
 * Advanced Professional Forums Search Tools
 * Implements Quora, Stack Exchange sites, and Reddit communities search
 */

import { ToolInput, ToolOutput } from '../../types.js';
import { createTool } from '../tool-registry.js';
import type { ToolRegistry } from '../tool-registry.js';
import { Logger } from '../../utils/logger.js';
import RedditAPIManager from '../../engines/reddit-api-manager.js';

const logger = new Logger('AdvancedForumsTools');
const redditManager = new RedditAPIManager();

/**
 * Search Quora for questions and answers across various topics
 */
async function searchQuora(args: ToolInput): Promise<ToolOutput> {
  const { query, maxResults = 10, topic, sortBy = 'relevance' } = args;
  
  try {
    logger.info(`Searching Quora for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    // Quora search through search engines (no public API)
    const searchQueries = [
      `site:quora.com "${query}"`,
      `"${query}" site:quora.com`,
      `site:quora.com ${query} question`,
      `site:quora.com ${query} answer`
    ];
    
    if (topic) {
      searchQueries.push(`site:quora.com "${query}" ${topic}`);
    }
    
    const results = [];
    
    for (const searchQuery of searchQueries) {
      try {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          const extractedResults = extractQuoraResultsFromSearch(html);
          results.push(...extractedResults);
        }
      } catch (error) {
        logger.warn(`Failed Quora search with query: ${searchQuery}`, error);
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = removeDuplicateResults(results, 'url');
    const finalResults = uniqueResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        results: finalResults,
        totalFound: finalResults.length,
        source: 'Quora',
        searchedAt: new Date().toISOString(),
        filters: {
          topic,
          sortBy
        }
      },
      metadata: {
        sources: ['quora'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} Quora Q&As for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search Quora for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to search Quora: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['quora'],
        cached: false
      }
    };
  }
}

/**
 * Search Stack Exchange network sites for specialized Q&A
 */
async function searchStackExchangeSites(args: ToolInput): Promise<ToolOutput> {
  const { query, maxResults = 10, site = 'all', sortBy = 'relevance' } = args;
  
  try {
    logger.info(`Searching Stack Exchange sites for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    // Stack Exchange sites to search
    const stackExchangeSites = [
      'stackoverflow.com',
      'superuser.com',
      'serverfault.com',
      'askubuntu.com',
      'mathoverflow.net',
      'physics.stackexchange.com',
      'chemistry.stackexchange.com',
      'biology.stackexchange.com',
      'cs.stackexchange.com',
      'datascience.stackexchange.com'
    ];
    
    const sitesToSearch = site === 'all' ? stackExchangeSites : [site];
    const results = [];
    
    for (const siteUrl of sitesToSearch) {
      try {
        const searchQuery = `site:${siteUrl} "${query}"`;
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          const extractedResults = extractStackExchangeResultsFromSearch(html, siteUrl);
          results.push(...extractedResults);
        }
      } catch (error) {
        logger.warn(`Failed Stack Exchange search on ${siteUrl}:`, error);
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = removeDuplicateResults(results, 'url');
    const finalResults = uniqueResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        results: finalResults,
        totalFound: finalResults.length,
        source: 'Stack Exchange Network',
        searchedAt: new Date().toISOString(),
        filters: {
          site,
          sortBy
        }
      },
      metadata: {
        sources: ['stackexchange'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} Stack Exchange Q&As for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search Stack Exchange for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to search Stack Exchange: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['stackexchange'],
        cached: false
      }
    };
  }
}

/**
 * Search Reddit professional communities for discussions
 */
async function searchRedditCommunities(args: ToolInput): Promise<ToolOutput> {
  const { query, maxResults = 10, subreddit, sortBy = 'relevance' } = args;
  
  try {
    logger.info(`Searching Reddit communities for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    // 使用优化的Reddit API管理器
    let allResults = [];

    if (subreddit) {
      // 搜索指定的subreddit
      const results = await redditManager.searchReddit(query, maxResults, subreddit, sortBy);
      allResults.push(...results);
    } else {
      // 搜索专业subreddits
      const professionalSubreddits = [
        'programming', 'MachineLearning', 'datascience', 'webdev', 'sysadmin',
        'cybersecurity', 'entrepreneur', 'startups', 'investing', 'finance',
        'science', 'AskScience', 'engineering', 'technology'
      ];

      // 限制搜索的subreddit数量以避免超时
      const subredditsToSearch = professionalSubreddits.slice(0, 5);
      const resultsPerSubreddit = Math.ceil(maxResults / subredditsToSearch.length);

      for (const sub of subredditsToSearch) {
        try {
          const results = await redditManager.searchReddit(query, resultsPerSubreddit, sub, sortBy);
          allResults.push(...results);

          // 如果已经获得足够结果，提前退出
          if (allResults.length >= maxResults) {
            break;
          }
        } catch (error) {
          logger.warn(`Failed Reddit search in r/${sub}:`, error);
          continue;
        }
      }
    }

    // 去重并限制结果数量
    const uniqueResults = deduplicateRedditResults(allResults);
    const finalResults = uniqueResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        results: finalResults,
        totalFound: finalResults.length,
        source: 'Reddit Communities',
        searchedAt: new Date().toISOString(),
        filters: {
          subreddit,
          sortBy
        }
      },
      metadata: {
        sources: ['reddit-communities'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} Reddit discussions for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search Reddit communities for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to search Reddit communities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['reddit-communities'],
        cached: false
      }
    };
  }
}

/**
 * Extract Quora results from search engine results
 */
function extractQuoraResultsFromSearch(html: string): any[] {
  const results = [];
  
  // Extract Quora URLs from search results
  const quoraUrlPattern = /https?:\/\/(?:www\.)?quora\.com\/[^\s"<>]+/gi;
  const urls = html.match(quoraUrlPattern) || [];
  
  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      if (!cleanUrl.includes('/profile/') && !cleanUrl.includes('/topic/')) {
        results.push({
          id: extractIdFromUrl(cleanUrl),
          title: extractTitleFromSearchResult(html, cleanUrl),
          url: cleanUrl,
          source: 'Quora',
          type: 'question-answer'
        });
      }
    } catch (error) {
      // Skip invalid URLs
    }
  }
  
  return results;
}

/**
 * Extract Stack Exchange results from search engine results
 */
function extractStackExchangeResultsFromSearch(html: string, site: string): any[] {
  const results = [];
  
  // Extract Stack Exchange URLs from search results
  const stackExchangeUrlPattern = new RegExp(`https?:\\/\\/(?:www\\.)?${site.replace('.', '\\.')}\/[^\\s"<>]+`, 'gi');
  const urls = html.match(stackExchangeUrlPattern) || [];
  
  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      if (cleanUrl.includes('/questions/')) {
        results.push({
          id: extractIdFromUrl(cleanUrl),
          title: extractTitleFromSearchResult(html, cleanUrl),
          url: cleanUrl,
          source: `Stack Exchange (${site})`,
          site: site,
          type: 'question-answer'
        });
      }
    } catch (error) {
      // Skip invalid URLs
    }
  }
  
  return results;
}

/**
 * Extract Reddit results from search engine results
 */
function extractRedditResultsFromSearch(html: string, subreddit: string): any[] {
  const results = [];
  
  // Extract Reddit URLs from search results
  const redditUrlPattern = new RegExp(`https?:\\/\\/(?:www\\.)?reddit\\.com\\/r\\/${subreddit}\\/[^\\s"<>]+`, 'gi');
  const urls = html.match(redditUrlPattern) || [];
  
  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      if (cleanUrl.includes('/comments/')) {
        results.push({
          id: extractIdFromUrl(cleanUrl),
          title: extractTitleFromSearchResult(html, cleanUrl),
          url: cleanUrl,
          source: `Reddit (r/${subreddit})`,
          subreddit: subreddit,
          type: 'discussion'
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
  return 'Forum Discussion';
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
 * Register all advanced professional forums search tools
 */
export function registerAdvancedForumsTools(registry: ToolRegistry): void {
  logger.info('Registering advanced professional forums search tools...');

  // Quora search tool
  const quoraTool = createTool(
    'search_quora',
    'Search Quora for questions and answers across various professional topics',
    'forums',
    'quora-search',
    searchQuora,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 20,  // 20 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'topic', 'sortBy']
    }
  );

  quoraTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Quora questions and answers'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      },
      topic: {
        type: 'string',
        description: 'Filter by topic (e.g., "technology", "business", "science")'
      },
      sortBy: {
        type: 'string',
        description: 'Sort order (relevance, recent)',
        enum: ['relevance', 'recent']
      }
    },
    required: ['query']
  };

  registry.registerTool(quoraTool);

  // Stack Exchange sites search tool
  const stackExchangeTool = createTool(
    'search_stackexchange_sites',
    'Search Stack Exchange network sites for specialized Q&A across multiple domains',
    'forums',
    'stackexchange-search',
    searchStackExchangeSites,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 25,  // 25 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'site', 'sortBy']
    }
  );

  stackExchangeTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Stack Exchange sites'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      },
      site: {
        type: 'string',
        description: 'Specific Stack Exchange site to search (default: all)',
        enum: ['all', 'stackoverflow.com', 'superuser.com', 'serverfault.com', 'askubuntu.com', 'mathoverflow.net', 'physics.stackexchange.com', 'chemistry.stackexchange.com', 'biology.stackexchange.com', 'cs.stackexchange.com', 'datascience.stackexchange.com']
      },
      sortBy: {
        type: 'string',
        description: 'Sort order (relevance, votes, activity)',
        enum: ['relevance', 'votes', 'activity']
      }
    },
    required: ['query']
  };

  registry.registerTool(stackExchangeTool);

  // Reddit communities search tool
  const redditCommunitiesTool = createTool(
    'search_reddit_communities',
    'Search Reddit professional communities for discussions and insights',
    'forums',
    'reddit-communities-search',
    searchRedditCommunities,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 25,  // 25 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'subreddit', 'sortBy']
    }
  );

  redditCommunitiesTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Reddit community discussions'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      },
      subreddit: {
        type: 'string',
        description: 'Specific subreddit to search (default: multiple professional subreddits)'
      },
      sortBy: {
        type: 'string',
        description: 'Sort order (relevance, hot, top)',
        enum: ['relevance', 'hot', 'top']
      }
    },
    required: ['query']
  };

  registry.registerTool(redditCommunitiesTool);

  logger.info('Advanced professional forums search tools registered successfully');
}

/**
 * 去重Reddit搜索结果
 */
function deduplicateRedditResults(results: any[]): any[] {
  const seen = new Set<string>();
  return results.filter(result => {
    const key = result.url || result.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
