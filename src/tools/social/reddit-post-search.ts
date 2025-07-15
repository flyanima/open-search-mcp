import { RedditSearchClient } from '../../api/clients/reddit-search-client.js';
import { RedditSearchRouter } from '../../utils/reddit-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Reddit 帖子搜索工具
 * 专门用于搜索Reddit帖子、讨论、问答等社区内容
 */

const logger = new Logger('RedditPostSearch');

export async function redditPostSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing Reddit post search: ${args.query}`);

    const limit = args.limit || 10;
    const result = await handlePostSearchRequest(client, router, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'reddit_post_search',
        result,
        source: 'Reddit',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Reddit post search failed:', error);
    return {
      success: false,
      error: `Reddit post search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理帖子搜索请求
 */
async function handlePostSearchRequest(client: RedditSearchClient, router: RedditSearchRouter, query: string, limit: number): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let searchResult;
    
    switch (route.searchType) {
      case 'hot':
        searchResult = await client.getHotPosts(route.subreddit, limit);
        break;
        
      case 'top':
        searchResult = await client.getTopPosts(route.subreddit, route.timeframe, limit);
        break;
        
      case 'specific_subreddit':
        searchResult = await client.searchPosts(route.query, {
          subreddit: route.subreddit,
          limit,
          sort: route.sortBy || 'relevance'
        });
        break;
        
      default: // 'posts'
        searchResult = await client.searchPosts(query, {
          limit,
          sort: route.sortBy || 'relevance'
        });
        break;
    }
    
    if (!searchResult.data || !searchResult.data.children || searchResult.data.children.length === 0) {
      return {
        type: 'reddit_post_search',
        query,
        posts: [],
        totalResults: 0,
        route,
        message: `No Reddit posts found for "${query}"`,
        suggestions: generateSearchSuggestions(query, route)
      };
    }

    // 增强帖子信息
    const enhancedPosts = searchResult.data.children.map((item: any) => {
      const post = item.data;
      return {
        ...post,
        
        // 计算相关性分数
        relevanceScore: calculateRelevanceScore(post, query),
        
        // 社区参与度分析
        engagementMetrics: analyzeEngagement(post),
        
        // 内容质量评估
        qualityIndicators: assessContentQuality(post),
        
        // 时间分析
        timeAnalysis: analyzePostTime(post),
        
        // 社区上下文
        communityContext: analyzeCommunityContext(post),
        
        // 格式化显示信息
        displayInfo: formatDisplayInfo(post)
      };
    });

    // 按相关性和质量排序
    enhancedPosts.sort((a: any, b: any) => {
      const scoreA = a.relevanceScore + a.qualityIndicators.score + a.engagementMetrics.score;
      const scoreB = b.relevanceScore + b.qualityIndicators.score + b.engagementMetrics.score;
      return scoreB - scoreA;
    });

    // 分析搜索结果
    const resultAnalysis = analyzeSearchResults(enhancedPosts, query);

    return {
      type: 'reddit_post_search',
      query,
      posts: enhancedPosts,
      totalResults: searchResult.data.dist || enhancedPosts.length,
      route,
      analysis: resultAnalysis,
      summary: generateSearchSummary(enhancedPosts, query, route, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 计算帖子相关性分数
 */
function calculateRelevanceScore(post: any, query: string): number {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // 标题匹配
  if (post.title) {
    const titleLower = post.title.toLowerCase();
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 10;
    });
  }
  
  // 内容匹配
  if (post.selftext) {
    const textLower = post.selftext.toLowerCase();
    queryWords.forEach(word => {
      if (textLower.includes(word)) score += 5;
    });
  }
  
  // Subreddit相关性
  if (post.subreddit) {
    const subredditLower = post.subreddit.toLowerCase();
    queryWords.forEach(word => {
      if (subredditLower.includes(word)) score += 8;
    });
  }
  
  // Reddit分数加权
  if (post.score > 0) {
    score += Math.min(Math.log10(post.score + 1) * 2, 10);
  }
  
  return Math.min(score, 50);
}

/**
 * 分析社区参与度
 */
