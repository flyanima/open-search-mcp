import { NewsAPISearchClient } from '../../api/clients/newsapi-search-client.js';
import { NewsSearchRouter } from '../../utils/news-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * NewsAPI 新闻来源搜索工具
 * 专门用于查找和管理新闻来源
 */

const logger = new Logger('NewsAPISourcesSearch');

export async function newsAPISourcesSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing sources search: ${args.query}`);

    // 解析查询参数
    const params = parseSourcesQuery(args.query);
    
    const result = await handleSourcesSearch(client, params, args.query);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'sources',
        result,
        source: 'NewsAPI',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Sources search failed:', error);
    return {
      success: false,
      error: `Sources search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 解析新闻来源查询参数
 */
function parseSourcesQuery(query: string): any {
  const normalizedQuery = query.toLowerCase().trim();
  const params: any = {};
  
  // 提取类别
  const categoryMap: Record<string, string> = {
    '科技': 'technology', 'tech': 'technology', 'technology': 'technology',
    '商业': 'business', '财经': 'business', 'business': 'business',
    '体育': 'sports', 'sports': 'sports',
    '娱乐': 'entertainment', 'entertainment': 'entertainment',
    '健康': 'health', 'health': 'health',
    '科学': 'science', 'science': 'science',
    '综合': 'general', 'general': 'general'
  };
  
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (normalizedQuery.includes(keyword)) {
      params.category = category;
      break;
    }
  }
  
  // 提取语言
  const languageMap: Record<string, string> = {
    '中文': 'zh', 'chinese': 'zh',
    '英文': 'en', 'english': 'en',
    '法文': 'fr', 'french': 'fr',
    '德文': 'de', 'german': 'de',
    '日文': 'ja', 'japanese': 'ja'
  };
  
  for (const [keyword, language] of Object.entries(languageMap)) {
    if (normalizedQuery.includes(keyword)) {
      params.language = language;
      break;
    }
  }
  
  // 提取国家
  const countryMap: Record<string, string> = {
    '中国': 'cn', 'china': 'cn',
    '美国': 'us', 'usa': 'us', 'america': 'us',
    '英国': 'gb', 'uk': 'gb', 'britain': 'gb',
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
  
  // 如果没有指定语言但有中文，默认中文
  if (!params.language && /[\u4e00-\u9fff]/.test(query)) {
    params.language = 'zh';
  }
  
  return params;
}

/**
 * 处理新闻来源搜索
 */
async function handleSourcesSearch(client: NewsAPISearchClient, params: any, originalQuery: string): Promise<any> {
  const sourcesData = await client.getSources(params);
  
  if (!sourcesData.sources || sourcesData.sources.length === 0) {
    return {
      type: 'sources',
      query: originalQuery,
      sources: [],
      totalResults: 0,
      searchParams: params,
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
    trustScore: calculateTrustScore(source),
    popularityScore: calculatePopularityScore(source),
    languageName: getLanguageName(source.language),
    countryName: getCountryName(source.country),
    categoryName: getCategoryName(source.category)
  }));

  // 按信任度和流行度排序
  formattedSources.sort((a: any, b: any) => {
    const scoreA = a.trustScore * 0.7 + a.popularityScore * 0.3;
    const scoreB = b.trustScore * 0.7 + b.popularityScore * 0.3;
    return scoreB - scoreA;
  });

  // 分析来源特征
  const analysis = analyzeSources(formattedSources, params);

  return {
    type: 'sources',
    query: originalQuery,
    sources: formattedSources,
    totalResults: sourcesData.totalResults,
    searchParams: params,
    analysis,
    summary: generateSourcesSummary(formattedSources, originalQuery, params, analysis)
  };
}

/**
 * 计算新闻来源信任度
 */
