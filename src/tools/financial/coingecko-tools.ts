/**
 * CoinGecko API Tools Registration
 * 注册CoinGecko加密货币API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * CoinGecko API客户端
 */
class CoinGeckoAPIClient {
  private apiKey: string;
  private baseURL = 'https://api.coingecko.com/api/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          ...params,
          x_cg_demo_api_key: this.apiKey
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchCoins(query: string) {
    return await this.makeRequest('/search', {
      query
    });
  }

  async getCoinPrice(ids: string[], vs_currencies: string[] = ['usd']) {
    return await this.makeRequest('/simple/price', {
      ids: ids.join(','),
      vs_currencies: vs_currencies.join(','),
      include_24hr_change: true,
      include_market_cap: true,
      include_24hr_vol: true
    });
  }

  async getCoinDetails(id: string) {
    return await this.makeRequest(`/coins/${id}`, {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: true,
      developer_data: false,
      sparkline: false
    });
  }

  async getTopCoins(limit: number = 100, vs_currency: string = 'usd') {
    return await this.makeRequest('/coins/markets', {
      vs_currency,
      order: 'market_cap_desc',
      per_page: limit,
      page: 1,
      sparkline: false,
      price_change_percentage: '24h,7d'
    });
  }

  async getTrendingCoins() {
    return await this.makeRequest('/search/trending');
  }

  async getGlobalData() {
    return await this.makeRequest('/global');
  }
}

/**
 * 注册所有CoinGecko API工具
 */
export function registerCoinGeckoTools(registry: ToolRegistry): void {
  const apiKey = process.env.COINGECKO_API_KEY;
  
  if (!apiKey) {return;
  }

  const client = new CoinGeckoAPIClient(apiKey);

  // 1. 加密货币搜索
  registry.registerTool({
    name: 'coingecko_coin_search',
    description: 'Search for cryptocurrencies by name or symbol',
    category: 'financial',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Cryptocurrency name or symbol (e.g., "bitcoin", "BTC", "ethereum")'
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const data = await client.searchCoins(args.query);
        
        return {
          success: true,
          data: {
            source: 'CoinGecko API',
            query: args.query,
            coins: data.coins || [],
            exchanges: data.exchanges || [],
            categories: data.categories || [],
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search cryptocurrencies'
        };
      }
    }
  });

  // 2. 加密货币价格
  registry.registerTool({
    name: 'coingecko_coin_price',
    description: 'Get current prices for cryptocurrencies',
    category: 'financial',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        coins: {
          type: 'array',
          items: { type: 'string' },
          description: 'Cryptocurrency IDs (e.g., ["bitcoin", "ethereum", "cardano"])'
        },
        currencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fiat currencies (e.g., ["usd", "eur", "btc"])',
          default: ['usd']
        }
      },
      required: ['coins']
    },
    execute: async (args: any) => {
      try {
        const currencies = args.currencies || ['usd'];
        const data = await client.getCoinPrice(args.coins, currencies);
        
        return {
          success: true,
          data: {
            source: 'CoinGecko API',
            coins: args.coins,
            currencies,
            prices: data,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get cryptocurrency prices'
        };
      }
    }
  });

  // 3. 加密货币详细信息
  registry.registerTool({
    name: 'coingecko_coin_details',
    description: 'Get detailed information about a specific cryptocurrency',
    category: 'financial',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        coinId: {
          type: 'string',
          description: 'Cryptocurrency ID (e.g., "bitcoin", "ethereum", "cardano")'
        }
      },
      required: ['coinId']
    },
    execute: async (args: any) => {
      try {
        const data = await client.getCoinDetails(args.coinId);
        
        const coinInfo = {
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          description: data.description?.en?.substring(0, 500) + (data.description?.en?.length > 500 ? '...' : ''),
          image: data.image,
          market_cap_rank: data.market_cap_rank,
          market_data: {
            current_price: data.market_data?.current_price,
            market_cap: data.market_data?.market_cap,
            total_volume: data.market_data?.total_volume,
            price_change_24h: data.market_data?.price_change_24h,
            price_change_percentage_24h: data.market_data?.price_change_percentage_24h,
            market_cap_change_24h: data.market_data?.market_cap_change_24h,
            circulating_supply: data.market_data?.circulating_supply,
            total_supply: data.market_data?.total_supply,
            max_supply: data.market_data?.max_supply
          },
          community_data: data.community_data,
          links: {
            homepage: data.links?.homepage?.[0],
            blockchain_site: data.links?.blockchain_site?.[0],
            official_forum_url: data.links?.official_forum_url?.[0],
            chat_url: data.links?.chat_url?.[0],
            announcement_url: data.links?.announcement_url?.[0],
            twitter_screen_name: data.links?.twitter_screen_name,
            facebook_username: data.links?.facebook_username,
            telegram_channel_identifier: data.links?.telegram_channel_identifier,
            subreddit_url: data.links?.subreddit_url
          }
        };
        
        return {
          success: true,
          data: {
            source: 'CoinGecko API',
            coinId: args.coinId,
            coin: coinInfo,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get cryptocurrency details'
        };
      }
    }
  });

  // 4. 市值排行榜
  registry.registerTool({
    name: 'coingecko_top_coins',
    description: 'Get top cryptocurrencies by market capitalization',
    category: 'financial',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of coins to return (1-250)',
          default: 100,
          minimum: 1,
          maximum: 250
        },
        currency: {
          type: 'string',
          description: 'Currency for prices (e.g., "usd", "eur", "btc")',
          default: 'usd'
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        const limit = args.limit || 100;
        const currency = args.currency || 'usd';
        const data = await client.getTopCoins(limit, currency);
        
        const coins = data.map((coin: any) => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          current_price: coin.current_price,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          fully_diluted_valuation: coin.fully_diluted_valuation,
          total_volume: coin.total_volume,
          high_24h: coin.high_24h,
          low_24h: coin.low_24h,
          price_change_24h: coin.price_change_24h,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
          circulating_supply: coin.circulating_supply,
          total_supply: coin.total_supply,
          max_supply: coin.max_supply,
          ath: coin.ath,
          ath_change_percentage: coin.ath_change_percentage,
          ath_date: coin.ath_date,
          atl: coin.atl,
          atl_change_percentage: coin.atl_change_percentage,
          atl_date: coin.atl_date,
          last_updated: coin.last_updated
        }));
        
        return {
          success: true,
          data: {
            source: 'CoinGecko API',
            limit,
            currency,
            coins,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get top cryptocurrencies'
        };
      }
    }
  });

  // 5. 趋势加密货币
  registry.registerTool({
    name: 'coingecko_trending_coins',
    description: 'Get trending cryptocurrencies based on search volume',
    category: 'financial',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async (args: any) => {
      try {
        const data = await client.getTrendingCoins();
        
        return {
          success: true,
          data: {
            source: 'CoinGecko API',
            trending_coins: data.coins || [],
            trending_nfts: data.nfts || [],
            trending_categories: data.categories || [],
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get trending cryptocurrencies'
        };
      }
    }
  });

  // 6. 全球市场数据
  registry.registerTool({
    name: 'coingecko_global_data',
    description: 'Get global cryptocurrency market data and statistics',
    category: 'financial',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    execute: async (args: any) => {
      try {
        const data = await client.getGlobalData();
        
        return {
          success: true,
          data: {
            source: 'CoinGecko API',
            global: data.data,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get global market data'
        };
      }
    }
  });

}
