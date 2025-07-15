import { PubmedSearchClient } from '../../api/clients/pubmed-search-client.js';
import { PubmedSearchRouter } from '../../utils/pubmed-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * PubMed 搜索工具
 * 支持医学论文搜索，智能路由到最合适的搜索方式
 */

const logger = new Logger('PubmedSearch');

export async function pubmedSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new PubmedSearchClient();
    const router = new PubmedSearchRouter();
    
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
    
    logger.info(`Processing PubMed search: ${args.query} -> ${route.intent}`);

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
        
      case 'mesh_search':
        result = await handleMeSHSearch(client, route.params, args.query, limit);
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
        source: 'PubMed',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('PubMed search failed:', error);
    return {
      success: false,
      error: `PubMed search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理一般搜索查询
 */
async function handleGeneralSearch(client: PubmedSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const searchParams = {
    retmax: Math.min(limit, 50),
    sort: params.sortBy || 'relevance',
    ...params
  };
  
  // 构建搜索查询
  let searchQuery = params.query || originalQuery;
  
  // 添加年份过滤
  if (params.year) {
    if (params.year.includes('-')) {
      const [startYear, endYear] = params.year.split('-');
      searchQuery += ` AND ${startYear}:${endYear}[pdat]`;
    } else {
      searchQuery += ` AND ${params.year}[pdat]`;
    }
  }
  
  // 添加文章类型过滤
  if (params.articleType) {
    searchQuery += ` AND ${params.articleType}[pt]`;
  }
  
  const searchData = await client.searchPapers(searchQuery, searchParams);
  
  if (!searchData.papers || searchData.papers.length === 0) {
    return {
      type: 'search',
      query: originalQuery,
      papers: [],
      totalResults: 0,
      message: `No PubMed papers found for "${originalQuery}"`
    };
  }

  // 增强搜索结果
  const enhancedPapers = searchData.papers.map((paper: any) => ({
    ...paper,
    relevanceScore: calculateRelevanceScore(paper, originalQuery),
    readingTime: estimateReadingTime(paper.abstract),
    impactLevel: assessImpactLevel(paper),
    medicalSpecialty: identifyMedicalSpecialty(paper.meshTerms)
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
async function handlePaperDetails(client: PubmedSearchClient, params: any, originalQuery: string): Promise<any> {
  const pmid = params.pmid;
  
  if (!pmid) {
    throw new Error('PMID is required for details query');
  }
  
  try {
    const paper = await client.getPaperDetails(pmid);
    
    // 增强论文信息
    const enhancedPaper = {
      ...paper,
      readingTime: estimateReadingTime(paper.abstract),
      impactLevel: assessImpactLevel(paper),
      medicalSpecialty: identifyMedicalSpecialty(paper.meshTerms),
      citationFormat: generateCitation(paper),
      keyTopics: extractKeyTopics(paper.abstract),
      clinicalRelevance: assessClinicalRelevance(paper)
    };
    
    return {
      type: 'paper_details',
      query: originalQuery,
      paper: enhancedPaper,
      summary: `Found details for paper "${paper.title}" (PMID: ${paper.pmid})`
    };
  } catch (error) {
    return {
      type: 'paper_details',
      query: originalQuery,
      paper: null,
      error: `Paper not found: ${pmid}`,
      suggestions: [`Try searching for: "${pmid.replace(/[^\w\s]/g, ' ').trim()}"`]
    };
  }
}

/**
 * 处理作者搜索查询
 */
async function handleAuthorSearch(client: PubmedSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const author = params.author;
  
  if (!author) {
    throw new Error('Author name is required for author search');
  }
  
  const searchOptions = {
    retmax: Math.min(limit, 30),
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
    authorPosition: getAuthorPosition(paper, author),
    yearPublished: extractYear(paper.publicationDate),
    medicalSpecialty: identifyMedicalSpecialty(paper.meshTerms)
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
 * 处理MeSH搜索查询
 */
async function handleMeSHSearch(client: PubmedSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const meshTerm = params.meshTerm;
  
  if (!meshTerm) {
    throw new Error('MeSH term is required for MeSH search');
  }
  
  const searchOptions = {
    retmax: Math.min(limit, 30),
    majorTopic: params.majorTopic || false
  };
  
  const searchData = await client.searchByMeSH(meshTerm, searchOptions);
  
  if (!searchData.papers || searchData.papers.length === 0) {
    return {
      type: 'mesh_search',
      query: originalQuery,
      meshTerm,
      papers: [],
      totalResults: 0,
      message: `No papers found for MeSH term "${meshTerm}"`
    };
  }

  // 分析MeSH主题趋势
  const meshAnalysis = analyzeMeSHTrends(searchData.papers, meshTerm);
  
  return {
    type: 'mesh_search',
    query: originalQuery,
    meshTerm,
    papers: searchData.papers,
    totalResults: searchData.totalResults,
    analysis: meshAnalysis,
    summary: generateMeSHSummary(searchData.papers, meshTerm, meshAnalysis)
  };
}

/**
 * 处理智能搜索
 */
async function handleSmartSearch(client: PubmedSearchClient, query: string, limit: number): Promise<any> {
  const searchData = await client.smartSearch(query, { retmax: Math.min(limit, 20) });
  
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
  if (paper.abstract) {
    const abstractLower = paper.abstract.toLowerCase();
    queryWords.forEach(word => {
      if (abstractLower.includes(word)) score += 1;
    });
  }
  
  // MeSH术语匹配
  if (paper.meshTerms) {
    queryWords.forEach(word => {
      paper.meshTerms.forEach((mesh: string) => {
        if (mesh.toLowerCase().includes(word)) score += 2;
      });
    });
  }
  
  return score;
}

/**
 * 估算阅读时间
 */
function estimateReadingTime(abstract: string): number {
  if (!abstract) return 0;
  const words = abstract.split(/\s+/).length;
  return Math.ceil(words / 200); // 假设每分钟200词
}

/**
 * 评估影响水平
 */
function assessImpactLevel(paper: any): 'high' | 'medium' | 'low' {
  let impactScore = 0;
  
  // 基于期刊
  const highImpactJournals = ['Nature', 'Science', 'Cell', 'Lancet', 'NEJM', 'JAMA'];
  if (paper.journal && highImpactJournals.some(journal => 
    paper.journal.toLowerCase().includes(journal.toLowerCase())
  )) {
    impactScore += 3;
  }
  
  // 基于文章类型
  if (paper.articleType) {
    if (paper.articleType.includes('Meta-Analysis') || paper.articleType.includes('Systematic Review')) {
      impactScore += 2;
    } else if (paper.articleType.includes('Randomized Controlled Trial')) {
      impactScore += 2;
    }
  }
  
  // 基于最近程度
  const daysSince = calculateDaysSince(paper.publicationDate);
  if (daysSince <= 365) impactScore += 1; // 一年内
  
  if (impactScore >= 4) return 'high';
  if (impactScore >= 2) return 'medium';
  return 'low';
}

/**
 * 识别医学专科
 */
function identifyMedicalSpecialty(meshTerms: string[]): string {
  if (!meshTerms || meshTerms.length === 0) return 'General Medicine';
  
  const specialtyMapping: Record<string, string> = {
    'Neoplasms': 'Oncology',
    'Heart Diseases': 'Cardiology',
    'Nervous System Diseases': 'Neurology',
    'Mental Disorders': 'Psychiatry',
    'Diabetes Mellitus': 'Endocrinology',
    'Infectious Diseases': 'Infectious Disease',
    'Surgery': 'Surgery',
    'Pediatrics': 'Pediatrics'
  };
  
  for (const mesh of meshTerms) {
    for (const [key, specialty] of Object.entries(specialtyMapping)) {
      if (mesh.includes(key)) {
        return specialty;
      }
    }
  }
  
  return 'General Medicine';
}

/**
 * 提取关键主题
 */
function extractKeyTopics(abstract: string): string[] {
  if (!abstract) return [];
  
  // 医学关键词提取
  const medicalTerms = abstract.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4);
  
  // 统计词频
  const wordCount: Record<string, number> = {};
  medicalTerms.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // 排除常见医学停用词
  const medicalStopWords = new Set([
    'study', 'patient', 'treatment', 'method', 'result', 'conclusion',
    'analysis', 'clinical', 'medical', 'disease', 'therapy', 'diagnosis'
  ]);
  
  return Object.entries(wordCount)
    .filter(([word]) => !medicalStopWords.has(word))
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 6)
    .map(([word]) => word);
}

/**
 * 评估临床相关性
 */
function assessClinicalRelevance(paper: any): 'high' | 'medium' | 'low' {
  let relevanceScore = 0;
  
  // 基于文章类型
  if (paper.articleType) {
    if (paper.articleType.includes('Clinical Trial') || 
        paper.articleType.includes('Case Reports')) {
      relevanceScore += 2;
    }
  }
  
  // 基于MeSH术语
  const clinicalTerms = ['Therapy', 'Diagnosis', 'Treatment', 'Clinical'];
  if (paper.meshTerms) {
    clinicalTerms.forEach(term => {
      if (paper.meshTerms.some((mesh: string) => mesh.includes(term))) {
        relevanceScore += 1;
      }
    });
  }
  
  if (relevanceScore >= 3) return 'high';
  if (relevanceScore >= 1) return 'medium';
  return 'low';
}

/**
 * 分析论文集合
 */
function analyzePapers(papers: any[]): any {
  if (papers.length === 0) return {};
  
  const analysis = {
    totalPapers: papers.length,
    averageImpact: 'medium',
    topSpecialties: {} as Record<string, number>,
    yearDistribution: {} as Record<string, number>,
    averageRelevance: 0
  };
  
  // 统计专科分布
  papers.forEach(paper => {
    const specialty = paper.medicalSpecialty;
    if (specialty) {
      analysis.topSpecialties[specialty] = (analysis.topSpecialties[specialty] || 0) + 1;
    }
    
    // 统计年份分布
    const year = extractYear(paper.publicationDate);
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
    medicalSpecialties: {} as Record<string, number>,
    publicationTrend: {} as Record<string, number>,
    firstAuthorPapers: 0,
    recentActivity: 0
  };
  
  papers.forEach(paper => {
    // 统计医学专科
    const specialty = identifyMedicalSpecialty(paper.meshTerms);
    analysis.medicalSpecialties[specialty] = (analysis.medicalSpecialties[specialty] || 0) + 1;
    
    // 统计发表趋势
    const year = extractYear(paper.publicationDate);
    if (year) {
      analysis.publicationTrend[year] = (analysis.publicationTrend[year] || 0) + 1;
    }
    
    // 统计第一作者论文
    if (isFirstAuthor(paper, author)) {
      analysis.firstAuthorPapers++;
    }
    
    // 最近活动
    const daysSince = calculateDaysSince(paper.publicationDate);
    if (daysSince <= 365) analysis.recentActivity++;
  });
  
  return analysis;
}

/**
 * 分析MeSH趋势
 */
function analyzeMeSHTrends(papers: any[], meshTerm: string): any {
  const analysis = {
    totalPapers: papers.length,
    recentTrends: {} as Record<string, number>,
    topJournals: {} as Record<string, number>,
    relatedMeSH: {} as Record<string, number>
  };
  
  papers.forEach(paper => {
    // 统计年份趋势
    const year = extractYear(paper.publicationDate);
    if (year) {
      analysis.recentTrends[year] = (analysis.recentTrends[year] || 0) + 1;
    }
    
    // 统计顶级期刊
    if (paper.journal) {
      analysis.topJournals[paper.journal] = (analysis.topJournals[paper.journal] || 0) + 1;
    }
    
    // 统计相关MeSH
    if (paper.meshTerms) {
      paper.meshTerms.forEach((mesh: string) => {
        if (mesh !== meshTerm) {
          analysis.relatedMeSH[mesh] = (analysis.relatedMeSH[mesh] || 0) + 1;
        }
      });
    }
  });
  
  return analysis;
}

/**
 * 辅助函数
 */
function extractYear(dateString: string): string | null {
  if (!dateString) return null;
  const match = dateString.match(/(\d{4})/);
  return match ? match[1] : null;
}

function calculateDaysSince(dateString: string): number {
  if (!dateString) return Infinity;
  const publishDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - publishDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isFirstAuthor(paper: any, author: string): boolean {
  if (!paper.authors || paper.authors.length === 0) return false;
  
  const firstAuthor = paper.authors[0].toLowerCase();
  const searchAuthor = author.toLowerCase();
  
  return firstAuthor.includes(searchAuthor) || searchAuthor.includes(firstAuthor);
}

function getAuthorPosition(paper: any, author: string): any {
  if (!paper.authors || paper.authors.length === 0) {
    return { position: 'unknown', total: 0 };
  }
  
  const searchAuthor = author.toLowerCase();
  const position = paper.authors.findIndex((a: string) => 
    a.toLowerCase().includes(searchAuthor) || searchAuthor.includes(a.toLowerCase())
  );
  
  if (position === -1) {
    return { position: 'not_found', total: paper.authors.length };
  }
  
  return {
    position: position + 1, // 1-based
    total: paper.authors.length,
    isFirst: position === 0,
    isLast: position === paper.authors.length - 1
  };
}

function generateCitation(paper: any): string {
  const authors = paper.authors ? paper.authors.slice(0, 3).join(', ') : 'Unknown';
  const year = extractYear(paper.publicationDate) || 'Unknown';
  return `${authors} (${year}). ${paper.title}. ${paper.journal}. PMID: ${paper.pmid}`;
}

function generateSearchSummary(papers: any[], query: string): string {
  if (papers.length === 0) return `No papers found for "${query}"`;
  
  const topPaper = papers[0];
  const specialty = papers[0]?.medicalSpecialty || 'medical';
  
  return `Found ${papers.length} ${specialty} papers about "${query}". Top result: "${topPaper.title}" (PMID: ${topPaper.pmid})`;
}

function generateAuthorSummary(papers: any[], author: string, analysis: any): string {
  const firstAuthorCount = analysis.firstAuthorPapers;
  const topSpecialty = Object.keys(analysis.medicalSpecialties)[0] || 'medical research';
  
  return `Found ${papers.length} papers by ${author}. ${firstAuthorCount} as first author. Primary specialty: ${topSpecialty}`;
}

function generateMeSHSummary(papers: any[], meshTerm: string, analysis: any): string {
  const recentYear = Math.max(...Object.keys(analysis.recentTrends).map(Number));
  const recentCount = analysis.recentTrends[recentYear] || 0;
  
  return `Found ${papers.length} papers on ${meshTerm}. ${recentCount} papers published in ${recentYear}`;
}

/**
 * 工具注册信息
 */
export const pubmedSearchTool = {
  name: 'pubmed_search',
  description: 'Search medical papers from PubMed with intelligent routing and advanced medical analysis',
  category: 'medical-search',
  source: 'pubmed.ncbi.nlm.nih.gov',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for PubMed papers. Examples: "COVID-19", "papers by Smith", "cancer treatment", "PMID:12345678"'
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
  execute: pubmedSearch,
  examples: [
    {
      query: "COVID-19",
      description: "Search for COVID-19 related medical papers"
    },
    {
      query: "papers by Smith",
      description: "Find papers by author Smith"
    },
    {
      query: "cancer treatment",
      description: "Search for cancer treatment research"
    },
    {
      query: "PMID:12345678",
      description: "Get details for a specific paper"
    },
    {
      query: "diabetes therapy 2024",
      description: "Find recent diabetes therapy papers"
    },
    {
      query: "hypertension diagnosis",
      description: "Search for hypertension diagnosis papers"
    }
  ]
};
