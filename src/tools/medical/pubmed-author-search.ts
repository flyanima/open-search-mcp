import { PubmedSearchClient } from '../../api/clients/pubmed-search-client.js';
import { PubmedSearchRouter } from '../../utils/pubmed-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * PubMed 作者搜索工具
 * 专门用于按作者搜索PubMed论文并分析医学研究模式
 */

const logger = new Logger('PubmedAuthorSearch');

export async function pubmedAuthorSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing PubMed author search: ${args.query}`);

    // 提取作者名
    const author = extractAuthor(args.query);
    
    if (!author) {
      return {
        success: false,
        error: 'No author name found in query. Please provide an author name like "papers by Smith" or "author:Johnson"'
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
        source: 'PubMed',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('PubMed author search failed:', error);
    return {
      success: false,
      error: `PubMed author search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理作者搜索请求
 */
async function handleAuthorSearchRequest(client: PubmedSearchClient, author: string, originalQuery: string, limit: number): Promise<any> {
  try {
    // 检查是否需要精确匹配
    const exactMatch = originalQuery.includes('"') || originalQuery.includes('exact');
    
    const searchOptions = {
      retmax: Math.min(limit, 50),
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
      yearPublished: extractYear(paper.publicationDate),
      relevanceToAuthor: calculateAuthorRelevance(paper, author),
      medicalSpecialty: identifyMedicalSpecialty(paper.meshTerms),
      clinicalRelevance: assessClinicalRelevance(paper),
      evidenceLevel: assessEvidenceLevel(paper)
    }));

    // 按作者相关性和时间排序
    enhancedPapers.sort((a: any, b: any) => {
      // 第一作者论文优先
      if (a.isFirstAuthor !== b.isFirstAuthor) {
        return a.isFirstAuthor ? -1 : 1;
      }
      // 然后按时间排序
      return new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime();
    });

    // 分析作者的医学研究模式
    const authorAnalysis = analyzeAuthorMedicalResearch(enhancedPapers, author);
    
    // 生成研究时间线
    const timeline = generateMedicalResearchTimeline(enhancedPapers);
    
    // 分析合作网络
    const collaborationNetwork = analyzeMedicalCollaborationNetwork(enhancedPapers, author);

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
    /written by\s+(.+)/i,
    /studies by\s+(.+)/i
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
  if (paper.authors && paper.authors.length <= 5) {
    score += 20;
  } else if (paper.authors && paper.authors.length <= 10) {
    score += 10;
  }
  
  // 最近的论文相关性更高
  const daysSince = calculateDaysSince(paper.publicationDate);
  if (daysSince <= 365) score += 15;
  else if (daysSince <= 1095) score += 10; // 3年内
  
  return Math.min(score, 100);
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
    'Pediatrics': 'Pediatrics',
    'Pregnancy': 'Obstetrics',
    'Eye Diseases': 'Ophthalmology'
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
 * 评估证据水平
 */
function assessEvidenceLevel(paper: any): string {
  if (!paper.articleType) return 'Unknown';
  
  const articleType = paper.articleType.toLowerCase();
  
  if (articleType.includes('meta-analysis')) return 'Level 1';
  if (articleType.includes('systematic review')) return 'Level 1';
  if (articleType.includes('randomized controlled trial')) return 'Level 2';
  if (articleType.includes('controlled clinical trial')) return 'Level 3';
  if (articleType.includes('cohort')) return 'Level 4';
  if (articleType.includes('case-control')) return 'Level 4';
  if (articleType.includes('case report')) return 'Level 5';
  
  return 'Level 5';
}

/**
 * 分析作者医学研究模式
 */
