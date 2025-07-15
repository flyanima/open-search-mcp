import { GoogleSearchClient } from '../../api/clients/google-search-client.js';
import { GoogleSearchRouter } from '../../utils/google-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Google 新闻搜索工具
 * 专门用于新闻文章和时事内容搜索
 */

const logger = new Logger('GoogleNewsSearch');

export async function googleNewsSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing Google news search: ${args.query}`);

    const limit = args.limit || 10;
    const timeframe = args.timeframe || 'w1'; // 默认最近一周
    const result = await handleNewsSearchRequest(client, args.query, limit, timeframe);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'google_news_search',
        result,
        source: 'Google News',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Google news search failed:', error);
    return {
      success: false,
      error: `Google news search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理新闻搜索请求
 */
async function handleNewsSearchRequest(client: GoogleSearchClient, query: string, limit: number, timeframe: string): Promise<any> {
  try {
    const searchResult = await client.searchNews(query, { 
      num: limit,
      dateRestrict: timeframe
    });
    
    if (!searchResult.items || searchResult.items.length === 0) {
      return {
        type: 'google_news_search',
        query,
        articles: [],
        totalResults: 0,
        timeframe,
        message: `No news articles found for "${query}"`,
        suggestions: generateNewsSearchSuggestions(query)
      };
    }

    // 增强新闻结果
    const enhancedArticles = searchResult.items.map((item: any) => {
      return {
        ...item,
        
        // 新闻价值评估
        newsValue: assessNewsValue(item),
        
        // 时效性分析
        timeliness: analyzeTimeliness(item),
        
        // 来源可信度
        sourceCredibility: assessSourceCredibility(item),
        
        // 相关性分数
        relevanceScore: calculateNewsRelevance(item, query),
        
        // 新闻类型分析
        newsType: analyzeNewsType(item),
        
        // 格式化显示信息
        displayInfo: formatNewsDisplayInfo(item)
      };
    });

    // 按新闻价值和时效性排序
    enhancedArticles.sort((a: any, b: any) => {
      const scoreA = a.newsValue + a.timeliness.score + a.sourceCredibility + a.relevanceScore;
      const scoreB = b.newsValue + b.timeliness.score + b.sourceCredibility + b.relevanceScore;
      return scoreB - scoreA;
    });

    // 分析新闻搜索结果
    const resultAnalysis = analyzeNewsResults(enhancedArticles, searchResult);

    return {
      type: 'google_news_search',
      query,
      articles: enhancedArticles,
      totalResults: parseInt(searchResult.searchInformation.totalResults) || enhancedArticles.length,
      searchTime: searchResult.searchInformation.searchTime,
      timeframe,
      analysis: resultAnalysis,
      summary: generateNewsSearchSummary(enhancedArticles, query, timeframe, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 评估新闻价值
 */
function assessNewsValue(item: any): number {
  let score = 0;
  const title = item.title?.toLowerCase() || '';
  const snippet = item.snippet?.toLowerCase() || '';
  
  // 突发新闻关键词
  const breakingKeywords = ['breaking', 'urgent', 'alert', 'developing', '突发', '紧急', '最新'];
  if (breakingKeywords.some(keyword => title.includes(keyword) || snippet.includes(keyword))) {
    score += 20;
  }
  
  // 重要性关键词
  const importanceKeywords = ['major', 'significant', 'important', 'critical', '重大', '重要', '关键'];
  if (importanceKeywords.some(keyword => title.includes(keyword) || snippet.includes(keyword))) {
    score += 15;
  }
  
  // 官方声明或政策
  const officialKeywords = ['official', 'government', 'policy', 'statement', '官方', '政府', '政策', '声明'];
  if (officialKeywords.some(keyword => title.includes(keyword) || snippet.includes(keyword))) {
    score += 10;
  }
  
  // 数据和统计
  const dataKeywords = ['report', 'study', 'data', 'statistics', '报告', '研究', '数据', '统计'];
  if (dataKeywords.some(keyword => title.includes(keyword) || snippet.includes(keyword))) {
    score += 8;
  }
  
  return Math.min(score, 30);
}

/**
 * 分析时效性
 */
function analyzeTimeliness(item: any): any {
  const snippet = item.snippet?.toLowerCase() || '';
  const title = item.title?.toLowerCase() || '';
  
  let score = 0;
  let freshness = 'unknown';
  
  // 时间指示词
  const timeIndicators = {
    'very_fresh': ['today', 'now', 'just', 'minutes ago', 'hours ago', '今天', '刚刚', '分钟前', '小时前'],
    'fresh': ['yesterday', 'this week', 'recent', 'latest', '昨天', '本周', '最近', '最新'],
    'moderate': ['this month', 'last week', '本月', '上周'],
    'old': ['last month', 'last year', '上月', '去年']
  };
  
  for (const [level, indicators] of Object.entries(timeIndicators)) {
    if (indicators.some(indicator => snippet.includes(indicator) || title.includes(indicator))) {
      freshness = level;
      break;
    }
  }
  
  // 根据时效性评分
  switch (freshness) {
    case 'very_fresh': score = 20; break;
    case 'fresh': score = 15; break;
    case 'moderate': score = 10; break;
    case 'old': score = 5; break;
    default: score = 8; // 未知但假设相对新鲜
  }
  
  return {
    score,
    freshness,
    indicators: timeIndicators[freshness as keyof typeof timeIndicators] || []
  };
}

/**
 * 评估来源可信度
 */
function assessSourceCredibility(item: any): number {
  let score = 0;
  const domain = item.displayLink?.toLowerCase() || '';
  
  // 主流媒体
  const majorNews = [
    'bbc.com', 'cnn.com', 'reuters.com', 'ap.org', 'nytimes.com',
    'washingtonpost.com', 'theguardian.com', 'wsj.com', 'bloomberg.com',
    'npr.org', 'pbs.org', 'abc.com', 'cbsnews.com', 'nbcnews.com'
  ];
  
  if (majorNews.some(source => domain.includes(source))) {
    score += 25;
  }
  
  // 专业媒体
  const professionalNews = [
    'techcrunch.com', 'wired.com', 'arstechnica.com', 'theverge.com',
    'fortune.com', 'forbes.com', 'businessinsider.com', 'cnbc.com'
  ];
  
  if (professionalNews.some(source => domain.includes(source))) {
    score += 20;
  }
  
  // 政府和官方来源
  if (domain.includes('.gov') || domain.includes('.edu')) {
    score += 20;
  }
  
  // 国际组织
  const intlOrgs = ['who.int', 'un.org', 'worldbank.org', 'imf.org'];
  if (intlOrgs.some(org => domain.includes(org))) {
    score += 18;
  }
  
  return Math.min(score, 25);
}

/**
 * 计算新闻相关性
 */
function calculateNewsRelevance(item: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配（权重更高）
  if (item.title) {
    const titleLower = item.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 15;
    });
  }
  
  // 摘要匹配
  if (item.snippet) {
    const snippetLower = item.snippet.toLowerCase();
    queryWords.forEach(word => {
      if (snippetLower.includes(word)) score += 8;
    });
  }
  
  // URL匹配
  if (item.link) {
    const urlLower = item.link.toLowerCase();
    queryWords.forEach(word => {
      if (urlLower.includes(word)) score += 3;
    });
  }
  
  return Math.min(score, 35);
}

/**
 * 分析新闻类型
 */
function analyzeNewsType(item: any): string {
  const title = item.title?.toLowerCase() || '';
  const snippet = item.snippet?.toLowerCase() || '';
  const domain = item.displayLink?.toLowerCase() || '';
  
  // 基于内容和来源判断新闻类型
  if (title.includes('breaking') || snippet.includes('breaking')) return 'Breaking News';
  if (domain.includes('business') || domain.includes('finance')) return 'Business';
  if (domain.includes('tech') || title.includes('technology')) return 'Technology';
  if (domain.includes('sports') || title.includes('sport')) return 'Sports';
  if (domain.includes('health') || title.includes('health')) return 'Health';
  if (domain.includes('science') || title.includes('science')) return 'Science';
  if (title.includes('politics') || title.includes('government')) return 'Politics';
  if (title.includes('world') || title.includes('international')) return 'World News';
  if (title.includes('local') || title.includes('city')) return 'Local News';
  if (title.includes('opinion') || title.includes('editorial')) return 'Opinion';
  
  return 'General News';
}

/**
 * 格式化新闻显示信息
 */
function formatNewsDisplayInfo(item: any): any {
  return {
    headline: item.title,
    url: item.link,
    source: item.displayLink,
    summary: item.snippet,
    formattedUrl: item.formattedUrl,
    publishedTime: extractPublishTime(item.snippet),
    newsType: analyzeNewsType(item)
  };
}

/**
 * 提取发布时间
 */
function extractPublishTime(snippet: string): string | null {
  // 尝试从摘要中提取时间信息
  const timePatterns = [
    /(\d+)\s*(hours?|hrs?)\s*ago/i,
    /(\d+)\s*(minutes?|mins?)\s*ago/i,
    /(\d+)\s*(days?)\s*ago/i,
    /(today|yesterday|now)/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/
  ];
  
  for (const pattern of timePatterns) {
    const match = snippet.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * 分析新闻搜索结果
 */
function analyzeNewsResults(articles: any[], searchResult: any): any {
  if (articles.length === 0) return {};
  
  const analysis = {
    totalArticles: articles.length,
    searchTime: searchResult.searchInformation.searchTime,
    newsTypes: {} as Record<string, number>,
    sources: {} as Record<string, number>,
    freshnessDistribution: { very_fresh: 0, fresh: 0, moderate: 0, old: 0, unknown: 0 },
    averageNewsValue: 0,
    averageCredibility: 0,
    averageRelevance: 0,
    topArticles: articles.slice(0, 3)
  };
  
  // 统计分布
  articles.forEach(article => {
    // 新闻类型分布
    const newsType = article.newsType;
    analysis.newsTypes[newsType] = (analysis.newsTypes[newsType] || 0) + 1;
    
    // 来源分布
    const source = article.displayLink;
    analysis.sources[source] = (analysis.sources[source] || 0) + 1;
    
    // 时效性分布
    const freshness = article.timeliness.freshness;
    if (freshness in analysis.freshnessDistribution) {
      (analysis.freshnessDistribution as any)[freshness]++;
    }
  });
  
  // 计算平均值
  analysis.averageNewsValue = articles.reduce((sum, article) => sum + article.newsValue, 0) / articles.length;
  analysis.averageCredibility = articles.reduce((sum, article) => sum + article.sourceCredibility, 0) / articles.length;
  analysis.averageRelevance = articles.reduce((sum, article) => sum + article.relevanceScore, 0) / articles.length;
  
  return analysis;
}

/**
 * 生成新闻搜索建议
 */
function generateNewsSearchSuggestions(query: string): string[] {
  return [
    'Try current event keywords',
    'Add location or organization names',
    'Use specific date ranges',
    'Include "breaking" for urgent news'
  ];
}

/**
 * 生成新闻搜索摘要
 */
function generateNewsSearchSummary(articles: any[], query: string, timeframe: string, analysis: any): string {
  if (articles.length === 0) return `No news articles found for "${query}"`;
  
  const topArticle = articles[0];
  const avgNewsValue = Math.round(analysis.averageNewsValue);
  const mainType = Object.keys(analysis.newsTypes)[0];
  
  return `Found ${analysis.totalArticles} news articles for "${query}" (${timeframe}). Top: "${topArticle.title}" from ${topArticle.displayLink}. Main type: ${mainType}. Average news value: ${avgNewsValue}/30.`;
}

/**
 * 工具注册信息
 */
export const googleNewsSearchTool = {
  name: 'google_news_search',
  description: 'Search for news articles using Google Custom Search with credibility assessment and timeliness analysis',
  category: 'web-search',
  source: 'google.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'News search query. Examples: "breaking tech news", "climate change policy", "stock market today", "COVID-19 updates"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of articles to return (default: 10, max: 10)',
        default: 10,
        minimum: 1,
        maximum: 10
      },
      timeframe: {
        type: 'string',
        description: 'Time restriction for news (d1=1day, w1=1week, m1=1month)',
        default: 'w1',
        enum: ['d1', 'w1', 'm1', 'm3', 'y1']
      }
    },
    required: ['query']
  },
  execute: googleNewsSearch,
  examples: [
    {
      query: "breaking tech news",
      description: "Find latest breaking technology news"
    },
    {
      query: "climate change policy",
      description: "Search for climate policy news"
    },
    {
      query: "stock market today",
      description: "Get today's stock market news"
    },
    {
      query: "AI artificial intelligence",
      description: "Find AI-related news articles"
    },
    {
      query: "COVID-19 updates",
      description: "Get latest COVID-19 news"
    }
  ]
};
