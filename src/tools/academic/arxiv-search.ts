import { ArxivSearchClient } from '../../api/clients/arxiv-search-client.js';
import { ArxivSearchRouter } from '../../utils/arxiv-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * arXiv 搜索工具
 * 支持学术论文搜索，智能路由到最合适的搜索方式
 */

const logger = new Logger('ArxivSearch');

export async function arxivSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new ArxivSearchClient();
    const router = new ArxivSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    // 智能路由搜索请求
    const route = router.routeSearch(args.query);
    
    logger.info(`Processing arXiv search: ${args.query} -> ${route.intent}`);

    let result;
    const limit = args.limit || 10;
    
    switch (route.endpoint) {
      case 'search':
        result = await handleGeneralSearch(client, route.params, args.query, limit);
        break;
        
      case 'paper_details':
        result = await handlePaperDetails(client, route.params, args.query);
        break;
        
      case 'author_search':
        result = await handleAuthorSearch(client, route.params, args.query, limit);
        break;
        
      case 'category_search':
        result = await handleCategorySearch(client, route.params, args.query, limit);
        break;
        
      default:
        // 默认使用智能搜索
        result = await handleSmartSearch(client, args.query, limit);
    }

    return {
      success: true,
      data: {
        query: args.query,
        searchType: route.intent,
        result,
        source: 'arXiv',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('arXiv search failed:', error);
    return {
      success: false,
      error: `arXiv search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理一般搜索查询
 */
async function handleGeneralSearch(client: ArxivSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const searchParams = {
    maxResults: Math.min(limit, 50),
    sortBy: params.sortBy || 'relevance',
    ...params
  };
  
  // 构建搜索查询
  let searchQuery = params.query || originalQuery;
  
  // 添加年份过滤
  if (params.year) {
    if (params.year.includes('-')) {
      const [startYear, endYear] = params.year.split('-');
      searchQuery += ` AND submittedDate:[${startYear}* TO ${endYear}*]`;
    } else {
      searchQuery += ` AND submittedDate:[${params.year}*]`;
    }
  }
  
  const searchData = await client.searchPapers(searchQuery, searchParams);
  
  if (!searchData.papers || searchData.papers.length === 0) {
    return {
      type: 'search',
      query: originalQuery,
      papers: [],
      totalResults: 0,
      message: `No arXiv papers found for "${originalQuery}"`
    };
  }

  // 增强搜索结果
  const enhancedPapers = searchData.papers.map((paper: any) => ({
    ...paper,
    relevanceScore: calculateRelevanceScore(paper, originalQuery),
    readingTime: estimateReadingTime(paper.summary),
    complexity: assessPaperComplexity(paper),
    topCategories: getTopCategories(paper.categories)
  }));

  // 按相关性排序
  enhancedPapers.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);

  return {
    type: 'search',
    query: originalQuery,
    papers: enhancedPapers,
    totalResults: searchData.totalResults,
    searchParams,
    analysis: analyzePapers(enhancedPapers),
    summary: generateSearchSummary(enhancedPapers, originalQuery)
  };
}

/**
 * 处理论文详情查询
 */
async function handlePaperDetails(client: ArxivSearchClient, params: any, originalQuery: string): Promise<any> {
  const paperId = params.id;
  
  if (!paperId) {
    throw new Error('Paper ID is required for details query');
  }
  
  try {
    const paper = await client.getPaperDetails(paperId);
    
    // 增强论文信息
    const enhancedPaper = {
      ...paper,
      readingTime: estimateReadingTime(paper.summary),
      complexity: assessPaperComplexity(paper),
      topCategories: getTopCategories(paper.categories),
      citationFormat: generateCitation(paper),
      keyTopics: extractKeyTopics(paper.summary),
      relatedCategories: getRelatedCategories(paper.categories)
    };
    
    return {
      type: 'paper_details',
      query: originalQuery,
      paper: enhancedPaper,
      summary: `Found details for paper "${paper.title}" (${paper.id})`
    };
  } catch (error) {
    return {
      type: 'paper_details',
      query: originalQuery,
      paper: null,
      error: `Paper not found: ${paperId}`,
      suggestions: [`Try searching for: "${paperId.replace(/[^\w\s]/g, ' ').trim()}"`]
    };
  }
}

/**
 * 处理作者搜索查询
 */
async function handleAuthorSearch(client: ArxivSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const author = params.author;
  
  if (!author) {
    throw new Error('Author name is required for author search');
  }
  
  const searchOptions = {
    maxResults: Math.min(limit, 30),
    exactMatch: params.exactMatch || false
  };
  
  const searchData = await client.searchByAuthor(author, searchOptions);
  
  if (!searchData.papers || searchData.papers.length === 0) {
    return {
      type: 'author_search',
      query: originalQuery,
      author,
      papers: [],
      totalResults: 0,
      message: `No papers found for author "${author}"`
    };
  }

  // 分析作者的研究
  const authorAnalysis = analyzeAuthorResearch(searchData.papers, author);
  
  // 增强论文信息
  const enhancedPapers = searchData.papers.map((paper: any) => ({
    ...paper,
    isFirstAuthor: isFirstAuthor(paper, author),
    collaborators: getCollaborators(paper, author),
    yearPublished: extractYear(paper.published)
  }));

  return {
    type: 'author_search',
    query: originalQuery,
    author,
    papers: enhancedPapers,
    totalResults: searchData.totalResults,
    analysis: authorAnalysis,
    summary: generateAuthorSummary(enhancedPapers, author, authorAnalysis)
  };
}

/**
 * 处理分类搜索查询
 */
async function handleCategorySearch(client: ArxivSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const category = params.category;
  
  if (!category) {
    throw new Error('Category is required for category search');
  }
  
  const searchOptions = {
    maxResults: Math.min(limit, 30),
    subcategories: params.subcategories || false
  };
  
  const searchData = await client.searchByCategory(category, searchOptions);
  
  if (!searchData.papers || searchData.papers.length === 0) {
    return {
      type: 'category_search',
      query: originalQuery,
      category,
      papers: [],
      totalResults: 0,
      message: `No papers found in category "${category}"`
    };
  }

  // 分析分类趋势
  const categoryAnalysis = analyzeCategoryTrends(searchData.papers, category);
  
  return {
    type: 'category_search',
    query: originalQuery,
    category,
    papers: searchData.papers,
    totalResults: searchData.totalResults,
    analysis: categoryAnalysis,
    summary: generateCategorySummary(searchData.papers, category, categoryAnalysis)
  };
}

/**
 * 处理智能搜索
 */
async function handleSmartSearch(client: ArxivSearchClient, query: string, limit: number): Promise<any> {
  const searchData = await client.smartSearch(query, { maxResults: Math.min(limit, 20) });
  
  return {
    type: 'smart_search',
    query: query,
    result: searchData.result,
    searchType: searchData.type,
    summary: `Smart search completed for "${query}". Found ${searchData.type} results.`
  };
}

/**
 * 计算相关性分数
 */
function calculateRelevanceScore(paper: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配
  if (paper.title) {
    const titleLower = paper.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 3;
    });
  }
  
  // 摘要匹配
  if (paper.summary) {
    const summaryLower = paper.summary.toLowerCase();
    queryWords.forEach(word => {
      if (summaryLower.includes(word)) score += 1;
    });
  }
  
  // 分类匹配
  if (paper.categories) {
    queryWords.forEach(word => {
      paper.categories.forEach((cat: string) => {
        if (cat.toLowerCase().includes(word)) score += 2;
      });
    });
  }
  
  return score;
}

/**
 * 估算阅读时间
 */
function estimateReadingTime(summary: string): number {
  if (!summary) return 0;
  const words = summary.split(/\s+/).length;
  return Math.ceil(words / 200); // 假设每分钟200词
}

/**
 * 评估论文复杂度
 */
function assessPaperComplexity(paper: any): 'beginner' | 'intermediate' | 'advanced' {
  let complexityScore = 0;
  
  // 基于摘要长度
  if (paper.summary && paper.summary.length > 1000) complexityScore += 1;
  
  // 基于分类
  const advancedCategories = ['hep-th', 'math-ph', 'quant-ph'];
  if (paper.categories && paper.categories.some((cat: string) => advancedCategories.includes(cat))) {
    complexityScore += 2;
  }
  
  // 基于标题复杂度
  if (paper.title && paper.title.split(/\s+/).length > 10) complexityScore += 1;
  
  if (complexityScore >= 3) return 'advanced';
  if (complexityScore >= 1) return 'intermediate';
  return 'beginner';
}

/**
 * 获取顶级分类
 */
function getTopCategories(categories: string[]): string[] {
  if (!categories) return [];
  
  // 获取主分类（去掉子分类）
  const mainCategories = categories.map(cat => cat.split('.')[0]);
  
  // 去重并返回前3个
  return [...new Set(mainCategories)].slice(0, 3);
}

/**
 * 提取关键主题
 */
function extractKeyTopics(summary: string): string[] {
  if (!summary) return [];
  
  // 简单的关键词提取
  const words = summary.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4);
  
  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * 分析论文集合
 */
function analyzePapers(papers: any[]): any {
  if (papers.length === 0) return {};
  
  const analysis = {
    totalPapers: papers.length,
    averageComplexity: 'intermediate',
    topCategories: {} as Record<string, number>,
    yearDistribution: {} as Record<string, number>,
    averageRelevance: 0
  };
  
  // 统计分类分布
  papers.forEach(paper => {
    paper.topCategories?.forEach((cat: string) => {
      analysis.topCategories[cat] = (analysis.topCategories[cat] || 0) + 1;
    });
    
    // 统计年份分布
    const year = extractYear(paper.published);
    if (year) {
      analysis.yearDistribution[year] = (analysis.yearDistribution[year] || 0) + 1;
    }
  });
  
  // 计算平均相关性
  analysis.averageRelevance = papers.reduce((sum, paper) => sum + (paper.relevanceScore || 0), 0) / papers.length;
  
  return analysis;
}

/**
 * 分析作者研究
 */
function analyzeAuthorResearch(papers: any[], author: string): any {
  const analysis = {
    totalPapers: papers.length,
    researchAreas: {} as Record<string, number>,
    collaborationNetwork: [] as string[],
    publicationTrend: {} as Record<string, number>,
    firstAuthorPapers: 0
  };
  
  papers.forEach(paper => {
    // 统计研究领域
    paper.categories?.forEach((cat: string) => {
      const mainCat = cat.split('.')[0];
      analysis.researchAreas[mainCat] = (analysis.researchAreas[mainCat] || 0) + 1;
    });
    
    // 统计合作者
    paper.authors?.forEach((paperAuthor: string) => {
      if (paperAuthor !== author && !analysis.collaborationNetwork.includes(paperAuthor)) {
        analysis.collaborationNetwork.push(paperAuthor);
      }
    });
    
    // 统计发表趋势
    const year = extractYear(paper.published);
    if (year) {
      analysis.publicationTrend[year] = (analysis.publicationTrend[year] || 0) + 1;
    }
    
    // 统计第一作者论文
    if (isFirstAuthor(paper, author)) {
      analysis.firstAuthorPapers++;
    }
  });
  
  return analysis;
}

/**
 * 分析分类趋势
 */
function analyzeCategoryTrends(papers: any[], category: string): any {
  const analysis = {
    totalPapers: papers.length,
    recentTrends: {} as Record<string, number>,
    topAuthors: {} as Record<string, number>,
    relatedCategories: {} as Record<string, number>
  };
  
  papers.forEach(paper => {
    // 统计年份趋势
    const year = extractYear(paper.published);
    if (year) {
      analysis.recentTrends[year] = (analysis.recentTrends[year] || 0) + 1;
    }
    
    // 统计顶级作者
    paper.authors?.forEach((author: string) => {
      analysis.topAuthors[author] = (analysis.topAuthors[author] || 0) + 1;
    });
    
    // 统计相关分类
    paper.categories?.forEach((cat: string) => {
      if (cat !== category) {
        analysis.relatedCategories[cat] = (analysis.relatedCategories[cat] || 0) + 1;
      }
    });
  });
  
  return analysis;
}

/**
 * 辅助函数
 */
function extractYear(dateString: string): string | null {
  const match = dateString.match(/(\d{4})/);
  return match ? match[1] : null;
}

function isFirstAuthor(paper: any, author: string): boolean {
  return paper.authors && paper.authors.length > 0 && 
         paper.authors[0].toLowerCase().includes(author.toLowerCase());
}

function getCollaborators(paper: any, author: string): string[] {
  if (!paper.authors) return [];
  return paper.authors.filter((a: string) => !a.toLowerCase().includes(author.toLowerCase()));
}

function getRelatedCategories(categories: string[]): string[] {
  // 简化实现：返回相关的主分类
  const mainCats = categories.map(cat => cat.split('.')[0]);
  return [...new Set(mainCats)];
}

function generateCitation(paper: any): string {
  const authors = paper.authors ? paper.authors.slice(0, 3).join(', ') : 'Unknown';
  const year = extractYear(paper.published) || 'Unknown';
  return `${authors} (${year}). ${paper.title}. arXiv:${paper.id}`;
}

function generateSearchSummary(papers: any[], query: string): string {
  if (papers.length === 0) return `No papers found for "${query}"`;
  
  const topPaper = papers[0];
  return `Found ${papers.length} papers about "${query}". Top result: "${topPaper.title}" (${topPaper.id})`;
}

function generateAuthorSummary(papers: any[], author: string, analysis: any): string {
  const firstAuthorCount = analysis.firstAuthorPapers;
  const topArea = Object.keys(analysis.researchAreas)[0] || 'various fields';
  
  return `Found ${papers.length} papers by ${author}. ${firstAuthorCount} as first author. Primary research area: ${topArea}`;
}

function generateCategorySummary(papers: any[], category: string, analysis: any): string {
  const recentYear = Math.max(...Object.keys(analysis.recentTrends).map(Number));
  const recentCount = analysis.recentTrends[recentYear] || 0;
  
  return `Found ${papers.length} papers in ${category}. ${recentCount} papers published in ${recentYear}`;
}

/**
 * 工具注册信息
 */
export const arxivSearchTool = {
  name: 'arxiv_search',
  description: 'Search academic papers from arXiv with intelligent routing and advanced analysis',
  category: 'academic-search',
  source: 'arxiv.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for arXiv papers. Examples: "machine learning", "papers by Hinton", "cs.AI papers", "quantum computing 2024", "arXiv:2301.12345"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 50)',
        default: 10,
        minimum: 1,
        maximum: 50
      }
    },
    required: ['query']
  },
  execute: arxivSearch,
  examples: [
    {
      query: "machine learning",
      description: "Search for machine learning papers"
    },
    {
      query: "papers by Hinton",
      description: "Find papers by Geoffrey Hinton"
    },
    {
      query: "cs.AI papers",
      description: "Browse AI papers in computer science"
    },
    {
      query: "quantum computing 2024",
      description: "Find recent quantum computing papers"
    },
    {
      query: "arXiv:2301.12345",
      description: "Get details for a specific paper"
    },
    {
      query: "deep learning neural networks",
      description: "Search for deep learning and neural network papers"
    }
  ]
};
