import { CoinGeckoAPIClient } from '../../api/clients/coingecko-client.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * CoinGecko 市场数据搜索工具
 * 专门用于获取加密货币市场数据和排行榜
 */

const logger = new Logger('CoinGeckoMarketSearch');

export async function coinGeckoMarketSearch(args: ToolInput): Promise<ToolOutput> {
  try {
    const client = new CoinGeckoAPIClient();
    
    logger.info('Processing CoinGecko market data search');

    const vsCurrency = args.vsCurrency || 'usd';
    const limit = Math.min(args.limit || 10, 100);
    const category = args.category || 'all';
    
    const result = await handleMarketDataRequest(client, vsCurrency, limit, category);

    return {
      success: true,
      data: {
        searchType: 'coingecko_market_search',
        result,
        source: 'CoinGecko',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('CoinGecko market search failed:', error);
    return {
      success: false,
      error: `CoinGecko market search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理市场数据请求
 */
async function handleMarketDataRequest(client: CoinGeckoAPIClient, vsCurrency: string, limit: number, category: string): Promise<any> {
  try {
    const marketData = await client.getMarketData(vsCurrency, limit);

    if (!marketData || marketData.length === 0) {
      return {
        type: 'coingecko_market_search',
        marketData: [],
        totalResults: 0,
        message: 'No market data available',
        suggestions: ['Try again later', 'Check your internet connection']
      };
    }

    // 增强市场数据
    const enhancedMarketData = marketData.map((crypto, index) => {
      return {
        ...crypto,
        
        // 市场排名分析
        rankingAnalysis: analyzeMarketRanking(crypto, index + 1),
        
        // 价格动量分析
        momentumAnalysis: analyzePriceMomentum(crypto),
        
        // 市值分析
        marketCapAnalysis: analyzeMarketCap(crypto),
        
        // 交易量分析
        volumeAnalysis: analyzeVolume(crypto),
        
        // 投资者情绪
        sentimentAnalysis: analyzeSentiment(crypto),
        
        // 格式化显示信息
        displayInfo: formatMarketDisplayInfo(crypto, index + 1)
      };
    });

    // 市场总体分析
    const marketAnalysis = analyzeOverallMarket(enhancedMarketData, vsCurrency);

    return {
      type: 'coingecko_market_search',
      marketData: enhancedMarketData,
      totalResults: enhancedMarketData.length,
      currency: vsCurrency,
      category,
      marketAnalysis,
      summary: generateMarketSummary(enhancedMarketData, marketAnalysis, vsCurrency)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 分析市场排名
 */
function analyzeMarketRanking(crypto: any, position: number): any {
  let tier = 'unknown';
  let stability = 'unknown';
  
  if (crypto.marketCapRank) {
    if (crypto.marketCapRank <= 10) {
      tier = 'blue_chip';
      stability = 'very_stable';
    } else if (crypto.marketCapRank <= 50) {
      tier = 'large_cap';
      stability = 'stable';
    } else if (crypto.marketCapRank <= 100) {
      tier = 'mid_cap';
      stability = 'moderate';
    } else if (crypto.marketCapRank <= 500) {
      tier = 'small_cap';
      stability = 'volatile';
    } else {
      tier = 'micro_cap';
      stability = 'highly_volatile';
    }
  }
  
  return {
    currentPosition: position,
    marketCapRank: crypto.marketCapRank,
    tier,
    stability,
    isTopTier: crypto.marketCapRank <= 20
  };
}

/**
 * 分析价格动量
 */
function analyzePriceMomentum(crypto: any): any {
  const momentum = {
    direction: 'neutral',
    strength: 'weak',
    signal: 'hold'
  };
  
  if (crypto.priceChangePercentage24h !== undefined) {
    const change = crypto.priceChangePercentage24h;
    
    // 方向分析
    if (change > 2) momentum.direction = 'bullish';
    else if (change < -2) momentum.direction = 'bearish';
    
    // 强度分析
    const absChange = Math.abs(change);
    if (absChange > 15) momentum.strength = 'very_strong';
    else if (absChange > 8) momentum.strength = 'strong';
    else if (absChange > 3) momentum.strength = 'moderate';
    
    // 信号分析
    if (change > 10) momentum.signal = 'strong_buy';
    else if (change > 5) momentum.signal = 'buy';
    else if (change < -10) momentum.signal = 'strong_sell';
    else if (change < -5) momentum.signal = 'sell';
  }
  
  return momentum;
}

/**
 * 分析市值
 */
function analyzeMarketCap(crypto: any): any {
  const analysis = {
    category: 'unknown',
    dominance: 0,
    growth: 'stable'
  };
  
  if (crypto.marketCap) {
    // 市值分类
    if (crypto.marketCap > 100000000000) analysis.category = 'mega_cap';
    else if (crypto.marketCap > 10000000000) analysis.category = 'large_cap';
    else if (crypto.marketCap > 1000000000) analysis.category = 'mid_cap';
    else if (crypto.marketCap > 100000000) analysis.category = 'small_cap';
    else analysis.category = 'micro_cap';
    
    // 市值变化分析
    if (crypto.marketCapChangePercentage24h !== undefined) {
      const change = crypto.marketCapChangePercentage24h;
      if (change > 5) analysis.growth = 'expanding';
      else if (change < -5) analysis.growth = 'contracting';
    }
  }
  
  return analysis;
}

/**
 * 分析交易量
 */
function analyzeVolume(crypto: any): any {
  const analysis = {
    level: 'unknown',
    liquidity: 'unknown',
    activity: 'normal'
  };
  
  if (crypto.totalVolume && crypto.marketCap) {
    const volumeToMarketCapRatio = crypto.totalVolume / crypto.marketCap;
    
    // 交易量水平
    if (volumeToMarketCapRatio > 0.3) analysis.level = 'very_high';
    else if (volumeToMarketCapRatio > 0.15) analysis.level = 'high';
    else if (volumeToMarketCapRatio > 0.05) analysis.level = 'moderate';
    else analysis.level = 'low';
    
    // 流动性分析
    if (volumeToMarketCapRatio > 0.2) analysis.liquidity = 'excellent';
    else if (volumeToMarketCapRatio > 0.1) analysis.liquidity = 'good';
    else if (volumeToMarketCapRatio > 0.03) analysis.liquidity = 'fair';
    else analysis.liquidity = 'poor';
    
    // 活动分析
    if (volumeToMarketCapRatio > 0.25) analysis.activity = 'very_active';
    else if (volumeToMarketCapRatio > 0.1) analysis.activity = 'active';
    else if (volumeToMarketCapRatio < 0.02) analysis.activity = 'quiet';
  }
  
  return analysis;
}

/**
 * 分析投资者情绪
 */
function analyzeSentiment(crypto: any): any {
  let sentiment = 'neutral';
  let confidence = 'medium';
  
  if (crypto.priceChangePercentage24h !== undefined) {
    const change = crypto.priceChangePercentage24h;
    
    if (change > 8) {
      sentiment = 'very_bullish';
      confidence = 'high';
    } else if (change > 3) {
      sentiment = 'bullish';
      confidence = 'medium';
    } else if (change < -8) {
      sentiment = 'very_bearish';
      confidence = 'high';
    } else if (change < -3) {
      sentiment = 'bearish';
      confidence = 'medium';
    }
  }
  
  return {
    sentiment,
    confidence,
    recommendation: generateSentimentRecommendation(sentiment, crypto)
  };
}

/**
 * 生成情绪推荐
 */
function generateSentimentRecommendation(sentiment: string, crypto: any): string {
  switch (sentiment) {
    case 'very_bullish':
      return 'Strong positive momentum - consider taking profits if overweight';
    case 'bullish':
      return 'Positive trend - good for accumulation';
    case 'very_bearish':
      return 'Strong negative momentum - potential buying opportunity for long-term';
    case 'bearish':
      return 'Negative trend - wait for stabilization';
    default:
      return 'Neutral sentiment - monitor for trend development';
  }
}

/**
 * 格式化市场显示信息
 */
function formatMarketDisplayInfo(crypto: any, position: number): any {
  return {
    rank: `#${position}`,
    name: crypto.name,
    symbol: crypto.symbol?.toUpperCase(),
    price: crypto.currentPrice ? `$${crypto.currentPrice.toLocaleString()}` : 'N/A',
    change24h: crypto.priceChangePercentage24h ? 
      `${crypto.priceChangePercentage24h > 0 ? '+' : ''}${crypto.priceChangePercentage24h.toFixed(2)}%` : 'N/A',
    marketCap: crypto.marketCap ? `$${(crypto.marketCap / 1000000000).toFixed(2)}B` : 'N/A',
    volume24h: crypto.totalVolume ? `$${(crypto.totalVolume / 1000000).toFixed(2)}M` : 'N/A',
    marketCapRank: crypto.marketCapRank ? `#${crypto.marketCapRank}` : 'N/A',
    image: crypto.image,
    url: crypto.url
  };
}

/**
 * 分析整体市场
 */
function analyzeOverallMarket(marketData: any[], currency: string): any {
  const analysis = {
    totalMarketCap: 0,
    totalVolume: 0,
    averageChange: 0,
    bullishCount: 0,
    bearishCount: 0,
    marketSentiment: 'neutral',
    topGainers: [] as any[],
    topLosers: [] as any[],
    marketTrends: {
      mega_cap: 0,
      large_cap: 0,
      mid_cap: 0,
      small_cap: 0
    }
  };
  
  // 计算总体指标
  marketData.forEach(crypto => {
    if (crypto.marketCap) analysis.totalMarketCap += crypto.marketCap;
    if (crypto.totalVolume) analysis.totalVolume += crypto.totalVolume;
    
    if (crypto.priceChangePercentage24h !== undefined) {
      analysis.averageChange += crypto.priceChangePercentage24h;
      if (crypto.priceChangePercentage24h > 0) analysis.bullishCount++;
      else if (crypto.priceChangePercentage24h < 0) analysis.bearishCount++;
    }
    
    // 市值分类统计
    const category = crypto.marketCapAnalysis.category;
    if (category in analysis.marketTrends) {
      (analysis.marketTrends as any)[category]++;
    }
  });
  
  analysis.averageChange = analysis.averageChange / marketData.length;
  
  // 市场情绪
  if (analysis.bullishCount > analysis.bearishCount * 1.5) {
    analysis.marketSentiment = 'bullish';
  } else if (analysis.bearishCount > analysis.bullishCount * 1.5) {
    analysis.marketSentiment = 'bearish';
  }
  
  // 涨跌幅排行
  const sortedByChange = marketData
    .filter(crypto => crypto.priceChangePercentage24h !== undefined)
    .sort((a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h);
  
  analysis.topGainers = sortedByChange.slice(0, 3);
  analysis.topLosers = sortedByChange.slice(-3).reverse();
  
  return analysis;
}

/**
 * 生成市场摘要
 */
function generateMarketSummary(marketData: any[], analysis: any, currency: string): string {
  const totalCoins = marketData.length;
  const avgChange = analysis.averageChange.toFixed(2);
  const sentiment = analysis.marketSentiment;
  
  return `Market overview: ${totalCoins} cryptocurrencies, average change: ${avgChange}%, market sentiment: ${sentiment}. Total market cap: $${(analysis.totalMarketCap / 1000000000000).toFixed(2)}T.`;
}

/**
 * 工具注册信息
 */
export const coinGeckoMarketSearchTool = {
  name: 'coingecko_market_search',
  description: 'Get cryptocurrency market data, rankings, and market analysis using CoinGecko API',
  category: 'crypto-search',
  source: 'coingecko.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      vsCurrency: {
        type: 'string',
        description: 'Currency for price data (default: usd)',
        default: 'usd'
      },
      limit: {
        type: 'number',
        description: 'Number of top cryptocurrencies to return (default: 10, max: 100)',
        default: 10,
        minimum: 1,
        maximum: 100
      },
      category: {
        type: 'string',
        description: 'Market category filter (default: all)',
        default: 'all'
      }
    },
    required: []
  },
  execute: coinGeckoMarketSearch,
  examples: [
    {
      limit: 10,
      description: "Get top 10 cryptocurrencies by market cap"
    },
    {
      limit: 50,
      vsCurrency: "eur",
      description: "Get top 50 cryptocurrencies in EUR"
    },
    {
      limit: 25,
      description: "Get top 25 cryptocurrencies with market analysis"
    },
    {
      limit: 100,
      description: "Get comprehensive market overview"
    }
  ]
};
