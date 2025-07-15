/**
 * Web Search Tools with Real Implementation
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';

export function registerWebTools(registry: ToolRegistry): void {
  // Wikipedia search with real implementation
  registry.registerTool({
    name: 'search_wikipedia',
    description: 'Search Wikipedia for information',
    category: 'web',
    source: 'wikipedia.org',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum results to return' },
        language: { type: 'string', description: 'Language code (default: en)' }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const maxResults = Math.min(args.maxResults || 10, 20);
      const language = args.language || 'en';

      try {
        const startTime = Date.now();

        // Wikipedia API search
        const searchUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const listUrl = `https://${language}.wikipedia.org/w/api.php`;

        const results: any[] = [];

        // First try direct page lookup
        try {
          const directResponse = await axios.get(searchUrl, {
            timeout: 5000,
            headers: {
              'User-Agent': 'Open-Search-MCP/1.0'
            }
          });

          if (directResponse.data && directResponse.data.title) {
            results.push({
              title: directResponse.data.title,
              summary: directResponse.data.extract,
              url: directResponse.data.content_urls?.desktop?.page,
              thumbnail: directResponse.data.thumbnail?.source,
              type: 'direct_match'
            });
          }
        } catch (directError) {
          // Direct lookup failed, continue with search
        }

        // Search for multiple results
        const searchParams = {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: query,
          srlimit: maxResults,
          srprop: 'snippet|titlesnippet|size|timestamp'
        };

        const searchResponse = await axios.get(listUrl, {
          params: searchParams,
          timeout: 10000,
          headers: {
            'User-Agent': 'Open-Search-MCP/1.0'
          }
        });

        if (searchResponse.data?.query?.search) {
          for (const item of searchResponse.data.query.search) {
            // Get page summary for each result
            try {
              const summaryUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title)}`;
              const summaryResponse = await axios.get(summaryUrl, {
                timeout: 3000,
                headers: {
                  'User-Agent': 'Open-Search-MCP/1.0'
                }
              });

              results.push({
                title: item.title,
                summary: summaryResponse.data.extract || item.snippet?.replace(/<[^>]*>/g, ''),
                url: summaryResponse.data.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                thumbnail: summaryResponse.data.thumbnail?.source,
                size: item.size,
                timestamp: item.timestamp,
                type: 'search_result'
              });
            } catch (summaryError) {
              // Add basic result without summary
              results.push({
                title: item.title,
                summary: item.snippet?.replace(/<[^>]*>/g, ''),
                url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                size: item.size,
                timestamp: item.timestamp,
                type: 'search_result'
              });
            }
          }
        }

        const searchTime = Date.now() - startTime;

        // Remove duplicates and limit results
        const uniqueResults = results.filter((result, index, self) =>
          index === self.findIndex(r => r.title === result.title)
        ).slice(0, maxResults);

        return {
          success: true,
          data: {
            source: 'Wikipedia',
            query,
            results: uniqueResults,
            totalResults: uniqueResults.length,
            searchTime,
            language
          },
          metadata: {
            totalResults: uniqueResults.length,
            searchTime,
            sources: [`${language}.wikipedia.org`],
            cached: false
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Wikipedia search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
