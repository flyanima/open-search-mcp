# Open-Search-MCP 使用示例

## 基础搜索示例

### 1. 网页搜索
```javascript
// 基本网页搜索
const webResults = await searchWeb({
  query: "人工智能最新发展",
  maxResults: 10,
  language: "zh"
});

// 处理结果
webResults.data.results.forEach(result => {
  console.log(`标题: ${result.title}`);
  console.log(`链接: ${result.url}`);
  console.log(`摘要: ${result.summary}`);
  console.log('---');
});
```

### 2. 学术论文搜索
```javascript
// 搜索arXiv论文
const papers = await searchArxiv({
  query: "machine learning transformer",
  maxResults: 5,
  category: "cs.AI"
});

// 获取论文详情
for (const paper of papers.data.results) {
  console.log(`论文: ${paper.title}`);
  console.log(`作者: ${paper.authors.join(', ')}`);
  console.log(`摘要: ${paper.abstract}`);
  console.log(`PDF: ${paper.pdfUrl}`);
}
```

### 3. 新闻搜索
```javascript
// 搜索最新科技新闻
const news = await searchNews({
  query: "人工智能",
  category: "technology",
  language: "zh",
  sortBy: "publishedAt"
});

// 显示新闻
news.data.results.forEach(article => {
  console.log(`新闻: ${article.title}`);
  console.log(`来源: ${article.source}`);
  console.log(`时间: ${article.publishedAt}`);
  console.log(`链接: ${article.url}`);
});
```

## 高级搜索示例

### 1. 多源聚合搜索
```javascript
// 同时搜索多个数据源
const aggregatedResults = await Promise.all([
  searchWeb({ query: "量子计算", maxResults: 5 }),
  searchArxiv({ query: "quantum computing", maxResults: 3 }),
  searchNews({ query: "量子计算", maxResults: 3 })
]);

// 合并和排序结果
const allResults = aggregatedResults
  .flatMap(result => result.data.results)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
```

### 2. 智能内容提取
```javascript
// 提取网页内容
const content = await extractContent({
  url: "https://example.com/article",
  includeImages: true,
  includeLinks: true
});

// 分析内容
console.log(`标题: ${content.title}`);
console.log(`作者: ${content.author}`);
console.log(`发布时间: ${content.publishedAt}`);
console.log(`正文长度: ${content.text.length} 字符`);
console.log(`图片数量: ${content.images.length}`);
```

## 错误处理示例

```javascript
try {
  const result = await searchWeb({
    query: "搜索内容",
    maxResults: 10
  });
  
  if (result.success) {
    // 处理成功结果
    console.log('搜索成功:', result.data);
  } else {
    // 处理搜索失败
    console.error('搜索失败:', result.error);
  }
} catch (error) {
  // 处理异常
  console.error('执行错误:', error.message);
}
```

## 批量处理示例

```javascript
// 批量搜索多个关键词
const keywords = ["人工智能", "机器学习", "深度学习"];
const batchResults = [];

for (const keyword of keywords) {
  try {
    const result = await searchWeb({
      query: keyword,
      maxResults: 5
    });
    
    batchResults.push({
      keyword,
      results: result.data.results,
      count: result.data.totalResults
    });
    
    // 添加延迟避免速率限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`搜索 "${keyword}" 失败:`, error.message);
  }
}

console.log('批量搜索完成:', batchResults);
```
