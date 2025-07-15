import { GoogleSearchClient } from '../../api/clients/google-search-client.js';
import { GoogleSearchRouter } from '../../utils/google-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Google 网页搜索工具
 * 专门用于通用网页搜索，支持智能路由和多种搜索类型
 */

const logger = new Logger('GoogleWebSearch');

export async function googleWebSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new GoogleSearchClient();
    const router = new GoogleSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing Google web search: ${args.query}`);

    const limit = args.limit || 10;
    const result = await handleWebSearchRequest(client, router, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'google_web_search',
        result,
        source: 'Google',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Google web search failed:', error);
    return {
      success: false,
      error: `Google web search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理网页搜索请求
 */
async function handleWebSearchRequest(client: GoogleSearchClient, router: GoogleSearchRouter, query: string, limit: number): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let searchResult;
    
    switch (route.searchType) {
      case 'image':
        searchResult = await client.searchImages(route.query, { num: limit });
        break;
        
      case 'news':
        searchResult = await client.searchNews(route.query, { 
          num: limit,
          dateRestrict: route.dateRestrict 
        });
        break;
        
      case 'academic':
        searchResult = await client.searchAcademic(route.query, { 
          num: limit,
          fileType: route.fileType 
        });
        break;
        
      case 'site':
        searchResult = await client.searchSite(route.query, route.site!, { num: limit });
        break;
        
      case 'filetype':
        searchResult = await client.searchFileType(route.query, route.fileType!, { num: limit });
        break;
        
      default: // 'web'
        searchResult = await client.searchWeb(query, { 
          num: limit,
          language: route.language,
          country: route.country
        });
        break;
    }
    
    if (!searchResult.items || searchResult.items.length === 0) {
      return {
        type: 'google_web_search',
        query,
        results: [],
        totalResults: 0,
        route,
        message: `No web results found for "${query}"`,
        suggestions: generateSearchSuggestions(query, route)
      };
    }

    // 简化搜索结果处理，确保基本字段存在
    const enhancedResults = searchResult.items.map((item: any) => {
      return {
        title: item.title || item.htmlTitle || 'No title',
        url: item.link || item.formattedUrl || '',
        snippet: item.snippet || item.htmlSnippet || 'No description available',
        displayLink: item.displayLink || '',

        // 保留原始数据
        originalItem: item,

        // 计算相关性分数
        relevanceScore: calculateRelevanceScore(item, query),

        // 内容质量评估
        qualityIndicators: assessContentQuality(item),

        // 网站权威性分析
        authorityScore: analyzeWebsiteAuthority(item),

        // 内容类型分析
        contentType: analyzeContentType(item),

        // 时效性分析
        freshnessScore: analyzeFreshness(item),

        // 格式化显示信息
        displayInfo: formatDisplayInfo(item)
      };
    });

    // 按相关性和质量排序
    enhancedResults.sort((a: any, b: any) => {
      const scoreA = a.relevanceScore + a.qualityIndicators.score + a.authorityScore;
      const scoreB = b.relevanceScore + b.qualityIndicators.score + b.authorityScore;
      return scoreB - scoreA;
    });

    // 分析搜索结果
    const resultAnalysis = analyzeSearchResults(enhancedResults, searchResult);

    return {
      type: 'google_web_search',
      query,
      results: enhancedResults,
      totalResults: parseInt(searchResult.searchInformation.totalResults) || enhancedResults.length,
      searchTime: searchResult.searchInformation.searchTime,
      route,
      analysis: resultAnalysis,
      summary: generateSearchSummary(enhancedResults, query, route, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 计算相关性分数
 */
function calculateRelevanceScore(item: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配
  if (item.title) {
    const titleLower = item.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 10;
    });
  }
  
  // 摘要匹配
  if (item.snippet) {
    const snippetLower = item.snippet.toLowerCase();
    queryWords.forEach(word => {
      if (snippetLower.includes(word)) score += 5;
    });
  }
  
  // URL匹配
  if (item.link) {
    const urlLower = item.link.toLowerCase();
    queryWords.forEach(word => {
      if (urlLower.includes(word)) score += 3;
    });
  }
  
  return Math.min(score, 50);
}

