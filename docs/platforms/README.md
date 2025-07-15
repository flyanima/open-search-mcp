# 🚀 Multi-Platform Integration Guide

Open-Search-MCP supports multiple AI development platforms and editors. This guide provides comprehensive integration instructions for each supported platform.

## 📊 Platform Support Matrix

| Platform | Status | Transport | Auto-Install | Manual Config | Documentation |
|----------|--------|-----------|--------------|---------------|---------------|
| **Claude Desktop** | ✅ Production | stdio | ✅ | ✅ | [Guide](claude-desktop.md) |
| **Cursor IDE** | ✅ Production | stdio | ✅ | ✅ | [Guide](cursor.md) |
| **VS Code** | ✅ Beta | stdio/http | ✅ | ✅ | [Guide](vscode.md) |
| **Windsurf** | 🚧 Beta | http | ⚠️ | ✅ | [Guide](windsurf.md) |
| **Augment Code** | 🚧 Beta | websocket | ⚠️ | ✅ | [Guide](augment-code.md) |
| **Cline** | ✅ Production | stdio | ✅ | ✅ | [Guide](cline.md) |

## 🎯 Quick Start

### Automatic Installation (Recommended)
```bash
# Install to all detected platforms
npm run install:multi

# Install to specific platform
npm run install:claude    # Claude Desktop
npm run install:cursor    # Cursor IDE
npm run install:vscode    # VS Code
```

### Manual Configuration
```bash
# Generate configuration for specific platform
npm run config:claude     # Claude Desktop config
npm run config:cursor     # Cursor IDE config
npm run config:vscode     # VS Code config
```

## 🔧 Platform-Specific Features

### Claude Desktop
- **Native MCP Support**: Full protocol compatibility
- **33 Tools Available**: All tools work seamlessly
- **Auto-restart**: Automatic server restart on crashes
- **Environment Variables**: Full API key support

### Cursor IDE (with Cline)
- **Auto-approve Tools**: Pre-configured safe tool list
- **Interactive Mode**: Real-time tool execution
- **Context Awareness**: Integrated with editor context
- **Custom Shortcuts**: Keyboard shortcuts for common searches

### VS Code
- **Extension Integration**: Works with MCP extensions
- **Command Palette**: Access tools via Ctrl/Cmd+Shift+P
- **Settings Sync**: Configuration syncs across devices
- **Workspace Support**: Project-specific configurations

### Windsurf
- **HTTP Transport**: RESTful API integration
- **Real-time Updates**: Live search results
- **Custom UI**: Native interface integration
- **Performance Optimized**: Efficient resource usage

### Augment Code
- **WebSocket Transport**: Real-time bidirectional communication
- **Advanced Analytics**: Usage statistics and insights
- **Team Collaboration**: Shared configurations
- **Enterprise Features**: Advanced security and compliance

## 🛠️ Installation Methods

### Method 1: Automatic Multi-Platform Installer
```bash
# Clone and build the project
git clone https://github.com/your-username/open-search-mcp.git
cd open-search-mcp
npm install
npm run build

# Run the installer
npm run install:multi
```

The installer will:
1. 🔍 Detect installed platforms
2. ⚙️ Generate appropriate configurations
3. 📝 Backup existing configurations
4. 🚀 Install Open-Search-MCP
5. ✅ Verify installation

### Method 2: Platform-Specific Installation
```bash
# For Claude Desktop
npm run install:claude

# For Cursor IDE
npm run install:cursor

# For VS Code
npm run install:vscode
```

### Method 3: Manual Configuration
1. Generate configuration:
   ```bash
   npm run config:generate -- --platform your-platform
   ```

2. Copy configuration to platform-specific location:
   - **Claude Desktop**: `~/.config/Claude/claude_desktop_config.json`
   - **Cursor**: `~/.config/Cursor/.../cline_mcp_settings.json`
   - **VS Code**: `~/.config/Code/User/settings.json`

## 🔑 API Keys Configuration

### Environment Variables
```bash
# GitHub (recommended for higher rate limits)
export GITHUB_TOKEN="your_github_token"

# Alpha Vantage (required for financial tools)
export ALPHA_VANTAGE_API_KEY="your_alpha_vantage_key"

# Google Custom Search (optional backup)
export GOOGLE_API_KEY="your_google_api_key"
export GOOGLE_SEARCH_ENGINE_ID="your_search_engine_id"

# News API (optional)
export NEWSAPI_KEY="your_newsapi_key"
```

### Platform-Specific Configuration
Each platform allows API keys to be configured in their respective configuration files. See platform-specific guides for details.

## 🧪 Testing Installation

### Health Check
```bash
# Check all platforms
npm run health:platforms

# Check specific platform
npm run health:check -- --platform cursor
```

### Manual Testing
1. **Open your platform** (Claude Desktop, Cursor, etc.)
2. **Start a new conversation/session**
3. **Try a search command**:
   ```
   Search for "machine learning" papers on arXiv
   ```
4. **Verify tools are working**:
   ```
   List available search tools
   ```

## 🔧 Troubleshooting

### Common Issues

#### 1. "Server not found" Error
**Solution**: Verify the server path in configuration
```bash
# Check if server file exists
ls -la dist/expanded-server.js

# Rebuild if necessary
npm run build
```

#### 2. "Permission denied" Error
**Solution**: Check file permissions and paths
```bash
# Fix permissions
chmod +x dist/expanded-server.js

# Verify Node.js is accessible
which node
node --version
```

#### 3. "API key not found" Error
**Solution**: Configure environment variables
```bash
# Check current environment
env | grep -E "(GITHUB|ALPHA|GOOGLE)"

# Set missing keys
export GITHUB_TOKEN="your_token_here"
```

#### 4. Platform-specific Issues
- **Claude Desktop**: Restart the application after configuration changes
- **Cursor**: Ensure Cline extension is installed and updated
- **VS Code**: Install MCP extension and reload window

### Debug Mode
```bash
# Enable debug logging
export DEBUG=open-search-mcp:*

# Run with verbose output
npm run server:stdio -- --verbose
```

### Log Files
- **Claude Desktop**: Check application logs in system log viewer
- **Cursor**: Open Developer Tools (Ctrl/Cmd+Shift+I)
- **VS Code**: Check Output panel → Open-Search-MCP

## 📚 Advanced Configuration

### Custom Tool Selection
```json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["dist/expanded-server.js"],
      "env": {
        "ENABLED_TOOLS": "search_arxiv,search_github,intelligent_research"
      }
    }
  }
}
```

### Performance Tuning
```json
{
  "mcpServers": {
    "open-search-mcp": {
      "timeout": 120,
      "maxConcurrency": 5,
      "cacheSize": "100MB"
    }
  }
}
```

### Security Settings
```json
{
  "mcpServers": {
    "open-search-mcp": {
      "autoApprove": [
        "search_arxiv",
        "search_github"
      ],
      "requireApproval": [
        "crawl_url_content",
        "batch_crawl_urls"
      ]
    }
  }
}
```

## 🤝 Contributing

### Adding New Platform Support
1. Create platform integration in `src/platforms/`
2. Add configuration generator support
3. Update installer script
4. Write platform-specific documentation
5. Add tests and validation

### Improving Existing Platforms
1. Test on your platform
2. Report issues with detailed logs
3. Submit pull requests with fixes
4. Update documentation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/open-search-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/open-search-mcp/discussions)
- **Platform-specific**: See individual platform guides

---

**🎯 Ready to integrate? Choose your platform and follow the specific guide!**
