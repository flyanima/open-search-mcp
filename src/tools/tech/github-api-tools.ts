/**
 * GitHub API Tools Registration
 * 注册GitHub API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * GitHub API客户端
 */
class GitHubAPIClient {
  private token: string;
  private baseURL = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Open-Search-MCP/2.0'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchRepositories(query: string, options: any = {}) {
    return await this.makeRequest('/search/repositories', {
      q: query,
      sort: options.sort || 'stars',
      order: options.order || 'desc',
      per_page: options.per_page || 10,
      page: options.page || 1
    });
  }

  async searchCode(query: string, options: any = {}) {
    return await this.makeRequest('/search/code', {
      q: query,
      sort: options.sort || 'indexed',
      order: options.order || 'desc',
      per_page: options.per_page || 10,
      page: options.page || 1
    });
  }

  async searchUsers(query: string, options: any = {}) {
    return await this.makeRequest('/search/users', {
      q: query,
      sort: options.sort || 'followers',
      order: options.order || 'desc',
      per_page: options.per_page || 10,
      page: options.page || 1
    });
  }

  async searchIssues(query: string, options: any = {}) {
    return await this.makeRequest('/search/issues', {
      q: query,
      sort: options.sort || 'updated',
      order: options.order || 'desc',
      per_page: options.per_page || 10,
      page: options.page || 1
    });
  }

  async getTrendingRepositories(language?: string, since: string = 'daily') {
    const dateMap = {
      'daily': new Date(Date.now() - 24 * 60 * 60 * 1000),
      'weekly': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      'monthly': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    };

    const date = dateMap[since as keyof typeof dateMap] || dateMap.daily;
    const dateString = date.toISOString().split('T')[0];
    
    let query = `created:>${dateString}`;
    if (language) {
      query += ` language:${language}`;
    }

    return await this.searchRepositories(query, {
      sort: 'stars',
      order: 'desc',
      per_page: 10
    });
  }
}

/**
 * 注册所有GitHub API工具
 */
export function registerGitHubAPITools(registry: ToolRegistry): void {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {return;
  }

  const client = new GitHubAPIClient(token);

  // 1. 仓库搜索
  registry.registerTool({
    name: 'search_github',
    description: 'Search GitHub repositories with advanced filtering',
    category: 'tech',
    source: 'github.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for repositories (e.g., "machine learning", "react hooks", "python web framework")'
        },
        language: {
          type: 'string',
          description: 'Programming language filter (e.g., "javascript", "python", "go")'
        },
        sort: {
          type: 'string',
          description: 'Sort by: stars, forks, help-wanted-issues, updated',
          default: 'stars'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        let searchQuery = args.query;
        if (args.language) {
          searchQuery += ` language:${args.language}`;
        }

        const data = await client.searchRepositories(searchQuery, {
          sort: args.sort,
          per_page: args.maxResults || 10
        });

        // 处理GitHub API返回的仓库数据
        const processedResults = (data.items || []).map((repo: any) => ({
          name: repo.name || 'Unknown',
          fullName: repo.full_name || 'Unknown',
          url: repo.html_url || repo.url || '',
          description: repo.description || 'No description available',
          stars: repo.stargazers_count || 0,
          forks: repo.forks_count || 0,
          language: repo.language || 'Unknown',
          owner: repo.owner?.login || 'Unknown',
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          topics: repo.topics || [],
          license: repo.license?.name || 'No license'
        }));

        return {
          success: true,
          data: {
            source: 'GitHub API',
            query: args.query,
            language: args.language,
            results: processedResults,
            totalCount: data.total_count || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search repositories'
        };
      }
    }
  });

  // 2. 代码搜索
  registry.registerTool({
    name: 'github_code_search',
    description: 'Search code across GitHub repositories',
    category: 'tech',
    source: 'github.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Code search query (e.g., "function useState", "class Component", "async def")'
        },
        language: {
          type: 'string',
          description: 'Programming language filter'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        let searchQuery = args.query;
        if (args.language) {
          searchQuery += ` language:${args.language}`;
        }

        const data = await client.searchCode(searchQuery, {
          per_page: args.maxResults || 10
        });
        
        return {
          success: true,
          data: {
            source: 'GitHub API',
            query: args.query,
            language: args.language,
            results: data.items || [],
            totalCount: data.total_count || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search code'
        };
      }
    }
  });

  // 3. 用户搜索
  registry.registerTool({
    name: 'github_user_search',
    description: 'Search GitHub users and organizations',
    category: 'tech',
    source: 'github.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User search query (username, name, or organization)'
        },
        type: {
          type: 'string',
          description: 'User type: user, org',
          default: 'user'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        let searchQuery = args.query;
        if (args.type) {
          searchQuery += ` type:${args.type}`;
        }

        const data = await client.searchUsers(searchQuery, {
          per_page: args.maxResults || 10
        });
        
        return {
          success: true,
          data: {
            source: 'GitHub API',
            query: args.query,
            type: args.type,
            results: data.items || [],
            totalCount: data.total_count || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search users'
        };
      }
    }
  });

  // 4. 趋势仓库
  registry.registerTool({
    name: 'github_trending_repositories',
    description: 'Get trending GitHub repositories by language and time period',
    category: 'tech',
    source: 'github.com',
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description: 'Programming language (e.g., "javascript", "python", "go")'
        },
        since: {
          type: 'string',
          description: 'Time period: daily, weekly, monthly',
          default: 'daily'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const data = await client.getTrendingRepositories(args.language, args.since || 'daily');
        
        return {
          success: true,
          data: {
            source: 'GitHub API',
            language: args.language,
            since: args.since || 'daily',
            results: data.items || [],
            totalCount: data.total_count || 0,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get trending repositories'
        };
      }
    }
  });

}
