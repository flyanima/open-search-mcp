import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { defaultLogger as logger } from '../utils/logger.js';

export interface AugmentCodeConfig {
  mcpServers: {
    [serverName: string]: {
      transport: 'websocket' | 'http' | 'stdio';
      endpoint?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      timeout?: number;
      reconnect?: {
        enabled: boolean;
        maxAttempts: number;
        delay: number;
      };
      features?: {
        realTimeUpdates: boolean;
        analytics: boolean;
        collaboration: boolean;
      };
    };
  };
  settings?: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    autoConnect: boolean;
    maxConnections: number;
  };
}

export interface AugmentCodeIntegrationOptions {
  serverName?: string;
  transport?: 'websocket' | 'http' | 'stdio';
  wsPort?: number;
  wsHost?: string;
  apiKeys?: Record<string, string>;
  timeout?: number;
  enableReconnect?: boolean;
  enableAnalytics?: boolean;
  enableCollaboration?: boolean;
  outputPath?: string;
}

/**
 * Augment Code Integration Manager
 * Handles WebSocket-based MCP integration for Augment Code platform
 */
export class AugmentCodeIntegration {
  private static readonly DEFAULT_CONFIG_PATH = join(process.cwd(), 'augment-mcp-config.json');
  
  private static readonly DEFAULT_WS_PORT = 8001;
  private static readonly DEFAULT_WS_HOST = 'localhost';

  /**
   * Generate Augment Code configuration for Open-Search-MCP
   */
  public static generateConfig(options: AugmentCodeIntegrationOptions = {}): AugmentCodeConfig {
    const {
      serverName = 'open-search-mcp',
      transport = 'websocket',
      wsPort = this.DEFAULT_WS_PORT,
      wsHost = this.DEFAULT_WS_HOST,
      apiKeys = {},
      timeout = 120,
      enableReconnect = true,
      enableAnalytics = true,
      enableCollaboration = false
    } = options;

    // Build environment variables
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      MCP_TRANSPORT: transport,
      ...apiKeys
    };

    // Add common API keys if available
    const commonKeys = [
      'GITHUB_TOKEN',
      'ALPHA_VANTAGE_API_KEY',
      'GOOGLE_API_KEY',
      'GOOGLE_SEARCH_ENGINE_ID',
      'NEWSAPI_KEY',
      'OPENWEATHER_API_KEY'
    ];

    commonKeys.forEach(key => {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    });

    const serverConfig: AugmentCodeConfig['mcpServers'][string] = {
      transport,
      timeout
    };

    if (transport === 'websocket') {
      // WebSocket configuration
      env.MCP_WS_PORT = wsPort.toString();
      env.MCP_WS_HOST = wsHost;
      
      serverConfig.endpoint = `ws://${wsHost}:${wsPort}`;
      serverConfig.command = 'node';
      serverConfig.args = [
        process.env.OPEN_SEARCH_MCP_PATH || join(process.cwd(), 'dist', 'expanded-server.js')
      ];
      serverConfig.env = env;
      
      if (enableReconnect) {
        serverConfig.reconnect = {
          enabled: true,
          maxAttempts: 5,
          delay: 3000 // 3 seconds
        };
      }

      serverConfig.features = {
        realTimeUpdates: true,
        analytics: enableAnalytics,
        collaboration: enableCollaboration
      };
    } else if (transport === 'http') {
      // HTTP fallback configuration
      const httpPort = 8000;
      env.MCP_HTTP_PORT = httpPort.toString();
      env.MCP_HTTP_HOST = wsHost;
      
      serverConfig.endpoint = `http://${wsHost}:${httpPort}/mcp`;
      serverConfig.command = 'node';
      serverConfig.args = [
        process.env.OPEN_SEARCH_MCP_PATH || join(process.cwd(), 'dist', 'expanded-server.js')
      ];
      serverConfig.env = env;
      
      serverConfig.features = {
        realTimeUpdates: false,
        analytics: enableAnalytics,
        collaboration: false
      };
    } else {
      // stdio configuration (fallback)
      serverConfig.command = 'node';
      serverConfig.args = [
        process.env.OPEN_SEARCH_MCP_PATH || join(process.cwd(), 'dist', 'expanded-server.js')
      ];
      serverConfig.env = env;
      
      serverConfig.features = {
        realTimeUpdates: false,
        analytics: false,
        collaboration: false
      };
    }

