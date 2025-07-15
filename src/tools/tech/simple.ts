/**
 * Technology Search Tools with Real Implementation
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';
// import { registerEnhancedGitHubSearchTool } from './github-enhanced.js'; // Removed - file deleted

export function registerTechTools(registry: ToolRegistry): void {
  // Removed enhanced GitHub search tool - file deleted

  // GitHub repository search (legacy - keeping for backward compatibility)
  registry.registerTool({
    name: 'search_github_legacy',
    description: 'Search GitHub repositories and code',
    category: 'tech',
    source: 'github.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum results to return' },
        searchType: { type: 'string', description: 'Search type: repositories, code, users (default: repositories)' },
        language: { type: 'string', description: 'Programming language filter' },
        sortBy: { type: 'string', description: 'Sort by: stars, forks, updated (default: stars)' }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const maxResults = Math.min(args.maxResults || 10, 30);
      const searchType = args.searchType || 'repositories';
      const language = args.language || '';
      const sortBy = args.sortBy || 'stars';

      try {
        const startTime = Date.now();

        // GitHub Search API (no authentication required for public repositories)
        let searchUrl = 'https://api.github.com/search/repositories';
        let searchQuery = query;

        // Add language filter if specified
        if (language) {
          searchQuery += ` language:${language}`;
        }

        // Adjust URL based on search type
        if (searchType === 'code') {
          searchUrl = 'https://api.github.com/search/code';
        } else if (searchType === 'users') {
          searchUrl = 'https://api.github.com/search/users';
        }

        const params: any = {
          q: searchQuery,
          per_page: maxResults,
          sort: sortBy,
          order: 'desc'
        };

        const headers: any = {
          'User-Agent': 'Open-Search-MCP/1.0',
          'Accept': 'application/vnd.github.v3+json'
        };

        // Add GitHub token if available for better rate limits and code search
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          headers['Authorization'] = `token ${githubToken}`;
        }

        const response = await axios.get(searchUrl, {
          params,
          timeout: 10000,
          headers
        });

        const results: any[] = [];

        if (response.data?.items) {
          for (const item of response.data.items) {
            if (searchType === 'repositories') {
              results.push({
                id: item.id,
                name: item.name,
                fullName: item.full_name,
                description: item.description,
                url: item.html_url,
                cloneUrl: item.clone_url,
                language: item.language,
                stars: item.stargazers_count,
                forks: item.forks_count,
                watchers: item.watchers_count,
                issues: item.open_issues_count,
                size: item.size,
                created: item.created_at,
                updated: item.updated_at,
                owner: {
                  login: item.owner.login,
                  type: item.owner.type,
                  url: item.owner.html_url,
                  avatar: item.owner.avatar_url
                },
                topics: item.topics || [],
                license: item.license?.name,
                defaultBranch: item.default_branch,
                isPrivate: item.private,
                isFork: item.fork,
                hasWiki: item.has_wiki,
                hasPages: item.has_pages
              });
            } else if (searchType === 'code') {
              results.push({
                name: item.name,
                path: item.path,
                sha: item.sha,
                url: item.html_url,
                repository: {
                  name: item.repository.name,
                  fullName: item.repository.full_name,
                  url: item.repository.html_url,
                  owner: item.repository.owner.login
                },
                score: item.score
              });
            } else if (searchType === 'users') {
              results.push({
                id: item.id,
                login: item.login,
                type: item.type,
                url: item.html_url,
                avatar: item.avatar_url,
                score: item.score
              });
            }
          }
        }

        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'GitHub',
            query,
            results: results.slice(0, maxResults),
            totalResults: response.data?.total_count || results.length,
            searchTime,
            searchType,
            language,
            sortBy
          },
          metadata: {
            totalResults: response.data?.total_count || results.length,
            searchTime,
            sources: ['github.com'],
            cached: false
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `GitHub search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
