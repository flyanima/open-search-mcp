import { OpenWeatherClient } from '../../api/clients/openweather-client.js';
import { OpenWeatherRouter } from '../../utils/openweather-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * OpenWeather 地理编码搜索工具
 * 专门用于地理位置查找、坐标转换和位置信息服务
 */

const logger = new Logger('OpenWeatherGeocodingSearch');

export async function openweatherGeocodingSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing OpenWeather geocoding search: ${args.query}`);

    const limit = args.limit || 5;
    const result = await handleGeocodingRequest(client, router, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'openweather_geocoding_search',
        result,
        source: 'OpenWeather',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('OpenWeather geocoding search failed:', error);
    return {
      success: false,
      error: `OpenWeather geocoding search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理地理编码请求
 */
async function handleGeocodingRequest(client: OpenWeatherClient, router: OpenWeatherRouter, query: string, limit: number): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let geoResult;
    
    switch (route.searchType) {
      case 'coordinates':
        // 反向地理编码
        geoResult = await client.reverseGeocoding(route.lat!, route.lon!, limit);
        break;
        
      case 'reverse_geocoding':
        // 从查询中提取坐标进行反向地理编码
        const coordMatch = query.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lon = parseFloat(coordMatch[2]);
          geoResult = await client.reverseGeocoding(lat, lon, limit);
        } else {
          throw new Error('Invalid coordinates format for reverse geocoding');
        }
        break;
        
      default: // 'geocoding'
        geoResult = await client.geocoding(route.location!, limit);
        break;
    }
    
    if (!geoResult || geoResult.length === 0) {
      return {
        type: 'openweather_geocoding_search',
        query,
        locations: [],
        totalResults: 0,
        message: `No locations found for "${query}"`,
        suggestions: generateGeocodingSuggestions(query, route)
      };
    }

    // 增强地理编码结果
    const enhancedLocations = geoResult.map((location: any) => {
      return {
        ...location,
        
        // 位置质量评估
        locationQuality: assessLocationQuality(location),
        
        // 地理信息分析
        geographicInfo: analyzeGeographicInfo(location),
        
        // 时区信息
        timezoneInfo: estimateTimezone(location),
        
        // 距离计算（如果有多个结果）
        distanceInfo: geoResult.length > 1 ? calculateDistances(location, geoResult) : null,
        
        // 格式化显示信息
        displayInfo: formatLocationDisplayInfo(location)
      };
    });

    // 按质量和相关性排序
    enhancedLocations.sort((a: any, b: any) => {
      return b.locationQuality.score - a.locationQuality.score;
    });

    // 分析地理编码结果
    const resultAnalysis = analyzeGeocodingResults(enhancedLocations, route);

    return {
      type: 'openweather_geocoding_search',
      query,
      locations: enhancedLocations,
      totalResults: enhancedLocations.length,
      route,
      analysis: resultAnalysis,
      summary: generateGeocodingSummary(enhancedLocations, query, route, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 评估位置质量
 */
function assessLocationQuality(location: any): any {
  let score = 50; // 基础分数
  
  // 名称完整性
  if (location.name) score += 20;
  if (location.local_names && Object.keys(location.local_names).length > 0) score += 10;
  
  // 地理层级完整性
  if (location.country) score += 15;
  if (location.state) score += 10;
  
  // 坐标精度
  const latPrecision = location.lat.toString().split('.')[1]?.length || 0;
  const lonPrecision = location.lon.toString().split('.')[1]?.length || 0;
  const avgPrecision = (latPrecision + lonPrecision) / 2;
  
  if (avgPrecision >= 4) score += 15;
  else if (avgPrecision >= 2) score += 10;
  else if (avgPrecision >= 1) score += 5;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    level: score >= 85 ? 'Excellent' : 
           score >= 70 ? 'Good' : 
           score >= 55 ? 'Fair' : 'Poor',
    factors: {
      nameCompleteness: !!location.name,
      localNames: location.local_names ? Object.keys(location.local_names).length : 0,
      hasCountry: !!location.country,
      hasState: !!location.state,
      coordinatePrecision: avgPrecision
    }
  };
}

/**
 * 分析地理信息
 */
function analyzeGeographicInfo(location: any): any {
  const lat = location.lat;
  const lon = location.lon;
  
  // 半球信息
  const hemisphere = {
    latitude: lat >= 0 ? 'Northern' : 'Southern',
    longitude: lon >= 0 ? 'Eastern' : 'Western'
  };
  
  // 气候带估算
  let climateZone = 'Temperate';
  if (Math.abs(lat) <= 23.5) climateZone = 'Tropical';
  else if (Math.abs(lat) >= 66.5) climateZone = 'Polar';
  else if (Math.abs(lat) >= 35) climateZone = 'Temperate';
  else climateZone = 'Subtropical';
  
  // 大陆估算
  let continent = 'Unknown';
  if (lon >= -170 && lon <= -30) {
    continent = lat >= 15 ? 'North America' : 'South America';
  } else if (lon >= -30 && lon <= 60) {
    continent = lat >= 35 ? 'Europe' : 'Africa';
  } else if (lon >= 60 && lon <= 180) {
    continent = lat >= 15 ? 'Asia' : 'Oceania';
  }
  
  return {
    hemisphere,
    climateZone,
    continent,
    coordinates: {
      decimal: { lat, lon },
      dms: convertToDMS(lat, lon)
    }
  };
}

/**
 * 估算时区
 */
function estimateTimezone(location: any): any {
  const lon = location.lon;
  
  // 粗略的时区估算（基于经度）
  const utcOffset = Math.round(lon / 15);
  const adjustedOffset = Math.max(-12, Math.min(12, utcOffset));
  
  return {
    estimatedUTCOffset: adjustedOffset,
    offsetString: `UTC${adjustedOffset >= 0 ? '+' : ''}${adjustedOffset}`,
    note: 'Estimated based on longitude - actual timezone may vary due to political boundaries'
  };
}

/**
 * 计算距离
 */
function calculateDistances(targetLocation: any, allLocations: any[]): any {
  const distances = allLocations
    .filter(loc => loc !== targetLocation)
    .map(loc => {
      const distance = calculateHaversineDistance(
        targetLocation.lat, targetLocation.lon,
        loc.lat, loc.lon
      );
      
      return {
        to: `${loc.name}, ${loc.country}`,
        distance: Math.round(distance),
        coordinates: { lat: loc.lat, lon: loc.lon }
      };
    })
    .sort((a, b) => a.distance - b.distance);
  
  return {
    nearestLocations: distances.slice(0, 3),
    averageDistance: distances.length > 0 ? 
      Math.round(distances.reduce((sum, d) => sum + d.distance, 0) / distances.length) : 0
  };
}

/**
 * 格式化位置显示信息
 */
function formatLocationDisplayInfo(location: any): any {
  const localNames = location.local_names || {};
  
  return {
    name: location.name,
    fullName: `${location.name}${location.state ? `, ${location.state}` : ''}, ${location.country}`,
    coordinates: `${location.lat}, ${location.lon}`,
    country: location.country,
    state: location.state,
    localNames: Object.keys(localNames).length > 0 ? localNames : null,
    coordinatesPrecision: {
      latitude: location.lat.toString().split('.')[1]?.length || 0,
      longitude: location.lon.toString().split('.')[1]?.length || 0
    }
  };
}

/**
 * 分析地理编码结果
 */
function analyzeGeocodingResults(locations: any[], route: any): any {
  if (locations.length === 0) return {};
  
  const analysis = {
    totalLocations: locations.length,
    qualityLevels: {} as Record<string, number>,
    countries: {} as Record<string, number>,
    continents: {} as Record<string, number>,
    climateZones: {} as Record<string, number>,
    averageQuality: 0,
    topLocation: locations[0],
    coordinateRange: calculateCoordinateRange(locations)
  };
  
  // 统计分布
  locations.forEach(location => {
    // 质量分布
    const quality = location.locationQuality.level;
    analysis.qualityLevels[quality] = (analysis.qualityLevels[quality] || 0) + 1;
    
    // 国家分布
    const country = location.country;
    analysis.countries[country] = (analysis.countries[country] || 0) + 1;
    
    // 大陆分布
    const continent = location.geographicInfo.continent;
    analysis.continents[continent] = (analysis.continents[continent] || 0) + 1;
    
    // 气候带分布
    const climate = location.geographicInfo.climateZone;
    analysis.climateZones[climate] = (analysis.climateZones[climate] || 0) + 1;
  });
  
  // 计算平均质量
  analysis.averageQuality = locations.reduce((sum, location) => 
    sum + location.locationQuality.score, 0) / locations.length;
  
  return analysis;
}

/**
 * 辅助函数
 */
function convertToDMS(lat: number, lon: number): any {
  const convertCoordinate = (coord: number, isLatitude: boolean) => {
    const abs = Math.abs(coord);
    const degrees = Math.floor(abs);
    const minutes = Math.floor((abs - degrees) * 60);
    const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60);
    
    const direction = isLatitude ? 
      (coord >= 0 ? 'N' : 'S') : 
      (coord >= 0 ? 'E' : 'W');
    
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };
  
  return {
    latitude: convertCoordinate(lat, true),
    longitude: convertCoordinate(lon, false)
  };
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateCoordinateRange(locations: any[]): any {
  const lats = locations.map(loc => loc.lat);
  const lons = locations.map(loc => loc.lon);
  
  return {
    latitude: {
      min: Math.min(...lats),
      max: Math.max(...lats),
      range: Math.max(...lats) - Math.min(...lats)
    },
    longitude: {
      min: Math.min(...lons),
      max: Math.max(...lons),
      range: Math.max(...lons) - Math.min(...lons)
    }
  };
}

/**
 * 生成搜索建议
 */
function generateGeocodingSuggestions(query: string, route: any): string[] {
  return [
    'Try more specific location names',
    'Include country name for better accuracy',
    'Use coordinates (lat,lon) for reverse geocoding',
    'Try alternative spellings or local names'
  ];
}

/**
 * 生成地理编码摘要
 */
function generateGeocodingSummary(locations: any[], query: string, route: any, analysis: any): string {
  if (locations.length === 0) return `No locations found for "${query}"`;
  
  const topLocation = locations[0];
  const avgQuality = Math.round(analysis.averageQuality);
  const countries = Object.keys(analysis.countries).length;
  
  return `Found ${analysis.totalLocations} locations for "${query}". Top: ${topLocation.name}, ${topLocation.country} (${topLocation.lat}, ${topLocation.lon}). Average quality: ${avgQuality}/100. ${countries} countries covered.`;
}

/**
 * 工具注册信息
 */
export const openweatherGeocodingSearchTool = {
  name: 'openweather_geocoding_search',
  description: 'Find location coordinates and geographic information using OpenWeather geocoding API',
  category: 'weather-search',
  source: 'openweathermap.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Location query for geocoding. Examples: "London", "New York, NY", "Beijing, China", "40.7128,-74.0060" (for reverse geocoding)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of locations to return (default: 5, max: 10)',
        default: 5,
        minimum: 1,
        maximum: 10
      }
    },
    required: ['query']
  },
  execute: openweatherGeocodingSearch,
  examples: [
    {
      query: "London",
      description: "Find coordinates for London"
    },
    {
      query: "New York, NY",
      description: "Geocode New York with state specification"
    },
    {
      query: "Beijing, China",
      description: "Find Beijing coordinates with country"
    },
    {
      query: "40.7128,-74.0060",
      description: "Reverse geocoding for NYC coordinates"
    },
    {
      query: "Paris, France",
      description: "Geocode Paris with country specification"
    }
  ]
};
