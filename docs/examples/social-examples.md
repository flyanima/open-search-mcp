# 社交媒体工具使用示例

## 基本使用

```javascript
// 使用 linkedin_search
const result = await linkedin_search({
  query: "搜索关键词",
  maxResults: 10
});

if (result.success) {
  console.log('搜索结果:', result.data.results);
} else {
  console.error('搜索失败:', result.error);
}
```

## 所有工具示例

### linkedin_search

```javascript
const result = await linkedin_search({
  query: "示例查询",
  maxResults: 5
});
```

### search_reddit

```javascript
const result = await search_reddit({
  query: "示例查询",
  maxResults: 5
});
```