function analyzeEngagement(post: any): any {
  const engagement = {
    score: 0,
    level: 'low' as 'low' | 'medium' | 'high',
    metrics: {} as any
  };
  
  // 评论数量
  const comments = post.num_comments || 0;
  if (comments > 100) engagement.score += 15;
  else if (comments > 20) engagement.score += 10;
  else if (comments > 5) engagement.score += 5;
  
  // 投票比率
  const upvoteRatio = post.upvote_ratio || 0;
  if (upvoteRatio > 0.9) engagement.score += 10;
  else if (upvoteRatio > 0.7) engagement.score += 5;
  
  // 总分数
  const totalScore = post.score || 0;
  if (totalScore > 1000) engagement.score += 15;
  else if (totalScore > 100) engagement.score += 10;
  else if (totalScore > 10) engagement.score += 5;
  
  // 奖励
  if (post.gilded > 0) engagement.score += 5;
  if (post.awards_received > 0) engagement.score += 3;
  
  // 确定参与度级别
  if (engagement.score >= 25) engagement.level = 'high';
  else if (engagement.score >= 15) engagement.level = 'medium';
  
  engagement.metrics = {
    comments,
    upvoteRatio,
    totalScore,
    awards: post.awards_received || 0,
    gilded: post.gilded || 0
  };
  
  return engagement;
}

/**
 * 评估内容质量
 */
function assessContentQuality(post: any): any {
  const quality = {
    score: 0,
    indicators: [] as string[],
    level: 'basic' as 'basic' | 'good' | 'excellent'
  };
  
  // 标题质量
  if (post.title && post.title.length > 10) {
    quality.score += 5;
    quality.indicators.push('Descriptive title');
  }
  
  // 内容长度
  if (post.selftext && post.selftext.length > 100) {
    quality.score += 10;
    quality.indicators.push('Detailed content');
  }
  
  // 社区认可
  if (post.upvote_ratio > 0.8) {
    quality.score += 10;
    quality.indicators.push('High community approval');
  }
  
  // 讨论活跃度
  if (post.num_comments > 20) {
    quality.score += 8;
    quality.indicators.push('Active discussion');
  }
  
  // 特殊标记
  if (post.stickied) {
    quality.score += 15;
    quality.indicators.push('Moderator highlighted');
  }
  
  if (post.distinguished) {
    quality.score += 10;
    quality.indicators.push('Official response');
  }
  
  // 确定质量级别
  if (quality.score >= 25) quality.level = 'excellent';
  else if (quality.score >= 15) quality.level = 'good';
  
  return quality;
}

/**
 * 分析帖子时间
 */
function analyzePostTime(post: any): any {
  const now = Date.now() / 1000;
  const postTime = post.created_utc;
  const ageInHours = (now - postTime) / 3600;
  const ageInDays = ageInHours / 24;
  
  let freshness = 'old';
  if (ageInHours < 1) freshness = 'very_fresh';
  else if (ageInHours < 24) freshness = 'fresh';
  else if (ageInDays < 7) freshness = 'recent';
  else if (ageInDays < 30) freshness = 'moderate';
  
  return {
    ageInHours: Math.round(ageInHours),
    ageInDays: Math.round(ageInDays),
    freshness,
    createdAt: new Date(postTime * 1000).toISOString(),
    relativeTime: formatRelativeTime(ageInHours)
  };
}

/**
 * 分析社区上下文
 */
function analyzeCommunityContext(post: any): any {
  const subreddit = post.subreddit;
  
  // 社区类型分析
  const communityTypes = {
    'AskReddit': 'Q&A Community',
    'explainlikeimfive': 'Educational',
    'todayilearned': 'Knowledge Sharing',
    'LifeProTips': 'Advice & Tips',
    'news': 'News & Current Events',
    'technology': 'Technology Discussion',
    'science': 'Scientific Discussion'
  };
  
  const communityType = communityTypes[subreddit as keyof typeof communityTypes] || 'General Discussion';
  
  return {
    subreddit,
    communityType,
    url: `https://reddit.com/r/${subreddit}`,
    postUrl: `https://reddit.com${post.permalink}`,
    isNSFW: post.over_18 || false,
    isLocked: post.locked || false,
    isStickied: post.stickied || false
  };
}

/**
 * 格式化显示信息
 */
