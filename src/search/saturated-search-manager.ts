/**
 * Saturated Search Manager
 * Manages concurrent searches across 200+ search sources, implementing true web-wide saturated search
 */

import { Logger } from '../utils/logger.js';
import { 
  COMPREHENSIVE_SEARCH_SOURCES, 
  SearchSourceConfig, 
  SearchSourceCategory,
  getAllActiveSources,
  getSourcesByDomain,
  getHighPrioritySources
} from '../config/comprehensive-search-sources.js';
import { ToolRegistry } from '../tools/tool-registry.js';
// import { PerformanceMonitor } from '../utils/performance-monitor.js'; // Simplified

export interface SaturatedSearchQuery {
  topic: string;
  domains?: string[];
  languages?: string[];
  maxConcurrentRequests?: number;
  priorityThreshold?: number;
  includeAuthRequired?: boolean;
  timeoutMs?: number;
}

export interface SaturatedSearchResult {
  sourceId: string;
  sourceName: string;
  results: any[];
  success: boolean;
  error?: string;
  responseTime: number;
  resultCount: number;
}

export interface SaturatedSearchSummary {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalResults: number;
  averageResponseTime: number;
  searchDuration: number;
  sourcesUsed: string[];
  errors: Array<{sourceId: string, error: string}>;
}

/**
 * 饱和搜索管理器
 * 实现200+搜索源的并发搜索
 */
export class SaturatedSearchManager {
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  // private performanceMonitor: PerformanceMonitor; // Simplified
  private activeRequests: Map<string, Promise<SaturatedSearchResult>> = new Map();

  constructor(toolRegistry: ToolRegistry) {
    this.logger = new Logger('SaturatedSearchManager');
    this.toolRegistry = toolRegistry;
    // this.performanceMonitor = new PerformanceMonitor(); // Simplified
  }

  /**
   * 执行饱和搜索 - 200+搜索源并发搜索
   */
  async executeSaturatedSearch(query: SaturatedSearchQuery): Promise<{
    results: SaturatedSearchResult[];
    summary: SaturatedSearchSummary;
  }> {
    const startTime = Date.now();
    this.logger.info(`Starting saturated search for: "${query.topic}"`);

    // 1. 选择搜索源
    const selectedSources = this.selectSearchSources(query);
    this.logger.info(`Selected ${selectedSources.length} search sources for saturated search`);

    // 2. 创建并发搜索任务
    const searchTasks = this.createSearchTasks(selectedSources, query);
    
    // 3. 执行并发搜索（带速率限制和错误处理）
    const results = await this.executeConcurrentSearches(searchTasks, query);

    // 4. 生成搜索摘要
    const summary = this.generateSearchSummary(results, selectedSources, startTime);

    this.logger.info(`Saturated search completed: ${summary.successfulSources}/${summary.totalSources} sources successful, ${summary.totalResults} total results`);

    return { results, summary };
  }

  /**
   * 选择搜索源
   */
  private selectSearchSources(query: SaturatedSearchQuery): SearchSourceConfig[] {
    let sources: SearchSourceConfig[] = [];

    // 获取所有活跃的搜索源
    const allSources = getAllActiveSources();

    // 根据领域过滤
    if (query.domains && query.domains.length > 0) {
      const domainSources = new Set<SearchSourceConfig>();
      for (const domain of query.domains) {
        const domainSpecificSources = getSourcesByDomain(domain);
        domainSpecificSources.forEach(source => domainSources.add(source));
      }
      sources = Array.from(domainSources);
    } else {
      sources = allSources;
    }

    // 根据优先级过滤
    if (query.priorityThreshold !== undefined) {
      sources = sources.filter(source => source.priority >= query.priorityThreshold!);
    }

    // 根据认证要求过滤
    if (!query.includeAuthRequired) {
      sources = sources.filter(source => !source.requiresAuth);
    }

    // 根据语言过滤
    if (query.languages && query.languages.length > 0) {
      sources = sources.filter(source => 
        !source.languages || 
        source.languages.some(lang => query.languages!.includes(lang))
      );
    }

    // 按优先级排序
    sources.sort((a, b) => b.priority - a.priority);

    this.logger.debug(`Source selection: ${sources.length} sources selected from ${allSources.length} total sources`);
    
    return sources;
  }

  /**
   * 创建搜索任务
   */
  private createSearchTasks(
    sources: SearchSourceConfig[], 
    query: SaturatedSearchQuery
  ): Array<{source: SearchSourceConfig, searchParams: any}> {
    return sources.map(source => ({
      source,
      searchParams: {
        query: query.topic,
        maxResults: source.maxResults,
        // 添加源特定的参数
        ...(source.domains && { domains: source.domains }),
        ...(source.languages && { languages: source.languages })
      }
    }));
  }

