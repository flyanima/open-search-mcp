# 技术开发工具使用示例

## 基本使用

```javascript
// 使用 search_github_legacy
const result = await search_github_legacy({
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

### search_github_legacy

```javascript
const result = await search_github_legacy({
  query: "示例查询",
  maxResults: 5
});
```

