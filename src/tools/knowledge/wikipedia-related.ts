import { WikipediaSearchClient } from '../../api/clients/wikipedia-search-client.js';
import { WikipediaSearchRouter } from '../../utils/wikipedia-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Wikipedia 相关条目工具
 * 专门用于发现和推荐与指定主题相关的维基百科条目
 */

const logger = new Logger('WikipediaRelated');

export async function wikipediaRelated(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new WikipediaSearchClient();
    const router = new WikipediaSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing Wikipedia related search: ${args.query}`);

    // 提取主题和语言
    const title = extractTitle(args.query);
    const language = detectLanguage(args.query);
    const limit = args.limit || 10;
    
    const result = await handleRelatedRequest(client, title, language, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'related',
        result,
        source: 'Wikipedia',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Wikipedia related search failed:', error);
    return {
      success: false,
      error: `Wikipedia related search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理相关条目请求
 */
async function handleRelatedRequest(client: WikipediaSearchClient, title: string, language: string, originalQuery: string, limit: number): Promise<any> {
  try {
    // 首先验证主题是否存在
    let mainPageTitle = title;
    let mainPageSummary;
    
    try {
      mainPageSummary = await client.getPageSummary(title, language);
      mainPageTitle = mainPageSummary.title;
    } catch (error) {
      // 如果直接获取失败，尝试搜索
      logger.info(`Direct page access failed for "${title}", trying search approach`);
      
      const searchResults = await client.searchPages(title, { limit: 1, language });
      if (searchResults.results.length === 0) {
        return {
          type: 'related',
          query: originalQuery,
          title,
          relatedPages: [],
          totalResults: 0,
          language,
          error: `No Wikipedia page found for "${title}"`,
          suggestions: await generateTopicSuggestions(client, title, language)
        };
      }
      
      mainPageTitle = searchResults.results[0].title;
      mainPageSummary = await client.getPageSummary(mainPageTitle, language);
    }
    
    // 获取相关页面
    const relatedPages = await client.getRelatedPages(mainPageTitle, language);
    
    if (relatedPages.length === 0) {
      // 如果没有直接相关页面，尝试基于主题搜索
      const alternativeRelated = await findAlternativeRelated(client, mainPageTitle, language, limit);
      
      return {
        type: 'related',
        query: originalQuery,
        title: mainPageTitle,
        mainPage: {
          title: mainPageSummary.title,
          extract: mainPageSummary.extract.substring(0, 200) + '...',
          url: mainPageSummary.url,
          thumbnail: mainPageSummary.thumbnail
        },
        relatedPages: alternativeRelated,
        totalResults: alternativeRelated.length,
        language,
        searchMethod: 'alternative_search',
        summary: generateRelatedSummary(alternativeRelated, mainPageTitle, language, 'alternative')
      };
    }
    
    // 增强相关页面信息
    const enhancedRelated = await enhanceRelatedPages(client, relatedPages, language, limit);
    
    // 分析相关性
    const analysis = analyzeRelatedPages(enhancedRelated, mainPageTitle);
    
    return {
      type: 'related',
      query: originalQuery,
      title: mainPageTitle,
      mainPage: {
        title: mainPageSummary.title,
        extract: mainPageSummary.extract.substring(0, 200) + '...',
        url: mainPageSummary.url,
        thumbnail: mainPageSummary.thumbnail
      },
      relatedPages: enhancedRelated,
      totalResults: relatedPages.length,
      language,
      analysis,
      searchMethod: 'direct_related',
      summary: generateRelatedSummary(enhancedRelated, mainPageTitle, language, 'direct')
    };
    
  } catch (error) {
    logger.error('Failed to get related pages:', error);
    throw error;
  }
}

/**
 * 增强相关页面信息
 */
async function enhanceRelatedPages(client: WikipediaSearchClient, relatedPages: any[], language: string, limit: number): Promise<any[]> {
  const enhanced = [];
  const maxPages = Math.min(relatedPages.length, limit);
  
  for (let i = 0; i < maxPages; i++) {
    const page = relatedPages[i];
    
    try {
      // 获取每个相关页面的摘要
      const summary = await client.getPageSummary(page.title, language);
      
      enhanced.push({
        title: page.title,
        description: page.description || summary.extract.substring(0, 150) + '...',
        url: page.url || summary.url,
        thumbnail: summary.thumbnail,
        extract: summary.extract.substring(0, 300) + '...',
        relevanceScore: calculateRelatedScore(page, summary),
        category: categorizeRelatedPage(page.title, summary.extract),
        wordCount: summary.extract ? summary.extract.split(/\s+/).length : 0
      });
      
      // 添加延迟以避免过度请求
      if (i < maxPages - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      // 如果获取摘要失败，使用基本信息
      enhanced.push({
        title: page.title,
        description: page.description || 'No description available',
        url: page.url,
        relevanceScore: 50,
        category: 'general',
        wordCount: 0
      });
    }
  }
  
  // 按相关性排序
  enhanced.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return enhanced;
}

/**
 * 寻找替代相关页面
 */
async function findAlternativeRelated(client: WikipediaSearchClient, title: string, language: string, limit: number): Promise<any[]> {
  const alternatives: any[] = [];
  
  // 提取关键词进行搜索
  const keywords = extractKeywords(title);
  
  for (const keyword of keywords.slice(0, 3)) {
    try {
      const searchResults = await client.searchPages(keyword, { limit: 3, language });
      
      searchResults.results.forEach(result => {
        // 避免包含原始页面
        if (result.title.toLowerCase() !== title.toLowerCase()) {
          alternatives.push({
            title: result.title,
            description: result.description,
            url: result.url,
            relevanceScore: calculateKeywordRelevance(result, keyword),
            searchKeyword: keyword
          });
        }
      });
      
      // 添加延迟
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      logger.warn(`Failed to search for keyword "${keyword}":`, error);
    }
  }
  
  // 去重并排序
  const unique = alternatives.filter((item, index, self) => 
    index === self.findIndex(t => t.title === item.title)
  );
  
  unique.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return unique.slice(0, limit);
}

/**
 * 提取关键词
 */
function extractKeywords(title: string): string[] {
  // 分割标题并过滤停用词
  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who']);
  
  return words.filter(word => !stopWords.has(word));
}

/**
 * 计算相关页面分数
 */
function calculateRelatedScore(page: any, summary: any): number {
  let score = 50; // 基础分数
  
  // 描述质量
  if (page.description && page.description.length > 50) {
    score += 15;
  }
  
  // 摘要质量
  if (summary.extract && summary.extract.length > 200) {
    score += 20;
  }
  
  // 是否有缩略图
  if (summary.thumbnail) {
    score += 10;
  }
  
  // URL有效性
  if (page.url && page.url.includes('wikipedia.org')) {
    score += 5;
  }
  
  return Math.min(score, 100);
}

/**
 * 计算关键词相关性
 */
function calculateKeywordRelevance(result: any, keyword: string): number {
  let score = 30; // 基础分数
  
  const titleLower = result.title.toLowerCase();
  const descLower = (result.description || '').toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  // 标题匹配
  if (titleLower.includes(keywordLower)) {
    score += 30;
  }
  
  // 描述匹配
  if (descLower.includes(keywordLower)) {
    score += 20;
  }
  
  // 完全匹配
  if (titleLower === keywordLower) {
    score += 20;
  }
  
  return score;
}

/**
 * 分类相关页面
 */
function categorizeRelatedPage(title: string, extract: string): string {
  const titleLower = title.toLowerCase();
  const extractLower = (extract || '').toLowerCase();
  
  // 人物
  if (titleLower.includes('person') || extractLower.includes('born') || extractLower.includes('died')) {
    return 'person';
  }
  
  // 地点
  if (titleLower.includes('city') || titleLower.includes('country') || extractLower.includes('located')) {
    return 'place';
  }
  
  // 概念
  if (titleLower.includes('theory') || titleLower.includes('concept') || extractLower.includes('theory')) {
    return 'concept';
  }
  
  // 事件
  if (titleLower.includes('war') || titleLower.includes('event') || extractLower.includes('occurred')) {
    return 'event';
  }
  
  // 组织
  if (titleLower.includes('company') || titleLower.includes('organization') || extractLower.includes('founded')) {
    return 'organization';
  }
  
  return 'general';
}

/**
 * 分析相关页面
 */
function analyzeRelatedPages(relatedPages: any[], mainTitle: string): any {
  const analysis = {
    totalPages: relatedPages.length,
    categories: {} as Record<string, number>,
    averageRelevance: 0,
    topCategories: [] as string[],
    qualityDistribution: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  
  // 统计类别
  relatedPages.forEach(page => {
    const category = page.category || 'general';
    analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    
    // 质量分布
    if (page.relevanceScore >= 80) {
      analysis.qualityDistribution.high++;
    } else if (page.relevanceScore >= 60) {
      analysis.qualityDistribution.medium++;
    } else {
      analysis.qualityDistribution.low++;
    }
  });
  
  // 计算平均相关性
  if (relatedPages.length > 0) {
    analysis.averageRelevance = relatedPages.reduce((sum, page) => sum + page.relevanceScore, 0) / relatedPages.length;
  }
  
  // 获取顶级类别
  analysis.topCategories = Object.entries(analysis.categories)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([category]) => category);
  
  return analysis;
}

/**
 * 生成主题建议
 */
async function generateTopicSuggestions(client: WikipediaSearchClient, title: string, language: string): Promise<string[]> {
  try {
    const keywords = extractKeywords(title);
    const suggestions: string[] = [];
    
    for (const keyword of keywords.slice(0, 2)) {
      try {
        const results = await client.searchPages(keyword, { limit: 2, language });
        results.results.forEach(result => {
          if (!suggestions.includes(result.title)) {
            suggestions.push(result.title);
          }
        });
      } catch (error) {
        // 忽略单个搜索失败
      }
    }
    
    return suggestions.slice(0, 5);
  } catch (error) {
    return [];
  }
}

/**
 * 提取标题
 */
function extractTitle(query: string): string {
  // 移除相关词汇
  const relatedWords = ['相关', '相关的', '类似', '相似', 'related', 'similar', 'like', 'associated'];
  
  let title = query;
  relatedWords.forEach(word => {
    title = title.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
  });
  
  return title || query;
}

/**
 * 检测语言
 */
function detectLanguage(query: string): string {
  if (/[\u4e00-\u9fff]/.test(query)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(query)) return 'ja';
  return 'en';
}

/**
 * 生成相关条目摘要
 */
function generateRelatedSummary(relatedPages: any[], title: string, language: string, method: string): string {
  if (relatedPages.length === 0) {
    return `No related pages found for "${title}"`;
  }

  const languageName = getLanguageName(language);
  const methodText = method === 'direct' ? 'directly related' : 'topically related';
  const topRelated = relatedPages[0];
  
  return `Found ${relatedPages.length} ${methodText} pages for "${title}" in ${languageName}. Top related: "${topRelated.title}"`;
}

/**
 * 获取语言名称
 */
function getLanguageName(languageCode: string): string {
  const languageNames: Record<string, string> = {
    'zh': 'Chinese',
    'en': 'English',
    'ja': 'Japanese',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish'
  };
  
  return languageNames[languageCode] || languageCode.toUpperCase();
}

/**
 * 工具注册信息
 */
export const wikipediaRelatedTool = {
  name: 'wikipedia_related',
  description: 'Find related Wikipedia articles and discover connected topics with intelligent categorization',
  category: 'knowledge-search',
  source: 'wikipedia.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Topic to find related articles for. Examples: "artificial intelligence related", "Einstein related", "人工智能相关", "quantum computing similar"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of related articles to return (default: 10, max: 20)',
        default: 10,
        minimum: 1,
        maximum: 20
      }
    },
    required: ['query']
  },
  execute: wikipediaRelated,
  examples: [
    {
      query: "artificial intelligence related",
      description: "Find articles related to artificial intelligence"
    },
    {
      query: "Einstein related",
      description: "Find articles related to Albert Einstein"
    },
    {
      query: "人工智能相关",
      description: "Find AI-related articles in Chinese"
    },
    {
      query: "quantum computing similar",
      description: "Find articles similar to quantum computing"
    },
    {
      query: "COVID-19 related",
      description: "Find articles related to COVID-19"
    }
  ]
};
