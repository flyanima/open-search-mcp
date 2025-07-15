import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { defaultLogger as logger } from '../utils/logger.js';

export interface WindsurfConfig {
  servers: {
    [serverName: string]: {
      type: 'mcp';
      protocol: 'http' | 'stdio';
      endpoint?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      timeout?: number;
      retries?: number;
      healthCheck?: {
        enabled: boolean;
        interval: number;
        endpoint: string;
      };
    };
  };
  ui?: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    autoStart: boolean;
  };
}

export interface WindsurfIntegrationOptions {
  serverName?: string;
  protocol?: 'http' | 'stdio';
  httpPort?: number;
  httpHost?: string;
  apiKeys?: Record<string, string>;
  timeout?: number;
  retries?: number;
  enableHealthCheck?: boolean;
  outputPath?: string;
}

/**
 * Windsurf IDE Integration Manager
 * Handles HTTP-based MCP integration for Windsurf IDE
 */
export class WindsurfIntegration {
  private static readonly DEFAULT_CONFIG_PATH = join(process.cwd(), 'windsurf-mcp-config.json');
  
  private static readonly DEFAULT_HTTP_PORT = 8000;
  private static readonly DEFAULT_HTTP_HOST = 'localhost';

  /**
   * Generate Windsurf configuration for Open-Search-MCP
   */
  public static generateConfig(options: WindsurfIntegrationOptions = {}): WindsurfConfig {
    const {
      serverName = 'open-search-mcp',
      protocol = 'http',
      httpPort = this.DEFAULT_HTTP_PORT,
      httpHost = this.DEFAULT_HTTP_HOST,
      apiKeys = {},
      timeout = 120,
      retries = 3,
      enableHealthCheck = true
    } = options;

    // Build environment variables
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      MCP_TRANSPORT: protocol,
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

    const serverConfig: WindsurfConfig['servers'][string] = {
      type: 'mcp',
      protocol,
      timeout,
      retries
    };

    if (protocol === 'http') {
      // HTTP configuration
      env.MCP_HTTP_PORT = httpPort.toString();
      env.MCP_HTTP_HOST = httpHost;
      
      serverConfig.endpoint = `http://${httpHost}:${httpPort}/mcp`;
      serverConfig.command = 'node';
      serverConfig.args = [
        process.env.OPEN_SEARCH_MCP_PATH || join(process.cwd(), 'dist', 'expanded-server.js')
      ];
      serverConfig.env = env;
      
      if (enableHealthCheck) {
        serverConfig.healthCheck = {
          enabled: true,
          interval: 30000, // 30 seconds
          endpoint: `http://${httpHost}:${httpPort}/health`
        };
      }
    } else {
      // stdio configuration (fallback)
      serverConfig.command = 'node';
      serverConfig.args = [
        process.env.OPEN_SEARCH_MCP_PATH || join(process.cwd(), 'dist', 'expanded-server.js')
      ];
      serverConfig.env = env;
    }

    return {
      servers: {
        [serverName]: serverConfig
      },
      ui: {
        theme: 'auto',
        notifications: true,
        autoStart: true
      }
    };
  }

  /**
   * Write Windsurf configuration to file
   */
  public static async writeConfig(config: WindsurfConfig, outputPath?: string): Promise<string> {
    const configPath = outputPath || this.DEFAULT_CONFIG_PATH;
    
    try {
      const configDir = dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      logger.info(`Windsurf configuration written to: ${configPath}`);
      
      return configPath;
    } catch (error) {
      logger.error('Failed to write Windsurf configuration:', error);
      throw error;
    }
  }

