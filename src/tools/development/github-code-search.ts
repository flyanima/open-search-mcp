import { GitHubSearchClient } from '../../api/clients/github-search-client.js';
import { GitHubSearchRouter } from '../../utils/github-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * GitHub 代码搜索工具
 * 专门用于搜索GitHub代码，支持函数、类、算法等代码片段搜索
 */

const logger = new Logger('GitHubCodeSearch');

export async function githubCodeSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new GitHubSearchClient();
    const router = new GitHubSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing GitHub code search: ${args.query}`);

    const limit = args.limit || 10;
    const result = await handleCodeSearchRequest(client, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'code_search',
        result,
        source: 'GitHub',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('GitHub code search failed:', error);
    return {
      success: false,
      error: `GitHub code search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理代码搜索请求
 */
async function handleCodeSearchRequest(client: GitHubSearchClient, query: string, limit: number): Promise<any> {
  try {
    // 解析搜索参数
    const searchParams = parseCodeSearchQuery(query);
    
    const searchOptions = {
      per_page: Math.min(limit, 30),
      language: searchParams.language,
      filename: searchParams.filename,
      extension: searchParams.extension,
      ...searchParams
    };
    
    const searchQuery = searchParams.query || query;
    const searchData = await client.searchCode(searchQuery, searchOptions);
    
    if (!searchData.items || searchData.items.length === 0) {
      return {
        type: 'code_search',
        query: query,
        codeResults: [],
        totalResults: 0,
        message: `No code found for "${query}"`,
        suggestions: generateCodeSearchSuggestions(query)
      };
    }

    // 增强代码搜索结果
    const enhancedResults = searchData.items.map((item: any) => ({
      ...item,
      relevanceScore: calculateCodeRelevanceScore(item, query),
      codeQuality: assessCodeQuality(item),
      repositoryMetrics: analyzeRepository(item.repository),
      usageContext: identifyUsageContext(item),
      codeType: identifyCodeType(item.name, item.path)
    }));

    // 按相关性和质量排序
    enhancedResults.sort((a: any, b: any) => {
      const scoreA = a.relevanceScore + a.codeQuality + a.repositoryMetrics.qualityScore;
      const scoreB = b.relevanceScore + b.codeQuality + b.repositoryMetrics.qualityScore;
      return scoreB - scoreA;
    });

    // 分析代码搜索结果
    const codeAnalysis = analyzeCodeResults(enhancedResults);

    return {
      type: 'code_search',
      query: query,
      codeResults: enhancedResults,
      totalResults: searchData.total_count,
      searchParams: searchOptions,
      analysis: codeAnalysis,
      summary: generateCodeSearchSummary(enhancedResults, query, codeAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 解析代码搜索查询
 */
function parseCodeSearchQuery(query: string): any {
  const params: any = {};
  
  // 提取语言
  const langMatch = query.match(/language:\s*([^\s]+)/i);
  if (langMatch) {
    params.language = langMatch[1];
    query = query.replace(/language:\s*[^\s]+/i, '').trim();
  }
  
  // 提取文件名
  const filenameMatch = query.match(/filename:\s*([^\s]+)/i);
  if (filenameMatch) {
    params.filename = filenameMatch[1];
    query = query.replace(/filename:\s*[^\s]+/i, '').trim();
  }
  
  // 提取扩展名
  const extensionMatch = query.match(/extension:\s*([^\s]+)/i);
  if (extensionMatch) {
    params.extension = extensionMatch[1];
    query = query.replace(/extension:\s*[^\s]+/i, '').trim();
  }
  
  // 提取路径
  const pathMatch = query.match(/path:\s*([^\s]+)/i);
  if (pathMatch) {
    params.path = pathMatch[1];
    query = query.replace(/path:\s*[^\s]+/i, '').trim();
  }
  
  // 清理查询
  params.query = query.replace(/\s+/g, ' ').trim();
  
  return params;
}

/**
 * 计算代码相关性分数
 */
function calculateCodeRelevanceScore(item: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 文件名匹配
  if (item.name) {
    const nameLower = item.name.toLowerCase();
    queryWords.forEach(word => {
      if (nameLower.includes(word)) score += 5;
    });
  }
  
  // 路径匹配
  if (item.path) {
    const pathLower = item.path.toLowerCase();
    queryWords.forEach(word => {
      if (pathLower.includes(word)) score += 3;
    });
  }
  
  // 仓库名匹配
  if (item.repository?.name) {
    const repoNameLower = item.repository.name.toLowerCase();
    queryWords.forEach(word => {
      if (repoNameLower.includes(word)) score += 2;
    });
  }
  
  // GitHub搜索分数
  if (item.score) {
    score += Math.min(item.score / 10, 10);
  }
  
  return Math.min(score, 50);
}

/**
 * 评估代码质量
 */
function assessCodeQuality(item: any): number {
  let qualityScore = 0;
  
  // 基于仓库星标
  const stars = item.repository?.stargazers_count || 0;
  if (stars > 10000) qualityScore += 15;
  else if (stars > 1000) qualityScore += 10;
  else if (stars > 100) qualityScore += 5;
  
  // 基于文件类型
  const extension = item.name.split('.').pop()?.toLowerCase();
  const qualityExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'rs'];
  if (extension && qualityExtensions.includes(extension)) {
    qualityScore += 5;
  }
  
  // 基于路径结构（表明项目组织良好）
  if (item.path.includes('/src/') || item.path.includes('/lib/') || item.path.includes('/components/')) {
    qualityScore += 5;
  }
  
  // 基于文件名（表明代码用途明确）
  if (item.name.includes('test') || item.name.includes('spec')) {
    qualityScore += 3; // 有测试文件
  }
  
  return Math.min(qualityScore, 30);
}

/**
 * 分析仓库指标
 */
function analyzeRepository(repo: any): any {
  if (!repo) return { qualityScore: 0 };
  
  const stars = repo.stargazers_count || 0;
  const language = repo.language || 'Unknown';
  const description = repo.description || '';
  
  let qualityScore = 0;
  
  // 基于星标
  if (stars > 10000) qualityScore += 20;
  else if (stars > 1000) qualityScore += 15;
  else if (stars > 100) qualityScore += 10;
  else if (stars > 10) qualityScore += 5;
  
  // 有描述
  if (description.length > 20) qualityScore += 5;
  
  return {
    qualityScore: Math.min(qualityScore, 25),
    popularity: stars > 1000 ? 'High' : stars > 100 ? 'Medium' : 'Low',
    language,
    trustLevel: stars > 5000 ? 'High' : stars > 500 ? 'Medium' : 'Basic'
  };
}

/**
 * 识别使用上下文
 */
function identifyUsageContext(item: any): string {
  const path = item.path.toLowerCase();
  const name = item.name.toLowerCase();
  
  if (path.includes('test') || name.includes('test') || name.includes('spec')) {
    return 'Test Code';
  }
  
  if (path.includes('example') || path.includes('demo') || path.includes('sample')) {
    return 'Example/Demo';
  }
  
  if (path.includes('src/') || path.includes('lib/')) {
    return 'Source Code';
  }
  
  if (path.includes('config') || name.includes('config')) {
    return 'Configuration';
  }
  
  if (path.includes('doc') || name.includes('readme')) {
    return 'Documentation';
  }
  
  if (path.includes('script') || path.includes('tool')) {
    return 'Script/Tool';
  }
  
  return 'General Code';
}

/**
 * 识别代码类型
 */
function identifyCodeType(filename: string, path: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  const nameLower = filename.toLowerCase();
  const pathLower = path.toLowerCase();
  
  // 基于扩展名
  const typeMapping: Record<string, string> = {
    'js': 'JavaScript',
    'jsx': 'React Component',
    'ts': 'TypeScript',
    'tsx': 'React TypeScript',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'rs': 'Rust',
    'go': 'Go',
    'php': 'PHP',
    'rb': 'Ruby',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'cs': 'C#',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON Config',
    'yml': 'YAML Config',
    'yaml': 'YAML Config',
    'md': 'Markdown',
    'sql': 'SQL'
  };
  
  if (extension && typeMapping[extension]) {
    return typeMapping[extension];
  }
  
  // 基于文件名模式
  if (nameLower.includes('component')) return 'Component';
  if (nameLower.includes('service')) return 'Service';
  if (nameLower.includes('util') || nameLower.includes('helper')) return 'Utility';
  if (nameLower.includes('model')) return 'Data Model';
  if (nameLower.includes('controller')) return 'Controller';
  if (nameLower.includes('api')) return 'API';
  if (nameLower.includes('test')) return 'Test';
  
  return 'Code File';
}

/**
 * 分析代码搜索结果
 */
function analyzeCodeResults(results: any[]): any {
  if (results.length === 0) return {};
  
  const analysis = {
    totalResults: results.length,
    languages: {} as Record<string, number>,
    codeTypes: {} as Record<string, number>,
    usageContexts: {} as Record<string, number>,
    averageQuality: 0,
    topRepositories: [] as any[],
    qualityDistribution: { high: 0, medium: 0, low: 0 }
  };
  
  // 统计分布
  results.forEach(result => {
    // 语言分布
    const language = result.repository?.language || 'Unknown';
    analysis.languages[language] = (analysis.languages[language] || 0) + 1;
    
    // 代码类型分布
    const codeType = result.codeType;
    if (codeType) {
      analysis.codeTypes[codeType] = (analysis.codeTypes[codeType] || 0) + 1;
    }
    
    // 使用上下文分布
    const context = result.usageContext;
    if (context) {
      analysis.usageContexts[context] = (analysis.usageContexts[context] || 0) + 1;
    }
    
    // 质量分布
    const quality = result.codeQuality;
    if (quality >= 20) analysis.qualityDistribution.high++;
    else if (quality >= 10) analysis.qualityDistribution.medium++;
    else analysis.qualityDistribution.low++;
  });
  
  // 计算平均质量
  analysis.averageQuality = results.reduce((sum, result) => sum + (result.codeQuality || 0), 0) / results.length;
  
  // 获取顶级仓库
  const uniqueRepos = new Map();
  results.forEach(result => {
    if (result.repository && !uniqueRepos.has(result.repository.full_name)) {
      uniqueRepos.set(result.repository.full_name, result.repository);
    }
  });
  
  analysis.topRepositories = Array.from(uniqueRepos.values())
    .sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 5);
  
  return analysis;
}

/**
 * 生成代码搜索建议
 */
function generateCodeSearchSuggestions(query: string): string[] {
  const suggestions: string[] = [];
  
  // 基于查询内容提供建议
  if (!query.includes('language:')) {
    suggestions.push('Add language filter: "' + query + ' language:javascript"');
    suggestions.push('Add language filter: "' + query + ' language:python"');
  }
  
  if (!query.includes('filename:') && !query.includes('extension:')) {
    suggestions.push('Search in specific files: "' + query + ' filename:package.json"');
    suggestions.push('Search by extension: "' + query + ' extension:js"');
  }
  
  suggestions.push('Try broader terms: remove specific keywords');
  suggestions.push('Try function names: "function ' + query + '"');
  suggestions.push('Try class names: "class ' + query + '"');
  
  return suggestions;
}

/**
 * 生成代码搜索摘要
 */
function generateCodeSearchSummary(results: any[], query: string, analysis: any): string {
  if (results.length === 0) return `No code found for "${query}"`;
  
  const topResult = results[0];
  const mainLanguage = Object.keys(analysis.languages)[0] || 'Unknown';
  const avgQuality = Math.round(analysis.averageQuality || 0);
  
  return `Found ${results.length} code results for "${query}". Top result: "${topResult.name}" in ${topResult.repository?.full_name}. Main language: ${mainLanguage}. Average quality: ${avgQuality}/30.`;
}

/**
 * 工具注册信息
 */
export const githubCodeSearchTool = {
  name: 'github_code_search',
  description: 'Search code across GitHub repositories with advanced filtering and quality analysis',
  category: 'development-search',
  source: 'api.github.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Code search query with optional filters. Examples: "function useState", "class Component language:javascript", "filename:package.json", "algorithm sort language:python"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of code results to return (default: 10, max: 30)',
        default: 10,
        minimum: 1,
        maximum: 30
      }
    },
    required: ['query']
  },
  execute: githubCodeSearch,
  examples: [
    {
      query: "function useState",
      description: "Search for useState function implementations"
    },
    {
      query: "class Component language:javascript",
      description: "Find JavaScript component classes"
    },
    {
      query: "filename:package.json",
      description: "Search in package.json files"
    },
    {
      query: "algorithm sort language:python",
      description: "Find sorting algorithms in Python"
    },
    {
      query: "async function extension:ts",
      description: "Search for async functions in TypeScript files"
    },
    {
      query: "machine learning path:src",
      description: "Find ML code in src directories"
    }
  ]
};
