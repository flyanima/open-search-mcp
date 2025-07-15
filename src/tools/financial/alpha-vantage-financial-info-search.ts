import { AlphaVantageSearchClient } from '../../api/clients/alpha-vantage-search-client.js';
import { FinancialSearchRouter } from '../../utils/financial-search-router.js';
import { Logger } from '../../utils/logger.js';

/**
 * Alpha Vantage 金融信息搜索工具
 * 支持股票、外汇、大宗商品的基础信息搜索
 */

const logger = new Logger('AlphaVantageFinancialInfoSearch');

import { ToolInput, ToolOutput } from '../../types.js';

export async function financialInfoSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    // 只处理金融信息相关的路由
    if (route.tool !== 'financial_info') {
      return {
        success: false,
        error: `Query "${args.query}" is not a financial info search. Try financial_news_search or market_calendar_search instead.`,
        data: null
      };
    }

    logger.info(`Processing financial info search: ${args.query} -> ${route.type}`);

    let result;
    
    switch (route.type) {
      case 'stock_price':
        result = await handleStockPriceSearch(client, route.params?.symbol, args.query);
        break;
        
      case 'company_search':
        result = await handleCompanySearch(client, route.params?.keywords, args.query);
        break;
        
      case 'forex_rate':
        result = await handleForexSearch(client, route.params, args.query);
        break;
        
      case 'commodity_price':
        result = await handleCommoditySearch(client, route.params, args.query);
        break;
        
      default:
        // 默认进行公司搜索
        result = await handleCompanySearch(client, args.query, args.query);
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
    logger.error('Financial info search failed:', error);
    return {
      success: false,
      error: `Financial info search failed: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
}

/**
 * 处理股票价格搜索
 */
async function handleStockPriceSearch(client: AlphaVantageSearchClient, symbol: string, originalQuery: string): Promise<any> {
  if (!symbol) {
    throw new Error('No stock symbol found in query');
  }

  const quoteData = await client.getStockQuote(symbol);
  
  return {
    type: 'stock_quote',
    symbol: quoteData.symbol,
    companyName: symbol, // 可以后续通过搜索获取公司名称
    currentPrice: quoteData.quote.price,
    change: quoteData.quote.change,
    changePercent: quoteData.quote.changePercent,
    volume: quoteData.quote.volume,
    dayRange: {
      high: quoteData.quote.high,
      low: quoteData.quote.low
    },
    previousClose: quoteData.quote.previousClose,
    lastUpdated: quoteData.quote.latestTradingDay,
    summary: `${symbol} is trading at $${quoteData.quote.price} (${quoteData.quote.changePercent}) with volume of ${quoteData.quote.volume.toLocaleString()}`
  };
}

/**
 * 处理公司搜索
 */
async function handleCompanySearch(client: AlphaVantageSearchClient, keywords: string, originalQuery: string): Promise<any> {
  const searchData = await client.searchSymbol(keywords);
  
  if (!searchData.results || searchData.results.length === 0) {
    return {
      type: 'company_search',
      query: keywords,
      results: [],
      message: `No companies found matching "${keywords}"`
    };
  }

  // 格式化搜索结果
  const formattedResults = searchData.results.slice(0, 10).map((result: any) => ({
    symbol: result['1. symbol'],
    name: result['2. name'],
    type: result['3. type'],
    region: result['4. region'],
    marketOpen: result['5. marketOpen'],
    marketClose: result['6. marketClose'],
    timezone: result['7. timezone'],
    currency: result['8. currency'],
    matchScore: parseFloat(result['9. matchScore'])
  }));

  return {
    type: 'company_search',
    query: keywords,
    results: formattedResults,
    totalResults: formattedResults.length,
    summary: `Found ${formattedResults.length} companies matching "${keywords}". Top match: ${formattedResults[0]?.name} (${formattedResults[0]?.symbol})`
  };
}

/**
 * 处理外汇搜索
 */
async function handleForexSearch(client: AlphaVantageSearchClient, params: any, originalQuery: string): Promise<any> {
  const { fromCurrency, toCurrency } = params;
  
  const forexData = await client.getForexRate(fromCurrency, toCurrency);
  
  return {
    type: 'forex_rate',
    currencyPair: `${fromCurrency}/${toCurrency}`,
    exchangeRate: forexData.exchangeRate,
    bidPrice: forexData.bidPrice,
    askPrice: forexData.askPrice,
    lastRefreshed: forexData.lastRefreshed,
    summary: `1 ${fromCurrency} = ${forexData.exchangeRate} ${toCurrency} (Bid: ${forexData.bidPrice}, Ask: ${forexData.askPrice})`
  };
}

/**
 * 处理大宗商品搜索
 */
async function handleCommoditySearch(client: AlphaVantageSearchClient, params: any, originalQuery: string): Promise<any> {
  const { commodity } = params;
  
  const commodityData = await client.getCommodityPrice(commodity);
  
  return {
    type: 'commodity_price',
    commodity: commodityData.commodity,
    price: commodityData.price,
    unit: commodityData.unit,
    date: commodityData.date,
    summary: `${commodityData.commodity} is trading at $${commodityData.price} ${commodityData.unit} as of ${commodityData.date}`
  };
}

/**
 * 工具注册信息
 */
export const financialInfoSearchTool = {
  name: 'alpha_vantage_financial_info_search',
  description: 'Search for financial information including stock prices, company data, forex rates, and commodity prices using Alpha Vantage',
  category: 'financial-search',
  source: 'alphavantage.co',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for financial information. Examples: "AAPL stock price", "Apple company info", "USD to CNY rate", "oil price", "Tesla stock"'
      }
    },
    required: ['query']
  },
  execute: financialInfoSearch,
  examples: [
    {
      query: "AAPL stock price",
      description: "Get current Apple stock price and trading information"
    },
    {
      query: "Tesla company search",
      description: "Search for Tesla company information and stock symbol"
    },
    {
      query: "USD to CNY exchange rate",
      description: "Get current US Dollar to Chinese Yuan exchange rate"
    },
    {
      query: "oil price",
      description: "Get current crude oil (WTI) price"
    },
    {
      query: "苹果股价",
      description: "Get Apple stock price (supports Chinese queries)"
    }
  ]
};
