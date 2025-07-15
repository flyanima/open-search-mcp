import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * OpenWeather API 客户端 - 专注于天气数据和位置服务
 * 支持当前天气、天气预报、历史数据、地理编码等功能
 */

interface WeatherOptions {
  units?: 'metric' | 'imperial' | 'kelvin';
  lang?: string;
  cnt?: number;
  dt?: number;
  start?: number;
  end?: number;
}

interface CurrentWeather {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
  dt: number;
  sys: {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

interface ForecastWeather {
  cod: string;
  message: number;
  cnt: number;
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      sea_level: number;
      grnd_level: number;
      humidity: number;
      temp_kf: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    clouds: {
      all: number;
    };
    wind: {
      speed: number;
      deg: number;
      gust?: number;
    };
    visibility: number;
    pop: number;
    rain?: {
      '3h': number;
    };
    snow?: {
      '3h': number;
    };
    sys: {
      pod: string;
    };
    dt_txt: string;
  }>;
  city: {
    id: number;
    name: string;
    coord: {
      lat: number;
      lon: number;
    };
    country: string;
    population: number;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

interface GeoLocation {
  name: string;
  local_names?: Record<string, string>;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export class OpenWeatherClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 1000; // 1秒延迟，OpenWeather API有速率限制
  private readonly API_KEY: string;

  constructor() {
    this.logger = new Logger('OpenWeather');
    
    // 使用环境变量或默认的免费API密钥
    this.API_KEY = process.env.OPENWEATHER_API_KEY || '';
    
    this.httpClient = axios.create({
      baseURL: 'https://api.openweathermap.org',
      timeout: 30000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0'
      }
    });

    // 添加响应拦截器处理错误
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          this.logger.warn('Rate limit exceeded for OpenWeather API');
        } else if (error.response?.status === 401) {
          this.logger.warn('Invalid API key for OpenWeather API');
        } else if (error.response?.status === 404) {
          this.logger.warn('Location not found in OpenWeather API');
        }
        throw error;
      }
    );
  }

  /**
   * 通用API请求方法（带速率限制）
   */
  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    // 实施速率限制
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    try {
      const requestParams = {
        appid: this.API_KEY,
        units: 'metric', // 默认使用摄氏度
        ...params
      };
      
      const response = await this.httpClient.get(endpoint, { params: requestParams });
      
      return response.data;
    } catch (error) {
      this.logger.error('OpenWeather API request failed:', error);
      throw error;
    }
  }

  /**
   * 获取当前天气
   */
  async getCurrentWeather(location: string, options: WeatherOptions = {}): Promise<CurrentWeather> {
    this.logger.info(`Getting current weather for: ${location}`);
    
    const params = {
      q: location,
      units: options.units || 'metric',
      lang: options.lang || 'en'
    };
    
    return await this.makeRequest('/data/2.5/weather', params);
  }

  /**
   * 通过坐标获取当前天气
   */
  async getCurrentWeatherByCoords(lat: number, lon: number, options: WeatherOptions = {}): Promise<CurrentWeather> {
    this.logger.info(`Getting current weather for coordinates: ${lat}, ${lon}`);
    
    const params = {
      lat,
      lon,
      units: options.units || 'metric',
      lang: options.lang || 'en'
    };
    
    return await this.makeRequest('/data/2.5/weather', params);
  }

  /**
   * 获取5天天气预报
   */
  async getForecast(location: string, options: WeatherOptions = {}): Promise<ForecastWeather> {
    this.logger.info(`Getting forecast for: ${location}`);
    
    const params = {
      q: location,
      units: options.units || 'metric',
      lang: options.lang || 'en',
      cnt: options.cnt || 40 // 5天 * 8次/天 (每3小时)
    };
    
    return await this.makeRequest('/data/2.5/forecast', params);
  }

  /**
   * 通过坐标获取5天天气预报
   */
  async getForecastByCoords(lat: number, lon: number, options: WeatherOptions = {}): Promise<ForecastWeather> {
    this.logger.info(`Getting forecast for coordinates: ${lat}, ${lon}`);
    
    const params = {
      lat,
      lon,
      units: options.units || 'metric',
      lang: options.lang || 'en',
      cnt: options.cnt || 40
    };
    
    return await this.makeRequest('/data/2.5/forecast', params);
  }

  /**
   * 地理编码 - 通过城市名获取坐标
   */
  async geocoding(location: string, limit: number = 5): Promise<GeoLocation[]> {
    this.logger.info(`Geocoding location: ${location}`);
    
    const params = {
      q: location,
      limit
    };
    
    return await this.makeRequest('/geo/1.0/direct', params);
  }

  /**
   * 反向地理编码 - 通过坐标获取地名
   */
  async reverseGeocoding(lat: number, lon: number, limit: number = 5): Promise<GeoLocation[]> {
    this.logger.info(`Reverse geocoding coordinates: ${lat}, ${lon}`);
    
    const params = {
      lat,
      lon,
      limit
    };
    
    return await this.makeRequest('/geo/1.0/reverse', params);
  }

  /**
   * 获取空气质量数据
   */
  async getAirPollution(lat: number, lon: number): Promise<any> {
    this.logger.info(`Getting air pollution data for: ${lat}, ${lon}`);
    
    const params = {
      lat,
      lon
    };
    
    return await this.makeRequest('/data/2.5/air_pollution', params);
  }

  /**
   * 获取历史空气质量数据
   */
  async getHistoricalAirPollution(lat: number, lon: number, start: number, end: number): Promise<any> {
    this.logger.info(`Getting historical air pollution data for: ${lat}, ${lon}`);
    
    const params = {
      lat,
      lon,
      start,
      end
    };
    
    return await this.makeRequest('/data/2.5/air_pollution/history', params);
  }

  /**
   * 智能天气搜索 - 根据查询自动选择最佳方法
   */
  async smartWeatherSearch(query: string, options: WeatherOptions = {}): Promise<any> {
    this.logger.info(`Smart weather search: ${query}`);
    
    const intent = this.analyzeWeatherIntent(query);
    
    try {
      let result: any;
      
      switch (intent.type) {
        case 'coordinates':
          if (intent.forecast) {
            result = await this.getForecastByCoords(intent.lat!, intent.lon!, options);
          } else {
            result = await this.getCurrentWeatherByCoords(intent.lat!, intent.lon!, options);
          }
          break;
          
        case 'forecast':
          result = await this.getForecast(intent.location, options);
          break;
          
        case 'geocoding':
          result = await this.geocoding(intent.location, 5);
          break;
          
        default: // 'current'
          result = await this.getCurrentWeather(intent.location, options);
          break;
      }
      
      return {
        type: intent.type,
        query,
        originalQuery: query,
        processedLocation: intent.location,
        intent: intent,
        result: result
      };
    } catch (error) {
      // 如果直接搜索失败，尝试地理编码
      try {
        const geoResults = await this.geocoding(query, 1);
        if (geoResults.length > 0) {
          const location = geoResults[0];
          const weatherResult = await this.getCurrentWeatherByCoords(location.lat, location.lon, options);
          
          return {
            type: 'geocoded_weather',
            query,
            originalQuery: query,
            processedLocation: `${location.name}, ${location.country}`,
            intent: intent,
            geocoding: location,
            result: weatherResult
          };
        }
      } catch (geoError) {
        // 忽略地理编码错误，抛出原始错误
      }
      
      throw error;
    }
  }

  /**
   * 分析天气搜索意图
   */
  private analyzeWeatherIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 坐标搜索意图
    const coordMatch = normalizedQuery.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      return {
        type: 'coordinates',
        lat,
        lon,
        forecast: normalizedQuery.includes('forecast') || normalizedQuery.includes('预报'),
        confidence: 0.95
      };
    }
    
    // 预报搜索意图
    if (normalizedQuery.includes('forecast') || normalizedQuery.includes('预报') || 
        normalizedQuery.includes('tomorrow') || normalizedQuery.includes('明天') ||
        normalizedQuery.includes('week') || normalizedQuery.includes('周') ||
        normalizedQuery.includes('days') || normalizedQuery.includes('天')) {
      return {
        type: 'forecast',
        location: normalizedQuery.replace(/(forecast|预报|tomorrow|明天|week|周|days|天)/g, '').trim(),
        confidence: 0.9
      };
    }
    
    // 地理编码意图
    if (normalizedQuery.includes('location') || normalizedQuery.includes('coordinates') ||
        normalizedQuery.includes('位置') || normalizedQuery.includes('坐标')) {
      return {
        type: 'geocoding',
        location: normalizedQuery.replace(/(location|coordinates|位置|坐标)/g, '').trim(),
        confidence: 0.85
      };
    }
    
    // 默认：当前天气
    return {
      type: 'current',
      location: normalizedQuery,
      confidence: 0.8
    };
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '1,000 requests per day (free tier)',
      features: ['current_weather', 'forecast', 'geocoding', 'air_pollution'],
      lastRequestTime: this.lastRequestTime,
      apiKey: this.API_KEY !== 'demo_key' ? 'configured' : 'demo'
    };
  }

  /**
   * 验证API配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      // 测试一个简单的天气查询
      const testResult = await this.getCurrentWeather('London', { units: 'metric' });
      return !!(testResult && testResult.name);
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取支持的单位
   */
  getSupportedUnits(): Record<string, string> {
    return {
      'metric': 'Celsius, meter/sec, hPa',
      'imperial': 'Fahrenheit, miles/hour, hPa',
      'kelvin': 'Kelvin, meter/sec, hPa'
    };
  }

  /**
   * 获取支持的语言
   */
  getSupportedLanguages(): Record<string, string> {
    return {
      'en': 'English',
      'zh_cn': '简体中文',
      'zh_tw': '繁體中文',
      'ja': '日本語',
      'ko': '한국어',
      'es': 'Español',
      'fr': 'Français',
      'de': 'Deutsch',
      'it': 'Italiano',
      'ru': 'Русский'
    };
  }

  /**
   * 获取支持的搜索类型
   */
  getSupportedSearchTypes(): Record<string, string> {
    return {
      'current': 'Current weather conditions',
      'forecast': '5-day weather forecast',
      'geocoding': 'Location coordinates lookup',
      'reverse_geocoding': 'Address lookup from coordinates',
      'air_pollution': 'Air quality and pollution data',
      'historical': 'Historical weather data'
    };
  }
}
