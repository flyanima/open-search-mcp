# ⚡ Augment Code Integration Guide

Complete guide for integrating Open-Search-MCP with Augment Code using WebSocket transport for real-time communication.

## 📋 Prerequisites

### Required Software
- **Augment Code** (latest version)
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

# Install to Augment Code automatically
npm run install:augment
```

This will:
- ✅ Generate WebSocket-based configuration
- ✅ Create augment-mcp-config.json
- ✅ Set up real-time communication
- ✅ Configure reconnection settings
- ✅ Enable analytics features

### Method 2: Manual Configuration

#### Step 1: Generate Configuration
```bash
# Generate Augment Code configuration
npm run config:augment > augment-mcp-config.json
```

#### Step 2: Start WebSocket Server
```bash
# Start MCP WebSocket server
npm run server:websocket

# Or with custom port
MCP_WS_PORT=8002 npm run server:websocket
```

#### Step 3: Configure Augment Code
1. Open Augment Code
2. Go to **Settings** → **MCP Servers**
3. Import the generated `augment-mcp-config.json`
4. Or manually add server configuration

## 🔧 Configuration Details

### Configuration File Structure
```json
{
  "mcpServers": {
    "open-search-mcp": {
      "transport": "websocket",
      "endpoint": "ws://localhost:8001",
      "command": "node",
      "args": ["dist/expanded-server.js"],
      "env": {
        "NODE_ENV": "production",
        "MCP_TRANSPORT": "websocket",
        "MCP_WS_PORT": "8001",
        "MCP_WS_HOST": "localhost",
        "GITHUB_TOKEN": "your_token_here"
      },
      "timeout": 120,
      "reconnect": {
        "enabled": true,
        "maxAttempts": 5,
        "delay": 3000
      },
      "features": {
        "realTimeUpdates": true,
        "analytics": true,
        "collaboration": false
      }
    }
  },
  "settings": {
    "theme": "auto",
    "notifications": true,
    "autoConnect": true,
    "maxConnections": 10
  }
}
```

### Environment Variables
```bash
# WebSocket server configuration
export MCP_WS_PORT=8001
export MCP_WS_HOST=localhost
export MCP_TRANSPORT=websocket

# Connection settings
export MCP_MAX_CONNECTIONS=100
export MCP_HEARTBEAT_INTERVAL=30000

# API keys
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
export ALPHA_VANTAGE_API_KEY="XXXXXXXXXXXXXXXX"
export GOOGLE_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

## 🎮 Usage Guide

### Starting the WebSocket Server
```bash
# Method 1: Using npm script
npm run server:websocket

# Method 2: Direct command
MCP_TRANSPORT=websocket node dist/expanded-server.js

# Method 3: Custom configuration
MCP_WS_PORT=8002 MCP_WS_HOST=0.0.0.0 npm run server:websocket
```

### WebSocket Features
- **Real-time Updates**: Live search results and notifications
- **Bidirectional Communication**: Server can push updates to client
- **Connection Management**: Automatic reconnection and heartbeat
- **Analytics**: Usage tracking and performance metrics
- **Collaboration**: Shared sessions (if enabled)

### Using Tools in Augment Code
Once configured, you can use Open-Search-MCP tools with real-time features:

```
# Real-time academic search
Search for "quantum computing" papers on arXiv
# Results stream in real-time as they're found

# Live GitHub monitoring
Monitor React repositories for new releases
# Get notifications when new releases are published

# Collaborative research
Start collaborative research session on "AI ethics"
# Share findings with team members in real-time
```

## 🔍 Available Tools

### Academic Research (7 tools)
- `search_arxiv` - arXiv papers with real-time updates
- `search_pubmed` - Medical literature with live results
- `search_ieee` - Engineering papers
- `search_semantic_scholar` - AI-enhanced search
- `search_iacr` - Cryptography research
- `search_biorxiv` - Biology preprints
- `search_medrxiv` - Medical preprints

