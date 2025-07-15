/**
 * 统一输出格式定义
 * 解决高级工具和基础工具输出格式差异问题
 */

/**
 * 统一的搜索结果项
 */
export interface UnifiedSearchResultItem {
  /** 结果唯一标识 */
  id: string;
  
  /** 结果标题 */
  title: string;
  
  /** 结果URL */
  url: string;
  
  /** 结果摘要/描述 */
  summary: string;
  
  /** 相关性评分 (0-100) */
  relevanceScore: number;
  
  /** 数据源 */
  source: string;
  
  /** 内容类型 */
  contentType: 'article' | 'paper' | 'video' | 'image' | 'code' | 'discussion' | 'news' | 'document' | 'other';
  
  /** 发布时间 */
  publishedAt?: string;
  
  /** 作者信息 */
  author?: string;
  
  /** 缩略图 */
  thumbnail?: string;
  
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * 搜索质量指标
 */
export interface SearchQualityMetrics {
  /** 总体质量评分 (0-100) */
  overallScore: number;
  
  /** 相关性评分 (0-100) */
  relevanceScore: number;
  
  /** 新鲜度评分 (0-100) */
  freshnessScore: number;
  
  /** 权威性评分 (0-100) */
  authorityScore: number;
  
  /** 覆盖度评分 (0-100) */
  coverageScore: number;
  
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 搜索元数据
 */
export interface SearchMetadata {
  /** 总结果数 */
  totalResults: number;
  
  /** 当前页码 */
  page: number;
  
  /** 每页结果数 */
  pageSize: number;
  
  /** 执行时间(毫秒) */
  executionTimeMs: number;
  
  /** API配额使用量 */
  apiQuotaUsed: number;
  
  /** 数据源列表 */
  sources: string[];
  
  /** 是否来自缓存 */
  cached: boolean;
  
  /** 缓存过期时间 */
  cacheExpiresAt?: string;
  
  /** 搜索策略 */
  searchStrategy?: string;
  
  /** 使用的API列表 */
  apisUsed?: string[];
}

/**
 * 错误信息
 */
export interface ErrorInfo {
  /** 错误代码 */
  code: string;
  
  /** 错误消息 */
  message: string;
  
  /** 错误详情 */
  details?: string;
  
  /** 建议解决方案 */
  suggestions?: string[];
  
  /** 错误发生时间 */
  timestamp: string;
  
  /** 错误来源 */
  source?: string;
}

/**
 * 统一的工具输出格式
 */
export interface UnifiedToolOutput {
  /** 执行状态 */
  status: 'success' | 'error' | 'partial' | 'warning';
  
  /** 查询内容 */
  query: string;
  
  /** 平台/工具名称 */
  platform: string;
  
  /** 搜索结果 */
  results: UnifiedSearchResultItem[];
  
  /** 搜索元数据 */
  metadata: SearchMetadata;
  
  /** 质量指标 */
  qualityMetrics?: SearchQualityMetrics;
  
  /** 错误信息 (仅在status为error时) */
  error?: ErrorInfo;
  
  /** 警告信息 */
  warnings?: string[];
  
  /** 搜索建议 */
  suggestions?: string[];
  
  /** 相关查询 */
  relatedQueries?: string[];
  
  /** 摘要信息 */
  summary?: string;
  
  /** 时间戳 */
  timestamp: string;
  
  /** 工具版本 */
  version?: string;
}

/**
 * 批量搜索结果
 */
export interface BatchSearchOutput {
  /** 批量查询ID */
  batchId: string;
  
  /** 总体状态 */
  status: 'success' | 'error' | 'partial';
  
  /** 各个查询的结果 */
  results: Array<{
    query: string;
    output: UnifiedToolOutput;
  }>;
  
  /** 聚合元数据 */
  aggregatedMetadata: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    totalResults: number;
    totalExecutionTimeMs: number;
    averageQualityScore: number;
  };
  
