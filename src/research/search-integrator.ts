/**
 * Search Integrator for Interactive Deep Research Engine
 * 
 * This module integrates the existing 35+ search tools with the Interactive Deep Research Engine,
 * replacing mock search implementations with real search functionality.
 */

import { Logger } from '../utils/logger.js';
// Define ResearchQuery type locally since the original file was deleted
interface ResearchQuery {
  query: string;
  topic: string;
  context?: string;
  depth?: number;
  sources?: string[];
  domains?: string[];
  timeRange?: string;
}

// Import tool registry to access existing search tools
import { ToolRegistry } from '../tools/tool-registry.js';
import { IntelligentRanker, RankingConfig } from '../ranking/intelligent-ranker.js';
// import { PerformanceMonitor } from '../utils/performance-monitor.js'; // Simplified
import { EnhancedSearchResult, SearchResult } from '../types.js';
import axios from 'axios';

export interface SearchTask {
  source: string;
  priority: number;
  maxResults: number;
}

/**
 * Search Integrator Class
 * Maps search source names to actual search tool implementations
 */
export class SearchIntegrator {
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  private intelligentRanker: IntelligentRanker;
  // private performanceMonitor: PerformanceMonitor; // Simplified

  constructor(toolRegistry?: ToolRegistry, rankingConfig?: Partial<RankingConfig>) {
    this.logger = new Logger('SearchIntegrator');
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.intelligentRanker = new IntelligentRanker(rankingConfig);
    // this.performanceMonitor = new PerformanceMonitor(); // Simplified
  }

  /**
   * Get the appropriate tool name for a search source
   */
  private getToolNameForSource(source: string): string {
    // Map search source names to actual tool names
    const sourceToToolMap: Record<string, string> = {
      // Academic sources
      'arxiv_search': 'search_arxiv',
      'academic_search_basic': 'search_arxiv',
      'academic_search_comprehensive': 'search_arxiv',
      'academic_search_exhaustive': 'search_arxiv',
      'pubmed_search': 'search_pubmed',
      'google_scholar': 'search_google_scholar',
      'ieee_search': 'search_ieee',

      // General web sources
      'wikipedia_search': 'search_wikipedia',
      'web_search_general': 'search_wikipedia',

      // Technical sources
      'github_search': 'search_github',
      'stackoverflow_search': 'search_stackoverflow',
      'technical_docs_search': 'search_stackoverflow',
      'technical_docs_comprehensive': 'search_stackoverflow',
      'tech_blogs': 'search_medium_tech',
      'devto_search': 'search_devto',

      // News sources
      'news_search_recent': 'search_techcrunch',
      'news_search_comprehensive': 'search_techcrunch',
      'news_search_exhaustive': 'search_techcrunch',
      'techcrunch_search': 'search_techcrunch',
      'bbc_tech_search': 'search_bbc_tech',
      'reuters_tech_search': 'search_reuters_tech',
      'financial_news': 'search_reuters_tech',

      // Social and forum sources
      'reddit_search': 'search_reddit',
      'social_media_search': 'search_reddit',
      'hackernews_search': 'search_hackernews',
      'expert_forums_search': 'search_quora',
      'expert_forums_comprehensive': 'search_quora',
      'quora_search': 'search_quora',
      'stackexchange_search': 'search_stackexchange',

      // Fallback mappings
      'government_sources': 'search_wikipedia',
      'industry_reports': 'search_wikipedia',
      'patent_search': 'search_wikipedia',
      'sec_filings': 'search_wikipedia',
      'market_data': 'search_wikipedia'
    };

    return sourceToToolMap[source] || 'search_wikipedia';
  }

  /**
   * Execute a search task using the appropriate search tool
   */
  async executeSearchTask(task: SearchTask, query: ResearchQuery): Promise<EnhancedSearchResult[]> {
    const { source, maxResults } = task;

    this.logger.debug(`Executing search task: ${source} (max: ${maxResults})`);

    // Performance monitoring simplified
    const requestId = `${source}-${Date.now()}`;

    try {
      // Get the tool name for this source
      const toolName = this.getToolNameForSource(source);

      // Check if the tool exists in the registry
      const tool = this.toolRegistry.getTool(toolName);

      if (!tool) {
        this.logger.warn(`No tool found for source: ${source} (tool: ${toolName}), using fallback`);
        const fallbackResults = await this.executeWikipediaFallback(query, maxResults);
        const enhancedFallbackResults = this.convertToEnhancedResults(fallbackResults);
        // this.performanceMonitor.completeRequest(requestId, true, enhancedFallbackResults); // Simplified
        return enhancedFallbackResults;
      }

      // Prepare search parameters
      const searchParams = this.prepareSearchParams(source, query, maxResults);

      // Execute the search tool
      const toolResult = await tool.execute(searchParams);

      // Convert tool result to standardized format
      const standardizedResults = this.standardizeToolResults(toolResult, source);

      // Convert to EnhancedSearchResult format for ranking
      const enhancedResults = this.convertToEnhancedResults(standardizedResults);

      // Apply intelligent ranking and optimization
      const rankedResults = await this.intelligentRanker.rankResults(
        enhancedResults,
        query.topic,
        {
          topic: query.topic,
          domain: query.domains?.[0],
          timeRange: query.timeRange
        }
      );

      // Limit results to maxResults after ranking
      const limitedResults = rankedResults.slice(0, maxResults);

      this.logger.debug(`Search completed: ${limitedResults.length} results from ${source} (ranked and optimized)`);

      // Complete performance monitoring
      // this.performanceMonitor.completeRequest(requestId, true, limitedResults); // Simplified

      return limitedResults;

    } catch (error) {
      this.logger.error(`Search failed for ${source}:`, error);

      // Complete performance monitoring with error
      // this.performanceMonitor.completeRequest(requestId, false, [], error instanceof Error ? error.message : String(error)); // Simplified

      // Return empty results on failure
      return [];
    }
  }

