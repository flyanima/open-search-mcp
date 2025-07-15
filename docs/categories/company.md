# 企业研究工具

## 概述

企业信息研究工具，支持公司背景调查和竞争分析。

## 工具列表 (2个)

### 1. competitor_finder

**描述**: Find and analyze competitors for a given company, including direct and indirect competitors

**文件位置**: `company\competitor-finder.ts`

**使用示例**:
```javascript
// 调用 competitor_finder
const result = await competitor_finder({
  query: "搜索关键词",
  maxResults: 10
});
console.log(result);
```

**返回格式**:
```json
{
  "success": true,
  "data": {
    "source": "企业研究",
    "query": "搜索关键词",
    "results": [...],
    "totalResults": 10,
    "searchTime": 1500
  }
}
```

---

### 2. search_company_info

**描述**: Search for company information from multiple sources

**文件位置**: `company\simple.ts`

**使用示例**:
```javascript
// 调用 search_company_info
const result = await search_company_info({
  query: "搜索关键词",
  maxResults: 10
});
console.log(result);
```

**返回格式**:
```json
{
  "success": true,
  "data": {
    "source": "企业研究",
    "query": "搜索关键词",
    "results": [...],
    "totalResults": 10,
    "searchTime": 1500
  }
}
```

---


## 相关文档

- [返回主文档](../README.md)
- [查看使用示例](../examples/company-examples.md)
- [API参考文档](../api/company-api.md)
