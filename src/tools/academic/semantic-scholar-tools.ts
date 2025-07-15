/**
 * Semantic Scholar Academic Research Tools
 * 提供Semantic Scholar学术论文搜索功能
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Semantic Scholar API客户端
 */
class SemanticScholarAPIClient {
  private baseURL = 'https://api.semanticscholar.org/graph/v1';

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params,
        headers: {
          'User-Agent': 'Open-Search-MCP/2.0'
        },
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchPapers(query: string, options: any = {}) {
    const params = {
      query,
      limit: Math.min(options.maxResults || 10, 100),
      fields: 'paperId,title,abstract,authors,venue,year,citationCount,url,publicationDate'
    };

    return await this.makeRequest('/paper/search', params);
  }

  async getPaperDetails(paperId: string) {
    const fields = 'paperId,title,abstract,authors,venue,year,citationCount,url,publicationDate,references,citations';
    return await this.makeRequest(`/paper/${paperId}`, { fields });
  }
}

export function registerSemanticScholarTools(registry: ToolRegistry): void {
  const client = new SemanticScholarAPIClient();

  // Semantic Scholar论文搜索
  registry.registerTool({
    name: 'semantic_scholar_search',
    description: 'Search Semantic Scholar for academic papers across all disciplines',
    category: 'academic',
    source: 'Semantic Scholar',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for academic papers (e.g., "machine learning", "neural networks", "computer vision")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of papers to return (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        },
        year: {
          type: 'string',
          description: 'Publication year filter (e.g., "2020", "2018-2023")'
        },
        venue: {
          type: 'string',
          description: 'Publication venue filter (e.g., "ICML", "NeurIPS", "Nature")'
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, maxResults = 10, year, venue } = args;

      try {
        // 构建搜索查询
        let searchQuery = query;
        if (year) {
          searchQuery += ` year:${year}`;
        }
        if (venue) {
          searchQuery += ` venue:${venue}`;
        }

        const data = await client.searchPapers(searchQuery, { maxResults });
        
        const papers = (data.data || []).map((paper: any) => ({
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract || 'No abstract available',
          authors: (paper.authors || []).map((author: any) => author.name).join(', '),
          venue: paper.venue || 'Unknown venue',
          year: paper.year,
          citationCount: paper.citationCount || 0,
          url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          publicationDate: paper.publicationDate,
          source: 'Semantic Scholar'
        }));

        return {
          success: true,
          data: {
            source: 'Semantic Scholar',
            query,
            year,
            venue,
            totalResults: papers.length,
            papers,
            timestamp: Date.now(),
            searchMetadata: {
              database: 'Semantic Scholar',
              searchStrategy: 'Full-text and metadata search',
              filters: {
                year: year || null,
                venue: venue || null
              }
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search Semantic Scholar'
        };
      }
    }
  });

  // Semantic Scholar论文详情
  registry.registerTool({
    name: 'semantic_scholar_paper_details',
    description: 'Get detailed information about a specific paper from Semantic Scholar',
    category: 'academic',
    source: 'Semantic Scholar',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Semantic Scholar paper ID or DOI'
        }
      },
      required: ['paperId']
    },
    execute: async (args: any) => {
      const { paperId } = args;

      try {
        const paper = await client.getPaperDetails(paperId);
        
        const paperDetails = {
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract || 'No abstract available',
          authors: (paper.authors || []).map((author: any) => ({
            name: author.name,
            authorId: author.authorId
          })),
          venue: paper.venue || 'Unknown venue',
          year: paper.year,
          citationCount: paper.citationCount || 0,
          url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          publicationDate: paper.publicationDate,
          references: (paper.references || []).slice(0, 10).map((ref: any) => ({
            title: ref.title,
            paperId: ref.paperId
          })),
          citations: (paper.citations || []).slice(0, 10).map((cite: any) => ({
            title: cite.title,
            paperId: cite.paperId
          })),
          source: 'Semantic Scholar'
        };

        return {
          success: true,
          data: {
            source: 'Semantic Scholar',
            paper: paperDetails,
            timestamp: Date.now()
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get paper details from Semantic Scholar'
        };
      }
    }
  });

  // Semantic Scholar作者搜索
  registry.registerTool({
    name: 'semantic_scholar_author_search',
    description: 'Search for authors and their papers on Semantic Scholar',
    category: 'academic',
    source: 'Semantic Scholar',
    inputSchema: {
      type: 'object',
      properties: {
        authorName: {
          type: 'string',
          description: 'Author name to search for'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of papers to return (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['authorName']
    },
    execute: async (args: any) => {
      const { authorName, maxResults = 10 } = args;

      try {
        // 搜索包含作者姓名的论文
        const searchQuery = `author:${authorName}`;
        const data = await client.searchPapers(searchQuery, { maxResults });
        
        const papers = (data.data || []).map((paper: any) => ({
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract ? paper.abstract.substring(0, 200) + '...' : 'No abstract available',
          authors: (paper.authors || []).map((author: any) => author.name).join(', '),
          venue: paper.venue || 'Unknown venue',
          year: paper.year,
          citationCount: paper.citationCount || 0,
          url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          source: 'Semantic Scholar'
        }));

        return {
          success: true,
          data: {
            source: 'Semantic Scholar',
            authorName,
            totalResults: papers.length,
            papers,
            timestamp: Date.now(),
            searchMetadata: {
              database: 'Semantic Scholar',
              searchType: 'author_search',
              author: authorName
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search author on Semantic Scholar'
        };
      }
    }
  });
}
