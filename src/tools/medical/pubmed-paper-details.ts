import { PubmedSearchClient } from '../../api/clients/pubmed-search-client.js';
import { PubmedSearchRouter } from '../../utils/pubmed-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * PubMed 论文详情工具
 * 专门用于获取特定PubMed论文的详细信息和增强分析
 */

const logger = new Logger('PubmedPaperDetails');

export async function pubmedPaperDetails(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing PubMed paper details: ${args.query}`);

    // 提取PMID
    const pmid = extractPMID(args.query);
    
    if (!pmid) {
      return {
        success: false,
        error: 'No valid PMID found in query. Please provide a PMID like "12345678" or "PMID:12345678"'
      };
    }
    
    const result = await handlePaperDetailsRequest(client, pmid, args.query);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'paper_details',
        result,
        source: 'PubMed',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('PubMed paper details failed:', error);
    return {
      success: false,
      error: `PubMed paper details failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理论文详情请求
 */
async function handlePaperDetailsRequest(client: PubmedSearchClient, pmid: string, originalQuery: string): Promise<any> {
  try {
    // 验证PMID格式
    if (!client.validatePMID(pmid)) {
      return {
        type: 'paper_details',
        query: originalQuery,
        paper: null,
        error: `Invalid PMID format: ${pmid}`,
        suggestions: [
          'Use format: 12345678 (8+ digits)',
          'Include PMID prefix: PMID:12345678',
          'Try searching for the paper title instead'
        ]
      };
    }
    
    // 获取论文详情
    const paper = await client.getPaperDetails(pmid);
    
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
        error: `Paper not found: PMID ${pmid}`,
        suggestions: await generateSearchSuggestions(client, pmid)
      };
    }
    
    throw error;
  }
}

/**
 * 增强论文详情信息
 */
