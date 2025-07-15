import { OpenWeatherClient } from '../../api/clients/openweather-client.js';
import { OpenWeatherRouter } from '../../utils/openweather-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * OpenWeather 天气预报搜索工具
 * 专门用于获取5天天气预报和未来天气趋势
 */

const logger = new Logger('OpenWeatherForecastSearch');

export async function openweatherForecastSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new OpenWeatherClient();
    const router = new OpenWeatherRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing OpenWeather forecast search: ${args.query}`);

    const units = args.units || 'metric';
    const lang = args.lang || 'en';
    const days = args.days || 5;
    const result = await handleForecastRequest(client, router, args.query, units, lang, days);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'openweather_forecast_search',
        result,
        source: 'OpenWeather',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('OpenWeather forecast search failed:', error);
    return {
      success: false,
      error: `OpenWeather forecast search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理天气预报请求
 */
async function handleForecastRequest(client: OpenWeatherClient, router: OpenWeatherRouter, query: string, units: string, lang: string, days: number): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let forecastResult;
    
    switch (route.searchType) {
      case 'coordinates':
        forecastResult = await client.getForecastByCoords(route.lat!, route.lon!, { 
          units: route.units || units as any,
          lang: route.lang || lang,
          cnt: Math.min(days * 8, 40) // 每天8个数据点，最多40个
        });
        break;
        
      case 'geocoding':
        // 先进行地理编码，然后获取预报
        const geoResults = await client.geocoding(route.location!, 1);
        if (geoResults.length > 0) {
          const location = geoResults[0];
          forecastResult = await client.getForecastByCoords(location.lat, location.lon, {
            units: route.units || units as any,
            lang: route.lang || lang,
            cnt: Math.min(days * 8, 40)
          });
          (forecastResult as any).geocoding = location;
        } else {
          throw new Error(`Location not found: ${route.location}`);
        }
        break;
        
      default: // 'forecast' or 'current'
        forecastResult = await client.getForecast(route.location!, { 
          units: route.units || units as any,
          lang: route.lang || lang,
          cnt: Math.min(days * 8, 40)
        });
        break;
    }
    
    if (!forecastResult || !forecastResult.list) {
      return {
        type: 'openweather_forecast_search',
        query,
        forecast: null,
        message: `No forecast data found for "${query}"`,
        suggestions: generateForecastSearchSuggestions(query, route)
      };
    }

    // 增强预报结果
    const enhancedForecast = {
      ...forecastResult,
      
      // 按天分组预报数据
      dailyForecasts: groupForecastByDay(forecastResult.list),
      
      // 天气趋势分析
      weatherTrends: analyzeWeatherTrends(forecastResult.list),
      
      // 极值分析
      extremeValues: analyzeExtremeValues(forecastResult.list),
      
      // 活动规划建议
      activityPlanning: generateActivityPlanning(forecastResult.list),
      
      // 预报质量评估
      forecastQuality: assessForecastQuality(forecastResult.list),
      
      // 格式化显示信息
      displayInfo: formatForecastDisplayInfo(forecastResult)
    };

    // 分析预报结果
    const resultAnalysis = analyzeForecastResults(enhancedForecast);

    return {
      type: 'openweather_forecast_search',
      query,
      forecast: enhancedForecast,
      route,
      analysis: resultAnalysis,
      summary: generateForecastSummary(enhancedForecast, query, route, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 按天分组预报数据
 */
function groupForecastByDay(forecastList: any[]): any[] {
  const dailyGroups: Record<string, any[]> = {};
  
  forecastList.forEach(item => {
    const date = item.dt_txt.split(' ')[0]; // 获取日期部分
    if (!dailyGroups[date]) {
      dailyGroups[date] = [];
    }
    dailyGroups[date].push(item);
  });
  
  return Object.entries(dailyGroups).map(([date, items]) => {
    const temps = items.map(item => item.main.temp);
    const conditions = items.map(item => item.weather[0].main);
    const precipitations = items.map(item => item.pop);
    
    return {
      date,
      items,
      summary: {
        minTemp: Math.min(...temps),
        maxTemp: Math.max(...temps),
        avgTemp: temps.reduce((sum, temp) => sum + temp, 0) / temps.length,
        dominantCondition: getMostFrequent(conditions),
        maxPrecipitation: Math.max(...precipitations),
        avgPrecipitation: precipitations.reduce((sum, pop) => sum + pop, 0) / precipitations.length
      }
    };
  });
}

/**
 * 分析天气趋势
 */
function analyzeWeatherTrends(forecastList: any[]): any {
  const temps = forecastList.map(item => item.main.temp);
  const humidity = forecastList.map(item => item.main.humidity);
  const pressure = forecastList.map(item => item.main.pressure);
  const windSpeed = forecastList.map(item => item.wind.speed);
  
  return {
    temperature: {
      trend: calculateTrend(temps),
      change: temps[temps.length - 1] - temps[0],
      volatility: calculateVolatility(temps)
    },
    humidity: {
      trend: calculateTrend(humidity),
      change: humidity[humidity.length - 1] - humidity[0],
      average: humidity.reduce((sum, h) => sum + h, 0) / humidity.length
    },
    pressure: {
      trend: calculateTrend(pressure),
      change: pressure[pressure.length - 1] - pressure[0],
      stability: calculateStability(pressure)
    },
    wind: {
      trend: calculateTrend(windSpeed),
      change: windSpeed[windSpeed.length - 1] - windSpeed[0],
      average: windSpeed.reduce((sum, w) => sum + w, 0) / windSpeed.length
    }
  };
}

/**
 * 分析极值
 */
function analyzeExtremeValues(forecastList: any[]): any {
  const temps = forecastList.map(item => item.main.temp);
  const windSpeeds = forecastList.map(item => item.wind.speed);
  const precipitations = forecastList.map(item => item.pop);
  
  const minTempItem = forecastList[temps.indexOf(Math.min(...temps))];
  const maxTempItem = forecastList[temps.indexOf(Math.max(...temps))];
  const maxWindItem = forecastList[windSpeeds.indexOf(Math.max(...windSpeeds))];
  const maxPrecipItem = forecastList[precipitations.indexOf(Math.max(...precipitations))];
  
  return {
    temperature: {
      min: {
        value: Math.min(...temps),
        time: minTempItem.dt_txt,
        conditions: minTempItem.weather[0].description
      },
      max: {
        value: Math.max(...temps),
        time: maxTempItem.dt_txt,
        conditions: maxTempItem.weather[0].description
      }
    },
    wind: {
      max: {
        value: Math.max(...windSpeeds),
        time: maxWindItem.dt_txt,
        direction: maxWindItem.wind.deg
      }
    },
    precipitation: {
      max: {
        value: Math.max(...precipitations),
        time: maxPrecipItem.dt_txt,
        conditions: maxPrecipItem.weather[0].description
      }
    }
  };
}

/**
 * 生成活动规划建议
 */
function generateActivityPlanning(forecastList: any[]): any {
  const dailyForecasts = groupForecastByDay(forecastList);
  
  return dailyForecasts.map(day => {
    const { minTemp, maxTemp, dominantCondition, maxPrecipitation } = day.summary;
    const suggestions: string[] = [];
    
    // 基于温度的建议
    if (maxTemp >= 25) {
      suggestions.push('Great day for outdoor activities and water sports');
    } else if (maxTemp >= 18) {
      suggestions.push('Perfect for hiking, cycling, and outdoor sports');
    } else if (maxTemp >= 10) {
      suggestions.push('Good for outdoor activities with warm clothing');
    } else {
      suggestions.push('Consider indoor activities or winter sports');
    }
    
    // 基于天气条件的建议
    if (dominantCondition === 'Clear') {
      suggestions.push('Excellent visibility for photography and sightseeing');
    } else if (dominantCondition === 'Rain') {
      suggestions.push('Plan indoor activities or bring rain gear');
    } else if (dominantCondition === 'Snow') {
      suggestions.push('Perfect for winter activities and sports');
    }
    
    // 基于降水概率的建议
    if (maxPrecipitation > 0.7) {
      suggestions.push('High chance of precipitation - plan accordingly');
    } else if (maxPrecipitation > 0.3) {
      suggestions.push('Possible precipitation - have backup plans');
    }
    
    return {
      date: day.date,
      suitability: calculateDaySuitability(day.summary),
      suggestions: suggestions.slice(0, 3)
    };
  });
}

/**
 * 评估预报质量
 */
function assessForecastQuality(forecastList: any[]): any {
  let qualityScore = 70; // 基础分数
  
  // 数据完整性
  const dataCompleteness = forecastList.length / 40; // 期望40个数据点
  qualityScore += dataCompleteness * 15;
  
  // 时间覆盖
  const timeSpan = forecastList.length > 0 ? 
    (new Date(forecastList[forecastList.length - 1].dt * 1000).getTime() - 
     new Date(forecastList[0].dt * 1000).getTime()) / (1000 * 60 * 60 * 24) : 0;
  
  if (timeSpan >= 5) qualityScore += 10;
  else if (timeSpan >= 3) qualityScore += 5;
  
  // 数据一致性
  const tempVariations = forecastList.map(item => item.main.temp);
  const tempStability = calculateStability(tempVariations);
  if (tempStability > 0.8) qualityScore += 5;
  
  return {
    score: Math.max(0, Math.min(100, qualityScore)),
    level: qualityScore >= 85 ? 'Excellent' : 
           qualityScore >= 70 ? 'Good' : 
           qualityScore >= 55 ? 'Fair' : 'Poor',
    dataPoints: forecastList.length,
    timeSpan: Math.round(timeSpan * 10) / 10,
    completeness: Math.round(dataCompleteness * 100)
  };
}

/**
 * 格式化预报显示信息
 */
function formatForecastDisplayInfo(forecast: any): any {
  return {
    location: `${forecast.city.name}, ${forecast.city.country}`,
    coordinates: `${forecast.city.coord.lat}, ${forecast.city.coord.lon}`,
    timezone: forecast.city.timezone,
    dataPoints: forecast.cnt,
    forecastPeriod: `${Math.round(forecast.cnt / 8)} days`,
    updateTime: new Date().toISOString()
  };
}

/**
 * 分析预报结果
 */
function analyzeForecastResults(forecast: any): any {
  return {
    location: forecast.city.name,
    country: forecast.city.country,
    forecastQuality: forecast.forecastQuality,
    weatherTrends: forecast.weatherTrends,
    extremeValues: forecast.extremeValues,
    dailyCount: forecast.dailyForecasts.length,
    totalDataPoints: forecast.list.length
  };
}

/**
 * 辅助函数
 */
function getMostFrequent(arr: string[]): string {
  const frequency: Record<string, number> = {};
  arr.forEach(item => {
    frequency[item] = (frequency[item] || 0) + 1;
  });
  
  return Object.entries(frequency).reduce((a, b) => 
    frequency[a[0]] > frequency[b[0]] ? a : b
  )[0];
}

function calculateTrend(values: number[]): string {
  if (values.length < 2) return 'stable';
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  const change = secondAvg - firstAvg;
  
  if (Math.abs(change) < 0.1) return 'stable';
  return change > 0 ? 'increasing' : 'decreasing';
}

function calculateVolatility(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateStability(values: number[]): number {
  const volatility = calculateVolatility(values);
  const range = Math.max(...values) - Math.min(...values);
  return range > 0 ? 1 - (volatility / range) : 1;
}

function calculateDaySuitability(summary: any): string {
  let score = 50;
  
  // 温度舒适度
  if (summary.maxTemp >= 18 && summary.maxTemp <= 26) score += 25;
  else if (summary.maxTemp >= 15 && summary.maxTemp <= 30) score += 15;
  
  // 降水影响
  if (summary.maxPrecipitation < 0.2) score += 20;
  else if (summary.maxPrecipitation < 0.5) score += 10;
  else score -= 15;
  
  // 天气条件
  if (summary.dominantCondition === 'Clear') score += 15;
  else if (summary.dominantCondition === 'Clouds') score += 5;
  else if (summary.dominantCondition === 'Rain') score -= 10;
  
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

/**
 * 生成搜索建议
 */
function generateForecastSearchSuggestions(query: string, route: any): string[] {
  return [
    'Try specific city names for accurate forecasts',
    'Use coordinates (lat,lon) for precise location',
    'Specify number of days (1-5) for forecast period',
    'Add temperature units preference (celsius/fahrenheit)'
  ];
}

/**
 * 生成预报摘要
 */
function generateForecastSummary(forecast: any, query: string, route: any, analysis: any): string {
  const location = forecast.city.name;
  const days = forecast.dailyForecasts.length;
  const tempTrend = forecast.weatherTrends.temperature.trend;
  const qualityLevel = forecast.forecastQuality.level;
  
  return `${days}-day forecast for ${location}: Temperature ${tempTrend}, forecast quality: ${qualityLevel}. ${forecast.dailyForecasts.length} days of detailed predictions available.`;
}

/**
 * 工具注册信息
 */
export const openweatherForecastSearchTool = {
  name: 'openweather_forecast_search',
  description: 'Get 5-day weather forecast with trend analysis and activity planning using OpenWeather API',
  category: 'weather-search',
  source: 'openweathermap.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Location query for weather forecast. Examples: "London forecast", "New York 3 days", "Beijing weather next week", "40.7128,-74.0060 forecast"'
      },
      units: {
        type: 'string',
        description: 'Temperature units (default: metric)',
        enum: ['metric', 'imperial', 'kelvin'],
        default: 'metric'
      },
      lang: {
        type: 'string',
        description: 'Language for weather descriptions (default: en)',
        default: 'en'
      },
      days: {
        type: 'number',
        description: 'Number of forecast days (default: 5, max: 5)',
        default: 5,
        minimum: 1,
        maximum: 5
      }
    },
    required: ['query']
  },
  execute: openweatherForecastSearch,
  examples: [
    {
      query: "London forecast",
      description: "5-day weather forecast for London"
    },
    {
      query: "New York 3 days",
      description: "3-day weather forecast for New York"
    },
    {
      query: "Beijing weather next week",
      description: "Weekly weather forecast for Beijing"
    },
    {
      query: "40.7128,-74.0060 forecast",
      description: "Forecast for specific coordinates"
    },
    {
      query: "Paris tomorrow weather",
      description: "Tomorrow's weather forecast for Paris"
    }
  ]
};
