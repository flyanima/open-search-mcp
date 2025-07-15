import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger.js';

/**
 * PubMed 搜索客户端 - 专注于医学论文搜索场景
 * 支持论文搜索、作者搜索、主题搜索、论文详情获取
 */

interface SearchOptions {
  retmax?: number;
  retstart?: number;
  sort?: 'relevance' | 'pub_date' | 'author';
  mindate?: string;
  maxdate?: string;
}

interface AuthorOptions extends SearchOptions {
  exactMatch?: boolean;
}

interface MeSHOptions extends SearchOptions {
  majorTopic?: boolean;
}

interface PubmedPaper {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  doi?: string;
  meshTerms: string[];
  articleType: string;
  language: string;
}

interface SearchResult {
  query: string;
  papers: PubmedPaper[];
  totalResults: number;
  retstart: number;
  retmax: number;
}

export class PubmedSearchClient {
  private httpClient: AxiosInstance;
  private logger: Logger;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 1000; // 1秒延迟，遵循NCBI建议

  // PubMed主要医学主题分类
  private readonly MESH_CATEGORIES = {
    'A': 'Anatomy',
    'B': 'Organisms',
    'C': 'Diseases',
    'D': 'Chemicals and Drugs',
    'E': 'Analytical, Diagnostic and Therapeutic Techniques',
    'F': 'Psychiatry and Psychology',
    'G': 'Phenomena and Processes',
    'H': 'Disciplines and Occupations',
    'I': 'Anthropology, Education, Sociology, and Social Phenomena',
    'J': 'Technology, Industry, and Agriculture',
    'K': 'Humanities',
    'L': 'Information Science',
    'M': 'Named Groups',
    'N': 'Health Care',
    'V': 'Publication Characteristics',
    'Z': 'Geographicals'
  };

  constructor() {
    this.logger = new Logger('PubmedSearch');
    
    this.httpClient = axios.create({
      baseURL: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
      timeout: 30000,
      headers: {
        'User-Agent': 'Open-Search-MCP/2.0 (https://github.com/open-search-mcp)'
      }
    });
  }

  /**
   * 通用API请求方法（带速率限制）
   */
  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    // 实施速率限制
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest;
      this.logger.info(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestCount++;
    this.lastRequestTime = Date.now();
    
    try {
      const response = await this.httpClient.get(endpoint, { params });
      return response.data;
    } catch (error) {
      this.logger.error('PubMed API request failed:', error);
      throw error;
    }
  }