function calculateTrustScore(source: any): number {
  let score = 50; // 基础分数
  
  // 知名媒体加分
  const trustedSources = [
    'bbc', 'cnn', 'reuters', 'ap', 'bloomberg', 'wsj', 'nyt', 'guardian',
    'npr', 'pbs', 'abc', 'cbs', 'nbc', 'fox', 'usa-today', 'washington-post'
  ];
  
  const sourceId = source.id?.toLowerCase() || '';
  const sourceName = source.name?.toLowerCase() || '';
  
  if (trustedSources.some(trusted => sourceId.includes(trusted) || sourceName.includes(trusted))) {
    score += 30;
  }
  
  // 官方媒体加分
  if (source.description?.includes('official') || source.description?.includes('官方')) {
    score += 20;
  }
  
  // 国际媒体加分
  if (source.description?.includes('international') || source.description?.includes('global')) {
    score += 15;
  }
  
  // 专业媒体加分
  if (source.description?.includes('professional') || source.description?.includes('专业')) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

/**
 * 计算流行度分数
 */
function calculatePopularityScore(source: any): number {
  let score = 50; // 基础分数
  
  // 主流媒体加分
  const popularSources = [
    'cnn', 'bbc', 'fox', 'nbc', 'abc', 'cbs', 'npr', 'usa-today',
    'buzzfeed', 'huffpost', 'mashable', 'techcrunch', 'engadget'
  ];
  
  const sourceId = source.id?.toLowerCase() || '';
  if (popularSources.some(popular => sourceId.includes(popular))) {
    score += 25;
  }
  
  // 科技媒体特殊加分
  if (source.category === 'technology') {
    const techSources = ['techcrunch', 'engadget', 'wired', 'ars-technica', 'the-verge'];
    if (techSources.some(tech => sourceId.includes(tech))) {
      score += 20;
    }
  }
  
  return Math.min(score, 100);
}

/**
 * 分析新闻来源特征
 */
function analyzeSources(sources: any[], params: any): any {
  if (sources.length === 0) {
    return {
      categoryDistribution: {},
      languageDistribution: {},
      countryDistribution: {},
      averageTrustScore: 0,
      topSources: [],
      recommendations: []
    };
  }

  const analysis = {
    categoryDistribution: {} as Record<string, number>,
    languageDistribution: {} as Record<string, number>,
    countryDistribution: {} as Record<string, number>,
    averageTrustScore: 0,
    topSources: [] as any[],
    recommendations: [] as string[]
  };

  // 统计类别分布
  sources.forEach(source => {
    const category = source.categoryName || 'Unknown';
    analysis.categoryDistribution[category] = (analysis.categoryDistribution[category] || 0) + 1;
  });

  // 统计语言分布
  sources.forEach(source => {
    const language = source.languageName || 'Unknown';
    analysis.languageDistribution[language] = (analysis.languageDistribution[language] || 0) + 1;
  });

  // 统计国家分布
  sources.forEach(source => {
    const country = source.countryName || 'Unknown';
    analysis.countryDistribution[country] = (analysis.countryDistribution[country] || 0) + 1;
  });

  // 计算平均信任度
  analysis.averageTrustScore = sources.reduce((sum, source) => sum + source.trustScore, 0) / sources.length;

  // 获取顶级来源
  analysis.topSources = sources.slice(0, 5);

  // 生成推荐
  analysis.recommendations = generateSourceRecommendations(sources, params);

  return analysis;
}

/**
 * 生成来源推荐
 */
function generateSourceRecommendations(sources: any[], params: any): string[] {
  const recommendations: string[] = [];
  
  // 基于信任度推荐
  const highTrustSources = sources.filter(s => s.trustScore > 80);
  if (highTrustSources.length > 0) {
    recommendations.push(`Consider high-trust sources like ${highTrustSources[0].name} for reliable news`);
  }
  
  // 基于类别推荐
  if (params.category) {
    const categoryName = getCategoryName(params.category);
    recommendations.push(`For ${categoryName} news, these sources provide comprehensive coverage`);
  }
  
  // 基于语言推荐
  if (params.language) {
    const languageName = getLanguageName(params.language);
    recommendations.push(`${languageName} sources available for localized news coverage`);
  }
  
  return recommendations;
}

/**
 * 获取语言名称
 */
function getLanguageName(languageCode: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'zh': 'Chinese',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic'
  };
  
  return languageNames[languageCode] || languageCode?.toUpperCase() || 'Unknown';
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
    'au': 'Australia',
    'in': 'India',
    'br': 'Brazil',
    'mx': 'Mexico',
    'it': 'Italy',
    'es': 'Spain'
  };
  
  return countryNames[countryCode] || countryCode?.toUpperCase() || 'Unknown';
}

/**
 * 获取类别名称
 */
function getCategoryName(categoryCode: string): string {
  const categoryNames: Record<string, string> = {
    'technology': 'Technology',
    'business': 'Business',
    'sports': 'Sports',
    'entertainment': 'Entertainment',
    'health': 'Health',
    'science': 'Science',
    'general': 'General'
  };
  
  return categoryNames[categoryCode] || categoryCode || 'General';
}

/**
 * 生成新闻来源摘要
 */
function generateSourcesSummary(sources: any[], query: string, params: any, analysis: any): string {
  if (sources.length === 0) {
    return `No news sources found for "${query}"`;
  }

  const filters = [];
  if (params.category) filters.push(getCategoryName(params.category));
  if (params.language) filters.push(getLanguageName(params.language));
  if (params.country) filters.push(getCountryName(params.country));
  
  const filterText = filters.length > 0 ? ` (${filters.join(', ')})` : '';
  
  let summary = `Found ${sources.length} news sources${filterText}`;
  
  if (analysis.averageTrustScore > 0) {
    summary += `. Average trust score: ${analysis.averageTrustScore.toFixed(0)}/100`;
  }
  
  const topSource = sources[0];
  summary += `. Top recommendation: ${topSource.name} (Trust: ${topSource.trustScore}/100)`;
  
  return summary;
}

/**
 * 工具注册信息
 */
export const newsAPISourcesSearchTool = {
  name: 'newsapi_sources_search',
  description: 'Search and discover news sources by category, language, and country using NewsAPI',
  category: 'news-search',
  source: 'newsapi.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query for news sources. Examples: "tech news sources", "Chinese news sources", "business media", "科技新闻来源", "英文新闻网站"'
      }
    },
    required: ['query']
  },
  execute: newsAPISourcesSearch,
  examples: [
    {
      query: "tech news sources",
      description: "Get technology news sources"
    },
    {
      query: "Chinese news sources",
      description: "Get Chinese language news sources"
    },
    {
      query: "business media",
      description: "Get business news sources"
    },
    {
      query: "US news sources",
      description: "Get news sources from the United States"
    },
    {
      query: "科技新闻来源",
      description: "Get technology news sources (Chinese)"
    },
    {
      query: "sports news sources",
      description: "Get sports news sources"
    }
  ]
};
