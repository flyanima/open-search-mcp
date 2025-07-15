/**
 * OpenLibrary API Tools Registration
 * 注册OpenLibrary图书API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * OpenLibrary API客户端
 */
class OpenLibraryAPIClient {
  private baseURL = 'https://openlibrary.org';

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers: {
          'User-Agent': 'Open-Search-MCP/2.0'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchBooks(query: string, limit: number = 10) {
    return await this.makeRequest('/search.json', {
      q: query,
      limit,
      fields: 'key,title,author_name,first_publish_year,isbn,cover_i,subject,publisher,language'
    });
  }

  async searchAuthors(query: string, limit: number = 10) {
    return await this.makeRequest('/search/authors.json', {
      q: query,
      limit
    });
  }

  async getBookDetails(key: string) {
    return await this.makeRequest(`${key}.json`);
  }

  async getAuthorDetails(key: string) {
    return await this.makeRequest(`${key}.json`);
  }

  async getSubjects(subject: string, limit: number = 10) {
    return await this.makeRequest(`/subjects/${subject}.json`, {
      limit
    });
  }
}

/**
 * 注册所有OpenLibrary API工具
 */
export function registerOpenLibraryTools(registry: ToolRegistry): void {
  const client = new OpenLibraryAPIClient();

  // 1. 图书搜索
  registry.registerTool({
    name: 'openlibrary_book_search',
    description: 'Search for books using OpenLibrary database',
    category: 'knowledge',
    source: 'openlibrary.org',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for books (title, author, ISBN, etc.)'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchBooks(args.query, args.maxResults || 10);
        
        const books = data.docs?.map((book: any) => ({
          title: book.title,
          authors: book.author_name || [],
          first_publish_year: book.first_publish_year,
          isbn: book.isbn?.[0],
          subjects: book.subject?.slice(0, 5) || [],
          publishers: book.publisher?.slice(0, 3) || [],
          languages: book.language || [],
          cover_url: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null,
          openlibrary_url: `https://openlibrary.org${book.key}`,
          key: book.key
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'OpenLibrary API',
            query: args.query,
            results: books,
            totalResults: data.numFound || books.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search books'
        };
      }
    }
  });

  // 2. 作者搜索
  registry.registerTool({
    name: 'openlibrary_author_search',
    description: 'Search for authors using OpenLibrary database',
    category: 'knowledge',
    source: 'openlibrary.org',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Author name to search for'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchAuthors(args.query, args.maxResults || 10);
        
        const authors = data.docs?.map((author: any) => ({
          name: author.name,
          birth_date: author.birth_date,
          death_date: author.death_date,
          work_count: author.work_count,
          top_work: author.top_work,
          top_subjects: author.top_subjects?.slice(0, 5) || [],
          openlibrary_url: `https://openlibrary.org${author.key}`,
          key: author.key
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'OpenLibrary API',
            query: args.query,
            results: authors,
            totalResults: data.numFound || authors.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search authors'
        };
      }
    }
  });

  // 3. 图书详细信息
  registry.registerTool({
    name: 'openlibrary_book_details',
    description: 'Get detailed information about a specific book',
    category: 'knowledge',
    source: 'openlibrary.org',
    inputSchema: {
      type: 'object',
      properties: {
        bookKey: {
          type: 'string',
          description: 'OpenLibrary book key (e.g., "/works/OL45804W")'
        }
      },
      required: ['bookKey']
    },
    execute: async (args: any) => {
      try {
        const data = await client.getBookDetails(args.bookKey);
        
        const bookDetails = {
          title: data.title,
          description: typeof data.description === 'string' ? data.description : data.description?.value,
          subjects: data.subjects || [],
          first_publish_date: data.first_publish_date,
          authors: data.authors?.map((author: any) => ({
            key: author.author?.key,
            name: author.author?.name || 'Unknown'
          })) || [],
          covers: data.covers?.map((id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`) || [],
          key: data.key,
          revision: data.revision,
          latest_revision: data.latest_revision,
          created: data.created?.value,
          last_modified: data.last_modified?.value
        };
        
        return {
          success: true,
          data: {
            source: 'OpenLibrary API',
            bookKey: args.bookKey,
            details: bookDetails,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get book details'
        };
      }
    }
  });

  // 4. 主题图书
  registry.registerTool({
    name: 'openlibrary_subject_books',
    description: 'Get books by subject/topic from OpenLibrary',
    category: 'knowledge',
    source: 'openlibrary.org',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject/topic (e.g., "science_fiction", "history", "programming")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['subject']
    },
    execute: async (args: any) => {
      try {
        const subject = args.subject.toLowerCase().replace(/\s+/g, '_');
        const data = await client.getSubjects(subject, args.maxResults || 10);
        
        const books = data.works?.map((work: any) => ({
          title: work.title,
          authors: work.authors?.map((author: any) => author.name) || [],
          first_publish_year: work.first_publish_year,
          subject: args.subject,
          cover_url: work.cover_id ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg` : null,
          openlibrary_url: `https://openlibrary.org${work.key}`,
          key: work.key
        })) || [];
        
        return {
          success: true,
          data: {
            source: 'OpenLibrary API',
            subject: args.subject,
            results: books,
            totalResults: data.work_count || books.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get subject books'
        };
      }
    }
  });

  // 5. 图书推荐
  registry.registerTool({
    name: 'openlibrary_book_recommendations',
    description: 'Get book recommendations based on interests',
    category: 'knowledge',
    source: 'openlibrary.org',
    inputSchema: {
      type: 'object',
      properties: {
        interests: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of interests/subjects (e.g., ["science", "technology", "fiction"])'
        },
        maxPerInterest: {
          type: 'number',
          description: 'Maximum books per interest (1-10)',
          default: 3,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['interests']
    },
    execute: async (args: any) => {
      try {
        const interests = args.interests || [];
        const maxPerInterest = args.maxPerInterest || 3;
        const recommendations: any = {
          interests: interests,
          recommendations_by_interest: {},
          all_recommendations: []
        };

        for (const interest of interests) {
          try {
            const subject = interest.toLowerCase().replace(/\s+/g, '_');
            const data = await client.getSubjects(subject, maxPerInterest);
            
            const books = data.works?.slice(0, maxPerInterest).map((work: any) => ({
              title: work.title,
              authors: work.authors?.map((author: any) => author.name) || [],
              first_publish_year: work.first_publish_year,
              interest: interest,
              cover_url: work.cover_id ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg` : null,
              openlibrary_url: `https://openlibrary.org${work.key}`,
              key: work.key
            })) || [];

            recommendations.recommendations_by_interest[interest] = books;
            recommendations.all_recommendations.push(...books);
          } catch (error) {recommendations.recommendations_by_interest[interest] = [];
          }
        }
        
        return {
          success: true,
          data: {
            source: 'OpenLibrary API',
            recommendations,
            total_recommendations: recommendations.all_recommendations.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get book recommendations'
        };
      }
    }
  });

}
