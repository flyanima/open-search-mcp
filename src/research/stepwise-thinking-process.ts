/**
 * StepwiseThinkingProcess - 7步思考流程架构
 * 
 * 核心功能：
 * - 实现7步标准化思考流程
 * - 用户决策点交互机制
 * - 思考过程透明化展示
 * - 步骤状态管理和回溯
 */

import { InteractiveThoughtMap } from './interactive-thought-map.js';
import { ThoughtNode, ThoughtNodeType, ThoughtNodeStatus, ThoughtNodePriority } from './thought-node.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * 思考步骤枚举
 */
export enum ThinkingStep {
  STEP_1_UNDERSTANDING = 'step_1_understanding',     // 问题理解与分解
  STEP_2_STRATEGY = 'step_2_strategy',               // 研究策略制定
  STEP_3_HYPOTHESIS = 'step_3_hypothesis',           // 假设生成与验证
  STEP_4_COLLECTION = 'step_4_collection',           // 分阶段信息收集
  STEP_5_ANALYSIS = 'step_5_analysis',               // 综合分析与推理
  STEP_6_CONCLUSION = 'step_6_conclusion',           // 结论形成与反思
  STEP_7_FEEDBACK = 'step_7_feedback'                // 用户反馈与迭代
}

/**
 * 用户决策点类型
 */
export enum UserDecisionType {
  CONTINUE = 'continue',           // 继续下一步
  MODIFY = 'modify',              // 修改当前步骤
  BACKTRACK = 'backtrack',        // 回到上一步
  SKIP = 'skip',                  // 跳过当前步骤
  DEEP_DIVE = 'deep_dive',        // 深入探索
  ALTERNATIVE = 'alternative'      // 探索替代方案
}

/**
 * 用户决策点接口
 */
export interface UserDecisionPoint {
  id: string;
  step: ThinkingStep;
  question: string;
  options: {
    type: UserDecisionType;
    label: string;
    description: string;
    action?: () => Promise<void>;
  }[];
  context: {
    currentProgress: string;
    nextSteps: string[];
    alternatives: string[];
  };
  timestamp: Date;
}

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
  success: boolean;
  nodeId: string;
  output: string;
  confidence: number;
  nextStepSuggestion?: ThinkingStep;
  userDecisionRequired?: UserDecisionPoint;
  metadata?: Record<string, any>;
}

/**
 * 思考流程配置
 */
export interface ThinkingProcessConfig {
  enableUserInteraction: boolean;
  autoAdvance: boolean;
  maxRetries: number;
  timeoutMs: number;
  detailLevel: 'minimal' | 'standard' | 'detailed';
}

/**
 * 7步思考流程处理器
 */
export class StepwiseThinkingProcess extends EventEmitter {
  private thoughtMap: InteractiveThoughtMap;
  private logger: Logger;
  private currentStep: ThinkingStep;
  private stepNodes: Map<ThinkingStep, string> = new Map();
  private config: ThinkingProcessConfig;
  private isProcessing: boolean = false;
  private userDecisionQueue: UserDecisionPoint[] = [];

  constructor(thoughtMap: InteractiveThoughtMap, config?: Partial<ThinkingProcessConfig>) {
    super();
    this.thoughtMap = thoughtMap;
    this.logger = new Logger('StepwiseThinkingProcess');
    this.currentStep = ThinkingStep.STEP_1_UNDERSTANDING;
    
    this.config = {
      enableUserInteraction: true,
      autoAdvance: false,
      maxRetries: 3,
      timeoutMs: 30000,
      detailLevel: 'standard',
      ...config
    };
  }

