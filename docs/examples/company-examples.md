# 企业研究工具使用示例

## 基本使用

```javascript
// 使用 competitor_finder
const result = await competitor_finder({
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

### competitor_finder

```javascript
const result = await competitor_finder({
  query: "示例查询",
  maxResults: 5
});
```

### search_company_info

```javascript
const result = await search_company_info({
  query: "示例查询",
  maxResults: 5
});
```

