# 🎯 Cursor IDE Integration Guide

Complete guide for integrating Open-Search-MCP with Cursor IDE using the Cline extension.

## 📋 Prerequisites

### Required Software
- **Cursor IDE** (latest version)
- **Node.js** ≥ 18.0.0
- **Cline Extension** (install from Cursor marketplace)

### Verification
```bash
# Check Cursor installation
cursor --version

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

# Install to Cursor automatically
npm run install:cursor
```

This will:
- ✅ Detect Cursor installation
- ✅ Generate configuration
- ✅ Install to correct location
- ✅ Configure auto-approve tools
- ✅ Set up API keys

### Method 2: Manual Configuration

#### Step 1: Install Cline Extension
1. Open Cursor IDE
2. Go to Extensions (Ctrl/Cmd+Shift+X)
3. Search for "Cline"
4. Install the extension by Anthropic

#### Step 2: Configure MCP Settings
1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Run "Cline: Open MCP Settings"
3. Add the following configuration:

```json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/open-search-mcp/dist/expanded-server.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "ALPHA_VANTAGE_API_KEY": "your_alpha_vantage_key_here"
      },
      "autoApprove": [
        "search_arxiv",
        "search_pubmed",
        "search_github",
        "search_stackoverflow",
        "crawl_url_content",
        "intelligent_research",
        "deep_research",
        "test_jsonplaceholder",
        "test_httpbin"
      ],
      "timeout": 60
    }
  }
}
```

## 🔧 Configuration Details

### Configuration File Location
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

### Environment Variables
```json
{
  "env": {
    "NODE_ENV": "production",
    "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx",
    "ALPHA_VANTAGE_API_KEY": "XXXXXXXXXXXXXXXX",
    "GOOGLE_API_KEY": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "GOOGLE_SEARCH_ENGINE_ID": "xxxxxxxxxxxxxxxxx",
    "NEWSAPI_KEY": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

### Auto-Approve Tools
Pre-approved tools that don't require user confirmation:

```json
{
  "autoApprove": [
    "search_arxiv",
    "search_pubmed", 
    "search_ieee",
    "search_semantic_scholar",
    "search_iacr",
    "search_biorxiv",
    "search_medrxiv",
    "search_github",
    "search_stackoverflow",
    "search_gitlab",
    "search_bitbucket",
    "search_searx",
    "search_startpage",
    "search_brave",
    "search_ecosia",
    "test_jsonplaceholder",
    "test_httpbin",
    "crawl_url_content",
    "analyze_pdf",
    "intelligent_research",
    "deep_research",
    "visualize_thinking",
    "decompose_thinking",
    "check_research_saturation"
  ]
}
```

## 🎮 Usage Guide

### Starting a Session
1. Open Cursor IDE
2. Open a project or create a new file
3. Open Cline panel (usually on the right side)
4. Start a new conversation

### Basic Commands
```
# Academic search
Search for "quantum computing" papers on arXiv

# Developer search  
Find React hooks examples on GitHub

# Web crawling
Extract content from https://example.com

# Intelligent research
Perform comprehensive research on "artificial intelligence ethics"

# Testing
Test the JSONPlaceholder API
```

### Advanced Usage
```
# Multi-source research
Research "climate change solutions" using arXiv, GitHub, and web sources

# Batch operations
Crawl these URLs and summarize the content: [url1, url2, url3]

# Thinking visualization
Visualize my thinking process for solving this complex problem

