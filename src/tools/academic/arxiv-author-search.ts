import { ArxivSearchClient } from '../../api/clients/arxiv-search-client.js';
import { ArxivSearchRouter } from '../../utils/arxiv-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * arXiv 作者搜索工具
 * 专门用于按作者搜索arXiv论文并分析研究模式
 */

const logger = new Logger('ArxivAuthorSearch');

export async function arxivAuthorSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing arXiv author search: ${args.query}`);

    // 提取作者名
    const author = extractAuthor(args.query);
    
    if (!author) {
      return {
        success: false,
        error: 'No author name found in query. Please provide an author name like "papers by Hinton" or "author:LeCun"'
      };
    }
    
    const limit = args.limit || 20;
    const result = await handleAuthorSearchRequest(client, author, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'author_search',
        result,
        source: 'arXiv',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('arXiv author search failed:', error);
    return {
      success: false,
      error: `arXiv author search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理作者搜索请求
 */
async function handleAuthorSearchRequest(client: ArxivSearchClient, author: string, originalQuery: string, limit: number): Promise<any> {
  try {
    // 检查是否需要精确匹配
    const exactMatch = originalQuery.includes('"') || originalQuery.includes('exact');
    
    const searchOptions = {
      maxResults: Math.min(limit, 50),
      exactMatch
    };
    
    const searchData = await client.searchByAuthor(author, searchOptions);
    
    if (!searchData.papers || searchData.papers.length === 0) {
      return {
        type: 'author_search',
        query: originalQuery,
        author,
        papers: [],
        totalResults: 0,
        message: `No papers found for author "${author}"`,
        suggestions: generateAuthorSuggestions(author)
      };
    }

    // 增强论文信息
    const enhancedPapers = searchData.papers.map((paper: any) => ({
      ...paper,
      isFirstAuthor: isFirstAuthor(paper, author),
      authorPosition: getAuthorPosition(paper, author),
      collaborators: getCollaborators(paper, author),
      yearPublished: extractYear(paper.published),
      relevanceToAuthor: calculateAuthorRelevance(paper, author),
      researchArea: identifyResearchArea(paper.categories)
    }));

    // 按作者相关性和时间排序
    enhancedPapers.sort((a: any, b: any) => {
      // 第一作者论文优先
      if (a.isFirstAuthor !== b.isFirstAuthor) {
        return a.isFirstAuthor ? -1 : 1;
      }
      // 然后按时间排序
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });

    // 分析作者的研究模式
    const authorAnalysis = analyzeAuthorResearch(enhancedPapers, author);
    
    // 生成研究时间线
    const timeline = generateResearchTimeline(enhancedPapers);
    
    // 分析合作网络
    const collaborationNetwork = analyzeCollaborationNetwork(enhancedPapers, author);

    return {
      type: 'author_search',
      query: originalQuery,
      author,
      papers: enhancedPapers,
      totalResults: searchData.totalResults,
      analysis: {
        ...authorAnalysis,
        timeline,
        collaborationNetwork
      },
      summary: generateAuthorSummary(enhancedPapers, author, authorAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 提取作者名
 */
function extractAuthor(query: string): string | null {
  const authorPatterns = [
    /papers by\s+(.+)/i,
    /author:\s*(.+)/i,
    /by\s+(.+)/i,
    /researcher\s+(.+)/i,
    /publications by\s+(.+)/i,
    /works by\s+(.+)/i,
    /written by\s+(.+)/i
  ];
  
  for (const pattern of authorPatterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1].trim().replace(/['"]/g, '');
    }
  }
  
  // 如果没有找到模式，检查是否整个查询就是作者名
  const cleanQuery = query.trim().replace(/['"]/g, '');
  if (cleanQuery.length > 0 && !cleanQuery.includes(' ') && cleanQuery.length < 50) {
    return cleanQuery;
  }
  
  return null;
}

/**
 * 判断是否为第一作者
 */
function isFirstAuthor(paper: any, author: string): boolean {
  if (!paper.authors || paper.authors.length === 0) return false;
  
  const firstAuthor = paper.authors[0].toLowerCase();
  const searchAuthor = author.toLowerCase();
  
  return firstAuthor.includes(searchAuthor) || searchAuthor.includes(firstAuthor);
}

/**
 * 获取作者在论文中的位置
 */
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
    isLast: position === paper.authors.length - 1,
    isCorresponding: position === paper.authors.length - 1 // 通常最后一个作者是通讯作者
  };
}

/**
 * 获取合作者
 */
function getCollaborators(paper: any, author: string): string[] {
  if (!paper.authors) return [];
  
  const searchAuthor = author.toLowerCase();
  return paper.authors.filter((a: string) => 
    !a.toLowerCase().includes(searchAuthor) && !searchAuthor.includes(a.toLowerCase())
  );
}

/**
 * 计算作者相关性
 */
function calculateAuthorRelevance(paper: any, author: string): number {
  let score = 0;
  
  // 第一作者加分最多
  if (isFirstAuthor(paper, author)) {
    score += 50;
  } else {
    // 其他位置根据位置给分
    const position = getAuthorPosition(paper, author);
    if (position.position !== 'unknown' && position.position !== 'not_found') {
      score += Math.max(10, 30 - (position.position as number) * 5);
    }
  }
  
  // 作者数量少的论文相关性更高
  if (paper.authors && paper.authors.length <= 3) {
    score += 20;
  } else if (paper.authors && paper.authors.length <= 5) {
    score += 10;
  }
  
  // 最近的论文相关性更高
  const daysSince = calculateDaysSince(paper.published);
  if (daysSince <= 365) score += 15;
  else if (daysSince <= 1095) score += 10; // 3年内
  
  return Math.min(score, 100);
}

/**
 * 分析作者研究模式
 */
function analyzeAuthorResearch(papers: any[], author: string): any {
  const analysis = {
    totalPapers: papers.length,
    firstAuthorPapers: 0,
    lastAuthorPapers: 0,
    soloAuthorPapers: 0,
    
    // 研究领域分析
    researchAreas: {} as Record<string, number>,
    primaryArea: '',
    
    // 时间分析
    publicationTrend: {} as Record<string, number>,
    mostProductiveYear: '',
    careerSpan: 0,
    
    // 合作分析
    totalCollaborators: 0,
    frequentCollaborators: {} as Record<string, number>,
    averageCoauthors: 0,
    
    // 影响力指标
    recentActivity: 0, // 最近一年的论文数
    consistentPublisher: false,
    
    // 研究模式
    researchPattern: 'unknown' as string
  };
  
  const collaboratorSet = new Set<string>();
  let totalCoauthors = 0;
  
  papers.forEach(paper => {
    const year = extractYear(paper.published);
    if (year) {
      analysis.publicationTrend[year] = (analysis.publicationTrend[year] || 0) + 1;
    }
    
    // 作者位置分析
    if (paper.isFirstAuthor) analysis.firstAuthorPapers++;
    if (paper.authorPosition?.isLast) analysis.lastAuthorPapers++;
    if (paper.authors && paper.authors.length === 1) analysis.soloAuthorPapers++;
    
    // 研究领域分析
    if (paper.researchArea) {
      analysis.researchAreas[paper.researchArea] = (analysis.researchAreas[paper.researchArea] || 0) + 1;
    }
    
    // 合作者分析
    if (paper.collaborators) {
      paper.collaborators.forEach((collab: string) => {
        collaboratorSet.add(collab);
        analysis.frequentCollaborators[collab] = (analysis.frequentCollaborators[collab] || 0) + 1;
      });
      totalCoauthors += paper.collaborators.length;
    }
    
    // 最近活动
    const daysSince = calculateDaysSince(paper.published);
    if (daysSince <= 365) analysis.recentActivity++;
  });
  
  // 计算衍生指标
  analysis.totalCollaborators = collaboratorSet.size;
  analysis.averageCoauthors = papers.length > 0 ? totalCoauthors / papers.length : 0;
  
  // 找出主要研究领域
  const sortedAreas = Object.entries(analysis.researchAreas)
    .sort(([,a], [,b]) => (b as number) - (a as number));
  analysis.primaryArea = sortedAreas[0]?.[0] || 'Unknown';
  
  // 找出最高产年份
  const sortedYears = Object.entries(analysis.publicationTrend)
    .sort(([,a], [,b]) => (b as number) - (a as number));
  analysis.mostProductiveYear = sortedYears[0]?.[0] || 'Unknown';
  
  // 计算职业生涯跨度
  const years = Object.keys(analysis.publicationTrend).map(Number).sort();
  if (years.length > 1) {
    analysis.careerSpan = years[years.length - 1] - years[0];
  }
  
  // 判断是否为持续发表者
  analysis.consistentPublisher = years.length >= 3 && analysis.careerSpan >= 2;
  
  // 分析研究模式
  analysis.researchPattern = identifyResearchPattern(analysis);
  
  return analysis;
}

/**
 * 识别研究模式
 */
function identifyResearchPattern(analysis: any): string {
  const firstAuthorRatio = analysis.firstAuthorPapers / analysis.totalPapers;
  const lastAuthorRatio = analysis.lastAuthorPapers / analysis.totalPapers;
  const soloRatio = analysis.soloAuthorPapers / analysis.totalPapers;
  
  if (soloRatio > 0.5) return 'Independent Researcher';
  if (firstAuthorRatio > 0.6) return 'Lead Researcher';
  if (lastAuthorRatio > 0.4) return 'Senior Researcher/PI';
  if (analysis.averageCoauthors > 5) return 'Collaborative Researcher';
  if (analysis.recentActivity > 5) return 'Highly Active Researcher';
  if (analysis.consistentPublisher) return 'Consistent Publisher';
  
  return 'Emerging Researcher';
}

/**
 * 生成研究时间线
 */
function generateResearchTimeline(papers: any[]): any[] {
  const timeline: any[] = [];
  
  // 按年份分组
  const yearGroups: Record<string, any[]> = {};
  papers.forEach(paper => {
    const year = extractYear(paper.published);
    if (year) {
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(paper);
    }
  });
  
  // 生成时间线条目
  Object.entries(yearGroups)
    .sort(([a], [b]) => parseInt(b) - parseInt(a)) // 最新的在前
    .forEach(([year, yearPapers]) => {
      const firstAuthorCount = yearPapers.filter(p => p.isFirstAuthor).length;
      const areas = [...new Set(yearPapers.map(p => p.researchArea).filter(Boolean))];
      
      timeline.push({
        year: parseInt(year),
        paperCount: yearPapers.length,
        firstAuthorCount,
        researchAreas: areas,
        notablePapers: yearPapers
          .filter(p => p.isFirstAuthor)
          .slice(0, 2)
          .map(p => ({ id: p.id, title: p.title }))
      });
    });
  
  return timeline;
}

/**
 * 分析合作网络
 */
function analyzeCollaborationNetwork(papers: any[], author: string): any {
  const network = {
    totalCollaborators: 0,
    frequentCollaborators: [] as any[],
    institutionalCollaborations: [] as string[],
    internationalCollaborations: 0,
    collaborationPattern: 'unknown' as string
  };
  
  const collaboratorCount: Record<string, number> = {};
  
  papers.forEach(paper => {
    if (paper.collaborators) {
      paper.collaborators.forEach((collab: string) => {
        collaboratorCount[collab] = (collaboratorCount[collab] || 0) + 1;
      });
    }
  });
  
  network.totalCollaborators = Object.keys(collaboratorCount).length;
  
  // 找出频繁合作者（合作3次以上）
  network.frequentCollaborators = Object.entries(collaboratorCount)
    .filter(([, count]) => (count as number) >= 3)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10)
    .map(([name, count]) => ({ name, collaborations: count }));
  
  // 分析合作模式
  const avgCollaborators = papers.reduce((sum, p) => sum + (p.collaborators?.length || 0), 0) / papers.length;
  
  if (avgCollaborators < 2) network.collaborationPattern = 'Mostly Solo';
  else if (avgCollaborators < 5) network.collaborationPattern = 'Small Teams';
  else if (avgCollaborators < 10) network.collaborationPattern = 'Medium Teams';
  else network.collaborationPattern = 'Large Collaborations';
  
  return network;
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

function identifyResearchArea(categories: string[]): string {
  if (!categories || categories.length === 0) return 'Unknown';
  
  const areaMapping: Record<string, string> = {
    'cs.AI': 'Artificial Intelligence',
    'cs.LG': 'Machine Learning',
    'cs.CV': 'Computer Vision',
    'cs.CL': 'Natural Language Processing',
    'cs.RO': 'Robotics',
    'math': 'Mathematics',
    'stat': 'Statistics',
    'physics': 'Physics',
    'quant-ph': 'Quantum Physics'
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
 * 生成作者建议
 */
function generateAuthorSuggestions(author: string): string[] {
  return [
    `Try searching for: "${author.split(' ')[0]}"`, // 姓氏
    `Try searching for: "${author.split(' ').pop()}"`, // 名字
    'Check spelling and try common name variations',
    'Try searching by research topic instead',
    'Browse recent papers in relevant categories'
  ];
}

/**
 * 生成作者摘要
 */
function generateAuthorSummary(papers: any[], author: string, analysis: any): string {
  const firstAuthorCount = analysis.firstAuthorPapers;
  const primaryArea = analysis.primaryArea;
  const recentActivity = analysis.recentActivity;
  const pattern = analysis.researchPattern;
  
  return `Found ${papers.length} papers by ${author}. ${firstAuthorCount} as first author. Primary area: ${primaryArea}. Pattern: ${pattern}. Recent activity: ${recentActivity} papers in last year.`;
}

/**
 * 工具注册信息
 */
export const arxivAuthorSearchTool = {
  name: 'arxiv_author_search',
  description: 'Search arXiv papers by author with comprehensive research pattern analysis',
  category: 'academic-search',
  source: 'arxiv.org',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Author search query. Examples: "papers by Hinton", "author:LeCun", "researcher Smith", "publications by Einstein"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of papers to return (default: 20, max: 50)',
        default: 20,
        minimum: 1,
        maximum: 50
      }
    },
    required: ['query']
  },
  execute: arxivAuthorSearch,
  examples: [
    {
      query: "papers by Hinton",
      description: "Find papers by Geoffrey Hinton"
    },
    {
      query: "author:LeCun",
      description: "Search for Yann LeCun's publications"
    },
    {
      query: "researcher Smith",
      description: "Find papers by researchers named Smith"
    },
    {
      query: "publications by Einstein",
      description: "Search for Einstein's papers"
    },
    {
      query: "works by Turing",
      description: "Find Alan Turing's research"
    }
  ]
};
