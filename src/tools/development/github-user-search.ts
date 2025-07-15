import { GitHubSearchClient } from '../../api/clients/github-search-client.js';
import { GitHubSearchRouter } from '../../utils/github-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * GitHub 用户搜索工具
 * 专门用于搜索GitHub用户和开发者，分析开发者档案和贡献模式
 */

const logger = new Logger('GitHubUserSearch');

export async function githubUserSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing GitHub user search: ${args.query}`);

    // 提取用户名
    const username = extractUsername(args.query);
    
    if (!username) {
      return {
        success: false,
        error: 'No username found in query. Please provide a username like "user:octocat" or "developer torvalds"'
      };
    }
    
    const limit = args.limit || 10;
    const result = await handleUserSearchRequest(client, username, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'user_search',
        result,
        source: 'GitHub',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('GitHub user search failed:', error);
    return {
      success: false,
      error: `GitHub user search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理用户搜索请求
 */
async function handleUserSearchRequest(client: GitHubSearchClient, username: string, originalQuery: string, limit: number): Promise<any> {
  try {
    // 检查是否为精确用户查询
    const isExactUser = originalQuery.includes('user:') || !originalQuery.includes(' ');
    
    if (isExactUser && !originalQuery.includes(' ')) {
      // 获取特定用户详情
      return await handleSpecificUserDetails(client, username, originalQuery);
    } else {
      // 搜索用户
      return await handleUserSearch(client, username, originalQuery, limit);
    }
    
  } catch (error) {
    throw error;
  }
}

/**
 * 处理特定用户详情
 */
async function handleSpecificUserDetails(client: GitHubSearchClient, username: string, originalQuery: string): Promise<any> {
  try {
    const user = await client.getUser(username);
    
    // 增强用户信息
    const enhancedUser = await enhanceUserDetails(user, client);
    
    return {
      type: 'user_details',
      query: originalQuery,
      user: enhancedUser,
      summary: generateUserSummary(enhancedUser)
    };
    
  } catch (error) {
    return {
      type: 'user_details',
      query: originalQuery,
      user: null,
      error: `User not found: ${username}`,
      suggestions: generateUserSuggestions(username)
    };
  }
}

/**
 * 处理用户搜索
 */