/**
 * 评估内容质量
 */
function assessContentQuality(item: any): any {
  const quality = {
    score: 0,
    indicators: [] as string[],
    level: 'basic' as 'basic' | 'good' | 'excellent'
  };
  
  // 标题质量
  if (item.title && item.title.length > 10 && item.title.length < 100) {
    quality.score += 10;
    quality.indicators.push('Good title length');
  }
  
  // 摘要质量
  if (item.snippet && item.snippet.length > 50) {
    quality.score += 10;
    quality.indicators.push('Detailed description');
  }
  
  // URL结构
  if (item.link && !item.link.includes('?')) {
    quality.score += 5;
    quality.indicators.push('Clean URL structure');
  }
  
  // 是否有缓存
  if (item.cacheId) {
    quality.score += 5;
    quality.indicators.push('Cached by Google');
  }
  
  // 是否有结构化数据
  if (item.pagemap) {
    quality.score += 10;
    quality.indicators.push('Rich structured data');
  }
  
  // 确定质量级别
  if (quality.score >= 25) quality.level = 'excellent';
  else if (quality.score >= 15) quality.level = 'good';
  
  return quality;
}

/**
 * 分析网站权威性
 */
function analyzeWebsiteAuthority(item: any): number {
  let score = 0;
  const domain = item.displayLink?.toLowerCase() || '';
  
  // 知名网站加分
  const authorityDomains = [
    'wikipedia.org', 'github.com', 'stackoverflow.com', 'medium.com',
    'nytimes.com', 'bbc.com', 'cnn.com', 'reuters.com',
    'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
    'nature.com', 'science.org', 'ieee.org', 'acm.org'
  ];
  
  if (authorityDomains.some(authDomain => domain.includes(authDomain))) {
    score += 20;
  }
  
  // 教育机构
  if (domain.includes('.edu') || domain.includes('.ac.')) {
    score += 15;
  }
  
  // 政府网站
  if (domain.includes('.gov') || domain.includes('.org')) {
    score += 10;
  }
  
  // HTTPS加分
  if (item.link?.startsWith('https://')) {
    score += 5;
  }
  
  return Math.min(score, 30);
}

/**
 * 分析内容类型
 */
function analyzeContentType(item: any): string {
  const url = item.link?.toLowerCase() || '';
  const title = item.title?.toLowerCase() || '';
  
  // 基于URL和标题判断内容类型
  if (url.includes('github.com')) return 'Code Repository';
  if (url.includes('stackoverflow.com')) return 'Q&A';
  if (url.includes('wikipedia.org')) return 'Encyclopedia';
  if (url.includes('youtube.com')) return 'Video';
  if (url.includes('medium.com') || url.includes('blog')) return 'Blog Post';
  if (url.includes('news') || title.includes('news')) return 'News Article';
  if (url.includes('.pdf')) return 'PDF Document';
  if (url.includes('docs.') || title.includes('documentation')) return 'Documentation';
  if (url.includes('tutorial') || title.includes('tutorial')) return 'Tutorial';
  if (url.includes('forum')) return 'Forum Discussion';
  
  return 'Web Page';
}

/**
 * 分析时效性
 */
function analyzeFreshness(item: any): number {
  let score = 0;
  
  // 基于URL和内容判断时效性
  const url = item.link?.toLowerCase() || '';
  const snippet = item.snippet?.toLowerCase() || '';
  
  // 包含日期信息
  if (snippet.includes('2024') || snippet.includes('2023')) {
    score += 15;
  }
  
  // 新闻网站通常更新频繁
  if (url.includes('news') || url.includes('blog')) {
    score += 10;
  }
  
  // 文档和教程可能较旧但仍有价值
  if (url.includes('docs') || url.includes('tutorial')) {
    score += 5;
  }
  
  return Math.min(score, 20);
}

