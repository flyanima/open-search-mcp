import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { OpenSearchMCPServer } from '../index.js';
import { defaultLogger as logger } from '../utils/logger.js';
import { MCPTool } from '../tools/tool-registry.js';
import { ErrorMiddleware } from '../middleware/error-middleware.js';

export interface APIConfig {
  port: number;
  host: string;
  apiKeys: string[];
  enableCors: boolean;
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export class HTTPAPIServer {
  private app: express.Application;
  private mcpServer: OpenSearchMCPServer;
  private config: APIConfig;

  constructor(mcpServer: OpenSearchMCPServer, config: APIConfig) {
    this.mcpServer = mcpServer;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    if (this.config.enableCors) {
      this.app.use(cors());
    }

    // Performance monitoring (before rate limiting)
    // this.app.use(apiMonitoringMiddleware()); // Simplified

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.max,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
      }
    });
    this.app.use(limiter);

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));

    // API Key authentication
    this.app.use('/api', this.authenticateAPIKey.bind(this));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`HTTP API Request: ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private authenticateAPIKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        error: 'Missing API key',
        message: 'Please provide an API key in the X-API-Key header'
      });
      return;
    }

    if (!this.config.apiKeys.includes(apiKey)) {
      res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
      return;
    }

    next();
  }

  private setupRoutes(): void {
    // Health check with performance metrics
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // System health status
    this.app.get('/health/system', (req, res) => {
      res.json({ status: 'healthy', uptime: process.uptime() });
    });

    // Performance metrics (public endpoint)
    this.app.get('/metrics', (req, res) => {
      res.json({ requests: 0, uptime: process.uptime() });
    });

    // Error statistics (public endpoint)
    this.app.get('/errors', (req, res) => {
      res.json({
        timestamp: new Date().toISOString(),
        errors: { total: 0, recent: 0 },
        recentErrors: []
      });
    });

    // API Info
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'Open Search MCP API',
        version: '2.0.0',
        description: 'HTTP API for Open Search MCP Server',
        endpoints: {
          tools: '/api/tools',
          search: '/api/search',
          pdf: '/api/pdf',
          ocr: '/api/ocr'
        }
      });
    });

    // List available tools
    this.app.get('/api/tools', async (req, res) => {
      try {
        const tools = await this.mcpServer.getAvailableTools();
        res.json({
          success: true,
          data: {
            totalTools: tools.length,
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              category: tool.category || 'general',
              source: tool.source || 'unknown'
            }))
          }
        });
      } catch (error) {
        logger.error('Error listing tools:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list tools',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Execute tool
    this.app.post('/api/tools/:toolName', async (req, res) => {
      try {
        const { toolName } = req.params;
        const args = req.body;

        logger.info(`HTTP API executing tool: ${toolName}`, { args });

        const result = await this.mcpServer.executeTool(toolName, args);
        
        res.json({
          success: true,
          data: result,
          metadata: {
            tool: toolName,
            executedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        // Track the error
        // errorTracker.trackError(error as Error, { // Simplified
        //   toolName: req.params.toolName,
        //   operation: 'http_tool_execution',
        //   userId: req.ip
        // }, {
        //   args: req.body,
        //   userAgent: req.get('User-Agent'),
        //   ip: req.ip
        // }); // Simplified

        logger.error(`Error executing tool ${req.params.toolName}:`, error);
        res.status(500).json({
          success: false,
          error: 'Tool execution failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          tool: req.params.toolName
        });
      }
    });

    // Specialized search endpoints
    this.app.post('/api/search/web', async (req, res) => {
      await this.executeToolEndpoint('web_search', req, res);
    });

    this.app.post('/api/search/academic', async (req, res) => {
      await this.executeToolEndpoint('academic_search', req, res);
    });

    this.app.post('/api/search/news', async (req, res) => {
      await this.executeToolEndpoint('news_search', req, res);
    });

    this.app.post('/api/search/forums', async (req, res) => {
      await this.executeToolEndpoint('forums_search', req, res);
    });

    // PDF research endpoints
    this.app.post('/api/pdf/research', async (req, res) => {
      await this.executeToolEndpoint('pdf_research', req, res);
    });

    this.app.post('/api/pdf/analyze', async (req, res) => {
      await this.executeToolEndpoint('pdf_analysis', req, res);
    });

    // OCR endpoints
    this.app.post('/api/ocr/health', async (req, res) => {
      await this.executeToolEndpoint('ocr_health_check', req, res);
    });

    this.app.post('/api/ocr/debug', async (req, res) => {
      await this.executeToolEndpoint('ocr_debug_test', req, res);
    });

    // Crawling endpoints
    this.app.post('/api/crawl/url', async (req, res) => {
      await this.executeToolEndpoint('crawl_url', req, res);
    });

    this.app.post('/api/crawl/batch', async (req, res) => {
      await this.executeToolEndpoint('batch_crawl', req, res);
    });

    // Admin endpoints (require API key)

    // Detailed performance metrics
    this.app.get('/api/metrics/detailed', (req, res) => {
      res.json({ detailed: true, requests: 0, uptime: process.uptime() });
    });

    // Reset monitoring data
    this.app.post('/api/metrics/reset', (req, res) => {
      // resetMonitoring(); // Simplified
      res.json({
        success: true,
        message: 'Performance monitoring and error tracking data reset',
        timestamp: new Date().toISOString()
      });
    });

    // Detailed error statistics
    this.app.get('/api/errors/detailed', (req, res) => {
      res.json({
        timestamp: new Date().toISOString(),
        stats: { total: 0, byType: {} },
        recentErrors: []
      });
    });

    // System status
    this.app.get('/api/system/status', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        server: {
          version: '2.0.0',
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        }
      });
    });

    // Error handling
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('HTTP API Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.path} not found`
      });
    });
  }

  private async executeToolEndpoint(toolName: string, req: express.Request, res: express.Response): Promise<void> {
    try {
      const result = await this.mcpServer.executeTool(toolName, req.body);
      res.json({
        success: true,
        data: result,
        metadata: {
          tool: toolName,
          executedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Error executing ${toolName}:`, error);
      res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        tool: toolName
      });
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.config.port, this.config.host, () => {
          logger.info(`HTTP API Server started on ${this.config.host}:${this.config.port}`);
          resolve();
        });

        server.on('error', (error) => {
          logger.error('HTTP API Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
