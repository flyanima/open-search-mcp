# 深度研究工具

## 概述

深度研究相关的搜索和分析工具。

## 工具列表 (1个)

### 1. search_comprehensive

**描述**: Perform comprehensive research across multiple sources (arXiv, Wikipedia, GitHub, Hacker News)

**文件位置**: `research\simple.ts`

**使用示例**:
```javascript
// 调用 search_comprehensive
const result = await search_comprehensive({
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
    "source": "深度研究",
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
- [查看使用示例](../examples/research-examples.md)
- [API参考文档](../api/research-api.md)