async function enhancePaperDetails(paper: any, client: PubmedSearchClient): Promise<any> {
  const enhanced = {
    ...paper,
    
    // 基础分析
    readingTime: estimateReadingTime(paper.abstract),
    complexity: assessPaperComplexity(paper),
    wordCount: paper.abstract ? paper.abstract.split(/\s+/).length : 0,
    
    // 医学内容分析
    medicalSpecialty: identifyMedicalSpecialty(paper.meshTerms),
    clinicalRelevance: assessClinicalRelevance(paper),
    evidenceLevel: assessEvidenceLevel(paper),
    keyTopics: extractMedicalTopics(paper.abstract),
    
    // 元数据增强
    citationFormats: generateCitationFormats(paper),
    relatedMeSH: getRelatedMeSH(paper.meshTerms),
    authorAnalysis: analyzeAuthors(paper.authors),
    
    // 时间分析
    publicationYear: extractYear(paper.publicationDate),
    daysSincePublication: calculateDaysSince(paper.publicationDate),
    isRecent: isRecentPaper(paper.publicationDate),
    
    // 质量指标
    qualityIndicators: assessPaperQuality(paper),
    impactLevel: assessImpactLevel(paper),
    
    // 实用信息
    accessInfo: {
      pmid: paper.pmid,
      doi: paper.doi || 'Not available',
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`,
      doiUrl: paper.doi ? `https://doi.org/${paper.doi}` : null
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
async function findRelatedPapers(client: PubmedSearchClient, paper: any): Promise<any[]> {
  // 使用主要MeSH术语搜索相关论文
  const mainMeSH = paper.meshTerms?.[0];
  if (!mainMeSH) return [];
  
  try {
    const result = await client.searchByMeSH(mainMeSH, { retmax: 3 });
    
    // 过滤掉当前论文
    return result.papers
      .filter((p: any) => p.pmid !== paper.pmid)
      .slice(0, 3)
      .map((p: any) => ({
        pmid: p.pmid,
        title: p.title,
        authors: p.authors.slice(0, 2),
        publicationDate: p.publicationDate
      }));
  } catch (error) {
    return [];
  }
}

/**
 * 提取PMID
 */
function extractPMID(query: string): string | null {
  // PMID格式: 8位或更多数字
  const patterns = [
    /(?:pmid:)?(\d{8,})/i,
    /(?:paper details|abstract|details)\s+(\d{8,})/i
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // 如果没有找到标准格式，尝试提取数字序列
  const numberMatch = query.match(/(\d{8,})/);
  if (numberMatch) {
    return numberMatch[1];
  }
  
  return null;
}

/**
 * 估算阅读时间
 */
function estimateReadingTime(abstract: string): number {
  if (!abstract) return 0;
  const words = abstract.split(/\s+/).length;
  // 医学论文阅读速度较慢，假设每分钟150词
  return Math.ceil(words / 150);
}

/**
 * 评估论文复杂度
 */
function assessPaperComplexity(paper: any): 'beginner' | 'intermediate' | 'advanced' {
  let complexityScore = 0;
  
  // 基于摘要长度和复杂度
  if (paper.abstract) {
    const words = paper.abstract.split(/\s+/).length;
    if (words > 250) complexityScore += 1;
    
    // 检查医学术语密度
    const medicalTerms = ['therapy', 'diagnosis', 'treatment', 'clinical', 'pathology', 'syndrome', 'intervention'];
    const termCount = medicalTerms.filter(term => 
      paper.abstract.toLowerCase().includes(term)
    ).length;
    complexityScore += Math.min(termCount, 3);
  }
  
  // 基于文章类型
  if (paper.articleType) {
    if (paper.articleType.includes('Meta-Analysis') || paper.articleType.includes('Systematic Review')) {
      complexityScore += 2;
    } else if (paper.articleType.includes('Clinical Trial')) {
      complexityScore += 1;
    }
  }
  
  // 基于MeSH术语数量
  if (paper.meshTerms && paper.meshTerms.length > 10) {
    complexityScore += 1;
  }
  
  if (complexityScore >= 4) return 'advanced';
  if (complexityScore >= 2) return 'intermediate';
  return 'beginner';
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
    'Eye Diseases': 'Ophthalmology',
    'Skin Diseases': 'Dermatology'
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
        paper.articleType.includes('Case Reports') ||
        paper.articleType.includes('Practice Guideline')) {
      relevanceScore += 3;
    } else if (paper.articleType.includes('Review') ||
               paper.articleType.includes('Meta-Analysis')) {
      relevanceScore += 2;
    }
  }
  
  // 基于MeSH术语
  const clinicalTerms = ['Therapy', 'Diagnosis', 'Treatment', 'Clinical', 'Patient'];
  if (paper.meshTerms) {
    clinicalTerms.forEach(term => {
      if (paper.meshTerms.some((mesh: string) => mesh.includes(term))) {
        relevanceScore += 1;
      }
    });
  }
  
  // 基于摘要内容
  if (paper.abstract) {
    const clinicalKeywords = ['patient', 'clinical', 'treatment', 'therapy', 'diagnosis'];
    clinicalKeywords.forEach(keyword => {
      if (paper.abstract.toLowerCase().includes(keyword)) {
        relevanceScore += 1;
      }
    });
  }
  
  if (relevanceScore >= 5) return 'high';
  if (relevanceScore >= 2) return 'medium';
  return 'low';
}

/**
 * 评估证据水平
 */
function assessEvidenceLevel(paper: any): string {
  if (!paper.articleType) return 'Unknown';
  
  const articleType = paper.articleType.toLowerCase();
  
  if (articleType.includes('meta-analysis')) return 'Level 1 (Meta-Analysis)';
  if (articleType.includes('systematic review')) return 'Level 1 (Systematic Review)';
  if (articleType.includes('randomized controlled trial')) return 'Level 2 (RCT)';
  if (articleType.includes('controlled clinical trial')) return 'Level 3 (CCT)';
  if (articleType.includes('cohort')) return 'Level 4 (Cohort Study)';
  if (articleType.includes('case-control')) return 'Level 4 (Case-Control)';
  if (articleType.includes('case report')) return 'Level 5 (Case Report)';
  if (articleType.includes('review')) return 'Level 5 (Review)';
  
  return 'Level 5 (Other)';
}

/**
 * 提取医学主题
 */
function extractMedicalTopics(abstract: string): string[] {
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
    'analysis', 'clinical', 'medical', 'disease', 'therapy', 'diagnosis',
    'research', 'group', 'control', 'significant', 'effect', 'level'
  ]);
  
  return Object.entries(wordCount)
    .filter(([word]) => !medicalStopWords.has(word))
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 8)
    .map(([word]) => word);
}

/**
 * 生成引用格式
 */
