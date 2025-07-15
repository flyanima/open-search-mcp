/**
 * OpenWeather API Tools Registration
 * 注册OpenWeather天气API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * OpenWeather API客户端
 */
class OpenWeatherAPIClient {
  private apiKey: string;
  private baseURL = 'https://api.openweathermap.org/data/2.5';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          ...params,
          appid: this.apiKey,
          units: 'metric' // 使用摄氏度
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async getCurrentWeather(location: string) {
    return await this.makeRequest('/weather', {
      q: location
    });
  }

  async getCurrentWeatherByCoords(lat: number, lon: number) {
    return await this.makeRequest('/weather', {
      lat,
      lon
    });
  }

  async getForecast(location: string, days: number = 5) {
    return await this.makeRequest('/forecast', {
      q: location,
      cnt: Math.min(days * 8, 40) // 每天8个数据点，最多5天
    });
  }

  async getAirPollution(lat: number, lon: number) {
    return await this.makeRequest('/air_pollution', {
      lat,
      lon
    });
  }
}

/**
 * 注册所有OpenWeather API工具
 */
export function registerOpenWeatherTools(registry: ToolRegistry): void {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {return;
  }

  const client = new OpenWeatherAPIClient(apiKey);

  // 1. 当前天气
  registry.registerTool({
    name: 'openweather_current_weather',
    description: 'Get current weather conditions for any location',
    category: 'weather',
    source: 'openweathermap.org',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name, state/country (e.g., "New York", "London,UK", "Tokyo,JP")'
        }
      },
      required: ['location']
    },
    execute: async (args: any) => {
      try {
        const data = await client.getCurrentWeather(args.location);
        
        return {
          success: true,
          data: {
            source: 'OpenWeather API',
            location: args.location,
            weather: {
              temperature: data.main.temp,
              feelsLike: data.main.feels_like,
              humidity: data.main.humidity,
              pressure: data.main.pressure,
              description: data.weather[0].description,
              main: data.weather[0].main,
              windSpeed: data.wind?.speed,
              windDirection: data.wind?.deg,
              visibility: data.visibility,
              cloudiness: data.clouds?.all
            },
            location_info: {
              name: data.name,
              country: data.sys.country,
              coordinates: {
                lat: data.coord.lat,
                lon: data.coord.lon
              }
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get current weather'
        };
      }
    }
  });

  // 2. 天气预报
  registry.registerTool({
    name: 'openweather_forecast',
    description: 'Get weather forecast for up to 5 days',
    category: 'weather',
    source: 'openweathermap.org',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name, state/country (e.g., "New York", "London,UK")'
        },
        days: {
          type: 'number',
          description: 'Number of days for forecast (1-5)',
          default: 3,
          minimum: 1,
          maximum: 5
        }
      },
      required: ['location']
    },
    execute: async (args: any) => {
      try {
        const days = Math.min(args.days || 3, 5);
        const data = await client.getForecast(args.location, days);
        
        // 处理预报数据，按天分组
        const forecastByDay: Record<string, any[]> = {};
        data.list.forEach((item: any) => {
          const date = new Date(item.dt * 1000).toISOString().split('T')[0];
          if (!forecastByDay[date]) {
            forecastByDay[date] = [];
          }
          forecastByDay[date].push({
            time: new Date(item.dt * 1000).toISOString(),
            temperature: item.main.temp,
            feelsLike: item.main.feels_like,
            humidity: item.main.humidity,
            description: item.weather[0].description,
            windSpeed: item.wind?.speed,
            precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0
          });
        });
        
        return {
          success: true,
          data: {
            source: 'OpenWeather API',
            location: args.location,
            days: days,
            city: data.city,
            forecast: forecastByDay,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get weather forecast'
        };
      }
    }
  });

  // 3. 空气质量
  registry.registerTool({
    name: 'openweather_air_quality',
    description: 'Get air pollution data for a location',
    category: 'weather',
    source: 'openweathermap.org',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name to get coordinates for air quality data'
        },
        lat: {
          type: 'number',
          description: 'Latitude (if coordinates are known)'
        },
        lon: {
          type: 'number',
          description: 'Longitude (if coordinates are known)'
        }
      },
      required: []
    },
    execute: async (args: any) => {
      try {
        let lat = args.lat;
        let lon = args.lon;
        
        // 如果没有坐标，先获取位置信息
        if (!lat || !lon) {
          if (!args.location) {
            throw new Error('Either location or coordinates (lat, lon) must be provided');
          }
          
          const weatherData = await client.getCurrentWeather(args.location);
          lat = weatherData.coord.lat;
          lon = weatherData.coord.lon;
        }
        
        const data = await client.getAirPollution(lat, lon);
        
        // 空气质量指数说明
        const aqiLevels = {
          1: 'Good',
          2: 'Fair', 
          3: 'Moderate',
          4: 'Poor',
          5: 'Very Poor'
        };
        
        return {
          success: true,
          data: {
            source: 'OpenWeather API',
            location: args.location,
            coordinates: { lat, lon },
            airQuality: {
              aqi: data.list[0].main.aqi,
              aqiLevel: aqiLevels[data.list[0].main.aqi as keyof typeof aqiLevels],
              components: data.list[0].components,
              timestamp: new Date(data.list[0].dt * 1000).toISOString()
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get air quality data'
        };
      }
    }
  });

  // 4. 天气警报（基于当前天气的简单警报）
  registry.registerTool({
    name: 'openweather_weather_alerts',
    description: 'Get weather alerts and warnings for a location',
    category: 'weather',
    source: 'openweathermap.org',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name to check for weather alerts'
        }
      },
      required: ['location']
    },
    execute: async (args: any) => {
      try {
        const currentWeather = await client.getCurrentWeather(args.location);
        const forecast = await client.getForecast(args.location, 2);
        
        // 简单的警报逻辑
        const alerts = [];
        
        // 检查极端温度
        if (currentWeather.main.temp > 35) {
          alerts.push({
            type: 'heat_warning',
            severity: 'high',
            message: `Extreme heat warning: ${currentWeather.main.temp}°C`
          });
        } else if (currentWeather.main.temp < -10) {
          alerts.push({
            type: 'cold_warning',
            severity: 'high',
            message: `Extreme cold warning: ${currentWeather.main.temp}°C`
          });
        }
        
        // 检查强风
        if (currentWeather.wind?.speed > 15) {
          alerts.push({
            type: 'wind_warning',
            severity: 'medium',
            message: `Strong wind warning: ${currentWeather.wind.speed} m/s`
          });
        }
        
        // 检查降水
        const hasRain = forecast.list.some((item: any) => item.rain?.['3h'] > 10);
        if (hasRain) {
          alerts.push({
            type: 'precipitation_warning',
            severity: 'medium',
            message: 'Heavy precipitation expected in the next 24 hours'
          });
        }
        
        return {
          success: true,
          data: {
            source: 'OpenWeather API',
            location: args.location,
            alerts: alerts,
            currentConditions: {
              temperature: currentWeather.main.temp,
              description: currentWeather.weather[0].description,
              windSpeed: currentWeather.wind?.speed
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get weather alerts'
        };
      }
    }
  });

}
