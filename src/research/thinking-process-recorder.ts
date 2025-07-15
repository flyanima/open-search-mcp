/**
 * Thinking Process Recorder - 思考过程记录器
 * 
 * 核心功能：
 * - 思考过程的完整记录
 * - 历史版本管理
 * - 回放功能
 * - 分支管理
 * - 性能分析
 */

import { InteractiveThoughtMap } from './interactive-thought-map.js';
import { ThoughtNode, ThoughtNodeStatus } from './thought-node.js';
import { StepwiseThinkingProcess, ThinkingStep } from './stepwise-thinking-process.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * 思考事件类型
 */
export enum ThinkingEventType {
  PROCESS_STARTED = 'process_started',
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',
  NODE_CREATED = 'node_created',
  NODE_UPDATED = 'node_updated',
  USER_DECISION = 'user_decision',
  BRANCH_CREATED = 'branch_created',
  PROCESS_COMPLETED = 'process_completed',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * 思考事件接口
 */
export interface ThinkingEvent {
  id: string;
  type: ThinkingEventType;
  timestamp: Date;
  sessionId: string;
  stepId?: string;
  nodeId?: string;
  data: any;
  metadata: {
    duration?: number;
    confidence?: number;
    userInput?: string;
    errorMessage?: string;
  };
}

/**
 * 思考会话接口
 */
export interface ThinkingSession {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'paused' | 'failed';
  events: ThinkingEvent[];
  branches: ThinkingBranch[];
  metadata: {
    totalSteps: number;
    completedSteps: number;
    userInteractions: number;
    totalDuration: number;
    averageStepTime: number;
    thoughtMapSnapshot?: any;
  };
}

/**
 * 思考分支接口
 */
export interface ThinkingBranch {
  id: string;
  parentEventId: string;
  name: string;
  description: string;
  createdAt: Date;
  events: ThinkingEvent[];
  isActive: boolean;
}

/**
 * 回放选项
 */
export interface PlaybackOptions {
  speed: number; // 回放速度倍数
  startFromEvent?: string; // 从指定事件开始
  endAtEvent?: string; // 在指定事件结束
  skipUserInteractions?: boolean; // 跳过用户交互
  branchId?: string; // 回放指定分支
  includeVisualization?: boolean; // 包含可视化
}

/**
 * 思考过程记录器类
 */
export class ThinkingProcessRecorder extends EventEmitter {
  private logger: Logger;
  private activeSessions: Map<string, ThinkingSession> = new Map();
  private eventCounter: number = 0;

  constructor() {
    super();
    this.logger = new Logger('ThinkingProcessRecorder');
  }

  /**
   * 开始记录思考过程
   */
  startRecording(title: string, description: string = ''): string {
    const sessionId = this.generateSessionId();
    
    const session: ThinkingSession = {
      id: sessionId,
      title,
      description,
      startTime: new Date(),
      status: 'active',
      events: [],
      branches: [],
      metadata: {
        totalSteps: 0,
        completedSteps: 0,
        userInteractions: 0,
        totalDuration: 0,
        averageStepTime: 0
      }
    };

    this.activeSessions.set(sessionId, session);

    // 记录开始事件
    this.recordEvent(sessionId, ThinkingEventType.PROCESS_STARTED, {
      title,
      description,
      startTime: session.startTime
    });

    this.logger.info(`Started recording thinking process: ${sessionId}`);
    return sessionId;
  }

  /**
   * 记录事件
   */
  recordEvent(
    sessionId: string,
    type: ThinkingEventType,
    data: any,
    metadata: Partial<ThinkingEvent['metadata']> = {}
  ): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const eventId = this.generateEventId();
    const event: ThinkingEvent = {
      id: eventId,
      type,
      timestamp: new Date(),
      sessionId,
      data,
      metadata: {
        duration: metadata.duration,
        confidence: metadata.confidence,
        userInput: metadata.userInput,
        errorMessage: metadata.errorMessage
      }
    };

