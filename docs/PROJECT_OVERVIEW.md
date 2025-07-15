# Open Search MCP - 项目概览

## 📋 项目状态

**当前阶段**: 项目初始化完成 ✅  
**下一阶段**: Phase 1 - 核心基础开发  
**预计完成时间**: 2-3周  

## 🎯 项目目标

创建一个**完全免费、自主开发**的 Model Context Protocol (MCP) 服务器，实现类似**Claude 4**和**Gemini 2.5 Pro**的深度研究功能，但不依赖任何付费的第三方 API。

### 🔬 深度研究能力
- **范围广**: 每项任务搜索50-200个网站源，覆盖全网内容
- **准确度高**: AI驱动的精准搜索，智能token优化
- **内容全面**: 深度提取和分析网页内容，结构化处理
- **PDF支持**: 搜索、下载、解析PDF文档，支持OCR识别
- **多轮搜索**: 基于初步结果进行深度挖掘
- **智能摘要**: AI生成的结构化研究报告

### 核心优势
- ✅ **深度研究**: 类似Claude 4的全面主题研究能力
- ✅ **AI增强**: 集成Ollama本地模型，智能查询优化
- ✅ **完全免费**: 不依赖付费API，降低使用成本
- ✅ **自主可控**: 完全开源，可自定义和扩展
- ✅ **功能完整**: 超越Exa的所有核心功能
- ✅ **多平台支持**: 支持Claude Desktop、Augment Codes、Cursor等
- ✅ **高性能**: 大规模并发搜索，多层缓存和智能优化
- ✅ **易部署**: 一键安装和配置

## 🏗️ 技术架构

### 技术栈
```
Frontend: TypeScript/Node.js
Framework: @modelcontextprotocol/sdk
Crawler: Puppeteer + Stealth Plugin
Parser: Cheerio + PDF-Parse
Cache: Node-Cache + File System
APIs: DuckDuckGo, arXiv, PubMed, Wikipedia, GitHub
```

### 系统架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude/AI     │    │   MCP Server    │    │  Free APIs      │
│   Assistant     │◄──►│  (Open Search)  │◄──►│  & Scrapers     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Multi-Layer   │
                       │   Cache System  │
                       └─────────────────┘
```

## 📁 项目结构

```
open-search-mcp/
├── 📄 PRD.md                    # 产品需求文档 ✅
├── 📄 README.md                 # 项目说明文档 ✅
├── 📄 package.json              # 项目配置文件 ✅
├── 📄 tsconfig.json             # TypeScript配置 ✅
├── 📄 .env.example              # 环境变量示例 ✅
├── 📄 .gitignore                # Git忽略文件 ✅
├── 📄 LICENSE                   # MIT许可证 ✅
├── 📁 src/                      # 源代码目录 ✅
│   ├── 📄 types.ts              # 类型定义 ✅
│   ├── 📄 index.ts              # 主入口文件 ⏳
│   ├── 📁 engines/              # 搜索引擎适配器 ⏳
│   ├── 📁 crawlers/             # 网页爬虫模块 ⏳
│   ├── 📁 parsers/              # 内容解析模块 ⏳
│   ├── 📁 academic/             # 学术搜索模块 ⏳
│   ├── 📁 social/               # 社交媒体搜索 ⏳
│   ├── 📁 tools/                # MCP工具实现 ⏳
│   ├── 📁 cache/                # 缓存管理 ⏳
│   ├── 📁 config/               # 配置管理 ⏳
│   └── 📁 utils/                # 工具函数 ⏳
├── 📁 tests/                    # 测试文件 ⏳
└── 📁 docs/                     # 文档目录 ✅
    ├── 📄 PROJECT_OVERVIEW.md   # 项目概览 ✅
    └── 📄 INSTALLATION_GUIDE.md # 安装配置指南 ✅