/**
 * 格式化显示信息
 */
function formatDisplayInfo(item: any): any {
  return {
    title: item.title,
    url: item.link,
    domain: item.displayLink,
    snippet: item.snippet,
    formattedUrl: item.formattedUrl,
    cacheId: item.cacheId || null,
    hasRichData: !!item.pagemap,
    fileFormat: item.fileFormat || null,
    mime: item.mime || null
  };
}

/**
 * 分析搜索结果
 */
function analyzeSearchResults(results: any[], searchResult: any): any {
  if (results.length === 0) return {};
  
  const analysis = {
    totalResults: results.length,
    searchTime: searchResult.searchInformation.searchTime,
    domains: {} as Record<string, number>,
    contentTypes: {} as Record<string, number>,
    qualityLevels: { excellent: 0, good: 0, basic: 0 },
    averageRelevance: 0,
    averageQuality: 0,
    averageAuthority: 0,
    topResults: results.slice(0, 3)
  };
  
  // 统计分布
  results.forEach(result => {
    // 域名分布
    const domain = result.displayLink;
    analysis.domains[domain] = (analysis.domains[domain] || 0) + 1;
    
    // 内容类型分布
    const contentType = result.contentType;
    analysis.contentTypes[contentType] = (analysis.contentTypes[contentType] || 0) + 1;
    
    // 质量分布
    if (result.qualityIndicators.level in analysis.qualityLevels) {
      (analysis.qualityLevels as any)[result.qualityIndicators.level]++;
    }
  });
  
  // 计算平均值
  analysis.averageRelevance = results.reduce((sum, result) => sum + result.relevanceScore, 0) / results.length;
  analysis.averageQuality = results.reduce((sum, result) => sum + result.qualityIndicators.score, 0) / results.length;
  analysis.averageAuthority = results.reduce((sum, result) => sum + result.authorityScore, 0) / results.length;
  
  return analysis;
}

/**
 * 生成搜索建议
 */
function generateSearchSuggestions(query: string, route: any): string[] {
  const suggestions: string[] = [];
  
  if (route.suggestions) {
    suggestions.push(...route.suggestions);
  }
  
  // 基于查询内容提供建议
  suggestions.push(
    'Try more specific keywords',
    'Use quotes for exact phrases',
    'Add site: to search specific websites',
    'Use filetype: for document searches'
  );
  
  return suggestions.slice(0, 4);
}

/**
 * 生成搜索摘要
 */
function generateSearchSummary(results: any[], query: string, route: any, analysis: any): string {
  if (results.length === 0) return `No web results found for "${query}"`;
  
  const topResult = results[0];
  const avgRelevance = Math.round(analysis.averageRelevance);
  const searchTime = analysis.searchTime;
  
  return `Found ${analysis.totalResults} web results for "${query}" in ${searchTime} seconds. Top result: "${topResult.title}" from ${topResult.displayLink}. Average relevance: ${avgRelevance}/50.`;
}

/**
 * 工具注册信息
 */
export const googleWebSearchTool = {
  name: 'google_web_search',
  description: 'Search the web using Google Custom Search with intelligent routing and content analysis',
  category: 'web-search',
  source: 'google.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for web content. Examples: "machine learning tutorials", "site:github.com react", "filetype:pdf climate change", "latest AI news"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 10)',
        default: 10,
        minimum: 1,
        maximum: 10
      }
    },
    required: ['query']
  },
  execute: googleWebSearch,
  examples: [
    {
      query: "machine learning tutorials",
      description: "Search for ML learning resources"
    },
    {
      query: "site:github.com react components",
      description: "Search GitHub for React components"
    },
    {
      query: "filetype:pdf climate change research",
      description: "Find PDF research papers on climate change"
    },
    {
      query: "latest AI news",
      description: "Get recent AI news articles"
    },
    {
      query: "python programming best practices",
      description: "Find Python programming guides"
    }
  ]
};