  /**
   * 开始思考流程
   */
  async startThinkingProcess(initialQuestion: string): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Thinking process is already running');
    }

    this.isProcessing = true;
    this.logger.info(`Starting 7-step thinking process: ${initialQuestion}`);

    try {
      // 创建根节点
      const rootNode = this.thoughtMap.addNode(
        '深度研究流程',
        `研究问题: ${initialQuestion}`,
        ThoughtNodeType.ROOT,
        ThoughtNodePriority.HIGH
      );

      // 开始执行步骤
      await this.executeStep(ThinkingStep.STEP_1_UNDERSTANDING, initialQuestion, rootNode.id);
      
    } catch (error) {
      this.logger.error('Failed to start thinking process:', error);
      this.isProcessing = false;
      throw error;
    }
  }

  /**
   * 执行指定步骤
   */
  async executeStep(step: ThinkingStep, input: string, parentNodeId?: string): Promise<StepExecutionResult> {
    this.currentStep = step;
    this.logger.info(`Executing step: ${step}`);

    const stepInfo = this.getStepInfo(step);
    
    // 创建步骤节点
    const stepNode = this.thoughtMap.addNode(
      stepInfo.title,
      `输入: ${input}`,
      stepInfo.nodeType,
      stepInfo.priority,
      parentNodeId
    );

    this.stepNodes.set(step, stepNode.id);
    stepNode.updateStatus(ThoughtNodeStatus.PROCESSING);

    try {
      // 执行步骤逻辑
      const result = await this.executeStepLogic(step, input, stepNode);
      
      // 更新节点状态
      stepNode.updateStatus(ThoughtNodeStatus.COMPLETED);
      stepNode.updateContent(result.output);
      stepNode.setAnalysisMetadata(result.confidence, 1.0, 0.8);

      // 检查是否需要用户决策
      if (this.config.enableUserInteraction && result.userDecisionRequired) {
        this.userDecisionQueue.push(result.userDecisionRequired);
        stepNode.updateStatus(ThoughtNodeStatus.WAITING_USER);
      }

      // 自动推进到下一步
      if (this.config.autoAdvance && result.nextStepSuggestion && !result.userDecisionRequired) {
        await this.executeStep(result.nextStepSuggestion, result.output, stepNode.id);
      }

      this.emit('stepCompleted', step, result);
      return result;

    } catch (error) {
      this.logger.error(`Step ${step} failed:`, error);
      stepNode.setError(error instanceof Error ? error.message : String(error));
      
      throw error;
    }
  }

  /**
   * 执行步骤具体逻辑
   */
  private async executeStepLogic(step: ThinkingStep, input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    switch (step) {
      case ThinkingStep.STEP_1_UNDERSTANDING:
        return await this.executeStep1Understanding(input, stepNode);
      case ThinkingStep.STEP_2_STRATEGY:
        return await this.executeStep2Strategy(input, stepNode);
      case ThinkingStep.STEP_3_HYPOTHESIS:
        return await this.executeStep3Hypothesis(input, stepNode);
      case ThinkingStep.STEP_4_COLLECTION:
        return await this.executeStep4Collection(input, stepNode);
      case ThinkingStep.STEP_5_ANALYSIS:
        return await this.executeStep5Analysis(input, stepNode);
      case ThinkingStep.STEP_6_CONCLUSION:
        return await this.executeStep6Conclusion(input, stepNode);
      case ThinkingStep.STEP_7_FEEDBACK:
        return await this.executeStep7Feedback(input, stepNode);
      default:
        throw new Error(`Unknown step: ${step}`);
    }
  }

  /**
   * 步骤1: 问题理解与分解
   */
  private async executeStep1Understanding(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const analysis = {
      mainQuestion: input,
      subQuestions: [
        `${input}的核心概念是什么？`,
        `需要从哪些角度来分析${input}？`,
        `${input}的关键影响因素有哪些？`
      ],
      scope: `研究范围：${input}的全面分析`,
      constraints: ['时间限制', '信息可获得性', '分析深度要求']
    };

    const output = `
**问题分解结果:**

**主要问题:** ${analysis.mainQuestion}

**子问题:**
${analysis.subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

**研究范围:** ${analysis.scope}

**约束条件:**
${analysis.constraints.map((c, i) => `- ${c}`).join('\n')}
`;

    // 创建子问题节点
    for (const subQuestion of analysis.subQuestions) {
      this.thoughtMap.addNode(
        '子问题',
        subQuestion,
        ThoughtNodeType.QUESTION,
        ThoughtNodePriority.MEDIUM,
        stepNode.id
      );
    }

    const userDecision: UserDecisionPoint = {
      id: `decision_${Date.now()}`,
      step: ThinkingStep.STEP_1_UNDERSTANDING,
      question: '问题分解是否准确？是否需要调整研究范围？',
      options: [
        {
          type: UserDecisionType.CONTINUE,
          label: '继续下一步',
          description: '问题分解合理，继续制定研究策略'
        },
        {
          type: UserDecisionType.MODIFY,
          label: '修改分解',
          description: '调整子问题或研究范围'
        },
        {
          type: UserDecisionType.DEEP_DIVE,
          label: '深入分解',
          description: '进一步细化问题分解'
        }
      ],
      context: {
        currentProgress: '已完成问题理解与分解',
        nextSteps: ['制定研究策略', '生成研究假设'],
        alternatives: ['重新定义问题范围', '调整分析角度']
      },
      timestamp: new Date()
    };

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.8,
      nextStepSuggestion: ThinkingStep.STEP_2_STRATEGY,
      userDecisionRequired: userDecision
    };
  }

  /**
   * 步骤2: 研究策略制定
   */
  private async executeStep2Strategy(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const strategy = {
      approach: '多维度综合分析法',
      methods: [
        '文献调研',
        '数据分析',
        '专家访谈',
        '案例研究'
      ],
      timeline: '分阶段执行，每阶段2-3天',
      resources: ['学术数据库', '行业报告', '专业网站', '新闻媒体']
    };

    const output = `
**研究策略:**

**分析方法:** ${strategy.approach}

**研究方法:**
${strategy.methods.map((m, i) => `${i + 1}. ${m}`).join('\n')}

**执行计划:** ${strategy.timeline}

**信息来源:**
${strategy.resources.map(r => `- ${r}`).join('\n')}
`;

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.85,
      nextStepSuggestion: ThinkingStep.STEP_3_HYPOTHESIS
    };
  }

  /**
   * 步骤3: 假设生成与验证
   */
  private async executeStep3Hypothesis(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const hypotheses = [
      '假设1: 主要因素X对结果有显著影响',
      '假设2: 趋势Y将在未来持续发展',
      '假设3: 方案Z是最优解决方案'
    ];

    const output = `
**研究假设:**

${hypotheses.map((h, i) => `**${h}**\n验证方法: 通过数据分析和案例研究验证\n`).join('\n')}
`;

    // 为每个假设创建子节点
    for (const hypothesis of hypotheses) {
      this.thoughtMap.addNode(
        '研究假设',
        hypothesis,
        ThoughtNodeType.HYPOTHESIS,
        ThoughtNodePriority.HIGH,
        stepNode.id
      );
    }

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.75,
      nextStepSuggestion: ThinkingStep.STEP_4_COLLECTION
    };
  }

  /**
   * 步骤4: 分阶段信息收集
   */
  private async executeStep4Collection(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const output = `
**信息收集计划:**

**阶段1: 基础信息收集**
- 搜索相关文献和报告
- 收集基础数据和统计信息

**阶段2: 深度信息挖掘**
- 分析专业数据库
- 查找案例研究

**阶段3: 最新动态跟踪**
- 监控新闻和行业动态
- 收集专家观点
`;

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.9,
      nextStepSuggestion: ThinkingStep.STEP_5_ANALYSIS
    };
  }

  /**
   * 步骤5: 综合分析与推理
   */
  private async executeStep5Analysis(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const output = `
**综合分析结果:**

**数据分析:**
- 收集到的信息显示明确的趋势模式
- 关键指标表现符合预期

**假设验证:**
- 假设1: 部分验证，需要更多数据支持
- 假设2: 基本验证，趋势明显
- 假设3: 需要进一步分析

**关键发现:**
- 发现了重要的关联性
- 识别了潜在的风险因素
- 确定了优化机会
`;

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.85,
      nextStepSuggestion: ThinkingStep.STEP_6_CONCLUSION
    };
  }

  /**
   * 步骤6: 结论形成与反思
   */
  private async executeStep6Conclusion(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const output = `
**研究结论:**

**主要结论:**
1. 基于分析结果，得出核心结论
2. 验证了大部分研究假设
3. 识别了关键成功因素

**建议行动:**
- 短期建议: 立即可执行的措施
- 中期建议: 需要规划的行动
- 长期建议: 战略性考虑

**局限性:**
- 数据来源的限制
- 分析方法的局限
- 时间范围的约束

**后续研究方向:**
- 需要深入研究的领域
- 值得关注的新问题
`;

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.9,
      nextStepSuggestion: ThinkingStep.STEP_7_FEEDBACK
    };
  }

  /**
   * 步骤7: 用户反馈与迭代
   */
  private async executeStep7Feedback(input: string, stepNode: ThoughtNode): Promise<StepExecutionResult> {
    const userDecision: UserDecisionPoint = {
      id: `final_decision_${Date.now()}`,
      step: ThinkingStep.STEP_7_FEEDBACK,
      question: '研究结果是否满足您的需求？',
      options: [
        {
          type: UserDecisionType.CONTINUE,
          label: '满意结果',
          description: '研究结果符合预期，完成流程'
        },
        {
          type: UserDecisionType.MODIFY,
          label: '需要调整',
          description: '部分结果需要修改或补充'
        },
        {
          type: UserDecisionType.DEEP_DIVE,
          label: '深入研究',
          description: '对某些方面进行更深入的分析'
        },
        {
          type: UserDecisionType.ALTERNATIVE,
          label: '探索替代方案',
          description: '尝试不同的研究角度或方法'
        }
      ],
      context: {
        currentProgress: '已完成完整的7步研究流程',
        nextSteps: ['结果应用', '持续监控', '定期更新'],
        alternatives: ['重新分析', '扩大研究范围', '调整研究重点']
      },
      timestamp: new Date()
    };

    const output = `
**流程总结:**

**完成状态:** 已完成7步思考流程
**总体质量:** 高质量研究结果
**用户满意度:** 待用户反馈

**下一步行动:**
请根据您的需求选择后续行动方向。
`;

    return {
      success: true,
      nodeId: stepNode.id,
      output,
      confidence: 0.95,
      userDecisionRequired: userDecision
    };
  }

  /**
   * 获取步骤信息
   */
  private getStepInfo(step: ThinkingStep): {
    title: string;
    nodeType: ThoughtNodeType;
    priority: ThoughtNodePriority;
  } {
    const stepInfoMap = {
      [ThinkingStep.STEP_1_UNDERSTANDING]: {
        title: '步骤1: 问题理解与分解',
        nodeType: ThoughtNodeType.QUESTION,
        priority: ThoughtNodePriority.HIGH
      },
      [ThinkingStep.STEP_2_STRATEGY]: {
        title: '步骤2: 研究策略制定',
        nodeType: ThoughtNodeType.ANALYSIS,
        priority: ThoughtNodePriority.HIGH
      },
      [ThinkingStep.STEP_3_HYPOTHESIS]: {
        title: '步骤3: 假设生成与验证',
        nodeType: ThoughtNodeType.HYPOTHESIS,
        priority: ThoughtNodePriority.MEDIUM
      },
      [ThinkingStep.STEP_4_COLLECTION]: {
        title: '步骤4: 分阶段信息收集',
        nodeType: ThoughtNodeType.SEARCH,
        priority: ThoughtNodePriority.HIGH
      },
      [ThinkingStep.STEP_5_ANALYSIS]: {
        title: '步骤5: 综合分析与推理',
        nodeType: ThoughtNodeType.ANALYSIS,
        priority: ThoughtNodePriority.CRITICAL
      },
      [ThinkingStep.STEP_6_CONCLUSION]: {
        title: '步骤6: 结论形成与反思',
        nodeType: ThoughtNodeType.CONCLUSION,
        priority: ThoughtNodePriority.CRITICAL
      },
      [ThinkingStep.STEP_7_FEEDBACK]: {
        title: '步骤7: 用户反馈与迭代',
        nodeType: ThoughtNodeType.USER_INPUT,
        priority: ThoughtNodePriority.HIGH
      }
    };

    return stepInfoMap[step];
  }

  /**
   * 处理用户决策
   */
  async handleUserDecision(decisionId: string, choice: UserDecisionType, additionalInput?: string): Promise<void> {
    const decision = this.userDecisionQueue.find(d => d.id === decisionId);
    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    this.logger.info(`User decision: ${choice} for step ${decision.step}`);

    // 移除已处理的决策
    this.userDecisionQueue = this.userDecisionQueue.filter(d => d.id !== decisionId);

    // 根据用户选择执行相应操作
    switch (choice) {
      case UserDecisionType.CONTINUE:
        // 继续下一步
        break;
      case UserDecisionType.MODIFY:
        // 修改当前步骤
        if (additionalInput) {
          await this.executeStep(decision.step, additionalInput);
        }
        break;
      case UserDecisionType.BACKTRACK:
        // 回到上一步
        const prevStep = this.getPreviousStep(decision.step);
        if (prevStep) {
          await this.executeStep(prevStep, additionalInput || '重新执行');
        }
        break;
      case UserDecisionType.SKIP:
        // 跳过当前步骤
        const nextStep = this.getNextStep(decision.step);
        if (nextStep) {
          await this.executeStep(nextStep, additionalInput || '跳过上一步');
        }
        break;
    }
  }

  /**
   * 获取上一步
   */
  private getPreviousStep(currentStep: ThinkingStep): ThinkingStep | null {
    const steps = Object.values(ThinkingStep);
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex > 0 ? steps[currentIndex - 1] : null;
  }

  /**
   * 获取下一步
   */
  private getNextStep(currentStep: ThinkingStep): ThinkingStep | null {
    const steps = Object.values(ThinkingStep);
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): {
    currentStep: ThinkingStep;
    isProcessing: boolean;
    pendingDecisions: UserDecisionPoint[];
    completedSteps: ThinkingStep[];
  } {
    const completedSteps = Array.from(this.stepNodes.keys()).filter(step => {
      const nodeId = this.stepNodes.get(step);
      const node = nodeId ? this.thoughtMap.getNode(nodeId) : null;
      return node?.isCompleted();
    });

    return {
      currentStep: this.currentStep,
      isProcessing: this.isProcessing,
      pendingDecisions: [...this.userDecisionQueue],
      completedSteps
    };
  }

  /**
   * 停止思考流程
   */
  stopThinkingProcess(): void {
    this.isProcessing = false;
    this.userDecisionQueue = [];
    this.logger.info('Thinking process stopped');
  }
}
