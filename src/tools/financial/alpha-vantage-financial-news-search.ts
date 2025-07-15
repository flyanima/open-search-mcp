import { AlphaVantageSearchClient } from '../../api/clients/alpha-vantage-search-client.js';
import { FinancialSearchRouter } from '../../utils/financial-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Alpha Vantage 财经新闻搜索工具
 * 支持财经新闻、市场动态、情感分析搜索
 */

const logger = new Logger('AlphaVantageFinancialNewsSearch');

export async function financialNewsSearch(args: ToolInput): Promise<ToolOutput> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Alpha Vantage API key not configured',
      data: null
    };
  }

  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required',
      data: null
    };
  }

  try {
    const client = new AlphaVantageSearchClient(apiKey);
    const router = new FinancialSearchRouter();
    
    // 智能路由搜索请求
    const route = router.routeSearch(args.query);
    
    // 处理财经新闻相关的路由，如果路由不匹配则使用默认新闻搜索
    if (route.tool !== 'financial_news') {
      logger.info(`Query "${args.query}" routed to ${route.tool}, but proceeding with news search`);
      // 继续执行新闻搜索而不是返回错误
    }

    logger.info(`Processing financial news search: ${args.query} -> ${route.type}`);

    let result;
    const limit = args.limit || 10;
    
    switch (route.type) {
      case 'news':
        result = await handleNewsSearch(client, route.params?.tickers, args.query, limit);
        break;
        
      case 'market_movers':
        result = await handleMarketMoversSearch(client, args.query);
        break;
        
      default:
        // 默认进行一般新闻搜索
        result = await handleNewsSearch(client, undefined, args.query, limit);
    }

    return {
      success: true,
      data: {
        query: args.query,
        searchType: route.type,
        result,
        source: 'Alpha Vantage',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Financial news search failed:', error);
    return {
      success: false,
      error: `Financial news search failed: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
}

/**
 * 处理新闻搜索
 */
async function handleNewsSearch(client: AlphaVantageSearchClient, tickers: string | undefined, originalQuery: string, limit: number): Promise<any> {
  const newsData = await client.getNewsSentiment(tickers, limit);
  
  if (!newsData.articles || newsData.articles.length === 0) {
    return {
      type: 'financial_news',
      query: originalQuery,
      tickers: tickers || 'general market',
      articles: [],
      message: `No recent financial news found for "${originalQuery}"`
    };
  }

  // 格式化新闻结果
  const formattedArticles = newsData.articles.map((article: any) => ({
    title: article.title,
    summary: article.summary,
    url: article.url,
    source: article.source,
    publishedTime: formatPublishTime(article.publishedTime),
    sentiment: {
      label: article.overallSentiment,
      score: article.sentimentScore,
      description: getSentimentDescription(article.overallSentiment)
    },
    topics: article.topics.map((topic: any) => topic.topic),
    relevantTickers: article.tickerSentiment.map((ts: any) => ({
      ticker: ts.ticker,
      sentiment: ts.ticker_sentiment_label,
      score: ts.ticker_sentiment_score
    }))
  }));

  // 计算整体市场情绪
  const overallSentiment = calculateOverallSentiment(formattedArticles);

  return {
    type: 'financial_news',
    query: originalQuery,
    tickers: tickers || 'general market',
    articles: formattedArticles,
    totalArticles: formattedArticles.length,
    overallSentiment,
    sentimentDefinition: newsData.sentimentDefinition,
    summary: generateNewsSummary(formattedArticles, tickers, originalQuery)
  };
}

/**
 * 处理市场动态搜索
 */
async function handleMarketMoversSearch(client: AlphaVantageSearchClient, originalQuery: string): Promise<any> {
  const moversData = await client.getMarketMovers();
  
  return {
    type: 'market_movers',
    query: originalQuery,
    topGainers: moversData.topGainers.slice(0, 10),
    topLosers: moversData.topLosers.slice(0, 10),
    mostActive: moversData.mostActivelyTraded.slice(0, 10),
    summary: generateMoversSummary(moversData),
    lastUpdated: moversData.timestamp
  };
}

/**
 * 格式化发布时间
 */
function formatPublishTime(timeString: string): string {
  if (!timeString) return 'Unknown';
  
  try {
    // Alpha Vantage时间格式: YYYYMMDDTHHMMSS
    const year = timeString.substring(0, 4);
    const month = timeString.substring(4, 6);
    const day = timeString.substring(6, 8);
    const hour = timeString.substring(9, 11);
    const minute = timeString.substring(11, 13);
    
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
    return date.toLocaleString();
  } catch (error) {
    return timeString;
  }
}

/**
 * 获取情感描述
 */
function getSentimentDescription(sentiment: string): string {
  const descriptions: Record<string, string> = {
    'Bullish': 'Positive market outlook, optimistic tone',
    'Bearish': 'Negative market outlook, pessimistic tone',
    'Neutral': 'Balanced perspective, no strong directional bias',
    'Somewhat-Bullish': 'Mildly positive outlook',
    'Somewhat-Bearish': 'Mildly negative outlook'
  };
  
  return descriptions[sentiment] || 'Unknown sentiment';
}

/**
 * 计算整体市场情绪
 */
function calculateOverallSentiment(articles: any[]): any {
  if (articles.length === 0) {
    return { label: 'Neutral', score: 0, confidence: 'Low' };
  }

  const sentimentCounts: Record<string, number> = {};
  let totalScore = 0;
  
  articles.forEach(article => {
    const sentiment = article.sentiment.label;
    sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
    totalScore += parseFloat(article.sentiment.score) || 0;
  });

  const avgScore = totalScore / articles.length;
  const dominantSentiment = Object.entries(sentimentCounts)
    .sort(([,a], [,b]) => b - a)[0][0];

  return {
    label: dominantSentiment,
    score: avgScore.toFixed(3),
    confidence: articles.length >= 5 ? 'High' : articles.length >= 3 ? 'Medium' : 'Low',
    distribution: sentimentCounts
  };
}

/**
 * 生成新闻摘要
 */
function generateNewsSummary(articles: any[], tickers: string | undefined, query: string): string {
  if (articles.length === 0) {
    return `No recent financial news found for "${query}"`;
  }

  const target = tickers || 'the market';
  const sentimentLabel = articles[0]?.sentiment?.label || 'Mixed';
  const articleCount = articles.length;
  
  return `Found ${articleCount} recent articles about ${target}. Overall sentiment appears ${sentimentLabel.toLowerCase()}. Latest: "${articles[0]?.title}"`;
}

/**
 * 生成市场动态摘要
 */
function generateMoversSummary(moversData: any): string {
  const topGainer = moversData.topGainers[0];
  const topLoser = moversData.topLosers[0];
  const mostActive = moversData.mostActivelyTraded[0];

  let summary = 'Market Activity Summary: ';
  
  if (topGainer) {
    summary += `Top gainer: ${topGainer.ticker} (+${topGainer.changePercentage}). `;
  }
  
  if (topLoser) {
    summary += `Top loser: ${topLoser.ticker} (${topLoser.changePercentage}). `;
  }
  
  if (mostActive) {
    summary += `Most active: ${mostActive.ticker} (${mostActive.volume.toLocaleString()} shares).`;
  }

  return summary;
}

/**
 * 工具注册信息
 */
export const financialNewsSearchTool = {
  name: 'alpha_vantage_financial_news_search',
  description: 'Search for financial news, market sentiment analysis, and market movers using Alpha Vantage',
  category: 'financial-search',
  source: 'alphavantage.co',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for financial news. Examples: "Tesla news", "market movers", "tech stocks news", "today gainers", "Apple latest news"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of news articles to return (default: 10, max: 50)',
        default: 10,
        minimum: 1,
        maximum: 50
      }
    },
    required: ['query']
  },
  execute: financialNewsSearch,
  examples: [
    {
      query: "Tesla news",
      description: "Get latest news about Tesla with sentiment analysis"
    },
    {
      query: "market movers today",
      description: "Get today's top gaining and losing stocks"
    },
    {
      query: "tech stocks news",
      description: "Get latest technology sector news"
    },
    {
      query: "today gainers",
      description: "Get today's top performing stocks"
    },
    {
      query: "Apple latest news",
      description: "Get recent news about Apple Inc."
    },
    {
      query: "特斯拉新闻",
      description: "Get Tesla news (supports Chinese queries)"
    }
  ]
};
