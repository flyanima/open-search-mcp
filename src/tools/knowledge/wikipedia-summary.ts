import { WikipediaSearchClient } from '../../api/clients/wikipedia-search-client.js';
import { WikipediaSearchRouter } from '../../utils/wikipedia-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Wikipedia 摘要工具
 * 专门用于获取维基百科条目的摘要信息
 */

const logger = new Logger('WikipediaSummary');

export async function wikipediaSummary(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing Wikipedia summary: ${args.query}`);

    // 提取主题和语言
    const title = extractTitle(args.query);
    const language = detectLanguage(args.query);
    
    const result = await handleSummaryRequest(client, title, language, args.query);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'summary',
        result,
        source: 'Wikipedia',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Wikipedia summary failed:', error);
    return {
      success: false,
      error: `Wikipedia summary failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理摘要请求
 */
async function handleSummaryRequest(client: WikipediaSearchClient, title: string, language: string, originalQuery: string): Promise<any> {
  try {
    // 直接尝试获取摘要
    const summary = await client.getPageSummary(title, language);
    
    // 增强摘要信息
    const enhancedSummary = await enhanceSummary(summary, client, language);
    
    return {
      type: 'summary',
      query: originalQuery,
      title: summary.title,
      extract: summary.extract,
      url: summary.url,
      thumbnail: summary.thumbnail,
      language: summary.language,
      coordinates: summary.coordinates,
      enhanced: enhancedSummary,
      summary: generateSummaryDescription(summary, language)
    };
    
  } catch (error) {
    // 如果直接获取失败，尝试搜索然后获取第一个结果
    logger.info(`Direct summary failed for "${title}", trying search approach`);
    
    const searchResults = await client.searchPages(title, { limit: 3, language });
    
    if (searchResults.results.length === 0) {
      return {
        type: 'summary',
        query: originalQuery,
        title,
        extract: '',
        url: '',
        language,
        error: `No Wikipedia page found for "${title}"`,
        suggestions: await generateSearchSuggestions(client, title, language)
      };
    }
    
    // 尝试获取最相关结果的摘要
    const bestMatch = findBestMatch(searchResults.results, title);
    const summary = await client.getPageSummary(bestMatch.title, language);
    
    // 增强摘要信息
    const enhancedSummary = await enhanceSummary(summary, client, language);
    
    return {
      type: 'summary',
      query: originalQuery,
      title: summary.title,
      extract: summary.extract,
      url: summary.url,
      thumbnail: summary.thumbnail,
      language: summary.language,
      coordinates: summary.coordinates,
      enhanced: enhancedSummary,
      originalTitle: title,
      matchType: 'closest_match',
      summary: generateSummaryDescription(summary, language, true)
    };
  }
}

/**
 * 增强摘要信息
 */
async function enhanceSummary(summary: any, client: WikipediaSearchClient, language: string): Promise<any> {
  const enhanced: any = {
    wordCount: summary.extract ? summary.extract.split(/\s+/).length : 0,
    readingTime: 0,
    keyTopics: [],
    relatedPages: []
  };
  
  // 计算阅读时间（假设每分钟200词）
  enhanced.readingTime = Math.ceil(enhanced.wordCount / 200);
  
  // 提取关键主题
  if (summary.extract) {
    enhanced.keyTopics = extractKeyTopics(summary.extract);
  }
  
  // 获取相关页面（限制数量以提高性能）
  try {
    const relatedPages = await client.getRelatedPages(summary.title, language);
    enhanced.relatedPages = relatedPages.slice(0, 5).map(page => ({
      title: page.title,
      url: page.url
    }));
  } catch (error) {
    logger.warn('Failed to get related pages:', error);
    enhanced.relatedPages = [];
  }
  
  // 分析摘要质量
  enhanced.quality = analyzeSummaryQuality(summary);
  
  return enhanced;
}

/**
 * 提取关键主题
 */
function extractKeyTopics(text: string): string[] {
  if (!text) return [];
  
  // 简单的关键词提取（可以后续改进为更复杂的NLP）
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // 统计词频
  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // 排除常见停用词
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'been', 'call', 'come', 'each', 'find', 'have', 'into', 'like', 'look', 'made', 'make', 'many', 'more', 'most', 'move', 'must', 'name', 'need', 'only', 'over', 'said', 'same', 'some', 'take', 'than', 'that', 'them', 'time', 'very', 'well', 'were', 'what', 'when', 'with', 'word', 'work', 'year', 'your', 'also', 'back', 'came', 'come', 'could', 'does', 'each', 'even', 'first', 'from', 'give', 'good', 'great', 'here', 'just', 'know', 'last', 'life', 'long', 'much', 'never', 'other', 'part', 'place', 'right', 'seem', 'small', 'such', 'tell', 'these', 'they', 'this', 'through', 'turn', 'want', 'water', 'where', 'which', 'while', 'world', 'would', 'write', 'years'
  ]);
  
  // 获取高频词汇
  const topWords = Object.entries(wordCount)
    .filter(([word]) => !stopWords.has(word))
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 8)
    .map(([word]) => word);
  
  return topWords;
}

/**
 * 分析摘要质量
 */