  /** 批量执行时间戳 */
  timestamp: string;
}

/**
 * 输出格式验证器
 */
export class OutputFormatValidator {
  /**
   * 验证统一输出格式
   */
  static validateUnifiedOutput(output: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查必需字段
    const requiredFields = ['status', 'query', 'platform', 'results', 'metadata', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in output)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // 检查状态值
    if (output.status && !['success', 'error', 'partial', 'warning'].includes(output.status)) {
      errors.push(`Invalid status value: ${output.status}`);
    }
    
    // 检查结果数组
    if (output.results && !Array.isArray(output.results)) {
      errors.push('Results must be an array');
    }
    
    // 检查元数据
    if (output.metadata) {
      const metadataRequired = ['totalResults', 'executionTimeMs', 'sources'];
      for (const field of metadataRequired) {
        if (!(field in output.metadata)) {
          errors.push(`Missing metadata field: ${field}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 验证搜索结果项
   */
  static validateResultItem(item: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const requiredFields = ['id', 'title', 'url', 'summary', 'relevanceScore', 'source', 'contentType'];
    for (const field of requiredFields) {
      if (!(field in item)) {
        errors.push(`Missing result item field: ${field}`);
      }
    }
    
    // 检查相关性评分范围
    if (item.relevanceScore && (item.relevanceScore < 0 || item.relevanceScore > 100)) {
      errors.push('Relevance score must be between 0 and 100');
    }
    
    // 检查内容类型
    const validContentTypes = ['article', 'paper', 'video', 'image', 'code', 'discussion', 'news', 'document', 'other'];
    if (item.contentType && !validContentTypes.includes(item.contentType)) {
      errors.push(`Invalid content type: ${item.contentType}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * 输出格式转换器
 */
export class OutputFormatConverter {
  /**
   * 将旧格式转换为统一格式
   */
  static convertLegacyFormat(legacyOutput: any, platform: string): UnifiedToolOutput {
    const now = new Date().toISOString();
    
    // 基础转换
    const unified: UnifiedToolOutput = {
      status: legacyOutput.success ? 'success' : 'error',
      query: legacyOutput.query || '',
      platform,
      results: [],
      metadata: {
        totalResults: 0,
        page: 1,
        pageSize: 10,
        executionTimeMs: 0,
        apiQuotaUsed: 1,
        sources: [platform],
        cached: false
      },
      timestamp: now
    };
    
    // 转换结果数据
    if (legacyOutput.data?.results) {
      unified.results = legacyOutput.data.results.map((item: any, index: number) => ({
        id: item.id || `${platform}_${index}`,
        title: item.title || '',
        url: item.url || item.link || '',
        summary: item.summary || item.snippet || item.description || '',
        relevanceScore: item.relevanceScore || 50,
        source: item.source || platform,
        contentType: this.inferContentType(item),
        publishedAt: item.publishedAt || item.timestamp,
        author: item.author,
        thumbnail: item.thumbnail || item.image,
        metadata: item.metadata
      }));
      
      unified.metadata.totalResults = unified.results.length;
    }
    
    // 转换元数据
    if (legacyOutput.data) {
      unified.metadata.executionTimeMs = legacyOutput.data.searchTime || 0;
      unified.metadata.totalResults = legacyOutput.data.totalResults || unified.results.length;
      unified.metadata.cached = legacyOutput.data.cached || false;
    }
    
    // 转换错误信息
    if (legacyOutput.error) {
      unified.error = {
        code: 'UNKNOWN_ERROR',
        message: legacyOutput.error,
        timestamp: now
      };
    }
    
    return unified;
  }
  
  /**
   * 推断内容类型
   */
  private static inferContentType(item: any): UnifiedSearchResultItem['contentType'] {
    const url = item.url || item.link || '';
    const title = item.title || '';
    
    if (url.includes('youtube.com') || url.includes('vimeo.com')) return 'video';
    if (url.includes('github.com')) return 'code';
    if (url.includes('reddit.com') || url.includes('stackoverflow.com')) return 'discussion';
    if (url.includes('arxiv.org') || url.includes('pubmed.ncbi.nlm.nih.gov')) return 'paper';
    if (url.includes('.pdf')) return 'document';
    if (url.includes('news') || title.toLowerCase().includes('news')) return 'news';
    if (url.includes('.jpg') || url.includes('.png') || url.includes('.gif')) return 'image';
    
    return 'article';
  }
}

/**
 * 质量评估器
 */
export class QualityAssessment {
  /**
   * 计算搜索质量指标
   */
  static calculateQualityMetrics(results: UnifiedSearchResultItem[], query: string): SearchQualityMetrics {
    if (results.length === 0) {
      return {
        overallScore: 0,
        relevanceScore: 0,
        freshnessScore: 0,
        authorityScore: 0,
        coverageScore: 0,
        confidence: 0
      };
    }
    
    const relevanceScore = results.reduce((sum, item) => sum + item.relevanceScore, 0) / results.length;
    const freshnessScore = this.calculateFreshnessScore(results);
    const authorityScore = this.calculateAuthorityScore(results);
    const coverageScore = this.calculateCoverageScore(results, query);
    
    const overallScore = (relevanceScore + freshnessScore + authorityScore + coverageScore) / 4;
    const confidence = Math.min(overallScore / 100, 1);
    
    return {
      overallScore: Math.round(overallScore),
      relevanceScore: Math.round(relevanceScore),
      freshnessScore: Math.round(freshnessScore),
      authorityScore: Math.round(authorityScore),
      coverageScore: Math.round(coverageScore),
      confidence: Math.round(confidence * 100) / 100
    };
  }
  
  /**
   * 计算新鲜度评分
   */
  private static calculateFreshnessScore(results: UnifiedSearchResultItem[]): number {
    const now = new Date();
    let totalScore = 0;
    let validItems = 0;
    
    for (const item of results) {
      if (item.publishedAt) {
        const publishedDate = new Date(item.publishedAt);
        const daysDiff = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        let score = 100;
        if (daysDiff > 365) score = 20;
        else if (daysDiff > 180) score = 40;
        else if (daysDiff > 90) score = 60;
        else if (daysDiff > 30) score = 80;
        
        totalScore += score;
        validItems++;
      }
    }
    
    return validItems > 0 ? totalScore / validItems : 50;
  }
  
  /**
   * 计算权威性评分
   */
  private static calculateAuthorityScore(results: UnifiedSearchResultItem[]): number {
    const authorityDomains = [
      'wikipedia.org', 'github.com', 'stackoverflow.com', 'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov', 'nature.com', 'science.org', 'ieee.org'
    ];
    
    let authorityCount = 0;
    for (const item of results) {
      const domain = new URL(item.url).hostname.toLowerCase();
      if (authorityDomains.some(authDomain => domain.includes(authDomain))) {
        authorityCount++;
      }
    }
    
    return Math.min((authorityCount / results.length) * 100, 100);
  }
  
  /**
   * 计算覆盖度评分
   */
  private static calculateCoverageScore(results: UnifiedSearchResultItem[], query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    let coverageSum = 0;
    
    for (const item of results) {
      const content = (item.title + ' ' + item.summary).toLowerCase();
      const coveredWords = queryWords.filter(word => content.includes(word));
      const coverage = coveredWords.length / queryWords.length;
      coverageSum += coverage;
    }
    
    return results.length > 0 ? (coverageSum / results.length) * 100 : 0;
  }
}
