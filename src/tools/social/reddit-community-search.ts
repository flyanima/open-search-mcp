import { RedditSearchClient } from '../../api/clients/reddit-search-client.js';
import { RedditSearchRouter } from '../../utils/reddit-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Reddit 社区搜索工具
 * 专门用于搜索Reddit社区(subreddit)、用户和社区发现
 */

const logger = new Logger('RedditCommunitySearch');

export async function redditCommunitySearch(args: ToolInput): Promise<ToolOutput> {
  if (!args.query) {
    return {
      success: false,
      error: 'Query parameter is required'
    };
  }

  try {
    const client = new RedditSearchClient();
    const router = new RedditSearchRouter();
    
    // 验证查询
    const validation = router.validateQuery(args.query);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.message || 'Invalid query'
      };
    }
    
    logger.info(`Processing Reddit community search: ${args.query}`);

    const limit = args.limit || 10;
    const result = await handleCommunitySearchRequest(client, router, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'reddit_community_search',
        result,
        source: 'Reddit',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Reddit community search failed:', error);
    return {
      success: false,
      error: `Reddit community search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理社区搜索请求
 */
async function handleCommunitySearchRequest(client: RedditSearchClient, router: RedditSearchRouter, query: string, limit: number): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let searchResult;
    let searchType = 'subreddits';
    
    if (route.searchType === 'users') {
      searchResult = await client.searchUsers(route.query, { limit });
      searchType = 'users';
    } else {
      // 默认搜索subreddit
      searchResult = await client.searchSubreddits(query, { limit });
      searchType = 'subreddits';
    }
    
    if (!searchResult.data || !searchResult.data.children || searchResult.data.children.length === 0) {
      return {
        type: 'reddit_community_search',
        searchType,
        query,
        communities: [],
        totalResults: 0,
        route,
        message: `No Reddit ${searchType} found for "${query}"`,
        suggestions: generateCommunitySearchSuggestions(query, searchType)
      };
    }

    // 增强社区/用户信息
    const enhancedResults = await Promise.all(
      searchResult.data.children.map(async (item: any) => {
        const data = item.data;
        
        if (searchType === 'users') {
          return await enhanceUserData(data, client);
        } else {
          return await enhanceSubredditData(data, client);
        }
      })
    );

    // 按相关性和质量排序
    enhancedResults.sort((a: any, b: any) => {
      const scoreA = a.relevanceScore + a.qualityScore + a.activityScore;
      const scoreB = b.relevanceScore + b.qualityScore + b.activityScore;
      return scoreB - scoreA;
    });

    // 分析搜索结果
    const resultAnalysis = analyzeCommunityResults(enhancedResults, searchType);

    return {
      type: 'reddit_community_search',
      searchType,
      query,
      communities: enhancedResults,
      totalResults: searchResult.data.dist || enhancedResults.length,
      route,
      analysis: resultAnalysis,
      summary: generateCommunitySearchSummary(enhancedResults, query, searchType, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 增强Subreddit数据
 */
async function enhanceSubredditData(subreddit: any, client: RedditSearchClient): Promise<any> {
  const enhanced = {
    ...subreddit,
    
    // 计算相关性分数
    relevanceScore: calculateSubredditRelevanceScore(subreddit),
    
    // 社区质量评估
    qualityScore: assessSubredditQuality(subreddit),
    
    // 活跃度分析
    activityScore: analyzeSubredditActivity(subreddit),
    
    // 社区分类
    category: categorizeSubreddit(subreddit),
    
    // 成长趋势
    growthTrend: analyzeGrowthTrend(subreddit),
    
    // 社区特征
    communityFeatures: analyzeCommunityFeatures(subreddit),
    
    // 格式化显示信息
    displayInfo: formatSubredditDisplayInfo(subreddit)
  };
  
  return enhanced;
}

/**
 * 增强用户数据
 */
async function enhanceUserData(user: any, client: RedditSearchClient): Promise<any> {
  const enhanced = {
    ...user,
    
    // 计算相关性分数
    relevanceScore: calculateUserRelevanceScore(user),
    
    // 用户质量评估
    qualityScore: assessUserQuality(user),
    
    // 活跃度分析
    activityScore: analyzeUserActivity(user),
    
    // 用户类型分析
    userType: analyzeUserType(user),
    
    // 影响力评估
    influenceLevel: assessInfluenceLevel(user),
    
    // 专业领域
    expertise: identifyExpertise(user),
    
    // 格式化显示信息
    displayInfo: formatUserDisplayInfo(user)
  };
  
  return enhanced;
}

/**
 * 计算Subreddit相关性分数
 */
function calculateSubredditRelevanceScore(subreddit: any): number {
  let score = 0;
  
  // 基于订阅者数量
  const subscribers = subreddit.subscribers || 0;
  if (subscribers > 1000000) score += 20;
  else if (subscribers > 100000) score += 15;
  else if (subscribers > 10000) score += 10;
  else if (subscribers > 1000) score += 5;
  
  // 基于活跃用户
  const activeUsers = subreddit.active_user_count || 0;
  if (activeUsers > 1000) score += 10;
  else if (activeUsers > 100) score += 5;
  
  // 基于描述质量
  if (subreddit.public_description && subreddit.public_description.length > 50) {
    score += 5;
  }
  
  return Math.min(score, 40);
}

/**
 * 评估Subreddit质量
 */
function assessSubredditQuality(subreddit: any): number {
  let score = 0;
  
  // 有详细描述
  if (subreddit.description && subreddit.description.length > 100) score += 10;
  
  // 有社区图标
  if (subreddit.icon_img || subreddit.community_icon) score += 5;
  
  // 有横幅
  if (subreddit.banner_img) score += 5;
  
  // 订阅者与活跃用户比率
  const subscribers = subreddit.subscribers || 0;
  const activeUsers = subreddit.active_user_count || 0;
  if (subscribers > 0 && activeUsers > 0) {
    const ratio = activeUsers / subscribers;
    if (ratio > 0.01) score += 10; // 高活跃度
    else if (ratio > 0.005) score += 5;
  }
  
  // 非NSFW内容
  if (!subreddit.over18) score += 5;
  
  return Math.min(score, 35);
}

/**
 * 分析Subreddit活跃度
 */
function analyzeSubredditActivity(subreddit: any): number {
  let score = 0;
  
  const activeUsers = subreddit.active_user_count || 0;
  const subscribers = subreddit.subscribers || 0;
  
  // 活跃用户数量
  if (activeUsers > 500) score += 15;
  else if (activeUsers > 100) score += 10;
  else if (activeUsers > 20) score += 5;
  
  // 活跃度比率
  if (subscribers > 0) {
    const activityRatio = activeUsers / subscribers;
    if (activityRatio > 0.02) score += 10;
    else if (activityRatio > 0.01) score += 5;
  }
  
  return Math.min(score, 25);
}

/**
 * 分类Subreddit
 */
function categorizeSubreddit(subreddit: any): string {
  const name = subreddit.display_name.toLowerCase();
  const description = (subreddit.public_description || '').toLowerCase();
  
  const categories = {
    'Technology': ['programming', 'tech', 'software', 'computer', 'ai', 'ml'],
    'Science': ['science', 'physics', 'chemistry', 'biology', 'research'],
    'Entertainment': ['movies', 'tv', 'music', 'gaming', 'games', 'entertainment'],
    'News': ['news', 'politics', 'world', 'current'],
    'Education': ['learn', 'education', 'study', 'academic', 'university'],
    'Lifestyle': ['life', 'tips', 'advice', 'health', 'fitness'],
    'Creative': ['art', 'design', 'photography', 'writing', 'creative'],
    'Business': ['business', 'entrepreneur', 'finance', 'investing', 'career']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword) || description.includes(keyword))) {
      return category;
    }
  }
  
  return 'General';
}

/**
 * 分析成长趋势
 */
function analyzeGrowthTrend(subreddit: any): string {
  const subscribers = subreddit.subscribers || 0;
  const activeUsers = subreddit.active_user_count || 0;
  
  if (subscribers < 1000) return 'New Community';
  if (activeUsers > subscribers * 0.02) return 'Rapidly Growing';
  if (activeUsers > subscribers * 0.01) return 'Growing';
  if (activeUsers > subscribers * 0.005) return 'Stable';
  return 'Declining';
}

/**
 * 分析社区特征
 */
function analyzeCommunityFeatures(subreddit: any): string[] {
  const features: string[] = [];
  
  if (subreddit.subscribers > 1000000) features.push('Large Community');
  if (subreddit.active_user_count > 1000) features.push('Very Active');
  if (subreddit.over18) features.push('NSFW Content');
  if (subreddit.lang !== 'en') features.push(`Language: ${subreddit.lang}`);
  if (subreddit.public_description) features.push('Well Documented');
  
  return features;
}

/**
 * 计算用户相关性分数
 */
function calculateUserRelevanceScore(user: any): number {
  let score = 0;
  
  // 基于总karma
  const totalKarma = user.total_karma || (user.comment_karma || 0) + (user.link_karma || 0);
  if (totalKarma > 100000) score += 20;
  else if (totalKarma > 10000) score += 15;
  else if (totalKarma > 1000) score += 10;
  else if (totalKarma > 100) score += 5;
  
  // 特殊状态
  if (user.is_gold) score += 10;
  if (user.is_mod) score += 15;
  if (user.verified) score += 10;
  
  return Math.min(score, 40);
}

/**
 * 评估用户质量
 */
function assessUserQuality(user: any): number {
  let score = 0;
  
  const commentKarma = user.comment_karma || 0;
  const linkKarma = user.link_karma || 0;
  
  // 评论karma（表明参与度）
  if (commentKarma > linkKarma) score += 10;
  
  // 账户年龄
  const accountAge = (Date.now() / 1000 - user.created_utc) / (365 * 24 * 3600);
  if (accountAge > 5) score += 10;
  else if (accountAge > 2) score += 5;
  
  // 验证状态
  if (user.has_verified_email) score += 5;
  if (user.verified) score += 10;
  
  return Math.min(score, 35);
}

/**
 * 分析用户活跃度
 */
function analyzeUserActivity(user: any): number {
  let score = 0;
  
  const totalKarma = user.total_karma || (user.comment_karma || 0) + (user.link_karma || 0);
  const accountAge = (Date.now() / 1000 - user.created_utc) / (365 * 24 * 3600);
  
  // Karma per year
  if (accountAge > 0) {
    const karmaPerYear = totalKarma / accountAge;
    if (karmaPerYear > 10000) score += 15;
    else if (karmaPerYear > 1000) score += 10;
    else if (karmaPerYear > 100) score += 5;
  }
  
  return Math.min(score, 25);
}

/**
 * 分析用户类型
 */
function analyzeUserType(user: any): string {
  if (user.is_mod) return 'Moderator';
  if (user.verified) return 'Verified User';
  if (user.is_gold) return 'Premium User';
  
  const totalKarma = user.total_karma || (user.comment_karma || 0) + (user.link_karma || 0);
  if (totalKarma > 100000) return 'Power User';
  if (totalKarma > 10000) return 'Active User';
  if (totalKarma > 1000) return 'Regular User';
  
  return 'New User';
}

/**
 * 评估影响力级别
 */
function assessInfluenceLevel(user: any): string {
  const totalKarma = user.total_karma || (user.comment_karma || 0) + (user.link_karma || 0);
  
  if (user.is_mod && totalKarma > 50000) return 'High Influence';
  if (totalKarma > 100000) return 'High Influence';
  if (totalKarma > 10000) return 'Medium Influence';
  if (totalKarma > 1000) return 'Low Influence';
  
  return 'Minimal Influence';
}

/**
 * 识别专业领域
 */
function identifyExpertise(user: any): string[] {
  const expertise: string[] = [];
  
  // 基于用户的subreddit（如果有）
  if (user.subreddit) {
    const subredditName = user.subreddit.display_name.toLowerCase();
    if (subredditName.includes('programming')) expertise.push('Programming');
    if (subredditName.includes('science')) expertise.push('Science');
    if (subredditName.includes('art')) expertise.push('Art');
  }
  
  // 基于karma分布
  const commentKarma = user.comment_karma || 0;
  const linkKarma = user.link_karma || 0;
  
  if (commentKarma > linkKarma * 3) expertise.push('Discussion Leader');
  if (linkKarma > commentKarma * 3) expertise.push('Content Creator');
  
  return expertise.length > 0 ? expertise : ['General'];
}

/**
 * 格式化Subreddit显示信息
 */
function formatSubredditDisplayInfo(subreddit: any): any {
  return {
    name: `r/${subreddit.display_name}`,
    title: subreddit.title,
    description: subreddit.public_description,
    subscribers: `${(subreddit.subscribers || 0).toLocaleString()} members`,
    activeUsers: `${(subreddit.active_user_count || 0).toLocaleString()} online`,
    url: `https://reddit.com/r/${subreddit.display_name}`,
    created: new Date(subreddit.created_utc * 1000).getFullYear(),
    isNSFW: subreddit.over18 || false
  };
}