# Research saturation check
Check if my research on "machine learning" is comprehensive
```

## 🔍 Available Tools

### Academic Research (7 tools)
- `search_arxiv` - arXiv preprints
- `search_pubmed` - Medical literature
- `search_ieee` - Engineering papers
- `search_semantic_scholar` - AI-enhanced search
- `search_iacr` - Cryptography research
- `search_biorxiv` - Biology preprints
- `search_medrxiv` - Medical preprints

### Developer Tools (4 tools)
- `search_github` - GitHub repositories
- `search_stackoverflow` - Programming Q&A
- `search_gitlab` - GitLab projects
- `search_bitbucket` - Bitbucket repos

### Search Engines (4 tools)
- `search_searx` - Privacy-focused meta-search
- `search_startpage` - Private web search
- `search_brave` - Independent search
- `search_ecosia` - Eco-friendly search

### Web & Analysis (8 tools)
- `crawl_url_content` - Single page extraction
- `batch_crawl_urls` - Multiple page crawling
- `analyze_pdf` - PDF document analysis
- `test_jsonplaceholder` - API testing
- `test_httpbin` - HTTP testing
- `intelligent_research` - Multi-source research
- `deep_research` - Iterative research
- `visualize_thinking` - Process visualization

### Research Tools (3 tools)
- `decompose_thinking` - Problem breakdown
- `check_research_saturation` - Completeness check

## 🧪 Testing Installation

### Quick Test
1. Open Cline in Cursor
2. Type: "Search for 'hello world' on GitHub"
3. Verify the tool executes and returns results

### Comprehensive Test
```
Test all search tools:
1. Search arXiv for "machine learning"
2. Find GitHub repos for "react hooks"  
3. Search Stack Overflow for "python debugging"
4. Crawl content from https://example.com
5. Test JSONPlaceholder API
```

### Expected Output
Each tool should return structured JSON with:
- Source information
- Query parameters
- Results array
- Metadata (response time, status, etc.)

## 🔧 Troubleshooting

### Common Issues

#### 1. "MCP Server not found"
**Symptoms**: Cline shows "No MCP servers configured"
**Solution**:
```bash
# Verify configuration file exists
ls -la ~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/

# Check configuration format
cat cline_mcp_settings.json | jq .

# Reinstall if needed
npm run install:cursor
```

#### 2. "Command execution failed"
**Symptoms**: Tools fail with timeout or error
**Solution**:
```bash
# Test server manually
node dist/expanded-server.js

# Check Node.js path
which node

# Verify permissions
chmod +x dist/expanded-server.js
```

#### 3. "API rate limits exceeded"
**Symptoms**: Some searches fail with rate limit errors
**Solution**:
```json
{
  "env": {
    "GITHUB_TOKEN": "your_token_here"
  }
}
```

#### 4. Cline Extension Issues
**Symptoms**: Extension not working or crashing
**Solution**:
1. Update Cline extension
2. Restart Cursor IDE
3. Check Cursor Developer Tools (Ctrl/Cmd+Shift+I)
4. Clear extension cache

### Debug Mode
```json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["dist/expanded-server.js"],
      "env": {
        "DEBUG": "open-search-mcp:*",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Log Locations
- **Cursor Logs**: Help → Show Logs
- **Cline Logs**: Cline panel → Settings → View Logs
- **MCP Server Logs**: Check Cursor Developer Console

## ⚙️ Advanced Configuration

### Custom Tool Selection
```json
{
  "mcpServers": {
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
  "mcpServers": {
    "open-search-mcp": {
      "timeout": 120,
      "env": {
        "MAX_CONCURRENT_REQUESTS": "3",
        "CACHE_TTL": "3600"
      }
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
      ]
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

# Update configuration
npm run install:cursor
```

### Backup Configuration
```bash
# Backup current config
cp ~/.config/Cursor/.../cline_mcp_settings.json backup.json

# Restore if needed
cp backup.json ~/.config/Cursor/.../cline_mcp_settings.json
```

## 🤝 Support

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/your-username/open-search-mcp/issues)
- **Cursor Community**: [Cursor Discord](https://discord.gg/cursor)
- **Cline Support**: [Cline Documentation](https://github.com/cline/cline)

### Reporting Bugs
Include:
1. Cursor version
2. Cline extension version
3. Configuration file (remove API keys)
4. Error messages
5. Steps to reproduce

---

**🎉 You're ready to use Open-Search-MCP with Cursor IDE!**

Try your first search: "Find React components on GitHub" and explore the 33 available tools.
