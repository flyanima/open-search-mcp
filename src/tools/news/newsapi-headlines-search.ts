import { NewsAPISearchClient } from '../../api/clients/newsapi-search-client.js';
import { NewsSearchRouter } from '../../utils/news-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * NewsAPI 头条新闻搜索工具
 * 专门用于获取各国和类别的头条新闻
 */

const logger = new Logger('NewsAPIHeadlinesSearch');

export async function newsAPIHeadlinesSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing headlines search: ${args.query}`);

    // 解析查询参数
    const params = parseHeadlinesQuery(args.query);
    
    // 设置限制
    const limit = args.limit || 20;
    params.pageSize = Math.min(limit, 100);
    
    const result = await handleHeadlinesSearch(client, params, args.query);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'headlines',
        result,
        source: 'NewsAPI',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Headlines search failed:', error);
    return {
      success: false,
      error: `Headlines search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 解析头条新闻查询参数
 */
function parseHeadlinesQuery(query: string): any {
  const normalizedQuery = query.toLowerCase().trim();
  const params: any = {};
  
  // 提取国家
  const countryMap: Record<string, string> = {
    '中国': 'cn', 'china': 'cn',
    '美国': 'us', 'usa': 'us', 'america': 'us', 'united states': 'us',
    '英国': 'gb', 'uk': 'gb', 'britain': 'gb', 'united kingdom': 'gb',
    '日本': 'jp', 'japan': 'jp',
    '德国': 'de', 'germany': 'de',
    '法国': 'fr', 'france': 'fr',
    '加拿大': 'ca', 'canada': 'ca',
    '澳大利亚': 'au', 'australia': 'au'
  };
  
  for (const [keyword, country] of Object.entries(countryMap)) {
    if (normalizedQuery.includes(keyword)) {
      params.country = country;
      break;
    }
  }
  
  // 提取类别
  const categoryMap: Record<string, string> = {
    '科技': 'technology', 'tech': 'technology', 'technology': 'technology',
    '商业': 'business', '财经': 'business', 'business': 'business',
    '体育': 'sports', 'sports': 'sports',
    '娱乐': 'entertainment', 'entertainment': 'entertainment',
    '健康': 'health', 'health': 'health',
    '科学': 'science', 'science': 'science'
  };
  
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (normalizedQuery.includes(keyword)) {
      params.category = category;
      break;
    }
  }
  
  // 提取关键词（移除国家和类别词汇）
  let keywords = query;
  const removeWords = [
    ...Object.keys(countryMap),
    ...Object.keys(categoryMap),
    '头条', 'headlines', '新闻', 'news', '最新', 'latest', '今日', 'today'
  ];
  
  removeWords.forEach(word => {
    keywords = keywords.replace(new RegExp(word, 'gi'), '').trim();
  });
  
  if (keywords) {
    params.q = keywords;
  }
  
  // 如果没有指定国家但有中文，默认中国
  if (!params.country && /[\u4e00-\u9fff]/.test(query)) {
    params.country = 'cn';
  }
  
  return params;
}

/**
 * 处理头条新闻搜索
 */
async function handleHeadlinesSearch(client: NewsAPISearchClient, params: any, originalQuery: string): Promise<any> {
  const headlinesData = await client.getTopHeadlines(params);
  
  if (!headlinesData.articles || headlinesData.articles.length === 0) {
    return {
      type: 'headlines',
      query: originalQuery,
      articles: [],
      totalResults: 0,
      searchParams: params,
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
    isBreaking: isBreakingNews(article.title),
    urgencyScore: calculateUrgencyScore(article),
    category: params.category || 'general',
    country: params.country || 'global'
  }));

  // 按紧急程度和时间排序
  formattedArticles.sort((a: any, b: any) => {
    if (a.isBreaking !== b.isBreaking) {
      return a.isBreaking ? -1 : 1; // 突发新闻优先
    }
    return b.urgencyScore - a.urgencyScore; // 按紧急程度排序
  });

  // 分析头条特征
  const analysis = analyzeHeadlines(formattedArticles);

  return {
    type: 'headlines',
    query: originalQuery,
    articles: formattedArticles,
    totalResults: headlinesData.totalResults,
    searchParams: params,
    analysis,
    summary: generateHeadlinesSummary(formattedArticles, originalQuery, params, analysis)
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
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 5) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
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
 * 判断是否为突发新闻
 */
