import express from 'express';
import cors from 'cors';
import { Server as HttpServer } from 'http';
import { defaultLogger as logger } from '../utils/logger.js';

export interface McpHttpServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  corsOrigins?: string[];
  timeout: number;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * MCP over HTTP Server Transport
 * Implements the Model Context Protocol over HTTP for multi-platform compatibility
 */
export class McpHttpServer {
  private app: express.Application;
  private server?: HttpServer;
  private config: McpHttpServerConfig;
  private requestHandlers: Map<string, (params: any) => Promise<any>> = new Map();
  private notificationHandlers: Map<string, (params: any) => void> = new Map();

  constructor(config: McpHttpServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    if (this.config.enableCors) {
      const corsOptions = {
        origin: this.config.corsOrigins || '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
      };
      this.app.use(cors(corsOptions));
    }

    // JSON parsing with size limit
    this.app.use(express.json({ limit: '10mb' }));

    // Request timeout
    this.app.use((req, res, next) => {
      res.setTimeout(this.config.timeout, () => {
        res.status(408).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Request timeout'
          }
        });
      });
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`MCP HTTP Request: ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        protocol: 'MCP over HTTP',
        version: '2024-11-05',
        timestamp: new Date().toISOString(),
        server: {
          host: this.config.host,
          port: this.config.port
        }
      });
    });

    // MCP protocol endpoint
    this.app.post('/mcp', async (req, res) => {
      try {
        const mcpRequest = req.body as McpRequest;

        // Validate MCP request format
        if (!this.isValidMcpRequest(mcpRequest)) {
          res.status(400).json({
            jsonrpc: '2.0',
            id: (mcpRequest as any)?.id || null,
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: 'Request must be a valid JSON-RPC 2.0 message'
            }
          });
          return;
        }

        // Handle the request
        const response = await this.handleMcpRequest(mcpRequest);
        res.json(response);

      } catch (error) {
        logger.error('MCP HTTP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });

    // Batch MCP requests
    this.app.post('/mcp/batch', async (req, res) => {
      try {
        const requests = req.body as McpRequest[];

        if (!Array.isArray(requests)) {
          res.status(400).json({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: 'Batch request must be an array'
            }
          });
          return;
        }

        const responses = await Promise.all(
          requests.map(request => this.handleMcpRequest(request))
        );

        res.json(responses);
      } catch (error) {
        logger.error('MCP HTTP batch request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    });

    // Server capabilities endpoint
    this.app.get('/mcp/capabilities', (req, res) => {
      res.json({
        jsonrpc: '2.0',
        result: {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
            logging: {}
          },
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'open-search-mcp',
            version: '1.0.0'
          }
        }
      });
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('MCP HTTP Server Error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32601,
          message: 'Method not found',
          data: `Endpoint ${req.method} ${req.path} not found`
        }
      });
    });
  }

  private isValidMcpRequest(request: any): request is McpRequest {
    return (
      request &&
      typeof request === 'object' &&
      request.jsonrpc === '2.0' &&
      typeof request.method === 'string'
    );
  }

  private async handleMcpRequest(request: McpRequest): Promise<McpResponse> {
    try {
      // Check if it's a notification (no id)
      if (request.id === undefined) {
        const handler = this.notificationHandlers.get(request.method);
        if (handler) {
          handler(request.params);
        }
        // Notifications don't return responses
        return {} as McpResponse;
      }

      // Handle request
      const handler = this.requestHandlers.get(request.method);
      if (!handler) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Method '${request.method}' is not supported`
          }
        };
      }

      const result = await handler(request.params);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };

    } catch (error) {
      logger.error(`Error handling MCP method '${request.method}':`, error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Register a handler for MCP requests
   */
  public onRequest(method: string, handler: (params: any) => Promise<any>): void {
    this.requestHandlers.set(method, handler);
    logger.debug(`Registered MCP request handler for method: ${method}`);
  }

  /**
   * Register a handler for MCP notifications
   */
  public onNotification(method: string, handler: (params: any) => void): void {
    this.notificationHandlers.set(method, handler);
    logger.debug(`Registered MCP notification handler for method: ${method}`);
  }

  /**
   * Start the HTTP server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          logger.info(`MCP HTTP Server started on ${this.config.host}:${this.config.port}`);
          logger.info(`Health check: http://${this.config.host}:${this.config.port}/health`);
          logger.info(`MCP endpoint: http://${this.config.host}:${this.config.port}/mcp`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('MCP HTTP Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('MCP HTTP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server information
   */
  public getServerInfo() {
    return {
      host: this.config.host,
      port: this.config.port,
      protocol: 'HTTP',
      endpoints: {
        health: '/health',
        mcp: '/mcp',
        batch: '/mcp/batch',
        capabilities: '/mcp/capabilities'
      }
    };
  }
}
