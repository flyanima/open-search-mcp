/**
 * InteractiveThoughtMap - 交互式思维导图核心类
 * 
 * 核心功能：
 * - 思维节点管理（增删改查）
 * - 层级关系维护
 * - 状态同步和事件通知
 * - 思维导图序列化/反序列化
 * - 实时更新和协作支持
 */

import { ThoughtNode, ThoughtNodeType, ThoughtNodeStatus, ThoughtNodePriority } from './thought-node.js';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';

/**
 * 思维导图事件类型
 */
export enum ThoughtMapEvent {
  NODE_ADDED = 'node_added',
  NODE_REMOVED = 'node_removed',
  NODE_UPDATED = 'node_updated',
  NODE_STATUS_CHANGED = 'node_status_changed',
  RELATIONSHIP_ADDED = 'relationship_added',
  RELATIONSHIP_REMOVED = 'relationship_removed',
  MAP_CLEARED = 'map_cleared',
  MAP_LOADED = 'map_loaded'
}

/**
 * 思维导图统计信息
 */
export interface ThoughtMapStats {
  totalNodes: number;
  nodesByType: Record<ThoughtNodeType, number>;
  nodesByStatus: Record<ThoughtNodeStatus, number>;
  maxDepth: number;
  avgExecutionTime: number;
  completionRate: number;
}

/**
 * 思维导图搜索选项
 */
export interface ThoughtMapSearchOptions {
  type?: ThoughtNodeType;
  status?: ThoughtNodeStatus;
  priority?: ThoughtNodePriority;
  tags?: string[];
  content?: string;
  depth?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * 交互式思维导图类
 */
export class InteractiveThoughtMap extends EventEmitter {
  private nodes: Map<string, ThoughtNode> = new Map();
  private rootNodeId?: string;
  private logger: Logger;
  private version: number = 1;
  private lastModified: Date;

  constructor() {
    super();
    this.logger = new Logger('InteractiveThoughtMap');
    this.lastModified = new Date();
  }

  /**
   * 添加节点
   */
  addNode(
    title: string,
    content: string,
    type: ThoughtNodeType = ThoughtNodeType.ANALYSIS,
    priority: ThoughtNodePriority = ThoughtNodePriority.MEDIUM,
    parentId?: string
  ): ThoughtNode {
    const node = new ThoughtNode(title, content, type, priority, parentId);
    
    // 设置根节点
    if (type === ThoughtNodeType.ROOT || !parentId) {
      if (!this.rootNodeId) {
        this.rootNodeId = node.id;
        node.setDepth(0);
      }
    }
    
    // 建立父子关系
    if (parentId) {
      const parentNode = this.nodes.get(parentId);
      if (parentNode) {
        parentNode.addChild(node.id);
        node.setDepth(parentNode.depth + 1);
      } else {
        throw new Error(`Parent node ${parentId} not found`);
      }
    }
    
    this.nodes.set(node.id, node);
    this.updateVersion();
    
    this.logger.debug(`Added node: ${node.getBrief()}`);
    this.emit(ThoughtMapEvent.NODE_ADDED, node);
    
    return node;
  }

  /**
   * 移除节点（递归移除子节点）
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    
    // 递归移除所有子节点
    const childIds = [...node.childIds];
    for (const childId of childIds) {
      this.removeNode(childId);
    }
    
    // 从父节点中移除引用
    if (node.parentId) {
      const parentNode = this.nodes.get(node.parentId);
      if (parentNode) {
        parentNode.removeChild(nodeId);
      }
    }
    
    // 如果是根节点，清空根节点引用
    if (this.rootNodeId === nodeId) {
      this.rootNodeId = undefined;
    }
    
    this.nodes.delete(nodeId);
    this.updateVersion();
    
    this.logger.debug(`Removed node: ${node.getBrief()}`);
    this.emit(ThoughtMapEvent.NODE_REMOVED, node);
    
    return true;
  }

  /**
   * 获取节点
   */
  getNode(nodeId: string): ThoughtNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取根节点
   */
  getRootNode(): ThoughtNode | undefined {
    return this.rootNodeId ? this.nodes.get(this.rootNodeId) : undefined;
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): ThoughtNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取子节点
   */
  getChildren(nodeId: string): ThoughtNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return [];
    }
    
