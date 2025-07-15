import { CoinGeckoAPIClient } from '../../api/clients/coingecko-client.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * CoinGecko 加密货币搜索工具
 * 专门用于搜索和发现加密货币项目
 */

const logger = new Logger('CoinGeckoCryptoSearch');

export async function coingeckoCryptoSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new CoinGeckoAPIClient();
    
    logger.info(`Processing CoinGecko crypto search: ${args.query}`);

    const maxResults = Math.min(args.maxResults || 10, 25);
    const includePrices = args.includePrices !== false;
    const vsCurrency = args.vsCurrency || 'usd';
    
    const result = await handleCryptoSearchRequest(client, args.query, maxResults, includePrices, vsCurrency);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'coingecko_crypto_search',
        result,
        source: 'CoinGecko',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('CoinGecko crypto search failed:', error);
    return {
      success: false,
      error: `CoinGecko crypto search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理加密货币搜索请求
 */
async function handleCryptoSearchRequest(client: CoinGeckoAPIClient, query: string, maxResults: number, includePrices: boolean, vsCurrency: string): Promise<any> {
  try {
    const searchResult = await client.search(query, {
      maxResults,
      includePrices,
      vsCurrency
    });

    if (!searchResult.results || searchResult.results.length === 0) {
      return {
        type: 'coingecko_crypto_search',
        query,
        cryptocurrencies: [],
        totalResults: 0,
        message: `No cryptocurrencies found for "${query}"`,
        suggestions: generateCryptoSearchSuggestions(query)
      };
    }

    // 增强搜索结果
    const enhancedCryptos = searchResult.results.map(crypto => {
      return {
        ...crypto,
        
        // 投资风险评估
        riskAssessment: assessInvestmentRisk(crypto),
        
        // 市场表现分析
        marketPerformance: analyzeMarketPerformance(crypto),
        
        // 技术指标
        technicalIndicators: calculateTechnicalIndicators(crypto),
        
        // 投资建议
        investmentInsights: generateInvestmentInsights(crypto),
        
        // 格式化显示信息
        displayInfo: formatCryptoDisplayInfo(crypto)
      };
    });

    // 分析搜索结果
    const resultAnalysis = analyzeCryptoSearchResults(enhancedCryptos);

    return {
      type: 'coingecko_crypto_search',
      query,
      cryptocurrencies: enhancedCryptos,
      totalResults: searchResult.totalResults,
      analysis: resultAnalysis,
      summary: generateCryptoSearchSummary(enhancedCryptos, query, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 评估投资风险
 */
function assessInvestmentRisk(crypto: any): any {
  let riskScore = 50; // 基础风险分数
  
  // 市值排名风险
  if (crypto.marketCapRank) {
    if (crypto.marketCapRank <= 10) riskScore -= 20; // 低风险
    else if (crypto.marketCapRank <= 50) riskScore -= 10; // 中低风险
    else if (crypto.marketCapRank <= 100) riskScore += 0; // 中等风险
    else if (crypto.marketCapRank <= 500) riskScore += 15; // 中高风险
    else riskScore += 30; // 高风险
  }
  
  // 价格波动风险
  if (crypto.priceChangePercentage24h !== undefined) {
    const volatility = Math.abs(crypto.priceChangePercentage24h);
    if (volatility > 20) riskScore += 25;
    else if (volatility > 10) riskScore += 15;
    else if (volatility > 5) riskScore += 5;
  }
  
  // 市值风险
  if (crypto.marketCap) {
    if (crypto.marketCap > 10000000000) riskScore -= 15; // 大市值
    else if (crypto.marketCap > 1000000000) riskScore -= 5; // 中市值
    else if (crypto.marketCap < 100000000) riskScore += 20; // 小市值
  }
  
  const riskLevel = riskScore >= 80 ? 'Very High' : 
                   riskScore >= 60 ? 'High' : 
                   riskScore >= 40 ? 'Medium' : 
                   riskScore >= 20 ? 'Low' : 'Very Low';
  
  return {
    score: Math.max(0, Math.min(100, riskScore)),
    level: riskLevel,
    factors: {
      marketCapRank: crypto.marketCapRank,
      volatility24h: crypto.priceChangePercentage24h,
      marketCap: crypto.marketCap
    }
  };
}

/**
 * 分析市场表现
 */
function analyzeMarketPerformance(crypto: any): any {
  const performance = {
    trend: 'neutral',
    momentum: 'stable',
    strength: 'medium'
  };
  
  // 价格趋势分析
  if (crypto.priceChangePercentage24h !== undefined) {
    if (crypto.priceChangePercentage24h > 5) performance.trend = 'bullish';
    else if (crypto.priceChangePercentage24h < -5) performance.trend = 'bearish';
    
    // 动量分析
    const momentum = Math.abs(crypto.priceChangePercentage24h);
    if (momentum > 15) performance.momentum = 'strong';
    else if (momentum > 5) performance.momentum = 'moderate';
    else performance.momentum = 'weak';
  }
  
  // 市场强度分析
  if (crypto.marketCapRank) {
    if (crypto.marketCapRank <= 20) performance.strength = 'very_strong';
    else if (crypto.marketCapRank <= 50) performance.strength = 'strong';
    else if (crypto.marketCapRank <= 100) performance.strength = 'medium';
    else performance.strength = 'weak';
  }
  
  return performance;
}

/**
 * 计算技术指标
 */
function calculateTechnicalIndicators(crypto: any): any {
  const indicators: any = {};
  
  // RSI模拟 (基于24小时变化)
  if (crypto.priceChangePercentage24h !== undefined) {
    const change = crypto.priceChangePercentage24h;
    indicators.rsi = Math.max(0, Math.min(100, 50 + change * 2));
    
    if (indicators.rsi > 70) indicators.rsiSignal = 'overbought';
    else if (indicators.rsi < 30) indicators.rsiSignal = 'oversold';
    else indicators.rsiSignal = 'neutral';
  }
  
  // 支撑阻力位
  if (crypto.low24h && crypto.high24h && crypto.currentPrice) {
    indicators.support = crypto.low24h;
    indicators.resistance = crypto.high24h;
    indicators.pricePosition = ((crypto.currentPrice - crypto.low24h) / (crypto.high24h - crypto.low24h)) * 100;
  }
  
  return indicators;
}

/**
 * 生成投资洞察
 */
function generateInvestmentInsights(crypto: any): string[] {
  const insights: string[] = [];
  
  // 基于市值排名的洞察
  if (crypto.marketCapRank) {
    if (crypto.marketCapRank <= 10) {
      insights.push('Top 10 cryptocurrency with established market presence');
    } else if (crypto.marketCapRank <= 50) {
      insights.push('Well-established cryptocurrency with good liquidity');
    } else if (crypto.marketCapRank > 500) {
      insights.push('Small-cap cryptocurrency with higher risk and potential');
    }
  }
  
  // 基于价格变化的洞察
  if (crypto.priceChangePercentage24h !== undefined) {
    if (crypto.priceChangePercentage24h > 10) {
      insights.push('Strong positive momentum in the last 24 hours');
    } else if (crypto.priceChangePercentage24h < -10) {
      insights.push('Significant decline in the last 24 hours - potential buying opportunity');
    }
  }
  
  // 基于历史高点的洞察
  if (crypto.athChangePercentage !== undefined) {
    if (crypto.athChangePercentage > -20) {
      insights.push('Trading near all-time high levels');
    } else if (crypto.athChangePercentage < -80) {
      insights.push('Trading significantly below all-time high - potential value opportunity');
    }
  }
  
  return insights.slice(0, 3);
}

/**
 * 格式化加密货币显示信息
 */
function formatCryptoDisplayInfo(crypto: any): any {
  return {
    name: crypto.name,
    symbol: crypto.symbol?.toUpperCase(),
    rank: crypto.marketCapRank ? `#${crypto.marketCapRank}` : 'N/A',
    price: crypto.currentPrice ? `$${crypto.currentPrice.toLocaleString()}` : 'N/A',
    change24h: crypto.priceChangePercentage24h ? 
      `${crypto.priceChangePercentage24h > 0 ? '+' : ''}${crypto.priceChangePercentage24h.toFixed(2)}%` : 'N/A',
    marketCap: crypto.marketCap ? `$${(crypto.marketCap / 1000000000).toFixed(2)}B` : 'N/A',
    volume24h: crypto.totalVolume ? `$${(crypto.totalVolume / 1000000).toFixed(2)}M` : 'N/A',
    image: crypto.image,
    url: crypto.url
  };
}

