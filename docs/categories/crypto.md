# 加密货币工具

## 概述

加密货币和区块链数据搜索工具。

## 工具列表 (3个)

### 1. crypto_search

**描述**: Search for cryptocurrency information using CoinGecko API

**文件位置**: `crypto\crypto-search.ts`

**使用示例**:
```javascript
// 调用 crypto_search
const result = await crypto_search({
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
    "source": "加密货币",
    "query": "搜索关键词",
    "results": [...],
    "totalResults": 10,
    "searchTime": 1500
  }
}
```

---

### 2. crypto_market_data

**描述**: Get top cryptocurrency market data from CoinGecko

**文件位置**: `crypto\crypto-search.ts`

**使用示例**:
```javascript
// 调用 crypto_market_data
const result = await crypto_market_data({
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
    "source": "加密货币",
    "query": "搜索关键词",
    "results": [...],
    "totalResults": 10,
    "searchTime": 1500
  }
}
```

---

### 3. crypto_price

**描述**: Get current price for specific cryptocurrencies

**文件位置**: `crypto\crypto-search.ts`

**使用示例**:
```javascript
// 调用 crypto_price
const result = await crypto_price({
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
    "source": "加密货币",
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
- [查看使用示例](../examples/crypto-examples.md)
- [API参考文档](../api/crypto-api.md)