    return node.childIds
      .map(childId => this.nodes.get(childId))
      .filter(child => child !== undefined) as ThoughtNode[];
  }

  /**
   * 获取父节点
   */
  getParent(nodeId: string): ThoughtNode | undefined {
    const node = this.nodes.get(nodeId);
    return node?.parentId ? this.nodes.get(node.parentId) : undefined;
  }

  /**
   * 获取节点路径（从根到指定节点）
   */
  getNodePath(nodeId: string): ThoughtNode[] {
    const path: ThoughtNode[] = [];
    let currentNode = this.nodes.get(nodeId);
    
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentId ? this.nodes.get(currentNode.parentId) : undefined;
    }
    
    return path;
  }

  /**
   * 获取叶子节点
   */
  getLeafNodes(): ThoughtNode[] {
    return Array.from(this.nodes.values()).filter(node => node.childIds.length === 0);
  }

  /**
   * 更新节点状态
   */
  updateNodeStatus(nodeId: string, status: ThoughtNodeStatus): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    
    const oldStatus = node.status;
    node.updateStatus(status);
    this.updateVersion();
    
    this.logger.debug(`Updated node status: ${nodeId} ${oldStatus} -> ${status}`);
    this.emit(ThoughtMapEvent.NODE_STATUS_CHANGED, node, oldStatus, status);
    this.emit(ThoughtMapEvent.NODE_UPDATED, node);
    
    return true;
  }

  /**
   * 更新节点内容
   */
  updateNodeContent(nodeId: string, content: string, summary?: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    
    node.updateContent(content, summary);
    this.updateVersion();
    
    this.logger.debug(`Updated node content: ${nodeId}`);
    this.emit(ThoughtMapEvent.NODE_UPDATED, node);
    
    return true;
  }

  /**
   * 移动节点到新父节点
   */
  moveNode(nodeId: string, newParentId?: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    
    // 移除旧的父子关系
    if (node.parentId) {
      const oldParent = this.nodes.get(node.parentId);
      if (oldParent) {
        oldParent.removeChild(nodeId);
      }
    }
    
    // 建立新的父子关系
    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (!newParent) {
        return false;
      }
      
      // 检查是否会形成循环
      if (this.wouldCreateCycle(nodeId, newParentId)) {
        return false;
      }
      
      newParent.addChild(nodeId);
      node.parentId = newParentId;
      node.setDepth(newParent.depth + 1);
    } else {
      node.parentId = undefined;
      node.setDepth(0);
    }
    
    // 更新所有子节点的深度
    this.updateChildrenDepth(nodeId);
    this.updateVersion();
    
    this.logger.debug(`Moved node: ${nodeId} to parent: ${newParentId || 'root'}`);
    this.emit(ThoughtMapEvent.RELATIONSHIP_ADDED, node, newParentId);
    
    return true;
  }

  /**
   * 搜索节点
   */
  searchNodes(options: ThoughtMapSearchOptions): ThoughtNode[] {
    const results: ThoughtNode[] = [];
    
    for (const node of this.nodes.values()) {
      let matches = true;
      
      // 类型过滤
      if (options.type && node.type !== options.type) {
        matches = false;
      }
      
      // 状态过滤
      if (options.status && node.status !== options.status) {
        matches = false;
      }
      
      // 优先级过滤
      if (options.priority && node.priority !== options.priority) {
        matches = false;
      }
      
      // 深度过滤
      if (options.depth !== undefined && node.depth !== options.depth) {
        matches = false;
      }
      
      // 标签过滤
      if (options.tags && options.tags.length > 0) {
        const nodeTags = node.metadata.tags || [];
        const hasAllTags = options.tags.every(tag => nodeTags.includes(tag));
        if (!hasAllTags) {
          matches = false;
        }
      }
      
      // 内容过滤
      if (options.content) {
        const searchText = options.content.toLowerCase();
        const nodeText = `${node.title} ${node.content}`.toLowerCase();
        if (!nodeText.includes(searchText)) {
          matches = false;
        }
      }
      
      // 日期范围过滤
      if (options.dateRange) {
        const nodeDate = node.metadata.createdAt;
        if (nodeDate < options.dateRange.start || nodeDate > options.dateRange.end) {
          matches = false;
        }
      }
      
      if (matches) {
        results.push(node);
      }
    }
    
    return results;
  }

  /**
   * 获取统计信息
   */
  getStats(): ThoughtMapStats {
    const nodes = Array.from(this.nodes.values());
    
    const nodesByType: Record<ThoughtNodeType, number> = {} as any;
    const nodesByStatus: Record<ThoughtNodeStatus, number> = {} as any;
    
    // 初始化计数器
    Object.values(ThoughtNodeType).forEach(type => {
      nodesByType[type] = 0;
    });
    Object.values(ThoughtNodeStatus).forEach(status => {
      nodesByStatus[status] = 0;
    });
    
    let maxDepth = 0;
    let totalExecutionTime = 0;
    let executionCount = 0;
    let completedCount = 0;
    
    for (const node of nodes) {
      nodesByType[node.type]++;
      nodesByStatus[node.status]++;
      
      maxDepth = Math.max(maxDepth, node.depth);
      
      if (node.metadata.executionTime) {
        totalExecutionTime += node.metadata.executionTime;
        executionCount++;
      }
      
      if (node.isCompleted()) {
        completedCount++;
      }
    }
    
    return {
      totalNodes: nodes.length,
      nodesByType,
      nodesByStatus,
      maxDepth,
      avgExecutionTime: executionCount > 0 ? totalExecutionTime / executionCount : 0,
      completionRate: nodes.length > 0 ? completedCount / nodes.length : 0
    };
  }

  /**
   * 清空思维导图
   */
  clear(): void {
    this.nodes.clear();
    this.rootNodeId = undefined;
    this.updateVersion();
    
    this.logger.debug('Cleared thought map');
    this.emit(ThoughtMapEvent.MAP_CLEARED);
  }

  /**
   * 序列化为JSON
   */
  toJSON(): any {
    return {
      version: this.version,
      lastModified: this.lastModified.toISOString(),
      rootNodeId: this.rootNodeId,
      nodes: Array.from(this.nodes.values()).map(node => node.toJSON())
    };
  }

  /**
   * 从JSON反序列化
   */
  static fromJSON(data: any): InteractiveThoughtMap {
    const map = new InteractiveThoughtMap();
    
    map.version = data.version || 1;
    map.lastModified = new Date(data.lastModified);
    map.rootNodeId = data.rootNodeId;
    
    // 重建节点
    for (const nodeData of data.nodes) {
      const node = ThoughtNode.fromJSON(nodeData);
      map.nodes.set(node.id, node);
    }
    
    map.emit(ThoughtMapEvent.MAP_LOADED, map);
    return map;
  }

  /**
   * 检查是否会形成循环
   */
  private wouldCreateCycle(nodeId: string, potentialParentId: string): boolean {
    let currentId = potentialParentId;
    
    while (currentId) {
      if (currentId === nodeId) {
        return true;
      }
      
      const currentNode = this.nodes.get(currentId);
      currentId = currentNode?.parentId || '';
    }
    
    return false;
  }

  /**
   * 更新子节点深度
   */
  private updateChildrenDepth(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    
    for (const childId of node.childIds) {
      const child = this.nodes.get(childId);
      if (child) {
        child.setDepth(node.depth + 1);
        this.updateChildrenDepth(childId);
      }
    }
  }

  /**
   * 更新版本号
   */
  private updateVersion(): void {
    this.version++;
    this.lastModified = new Date();
  }

  /**
   * 获取版本信息
   */
  getVersion(): { version: number; lastModified: Date } {
    return {
      version: this.version,
      lastModified: this.lastModified
    };
  }

  /**
   * 获取节点数量
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * 检查节点是否存在
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }
}
