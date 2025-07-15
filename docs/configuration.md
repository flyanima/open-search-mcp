# Open-Search-MCP 配置指南

## 概述

本指南将帮助您正确配置Open-Search-MCP系统，包括API密钥设置、环境配置和Claude Desktop集成。

## 环境要求

### 系统要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)

### 依赖检查
```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version

# 检查Git版本
git --version
```

## 安装步骤

### 1. 克隆项目
```bash
git clone https://github.com/your-repo/open-search-mcp.git
cd open-search-mcp
```

### 2. 安装依赖
```bash
npm install
```

### 3. 构建项目
```bash
npm run build
```

## API密钥配置

### 1. 创建环境配置文件
```bash
# 复制模板文件
cp .env.template .env
```

### 2. 编辑.env文件
在`.env`文件中添加您的API密钥：

```env
# Google搜索API
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# NewsAPI
NEWSAPI_API_KEY=your_newsapi_key_here

# Alpha Vantage (金融数据)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# OpenWeather (天气数据)
OPENWEATHER_API_KEY=your_openweather_key_here

# GitHub (代码搜索)
GITHUB_TOKEN=your_github_token_here

# Reddit (社交媒体)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# CoinGecko (加密货币)
COINGECKO_API_KEY=your_coingecko_key_here

# Hugging Face (AI模型)
HUGGINGFACE_API_KEY=your_huggingface_key_here
```

### 3. 获取API密钥

#### Google搜索API
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Custom Search API"
4. 创建API密钥
5. 设置自定义搜索引擎ID

#### NewsAPI
1. 访问 [NewsAPI](https://newsapi.org/)
2. 注册免费账户
3. 获取API密钥（免费版每天1000次请求）

#### Alpha Vantage
1. 访问 [Alpha Vantage](https://www.alphavantage.co/)
2. 注册免费账户
3. 获取API密钥（免费版每天500次请求）

#### OpenWeather
1. 访问 [OpenWeather](https://openweathermap.org/api)
2. 注册免费账户
3. 获取API密钥（免费版每天1000次请求）

#### GitHub
1. 访问 [GitHub Settings](https://github.com/settings/tokens)
2. 创建Personal Access Token
3. 选择适当的权限（public_repo即可）

#### Reddit
1. 访问 [Reddit Apps](https://www.reddit.com/prefs/apps)
2. 创建新应用（选择"script"类型）
3. 获取client_id和client_secret

#### CoinGecko
1. 访问 [CoinGecko API](https://www.coingecko.com/en/api)
2. 注册账户获取API密钥（免费版有速率限制）

#### Hugging Face
1. 访问 [Hugging Face](https://huggingface.co/)
2. 注册账户
3. 在设置中创建Access Token

## Claude Desktop集成

### 1. 找到配置文件位置

#### Windows
```
C:\Users\[用户名]\AppData\Roaming\Claude\claude_desktop_config.json
```

#### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

#### Linux
```
~/.config/Claude/claude_desktop_config.json
```

### 2. 配置MCP服务器

在`claude_desktop_config.json`中添加：

```json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["path/to/open-search-mcp/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_google_api_key",
        "NEWSAPI_API_KEY": "your_newsapi_key",
        "ALPHA_VANTAGE_API_KEY": "your_alpha_vantage_key",
        "OPENWEATHER_API_KEY": "your_openweather_key",
        "GITHUB_TOKEN": "your_github_token",
        "REDDIT_CLIENT_ID": "your_reddit_client_id",
        "REDDIT_CLIENT_SECRET": "your_reddit_client_secret",
        "COINGECKO_API_KEY": "your_coingecko_key",
        "HUGGINGFACE_API_KEY": "your_huggingface_key"
      }
    }
  }
}
```

### 3. 重启Claude Desktop
配置完成后，重启Claude Desktop以加载新的MCP服务器。

## 验证配置

### 1. 运行测试脚本
```bash
# 测试API集成
node test-api-integration.js

# 测试真实数据输出
node implement-real-data-output.js
```

### 2. 检查Claude Desktop连接
在Claude Desktop中尝试使用搜索工具：
```
请帮我搜索"人工智能最新发展"的相关信息
```

### 3. 查看日志
检查系统日志以确认工具正常工作：
```bash
# 查看构建日志
npm run build

# 查看服务器启动日志
node dist/index.js
```

## 高级配置

### 1. 缓存配置
在代码中调整缓存设置：
```javascript
// 修改缓存TTL（生存时间）
const cacheConfig = {
  defaultTTL: 3600, // 1小时
  maxSize: 1000,    // 最大缓存条目数
  checkPeriod: 600  // 清理周期（秒）
};
```

### 2. 速率限制配置
```javascript
// 调整API调用速率限制
const rateLimitConfig = {
  windowMs: 60000,  // 1分钟窗口
  maxRequests: 100, // 最大请求数
  skipSuccessfulRequests: false
};
```

### 3. 日志级别配置
```javascript
// 设置日志级别
const logConfig = {
  level: 'info',    // debug, info, warn, error
  format: 'json',   // json, simple
  file: './logs/app.log'
};
```

## 故障排除

### 常见问题

#### 1. API密钥无效
**症状**: 工具返回认证错误
**解决方案**: 
- 检查API密钥是否正确
- 确认API密钥权限
- 验证API配额是否用完

#### 2. Claude Desktop无法连接
**症状**: Claude Desktop中看不到工具
**解决方案**:
- 检查配置文件路径是否正确
- 确认JSON格式是否有效
- 重启Claude Desktop

#### 3. 构建失败
**症状**: npm run build报错
**解决方案**:
- 检查Node.js版本
- 清理node_modules: `rm -rf node_modules && npm install`
- 检查TypeScript错误

#### 4. 工具执行超时
**症状**: 工具执行时间过长
**解决方案**:
- 检查网络连接
- 调整超时设置
- 使用缓存减少API调用

### 调试模式

启用详细日志：
```bash
# 设置调试环境变量
export DEBUG=open-search-mcp:*

# 运行服务器
node dist/index.js
```

### 性能优化

1. **启用缓存**: 确保缓存配置正确
2. **并发控制**: 限制同时进行的API调用数量
3. **结果过滤**: 只返回必要的数据字段
4. **压缩响应**: 启用响应压缩

## 安全注意事项

1. **API密钥保护**: 
   - 不要将API密钥提交到版本控制
   - 使用环境变量存储敏感信息
   - 定期轮换API密钥

2. **网络安全**:
   - 使用HTTPS进行API调用
   - 验证SSL证书
   - 实施速率限制

3. **数据隐私**:
   - 不记录敏感查询内容
   - 遵守数据保护法规
   - 实施数据清理策略

## 支持和帮助

如果您遇到配置问题，请：

1. 查看 [故障排除文档](./troubleshooting.md)
2. 检查 [GitHub Issues](https://github.com/your-repo/open-search-mcp/issues)
3. 提交新的Issue描述您的问题

---

**最后更新**: 2025-01-13  
**版本**: 2.0.0
