import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { IncomingMessage } from 'http';
import { defaultLogger as logger } from '../utils/logger.js';

export interface McpWebSocketServerConfig {
  port: number;
  host: string;
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
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

interface ClientConnection {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * MCP over WebSocket Server Transport
 * Provides real-time bidirectional communication for MCP protocol
 */
export class McpWebSocketServer {
  private wss?: WebSocketServer;
  private httpServer?: HttpServer;
  private config: McpWebSocketServerConfig;
  private clients: Map<string, ClientConnection> = new Map();
  private requestHandlers: Map<string, (params: any) => Promise<any>> = new Map();
  private notificationHandlers: Map<string, (params: any) => void> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(config: McpWebSocketServerConfig) {
    this.config = config;
  }

  /**
   * Start the WebSocket server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server for WebSocket upgrade
        this.httpServer = new HttpServer();
        
        // Create WebSocket server
        this.wss = new WebSocketServer({
          server: this.httpServer,
          maxPayload: 10 * 1024 * 1024, // 10MB
          perMessageDeflate: true
        });

        this.setupWebSocketHandlers();
        this.startHeartbeat();

        this.httpServer.listen(this.config.port, this.config.host, () => {
          logger.info(`MCP WebSocket Server started on ws://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.httpServer.on('error', (error) => {
          logger.error('MCP WebSocket Server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      // Check connection limit
      if (this.clients.size >= this.config.maxConnections) {
        logger.warn('Connection rejected: maximum connections reached');
        ws.close(1013, 'Server overloaded');
        return;
      }

      const clientId = this.generateClientId();
      const client: ClientConnection = {
        ws,
        id: clientId,
        isAlive: true,
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      this.clients.set(clientId, client);
      logger.info(`Client connected: ${clientId} (${this.clients.size} total connections)`);

      // Setup client handlers
      ws.on('message', (data: Buffer | string) => this.handleMessage(client, data));
      ws.on('close', (code: number, reason: Buffer) => this.handleDisconnection(client, code, reason));
      ws.on('error', (error: Error) => this.handleError(client, error));
      ws.on('pong', () => {
        client.isAlive = true;
        client.lastActivity = new Date();
      });

      // Send welcome message
      this.sendToClient(client, {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
            logging: {}
          },
          serverInfo: {
            name: 'open-search-mcp',
            version: '1.0.0'
          }
        }
      });
    });

    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket Server error:', error);
    });
  }

  private async handleMessage(client: ClientConnection, data: Buffer | string): Promise<void> {
    try {
      client.lastActivity = new Date();
      
      const message = JSON.parse(data.toString());
      
      if (!this.isValidMcpMessage(message)) {
        this.sendError(client, null, -32600, 'Invalid Request', 'Message must be valid JSON-RPC 2.0');
        return;
      }

      const response = await this.handleMcpRequest(message);
      if (response && Object.keys(response).length > 0) {
        this.sendToClient(client, response);
      }

    } catch (error) {
      logger.error(`Error handling message from client ${client.id}:`, error);
      this.sendError(client, null, -32700, 'Parse error', 'Invalid JSON');
    }
  }

  private handleDisconnection(client: ClientConnection, code: number, reason: Buffer): void {
    this.clients.delete(client.id);
    logger.info(`Client disconnected: ${client.id} (code: ${code}, reason: ${reason.toString()}) (${this.clients.size} remaining)`);
  }

  private handleError(client: ClientConnection, error: Error): void {
    logger.error(`Client error ${client.id}:`, error);
  }

  private isValidMcpMessage(message: any): message is McpRequest {
    return (
      message &&
      typeof message === 'object' &&
      message.jsonrpc === '2.0' &&
      typeof message.method === 'string'
    );
  }

  private async handleMcpRequest(request: McpRequest): Promise<McpResponse | null> {
    try {
      // Handle notification (no id)
      if (request.id === undefined) {
        const handler = this.notificationHandlers.get(request.method);
        if (handler) {
          handler(request.params);
        }
        return null; // Notifications don't return responses
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

  private sendToClient(client: ClientConnection, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private sendError(client: ClientConnection, id: any, code: number, message: string, data?: any): void {
    this.sendToClient(client, {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.isAlive) {
          logger.info(`Terminating inactive client: ${client.id}`);
          client.ws.terminate();
          this.clients.delete(client.id);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, this.config.heartbeatInterval);
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
   * Broadcast notification to all connected clients
   */
  public broadcast(notification: McpNotification): void {
    const message = JSON.stringify(notification);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    });
  }

  /**
   * Send notification to specific client
   */
  public sendToClientById(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Stop the WebSocket server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }

      // Close all client connections
      this.clients.forEach((client) => {
        client.ws.close(1001, 'Server shutting down');
      });
      this.clients.clear();

      if (this.wss) {
        this.wss.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => {
              logger.info('MCP WebSocket Server stopped');
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server statistics
   */
  public getStats() {
    return {
      connectedClients: this.clients.size,
      maxConnections: this.config.maxConnections,
      uptime: process.uptime(),
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        isAlive: client.isAlive
      }))
    };
  }
}
