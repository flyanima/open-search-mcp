/**
 * Crawling Tools - Intelligent URL Content Extraction
 * 
 * Provides advanced web crawling and content extraction capabilities
 * with anti-detection features and AI-driven content processing.
 */

import { ToolRegistry, createTool } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import { Logger } from '../../utils/logger.js';
// import { registerEnhancedCrawlingTool } from './exa-compatible.js'; // Removed - file deleted

const logger = new Logger('CrawlingTools');

/**
 * Intelligent URL content extraction with anti-detection
 */
async function crawlUrl(args: ToolInput): Promise<ToolOutput> {
  const { url, maxCharacters = 5000, includeImages = false, waitForJs = true } = args;
  
  try {
    logger.info(`Crawling URL: ${url}`);
    
    // For now, implement a basic fetch-based crawler
    // TODO: Implement Puppeteer/Playwright for advanced crawling
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content = '';
    let title = 'No title found';

    // Read the response body only once
    const responseText = await response.text();

    if (contentType.includes('text/html')) {
      content = extractTextFromHtml(responseText);
      title = extractTitleFromHtml(responseText);
    } else if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(responseText);
        content = JSON.stringify(json, null, 2);
      } catch {
        content = responseText;
      }
    } else {
      content = responseText;
    }

    // Truncate content if needed
    if (content.length > maxCharacters) {
      content = content.substring(0, maxCharacters) + '...';
    }

    const result: ToolOutput = {
      success: true,
      data: {
        url,
        title,
        content,
        contentType,
        length: content.length,
        extractedAt: new Date().toISOString(),
        includeImages,
        waitForJs
      },
      metadata: {
        sources: ['web-crawler'],
        cached: false
      }
    };

    logger.info(`Successfully crawled ${url}, extracted ${content.length} characters`);
    return result;

  } catch (error) {
    logger.error(`Failed to crawl ${url}:`, error);
    
    return {
      success: false,
      error: `Failed to crawl URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['web-crawler'],
        cached: false
      }
    };
  }
}

/**
 * Extract clean text content from HTML
 */
function extractTextFromHtml(html: string): string {
  // Basic HTML text extraction (simplified version)
  // TODO: Implement proper HTML parsing with readability algorithms
  
  // Remove script and style elements
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Extract title from HTML
 */
function extractTitleFromHtml(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : 'No title found';
}

/**
 * Find competitors for a given company
 */
async function findCompetitors(args: ToolInput): Promise<ToolOutput> {
  const { companyName, industry, maxResults = 10 } = args;

  try {
    logger.info(`Finding competitors for: ${companyName}`);

    // Build search queries for competitor discovery
    const searchQueries = [
      `"${companyName}" competitors`,
      `"${companyName}" vs alternative`,
      `companies like "${companyName}"`,
      industry ? `${industry} companies similar to "${companyName}"` : null
    ].filter(Boolean);

    const competitors = [];

    // Search for competitors using multiple queries
    for (const query of searchQueries) {
      if (!query) continue; // Skip null queries

      try {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const html = await response.text();
          const extractedCompetitors = extractCompetitorsFromSearchResults(html, companyName);
          competitors.push(...extractedCompetitors);
        }
      } catch (error) {
        logger.warn(`Failed to search with query: ${query}`, error);
      }
    }

    // Remove duplicates and rank by relevance
    const uniqueCompetitors = removeDuplicateCompetitors(competitors);
    const rankedCompetitors = rankCompetitorsByRelevance(uniqueCompetitors, companyName, industry);

    // Limit results
    const finalResults = rankedCompetitors.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        targetCompany: companyName,
        industry: industry || 'Not specified',
        competitors: finalResults,
        totalFound: finalResults.length,
        searchQueries: searchQueries,
        analyzedAt: new Date().toISOString()
      },
      metadata: {
        sources: ['competitor-finder'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} competitors for ${companyName}`);
    return result;

  } catch (error) {
    logger.error(`Failed to find competitors for ${companyName}:`, error);

    return {
      success: false,
      error: `Failed to find competitors: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['competitor-finder'],
        cached: false
      }
    };
  }
}

/**
 * Extract competitor names from search results
 */
function extractCompetitorsFromSearchResults(html: string, targetCompany: string): any[] {
  const competitors = [];

  // Simple extraction logic - look for company names in search results
  // This is a basic implementation that could be enhanced with AI
  const companyPatterns = [
    /([A-Z][a-z]+ (?:Inc|Corp|LLC|Ltd|Company|Technologies|Systems|Solutions))/g,
    /([A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+)/g
  ];

  for (const pattern of companyPatterns) {
    const matches = html.match(pattern) || [];
    for (const match of matches) {
      if (match !== targetCompany && match.length > 3) {
        competitors.push({
          name: match.trim(),
          source: 'search-extraction',
          relevanceScore: 0.5 // Basic score, could be enhanced with AI
        });
      }
    }
  }

  return competitors;
}

/**
 * Remove duplicate competitors
 */
function removeDuplicateCompetitors(competitors: any[]): any[] {
  const seen = new Set();
  return competitors.filter(comp => {
    const key = comp.name.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Rank competitors by relevance
 */
function rankCompetitorsByRelevance(competitors: any[], targetCompany: string, industry?: string): any[] {
  return competitors
    .map(comp => ({
      ...comp,
      relevanceScore: calculateRelevanceScore(comp, targetCompany, industry)
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Calculate relevance score for a competitor
 */
function calculateRelevanceScore(competitor: any, targetCompany: string, industry?: string): number {
  let score = competitor.relevanceScore || 0.5;

  // Boost score if industry keywords are present
  if (industry) {
    const industryKeywords = industry.toLowerCase().split(' ');
    const companyName = competitor.name.toLowerCase();
    for (const keyword of industryKeywords) {
      if (companyName.includes(keyword)) {
        score += 0.2;
      }
    }
  }

  // Boost score for common business suffixes
  if (/\b(inc|corp|llc|ltd|company|technologies|systems|solutions)\b/i.test(competitor.name)) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Search LinkedIn profiles through search engines (compliant method)
 */
async function searchLinkedIn(args: ToolInput): Promise<ToolOutput> {
  const { query, searchType = 'profiles', maxResults = 10 } = args;

  try {
    logger.info(`Searching LinkedIn for: ${query} (type: ${searchType})`);

    // Build LinkedIn-specific search queries for search engines
    const searchQueries = [];

    if (searchType === 'profiles' || searchType === 'all') {
      searchQueries.push(`site:linkedin.com/in "${query}"`);
      searchQueries.push(`site:linkedin.com/in ${query}`);
    }

    if (searchType === 'companies' || searchType === 'all') {
      searchQueries.push(`site:linkedin.com/company "${query}"`);
      searchQueries.push(`site:linkedin.com/company ${query}`);
    }

    if (searchType === 'posts' || searchType === 'all') {
      searchQueries.push(`site:linkedin.com/posts "${query}"`);
      searchQueries.push(`site:linkedin.com/feed "${query}"`);
    }

    const results = [];

    // Search using multiple queries
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
          const extractedResults = extractLinkedInResultsFromSearch(html, searchType);
          results.push(...extractedResults);
        }
      } catch (error) {
        logger.warn(`Failed to search with query: ${searchQuery}`, error);
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = removeDuplicateLinkedInResults(results);
    const finalResults = uniqueResults.slice(0, maxResults);

    const result: ToolOutput = {
      success: true,
      data: {
        query,
        searchType,
        results: finalResults,
        totalFound: finalResults.length,
        searchQueries: searchQueries,
        disclaimer: 'This search only accesses publicly available LinkedIn information through search engines. Users must ensure compliance with LinkedIn\'s terms of service.',
        searchedAt: new Date().toISOString()
      },
      metadata: {
        sources: ['linkedin-search'],
        cached: false
      }
    };

    logger.info(`Found ${finalResults.length} LinkedIn results for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed to search LinkedIn for ${query}:`, error);

    return {
      success: false,
      error: `Failed to search LinkedIn: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['linkedin-search'],
        cached: false
      }
    };
  }
}

