# ❓ Frequently Asked Questions

Common questions and answers about Open-Search-MCP.

## 🚀 Getting Started

### Q: What is Open-Search-MCP?
**A:** Open-Search-MCP is a free, open-source Model Context Protocol (MCP) server that provides 33 powerful search and research tools. It integrates with AI platforms like Claude Desktop, Cursor IDE, VS Code, and more to enhance your research capabilities.

### Q: Which platforms are supported?
**A:** We support 6 major platforms:
- ✅ **Claude Desktop** (Production)
- ✅ **Cursor IDE** (Production) 
- ✅ **VS Code** (Beta)
- 🚧 **Windsurf** (Beta)
- 🚧 **Augment Code** (Beta)
- ✅ **Cline** (Production)

### Q: Is it really free?
**A:** Yes! Open-Search-MCP is completely free and open-source under the MIT license. No subscriptions, no API costs for basic functionality. Some optional features may require free API keys from third-party services.

### Q: How long does setup take?
**A:** About 5 minutes for basic setup:
- 2 minutes: Clone and build
- 1 minute: Auto-install to platforms
- 2 minutes: Test first search

## 🔧 Installation & Setup

### Q: The auto-installer didn't detect my platform. What should I do?
**A:** Try manual installation:
```bash
# Check what was detected
npm run platforms:detect

# Manual install for specific platform
npm run install:claude    # or cursor, vscode, etc.

# Verify installation
npm run health:platforms
```

### Q: I get "Server not found" errors. How do I fix this?
**A:** This usually means the project isn't built or the path is wrong:
```bash
# Check if server file exists
ls -la dist/expanded-server.js

# Rebuild if missing
npm run build

# Check Node.js is accessible
which node
node --version
```

### Q: Do I need API keys to use Open-Search-MCP?
**A:** No, most tools work without API keys! However, adding keys improves performance:
- **GitHub Token**: Higher rate limits for GitHub search
- **Alpha Vantage**: Required for financial tools
- **Google API**: Backup search capabilities
- **News API**: Enhanced news search

### Q: How do I add API keys?
**A:** Set them as environment variables:
```bash
export GITHUB_TOKEN="your_token_here"
export ALPHA_VANTAGE_API_KEY="your_key_here"
# Restart your platform after setting keys
```

## 🎯 Usage

### Q: What can I search for?
**A:** Almost anything! Here are examples:
- **Academic**: "Search for quantum computing papers on arXiv"
- **Code**: "Find React hooks examples on GitHub"
- **News**: "Search for AI news"
- **Web**: "Crawl content from https://example.com"
- **Research**: "Perform comprehensive research on climate change"

### Q: How many tools are available?
**A:** 33 tools across 6 categories:
- 7 Academic research tools
- 4 Developer tools
- 4 Search engines
- 8 Web & analysis tools
- 3 Research tools
- 7 Financial tools

### Q: Can I use multiple tools in one request?
**A:** Yes! Try commands like:
- "Research machine learning using arXiv, GitHub, and Stack Overflow"
- "Find information about Tesla from financial news and company data"

### Q: Do the tools work in real-time?
**A:** Depends on the platform:
- **Claude Desktop, Cursor, VS Code**: Standard request-response
- **Windsurf**: HTTP-based with health checks
- **Augment Code**: Real-time WebSocket updates

## 🔍 Platform-Specific Questions

### Q: Why isn't Cursor working?
**A:** Make sure you have the Cline extension installed:
1. Open Cursor IDE
2. Go to Extensions (Ctrl/Cmd+Shift+X)
3. Search for "Cline" and install
4. Restart Cursor
5. Try the installation again: `npm run install:cursor`

### Q: VS Code says "MCP extension not found"
**A:** You need an MCP extension:
1. Search for "MCP" or "Model Context Protocol" in VS Code marketplace
2. Install a compatible extension
3. Reload VS Code window
4. Try: `npm run install:vscode`

### Q: How do I use Windsurf with HTTP mode?
**A:** Windsurf requires running an HTTP server:
```bash
# Generate config
npm run install:windsurf

# Start HTTP server
npm run server:http

# Import the generated windsurf-mcp-config.json in Windsurf
```

### Q: Augment Code WebSocket connection fails
**A:** Check WebSocket server status:
```bash
# Start WebSocket server
npm run server:websocket

# Test connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8001

# Check firewall settings for port 8001
```

## ⚡ Performance & Troubleshooting

### Q: Searches are slow. How can I speed them up?
**A:** Several optimization options:
1. **Add API keys** for higher rate limits
2. **Use specific tools** instead of general search
3. **Check network connection**
4. **Restart the platform** if it's been running long

### Q: I get rate limit errors
**A:** Add API tokens to increase limits:
```bash
# GitHub token gives 5000 requests/hour vs 60 without
export GITHUB_TOKEN="ghp_your_token_here"

# Restart your platform after adding tokens
```

### Q: Some tools return "implementation pending"
**A:** This shouldn't happen in the current version. If you see this:
1. Make sure you're using the latest version
2. Rebuild the project: `npm run build`
3. Check you're using the right server file (expanded-server.js)

### Q: Memory usage is high
**A:** Try these optimizations:
```bash
# Limit concurrent requests
export MAX_CONCURRENT_REQUESTS=3

# Reduce cache size
export CACHE_TTL=1800

# Restart your platform
```

## 🔒 Security & Privacy

### Q: Is my data secure?
**A:** Yes:
- All searches go directly to public APIs
- No data is stored permanently
- API keys are only used for authentication
- Open source - you can audit the code

### Q: What data is collected?
**A:** Minimal data for functionality:
- Search queries (to perform searches)
- API responses (temporarily cached)
- Error logs (for debugging)
- No personal data is stored or transmitted

### Q: Can I use this offline?
**A:** No, Open-Search-MCP requires internet access to query external APIs and services. However, once results are retrieved, they're available until you restart.

## 🛠️ Development & Customization

### Q: Can I add custom tools?
**A:** Yes! The architecture is modular:
1. Create a new tool in `src/tools/`
2. Register it in the tool registry
3. Rebuild and test
4. See our [development guide](docs/DEVELOPMENT.md)

### Q: How do I contribute?
**A:** We welcome contributions!
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Q: Can I deploy this for my team?
**A:** Absolutely! Options include:
- **Shared configuration**: Same config across team
- **Central server**: HTTP/WebSocket server for multiple clients
- **Docker deployment**: Containerized deployment
- See our [deployment guide](docs/DEPLOYMENT.md)

## 🆘 Still Need Help?

### Q: Where can I get more help?
**A:** Multiple support channels:
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community help
- **Documentation**: Comprehensive guides in `docs/`
- **Discord**: Real-time community support (link in README)

### Q: How do I report a bug?
**A:** Please include:
1. Platform and version
2. Error messages
3. Steps to reproduce
4. Configuration (remove API keys)
5. Expected vs actual behavior

### Q: Can I request new features?
**A:** Yes! We love feature requests:
1. Check existing issues first
2. Open a new issue with "Feature Request" label
3. Describe the use case and expected behavior
4. We'll discuss and prioritize

---

## 📚 Quick Links

- **[Quick Start Guide](QUICK_START.md)** - Get running in 5 minutes
- **[Platform Guides](platforms/)** - Detailed setup for each platform
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[API Setup](API_SETUP.md)** - Configure API keys
- **[Development Guide](DEVELOPMENT.md)** - Contribute to the project

---

*Don't see your question? [Open an issue](https://github.com/your-username/open-search-mcp/issues) or [start a discussion](https://github.com/your-username/open-search-mcp/discussions)!*