/**
 * 格式化用户显示信息
 */
function formatUserDisplayInfo(user: any): any {
  const totalKarma = user.total_karma || (user.comment_karma || 0) + (user.link_karma || 0);
  
  return {
    username: `u/${user.name}`,
    totalKarma: `${totalKarma.toLocaleString()} karma`,
    commentKarma: `${(user.comment_karma || 0).toLocaleString()} comment karma`,
    linkKarma: `${(user.link_karma || 0).toLocaleString()} post karma`,
    accountAge: `${Math.round((Date.now() / 1000 - user.created_utc) / (365 * 24 * 3600))} years`,
    url: `https://reddit.com/u/${user.name}`,
    isVerified: user.verified || false,
    isPremium: user.is_gold || false,
    isModerator: user.is_mod || false
  };
}

/**
 * 分析社区搜索结果
 */
function analyzeCommunityResults(results: any[], searchType: string): any {
  if (results.length === 0) return {};
  
  const analysis = {
    totalResults: results.length,
    searchType,
    averageQuality: 0,
    averageActivity: 0,
    categories: {} as Record<string, number>,
    topResults: results.slice(0, 3)
  };
  
  if (searchType === 'subreddits') {
    // 分析subreddit
    results.forEach(result => {
      const category = result.category;
      analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    });
    
    analysis.averageQuality = results.reduce((sum, result) => sum + result.qualityScore, 0) / results.length;
    analysis.averageActivity = results.reduce((sum, result) => sum + result.activityScore, 0) / results.length;
  } else {
    // 分析用户
    results.forEach(result => {
      const userType = result.userType;
      analysis.categories[userType] = (analysis.categories[userType] || 0) + 1;
    });
    
    analysis.averageQuality = results.reduce((sum, result) => sum + result.qualityScore, 0) / results.length;
    analysis.averageActivity = results.reduce((sum, result) => sum + result.activityScore, 0) / results.length;
  }
  
  return analysis;
}

