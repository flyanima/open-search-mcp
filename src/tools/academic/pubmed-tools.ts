/**
 * PubMed Academic Research Tools
 * 提供PubMed医学文献搜索和研究功能
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * PubMed API客户端
 */
class PubMedAPIClient {
  private baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const requestParams = {
        ...params,
        retmode: 'json',
        retmax: Math.min(params.retmax || 20, 200),
        tool: 'open-search-mcp',
        email: 'support@open-search-mcp.com'
      };

      if (this.apiKey) {
        (requestParams as any).api_key = this.apiKey;
      }

      const response = await axios.get(`${this.baseURL}/${endpoint}`, {
        params: requestParams,
        timeout: 20000,
        headers: {
          'User-Agent': 'Open-Search-MCP/2.0'
        }
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchPubMed(query: string, options: any = {}) {
    // 第一步：搜索获取PMID列表
    const searchParams = {
      db: 'pubmed',
      term: query,
      retmax: options.maxResults || 20,
      sort: options.sort === 'date' ? 'pub_date' : 'relevance',
      datetype: 'pdat'
    };

    // 添加日期过滤
    if (options.dateRange && options.dateRange !== 'all') {
      const now = new Date();
      let startDate;

      switch (options.dateRange) {
        case '1year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case '5years':
          startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
          break;
        case '10years':
          startDate = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
          break;
      }

      if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
        const endDateStr = now.toISOString().split('T')[0].replace(/-/g, '/');
        searchParams.term += ` AND ("${startDateStr}"[Date - Publication] : "${endDateStr}"[Date - Publication])`;
      }
    }

    // 添加出版物类型过滤
    if (options.publicationType && options.publicationType !== 'all') {
      const typeMap: Record<string, string> = {
        'review': 'Review[Publication Type]',
        'clinical_trial': 'Clinical Trial[Publication Type]',
        'meta_analysis': 'Meta-Analysis[Publication Type]',
        'case_report': 'Case Reports[Publication Type]'
      };

      const pubType = options.publicationType as string;
      if (typeMap[pubType]) {
        searchParams.term += ` AND ${typeMap[pubType]}`;
      }
    }

    const searchResult = await this.makeRequest('esearch.fcgi', searchParams);

    if (!searchResult.esearchresult || !searchResult.esearchresult.idlist || searchResult.esearchresult.idlist.length === 0) {
      return { articles: [], count: 0 };
    }

    const pmids = searchResult.esearchresult.idlist;

    // 第二步：获取详细信息
    const summaryParams = {
      db: 'pubmed',
      id: pmids.join(','),
      retmode: 'json'
    };

    const summaryResult = await this.makeRequest('esummary.fcgi', summaryParams);

    return {
      articles: this.parseSummaryResult(summaryResult),
      count: parseInt(searchResult.esearchresult.count) || 0
    };
  }

  private parseSummaryResult(summaryResult: any): any[] {
    if (!summaryResult.result) return [];

    const articles = [];
    const uids = summaryResult.result.uids || [];

    for (const uid of uids) {
      const article = summaryResult.result[uid];
      if (!article) continue;

      articles.push({
        pmid: article.uid,
        title: article.title || 'No title available',
        abstract: article.abstract || 'No abstract available',
        authors: (article.authors || []).map((author: any) => author.name).join(', '),
        journal: article.fulljournalname || article.source || 'Unknown journal',
        publicationDate: article.pubdate || 'Unknown date',
        publicationType: (article.pubtype || []).join(', ') || 'Unknown type',
        doi: article.elocationid && article.elocationid.includes('doi:')
          ? article.elocationid.replace('doi: ', '')
          : null,
        pmcid: article.pmcid || null,
        volume: article.volume || null,
        issue: article.issue || null,
        pages: article.pages || null,
        url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
        fullTextUrl: article.pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmcid}/` : null
      });
    }

    return articles;
  }
}

export function registerPubMedTools(registry: ToolRegistry): void {
  const apiKey = process.env.PUBMED_API_KEY; // 可选的API密钥
  const client = new PubMedAPIClient(apiKey);

  // PubMed文献搜索
  registry.registerTool({
    name: 'search_pubmed',
    description: 'Search PubMed for medical and life science literature',
    category: 'academic',
    source: 'PubMed',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for medical literature (e.g., "COVID-19 treatment", "cancer immunotherapy", "diabetes management")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of articles to return (1-200)',
          default: 20,
          minimum: 1,
          maximum: 200
        },
        sort: {
          type: 'string',
          description: 'Sort order: relevance, date',
          default: 'relevance',
          enum: ['relevance', 'date']
        },
        publicationType: {
          type: 'string',
          description: 'Filter by publication type: all, review, clinical_trial, meta_analysis, case_report',
          default: 'all',
          enum: ['all', 'review', 'clinical_trial', 'meta_analysis', 'case_report']
        },
        dateRange: {
          type: 'string',
          description: 'Date range filter: all, 1year, 5years, 10years',
          default: 'all',
          enum: ['all', '1year', '5years', '10years']
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, maxResults = 20, sort = 'relevance', publicationType = 'all', dateRange = 'all' } = args;

      try {
        const startTime = Date.now();

        // 使用真正的PubMed API
        const result = await client.searchPubMed(query, {
          maxResults,
          sort,
          publicationType,
          dateRange
        });

        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'PubMed API',
            query,
            sort,
            publicationType,
            dateRange,
            totalResults: result.count,
            articles: result.articles,
            searchTime,
            timestamp: Date.now(),
            apiUsed: true,
            searchMetadata: {
              database: 'PubMed',
              searchStrategy: 'E-utilities API',
              filters: {
                publicationType: publicationType !== 'all' ? publicationType : null,
                dateRange: dateRange !== 'all' ? dateRange : null,
                sort
              }
            }
          }
        };
      } catch (error) {
        // 如果API失败，提供有用的错误信息
        return {
          success: false,
          error: `PubMed search failed: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            source: 'PubMed',
            query,
            articles: [],
            totalResults: 0,
            apiUsed: false,
            suggestions: [
              'Check your internet connection',
              'Try simpler search terms',
              'Use medical subject headings (MeSH terms)',
              'Try again in a few moments'
            ]
          }
        };
      }
    }
  });

  // PubMed文章详情获取
  registry.registerTool({
    name: 'pubmed_article_details',
    description: 'Get detailed information about a specific PubMed article',
    category: 'academic',
    source: 'PubMed',
    inputSchema: {
      type: 'object',
      properties: {
        pmid: {
          type: 'string',
          description: 'PubMed ID (PMID) of the article'
        }
      },
      required: ['pmid']
    },
    execute: async (args: any) => {
      const { pmid } = args;

      try {
        // 获取文章摘要信息
        const summaryParams = {
          db: 'pubmed',
          id: pmid,
          retmode: 'json'
        };

        const summaryResult = await client.makeRequest('esummary.fcgi', summaryParams);

        if (!summaryResult.result || !summaryResult.result[pmid]) {
          return {
            success: false,
            error: `Article with PMID ${pmid} not found`
          };
        }

        const article = summaryResult.result[pmid];

        // 尝试获取全文摘要
        let fullAbstract = null;
        try {
          const fetchParams = {
            db: 'pubmed',
            id: pmid,
            retmode: 'xml',
            rettype: 'abstract'
          };

          const fetchResult = await client.makeRequest('efetch.fcgi', fetchParams);
          // 这里可以解析XML获取完整摘要，暂时使用summary中的摘要
          fullAbstract = article.abstract || 'No abstract available';
        } catch (fetchError) {
          fullAbstract = article.abstract || 'No abstract available';
        }

        const articleDetails = {
          pmid: article.uid,
          title: article.title || 'No title available',
          abstract: fullAbstract,
          authors: (article.authors || []).map((author: any) => ({
            name: author.name,
            affiliation: author.affiliation || null
          })),
          journal: {
            name: article.fulljournalname || article.source || 'Unknown journal',
            abbreviation: article.source || null,
            volume: article.volume || null,
            issue: article.issue || null,
            pages: article.pages || null
          },
          publicationDate: article.pubdate || 'Unknown date',
          publicationType: (article.pubtype || []).join(', ') || 'Unknown type',
          doi: article.elocationid && article.elocationid.includes('doi:')
            ? article.elocationid.replace('doi: ', '')
            : null,
          pmcid: article.pmcid || null,
          meshTerms: article.keywords || [],
          url: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
          fullTextUrl: article.pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${article.pmcid}/` : null,
          citationCount: null, // PubMed API不直接提供引用数
          source: 'PubMed'
        };

        return {
          success: true,
          data: {
            source: 'PubMed API',
            article: articleDetails,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get PubMed article details: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}