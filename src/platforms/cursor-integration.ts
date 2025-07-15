import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { defaultLogger as logger } from '../utils/logger.js';

export interface CursorConfig {
  mcpServers: {
    [serverName: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
      disabled?: boolean;
      timeout?: number;
      autoApprove?: string[];
    };
  };
}

export interface CursorIntegrationOptions {
  serverName?: string;
  serverPath?: string;
  apiKeys?: Record<string, string>;
  autoApprove?: string[];
  timeout?: number;
  disabled?: boolean;
}

/**
 * Cursor IDE Integration Manager
 * Handles configuration generation and management for Cursor IDE
 */
export class CursorIntegration {
  private static readonly CONFIG_PATHS = {
    windows: join(homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
    darwin: join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
    linux: join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json')
  };

  /**
   * Get the Cursor configuration file path for the current platform
   */
  public static getConfigPath(): string {
    const platform = process.platform;
    switch (platform) {
      case 'win32':
        return this.CONFIG_PATHS.windows;
      case 'darwin':
        return this.CONFIG_PATHS.darwin;
      case 'linux':
        return this.CONFIG_PATHS.linux;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Check if Cursor is installed
   */
  public static async isCursorInstalled(): Promise<boolean> {
    try {
      const configPath = this.getConfigPath();
      const configDir = dirname(configPath);
      await fs.access(configDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read existing Cursor configuration
   */
  public static async readConfig(): Promise<CursorConfig | null> {
    try {
      const configPath = this.getConfigPath();
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.debug('No existing Cursor config found or failed to read:', error);
      return null;
    }
  }

  /**
   * Write Cursor configuration
   */
  public static async writeConfig(config: CursorConfig): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      const configDir = dirname(configPath);
      
      // Ensure directory exists
      await fs.mkdir(configDir, { recursive: true });
      
      // Write configuration
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      logger.info(`Cursor configuration written to: ${configPath}`);
    } catch (error) {
      logger.error('Failed to write Cursor configuration:', error);
      throw error;
    }
  }

  /**
   * Generate Cursor configuration for Open-Search-MCP
   */
  public static generateConfig(options: CursorIntegrationOptions = {}): CursorConfig {
    const {
      serverName = 'open-search-mcp',
      serverPath = 'node',
      apiKeys = {},
      autoApprove = [
        'search_arxiv',
        'search_github',
        'search_stackoverflow',
        'crawl_url_content',
        'batch_crawl_urls',
        'test_jsonplaceholder',
        'test_httpbin',
        'intelligent_research',
        'deep_research'
      ],
      timeout = 60,
      disabled = false
    } = options;

    // Determine the server script path
    const scriptPath = process.env.OPEN_SEARCH_MCP_PATH || 
                      join(process.cwd(), 'dist', 'expanded-server.js');

    // Build environment variables
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      ...apiKeys
    };

    // Add common API keys if available
    const commonKeys = [
      'GITHUB_TOKEN',
      'ALPHA_VANTAGE_API_KEY',
      'GOOGLE_API_KEY',
      'GOOGLE_SEARCH_ENGINE_ID',
      'NEWSAPI_KEY'
    ];

    commonKeys.forEach(key => {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    });

    return {
      mcpServers: {
        [serverName]: {
          command: serverPath,
          args: [scriptPath],
          env,
          disabled,
          timeout,
          autoApprove
        }
      }
    };
  }

  /**
   * Install Open-Search-MCP to Cursor
   */
  public static async install(options: CursorIntegrationOptions = {}): Promise<void> {
    try {
      // Check if Cursor is installed
      if (!(await this.isCursorInstalled())) {
        throw new Error('Cursor IDE is not installed or not found');
      }

      // Read existing configuration
      let existingConfig = await this.readConfig();
      if (!existingConfig) {
        existingConfig = { mcpServers: {} };
      }

      // Generate new configuration
      const newConfig = this.generateConfig(options);
      const serverName = options.serverName || 'open-search-mcp';

      // Merge configurations
      existingConfig.mcpServers[serverName] = newConfig.mcpServers[serverName];

      // Write updated configuration
      await this.writeConfig(existingConfig);

      logger.info(`Open-Search-MCP successfully installed to Cursor IDE`);
      logger.info(`Server name: ${serverName}`);
      logger.info(`Auto-approved tools: ${newConfig.mcpServers[serverName].autoApprove?.length || 0}`);
      
    } catch (error) {
      logger.error('Failed to install Open-Search-MCP to Cursor:', error);
      throw error;
    }
  }

  /**
   * Uninstall Open-Search-MCP from Cursor
   */
  public static async uninstall(serverName: string = 'open-search-mcp'): Promise<void> {
    try {
      const existingConfig = await this.readConfig();
      if (!existingConfig || !existingConfig.mcpServers[serverName]) {
        logger.warn(`Server '${serverName}' not found in Cursor configuration`);
        return;
      }

      // Remove the server
      delete existingConfig.mcpServers[serverName];

      // Write updated configuration
      await this.writeConfig(existingConfig);

      logger.info(`Open-Search-MCP '${serverName}' uninstalled from Cursor IDE`);
    } catch (error) {
      logger.error('Failed to uninstall Open-Search-MCP from Cursor:', error);
      throw error;
    }
  }

  /**
   * Update existing Cursor configuration
   */
  public static async update(options: CursorIntegrationOptions = {}): Promise<void> {
    const serverName = options.serverName || 'open-search-mcp';
    
    try {
      const existingConfig = await this.readConfig();
      if (!existingConfig || !existingConfig.mcpServers[serverName]) {
        logger.info(`Server '${serverName}' not found, installing instead`);
        await this.install(options);
        return;
      }

      // Generate updated configuration
      const newConfig = this.generateConfig(options);
      existingConfig.mcpServers[serverName] = newConfig.mcpServers[serverName];

      // Write updated configuration
      await this.writeConfig(existingConfig);

      logger.info(`Open-Search-MCP '${serverName}' updated in Cursor IDE`);
    } catch (error) {
      logger.error('Failed to update Open-Search-MCP in Cursor:', error);
      throw error;
    }
  }

  /**
   * Get status of Open-Search-MCP in Cursor
   */
  public static async getStatus(serverName: string = 'open-search-mcp'): Promise<{
    installed: boolean;
    disabled: boolean;
    config?: any;
  }> {
    try {
      const config = await this.readConfig();
      if (!config || !config.mcpServers[serverName]) {
        return { installed: false, disabled: false };
      }

      const serverConfig = config.mcpServers[serverName];
      return {
        installed: true,
        disabled: serverConfig.disabled || false,
        config: serverConfig
      };
    } catch (error) {
      logger.error('Failed to get Cursor status:', error);
      return { installed: false, disabled: false };
    }
  }

  /**
   * Validate Cursor configuration
   */
  public static validateConfig(config: CursorConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.mcpServers) {
      errors.push('Missing mcpServers configuration');
      return { valid: false, errors };
    }

    Object.entries(config.mcpServers).forEach(([serverName, serverConfig]) => {
      if (!serverConfig.command) {
        errors.push(`Server '${serverName}': missing command`);
      }

      if (!Array.isArray(serverConfig.args)) {
        errors.push(`Server '${serverName}': args must be an array`);
      }

      if (serverConfig.timeout && typeof serverConfig.timeout !== 'number') {
        errors.push(`Server '${serverName}': timeout must be a number`);
      }

      if (serverConfig.autoApprove && !Array.isArray(serverConfig.autoApprove)) {
        errors.push(`Server '${serverName}': autoApprove must be an array`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate installation instructions
   */
  public static getInstallationInstructions(): string {
    return `
# Cursor IDE Integration Instructions

## Automatic Installation
\`\`\`bash
npm run install:cursor
\`\`\`

## Manual Installation
1. Open Cursor IDE
2. Install the Cline extension if not already installed
3. Open Command Palette (Ctrl/Cmd + Shift + P)
4. Run "Cline: Open MCP Settings"
5. Add the following configuration:

\`\`\`json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["${join(process.cwd(), 'dist', 'expanded-server.js')}"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "ALPHA_VANTAGE_API_KEY": "your_alpha_vantage_key_here"
      },
      "autoApprove": [
        "search_arxiv",
        "search_github",
        "search_stackoverflow",
        "crawl_url_content",
        "intelligent_research"
      ]
    }
  }
}
\`\`\`

## Verification
1. Restart Cursor IDE
2. Open a new chat with Cline
3. Try using one of the search tools
4. Check that the tools are working correctly

## Troubleshooting
- Ensure Node.js is installed and accessible
- Check that the server path is correct
- Verify API keys are properly set
- Check Cursor's developer console for errors
`;
  }
}