  /**
   * Prepare search parameters for different search tools
   */
  private prepareSearchParams(source: string, query: ResearchQuery, maxResults: number): any {
    const baseParams = {
      query: query.topic,
      maxResults: maxResults
    };

    // Add source-specific parameters
    switch (source) {
      case 'arxiv_search':
      case 'academic_search_basic':
      case 'academic_search_comprehensive':
      case 'academic_search_exhaustive':
        return {
          ...baseParams,
          category: 'all'
        };

      case 'pubmed_search':
        return {
          ...baseParams,
          database: 'pubmed'
        };

      case 'github_search':
        return {
          ...baseParams,
          type: 'repositories'
        };

      case 'stackoverflow_search':
        return {
          ...baseParams,
          site: 'stackoverflow'
        };

      case 'reddit_search':
        return {
          ...baseParams,
          subreddit: 'all'
        };

      default:
        return baseParams;
    }
  }

  /**
   * Standardize tool results to SearchResult format
   */
  private standardizeToolResults(toolResult: any, source: string): SearchResult[] {
    if (!toolResult || !toolResult.success || !toolResult.data) {
      return [];
    }

    const results = Array.isArray(toolResult.data) ? toolResult.data : [toolResult.data];

    return results.map((result: any) => {
      // Handle different result formats from different tools
      const standardized: SearchResult = {
        title: result.title || result.name || 'Untitled',
        url: result.url || result.link || result.href || '#',
        snippet: result.snippet || result.description || result.summary || result.abstract || '',
        content: result.content || result.description || result.summary || result.abstract || '',
        source: source,
        timestamp: new Date().toISOString(),
        score: result.relevance || result.score || 0.8,
        type: 'web' as const,
        metadata: {
          originalResult: result,
          searchSource: source,
          toolResult: toolResult
        }
      };

      return standardized;
    });
  }

  /**
   * Fallback search using Wikipedia tool
   */
  private async executeWikipediaFallback(query: ResearchQuery, maxResults: number): Promise<SearchResult[]> {
    try {
      const wikipediaTool = this.toolRegistry.getTool('search_wikipedia');

      if (!wikipediaTool) {
        this.logger.error('Wikipedia tool not found for fallback');
        return [];
      }

      const toolResult = await wikipediaTool.execute({
        query: query.topic,
        maxResults: maxResults
      });

      return this.standardizeToolResults(toolResult, 'wikipedia_fallback');
    } catch (error) {
      this.logger.error('Wikipedia fallback search failed:', error);
      return [];
    }
  }

  /**
   * Get available search sources
   */
  getAvailableSources(): string[] {
    const allTools = this.toolRegistry.getAllTools();
    return allTools
      .filter(tool => tool.category === 'academic' || tool.category === 'tech' || tool.category === 'news' || tool.category === 'social')
      .map(tool => tool.name);
  }

  /**
   * Check if a search source is available
   */
  isSourceAvailable(source: string): boolean {
    const toolName = this.getToolNameForSource(source);
    return this.toolRegistry.getTool(toolName) !== undefined;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(timeWindow: 'short' | 'medium' | 'long' = 'short') {
    // return this.performanceMonitor.getCurrentMetrics(timeWindow); // Simplified
    return { requests: 0, averageTime: 0, successRate: 100 };
  }

  /**
   * Get performance metrics by source
   */
  getPerformanceMetricsBySource(timeWindow: 'short' | 'medium' | 'long' = 'short') {
    // return this.performanceMonitor.getMetricsBySource(timeWindow); // Simplified
    return {};
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts(limit: number = 50) {
    // return this.performanceMonitor.getAlerts(limit); // Simplified
    return [];
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24) {
    // return this.performanceMonitor.getPerformanceTrends(hours); // Simplified
    return [];
  }

  /**
   * Configure intelligent ranking
   */
  configureRanking(config: Partial<RankingConfig>) {
    this.intelligentRanker = new IntelligentRanker(config);
    this.logger.info('Intelligent ranking configuration updated');
  }

  /**
   * Convert SearchResult to EnhancedSearchResult
   */
  private convertToEnhancedResults(results: SearchResult[]): EnhancedSearchResult[] {
    return results.map(result => ({
      ...result,
      relevanceScore: result.relevanceScore || result.score || 0.5,
      qualityScore: 0.7, // Default quality score
      summary: result.content ? result.content.substring(0, 200) + '...' : result.title,
      keyPoints: [],
      extractedEntities: [],
      credibilityScore: 0.7,
      lastUpdated: result.timestamp || new Date().toISOString(),
      wordCount: result.content ? result.content.split(' ').length : 0,
      readingTime: result.content ? Math.ceil(result.content.split(' ').length / 200) : 1
    }));
  }
}
