# 🌊 Windsurf IDE Integration Guide

Complete guide for integrating Open-Search-MCP with Windsurf IDE using HTTP transport.

## 📋 Prerequisites

### Required Software
- **Windsurf IDE** (latest version)
- **Node.js** ≥ 18.0.0
- **Open-Search-MCP** (built project)

### Verification
```bash
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

# Install to Windsurf automatically
npm run install:windsurf
```

This will:
- ✅ Generate HTTP-based configuration
- ✅ Create windsurf-mcp-config.json
- ✅ Set up health check endpoints
- ✅ Configure API keys

### Method 2: Manual Configuration

#### Step 1: Generate Configuration
```bash
# Generate Windsurf configuration
npm run config:windsurf > windsurf-mcp-config.json
```

#### Step 2: Start HTTP Server
```bash
# Start MCP HTTP server
npm run server:http

# Or with custom port
MCP_HTTP_PORT=8001 npm run server:http
```

#### Step 3: Configure Windsurf
1. Open Windsurf IDE
2. Go to **Settings** → **MCP Servers**
3. Import the generated `windsurf-mcp-config.json`
4. Or manually add server configuration

## 🔧 Configuration Details

### Configuration File Structure
```json
{
  "servers": {
    "open-search-mcp": {
      "type": "mcp",
      "protocol": "http",
      "endpoint": "http://localhost:8000/mcp",
      "command": "node",
      "args": ["dist/expanded-server.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_TRANSPORT": "http",
        "MCP_HTTP_PORT": "8000",
        "MCP_HTTP_HOST": "localhost",
        "GITHUB_TOKEN": "your_token_here"
      },
      "timeout": 120,
      "retries": 3,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "endpoint": "http://localhost:8000/health"
      }
    }
  },
  "ui": {
    "theme": "auto",
    "notifications": true,
    "autoStart": true
  }
}
```

### Environment Variables
```bash
# Server configuration
export MCP_HTTP_PORT=8000
export MCP_HTTP_HOST=localhost
export MCP_TRANSPORT=http

# API keys
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
export ALPHA_VANTAGE_API_KEY="XXXXXXXXXXXXXXXX"
export GOOGLE_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX"
export NEWSAPI_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## 🎮 Usage Guide

### Starting the Server
```bash
# Method 1: Using npm script
npm run server:http

# Method 2: Direct command
MCP_TRANSPORT=http node dist/expanded-server.js

# Method 3: Custom configuration
MCP_HTTP_PORT=8001 MCP_HTTP_HOST=0.0.0.0 npm run server:http
```

### Server Endpoints
- **MCP Protocol**: `http://localhost:8000/mcp`
- **Health Check**: `http://localhost:8000/health`
- **Batch Requests**: `http://localhost:8000/mcp/batch`
- **Capabilities**: `http://localhost:8000/mcp/capabilities`

### Using Tools in Windsurf
Once configured, you can use Open-Search-MCP tools directly in Windsurf:

```
# Academic search
Search for "quantum computing" papers on arXiv

# Developer search
Find React components on GitHub

# Web analysis
Analyze content from https://example.com

# Comprehensive research
Research "artificial intelligence ethics" comprehensively
```

## 🔍 Available Tools

### Academic Research (7 tools)
- `search_arxiv` - arXiv preprints and papers
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
- `search_searx` - Privacy-focused search
- `search_startpage` - Private web search
- `search_brave` - Independent search
- `search_ecosia` - Eco-friendly search

### Web & Analysis (8 tools)
- `crawl_url_content` - Single page extraction
- `batch_crawl_urls` - Multiple page crawling
- `analyze_pdf` - PDF analysis
- `test_jsonplaceholder` - API testing
- `test_httpbin` - HTTP testing
- `intelligent_research` - Multi-source research
- `deep_research` - Iterative research
- `visualize_thinking` - Process visualization

### Research Tools (3 tools)
- `decompose_thinking` - Problem breakdown
- `check_research_saturation` - Completeness check

## 🧪 Testing Installation

### Health Check
```bash
# Test server health
curl http://localhost:8000/health

# Expected response
{
  "status": "healthy",
  "protocol": "MCP over HTTP",
  "version": "2024-11-05",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "tools": 33
}
```

