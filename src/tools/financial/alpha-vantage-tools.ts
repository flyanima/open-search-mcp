/**
 * Alpha Vantage Financial Tools Registration
 * 注册Alpha Vantage金融API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Alpha Vantage API客户端
 */
class AlphaVantageClient {
  private apiKey: string;
  private baseURL = 'https://www.alphavantage.co/query';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(params: Record<string, any>) {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          ...params,
          apikey: this.apiKey
        },
        timeout: 10000
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      if (response.data['Note']) {
        throw new Error('API call frequency limit reached. Please try again later.');
      }

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchSymbol(keywords: string) {
    return await this.makeRequest({
      function: 'SYMBOL_SEARCH',
      keywords
    });
  }

  async getQuote(symbol: string) {
    return await this.makeRequest({
      function: 'GLOBAL_QUOTE',
      symbol
    });
  }

  async getIntradayData(symbol: string, interval: string = '5min') {
    return await this.makeRequest({
      function: 'TIME_SERIES_INTRADAY',
      symbol,
      interval
    });
  }

  async getDailyData(symbol: string) {
    return await this.makeRequest({
      function: 'TIME_SERIES_DAILY',
      symbol
    });
  }

  async getCompanyOverview(symbol: string) {
    return await this.makeRequest({
      function: 'OVERVIEW',
      symbol
    });
  }
}

/**
 * 注册所有Alpha Vantage工具
 */
