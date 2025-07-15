import { RedditSearchClient } from '../../api/clients/reddit-search-client.js';
import { RedditSearchRouter } from '../../utils/reddit-search-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Reddit 热门内容搜索工具
 * 专门用于发现Reddit热门、趋势、顶级内容
 */

const logger = new Logger('RedditTrendingSearch');

export async function redditTrendingSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing Reddit trending search: ${args.query}`);

    const limit = args.limit || 15;
    const result = await handleTrendingSearchRequest(client, router, args.query, limit);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'reddit_trending_search',
        result,
        source: 'Reddit',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Reddit trending search failed:', error);
    return {
      success: false,
      error: `Reddit trending search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理热门内容搜索请求
 */
async function handleTrendingSearchRequest(client: RedditSearchClient, router: RedditSearchRouter, query: string, limit: number): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let trendingData;
    let contentType = 'mixed';
    
    // 根据路由类型获取不同的热门内容
    switch (route.searchType) {
      case 'hot':
        trendingData = await client.getHotPosts(route.subreddit, limit);
        contentType = 'hot_posts';
        break;
        
      case 'top':
        trendingData = await client.getTopPosts(route.subreddit, route.timeframe || 'day', limit);
        contentType = 'top_posts';
        break;
        
      default:
        // 获取多种热门内容的组合
        trendingData = await getMultipleTrendingContent(client, query, limit);
        contentType = 'mixed_trending';
        break;
    }
    
    if (!trendingData || (Array.isArray(trendingData) ? trendingData.length === 0 : (trendingData.data && trendingData.data.children.length === 0))) {
      return {
        type: 'reddit_trending_search',
        contentType,
        query,
        trendingContent: [],
        totalResults: 0,
        route,
        message: `No trending content found for "${query}"`,
        suggestions: generateTrendingSuggestions(query)
      };
    }

    // 处理不同类型的数据结构
    let posts: any[] = [];
    if (contentType === 'mixed_trending') {
      posts = Array.isArray(trendingData) ? trendingData : [];
    } else {
      posts = (trendingData as any).data.children.map((item: any) => item.data);
    }

    // 增强热门内容信息
    const enhancedContent = posts.map((post: any) => ({
      ...post,
      
      // 热门度分析
      trendingScore: calculateTrendingScore(post),
      
      // 病毒传播潜力
      viralPotential: assessViralPotential(post),
      
      // 内容分类
      contentCategory: categorizeContent(post),
      
      // 时效性分析
      timeliness: analyzeTimeliness(post),
      
      // 社区影响力
      communityImpact: assessCommunityImpact(post),
      
      // 趋势指标
      trendingIndicators: identifyTrendingIndicators(post),
      
      // 格式化显示信息
      displayInfo: formatTrendingDisplayInfo(post)
    }));

    // 按热门度排序
    enhancedContent.sort((a: any, b: any) => {
      const scoreA = a.trendingScore + a.viralPotential + a.communityImpact;
      const scoreB = b.trendingScore + b.viralPotential + b.communityImpact;
      return scoreB - scoreA;
    });

    // 分析热门趋势
    const trendAnalysis = analyzeTrendingPatterns(enhancedContent);

    return {
      type: 'reddit_trending_search',
      contentType,
      query,
      trendingContent: enhancedContent,
      totalResults: enhancedContent.length,
      route,
      analysis: trendAnalysis,
      summary: generateTrendingSummary(enhancedContent, query, contentType, trendAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 获取多种热门内容的组合
 */
async function getMultipleTrendingContent(client: RedditSearchClient, query: string, limit: number): Promise<any[]> {
  const promises = [
    client.getHotPosts(undefined, Math.ceil(limit / 3)),
    client.getTopPosts(undefined, 'day', Math.ceil(limit / 3)),
    client.getTopPosts(undefined, 'week', Math.ceil(limit / 3))
  ];
  
  try {
    const results = await Promise.all(promises);
    const allPosts: any[] = [];
    
    results.forEach(result => {
      if (result.data && result.data.children) {
        allPosts.push(...result.data.children.map((item: any) => ({
          ...item.data,
          sourceType: result === results[0] ? 'hot' : result === results[1] ? 'top_day' : 'top_week'
        })));
      }
    });
    
    // 去重并限制数量
    const uniquePosts = allPosts.filter((post, index, self) => 
      index === self.findIndex(p => p.id === post.id)
    );
    
    return uniquePosts.slice(0, limit);
  } catch (error) {
    logger.warn('Failed to get multiple trending content, falling back to hot posts');
    const fallback = await client.getHotPosts(undefined, limit);
    return fallback.data.children.map((item: any) => ({ ...item.data, sourceType: 'hot' }));
  }
}

/**
 * 计算热门度分数
 */
function calculateTrendingScore(post: any): number {
  let score = 0;
  
  // 基于分数
  const postScore = post.score || 0;
  if (postScore > 10000) score += 25;
  else if (postScore > 5000) score += 20;
  else if (postScore > 1000) score += 15;
  else if (postScore > 100) score += 10;
  else if (postScore > 10) score += 5;
  
  // 基于评论数
  const comments = post.num_comments || 0;
  if (comments > 1000) score += 15;
  else if (comments > 500) score += 12;
  else if (comments > 100) score += 8;
  else if (comments > 20) score += 5;
  
  // 基于投票比率
  const upvoteRatio = post.upvote_ratio || 0;
  if (upvoteRatio > 0.95) score += 10;
  else if (upvoteRatio > 0.9) score += 8;
  else if (upvoteRatio > 0.8) score += 5;
  
  // 奖励加成
  if (post.gilded > 0) score += 5;
  if (post.awards_received > 0) score += 3;
  
  return Math.min(score, 60);
}

/**
 * 评估病毒传播潜力
 */
function assessViralPotential(post: any): number {
  let potential = 0;
  
  // 评论与分数比率（高互动性）
  const comments = post.num_comments || 0;
  const score = post.score || 1;
  const commentRatio = comments / score;
  
  if (commentRatio > 0.1) potential += 15;
  else if (commentRatio > 0.05) potential += 10;
  else if (commentRatio > 0.02) potential += 5;
  
  // 时间因素（新鲜内容更容易传播）
  const ageInHours = (Date.now() / 1000 - post.created_utc) / 3600;
  if (ageInHours < 2) potential += 15;
  else if (ageInHours < 6) potential += 10;
  else if (ageInHours < 24) potential += 5;
  
  // 内容类型（某些类型更容易传播）
  if (post.is_video) potential += 8;
  if (post.thumbnail && post.thumbnail !== 'self') potential += 5;
  
  // 争议性（可能引发讨论）
  const upvoteRatio = post.upvote_ratio || 1;
  if (upvoteRatio < 0.7 && upvoteRatio > 0.5) potential += 10; // 争议内容
  
  return Math.min(potential, 40);
}

/**
 * 分类内容
 */
function categorizeContent(post: any): string {
  const title = (post.title || '').toLowerCase();
  const subreddit = (post.subreddit || '').toLowerCase();
  
  // 基于subreddit分类
  const categoryMap = {
    'News': ['news', 'worldnews', 'politics'],
    'Technology': ['technology', 'programming', 'artificial'],
    'Entertainment': ['movies', 'television', 'music', 'gaming'],
    'Science': ['science', 'askscience', 'space'],
    'Lifestyle': ['lifeprotips', 'todayilearned', 'explainlikeimfive'],
    'Discussion': ['askreddit', 'nostupidquestions', 'changemyview'],
    'Humor': ['funny', 'memes', 'dankmemes', 'jokes'],
    'Creative': ['art', 'photography', 'diy', 'crafts']
  };
  
  for (const [category, subreddits] of Object.entries(categoryMap)) {
    if (subreddits.some(sub => subreddit.includes(sub))) {
      return category;
    }
  }
  
  // 基于标题关键词
  if (title.includes('breaking') || title.includes('urgent')) return 'Breaking News';
  if (title.includes('ama') || title.includes('ask me anything')) return 'AMA';
  if (title.includes('til') || title.includes('today i learned')) return 'Educational';
  if (title.includes('lpt') || title.includes('life pro tip')) return 'Tips';
  
  return 'General';
}

/**
 * 分析时效性
 */
function analyzeTimeliness(post: any): any {
  const ageInHours = (Date.now() / 1000 - post.created_utc) / 3600;
  const ageInDays = ageInHours / 24;
  
  let timeliness = 'old';
  let urgency = 'low';
  
  if (ageInHours < 1) {
    timeliness = 'breaking';
    urgency = 'very_high';
  } else if (ageInHours < 6) {
    timeliness = 'very_fresh';
    urgency = 'high';
  } else if (ageInHours < 24) {
    timeliness = 'fresh';
    urgency = 'medium';
  } else if (ageInDays < 3) {
    timeliness = 'recent';
    urgency = 'low';
  }
  
  return {
    ageInHours: Math.round(ageInHours),
    ageInDays: Math.round(ageInDays),
    timeliness,
    urgency,
    relativeTime: formatRelativeTime(ageInHours)
  };
}

/**
 * 评估社区影响力
 */
function assessCommunityImpact(post: any): number {
  let impact = 0;
  
  // 基于subreddit规模（推测）
  const subreddit = post.subreddit || '';
  const popularSubreddits = ['askreddit', 'todayilearned', 'worldnews', 'funny', 'pics'];
  
  if (popularSubreddits.includes(subreddit.toLowerCase())) {
    impact += 20;
  }
  
  // 基于帖子特征
  if (post.stickied) impact += 15; // 置顶帖子
  if (post.distinguished) impact += 10; // 官方回复
  
  // 基于互动质量
  const score = post.score || 0;
  const comments = post.num_comments || 0;
  
  if (score > 5000 && comments > 500) impact += 15;
  else if (score > 1000 && comments > 100) impact += 10;
  else if (score > 100 && comments > 20) impact += 5;
  
  return Math.min(impact, 35);
}

/**
 * 识别热门指标
 */
function identifyTrendingIndicators(post: any): string[] {
  const indicators: string[] = [];
  
  if (post.score > 10000) indicators.push('High Score');
  if (post.num_comments > 1000) indicators.push('High Engagement');
  if (post.upvote_ratio > 0.95) indicators.push('Highly Approved');
  if (post.gilded > 0) indicators.push('Awarded');
  if (post.stickied) indicators.push('Pinned');
  if (post.distinguished) indicators.push('Official');
  
  const ageInHours = (Date.now() / 1000 - post.created_utc) / 3600;
  if (ageInHours < 6) indicators.push('Fresh Content');
  
  if (post.is_video) indicators.push('Video Content');
  if (post.over_18) indicators.push('NSFW');
  
  return indicators;
}

/**
 * 格式化热门显示信息
 */
function formatTrendingDisplayInfo(post: any): any {
  const ageInHours = (Date.now() / 1000 - post.created_utc) / 3600;
  
  return {
    title: post.title,
    author: `u/${post.author}`,
    subreddit: `r/${post.subreddit}`,
    score: `${(post.score || 0).toLocaleString()} points`,
    comments: `${(post.num_comments || 0).toLocaleString()} comments`,
    upvoteRatio: `${Math.round((post.upvote_ratio || 0) * 100)}% upvoted`,
    age: formatRelativeTime(ageInHours),
    url: `https://reddit.com${post.permalink}`,
    thumbnail: post.thumbnail !== 'self' ? post.thumbnail : null,
    isVideo: post.is_video || false,
    awards: post.awards_received || 0,
    sourceType: post.sourceType || 'unknown'
  };
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(ageInHours: number): string {
  if (ageInHours < 1) return `${Math.round(ageInHours * 60)} minutes ago`;
  if (ageInHours < 24) return `${Math.round(ageInHours)} hours ago`;
  
  const days = Math.round(ageInHours / 24);
  return `${days} days ago`;
}

/**
 * 分析热门趋势模式
 */
function analyzeTrendingPatterns(content: any[]): any {
  if (content.length === 0) return {};
  
  const analysis = {
    totalContent: content.length,
    categories: {} as Record<string, number>,
    subreddits: {} as Record<string, number>,
    averageTrendingScore: 0,
    averageViralPotential: 0,
    timeDistribution: { breaking: 0, very_fresh: 0, fresh: 0, recent: 0, old: 0 },
    contentTypes: { text: 0, image: 0, video: 0, link: 0 },
    topTrending: content.slice(0, 5)
  };
  
  // 统计分布
  content.forEach(item => {
    // 分类分布
    const category = item.contentCategory;
    analysis.categories[category] = (analysis.categories[category] || 0) + 1;
    
    // Subreddit分布
    const subreddit = item.subreddit;
    analysis.subreddits[subreddit] = (analysis.subreddits[subreddit] || 0) + 1;
    
    // 时间分布
    if (item.timeliness.timeliness in analysis.timeDistribution) {
      (analysis.timeDistribution as any)[item.timeliness.timeliness]++;
    }
    
    // 内容类型分布
    if (item.is_video) analysis.contentTypes.video++;
    else if (item.thumbnail && item.thumbnail !== 'self') analysis.contentTypes.image++;
    else if (item.selftext) analysis.contentTypes.text++;
    else analysis.contentTypes.link++;
  });
  
  // 计算平均值
  analysis.averageTrendingScore = content.reduce((sum, item) => sum + item.trendingScore, 0) / content.length;
  analysis.averageViralPotential = content.reduce((sum, item) => sum + item.viralPotential, 0) / content.length;
  
  return analysis;
}

/**
 * 生成热门搜索建议
 */
function generateTrendingSuggestions(query: string): string[] {
  return [
    'Try "hot posts" for currently trending content',
    'Use "top posts today" for best content of the day',
    'Search "trending in r/subreddit" for specific communities',
    'Look for "breaking news" for urgent updates',
    'Try "viral content" for highly shared posts'
  ];
}

/**
 * 生成热门搜索摘要
 */
function generateTrendingSummary(content: any[], query: string, contentType: string, analysis: any): string {
  if (content.length === 0) return `No trending content found for "${query}"`;
  
  const topItem = content[0];
  const avgTrending = Math.round(analysis.averageTrendingScore);
  const mainCategory = Object.keys(analysis.categories)[0];
  
  return `Found ${content.length} trending items for "${query}". Top: "${topItem.title}" in r/${topItem.subreddit} (${topItem.score} points). Main category: ${mainCategory}. Average trending score: ${avgTrending}/60.`;
}

/**
 * 工具注册信息
 */
export const redditTrendingSearchTool = {
  name: 'reddit_trending_search',
  description: 'Discover trending, hot, and viral content on Reddit with comprehensive trend analysis',
  category: 'social-search',
  source: 'reddit.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Trending search query. Examples: "hot posts", "top posts today", "trending in r/technology", "viral content", "breaking news"'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of trending items to return (default: 15, max: 30)',
        default: 15,
        minimum: 1,
        maximum: 30
      }
    },
    required: ['query']
  },
  execute: redditTrendingSearch,
  examples: [
    {
      query: "hot posts",
      description: "Get currently hot/trending posts across Reddit"
    },
    {
      query: "top posts today",
      description: "Find today's top-rated posts"
    },
    {
      query: "trending in r/technology",
      description: "Get trending content from technology subreddit"
    },
    {
      query: "viral content",
      description: "Find viral and highly shared content"
    },
    {
      query: "breaking news",
      description: "Discover breaking news and urgent updates"
    }
  ]
};