function analyzeSummaryQuality(summary: any): any {
  const quality: any = {
    score: 0,
    factors: []
  };
  
  // 检查摘要长度
  if (summary.extract) {
    const length = summary.extract.length;
    if (length > 500) {
      quality.score += 30;
      quality.factors.push('Comprehensive content');
    } else if (length > 200) {
      quality.score += 20;
      quality.factors.push('Adequate content');
    } else {
      quality.score += 10;
      quality.factors.push('Brief content');
    }
  }
  
  // 检查是否有缩略图
  if (summary.thumbnail) {
    quality.score += 20;
    quality.factors.push('Has thumbnail');
  }
  
  // 检查是否有坐标信息
  if (summary.coordinates) {
    quality.score += 15;
    quality.factors.push('Has location data');
  }
  
  // 检查URL有效性
  if (summary.url && summary.url.includes('wikipedia.org')) {
    quality.score += 15;
    quality.factors.push('Valid Wikipedia URL');
  }
  
  // 检查标题质量
  if (summary.title && summary.title.length > 0) {
    quality.score += 20;
    quality.factors.push('Clear title');
  }
  
  // 质量等级
  if (quality.score >= 80) {
    quality.level = 'Excellent';
  } else if (quality.score >= 60) {
    quality.level = 'Good';
  } else if (quality.score >= 40) {
    quality.level = 'Fair';
  } else {
    quality.level = 'Poor';
  }
  
  return quality;
}

/**
 * 找到最佳匹配结果
 */
function findBestMatch(results: any[], targetTitle: string): any {
  if (results.length === 0) return null;
  
  // 计算每个结果与目标标题的相似度
  const scored = results.map(result => ({
    ...result,
    similarity: calculateTitleSimilarity(result.title, targetTitle)
  }));
  
  // 按相似度排序
  scored.sort((a, b) => b.similarity - a.similarity);
  
  return scored[0];
}

/**
 * 计算标题相似度
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const t1 = title1.toLowerCase().trim();
  const t2 = title2.toLowerCase().trim();
  
  // 完全匹配
  if (t1 === t2) return 1.0;
  
  // 包含关系
  if (t1.includes(t2) || t2.includes(t1)) return 0.8;
  
  // 词汇重叠
  const words1 = new Set(t1.split(/\s+/));
  const words2 = new Set(t2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * 生成搜索建议
 */
async function generateSearchSuggestions(client: WikipediaSearchClient, title: string, language: string): Promise<string[]> {
  try {
    // 尝试部分匹配搜索
    const words = title.split(/\s+/);
    const suggestions: string[] = [];
    
    // 使用单个关键词搜索
    for (const word of words) {
      if (word.length > 2) {
        try {
          const results = await client.searchPages(word, { limit: 2, language });
          results.results.forEach(result => {
            if (!suggestions.includes(result.title)) {
              suggestions.push(result.title);
            }
          });
        } catch (error) {
          // 忽略单个搜索失败
        }
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
  // 移除摘要相关词汇
  const summaryWords = ['摘要', '简介', '介绍', '概述', '概要', 'summary', 'intro', 'introduction', 'overview', 'brief'];
  
  let title = query;
  summaryWords.forEach(word => {
    title = title.replace(new RegExp(`\\b${word}\\b`, 'gi'), '').trim();
  });
  
  return title || query;
}

/**
 * 检测语言
 */
function detectLanguage(query: string): string {
  // 检测中文
  if (/[\u4e00-\u9fff]/.test(query)) {
    return 'zh';
  }
  
  // 检测日文
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(query)) {
    return 'ja';
  }
  
  // 默认英文
  return 'en';
}

/**
 * 生成摘要描述
 */
function generateSummaryDescription(summary: any, language: string, isClosestMatch = false): string {
  const languageName = getLanguageName(language);
  
  if (isClosestMatch) {
    return `Found closest match summary for "${summary.title}" in ${languageName}. ${summary.extract ? `${summary.extract.length} characters.` : 'No extract available.'}`;
  }
  
  return `Found summary for "${summary.title}" in ${languageName}. ${summary.extract ? `${summary.extract.length} characters.` : 'No extract available.'}`;
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
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ar': 'Arabic'
  };
  
  return languageNames[languageCode] || languageCode.toUpperCase();
}

/**
 * 工具注册信息
 */
export const wikipediaSummaryTool = {
  name: 'wikipedia_summary',
  description: 'Get detailed summaries of Wikipedia articles with enhanced information and analysis',
  category: 'knowledge-search',
  source: 'wikipedia.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Topic or article title to get summary for. Examples: "Albert Einstein", "artificial intelligence", "人工智能", "quantum computing", "COVID-19"'
      }
    },
    required: ['query']
  },
  execute: wikipediaSummary,
  examples: [
    {
      query: "Albert Einstein",
      description: "Get a detailed summary of Albert Einstein"
    },
    {
      query: "artificial intelligence",
      description: "Get a summary of artificial intelligence"
    },
    {
      query: "人工智能",
      description: "Get AI summary in Chinese"
    },
    {
      query: "quantum computing",
      description: "Get quantum computing summary"
    },
    {
      query: "COVID-19",
      description: "Get COVID-19 overview"
    },
    {
      query: "machine learning",
      description: "Get machine learning summary"
    }
  ]
};
