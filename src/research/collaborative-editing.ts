/**
 * Collaborative Editing - 协作编辑管理器
 * 
 * 核心功能：
 * - 多用户实时协作
 * - 冲突检测和解决
 * - 操作同步
 * - 权限管理
 * - 版本控制
 */

import { InteractiveThoughtMap, ThoughtMapEvent } from './interactive-thought-map.js';
import { ThoughtNode, ThoughtNodeStatus } from './thought-node.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * 用户角色枚举
 */
export enum UserRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  COMMENTER = 'commenter'
}

/**
 * 操作类型枚举
 */
export enum OperationType {
  NODE_CREATE = 'node_create',
  NODE_UPDATE = 'node_update',
  NODE_DELETE = 'node_delete',
  NODE_MOVE = 'node_move',
  STATUS_CHANGE = 'status_change',
  CURSOR_MOVE = 'cursor_move',
  SELECTION_CHANGE = 'selection_change'
}

/**
 * 协作用户接口
 */
export interface CollaborativeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isOnline: boolean;
  lastSeen: Date;
  cursor?: {
    nodeId: string;
    position: { x: number; y: number };
  };
  selection?: string[]; // 选中的节点ID列表
  color: string; // 用户标识颜色
}

/**
 * 协作操作接口
 */
export interface CollaborativeOperation {
  id: string;
  type: OperationType;
  userId: string;
  timestamp: Date;
  data: any;
  metadata: {
    nodeId?: string;
    previousValue?: any;
    newValue?: any;
    conflictResolution?: string;
  };
}

/**
 * 冲突检测结果
 */
export interface ConflictDetection {
  hasConflict: boolean;
  conflictType: 'concurrent_edit' | 'version_mismatch' | 'permission_denied' | 'node_deleted';
  conflictingOperations: CollaborativeOperation[];
  resolution: 'merge' | 'reject' | 'manual';
  mergedResult?: any;
}

/**
 * 协作会话接口
 */
export interface CollaborativeSession {
  id: string;
  thoughtMapId: string;
  owner: string;
  participants: CollaborativeUser[];
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  settings: {
    allowAnonymous: boolean;
    maxParticipants: number;
    autoSave: boolean;
    conflictResolution: 'auto' | 'manual';
  };
}

/**
 * 协作编辑管理器类
 */
export class CollaborativeEditingManager extends EventEmitter {
  private logger: Logger;
  private sessions: Map<string, CollaborativeSession> = new Map();
  private operations: Map<string, CollaborativeOperation[]> = new Map();
  private thoughtMaps: Map<string, InteractiveThoughtMap> = new Map();
  private operationCounter: number = 0;

  constructor() {
    super();
    this.logger = new Logger('CollaborativeEditingManager');
  }

  /**
   * 创建协作会话
   */
  createSession(
    thoughtMapId: string,
    owner: CollaborativeUser,
    settings?: Partial<CollaborativeSession['settings']>
  ): string {
    const sessionId = this.generateSessionId();
    
    const session: CollaborativeSession = {
      id: sessionId,
      thoughtMapId,
      owner: owner.id,
      participants: [owner],
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      settings: {
        allowAnonymous: false,
        maxParticipants: 10,
        autoSave: true,
        conflictResolution: 'auto',
        ...settings
      }
    };

    this.sessions.set(sessionId, session);
    this.operations.set(sessionId, []);

    this.logger.info(`Created collaborative session: ${sessionId}`);
    this.emit('sessionCreated', session);

    return sessionId;
  }

  /**
   * 加入协作会话
   */
  joinSession(sessionId: string, user: CollaborativeUser): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 检查权限和限制
    if (!this.canJoinSession(session, user)) {
      return false;
    }

    // 添加用户到会话
    const existingUserIndex = session.participants.findIndex(p => p.id === user.id);
    if (existingUserIndex >= 0) {
      // 更新现有用户信息
      session.participants[existingUserIndex] = { ...user, isOnline: true };
    } else {
      // 添加新用户
      session.participants.push({ ...user, isOnline: true });
    }

    session.lastActivity = new Date();

    this.logger.info(`User ${user.id} joined session: ${sessionId}`);
    this.emit('userJoined', sessionId, user);

