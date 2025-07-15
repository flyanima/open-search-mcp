/**
 * ThoughtNode - 思维节点数据结构
 * 
 * 核心功能：
 * - 支持层级关系管理
 * - 节点状态跟踪
 * - 元数据存储
 * - 思维过程记录
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 思维节点状态枚举
 */
export enum ThoughtNodeStatus {
  PENDING = 'pending',           // 待处理
  PROCESSING = 'processing',     // 处理中
  COMPLETED = 'completed',       // 已完成
  FAILED = 'failed',            // 失败
  SKIPPED = 'skipped',          // 跳过
  WAITING_USER = 'waiting_user'  // 等待用户输入
}

/**
 * 思维节点类型枚举
 */
export enum ThoughtNodeType {
  ROOT = 'root',                 // 根节点
  QUESTION = 'question',         // 问题节点
  HYPOTHESIS = 'hypothesis',     // 假设节点
  SEARCH = 'search',            // 搜索节点
  ANALYSIS = 'analysis',        // 分析节点
  CONCLUSION = 'conclusion',    // 结论节点
  DECISION_POINT = 'decision_point', // 决策点
  USER_INPUT = 'user_input'     // 用户输入节点
}

/**
 * 思维节点优先级
 */
export enum ThoughtNodePriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * 思维节点元数据接口
 */
export interface ThoughtNodeMetadata {
  // 时间信息
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // 执行信息
  executionTime?: number;       // 执行时间（毫秒）
  retryCount?: number;          // 重试次数
  errorMessage?: string;        // 错误信息
  
  // 用户交互
  userFeedback?: string;        // 用户反馈
  userRating?: number;          // 用户评分 (1-5)
  
  // 搜索相关
  searchQuery?: string;         // 搜索查询
  searchResults?: number;       // 搜索结果数量
  searchSources?: string[];     // 搜索来源
  
  // 分析相关
  confidence?: number;          // 置信度 (0-1)
  relevance?: number;          // 相关性 (0-1)
  quality?: number;            // 质量评分 (0-1)
  
  // 扩展属性
  tags?: string[];             // 标签
  category?: string;           // 分类
  customData?: Record<string, any>; // 自定义数据
}

/**
 * 思维节点接口
 */
export interface IThoughtNode {
  id: string;
  type: ThoughtNodeType;
  status: ThoughtNodeStatus;
  priority: ThoughtNodePriority;
  
  // 内容
  title: string;
  content: string;
  summary?: string;
  
  // 层级关系
  parentId?: string;
  childIds: string[];
  depth: number;
  
  // 元数据
  metadata: ThoughtNodeMetadata;
  
  // 方法
  addChild(childId: string): void;
  removeChild(childId: string): void;
  updateStatus(status: ThoughtNodeStatus): void;
  updateContent(content: string, summary?: string): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  setCustomData(key: string, value: any): void;
  getCustomData(key: string): any;
}

/**
 * 思维节点实现类
 */
export class ThoughtNode implements IThoughtNode {
  public id: string;
  public type: ThoughtNodeType;
  public status: ThoughtNodeStatus;
  public priority: ThoughtNodePriority;
  
  public title: string;
  public content: string;
  public summary?: string;
  
  public parentId?: string;
  public childIds: string[] = [];
  public depth: number;
  
  public metadata: ThoughtNodeMetadata;