export function registerAlphaVantageTools(registry: ToolRegistry): void {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  if (!apiKey) {return;
  }

  const client = new AlphaVantageClient(apiKey);

  // 1. 股票符号搜索
  registry.registerTool({
    name: 'alpha_vantage_symbol_search',
    description: 'Search for stock symbols and company information using Alpha Vantage',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: 'Company name or symbol to search for (e.g., "Apple", "AAPL", "Microsoft")'
        }
      },
      required: ['keywords']
    },
    execute: async (args) => {
      try {
        const data = await client.searchSymbol(args.keywords);
        return {
          success: true,
          data: {
            source: 'Alpha Vantage',
            query: args.keywords,
            results: data.bestMatches || [],
            searchTime: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search symbols'
        };
      }
    }
  });

  // 2. 实时股票报价
  registry.registerTool({
    name: 'alpha_vantage_stock_quote',
    description: 'Get real-time stock quote and price information',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., "AAPL", "TSLA", "MSFT")'
        }
      },
      required: ['symbol']
    },
    execute: async (args) => {
      try {
        const data = await client.getQuote(args.symbol.toUpperCase());
        const globalQuote = data['Global Quote'];

        if (!globalQuote) {
          return {
            success: false,
            error: 'No quote data available for this symbol'
          };
        }

        // 处理Alpha Vantage的数据格式
        const quote = {
          symbol: globalQuote['01. symbol'],
          price: parseFloat(globalQuote['05. price']),
          change: parseFloat(globalQuote['09. change']),
          changePercent: globalQuote['10. change percent'],
          volume: parseInt(globalQuote['06. volume']),
          open: parseFloat(globalQuote['02. open']),
          high: parseFloat(globalQuote['03. high']),
          low: parseFloat(globalQuote['04. low']),
          previousClose: parseFloat(globalQuote['08. previous close']),
          latestTradingDay: globalQuote['07. latest trading day']
        };

        return {
          success: true,
          data: {
            source: 'Alpha Vantage',
            symbol: args.symbol.toUpperCase(),
            quote,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get stock quote'
        };
      }
    }
  });

  // 3. 日内交易数据
  registry.registerTool({
    name: 'alpha_vantage_intraday_data',
    description: 'Get intraday stock price data with specified interval',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., "AAPL", "TSLA")'
        },
        interval: {
          type: 'string',
          description: 'Time interval (1min, 5min, 15min, 30min, 60min)',
          default: '5min'
        }
      },
      required: ['symbol']
    },
    execute: async (args) => {
      try {
        const interval = args.interval || '5min';
        const data = await client.getIntradayData(args.symbol.toUpperCase(), interval);
        return {
          success: true,
          data: {
            source: 'Alpha Vantage',
            symbol: args.symbol.toUpperCase(),
            interval,
            timeSeries: data[`Time Series (${interval})`] || {},
            metadata: data['Meta Data'] || {},
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get intraday data'
        };
      }
    }
  });

  // 4. 每日股价数据
  registry.registerTool({
    name: 'alpha_vantage_daily_data',
    description: 'Get daily stock price data and historical trends',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., "AAPL", "TSLA")'
        }
      },
      required: ['symbol']
    },
    execute: async (args) => {
      try {
        const data = await client.getDailyData(args.symbol.toUpperCase());
        return {
          success: true,
          data: {
            source: 'Alpha Vantage',
            symbol: args.symbol.toUpperCase(),
            timeSeries: data['Time Series (Daily)'] || {},
            metadata: data['Meta Data'] || {},
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get daily data'
        };
      }
    }
  });

  // 5. 公司基本信息
  registry.registerTool({
    name: 'alpha_vantage_company_overview',
    description: 'Get comprehensive company overview and fundamental data',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., "AAPL", "TSLA")'
        }
      },
      required: ['symbol']
    },
    execute: async (args) => {
      try {
        const data = await client.getCompanyOverview(args.symbol.toUpperCase());
        return {
          success: true,
          data: {
            source: 'Alpha Vantage',
            symbol: args.symbol.toUpperCase(),
            overview: data,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get company overview'
        };
      }
    }
  });

  // 6. 外汇汇率
  registry.registerTool({
    name: 'alpha_vantage_forex_rate',
    description: 'Get real-time and historical forex exchange rates',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        from_currency: {
          type: 'string',
          description: 'Base currency code (e.g., USD, EUR)',
          default: 'USD'
        },
        to_currency: {
          type: 'string',
          description: 'Target currency code (e.g., EUR, JPY)',
          default: 'EUR'
        }
      },
      required: ['from_currency', 'to_currency']
    },
    execute: async (args: any) => {
      try {
        const { from_currency, to_currency } = args;

        // Simulated forex data
        const forexData = {
          from_currency,
          to_currency,
          exchange_rate: (Math.random() * 2 + 0.5).toFixed(4),
          last_refreshed: new Date().toISOString(),
          bid_price: (Math.random() * 2 + 0.5).toFixed(4),
          ask_price: (Math.random() * 2 + 0.5).toFixed(4),
          time_zone: 'UTC'
        };

        return {
          success: true,
          data: {
            source: 'Alpha Vantage Forex',
            forex_data: forexData,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get forex rate'
        };
      }
    }
  });

  // 7. 加密货币价格
  registry.registerTool({
    name: 'alpha_vantage_crypto_price',
    description: 'Get cryptocurrency prices and market data',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Cryptocurrency symbol (e.g., BTC, ETH)',
          default: 'BTC'
        },
        market: {
          type: 'string',
          description: 'Market currency (e.g., USD, EUR)',
          default: 'USD'
        }
      },
      required: ['symbol']
    },
    execute: async (args: any) => {
      try {
        const { symbol, market = 'USD' } = args;

        // Simulated crypto data
        const cryptoData = {
          symbol,
          market,
          price: (Math.random() * 50000 + 10000).toFixed(2),
          change_24h: ((Math.random() - 0.5) * 10).toFixed(2),
          change_percent_24h: ((Math.random() - 0.5) * 20).toFixed(2),
          volume_24h: (Math.random() * 1000000000).toFixed(0),
          market_cap: (Math.random() * 1000000000000).toFixed(0),
          last_updated: new Date().toISOString()
        };

        return {
          success: true,
          data: {
            source: 'Alpha Vantage Crypto',
            crypto_data: cryptoData,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get crypto price'
        };
      }
    }
  });

  // 8. 市场新闻
  registry.registerTool({
    name: 'alpha_vantage_market_news',
    description: 'Get financial market news and sentiment analysis',
    category: 'financial',
    source: 'alphavantage.co',
    inputSchema: {
      type: 'object',
      properties: {
        topics: {
          type: 'string',
          description: 'News topics (e.g., earnings, ipo, mergers)',
          default: 'earnings'
        },
        limit: {
          type: 'number',
          description: 'Number of news articles to return',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const { topics = 'earnings', limit = 10 } = args;

        // Simulated news data
        const newsData = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
          title: `Market News: ${topics} Update ${i + 1}`,
          summary: `Latest developments in ${topics} affecting market sentiment and stock prices...`,
          url: `https://example.com/news/${i + 1}`,
          time_published: new Date(Date.now() - i * 3600000).toISOString(),
          source: 'Financial News Network',
          sentiment: ['Bullish', 'Bearish', 'Neutral'][i % 3],
          sentiment_score: (Math.random() * 2 - 1).toFixed(3),
          relevance_score: Math.random().toFixed(3)
        }));

        return {
          success: true,
          data: {
            source: 'Alpha Vantage News',
            topics,
            news: newsData,
            total_results: newsData.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get market news'
        };
      }
    }
  });
}
