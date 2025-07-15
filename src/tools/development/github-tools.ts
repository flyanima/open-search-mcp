/**
 * GitHub Developer Tools
 * 提供GitHub代码仓库和代码搜索功能
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * GitHub API客户端
 */
class GitHubAPIClient {
  private token: string | undefined;
  private baseURL = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token;
  }

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Open-Search-MCP/2.0',
        'Accept': 'application/vnd.github.v3+json'
      };

      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers,
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchRepositories(query: string, options: any = {}) {
    const params = {
      q: query,
      sort: options.sort || 'best-match',
      order: options.order || 'desc',
      per_page: Math.min(options.per_page || 10, 100),
      page: options.page || 1
    };

    return await this.makeRequest('/search/repositories', params);
  }

  async searchCode(query: string, options: any = {}) {
    const params = {
      q: query,
      sort: options.sort || 'best-match',
      order: options.order || 'desc',
      per_page: Math.min(options.per_page || 10, 100),
      page: options.page || 1
    };

    return await this.makeRequest('/search/code', params);
  }

  async searchUsers(query: string, options: any = {}) {
    const params = {
      q: query,
      sort: options.sort || 'best-match',
      order: options.order || 'desc',
      per_page: Math.min(options.per_page || 10, 100),
      page: options.page || 1
    };

    return await this.makeRequest('/search/users', params);
  }

  async getRepository(owner: string, repo: string) {
    return await this.makeRequest(`/repos/${owner}/${repo}`);
  }

  async getRepositoryContents(owner: string, repo: string, path: string) {
    return await this.makeRequest(`/repos/${owner}/${repo}/contents/${path}`);
  }
}

export function registerGitHubTools(registry: ToolRegistry): void {
  const token = process.env.GITHUB_TOKEN;
  const client = new GitHubAPIClient(token);

  // GitHub仓库搜索
  registry.registerTool({
    name: 'github_repository_search',
    description: 'Search GitHub repositories with advanced filtering',
    category: 'development',
    source: 'GitHub',
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
          default: 'stars',
          enum: ['stars', 'forks', 'help-wanted-issues', 'updated']
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
      const { query, language, sort = 'stars', maxResults = 10 } = args;

      try {
        // 构建搜索查询
        let searchQuery = query;
        if (language) {
          searchQuery += ` language:${language}`;
        }

        const data = await client.searchRepositories(searchQuery, {
          sort,
          per_page: maxResults
        });
        
        const repositories = (data.items || []).map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || 'No description available',
          url: repo.html_url,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          topics: repo.topics || [],
          owner: {
            login: repo.owner.login,
            url: repo.owner.html_url,
            avatarUrl: repo.owner.avatar_url
          },
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          license: repo.license ? repo.license.name : null,
          isPrivate: repo.private,
          hasIssues: repo.has_issues,
          hasWiki: repo.has_wiki,
          openIssuesCount: repo.open_issues_count
        }));

        return {
          success: true,
          data: {
            source: 'GitHub API',
            query,
            language,
            sort,
            totalCount: data.total_count || 0,
            repositories,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search GitHub repositories'
        };
      }
    }
  });

  // GitHub代码搜索
  registry.registerTool({
    name: 'github_code_search',
    description: 'Search code across GitHub repositories',
    category: 'development',
    source: 'GitHub',
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
      const { query, language, maxResults = 10 } = args;

      try {
        // 构建搜索查询
        let searchQuery = query;
        if (language) {
          searchQuery += ` language:${language}`;
        }

        const data = await client.searchCode(searchQuery, {
          per_page: maxResults
        });
        
        const codeResults = (data.items || []).map((item: any) => ({
          name: item.name,
          path: item.path,
          repository: {
            name: item.repository.name,
            fullName: item.repository.full_name,
            url: item.repository.html_url
          },
          url: item.html_url,
          sha: item.sha,
          score: item.score,
          language: language || detectLanguage(item.name)
        }));

        return {
          success: true,
          data: {
            source: 'GitHub API',
            query,
            language,
            totalCount: data.total_count || 0,
            codeResults,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search GitHub code'
        };
      }
    }
  });

  // GitHub用户搜索
  registry.registerTool({
    name: 'github_user_search',
    description: 'Search for users and organizations on GitHub',
    category: 'development',
    source: 'GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User search query'
        },
        type: {
          type: 'string',
          description: 'Type of account to search for',
          enum: ['user', 'org'],
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
      const { query, type = 'user', maxResults = 10 } = args;

      try {
        // 构建搜索查询
        let searchQuery = query;
        if (type) {
          searchQuery += ` type:${type}`;
        }

        const data = await client.searchUsers(searchQuery, {
          per_page: maxResults
        });
        
        const users = (data.items || []).map((user: any) => ({
          id: user.id,
          login: user.login,
          url: user.html_url,
          avatarUrl: user.avatar_url,
          type: user.type,
          score: user.score,
          siteAdmin: user.site_admin
        }));

        return {
          success: true,
          data: {
            source: 'GitHub API',
            query,
            type,
            totalCount: data.total_count || 0,
            users,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search GitHub users'
        };
      }
    }
  });
}

// 根据文件名检测编程语言
function detectLanguage(filename: string): string {
  const extensions: Record<string, string> = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++',
    '.c': 'C',
    '.html': 'HTML',
    '.css': 'CSS',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin'
  };

  const ext = '.' + filename.split('.').pop();
  return extensions[ext] || 'Unknown';
}