/**
 * 分析加密货币搜索结果
 */
function analyzeCryptoSearchResults(cryptos: any[]): any {
  if (cryptos.length === 0) return {};
  
  const analysis = {
    totalCryptocurrencies: cryptos.length,
    averageRisk: 0,
    marketTrends: {} as Record<string, number>,
    topPerformers: [] as any[],
    riskDistribution: {} as Record<string, number>
  };
  
  // 计算平均风险
  analysis.averageRisk = cryptos.reduce((sum, crypto) => 
    sum + crypto.riskAssessment.score, 0) / cryptos.length;
  
  // 分析市场趋势
  cryptos.forEach(crypto => {
    const trend = crypto.marketPerformance.trend;
    analysis.marketTrends[trend] = (analysis.marketTrends[trend] || 0) + 1;
  });
  
  // 找出表现最好的
  analysis.topPerformers = cryptos
    .filter(crypto => crypto.priceChangePercentage24h !== undefined)
    .sort((a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h)
    .slice(0, 3);
  
  // 风险分布
  cryptos.forEach(crypto => {
    const risk = crypto.riskAssessment.level;
    analysis.riskDistribution[risk] = (analysis.riskDistribution[risk] || 0) + 1;
  });
  
  return analysis;
}

/**
 * 生成搜索建议
 */
function generateCryptoSearchSuggestions(query: string): string[] {
  return [
    'Try searching for popular cryptocurrencies like "bitcoin", "ethereum", "binance"',
    'Use cryptocurrency symbols like "BTC", "ETH", "ADA"',
    'Search for categories like "defi", "nft", "gaming"',
    'Try broader terms like "stablecoin", "altcoin", "meme coin"'
  ];
}

/**
 * 生成加密货币搜索摘要
 */
function generateCryptoSearchSummary(cryptos: any[], query: string, analysis: any): string {
  if (cryptos.length === 0) return `No cryptocurrencies found for "${query}"`;
  
  const topCrypto = cryptos[0];
  const avgRisk = Math.round(analysis.averageRisk);
  
  return `Found ${analysis.totalCryptocurrencies} cryptocurrencies for "${query}". Top: ${topCrypto.name} (${topCrypto.symbol}) at ${topCrypto.displayInfo.price}. Average risk: ${avgRisk}/100.`;
}

/**
 * 工具注册信息
 */
export const coingeckoCryptoSearchTool = {
  name: 'coingecko_crypto_search',
  description: 'Search cryptocurrencies with investment analysis and risk assessment using CoinGecko API',
  category: 'crypto-search',
  source: 'coingecko.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Cryptocurrency name, symbol, or search term. Examples: "bitcoin", "BTC", "ethereum", "defi tokens"'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 25)',
        default: 10,
        minimum: 1,
        maximum: 25
      },
      includePrices: {
        type: 'boolean',
        description: 'Include current price data (default: true)',
        default: true
      },
      vsCurrency: {
        type: 'string',
        description: 'Currency for price data (default: usd)',
        default: 'usd'
      }
    },
    required: ['query']
  },
  execute: coingeckoCryptoSearch,
  examples: [
    {
      query: "bitcoin",
      description: "Search for Bitcoin cryptocurrency"
    },
    {
      query: "ethereum",
      description: "Search for Ethereum and related tokens"
    },
    {
      query: "defi",
      description: "Search for DeFi (Decentralized Finance) tokens"
    },
    {
      query: "BTC",
      description: "Search using cryptocurrency symbol"
    },
    {
      query: "stablecoin",
      description: "Search for stablecoins"
    }
  ]
};