  /**
   * Read existing Windsurf configuration
   */
  public static async readConfig(configPath?: string): Promise<WindsurfConfig | null> {
    const filePath = configPath || this.DEFAULT_CONFIG_PATH;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.debug('No existing Windsurf config found or failed to read:', error);
      return null;
    }
  }

  /**
   * Install Open-Search-MCP to Windsurf
   */
  public static async install(options: WindsurfIntegrationOptions = {}): Promise<string> {
    try {
      // Generate configuration
      const config = this.generateConfig(options);
      
      // Read existing configuration if it exists
      const existingConfig = await this.readConfig(options.outputPath);
      if (existingConfig) {
        // Merge configurations
        const serverName = options.serverName || 'open-search-mcp';
        existingConfig.servers[serverName] = config.servers[serverName];
        
        // Write merged configuration
        const configPath = await this.writeConfig(existingConfig, options.outputPath);
        logger.info(`Open-Search-MCP updated in Windsurf configuration`);
        return configPath;
      } else {
        // Write new configuration
        const configPath = await this.writeConfig(config, options.outputPath);
        logger.info(`Open-Search-MCP installed to Windsurf`);
        return configPath;
      }
    } catch (error) {
      logger.error('Failed to install Open-Search-MCP to Windsurf:', error);
      throw error;
    }
  }

  /**
   * Uninstall Open-Search-MCP from Windsurf
   */
  public static async uninstall(serverName: string = 'open-search-mcp', configPath?: string): Promise<void> {
    try {
      const config = await this.readConfig(configPath);
      if (!config || !config.servers[serverName]) {
        logger.warn(`Server '${serverName}' not found in Windsurf configuration`);
        return;
      }

      // Remove the server
      delete config.servers[serverName];

      // Write updated configuration
      await this.writeConfig(config, configPath);
      logger.info(`Open-Search-MCP '${serverName}' uninstalled from Windsurf`);
    } catch (error) {
      logger.error('Failed to uninstall Open-Search-MCP from Windsurf:', error);
      throw error;
    }
  }

  /**
   * Get status of Open-Search-MCP in Windsurf
   */
  public static async getStatus(serverName: string = 'open-search-mcp', configPath?: string): Promise<{
    installed: boolean;
    protocol: string;
    endpoint?: string;
    healthCheck?: boolean;
    config?: any;
  }> {
    try {
      const config = await this.readConfig(configPath);
      if (!config || !config.servers[serverName]) {
        return { installed: false, protocol: 'unknown' };
      }

      const serverConfig = config.servers[serverName];
      return {
        installed: true,
        protocol: serverConfig.protocol,
        endpoint: serverConfig.endpoint,
        healthCheck: serverConfig.healthCheck?.enabled || false,
        config: serverConfig
      };
    } catch (error) {
      logger.error('Failed to get Windsurf status:', error);
      return { installed: false, protocol: 'unknown' };
    }
  }

  /**
   * Validate Windsurf configuration
   */
  public static validateConfig(config: WindsurfConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.servers) {
      errors.push('Missing servers configuration');
      return { valid: false, errors };
    }

    Object.entries(config.servers).forEach(([serverName, serverConfig]) => {
      if (serverConfig.type !== 'mcp') {
        errors.push(`Server '${serverName}': type must be 'mcp'`);
      }

      if (!['http', 'stdio'].includes(serverConfig.protocol)) {
        errors.push(`Server '${serverName}': protocol must be 'http' or 'stdio'`);
      }

      if (serverConfig.protocol === 'http' && !serverConfig.endpoint) {
        errors.push(`Server '${serverName}': HTTP protocol requires endpoint`);
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
   * Test HTTP endpoint connectivity
   */
  public static async testHttpEndpoint(endpoint: string): Promise<{ success: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${endpoint.replace('/mcp', '/health')}`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Generate installation instructions
   */
  public static getInstallationInstructions(): string {
    return `
# Windsurf IDE Integration Instructions

## Automatic Installation
\`\`\`bash
npm run install:windsurf
\`\`\`

## Manual Installation
1. Generate configuration file:
   \`\`\`bash
   npm run config:windsurf > windsurf-mcp-config.json
   \`\`\`

2. Start the HTTP server:
   \`\`\`bash
   npm run server:http
   \`\`\`

3. Import configuration in Windsurf:
   - Open Windsurf IDE
   - Go to Settings → MCP Servers
   - Import the generated \`windsurf-mcp-config.json\`
   - Or manually add server configuration

## Configuration Example
\`\`\`json
{
  "servers": {
    "open-search-mcp": {
      "type": "mcp",
      "protocol": "http",
      "endpoint": "http://localhost:8000/mcp",
      "timeout": 120,
      "retries": 3,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "endpoint": "http://localhost:8000/health"
      }
    }
  }
}
\`\`\`

## Verification
1. Check server health: \`curl http://localhost:8000/health\`
2. Test MCP endpoint: \`curl -X POST http://localhost:8000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'\`
3. Verify in Windsurf that tools are available

## Troubleshooting
- Ensure HTTP server is running on correct port
- Check firewall settings for port 8000
- Verify Windsurf can access localhost
- Check server logs for errors
`;
  }
}
