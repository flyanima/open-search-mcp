# 💻 VS Code Integration Guide

Complete guide for integrating Open-Search-MCP with Visual Studio Code.

## 📋 Prerequisites

### Required Software
- **Visual Studio Code** (latest version)
- **Node.js** ≥ 18.0.0
- **MCP Extension** (see installation options below)

### Verification
```bash
# Check VS Code installation
code --version

# Check Node.js
node --version
npm --version

# Verify project build
cd open-search-mcp
npm run build
ls -la dist/expanded-server.js
```

## 🚀 Installation Methods

### Method 1: Automatic Installation (Recommended)
```bash
# Navigate to project directory
cd open-search-mcp

# Install to VS Code automatically
npm run install:vscode
```

### Method 2: Manual Configuration

#### Step 1: Install MCP Extension
Choose one of these MCP extensions:

**Option A: Official MCP Extension (if available)**
1. Open VS Code
2. Go to Extensions (Ctrl/Cmd+Shift+X)
3. Search for "Model Context Protocol"
4. Install the official extension

**Option B: Community MCP Extensions**
- Search for "MCP" or "Model Context Protocol" in the marketplace
- Choose a well-maintained extension with good reviews

#### Step 2: Configure Settings
1. Open VS Code Settings (Ctrl/Cmd+,)
2. Search for "MCP" or open `settings.json`
3. Add the following configuration:

```json
{
  "mcp.servers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/open-search-mcp/dist/expanded-server.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "ALPHA_VANTAGE_API_KEY": "your_alpha_vantage_key_here"
      },
      "autoStart": true,
      "restart": true,
      "timeout": 60
    }
  }
}
```

## 🔧 Configuration Details

### Settings File Location
- **Windows**: `%APPDATA%\Code\User\settings.json`
- **macOS**: `~/Library/Application Support/Code/User/settings.json`
- **Linux**: `~/.config/Code/User/settings.json`

### Complete Configuration Example
```json
{
  "mcp.servers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["/Users/username/projects/open-search-mcp/dist/expanded-server.js"],
      "env": {
        "NODE_ENV": "production",
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
        "ALPHA_VANTAGE_API_KEY": "XXXXXXXXXXXXXXXX",
        "GOOGLE_API_KEY": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "GOOGLE_SEARCH_ENGINE_ID": "xxxxxxxxxxxxxxxxx",
        "NEWSAPI_KEY": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "LOG_LEVEL": "info"
      },
      "autoStart": true,
      "restart": true,
      "timeout": 60,
      "maxRetries": 3
    }
  },
  "mcp.enableLogging": true,
  "mcp.logLevel": "info"
}
```

## 🎮 Usage Guide

### Command Palette Access
1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Type "MCP" to see available commands:
   - `MCP: Search arXiv`
   - `MCP: Search GitHub`
   - `MCP: Intelligent Research`
   - `MCP: Crawl URL`

### Chat Interface (if supported by extension)
```
# Academic search
Search for "quantum computing" papers on arXiv

# Developer search
Find React hooks examples on GitHub

# Web analysis
Analyze the content of https://example.com

# Comprehensive research
Research "artificial intelligence ethics" comprehensively
```

### Keyboard Shortcuts
Add custom shortcuts in `keybindings.json`:
```json
[
  {
    "key": "ctrl+shift+a",
    "command": "mcp.searchArxiv",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+shift+g",
    "command": "mcp.searchGitHub",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+shift+r",
    "command": "mcp.intelligentResearch",
    "when": "editorTextFocus"
  }
]
```

## 🔍 Available Tools

### Academic Research (7 tools)
- `search_arxiv` - arXiv preprints and papers
- `search_pubmed` - Medical and life science literature
- `search_ieee` - Engineering and technology papers
- `search_semantic_scholar` - AI-enhanced academic search
- `search_iacr` - Cryptography and security research
- `search_biorxiv` - Biology preprints
- `search_medrxiv` - Medical preprints

### Developer Tools (4 tools)
- `search_github` - GitHub repositories and code
- `search_stackoverflow` - Programming Q&A
- `search_gitlab` - GitLab projects
- `search_bitbucket` - Bitbucket repositories

### Search Engines (4 tools)
- `search_searx` - Privacy-focused meta-search
- `search_startpage` - Private web search
- `search_brave` - Independent search engine
- `search_ecosia` - Eco-friendly search

### Web & Analysis (8 tools)
- `crawl_url_content` - Single page content extraction
- `batch_crawl_urls` - Multiple page crawling
- `analyze_pdf` - PDF document analysis
- `test_jsonplaceholder` - JSON API testing
- `test_httpbin` - HTTP request testing
- `intelligent_research` - Multi-source research
- `deep_research` - Iterative deep research
- `visualize_thinking` - Process visualization

