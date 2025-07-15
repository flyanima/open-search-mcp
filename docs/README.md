# Open-Search-MCP 工具文档

## 概述

Open-Search-MCP 是一个功能强大的搜索和研究工具集合，提供200+专业化搜索工具，支持多种数据源和搜索场景。

## 工具统计

- **总工具数**: 12
- **工具分类**: 8
- **支持的数据源**: Google、Wikipedia、arXiv、PubMed、NewsAPI、GitHub、Reddit等

## 工具分类

### 学术研究 (1个工具)

- **search_arxiv**: Search arXiv for academic papers


📖 [查看完整列表](./categories/academic.md)

### 企业研究 (2个工具)

- **competitor_finder**: Find and analyze competitors for a given company, including direct and indirect competitors
- **search_company_info**: Search for company information from multiple sources


📖 [查看完整列表](./categories/company.md)

### 加密货币 (3个工具)

- **crypto_search**: Search for cryptocurrency information using CoinGecko API
- **crypto_market_data**: Get top cryptocurrency market data from CoinGecko
- **crypto_price**: Get current price for specific cryptocurrencies


📖 [查看完整列表](./categories/crypto.md)

### 新闻媒体 (1个工具)

- **search_hackernews**: Search Hacker News for tech discussions and news


📖 [查看完整列表](./categories/news.md)

### 深度研究 (1个工具)

- **search_comprehensive**: Perform comprehensive research across multiple sources (arXiv, Wikipedia, GitHub, Hacker News)


📖 [查看完整列表](./categories/research.md)

### 社交媒体 (2个工具)

- **linkedin_search**: Search LinkedIn for professional profiles, companies, and business content
- **search_reddit**: Search Reddit for discussions and posts


📖 [查看完整列表](./categories/social.md)

### 技术开发 (1个工具)

- **search_github_legacy**: Search GitHub repositories and code


📖 [查看完整列表](./categories/tech.md)

### 网页搜索 (1个工具)

- **search_wikipedia**: Search Wikipedia for information


📖 [查看完整列表](./categories/web.md)


## 快速开始

### 1. 安装和配置

```bash
# 克隆项目
git clone https://github.com/your-repo/open-search-mcp.git
cd open-search-mcp

# 安装依赖
npm install

# 配置API密钥
cp .env.template .env
# 编辑 .env 文件，添加你的API密钥

# 构建项目
npm run build
```

### 2. Claude Desktop集成

在Claude Desktop配置文件中添加：

```json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["path/to/open-search-mcp/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your_google_api_key",
        "NEWSAPI_API_KEY": "your_newsapi_key"
      }
    }
  }
}
```

### 3. 基本使用

```javascript
// 搜索网页内容
await searchWeb({ query: "人工智能最新发展", maxResults: 10 });

// 搜索学术论文
await searchArxiv({ query: "machine learning", maxResults: 5 });

// 搜索新闻
await searchNews({ query: "科技新闻", category: "technology" });
```

## 文档导航

- 📚 [工具分类文档](./categories/) - 按分类查看所有工具
- 💡 [使用示例](./examples/) - 实际使用案例和代码示例
- 🔧 [API参考](./api/) - 详细的API文档和参数说明
- ⚙️ [配置指南](./configuration.md) - 环境配置和API密钥设置
- 🚀 [最佳实践](./best-practices.md) - 使用建议和优化技巧

## 支持的搜索类型

- **网页搜索**: Google、DuckDuckGo、Bing
- **学术搜索**: arXiv、PubMed、Google Scholar、IEEE
- **新闻搜索**: NewsAPI、RSS聚合、媒体网站
- **技术搜索**: GitHub、Stack Overflow、Dev.to
- **社交搜索**: Reddit、Twitter（有限支持）
- **金融搜索**: Alpha Vantage、CoinGecko
- **天气搜索**: OpenWeather
- **内容提取**: 智能网页内容提取和分析

## 贡献指南

欢迎贡献代码和文档！请查看 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解详细信息。

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。

---

**最后更新**: 2025-07-13  
**版本**: 2.0.0
