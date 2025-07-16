# 🚀 Claude Desktop MCP部署指南

## 快速部署（推荐）

### 方法1：自动部署脚本
```powershell
# 在PowerShell中运行（以管理员身份）
.\deploy-to-claude.ps1
```

### 方法2：手动部署

#### 第一步：确保MCP服务器已构建
```bash
npm run build
```

#### 第二步：创建Claude配置目录
```powershell
# 创建Claude配置目录（如果不存在）
New-Item -ItemType Directory -Path "$env:APPDATA\Claude" -Force
```

#### 第三步：创建配置文件
在 `C:\Users\Admin\AppData\Roaming\Claude\` 目录中创建 `claude_desktop_config.json` 文件：

```json
{
  "mcpServers": {
    "open-search-mcp": {
      "command": "node",
      "args": ["D:\\Github\\open-search-mcp\\dist\\index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### 第四步：重启Claude Desktop
1. 完全关闭Claude Desktop应用
2. 重新启动Claude Desktop
3. 等待MCP服务器连接

## 🧪 测试部署

### 在Claude Desktop中测试以下命令：

1. **学术搜索测试**：
   ```
   帮我在arXiv上搜索"machine learning"相关的最新论文
   ```

2. **开发工具测试**：
   ```
   在GitHub上搜索React相关的热门项目
   ```

3. **金融数据测试**：
   ```
   查询苹果公司(AAPL)的股票报价
   ```

4. **智能研究测试**：
   ```
   对"人工智能"这个主题进行深度研究分析
   ```

## 🔧 可用的33个工具

### 🎓 学术研究工具 (7个)
- `search_arxiv` - arXiv论文搜索
- `search_pubmed` - 医学文献搜索
- `search_ieee` - IEEE工程技术论文
- `search_semantic_scholar` - AI增强学术搜索
- `search_iacr` - 密码学研究
- `search_biorxiv` - 生物学预印本
- `search_medrxiv` - 医学预印本

### 💻 开发工具 (4个)
- `search_github` - GitHub仓库搜索
- `search_stackoverflow` - 编程问答搜索
- `search_gitlab` - GitLab项目搜索
- `search_bitbucket` - Bitbucket代码搜索

### 🔍 隐私搜索 (4个)
- `search_searx` - 隐私保护元搜索
- `search_startpage` - 隐私搜索引擎
- `search_brave` - Brave搜索
- `search_ecosia` - 环保搜索引擎

### 🧪 测试工具 (2个)
- `test_jsonplaceholder` - JSON API测试
- `test_httpbin` - HTTP请求测试

### 🕷️ 网页爬取 (2个)
- `crawl_url_content` - 单页面内容提取
- `batch_crawl_urls` - 批量网站分析

### 📄 文档处理 (1个)
- `analyze_pdf` - PDF文档分析

### 🧠 智能研究 (5个)
- `intelligent_research` - 多源综合研究
- `deep_research` - 深度迭代研究
- `visualize_thinking` - 思维可视化
- `decompose_thinking` - 问题分解分析
- `check_research_saturation` - 研究完整性评估

### 💰 金融工具 (8个)
- `alpha_vantage_symbol_search` - 股票代码搜索
- `alpha_vantage_stock_quote` - 实时股票报价
- `alpha_vantage_intraday_data` - 日内交易数据
- `alpha_vantage_daily_data` - 每日股价数据
- `alpha_vantage_company_overview` - 公司基本信息
- `alpha_vantage_forex_rate` - 外汇汇率
- `alpha_vantage_crypto_price` - 加密货币价格
- `alpha_vantage_market_news` - 市场新闻

## 🔧 故障排除

### 常见问题：

1. **MCP服务器无法启动**
   - 检查Node.js是否正确安装
   - 确认构建文件存在：`dist/index.js`
   - 检查配置文件路径是否正确

2. **Claude Desktop无法识别工具**
   - 确认配置文件位置正确
   - 重启Claude Desktop应用
   - 检查JSON配置文件格式

3. **工具执行失败**
   - 某些工具可能需要API密钥
   - 检查网络连接
   - 查看Claude Desktop的错误日志

## 📞 支持

如果遇到问题，请检查：
1. Node.js版本 >= 18
2. 配置文件路径和格式
3. MCP服务器构建状态
4. Claude Desktop版本兼容性

## 🎉 享受使用！

现在您可以在Claude Desktop中使用这33个强大的搜索和研究工具了！
