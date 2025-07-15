import { StackExchangeClient } from '../../api/clients/stackexchange-client.js';
import { StackExchangeRouter } from '../../utils/stackexchange-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Stack Exchange 标签搜索工具
 * 专门用于按技术标签搜索编程问答内容
 */

const logger = new Logger('StackExchangeTagSearch');

export async function stackexchangeTagSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing Stack Exchange tag search: ${args.query}`);

    const limit = args.limit || 10;
    const site = args.site || 'stackoverflow';
    const tag = args.tag || extractTagFromQuery(args.query);
    const result = await handleTagSearchRequest(client, tag, limit, site);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'stackexchange_tag_search',
        result,
        source: 'Stack Exchange',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Stack Exchange tag search failed:', error);
    return {
      success: false,
      error: `Stack Exchange tag search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 从查询中提取标签
 */
function extractTagFromQuery(query: string): string {
  // 检查 [tag] 语法
  const tagMatch = query.match(/\[([^\]]+)\]/);
  if (tagMatch) {
    return tagMatch[1];
  }
  
  // 检查 tag: 语法
  const tagColonMatch = query.match(/tag:([^\s]+)/);
  if (tagColonMatch) {
    return tagColonMatch[1];
  }
  
  // 默认使用整个查询作为标签
  return query.toLowerCase().trim();
}

/**
 * 处理标签搜索请求
 */
