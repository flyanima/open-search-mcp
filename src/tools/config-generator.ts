import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { defaultLogger as logger } from '../utils/logger.js';

export type PlatformType = 'claude-desktop' | 'cursor' | 'vscode' | 'windsurf' | 'augment-code' | 'cline';

export interface ConfigGeneratorOptions {
  platform: PlatformType;
  serverName?: string;
  serverPath?: string;
  apiKeys?: Record<string, string>;
  autoApprove?: string[];
  timeout?: number;
  disabled?: boolean;
  outputPath?: string;
}

export interface PlatformConfig {
  configPath: string;
  configFormat: 'json' | 'yaml';
  configStructure: any;
  installInstructions: string;
}

/**
 * Multi-Platform Configuration Generator
 * Generates platform-specific configurations for Open-Search-MCP
 */
export class ConfigGenerator {
  private static readonly PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
    'claude-desktop': {
      configPath: process.platform === 'win32' 
        ? join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
        : process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        : join(homedir(), '.config', 'Claude', 'claude_desktop_config.json'),
      configFormat: 'json',
      configStructure: {
        mcpServers: {}
      },
      installInstructions: 'Restart Claude Desktop after configuration update'
    },
    'cursor': {
      configPath: process.platform === 'win32'
        ? join(homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json')
        : process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json')
        : join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
      configFormat: 'json',
      configStructure: {
        mcpServers: {}
      },
      installInstructions: 'Install Cline extension and restart Cursor IDE'
    },
    'vscode': {
      configPath: process.platform === 'win32'
        ? join(homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json')
        : process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json')
        : join(homedir(), '.config', 'Code', 'User', 'settings.json'),
      configFormat: 'json',
      configStructure: {
        'mcp.servers': {}
      },
      installInstructions: 'Install MCP extension and reload VS Code window'
    },
    'windsurf': {
      configPath: join(process.cwd(), 'windsurf-mcp-config.json'),
      configFormat: 'json',
      configStructure: {
        servers: {},
        ui: {
          theme: 'auto',
          notifications: true,
          autoStart: true
        }
      },
      installInstructions: 'Start HTTP server with npm run server:http and import config in Windsurf Settings → MCP Servers'
    },
    'augment-code': {
      configPath: join(process.cwd(), 'augment-mcp-config.json'),
      configFormat: 'json',
      configStructure: {
        mcpServers: {}
      },
      installInstructions: 'Import configuration in Augment Code settings'
    },
    'cline': {
      configPath: join(process.cwd(), 'cline-mcp-settings.json'),
      configFormat: 'json',
      configStructure: {
        mcpServers: {}
      },
      installInstructions: 'Use with Cline extension in supported editors'
    }
  };

  /**
   * Generate configuration for a specific platform
   */
  public static async generateConfig(options: ConfigGeneratorOptions): Promise<string> {
    const {
      platform,
      serverName = 'open-search-mcp',
      serverPath = 'node',
      apiKeys = {},
      autoApprove = this.getDefaultAutoApproveTools(),
      timeout = 60,
      disabled = false,
      outputPath
    } = options;

    const platformConfig = this.PLATFORM_CONFIGS[platform];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Generate server configuration
    const serverConfig = this.generateServerConfig({
      serverName,
      serverPath,
      apiKeys,
      autoApprove,
      timeout,
      disabled,
      platform
    });

    // Create platform-specific configuration
    const config = { ...platformConfig.configStructure };
    
    switch (platform) {
      case 'claude-desktop':
      case 'cursor':
      case 'augment-code':
      case 'cline':
        config.mcpServers[serverName] = serverConfig;
        break;
      case 'vscode':
        config['mcp.servers'][serverName] = serverConfig;
        break;
      case 'windsurf':
        config.servers[serverName] = serverConfig;
        break;
    }

    // Convert to string
    const configString = JSON.stringify(config, null, 2);

    // Write to file if output path is specified
    if (outputPath) {
      await this.writeConfigFile(outputPath, configString);
    }

    return configString;
  }

  /**
   * Generate server configuration object
   */
  private static generateServerConfig(options: {
    serverName: string;
    serverPath: string;
    apiKeys: Record<string, string>;
    autoApprove: string[];
    timeout: number;
    disabled: boolean;
    platform: PlatformType;
  }) {
    const { serverPath, apiKeys, autoApprove, timeout, disabled, platform } = options;

    // Determine script path
    const scriptPath = process.env.OPEN_SEARCH_MCP_PATH || 
                      join(process.cwd(), 'dist', 'expanded-server.js');

    // Build environment variables
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      MCP_PLATFORM: platform,
      ...apiKeys
    };

    // Add common environment variables if available
    const commonEnvVars = [
      'GITHUB_TOKEN',
      'ALPHA_VANTAGE_API_KEY',
      'GOOGLE_API_KEY',
      'GOOGLE_SEARCH_ENGINE_ID',
      'NEWSAPI_KEY',
      'OPENWEATHER_API_KEY'
    ];

    commonEnvVars.forEach(key => {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    });

    // Platform-specific configuration
    const baseConfig = {
      command: serverPath,
      args: [scriptPath],
      env,
      timeout,
      disabled
    };

    // Add platform-specific fields
    switch (platform) {
      case 'cursor':
      case 'cline':
        return {
          ...baseConfig,
          autoApprove
        };
      case 'vscode':
        return {
          ...baseConfig,
          autoStart: true,
          restart: true
        };
      case 'windsurf':
        return {
          type: 'mcp',
          protocol: 'http',
          endpoint: `http://localhost:8000/mcp`,
          command: baseConfig.command,
          args: baseConfig.args,
          env: {
            ...baseConfig.env,
            MCP_TRANSPORT: 'http',
            MCP_HTTP_PORT: '8000',
            MCP_HTTP_HOST: 'localhost'
          },
          timeout: baseConfig.timeout,
          retries: 3,
          healthCheck: {
            enabled: true,
            interval: 30000,
            endpoint: 'http://localhost:8000/health'
          }
        };
      case 'augment-code':
        return {
          transport: 'websocket',
          endpoint: 'ws://localhost:8001',
          command: baseConfig.command,
          args: baseConfig.args,
          env: {
            ...baseConfig.env,
            MCP_TRANSPORT: 'websocket',
            MCP_WS_PORT: '8001',
            MCP_WS_HOST: 'localhost'
          },
          timeout: baseConfig.timeout,
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            delay: 3000
          },
          features: {
            realTimeUpdates: true,
            analytics: true,
            collaboration: false
          }
        };
      default:
        return baseConfig;
    }
  }

  /**
   * Get default auto-approve tools
   */
  private static getDefaultAutoApproveTools(): string[] {
    return [
      // Academic search tools
      'search_arxiv',
      'search_pubmed',
      'search_ieee',
      'search_semantic_scholar',
      'search_iacr',
      'search_biorxiv',
      'search_medrxiv',
      
      // Developer tools
      'search_github',
      'search_stackoverflow',
      'search_gitlab',
      'search_bitbucket',
      
      // Search engines
      'search_searx',
      'search_startpage',
      'search_brave',
      'search_ecosia',
      
      // Testing tools
      'test_jsonplaceholder',
      'test_httpbin',
      
      // Web crawling
      'crawl_url_content',
      'batch_crawl_urls',
      
      // Document processing
      'analyze_pdf',
      
      // Research tools
      'intelligent_research',
      'deep_research',
      'visualize_thinking',
      'decompose_thinking',
      'check_research_saturation'
    ];
  }

  /**
   * Write configuration to file
   */
  private static async writeConfigFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Configuration written to: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to write configuration file: ${error}`);
      throw error;
    }
  }

  /**
   * Install configuration for a platform
   */
  public static async installConfig(options: ConfigGeneratorOptions): Promise<void> {
    const { platform } = options;
    const platformConfig = this.PLATFORM_CONFIGS[platform];
    
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    try {
      // Check if platform is installed
      const isInstalled = await this.isPlatformInstalled(platform);
      if (!isInstalled) {
        logger.warn(`${platform} may not be installed or configuration directory not found`);
      }

      // Generate configuration
      const configString = await this.generateConfig({
        ...options,
        outputPath: platformConfig.configPath
      });

      logger.info(`Configuration installed for ${platform}`);
      logger.info(`Config path: ${platformConfig.configPath}`);
      logger.info(`Instructions: ${platformConfig.installInstructions}`);

    } catch (error) {
      logger.error(`Failed to install configuration for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Check if a platform is installed
   */
  private static async isPlatformInstalled(platform: PlatformType): Promise<boolean> {
    try {
      const platformConfig = this.PLATFORM_CONFIGS[platform];
      const configDir = dirname(platformConfig.configPath);
      await fs.access(configDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installation instructions for a platform
   */
  public static getInstallationInstructions(platform: PlatformType): string {
    const platformConfig = this.PLATFORM_CONFIGS[platform];
    if (!platformConfig) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return `
# ${platform.toUpperCase()} Integration Instructions

## Configuration Path
${platformConfig.configPath}

## Installation Steps
${platformConfig.installInstructions}

## Configuration Format
${platformConfig.configFormat.toUpperCase()}

## Auto-Generate Configuration
\`\`\`bash
npm run config:generate -- --platform ${platform}
\`\`\`

## Manual Installation
\`\`\`bash
npm run install:${platform}
\`\`\`
`;
  }

  /**
   * Get all supported platforms
   */
  public static getSupportedPlatforms(): PlatformType[] {
    return Object.keys(this.PLATFORM_CONFIGS) as PlatformType[];
  }

  /**
   * Validate platform configuration
   */
  public static validatePlatformConfig(platform: PlatformType, config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const platformConfig = this.PLATFORM_CONFIGS[platform];

    if (!platformConfig) {
      errors.push(`Unsupported platform: ${platform}`);
      return { valid: false, errors };
    }

    // Platform-specific validation
    switch (platform) {
      case 'claude-desktop':
      case 'cursor':
      case 'augment-code':
      case 'cline':
        if (!config.mcpServers) {
          errors.push('Missing mcpServers configuration');
        }
        break;
      case 'vscode':
        if (!config['mcp.servers']) {
          errors.push('Missing mcp.servers configuration');
        }
        break;
      case 'windsurf':
        if (!config.servers) {
          errors.push('Missing servers configuration');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }
}
