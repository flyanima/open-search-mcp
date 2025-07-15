import { GitHubSearchClient } from '../../api/clients/github-search-client.js';
import { GitHubSearchRouter } from '../../utils/github-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * GitHub 搜索工具
 * 支持仓库搜索，智能路由到最合适的搜索方式
 */

const logger = new Logger('GitHubSearch');

export async function githubSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    // 智能路由搜索请求
    const route = router.routeSearch(args.query);
    
    logger.info(`Processing GitHub search: ${args.query} -> ${route.intent}`);

    let result;
    const limit = args.limit || 10;
    
    switch (route.endpoint) {
      case 'repositories':
        result = await handleRepositorySearch(client, route.params, args.query, limit);
        break;
        
      case 'repository_details':
        result = await handleRepositoryDetails(client, route.params, args.query);
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
        source: 'GitHub',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('GitHub search failed:', error);
    return {
      success: false,
      error: `GitHub search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理仓库搜索查询
 */
async function handleRepositorySearch(client: GitHubSearchClient, params: any, originalQuery: string, limit: number): Promise<any> {
  const searchOptions = {
    per_page: Math.min(limit, 50),
    sort: params.sort || 'best-match',
    language: params.language,
    license: params.license,
    size: params.size,
    ...params
  };
  
  const searchQuery = params.query || originalQuery;
  const searchData = await client.searchRepositories(searchQuery, searchOptions);
  
  if (!searchData.items || searchData.items.length === 0) {
    return {
      type: 'repository_search',
      query: originalQuery,
      repositories: [],
      totalResults: 0,
      message: `No GitHub repositories found for "${originalQuery}"`
    };
  }

  // 增强搜索结果
  const enhancedRepositories = searchData.items.map((repo: any) => ({
    ...repo,
    relevanceScore: calculateRelevanceScore(repo, originalQuery),
    trendingScore: calculateTrendingScore(repo),
    qualityScore: calculateQualityScore(repo),
    developmentStatus: assessDevelopmentStatus(repo)
  }));

  // 按相关性和质量排序
  enhancedRepositories.sort((a: any, b: any) => {
    const scoreA = a.relevanceScore + a.qualityScore + a.trendingScore;
    const scoreB = b.relevanceScore + b.qualityScore + b.trendingScore;
    return scoreB - scoreA;
  });

  return {
    type: 'repository_search',
    query: originalQuery,
    repositories: enhancedRepositories,
    totalResults: searchData.total_count,
    searchOptions,
    analysis: analyzeRepositories(enhancedRepositories),
    summary: generateRepositorySearchSummary(enhancedRepositories, originalQuery)
  };
}

/**
 * 处理仓库详情查询
 */
async function handleRepositoryDetails(client: GitHubSearchClient, params: any, originalQuery: string): Promise<any> {
  const { owner, repo } = params;
  
  if (!owner || !repo) {
    throw new Error('Owner and repository name are required for details query');
  }
  
  try {
    const repository = await client.getRepository(owner, repo);
    
    // 增强仓库信息
    const enhancedRepository = {
      ...repository,
      qualityScore: calculateQualityScore(repository),
      trendingScore: calculateTrendingScore(repository),
      developmentStatus: assessDevelopmentStatus(repository),
      contributionGuide: generateContributionGuide(repository),
      usageExamples: generateUsageExamples(repository),
      relatedProjects: await findRelatedProjects(client, repository)
    };
    
    return {
      type: 'repository_details',
      query: originalQuery,
      repository: enhancedRepository,
      summary: `Found details for repository "${repository.full_name}"`
    };
  } catch (error) {
    return {
      type: 'repository_details',
      query: originalQuery,
      repository: null,
      error: `Repository not found: ${owner}/${repo}`,
      suggestions: [`Try searching for: "${owner}" or "${repo}"`]
    };
  }
}

/**
 * 处理智能搜索
 */
async function handleSmartSearch(client: GitHubSearchClient, query: string, limit: number): Promise<any> {
  const searchData = await client.smartSearch(query, { per_page: Math.min(limit, 20) });
  
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
function calculateRelevanceScore(repo: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 名称匹配
  if (repo.name) {
    const nameLower = repo.name.toLowerCase();
    queryWords.forEach(word => {
      if (nameLower.includes(word)) score += 5;
    });
  }
  
  // 描述匹配
  if (repo.description) {
    const descLower = repo.description.toLowerCase();
    queryWords.forEach(word => {
      if (descLower.includes(word)) score += 2;
    });
  }
  
  // 主题匹配
  if (repo.topics) {
    queryWords.forEach(word => {
      repo.topics.forEach((topic: string) => {
        if (topic.toLowerCase().includes(word)) score += 3;
      });
    });
  }
  
  // 语言匹配
  if (repo.language) {
    queryWords.forEach(word => {
      if (repo.language.toLowerCase().includes(word)) score += 4;
    });
  }
  
  return Math.min(score, 100);
}

/**
 * 计算趋势分数
 */
function calculateTrendingScore(repo: any): number {
  const stars = repo.stargazers_count || 0;
  const forks = repo.forks_count || 0;
  const watchers = repo.watchers_count || 0;
  
  // 基于最近活动的趋势分数
  const lastPush = new Date(repo.pushed_at);
  const daysSinceLastPush = (Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24);
  
  let trendingScore = 0;
  
  // 活跃度加分
  if (daysSinceLastPush <= 7) trendingScore += 20;
  else if (daysSinceLastPush <= 30) trendingScore += 10;
  else if (daysSinceLastPush <= 90) trendingScore += 5;
  
  // 流行度加分
  if (stars > 10000) trendingScore += 15;
  else if (stars > 1000) trendingScore += 10;
  else if (stars > 100) trendingScore += 5;
  
  // 社区参与度加分
  if (forks > 1000) trendingScore += 10;
  else if (forks > 100) trendingScore += 5;
  
  return Math.min(trendingScore, 50);
}

/**
 * 计算质量分数
 */
function calculateQualityScore(repo: any): number {
  let qualityScore = 0;
  
  // 有描述
  if (repo.description && repo.description.length > 20) qualityScore += 10;
  
  // 有README（通过大小判断）
  if (repo.size > 0) qualityScore += 10;
  
  // 有许可证
  if (repo.license) qualityScore += 10;
  
  // 有主题标签
  if (repo.topics && repo.topics.length > 0) qualityScore += 10;
  
  // 有足够的星标
  if (repo.stargazers_count > 10) qualityScore += 5;
  if (repo.stargazers_count > 100) qualityScore += 5;
  
  // 有分叉
  if (repo.forks_count > 5) qualityScore += 5;
  
  // 最近更新
  const lastUpdate = new Date(repo.updated_at);
  const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate <= 30) qualityScore += 10;
  else if (daysSinceUpdate <= 180) qualityScore += 5;
  
  return Math.min(qualityScore, 50);
}

/**
 * 评估开发状态
 */
function assessDevelopmentStatus(repo: any): string {
  const lastPush = new Date(repo.pushed_at);
  const daysSinceLastPush = (Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastPush <= 7) return 'Very Active';
  if (daysSinceLastPush <= 30) return 'Active';
  if (daysSinceLastPush <= 90) return 'Maintained';
  if (daysSinceLastPush <= 365) return 'Occasionally Updated';
  return 'Inactive';
}

/**
 * 生成贡献指南
 */
function generateContributionGuide(repo: any): any {
  return {
    cloneUrl: repo.clone_url,
    language: repo.language,
    license: repo.license?.name || 'No license specified',
    topics: repo.topics || [],
    gettingStarted: [
      `git clone ${repo.clone_url}`,
      'cd ' + repo.name,
      repo.language === 'JavaScript' ? 'npm install' : 
      repo.language === 'Python' ? 'pip install -r requirements.txt' :
      repo.language === 'Java' ? 'mvn install' :
      'Follow project-specific setup instructions'
    ]
  };
}

/**
 * 生成使用示例
 */
function generateUsageExamples(repo: any): string[] {
  const examples: string[] = [];
  
  if (repo.language === 'JavaScript') {
    examples.push(`npm install ${repo.name}`);
    examples.push(`import ${repo.name} from '${repo.name}'`);
  } else if (repo.language === 'Python') {
    examples.push(`pip install ${repo.name}`);
    examples.push(`import ${repo.name}`);
  } else if (repo.language === 'Java') {
    examples.push('Add to pom.xml or build.gradle');
  }
  
  examples.push(`Visit: ${repo.html_url}`);
  examples.push(`Star: ${repo.stargazers_count} stars`);
  
  return examples;
}

/**
 * 查找相关项目
 */
async function findRelatedProjects(client: GitHubSearchClient, repo: any): Promise<any[]> {
  try {
    // 使用主要主题搜索相关项目
    const mainTopic = repo.topics?.[0] || repo.language;
    if (!mainTopic) return [];
    
    const result = await client.searchRepositories(mainTopic, { per_page: 3 });
    
    // 过滤掉当前仓库
    return result.items
      .filter((r: any) => r.id !== repo.id)
      .slice(0, 3)
      .map((r: any) => ({
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        html_url: r.html_url,
        stargazers_count: r.stargazers_count,
        language: r.language
      }));
  } catch (error) {
    return [];
  }
}

/**
 * 分析仓库集合
 */
function analyzeRepositories(repositories: any[]): any {
  if (repositories.length === 0) return {};
  
  const analysis = {
    totalRepositories: repositories.length,
    languages: {} as Record<string, number>,
    averageStars: 0,
    averageQuality: 0,
    topRepositories: repositories.slice(0, 3),
    developmentStatus: {} as Record<string, number>
  };
  
  // 统计语言分布
  repositories.forEach(repo => {
    if (repo.language) {
      analysis.languages[repo.language] = (analysis.languages[repo.language] || 0) + 1;
    }
    
    // 统计开发状态
    const status = repo.developmentStatus;
    if (status) {
      analysis.developmentStatus[status] = (analysis.developmentStatus[status] || 0) + 1;
    }
  });
  
  // 计算平均值
  analysis.averageStars = repositories.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0) / repositories.length;
  analysis.averageQuality = repositories.reduce((sum, repo) => sum + (repo.qualityScore || 0), 0) / repositories.length;
  
  return analysis;
}

/**
 * 生成仓库搜索摘要
 */
function generateRepositorySearchSummary(repositories: any[], query: string): string {
  if (repositories.length === 0) return `No repositories found for "${query}"`;
  
  const topRepo = repositories[0];
  const totalStars = repositories.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  const mainLanguage = topRepo.language || 'Unknown';
  
  return `Found ${repositories.length} repositories for "${query}". Top result: "${topRepo.full_name}" (${topRepo.stargazers_count} stars, ${mainLanguage}). Total stars: ${totalStars}.`;
}

/**
 * 工具注册信息
 */
export const githubSearchTool = {
  name: 'github_search',
  description: 'Search GitHub repositories with intelligent routing and advanced development analysis',
  category: 'development-search',
  source: 'api.github.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query for GitHub repositories. Examples: "react framework", "machine learning python", "web scraping", "owner/repo"'
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
  execute: githubSearch,
  examples: [
    {
      query: "react framework",
      description: "Search for React framework repositories"
    },
    {
      query: "machine learning python",
      description: "Find Python machine learning projects"
    },
    {
      query: "web scraping",
      description: "Search for web scraping tools"
    },
    {
      query: "facebook/react",
      description: "Get details for specific repository"
    },
    {
      query: "javascript popular",
      description: "Find popular JavaScript projects"
    },
    {
      query: "cli tool golang",
      description: "Search for Go CLI tools"
    }
  ]
};
