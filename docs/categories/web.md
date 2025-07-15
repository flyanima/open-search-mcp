# 网页搜索工具

## 概述

提供多种网页搜索引擎的集成，包括Google、DuckDuckGo等，支持智能查询路由和结果聚合。

## 工具列表 (1个)

### 1. search_wikipedia

**描述**: Search Wikipedia for information

**文件位置**: `web\simple.ts`

**使用示例**:
```javascript
// 调用 search_wikipedia
const result = await search_wikipedia({
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
    "source": "网页搜索",
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
- [查看使用示例](../examples/web-examples.md)
- [API参考文档](../api/web-api.md)
