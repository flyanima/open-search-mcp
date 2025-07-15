import { ArxivSearchClient } from '../../api/clients/arxiv-search-client.js';
import { ArxivSearchRouter } from '../../utils/arxiv-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * arXiv 论文详情工具
 * 专门用于获取特定arXiv论文的详细信息
 */

const logger = new Logger('ArxivPaperDetails');

export async function arxivPaperDetails(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing arXiv paper details: ${args.query}`);

    // 提取论文ID
    const paperId = extractPaperId(args.query);
    
    if (!paperId) {
      return {
        success: false,
        error: 'No valid arXiv ID found in query. Please provide an arXiv ID like "2301.12345" or "arXiv:2301.12345"'
      };
    }
    
    const result = await handlePaperDetailsRequest(client, paperId, args.query);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'paper_details',
        result,
        source: 'arXiv',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('arXiv paper details failed:', error);
    return {
      success: false,
      error: `arXiv paper details failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理论文详情请求
 */
async function handlePaperDetailsRequest(client: ArxivSearchClient, paperId: string, originalQuery: string): Promise<any> {
  try {
    // 验证arXiv ID格式
    if (!client.validateArxivId(paperId)) {
      return {
        type: 'paper_details',
        query: originalQuery,
        paper: null,
        error: `Invalid arXiv ID format: ${paperId}`,
        suggestions: [
          'Use format: YYMM.NNNN (e.g., 2301.12345)',
          'Include version if needed: 2301.12345v1',
          'Try searching for the paper title instead'
        ]
      };
    }
    
    // 获取论文详情
    const paper = await client.getPaperDetails(paperId);
    
    // 增强论文信息
    const enhancedPaper = await enhancePaperDetails(paper, client);
    
    return {
      type: 'paper_details',
      query: originalQuery,
      paper: enhancedPaper,
      summary: generatePaperSummary(enhancedPaper)
    };
    
  } catch (error) {
    // 如果论文不存在，提供建议
    if (error instanceof Error && error.message.includes('not found')) {
      return {
        type: 'paper_details',
        query: originalQuery,
        paper: null,
        error: `Paper not found: ${paperId}`,
        suggestions: await generateSearchSuggestions(client, paperId)
      };
    }
    
    throw error;
  }
}

/**
 * 增强论文详情信息
 */
async function enhancePaperDetails(paper: any, client: ArxivSearchClient): Promise<any> {
  const enhanced = {
    ...paper,
    
    // 基础分析
    readingTime: estimateReadingTime(paper.summary),
    complexity: assessPaperComplexity(paper),
    wordCount: paper.summary ? paper.summary.split(/\s+/).length : 0,
    
    // 内容分析
    keyTopics: extractKeyTopics(paper.summary),
    researchArea: identifyResearchArea(paper.categories),
    methodology: identifyMethodology(paper.summary),
    
    // 元数据增强
    citationFormat: generateCitationFormats(paper),
    relatedCategories: getRelatedCategories(paper.categories),
    authorAnalysis: analyzeAuthors(paper.authors),
    
    // 时间分析
    publicationYear: extractYear(paper.published),
    daysSincePublication: calculateDaysSince(paper.published),
    isRecent: isRecentPaper(paper.published),
    
    // 质量指标
    qualityIndicators: assessPaperQuality(paper),
    
    // 实用信息
    downloadInfo: {
      pdfUrl: paper.pdfUrl,
      abstractUrl: paper.abstractUrl,
      pdfSize: 'Unknown', // arXiv不提供文件大小信息
      format: 'PDF'
    }
  };
  
  // 尝试获取相关论文（如果时间允许）
  try {
    const relatedPapers = await findRelatedPapers(client, paper);
    enhanced.relatedPapers = relatedPapers;
  } catch (error) {
    logger.warn('Failed to get related papers:', error);
    enhanced.relatedPapers = [];
  }
  
  return enhanced;
}

/**
 * 查找相关论文
 */
async function findRelatedPapers(client: ArxivSearchClient, paper: any): Promise<any[]> {
  // 使用主要分类搜索相关论文
  const mainCategory = paper.categories[0];
  if (!mainCategory) return [];
  
  try {
    const result = await client.searchByCategory(mainCategory, { maxResults: 3 });
    
    // 过滤掉当前论文
    return result.papers
      .filter((p: any) => p.id !== paper.id)
      .slice(0, 3)
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        authors: p.authors.slice(0, 2),
        published: p.published
      }));
  } catch (error) {
    return [];
  }
}

/**
 * 提取论文ID
 */