  constructor(
    title: string,
    content: string,
    type: ThoughtNodeType = ThoughtNodeType.ANALYSIS,
    priority: ThoughtNodePriority = ThoughtNodePriority.MEDIUM,
    parentId?: string
  ) {
    this.id = uuidv4();
    this.type = type;
    this.status = ThoughtNodeStatus.PENDING;
    this.priority = priority;
    
    this.title = title;
    this.content = content;
    
    this.parentId = parentId;
    this.depth = parentId ? 1 : 0; // 将在添加到图中时重新计算
    
    this.metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      customData: {}
    };
  }

  /**
   * 添加子节点
   */
  addChild(childId: string): void {
    if (!this.childIds.includes(childId)) {
      this.childIds.push(childId);
      this.metadata.updatedAt = new Date();
    }
  }

  /**
   * 移除子节点
   */
  removeChild(childId: string): void {
    const index = this.childIds.indexOf(childId);
    if (index > -1) {
      this.childIds.splice(index, 1);
      this.metadata.updatedAt = new Date();
    }
  }

  /**
   * 更新状态
   */
  updateStatus(status: ThoughtNodeStatus): void {
    const oldStatus = this.status;
    this.status = status;
    this.metadata.updatedAt = new Date();
    
    // 记录状态变化的时间戳
    switch (status) {
      case ThoughtNodeStatus.PROCESSING:
        this.metadata.startedAt = new Date();
        break;
      case ThoughtNodeStatus.COMPLETED:
      case ThoughtNodeStatus.FAILED:
      case ThoughtNodeStatus.SKIPPED:
        this.metadata.completedAt = new Date();
        if (this.metadata.startedAt) {
          this.metadata.executionTime = 
            this.metadata.completedAt.getTime() - this.metadata.startedAt.getTime();
        }
        break;
    }
  }

  /**
   * 更新内容
   */
  updateContent(content: string, summary?: string): void {
    this.content = content;
    if (summary !== undefined) {
      this.summary = summary;
    }
    this.metadata.updatedAt = new Date();
  }

  /**
   * 添加标签
   */
  addTag(tag: string): void {
    if (!this.metadata.tags) {
      this.metadata.tags = [];
    }
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
      this.metadata.updatedAt = new Date();
    }
  }

  /**
   * 移除标签
   */
  removeTag(tag: string): void {
    if (this.metadata.tags) {
      const index = this.metadata.tags.indexOf(tag);
      if (index > -1) {
        this.metadata.tags.splice(index, 1);
        this.metadata.updatedAt = new Date();
      }
    }
  }

  /**
   * 设置自定义数据
   */
  setCustomData(key: string, value: any): void {
    if (!this.metadata.customData) {
      this.metadata.customData = {};
    }
    this.metadata.customData[key] = value;
    this.metadata.updatedAt = new Date();
  }

  /**
   * 获取自定义数据
   */
  getCustomData(key: string): any {
    return this.metadata.customData?.[key];
  }

  /**
   * 设置深度
   */
  setDepth(depth: number): void {
    this.depth = depth;
  }

  /**
   * 设置搜索相关元数据
   */
  setSearchMetadata(query: string, resultCount: number, sources: string[]): void {
    this.metadata.searchQuery = query;
    this.metadata.searchResults = resultCount;
    this.metadata.searchSources = sources;
    this.metadata.updatedAt = new Date();
  }

  /**
   * 设置分析相关元数据
   */
  setAnalysisMetadata(confidence: number, relevance: number, quality: number): void {
    this.metadata.confidence = Math.max(0, Math.min(1, confidence));
    this.metadata.relevance = Math.max(0, Math.min(1, relevance));
    this.metadata.quality = Math.max(0, Math.min(1, quality));
    this.metadata.updatedAt = new Date();
  }

  /**
   * 设置用户反馈
   */
  setUserFeedback(feedback: string, rating?: number): void {
    this.metadata.userFeedback = feedback;
    if (rating !== undefined) {
      this.metadata.userRating = Math.max(1, Math.min(5, rating));
    }
    this.metadata.updatedAt = new Date();
  }

  /**
   * 设置错误信息
   */
  setError(errorMessage: string): void {
    this.metadata.errorMessage = errorMessage;
    this.metadata.retryCount = (this.metadata.retryCount || 0) + 1;
    this.updateStatus(ThoughtNodeStatus.FAILED);
  }

  /**
   * 转换为JSON
   */
  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      priority: this.priority,
      title: this.title,
      content: this.content,
      summary: this.summary,
      parentId: this.parentId,
      childIds: this.childIds,
      depth: this.depth,
      metadata: this.metadata
    };
  }

  /**
   * 从JSON创建节点
   */
  static fromJSON(data: any): ThoughtNode {
    const node = new ThoughtNode(
      data.title,
      data.content,
      data.type,
      data.priority,
      data.parentId
    );
    
    node.id = data.id;
    node.status = data.status;
    node.summary = data.summary;
    node.childIds = data.childIds || [];
    node.depth = data.depth || 0;
    node.metadata = {
      ...data.metadata,
      createdAt: new Date(data.metadata.createdAt),
      updatedAt: new Date(data.metadata.updatedAt),
      startedAt: data.metadata.startedAt ? new Date(data.metadata.startedAt) : undefined,
      completedAt: data.metadata.completedAt ? new Date(data.metadata.completedAt) : undefined
    };
    
    return node;
  }

  /**
   * 克隆节点
   */
  clone(): ThoughtNode {
    return ThoughtNode.fromJSON(this.toJSON());
  }

  /**
   * 获取节点的简要信息
   */
  getBrief(): string {
    return `[${this.type}] ${this.title} (${this.status})`;
  }

  /**
   * 检查节点是否可以执行
   */
  canExecute(): boolean {
    return this.status === ThoughtNodeStatus.PENDING || 
           this.status === ThoughtNodeStatus.WAITING_USER;
  }

  /**
   * 检查节点是否已完成
   */
  isCompleted(): boolean {
    return this.status === ThoughtNodeStatus.COMPLETED || 
           this.status === ThoughtNodeStatus.SKIPPED;
  }

  /**
   * 检查节点是否失败
   */
  isFailed(): boolean {
    return this.status === ThoughtNodeStatus.FAILED;
  }
}
