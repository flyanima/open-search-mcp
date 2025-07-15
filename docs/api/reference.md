# Open-Search-MCP API参考

## 通用响应格式

所有工具都返回统一的响应格式：

```typescript
interface ToolResponse {
  success: boolean;
  data?: {
    source: string;
    query: string;
    results: SearchResult[];
    totalResults: number;
    searchTime: number;
    metadata?: any;
  };
  error?: string;
}

interface SearchResult {
  title: string;
  url: string;
  summary: string;
  publishedAt?: string;
  author?: string;
  type: string;
  metadata?: any;
}
```

## 通用参数

大多数搜索工具支持以下参数：

- `query` (string, 必需): 搜索查询
- `maxResults` (number, 可选): 最大结果数，默认10
- `language` (string, 可选): 语言代码，如 'zh', 'en'
- `category` (string, 可选): 搜索分类

## 工具分类API

### 学术研究

#### search_arxiv

**描述**: Search arXiv for academic papers

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_arxiv({ query: "示例", maxResults: 5 });
```


### 企业研究

#### competitor_finder

**描述**: Find and analyze competitors for a given company, including direct and indirect competitors

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await competitor_finder({ query: "示例", maxResults: 5 });
```

#### search_company_info

**描述**: Search for company information from multiple sources

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_company_info({ query: "示例", maxResults: 5 });
```


### 加密货币

#### crypto_search

**描述**: Search for cryptocurrency information using CoinGecko API

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await crypto_search({ query: "示例", maxResults: 5 });
```

#### crypto_market_data

**描述**: Get top cryptocurrency market data from CoinGecko

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await crypto_market_data({ query: "示例", maxResults: 5 });
```

#### crypto_price

**描述**: Get current price for specific cryptocurrencies

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await crypto_price({ query: "示例", maxResults: 5 });
```


### 新闻媒体

#### search_hackernews

**描述**: Search Hacker News for tech discussions and news

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_hackernews({ query: "示例", maxResults: 5 });
```


### 深度研究

#### search_comprehensive

**描述**: Perform comprehensive research across multiple sources (arXiv, Wikipedia, GitHub, Hacker News)

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_comprehensive({ query: "示例", maxResults: 5 });
```


### 社交媒体

#### linkedin_search

**描述**: Search LinkedIn for professional profiles, companies, and business content

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await linkedin_search({ query: "示例", maxResults: 5 });
```

#### search_reddit

**描述**: Search Reddit for discussions and posts

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_reddit({ query: "示例", maxResults: 5 });
```


### 技术开发

#### search_github_legacy

**描述**: Search GitHub repositories and code

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_github_legacy({ query: "示例", maxResults: 5 });
```


### 网页搜索

#### search_wikipedia

**描述**: Search Wikipedia for information

**参数**:
- query (string): 搜索查询
- maxResults (number): 结果数量

**示例**:
```javascript
await search_wikipedia({ query: "示例", maxResults: 5 });
```


