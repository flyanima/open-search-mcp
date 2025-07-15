import { GoogleSearchClient } from '../../api/clients/google-search-client.js';
import { GoogleSearchRouter } from '../../utils/google-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Google 图片搜索工具
 * 专门用于图片和视觉内容搜索
 */

const logger = new Logger('GoogleImageSearch');

export async function googleImageSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new GoogleSearchClient();
    const router = new GoogleSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing Google image search: ${args.query}`);

    const limit = args.limit || 10;
    const result = await handleImageSearchRequest(client, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'google_image_search',
        result,
        source: 'Google Images',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Google image search failed:', error);
    return {
      success: false,
      error: `Google image search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理图片搜索请求
 */
async function handleImageSearchRequest(client: GoogleSearchClient, query: string, limit: number): Promise<any> {
  try {
    const searchResult = await client.searchImages(query, { num: limit });
    
    if (!searchResult.items || searchResult.items.length === 0) {
      return {
        type: 'google_image_search',
        query,
        images: [],
        totalResults: 0,
        message: `No images found for "${query}"`,
        suggestions: generateImageSearchSuggestions(query)
      };
    }

    // 增强图片结果
    const enhancedImages = searchResult.items.map((item: any) => {
      return {
        ...item,
        
        // 图片质量评估
        qualityScore: assessImageQuality(item),
        
        // 图片类型分析
        imageType: analyzeImageType(item),
        
        // 相关性分数
        relevanceScore: calculateImageRelevance(item, query),
        
        // 使用适用性
        usabilityScore: assessImageUsability(item),
        
        // 格式化显示信息
        displayInfo: formatImageDisplayInfo(item)
      };
    });

    // 按质量和相关性排序
    enhancedImages.sort((a: any, b: any) => {
      const scoreA = a.qualityScore + a.relevanceScore + a.usabilityScore;
      const scoreB = b.qualityScore + b.relevanceScore + b.usabilityScore;
      return scoreB - scoreA;
    });

    // 分析图片搜索结果
    const resultAnalysis = analyzeImageResults(enhancedImages, searchResult);

    return {
      type: 'google_image_search',
      query,
      images: enhancedImages,
      totalResults: parseInt(searchResult.searchInformation.totalResults) || enhancedImages.length,
      searchTime: searchResult.searchInformation.searchTime,
      analysis: resultAnalysis,
      summary: generateImageSearchSummary(enhancedImages, query, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 评估图片质量
 */
function assessImageQuality(item: any): number {
  let score = 0;
  
  // 基于图片尺寸
  if (item.image) {
    const width = item.image.width || 0;
    const height = item.image.height || 0;
    
    // 高分辨率加分
    if (width >= 1920 && height >= 1080) score += 20;
    else if (width >= 1280 && height >= 720) score += 15;
    else if (width >= 800 && height >= 600) score += 10;
    else if (width >= 400 && height >= 300) score += 5;
    
    // 合理的宽高比
    if (width > 0 && height > 0) {
      const ratio = width / height;
      if (ratio >= 0.5 && ratio <= 2.0) score += 5;
    }
  }
  
  // 基于文件大小
  if (item.image?.byteSize) {
    const sizeKB = item.image.byteSize / 1024;
    if (sizeKB > 50 && sizeKB < 5000) score += 10; // 合理的文件大小
  }
  
  // 基于来源网站
  const domain = item.displayLink?.toLowerCase() || '';
  if (domain.includes('wikipedia') || domain.includes('wikimedia')) score += 10;
  if (domain.includes('unsplash') || domain.includes('pixabay')) score += 8;
  if (domain.includes('flickr') || domain.includes('500px')) score += 6;
  
  return Math.min(score, 40);
}

/**
 * 分析图片类型
 */
function analyzeImageType(item: any): string {
  const title = item.title?.toLowerCase() || '';
  const contextLink = item.image?.contextLink?.toLowerCase() || '';
  
  // 基于标题和上下文判断图片类型
  if (title.includes('logo') || contextLink.includes('logo')) return 'Logo';
  if (title.includes('diagram') || title.includes('chart')) return 'Diagram/Chart';
  if (title.includes('screenshot') || title.includes('screen')) return 'Screenshot';
  if (title.includes('photo') || title.includes('picture')) return 'Photograph';
  if (title.includes('illustration') || title.includes('drawing')) return 'Illustration';
  if (title.includes('icon') || contextLink.includes('icon')) return 'Icon';
  if (title.includes('map') || contextLink.includes('map')) return 'Map';
  if (title.includes('infographic')) return 'Infographic';
  if (title.includes('meme')) return 'Meme';
  if (title.includes('art') || title.includes('artwork')) return 'Artwork';
  
  return 'General Image';
}

/**
 * 计算图片相关性
 */
function calculateImageRelevance(item: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配
  if (item.title) {
    const titleLower = item.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 10;
    });
  }
  
  // 上下文链接匹配
  if (item.image?.contextLink) {
    const contextLower = item.image.contextLink.toLowerCase();
    queryWords.forEach(word => {
      if (contextLower.includes(word)) score += 5;
    });
  }
  
  // 显示链接匹配
  if (item.displayLink) {
    const displayLower = item.displayLink.toLowerCase();
    queryWords.forEach(word => {
      if (displayLower.includes(word)) score += 3;
    });
  }
  
  return Math.min(score, 30);
}

/**
 * 评估图片可用性
 */
function assessImageUsability(item: any): number {
  let score = 0;
  
  // 有缩略图
  if (item.image?.thumbnailLink) score += 5;
  
  // 有明确的尺寸信息
  if (item.image?.width && item.image?.height) score += 5;
  
  // 有文件大小信息
  if (item.image?.byteSize) score += 3;
  
  // 来源可靠
  const domain = item.displayLink?.toLowerCase() || '';
  if (!domain.includes('pinterest') && !domain.includes('tumblr')) {
    score += 5; // 非社交媒体来源通常更可靠
  }
  
  // HTTPS链接
  if (item.link?.startsWith('https://')) score += 2;
  
  return Math.min(score, 20);
}

/**
 * 格式化图片显示信息
 */
function formatImageDisplayInfo(item: any): any {
  const image = item.image || {};
  
  return {
    title: item.title,
    imageUrl: item.link,
    thumbnailUrl: image.thumbnailLink,
    contextUrl: image.contextLink,
    domain: item.displayLink,
    dimensions: image.width && image.height ? `${image.width}x${image.height}` : 'Unknown',
    fileSize: image.byteSize ? `${Math.round(image.byteSize / 1024)}KB` : 'Unknown',
    thumbnailSize: image.thumbnailWidth && image.thumbnailHeight ? 
      `${image.thumbnailWidth}x${image.thumbnailHeight}` : 'Unknown'
  };
}

/**
 * 分析图片搜索结果
 */
function analyzeImageResults(images: any[], searchResult: any): any {
  if (images.length === 0) return {};
  
  const analysis = {
    totalImages: images.length,
    searchTime: searchResult.searchInformation.searchTime,
    imageTypes: {} as Record<string, number>,
    domains: {} as Record<string, number>,
    qualityDistribution: { high: 0, medium: 0, low: 0 },
    averageQuality: 0,
    averageRelevance: 0,
    averageUsability: 0,
    topImages: images.slice(0, 3)
  };
  
  // 统计分布
  images.forEach(image => {
    // 图片类型分布
    const imageType = image.imageType;
    analysis.imageTypes[imageType] = (analysis.imageTypes[imageType] || 0) + 1;
    
    // 域名分布
    const domain = image.displayLink;
    analysis.domains[domain] = (analysis.domains[domain] || 0) + 1;
    
    // 质量分布
    if (image.qualityScore >= 25) analysis.qualityDistribution.high++;
    else if (image.qualityScore >= 15) analysis.qualityDistribution.medium++;
    else analysis.qualityDistribution.low++;
  });
  
  // 计算平均值
  analysis.averageQuality = images.reduce((sum, image) => sum + image.qualityScore, 0) / images.length;
  analysis.averageRelevance = images.reduce((sum, image) => sum + image.relevanceScore, 0) / images.length;
  analysis.averageUsability = images.reduce((sum, image) => sum + image.usabilityScore, 0) / images.length;
  
  return analysis;
}

/**
 * 生成图片搜索建议
 */
function generateImageSearchSuggestions(query: string): string[] {
  return [
    'Try more descriptive visual terms',
    'Add color, style, or object keywords',
    'Use specific image type terms (logo, diagram, photo)',
    'Consider adding context or setting descriptions'
  ];
}

/**
 * 生成图片搜索摘要
 */
function generateImageSearchSummary(images: any[], query: string, analysis: any): string {
  if (images.length === 0) return `No images found for "${query}"`;
  
  const topImage = images[0];
  const avgQuality = Math.round(analysis.averageQuality);
  const mainType = Object.keys(analysis.imageTypes)[0];
  
  return `Found ${analysis.totalImages} images for "${query}" in ${analysis.searchTime} seconds. Top result: "${topImage.title}" (${topImage.displayInfo.dimensions}). Main type: ${mainType}. Average quality: ${avgQuality}/40.`;
}

/**
 * 工具注册信息
 */
export const googleImageSearchTool = {
  name: 'google_image_search',
  description: 'Search for images using Google Custom Search with quality assessment and type analysis',
  category: 'web-search',
  source: 'google.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Image search query. Examples: "machine learning diagram", "sunset photography", "company logos", "infographic climate change"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of images to return (default: 10, max: 10)',
        default: 10,
        minimum: 1,
        maximum: 10
      }
    },
    required: ['query']
  },
  execute: googleImageSearch,
  examples: [
    {
      query: "machine learning diagram",
      description: "Find ML concept diagrams and visualizations"
    },
    {
      query: "sunset photography",
      description: "Search for sunset photos"
    },
    {
      query: "company logos tech",
      description: "Find technology company logos"
    },
    {
      query: "infographic climate change",
      description: "Search for climate change infographics"
    },
    {
      query: "architecture modern buildings",
      description: "Find modern architecture images"
    }
  ]
};
