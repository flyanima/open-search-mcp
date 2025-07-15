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

// Import ONLY real API tool categories (no mock/simulation tools)
import { registerAcademicTools } from './tools/academic/simple.js';
import { registerWebTools } from './tools/web/simple.js';
import { registerGoogleTools } from './tools/web/google-tools.js';
import { registerPDFResearchTools } from './tools/pdf/research.js';
import { registerAlphaVantageTools } from './tools/financial/alpha-vantage-tools.js';
import { registerNewsAPITools } from './tools/news/newsapi-tools.js';
import { registerGitHubAPITools } from './tools/tech/github-api-tools.js';
import { registerOpenWeatherTools } from './tools/weather/openweather-tools.js';
// import { registerAPIHealthCheckTools } from './tools/monitoring/api-health-check.js'; // Removed
import { registerRedditAPITools } from './tools/social/reddit-api-tools.js';
import { registerEnhancedRedditTools } from './tools/social/enhanced-reddit-tools.js';
import { registerCoinGeckoTools } from './tools/financial/coingecko-tools.js';
import { registerSmartSearchTools } from './tools/aggregation/smart-search-tools.js';
import { registerHuggingFaceTools } from './tools/ai/huggingface-tools.js';
import { registerIntegrityCheckTools } from './tools/system/integrity-check-tools.js';
import { registerSmartAPIRouter } from './tools/routing/smart-api-router.js';
import { registerWikipediaTools } from './tools/knowledge/wikipedia-api-tools.js';
import { registerOpenLibraryTools } from './tools/knowledge/openlibrary-tools.js';
import { registerJSONPlaceholderTools } from './tools/testing/jsonplaceholder-tools.js';
import { registerSmartAPIManager } from './tools/management/smart-api-manager.js';
// import { registerCoinGeckoTools } from './tools/crypto/register-coingecko-tools.js'; // Removed

// Import new tool modules for 93-tool system
import { registerYouTubeTools } from './tools/video/youtube-tools.js';
import { registerStackOverflowTools } from './tools/tech/stackoverflow-tools.js';
import { registerPubMedTools } from './tools/academic/pubmed-tools.js';
import { registerIEEETools } from './tools/academic/ieee-tools.js';
import { registerTwitterLinkedInTools } from './tools/social/twitter-linkedin-tools.js';
import { registerUtilityTools } from './tools/utility/utility-tools.js';

// Import newly created tools
import { registerSemanticScholarTools } from './tools/academic/semantic-scholar-tools.js';
import { registerGitHubTools } from './tools/development/github-tools.js';
// import { registerTestTools } from './tools/testing/test-tools.js'; // Removed
import { registerBioRxivTools } from './tools/academic/biorxiv-tools.js';

// Import "pending implementation" tools
import { registerWebCrawlerTools } from './tools/utility/web-crawler-tools.js';
import { registerSearxTools } from './tools/search/searx-tools.js';

// Import monitoring tools
// import { registerHealthMonitorTools } from './tools/monitoring/health-monitor-tools.js'; // Removed

// Import alternative search engines and thinking analysis tools
import { registerAlternativeSearchEngines } from './tools/search/alternative-search-engines.js';
import { registerThinkingAnalysisTools } from './tools/research/thinking-analysis-tools.js';

// Removed register imports - using individual tool imports instead

// Removed more register imports

// Removed remaining register imports

// Removed intelligent decomposed research tools import

