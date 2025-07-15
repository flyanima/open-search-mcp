import { Logger } from './logger.js';

/**
 * OpenWeather 搜索路由器 - 智能分析用户查询并路由到最佳天气搜索方法
 * 支持当前天气、预报、地理编码、空气质量等
 */

export interface WeatherRoute {
  searchType: 'current' | 'forecast' | 'geocoding' | 'reverse_geocoding' | 'air_pollution' | 'coordinates';
  query: string;
  originalQuery: string;
  location?: string;
  lat?: number;
  lon?: number;
  units?: 'metric' | 'imperial' | 'kelvin';
  lang?: string;
  days?: number;
  confidence: number;
  reasoning: string;
  suggestions?: string[];
}

export class OpenWeatherRouter {
  private logger: Logger;

  // 搜索类型关键词映射
  private readonly SEARCH_TYPE_KEYWORDS = {
    forecast: ['forecast', 'tomorrow', 'week', 'days', 'future', '预报', '明天', '未来', '周', '天'],
    geocoding: ['location', 'coordinates', 'where is', 'find', '位置', '坐标', '在哪里'],
    air_pollution: ['air quality', 'pollution', 'aqi', 'pm2.5', 'pm10', '空气质量', '污染'],
    current: ['now', 'current', 'today', 'weather', '现在', '当前', '今天', '天气']
  };

  // 单位关键词映射
  private readonly UNIT_KEYWORDS = {
    metric: ['celsius', 'metric', 'c', '摄氏度', '公制'],
    imperial: ['fahrenheit', 'imperial', 'f', '华氏度', '英制'],
    kelvin: ['kelvin', 'k', '开尔文']
  };

  // 语言关键词映射
  private readonly LANGUAGE_KEYWORDS = {
    'zh_cn': ['chinese', 'china', '中文', '简体', '中国'],
    'zh_tw': ['traditional', 'taiwan', '繁体', '台湾'],
    'ja': ['japanese', 'japan', '日语', '日本'],
    'ko': ['korean', 'korea', '韩语', '韩国'],
    'es': ['spanish', 'spain', '西班牙语'],
    'fr': ['french', 'france', '法语', '法国'],
    'de': ['german', 'germany', '德语', '德国'],
    'en': ['english', 'english', '英语']
  };

  // 常见城市和地区
  private readonly MAJOR_CITIES = {
    'beijing': ['beijing', 'peking', '北京'],
    'shanghai': ['shanghai', '上海'],
    'guangzhou': ['guangzhou', 'canton', '广州'],
    'shenzhen': ['shenzhen', '深圳'],
    'tokyo': ['tokyo', '东京'],
    'seoul': ['seoul', '首尔'],
    'london': ['london', '伦敦'],
    'paris': ['paris', '巴黎'],
    'new york': ['new york', 'nyc', '纽约'],
    'los angeles': ['los angeles', 'la', '洛杉矶'],
    'chicago': ['chicago', '芝加哥'],
    'sydney': ['sydney', '悉尼'],
    'melbourne': ['melbourne', '墨尔本']
  };

  constructor() {
    this.logger = new Logger('OpenWeatherRouter');
  }

  /**
   * 根据用户搜索内容智能路由
   */
  routeSearch(query: string): WeatherRoute {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 1. 检查坐标搜索
    const coordRoute = this.checkCoordinateSearch(normalizedQuery, query);
    if (coordRoute) return coordRoute;
    
    // 2. 检查空气质量搜索
    const airRoute = this.checkAirPollutionSearch(normalizedQuery, query);
    if (airRoute) return airRoute;
    
    // 3. 检查预报搜索
    const forecastRoute = this.checkForecastSearch(normalizedQuery, query);
    if (forecastRoute) return forecastRoute;
    
    // 4. 检查地理编码搜索
    const geoRoute = this.checkGeocodingSearch(normalizedQuery, query);
    if (geoRoute) return geoRoute;
    
    // 5. 默认：当前天气搜索
    return this.createCurrentWeatherRoute(query, normalizedQuery);
  }