function formatDisplayInfo(post: any): any {
  return {
    title: post.title,
    author: post.author,
    subreddit: `r/${post.subreddit}`,
    score: `${post.score} points`,
    comments: `${post.num_comments} comments`,
    upvoteRatio: `${Math.round((post.upvote_ratio || 0) * 100)}% upvoted`,
    preview: post.selftext ? post.selftext.substring(0, 200) + '...' : 'Link post',
    url: `https://reddit.com${post.permalink}`,
    thumbnail: post.thumbnail !== 'self' ? post.thumbnail : null
  };
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(ageInHours: number): string {
  if (ageInHours < 1) return `${Math.round(ageInHours * 60)} minutes ago`;
  if (ageInHours < 24) return `${Math.round(ageInHours)} hours ago`;
  
  const days = Math.round(ageInHours / 24);
  if (days < 30) return `${days} days ago`;
  
  const months = Math.round(days / 30);
  if (months < 12) return `${months} months ago`;
  
  const years = Math.round(months / 12);
  return `${years} years ago`;
}

/**
 * 分析搜索结果
 */
function analyzeSearchResults(posts: any[], query: string): any {
  if (posts.length === 0) return {};
  
  const analysis = {
    totalPosts: posts.length,
    subreddits: {} as Record<string, number>,
    engagementLevels: { high: 0, medium: 0, low: 0 },
    qualityLevels: { excellent: 0, good: 0, basic: 0 },
    timeDistribution: { very_fresh: 0, fresh: 0, recent: 0, moderate: 0, old: 0 },
    averageScore: 0,
    averageComments: 0,
    topPosts: posts.slice(0, 3)
  };
  
  // 统计分布
  posts.forEach(post => {
    // Subreddit分布
    const subreddit = post.subreddit;
    analysis.subreddits[subreddit] = (analysis.subreddits[subreddit] || 0) + 1;
    
    // 参与度分布
    if (post.engagementMetrics.level in analysis.engagementLevels) {
      (analysis.engagementLevels as any)[post.engagementMetrics.level]++;
    }

    // 质量分布
    if (post.qualityIndicators.level in analysis.qualityLevels) {
      (analysis.qualityLevels as any)[post.qualityIndicators.level]++;
    }

    // 时间分布
    if (post.timeAnalysis.freshness in analysis.timeDistribution) {
      (analysis.timeDistribution as any)[post.timeAnalysis.freshness]++;
    }
  });
  
  // 计算平均值
  analysis.averageScore = posts.reduce((sum, post) => sum + (post.score || 0), 0) / posts.length;
  analysis.averageComments = posts.reduce((sum, post) => sum + (post.num_comments || 0), 0) / posts.length;
  
  return analysis;
}

/**
 * 生成搜索建议
 */
function generateSearchSuggestions(query: string, route: any): string[] {
  const suggestions: string[] = [];
  
  if (route.suggestions) {
    suggestions.push(...route.suggestions);
  }
  
  // 基于查询内容提供建议
  suggestions.push(
    'Try more specific keywords',
    'Search within specific subreddits using "in r/subreddit"',
    'Use "hot" or "top" for trending content',
    'Try different time periods for top posts'
  );
  
  return suggestions.slice(0, 4);
}

/**
 * 生成搜索摘要
 */
function generateSearchSummary(posts: any[], query: string, route: any, analysis: any): string {
  if (posts.length === 0) return `No Reddit posts found for "${query}"`;
  
  const topPost = posts[0];
  const mainSubreddit = Object.keys(analysis.subreddits)[0];
  const avgScore = Math.round(analysis.averageScore);
  
  return `Found ${posts.length} Reddit posts for "${query}". Top result: "${topPost.title}" in r/${topPost.subreddit} (${topPost.score} points). Main community: r/${mainSubreddit}. Average score: ${avgScore}.`;
}

/**
 * 工具注册信息
 */
export const redditPostSearchTool = {
  name: 'reddit_post_search',
  description: 'Search Reddit posts, discussions, and community content with intelligent routing and engagement analysis',
  category: 'social-search',
  source: 'reddit.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for Reddit posts. Examples: "machine learning tips", "hot posts in r/programming", "top posts this week", "best advice for beginners"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of posts to return (default: 10, max: 25)',
        default: 10,
        minimum: 1,
        maximum: 25
      }
    },
    required: ['query']
  },
  execute: redditPostSearch,
  examples: [
    {
      query: "machine learning tips",
      description: "Search for machine learning tips and discussions"
    },
    {
      query: "hot posts in r/programming",
      description: "Get hot posts from programming subreddit"
    },
    {
      query: "top posts this week",
      description: "Find top-rated posts from this week"
    },
    {
      query: "best advice for beginners",
      description: "Search for beginner advice across Reddit"
    },
    {
      query: "AskReddit funny stories",
      description: "Find funny stories from AskReddit"
    }
  ]
};
