import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpHttpServer, McpHttpServerConfig } from './mcp-http-server.js';
import { McpWebSocketServer, McpWebSocketServerConfig } from './mcp-websocket-server.js';
import { defaultLogger as logger } from '../utils/logger.js';

export type TransportType = 'stdio' | 'http' | 'websocket';

export interface LaunchConfig {
  transport: TransportType;
  http?: McpHttpServerConfig;
  websocket?: McpWebSocketServerConfig;
  autoDetect?: boolean;
}

export interface McpServerAdapter {
  onRequest(method: string, handler: (params: any) => Promise<any>): void;
  onNotification(method: string, handler: (params: any) => void): void;
  start?(): Promise<void>;
  stop?(): Promise<void>;
  getInfo?(): any;
}

/**
 * Universal MCP Server Launcher
 * Supports multiple transport protocols for maximum platform compatibility
 */
export class McpLauncher {
  private config: LaunchConfig;
  private server?: McpServerAdapter;
  private requestHandlers: Map<string, (params: any) => Promise<any>> = new Map();
  private notificationHandlers: Map<string, (params: any) => void> = new Map();

  constructor(config: LaunchConfig) {
    this.config = config;
  }

  /**
   * Auto-detect the best transport based on environment
   */
  private detectTransport(): TransportType {
    // Check for HTTP environment variables
    if (process.env.MCP_HTTP_PORT || process.env.PORT) {
      return 'http';
    }

    // Check for WebSocket environment variables
    if (process.env.MCP_WS_PORT) {
      return 'websocket';
    }

    // Check if running in a web environment
    if (typeof window !== 'undefined') {
      return 'websocket';
    }

    // Check for specific platform indicators
    const platform = process.env.MCP_PLATFORM || '';
    switch (platform.toLowerCase()) {
      case 'cursor':
      case 'vscode':
      case 'claude':
        return 'stdio';
      case 'web':
      case 'browser':
        return 'websocket';
      case 'server':
      case 'api':
        return 'http';
      default:
        return 'stdio'; // Default fallback
    }
  }

  /**
   * Start the MCP server with the configured transport
   */
  public async start(): Promise<void> {
    const transport = this.config.autoDetect ? this.detectTransport() : this.config.transport;
    
    logger.info(`Starting MCP server with ${transport} transport`);

    switch (transport) {
      case 'stdio':
        await this.startStdio();
        break;
      case 'http':
        await this.startHttp();
        break;
      case 'websocket':
        await this.startWebSocket();
        break;
      default:
        throw new Error(`Unsupported transport type: ${transport}`);
    }

    logger.info(`MCP server started successfully with ${transport} transport`);
  }

  private async startStdio(): Promise<void> {
    // For stdio, we need to integrate with the existing MCP SDK
    // This is a placeholder - the actual implementation would integrate with your existing server
    logger.info('Starting MCP server with stdio transport');
    
    // Create a simple adapter for stdio
    this.server = {
      onRequest: (method: string, handler: (params: any) => Promise<any>) => {
        this.requestHandlers.set(method, handler);
      },
      onNotification: (method: string, handler: (params: any) => void) => {
        this.notificationHandlers.set(method, handler);
      }
    };

    // Note: Actual stdio implementation would be handled by the main server
    logger.info('Stdio transport configured - handlers registered');
  }

  private async startHttp(): Promise<void> {
    const httpConfig: McpHttpServerConfig = this.config.http || {
      port: parseInt(process.env.MCP_HTTP_PORT || process.env.PORT || '8000'),
      host: process.env.MCP_HTTP_HOST || 'localhost',
      enableCors: true,
      corsOrigins: process.env.MCP_CORS_ORIGINS?.split(','),
      timeout: 30000
    };

    const httpServer = new McpHttpServer(httpConfig);
    
    // Register existing handlers
    this.requestHandlers.forEach((handler, method) => {
      httpServer.onRequest(method, handler);
    });
    
    this.notificationHandlers.forEach((handler, method) => {
      httpServer.onNotification(method, handler);
    });

    await httpServer.start();
    this.server = httpServer;
  }