    session.events.push(event);
    this.updateSessionMetadata(session, event);

    this.logger.debug(`Recorded event: ${type} for session ${sessionId}`);
    this.emit('eventRecorded', event);

    return eventId;
  }

  /**
   * 记录步骤开始
   */
  recordStepStart(sessionId: string, step: ThinkingStep, stepData: any): string {
    return this.recordEvent(sessionId, ThinkingEventType.STEP_STARTED, {
      step,
      stepData,
      startTime: new Date()
    });
  }

  /**
   * 记录步骤完成
   */
  recordStepComplete(
    sessionId: string,
    step: ThinkingStep,
    result: any,
    duration: number,
    confidence: number
  ): string {
    return this.recordEvent(sessionId, ThinkingEventType.STEP_COMPLETED, {
      step,
      result,
      endTime: new Date()
    }, {
      duration,
      confidence
    });
  }

  /**
   * 记录节点创建
   */
  recordNodeCreated(sessionId: string, node: ThoughtNode): string {
    return this.recordEvent(sessionId, ThinkingEventType.NODE_CREATED, {
      nodeId: node.id,
      nodeType: node.type,
      title: node.title,
      content: node.content,
      parentId: node.parentId,
      depth: node.depth
    });
  }

  /**
   * 记录节点更新
   */
  recordNodeUpdated(sessionId: string, nodeId: string, changes: any): string {
    return this.recordEvent(sessionId, ThinkingEventType.NODE_UPDATED, {
      nodeId,
      changes,
      timestamp: new Date()
    });
  }

  /**
   * 记录用户决策
   */
  recordUserDecision(
    sessionId: string,
    decisionPoint: any,
    userChoice: any,
    userInput?: string
  ): string {
    return this.recordEvent(sessionId, ThinkingEventType.USER_DECISION, {
      decisionPoint,
      userChoice,
      decisionTime: new Date()
    }, {
      userInput
    });
  }

  /**
   * 创建分支
   */
  createBranch(
    sessionId: string,
    parentEventId: string,
    name: string,
    description: string = ''
  ): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const branchId = this.generateBranchId();
    const branch: ThinkingBranch = {
      id: branchId,
      parentEventId,
      name,
      description,
      createdAt: new Date(),
      events: [],
      isActive: false
    };

    session.branches.push(branch);

    // 记录分支创建事件
    this.recordEvent(sessionId, ThinkingEventType.BRANCH_CREATED, {
      branchId,
      parentEventId,
      name,
      description
    });