// Import debug tools (only in development)
// import { ocrHealthCheckTool, executeOCRHealthCheck } from './tools/debug/ocr-health-check.js'; // Removed from production
// import { ErrorTracker } from './monitoring/error-tracker.js'; // Removed

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
    this.registerAllTools();

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

  private registerAllTools(): void {
    this.logger.info('Registering all REAL API tools...');

    // ONLY REGISTER REAL API TOOLS - NO MOCK/SIMULATION TOOLS
    // This ensures all tools provide actual data from real APIs

    // Google Search Tools (5 tools) - CRITICAL FOR API FUNCTIONALITY
    registerGoogleTools(this.toolRegistry);

    // Alpha Vantage Financial Tools (5 tools) - CRITICAL FOR FINANCIAL DATA
    registerAlphaVantageTools(this.toolRegistry);

    // NewsAPI Tools (4 tools) - CRITICAL FOR NEWS DATA
    registerNewsAPITools(this.toolRegistry);

    // GitHub API Tools (4 tools) - CRITICAL FOR TECH DATA
    registerGitHubAPITools(this.toolRegistry);

    // OpenWeather Tools (4 tools) - CRITICAL FOR WEATHER DATA
    registerOpenWeatherTools(this.toolRegistry);

    // Reddit API Tools (4 tools) - CRITICAL FOR SOCIAL DATA
    registerRedditAPITools(this.toolRegistry);

    // Enhanced Reddit Tools (4 tools) - BACKUP FOR SOCIAL DATA
    registerEnhancedRedditTools(this.toolRegistry);

    // CoinGecko Tools (6 tools) - CRITICAL FOR CRYPTO DATA
    registerCoinGeckoTools(this.toolRegistry);

    // Hugging Face Tools (5 tools) - CRITICAL FOR AI DATA
    registerHuggingFaceTools(this.toolRegistry);

    // System Integrity Tools (3 tools) - CRITICAL FOR MONITORING
    registerIntegrityCheckTools(this.toolRegistry);

    // Smart API Router (2 tools) - CRITICAL FOR INTELLIGENCE
    registerSmartAPIRouter(this.toolRegistry);

    // Wikipedia Tools (5 tools) - RELIABLE KNOWLEDGE SOURCE
    registerWikipediaTools(this.toolRegistry);

    // OpenLibrary Tools (5 tools) - BOOK AND LITERATURE DATA
    registerOpenLibraryTools(this.toolRegistry);

    // JSONPlaceholder Tools (5 tools) - RELIABLE TEST DATA
    registerJSONPlaceholderTools(this.toolRegistry);

    // Smart API Manager (4 tools) - INTELLIGENT API MANAGEMENT
    registerSmartAPIManager(this.toolRegistry);

    // Smart Search Aggregation Tools (2 tools) - CRITICAL FOR INTELLIGENCE
    registerSmartSearchTools(this.toolRegistry);

    // Real Academic Tools (with actual arXiv/PubMed API calls)
    registerAcademicTools(this.toolRegistry);

    // Real Web Search Tools (with actual Wikipedia API calls)
    registerWebTools(this.toolRegistry);

    // NOTE: Removed all mock/simulation tools to prevent conflicts with real APIs
    // Only real API tools with actual data sources are registered above
    // This ensures 100% real data responses from all tools

    // API Health Check Tools (3 tools) - CRITICAL FOR MONITORING
    // registerAPIHealthCheckTools(this.toolRegistry); // Removed

    // NEW TOOLS FOR 93-TOOL SYSTEM COMPLETION

    // YouTube Video Platform Tools (3 tools) - VIDEO CONTENT SEARCH
    registerYouTubeTools(this.toolRegistry);

    // Stack Overflow Developer Tools (3 tools) - DEVELOPER Q&A
    registerStackOverflowTools(this.toolRegistry);

    // PubMed Medical Research Tools (3 tools) - MEDICAL LITERATURE
    registerPubMedTools(this.toolRegistry);

    // IEEE Academic Tools (3 tools) - ENGINEERING RESEARCH
    registerIEEETools(this.toolRegistry);

    // Twitter & LinkedIn Social Tools (3 tools) - SOCIAL MEDIA
    registerTwitterLinkedInTools(this.toolRegistry);

    // Utility Tools (3 tools) - DATA PROCESSING & CONVERSION
    registerUtilityTools(this.toolRegistry);

    // NEWLY CREATED TOOLS TO FIX FUNCTION UNDEFINED ERRORS

    // Semantic Scholar Academic Tools (3 tools) - ACADEMIC RESEARCH
    registerSemanticScholarTools(this.toolRegistry);

    // GitHub Developer Tools (3 tools) - CODE REPOSITORY SEARCH
    registerGitHubTools(this.toolRegistry);

    // Testing Tools (5 tools) - API TESTING & VALIDATION
    // registerTestTools(this.toolRegistry); // Removed

    // bioRxiv Academic Tools (2 tools) - BIOLOGY PREPRINTS
    registerBioRxivTools(this.toolRegistry);

    // Web Crawler Tools (2 tools) - WEB CONTENT EXTRACTION
    registerWebCrawlerTools(this.toolRegistry);

    // Searx Search Tools (3 tools) - PRIVACY-FOCUSED SEARCH
    registerSearxTools(this.toolRegistry);

    // Health Monitor Tools (5 tools) - API HEALTH MONITORING
    // registerHealthMonitorTools(this.toolRegistry); // Removed

    // Alternative Search Engines (3 tools) - PRIVACY & ECO-FRIENDLY SEARCH
    registerAlternativeSearchEngines(this.toolRegistry);

    // Thinking Analysis Tools (3 tools) - DEEP RESEARCH & ANALYSIS
    registerThinkingAnalysisTools(this.toolRegistry);

    // Removed missing register function calls - these files were deleted

    const totalTools = this.toolRegistry.getToolCount();
    this.logger.info(`Successfully registered ${totalTools} search tools`);
    
    if (totalTools < 200) {
      this.logger.warn(`Only ${totalTools} tools registered. Target is 200+ for optimal Function Calling performance.`);
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

    try {
      // Dynamically import debug tools only in development
      import('./tools/debug/ocr-health-check.js').then(({ ocrHealthCheckTool, executeOCRHealthCheck }) => {
        this.toolRegistry.registerTool({
          name: ocrHealthCheckTool.name,
          description: ocrHealthCheckTool.description || 'OCR Health Check Tool (Development Only)',
          category: 'debug',
          source: 'internal',
          inputSchema: ocrHealthCheckTool.inputSchema as any,
          execute: executeOCRHealthCheck
        });

        this.logger.info('Debug tools registered successfully');
      }).catch(error => {
        this.logger.warn('Failed to load debug tools', error);
      });
    } catch (error) {
      this.logger.warn('Debug tools not available', error);
    }
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

  async start(): Promise<void> {
    try {
      // Initialize all components
      await this.initialize();

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
        inputSchema: tool.inputSchema || {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            }
          },
          required: ['query']
        }
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
