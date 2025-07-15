/**
 * Tool Registry - Central registry for all MCP tools
 * 
 * This registry manages 200+ specialized search tools designed for
 * Function Calling concurrency. Each tool handles a specific source
 * or search domain to enable parallel execution by AI models.
 */

import { Logger } from '../utils/logger.js';
import { SearchOptions, ToolInput, ToolOutput } from '../types.js';

// Import debug tools
import { ocrHealthCheckTool, executeOCRHealthCheck } from './debug/ocr-health-check.js';

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  source: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  cacheTTL?: number; // Cache time-to-live in seconds
  rateLimit?: number; // Requests per minute
  execute: (args: ToolInput) => Promise<ToolOutput>;
}

export interface ToolCategory {
  name: string;
  description: string;
  tools: MCPTool[];
}

export class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private categories: Map<string, ToolCategory> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ToolRegistry');
  }

  /**
   * Register a single tool
   */
  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool already registered: ${tool.name}`);
      return;
    }

    // Validate tool structure
    if (!this.validateTool(tool)) {
      throw new Error(`Invalid tool structure: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
    this.addToCategory(tool);
    
    this.logger.debug(`Registered tool: ${tool.name} (${tool.category})`);
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: MCPTool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): MCPTool[] {
    const categoryData = this.categories.get(category);
    return categoryData ? categoryData.tools : [];
  }

  /**
   * Get all categories
   */
  getCategories(): ToolCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Get total tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Get tools by source
   */
  getToolsBySource(source: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.source === source);
  }

  /**
   * Search tools by name or description
   */
  searchTools(query: string): MCPTool[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tools.values()).filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.category.toLowerCase().includes(lowerQuery) ||
      tool.source.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    categoriesCount: number;
    toolsByCategory: Record<string, number>;
    toolsBySource: Record<string, number>;
  } {
    const toolsByCategory: Record<string, number> = {};
    const toolsBySource: Record<string, number> = {};

    for (const tool of this.tools.values()) {
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;
      toolsBySource[tool.source] = (toolsBySource[tool.source] || 0) + 1;
    }

    return {
      totalTools: this.tools.size,
      categoriesCount: this.categories.size,
      toolsByCategory,
      toolsBySource,
    };
  }

  /**
   * Validate tool structure
   */
  private validateTool(tool: MCPTool): boolean {
    if (!tool.name || typeof tool.name !== 'string') {
      this.logger.error('Tool name is required and must be a string');
      return false;
    }

    if (!tool.description || typeof tool.description !== 'string') {
      this.logger.error('Tool description is required and must be a string');
      return false;
    }

    if (!tool.category || typeof tool.category !== 'string') {
      this.logger.error('Tool category is required and must be a string');
      return false;
    }

    if (!tool.source || typeof tool.source !== 'string') {
      this.logger.error('Tool source is required and must be a string');
      return false;
    }

    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      this.logger.error('Tool inputSchema is required and must be an object');
      return false;
    }

    if (!tool.execute || typeof tool.execute !== 'function') {
      this.logger.error('Tool execute function is required');
      return false;
    }

    return true;
  }

  /**
   * Add tool to category
   */
  private addToCategory(tool: MCPTool): void {
    let category = this.categories.get(tool.category);
    
    if (!category) {
      category = {
        name: tool.category,
        description: `${tool.category} search tools`,
        tools: [],
      };
      this.categories.set(tool.category, category);
    }

    category.tools.push(tool);
  }

  /**
   * Remove a tool
   */
  removeTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) {
      return false;
    }

    this.tools.delete(name);
    
    // Remove from category
    const category = this.categories.get(tool.category);
    if (category) {
      category.tools = category.tools.filter(t => t.name !== name);
      if (category.tools.length === 0) {
        this.categories.delete(tool.category);
      }
    }

    this.logger.debug(`Removed tool: ${name}`);
    return true;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.categories.clear();
    this.logger.info('Cleared all tools from registry');
  }

  /**
   * Export registry data
   */
  export(): {
    tools: MCPTool[];
    categories: ToolCategory[];
    stats: any;
  } {
    return {
      tools: this.getAllTools(),
      categories: this.getCategories(),
      stats: this.getStats(),
    };
  }

  /**
   * Get tools optimized for Function Calling
   * Returns tools grouped by their execution characteristics
   */
  getFunctionCallingOptimizedTools(): {
    fast: MCPTool[];      // < 2 seconds
    medium: MCPTool[];    // 2-5 seconds  
    slow: MCPTool[];      // > 5 seconds
  } {
    const fast: MCPTool[] = [];
    const medium: MCPTool[] = [];
    const slow: MCPTool[] = [];

    for (const tool of this.tools.values()) {
      // Categorize based on expected execution time
      // This helps AI models optimize their Function Calling strategy
      if (tool.source.includes('api') || tool.source.includes('cache')) {
        fast.push(tool);
      } else if (tool.source.includes('crawl') || tool.source.includes('pdf')) {
        slow.push(tool);
      } else {
        medium.push(tool);
      }
    }

    return { fast, medium, slow };
  }
}

/**
 * Helper function to create a standardized tool
 */
export function createTool(
  name: string,
  description: string,
  category: string,
  source: string,
  execute: (args: ToolInput) => Promise<ToolOutput>,
  options: {
    cacheTTL?: number;
    rateLimit?: number;
    requiredParams?: string[];
    optionalParams?: string[];
  } = {}
): MCPTool {
  const { cacheTTL = 3600, rateLimit = 60, requiredParams = ['query'], optionalParams = [] } = options;

  const properties: Record<string, any> = {
    query: {
      type: 'string',
      description: 'Search query or topic',
    },
  };

  // Add optional parameters
  for (const param of optionalParams) {
    switch (param) {
      case 'numResults':
        properties.numResults = {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        };
        break;
      case 'maxCharacters':
        properties.maxCharacters = {
          type: 'number',
          description: 'Maximum characters to extract from each result',
          default: 5000,
        };
        break;
      case 'includeContent':
        properties.includeContent = {
          type: 'boolean',
          description: 'Whether to include full content extraction',
          default: true,
        };
        break;
    }
  }

  return {
    name,
    description,
    category,
    source,
    cacheTTL,
    rateLimit,
    inputSchema: {
      type: 'object',
      properties,
      required: requiredParams,
    },
    execute,
  };
}
