/**
 * Google Search Tools Registration
 * 注册所有Google搜索工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import { googleWebSearch, googleWebSearchTool } from './google-web-search.js';
import { googleImageSearch, googleImageSearchTool } from './google-image-search.js';
import { googleNewsSearch, googleNewsSearchTool } from './google-news-search.js';

/**
 * 注册所有Google搜索工具
 */
export function registerGoogleTools(registry: ToolRegistry): void {
  // 1. Google Web Search
  registry.registerTool({
    name: googleWebSearchTool.name,
    description: googleWebSearchTool.description,
    category: googleWebSearchTool.category,
    source: googleWebSearchTool.source,
    inputSchema: googleWebSearchTool.inputSchema,
    execute: googleWebSearch
  });

  // 2. Google Image Search
  registry.registerTool({
    name: googleImageSearchTool.name,
    description: googleImageSearchTool.description,
    category: googleImageSearchTool.category,
    source: googleImageSearchTool.source,
    inputSchema: googleImageSearchTool.inputSchema,
    execute: googleImageSearch
  });

  // 3. Google News Search
  registry.registerTool({
    name: googleNewsSearchTool.name,
    description: googleNewsSearchTool.description,
    category: googleNewsSearchTool.category,
    source: googleNewsSearchTool.source,
    inputSchema: googleNewsSearchTool.inputSchema,
    execute: googleNewsSearch
  });

  // 4. Google Scholar Search (基于Google Custom Search)
  registry.registerTool({
    name: 'google_scholar_search',
    description: 'Search Google Scholar for academic papers and citations',
    category: 'academic',
    source: 'scholar.google.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Academic search query for papers, authors, or topics'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['query']
    },
    execute: async (args) => {
      // 使用Google Custom Search with site:scholar.google.com
      const modifiedArgs = {
        ...args,
        query: `site:scholar.google.com ${args.query}`
      };
      return await googleWebSearch(modifiedArgs);
    }
  });

  // 5. Google Books Search
  registry.registerTool({
    name: 'google_books_search',
    description: 'Search Google Books for books, authors, and publications',
    category: 'research',
    source: 'books.google.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Book search query for titles, authors, or topics'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['query']
    },
    execute: async (args) => {
      // 使用Google Custom Search with site:books.google.com
      const modifiedArgs = {
        ...args,
        query: `site:books.google.com ${args.query}`
      };
      return await googleWebSearch(modifiedArgs);
    }
  });
}
