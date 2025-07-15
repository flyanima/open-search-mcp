/**
 * 加密货币搜索工具
 * 使用CoinGecko API提供真实的加密货币数据
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import { CoinGeckoAPIClient, CoinGeckoSearchOptions } from '../../api/clients/coingecko-client.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('CryptoSearchTools');

export function registerCryptoTools(registry: ToolRegistry): void {
  // 加密货币搜索工具
  registry.registerTool({
    name: 'crypto_search',
    description: 'Search for cryptocurrency information using CoinGecko API',
    category: 'crypto',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Cryptocurrency name or symbol to search for' 
        },
        maxResults: { 
          type: 'number', 
          description: 'Maximum number of results to return (default: 10)' 
        },
        includePrices: { 
          type: 'boolean', 
          description: 'Include current price data (default: true)' 
        },
        includeMarketData: { 
          type: 'boolean', 
          description: 'Include detailed market data (default: false)' 
        },
        vsCurrency: { 
          type: 'string', 
          description: 'Currency for price data (default: usd)' 
        }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const maxResults = Math.min(args.maxResults || 10, 25);
      const includePrices = args.includePrices !== false;
      const includeMarketData = args.includeMarketData || false;
      const vsCurrency = args.vsCurrency || 'usd';

      try {
        const startTime = Date.now();
        
        if (!query || typeof query !== 'string') {
          throw new Error('Query parameter is required and must be a string');
        }

        logger.info(`Searching for cryptocurrency: ${query}`);

        const coinGeckoClient = new CoinGeckoAPIClient();
        
        const searchOptions: CoinGeckoSearchOptions = {
          maxResults,
          includePrices,
          includeMarketData,
          vsCurrency
        };

        const searchResult = await coinGeckoClient.search(query, searchOptions);
        
        // 如果需要详细市场数据，获取额外信息
        if (includeMarketData && searchResult.results.length > 0) {
          const detailedResults = await Promise.all(
            searchResult.results.slice(0, 5).map(async (coin) => {
              const details = await coinGeckoClient.getCoinDetails(coin.id);
              return details || coin;
            })
          );
          searchResult.results = detailedResults;
        }

        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'CoinGecko',
            query,
            results: searchResult.results,
            totalResults: searchResult.totalResults,
            searchTime,
            currency: vsCurrency,
            includedPrices: includePrices,
            includedMarketData: includeMarketData
          },
          metadata: {
            totalResults: searchResult.totalResults,
            searchTime,
            sources: ['coingecko.com'],
            cached: false
          }
        };
      } catch (error) {
        logger.error(`Crypto search failed for ${query}:`, error);
        
        return {
          success: false,
          error: `Cryptocurrency search failed: ${error instanceof Error ? error.message : String(error)}`,
          data: null,
          metadata: {
            sources: ['coingecko.com'],
            cached: false
          }
        };
      }
    }
  });

  // 加密货币市场数据工具
  registry.registerTool({
    name: 'crypto_market_data',
    description: 'Get top cryptocurrency market data from CoinGecko',
    category: 'crypto',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        vsCurrency: { 
          type: 'string', 
          description: 'Currency for price data (default: usd)' 
        },
        limit: { 
          type: 'number', 
          description: 'Number of top cryptocurrencies to return (default: 10, max: 50)' 
        }
      },
      required: []
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const vsCurrency = args.vsCurrency || 'usd';
      const limit = Math.min(args.limit || 10, 50);

      try {
        const startTime = Date.now();
        
        logger.info(`Getting top ${limit} cryptocurrency market data`);

        const coinGeckoClient = new CoinGeckoAPIClient();
        const marketData = await coinGeckoClient.getMarketData(vsCurrency, limit);
        
        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'CoinGecko',
            results: marketData,
            totalResults: marketData.length,
            searchTime,
            currency: vsCurrency,
            marketDataType: 'top_by_market_cap'
          },
          metadata: {
            totalResults: marketData.length,
            searchTime,
            sources: ['coingecko.com'],
            cached: false
          }
        };
      } catch (error) {
        logger.error('Crypto market data fetch failed:', error);
        
        return {
          success: false,
          error: `Cryptocurrency market data fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          data: null,
          metadata: {
            sources: ['coingecko.com'],
            cached: false
          }
        };
      }
    }
  });

  // 加密货币价格工具
  registry.registerTool({
    name: 'crypto_price',
    description: 'Get current price for specific cryptocurrencies',
    category: 'crypto',
    source: 'coingecko.com',
    inputSchema: {
      type: 'object',
      properties: {
        coinIds: { 
          type: 'string', 
          description: 'Comma-separated list of CoinGecko coin IDs (e.g., "bitcoin,ethereum")' 
        },
        vsCurrencies: { 
          type: 'string', 
          description: 'Comma-separated list of currencies (default: usd)' 
        }
      },
      required: ['coinIds']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const coinIds = args.coinIds || '';
      const vsCurrencies = args.vsCurrencies || 'usd';

      try {
        const startTime = Date.now();
        
        if (!coinIds || typeof coinIds !== 'string') {
          throw new Error('coinIds parameter is required and must be a string');
        }

        logger.info(`Getting prices for: ${coinIds}`);

        const coinGeckoClient = new CoinGeckoAPIClient();
        const priceData = await coinGeckoClient.getPrices(coinIds, vsCurrencies);
        
        const searchTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'CoinGecko',
            prices: priceData,
            coinIds: coinIds.split(','),
            currencies: vsCurrencies.split(','),
            searchTime
          },
          metadata: {
            totalResults: Object.keys(priceData).length,
            searchTime,
            sources: ['coingecko.com'],
            cached: false
          }
        };
      } catch (error) {
        logger.error(`Crypto price fetch failed for ${coinIds}:`, error);
        
        return {
          success: false,
          error: `Cryptocurrency price fetch failed: ${error instanceof Error ? error.message : String(error)}`,
          data: null,
          metadata: {
            sources: ['coingecko.com'],
            cached: false
          }
        };
      }
    }
  });

  logger.info('Registered 3 cryptocurrency search tools');
}