/**
 * 生成社区搜索建议
 */
function generateCommunitySearchSuggestions(query: string, searchType: string): string[] {
  const suggestions: string[] = [];
  
  if (searchType === 'subreddits') {
    suggestions.push(
      'Try searching for topic keywords',
      'Look for communities with active discussions',
      'Check community rules and guidelines',
      'Consider subscriber count and activity level'
    );
  } else {
    suggestions.push(
      'Search for usernames or user types',
      'Look for verified or moderator users',
      'Check user karma and account age',
      'Consider user activity and expertise'
    );
  }
  
  return suggestions;
}

/**
 * 生成社区搜索摘要
 */
function generateCommunitySearchSummary(results: any[], query: string, searchType: string, analysis: any): string {
  if (results.length === 0) return `No Reddit ${searchType} found for "${query}"`;
  
  const topResult = results[0];
  const avgQuality = Math.round(analysis.averageQuality);
  
  if (searchType === 'subreddits') {
    return `Found ${results.length} subreddits for "${query}". Top result: r/${topResult.display_name} (${topResult.subscribers} members). Average quality: ${avgQuality}/35.`;
  } else {
    const totalKarma = topResult.total_karma || (topResult.comment_karma || 0) + (topResult.link_karma || 0);
    return `Found ${results.length} users for "${query}". Top result: u/${topResult.name} (${totalKarma} karma). Average quality: ${avgQuality}/35.`;
  }
}

/**
 * 工具注册信息
 */
export const redditCommunitySearchTool = {
  name: 'reddit_community_search',
  description: 'Search Reddit communities (subreddits) and users with quality assessment and activity analysis',
  category: 'social-search',
  source: 'reddit.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Reddit communities or users. Examples: "programming communities", "user:spez", "machine learning subreddits", "find science communities"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 25)',
        default: 10,
        minimum: 1,
        maximum: 25
      }
    },
    required: ['query']
  },
  execute: redditCommunitySearch,
  examples: [
    {
      query: "programming communities",
      description: "Find programming-related subreddits"
    },
    {
      query: "user:spez",
      description: "Search for specific Reddit user"
    },
    {
      query: "machine learning subreddits",
      description: "Find ML communities on Reddit"
    },
    {
      query: "find science communities",
      description: "Discover science-related subreddits"
    },
    {
      query: "active gaming communities",
      description: "Find active gaming subreddits"
    }
  ]
};