/**
 * Extract LinkedIn results from search engine results
 */
function extractLinkedInResultsFromSearch(html: string, searchType: string): any[] {
  const results = [];

  // Extract LinkedIn URLs from search results
  const linkedinUrlPattern = /https?:\/\/[a-z]{2,3}\.linkedin\.com\/[^\s"<>]+/gi;
  const urls = html.match(linkedinUrlPattern) || [];

  for (const url of urls) {
    try {
      const cleanUrl = url.replace(/['"<>]/g, '');
      const result = parseLinkedInUrl(cleanUrl, searchType);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      // Skip invalid URLs
    }
  }

  return results;
}

/**
 * Parse LinkedIn URL and extract information
 */
function parseLinkedInUrl(url: string, searchType: string): any | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname.includes('linkedin.com')) {
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      if (pathParts[0] === 'in' && (searchType === 'profiles' || searchType === 'all')) {
        // Profile URL
        return {
          type: 'profile',
          url: url,
          username: pathParts[1] || 'unknown',
          title: extractTitleFromUrl(url),
          source: 'search-engine'
        };
      } else if (pathParts[0] === 'company' && (searchType === 'companies' || searchType === 'all')) {
        // Company URL
        return {
          type: 'company',
          url: url,
          companyName: pathParts[1] || 'unknown',
          title: extractTitleFromUrl(url),
          source: 'search-engine'
        };
      } else if ((pathParts[0] === 'posts' || pathParts[0] === 'feed') && (searchType === 'posts' || searchType === 'all')) {
        // Post URL
        return {
          type: 'post',
          url: url,
          title: extractTitleFromUrl(url),
          source: 'search-engine'
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract title from URL (simplified)
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    return pathParts.join(' - ') || 'LinkedIn Result';
  } catch {
    return 'LinkedIn Result';
  }
}

/**
 * Remove duplicate LinkedIn results
 */
function removeDuplicateLinkedInResults(results: any[]): any[] {
  const seen = new Set();
  return results.filter(result => {
    const key = result.url.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Register all crawling tools
 */
export function registerCrawlingTools(registry: ToolRegistry): void {
  logger.info('Registering crawling tools...');

  // Removed enhanced Exa-compatible crawling tool - file deleted

  // Main crawling tool (legacy - keeping for backward compatibility)
  const crawlingTool = createTool(
    'crawl_url_legacy',
    'Extract content from any URL with intelligent parsing and anti-detection',
    'crawling',
    'web-crawler',
    crawlUrl,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 30,  // 30 requests per minute
      requiredParams: ['url'],
      optionalParams: ['maxCharacters', 'includeImages', 'waitForJs']
    }
  );

  // Override the input schema for crawling-specific parameters
  crawlingTool.inputSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to crawl and extract content from'
      },
      maxCharacters: {
        type: 'number',
        description: 'Maximum characters to extract (default: 5000)'
      },
      includeImages: {
        type: 'boolean',
        description: 'Whether to include image information (default: false)'
      },
      waitForJs: {
        type: 'boolean',
        description: 'Whether to wait for JavaScript execution (default: true)'
      }
    },
    required: ['url']
  };

  registry.registerTool(crawlingTool);

  // Competitor finder tool
  const competitorTool = createTool(
    'find_competitors',
    'Find competitors for a given company using intelligent search and analysis',
    'crawling',
    'competitor-finder',
    findCompetitors,
    {
      cacheTTL: 3600, // 1 hour cache
      rateLimit: 20,  // 20 requests per minute
      requiredParams: ['companyName'],
      optionalParams: ['industry', 'maxResults']
    }
  );

  // Override the input schema for competitor-specific parameters
  competitorTool.inputSchema = {
    type: 'object',
    properties: {
      companyName: {
        type: 'string',
        description: 'Name of the company to find competitors for'
      },
      industry: {
        type: 'string',
        description: 'Industry sector to focus the search (optional)'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of competitors to return (default: 10)'
      }
    },
    required: ['companyName']
  };

  registry.registerTool(competitorTool);

  // LinkedIn search tool
  const linkedinTool = createTool(
    'search_linkedin',
    'Search LinkedIn profiles, companies, and posts through search engines (compliant method)',
    'crawling',
    'linkedin-search',
    searchLinkedIn,
    {
      cacheTTL: 3600, // 1 hour cache
      rateLimit: 15,  // 15 requests per minute (conservative)
      requiredParams: ['query'],
      optionalParams: ['searchType', 'maxResults']
    }
  );

  // Override the input schema for LinkedIn-specific parameters
  linkedinTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for LinkedIn content'
      },
      searchType: {
        type: 'string',
        description: 'Type of LinkedIn content to search (profiles, companies, posts, all)',
        enum: ['profiles', 'companies', 'posts', 'all']
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)'
      }
    },
    required: ['query']
  };

  registry.registerTool(linkedinTool);

  logger.info('Crawling tools registered successfully');
}
