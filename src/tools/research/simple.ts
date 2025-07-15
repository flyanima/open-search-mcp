/**
 * Comprehensive Research Tools with Multi-Source Integration
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';

export function registerResearchTools(registry: ToolRegistry): void {
  // Comprehensive multi-source research tool
  registry.registerTool({
    name: 'search_comprehensive',
    description: 'Perform comprehensive research across multiple sources (arXiv, Wikipedia, GitHub, Hacker News)',
    category: 'research',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research query' },
        maxResults: { type: 'number', description: 'Maximum results per source (default: 3)' },
        sources: { type: 'array', items: { type: 'string' }, description: 'Sources to search: arxiv, wikipedia, github, hackernews (default: all)' },
        includeAcademic: { type: 'boolean', description: 'Include academic papers from arXiv (default: true)' },
        includeCode: { type: 'boolean', description: 'Include code repositories from GitHub (default: true)' },
        includeNews: { type: 'boolean', description: 'Include tech news from Hacker News (default: true)' },
        includeWiki: { type: 'boolean', description: 'Include Wikipedia articles (default: true)' }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const maxResults = Math.min(args.maxResults || 3, 5);
      const includeAcademic = args.includeAcademic !== false;
      const includeCode = args.includeCode !== false;
      const includeNews = args.includeNews !== false;
      const includeWiki = args.includeWiki !== false;

      try {
        const startTime = Date.now();
        const results: any = {
          academic: [],
          code: [],
          news: [],
          wiki: [],
          summary: {
            totalSources: 0,
            totalResults: 0,
            searchTime: 0
          }
        };
        const sources: string[] = [];

        // Parallel search across all sources
        const searchPromises: Promise<any>[] = [];

        // 1. arXiv Academic Search
        if (includeAcademic) {
          searchPromises.push(
            searchArxiv(query, maxResults).then(data => {
              results.academic = data.results || [];
              if (data.results?.length > 0) sources.push('arxiv.org');
              return data;
            }).catch(err => {return { results: [] };
            })
          );
        }

        // 2. GitHub Code Search
        if (includeCode) {
          searchPromises.push(
            searchGitHub(query, maxResults).then(data => {
              results.code = data.results || [];
              if (data.results?.length > 0) sources.push('github.com');
              return data;
            }).catch(err => {return { results: [] };
            })
          );
        }

        // 3. Hacker News Search
        if (includeNews) {
          searchPromises.push(
            searchHackerNews(query, maxResults).then(data => {
              results.news = data.results || [];
              if (data.results?.length > 0) sources.push('news.ycombinator.com');
              return data;
            }).catch(err => {return { results: [] };
            })
          );
        }

        // 4. Wikipedia Search
        if (includeWiki) {
          searchPromises.push(
            searchWikipedia(query, maxResults).then(data => {
              results.wiki = data.results || [];
              if (data.results?.length > 0) sources.push('en.wikipedia.org');
              return data;
            }).catch(err => {return { results: [] };
            })
          );
        }

        // Wait for all searches to complete
        await Promise.all(searchPromises);

        const searchTime = Date.now() - startTime;
        const totalResults = results.academic.length + results.code.length + results.news.length + results.wiki.length;

        results.summary = {
          totalSources: sources.length,
          totalResults,
          searchTime,
          sources
        };

        return {
          success: true,
          data: {
            source: 'Comprehensive Research',
            query,
            academic: results.academic,
            code: results.code,
            news: results.news,
            wiki: results.wiki,
            summary: results.summary,
            includeAcademic,
            includeCode,
            includeNews,
            includeWiki
          },
          metadata: {
            totalResults,
            searchTime,
            sources,
            cached: false
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Comprehensive research failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}

/**
 * Search arXiv for academic papers
 */
async function searchArxiv(query: string, maxResults: number): Promise<any> {
  const apiUrl = 'http://export.arxiv.org/api/query';
  const params = {
    search_query: `all:${encodeURIComponent(query)}`,
    start: 0,
    max_results: maxResults,
    sortBy: 'relevance',
    sortOrder: 'descending'
  };

  const response = await axios.get(apiUrl, {
    params,
    timeout: 10000,
    headers: {
      'User-Agent': 'Open-Search-MCP/1.0'
    }
  });

  const results: any[] = [];

  // Parse XML response
  const entries = response.data.match(/<entry>(.*?)<\/entry>/gs) || [];

  for (const entry of entries.slice(0, maxResults)) {
    const id = extractXMLValue(entry, 'id');
    const title = extractXMLValue(entry, 'title')?.replace(/\s+/g, ' ').trim();
    const summary = extractXMLValue(entry, 'summary')?.replace(/\s+/g, ' ').trim();
    const published = extractXMLValue(entry, 'published');

    if (title && summary) {
      results.push({
        id,
        title,
        summary: summary.substring(0, 300) + (summary.length > 300 ? '...' : ''),
        published,
        url: id,
        type: 'academic_paper'
      });
    }
  }

  return { results };
}

/**
 * Search GitHub repositories
 */
async function searchGitHub(query: string, maxResults: number): Promise<any> {
  const response = await axios.get('https://api.github.com/search/repositories', {
    params: {
      q: query,
      sort: 'stars',
      order: 'desc',
      per_page: maxResults
    },
    timeout: 10000,
    headers: {
      'User-Agent': 'Open-Search-MCP/1.0',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  const results: any[] = [];

  if (response.data?.items) {
    for (const item of response.data.items.slice(0, maxResults)) {
      results.push({
        name: item.full_name,
        description: item.description,
        url: item.html_url,
        stars: item.stargazers_count,
        language: item.language,
        updated: item.updated_at,
        type: 'code_repository'
      });
    }
  }

  return { results };
}

/**
 * Search Hacker News
 */
async function searchHackerNews(query: string, maxResults: number): Promise<any> {
  const response = await axios.get('https://hn.algolia.com/api/v1/search', {
    params: {
      query,
      tags: 'story',
      hitsPerPage: maxResults
    },
    timeout: 10000,
    headers: {
      'User-Agent': 'Open-Search-MCP/1.0'
    }
  });

  const results: any[] = [];

  if (response.data?.hits) {
    for (const hit of response.data.hits.slice(0, maxResults)) {
      results.push({
        title: hit.title,
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        points: hit.points,
        comments: hit.num_comments,
        author: hit.author,
        created: hit.created_at,
        type: 'tech_news'
      });
    }
  }

  return { results };
}

/**
 * Search Wikipedia
 */
async function searchWikipedia(query: string, maxResults: number): Promise<any> {
  // Try direct page lookup first
  try {
    const directResponse = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Open-Search-MCP/1.0'
      }
    });

    if (directResponse.data && !directResponse.data.type?.includes('disambiguation')) {
      return {
        results: [{
          title: directResponse.data.title,
          summary: directResponse.data.extract,
          url: directResponse.data.content_urls?.desktop?.page,
          type: 'encyclopedia_article'
        }]
      };
    }
  } catch (directError) {
    // Continue to search if direct lookup fails
  }

  // Fallback to search
  const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
    params: {
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      srlimit: maxResults
    },
    timeout: 5000,
    headers: {
      'User-Agent': 'Open-Search-MCP/1.0'
    }
  });

  const results: any[] = [];

  if (searchResponse.data?.query?.search) {
    for (const item of searchResponse.data.query.search.slice(0, maxResults)) {
      results.push({
        title: item.title,
        summary: item.snippet?.replace(/<[^>]*>/g, ''),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        type: 'encyclopedia_article'
      });
    }
  }

  return { results };
}

/**
 * Extract value from XML tag
 */
function extractXMLValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}