  private async startWebSocket(): Promise<void> {
    const wsConfig: McpWebSocketServerConfig = this.config.websocket || {
      port: parseInt(process.env.MCP_WS_PORT || '8001'),
      host: process.env.MCP_WS_HOST || 'localhost',
      maxConnections: parseInt(process.env.MCP_MAX_CONNECTIONS || '100'),
      heartbeatInterval: parseInt(process.env.MCP_HEARTBEAT_INTERVAL || '30000'),
      connectionTimeout: parseInt(process.env.MCP_CONNECTION_TIMEOUT || '60000')
    };

    const wsServer = new McpWebSocketServer(wsConfig);
    
    // Register existing handlers
    this.requestHandlers.forEach((handler, method) => {
      wsServer.onRequest(method, handler);
    });
    
    this.notificationHandlers.forEach((handler, method) => {
      wsServer.onNotification(method, handler);
    });

    await wsServer.start();
    this.server = wsServer;
  }

  /**
   * Register a request handler
   */
  public onRequest(method: string, handler: (params: any) => Promise<any>): void {
    this.requestHandlers.set(method, handler);
    if (this.server) {
      this.server.onRequest(method, handler);
    }
  }

  /**
   * Register a notification handler
   */
  public onNotification(method: string, handler: (params: any) => void): void {
    this.notificationHandlers.set(method, handler);
    if (this.server) {
      this.server.onNotification(method, handler);
    }
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    if (this.server && this.server.stop) {
      await this.server.stop();
    }
    logger.info('MCP server stopped');
  }

  /**
   * Get server information
   */
  public getServerInfo(): any {
    if (this.server && this.server.getInfo) {
      return this.server.getInfo();
    }
    return {
      transport: this.config.transport,
      status: 'running'
    };
  }

  /**
   * Create a launcher with auto-detection
   */
  public static createAutoDetect(): McpLauncher {
    return new McpLauncher({
      transport: 'stdio', // Will be overridden by auto-detect
      autoDetect: true
    });
  }

  /**
   * Create a launcher for a specific platform
   */
  public static createForPlatform(platform: string): McpLauncher {
    const configs: Record<string, LaunchConfig> = {
      'claude-desktop': {
        transport: 'stdio'
      },
      'cursor': {
        transport: 'stdio'
      },
      'vscode': {
        transport: 'stdio'
      },
      'windsurf': {
        transport: 'http',
        http: {
          port: 8000,
          host: 'localhost',
          enableCors: true,
          timeout: 30000
        }
      },
      'augment-code': {
        transport: 'websocket',
        websocket: {
          port: 8001,
          host: 'localhost',
          maxConnections: 50,
          heartbeatInterval: 30000,
          connectionTimeout: 60000
        }
      },
      'web': {
        transport: 'websocket',
        websocket: {
          port: 8001,
          host: '0.0.0.0',
          maxConnections: 100,
          heartbeatInterval: 30000,
          connectionTimeout: 60000
        }
      }
    };

    const config = configs[platform.toLowerCase()];
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return new McpLauncher(config);
  }

  /**
   * Get supported platforms
   */
  public static getSupportedPlatforms(): string[] {
    return [
      'claude-desktop',
      'cursor',
      'vscode',
      'windsurf',
      'augment-code',
      'web'
    ];
  }

  /**
   * Validate configuration
   */
  public static validateConfig(config: LaunchConfig): boolean {
    if (!config.transport) {
      return false;
    }

    switch (config.transport) {
      case 'http':
        return !!(config.http?.port && config.http?.host);
      case 'websocket':
        return !!(config.websocket?.port && config.websocket?.host);
      case 'stdio':
        return true;
      default:
        return false;
    }
  }
}
