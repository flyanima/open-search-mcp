/**
 * CoinGecko API Client
 * 实现CoinGecko免费API集成，用于加密货币数据获取
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

export interface CoinGeckoSearchOptions {
  maxResults?: number;
  includePrices?: boolean;
  includeMarketData?: boolean;
  vsCurrency?: string;
}

export interface CoinGeckoSearchResult {
  query: string;
  results: CoinGeckoCoin[];
  totalResults: number;
  source: string;
  searchTime: number;
  cached: boolean;
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  currentPrice?: number;
  marketCap?: number;
  marketCapRank?: number;
  fullyDilutedValuation?: number;
  totalVolume?: number;
  high24h?: number;
  low24h?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  marketCapChange24h?: number;
  marketCapChangePercentage24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  ath?: number;
  athChangePercentage?: number;
  athDate?: string;
  atl?: number;
  atlChangePercentage?: number;
  atlDate?: string;
  lastUpdated?: string;
  url?: string;
}

export interface CoinGeckoPriceData {
  [coinId: string]: {
    [currency: string]: number;
  };
}

export class CoinGeckoAPIClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1200; // 1.2秒最小间隔（每分钟50次请求）

  constructor() {
    this.logger = new Logger('CoinGeckoAPI');
    
    this.httpClient = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3',
      timeout: 15000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * 搜索加密货币
   */
  async search(query: string, options: CoinGeckoSearchOptions = {}): Promise<CoinGeckoSearchResult> {
    const startTime = Date.now();
    
    try {
      await this.enforceRateLimit();
      
      this.logger.debug(`Searching CoinGecko for: "${query}"`);

      // 执行搜索请求
      const searchResponse = await this.httpClient.get('/search', {
        params: {
          query: query
        }
      });

      const searchData = searchResponse.data;
      let results: CoinGeckoCoin[] = [];

      // 处理搜索结果
      if (searchData.coins && searchData.coins.length > 0) {
        const coins = searchData.coins.slice(0, options.maxResults || 10);
        
        // 如果需要价格数据，批量获取
        if (options.includePrices && coins.length > 0) {
          const coinIds = coins.map((coin: any) => coin.id).join(',');
          const priceData = await this.getPrices(coinIds, options.vsCurrency || 'usd');
          
          results = coins.map((coin: any) => this.transformCoinWithPrice(coin, priceData));
        } else {
          results = coins.map((coin: any) => this.transformCoin(coin));
        }
      }

      const searchTime = Date.now() - startTime;
      
      this.logger.info(`CoinGecko search completed: ${results.length} results in ${searchTime}ms`);
      
      return {
        query,
        results,
        totalResults: results.length,
        source: 'coingecko',
        searchTime,
        cached: false
      };

    } catch (error) {
      this.logger.error('CoinGecko search failed:', error);
      throw new Error(`CoinGecko search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取加密货币价格
   */
  async getPrices(coinIds: string, vsCurrencies: string = 'usd'): Promise<CoinGeckoPriceData> {
    try {
      await this.enforceRateLimit();
      
      const response = await this.httpClient.get('/simple/price', {
        params: {
          ids: coinIds,
          vs_currencies: vsCurrencies,
          include_market_cap: true,
          include_24hr_vol: true,
          include_24hr_change: true,
          include_last_updated_at: true
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('CoinGecko price fetch failed:', error);
      return {};
    }
  }

  /**
   * 获取加密货币详细信息
   */
  async getCoinDetails(coinId: string): Promise<CoinGeckoCoin | null> {
    try {
      await this.enforceRateLimit();
      
      const response = await this.httpClient.get(`/coins/${coinId}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false,
          sparkline: false
        }
      });

      return this.transformDetailedCoin(response.data);
    } catch (error) {
      this.logger.error(`CoinGecko coin details fetch failed for ${coinId}:`, error);
      return null;
    }
  }

  /**
   * 获取市场数据
   */
  async getMarketData(vsCurrency: string = 'usd', perPage: number = 10): Promise<CoinGeckoCoin[]> {
    try {
      await this.enforceRateLimit();
      
      const response = await this.httpClient.get('/coins/markets', {
        params: {
          vs_currency: vsCurrency,
          order: 'market_cap_desc',
          per_page: perPage,
          page: 1,
          sparkline: false
        }
      });

      return response.data.map((coin: any) => this.transformMarketCoin(coin));
    } catch (error) {
      this.logger.error('CoinGecko market data fetch failed:', error);
      return [];
    }
  }

  /**
   * 速率限制控制
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * 转换基础币种数据
   */
  private transformCoin(coin: any): CoinGeckoCoin {
    return {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.large || coin.thumb,
      marketCapRank: coin.market_cap_rank,
      url: `https://www.coingecko.com/en/coins/${coin.id}`
    };
  }

  /**
   * 转换带价格的币种数据
   */
  private transformCoinWithPrice(coin: any, priceData: CoinGeckoPriceData): CoinGeckoCoin {
    const baseData = this.transformCoin(coin);
    const prices = priceData[coin.id];
    
    if (prices) {
      baseData.currentPrice = prices.usd;
      baseData.marketCap = prices.usd_market_cap;
      baseData.totalVolume = prices.usd_24h_vol;
      baseData.priceChangePercentage24h = prices.usd_24h_change;
      baseData.lastUpdated = new Date(prices.last_updated_at * 1000).toISOString();
    }
    
    return baseData;
  }

  /**
   * 转换详细币种数据
   */
  private transformDetailedCoin(coin: any): CoinGeckoCoin {
    const marketData = coin.market_data || {};
    
    return {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image?.large,
      currentPrice: marketData.current_price?.usd,
      marketCap: marketData.market_cap?.usd,
      marketCapRank: coin.market_cap_rank,
      fullyDilutedValuation: marketData.fully_diluted_valuation?.usd,
      totalVolume: marketData.total_volume?.usd,
      high24h: marketData.high_24h?.usd,
      low24h: marketData.low_24h?.usd,
      priceChange24h: marketData.price_change_24h,
      priceChangePercentage24h: marketData.price_change_percentage_24h,
      marketCapChange24h: marketData.market_cap_change_24h,
      marketCapChangePercentage24h: marketData.market_cap_change_percentage_24h,
      circulatingSupply: marketData.circulating_supply,
      totalSupply: marketData.total_supply,
      maxSupply: marketData.max_supply,
      ath: marketData.ath?.usd,
      athChangePercentage: marketData.ath_change_percentage?.usd,
      athDate: marketData.ath_date?.usd,
      atl: marketData.atl?.usd,
      atlChangePercentage: marketData.atl_change_percentage?.usd,
      atlDate: marketData.atl_date?.usd,
      lastUpdated: marketData.last_updated,
      url: `https://www.coingecko.com/en/coins/${coin.id}`
    };
  }

  /**
   * 转换市场币种数据
   */
  private transformMarketCoin(coin: any): CoinGeckoCoin {
    return {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      currentPrice: coin.current_price,
      marketCap: coin.market_cap,
      marketCapRank: coin.market_cap_rank,
      fullyDilutedValuation: coin.fully_diluted_valuation,
      totalVolume: coin.total_volume,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      priceChange24h: coin.price_change_24h,
      priceChangePercentage24h: coin.price_change_percentage_24h,
      marketCapChange24h: coin.market_cap_change_24h,
      marketCapChangePercentage24h: coin.market_cap_change_percentage_24h,
      circulatingSupply: coin.circulating_supply,
      totalSupply: coin.total_supply,
      maxSupply: coin.max_supply,
      ath: coin.ath,
      athChangePercentage: coin.ath_change_percentage,
      athDate: coin.ath_date,
      atl: coin.atl,
      atlChangePercentage: coin.atl_change_percentage,
      atlDate: coin.atl_date,
      lastUpdated: coin.last_updated,
      url: `https://www.coingecko.com/en/coins/${coin.id}`
    };
  }

  /**
   * 检查API健康状态
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/ping', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('CoinGecko health check failed:', error);
      return false;
    }
  }

  /**
   * 通用API调用方法
   */
  async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const response = await this.httpClient.get(endpoint, { params });
      return response.data;
    } catch (error) {
      this.logger.error(`${this.constructor.name} API request failed:`, error);
      throw error;
    }
  }
}
