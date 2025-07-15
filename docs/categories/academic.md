# 学术研究工具

## 概述

专业的学术论文搜索工具，支持arXiv、PubMed、Google Scholar等学术数据库。

## 工具列表 (1个)

### 1. search_arxiv

**描述**: Search arXiv for academic papers

**文件位置**: `academic\simple.ts`

**使用示例**:
```javascript
// 调用 search_arxiv
const result = await search_arxiv({
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
    "source": "学术研究",
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
- [查看使用示例](../examples/academic-examples.md)
- [API参考文档](../api/academic-api.md)