async function handleTagSearchRequest(client: StackExchangeClient, tag: string, limit: number, site: string): Promise<any> {
  try {
    const searchResult = await client.searchByTag(tag, site, { 
      pagesize: limit,
      sort: 'votes',
      order: 'desc'
    });
    
    if (!searchResult.items || searchResult.items.length === 0) {
      return {
        type: 'stackexchange_tag_search',
        tag,
        questions: [],
        totalResults: 0,
        message: `No questions found for tag "${tag}" on ${site}`,
        suggestions: generateTagSearchSuggestions(tag)
      };
    }

    // 增强标签搜索结果
    const enhancedQuestions = searchResult.items.map((item: any) => {
      return {
        ...item,
        
        // 标签相关性分数
        tagRelevance: calculateTagRelevance(item, tag),
        
        // 问题质量分数
        qualityScore: calculateQuestionQuality(item),
        
        // 技术难度评估
        technicalDifficulty: assessTechnicalDifficulty(item, tag),
        
        // 解决状态分析
        solutionStatus: analyzeSolutionStatus(item),
        
        // 社区参与度
        communityEngagement: analyzeCommunityEngagement(item),
        
        // 格式化显示信息
        displayInfo: formatTagQuestionDisplayInfo(item, tag)
      };
    });

    // 按质量和相关性排序
    enhancedQuestions.sort((a: any, b: any) => {
      const scoreA = a.qualityScore + a.tagRelevance + (a.is_answered ? 15 : 0);
      const scoreB = b.qualityScore + b.tagRelevance + (b.is_answered ? 15 : 0);
      return scoreB - scoreA;
    });

    // 分析标签搜索结果
    const resultAnalysis = analyzeTagResults(enhancedQuestions, searchResult, tag);

    return {
      type: 'stackexchange_tag_search',
      tag,
      questions: enhancedQuestions,
      totalResults: searchResult.items.length,
      hasMore: searchResult.has_more,
      quotaRemaining: searchResult.quota_remaining,
      site,
      analysis: resultAnalysis,
      summary: generateTagSearchSummary(enhancedQuestions, tag, site, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 计算标签相关性分数
 */
function calculateTagRelevance(question: any, searchTag: string): number {
  let score = 0;
  const tags = question.tags || [];
  const normalizedSearchTag = searchTag.toLowerCase();
  
  // 精确匹配
  if (tags.includes(normalizedSearchTag)) {
    score += 30;
  }
  
  // 部分匹配
  const partialMatches = tags.filter((tag: string) => 
    tag.includes(normalizedSearchTag) || normalizedSearchTag.includes(tag)
  );
  score += partialMatches.length * 10;
  
  // 标题中包含标签
  if (question.title && question.title.toLowerCase().includes(normalizedSearchTag)) {
    score += 15;
  }
  
  // 相关技术标签
  const relatedTags = getRelatedTags(normalizedSearchTag);
  const relatedMatches = tags.filter((tag: string) => relatedTags.includes(tag));
  score += relatedMatches.length * 5;
  
  return Math.min(score, 50);
}

/**
 * 获取相关技术标签
 */
function getRelatedTags(tag: string): string[] {
  const relatedTagsMap: Record<string, string[]> = {
    'javascript': ['node.js', 'react', 'vue.js', 'angular', 'typescript', 'jquery'],
    'python': ['django', 'flask', 'pandas', 'numpy', 'scikit-learn', 'tensorflow'],
    'java': ['spring', 'hibernate', 'maven', 'gradle', 'android'],
    'csharp': ['.net', 'asp.net', 'entity-framework', 'wpf', 'xamarin'],
    'cpp': ['c', 'stl', 'boost', 'cmake'],
    'php': ['laravel', 'symfony', 'wordpress', 'composer'],
    'ruby': ['rails', 'gem', 'bundler'],
    'go': ['goroutine', 'gin', 'gorm'],
    'rust': ['cargo', 'tokio', 'serde'],
    'swift': ['ios', 'xcode', 'cocoapods'],
    'kotlin': ['android', 'spring-boot'],
    'typescript': ['javascript', 'node.js', 'angular', 'react']
  };
  
  return relatedTagsMap[tag] || [];
}

/**
 * 计算问题质量分数
 */
function calculateQuestionQuality(question: any): number {
  let score = 0;
  
  // 投票分数
  score += Math.min(question.score * 2, 25);
  
  // 浏览量
  if (question.view_count > 1000) score += 10;
  else if (question.view_count > 100) score += 5;
  
  // 答案数量和质量
  if (question.answer_count > 0) score += 10;
  if (question.accepted_answer_id) score += 15;
  
  // 标题质量
  if (question.title && question.title.length > 20 && question.title.length < 150) {
    score += 5;
  }
  
  return Math.min(score, 50);
}

/**
 * 评估技术难度
 */
function assessTechnicalDifficulty(question: any, tag: string): string {
  let difficultyScore = 0;
  
  // 基于投票和浏览量
  if (question.score > 20) difficultyScore += 3;
  else if (question.score > 5) difficultyScore += 2;
  else if (question.score > 0) difficultyScore += 1;
  
  if (question.view_count > 5000) difficultyScore += 2;
  else if (question.view_count > 1000) difficultyScore += 1;
  
  // 基于答案数量
  if (question.answer_count > 3) difficultyScore += 2;
  else if (question.answer_count > 1) difficultyScore += 1;
  
  // 基于标签复杂性
  const complexTags = ['algorithm', 'performance', 'concurrency', 'security', 'architecture', 'design-patterns'];
  if (question.tags && question.tags.some((t: string) => complexTags.includes(t))) {
    difficultyScore += 2;
  }
  
  // 基于特定技术的复杂性
  const advancedTopics = ['machine-learning', 'deep-learning', 'blockchain', 'microservices', 'kubernetes'];
  if (question.tags && question.tags.some((t: string) => advancedTopics.includes(t))) {
    difficultyScore += 3;
  }
  
  if (difficultyScore >= 7) return 'Advanced';
  if (difficultyScore >= 4) return 'Intermediate';
  return 'Beginner';
}

/**
 * 分析解决状态
 */
function analyzeSolutionStatus(question: any): any {
  return {
    hasAnswers: question.answer_count > 0,
    hasAcceptedAnswer: !!question.accepted_answer_id,
    answerCount: question.answer_count,
    isResolved: !!question.accepted_answer_id || (question.answer_count > 0 && question.score > 0),
    confidence: question.accepted_answer_id ? 'high' : 
                question.answer_count > 0 && question.score > 0 ? 'medium' : 
                question.answer_count > 0 ? 'low' : 'none'
  };
}

/**
 * 分析社区参与度
 */
function analyzeCommunityEngagement(question: any): any {
  let engagementScore = 0;
  
  // 基于浏览量
  engagementScore += Math.min(question.view_count / 100, 20);
  
  // 基于投票
  engagementScore += Math.min(Math.abs(question.score) * 2, 15);
  
  // 基于答案数量
  engagementScore += Math.min(question.answer_count * 5, 15);
  
  // 基于评论数量
  engagementScore += Math.min((question.comment_count || 0) * 2, 10);
  
  let engagementLevel = 'Low';
  if (engagementScore >= 40) engagementLevel = 'Very High';
  else if (engagementScore >= 25) engagementLevel = 'High';
  else if (engagementScore >= 15) engagementLevel = 'Medium';
  
  return {
    score: Math.round(engagementScore),
    level: engagementLevel
  };
}

/**
 * 格式化标签问题显示信息
 */
function formatTagQuestionDisplayInfo(question: any, searchTag: string): any {
  return {
    title: question.title,
    link: question.link,
    score: question.score,
    viewCount: question.view_count,
    answerCount: question.answer_count,
    isAnswered: question.is_answered,
    hasAcceptedAnswer: !!question.accepted_answer_id,
    tags: question.tags || [],
    searchTag: searchTag,
    relatedTags: (question.tags || []).filter((tag: string) => tag !== searchTag),
    author: question.owner?.display_name || 'Unknown',
    authorReputation: question.owner?.reputation || 0,
    creationDate: new Date(question.creation_date * 1000).toISOString(),
    lastActivity: new Date(question.last_activity_date * 1000).toISOString()
  };
}

/**
 * 分析标签搜索结果
 */
function analyzeTagResults(questions: any[], searchResult: any, tag: string): any {
  if (questions.length === 0) return {};
  
  const analysis = {
    totalQuestions: questions.length,
    tag: tag,
    difficultyLevels: { Beginner: 0, Intermediate: 0, Advanced: 0 },
    solutionStatus: { resolved: 0, unresolved: 0, withAcceptedAnswer: 0 },
    engagementLevels: {} as Record<string, number>,
    averageQuality: 0,
    averageTagRelevance: 0,
    topQuestions: questions.slice(0, 3),
    relatedTags: {} as Record<string, number>,
    hasMore: searchResult.has_more,
    quotaRemaining: searchResult.quota_remaining
  };
  
  // 统计分布
  questions.forEach(question => {
    // 难度分布
    const difficulty = question.technicalDifficulty;
    if (difficulty in analysis.difficultyLevels) {
      (analysis.difficultyLevels as any)[difficulty]++;
    }
    
    // 解决状态分布
    if (question.solutionStatus.isResolved) analysis.solutionStatus.resolved++;
    else analysis.solutionStatus.unresolved++;
    
    if (question.solutionStatus.hasAcceptedAnswer) analysis.solutionStatus.withAcceptedAnswer++;
    
    // 参与度分布
    const engagement = question.communityEngagement.level;
    analysis.engagementLevels[engagement] = (analysis.engagementLevels[engagement] || 0) + 1;
    
    // 相关标签统计
    (question.tags || []).forEach((t: string) => {
      if (t !== tag) {
        analysis.relatedTags[t] = (analysis.relatedTags[t] || 0) + 1;
      }
    });
  });
  
  // 计算平均值
  analysis.averageQuality = questions.reduce((sum, question) => sum + question.qualityScore, 0) / questions.length;
  analysis.averageTagRelevance = questions.reduce((sum, question) => sum + question.tagRelevance, 0) / questions.length;
  
  return analysis;
}

/**
 * 生成标签搜索建议
 */
function generateTagSearchSuggestions(tag: string): string[] {
  return [
    'Try related technology tags',
    'Use [tag] syntax for exact tag searches',
    'Combine with specific keywords for better results',
    'Check different Stack Exchange sites for specialized topics'
  ];
}

/**
 * 生成标签搜索摘要
 */
function generateTagSearchSummary(questions: any[], tag: string, site: string, analysis: any): string {
  if (questions.length === 0) return `No questions found for tag "${tag}" on ${site}`;
  
  const topQuestion = questions[0];
  const avgQuality = Math.round(analysis.averageQuality);
  const resolvedCount = analysis.solutionStatus.resolved;
  
  return `Found ${analysis.totalQuestions} questions for tag "${tag}" on ${site}. Top: "${topQuestion.title}" (${topQuestion.score} votes). ${resolvedCount}/${analysis.totalQuestions} resolved. Average quality: ${avgQuality}/50.`;
}

/**
 * 工具注册信息
 */
export const stackexchangeTagSearchTool = {
  name: 'stackexchange_tag_search',
  description: 'Search Stack Exchange questions by technology tags with relevance scoring and difficulty assessment',
  category: 'qa-search',
  source: 'stackexchange.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Tag search query. Examples: "[javascript]", "python", "tag:react", "[machine-learning]", "algorithm"'
      },
      tag: {
        type: 'string',
        description: 'Specific tag to search (overrides tag extraction from query)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of questions to return (default: 10, max: 30)',
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
  execute: stackexchangeTagSearch,
  examples: [
    {
      query: "[javascript]",
      description: "Find JavaScript-related questions"
    },
    {
      query: "python",
      description: "Search Python programming questions"
    },
    {
      query: "tag:react",
      description: "Find React framework questions"
    },
    {
      query: "[machine-learning]",
      description: "Search machine learning questions"
    },
    {
      query: "algorithm",
      description: "Find algorithm and data structure questions"
    }
  ]
};