    this.logger.info(`Created branch: ${branchId} for session ${sessionId}`);
    return branchId;
  }

  /**
   * 切换到分支
   */
  switchToBranch(sessionId: string, branchId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 停用所有分支
    session.branches.forEach(branch => {
      branch.isActive = false;
    });

    // 激活指定分支
    const targetBranch = session.branches.find(b => b.id === branchId);
    if (targetBranch) {
      targetBranch.isActive = true;
      this.logger.info(`Switched to branch: ${branchId}`);
    } else {
      throw new Error(`Branch ${branchId} not found`);
    }
  }

  /**
   * 完成记录
   */
  completeRecording(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.endTime = new Date();
    session.status = 'completed';
    session.metadata.totalDuration = session.endTime.getTime() - session.startTime.getTime();

    // 记录完成事件
    this.recordEvent(sessionId, ThinkingEventType.PROCESS_COMPLETED, {
      endTime: session.endTime,
      totalDuration: session.metadata.totalDuration,
      summary: this.generateSessionSummary(session)
    });

    this.logger.info(`Completed recording: ${sessionId}`);
  }

  /**
   * 回放思考过程
   */
  async playback(sessionId: string, options: PlaybackOptions = { speed: 1 }): Promise<any> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const events = this.getEventsForPlayback(session, options);
    const playbackResults: any[] = [];

    this.logger.info(`Starting playback for session: ${sessionId}`);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // 计算延迟时间
      const delay = this.calculatePlaybackDelay(event, events[i - 1], options.speed);
      
      if (delay > 0) {
        await this.sleep(delay);
      }

      // 回放事件
      const result = await this.playbackEvent(event, options);
      playbackResults.push(result);

      // 发出回放事件
      this.emit('playbackEvent', {
        event,
        result,
        progress: (i + 1) / events.length
      });
    }

    this.logger.info(`Playback completed for session: ${sessionId}`);
    return playbackResults;
  }

  /**
   * 获取会话信息
   */
  getSession(sessionId: string): ThinkingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): ThinkingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 导出会话
   */
  exportSession(sessionId: string, format: 'json' | 'csv' | 'markdown' = 'json'): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);
      case 'csv':
        return this.exportToCSV(session);
      case 'markdown':
        return this.exportToMarkdown(session);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 分析思考过程
   */
  analyzeThinkingProcess(sessionId: string): any {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const analysis = {
      overview: {
        sessionId: session.id,
        title: session.title,
        duration: session.metadata.totalDuration,
        totalEvents: session.events.length,
        completionRate: session.metadata.completedSteps / session.metadata.totalSteps
      },
      timeline: this.analyzeTimeline(session),
      performance: this.analyzePerformance(session),
      patterns: this.analyzePatterns(session),
      recommendations: this.generateRecommendations(session)
    };

    return analysis;
  }

  /**
   * 私有方法
   */
  private updateSessionMetadata(session: ThinkingSession, event: ThinkingEvent): void {
    switch (event.type) {
      case ThinkingEventType.STEP_STARTED:
        session.metadata.totalSteps++;
        break;
      case ThinkingEventType.STEP_COMPLETED:
        session.metadata.completedSteps++;
        break;
      case ThinkingEventType.USER_DECISION:
        session.metadata.userInteractions++;
        break;
    }

    // 更新平均步骤时间
    if (session.metadata.completedSteps > 0) {
      const totalStepTime = session.events
        .filter(e => e.type === ThinkingEventType.STEP_COMPLETED)
        .reduce((sum, e) => sum + (e.metadata.duration || 0), 0);
      
      session.metadata.averageStepTime = totalStepTime / session.metadata.completedSteps;
    }
  }

  private getEventsForPlayback(session: ThinkingSession, options: PlaybackOptions): ThinkingEvent[] {
    let events = [...session.events];

    // 过滤分支
    if (options.branchId) {
      const branch = session.branches.find(b => b.id === options.branchId);
      if (branch) {
        events = branch.events;
      }
    }

    // 过滤事件范围
    if (options.startFromEvent) {
      const startIndex = events.findIndex(e => e.id === options.startFromEvent);
      if (startIndex >= 0) {
        events = events.slice(startIndex);
      }
    }

    if (options.endAtEvent) {
      const endIndex = events.findIndex(e => e.id === options.endAtEvent);
      if (endIndex >= 0) {
        events = events.slice(0, endIndex + 1);
      }
    }

    // 过滤用户交互
    if (options.skipUserInteractions) {
      events = events.filter(e => e.type !== ThinkingEventType.USER_DECISION);
    }

    return events;
  }

  private calculatePlaybackDelay(
    currentEvent: ThinkingEvent,
    previousEvent: ThinkingEvent | undefined,
    speed: number
  ): number {
    if (!previousEvent) {
      return 0;
    }

    const realDelay = currentEvent.timestamp.getTime() - previousEvent.timestamp.getTime();
    return Math.max(0, realDelay / speed);
  }

  private async playbackEvent(event: ThinkingEvent, options: PlaybackOptions): Promise<any> {
    // 模拟事件回放
    const result = {
      eventId: event.id,
      type: event.type,
      timestamp: event.timestamp,
      data: event.data,
      playbackTime: new Date()
    };

    // 如果需要可视化，生成相应的可视化内容
    if (options.includeVisualization && this.shouldGenerateVisualization(event)) {
      (result as any).visualization = this.generateEventVisualization(event);
    }

    return result;
  }

  private shouldGenerateVisualization(event: ThinkingEvent): boolean {
    return [
      ThinkingEventType.NODE_CREATED,
      ThinkingEventType.NODE_UPDATED,
      ThinkingEventType.STEP_COMPLETED
    ].includes(event.type);
  }

  private generateEventVisualization(event: ThinkingEvent): string {
    // 简化的可视化生成
    return `Event: ${event.type} at ${event.timestamp.toISOString()}`;
  }

  private generateSessionSummary(session: ThinkingSession): any {
    return {
      totalEvents: session.events.length,
      duration: session.metadata.totalDuration,
      stepsCompleted: session.metadata.completedSteps,
      userInteractions: session.metadata.userInteractions,
      branches: session.branches.length
    };
  }

  private analyzeTimeline(session: ThinkingSession): any {
    const timeline = session.events.map(event => ({
      timestamp: event.timestamp,
      type: event.type,
      duration: event.metadata.duration || 0
    }));

    return {
      events: timeline,
      totalDuration: session.metadata.totalDuration,
      averageEventDuration: timeline.reduce((sum, e) => sum + e.duration, 0) / timeline.length
    };
  }

  private analyzePerformance(session: ThinkingSession): any {
    const stepEvents = session.events.filter(e => e.type === ThinkingEventType.STEP_COMPLETED);
    const durations = stepEvents.map(e => e.metadata.duration || 0);

    return {
      averageStepTime: session.metadata.averageStepTime,
      fastestStep: Math.min(...durations),
      slowestStep: Math.max(...durations),
      totalThinkingTime: durations.reduce((sum, d) => sum + d, 0)
    };
  }

  private analyzePatterns(session: ThinkingSession): any {
    const eventTypes = session.events.map(e => e.type);
    const typeFrequency = eventTypes.reduce((freq, type) => {
      freq[type] = (freq[type] || 0) + 1;
      return freq;
    }, {} as Record<string, number>);

    return {
      eventFrequency: typeFrequency,
      mostCommonEvent: Object.keys(typeFrequency).reduce((a, b) => 
        typeFrequency[a] > typeFrequency[b] ? a : b
      ),
      userInteractionRate: session.metadata.userInteractions / session.events.length
    };
  }

  private generateRecommendations(session: ThinkingSession): string[] {
    const recommendations: string[] = [];

    if (session.metadata.averageStepTime > 60000) { // 超过1分钟
      recommendations.push('考虑将复杂步骤分解为更小的子步骤');
    }

    if (session.metadata.userInteractions / session.metadata.totalSteps < 0.3) {
      recommendations.push('增加更多用户交互点以提高参与度');
    }

    if (session.branches.length === 0) {
      recommendations.push('考虑在关键决策点创建分支以探索不同方案');
    }

    return recommendations;
  }

  private exportToCSV(session: ThinkingSession): string {
    const headers = ['EventID', 'Type', 'Timestamp', 'Duration', 'Confidence', 'Data'];
    const rows = session.events.map(event => [
      event.id,
      event.type,
      event.timestamp.toISOString(),
      event.metadata.duration || '',
      event.metadata.confidence || '',
      JSON.stringify(event.data)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private exportToMarkdown(session: ThinkingSession): string {
    let markdown = `# Thinking Process: ${session.title}\n\n`;
    markdown += `**Session ID**: ${session.id}\n`;
    markdown += `**Duration**: ${session.metadata.totalDuration}ms\n`;
    markdown += `**Events**: ${session.events.length}\n\n`;

    markdown += `## Timeline\n\n`;
    for (const event of session.events) {
      markdown += `### ${event.type} - ${event.timestamp.toISOString()}\n`;
      markdown += `${JSON.stringify(event.data, null, 2)}\n\n`;
    }

    return markdown;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${++this.eventCounter}_${Date.now()}`;
  }

  private generateBranchId(): string {
    return `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