  /**
   * 检查坐标搜索
   */
  private checkCoordinateSearch(normalizedQuery: string, originalQuery: string): WeatherRoute | null {
    // 检查坐标格式：lat,lon 或 lat lon
    const coordMatch = normalizedQuery.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      
      // 验证坐标范围
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const isForecast = this.containsForecastKeywords(normalizedQuery);
        
        return {
          searchType: 'coordinates',
          query: originalQuery,
          originalQuery,
          lat,
          lon,
          units: this.detectUnits(normalizedQuery),
          lang: this.detectLanguage(normalizedQuery),
          confidence: 0.95,
          reasoning: `Detected coordinate search: ${lat}, ${lon}${isForecast ? ' with forecast' : ''}`,
          suggestions: [
            'Coordinates detected automatically',
            'Use forecast keywords for weather predictions',
            'Specify units (celsius/fahrenheit) for temperature'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查空气质量搜索
   */
  private checkAirPollutionSearch(normalizedQuery: string, originalQuery: string): WeatherRoute | null {
    const airKeywords = this.SEARCH_TYPE_KEYWORDS.air_pollution;
    
    for (const keyword of airKeywords) {
      if (normalizedQuery.includes(keyword)) {
        const location = this.extractLocation(normalizedQuery, [keyword]);
        
        return {
          searchType: 'air_pollution',
          query: originalQuery,
          originalQuery,
          location: location || normalizedQuery,
          units: this.detectUnits(normalizedQuery),
          lang: this.detectLanguage(normalizedQuery),
          confidence: 0.9,
          reasoning: `Detected air pollution search keyword: ${keyword}`,
          suggestions: [
            'Air quality data includes PM2.5, PM10, CO, NO2, SO2, O3',
            'Specify location for accurate air quality data',
            'Use coordinates for precise location'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查预报搜索
   */
  private checkForecastSearch(normalizedQuery: string, originalQuery: string): WeatherRoute | null {
    const forecastKeywords = this.SEARCH_TYPE_KEYWORDS.forecast;
    
    for (const keyword of forecastKeywords) {
      if (normalizedQuery.includes(keyword)) {
        const location = this.extractLocation(normalizedQuery, [keyword]);
        const days = this.extractDays(normalizedQuery);
        
        return {
          searchType: 'forecast',
          query: originalQuery,
          originalQuery,
          location: location || this.detectMajorCity(normalizedQuery) || 'London',
          units: this.detectUnits(normalizedQuery),
          lang: this.detectLanguage(normalizedQuery),
          days,
          confidence: 0.85,
          reasoning: `Detected forecast search keyword: ${keyword}`,
          suggestions: [
            'Forecast provides 5-day weather predictions',
            'Specify city name for accurate forecasts',
            'Use "tomorrow" for next day weather',
            'Add units preference (celsius/fahrenheit)'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 检查地理编码搜索
   */
  private checkGeocodingSearch(normalizedQuery: string, originalQuery: string): WeatherRoute | null {
    const geoKeywords = this.SEARCH_TYPE_KEYWORDS.geocoding;
    
    for (const keyword of geoKeywords) {
      if (normalizedQuery.includes(keyword)) {
        const location = this.extractLocation(normalizedQuery, [keyword]);
        
        return {
          searchType: 'geocoding',
          query: originalQuery,
          originalQuery,
          location: location || normalizedQuery,
          units: this.detectUnits(normalizedQuery),
          lang: this.detectLanguage(normalizedQuery),
          confidence: 0.8,
          reasoning: `Detected geocoding search keyword: ${keyword}`,
          suggestions: [
            'Geocoding finds coordinates for locations',
            'Use specific city names for better results',
            'Include country for disambiguation',
            'Try "reverse geocoding" for coordinate-to-address lookup'
          ]
        };
      }
    }
    
    return null;
  }

  /**
   * 创建当前天气搜索路由
   */
  private createCurrentWeatherRoute(originalQuery: string, normalizedQuery: string): WeatherRoute {
    const location = this.detectMajorCity(normalizedQuery) || normalizedQuery;
    const units = this.detectUnits(normalizedQuery);
    const lang = this.detectLanguage(normalizedQuery);
    
    return {
      searchType: 'current',
      query: originalQuery,
      originalQuery,
      location,
      units,
      lang,
      confidence: 0.7,
      reasoning: 'Default current weather search with location detection',
      suggestions: this.generateCurrentWeatherSuggestions(normalizedQuery)
    };
  }

  /**
   * 检查是否包含预报关键词
   */
  private containsForecastKeywords(query: string): boolean {
    const forecastKeywords = this.SEARCH_TYPE_KEYWORDS.forecast;
    return forecastKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * 提取位置信息
   */
  private extractLocation(query: string, excludeKeywords: string[]): string {
    let cleanQuery = query;
    
    // 移除搜索类型关键词
    excludeKeywords.forEach(keyword => {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '');
    });
    
    // 移除单位和语言关键词
    Object.values(this.UNIT_KEYWORDS).flat().forEach(keyword => {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '');
    });
    
    Object.values(this.LANGUAGE_KEYWORDS).flat().forEach(keyword => {
      cleanQuery = cleanQuery.replace(new RegExp(`\\b${keyword}\\b`, 'g'), '');
    });
    
    return cleanQuery.trim();
  }

  /**
   * 提取天数
   */
  private extractDays(query: string): number {
    const daysMatch = query.match(/(\d+)\s*(days?|天)/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      return Math.min(Math.max(days, 1), 5); // 限制在1-5天
    }
    
    if (query.includes('tomorrow') || query.includes('明天')) return 1;
    if (query.includes('week') || query.includes('周')) return 7;
    
    return 5; // 默认5天
  }

  /**
   * 检测单位偏好
   */
  private detectUnits(query: string): 'metric' | 'imperial' | 'kelvin' {
    for (const [unit, keywords] of Object.entries(this.UNIT_KEYWORDS)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return unit as 'metric' | 'imperial' | 'kelvin';
      }
    }
    
    return 'metric'; // 默认公制
  }

  /**
   * 检测语言偏好
   */
  private detectLanguage(query: string): string {
    for (const [lang, keywords] of Object.entries(this.LANGUAGE_KEYWORDS)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return lang;
      }
    }
    
    // 检测中文字符
    if (/[\u4e00-\u9fff]/.test(query)) {
      return 'zh_cn';
    }
    
    return 'en'; // 默认英语
  }

  /**
   * 检测主要城市
   */
  private detectMajorCity(query: string): string | null {
    for (const [city, aliases] of Object.entries(this.MAJOR_CITIES)) {
      if (aliases.some(alias => query.includes(alias))) {
        return city;
      }
    }
    
    return null;
  }

  /**
   * 生成当前天气搜索建议
   */
  private generateCurrentWeatherSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    if (query.length < 3) {
      suggestions.push('Try using specific city names');
    }
    
    if (!this.detectMajorCity(query)) {
      suggestions.push('Include country name for better location accuracy');
    }
    
    suggestions.push(
      'Use "forecast" for weather predictions',
      'Add "celsius" or "fahrenheit" for temperature units',
      'Try coordinates (lat,lon) for precise location',
      'Use "air quality" for pollution data'
    );
    
    return suggestions.slice(0, 4);
  }

  /**
   * 验证查询
   */
  validateQuery(query: string): { valid: boolean; message?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, message: 'Query cannot be empty' };
    }
    
    if (query.length > 200) {
      return { valid: false, message: 'Query too long (max 200 characters)' };
    }
    
    return { valid: true };
  }

  /**
   * 获取推荐的搜索类型
   */
  getRecommendedSearchTypes(): Record<string, string[]> {
    return {
      current: ['Current weather conditions', 'Real-time temperature and conditions', 'Today\'s weather'],
      forecast: ['5-day weather forecast', 'Tomorrow\'s weather', 'Weekly weather predictions'],
      geocoding: ['Find location coordinates', 'City location lookup', 'Address to coordinates'],
      air_pollution: ['Air quality index', 'Pollution levels', 'PM2.5 and PM10 data'],
      coordinates: ['Weather by coordinates', 'Precise location weather', 'GPS-based weather']
    };
  }

  /**
   * 获取搜索统计
   */
  getSearchStats(): any {
    return {
      supportedSearchTypes: Object.keys(this.SEARCH_TYPE_KEYWORDS).concat(['coordinates']),
      supportedUnits: Object.keys(this.UNIT_KEYWORDS).length,
      supportedLanguages: Object.keys(this.LANGUAGE_KEYWORDS).length,
      majorCities: Object.keys(this.MAJOR_CITIES).length,
      features: [
        'Intelligent query routing',
        'Multi-language detection',
        'Unit preference detection',
        'Coordinate parsing',
        'Major city recognition',
        'Forecast period extraction'
      ]
    };
  }
}
