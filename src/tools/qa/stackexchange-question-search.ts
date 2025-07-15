import { StackExchangeClient } from '../../api/clients/stackexchange-client.js';
import { StackExchangeRouter } from '../../utils/stackexchange-router.js';
import { Logger } from '../../utils/logger.js';
import { ToolInput, ToolOutput } from '../../types.js';

/**
 * Stack Exchange 问题搜索工具
 * 专门用于搜索编程问答和技术支持内容
 */

const logger = new Logger('StackExchangeQuestionSearch');

export async function stackexchangeQuestionSearch(args: ToolInput): Promise<ToolOutput> {
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
    
    logger.info(`Processing Stack Exchange question search: ${args.query}`);

    const limit = args.limit || 10;
    const site = args.site || 'stackoverflow';
    const result = await handleQuestionSearchRequest(client, router, args.query, limit, site);

    return {
      success: true,
      data: {
        query: args.query,
        searchType: 'stackexchange_question_search',
        result,
        source: 'Stack Exchange',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error('Stack Exchange question search failed:', error);
    return {
      success: false,
      error: `Stack Exchange question search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 处理问题搜索请求
 */
async function handleQuestionSearchRequest(client: StackExchangeClient, router: StackExchangeRouter, query: string, limit: number, site: string): Promise<any> {
  try {
    // 智能路由分析
    const route = router.routeSearch(query);
    
    let searchResult;
    
    switch (route.searchType) {
      case 'tags':
        searchResult = await client.searchByTag(route.tag!, route.site || site, { pagesize: limit });
        break;
        
      case 'users':
        searchResult = await client.searchUsers(route.query, route.site || site);
        break;
        
      case 'hot':
        searchResult = await client.getHotQuestions(route.site || site);
        break;
        
      case 'advanced':
        searchResult = await client.advancedSearch(route.query, { 
          site: route.site || site,
          pagesize: limit,
          sort: route.sort,
          order: route.order
        });
        break;
        
      default: // 'questions'
        searchResult = await client.searchQuestions(query, { 
          site: route.site || site,
          pagesize: limit,
          sort: route.sort,
          order: route.order
        });
        break;
    }
    
    if (!searchResult.items || searchResult.items.length === 0) {
      return {
        type: 'stackexchange_question_search',
        query,
        questions: [],
        totalResults: 0,
        route,
        message: `No questions found for "${query}" on ${route.site || site}`,
        suggestions: generateSearchSuggestions(query, route)
      };
    }

    // 增强搜索结果
    const enhancedQuestions = searchResult.items.map((item: any) => {
      return {
        ...item,
        
        // 计算问题质量分数
        qualityScore: calculateQuestionQuality(item),
        
        // 问题类型分析
        questionType: analyzeQuestionType(item),
        
        // 难度评估
        difficultyLevel: assessDifficulty(item),
        
        // 解决状态分析
        solutionStatus: analyzeSolutionStatus(item),
        
        // 时效性分析
        freshnessScore: analyzeFreshness(item),
        
        // 格式化显示信息
        displayInfo: formatQuestionDisplayInfo(item)
      };
    });

    // 按质量和相关性排序
    enhancedQuestions.sort((a: any, b: any) => {
      const scoreA = a.qualityScore + a.freshnessScore + (a.is_answered ? 20 : 0);
      const scoreB = b.qualityScore + b.freshnessScore + (b.is_answered ? 20 : 0);
      return scoreB - scoreA;
    });

    // 分析搜索结果
    const resultAnalysis = analyzeQuestionResults(enhancedQuestions, searchResult);

    return {
      type: 'stackexchange_question_search',
      query,
      questions: enhancedQuestions,
      totalResults: searchResult.items.length,
      hasMore: searchResult.has_more,
      quotaRemaining: searchResult.quota_remaining,
      site: route.site || site,
      route,
      analysis: resultAnalysis,
      summary: generateQuestionSearchSummary(enhancedQuestions, query, route, resultAnalysis)
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * 计算问题质量分数
 */
function calculateQuestionQuality(question: any): number {
  let score = 0;
  
  // 投票分数
  score += Math.min(question.score * 2, 20);
  
  // 浏览量
  if (question.view_count > 1000) score += 10;
  else if (question.view_count > 100) score += 5;
  
  // 答案数量
  if (question.answer_count > 0) score += 10;
  if (question.answer_count > 3) score += 5;
  
  // 是否有被接受的答案
  if (question.accepted_answer_id) score += 15;
  
  // 标签数量（适中的标签数量表示问题定义清晰）
  if (question.tags && question.tags.length >= 2 && question.tags.length <= 5) {
    score += 5;
  }
  
  // 标题长度（适中的标题长度表示问题描述清晰）
  if (question.title && question.title.length > 20 && question.title.length < 150) {
    score += 5;
  }
  
  return Math.min(score, 50);
}

/**
 * 分析问题类型
 */
function analyzeQuestionType(question: any): string {
  const title = question.title?.toLowerCase() || '';
  const tags = question.tags || [];
  
  // 基于标题和标签判断问题类型
  if (title.includes('how to') || title.includes('how do i')) return 'How-to Guide';
  if (title.includes('error') || title.includes('exception') || title.includes('bug')) return 'Error/Bug Fix';
  if (title.includes('best practice') || title.includes('recommended')) return 'Best Practice';
  if (title.includes('difference between') || title.includes('vs ')) return 'Comparison';
  if (title.includes('why') || title.includes('what is')) return 'Conceptual';
  if (title.includes('performance') || title.includes('optimize')) return 'Performance';
  if (title.includes('security') || title.includes('secure')) return 'Security';
  if (tags.includes('debugging')) return 'Debugging';
  if (tags.includes('algorithm')) return 'Algorithm';
  if (tags.includes('design-patterns')) return 'Design Pattern';
  
  return 'General Question';
}

/**
 * 评估问题难度
 */
function assessDifficulty(question: any): string {
  let difficultyScore = 0;
  
  // 基于投票分数
  if (question.score > 50) difficultyScore += 3;
  else if (question.score > 10) difficultyScore += 2;
  else if (question.score > 0) difficultyScore += 1;
  
  // 基于浏览量
  if (question.view_count > 10000) difficultyScore += 2;
  else if (question.view_count > 1000) difficultyScore += 1;
  
  // 基于答案数量
  if (question.answer_count > 5) difficultyScore += 2;
  else if (question.answer_count > 1) difficultyScore += 1;
  
  // 基于标签复杂性
  const complexTags = ['algorithm', 'performance', 'concurrency', 'security', 'architecture'];
  if (question.tags && question.tags.some((tag: string) => complexTags.includes(tag))) {
    difficultyScore += 2;
  }
  
  if (difficultyScore >= 6) return 'Advanced';
  if (difficultyScore >= 3) return 'Intermediate';
  return 'Beginner';
}

/**
 * 分析解决状态
 */
function analyzeSolutionStatus(question: any): any {
  const status = {
    hasAnswers: question.answer_count > 0,
    hasAcceptedAnswer: !!question.accepted_answer_id,
    answerCount: question.answer_count,
    isResolved: false,
    confidence: 'unknown' as 'high' | 'medium' | 'low' | 'unknown'
  };
  
  if (question.accepted_answer_id) {
    status.isResolved = true;
    status.confidence = 'high';
  } else if (question.answer_count > 0 && question.score > 0) {
    status.isResolved = true;
    status.confidence = 'medium';
  } else if (question.answer_count > 0) {
    status.confidence = 'low';
  }
  
  return status;
}

/**
 * 分析时效性
 */
function analyzeFreshness(question: any): number {
  let score = 0;
  const now = Date.now() / 1000; // Unix timestamp
  
  // 创建时间
  const daysSinceCreation = (now - question.creation_date) / (24 * 60 * 60);
  if (daysSinceCreation < 30) score += 15;
  else if (daysSinceCreation < 365) score += 10;
  else if (daysSinceCreation < 365 * 2) score += 5;
  
  // 最后活动时间
  const daysSinceActivity = (now - question.last_activity_date) / (24 * 60 * 60);
  if (daysSinceActivity < 7) score += 10;
  else if (daysSinceActivity < 30) score += 5;
  
  return Math.min(score, 20);
}

/**
 * 格式化问题显示信息
 */
function formatQuestionDisplayInfo(question: any): any {
  return {
    title: question.title,
    link: question.link,
    score: question.score,
    viewCount: question.view_count,
    answerCount: question.answer_count,
    isAnswered: question.is_answered,
    hasAcceptedAnswer: !!question.accepted_answer_id,
    tags: question.tags || [],
    author: question.owner?.display_name || 'Unknown',
    authorReputation: question.owner?.reputation || 0,
    creationDate: new Date(question.creation_date * 1000).toISOString(),
    lastActivity: new Date(question.last_activity_date * 1000).toISOString(),
    isClosed: !!question.closed_date
  };
}

/**
 * 分析问题搜索结果
 */
function analyzeQuestionResults(questions: any[], searchResult: any): any {
  if (questions.length === 0) return {};
  
  const analysis = {
    totalQuestions: questions.length,
    questionTypes: {} as Record<string, number>,
    difficultyLevels: { Beginner: 0, Intermediate: 0, Advanced: 0 },
    solutionStatus: { resolved: 0, unresolved: 0, withAcceptedAnswer: 0 },
    averageQuality: 0,
    averageFreshness: 0,
    topQuestions: questions.slice(0, 3),
    hasMore: searchResult.has_more,
    quotaRemaining: searchResult.quota_remaining
  };
  
  // 统计分布
  questions.forEach(question => {
    // 问题类型分布
    const questionType = question.questionType;
    analysis.questionTypes[questionType] = (analysis.questionTypes[questionType] || 0) + 1;
    
    // 难度分布
    const difficulty = question.difficultyLevel;
    if (difficulty in analysis.difficultyLevels) {
      (analysis.difficultyLevels as any)[difficulty]++;
    }
    
    // 解决状态分布
    if (question.solutionStatus.isResolved) analysis.solutionStatus.resolved++;
    else analysis.solutionStatus.unresolved++;
    
    if (question.solutionStatus.hasAcceptedAnswer) analysis.solutionStatus.withAcceptedAnswer++;
  });
  
  // 计算平均值
  analysis.averageQuality = questions.reduce((sum, question) => sum + question.qualityScore, 0) / questions.length;
  analysis.averageFreshness = questions.reduce((sum, question) => sum + question.freshnessScore, 0) / questions.length;
  
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
    'Try more specific programming terms',
    'Add programming language tags like [python] or [javascript]',
    'Use error messages for debugging questions',
    'Check different Stack Exchange sites for specialized topics'
  );
  
  return suggestions.slice(0, 4);
}

/**
 * 生成问题搜索摘要
 */
function generateQuestionSearchSummary(questions: any[], query: string, route: any, analysis: any): string {
  if (questions.length === 0) return `No questions found for "${query}" on ${route.site || 'stackoverflow'}`;
  
  const topQuestion = questions[0];
  const avgQuality = Math.round(analysis.averageQuality);
  const resolvedCount = analysis.solutionStatus.resolved;
  
  return `Found ${analysis.totalQuestions} questions for "${query}" on ${route.site || 'stackoverflow'}. Top: "${topQuestion.title}" (${topQuestion.score} votes). ${resolvedCount}/${analysis.totalQuestions} resolved. Average quality: ${avgQuality}/50.`;
}

/**
 * 工具注册信息
 */
export const stackexchangeQuestionSearchTool = {
  name: 'stackexchange_question_search',
  description: 'Search programming questions and technical discussions on Stack Exchange with intelligent routing and quality assessment',
  category: 'qa-search',
  source: 'stackexchange.com',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query for programming questions. Examples: "python list comprehension", "[javascript] async await", "how to debug memory leak", "best practices REST API"'
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
  execute: stackexchangeQuestionSearch,
  examples: [
    {
      query: "python list comprehension",
      description: "Find Python list comprehension questions"
    },
    {
      query: "[javascript] async await",
      description: "Search JavaScript async/await tagged questions"
    },
    {
      query: "how to debug memory leak",
      description: "Find debugging help for memory leaks"
    },
    {
      query: "best practices REST API",
      description: "Get REST API best practice discussions"
    },
    {
      query: "user:jon-skeet",
      description: "Find questions by specific user"
    }
  ]
};
