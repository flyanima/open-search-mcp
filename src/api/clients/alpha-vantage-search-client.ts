import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';
import { alphaVantageCache } from '../../utils/alpha-vantage-cache.js';
import { alphaVantageMonitor } from '../../utils/alpha-vantage-monitor.js';

/**
 * Alpha Vantage API客户端 - 专注于搜索场景
 * 只实现搜索相关的核心API功能
 */
export class AlphaVantageSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private apiKey: string;
  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.logger = new Logger('AlphaVantageSearch');
    
    this.httpClient = axios.create({
      baseURL: 'https://www.alphavantage.co/query',
      timeout: 15000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0'
      }
    });
  }

  /**
   * 速率限制检查 (每分钟5次)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // 重置计数器 (每分钟)
    if (now - this.lastResetTime >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    // 检查限制
    if (this.requestCount >= 5) {
      const waitTime = 60000 - (now - this.lastResetTime);
      this.logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }
    
    this.requestCount++;
  }

  /**
   * 通用API请求方法 (带缓存和监控)
   */
  private async makeRequest(params: Record<string, any>): Promise<any> {
    const apiFunction = params.function;

    // 检查缓存
    const cachedData = await alphaVantageCache.get(apiFunction, params);
    if (cachedData) {
      this.logger.debug(`Using cached data for ${apiFunction}`);
      return cachedData;
    }

    // 开始监控
    const { requestId, startTime } = alphaVantageMonitor.startRequest(apiFunction);

    await this.checkRateLimit();

    try {
      const response = await this.httpClient.get('', {
        params: { ...params, apikey: this.apiKey }
      });

      const data = response.data;

      // 检查API错误
      if (data['Error Message']) {
        alphaVantageMonitor.endRequest(requestId, startTime, apiFunction, false, data['Error Message']);
        throw new Error(data['Error Message']);
      }

      if (data['Note']) {
        this.logger.warn('API Note:', data['Note']);
        alphaVantageMonitor.endRequest(requestId, startTime, apiFunction, false, data['Note']);
        throw new Error(data['Note']);
      }

      // 缓存成功的响应
      await alphaVantageCache.set(apiFunction, params, data);

      // 记录成功的请求
      alphaVantageMonitor.endRequest(requestId, startTime, apiFunction, true);

      return data;
    } catch (error) {
      // 记录失败的请求
      alphaVantageMonitor.endRequest(requestId, startTime, apiFunction, false, error instanceof Error ? error.message : String(error));
      this.logger.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * 股票代码搜索
   */
  async searchSymbol(keywords: string): Promise<any> {
    this.logger.info(`Searching symbol: ${keywords}`);
    
    const params = {
      function: 'SYMBOL_SEARCH',
      keywords
    };
    
    const data = await this.makeRequest(params);
    return {
      query: keywords,
      results: data.bestMatches || [],
      source: 'Alpha Vantage'
    };
  }

  /**
   * 获取股票实时报价
   */
  async getStockQuote(symbol: string): Promise<any> {
    this.logger.info(`Getting stock quote: ${symbol}`);
    
    const params = {
      function: 'GLOBAL_QUOTE',
      symbol
    };
    
    const data = await this.makeRequest(params);
    const quote = data['Global Quote'];
    
    if (!quote) {
      throw new Error(`No quote data found for symbol: ${symbol}`);
    }
    
    return {
      symbol,
      quote: {
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: quote['10. change percent'],
        volume: parseInt(quote['06. volume']),
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        previousClose: parseFloat(quote['08. previous close']),
        latestTradingDay: quote['07. latest trading day']
      },
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取外汇汇率
   */
  async getForexRate(fromCurrency: string, toCurrency: string): Promise<any> {
    this.logger.info(`Getting forex rate: ${fromCurrency}/${toCurrency}`);
    
    const params = {
      function: 'CURRENCY_EXCHANGE_RATE',
      from_currency: fromCurrency,
      to_currency: toCurrency
    };
    
    const data = await this.makeRequest(params);
    const rate = data['Realtime Currency Exchange Rate'];
    
    if (!rate) {
      throw new Error(`No exchange rate found for ${fromCurrency}/${toCurrency}`);
    }
    
    return {
      fromCurrency: rate['1. From_Currency Code'],
      toCurrency: rate['3. To_Currency Code'],
      exchangeRate: parseFloat(rate['5. Exchange Rate']),
      lastRefreshed: rate['6. Last Refreshed'],
      bidPrice: parseFloat(rate['8. Bid Price']),
      askPrice: parseFloat(rate['9. Ask Price']),
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取大宗商品价格 (WTI原油)
   */
  async getCommodityPrice(commodity: 'WTI' | 'BRENT'): Promise<any> {
    this.logger.info(`Getting commodity price: ${commodity}`);
    
    const params = {
      function: commodity,
      interval: 'monthly'
    };
    
    const data = await this.makeRequest(params);
    
    // 获取最新数据
    const dataKey = Object.keys(data).find(key => key.includes('data'));
    if (!dataKey || !data[dataKey]) {
      throw new Error(`No ${commodity} price data found`);
    }
    
    const priceData = data[dataKey];
    const latestDate = Object.keys(priceData)[0];
    const latestPrice = priceData[latestDate];
    
    return {
      commodity,
      price: parseFloat(latestPrice.value),
      unit: latestPrice.unit || 'USD per barrel',
      date: latestDate,
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取财经新闻和情感分析
   */
  async getNewsSentiment(tickers?: string, limit: number = 10): Promise<any> {
    this.logger.info(`Getting news sentiment: ${tickers || 'general'}`);
    
    const params: Record<string, any> = {
      function: 'NEWS_SENTIMENT'
    };
    
    if (tickers) {
      params.tickers = tickers;
    }
    
    const data = await this.makeRequest(params);
    
    return {
      query: tickers || 'general market',
      articles: (data.feed || []).slice(0, limit).map((article: any) => ({
        title: article.title,
        url: article.url,
        summary: article.summary,
        source: article.source,
        publishedTime: article.time_published,
        overallSentiment: article.overall_sentiment_label,
        sentimentScore: article.overall_sentiment_score,
        topics: article.topics || [],
        tickerSentiment: article.ticker_sentiment || []
      })),
      sentimentDefinition: data.sentiment_score_definition,
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取市场涨跌幅排行
   */
  async getMarketMovers(): Promise<any> {
    this.logger.info('Getting market movers');
    
    const params = {
      function: 'TOP_GAINERS_LOSERS'
    };
    
    const data = await this.makeRequest(params);
    
    return {
      topGainers: (data.top_gainers || []).map((stock: any) => ({
        ticker: stock.ticker,
        price: parseFloat(stock.price),
        changeAmount: parseFloat(stock.change_amount),
        changePercentage: stock.change_percentage,
        volume: parseInt(stock.volume)
      })),
      topLosers: (data.top_losers || []).map((stock: any) => ({
        ticker: stock.ticker,
        price: parseFloat(stock.price),
        changeAmount: parseFloat(stock.change_amount),
        changePercentage: stock.change_percentage,
        volume: parseInt(stock.volume)
      })),
      mostActivelyTraded: (data.most_actively_traded || []).map((stock: any) => ({
        ticker: stock.ticker,
        price: parseFloat(stock.price),
        changeAmount: parseFloat(stock.change_amount),
        changePercentage: stock.change_percentage,
        volume: parseInt(stock.volume)
      })),
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取财报日历
   */
  async getEarningsCalendar(horizon: string = '3month'): Promise<any> {
    this.logger.info(`Getting earnings calendar: ${horizon}`);
    
    const params = {
      function: 'EARNINGS_CALENDAR',
      horizon
    };
    
    const data = await this.makeRequest(params);
    
    // 解析CSV数据 (Alpha Vantage返回CSV格式)
    if (typeof data === 'string') {
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',');
      const earnings = lines.slice(1).map(line => {
        const values = line.split(',');
        const earning: any = {};
        headers.forEach((header, index) => {
          earning[header.trim()] = values[index]?.trim() || '';
        });
        return earning;
      });
      
      return {
        horizon,
        earnings: earnings.slice(0, 50), // 限制返回数量
        source: 'Alpha Vantage',
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      horizon,
      earnings: [],
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取IPO日历
   */
  async getIPOCalendar(): Promise<any> {
    this.logger.info('Getting IPO calendar');
    
    const params = {
      function: 'IPO_CALENDAR'
    };
    
    const data = await this.makeRequest(params);
    
    // 解析CSV数据
    if (typeof data === 'string') {
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',');
      const ipos = lines.slice(1).map(line => {
        const values = line.split(',');
        const ipo: any = {};
        headers.forEach((header, index) => {
          ipo[header.trim()] = values[index]?.trim() || '';
        });
        return ipo;
      });
      
      return {
        ipos: ipos.slice(0, 20), // 限制返回数量
        source: 'Alpha Vantage',
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      ipos: [],
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取股票报价
   */
  async getQuote(symbol: string): Promise<any> {
    return this.makeRequest({ function: 'GLOBAL_QUOTE', symbol });
  }

  /**
   * 获取时间序列数据
   */
  async getTimeSeries(symbol: string, interval: string = 'daily'): Promise<any> {
    const func = interval === 'daily' ? 'TIME_SERIES_DAILY' : 'TIME_SERIES_INTRADAY';
    const params: Record<string, any> = { function: func, symbol };

    if (interval !== 'daily') {
      params.interval = interval;
    }

    return this.makeRequest(params);
  }
}
