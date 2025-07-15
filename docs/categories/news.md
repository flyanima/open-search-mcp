# 新闻媒体工具

## 概述

新闻和媒体内容搜索，支持实时新闻、RSS聚合和多语言新闻源。

## 工具列表 (1个)

### 1. search_hackernews

**描述**: Search Hacker News for tech discussions and news

**文件位置**: `news\simple.ts`

**使用示例**:
```javascript
// 调用 search_hackernews
const result = await search_hackernews({
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
    "source": "新闻媒体",
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
- [查看使用示例](../examples/news-examples.md)
- [API参考文档](../api/news-api.md)