### Research Tools (3 tools)
- `decompose_thinking` - Complex problem breakdown
- `check_research_saturation` - Research completeness check

## 🧪 Testing Installation

### Quick Test
1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Run "MCP: List Tools" (if available)
3. Try "MCP: Search GitHub" with query "hello world"

### Manual Testing
Open VS Code terminal and test the server:
```bash
# Test server directly
node dist/expanded-server.js

# Should show MCP initialization
```

### Extension-Specific Testing
Depends on the MCP extension you're using. Common patterns:
- Check Output panel for "Open-Search-MCP" logs
- Look for MCP status in status bar
- Try extension-specific commands

## 🔧 Troubleshooting

### Common Issues

#### 1. "MCP Server not responding"
**Symptoms**: Extension shows server as offline
**Solution**:
```bash
# Check server path
ls -la /path/to/dist/expanded-server.js

# Test server manually
node dist/expanded-server.js

# Check Node.js path in VS Code
code --version
which node
```

#### 2. "Extension not found"
**Symptoms**: No MCP commands in Command Palette
**Solution**:
1. Install an MCP extension from marketplace
2. Reload VS Code window (Ctrl/Cmd+Shift+P → "Developer: Reload Window")
3. Check Extensions view for enabled MCP extension

#### 3. "Configuration not loaded"
**Symptoms**: Settings don't take effect
**Solution**:
```json
// Verify settings.json syntax
{
  "mcp.servers": {
    "open-search-mcp": {
      // ... configuration
    }
  }
}
```

#### 4. "API rate limits"
**Symptoms**: Some tools fail with rate limit errors
**Solution**: Add API tokens to configuration

### Debug Mode
```json
{
  "mcp.servers": {
    "open-search-mcp": {
      "env": {
        "DEBUG": "open-search-mcp:*",
        "LOG_LEVEL": "debug"
      }
    }
  },
  "mcp.enableLogging": true,
  "mcp.logLevel": "debug"
}
```

### Log Locations
- **VS Code Output**: View → Output → Select "Open-Search-MCP"
- **Developer Console**: Help → Toggle Developer Tools
- **Extension Logs**: Depends on MCP extension used

## ⚙️ Advanced Configuration

### Workspace-Specific Settings
Create `.vscode/settings.json` in your project:
```json
{
  "mcp.servers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["../open-search-mcp/dist/expanded-server.js"],
      "env": {
        "PROJECT_CONTEXT": "true",
        "WORKSPACE_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

### Custom Tool Selection
```json
{
  "mcp.servers": {
    "open-search-mcp": {
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
  "mcp.servers": {
    "open-search-mcp": {
      "timeout": 120,
      "maxRetries": 5,
      "env": {
        "MAX_CONCURRENT_REQUESTS": "3",
        "CACHE_TTL": "3600"
      }
    }
  }
}
```

## 🔄 Updates and Maintenance

### Updating Open-Search-MCP
```bash
# Pull latest changes
git pull origin main

# Rebuild
npm run build

# Update VS Code configuration
npm run install:vscode
```

### Extension Updates
1. Check Extensions view for updates
2. Update MCP extension when available
3. Reload VS Code window after updates

### Settings Sync
VS Code Settings Sync will automatically sync your MCP configuration across devices (API keys excluded for security).

## 🎨 Customization

### Custom Commands
Add to `settings.json`:
```json
{
  "mcp.customCommands": {
    "quickArxivSearch": {
      "tool": "search_arxiv",
      "prompt": "Enter search terms for arXiv:",
      "keybinding": "ctrl+shift+a"
    },
    "quickGitHubSearch": {
      "tool": "search_github", 
      "prompt": "Enter GitHub search query:",
      "keybinding": "ctrl+shift+g"
    }
  }
}
```

### UI Customization
```json
{
  "mcp.ui.showStatusBar": true,
  "mcp.ui.showNotifications": true,
  "mcp.ui.theme": "dark"
}
```

## 🤝 Support

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/your-username/open-search-mcp/issues)
- **VS Code Community**: [VS Code Discord](https://discord.gg/vscode)
- **Extension Support**: Check your MCP extension's documentation

### Reporting Bugs
Include:
1. VS Code version (`code --version`)
2. MCP extension name and version
3. Configuration (remove API keys)
4. Error messages from Output panel
5. Steps to reproduce

### Contributing
- Help test different MCP extensions
- Report compatibility issues
- Contribute VS Code-specific features
- Improve documentation

---

**🎉 You're ready to use Open-Search-MCP with VS Code!**

Start with Command Palette → "MCP: Search GitHub" and explore all 33 available tools.