function extractPaperId(query: string): string | null {
  // arXiv ID格式: YYMM.NNNN[vN] 或 subject-class/YYMMnnn
  const patterns = [
    /(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)/i,
    /(?:arxiv:)?([a-z-]+\/\d{7})/i
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // 如果没有找到标准格式，尝试提取数字序列
  const numberMatch = query.match(/(\d{4}\.\d{4,5})/);
  if (numberMatch) {
    return numberMatch[1];
  }
  
  return null;
}

/**
 * 估算阅读时间
 */
function estimateReadingTime(summary: string): number {
  if (!summary) return 0;
  const words = summary.split(/\s+/).length;
  // 学术论文阅读速度较慢，假设每分钟150词
  return Math.ceil(words / 150);
}

/**
 * 评估论文复杂度
 */
function assessPaperComplexity(paper: any): 'beginner' | 'intermediate' | 'advanced' {
  let complexityScore = 0;
  
  // 基于摘要长度和复杂度
  if (paper.summary) {
    const words = paper.summary.split(/\s+/).length;
    if (words > 200) complexityScore += 1;
    
    // 检查技术术语密度
    const technicalTerms = ['algorithm', 'optimization', 'neural', 'quantum', 'theorem', 'proof', 'analysis'];
    const termCount = technicalTerms.filter(term => 
      paper.summary.toLowerCase().includes(term)
    ).length;
    complexityScore += Math.min(termCount, 3);
  }
  
  // 基于分类
  const advancedCategories = ['hep-th', 'math-ph', 'quant-ph', 'gr-qc'];
  if (paper.categories && paper.categories.some((cat: string) => 
    advancedCategories.some(advCat => cat.startsWith(advCat))
  )) {
    complexityScore += 2;
  }
  
  // 基于作者数量（更多作者可能意味着更复杂的研究）
  if (paper.authors && paper.authors.length > 5) {
    complexityScore += 1;
  }
  
  if (complexityScore >= 4) return 'advanced';
  if (complexityScore >= 2) return 'intermediate';
  return 'beginner';
}

/**
 * 提取关键主题
 */
function extractKeyTopics(summary: string): string[] {
  if (!summary) return [];
  
  // 学术关键词提取
  const academicTerms = summary.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4);
  
  // 统计词频
  const wordCount: Record<string, number> = {};
  academicTerms.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  // 排除常见学术停用词
  const academicStopWords = new Set([
    'paper', 'study', 'research', 'method', 'approach', 'results', 'conclusion',
    'analysis', 'present', 'propose', 'show', 'demonstrate', 'investigate'
  ]);
  
  return Object.entries(wordCount)
    .filter(([word]) => !academicStopWords.has(word))
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 8)
    .map(([word]) => word);
}

/**
 * 识别研究领域
 */
function identifyResearchArea(categories: string[]): string {
  if (!categories || categories.length === 0) return 'Unknown';
  
  const areaMapping: Record<string, string> = {
    'cs.AI': 'Artificial Intelligence',
    'cs.LG': 'Machine Learning',
    'cs.CV': 'Computer Vision',
    'cs.CL': 'Natural Language Processing',
    'cs.RO': 'Robotics',
    'cs.CR': 'Cryptography',
    'math': 'Mathematics',
    'stat': 'Statistics',
    'physics': 'Physics',
    'quant-ph': 'Quantum Physics',
    'astro-ph': 'Astrophysics',
    'q-bio': 'Quantitative Biology',
    'q-fin': 'Quantitative Finance'
  };
  
  const mainCategory = categories[0];
  for (const [key, area] of Object.entries(areaMapping)) {
    if (mainCategory.startsWith(key)) {
      return area;
    }
  }
  
  return mainCategory;
}

/**
 * 识别研究方法
 */
function identifyMethodology(summary: string): string[] {
  if (!summary) return [];
  
  const methodologies = [
    'theoretical', 'empirical', 'experimental', 'simulation', 'survey',
    'case study', 'comparative', 'statistical', 'machine learning',
    'deep learning', 'reinforcement learning', 'optimization'
  ];
  
  const summaryLower = summary.toLowerCase();
  return methodologies.filter(method => summaryLower.includes(method));
}

/**
 * 生成引用格式
 */
function generateCitationFormats(paper: any): any {
  const authors = paper.authors ? paper.authors.slice(0, 3).join(', ') : 'Unknown';
  const year = extractYear(paper.published) || 'Unknown';
  const title = paper.title || 'Unknown Title';
  const id = paper.id || 'Unknown';
  
  return {
    apa: `${authors} (${year}). ${title}. arXiv preprint arXiv:${id}.`,
    mla: `${authors}. "${title}." arXiv preprint arXiv:${id} (${year}).`,
    chicago: `${authors}. "${title}." arXiv preprint arXiv:${id}, ${year}.`,
    bibtex: `@article{${id.replace('.', '')},
  title={${title}},
  author={${authors}},
  journal={arXiv preprint arXiv:${id}},
  year={${year}}
}`
  };
}