    return {
      mcpServers: {
        [serverName]: serverConfig
      },
      settings: {
        theme: 'auto',
        notifications: true,
        autoConnect: true,
        maxConnections: 10
      }
    };
  }

  /**
   * Write Augment Code configuration to file
   */
  public static async writeConfig(config: AugmentCodeConfig, outputPath?: string): Promise<string> {
    const configPath = outputPath || this.DEFAULT_CONFIG_PATH;
    
    try {
      const configDir = dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      logger.info(`Augment Code configuration written to: ${configPath}`);
      
      return configPath;
    } catch (error) {
      logger.error('Failed to write Augment Code configuration:', error);
      throw error;
    }
  }

  /**
   * Read existing Augment Code configuration
   */
  public static async readConfig(configPath?: string): Promise<AugmentCodeConfig | null> {
    const filePath = configPath || this.DEFAULT_CONFIG_PATH;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.debug('No existing Augment Code config found or failed to read:', error);
      return null;
    }
  }

  /**
   * Install Open-Search-MCP to Augment Code
   */
  public static async install(options: AugmentCodeIntegrationOptions = {}): Promise<string> {
    try {
      // Generate configuration
      const config = this.generateConfig(options);
      
      // Read existing configuration if it exists
      const existingConfig = await this.readConfig(options.outputPath);
      if (existingConfig) {
        // Merge configurations
        const serverName = options.serverName || 'open-search-mcp';
        existingConfig.mcpServers[serverName] = config.mcpServers[serverName];
        
        // Write merged configuration
        const configPath = await this.writeConfig(existingConfig, options.outputPath);
        logger.info(`Open-Search-MCP updated in Augment Code configuration`);
        return configPath;
      } else {
        // Write new configuration
        const configPath = await this.writeConfig(config, options.outputPath);
        logger.info(`Open-Search-MCP installed to Augment Code`);
        return configPath;
      }
    } catch (error) {
      logger.error('Failed to install Open-Search-MCP to Augment Code:', error);
      throw error;
    }
  }

  /**
   * Uninstall Open-Search-MCP from Augment Code
   */
  public static async uninstall(serverName: string = 'open-search-mcp', configPath?: string): Promise<void> {
    try {
      const config = await this.readConfig(configPath);
      if (!config || !config.mcpServers[serverName]) {
        logger.warn(`Server '${serverName}' not found in Augment Code configuration`);
        return;
      }

      // Remove the server
      delete config.mcpServers[serverName];

      // Write updated configuration
      await this.writeConfig(config, configPath);
      logger.info(`Open-Search-MCP '${serverName}' uninstalled from Augment Code`);
    } catch (error) {
      logger.error('Failed to uninstall Open-Search-MCP from Augment Code:', error);
      throw error;
    }
  }

  /**
   * Get status of Open-Search-MCP in Augment Code
   */
  public static async getStatus(serverName: string = 'open-search-mcp', configPath?: string): Promise<{
    installed: boolean;
    transport: string;
    endpoint?: string;
    features?: any;
    config?: any;
  }> {
    try {
      const config = await this.readConfig(configPath);
      if (!config || !config.mcpServers[serverName]) {
        return { installed: false, transport: 'unknown' };
      }

      const serverConfig = config.mcpServers[serverName];
      return {
        installed: true,
        transport: serverConfig.transport,
        endpoint: serverConfig.endpoint,
        features: serverConfig.features,
        config: serverConfig
      };
    } catch (error) {
      logger.error('Failed to get Augment Code status:', error);
      return { installed: false, transport: 'unknown' };
    }
  }

  /**
   * Validate Augment Code configuration
   */
  public static validateConfig(config: AugmentCodeConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.mcpServers) {
      errors.push('Missing mcpServers configuration');
      return { valid: false, errors };
    }

    Object.entries(config.mcpServers).forEach(([serverName, serverConfig]) => {
      if (!['websocket', 'http', 'stdio'].includes(serverConfig.transport)) {
        errors.push(`Server '${serverName}': transport must be 'websocket', 'http', or 'stdio'`);
      }

      if (serverConfig.transport === 'websocket' && !serverConfig.endpoint?.startsWith('ws://')) {
        errors.push(`Server '${serverName}': WebSocket transport requires ws:// endpoint`);
      }

      if (serverConfig.transport === 'http' && !serverConfig.endpoint?.startsWith('http://')) {
        errors.push(`Server '${serverName}': HTTP transport requires http:// endpoint`);
      }

      if (!serverConfig.command) {
        errors.push(`Server '${serverName}': missing command`);
      }

      if (serverConfig.timeout && typeof serverConfig.timeout !== 'number') {
        errors.push(`Server '${serverName}': timeout must be a number`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Test WebSocket endpoint connectivity
   */
  public static async testWebSocketEndpoint(endpoint: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const WebSocket = require('ws');
        const ws = new WebSocket(endpoint);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Connection timeout' });
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve({ success: true });
        });

        ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      } catch (error) {
        resolve({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });
  }

  /**
   * Generate installation instructions
   */
  public static getInstallationInstructions(): string {
    return `
# Augment Code Integration Instructions

## Automatic Installation
\`\`\`bash
npm run install:augment
\`\`\`

## Manual Installation
1. Generate configuration file:
   \`\`\`bash
   npm run config:augment > augment-mcp-config.json
   \`\`\`

2. Start the WebSocket server:
   \`\`\`bash
   npm run server:websocket
   \`\`\`

3. Import configuration in Augment Code:
   - Open Augment Code
   - Go to Settings → MCP Servers
   - Import the generated \`augment-mcp-config.json\`
   - Or manually add server configuration

## Configuration Example
\`\`\`json
{
  "mcpServers": {
    "open-search-mcp": {
      "transport": "websocket",
      "endpoint": "ws://localhost:8001",
      "timeout": 120,
      "reconnect": {
        "enabled": true,
        "maxAttempts": 5,
        "delay": 3000
      },
      "features": {
        "realTimeUpdates": true,
        "analytics": true,
        "collaboration": false
      }
    }
  }
}
\`\`\`

## Verification
1. Check WebSocket server: \`curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:8001\`
2. Test connection in Augment Code
3. Verify real-time updates are working

## Troubleshooting
- Ensure WebSocket server is running on correct port
- Check firewall settings for port 8001
- Verify Augment Code can access localhost
- Check server logs for WebSocket errors
`;
  }
}