    return true;
  }

  /**
   * 离开协作会话
   */
  leaveSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const userIndex = session.participants.findIndex(p => p.id === userId);
    if (userIndex >= 0) {
      session.participants[userIndex].isOnline = false;
      session.participants[userIndex].lastSeen = new Date();
    }

    session.lastActivity = new Date();

    this.logger.info(`User ${userId} left session: ${sessionId}`);
    this.emit('userLeft', sessionId, userId);

    // 如果没有在线用户，标记会话为非活跃
    const onlineUsers = session.participants.filter(p => p.isOnline);
    if (onlineUsers.length === 0) {
      session.isActive = false;
    }
  }

  /**
   * 执行协作操作
   */
  async executeOperation(
    sessionId: string,
    userId: string,
    type: OperationType,
    data: any
  ): Promise<CollaborativeOperation> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const user = session.participants.find(p => p.id === userId);
    if (!user) {
      throw new Error(`User ${userId} not in session`);
    }

    // 检查权限
    if (!this.hasPermission(user, type)) {
      throw new Error(`User ${userId} does not have permission for ${type}`);
    }

    const operation: CollaborativeOperation = {
      id: this.generateOperationId(),
      type,
      userId,
      timestamp: new Date(),
      data,
      metadata: {}
    };

    // 冲突检测
    const conflictResult = await this.detectConflicts(sessionId, operation);
    if (conflictResult.hasConflict) {
      operation.metadata.conflictResolution = await this.resolveConflict(
        sessionId,
        operation,
        conflictResult
      );
    }

    // 执行操作
    await this.applyOperation(sessionId, operation);

    // 记录操作
    const sessionOperations = this.operations.get(sessionId) || [];
    sessionOperations.push(operation);
    this.operations.set(sessionId, sessionOperations);

    // 更新会话活动时间
    session.lastActivity = new Date();

    this.logger.debug(`Executed operation: ${type} by user ${userId}`);
    this.emit('operationExecuted', sessionId, operation);

    return operation;
  }

  /**
   * 同步操作到其他用户
   */
  syncOperation(sessionId: string, operation: CollaborativeOperation): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // 向所有在线用户（除了操作发起者）广播操作
    const onlineUsers = session.participants.filter(
      p => p.isOnline && p.id !== operation.userId
    );

    for (const user of onlineUsers) {
      this.emit('operationSync', sessionId, user.id, operation);
    }
  }

  /**
   * 更新用户光标位置
   */
  updateUserCursor(
    sessionId: string,
    userId: string,
    nodeId: string,
    position: { x: number; y: number }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const user = session.participants.find(p => p.id === userId);
    if (user) {
      user.cursor = { nodeId, position };
      this.emit('cursorUpdated', sessionId, userId, user.cursor);
    }
  }

  /**
   * 更新用户选择
   */
  updateUserSelection(sessionId: string, userId: string, selectedNodeIds: string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const user = session.participants.find(p => p.id === userId);
    if (user) {
      user.selection = selectedNodeIds;
      this.emit('selectionUpdated', sessionId, userId, selectedNodeIds);
    }
  }

  /**
   * 获取会话信息
   */
  getSession(sessionId: string): CollaborativeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取会话操作历史
   */
  getSessionOperations(sessionId: string): CollaborativeOperation[] {
    return this.operations.get(sessionId) || [];
  }

  /**
   * 获取在线用户
   */
  getOnlineUsers(sessionId: string): CollaborativeUser[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.participants.filter(p => p.isOnline);
  }

  /**
   * 私有方法
   */
  private canJoinSession(session: CollaborativeSession, user: CollaborativeUser): boolean {
    // 检查最大参与者限制
    const onlineCount = session.participants.filter(p => p.isOnline).length;
    if (onlineCount >= session.settings.maxParticipants) {
      return false;
    }

    // 检查匿名用户权限
    if (!session.settings.allowAnonymous && !user.email) {
      return false;
    }

    return true;
  }

  private hasPermission(user: CollaborativeUser, operationType: OperationType): boolean {
    switch (user.role) {
      case UserRole.OWNER:
        return true;
      case UserRole.EDITOR:
        return ![OperationType.NODE_DELETE].includes(operationType);
      case UserRole.COMMENTER:
        return [OperationType.CURSOR_MOVE, OperationType.SELECTION_CHANGE].includes(operationType);
      case UserRole.VIEWER:
        return [OperationType.CURSOR_MOVE, OperationType.SELECTION_CHANGE].includes(operationType);
      default:
        return false;
    }
  }

  private async detectConflicts(
    sessionId: string,
    operation: CollaborativeOperation
  ): Promise<ConflictDetection> {
    const sessionOperations = this.operations.get(sessionId) || [];
    const recentOperations = sessionOperations.filter(
      op => Date.now() - op.timestamp.getTime() < 5000 // 5秒内的操作
    );

    const conflictingOps = recentOperations.filter(op => 
      op.metadata.nodeId === operation.metadata.nodeId &&
      op.userId !== operation.userId &&
      op.type === operation.type
    );

    if (conflictingOps.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'concurrent_edit',
        conflictingOperations: conflictingOps,
        resolution: 'merge'
      };
    }

    return {
      hasConflict: false,
      conflictType: 'concurrent_edit',
      conflictingOperations: [],
      resolution: 'merge'
    };
  }

  private async resolveConflict(
    sessionId: string,
    operation: CollaborativeOperation,
    conflict: ConflictDetection
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return 'reject';
    }

    switch (session.settings.conflictResolution) {
      case 'auto':
        return this.autoResolveConflict(operation, conflict);
      case 'manual':
        return await this.requestManualResolution(sessionId, operation, conflict);
      default:
        return 'reject';
    }
  }

  private autoResolveConflict(
    operation: CollaborativeOperation,
    conflict: ConflictDetection
  ): string {
    // 简单的自动解决策略：最后操作获胜
    const latestConflictOp = conflict.conflictingOperations.reduce((latest, op) =>
      op.timestamp > latest.timestamp ? op : latest
    );

    if (operation.timestamp > latestConflictOp.timestamp) {
      return 'accept';
    } else {
      return 'merge';
    }
  }

  private async requestManualResolution(
    sessionId: string,
    operation: CollaborativeOperation,
    conflict: ConflictDetection
  ): Promise<string> {
    // 发出冲突解决请求事件
    this.emit('conflictResolutionRequired', sessionId, operation, conflict);
    
    // 在实际实现中，这里会等待用户输入
    // 现在返回默认解决方案
    return 'merge';
  }

  private async applyOperation(sessionId: string, operation: CollaborativeOperation): Promise<void> {
    const thoughtMap = this.thoughtMaps.get(sessionId);
    if (!thoughtMap) {
      return;
    }

    switch (operation.type) {
      case OperationType.NODE_CREATE:
        const { title, content, type, parentId } = operation.data;
        thoughtMap.addNode(title, content, type, undefined, parentId);
        break;

      case OperationType.NODE_UPDATE:
        const { nodeId, updates } = operation.data;
        if (updates.content) {
          thoughtMap.updateNodeContent(nodeId, updates.content, updates.summary);
        }
        break;

      case OperationType.NODE_DELETE:
        thoughtMap.removeNode(operation.data.nodeId);
        break;

      case OperationType.NODE_MOVE:
        thoughtMap.moveNode(operation.data.nodeId, operation.data.newParentId);
        break;

      case OperationType.STATUS_CHANGE:
        thoughtMap.updateNodeStatus(operation.data.nodeId, operation.data.status);
        break;
    }

    // 同步操作到其他用户
    this.syncOperation(sessionId, operation);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${++this.operationCounter}_${Date.now()}`;
  }

  /**
   * 导出会话数据
   */
  exportSession(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    const operations = this.operations.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return {
      session,
      operations,
      exportedAt: new Date()
    };
  }

  /**
   * 清理非活跃会话
   */
  cleanupInactiveSessions(maxAgeMs: number = 86400000): void { // 24小时
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session.isActive || (now - session.lastActivity.getTime()) > maxAgeMs) {
        this.sessions.delete(sessionId);
        this.operations.delete(sessionId);
        this.thoughtMaps.delete(sessionId);
        
        this.logger.info(`Cleaned up inactive session: ${sessionId}`);
      }
    }
  }

  /**
   * 获取会话统计
   */
  getSessionStats(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    const operations = this.operations.get(sessionId) || [];

    if (!session) {
      return null;
    }

    const onlineUsers = session.participants.filter(p => p.isOnline);
    const operationsByUser = operations.reduce((stats, op) => {
      stats[op.userId] = (stats[op.userId] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    return {
      sessionId,
      duration: Date.now() - session.createdAt.getTime(),
      totalParticipants: session.participants.length,
      onlineParticipants: onlineUsers.length,
      totalOperations: operations.length,
      operationsByUser,
      lastActivity: session.lastActivity
    };
  }
}