/**
 * 分析作者信息
 */
function analyzeAuthors(authors: string[]): any {
  if (!authors || authors.length === 0) {
    return { count: 0, type: 'unknown' };
  }
  
  const count = authors.length;
  let type = 'solo';
  
  if (count === 1) type = 'solo';
  else if (count <= 3) type = 'small_team';
  else if (count <= 10) type = 'medium_team';
  else type = 'large_collaboration';
  
  return {
    count,
    type,
    firstAuthor: authors[0],
    lastAuthor: authors[authors.length - 1],
    isCollaboration: count > 1
  };
}

/**
 * 评估论文质量指标
 */
function assessPaperQuality(paper: any): any {
  const indicators = {
    score: 0,
    factors: [] as string[],
    level: 'Basic' as string
  };
  
  // 摘要质量
  if (paper.summary && paper.summary.length > 500) {
    indicators.score += 20;
    indicators.factors.push('Comprehensive abstract');
  }
  
  // 作者数量（适中的合作）
  if (paper.authors && paper.authors.length >= 2 && paper.authors.length <= 8) {
    indicators.score += 15;
    indicators.factors.push('Collaborative research');
  }
  
  // 分类明确性
  if (paper.categories && paper.categories.length > 0) {
    indicators.score += 10;
    indicators.factors.push('Clear categorization');
  }
  
  // 最近发表
  if (isRecentPaper(paper.published)) {
    indicators.score += 15;
    indicators.factors.push('Recent publication');
  }
  
  // 有DOI或期刊引用
  if (paper.doi || paper.journalRef) {
    indicators.score += 25;
    indicators.factors.push('Published or accepted');
  }
  
  // 有评论信息
  if (paper.comments) {
    indicators.score += 15;
    indicators.factors.push('Additional metadata');
  }
  
  // 质量等级
  if (indicators.score >= 70) indicators.level = 'High';
  else if (indicators.score >= 40) indicators.level = 'Medium';
  else indicators.level = 'Basic';
  
  return indicators;
}

/**
 * 辅助函数
 */
function extractYear(dateString: string): string | null {
  const match = dateString.match(/(\d{4})/);
  return match ? match[1] : null;
}

function calculateDaysSince(dateString: string): number {
  const publishDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - publishDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isRecentPaper(dateString: string): boolean {
  const days = calculateDaysSince(dateString);
  return days <= 365; // 一年内算作最近
}

function getRelatedCategories(categories: string[]): string[] {
  if (!categories) return [];
  
  // 获取主分类
  const mainCategories = categories.map(cat => cat.split('.')[0]);
  return [...new Set(mainCategories)];
}

/**
 * 生成搜索建议
 */
async function generateSearchSuggestions(client: ArxivSearchClient, paperId: string): Promise<string[]> {
  const suggestions: string[] = [];
  
  // 基于ID的部分匹配
  const idParts = paperId.split('.');
  if (idParts.length >= 2) {
    suggestions.push(`Try searching for: "${idParts[0]}.${idParts[1].substring(0, 2)}*"`);
  }
  
  // 通用建议
  suggestions.push('Check the arXiv ID format (YYMM.NNNN)');
  suggestions.push('Try searching by paper title or author');
  suggestions.push('Browse recent papers in relevant categories');
  
  return suggestions;
}

/**
 * 生成论文摘要
 */
function generatePaperSummary(paper: any): string {
  const year = paper.publicationYear || 'Unknown';
  const area = paper.researchArea || 'Unknown';
  const complexity = paper.complexity || 'unknown';
  const authorCount = paper.authorAnalysis?.count || 0;
  
  return `Found paper "${paper.title}" (${paper.id}) from ${year}. Research area: ${area}. Complexity: ${complexity}. Authors: ${authorCount}. Reading time: ~${paper.readingTime} minutes.`;
}

/**
 * 工具注册信息
 */
export const arxivPaperDetailsTool = {
  name: 'arxiv_paper_details',
  description: 'Get detailed information about specific arXiv papers with comprehensive analysis',
  category: 'academic-search',
  source: 'arxiv.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'arXiv paper ID or query containing arXiv ID. Examples: "2301.12345", "arXiv:2301.12345", "paper details 2301.12345"'
      }
    },
    required: ['query']
  },
  execute: arxivPaperDetails,
  examples: [
    {
      query: "2301.12345",
      description: "Get details for arXiv paper 2301.12345"
    },
    {
      query: "arXiv:2301.12345",
      description: "Get details using full arXiv format"
    },
    {
      query: "paper details 2301.12345",
      description: "Get paper details with natural language"
    },
    {
      query: "abstract 1909.03550",
      description: "Get abstract and details for specific paper"
    }
  ]
};
