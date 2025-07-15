import { NewsAPISearchClient } from '../../api/clients/newsapi-search-client.js';
import { NewsSearchRouter } from '../../utils/news-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * NewsAPI 新闻搜索工具
 * 支持全面的新闻搜索功能，包括关键词搜索、日期过滤、来源过滤等
 */

const logger = new Logger('NewsAPINewsSearch');

export async function newsAPINewsSearch(args: ToolInput): Promise<ToolOutput> {
  const apiKey = process.env.NEWSAPI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'NewsAPI API key not configured. Please set NEWSAPI_API_KEY environment variable.'
    };
  }

  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new NewsAPISearchClient(apiKey);
    const router = new NewsSearchRouter();
    
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
    
    logger.info(`Processing news search: ${args.query} -> ${route.intent}`);

    let result;
    const limit = args.limit || 20;
    
    switch (route.endpoint) {
      case 'everything':
        result = await handleEverythingSearch(client, route.params, args.query, limit);
        break;
        
      case 'top-headlines':
        result = await handleHeadlinesSearch(client, route.params, args.query, limit);
        break;
        
      case 'sources':
        result = await handleSourcesSearch(client, route.params, args.query);
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
        source: 'NewsAPI',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('News search failed:', error);
    return {
      success: false,
      error: `News search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理全面新闻搜索
 */
async function handleEverythingSearch(client: NewsAPISearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  // 设置页面大小
  params.pageSize = Math.min(limit, 100);
  
  const newsData = await client.searchEverything(params);
  
  if (!newsData.articles || newsData.articles.length === 0) {
    return {
      type: 'news_search',
      query: originalQuery,
      articles: [],
      totalResults: 0,
      message: `No news articles found for "${originalQuery}"`
    };
  }

  // 格式化新闻结果
  const formattedArticles = newsData.articles.map((article: any) => ({
    title: article.title,
    description: article.description,
    url: article.url,
    imageUrl: article.urlToImage,
    publishedAt: formatPublishTime(article.publishedAt),
    source: article.source.name,
    author: article.author,
    relevanceScore: calculateRelevanceScore(article, originalQuery)
  }));

  // 按相关性排序
  formattedArticles.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

  return {
    type: 'news_search',
    query: originalQuery,
    articles: formattedArticles,
    totalResults: newsData.totalResults,
    searchParams: params,
    summary: generateSearchSummary(formattedArticles, originalQuery, newsData.totalResults)
  };
}

/**
 * 处理头条新闻搜索
 */
async function handleHeadlinesSearch(client: NewsAPISearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  // 设置页面大小
  params.pageSize = Math.min(limit, 100);
  
  const headlinesData = await client.getTopHeadlines(params);
  
  if (!headlinesData.articles || headlinesData.articles.length === 0) {
    return {
      type: 'headlines_search',
      query: originalQuery,
      articles: [],
      totalResults: 0,
      message: `No headlines found for "${originalQuery}"`
    };
  }

  // 格式化头条新闻结果
  const formattedArticles = headlinesData.articles.map((article: any) => ({
    title: article.title,
    description: article.description,
    url: article.url,
    imageUrl: article.urlToImage,
    publishedAt: formatPublishTime(article.publishedAt),
    source: article.source.name,
    author: article.author,
    isBreaking: isBreakingNews(article)
  }));

  return {
    type: 'headlines_search',
    query: originalQuery,
    articles: formattedArticles,
    totalResults: headlinesData.totalResults,
    searchParams: params,
    summary: generateHeadlinesSummary(formattedArticles, originalQuery, params)
  };
}

/**
 * 处理新闻来源搜索
 */
async function handleSourcesSearch(client: NewsAPISearchClient, params: any, originalQuery: string): Promise<any> {
  const sourcesData = await client.getSources(params);
  
  if (!sourcesData.sources || sourcesData.sources.length === 0) {
    return {
      type: 'sources_search',
      query: originalQuery,
      sources: [],
      totalResults: 0,
      message: `No news sources found for "${originalQuery}"`
    };
  }

  // 格式化新闻来源结果
  const formattedSources = sourcesData.sources.map((source: any) => ({
    id: source.id,
    name: source.name,
    description: source.description,
    url: source.url,
    category: source.category,
    language: source.language,
    country: source.country,
    trustScore: calculateTrustScore(source)
  }));

  // 按信任度排序
  formattedSources.sort((a: any, b: any) => b.trustScore - a.trustScore);

  return {
    type: 'sources_search',
    query: originalQuery,
    sources: formattedSources,
    totalResults: sourcesData.totalResults,
    searchParams: params,
    summary: generateSourcesSummary(formattedSources, originalQuery, params)
  };
}

/**
 * 处理智能搜索
 */
async function handleSmartSearch(client: NewsAPISearchClient, query: string, limit: number): Promise<any> {
  const searchData = await client.smartSearch(query, { pageSize: Math.min(limit, 100) });
  
  return {
    type: 'smart_search',
    query: query,
    articles: searchData.articles || [],
    sources: searchData.sources || [],
    totalResults: searchData.totalResults,
    summary: `Smart search completed for "${query}". Found ${searchData.totalResults} results.`
  };
}

/**
 * 格式化发布时间
 */
function formatPublishTime(timeString: string): string {
  if (!timeString) return 'Unknown';
  
  try {
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch (error) {
    return timeString;
  }
}

/**
 * 计算相关性分数
 */
function calculateRelevanceScore(article: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配
  if (article.title) {
    const titleLower = article.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 3;
    });
  }
  
  // 描述匹配
  if (article.description) {
    const descLower = article.description.toLowerCase();
    queryWords.forEach(word => {
      if (descLower.includes(word)) score += 1;
    });
  }
  
  // 时间新鲜度
  if (article.publishedAt) {
    const hoursAgo = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) score += 2;
    else if (hoursAgo < 72) score += 1;
  }
  
  return score;
}

/**
 * 判断是否为突发新闻
 */
function isBreakingNews(article: any): boolean {
  if (!article.title) return false;
  
  const breakingKeywords = ['breaking', '突发', 'urgent', '紧急', 'live', '实时'];
  const titleLower = article.title.toLowerCase();
  
  return breakingKeywords.some(keyword => titleLower.includes(keyword));
}

/**
 * 计算新闻来源信任度
 */
function calculateTrustScore(source: any): number {
  let score = 50; // 基础分数
  
  // 知名媒体加分
  const trustedSources = ['bbc', 'cnn', 'reuters', 'ap', 'bloomberg', 'wsj', 'nyt'];
  if (trustedSources.some(trusted => source.id?.includes(trusted) || source.name?.toLowerCase().includes(trusted))) {
    score += 30;
  }
  
  // 官方媒体加分
  if (source.description?.includes('official') || source.description?.includes('官方')) {
    score += 20;
  }
  
  return Math.min(score, 100);
}

/**
 * 生成搜索摘要
 */
function generateSearchSummary(articles: any[], query: string, totalResults: number): string {
  if (articles.length === 0) {
    return `No news articles found for "${query}"`;
  }

  const latestArticle = articles[0];
  const sourceCount = new Set(articles.map(a => a.source)).size;
  
  return `Found ${totalResults} articles about "${query}" from ${sourceCount} sources. Latest: "${latestArticle.title}" (${latestArticle.publishedAt})`;
}

/**
 * 生成头条新闻摘要
 */
function generateHeadlinesSummary(articles: any[], query: string, params: any): string {
  if (articles.length === 0) {
    return `No headlines found for "${query}"`;
  }

  const breakingCount = articles.filter(a => a.isBreaking).length;
  const location = params.country ? `in ${params.country.toUpperCase()}` : 'globally';
  const category = params.category ? ` (${params.category})` : '';
  
  let summary = `Found ${articles.length} headlines ${location}${category}`;
  if (breakingCount > 0) {
    summary += `, including ${breakingCount} breaking news`;
  }
  
  return summary + `. Latest: "${articles[0].title}"`;
}

/**
 * 生成新闻来源摘要
 */
function generateSourcesSummary(sources: any[], query: string, params: any): string {
  if (sources.length === 0) {
    return `No news sources found for "${query}"`;
  }

  const categories = new Set(sources.map(s => s.category)).size;
  const languages = new Set(sources.map(s => s.language)).size;
  
  return `Found ${sources.length} news sources across ${categories} categories and ${languages} languages. Top source: ${sources[0].name}`;
}

/**
 * 工具注册信息
 */
export const newsAPINewsSearchTool = {
  name: 'newsapi_news_search',
  description: 'Search for news articles, headlines, and sources using NewsAPI with intelligent routing',
  category: 'news-search',
  source: 'newsapi.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for news. Examples: "AI news today", "US headlines", "tech news sources", "COVID-19 updates", "今日科技新闻"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of articles to return (default: 20, max: 100)',
        default: 20,
        minimum: 1,
        maximum: 100
      }
    },
    required: ['query']
  },
  execute: newsAPINewsSearch,
  examples: [
    {
      query: "AI news today",
      description: "Get today's artificial intelligence news"
    },
    {
      query: "US headlines",
      description: "Get top headlines from the United States"
    },
    {
      query: "tech news sources",
      description: "Get technology news sources"
    },
    {
      query: "COVID-19 updates",
      description: "Get latest COVID-19 news updates"
    },
    {
      query: "今日科技新闻",
      description: "Get today's technology news (Chinese)"
    },
    {
      query: "breaking news",
      description: "Get latest breaking news"
    }
  ]
};
