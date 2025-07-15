import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * CoinGecko 趋势搜索工具
 * 专门用于获取热门和趋势加密货币
 */

const logger = new Logger('CoinGeckoTrendingSearch');

// 模拟CoinGecko客户端的趋势功能
class CoinGeckoTrendingClient {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private requestCount = 0;

  async makeRequest(endpoint: string): Promise<any> {
    this.requestCount++;
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('CoinGecko trending request failed:', error);
      throw error;
    }
  }

  async getTrendingCoins(): Promise<any> {
    return await this.makeRequest('/search/trending');
  }

  async getGlobalStats(): Promise<any> {
    return await this.makeRequest('/global');
  }
}

export async function coinGeckoTrendingSearch(args: ToolInput): Promise<ToolOutput> {
  try {
    const client = new CoinGeckoTrendingClient();
    
    logger.info('Processing CoinGecko trending search');

    const searchType = args.searchType || 'trending';
    const includeGlobal = args.includeGlobal !== false;
    
    const result = await handleTrendingRequest(client, searchType, includeGlobal);

    return {
      success: true,
      data: {
        searchType: 'coingecko_trending_search',
        result,
        source: 'CoinGecko',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('CoinGecko trending search failed:', error);
    return {
      success: false,
      error: `CoinGecko trending search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理趋势搜索请求
 */
async function handleTrendingRequest(client: CoinGeckoTrendingClient, searchType: string, includeGlobal: boolean): Promise<any> {
  try {
    const trendingData = await client.getTrendingCoins();
    let globalData = null;

    if (includeGlobal) {
      try {
        globalData = await client.getGlobalStats();
      } catch (error) {
        logger.warn('Failed to fetch global stats:', error);
      }
    }

    if (!trendingData) {
      return {
        type: 'coingecko_trending_search',
        trending: [],
        message: 'No trending data available',
        suggestions: ['Try again later', 'Check CoinGecko API status']
      };
    }

    // 增强趋势数据
    const enhancedTrending = {
      coins: trendingData.coins ? trendingData.coins.map((coinData: any) => {
        const coin = coinData.item;
        return {
          ...coin,
          
          // 趋势分析
          trendAnalysis: analyzeTrendStrength(coin),
          
          // 热度评估
          popularityScore: calculatePopularityScore(coin),
          
          // 投资潜力
          investmentPotential: assessInvestmentPotential(coin),
          
          // 风险评估
          riskProfile: assessTrendingRisk(coin),
          
          // 格式化显示信息
          displayInfo: formatTrendingDisplayInfo(coin)
        };
      }) : [],
      
      nfts: trendingData.nfts ? trendingData.nfts.map((nft: any) => {
        return {
          ...nft,
          
          // NFT趋势分析
          nftTrendAnalysis: analyzeNFTTrend(nft),
          
          // 格式化显示信息
          displayInfo: formatNFTDisplayInfo(nft)
        };
      }) : [],
      
      categories: trendingData.categories ? trendingData.categories.map((category: any) => {
        return {
          ...category,
          
          // 分类趋势分析
          categoryTrendAnalysis: analyzeCategoryTrend(category),
          
          // 格式化显示信息
          displayInfo: formatCategoryDisplayInfo(category)
        };
      }) : []
    };

    // 全局市场分析
    const marketAnalysis = globalData ? analyzeGlobalMarket(globalData) : null;

    // 趋势洞察
    const trendingInsights = generateTrendingInsights(enhancedTrending, marketAnalysis);

    return {
      type: 'coingecko_trending_search',
      trending: enhancedTrending,
      globalMarket: marketAnalysis,
      insights: trendingInsights,
      summary: generateTrendingSummary(enhancedTrending, marketAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 分析趋势强度
 */
function analyzeTrendStrength(coin: any): any {
  let strength = 'medium';
  let momentum = 'stable';
  
  // 基于排名分析趋势强度
  if (coin.score !== undefined) {
    if (coin.score >= 8) strength = 'very_strong';
    else if (coin.score >= 6) strength = 'strong';
    else if (coin.score >= 4) strength = 'medium';
    else strength = 'weak';
  }
  
  // 基于市值排名分析动量
  if (coin.market_cap_rank) {
    if (coin.market_cap_rank <= 50) momentum = 'established';
    else if (coin.market_cap_rank <= 200) momentum = 'growing';
    else momentum = 'emerging';
  }
  
  return {
    strength,
    momentum,
    trendScore: coin.score || 0,
    isBreakout: coin.score >= 7 && coin.market_cap_rank > 100
  };
}

/**
 * 计算热度分数
 */
function calculatePopularityScore(coin: any): any {
  let score = 50; // 基础分数
  
  // 基于趋势分数
  if (coin.score) score += coin.score * 5;
  
  // 基于市值排名（排名越高，热度越高）
  if (coin.market_cap_rank) {
    if (coin.market_cap_rank <= 20) score += 20;
    else if (coin.market_cap_rank <= 100) score += 10;
    else if (coin.market_cap_rank > 500) score -= 10;
  }
  
  const level = score >= 80 ? 'Viral' : 
               score >= 60 ? 'Hot' : 
               score >= 40 ? 'Trending' : 'Emerging';
  
  return {
    score: Math.max(0, Math.min(100, score)),
    level,
    isViral: score >= 80
  };
}

/**
 * 评估投资潜力
 */
function assessInvestmentPotential(coin: any): any {
  let potential = 'medium';
  let timeframe = 'medium_term';
  
  // 基于市值排名和趋势分数
  const score = coin.score || 0;
  const rank = coin.market_cap_rank || 1000;
  
  if (score >= 7 && rank > 200) {
    potential = 'high';
    timeframe = 'short_term';
  } else if (score >= 5 && rank <= 100) {
    potential = 'medium';
    timeframe = 'long_term';
  } else if (score < 3) {
    potential = 'low';
    timeframe = 'speculative';
  }
  
  return {
    potential,
    timeframe,
    recommendation: generateInvestmentRecommendation(potential, timeframe, coin)
  };
}

/**
 * 评估趋势风险
 */
function assessTrendingRisk(coin: any): any {
  let riskLevel = 'medium';
  
  const rank = coin.market_cap_rank || 1000;
  const score = coin.score || 0;
  
  // 高趋势分数 + 低市值排名 = 高风险
  if (score >= 7 && rank > 500) riskLevel = 'very_high';
  else if (score >= 5 && rank > 200) riskLevel = 'high';
  else if (rank <= 50) riskLevel = 'low';
  
  return {
    level: riskLevel,
    factors: {
      marketCapRank: rank,
      trendScore: score,
      volatilityRisk: rank > 200 ? 'high' : 'medium'
    }
  };
}

/**
 * 分析NFT趋势
 */
function analyzeNFTTrend(nft: any): any {
  let trend = 'stable';
  
  if (nft.floor_price_24h_percentage_change !== undefined) {
    const change = nft.floor_price_24h_percentage_change;
    if (change > 20) trend = 'surging';
    else if (change > 5) trend = 'rising';
    else if (change < -20) trend = 'declining';
    else if (change < -5) trend = 'falling';
  }
  
  return {
    trend,
    floorPriceChange: nft.floor_price_24h_percentage_change,
    momentum: Math.abs(nft.floor_price_24h_percentage_change || 0) > 10 ? 'strong' : 'weak'
  };
}

/**
 * 分析分类趋势
 */
function analyzeCategoryTrend(category: any): any {
  let trend = 'stable';
  
  if (category.market_cap_1h_change !== undefined) {
    const change = category.market_cap_1h_change;
    if (change > 5) trend = 'surging';
    else if (change > 1) trend = 'rising';
    else if (change < -5) trend = 'declining';
    else if (change < -1) trend = 'falling';
  }
  
  return {
    trend,
    marketCapChange: category.market_cap_1h_change,
    momentum: Math.abs(category.market_cap_1h_change || 0) > 3 ? 'strong' : 'moderate'
  };
}

/**
 * 分析全球市场
 */
function analyzeGlobalMarket(globalData: any): any {
  const data = globalData.data || {};
  
  return {
    totalMarketCap: data.total_market_cap?.usd,
    totalVolume: data.total_volume?.usd,
    marketCapChange: data.market_cap_change_percentage_24h_usd,
    bitcoinDominance: data.market_cap_percentage?.btc,
    ethereumDominance: data.market_cap_percentage?.eth,
    activeCryptocurrencies: data.active_cryptocurrencies,
    markets: data.markets,
    marketSentiment: data.market_cap_change_percentage_24h_usd > 2 ? 'bullish' : 
                    data.market_cap_change_percentage_24h_usd < -2 ? 'bearish' : 'neutral'
  };
}

/**
 * 生成趋势洞察
 */
function generateTrendingInsights(trending: any, marketAnalysis: any): string[] {
  const insights: string[] = [];
  
  // 基于趋势币种的洞察
  if (trending.coins && trending.coins.length > 0) {
    const topCoin = trending.coins[0];
    insights.push(`${topCoin.name} is the top trending cryptocurrency with ${topCoin.popularityScore.level.toLowerCase()} popularity`);
    
    const viralCoins = trending.coins.filter((coin: any) => coin.popularityScore.isViral);
    if (viralCoins.length > 0) {
      insights.push(`${viralCoins.length} cryptocurrencies are experiencing viral-level attention`);
    }
  }
  
  // 基于全球市场的洞察
  if (marketAnalysis) {
    insights.push(`Global market sentiment is ${marketAnalysis.marketSentiment} with ${marketAnalysis.marketCapChange?.toFixed(2)}% change`);
    
    if (marketAnalysis.bitcoinDominance) {
      insights.push(`Bitcoin dominance is ${marketAnalysis.bitcoinDominance.toFixed(1)}%`);
    }
  }
  
  return insights.slice(0, 4);
}

/**
 * 格式化显示信息
 */
function formatTrendingDisplayInfo(coin: any): any {
  return {
    name: coin.name,
    symbol: coin.symbol?.toUpperCase(),
    rank: coin.market_cap_rank ? `#${coin.market_cap_rank}` : 'N/A',
    trendScore: coin.score || 0,
    priceBTC: coin.price_btc ? `${coin.price_btc.toFixed(8)} BTC` : 'N/A',
    image: coin.large || coin.small || coin.thumb,
    slug: coin.slug
  };
}

function formatNFTDisplayInfo(nft: any): any {
  return {
    name: nft.name,
    symbol: nft.symbol,
    floorPrice: nft.floor_price_in_native_currency,
    priceChange: nft.floor_price_24h_percentage_change,
    currency: nft.native_currency_symbol,
    image: nft.thumb
  };
}

function formatCategoryDisplayInfo(category: any): any {
  return {
    name: category.name,
    marketCapChange: category.market_cap_1h_change,
    slug: category.slug
  };
}

/**
 * 生成投资建议
 */
function generateInvestmentRecommendation(potential: string, timeframe: string, coin: any): string {
  if (potential === 'high' && timeframe === 'short_term') {
    return 'High momentum play - consider small position with tight stop-loss';
  } else if (potential === 'medium' && timeframe === 'long_term') {
    return 'Established project with steady growth potential';
  } else if (potential === 'low') {
    return 'High risk speculative play - only for risk-tolerant investors';
  }
  return 'Monitor for trend development before making investment decision';
}

/**
 * 生成趋势摘要
 */
function generateTrendingSummary(trending: any, marketAnalysis: any): string {
  const coinCount = trending.coins?.length || 0;
  const nftCount = trending.nfts?.length || 0;
  const categoryCount = trending.categories?.length || 0;
  
  let summary = `Trending: ${coinCount} cryptocurrencies, ${nftCount} NFTs, ${categoryCount} categories`;
  
  if (marketAnalysis) {
    summary += `. Market sentiment: ${marketAnalysis.marketSentiment}`;
  }
  
  return summary;
}

/**
 * 工具注册信息
 */
export const coinGeckoTrendingSearchTool = {
  name: 'coingecko_trending_search',
  description: 'Get trending cryptocurrencies, NFTs, and market categories with popularity analysis using CoinGecko API',
  category: 'crypto-search',
  source: 'coingecko.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      searchType: {
        type: 'string',
        description: 'Type of trending search (default: trending)',
        default: 'trending'
      },
      includeGlobal: {
        type: 'boolean',
        description: 'Include global market statistics (default: true)',
        default: true
      }
    },
    required: []
  },
  execute: coinGeckoTrendingSearch,
  examples: [
    {
      description: "Get trending cryptocurrencies and market overview"
    },
    {
      includeGlobal: false,
      description: "Get trending cryptocurrencies without global stats"
    },
    {
      searchType: "trending",
      description: "Get comprehensive trending analysis"
    }
  ]
};