  /**
   * 解析PubMed XML响应
   */
  private async parsePubmedXML(xmlData: string): Promise<any> {
    try {
      // 动态导入xml2js以处理ES模块
      const { parseStringPromise } = await import('xml2js');
      
      const result = await parseStringPromise(xmlData, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
        ignoreAttrs: false
      });
      
      return result;
    } catch (error) {
      this.logger.error('XML parsing failed:', error);
      throw new Error('Failed to parse PubMed response');
    }
  }

  /**
   * 格式化论文数据
   */
  private formatPaper(article: any): PubmedPaper {
    const pmid = article.MedlineCitation?.PMID?._ || article.MedlineCitation?.PMID || '';
    
    // 提取标题
    const title = article.MedlineCitation?.Article?.ArticleTitle || '';
    
    // 提取摘要
    let abstract = '';
    const abstractText = article.MedlineCitation?.Article?.Abstract?.AbstractText;
    if (abstractText) {
      if (Array.isArray(abstractText)) {
        abstract = abstractText.map(text => typeof text === 'object' ? text._ || text : text).join(' ');
      } else {
        abstract = typeof abstractText === 'object' ? abstractText._ || abstractText : abstractText;
      }
    }
    
    // 提取作者
    let authors: string[] = [];
    const authorList = article.MedlineCitation?.Article?.AuthorList?.Author;
    if (authorList) {
      const authorsArray = Array.isArray(authorList) ? authorList : [authorList];
      authors = authorsArray.map((author: any) => {
        const lastName = author.LastName || '';
        const foreName = author.ForeName || author.Initials || '';
        return `${foreName} ${lastName}`.trim();
      }).filter(name => name);
    }
    
    // 提取期刊信息
    const journal = article.MedlineCitation?.Article?.Journal?.Title || 
                   article.MedlineCitation?.Article?.Journal?.ISOAbbreviation || '';
    
    // 提取发表日期
    let publicationDate = '';
    const pubDate = article.MedlineCitation?.Article?.Journal?.JournalIssue?.PubDate;
    if (pubDate) {
      const year = pubDate.Year || '';
      const month = pubDate.Month || '';
      const day = pubDate.Day || '';
      publicationDate = `${year}-${month}-${day}`.replace(/--+/g, '-').replace(/^-|-$/g, '');
    }
    
    // 提取DOI
    let doi = '';
    const articleIds = article.PubmedData?.ArticleIdList?.ArticleId;
    if (articleIds) {
      const idsArray = Array.isArray(articleIds) ? articleIds : [articleIds];
      const doiId = idsArray.find((id: any) => id.IdType === 'doi');
      doi = doiId?._ || doiId || '';
    }
    
    // 提取MeSH术语
    let meshTerms: string[] = [];
    const meshHeadingList = article.MedlineCitation?.MeshHeadingList?.MeshHeading;
    if (meshHeadingList) {
      const meshArray = Array.isArray(meshHeadingList) ? meshHeadingList : [meshHeadingList];
      meshTerms = meshArray.map((mesh: any) => {
        const descriptor = mesh.DescriptorName;
        return typeof descriptor === 'object' ? descriptor._ || descriptor : descriptor;
      }).filter(term => term);
    }
    
    // 提取文章类型
    const publicationTypes = article.MedlineCitation?.Article?.PublicationTypeList?.PublicationType;
    let articleType = 'Research Article';
    if (publicationTypes) {
      const typesArray = Array.isArray(publicationTypes) ? publicationTypes : [publicationTypes];
      articleType = typesArray[0]?._ || typesArray[0] || 'Research Article';
    }
    
    // 提取语言
    const language = article.MedlineCitation?.Article?.Language || 'eng';

    return {
      pmid,
      title,
      abstract,
      authors,
      journal,
      publicationDate,
      doi,
      meshTerms,
      articleType,
      language
    };
  }

  /**
   * 搜索PubMed论文
   */
  async searchPapers(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const retmax = Math.min(options.retmax || 10, 100); // 限制最大结果数
    const retstart = options.retstart || 0;
    
    this.logger.info(`Searching PubMed: ${query}`);
    
    // 第一步：使用esearch获取PMID列表
    const searchParams = {
      db: 'pubmed',
      term: query,
      retmax,
      retstart,
      retmode: 'xml',
      sort: options.sort || 'relevance'
    };
    
    // 添加日期过滤
    if (options.mindate) (searchParams as any).mindate = options.mindate;
    if (options.maxdate) (searchParams as any).maxdate = options.maxdate;
    
    const searchXml = await this.makeRequest('/esearch.fcgi', searchParams);
    const searchResult = await this.parsePubmedXML(searchXml);
    
    if (!searchResult.eSearchResult) {
      throw new Error('Invalid PubMed search response format');
    }
    
    const totalResults = parseInt(searchResult.eSearchResult.Count) || 0;
    const pmids = searchResult.eSearchResult.IdList?.Id || [];
    const pmidArray = Array.isArray(pmids) ? pmids : (pmids ? [pmids] : []);
    
    if (pmidArray.length === 0) {
      return {
        query,
        papers: [],
        totalResults,
        retstart,
        retmax
      };
    }
    
    // 第二步：使用efetch获取详细信息
    const fetchParams = {
      db: 'pubmed',
      id: pmidArray.join(','),
      retmode: 'xml'
    };
    
    const fetchXml = await this.makeRequest('/efetch.fcgi', fetchParams);
    const fetchResult = await this.parsePubmedXML(fetchXml);
    
    if (!fetchResult.PubmedArticleSet) {
      throw new Error('Invalid PubMed fetch response format');
    }
    
    const articles = fetchResult.PubmedArticleSet.PubmedArticle || [];
    const articlesArray = Array.isArray(articles) ? articles : [articles];
    
    const papers = articlesArray.map((article: any) => this.formatPaper(article));
    
    return {
      query,
      papers,
      totalResults,
      retstart,
      retmax
    };
  }

  /**
   * 根据PMID获取论文详情
   */
  async getPaperDetails(pmid: string): Promise<PubmedPaper> {
    this.logger.info(`Getting paper details: ${pmid}`);
    
    // 清理PMID格式
    const cleanPmid = pmid.replace(/^(PMID:|pmid:)/i, '');
    
    const params = {
      db: 'pubmed',
      id: cleanPmid,
      retmode: 'xml'
    };
    
    const xmlData = await this.makeRequest('/efetch.fcgi', params);
    const parsed = await this.parsePubmedXML(xmlData);
    
    if (!parsed.PubmedArticleSet || !parsed.PubmedArticleSet.PubmedArticle) {
      throw new Error(`Paper not found: ${pmid}`);
    }
    
    const article = Array.isArray(parsed.PubmedArticleSet.PubmedArticle) 
      ? parsed.PubmedArticleSet.PubmedArticle[0] 
      : parsed.PubmedArticleSet.PubmedArticle;
      
    return this.formatPaper(article);
  }

  /**
   * 按作者搜索论文
   */
  async searchByAuthor(author: string, options: AuthorOptions = {}): Promise<SearchResult> {
    this.logger.info(`Searching papers by author: ${author}`);
    
    // 构建作者查询
    const authorQuery = options.exactMatch 
      ? `"${author}"[Author]` 
      : `${author}[Author]`;
    
    return await this.searchPapers(authorQuery, options);
  }

  /**
   * 按MeSH术语搜索论文
   */
  async searchByMeSH(meshTerm: string, options: MeSHOptions = {}): Promise<SearchResult> {
    this.logger.info(`Searching papers by MeSH term: ${meshTerm}`);
    
    // 构建MeSH查询
    const meshQuery = options.majorTopic 
      ? `${meshTerm}[MeSH Major Topic]` 
      : `${meshTerm}[MeSH Terms]`;
    
    return await this.searchPapers(meshQuery, options);
  }

  /**
   * 智能搜索 - 根据查询自动选择最佳方法
   */
  async smartSearch(query: string, options: any = {}): Promise<any> {
    this.logger.info(`Smart search: ${query}`);
    
    const intent = this.analyzeSearchIntent(query);
    
    switch (intent.type) {
      case 'pmid':
        const paperDetails = await this.getPaperDetails(intent.pmid!);
        return {
          type: 'paper_details',
          query,
          result: paperDetails
        };
        
      case 'author':
        const authorResult = await this.searchByAuthor(intent.author!, options);
        return {
          type: 'author_search',
          query,
          result: authorResult
        };
        
      case 'mesh':
        const meshResult = await this.searchByMeSH(intent.meshTerm!, options);
        return {
          type: 'mesh_search',
          query,
          result: meshResult
        };
        
      default: // 'general'
        const searchResult = await this.searchPapers(query, options);
        return {
          type: 'general_search',
          query,
          result: searchResult
        };
    }
  }

  /**
   * 分析搜索意图
   */
  private analyzeSearchIntent(query: string): any {
    const normalizedQuery = query.toLowerCase().trim();
    
    // PMID查询
    const pmidPattern = /(?:pmid:)?(\d{8,})/i;
    const pmidMatch = query.match(pmidPattern);
    if (pmidMatch) {
      return {
        type: 'pmid',
        pmid: pmidMatch[1]
      };
    }
    
    // 作者查询
    if (normalizedQuery.includes('papers by') || normalizedQuery.includes('author:') || 
        normalizedQuery.includes('by ') || normalizedQuery.includes('researcher')) {
      const author = this.extractAuthor(query);
      if (author) {
        return {
          type: 'author',
          author
        };
      }
    }
    
    // MeSH术语查询
    if (normalizedQuery.includes('mesh:') || this.isMeSHTerm(normalizedQuery)) {
      const meshTerm = this.extractMeSHTerm(query);
      if (meshTerm) {
        return {
          type: 'mesh',
          meshTerm
        };
      }
    }
    
    // 默认：一般搜索
    return {
      type: 'general'
    };
  }

  /**
   * 从查询中提取作者名
   */
  private extractAuthor(query: string): string | undefined {
    const authorWords = ['papers by', 'author:', 'by ', 'researcher', 'author'];
    let author = query;
    
    authorWords.forEach(word => {
      author = author.replace(new RegExp(word, 'gi'), '').trim();
    });
    
    return author || undefined;
  }

  /**
   * 判断是否为MeSH术语
   */
  private isMeSHTerm(query: string): boolean {
    // 简单的MeSH术语检测
    const meshKeywords = [
      'disease', 'treatment', 'therapy', 'diagnosis', 'syndrome', 'disorder',
      'cancer', 'tumor', 'infection', 'virus', 'bacteria', 'drug', 'medicine'
    ];
    
    return meshKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * 从查询中提取MeSH术语
   */
  private extractMeSHTerm(query: string): string | undefined {
    const meshMatch = query.match(/mesh:\s*(.+)/i);
    return meshMatch ? meshMatch[1].trim() : query;
  }

  /**
   * 获取支持的MeSH分类
   */
  getSupportedMeSHCategories(): Record<string, string> {
    return { ...this.MESH_CATEGORIES };
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): any {
    return {
      requestsUsed: this.requestCount,
      rateLimits: '1 request per second (recommended)',
      features: ['search', 'paper_details', 'author_search', 'mesh_search'],
      supportedCategories: Object.keys(this.MESH_CATEGORIES).length,
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * 验证PMID格式
   */
  validatePMID(pmid: string): boolean {
    const pmidPattern = /^\d{8,}$/;
    const cleanPmid = pmid.replace(/^(PMID:|pmid:)/i, '');
    return pmidPattern.test(cleanPmid);
  }


}