```

## 🔧 功能模块

### 已完成 ✅
1. **项目初始化**
   - 基础项目结构
   - TypeScript配置
   - 依赖包配置
   - 类型定义
   - 文档框架

2. **多平台支持文档**
   - Claude Desktop配置指南
   - Augment Codes集成说明
   - Cursor IDE配置方法
   - VS Code扩展支持
   - Python/Web客户端示例
   - 故障排除指南

### 开发中 ⏳
*暂无正在开发的模块*

### 待开发 📋

#### Phase 1 - 核心基础 (2-3周)
1. **MCP服务器框架** 
   - [ ] 主入口文件 (`src/index.ts`)
   - [ ] MCP工具注册和管理
   - [ ] 基础错误处理

2. **搜索引擎模块**
   - [ ] DuckDuckGo搜索引擎 (`src/engines/duckduckgo.ts`)
   - [ ] 搜索引擎基类 (`src/engines/base.ts`)
   - [ ] 搜索结果聚合

3. **网页爬虫模块**
   - [ ] 基础网页爬虫 (`src/crawlers/web-crawler.ts`)
   - [ ] 内容提取器 (`src/crawlers/content-extractor.ts`)
   - [ ] 反爬虫处理

4. **MCP工具实现**
   - [ ] 网络搜索工具 (`src/tools/web-search.ts`)
   - [ ] URL爬虫工具 (`src/tools/url-crawler.ts`)

#### Phase 2 - 功能扩展 (2-3周)
1. **学术搜索模块**
   - [ ] arXiv搜索 (`src/academic/arxiv.ts`)
   - [ ] PubMed搜索 (`src/academic/pubmed.ts`)
   - [ ] 学术搜索工具 (`src/tools/academic-search.ts`)

2. **高级爬虫功能**
   - [ ] 反爬虫检测 (`src/crawlers/anti-bot.ts`)
   - [ ] 多格式解析 (`src/parsers/`)
   - [ ] 内容清理和优化

3. **社交媒体搜索**
   - [ ] GitHub搜索 (`src/social/github.ts`)
   - [ ] Wikipedia搜索 (`src/social/wikipedia.ts`)
   - [ ] 社交搜索工具 (`src/tools/social-search.ts`)

4. **缓存系统**
   - [ ] 内存缓存 (`src/cache/memory-cache.ts`)
   - [ ] 文件缓存 (`src/cache/file-cache.ts`)
   - [ ] 缓存管理器 (`src/cache/cache-manager.ts`)

#### Phase 3 - 优化完善 (1-2周)
1. **公司研究功能**
   - [ ] 公司研究工具 (`src/tools/company-research.ts`)
   - [ ] 竞争对手查找 (`src/tools/competitor-finder.ts`)

2. **系统优化**
   - [ ] 性能优化和监控
   - [ ] 错误处理完善
   - [ ] 日志系统 (`src/utils/logger.ts`)

3. **测试和文档**
   - [ ] 单元测试
   - [ ] 集成测试
   - [ ] API文档
   - [ ] 使用指南

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- 内存 ≥ 512MB

### 安装步骤
```bash
# 1. 克隆项目
git clone https://github.com/your-username/open-search-mcp.git
cd open-search-mcp

# 2. 安装依赖
npm install

# 3. 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件，添加可选的API密钥

# 4. 开发模式运行
npm run dev

# 5. 构建生产版本
npm run build

# 6. 运行生产版本
npm start
```

### 多平台配置

#### Claude Desktop
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

#### Augment Codes
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

#### Cursor IDE
```json
{
  "mcp.servers": {
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

#### VS Code
```json
{
  "mcp.servers": [
    {
      "name": "open-search",
      "command": "npx",
      "args": ["-y", "open-search-mcp"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  ]
}
```

**详细配置指南**: 请参考 [`docs/INSTALLATION_GUIDE.md`](./INSTALLATION_GUIDE.md)

## 📊 开发进度

### 总体进度: 15% ✅⏳⏳⏳⏳⏳⏳⏳⏳⏳

| 阶段 | 进度 | 状态 | 预计完成 |
|------|------|------|----------|
| 项目初始化 | 100% | ✅ 完成 | 2025-07-03 |
| Phase 1 - 核心基础 | 0% | ⏳ 待开始 | 2025-07-24 |
| Phase 2 - 功能扩展 | 0% | 📋 计划中 | 2025-08-14 |
| Phase 3 - 优化完善 | 0% | 📋 计划中 | 2025-08-28 |

### 功能完成度

| 功能模块 | 完成度 | 状态 |
|----------|--------|------|
| 🔍 网络搜索 | 0% | 📋 待开发 |
| 📚 学术搜索 | 0% | 📋 待开发 |
| 🏢 公司研究 | 0% | 📋 待开发 |
| 🌐 内容提取 | 0% | 📋 待开发 |
| 🔗 社交搜索 | 0% | 📋 待开发 |
| ⚡ 缓存系统 | 0% | 📋 待开发 |
| 🛠️ 配置管理 | 0% | 📋 待开发 |
| 📝 日志系统 | 0% | 📋 待开发 |

## 🎯 下一步计划

### 立即开始 (本周)
1. **创建主入口文件** (`src/index.ts`)
   - 初始化MCP服务器
   - 注册基础工具
   - 设置错误处理

2. **实现DuckDuckGo搜索引擎**
   - 创建搜索引擎基类
   - 实现DuckDuckGo API调用
   - 添加结果解析和格式化

3. **开发基础网页爬虫**
   - 集成Puppeteer
   - 实现基础内容提取
   - 添加反爬虫保护

### 本月目标
- 完成Phase 1的所有核心功能
- 实现基础的网络搜索和内容提取
- 完成MCP工具的基础框架
- 添加基础的错误处理和日志

### 长期目标
- 成为Exa MCP Server的完美免费替代品
- 建立活跃的开源社区
- 支持更多搜索引擎和数据源
- 提供企业级的稳定性和性能

---

**最后更新**: 2025-07-03  
**文档版本**: v1.0  
**维护者**: Open Search MCP Team