function isBreakingNews(title: string): boolean {
  if (!title) return false;
  
  const breakingKeywords = [
    'breaking', '突发', 'urgent', '紧急', 'live', '实时',
    'alert', '警报', 'developing', '发展中', 'just in', '刚刚'
  ];
  
  const titleLower = title.toLowerCase();
  return breakingKeywords.some(keyword => titleLower.includes(keyword));
}

/**
 * 计算紧急程度分数
 */
function calculateUrgencyScore(article: any): number {
  let score = 0;
  
  // 突发新闻加分
  if (isBreakingNews(article.title)) {
    score += 50;
  }
  
  // 时间新鲜度加分
  if (article.publishedAt) {
    const hoursAgo = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 1) score += 30;
    else if (hoursAgo < 6) score += 20;
    else if (hoursAgo < 24) score += 10;
  }
  
  // 标题关键词加分
  if (article.title) {
    const urgentKeywords = ['crisis', '危机', 'emergency', '紧急', 'disaster', '灾难'];
    const titleLower = article.title.toLowerCase();
    urgentKeywords.forEach(keyword => {
      if (titleLower.includes(keyword)) score += 15;
    });
  }
  
  return score;
}

/**
 * 分析头条新闻特征
 */
function analyzeHeadlines(articles: any[]): any {
  if (articles.length === 0) {
    return {
      breakingCount: 0,
      categories: {},
      sources: {},
      timeDistribution: {},
      topKeywords: []
    };
  }

  const analysis = {
    breakingCount: articles.filter(a => a.isBreaking).length,
    categories: {} as Record<string, number>,
    sources: {} as Record<string, number>,
    timeDistribution: {} as Record<string, number>,
    topKeywords: [] as string[]
  };

  // 统计类别分布
  articles.forEach(article => {
    const category = article.category || 'general';
    analysis.categories[category] = (analysis.categories[category] || 0) + 1;
  });

  // 统计来源分布
  articles.forEach(article => {
    const source = article.source;
    if (source) {
      analysis.sources[source] = (analysis.sources[source] || 0) + 1;
    }
  });

  // 统计时间分布
  articles.forEach(article => {
    if (article.publishedAt) {
      const timeKey = article.publishedAt.includes('ago') ? 'recent' : 'older';
      analysis.timeDistribution[timeKey] = (analysis.timeDistribution[timeKey] || 0) + 1;
    }
  });

  // 提取热门关键词
  const allWords = articles
    .map(a => a.title)
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordCount: Record<string, number> = {};
  allWords.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  analysis.topKeywords = Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);

  return analysis;
}

/**
 * 生成头条新闻摘要
 */
function generateHeadlinesSummary(articles: any[], query: string, params: any, analysis: any): string {
  if (articles.length === 0) {
    return `No headlines found for "${query}"`;
  }

  const location = params.country ? getCountryName(params.country) : 'Global';
  const category = params.category ? ` ${params.category}` : '';
  
  let summary = `${location}${category} Headlines: Found ${articles.length} articles`;
  
  if (analysis.breakingCount > 0) {
    summary += `, including ${analysis.breakingCount} breaking news`;
  }
  
  const latestArticle = articles[0];
  summary += `. Latest: "${latestArticle.title}" (${latestArticle.source})`;
  
  return summary;
}

/**
 * 获取国家名称
 */
function getCountryName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    'cn': 'China',
    'us': 'United States',
    'gb': 'United Kingdom',
    'jp': 'Japan',
    'de': 'Germany',
    'fr': 'France',
    'ca': 'Canada',
    'au': 'Australia'
  };
  
  return countryNames[countryCode] || countryCode.toUpperCase();
}

/**
 * 工具注册信息
 */
export const newsAPIHeadlinesSearchTool = {
  name: 'newsapi_headlines_search',
  description: 'Search for top headlines and breaking news by country and category using NewsAPI',
  category: 'news-search',
  source: 'newsapi.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query for headlines. Examples: "US tech headlines", "China breaking news", "today headlines", "business news", "今日头条"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of headlines to return (default: 20, max: 100)',
        default: 20,
        minimum: 1,
        maximum: 100
      }
    },
    required: ['query']
  },
  execute: newsAPIHeadlinesSearch,
  examples: [
    {
      query: "US tech headlines",
      description: "Get top technology headlines from the United States"
    },
    {
      query: "breaking news",
      description: "Get latest breaking news headlines"
    },
    {
      query: "China business news",
      description: "Get business headlines from China"
    },
    {
      query: "today headlines",
      description: "Get today's top headlines"
    },
    {
      query: "今日头条",
      description: "Get today's headlines (Chinese)"
    },
    {
      query: "sports news",
      description: "Get sports headlines"
    }
  ]
};
