import { ToolInput, ToolOutput } from '../../types.js';
import { Logger } from '../../utils/logger.js';

/**
 * Dev.to 文章搜索工具
 * 搜索Dev.to平台上的技术文章和教程
 */

const logger = new Logger('DevtoArticleSearch');

export async function devtoArticleSearch(args: ToolInput): Promise<ToolOutput> {
  try {
    const query = args.query || '';
    const maxResults = Math.min(args.max_results || 10, 50);
    const tag = args.tag || '';
    const username = args.username || '';
    
    if (!query && !tag && !username) {
      return {
        success: false,
        error: 'Please provide a search query, tag, or username',
        data: null
      };
    }
    
    logger.info(`Searching Dev.to articles: query="${query}", tag="${tag}", username="${username}"`);
    
    // 构建搜索URL
    let searchUrl = 'https://dev.to/api/articles';
    const params = new URLSearchParams();
    
    if (tag) {
      params.append('tag', tag);
    }
    if (username) {
      params.append('username', username);
    }
    params.append('per_page', maxResults.toString());
    params.append('page', '1');
    
    if (params.toString()) {
      searchUrl += '?' + params.toString();
    }
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'OpenSearchMCP/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Dev.to API error: ${response.status} ${response.statusText}`);
    }
    
    const articles = await response.json();
    
    // 如果有查询词，进行客户端过滤
    let filteredArticles = articles;
    if (query) {
      const queryLower = query.toLowerCase();
      filteredArticles = articles.filter((article: any) => 
        article.title?.toLowerCase().includes(queryLower) ||
        article.description?.toLowerCase().includes(queryLower) ||
        article.tag_list?.some((tag: string) => tag.toLowerCase().includes(queryLower))
      );
    }
    
    // 限制结果数量
    filteredArticles = filteredArticles.slice(0, maxResults);
    
    const results = filteredArticles.map((article: any) => ({
      title: article.title || 'No title',
      description: article.description || 'No description',
      url: article.url || `https://dev.to${article.path}`,
      author: article.user?.name || 'Unknown author',
      username: article.user?.username || '',
      published_at: article.published_at || '',
      tags: article.tag_list || [],
      reading_time_minutes: article.reading_time_minutes || 0,
      public_reactions_count: article.public_reactions_count || 0,
      comments_count: article.comments_count || 0,
      cover_image: article.cover_image || '',
      social_image: article.social_image || '',
      canonical_url: article.canonical_url || '',
      created_at: article.created_at || '',
      edited_at: article.edited_at || '',
      crossposted_at: article.crossposted_at || '',
      published_timestamp: article.published_timestamp || '',
      slug: article.slug || '',
      path: article.path || '',
      type_of: article.type_of || 'article'
    }));
    
    const summary = `Found ${results.length} Dev.to articles` +
      (query ? ` for "${query}"` : '') +
      (tag ? ` with tag "${tag}"` : '') +
      (username ? ` by user "${username}"` : '');
    
    return {
      success: true,
      data: {
        results,
        total: results.length,
        query: query || '',
        tag: tag || '',
        username: username || '',
        summary,
        source: 'dev.to',
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error('Dev.to article search error:', error);
    return {
      success: false,
      error: `Dev.to search failed: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
}

/**
 * 工具注册信息
 */
export const devtoArticleSearchTool = {
  name: 'devto_article_search',
  description: 'Search Dev.to for technical articles, tutorials, and programming content by query, tag, or author',
  category: 'tech-search',
  source: 'dev.to',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for articles (searches in title, description, and tags)'
      },
      tag: {
        type: 'string',
        description: 'Filter by specific tag (e.g., javascript, python, react)'
      },
      username: {
        type: 'string',
        description: 'Filter by specific author username'
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (1-50, default: 10)',
        minimum: 1,
        maximum: 50,
        default: 10
      }
    },
    required: []
  },
  execute: devtoArticleSearch,
  examples: [
    {
      query: 'React hooks tutorial',
      max_results: 5,
      description: 'Search for React hooks tutorials'
    },
    {
      tag: 'javascript',
      max_results: 10,
      description: 'Find JavaScript articles'
    },
    {
      username: 'ben',
      max_results: 5,
      description: 'Get articles by specific author'
    },
    {
      query: 'machine learning',
      tag: 'python',
      max_results: 8,
      description: 'Search for Python machine learning content'
    }
  ]
};
