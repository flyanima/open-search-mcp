# Open Search MCP - 安装配置指南

本指南详细介绍如何在各种AI开发工具和平台中安装和配置Open Search MCP服务器。

## 📋 目录

- [系统要求](#系统要求)
- [基础安装](#基础安装)
- [Claude Desktop](#claude-desktop)
- [Augment Codes](#augment-codes)
- [Cursor IDE](#cursor-ide)
- [VS Code](#vs-code)
- [Python客户端](#python客户端)
- [Web客户端](#web客户端)
- [故障排除](#故障排除)

## 🔧 系统要求

### 最低要求
- **Node.js**: ≥ 18.0.0
- **npm**: ≥ 9.0.0
- **内存**: ≥ 512MB
- **磁盘空间**: ≥ 1GB（用于缓存）

### 推荐配置
- **Node.js**: ≥ 20.0.0
- **内存**: ≥ 2GB
- **网络**: 稳定的互联网连接

### 验证环境
```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version

# 检查网络连接
ping google.com
```

## 📦 基础安装

### 全局安装（推荐）
```bash
# 安装Open Search MCP
npm install -g open-search-mcp

# 验证安装
open-search-mcp --version

# 测试运行
open-search-mcp --help
```

### 本地安装
```bash
# 创建项目目录
mkdir my-mcp-project
cd my-mcp-project

# 初始化项目
npm init -y

# 安装Open Search MCP
npm install open-search-mcp

# 测试运行
npx open-search-mcp --help
```

### 从源码安装
```bash
# 克隆仓库
git clone https://github.com/your-username/open-search-mcp.git
cd open-search-mcp

# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接
npm link
```

## 🤖 Claude Desktop

### 配置步骤

1. **找到配置文件**
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`

2. **编辑配置文件**
   ```json
   {
     "mcpServers": {
       "open-search": {
         "command": "npx",
         "args": ["-y", "open-search-mcp"],
         "env": {
           "LOG_LEVEL": "info",
           "GOOGLE_API_KEY": "your_optional_google_api_key",
           "BING_API_KEY": "your_optional_bing_api_key"
         }
       }
     }
   }
   ```

3. **重启Claude Desktop**
   - 完全退出Claude Desktop（不只是关闭窗口）
   - 重新启动Claude Desktop
   - 查看状态栏是否显示🔍图标

### 验证安装
在Claude Desktop中输入：
```
请使用web_search工具搜索"最新AI发展"
```

## 🚀 Augment Codes

### 方法1: 通过设置界面

1. **打开Augment Codes**
2. **进入设置**
   - 点击设置图标或使用快捷键
   - 找到"MCP Servers"或"模型上下文协议"选项

3. **添加新服务器**
   - 点击"添加服务器"或"+"按钮
   - 填写以下信息：
     - **名称**: `open-search`
     - **命令**: `npx`
     - **参数**: `["-y", "open-search-mcp"]`
     - **环境变量**:
       ```json
       {
         "LOG_LEVEL": "info"
       }
       ```

4. **保存并重启**

### 方法2: 配置文件

1. **找到配置文件**
   - 通常位于用户配置目录
   - 文件名可能是`mcp_config.json`或类似

2. **编辑配置**
   ```json
   {
     "mcpServers": {
       "open-search": {
         "command": "npx",
         "args": ["-y", "open-search-mcp"],
         "env": {
           "LOG_LEVEL": "info"
         }
       }
     }
   }
   ```

## ⚡ Cursor IDE

### 配置步骤

1. **打开Cursor IDE**
2. **进入设置**
   - 使用快捷键 `Ctrl/Cmd + ,`
   - 或通过菜单: File → Preferences → Settings

3. **搜索MCP设置**
   - 在设置搜索框中输入"MCP"或"Model Context Protocol"

4. **添加MCP服务器**
   - 找到MCP服务器配置选项
   - 添加新服务器：
     - **服务器名称**: `open-search`
     - **命令**: `npx -y open-search-mcp`
     - **工作目录**: （留空使用默认）

### 配置文件方式

编辑`.cursor/settings.json`：
```json
{
  "mcp.servers": {
    "open-search": {
      "command": "npx",
      "args": ["-y", "open-search-mcp"],
      "env": {
        "LOG_LEVEL": "info"
      },
      "timeout": 30000
    }
  }
}
```

## 📝 VS Code

### 前提条件
安装MCP扩展（从VS Code市场搜索"MCP"或"Model Context Protocol"）

### 配置步骤

1. **打开VS Code设置**
   - `Ctrl/Cmd + ,` 打开设置
   - 点击右上角的"打开设置(JSON)"图标

2. **添加MCP配置**
   ```json
   {
     "mcp.servers": [
       {
         "name": "open-search",
         "command": "npx",
         "args": ["-y", "open-search-mcp"],
         "env": {
           "LOG_LEVEL": "info"
         },
         "timeout": 30000,
         "restart": true
       }
     ]
   }
   ```

3. **重启VS Code**

### 工作区配置
在项目根目录创建`.vscode/settings.json`：
```json
{
  "mcp.servers": [
    {
      "name": "open-search",
      "command": "npx",
      "args": ["-y", "open-search-mcp"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

## 🐍 Python客户端

### 安装依赖
```bash
pip install mcp
```

### 基础使用
```python
import asyncio
from mcp import ClientSession, StdioServerParameters

async def main():
    # 配置服务器参数
    server_params = StdioServerParameters(
        command="npx",
        args=["-y", "open-search-mcp"],
        env={"LOG_LEVEL": "info"}
    )
    
    # 创建客户端会话
    async with ClientSession(server_params) as session:
        # 初始化会话
        await session.initialize()
        
        # 列出可用工具
        tools = await session.list_tools()
        print("可用工具:", [tool.name for tool in tools])
        
        # 使用搜索工具
        result = await session.call_tool("web_search", {
            "query": "Python机器学习教程",
            "numResults": 5
        })
        
        print("搜索结果:", result)

if __name__ == "__main__":
    asyncio.run(main())
```

### 高级配置
```python
import asyncio
from mcp import ClientSession, StdioServerParameters

class SearchClient:
    def __init__(self):
        self.server_params = StdioServerParameters(
            command="npx",
            args=["-y", "open-search-mcp"],
            env={
                "LOG_LEVEL": "debug",
                "GOOGLE_API_KEY": "your_api_key",
                "CACHE_TTL": "7200"
            }
        )
    
    async def search_web(self, query: str, num_results: int = 5):
        async with ClientSession(self.server_params) as session:
            await session.initialize()
            return await session.call_tool("web_search", {
                "query": query,
                "numResults": num_results,
                "includeContent": True
            })
    
    async def search_academic(self, query: str, sources: list = None):
        async with ClientSession(self.server_params) as session:
            await session.initialize()
            return await session.call_tool("research_paper_search", {
                "query": query,
                "sources": sources or ["arxiv", "pubmed"],
                "numResults": 10
            })

# 使用示例
async def example():
    client = SearchClient()
    
    # 网络搜索
    web_results = await client.search_web("最新AI技术")
    print("网络搜索结果:", web_results)
    
    # 学术搜索
    academic_results = await client.search_academic("machine learning")
    print("学术搜索结果:", academic_results)

asyncio.run(example())
```

## 🌐 Web客户端

### 安装依赖
```bash
npm install @modelcontextprotocol/sdk
```

### 基础使用
```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class OpenSearchClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }
  
  async connect() {
    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'open-search-mcp'],
      env: { 
        LOG_LEVEL: 'info',
        CACHE_TTL: '3600'
      }
    });
    
    this.client = new Client({
      name: "web-search-client",
      version: "1.0.0"
    }, {
      capabilities: {}
    });
    
    await this.client.connect(this.transport);
  }
  
  async searchWeb(query, options = {}) {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    
    return await this.client.request({
      method: "tools/call",
      params: {
        name: "web_search",
        arguments: {
          query,
          numResults: options.numResults || 5,
          includeContent: options.includeContent || true
        }
      }
    });
  }
  
  async searchAcademic(query, options = {}) {
    return await this.client.request({
      method: "tools/call",
      params: {
        name: "research_paper_search",
        arguments: {
          query,
          sources: options.sources || ["arxiv", "pubmed"],
          numResults: options.numResults || 10
        }
      }
    });
  }
  
  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
  }
}

// 使用示例
async function example() {
  const searchClient = new OpenSearchClient();
  
  try {
    await searchClient.connect();
    
    // 网络搜索
    const webResults = await searchClient.searchWeb("JavaScript教程", {
      numResults: 8,
      includeContent: true
    });
    console.log('网络搜索结果:', webResults);
    
    // 学术搜索
    const academicResults = await searchClient.searchAcademic("neural networks", {
      sources: ["arxiv"],
      numResults: 5
    });
    console.log('学术搜索结果:', academicResults);
    
  } catch (error) {
    console.error('搜索错误:', error);
  } finally {
    await searchClient.disconnect();
  }
}

example();
```

### React集成示例
```jsx
import React, { useState, useEffect } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function SearchComponent() {
  const [client, setClient] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const initClient = async () => {
      const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', 'open-search-mcp']
      });
      
      const mcpClient = new Client({
        name: "react-search-app",
        version: "1.0.0"
      }, { capabilities: {} });
      
      await mcpClient.connect(transport);
      setClient(mcpClient);
    };
    
    initClient();
    
    return () => {
      if (client) {
        client.close();
      }
    };
  }, []);
  
  const handleSearch = async () => {
    if (!client || !query) return;
    
    setLoading(true);
    try {
      const result = await client.request({
        method: "tools/call",
        params: {
          name: "web_search",
          arguments: {
            query,
            numResults: 10
          }
        }
      });
      
      setResults(result.content[0].text.data || []);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入搜索关键词..."
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>
      
      <div>
        {results.map((result, index) => (
          <div key={index} style={{ margin: '10px 0', padding: '10px', border: '1px solid #ccc' }}>
            <h3><a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a></h3>
            <p>{result.snippet}</p>
            <small>来源: {result.source}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchComponent;
```

## 🔧 故障排除

### 常见问题

#### 1. 安装失败

**问题**: `npm install -g open-search-mcp` 失败
**解决方案**:
```bash
# 清理npm缓存
npm cache clean --force

# 使用不同的registry
npm install -g open-search-mcp --registry https://registry.npmjs.org/

# 如果权限问题（Linux/macOS）
sudo npm install -g open-search-mcp

# Windows权限问题
# 以管理员身份运行命令提示符
```

#### 2. Node.js版本不兼容

**问题**: Node.js版本过低
**解决方案**:
```bash
# 检查当前版本
node --version

# 安装Node.js 18+
# 方法1: 使用nvm (推荐)
nvm install 18
nvm use 18

# 方法2: 从官网下载
# https://nodejs.org/

# 方法3: 使用包管理器
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# macOS (使用Homebrew)
brew install node

# Windows (使用Chocolatey)
choco install nodejs
```

#### 3. MCP服务器无法启动

**问题**: 服务器启动失败或连接超时
**解决方案**:

1. **检查命令是否正确**:
   ```bash
   # 测试命令
   npx -y open-search-mcp --help

   # 如果失败，尝试完整路径
   which npx
   /usr/local/bin/npx -y open-search-mcp --help
   ```

2. **检查环境变量**:
   ```bash
   # 检查PATH
   echo $PATH

   # 检查npm全局目录
   npm config get prefix

   # 添加到PATH (如果需要)
   export PATH=$PATH:$(npm config get prefix)/bin
   ```

3. **检查防火墙和网络**:
   ```bash
   # 测试网络连接
   ping google.com
   curl -I https://duckduckgo.com

   # 检查代理设置
   npm config get proxy
   npm config get https-proxy
   ```

#### 4. Claude Desktop无法识别MCP服务器

**问题**: Claude Desktop中看不到🔍图标
**解决方案**:

1. **检查配置文件格式**:
   ```bash
   # 验证JSON格式
   cat "%APPDATA%\Claude\claude_desktop_config.json" | jq .

   # 或使用在线JSON验证器
   ```

2. **检查文件权限**:
   ```bash
   # Windows
   icacls "%APPDATA%\Claude\claude_desktop_config.json"

   # macOS/Linux
   ls -la "~/Library/Application Support/Claude/claude_desktop_config.json"
   chmod 644 "~/Library/Application Support/Claude/claude_desktop_config.json"
   ```

3. **重置Claude Desktop**:
   - 完全退出Claude Desktop
   - 清除缓存（如果有选项）
   - 重新启动

#### 5. 搜索结果为空或错误

**问题**: 工具调用成功但返回空结果
**解决方案**:

1. **检查网络连接**:
   ```bash
   # 测试DuckDuckGo API
   curl "https://api.duckduckgo.com/?q=test&format=json"

   # 测试arXiv API
   curl "http://export.arxiv.org/api/query?search_query=all:test&max_results=1"
   ```

2. **检查日志**:
   ```bash
   # 启用调试日志
   LOG_LEVEL=debug npx -y open-search-mcp

   # 查看详细错误信息
   ```

3. **测试特定工具**:
   ```bash
   # 使用MCP inspector测试
   npx @modelcontextprotocol/inspector npx -y open-search-mcp
   ```

#### 6. 性能问题

**问题**: 搜索响应缓慢
**解决方案**:

1. **启用缓存**:
   ```json
   {
     "env": {
       "CACHE_TTL": "3600",
       "MAX_CACHE_SIZE": "100MB"
     }
   }
   ```

2. **调整并发设置**:
   ```json
   {
     "env": {
       "RATE_LIMIT_GLOBAL": "30",
       "CRAWLER_TIMEOUT": "15000"
     }
   }
   ```

3. **使用本地缓存**:
   ```bash
   # 创建缓存目录
   mkdir -p ~/.open-search-mcp/cache

   # 设置缓存目录
   export CACHE_DIR=~/.open-search-mcp/cache
   ```

### 调试技巧

#### 1. 启用详细日志
```json
{
  "env": {
    "LOG_LEVEL": "debug",
    "DEBUG_REQUESTS": "true",
    "ENABLE_METRICS": "true"
  }
}
```

#### 2. 使用MCP Inspector
```bash
# 安装MCP Inspector
npm install -g @modelcontextprotocol/inspector

# 启动inspector
npx @modelcontextprotocol/inspector npx -y open-search-mcp

# 在浏览器中打开 http://localhost:5173
```

#### 3. 手动测试工具
```bash
# 创建测试脚本
cat > test_mcp.js << 'EOF'
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'open-search-mcp'],
  env: { LOG_LEVEL: 'debug' }
});

const client = new Client({
  name: "test-client",
  version: "1.0.0"
}, { capabilities: {} });

try {
  await client.connect(transport);
  console.log('连接成功');

  const tools = await client.request({ method: "tools/list" });
  console.log('可用工具:', tools);

  const result = await client.request({
    method: "tools/call",
    params: {
      name: "web_search",
      arguments: { query: "test", numResults: 1 }
    }
  });
  console.log('搜索结果:', result);

} catch (error) {
  console.error('错误:', error);
} finally {
  await client.close();
}
EOF

# 运行测试
node test_mcp.js
```

### 获取帮助

#### 1. 官方资源
- **GitHub Issues**: https://github.com/your-username/open-search-mcp/issues
- **文档**: https://github.com/your-username/open-search-mcp/docs
- **讨论区**: https://github.com/your-username/open-search-mcp/discussions

#### 2. 社区支持
- **Discord**: [加入我们的Discord服务器]
- **Reddit**: r/ModelContextProtocol
- **Stack Overflow**: 标签 `open-search-mcp`

#### 3. 报告问题
提交问题时请包含：
- 操作系统和版本
- Node.js和npm版本
- 完整的错误日志
- 配置文件内容（去除敏感信息）
- 重现步骤

```bash
# 收集系统信息
echo "操作系统: $(uname -a)"
echo "Node.js版本: $(node --version)"
echo "npm版本: $(npm --version)"
echo "Open Search MCP版本: $(npx -y open-search-mcp --version)"

# 测试基础功能
npx -y open-search-mcp --help
```

---

**最后更新**: 2025-07-03
**文档版本**: v1.0
**维护者**: Open Search MCP Team