function analyzeAuthorMedicalResearch(papers: any[], author: string): any {
  const analysis = {
    totalPapers: papers.length,
    firstAuthorPapers: 0,
    lastAuthorPapers: 0,
    soloAuthorPapers: 0,
    
    // 医学专科分析
    medicalSpecialties: {} as Record<string, number>,
    primarySpecialty: '',
    
    // 时间分析
    publicationTrend: {} as Record<string, number>,
    mostProductiveYear: '',
    careerSpan: 0,
    
    // 合作分析
    totalCollaborators: 0,
    frequentCollaborators: {} as Record<string, number>,
    averageCoauthors: 0,
    
    // 临床影响力指标
    recentActivity: 0, // 最近一年的论文数
    clinicalRelevance: { high: 0, medium: 0, low: 0 },
    evidenceLevels: {} as Record<string, number>,
    
    // 研究模式
    researchPattern: 'unknown' as string
  };
  
  const collaboratorSet = new Set<string>();
  let totalCoauthors = 0;
  
  papers.forEach(paper => {
    const year = extractYear(paper.publicationDate);
    if (year) {
      analysis.publicationTrend[year] = (analysis.publicationTrend[year] || 0) + 1;
    }
    
    // 作者位置分析
    if (paper.isFirstAuthor) analysis.firstAuthorPapers++;
    if (paper.authorPosition?.isLast) analysis.lastAuthorPapers++;
    if (paper.authors && paper.authors.length === 1) analysis.soloAuthorPapers++;
    
    // 医学专科分析
    if (paper.medicalSpecialty) {
      analysis.medicalSpecialties[paper.medicalSpecialty] = (analysis.medicalSpecialties[paper.medicalSpecialty] || 0) + 1;
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
    const daysSince = calculateDaysSince(paper.publicationDate);
    if (daysSince <= 365) analysis.recentActivity++;
    
    // 临床相关性统计
    if (paper.clinicalRelevance && paper.clinicalRelevance in analysis.clinicalRelevance) {
      (analysis.clinicalRelevance as any)[paper.clinicalRelevance]++;
    }
    
    // 证据水平统计
    if (paper.evidenceLevel) {
      analysis.evidenceLevels[paper.evidenceLevel] = (analysis.evidenceLevels[paper.evidenceLevel] || 0) + 1;
    }
  });
  
  // 计算衍生指标
  analysis.totalCollaborators = collaboratorSet.size;
  analysis.averageCoauthors = papers.length > 0 ? totalCoauthors / papers.length : 0;
  
  // 找出主要医学专科
  const sortedSpecialties = Object.entries(analysis.medicalSpecialties)
    .sort(([,a], [,b]) => (b as number) - (a as number));
  analysis.primarySpecialty = sortedSpecialties[0]?.[0] || 'General Medicine';
  
  // 找出最高产年份
  const sortedYears = Object.entries(analysis.publicationTrend)
    .sort(([,a], [,b]) => (b as number) - (a as number));
  analysis.mostProductiveYear = sortedYears[0]?.[0] || 'Unknown';
  
  // 计算职业生涯跨度
  const years = Object.keys(analysis.publicationTrend).map(Number).sort();
  if (years.length > 1) {
    analysis.careerSpan = years[years.length - 1] - years[0];
  }
  
  // 分析研究模式
  analysis.researchPattern = identifyMedicalResearchPattern(analysis);
  
  return analysis;
}

/**
 * 识别医学研究模式
 */
function identifyMedicalResearchPattern(analysis: any): string {
  const firstAuthorRatio = analysis.firstAuthorPapers / analysis.totalPapers;
  const lastAuthorRatio = analysis.lastAuthorPapers / analysis.totalPapers;
  const soloRatio = analysis.soloAuthorPapers / analysis.totalPapers;
  const clinicalHighRatio = analysis.clinicalRelevance.high / analysis.totalPapers;
  
  if (soloRatio > 0.5) return 'Independent Medical Researcher';
  if (firstAuthorRatio > 0.6) return 'Lead Clinical Researcher';
  if (lastAuthorRatio > 0.4) return 'Senior Medical Researcher/PI';
  if (clinicalHighRatio > 0.5) return 'Clinical Practice Researcher';
  if (analysis.averageCoauthors > 8) return 'Collaborative Medical Researcher';
  if (analysis.recentActivity > 5) return 'Highly Active Medical Researcher';
  
  return 'Emerging Medical Researcher';
}

/**
 * 生成医学研究时间线
 */
function generateMedicalResearchTimeline(papers: any[]): any[] {
  const timeline: any[] = [];
  
  // 按年份分组
  const yearGroups: Record<string, any[]> = {};
  papers.forEach(paper => {
    const year = extractYear(paper.publicationDate);
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
      const specialties = [...new Set(yearPapers.map(p => p.medicalSpecialty).filter(Boolean))];
      const clinicalRelevance = yearPapers.filter(p => p.clinicalRelevance === 'high').length;
      
      timeline.push({
        year: parseInt(year),
        paperCount: yearPapers.length,
        firstAuthorCount,
        medicalSpecialties: specialties,
        clinicalRelevantPapers: clinicalRelevance,
        notablePapers: yearPapers
          .filter(p => p.isFirstAuthor || p.clinicalRelevance === 'high')
          .slice(0, 2)
          .map(p => ({ pmid: p.pmid, title: p.title }))
      });
    });
  
  return timeline;
}

/**
 * 分析医学合作网络
 */
function analyzeMedicalCollaborationNetwork(papers: any[], author: string): any {
  const network = {
    totalCollaborators: 0,
    frequentCollaborators: [] as any[],
    medicalSpecialtyCollaborations: {} as Record<string, number>,
    internationalCollaborations: 0,
    collaborationPattern: 'unknown' as string
  };
  
  const collaboratorCount: Record<string, number> = {};
  const specialtyCollaborations: Record<string, Set<string>> = {};
  
  papers.forEach(paper => {
    if (paper.collaborators) {
      paper.collaborators.forEach((collab: string) => {
        collaboratorCount[collab] = (collaboratorCount[collab] || 0) + 1;
      });
    }
    
    // 分析专科合作
    if (paper.medicalSpecialty && paper.collaborators) {
      if (!specialtyCollaborations[paper.medicalSpecialty]) {
        specialtyCollaborations[paper.medicalSpecialty] = new Set();
      }
      paper.collaborators.forEach((collab: string) => {
        specialtyCollaborations[paper.medicalSpecialty].add(collab);
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
  
  // 统计专科合作
  Object.entries(specialtyCollaborations).forEach(([specialty, collaborators]) => {
    network.medicalSpecialtyCollaborations[specialty] = collaborators.size;
  });
  
  // 分析合作模式
  const avgCollaborators = papers.reduce((sum, p) => sum + (p.collaborators?.length || 0), 0) / papers.length;
  
  if (avgCollaborators < 3) network.collaborationPattern = 'Small Medical Teams';
  else if (avgCollaborators < 8) network.collaborationPattern = 'Medium Medical Teams';
  else network.collaborationPattern = 'Large Medical Collaborations';
  
  return network;
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

/**
 * 生成作者建议
 */
function generateAuthorSuggestions(author: string): string[] {
  return [
    `Try searching for: "${author.split(' ')[0]}"`, // 姓氏
    `Try searching for: "${author.split(' ').pop()}"`, // 名字
    'Check spelling and try common name variations',
    'Try searching by medical topic instead',
    'Browse recent papers in relevant medical categories'
  ];
}

/**
 * 生成作者摘要
 */
function generateAuthorSummary(papers: any[], author: string, analysis: any): string {
  const firstAuthorCount = analysis.firstAuthorPapers;
  const primarySpecialty = analysis.primarySpecialty;
  const recentActivity = analysis.recentActivity;
  const pattern = analysis.researchPattern;
  
  return `Found ${papers.length} medical papers by ${author}. ${firstAuthorCount} as first author. Primary specialty: ${primarySpecialty}. Pattern: ${pattern}. Recent activity: ${recentActivity} papers in last year.`;
}

/**
 * 工具注册信息
 */
export const pubmedAuthorSearchTool = {
  name: 'pubmed_author_search',
  description: 'Search PubMed papers by author with comprehensive medical research pattern analysis',
  category: 'medical-search',
  source: 'pubmed.ncbi.nlm.nih.gov',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Author search query. Examples: "papers by Smith", "author:Johnson", "researcher Brown", "publications by Wilson"'
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
  execute: pubmedAuthorSearch,
  examples: [
    {
      query: "papers by Smith",
      description: "Find medical papers by Dr. Smith"
    },
    {
      query: "author:Johnson",
      description: "Search for Dr. Johnson's publications"
    },
    {
      query: "researcher Brown",
      description: "Find papers by researcher Brown"
    },
    {
      query: "publications by Wilson",
      description: "Search for Dr. Wilson's research"
    },
    {
      query: "studies by Garcia",
      description: "Find clinical studies by Dr. Garcia"
    }
  ]
};