### Developer Tools (4 tools)
- `search_github` - GitHub repos with live monitoring
- `search_stackoverflow` - Programming Q&A
- `search_gitlab` - GitLab projects
- `search_bitbucket` - Bitbucket repos

### Search Engines (4 tools)
- `search_searx` - Privacy-focused search
- `search_startpage` - Private web search
- `search_brave` - Independent search
- `search_ecosia` - Eco-friendly search

### Web & Analysis (8 tools)
- `crawl_url_content` - Real-time page extraction
- `batch_crawl_urls` - Parallel crawling with progress
- `analyze_pdf` - PDF analysis with streaming
- `test_jsonplaceholder` - API testing
- `test_httpbin` - HTTP testing
- `intelligent_research` - Multi-source research
- `deep_research` - Iterative research with updates
- `visualize_thinking` - Process visualization

### Research Tools (3 tools)
- `decompose_thinking` - Problem breakdown
- `check_research_saturation` - Completeness check

## 🧪 Testing Installation

### WebSocket Connection Test
```bash
# Test WebSocket server
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8001

# Expected response headers
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

### MCP Protocol Test
```javascript
// JavaScript WebSocket test
const ws = new WebSocket('ws://localhost:8001');

ws.onopen = () => {
  // Test tools list
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  }));
};

ws.onmessage = (event) => {
  console.log('Response:', JSON.parse(event.data));
};
```

### Augment Code Integration Test
1. Open Augment Code
2. Check WebSocket connection status
3. Try a real-time search: "Search for 'machine learning' on arXiv"
4. Verify real-time updates are working

## 🔧 Troubleshooting

### Common Issues

#### 1. "WebSocket connection failed"
**Symptoms**: Cannot establish WebSocket connection
**Solution**:
```bash
# Check if WebSocket server is running
netstat -an | grep 8001

# Start server if not running
npm run server:websocket

# Test connection manually
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8001
```

#### 2. "Connection keeps dropping"
**Symptoms**: Frequent disconnections
**Solution**: Adjust reconnection settings:
```json
{
  "reconnect": {
    "enabled": true,
    "maxAttempts": 10,
    "delay": 5000
  }
}
```

#### 3. "Real-time updates not working"
**Symptoms**: No live updates in results
**Solution**: Check feature configuration:
```json
{
  "features": {
    "realTimeUpdates": true,
    "analytics": true
  }
}
```

#### 4. "High memory usage"
**Symptoms**: Server consuming too much memory
**Solution**: Limit connections:
```bash
export MCP_MAX_CONNECTIONS=50
export MCP_HEARTBEAT_INTERVAL=60000
```

### Debug Mode
```bash
# Enable WebSocket debug logging
DEBUG=ws,open-search-mcp:* npm run server:websocket

# Monitor WebSocket traffic
DEBUG=ws npm run server:websocket
```

### Performance Monitoring
```bash
# Monitor WebSocket connections
ss -tuln | grep 8001

# Check server performance
top -p $(pgrep -f "expanded-server.js")
```

## ⚙️ Advanced Configuration

### Custom WebSocket Settings
```json
{
  "mcpServers": {
    "open-search-mcp": {
      "endpoint": "ws://192.168.1.100:8002",
      "env": {
        "MCP_WS_PORT": "8002",
        "MCP_WS_HOST": "192.168.1.100",
        "MCP_MAX_CONNECTIONS": "200",
        "MCP_HEARTBEAT_INTERVAL": "15000"
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
      "timeout": 180,
      "env": {
        "MAX_CONCURRENT_REQUESTS": "10",
        "CACHE_TTL": "3600",
        "WS_COMPRESSION": "true"
      }
    }
  }
}
```

---

**🎉 You're ready to use Open-Search-MCP with Augment Code!**

Start the WebSocket server with `npm run server:websocket` and experience real-time search: "Find latest AI papers on arXiv"