  /**
   * 执行并发搜索
   */
  private async executeConcurrentSearches(
    tasks: Array<{source: SearchSourceConfig, searchParams: any}>,
    query: SaturatedSearchQuery
  ): Promise<SaturatedSearchResult[]> {
    const maxConcurrent = query.maxConcurrentRequests || 50; // 默认50个并发请求
    const timeoutMs = query.timeoutMs || 30000; // 默认30秒超时

    const results: SaturatedSearchResult[] = [];
    const semaphore = new Semaphore(maxConcurrent);

    // 创建所有搜索Promise
    const searchPromises = tasks.map(async (task) => {
      return semaphore.acquire().then(async (release) => {
        try {
          const result = await this.executeSearchTask(task, timeoutMs);
          return result;
        } finally {
          release();
        }
      });
    });

    // 等待所有搜索完成
    const settledResults = await Promise.allSettled(searchPromises);

    // 处理结果
    settledResults.forEach((settledResult, index) => {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value);
      } else {
        // 处理Promise被拒绝的情况
        const task = tasks[index];
        results.push({
          sourceId: task.source.id,
          sourceName: task.source.name,
          results: [],
          success: false,
          error: settledResult.reason?.message || 'Unknown error',
          responseTime: 0,
          resultCount: 0
        });
      }
    });

    return results;
  }

  /**
   * 执行单个搜索任务
   */
  private async executeSearchTask(
    task: {source: SearchSourceConfig, searchParams: any},
    timeoutMs: number
  ): Promise<SaturatedSearchResult> {
    const { source, searchParams } = task;
    const startTime = Date.now();

    try {
      // 获取对应的搜索工具
      const toolName = this.getToolNameForSource(source);
      const tool = this.toolRegistry.getTool(toolName);

      if (!tool) {
        throw new Error(`No tool found for source: ${source.id}`);
      }

      // 执行搜索（带超时）
      const searchPromise = tool.execute(searchParams);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Search timeout')), timeoutMs);
      });

      const toolResult = await Promise.race([searchPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      // 标准化结果
      const results = this.standardizeResults(toolResult, source);

      return {
        sourceId: source.id,
        sourceName: source.name,
        results: results,
        success: true,
        responseTime: responseTime,
        resultCount: results.length
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.warn(`Search failed for ${source.id}: ${error}`);

      return {
        sourceId: source.id,
        sourceName: source.name,
        results: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: responseTime,
        resultCount: 0
      };
    }
  }

  /**
   * 根据搜索源获取对应的工具名称
   * 为200+搜索源提供完整的工具映射
   */
  private getToolNameForSource(source: SearchSourceConfig): string {
    // 建立搜索源ID到实际MCP工具名称的完整映射
    const toolMappings: Record<string, string> = {
      // 学术搜索工具 - 使用专门的paper search工具
      'google_scholar': 'search_google_scholar_paper_search_server',
      'pubmed_search': 'search_pubmed_paper_search_server',
      'arxiv_search': 'search_arxiv_paper_search_server',
      'semantic_scholar': 'search_semantic_paper_search_server',
      'biorxiv_search': 'search_biorxiv_paper_search_server',
      'medrxiv_search': 'search_medrxiv_paper_search_server',
      'iacr_search': 'search_iacr_paper_search_server',

      // 其他学术期刊和数据库 - 使用研究论文搜索工具
      'ieee_xplore': 'research_paper_search_exa_exa',
      'acm_digital_library': 'research_paper_search_exa_exa',
      'springer_link': 'research_paper_search_exa_exa',
      'sciencedirect': 'research_paper_search_exa_exa',
      'nature_journals': 'research_paper_search_exa_exa',
      'science_magazine': 'research_paper_search_exa_exa',
      'cell_press': 'research_paper_search_exa_exa',
      'plos_journals': 'research_paper_search_exa_exa',
      'frontiers_journals': 'research_paper_search_exa_exa',
      'lancet_journals': 'research_paper_search_exa_exa',
      'nejm_journal': 'research_paper_search_exa_exa',
      'jama_network': 'research_paper_search_exa_exa',
      'bmj_journals': 'research_paper_search_exa_exa',
      'wiley_journals': 'research_paper_search_exa_exa',
      'taylor_francis': 'research_paper_search_exa_exa',
      'sage_journals': 'research_paper_search_exa_exa',
      'cambridge_journals': 'research_paper_search_exa_exa',
      'oxford_journals': 'research_paper_search_exa_exa',
      'mdpi_journals': 'research_paper_search_exa_exa',
      'microsoft_academic': 'research_paper_search_exa_exa',
      'web_of_science': 'research_paper_search_exa_exa',
      'scopus_search': 'research_paper_search_exa_exa',
      'jstor_search': 'research_paper_search_exa_exa',
      'proquest_search': 'research_paper_search_exa_exa',
      'ebsco_search': 'research_paper_search_exa_exa',
      'cochrane_library': 'research_paper_search_exa_exa',
      'lens_org': 'research_paper_search_exa_exa',
      'dimensions_ai': 'research_paper_search_exa_exa',
      'crossref_search': 'research_paper_search_exa_exa',
      'dblp_search': 'research_paper_search_exa_exa',
      'citeseerx_search': 'research_paper_search_exa_exa',
      'core_search': 'research_paper_search_exa_exa',
      'base_search': 'research_paper_search_exa_exa',
      'openaire_search': 'research_paper_search_exa_exa',

      // 预印本服务器
      'engrxiv_search': 'research_paper_search_exa_exa',
      'psyarxiv_search': 'research_paper_search_exa_exa',
      'socarxiv_search': 'research_paper_search_exa_exa',
      'chemrxiv_search': 'research_paper_search_exa_exa',
      'techrxiv_search': 'research_paper_search_exa_exa',
      'eartharxiv_search': 'research_paper_search_exa_exa',
      'authorea_search': 'research_paper_search_exa_exa',
      'figshare_search': 'research_paper_search_exa_exa',
      'zenodo_search': 'research_paper_search_exa_exa',
      'researchgate_search': 'research_paper_search_exa_exa',

      // 论文库
      'ndltd_search': 'research_paper_search_exa_exa',
      'dart_europe': 'research_paper_search_exa_exa',
      'theses_canada': 'research_paper_search_exa_exa',
      'ethos_bl': 'research_paper_search_exa_exa',
      'oatd_search': 'research_paper_search_exa_exa',

      // 专门搜索工具
      'linkedin_search': 'linkedin_search_exa_exa',
      'wikipedia_search': 'wikipedia_search_exa_exa',
      'github_search': 'github_search_exa_exa',
      'company_research': 'company_research_exa_exa'
    };

    // 如果没有找到特定映射，根据类别选择合适的工具
    if (toolMappings[source.id]) {
      return toolMappings[source.id];
    }

    // 根据搜索源类别选择默认工具
    switch (source.category) {
      case 'academic_journals':
      case 'academic_databases':
      case 'preprint_servers':
      case 'thesis_repositories':
        return 'research_paper_search_exa_exa';

      case 'professional_networks':
        return 'linkedin_search_exa_exa';

      case 'encyclopedias':
      case 'reference_sites':
        return 'wikipedia_search_exa_exa';

      case 'developer_guides':
      case 'api_docs':
        return 'github_search_exa_exa';

      case 'company_databases':
      case 'market_research':
      case 'industry_reports':
        return 'company_research_exa_exa';

      default:
        // 所有其他类型使用通用web搜索
        return 'web_search_exa_exa';
    }
  }

  /**
   * 标准化搜索结果
   */
  private standardizeResults(toolResult: any, source: SearchSourceConfig): any[] {
    // 根据不同的工具结果格式进行标准化
    if (Array.isArray(toolResult)) {
      return toolResult;
    } else if (toolResult && Array.isArray(toolResult.results)) {
      return toolResult.results;
    } else if (toolResult && toolResult.data && Array.isArray(toolResult.data)) {
      return toolResult.data;
    } else {
      return [];
    }
  }

  /**
   * 生成搜索摘要
   */
  private generateSearchSummary(
    results: SaturatedSearchResult[],
    sources: SearchSourceConfig[],
    startTime: number
  ): SaturatedSearchSummary {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    const totalResults = successfulResults.reduce((sum, r) => sum + r.resultCount, 0);
    const averageResponseTime = results.length > 0 
      ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length 
      : 0;

    return {
      totalSources: sources.length,
      successfulSources: successfulResults.length,
      failedSources: failedResults.length,
      totalResults: totalResults,
      averageResponseTime: averageResponseTime,
      searchDuration: Date.now() - startTime,
      sourcesUsed: sources.map(s => s.name),
      errors: failedResults.map(r => ({
        sourceId: r.sourceId,
        error: r.error || 'Unknown error'
      }))
    };
  }
}

/**
 * 信号量实现，用于控制并发数量
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }
}
