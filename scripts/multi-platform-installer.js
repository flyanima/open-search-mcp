#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

/**
 * Multi-Platform Installer for Open-Search-MCP
 * Automatically detects and configures supported platforms
 */

const PLATFORMS = {
  'claude-desktop': {
    name: 'Claude Desktop',
    configPath: {
      win32: join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
      darwin: join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      linux: join(homedir(), '.config', 'Claude', 'claude_desktop_config.json')
    },
    detectCommand: null, // No command detection needed
    installInstructions: 'Restart Claude Desktop after installation'
  },
  'cursor': {
    name: 'Cursor IDE',
    configPath: {
      win32: join(homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
      darwin: join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
      linux: join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json')
    },
    detectCommand: 'cursor --version',
    installInstructions: 'Install Cline extension and restart Cursor IDE'
  },
  'vscode': {
    name: 'Visual Studio Code',
    configPath: {
      win32: join(homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json'),
      darwin: join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json'),
      linux: join(homedir(), '.config', 'Code', 'User', 'settings.json')
    },
    detectCommand: 'code --version',
    installInstructions: 'Install MCP extension and reload VS Code window'
  },
  'windsurf': {
    name: 'Windsurf IDE',
    configPath: {
      win32: join(process.cwd(), 'windsurf-mcp-config.json'),
      darwin: join(process.cwd(), 'windsurf-mcp-config.json'),
      linux: join(process.cwd(), 'windsurf-mcp-config.json')
    },
    detectCommand: null, // No command detection for Windsurf yet
    installInstructions: 'Start HTTP server with npm run server:http and import config in Windsurf Settings → MCP Servers'
  },
  'augment-code': {
    name: 'Augment Code',
    configPath: {
      win32: join(process.cwd(), 'augment-mcp-config.json'),
      darwin: join(process.cwd(), 'augment-mcp-config.json'),
      linux: join(process.cwd(), 'augment-mcp-config.json')
    },
    detectCommand: null, // No command detection for Augment Code yet
    installInstructions: 'Start WebSocket server with npm run server:websocket and import config in Augment Code Settings → MCP Servers'
  }
};

class MultiPlatformInstaller {
  constructor() {
    this.detectedPlatforms = [];
    this.installedPlatforms = [];
    this.errors = [];
  }

  /**
   * Main installation process
   */
  async install() {
    console.log('🚀 Open-Search-MCP Multi-Platform Installer\n');

    try {
      // Detect available platforms
      await this.detectPlatforms();
      
      // Show detection results
      this.showDetectionResults();
      
      // Install to detected platforms
      await this.installToPlatforms();
      
      // Show installation summary
      this.showInstallationSummary();
      
    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Detect available platforms
   */
  async detectPlatforms() {
    console.log('🔍 Detecting available platforms...\n');

    for (const [platformId, platform] of Object.entries(PLATFORMS)) {
      const isInstalled = await this.isPlatformInstalled(platformId, platform);
      
      if (isInstalled) {
        this.detectedPlatforms.push({
          id: platformId,
          name: platform.name,
          configPath: this.getConfigPath(platform)
        });
        console.log(`✅ ${platform.name} detected`);
      } else {
        console.log(`⚪ ${platform.name} not found`);
      }
    }

    if (this.detectedPlatforms.length === 0) {
      throw new Error('No supported platforms detected. Please install Claude Desktop, Cursor IDE, or VS Code.');
    }
  }

  /**
   * Check if a platform is installed
   */
  async isPlatformInstalled(platformId, platform) {
    try {
      // Check if config directory exists
      const configPath = this.getConfigPath(platform);
      const configDir = dirname(configPath);
      await fs.access(configDir);

      // For platforms with detect commands, verify they're actually installed
      if (platform.detectCommand) {
        try {
          execSync(platform.detectCommand, { stdio: 'ignore' });
        } catch {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get config path for current platform
   */
  getConfigPath(platform) {
    const platformPaths = platform.configPath;
    return platformPaths[process.platform] || platformPaths.linux;
  }

  /**
   * Show detection results
   */
  showDetectionResults() {
    console.log(`\n📊 Detection Summary:`);
    console.log(`Found ${this.detectedPlatforms.length} supported platform(s):\n`);
    
    this.detectedPlatforms.forEach(platform => {
      console.log(`  • ${platform.name}`);
      console.log(`    Config: ${platform.configPath}`);
    });
    console.log('');
  }

  /**
   * Install to all detected platforms
   */
  async installToPlatforms() {
    console.log('⚙️  Installing Open-Search-MCP...\n');

    for (const platform of this.detectedPlatforms) {
      try {
        await this.installToPlatform(platform);
        this.installedPlatforms.push(platform);
        console.log(`✅ ${platform.name} installation completed`);
      } catch (error) {
        this.errors.push({
          platform: platform.name,
          error: error.message
        });
        console.log(`❌ ${platform.name} installation failed: ${error.message}`);
      }
    }
  }

  /**
   * Install to a specific platform
   */
  async installToPlatform(platform) {
    const config = await this.generatePlatformConfig(platform.id);
    
    // Ensure config directory exists
    const configDir = dirname(platform.configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Read existing config if it exists
    let existingConfig = {};
    try {
      const existingContent = await fs.readFile(platform.configPath, 'utf-8');
      existingConfig = JSON.parse(existingContent);
    } catch {
      // File doesn't exist or is invalid, start with empty config
    }

    // Merge configurations
    const mergedConfig = this.mergeConfigs(existingConfig, config, platform.id);

    // Write updated configuration
    await fs.writeFile(platform.configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
  }

  /**
   * Generate platform-specific configuration
   */
  async generatePlatformConfig(platformId) {
    const serverPath = join(process.cwd(), 'dist', 'expanded-server.js');
    
    // Check if server file exists
    try {
      await fs.access(serverPath);
    } catch {
      throw new Error(`Server file not found: ${serverPath}. Please run 'npm run build' first.`);
    }

    const baseConfig = {
      command: 'node',
      args: [serverPath],
      env: this.getEnvironmentVariables(),
      timeout: 60
    };

    // Platform-specific configuration
    switch (platformId) {
      case 'claude-desktop':
        return {
          mcpServers: {
            'open-search-mcp': baseConfig
          }
        };
      
      case 'cursor':
        return {
          mcpServers: {
            'open-search-mcp': {
              ...baseConfig,
              autoApprove: this.getAutoApproveTools()
            }
          }
        };
      
      case 'vscode':
        return {
          'mcp.servers': {
            'open-search-mcp': {
              ...baseConfig,
              autoStart: true,
              restart: true
            }
          }
        };

      case 'windsurf':
        return {
          servers: {
            'open-search-mcp': {
              type: 'mcp',
              protocol: 'http',
              endpoint: 'http://localhost:8000/mcp',
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
            }
          },
          ui: {
            theme: 'auto',
            notifications: true,
            autoStart: true
          }
        };

      case 'augment-code':
        return {
          mcpServers: {
            'open-search-mcp': {
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
            }
          },
          settings: {
            theme: 'auto',
            notifications: true,
            autoConnect: true,
            maxConnections: 10
          }
        };

      default:
        return { mcpServers: { 'open-search-mcp': baseConfig } };
    }
  }

  /**
   * Get environment variables for configuration
   */
  getEnvironmentVariables() {
    const env = { NODE_ENV: 'production' };
    
    // Add API keys if available
    const apiKeys = [
      'GITHUB_TOKEN',
      'ALPHA_VANTAGE_API_KEY',
      'GOOGLE_API_KEY',
      'GOOGLE_SEARCH_ENGINE_ID',
      'NEWSAPI_KEY'
    ];

    apiKeys.forEach(key => {
      if (process.env[key]) {
        env[key] = process.env[key];
      }
    });

    return env;
  }

  /**
   * Get auto-approve tools list
   */
  getAutoApproveTools() {
    return [
      'search_arxiv',
      'search_github',
      'search_stackoverflow',
      'crawl_url_content',
      'batch_crawl_urls',
      'test_jsonplaceholder',
      'test_httpbin',
      'intelligent_research',
      'deep_research'
    ];
  }

  /**
   * Merge existing and new configurations
   */
  mergeConfigs(existing, newConfig, platformId) {
    const merged = { ...existing };

    switch (platformId) {
      case 'claude-desktop':
      case 'cursor':
        if (!merged.mcpServers) merged.mcpServers = {};
        merged.mcpServers['open-search-mcp'] = newConfig.mcpServers['open-search-mcp'];
        break;
      
      case 'vscode':
        if (!merged['mcp.servers']) merged['mcp.servers'] = {};
        merged['mcp.servers']['open-search-mcp'] = newConfig['mcp.servers']['open-search-mcp'];
        break;

      case 'windsurf':
        if (!merged.servers) merged.servers = {};
        merged.servers['open-search-mcp'] = newConfig.servers['open-search-mcp'];
        if (newConfig.ui) merged.ui = newConfig.ui;
        break;

      case 'augment-code':
        if (!merged.mcpServers) merged.mcpServers = {};
        merged.mcpServers['open-search-mcp'] = newConfig.mcpServers['open-search-mcp'];
        if (newConfig.settings) merged.settings = newConfig.settings;
        break;
    }

    return merged;
  }

  /**
   * Show installation summary
   */
  showInstallationSummary() {
    console.log('\n🎉 Installation Summary:\n');
    
    if (this.installedPlatforms.length > 0) {
      console.log(`✅ Successfully installed to ${this.installedPlatforms.length} platform(s):`);
      this.installedPlatforms.forEach(platform => {
        const platformConfig = PLATFORMS[platform.id];
        console.log(`  • ${platform.name}`);
        console.log(`    Instructions: ${platformConfig.installInstructions}`);
      });
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Failed installations (${this.errors.length}):`);
      this.errors.forEach(error => {
        console.log(`  • ${error.platform}: ${error.error}`);
      });
    }

    console.log('\n📚 Next Steps:');
    console.log('1. Restart the applications where Open-Search-MCP was installed');
    console.log('2. Verify the tools are working by trying a search command');
    console.log('3. Check the documentation for platform-specific usage instructions');
    
    if (this.installedPlatforms.length > 0) {
      console.log('\n🎯 Open-Search-MCP is ready to use!');
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const installer = new MultiPlatformInstaller();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Open-Search-MCP Multi-Platform Installer

Usage:
  node scripts/multi-platform-installer.js [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

This installer will automatically detect and configure Open-Search-MCP
for all supported platforms on your system.

Supported Platforms:
  • Claude Desktop
  • Cursor IDE  
  • Visual Studio Code

Prerequisites:
  • Node.js installed
  • Project built (run 'npm run build')
  • Target applications installed
`);
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    console.log(`Open-Search-MCP v${packageJson.version}`);
    return;
  }

  await installer.install();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Installer error:', error);
    process.exit(1);
  });
}

export { MultiPlatformInstaller };
