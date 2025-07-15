# 加密货币工具使用示例

## 基本使用

```javascript
// 使用 crypto_search
const result = await crypto_search({
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

### crypto_search

```javascript
const result = await crypto_search({
  query: "示例查询",
  maxResults: 5
});
```

### crypto_market_data

```javascript
const result = await crypto_market_data({
  query: "示例查询",
  maxResults: 5
});
```

### crypto_price

```javascript
const result = await crypto_price({
  query: "示例查询",
  maxResults: 5
});
```

