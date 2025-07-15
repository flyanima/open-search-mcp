/**
 * News Search Tools with Real Implementation
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';

export function registerNewsTools(registry: ToolRegistry): void {
  // Hacker News search using Algolia API
  registry.registerTool({
    name: 'search_hackernews',
    description: 'Search Hacker News for tech discussions and news',
    category: 'news',
    source: 'news.ycombinator.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum results to return' },
        searchType: { type: 'string', description: 'Search type: story, comment (default: story)' }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const maxResults = Math.min(args.maxResults || 10, 30);
      const searchType = args.searchType || 'story';

      try {
        const startTime = Date.now();

        // Use Algolia HN Search API (free)
        const searchUrl = 'https://hn.algolia.com/api/v1/search';
        const params = {
          query,
          tags: searchType,
          hitsPerPage: maxResults
        };

        const response = await axios.get(searchUrl, {
          params,
          timeout: 10000,
          headers: {
            'User-Agent': 'Open-Search-MCP/1.0'
          }
        });

        const results: any[] = [];

        if (response.data?.hits) {
          for (const hit of response.data.hits) {
            results.push({
              id: hit.objectID,
              title: hit.title || hit.story_title,
              url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
              author: hit.author,
              points: hit.points,
              numComments: hit.num_comments,
              createdAt: hit.created_at,
              tags: hit._tags,
              type: searchType,
              hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`
            });
          }
        }

        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'Hacker News',
            query,
            results,
            totalResults: response.data?.nbHits || results.length,
            searchTime,
            searchType
          },
          metadata: {
            totalResults: response.data?.nbHits || results.length,
            searchTime,
            sources: ['news.ycombinator.com'],
            cached: false
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Hacker News search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
