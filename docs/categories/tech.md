# 技术开发工具

## 概述

技术开发相关的搜索工具，包括GitHub代码搜索、Stack Overflow问答等。

## 工具列表 (1个)

### 1. search_github_legacy

**描述**: Search GitHub repositories and code

**文件位置**: `tech\simple.ts`

**使用示例**:
```javascript
// 调用 search_github_legacy
const result = await search_github_legacy({
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
    "source": "技术开发",
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
- [查看使用示例](../examples/tech-examples.md)
- [API参考文档](../api/tech-api.md)