async function handleUserSearch(client: GitHubSearchClient, username: string, originalQuery: string, limit: number): Promise<any> {
  try {
    const searchOptions = {
      per_page: Math.min(limit, 30),
      type: originalQuery.includes('organization') ? 'org' as const : 'user' as const
    };
    
    const searchData = await client.searchUsers(username, searchOptions);
    
    if (!searchData.items || searchData.items.length === 0) {
      return {
        type: 'user_search',
        query: originalQuery,
        username,
        users: [],
        totalResults: 0,
        message: `No GitHub users found for "${username}"`,
        suggestions: generateUserSuggestions(username)
      };
    }

    // 增强用户信息
    const enhancedUsers = await Promise.all(
      searchData.items.slice(0, 5).map(async (user: any) => {
        try {
          return await enhanceUserDetails(user, client);
        } catch (error) {
          return {
            ...user,
            detailsError: 'Could not fetch detailed information'
          };
        }
      })
    );

    // 分析用户群体
    const userAnalysis = analyzeUserGroup(enhancedUsers);

    return {
      type: 'user_search',
      query: originalQuery,
      username,
      users: enhancedUsers,
      totalResults: searchData.total_count,
      analysis: userAnalysis,
      summary: generateUserSearchSummary(enhancedUsers, username, userAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 增强用户详情信息
 */
async function enhanceUserDetails(user: any, client: GitHubSearchClient): Promise<any> {
  const enhanced = {
    ...user,
    
    // 基础分析
    accountAge: calculateAccountAge(user.created_at),
    lastActivity: calculateLastActivity(user.updated_at),
    
    // 开发者指标
    repoToFollowerRatio: calculateRepoToFollowerRatio(user),
    followingToFollowerRatio: calculateFollowingToFollowerRatio(user),
    influenceScore: calculateInfluenceScore(user),
    activityLevel: assessActivityLevel(user),
    
    // 开发者类型分析
    developerType: identifyDeveloperType(user),
    contributionPattern: assessContributionPattern(user),
    
    // 社交指标
    socialMetrics: calculateSocialMetrics(user),
    
    // 档案质量
    profileCompleteness: assessProfileCompleteness(user)
  };
  
  // 尝试获取热门仓库（如果时间允许）
  try {
    const topRepos = await getTopRepositories(client, user.login);
    enhanced.topRepositories = topRepos;
  } catch (error) {
    logger.warn('Failed to get top repositories:', error);
    enhanced.topRepositories = [];
  }
  
  return enhanced;
}

/**
 * 获取用户热门仓库
 */
async function getTopRepositories(client: GitHubSearchClient, username: string): Promise<any[]> {
  try {
    const result = await client.searchRepositories(`user:${username}`, { 
      sort: 'stars', 
      per_page: 3 
    });
    
    return result.items.map((repo: any) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count
    }));
  } catch (error) {
    return [];
  }
}

/**
 * 提取用户名
 */
function extractUsername(query: string): string | null {
  const userPatterns = [
    /user:\s*([^\s]+)/i,
    /developer\s+([^\s]+)/i,
    /programmer\s+([^\s]+)/i,
    /github\s+user\s+([^\s]+)/i,
    /profile\s+([^\s]+)/i
  ];
  
  for (const pattern of userPatterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1].trim().replace(/['"]/g, '');
    }
  }
  
  // 如果没有找到模式，检查是否整个查询就是用户名
  const cleanQuery = query.trim().replace(/['"]/g, '');
  if (cleanQuery.length > 0 && !cleanQuery.includes(' ') && cleanQuery.length < 40) {
    return cleanQuery;
  }
  
  return null;
}

/**
 * 计算账户年龄
 */
function calculateAccountAge(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - created.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365)); // 年
}

/**
 * 计算最后活动时间
 */
function calculateLastActivity(updatedAt: string): number {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - updated.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 天
}

/**
 * 计算仓库与关注者比率
 */
function calculateRepoToFollowerRatio(user: any): number {
  const repos = user.public_repos || 0;
  const followers = user.followers || 1; // 避免除零
  return Math.round((repos / followers) * 100) / 100;
}

/**
 * 计算关注与被关注比率
 */
function calculateFollowingToFollowerRatio(user: any): number {
  const following = user.following || 0;
  const followers = user.followers || 1; // 避免除零
  return Math.round((following / followers) * 100) / 100;
}

/**
 * 计算影响力分数
 */
function calculateInfluenceScore(user: any): number {
  const repos = user.public_repos || 0;
  const followers = user.followers || 0;
  const following = user.following || 0;
  const gists = user.public_gists || 0;
  
  // 加权计算影响力
  let score = 0;
  score += followers * 0.4; // 关注者权重最高
  score += repos * 0.3; // 仓库数量
  score += gists * 0.1; // 代码片段
  score += Math.min(following / Math.max(followers, 1), 2) * 0.2; // 社交比率
  
  return Math.round(score);
}

/**
 * 评估活跃度
 */
function assessActivityLevel(user: any): 'high' | 'medium' | 'low' {
  const repos = user.public_repos || 0;
  const followers = user.followers || 0;
  const lastActivity = calculateLastActivity(user.updated_at);
  
  let activityScore = 0;
  
  // 基于仓库数量
  if (repos > 50) activityScore += 3;
  else if (repos > 10) activityScore += 2;
  else if (repos > 0) activityScore += 1;
  
  // 基于关注者
  if (followers > 1000) activityScore += 3;
  else if (followers > 100) activityScore += 2;
  else if (followers > 10) activityScore += 1;
  
  // 基于最近活动
  if (lastActivity <= 7) activityScore += 3;
  else if (lastActivity <= 30) activityScore += 2;
  else if (lastActivity <= 90) activityScore += 1;
  
  if (activityScore >= 7) return 'high';
  if (activityScore >= 4) return 'medium';
  return 'low';
}

/**
 * 识别开发者类型
 */
function identifyDeveloperType(user: any): string {
  const repos = user.public_repos || 0;
  const followers = user.followers || 0;
  const following = user.following || 0;
  const gists = user.public_gists || 0;
  
  if (user.type === 'Organization') return 'Organization';
  
  if (followers > 10000) return 'Influential Developer';
  if (repos > 100 && followers > 1000) return 'Prolific Open Source Developer';
  if (repos > 50) return 'Active Developer';
  if (gists > 20) return 'Code Sharing Enthusiast';
  if (following > followers * 2) return 'Learning-Oriented Developer';
  if (repos < 5 && followers < 10) return 'New Developer';
  
  return 'Regular Developer';
}

/**
 * 评估贡献模式
 */
function assessContributionPattern(user: any): string {
  const repos = user.public_repos || 0;
  const gists = user.public_gists || 0;
  const followers = user.followers || 0;
  
  if (repos > 100) return 'Heavy Contributor';
  if (gists > 50) return 'Code Snippet Sharer';
  if (followers > repos * 2) return 'Community Influencer';
  if (repos > 20) return 'Regular Contributor';
  if (repos > 5) return 'Occasional Contributor';
  
  return 'Minimal Contributor';
}

/**
 * 计算社交指标
 */
function calculateSocialMetrics(user: any): any {
  const followers = user.followers || 0;
  const following = user.following || 0;
  const repos = user.public_repos || 0;
  
  return {
    networkSize: followers + following,
    influence: followers > following ? 'Influencer' : 'Networker',
    engagement: repos > 0 ? Math.round((followers / repos) * 10) / 10 : 0,
    socialRatio: following > 0 ? Math.round((followers / following) * 100) / 100 : followers
  };
}

/**
 * 评估档案完整性
 */
function assessProfileCompleteness(user: any): any {
  let completeness = 0;
  const factors: string[] = [];
  
  if (user.name) { completeness += 20; factors.push('Name provided'); }
  if (user.bio) { completeness += 20; factors.push('Bio provided'); }
  if (user.company) { completeness += 15; factors.push('Company listed'); }
  if (user.location) { completeness += 15; factors.push('Location provided'); }
  if (user.email) { completeness += 10; factors.push('Email provided'); }
  if (user.public_repos > 0) { completeness += 20; factors.push('Has repositories'); }
  
  return {
    score: completeness,
    level: completeness >= 80 ? 'Complete' : completeness >= 50 ? 'Good' : 'Basic',
    factors
  };
}

/**
 * 分析用户群体
 */
function analyzeUserGroup(users: any[]): any {
  if (users.length === 0) return {};
  
  const analysis = {
    totalUsers: users.length,
    developerTypes: {} as Record<string, number>,
    activityLevels: {} as Record<string, number>,
    averageInfluence: 0,
    averageRepos: 0,
    averageFollowers: 0,
    topInfluencers: users.slice(0, 3)
  };
  
  // 统计开发者类型
  users.forEach(user => {
    const type = user.developerType;
    if (type) {
      analysis.developerTypes[type] = (analysis.developerTypes[type] || 0) + 1;
    }
    
    const activity = user.activityLevel;
    if (activity) {
      analysis.activityLevels[activity] = (analysis.activityLevels[activity] || 0) + 1;
    }
  });
  
  // 计算平均值
  analysis.averageInfluence = users.reduce((sum, user) => sum + (user.influenceScore || 0), 0) / users.length;
  analysis.averageRepos = users.reduce((sum, user) => sum + (user.public_repos || 0), 0) / users.length;
  analysis.averageFollowers = users.reduce((sum, user) => sum + (user.followers || 0), 0) / users.length;
  
  return analysis;
}

/**
 * 生成用户建议
 */
function generateUserSuggestions(username: string): string[] {
  return [
    `Try searching for: "${username.toLowerCase()}"`,
    `Try searching for: "${username.substring(0, 3)}"`,
    'Check spelling and try variations',
    'Try searching by programming language or location',
    'Browse trending developers in specific technologies'
  ];
}

/**
 * 生成用户摘要
 */
function generateUserSummary(user: any): string {
  const type = user.developerType || 'Developer';
  const repos = user.public_repos || 0;
  const followers = user.followers || 0;
  const activity = user.activityLevel || 'unknown';
  const age = user.accountAge || 0;
  
  return `Found ${type} "${user.login}" with ${repos} repositories and ${followers} followers. Activity level: ${activity}. Account age: ${age} years.`;
}

/**
 * 生成用户搜索摘要
 */
function generateUserSearchSummary(users: any[], username: string, analysis: any): string {
  const topUser = users[0];
  const avgInfluence = Math.round(analysis.averageInfluence || 0);
  const topType = Object.keys(analysis.developerTypes)[0] || 'developers';
  
  return `Found ${users.length} users matching "${username}". Top result: "${topUser.login}" (${topUser.followers} followers). Average influence: ${avgInfluence}. Mainly: ${topType}.`;
}

/**
 * 工具注册信息
 */
export const githubUserSearchTool = {
  name: 'github_user_search',
  description: 'Search GitHub users and developers with comprehensive profile analysis and contribution pattern recognition',
  category: 'development-search',
  source: 'api.github.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'User search query. Examples: "user:octocat", "developer torvalds", "programmer location:china", "octocat"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of users to return (default: 10, max: 30)',
        default: 10,
        minimum: 1,
        maximum: 30
      }
    },
    required: ['query']
  },
  execute: githubUserSearch,
  examples: [
    {
      query: "user:octocat",
      description: "Get details for specific GitHub user"
    },
    {
      query: "developer torvalds",
      description: "Search for developer Linus Torvalds"
    },
    {
      query: "programmer location:china",
      description: "Find programmers in China"
    },
    {
      query: "gaearon",
      description: "Search for user gaearon (Dan Abramov)"
    },
    {
      query: "organization facebook",
      description: "Search for Facebook organization"
    }
  ]
};
