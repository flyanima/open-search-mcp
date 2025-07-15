# 社交媒体工具

## 概述

社交媒体平台搜索，包括Reddit、Twitter等平台的内容检索。

## 工具列表 (2个)

### 1. linkedin_search

**描述**: Search LinkedIn for professional profiles, companies, and business content

**文件位置**: `social\linkedin-search.ts`

**使用示例**:
```javascript
// 调用 linkedin_search
const result = await linkedin_search({
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
    "source": "社交媒体",
    "query": "搜索关键词",
    "results": [...],
    "totalResults": 10,
    "searchTime": 1500
  }
}
```

---

### 2. search_reddit

**描述**: Search Reddit for discussions and posts

**文件位置**: `social\simple.ts`

**使用示例**:
```javascript
// 调用 search_reddit
const result = await search_reddit({
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
    "source": "社交媒体",
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
- [查看使用示例](../examples/social-examples.md)
- [API参考文档](../api/social-api.md)
