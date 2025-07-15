/**
 * Stack Overflow Developer Tools
 * 提供Stack Overflow问题搜索和开发者问答功能
 */

import { ToolRegistry } from '../tool-registry.js';

export function registerStackOverflowTools(registry: ToolRegistry): void {
  // Stack Overflow问题搜索
  registry.registerTool({
    name: 'stackoverflow_search',
    description: 'Search Stack Overflow questions and answers',
    category: 'tech',
    source: 'Stack Overflow',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for Stack Overflow (e.g., "javascript async await", "python pandas", "react hooks")'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Programming language or technology tags (e.g., ["javascript", "react", "nodejs"])'
        },
        sort: {
          type: 'string',
          description: 'Sort order: relevance, votes, activity, creation',
          default: 'relevance',
          enum: ['relevance', 'votes', 'activity', 'creation']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of questions to return (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        },
        answered: {
          type: 'boolean',
          description: 'Filter for answered questions only',
          default: false
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, tags = [], sort = 'relevance', maxResults = 10, answered = false } = args;

      try {
        // 模拟Stack Overflow搜索结果
        const mockQuestions = Array.from({ length: Math.min(maxResults, 10) }, (_, i) => ({
          questionId: 70000000 + i,
          title: `How to ${query} - Question ${i + 1}`,
          body: `I'm trying to implement ${query} in my project. Here's what I've tried so far...\n\n\`\`\`javascript\n// Sample code\nfunction example() {\n  // Implementation here\n}\n\`\`\`\n\nWhat's the best approach for this?`,
          tags: tags.length > 0 ? tags : ['javascript', 'programming', 'web-development'],
          author: {
            userId: 1000000 + i,
            displayName: `Developer${i + 1}`,
            reputation: Math.floor(Math.random() * 50000) + 100,
            profileImage: `https://www.gravatar.com/avatar/user${i}?s=64&d=identicon`
          },
          creationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivityDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          score: Math.floor(Math.random() * 100) - 10,
          viewCount: Math.floor(Math.random() * 10000) + 100,
          answerCount: answered ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 8),
          isAnswered: answered || Math.random() > 0.3,
          hasAcceptedAnswer: answered || Math.random() > 0.5,
          url: `https://stackoverflow.com/questions/${70000000 + i}`,
          excerpt: `Question about ${query}. Looking for best practices and efficient solutions...`
        }));

        return {
          success: true,
          data: {
            source: 'Stack Overflow',
            query,
            tags,
            sort,
            answered,
            totalResults: mockQuestions.length,
            questions: mockQuestions,
            timestamp: Date.now(),
            searchMetadata: {
              hasMore: maxResults >= 10,
              quotaRemaining: 9999,
              searchType: 'questions'
            }
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
    description: 'Get detailed information about a specific Stack Overflow question including answers',
    category: 'tech',
    source: 'Stack Overflow',
    inputSchema: {
      type: 'object',
      properties: {
        questionId: {
          type: 'number',
          description: 'Stack Overflow question ID'
        },
        includeAnswers: {
          type: 'boolean',
          description: 'Include answers in the response',
          default: true
        },
        includeComments: {
          type: 'boolean',
          description: 'Include comments in the response',
          default: false
        }
      },
      required: ['questionId']
    },
    execute: async (args: any) => {
      const { questionId, includeAnswers = true, includeComments = false } = args;

      try {
        // 模拟Stack Overflow问题详情
        const mockQuestion = {
          questionId,
          title: `Detailed Question ${questionId}`,
          body: `This is a detailed question about programming. Here's the complete context:\n\n\`\`\`javascript\nfunction complexFunction() {\n  // Complex implementation\n  return result;\n}\n\`\`\`\n\nI need help optimizing this code.`,
          tags: ['javascript', 'optimization', 'performance'],
          author: {
            userId: 1000001,
            displayName: 'ExperiencedDev',
            reputation: 25000,
            profileImage: 'https://www.gravatar.com/avatar/experienced?s=64&d=identicon'
          },
          creationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          lastActivityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          score: 15,
          viewCount: 1250,
          answerCount: 3,
          isAnswered: true,
          hasAcceptedAnswer: true,
          url: `https://stackoverflow.com/questions/${questionId}`,
          answers: includeAnswers ? [
            {
              answerId: questionId * 10 + 1,
              body: `Here's the optimized solution:\n\n\`\`\`javascript\nfunction optimizedFunction() {\n  // Optimized implementation\n  return optimizedResult;\n}\n\`\`\`\n\nThis approach is more efficient because...`,
              author: {
                userId: 2000001,
                displayName: 'ExpertCoder',
                reputation: 75000,
                profileImage: 'https://www.gravatar.com/avatar/expert?s=64&d=identicon'
              },
              creationDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
              score: 25,
              isAccepted: true,
              url: `https://stackoverflow.com/a/${questionId * 10 + 1}`
            },
            {
              answerId: questionId * 10 + 2,
              body: `Alternative approach using modern JavaScript features:\n\n\`\`\`javascript\nconst modernSolution = async () => {\n  // Modern implementation\n};\n\`\`\``,
              author: {
                userId: 2000002,
                displayName: 'ModernDev',
                reputation: 45000,
                profileImage: 'https://www.gravatar.com/avatar/modern?s=64&d=identicon'
              },
              creationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              score: 12,
              isAccepted: false,
              url: `https://stackoverflow.com/a/${questionId * 10 + 2}`
            }
          ] : [],
          comments: includeComments ? [
            {
              commentId: questionId * 100 + 1,
              body: 'Have you considered using a different algorithm?',
              author: {
                userId: 3000001,
                displayName: 'HelpfulUser',
                reputation: 5000
              },
              creationDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
              score: 3
            }
          ] : []
        };

        return {
          success: true,
          data: {
            source: 'Stack Overflow',
            question: mockQuestion,
            timestamp: Date.now(),
            metadata: {
              includeAnswers,
              includeComments,
              quotaRemaining: 9998
            }
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
    name: 'stackoverflow_tags',
    description: 'Search and explore Stack Overflow tags',
    category: 'tech',
    source: 'Stack Overflow',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for tags (e.g., "javascript", "python", "react")'
        },
        sort: {
          type: 'string',
          description: 'Sort order: popular, activity, name',
          default: 'popular',
          enum: ['popular', 'activity', 'name']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of tags to return (1-100)',
          default: 20,
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    },
    execute: async (args: any) => {
      const { query = '', sort = 'popular', maxResults = 20 } = args;

      try {
        // 模拟Stack Overflow标签
        const popularTags = [
          'javascript', 'python', 'java', 'c#', 'php', 'android', 'html', 'jquery', 'c++', 'css',
          'ios', 'sql', 'mysql', 'r', 'node.js', 'arrays', 'c', 'asp.net', 'ruby-on-rails', 'json',
          'swift', 'python-3.x', 'angular', 'regex', 'django', 'pandas', 'react', 'excel', 'linux', 'spring'
        ];

        const filteredTags = query ? 
          popularTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase())) : 
          popularTags;

        const mockTags = filteredTags.slice(0, maxResults).map((tagName, i) => ({
          name: tagName,
          count: Math.floor(Math.random() * 1000000) + 10000,
          description: `Questions related to ${tagName} programming and development`,
          synonyms: [`${tagName}-dev`, `${tagName}-programming`],
          isRequired: false,
          isModeratorOnly: false,
          lastActivityDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          url: `https://stackoverflow.com/questions/tagged/${tagName}`
        }));

        return {
          success: true,
          data: {
            source: 'Stack Overflow',
            query,
            sort,
            totalResults: mockTags.length,
            tags: mockTags,
            timestamp: Date.now(),
            metadata: {
              hasMore: filteredTags.length > maxResults,
              quotaRemaining: 9997
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search Stack Overflow tags'
        };
      }
    }
  });}
