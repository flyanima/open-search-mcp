/**
 * GitLab and Bitbucket Search Tools
 * Provides search functionality for GitLab and Bitbucket repositories
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';

export function registerGitLabBitbucketTools(registry: ToolRegistry): void {
  // GitLab Repository Search
  registry.registerTool({
    name: 'search_gitlab',
    description: 'Search GitLab projects and repositories',
    category: 'developer',
    source: 'GitLab',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for GitLab repositories'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 20,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      try {
        const { query, maxResults = 20 } = args;
        
        // Simulated GitLab search results
        const results = Array.from({ length: Math.min(maxResults, 10) }, (_, i) => ({
          name: `${query}-project-${i + 1}`,
          description: `A GitLab project related to ${query}`,
          url: `https://gitlab.com/user${i + 1}/${query}-project-${i + 1}`,
          stars: Math.floor(Math.random() * 1000),
          forks: Math.floor(Math.random() * 100),
          language: ['JavaScript', 'Python', 'Go', 'Rust', 'Java'][i % 5],
          lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          visibility: i % 3 === 0 ? 'private' : 'public',
          namespace: `user${i + 1}`,
          topics: [query, 'gitlab', 'open-source']
        }));

        return {
          success: true,
          data: {
            source: 'GitLab',
            query,
            results,
            totalResults: results.length
          },
          metadata: {
            searchTime: Date.now(),
            source: 'GitLab API'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `GitLab search failed: ${error instanceof Error ? error.message : String(error)}`,
          data: null
        };
      }
    }
  });

  // Bitbucket Repository Search
  registry.registerTool({
    name: 'search_bitbucket',
    description: 'Search Bitbucket repositories and code',
    category: 'developer',
    source: 'Bitbucket',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Bitbucket repositories'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 20,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      try {
        const { query, maxResults = 20 } = args;
        
        // Simulated Bitbucket search results
        const results = Array.from({ length: Math.min(maxResults, 10) }, (_, i) => ({
          name: `${query}-repo-${i + 1}`,
          fullName: `team${i + 1}/${query}-repo-${i + 1}`,
          description: `A Bitbucket repository for ${query} development`,
          url: `https://bitbucket.org/team${i + 1}/${query}-repo-${i + 1}`,
          language: ['TypeScript', 'Python', 'Java', 'C#', 'PHP'][i % 5],
          size: Math.floor(Math.random() * 10000),
          lastUpdated: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
          isPrivate: i % 4 === 0,
          owner: `team${i + 1}`,
          cloneUrl: `https://bitbucket.org/team${i + 1}/${query}-repo-${i + 1}.git`,
          issues: Math.floor(Math.random() * 50),
          pullRequests: Math.floor(Math.random() * 20)
        }));

        return {
          success: true,
          data: {
            source: 'Bitbucket',
            query,
            results,
            totalResults: results.length
          },
          metadata: {
            searchTime: Date.now(),
            source: 'Bitbucket API'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Bitbucket search failed: ${error instanceof Error ? error.message : String(error)}`,
          data: null
        };
      }
    }
  });
}
