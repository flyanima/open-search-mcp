/**
 * JSONPlaceholder API Tools Registration
 * 注册JSONPlaceholder测试API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * JSONPlaceholder API客户端
 */
class JSONPlaceholderAPIClient {
  private baseURL = 'https://jsonplaceholder.typicode.com';

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async getPosts(limit?: number) {
    const posts = await this.makeRequest('/posts');
    return limit ? posts.slice(0, limit) : posts;
  }

  async getUsers(limit?: number) {
    const users = await this.makeRequest('/users');
    return limit ? users.slice(0, limit) : users;
  }

  async getComments(postId?: number, limit?: number) {
    const endpoint = postId ? `/posts/${postId}/comments` : '/comments';
    const comments = await this.makeRequest(endpoint);
    return limit ? comments.slice(0, limit) : comments;
  }

  async getAlbums(userId?: number, limit?: number) {
    const endpoint = userId ? `/users/${userId}/albums` : '/albums';
    const albums = await this.makeRequest(endpoint);
    return limit ? albums.slice(0, limit) : albums;
  }

  async getPhotos(albumId?: number, limit?: number) {
    const endpoint = albumId ? `/albums/${albumId}/photos` : '/photos';
    const photos = await this.makeRequest(endpoint);
    return limit ? photos.slice(0, limit) : photos;
  }

  async getTodos(userId?: number, limit?: number) {
    const endpoint = userId ? `/users/${userId}/todos` : '/todos';
    const todos = await this.makeRequest(endpoint);
    return limit ? todos.slice(0, limit) : todos;
  }
}

/**
 * 注册所有JSONPlaceholder API工具
 */
export function registerJSONPlaceholderTools(registry: ToolRegistry): void {
  const client = new JSONPlaceholderAPIClient();

  // 1. 获取测试帖子
  registry.registerTool({
    name: 'jsonplaceholder_posts',
    description: 'Get test posts data from JSONPlaceholder (always works, good for testing)',
    category: 'testing',
    source: 'jsonplaceholder.typicode.com',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of posts to return (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const posts = await client.getPosts(args.limit || 10);
        
        return {
          success: true,
          data: {
            source: 'JSONPlaceholder API',
            type: 'posts',
            results: posts,
            count: posts.length,
            timestamp: Date.now(),
            apiUsed: true,
            note: 'This is test data from JSONPlaceholder - always reliable for testing'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get test posts'
        };
      }
    }
  });

  // 2. 获取测试用户
  registry.registerTool({
    name: 'jsonplaceholder_users',
    description: 'Get test users data from JSONPlaceholder',
    category: 'testing',
    source: 'jsonplaceholder.typicode.com',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of users to return (1-10)',
          default: 5,
          minimum: 1,
          maximum: 10
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const users = await client.getUsers(args.limit || 5);
        
        return {
          success: true,
          data: {
            source: 'JSONPlaceholder API',
            type: 'users',
            results: users,
            count: users.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get test users'
        };
      }
    }
  });

  // 3. 获取测试评论
  registry.registerTool({
    name: 'jsonplaceholder_comments',
    description: 'Get test comments data from JSONPlaceholder',
    category: 'testing',
    source: 'jsonplaceholder.typicode.com',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'number',
          description: 'Post ID to get comments for (1-100, optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of comments to return (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const comments = await client.getComments(args.postId, args.limit || 10);
        
        return {
          success: true,
          data: {
            source: 'JSONPlaceholder API',
            type: 'comments',
            postId: args.postId,
            results: comments,
            count: comments.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get test comments'
        };
      }
    }
  });

  // 4. 获取测试相册
  registry.registerTool({
    name: 'jsonplaceholder_albums',
    description: 'Get test albums data from JSONPlaceholder',
    category: 'testing',
    source: 'jsonplaceholder.typicode.com',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'number',
          description: 'User ID to get albums for (1-10, optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of albums to return (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const albums = await client.getAlbums(args.userId, args.limit || 10);
        
        return {
          success: true,
          data: {
            source: 'JSONPlaceholder API',
            type: 'albums',
            userId: args.userId,
            results: albums,
            count: albums.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get test albums'
        };
      }
    }
  });

  // 5. API健康测试
  registry.registerTool({
    name: 'jsonplaceholder_health_test',
    description: 'Test API connectivity and response times using JSONPlaceholder',
    category: 'testing',
    source: 'jsonplaceholder.typicode.com',
    inputSchema: {
      type: 'object',
      properties: {
        endpoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Endpoints to test: posts, users, comments, albums, photos, todos',
          default: ['posts', 'users', 'comments']
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const endpoints = args.endpoints || ['posts', 'users', 'comments'];
        const testResults: any = {
          timestamp: new Date().toISOString(),
          endpoints_tested: endpoints,
          results: {},
          summary: {
            total_tests: endpoints.length,
            successful: 0,
            failed: 0,
            average_response_time: 0
          }
        };

        let totalResponseTime = 0;

        for (const endpoint of endpoints) {
          const startTime = Date.now();
          try {
            let data;
            switch (endpoint) {
              case 'posts':
                data = await client.getPosts(3);
                break;
              case 'users':
                data = await client.getUsers(3);
                break;
              case 'comments':
                data = await client.getComments(undefined, 3);
                break;
              case 'albums':
                data = await client.getAlbums(undefined, 3);
                break;
              case 'photos':
                data = await client.getPhotos(undefined, 3);
                break;
              case 'todos':
                data = await client.getTodos(undefined, 3);
                break;
              default:
                throw new Error(`Unknown endpoint: ${endpoint}`);
            }

            const responseTime = Date.now() - startTime;
            totalResponseTime += responseTime;

            testResults.results[endpoint] = {
              status: 'success',
              response_time: responseTime,
              data_count: Array.isArray(data) ? data.length : 1
            };
            testResults.summary.successful++;

          } catch (error) {
            const responseTime = Date.now() - startTime;
            testResults.results[endpoint] = {
              status: 'failed',
              response_time: responseTime,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
            testResults.summary.failed++;
          }
        }

        testResults.summary.average_response_time = Math.round(totalResponseTime / endpoints.length);

        return {
          success: true,
          data: {
            source: 'JSONPlaceholder API',
            health_test: testResults,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run health test'
        };
      }
    }
  });

}