### MCP Protocol Test
```bash
# Test tools list
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test tool execution
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"search_arxiv",
      "arguments":{"query":"machine learning"}
    },
    "id":2
  }'
```

### Windsurf Integration Test
1. Open Windsurf IDE
2. Check MCP server status in settings
3. Try a search command: "Search for 'hello world' on GitHub"
4. Verify results are returned

## 🔧 Troubleshooting

### Common Issues

#### 1. "Server not responding"
**Symptoms**: Windsurf shows server as offline
**Solution**:
```bash
# Check if server is running
curl http://localhost:8000/health

# Start server if not running
npm run server:http

# Check port availability
netstat -an | grep 8000
```

#### 2. "Connection refused"
**Symptoms**: Cannot connect to HTTP endpoint
**Solution**:
```bash
# Check firewall settings
# Windows
netsh advfirewall firewall add rule name="MCP HTTP" dir=in action=allow protocol=TCP localport=8000

# macOS/Linux
sudo ufw allow 8000

# Check if port is in use
lsof -i :8000
```

#### 3. "CORS errors"
**Symptoms**: Browser console shows CORS errors
**Solution**: CORS is enabled by default, but check configuration:
```json
{
  "servers": {
    "open-search-mcp": {
      "env": {
        "MCP_CORS_ORIGINS": "*"
      }
    }
  }
}
```

#### 4. "API rate limits"
**Symptoms**: Some tools fail with rate limit errors
**Solution**: Add API tokens to configuration

### Debug Mode
```bash
# Enable debug logging
DEBUG=open-search-mcp:* npm run server:http

# Or set environment variable
export DEBUG=open-search-mcp:*
npm run server:http
```

### Log Analysis
```bash
# Check server logs
tail -f logs/mcp-http-server.log

# Monitor HTTP requests
curl -v http://localhost:8000/health
```

## ⚙️ Advanced Configuration

### Custom Port and Host
```json
{
  "servers": {
    "open-search-mcp": {
      "endpoint": "http://192.168.1.100:8001/mcp",
      "env": {
        "MCP_HTTP_PORT": "8001",
        "MCP_HTTP_HOST": "192.168.1.100"
      },
      "healthCheck": {
        "endpoint": "http://192.168.1.100:8001/health"
      }
    }
  }
}
```

### Performance Tuning
```json
{
  "servers": {
    "open-search-mcp": {
      "timeout": 180,
      "retries": 5,
      "env": {
        "MAX_CONCURRENT_REQUESTS": "5",
        "CACHE_TTL": "7200"
      }
    }
  }
}
```

### Security Settings
```json
{
  "servers": {
    "open-search-mcp": {
      "env": {
        "MCP_CORS_ORIGINS": "https://windsurf.example.com",
        "MCP_API_KEYS": "your-api-key-here"
      }
    }
  }
}
```

### Load Balancing
```json
{
  "servers": {
    "open-search-mcp-1": {
      "endpoint": "http://localhost:8000/mcp"
    },
    "open-search-mcp-2": {
      "endpoint": "http://localhost:8001/mcp"
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

# Restart HTTP server
npm run server:http
```

### Configuration Updates
```bash
# Regenerate configuration
npm run config:windsurf > windsurf-mcp-config.json

# Reload in Windsurf
# Settings → MCP Servers → Reload Configuration
```

### Health Monitoring
```bash
# Automated health check
while true; do
  curl -s http://localhost:8000/health | jq .status
  sleep 30
done

# Or use monitoring script
npm run health:monitor
```

## 🤝 Support

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/your-username/open-search-mcp/issues)
- **Windsurf Community**: [Windsurf Discord](https://discord.gg/windsurf)
- **HTTP Transport**: Check server logs and network connectivity

### Reporting Bugs
Include:
1. Windsurf version
2. Server configuration (remove API keys)
3. HTTP server logs
4. Network connectivity test results
5. Steps to reproduce

### Performance Issues
- Monitor server response times
- Check concurrent request limits
- Analyze memory usage
- Review cache hit rates

---

**🎉 You're ready to use Open-Search-MCP with Windsurf IDE!**

Start the HTTP server with `npm run server:http` and try your first search: "Find machine learning papers on arXiv"
