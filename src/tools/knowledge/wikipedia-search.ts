import { WikipediaSearchClient } from '../../api/clients/wikipedia-search-client.js';
import { WikipediaSearchRouter } from '../../utils/wikipedia-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Wikipedia 搜索工具
 * 支持多语言维基百科搜索，智能路由到最合适的搜索方式
 */

const logger = new Logger('WikipediaSearch');

export async function wikipediaSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new WikipediaSearchClient();
    const router = new WikipediaSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    // 智能路由搜索请求
    const route = router.routeSearch(args.query);
    
    logger.info(`Processing Wikipedia search: ${args.query} -> ${route.intent}`);

    let result;
    const limit = args.limit || 10;
    
    switch (route.endpoint) {
      case 'search':
        result = await handleSearch(client, route.params, args.query, limit);
        break;
        
      case 'summary':
        result = await handleSummary(client, route.params, args.query);
        break;
        
      case 'related':
        result = await handleRelated(client, route.params, args.query);
        break;
        
      default:
        // 默认使用智能搜索
        result = await handleSmartSearch(client, args.query, limit);
    }

    return {
      success: true,
      data: {
        query: args.query,
        searchType: route.intent,
        result,
        source: 'Wikipedia',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Wikipedia search failed:', error);
    return {
      success: false,
      error: `Wikipedia search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理搜索查询
 */
async function handleSearch(client: WikipediaSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const searchParams = {
    limit: Math.min(limit, 50),
    language: params.language,
    ...params
  };
  
  const searchData = await client.searchPages(params.query || originalQuery, searchParams);
  
  if (!searchData.results || searchData.results.length === 0) {
    return {
      type: 'search',
      query: originalQuery,
      results: [],
      totalResults: 0,
      language: searchParams.language || 'en',
      message: `No Wikipedia articles found for "${originalQuery}"`
    };
  }

  // 增强搜索结果
  const enhancedResults = await Promise.all(
    searchData.results.slice(0, Math.min(limit, 10)).map(async (result: any) => {
      try {
        // 获取每个结果的简要摘要
        const summary = await client.getPageSummary(result.title, searchParams.language);
        return {
          title: result.title,
          description: result.description || summary.extract.substring(0, 200) + '...',
          url: result.url || summary.url,
          extract: summary.extract.substring(0, 500) + '...',
          thumbnail: summary.thumbnail,
          relevanceScore: calculateRelevanceScore(result, originalQuery)
        };
      } catch (error) {
        // 如果获取摘要失败，返回基本信息
        return {
          title: result.title,
          description: result.description,
          url: result.url,
          extract: result.extract || result.description,
          relevanceScore: calculateRelevanceScore(result, originalQuery)
        };
      }
    })
  );

  // 按相关性排序
  enhancedResults.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

  return {
    type: 'search',
    query: originalQuery,
    results: enhancedResults,
    totalResults: searchData.totalResults,
    language: searchData.language,
    searchParams,
    summary: generateSearchSummary(enhancedResults, originalQuery, searchData.language)
  };
}

/**
 * 处理摘要查询
 */
async function handleSummary(client: WikipediaSearchClient, params: any, originalQuery: string): Promise<any> {
  const title = params.title || originalQuery;
  
  try {
    const summary = await client.getPageSummary(title, params.language);
    
    return {
      type: 'summary',
      query: originalQuery,
      title: summary.title,
      extract: summary.extract,
      url: summary.url,
      thumbnail: summary.thumbnail,
      language: summary.language,
      coordinates: summary.coordinates,
      summary: `Found summary for "${summary.title}" in ${getLanguageName(summary.language)}`
    };
  } catch (error) {
    // 如果直接获取摘要失败，尝试搜索然后获取第一个结果的摘要
    const searchResults = await client.searchPages(title, { limit: 1, language: params.language });
    
    if (searchResults.results.length > 0) {
      const firstResult = searchResults.results[0];
      const summary = await client.getPageSummary(firstResult.title, params.language);
      
      return {
        type: 'summary',
        query: originalQuery,
        title: summary.title,
        extract: summary.extract,
        url: summary.url,
        thumbnail: summary.thumbnail,
        language: summary.language,
        coordinates: summary.coordinates,
        summary: `Found summary for "${summary.title}" (closest match) in ${getLanguageName(summary.language)}`
      };
    }
    
    throw error;
  }
}

/**
 * 处理相关条目查询
 */
async function handleRelated(client: WikipediaSearchClient, params: any, originalQuery: string): Promise<any> {
  const title = params.title || originalQuery;
  
  const relatedPages = await client.getRelatedPages(title, params.language);
  
  if (relatedPages.length === 0) {
    return {
      type: 'related',
      query: originalQuery,
      title,
      relatedPages: [],
      totalResults: 0,
      language: params.language || 'en',
      message: `No related pages found for "${title}"`
    };
  }

  // 增强相关页面信息
  const enhancedRelated = await Promise.all(
    relatedPages.slice(0, 8).map(async (page: any) => {
      try {
        const summary = await client.getPageSummary(page.title, params.language);
        return {
          title: page.title,
          description: page.description || summary.extract.substring(0, 150) + '...',
          url: page.url || summary.url,
          thumbnail: summary.thumbnail,
          relevanceScore: calculateRelatedScore(page, title)
        };
      } catch (error) {
        return {
          title: page.title,
          description: page.description,
          url: page.url,
          relevanceScore: 50 // 默认分数
        };
      }
    })
  );

  // 按相关性排序
  enhancedRelated.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

  return {
    type: 'related',
    query: originalQuery,
    title,
    relatedPages: enhancedRelated,
    totalResults: relatedPages.length,
    language: params.language || 'en',
    summary: generateRelatedSummary(enhancedRelated, title, params.language)
  };
}

/**
 * 处理智能搜索
 */
async function handleSmartSearch(client: WikipediaSearchClient, query: string, limit: number): Promise<any> {
  const searchData = await client.smartSearch(query, { limit: Math.min(limit, 20) });
  
  return {
    type: 'smart_search',
    query: query,
    result: searchData.result,
    searchType: searchData.type,
    summary: `Smart search completed for "${query}". Found ${searchData.type} results.`
  };
}

/**
 * 计算相关性分数
 */
function calculateRelevanceScore(result: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配
  if (result.title) {
    const titleLower = result.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 3;
    });
  }
  
  // 描述匹配
  if (result.description) {
    const descLower = result.description.toLowerCase();
    queryWords.forEach(word => {
      if (descLower.includes(word)) score += 1;
    });
  }
  
  // 完全匹配加分
  if (result.title && result.title.toLowerCase() === query.toLowerCase()) {
    score += 10;
  }
  
  return score;
}

/**
 * 计算相关条目分数
 */
function calculateRelatedScore(page: any, originalTitle: string): number {
  let score = 50; // 基础分数
  
  // 标题相似度
  if (page.title && originalTitle) {
    const similarity = calculateStringSimilarity(page.title.toLowerCase(), originalTitle.toLowerCase());
    score += similarity * 20;
  }
  
  // 描述相关性
  if (page.description && originalTitle) {
    const descLower = page.description.toLowerCase();
    const titleWords = originalTitle.toLowerCase().split(/\s+/);
    titleWords.forEach(word => {
      if (descLower.includes(word)) score += 5;
    });
  }
  
  return Math.min(score, 100);
}

/**
 * 计算字符串相似度
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * 计算编辑距离
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 获取语言名称
 */
function getLanguageName(languageCode: string): string {
  const languageNames: Record<string, string> = {
    'zh': 'Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic'
  };
  
  return languageNames[languageCode] || languageCode.toUpperCase();
}

/**
 * 生成搜索摘要
 */
function generateSearchSummary(results: any[], query: string, language: string): string {
  if (results.length === 0) {
    return `No Wikipedia articles found for "${query}"`;
  }

  const topResult = results[0];
  const languageName = getLanguageName(language);
  
  return `Found ${results.length} Wikipedia articles about "${query}" in ${languageName}. Top result: "${topResult.title}"`;
}

/**
 * 生成相关条目摘要
 */
function generateRelatedSummary(relatedPages: any[], title: string, language: string): string {
  if (relatedPages.length === 0) {
    return `No related pages found for "${title}"`;
  }

  const languageName = getLanguageName(language || 'en');
  const topRelated = relatedPages[0];
  
  return `Found ${relatedPages.length} related pages for "${title}" in ${languageName}. Top related: "${topRelated.title}"`;
}

/**
 * 工具注册信息
 */
export const wikipediaSearchTool = {
  name: 'wikipedia_search',
  description: 'Search Wikipedia articles with intelligent routing and multi-language support',
  category: 'knowledge-search',
  source: 'wikipedia.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for Wikipedia. Examples: "artificial intelligence", "Einstein summary", "quantum computing related", "人工智能", "爱因斯坦简介"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 50)',
        default: 10,
        minimum: 1,
        maximum: 50
      }
    },
    required: ['query']
  },
  execute: wikipediaSearch,
  examples: [
    {
      query: "artificial intelligence",
      description: "Search for artificial intelligence articles"
    },
    {
      query: "Einstein summary",
      description: "Get a summary of Albert Einstein"
    },
    {
      query: "quantum computing related",
      description: "Find articles related to quantum computing"
    },
    {
      query: "人工智能",
      description: "Search for AI articles in Chinese"
    },
    {
      query: "COVID-19 overview",
      description: "Get an overview of COVID-19"
    },
    {
      query: "machine learning",
      description: "Search for machine learning articles"
    }
  ]
};
