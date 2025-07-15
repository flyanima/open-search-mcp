/**
 * 金融搜索路由器 - 智能识别搜索意图并路由到合适的API
 */

export interface SearchRoute {
  tool: 'financial_info' | 'financial_news' | 'market_calendar';
  type: string;
  api: string;
  params?: Record<string, any>;
}

export class FinancialSearchRouter {
  
  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): SearchRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 股票价格查询
    if (this.isStockPriceQuery(normalizedQuery)) {
      return {
        tool: 'financial_info',
        type: 'stock_price',
        api: 'GLOBAL_QUOTE',
        params: { symbol: this.extractSymbol(query) }
      };
    }
    
    // 公司/股票搜索
    if (this.isCompanySearchQuery(normalizedQuery)) {
      return {
        tool: 'financial_info',
        type: 'company_search',
        api: 'SYMBOL_SEARCH',
        params: { keywords: this.extractSearchKeywords(query) }
      };
    }
    
    // 外汇汇率查询
    if (this.isForexQuery(normalizedQuery)) {
      const currencyPair = this.extractCurrencyPair(query);
      return {
        tool: 'financial_info',
        type: 'forex_rate',
        api: 'CURRENCY_EXCHANGE_RATE',
        params: currencyPair
      };
    }
    
    // 大宗商品价格查询
    if (this.isCommodityQuery(normalizedQuery)) {
      return {
        tool: 'financial_info',
        type: 'commodity_price',
        api: this.extractCommodityAPI(query),
        params: { commodity: this.extractCommodity(query) }
      };
    }
    
    // 新闻查询
    if (this.isNewsQuery(normalizedQuery)) {
      return {
        tool: 'financial_news',
        type: 'news',
        api: 'NEWS_SENTIMENT',
        params: { tickers: this.extractTickersFromNews(query) }
      };
    }
    
    // 市场动态查询
    if (this.isMarketMoversQuery(normalizedQuery)) {
      return {
        tool: 'financial_news',
        type: 'market_movers',
        api: 'TOP_GAINERS_LOSERS'
      };
    }
    
    // 财报日历查询
    if (this.isEarningsCalendarQuery(normalizedQuery)) {
      return {
        tool: 'market_calendar',
        type: 'earnings_calendar',
        api: 'EARNINGS_CALENDAR',
        params: { horizon: this.extractTimeHorizon(query) }
      };
    }
    
    // IPO日历查询
    if (this.isIPOCalendarQuery(normalizedQuery)) {
      return {
        tool: 'market_calendar',
        type: 'ipo_calendar',
        api: 'IPO_CALENDAR'
      };
    }
    
    // 默认：公司搜索
    return {
      tool: 'financial_info',
      type: 'company_search',
      api: 'SYMBOL_SEARCH',
      params: { keywords: query }
    };
  }

  /**
   * 判断是否为股票价格查询
   */
  private isStockPriceQuery(query: string): boolean {
    const priceKeywords = ['股价', '价格', 'price', '报价', '多少钱', '现价', '当前价'];
    const stockPattern = /\b[A-Z]{1,5}\b/; // 股票代码模式
    
    return priceKeywords.some(kw => query.includes(kw)) && 
           (stockPattern.test(query) || this.hasCompanyName(query));
  }

  /**
   * 判断是否为公司搜索查询
   */
  private isCompanySearchQuery(query: string): boolean {
    const searchKeywords = ['公司', '企业', '搜索', 'search', '查找', '找'];
    const hasSearchKeyword = searchKeywords.some(kw => query.includes(kw));
    const hasStockSymbol = /\b[A-Z]{1,5}\b/.test(query);
    const hasCompanyName = this.hasCompanyName(query);
    
    return hasSearchKeyword || (!this.isSpecificQuery(query) && (hasStockSymbol || hasCompanyName));
  }

  /**
   * 判断是否为外汇查询
   */
  private isForexQuery(query: string): boolean {
    const forexKeywords = ['汇率', '外汇', 'forex', 'exchange rate', '兑', '美元', '人民币', '欧元', '英镑', '日元'];
    const currencyPattern = /\b(USD|CNY|EUR|GBP|JPY|AUD|CAD|CHF|HKD)\b/i;
    
    return forexKeywords.some(kw => query.includes(kw)) || currencyPattern.test(query);
  }

  /**
   * 判断是否为大宗商品查询
   */
  private isCommodityQuery(query: string): boolean {
    const commodityKeywords = ['原油', '石油', '黄金', '白银', '铜', '天然气', 'oil', 'gold', 'silver', 'copper', 'gas', 'wti', 'brent'];
    return commodityKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为新闻查询
   */
  private isNewsQuery(query: string): boolean {
    const newsKeywords = ['新闻', 'news', '消息', '资讯', '报道', '动态'];
    return newsKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为市场动态查询
   */
  private isMarketMoversQuery(query: string): boolean {
    const moversKeywords = ['涨幅', '跌幅', '排行', '榜单', '热门', '活跃', 'gainers', 'losers', 'movers', '涨停', '跌停'];
    return moversKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为财报日历查询
   */
  private isEarningsCalendarQuery(query: string): boolean {
    const earningsKeywords = ['财报', '业绩', 'earnings', '季报', '年报', '财报日历'];
    return earningsKeywords.some(kw => query.includes(kw));
  }

  /**
   * 判断是否为IPO日历查询
   */
  private isIPOCalendarQuery(query: string): boolean {
    const ipoKeywords = ['ipo', '上市', '新股', '发行', '首发'];
    return ipoKeywords.some(kw => query.includes(kw));
  }

  /**
   * 提取股票代码
   */
  private extractSymbol(query: string): string {
    // 匹配股票代码模式
    const symbolMatch = query.match(/\b[A-Z]{1,5}\b/);
    if (symbolMatch) {
      return symbolMatch[0];
    }
    
    // 常见公司名称到股票代码的映射
    const companyMap: Record<string, string> = {
      '苹果': 'AAPL',
      'apple': 'AAPL',
      '特斯拉': 'TSLA',
      'tesla': 'TSLA',
      '微软': 'MSFT',
      'microsoft': 'MSFT',
      '谷歌': 'GOOGL',
      'google': 'GOOGL',
      '亚马逊': 'AMZN',
      'amazon': 'AMZN',
      '脸书': 'META',
      'facebook': 'META',
      'meta': 'META'
    };
    
    for (const [name, symbol] of Object.entries(companyMap)) {
      if (query.toLowerCase().includes(name)) {
        return symbol;
      }
    }
    
    // 如果没有找到，返回查询的第一个单词
    return query.split(/\s+/)[0].toUpperCase();
  }

  /**
   * 提取搜索关键词
   */
  private extractSearchKeywords(query: string): string {
    // 移除常见的搜索词
    const stopWords = ['搜索', 'search', '查找', '找', '公司', '企业', '股票'];
    let keywords = query;
    
    stopWords.forEach(word => {
      keywords = keywords.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    return keywords || query;
  }

  /**
   * 提取货币对
   */
  private extractCurrencyPair(query: string): { fromCurrency: string; toCurrency: string } {
    // 常见货币代码
    const currencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'HKD'];
    const foundCurrencies = currencies.filter(curr => 
      query.toUpperCase().includes(curr)
    );
    
    if (foundCurrencies.length >= 2) {
      return {
        fromCurrency: foundCurrencies[0],
        toCurrency: foundCurrencies[1]
      };
    }
    
    // 默认查询美元兑人民币
    if (query.includes('美元') || query.includes('USD')) {
      return { fromCurrency: 'USD', toCurrency: 'CNY' };
    }
    
    if (query.includes('欧元') || query.includes('EUR')) {
      return { fromCurrency: 'EUR', toCurrency: 'CNY' };
    }
    
    return { fromCurrency: 'USD', toCurrency: 'CNY' };
  }

  /**
   * 提取大宗商品类型
   */
  private extractCommodity(query: string): 'WTI' | 'BRENT' {
    if (query.includes('brent') || query.includes('布伦特')) {
      return 'BRENT';
    }
    return 'WTI'; // 默认WTI原油
  }

  /**
   * 提取大宗商品API
   */
  private extractCommodityAPI(query: string): string {
    if (query.includes('brent') || query.includes('布伦特')) {
      return 'BRENT';
    }
    return 'WTI';
  }

  /**
   * 从新闻查询中提取股票代码
   */
  private extractTickersFromNews(query: string): string | undefined {
    const symbol = this.extractSymbol(query);
    // 如果提取到的是有效的股票代码，返回它
    if (symbol && symbol.length <= 5 && /^[A-Z]+$/.test(symbol)) {
      return symbol;
    }
    return undefined;
  }

  /**
   * 提取时间范围
   */
  private extractTimeHorizon(query: string): string {
    if (query.includes('本周') || query.includes('this week')) {
      return '3month'; // Alpha Vantage没有周级别，使用3个月
    }
    if (query.includes('本月') || query.includes('this month')) {
      return '3month';
    }
    if (query.includes('下月') || query.includes('next month')) {
      return '3month';
    }
    return '3month'; // 默认3个月
  }

  /**
   * 判断是否包含公司名称
   */
  private hasCompanyName(query: string): boolean {
    const companyNames = ['苹果', 'apple', '特斯拉', 'tesla', '微软', 'microsoft', '谷歌', 'google', '亚马逊', 'amazon'];
    return companyNames.some(name => query.toLowerCase().includes(name));
  }

  /**
   * 判断是否为特定类型的查询
   */
  private isSpecificQuery(query: string): boolean {
    return this.isNewsQuery(query) || 
           this.isMarketMoversQuery(query) || 
           this.isForexQuery(query) || 
           this.isCommodityQuery(query) ||
           this.isEarningsCalendarQuery(query) ||
           this.isIPOCalendarQuery(query);
  }
}
