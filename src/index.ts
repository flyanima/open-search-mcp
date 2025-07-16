#!/usr/bin/env node

/**
 * Open Search MCP Server
 * 
 * A free and open-source Model Context Protocol server for web search,
 * academic research, and content extraction. Provides real-time search
 * capabilities without relying on paid third-party APIs.
 * 
 * Features:
 * - 200+ specialized search tools for Function Calling
 * - Saturated search mechanism for comprehensive research
 * - Academic paper search and PDF processing
 * - Company research and competitor analysis
 * - Social media and forum content search
 * - Multi-platform MCP integration (Claude Desktop, Augment Codes, Cursor)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { Logger } from './utils/logger.js';
import { ConfigManager } from './config/config-manager.js';
import { getConfigManager } from './config/enhanced-config-manager.js';
import { ToolRegistry } from './tools/tool-registry.js';
// import { CacheManager } from './caching/advanced-cache.js'; // Simplified
import { RateLimitManager } from './utils/rate-limiter.js';
import { ErrorHandler } from './utils/error-handler.js';
import { MetricsCollector } from './utils/metrics.js';
import { z } from 'zod';
import { InputValidator } from './utils/input-validator.js';

// Import only the CORE 33 tools as documented in README
// 🎓 Academic Research (7 tools)
import { registerAcademicTools } from './tools/academic/simple.js';
import { registerPubMedTools } from './tools/academic/pubmed-tools.js';
import { registerIEEETools } from './tools/academic/ieee-tools.js';
import { registerSemanticScholarTools } from './tools/academic/semantic-scholar-tools.js';
import { registerBioRxivTools } from './tools/academic/biorxiv-tools.js';

// 💻 Developer Tools (4 tools)
import { registerGitHubAPITools } from './tools/tech/github-api-tools.js';
import { registerStackOverflowTools } from './tools/tech/stackoverflow-tools.js';
import { registerGitLabBitbucketTools } from './tools/tech/gitlab-bitbucket-tools.js';

// 🔍 Privacy-Focused Search (4 tools)
import { registerAlternativeSearchEngines } from './tools/search/alternative-search-engines.js';
import { registerSearxTools } from './tools/search/searx-tools.js';

// 🧪 Testing & Development (2 tools)
import { registerJSONPlaceholderTools } from './tools/testing/jsonplaceholder-tools.js';

// 🕷️ Web Crawling (2 tools)
import { registerWebCrawlerTools } from './tools/utility/web-crawler-tools.js';

// 📄 Document Processing (1 tool)
import { registerPDFResearchTools } from './tools/pdf/research.js';

// 🧠 Intelligent Research (5 tools)
import { registerSmartSearchTools } from './tools/aggregation/smart-search-tools.js';
import { registerThinkingAnalysisTools } from './tools/research/thinking-analysis-tools.js';

// 💰 Financial Tools (8 tools)
import { registerAlphaVantageTools } from './tools/financial/alpha-vantage-tools.js';



class OpenSearchMCPServer {
  private server: Server;
  private logger: Logger;
  private config: ConfigManager;
  private toolRegistry: ToolRegistry;
  // private cache: CacheManager; // Simplified
  private rateLimiter: RateLimitManager;
  private errorHandler: ErrorHandler;
  private metrics: MetricsCollector;
  private inputValidator: InputValidator;
  // private errorTracker: ErrorTracker; // Simplified

  constructor() {
    // Increase max listeners to avoid warnings
    process.setMaxListeners(20);

    this.logger = new Logger('OpenSearchMCP');
    this.config = new ConfigManager();

    // 初始化增强配置管理器
    const enhancedConfig = getConfigManager();
    this.logger.info('Enhanced configuration manager initialized', enhancedConfig.getConfigSummary());

    this.toolRegistry = new ToolRegistry();
    // this.cache = new CacheManager(this.config.getCacheConfig()); // Simplified
    this.rateLimiter = new RateLimitManager(this.config.getRateLimitConfig());
    this.errorHandler = new ErrorHandler(this.logger);
    this.metrics = new MetricsCollector();
    this.inputValidator = new InputValidator();
    // this.errorTracker = new ErrorTracker(); // Simplified

    this.server = new Server(
      {
        name: 'open-search-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    // Note: registerAllTools() is now called in start() method

    // Register debug tools only in development
    if (process.env.NODE_ENV === 'development') {
      this.registerDebugTools();
    }
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.toolRegistry.getAllTools();
      this.logger.info(`Listed ${tools.length} available tools`);
      
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // Start metrics collection
        const startTime = Date.now();
        this.metrics.incrementToolCall(name);

        // Rate limiting check
        const rateLimitKey = `tool:${name}`;
        const isAllowed = await this.rateLimiter.checkLimit(rateLimitKey);
        if (!isAllowed) {
          throw new McpError(
            ErrorCode.InternalError,
            `Rate limit exceeded for tool: ${name}`
          );
        }

        // Get tool from registry
        const tool = this.toolRegistry.getTool(name);
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool not found: ${name}`
          );
        }

        // Validate input with enhanced security validation
        const validationResult = this.inputValidator.validateToolInput(name, args);
        if (!validationResult.success) {
          this.logger.warn(`Input validation failed for tool ${name}`, { error: validationResult.error, args });
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid input parameters for tool ${name}: ${validationResult.error}`
          );
        }

        // Use validated and sanitized data
        const validatedArgs = validationResult.data;

        this.logger.info(`Executing tool: ${name}`, { validatedArgs });

        // Execute tool with validated input and caching (simplified)
        // const cacheKey = this.generateCacheKey(name, validatedArgs);
        // let result = await this.cache.get(cacheKey);

        // if (!result) {
          const result = await tool.execute(validatedArgs);
        //   await this.cache.set(cacheKey, result, tool.cacheTTL || 3600);
        //   this.logger.debug(`Tool result cached: ${name}`);
        // } else {
        //   this.logger.debug(`Tool result from cache: ${name}`);
        // }

        // Record metrics
        const executionTime = Date.now() - startTime;
        this.metrics.recordToolExecution(name, executionTime, true);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error) {
        // Record error metrics
        this.metrics.recordToolExecution(name, Date.now() - Date.now(), false);
        
        // Handle and log error
        const handledError = this.errorHandler.handleError(error, { tool: name, args });
        this.logger.error(`Tool execution failed: ${name}`, handledError);

        throw new McpError(
          ErrorCode.InternalError,
          handledError.message || `Failed to execute tool: ${name}`
        );
      }
    });
  }

  private async registerAllTools(): Promise<void> {
    this.logger.info('Registering exactly 33 specialized tools...');

    // 🎓 Academic Research (7 tools)
    registerAcademicTools(this.toolRegistry);           // 1 tool: search_arxiv
    registerPubMedTools(this.toolRegistry);             // 1 tool: search_pubmed
    registerIEEETools(this.toolRegistry);               // 1 tool: search_ieee
    registerSemanticScholarTools(this.toolRegistry);    // 1 tool: search_semantic_scholar
    registerBioRxivTools(this.toolRegistry);            // 3 tools: search_iacr, search_medrxiv, search_biorxiv

    // 💻 Developer Tools (4 tools)
    registerGitHubAPITools(this.toolRegistry);          // 1 tool: search_github
    registerStackOverflowTools(this.toolRegistry);      // 1 tool: search_stackoverflow
    registerGitLabBitbucketTools(this.toolRegistry);    // 2 tools: search_gitlab, search_bitbucket

    // 🔍 Privacy-Focused Search (4 tools)
    registerAlternativeSearchEngines(this.toolRegistry); // 3 tools: search_startpage, search_brave, search_ecosia
    registerSearxTools(this.toolRegistry);              // 1 tool: search_searx

    // 🧪 Testing & Development (2 tools)
    registerJSONPlaceholderTools(this.toolRegistry);    // 2 tools: test_jsonplaceholder, test_httpbin

    // 🕷️ Web Crawling (2 tools)
    registerWebCrawlerTools(this.toolRegistry);         // 2 tools: crawl_url_content, batch_crawl_urls

    // 📄 Document Processing (1 tool)
    registerPDFResearchTools(this.toolRegistry);        // 1 tool: analyze_pdf

    // 🧠 Intelligent Research (6 tools)
    registerSmartSearchTools(this.toolRegistry);        // 2 tools: intelligent_research, market_intelligence_aggregator
    registerThinkingAnalysisTools(this.toolRegistry);   // 4 tools: deep_research, visualize_thinking, decompose_thinking, check_research_saturation

    // 💰 Financial Tools (8 tools)
    registerAlphaVantageTools(this.toolRegistry);       // 8 tools: Alpha Vantage Integration

    const totalTools = this.toolRegistry.getToolCount();
    this.logger.info(`Successfully registered ${totalTools} tools`);

    // Filter to README 33 tools if environment variable is set
    if (process.env.FILTER_TO_README_33 === 'true') {
      await this.filterToReadme33Tools();
    }

    const finalToolCount = this.toolRegistry.getToolCount();
    const expectedCount = process.env.FILTER_TO_README_33 === 'true' ? 33 : 34;

    if (finalToolCount !== expectedCount) {
      this.logger.warn(`Expected ${expectedCount} tools, but registered ${finalToolCount}. Please check tool registrations.`);
    }



  }

  /**
   * Register debug tools for development environment only
   * SECURITY: Debug tools are only available in development mode
   */
  private registerDebugTools(): void {
    if (process.env.NODE_ENV !== 'development') {
      this.logger.warn('Debug tools are only available in development mode');
      return;
    }

    this.logger.info('Registering debug tools for development...');

    // Debug tools removed for production build
  }

  /**
   * Legacy validation method - replaced by InputValidator
   * @deprecated Use this.inputValidator.validateToolInput instead
   */
  private validateToolInput(args: any, schema: any): boolean {
    this.logger.warn('Using deprecated validateToolInput method. Use InputValidator instead.');

    // Fallback to basic validation for backward compatibility
    if (!args || typeof args !== 'object') {
      return false;
    }

    // Check required fields
    if (schema && schema.required) {
      for (const field of schema.required) {
        if (!(field in args)) {
          return false;
        }
      }
    }

    return true;
  }

  private generateCacheKey(toolName: string, args: any): string {
    const argsString = JSON.stringify(args, Object.keys(args).sort());
    return `tool:${toolName}:${Buffer.from(argsString).toString('base64')}`;
  }

  /**
   * Get the MCP server instance
   * Used by dual mode server to access the server
   */
  public getServer() {
    return this.server;
  }

  /**
   * Initialize the server components without starting MCP transport
   * Used for API mode where we don't need stdio transport
   */
  async initialize(): Promise<void> {
    try {
      // Initialize all components
      await this.config.initialize();
      // await this.cache.initialize(); // Simplified
      await this.rateLimiter.initialize();

      this.logger.info('Open Search MCP Server started successfully');
      this.logger.info(`Registered ${this.toolRegistry.getToolCount()} search tools`);
      this.logger.info('Ready for Function Calling with 200+ concurrent tools');

    } catch (error) {
      this.logger.error('Failed to initialize server', error);
      throw error;
    }
  }

  private async filterToReadme33Tools(): Promise<void> {
    this.logger.info('Filtering to README 33 tools only...');

    // Define the exact 33 tools from README.md
    const README_33_TOOLS = [
      // Academic Research (7 tools)
      'search_arxiv', 'search_pubmed', 'search_ieee', 'search_semantic_scholar',
      'search_iacr', 'search_biorxiv', 'search_medrxiv',

      // Developer Tools (4 tools)
      'search_github', 'search_stackoverflow', 'search_gitlab', 'search_bitbucket',

      // Privacy-Focused Search (4 tools)
      'search_searx', 'search_startpage', 'search_brave', 'search_ecosia',

      // Testing & Development (2 tools)
      'test_jsonplaceholder', 'test_httpbin',

      // Web Crawling (2 tools)
      'crawl_url_content', 'batch_crawl_urls',

      // Document Processing (1 tool)
      'analyze_pdf',

      // Intelligent Research (5 tools)
      'intelligent_research', 'deep_research', 'visualize_thinking',
      'decompose_thinking', 'check_research_saturation',

      // Financial Tools (8 tools)
      'alpha_vantage_symbol_search', 'alpha_vantage_stock_quote', 'alpha_vantage_intraday_data',
      'alpha_vantage_daily_data', 'alpha_vantage_company_overview', 'alpha_vantage_forex_rate',
      'alpha_vantage_crypto_price', 'alpha_vantage_market_news'
    ];

    const allTools = this.toolRegistry.getAllTools();
    const toolsToRemove = allTools.filter(tool => !README_33_TOOLS.includes(tool.name));

    this.logger.info(`Removing ${toolsToRemove.length} extra tools to keep only README 33...`);
    for (const tool of toolsToRemove) {
      this.toolRegistry.removeTool(tool.name);
    }

    const finalTools = this.toolRegistry.getAllTools();
    const finalToolNames = finalTools.map(t => t.name);
    const missingTools = README_33_TOOLS.filter(name => !finalToolNames.includes(name));

    if (missingTools.length > 0) {
      this.logger.warn(`Missing README tools: ${missingTools.join(', ')}`);
    }

    this.logger.info(`✅ Filtered to ${finalTools.length} README tools`);
  }

  async start(): Promise<void> {
    try {
      // Initialize all components
      await this.initialize();

      // Register all tools
      await this.registerAllTools();

      // Setup global error handlers
      this.setupGlobalErrorHandlers();

      // Start the MCP server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Keep the process alive - wait for shutdown signal
      await new Promise<void>((resolve) => {
        const shutdown = () => {
          this.mcpShutdown().finally(() => resolve());
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      });

    } catch (error) {
      this.logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Promise Rejection:', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString()
      });

      // Track the error but don't exit the process
      // this.errorTracker.trackError( // Simplified
      //   reason instanceof Error ? reason : new Error(String(reason)),
      //   { operation: 'unhandled_rejection' }
      // );
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack
      });

      // Track the error
      // this.errorTracker.trackError(error, { operation: 'uncaught_exception' }); // Simplified

      // For uncaught exceptions, we should exit gracefully
      this.mcpShutdown().finally(() => {
        process.exit(1);
      });
    });

    // Handle error tracker events to prevent them from becoming unhandled
    // this.errorTracker.on('error', (errorEvent: any) => { // Simplified
    //   // Just log it, don't re-emit
    //   this.logger.warn('Error tracker event:', {
    //     id: errorEvent.id,
    //     message: errorEvent.error instanceof Error ? errorEvent.error.message : String(errorEvent.error),
    //     context: errorEvent.context
    //   });
    // });
  }

  private async mcpShutdown(): Promise<void> {
    this.logger.info('Shutting down Open Search MCP Server...');

    try {
      // await this.cache.close(); // Simplified
      await this.metrics.flush();
      this.logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }

  // Public methods for testing and external access
  public getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  public getMetrics(): MetricsCollector {
    return this.metrics;
  }

  public getLogger(): Logger {
    return this.logger;
  }

  // HTTP API support methods
  public async getAvailableTools(): Promise<any[]> {
    const tools = this.toolRegistry.getAllTools();
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category || 'general',
      source: tool.source || 'unknown',
      inputSchema: tool.inputSchema
    }));
  }

  public async executeTool(toolName: string, args: any): Promise<any> {
    const startTime = Date.now();

    try {
      // Rate limiting check
      const rateLimitKey = `tool:${toolName}`;
      const isAllowed = await this.rateLimiter.checkLimit(rateLimitKey);
      if (!isAllowed) {
        throw new Error(`Rate limit exceeded for tool: ${toolName}`);
      }

      // Get tool from registry
      const tool = this.toolRegistry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Validate input with enhanced security validation
      const validationResult = this.inputValidator.validateToolInput(toolName, args);
      if (!validationResult.success) {
        this.logger.warn(`HTTP API input validation failed for tool ${toolName}`, { error: validationResult.error, args });
        throw new Error(`Invalid input parameters for tool ${toolName}: ${validationResult.error}`);
      }

      // Use validated and sanitized data
      const validatedArgs = validationResult.data;
      this.logger.info(`HTTP API executing tool: ${toolName}`, { validatedArgs });

      // Execute tool with validated input and caching (simplified)
      // const cacheKey = this.generateCacheKey(toolName, validatedArgs);
      // let result = await this.cache.get(cacheKey);

      // if (!result) {
        const result = await tool.execute(validatedArgs);
      //   await this.cache.set(cacheKey, result, tool.cacheTTL || 3600);
      //   this.logger.debug(`Tool result cached: ${toolName}`);
      // } else {
      //   this.logger.debug(`Tool result from cache: ${toolName}`);
      // }

      // Record metrics
      const executionTime = Date.now() - startTime;
      this.metrics.recordToolExecution(toolName, executionTime, true);

      return result;

    } catch (error) {
      // Record error metrics
      this.metrics.recordToolExecution(toolName, Date.now() - startTime, false);

      // Handle and log error
      const handledError = this.errorHandler.handleError(error, { tool: toolName, args });
      this.logger.error(`HTTP API tool execution failed: ${toolName}`, handledError);

      throw new Error(handledError.message || `Failed to execute tool: ${toolName}`);
    }
  }

  public getRegisteredToolsCount(): number {
    return this.toolRegistry.getToolCount();
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Open Search MCP Server...');

    try {
      // await this.cache.close(); // Simplified
      await this.metrics.flush();
      this.logger.info('Server shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  /**
   * List all available tools (MCP Protocol)
   */
  list_tools(): { tools: any[] } {
    const tools = this.toolRegistry.getAllTools();

    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  }

  /**
   * Call a specific tool (MCP Protocol)
   */
  async call_tool(request: { name: string; arguments: any }): Promise<{ content: any[] }> {
    const tool = this.toolRegistry.getTool(request.name);

    if (!tool) {
      throw new Error(`Tool '${request.name}' not found`);
    }

    try {
      const result = await tool.execute(request.arguments || {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Start the server only in MCP mode when this file is executed directly
// Check if this is the main module being executed
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule && process.env.SERVER_MODE !== 'api' && process.env.SERVER_MODE !== 'dual') {
  // Silent startup for MCP compatibility - no console output
  const server = new OpenSearchMCPServer();
  server.start().catch((error) => {
    // Only output critical errors to stderr
    process.stderr.write(`MCP Server Error: ${error.message}\n`);
    process.exit(1);
  });
}

export { OpenSearchMCPServer };