function generateCitationFormats(paper: any): any {
  const authors = paper.authors ? paper.authors.slice(0, 3).join(', ') : 'Unknown';
  const year = extractYear(paper.publicationDate) || 'Unknown';
  const title = paper.title || 'Unknown Title';
  const journal = paper.journal || 'Unknown Journal';
  const pmid = paper.pmid || 'Unknown';
  
  return {
    apa: `${authors} (${year}). ${title}. ${journal}. PMID: ${pmid}`,
    vancouver: `${authors}. ${title}. ${journal}. ${year}. PMID: ${pmid}`,
    mla: `${authors}. "${title}." ${journal}, ${year}. PubMed, PMID: ${pmid}`,
    chicago: `${authors}. "${title}." ${journal} (${year}). PMID: ${pmid}.`
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
  else if (count <= 5) type = 'small_team';
  else if (count <= 15) type = 'medium_team';
  else type = 'large_collaboration';
  
  return {
    count,
    type,
    firstAuthor: authors[0],
    lastAuthor: authors[authors.length - 1],
    isCollaboration: count > 1,
    collaborationSize: count > 1 ? (count <= 5 ? 'small' : count <= 15 ? 'medium' : 'large') : 'none'
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
  if (paper.abstract && paper.abstract.length > 200) {
    indicators.score += 20;
    indicators.factors.push('Comprehensive abstract');
  }
  
  // 作者数量（适中的合作）
  if (paper.authors && paper.authors.length >= 2 && paper.authors.length <= 10) {
    indicators.score += 15;
    indicators.factors.push('Collaborative research');
  }
  
  // MeSH术语
  if (paper.meshTerms && paper.meshTerms.length >= 5) {
    indicators.score += 15;
    indicators.factors.push('Well-categorized');
  }
  
  // 最近发表
  if (isRecentPaper(paper.publicationDate)) {
    indicators.score += 10;
    indicators.factors.push('Recent publication');
  }
  
  // 有DOI
  if (paper.doi) {
    indicators.score += 20;
    indicators.factors.push('DOI available');
  }
  
  // 期刊质量
  if (paper.journal) {
    const highImpactJournals = ['Nature', 'Science', 'Cell', 'Lancet', 'NEJM', 'JAMA'];
    if (highImpactJournals.some(journal => 
      paper.journal.toLowerCase().includes(journal.toLowerCase())
    )) {
      indicators.score += 20;
      indicators.factors.push('High-impact journal');
    }
  }
  
  // 质量等级
  if (indicators.score >= 70) indicators.level = 'High';
  else if (indicators.score >= 40) indicators.level = 'Medium';
  else indicators.level = 'Basic';
  
  return indicators;
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

function isRecentPaper(dateString: string): boolean {
  const days = calculateDaysSince(dateString);
  return days <= 730; // 两年内算作最近
}

function getRelatedMeSH(meshTerms: string[]): string[] {
  if (!meshTerms) return [];
  
  // 获取主要分类
  const mainCategories = meshTerms.map(term => term.split('/')[0]);
  return [...new Set(mainCategories)];
}

/**
 * 生成搜索建议
 */
async function generateSearchSuggestions(client: PubmedSearchClient, pmid: string): Promise<string[]> {
  const suggestions: string[] = [];
  
  // 基于PMID的部分匹配
  if (pmid.length >= 6) {
    suggestions.push(`Try searching for: "${pmid.substring(0, 6)}*"`);
  }
  
  // 通用建议
  suggestions.push('Check the PMID format (8+ digits)');
  suggestions.push('Try searching by paper title or author');
  suggestions.push('Browse recent papers in relevant medical categories');
  
  return suggestions;
}

/**
 * 生成论文摘要
 */
function generatePaperSummary(paper: any): string {
  const year = paper.publicationYear || 'Unknown';
  const specialty = paper.medicalSpecialty || 'medical';
  const complexity = paper.complexity || 'unknown';
  const authorCount = paper.authorAnalysis?.count || 0;
  const relevance = paper.clinicalRelevance || 'unknown';
  
  return `Found paper "${paper.title}" (PMID: ${paper.pmid}) from ${year}. Specialty: ${specialty}. Complexity: ${complexity}. Authors: ${authorCount}. Clinical relevance: ${relevance}. Reading time: ~${paper.readingTime} minutes.`;
}

/**
 * 工具注册信息
 */
export const pubmedPaperDetailsTool = {
  name: 'pubmed_paper_details',
  description: 'Get detailed information about specific PubMed papers with comprehensive medical analysis',
  category: 'medical-search',
  source: 'pubmed.ncbi.nlm.nih.gov',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'PMID or query containing PMID. Examples: "12345678", "PMID:12345678", "paper details 12345678"'
      }
    },
    required: ['query']
  },
  execute: pubmedPaperDetails,
  examples: [
    {
      query: "12345678",
      description: "Get details for PMID 12345678"
    },
    {
      query: "PMID:12345678",
      description: "Get details using full PMID format"
    },
    {
      query: "paper details 12345678",
      description: "Get paper details with natural language"
    },
    {
      query: "abstract 35000000",
      description: "Get abstract and details for specific paper"
    }
  ]
};
