import { OpenWeatherClient } from '../../api/clients/openweather-client.js';
import { OpenWeatherRouter } from '../../utils/openweather-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * OpenWeather 当前天气搜索工具
 * 专门用于获取实时天气条件和当前气象数据
 */

const logger = new Logger('OpenWeatherCurrentSearch');

export async function openweatherCurrentSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing OpenWeather current weather search: ${args.query}`);

    const units = args.units || 'metric';
    const lang = args.lang || 'en';
    const result = await handleCurrentWeatherRequest(client, router, args.query, units, lang);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'openweather_current_search',
        result,
        source: 'OpenWeather',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('OpenWeather current weather search failed:', error);
    return {
      success: false,
      error: `OpenWeather current weather search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理当前天气搜索请求
 */
async function handleCurrentWeatherRequest(client: OpenWeatherClient, router: OpenWeatherRouter, query: string, units: string, lang: string): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let weatherResult;
    
    switch (route.searchType) {
      case 'coordinates':
        weatherResult = await client.getCurrentWeatherByCoords(route.lat!, route.lon!, { 
          units: route.units || units as any,
          lang: route.lang || lang
        });
        break;
        
      case 'geocoding':
        // 先进行地理编码，然后获取天气
        const geoResults = await client.geocoding(route.location!, 1);
        if (geoResults.length > 0) {
          const location = geoResults[0];
          weatherResult = await client.getCurrentWeatherByCoords(location.lat, location.lon, {
            units: route.units || units as any,
            lang: route.lang || lang
          });
          (weatherResult as any).geocoding = location;
        } else {
          throw new Error(`Location not found: ${route.location}`);
        }
        break;
        
      default: // 'current'
        weatherResult = await client.getCurrentWeather(route.location!, { 
          units: route.units || units as any,
          lang: route.lang || lang
        });
        break;
    }
    
    if (!weatherResult) {
      return {
        type: 'openweather_current_search',
        query,
        weather: null,
        message: `No weather data found for "${query}"`,
        suggestions: generateWeatherSearchSuggestions(query, route)
      };
    }

    // 增强天气结果
    const enhancedWeather = {
      ...weatherResult,
      
      // 天气质量评估
      weatherQuality: assessWeatherQuality(weatherResult),
      
      // 舒适度分析
      comfortLevel: analyzeComfortLevel(weatherResult),
      
      // 活动建议
      activitySuggestions: generateActivitySuggestions(weatherResult),
      
      // 健康指数
      healthIndex: calculateHealthIndex(weatherResult),
      
      // 时间信息
      timeInfo: formatTimeInfo(weatherResult),
      
      // 格式化显示信息
      displayInfo: formatWeatherDisplayInfo(weatherResult)
    };

    // 分析天气结果
    const resultAnalysis = analyzeWeatherResults(enhancedWeather);

    return {
      type: 'openweather_current_search',
      query,
      weather: enhancedWeather,
      route,
      analysis: resultAnalysis,
      summary: generateCurrentWeatherSummary(enhancedWeather, query, route, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 评估天气质量
 */
function assessWeatherQuality(weather: any): any {
  let score = 50; // 基础分数
  
  // 温度舒适度
  const temp = weather.main.temp;
  if (temp >= 18 && temp <= 26) score += 20;
  else if (temp >= 15 && temp <= 30) score += 10;
  else if (temp < 0 || temp > 35) score -= 20;
  
  // 湿度舒适度
  const humidity = weather.main.humidity;
  if (humidity >= 40 && humidity <= 60) score += 15;
  else if (humidity >= 30 && humidity <= 70) score += 5;
  else if (humidity < 20 || humidity > 80) score -= 15;
  
  // 风速影响
  const windSpeed = weather.wind.speed;
  if (windSpeed <= 3) score += 10;
  else if (windSpeed <= 7) score += 5;
  else if (windSpeed > 15) score -= 15;
  
  // 天气条件
  const weatherMain = weather.weather[0].main.toLowerCase();
  if (weatherMain === 'clear') score += 15;
  else if (weatherMain === 'clouds') score += 5;
  else if (weatherMain === 'rain') score -= 10;
  else if (weatherMain === 'snow') score -= 5;
  else if (weatherMain === 'thunderstorm') score -= 20;
  
  // 能见度
  if (weather.visibility >= 10000) score += 10;
  else if (weather.visibility < 1000) score -= 15;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    level: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'
  };
}

/**
 * 分析舒适度
 */
function analyzeComfortLevel(weather: any): any {
  const temp = weather.main.temp;
  const feelsLike = weather.main.feels_like;
  const humidity = weather.main.humidity;
  const windSpeed = weather.wind.speed;
  
  let comfortScore = 50;
  
  // 体感温度舒适度
  if (Math.abs(temp - feelsLike) <= 2) comfortScore += 15;
  else if (Math.abs(temp - feelsLike) > 5) comfortScore -= 10;
  
  // 温湿度综合舒适度
  if (temp >= 20 && temp <= 24 && humidity >= 40 && humidity <= 60) comfortScore += 20;
  else if (temp >= 18 && temp <= 26 && humidity >= 30 && humidity <= 70) comfortScore += 10;
  
  // 风感舒适度
  if (windSpeed >= 1 && windSpeed <= 5) comfortScore += 10;
  else if (windSpeed > 10) comfortScore -= 15;
  
  return {
    score: Math.max(0, Math.min(100, comfortScore)),
    level: comfortScore >= 80 ? 'Very Comfortable' : 
           comfortScore >= 60 ? 'Comfortable' : 
           comfortScore >= 40 ? 'Moderate' : 'Uncomfortable',
    factors: {
      temperature: temp,
      feelsLike: feelsLike,
      humidity: humidity,
      windSpeed: windSpeed
    }
  };
}

/**
 * 生成活动建议
 */
function generateActivitySuggestions(weather: any): string[] {
  const suggestions: string[] = [];
  const temp = weather.main.temp;
  const weatherMain = weather.weather[0].main.toLowerCase();
  const windSpeed = weather.wind.speed;
  
  // 基于温度的建议
  if (temp >= 25) {
    suggestions.push('Great for swimming and water activities');
    suggestions.push('Stay hydrated and seek shade during peak hours');
  } else if (temp >= 18) {
    suggestions.push('Perfect for outdoor activities and sports');
    suggestions.push('Ideal for walking, cycling, or picnics');
  } else if (temp >= 10) {
    suggestions.push('Good for hiking with appropriate clothing');
    suggestions.push('Consider indoor activities or dress warmly');
  } else {
    suggestions.push('Bundle up for outdoor activities');
    suggestions.push('Great for indoor activities and cozy settings');
  }
  
  // 基于天气条件的建议
  if (weatherMain === 'clear') {
    suggestions.push('Excellent visibility for photography and sightseeing');
  } else if (weatherMain === 'rain') {
    suggestions.push('Carry an umbrella and consider indoor activities');
  } else if (weatherMain === 'snow') {
    suggestions.push('Perfect for winter sports and activities');
  } else if (weatherMain === 'clouds') {
    suggestions.push('Good for outdoor activities without harsh sun');
  }
  
  // 基于风速的建议
  if (windSpeed > 10) {
    suggestions.push('Windy conditions - secure loose items');
  }
  
  return suggestions.slice(0, 4);
}

/**
 * 计算健康指数
 */
function calculateHealthIndex(weather: any): any {
  const temp = weather.main.temp;
  const humidity = weather.main.humidity;
  const pressure = weather.main.pressure;
  
  let healthScore = 50;
  
  // 温度对健康的影响
  if (temp >= 18 && temp <= 24) healthScore += 20;
  else if (temp < 5 || temp > 35) healthScore -= 20;
  
  // 湿度对健康的影响
  if (humidity >= 40 && humidity <= 60) healthScore += 15;
  else if (humidity < 30 || humidity > 70) healthScore -= 10;
  
  // 气压对健康的影响
  if (pressure >= 1013 && pressure <= 1020) healthScore += 10;
  else if (pressure < 1000 || pressure > 1030) healthScore -= 10;
  
  const healthLevel = healthScore >= 80 ? 'Excellent' : 
                     healthScore >= 60 ? 'Good' : 
                     healthScore >= 40 ? 'Moderate' : 'Poor';
  
  const recommendations: string[] = [];
  
  if (temp < 10) recommendations.push('Dress warmly to prevent cold-related illness');
  if (temp > 30) recommendations.push('Stay hydrated and avoid prolonged sun exposure');
  if (humidity > 70) recommendations.push('High humidity may affect those with respiratory conditions');
  if (humidity < 30) recommendations.push('Low humidity - consider using a humidifier');
  
  return {
    score: Math.max(0, Math.min(100, healthScore)),
    level: healthLevel,
    recommendations: recommendations.slice(0, 3)
  };
}

/**
 * 格式化时间信息
 */
function formatTimeInfo(weather: any): any {
  const currentTime = new Date(weather.dt * 1000);
  const sunrise = new Date(weather.sys.sunrise * 1000);
  const sunset = new Date(weather.sys.sunset * 1000);
  
  const isDaytime = currentTime >= sunrise && currentTime <= sunset;
  const timeUntilSunrise = sunrise.getTime() - currentTime.getTime();
  const timeUntilSunset = sunset.getTime() - currentTime.getTime();
  
  return {
    currentTime: currentTime.toISOString(),
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString(),
    isDaytime,
    timeUntilSunrise: timeUntilSunrise > 0 ? Math.round(timeUntilSunrise / (1000 * 60 * 60)) : null,
    timeUntilSunset: timeUntilSunset > 0 ? Math.round(timeUntilSunset / (1000 * 60 * 60)) : null,
    dayLength: Math.round((sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60 * 24) * 24)
  };
}

/**
 * 格式化天气显示信息
 */
function formatWeatherDisplayInfo(weather: any): any {
  return {
    location: `${weather.name}, ${weather.sys.country}`,
    coordinates: `${weather.coord.lat}, ${weather.coord.lon}`,
    temperature: `${Math.round(weather.main.temp)}°C`,
    feelsLike: `${Math.round(weather.main.feels_like)}°C`,
    description: weather.weather[0].description,
    humidity: `${weather.main.humidity}%`,
    pressure: `${weather.main.pressure} hPa`,
    windSpeed: `${weather.wind.speed} m/s`,
    windDirection: weather.wind.deg ? `${weather.wind.deg}°` : 'N/A',
    visibility: `${(weather.visibility / 1000).toFixed(1)} km`,
    cloudiness: `${weather.clouds.all}%`,
    icon: weather.weather[0].icon,
    timezone: weather.timezone
  };
}

/**
 * 分析天气结果
 */
function analyzeWeatherResults(weather: any): any {
  return {
    location: weather.name,
    country: weather.sys.country,
    weatherQuality: weather.weatherQuality,
    comfortLevel: weather.comfortLevel,
    healthIndex: weather.healthIndex,
    timeInfo: weather.timeInfo,
    conditions: {
      main: weather.weather[0].main,
      description: weather.weather[0].description,
      temperature: weather.main.temp,
      humidity: weather.main.humidity,
      pressure: weather.main.pressure,
      windSpeed: weather.wind.speed
    }
  };
}

/**
 * 生成搜索建议
 */
function generateWeatherSearchSuggestions(query: string, route: any): string[] {
  const suggestions: string[] = [];
  
  if (route.suggestions) {
    suggestions.push(...route.suggestions);
  }
  
  suggestions.push(
    'Try specific city names for accurate weather',
    'Use coordinates (lat,lon) for precise location',
    'Add "forecast" for weather predictions',
    'Specify units: celsius, fahrenheit, or kelvin'
  );
  
  return suggestions.slice(0, 4);
}

/**
 * 生成当前天气摘要
 */
function generateCurrentWeatherSummary(weather: any, query: string, route: any, analysis: any): string {
  const location = weather.name;
  const temp = Math.round(weather.main.temp);
  const description = weather.weather[0].description;
  const qualityLevel = weather.weatherQuality.level;
  
  return `Current weather in ${location}: ${temp}°C, ${description}. Weather quality: ${qualityLevel}. Comfort level: ${weather.comfortLevel.level}.`;
}

/**
 * 工具注册信息
 */
export const openweatherCurrentSearchTool = {
  name: 'openweather_current_search',
  description: 'Get current weather conditions with comfort analysis and activity suggestions using OpenWeather API',
  category: 'weather-search',
  source: 'openweathermap.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Location query for current weather. Examples: "London", "New York", "Beijing", "40.7128,-74.0060", "weather in Paris"'
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
      }
    },
    required: ['query']
  },
  execute: openweatherCurrentSearch,
  examples: [
    {
      query: "London",
      description: "Get current weather in London"
    },
    {
      query: "New York weather",
      description: "Current weather conditions in New York"
    },
    {
      query: "40.7128,-74.0060",
      description: "Weather at specific coordinates (NYC)"
    },
    {
      query: "Beijing celsius",
      description: "Beijing weather in Celsius"
    },
    {
      query: "Paris current conditions",
      description: "Current weather conditions in Paris"
    }
  ]
};
