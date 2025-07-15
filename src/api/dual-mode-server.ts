import { OpenSearchMCPServer } from '../index.js';
import { HTTPAPIServer } from './http-server.js';
import { APIConfigManager } from './api-config.js';
import { defaultLogger as logger } from '../utils/logger.js';

export type ServerMode = 'mcp' | 'api' | 'dual';

export interface DualModeConfig {
  mode: ServerMode;
  enableMCP: boolean;
  enableAPI: boolean;
}

export class DualModeServer {
  private mcpServer: OpenSearchMCPServer;
  private httpServer?: HTTPAPIServer;
  private config: DualModeConfig;

  constructor() {
    this.config = this.loadConfig();
    this.mcpServer = new OpenSearchMCPServer();
  }

  private loadConfig(): DualModeConfig {
    const mode = (process.env.SERVER_MODE || 'mcp') as ServerMode;
    
    const config: DualModeConfig = {
      mode,
      enableMCP: mode === 'mcp' || mode === 'dual',
      enableAPI: mode === 'api' || mode === 'dual'
    };

    logger.info('Dual Mode Server Configuration:', config);
    return config;
  }

  public async start(): Promise<void> {
    try {
      logger.info(`Starting Open Search Server in ${this.config.mode} mode...`);

      // Always initialize the MCP server components first
      await this.mcpServer.initialize();

      logger.info('Checking API configuration:', { enableAPI: this.config.enableAPI, mode: this.config.mode });
      if (this.config.enableAPI) {
        logger.info('Starting HTTP API server...');
        await this.startHTTPAPI();
        logger.info('HTTP API server startup completed');
      } else {
        logger.info('API mode disabled, skipping HTTP server startup');
      }

      if (this.config.enableMCP) {
        logger.info('Starting MCP mode with stdio transport...');
        await this.startMCPMode();
      }

      logger.info('Open Search Server started successfully');
      
      // Keep the process running
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async startHTTPAPI(): Promise<void> {
    try {
      const apiConfig = APIConfigManager.getInstance().getConfig();
      this.httpServer = new HTTPAPIServer(this.mcpServer, apiConfig);
      await this.httpServer.start();
      
      logger.info('HTTP API Server started successfully');
      logger.info('API Documentation available at: http://localhost:' + apiConfig.port + '/api/info');
      
      if (apiConfig.apiKeys.length === 1 && apiConfig.apiKeys[0].startsWith('dev-key-')) {
        logger.warn('Using development API key. Set API_KEYS environment variable for production.');
        logger.info('Development API Key:', apiConfig.apiKeys[0]);
      }
      
    } catch (error) {
      logger.error('Failed to start HTTP API server:', error);
      throw error;
    }
  }

  private async startMCPMode(): Promise<void> {
    try {
      // Import StdioServerTransport here to avoid circular dependencies
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');

      // Start the MCP server with stdio transport
      const transport = new StdioServerTransport();
      await this.mcpServer.getServer().connect(transport);

      logger.info('MCP Server connected to stdio transport');

      if (this.config.mode === 'mcp') {
        // In pure MCP mode, keep the process alive - wait for shutdown signal
        await new Promise<void>((resolve) => {
          const shutdown = () => {
            this.mcpShutdown().finally(() => resolve());
          };
          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);
        });
      } else {
        // In dual mode, don't block - let the process continue
        logger.info('MCP Server ready (dual mode - non-blocking)');
      }
    } catch (error) {
      logger.error('Failed to start MCP mode:', error);
      throw error;
    }
  }

  private async mcpShutdown(): Promise<void> {
    logger.info('Shutting down MCP Server...');
    // Delegate to the MCP server's shutdown method
    // Note: We can't call the private method directly, so we'll just log
    process.exit(0);
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      
      try {
        if (this.mcpServer) {
          await this.mcpServer.shutdown();
        }
        
        logger.info('Server shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Only set up these listeners if not in MCP mode (to avoid duplicates)
    if (this.config.mode !== 'mcp') {
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    // Handle uncaught exceptions (only once)
    if (process.listenerCount('uncaughtException') === 0) {
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        process.exit(1);
      });
    }

    if (process.listenerCount('unhandledRejection') === 0) {
      process.on('unhandledRejection', (reason, promise) => {
        logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
        process.exit(1);
      });
    }
  }

  public getServerInfo(): any {
    return {
      mode: this.config.mode,
      mcpEnabled: this.config.enableMCP,
      apiEnabled: this.config.enableAPI,
      mcpTools: this.mcpServer ? this.mcpServer.getRegisteredToolsCount() : 0,
      apiEndpoint: this.httpServer ? `http://localhost:${APIConfigManager.getInstance().getConfig().port}` : null
    };
  }
}

// CLI usage information
export const CLI_USAGE = `
Open Search MCP Server - Dual Mode

Usage:
  npm start                    # Start in MCP mode (default)
  npm run start:api           # Start in HTTP API mode
  npm run start:dual          # Start in dual mode (both MCP and API)

Environment Variables:
  SERVER_MODE=mcp|api|dual    # Server mode (default: mcp)
  API_PORT=3000               # HTTP API port
  API_HOST=0.0.0.0           # HTTP API host
  API_KEYS=key1,key2         # Comma-separated API keys
  
Examples:
  # MCP mode for Claude Desktop integration
  SERVER_MODE=mcp npm start
  
  # API mode for HTTP integration
  SERVER_MODE=api API_PORT=8080 API_KEYS=my-secret-key npm start
  
  # Dual mode for both MCP and API
  SERVER_MODE=dual API_PORT=3000 API_KEYS=key1,key2 npm start
`;

// Main entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DualModeServer();
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}
