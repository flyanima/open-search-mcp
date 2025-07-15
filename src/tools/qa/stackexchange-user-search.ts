import { StackExchangeClient } from '../../api/clients/stackexchange-client.js';
import { StackExchangeRouter } from '../../utils/stackexchange-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Stack Exchange 用户搜索工具
 * 专门用于搜索Stack Exchange平台的专家用户和贡献者
 */

const logger = new Logger('StackExchangeUserSearch');

export async function stackexchangeUserSearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new StackExchangeClient();
    const router = new StackExchangeRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing Stack Exchange user search: ${args.query}`);

    const limit = args.limit || 10;
    const site = args.site || 'stackoverflow';
    const result = await handleUserSearchRequest(client, args.query, limit, site);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'stackexchange_user_search',
        result,
        source: 'Stack Exchange',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Stack Exchange user search failed:', error);
    return {
      success: false,
      error: `Stack Exchange user search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理用户搜索请求
 */
async function handleUserSearchRequest(client: StackExchangeClient, query: string, limit: number, site: string): Promise<any> {
  try {
    const searchResult = await client.searchUsers(query, site);
    
    if (!searchResult.items || searchResult.items.length === 0) {
      return {
        type: 'stackexchange_user_search',
        query,
        users: [],
        totalResults: 0,
        message: `No users found for "${query}" on ${site}`,
        suggestions: generateUserSearchSuggestions(query)
      };
    }

    // 增强用户结果
    const enhancedUsers = searchResult.items.slice(0, limit).map((item: any) => {
      return {
        ...item,
        
        // 用户影响力评估
        influenceScore: calculateUserInfluence(item),
        
        // 专业领域分析
        expertiseLevel: assessExpertiseLevel(item),
        
        // 活跃度分析
        activityLevel: analyzeActivityLevel(item),
        
        // 贡献质量评估
        contributionQuality: assessContributionQuality(item),
        
        // 用户类型分析
        userType: analyzeUserType(item),
        
        // 格式化显示信息
        displayInfo: formatUserDisplayInfo(item)
      };
    });

    // 按影响力和声誉排序
    enhancedUsers.sort((a: any, b: any) => {
      const scoreA = a.influenceScore + (a.reputation / 1000);
      const scoreB = b.influenceScore + (b.reputation / 1000);
      return scoreB - scoreA;
    });

    // 分析用户搜索结果
    const resultAnalysis = analyzeUserResults(enhancedUsers, searchResult);

    return {
      type: 'stackexchange_user_search',
      query,
      users: enhancedUsers,
      totalResults: searchResult.items.length,
      hasMore: searchResult.has_more,
      quotaRemaining: searchResult.quota_remaining,
      site,
      analysis: resultAnalysis,
      summary: generateUserSearchSummary(enhancedUsers, query, site, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 计算用户影响力分数
 */
function calculateUserInfluence(user: any): number {
  let score = 0;
  
  // 声誉分数（对数缩放）
  if (user.reputation > 0) {
    score += Math.min(Math.log10(user.reputation) * 10, 50);
  }
  
  // 徽章分数
  if (user.badge_counts) {
    score += user.badge_counts.gold * 5;
    score += user.badge_counts.silver * 2;
    score += user.badge_counts.bronze * 0.5;
  }
  
  // 问题和答案数量
  score += Math.min(user.question_count * 0.5, 10);
  score += Math.min(user.answer_count * 1, 20);
  
  // 投票活动
  score += Math.min((user.up_vote_count || 0) * 0.1, 10);
  
  // 浏览量
  if (user.view_count > 1000) score += 5;
  if (user.view_count > 10000) score += 10;
  
  return Math.min(score, 100);
}

/**
 * 评估专业水平
 */
function assessExpertiseLevel(user: any): string {
  const reputation = user.reputation || 0;
  const answerCount = user.answer_count || 0;
  const questionCount = user.question_count || 0;
  
  // 基于声誉和贡献评估
  if (reputation > 100000 && answerCount > 1000) return 'Expert';
  if (reputation > 50000 && answerCount > 500) return 'Advanced';
  if (reputation > 10000 && answerCount > 100) return 'Experienced';
  if (reputation > 1000 && (answerCount > 10 || questionCount > 20)) return 'Intermediate';
  if (reputation > 100) return 'Beginner';
  
  return 'New User';
}

/**
 * 分析活跃度
 */
function analyzeActivityLevel(user: any): any {
  const now = Date.now() / 1000;
  const daysSinceLastAccess = user.last_access_date ? 
    (now - user.last_access_date) / (24 * 60 * 60) : Infinity;
  
  let activityLevel = 'Unknown';
  let activityScore = 0;
  
  if (daysSinceLastAccess < 1) {
    activityLevel = 'Very Active';
    activityScore = 20;
  } else if (daysSinceLastAccess < 7) {
    activityLevel = 'Active';
    activityScore = 15;
  } else if (daysSinceLastAccess < 30) {
    activityLevel = 'Moderately Active';
    activityScore = 10;
  } else if (daysSinceLastAccess < 90) {
    activityLevel = 'Occasionally Active';
    activityScore = 5;
  } else {
    activityLevel = 'Inactive';
    activityScore = 0;
  }
  
  return {
    level: activityLevel,
    score: activityScore,
    daysSinceLastAccess: Math.round(daysSinceLastAccess),
    lastAccessDate: user.last_access_date ? new Date(user.last_access_date * 1000).toISOString() : null
  };
}

/**
 * 评估贡献质量
 */
function assessContributionQuality(user: any): any {
  const reputation = user.reputation || 0;
  const answerCount = user.answer_count || 0;
  const questionCount = user.question_count || 0;
  const upVotes = user.up_vote_count || 0;
  const downVotes = user.down_vote_count || 0;
  
  let qualityScore = 0;
  
  // 平均声誉每个贡献
  const totalContributions = answerCount + questionCount;
  if (totalContributions > 0) {
    const avgReputationPerContribution = reputation / totalContributions;
    qualityScore += Math.min(avgReputationPerContribution / 10, 20);
  }
  
  // 投票比率
  const totalVotes = upVotes + downVotes;
  if (totalVotes > 0) {
    const upVoteRatio = upVotes / totalVotes;
    qualityScore += upVoteRatio * 15;
  }
  
  // 答案vs问题比率（更多答案通常表示更有帮助）
  if (totalContributions > 0) {
    const answerRatio = answerCount / totalContributions;
    qualityScore += answerRatio * 10;
  }
  
  let qualityLevel = 'Unknown';
  if (qualityScore >= 30) qualityLevel = 'Excellent';
  else if (qualityScore >= 20) qualityLevel = 'Good';
  else if (qualityScore >= 10) qualityLevel = 'Average';
  else qualityLevel = 'Below Average';
  
  return {
    score: Math.round(qualityScore),
    level: qualityLevel,
    avgReputationPerContribution: totalContributions > 0 ? Math.round(reputation / totalContributions) : 0,
    upVoteRatio: totalVotes > 0 ? Math.round((upVotes / totalVotes) * 100) : 0
  };
}

/**
 * 分析用户类型
 */
function analyzeUserType(user: any): string {
  const reputation = user.reputation || 0;
  const answerCount = user.answer_count || 0;
  const questionCount = user.question_count || 0;
  const badges = user.badge_counts;
  
  // 基于活动模式判断用户类型
  if (reputation > 50000 && badges && badges.gold > 5) return 'Community Leader';
  if (answerCount > questionCount * 3 && answerCount > 100) return 'Helper/Answerer';
  if (questionCount > answerCount * 2 && questionCount > 50) return 'Active Questioner';
  if (reputation > 10000 && answerCount > 50) return 'Experienced Contributor';
  if (reputation > 1000) return 'Regular User';
  if (reputation > 100) return 'New Contributor';
  
  return 'Newcomer';
}

/**
 * 格式化用户显示信息
 */
function formatUserDisplayInfo(user: any): any {
  return {
    displayName: user.display_name,
    reputation: user.reputation,
    userId: user.user_id,
    profileImage: user.profile_image,
    link: user.link,
    location: user.location,
    websiteUrl: user.website_url,
    aboutMe: user.about_me ? user.about_me.substring(0, 200) + '...' : null,
    viewCount: user.view_count,
    questionCount: user.question_count,
    answerCount: user.answer_count,
    upVoteCount: user.up_vote_count,
    downVoteCount: user.down_vote_count,
    badges: user.badge_counts,
    creationDate: new Date(user.creation_date * 1000).toISOString(),
    lastAccessDate: user.last_access_date ? new Date(user.last_access_date * 1000).toISOString() : null
  };
}

/**
 * 分析用户搜索结果
 */
function analyzeUserResults(users: any[], searchResult: any): any {
  if (users.length === 0) return {};
  
  const analysis = {
    totalUsers: users.length,
    expertiseLevels: {} as Record<string, number>,
    userTypes: {} as Record<string, number>,
    activityLevels: {} as Record<string, number>,
    averageReputation: 0,
    averageInfluence: 0,
    topUsers: users.slice(0, 3),
    hasMore: searchResult.has_more,
    quotaRemaining: searchResult.quota_remaining
  };
  
  // 统计分布
  users.forEach(user => {
    // 专业水平分布
    const expertise = user.expertiseLevel;
    analysis.expertiseLevels[expertise] = (analysis.expertiseLevels[expertise] || 0) + 1;
    
    // 用户类型分布
    const userType = user.userType;
    analysis.userTypes[userType] = (analysis.userTypes[userType] || 0) + 1;
    
    // 活跃度分布
    const activityLevel = user.activityLevel.level;
    analysis.activityLevels[activityLevel] = (analysis.activityLevels[activityLevel] || 0) + 1;
  });
  
  // 计算平均值
  analysis.averageReputation = users.reduce((sum, user) => sum + (user.reputation || 0), 0) / users.length;
  analysis.averageInfluence = users.reduce((sum, user) => sum + user.influenceScore, 0) / users.length;
  
  return analysis;
}

/**
 * 生成用户搜索建议
 */
function generateUserSearchSuggestions(query: string): string[] {
  return [
    'Try searching by exact username or display name',
    'Use partial names for broader results',
    'Check different Stack Exchange sites',
    'Look for users with high reputation in specific tags'
  ];
}

/**
 * 生成用户搜索摘要
 */
function generateUserSearchSummary(users: any[], query: string, site: string, analysis: any): string {
  if (users.length === 0) return `No users found for "${query}" on ${site}`;
  
  const topUser = users[0];
  const avgReputation = Math.round(analysis.averageReputation);
  const expertCount = Object.values(analysis.expertiseLevels).reduce((sum: number, count: any) => {
    return sum + (count || 0);
  }, 0);
  
  return `Found ${analysis.totalUsers} users for "${query}" on ${site}. Top: "${topUser.display_name}" (${topUser.reputation} rep). Average reputation: ${avgReputation}. Expertise levels: ${expertCount} total.`;
}

/**
 * 工具注册信息
 */
export const stackexchangeUserSearchTool = {
  name: 'stackexchange_user_search',
  description: 'Search Stack Exchange users and experts with influence assessment and expertise analysis',
  category: 'qa-search',
  source: 'stackexchange.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for users. Examples: "jon skeet", "expert python", "high reputation javascript", "active contributors"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of users to return (default: 10, max: 30)',
        default: 10,
        minimum: 1,
        maximum: 30
      },
      site: {
        type: 'string',
        description: 'Stack Exchange site to search (default: stackoverflow)',
        default: 'stackoverflow',
        enum: ['stackoverflow', 'superuser', 'serverfault', 'askubuntu', 'mathoverflow.net', 'tex', 'dba', 'webmasters', 'gamedev', 'security']
      }
    },
    required: ['query']
  },
  execute: stackexchangeUserSearch,
  examples: [
    {
      query: "jon skeet",
      description: "Find the famous Stack Overflow contributor"
    },
    {
      query: "python expert",
      description: "Search for Python experts"
    },
    {
      query: "high reputation javascript",
      description: "Find high-reputation JavaScript contributors"
    },
    {
      query: "active contributors",
      description: "Find currently active users"
    },
    {
      query: "machine learning",
      description: "Find users interested in machine learning"
    }
  ]
};
