/**
 * Stack Overflow Developer Tools
 * 提供Stack Overflow问题和答案搜索功能
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Stack Overflow API客户端
 */
class StackOverflowAPIClient {
  private baseURL = 'https://api.stackexchange.com/2.3';

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          ...params,
          site: params.site || 'stackoverflow'
        },
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchQuestions(query: string, options: any = {}) {
    const params = {
      q: query,
      sort: options.sort || 'relevance',
      order: options.order || 'desc',
      tagged: options.tagged,
      pagesize: Math.min(options.pagesize || 10, 100),
      page: options.page || 1,
      site: options.site || 'stackoverflow'
    };

    return await this.makeRequest('/search/advanced', params);
  }

  async getQuestionDetails(questionId: number, options: any = {}) {
    const params = {
      filter: 'withbody',
      site: options.site || 'stackoverflow'
    };

    return await this.makeRequest(`/questions/${questionId}`, params);
  }

  async getAnswers(questionId: number, options: any = {}) {
    const params = {
      sort: options.sort || 'votes',
      order: options.order || 'desc',
      filter: 'withbody',
      pagesize: Math.min(options.pagesize || 10, 100),
      page: options.page || 1,
      site: options.site || 'stackoverflow'
    };

    return await this.makeRequest(`/questions/${questionId}/answers`, params);
  }

  async searchTags(inname: string, options: any = {}) {
    const params = {
      inname,
      sort: options.sort || 'popular',
      order: options.order || 'desc',
      pagesize: Math.min(options.pagesize || 10, 100),
      page: options.page || 1,
      site: options.site || 'stackoverflow'
    };

    return await this.makeRequest('/tags', params);
  }
}

export function registerStackOverflowTools(registry: ToolRegistry): void {
  const client = new StackOverflowAPIClient();

  // Stack Overflow问题搜索
  registry.registerTool({
    name: 'stackoverflow_search',
    description: 'Search Stack Overflow questions and answers',
    category: 'development',
    source: 'Stack Overflow',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Stack Overflow (e.g., "javascript async await", "python pandas", "react hooks")'
        },
        tags: {
          type: 'string',
          description: 'Comma-separated list of tags to filter by (e.g., "javascript,react,node.js")'
        },
        sort: {
          type: 'string',
          description: 'Sort order: relevance, votes, activity, creation',
          default: 'relevance',
          enum: ['relevance', 'votes', 'activity', 'creation']
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
      const { query, tags, sort = 'relevance', maxResults = 10 } = args;

      try {
        const data = await client.searchQuestions(query, {
          sort,
          tagged: tags,
          pagesize: maxResults
        });
        
        const questions = (data.items || []).map((item: any) => ({
          questionId: item.question_id,
          title: item.title,
          link: item.link,
          score: item.score,
          answerCount: item.answer_count,
          isAnswered: item.is_answered,
          acceptedAnswerId: item.accepted_answer_id,
          viewCount: item.view_count,
          tags: item.tags || [],
          creationDate: new Date(item.creation_date * 1000).toISOString(),
          lastActivityDate: new Date(item.last_activity_date * 1000).toISOString(),
          owner: item.owner ? {
            userId: item.owner.user_id,
            displayName: item.owner.display_name,
            reputation: item.owner.reputation,
            profileImage: item.owner.profile_image
          } : null
        }));

        return {
          success: true,
          data: {
            source: 'Stack Overflow API',
            query,
            tags,
            sort,
            totalResults: data.total || 0,
            hasMore: data.has_more || false,
            questions,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search Stack Overflow'
        };
      }
    }
  });

  // Stack Overflow问题详情
  registry.registerTool({
    name: 'stackoverflow_question_details',
    description: 'Get detailed information about a specific Stack Overflow question and its answers',
    category: 'development',
    source: 'Stack Overflow',
    inputSchema: {
      type: 'object',
      properties: {
        questionId: {
          type: 'number',
          description: 'Stack Overflow question ID'
        },
        maxAnswers: {
          type: 'number',
          description: 'Maximum number of answers to return (1-100)',
          default: 5,
          minimum: 1,
          maximum: 100
        },
        answerSort: {
          type: 'string',
          description: 'Sort order for answers: votes, activity, creation',
          default: 'votes',
          enum: ['votes', 'activity', 'creation']
        }
      },
      required: ['questionId']
    },
    execute: async (args: any) => {
      const { questionId, maxAnswers = 5, answerSort = 'votes' } = args;

      try {
        // 获取问题详情
        const questionData = await client.getQuestionDetails(questionId);
        if (!questionData.items || questionData.items.length === 0) {
          return {
            success: false,
            error: `Question with ID ${questionId} not found`
          };
        }

        const question = questionData.items[0];

        // 获取答案
        const answersData = await client.getAnswers(questionId, {
          sort: answerSort,
          pagesize: maxAnswers
        });

        const answers = (answersData.items || []).map((item: any) => ({
          answerId: item.answer_id,
          score: item.score,
          isAccepted: item.is_accepted,
          body: item.body,
          creationDate: new Date(item.creation_date * 1000).toISOString(),
          lastActivityDate: new Date(item.last_activity_date * 1000).toISOString(),
          owner: item.owner ? {
            userId: item.owner.user_id,
            displayName: item.owner.display_name,
            reputation: item.owner.reputation,
            profileImage: item.owner.profile_image
          } : null
        }));

        return {
          success: true,
          data: {
            source: 'Stack Overflow API',
            question: {
              questionId: question.question_id,
              title: question.title,
              body: question.body,
              link: question.link,
              score: question.score,
              answerCount: question.answer_count,
              isAnswered: question.is_answered,
              acceptedAnswerId: question.accepted_answer_id,
              viewCount: question.view_count,
              tags: question.tags || [],
              creationDate: new Date(question.creation_date * 1000).toISOString(),
              lastActivityDate: new Date(question.last_activity_date * 1000).toISOString(),
              owner: question.owner ? {
                userId: question.owner.user_id,
                displayName: question.owner.display_name,
                reputation: question.owner.reputation,
                profileImage: question.owner.profile_image
              } : null
            },
            answers,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get Stack Overflow question details'
        };
      }
    }
  });

  // Stack Overflow标签搜索
  registry.registerTool({
    name: 'stackoverflow_tag_search',
    description: 'Search for tags on Stack Overflow',
    category: 'development',
    source: 'Stack Overflow',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Tag name to search for (e.g., "javascript", "python", "react")'
        },
        sort: {
          type: 'string',
          description: 'Sort order: popular, name, activity',
          default: 'popular',
          enum: ['popular', 'name', 'activity']
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
      const { query, sort = 'popular', maxResults = 10 } = args;

      try {
        const data = await client.searchTags(query, {
          sort,
          pagesize: maxResults
        });
        
        const tags = (data.items || []).map((item: any) => ({
          name: item.name,
          count: item.count,
          hasWiki: item.has_synonyms,
          synonyms: item.synonyms || [],
          isModeratorOnly: item.is_moderator_only,
          isRequired: item.is_required
        }));

        return {
          success: true,
          data: {
            source: 'Stack Overflow API',
            query,
            sort,
            totalResults: tags.length,
            hasMore: data.has_more || false,
            tags,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search Stack Overflow tags'
        };
      }
    }
  });
}
