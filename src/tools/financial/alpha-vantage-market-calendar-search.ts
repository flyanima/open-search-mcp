import { AlphaVantageSearchClient } from '../../api/clients/alpha-vantage-search-client.js';
import { FinancialSearchRouter } from '../../utils/financial-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Alpha Vantage 市场日历搜索工具
 * 支持财报日历、IPO日历等重要市场事件搜索
 */

const logger = new Logger('AlphaVantageMarketCalendarSearch');

export async function marketCalendarSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    // 处理市场日历相关的路由，如果路由不匹配则使用默认日历搜索
    if (route.tool !== 'market_calendar') {
      logger.info(`Query "${args.query}" routed to ${route.tool}, but proceeding with calendar search`);
      // 继续执行日历搜索而不是返回错误
    }

    logger.info(`Processing market calendar search: ${args.query} -> ${route.type}`);

    let result;
    
    switch (route.type) {
      case 'earnings_calendar':
        result = await handleEarningsCalendarSearch(client, route.params?.horizon, args.query);
        break;
        
      case 'ipo_calendar':
        result = await handleIPOCalendarSearch(client, args.query);
        break;
        
      default:
        // 默认进行财报日历搜索
        result = await handleEarningsCalendarSearch(client, '3month', args.query);
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
    logger.error('Market calendar search failed:', error);
    return {
      success: false,
      error: `Market calendar search failed: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
}

/**
 * 处理财报日历搜索
 */
async function handleEarningsCalendarSearch(client: AlphaVantageSearchClient, horizon: string, originalQuery: string): Promise<any> {
  const earningsData = await client.getEarningsCalendar(horizon);
  
  if (!earningsData.earnings || earningsData.earnings.length === 0) {
    return {
      type: 'earnings_calendar',
      query: originalQuery,
      horizon,
      earnings: [],
      message: `No earnings events found for the specified period`
    };
  }

  // 格式化财报数据
  const formattedEarnings = earningsData.earnings
    .filter((earning: any) => earning.symbol && earning.reportDate) // 过滤有效数据
    .slice(0, 50) // 限制返回数量
    .map((earning: any) => ({
      symbol: earning.symbol,
      name: earning.name || earning.symbol,
      reportDate: earning.reportDate,
      fiscalDateEnding: earning.fiscalDateEnding,
      estimate: earning.estimate ? parseFloat(earning.estimate) : null,
      currency: earning.currency || 'USD'
    }));

  // 按日期分组
  const groupedByDate = groupEarningsByDate(formattedEarnings);
  
  // 获取即将到来的财报
  const upcomingEarnings = getUpcomingEarnings(formattedEarnings);

  return {
    type: 'earnings_calendar',
    query: originalQuery,
    horizon,
    earnings: formattedEarnings,
    groupedByDate,
    upcomingEarnings,
    totalEvents: formattedEarnings.length,
    summary: generateEarningsSummary(formattedEarnings, upcomingEarnings, originalQuery)
  };
}

/**
 * 处理IPO日历搜索
 */
async function handleIPOCalendarSearch(client: AlphaVantageSearchClient, originalQuery: string): Promise<any> {
  const ipoData = await client.getIPOCalendar();
  
  if (!ipoData.ipos || ipoData.ipos.length === 0) {
    return {
      type: 'ipo_calendar',
      query: originalQuery,
      ipos: [],
      message: `No upcoming IPO events found`
    };
  }

  // 格式化IPO数据
  const formattedIPOs = ipoData.ipos
    .filter((ipo: any) => ipo.symbol && ipo.ipoDate) // 过滤有效数据
    .slice(0, 30) // 限制返回数量
    .map((ipo: any) => ({
      symbol: ipo.symbol,
      name: ipo.name || ipo.symbol,
      ipoDate: ipo.ipoDate,
      priceRangeLow: ipo.priceRangeLow ? parseFloat(ipo.priceRangeLow) : null,
      priceRangeHigh: ipo.priceRangeHigh ? parseFloat(ipo.priceRangeHigh) : null,
      currency: ipo.currency || 'USD',
      exchange: ipo.exchange
    }));

  // 按日期分组
  const groupedByDate = groupIPOsByDate(formattedIPOs);
  
  // 获取即将到来的IPO
  const upcomingIPOs = getUpcomingIPOs(formattedIPOs);

  return {
    type: 'ipo_calendar',
    query: originalQuery,
    ipos: formattedIPOs,
    groupedByDate,
    upcomingIPOs,
    totalEvents: formattedIPOs.length,
    summary: generateIPOSummary(formattedIPOs, upcomingIPOs, originalQuery)
  };
}

/**
 * 按日期分组财报数据
 */
function groupEarningsByDate(earnings: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  earnings.forEach(earning => {
    const date = earning.reportDate;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(earning);
  });

  return grouped;
}

/**
 * 按日期分组IPO数据
 */
function groupIPOsByDate(ipos: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  
  ipos.forEach(ipo => {
    const date = ipo.ipoDate;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(ipo);
  });

  return grouped;
}

/**
 * 获取即将到来的财报
 */
function getUpcomingEarnings(earnings: any[]): any[] {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return earnings
    .filter(earning => {
      const reportDate = new Date(earning.reportDate);
      return reportDate >= today && reportDate <= nextWeek;
    })
    .sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime())
    .slice(0, 10);
}

/**
 * 获取即将到来的IPO
 */
function getUpcomingIPOs(ipos: any[]): any[] {
  const today = new Date();
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return ipos
    .filter(ipo => {
      const ipoDate = new Date(ipo.ipoDate);
      return ipoDate >= today && ipoDate <= nextMonth;
    })
    .sort((a, b) => new Date(a.ipoDate).getTime() - new Date(b.ipoDate).getTime())
    .slice(0, 10);
}

/**
 * 生成财报摘要
 */
function generateEarningsSummary(earnings: any[], upcomingEarnings: any[], query: string): string {
  if (earnings.length === 0) {
    return `No earnings events found for "${query}"`;
  }

  let summary = `Found ${earnings.length} earnings events. `;
  
  if (upcomingEarnings.length > 0) {
    const nextEarning = upcomingEarnings[0];
    summary += `Next upcoming: ${nextEarning.name || nextEarning.symbol} on ${nextEarning.reportDate}. `;
    
    if (upcomingEarnings.length > 1) {
      summary += `${upcomingEarnings.length} companies reporting in the next week.`;
    }
  } else {
    summary += `No earnings in the immediate future.`;
  }

  return summary;
}

/**
 * 生成IPO摘要
 */
function generateIPOSummary(ipos: any[], upcomingIPOs: any[], query: string): string {
  if (ipos.length === 0) {
    return `No IPO events found for "${query}"`;
  }

  let summary = `Found ${ipos.length} IPO events. `;
  
  if (upcomingIPOs.length > 0) {
    const nextIPO = upcomingIPOs[0];
    summary += `Next upcoming: ${nextIPO.name || nextIPO.symbol} on ${nextIPO.ipoDate}`;
    
    if (nextIPO.priceRangeLow && nextIPO.priceRangeHigh) {
      summary += ` (${nextIPO.priceRangeLow}-${nextIPO.priceRangeHigh} ${nextIPO.currency})`;
    }
    
    summary += '. ';
    
    if (upcomingIPOs.length > 1) {
      summary += `${upcomingIPOs.length} companies going public in the next month.`;
    }
  } else {
    summary += `No IPOs scheduled in the immediate future.`;
  }

  return summary;
}

/**
 * 工具注册信息
 */
export const marketCalendarSearchTool = {
  name: 'alpha_vantage_market_calendar_search',
  description: 'Search for market calendar events including earnings reports and IPO schedules using Alpha Vantage',
  category: 'financial-search',
  source: 'alphavantage.co',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for market calendar events. Examples: "earnings calendar", "upcoming earnings", "IPO calendar", "this week earnings", "next month IPO"'
      }
    },
    required: ['query']
  },
  execute: marketCalendarSearch,
  examples: [
    {
      query: "earnings calendar",
      description: "Get upcoming earnings reports calendar"
    },
    {
      query: "this week earnings",
      description: "Get earnings reports for this week"
    },
    {
      query: "IPO calendar",
      description: "Get upcoming IPO schedule"
    },
    {
      query: "upcoming IPO",
      description: "Get companies going public soon"
    },
    {
      query: "next month earnings",
      description: "Get earnings calendar for next month"
    },
    {
      query: "财报日历",
      description: "Get earnings calendar (supports Chinese queries)"
    }
  ]
};
