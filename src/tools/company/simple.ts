/**
 * Company Research Tools with Real Implementation
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';
// import { registerExaCompatibleCompanyTools } from './exa-compatible.js'; // Removed - file deleted

export function registerCompanyTools(registry: ToolRegistry): void {
  // Removed Exa-compatible company research tools - file deleted

  // Company information search using multiple free sources
  registry.registerTool({
    name: 'search_company_info',
    description: 'Search for company information from multiple sources',
    category: 'company',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Company name or search query' },
        maxResults: { type: 'number', description: 'Maximum results to return' },
        includeNews: { type: 'boolean', description: 'Include recent news about the company (default: true)' },
        includeGitHub: { type: 'boolean', description: 'Include GitHub repositories (default: true)' }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const maxResults = Math.min(args.maxResults || 5, 10);
      const includeNews = args.includeNews !== false;
      const includeGitHub = args.includeGitHub !== false;

      try {
        const startTime = Date.now();
        const results: any[] = [];
        const sources: string[] = [];

        // 1. Search GitHub for company repositories
        if (includeGitHub) {
          try {
            const githubResponse = await axios.get('https://api.github.com/search/repositories', {
              params: {
                q: `${query} in:name,description`,
                sort: 'stars',
                order: 'desc',
                per_page: Math.min(maxResults, 5)
              },
              timeout: 8000,
              headers: {
                'User-Agent': 'Open-Search-MCP/1.0',
                'Accept': 'application/vnd.github.v3+json'
              }
            });

            if (githubResponse.data?.items) {
              for (const repo of githubResponse.data.items.slice(0, 3)) {
                results.push({
                  type: 'github_repository',
                  name: repo.full_name,
                  description: repo.description,
                  url: repo.html_url,
                  stars: repo.stargazers_count,
                  forks: repo.forks_count,
                  language: repo.language,
                  updated: repo.updated_at,
                  owner: repo.owner.login,
                  topics: repo.topics || []
                });
              }
              sources.push('github.com');
            }
          } catch (githubError) {}
        }

        // 2. Search Hacker News for company mentions
        if (includeNews) {
          try {
            const hnResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
              params: {
                query: query,
                tags: 'story',
                hitsPerPage: Math.min(maxResults, 5)
              },
              timeout: 8000,
              headers: {
                'User-Agent': 'Open-Search-MCP/1.0'
              }
            });

            if (hnResponse.data?.hits) {
              for (const hit of hnResponse.data.hits.slice(0, 3)) {
                if (hit.title && hit.title.toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    type: 'news_mention',
                    title: hit.title,
                    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
                    author: hit.author,
                    points: hit.points,
                    comments: hit.num_comments,
                    created: hit.created_at,
                    source: 'Hacker News'
                  });
                }
              }
              sources.push('news.ycombinator.com');
            }
          } catch (hnError) {}
        }

        // 3. Search Wikipedia for company information
        try {
          const wikiResponse = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, {
            timeout: 5000,
            headers: {
              'User-Agent': 'Open-Search-MCP/1.0'
            }
          });

          if (wikiResponse.data && !wikiResponse.data.type?.includes('disambiguation')) {
            results.push({
              type: 'wikipedia_info',
              title: wikiResponse.data.title,
              summary: wikiResponse.data.extract,
              url: wikiResponse.data.content_urls?.desktop?.page,
              thumbnail: wikiResponse.data.thumbnail?.source,
              pageId: wikiResponse.data.pageid
            });
            sources.push('en.wikipedia.org');
          }
        } catch (wikiError) {}

        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'Company Research',
            query,
            results: results.slice(0, maxResults),
            totalResults: results.length,
            searchTime,
            includeNews,
            includeGitHub
          },
          metadata: {
            totalResults: results.length,
            searchTime,
            sources,
            cached: false
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Company research failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
