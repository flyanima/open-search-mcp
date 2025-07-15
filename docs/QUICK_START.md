# 🚀 Quick Start Guide

Get Open-Search-MCP running in 5 minutes across multiple platforms!

## ⚡ Super Quick Setup

### 1. Install and Build (2 minutes)
```bash
# Clone the repository
git clone https://github.com/your-username/open-search-mcp.git
cd open-search-mcp

# Install dependencies and build
npm install
npm run build
```

### 2. Auto-Install to All Platforms (1 minute)
```bash
# Automatically detect and install to all supported platforms
npm run install:multi
```

### 3. Start Using (2 minutes)
Open your preferred platform and try:
```
Search for "machine learning" papers on arXiv
```

**🎉 That's it! You now have 33 powerful search and research tools available.**

---

## 📱 Platform-Specific Quick Setup

### Claude Desktop (Recommended)
```bash
# Install to Claude Desktop
npm run install:claude

# Restart Claude Desktop
# Try: "Search for React hooks on GitHub"
```

### Cursor IDE
```bash
# Install to Cursor (requires Cline extension)
npm run install:cursor

# Restart Cursor IDE
# Try: "Find Python tutorials on Stack Overflow"
```

### VS Code
```bash
# Install to VS Code (requires MCP extension)
npm run install:vscode

# Reload VS Code window
# Try: "Search for TypeScript examples"
```

### Windsurf IDE (HTTP Mode)
```bash
# Generate config and start HTTP server
npm run install:windsurf
npm run server:http

# Import config in Windsurf Settings → MCP Servers
# Try: "Research quantum computing papers"
```

### Augment Code (WebSocket Mode)
```bash
# Generate config and start WebSocket server
npm run install:augment
npm run server:websocket

# Import config in Augment Code Settings → MCP Servers
# Try: "Monitor AI research trends in real-time"
```

---

## 🔧 Essential Configuration

### API Keys (Optional but Recommended)
Add these to your environment for better performance:

```bash
# GitHub (higher rate limits)
export GITHUB_TOKEN="ghp_your_token_here"

# Alpha Vantage (financial data)
export ALPHA_VANTAGE_API_KEY="your_key_here"

# Google Custom Search (backup search)
export GOOGLE_API_KEY="your_key_here"
export GOOGLE_SEARCH_ENGINE_ID="your_engine_id"

# News API (news search)
export NEWSAPI_KEY="your_key_here"
```

### Health Check
```bash
# Verify installation across all platforms
npm run health:platforms

# Expected output:
# ✅ Claude Desktop: Configured and healthy
# ✅ Cursor IDE: Configured and healthy
# ✅ VS Code: Configured and healthy
```

---

## 🎯 Try These Commands

### Academic Research
```
Search for "artificial intelligence" papers on arXiv
Find medical research about "cancer treatment" on PubMed
Look up "quantum computing" papers on IEEE
```

### Developer Tools
```
Search for "React hooks" examples on GitHub
Find "Python debugging" solutions on Stack Overflow
Look for "machine learning" projects on GitLab
```

### Web Research
```
Crawl content from https://example.com
Analyze this PDF document: [upload or provide URL]
Perform intelligent research on "climate change solutions"
```

### Advanced Features
```
Visualize my thinking process for this problem
Decompose this complex task into smaller steps
Check if my research on "AI ethics" is comprehensive
```

---

## 🔍 All 33 Available Tools

### 📚 Academic Research (7 tools)
- `search_arxiv` - arXiv preprints
- `search_pubmed` - Medical literature  
- `search_ieee` - Engineering papers
- `search_semantic_scholar` - AI-enhanced search
- `search_iacr` - Cryptography research
- `search_biorxiv` - Biology preprints
- `search_medrxiv` - Medical preprints

### 💻 Developer Tools (4 tools)
- `search_github` - GitHub repositories
- `search_stackoverflow` - Programming Q&A
- `search_gitlab` - GitLab projects
- `search_bitbucket` - Bitbucket repos

### 🔍 Search Engines (4 tools)
- `search_searx` - Privacy-focused search
- `search_startpage` - Private web search
- `search_brave` - Independent search
- `search_ecosia` - Eco-friendly search

### 🌐 Web & Analysis (8 tools)
- `crawl_url_content` - Single page extraction
- `batch_crawl_urls` - Multiple page crawling
- `analyze_pdf` - PDF document analysis
- `test_jsonplaceholder` - JSON API testing
- `test_httpbin` - HTTP request testing
- `intelligent_research` - Multi-source research
- `deep_research` - Iterative deep research
- `visualize_thinking` - Process visualization

### 🧠 Research Tools (3 tools)
- `decompose_thinking` - Problem breakdown
- `check_research_saturation` - Completeness check

### 💰 Financial Tools (7 tools)
- `search_financial_news` - Financial news
- `get_stock_quote` - Real-time stock data
- `get_company_overview` - Company information
- `track_portfolio` - Portfolio tracking
- `perform_market_analysis` - Market analysis
- `get_economic_indicators` - Economic data
- `analyze_market_trends` - Trend analysis

---

## 🚨 Troubleshooting

### "Server not found" Error
```bash
# Check if project is built
ls -la dist/expanded-server.js

# Rebuild if necessary
npm run build
```

### "Permission denied" Error
```bash
# Fix permissions
chmod +x dist/expanded-server.js

# Check Node.js path
which node
```

### "API rate limits" Error
```bash
# Add GitHub token for higher limits
export GITHUB_TOKEN="your_token_here"

# Restart your platform after setting tokens
```

### Platform Not Detected
```bash
# Check platform installation
npm run platforms:detect

# Manual installation
npm run install:claude    # or cursor, vscode, etc.
```

---

## 📚 Next Steps

### Learn More
- **Platform Guides**: [docs/platforms/](docs/platforms/) - Detailed setup for each platform
- **Tool Documentation**: [docs/tools/](docs/tools/) - Complete tool reference
- **API Configuration**: [docs/api-setup.md](docs/api-setup.md) - API key setup guide

### Advanced Usage
- **Custom Configurations**: Modify settings for your workflow
- **Performance Tuning**: Optimize for your use case
- **Team Deployment**: Set up for multiple users

### Get Help
- **Issues**: [GitHub Issues](https://github.com/your-username/open-search-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/open-search-mcp/discussions)
- **Community**: Join our Discord server

---

## 🎯 Success Checklist

- [ ] Project cloned and built successfully
- [ ] At least one platform configured
- [ ] Health check passes
- [ ] First search command works
- [ ] API keys configured (optional)
- [ ] Explored different tool categories

**🎉 Congratulations! You're now ready to supercharge your research and development workflow with Open-Search-MCP!**

---

*Need help? Check our [troubleshooting guide](docs/TROUBLESHOOTING.md) or [open an issue](https://github.com/your-username/open-search-mcp/issues).*
