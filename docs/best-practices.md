# Open-Search-MCP 最佳实践指南

## 概述

本指南提供使用Open-Search-MCP系统的最佳实践，帮助您获得最佳的搜索效果和系统性能。

## 搜索策略

### 1. 查询优化

#### 关键词选择
```javascript
// ✅ 好的做法：使用具体、相关的关键词
await searchWeb({ 
  query: "机器学习 transformer 模型 2024",
  maxResults: 10 
});

// ❌ 避免：过于宽泛的查询
await searchWeb({ 
  query: "技术",
  maxResults: 10 
});
```

#### 查询长度
- **最佳长度**: 3-8个关键词
- **避免**: 单个词或过长的句子
- **建议**: 使用核心概念和修饰词

#### 语言一致性
```javascript
// ✅ 中文查询使用中文工具
await searchWeb({ 
  query: "人工智能发展趋势",
  language: "zh" 
});

// ✅ 英文查询使用英文工具
await searchArxiv({ 
  query: "machine learning algorithms",
  maxResults: 5 
});
```

### 2. 工具选择策略

#### 按内容类型选择
```javascript
// 学术研究 → 使用学术工具
const papers = await searchArxiv({ 
  query: "quantum computing", 
  category: "quant-ph" 
});

// 实时新闻 → 使用新闻工具
const news = await searchNews({ 
  query: "科技新闻", 
  sortBy: "publishedAt" 
});

// 技术问题 → 使用技术工具
const solutions = await searchStackOverflow({ 
  query: "React hooks error" 
});
```

#### 多源验证
```javascript
// 重要信息使用多个来源验证
const results = await Promise.all([
  searchWeb({ query: "公司财报 2024" }),
  searchNews({ query: "公司财报", category: "business" }),
  searchFinancial({ symbol: "AAPL", dataType: "earnings" })
]);

// 交叉验证结果
const verifiedInfo = crossValidateResults(results);
```

### 3. 结果处理

#### 结果过滤
```javascript
// 按时间过滤
const recentResults = results.data.results.filter(item => {
  const publishDate = new Date(item.publishedAt);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return publishDate > oneMonthAgo;
});

// 按相关性过滤
const relevantResults = results.data.results.filter(item => 
  item.title.toLowerCase().includes(targetKeyword.toLowerCase()) ||
  item.summary.toLowerCase().includes(targetKeyword.toLowerCase())
);
```

#### 结果排序
```javascript
// 按发布时间排序
const sortedByDate = results.sort((a, b) => 
  new Date(b.publishedAt) - new Date(a.publishedAt)
);

// 按相关性评分排序
const sortedByRelevance = results.sort((a, b) => 
  calculateRelevanceScore(b, query) - calculateRelevanceScore(a, query)
);
```

## 性能优化

### 1. 缓存策略

#### 智能缓存使用
```javascript
// 对稳定内容使用长期缓存
const encyclopediaResult = await searchWikipedia({ 
  query: "量子物理学",
  cacheTTL: 86400 // 24小时
});

// 对动态内容使用短期缓存
const newsResult = await searchNews({ 
  query: "今日科技新闻",
  cacheTTL: 1800 // 30分钟
});
```

#### 缓存键优化
```javascript
// 标准化查询以提高缓存命中率
function normalizeQuery(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u4e00-\u9fff]/g, '');
}

const cacheKey = `search:${normalizeQuery(query)}:${maxResults}`;
```

### 2. 并发控制

#### 批量请求优化
```javascript
// ✅ 控制并发数量
const batchSize = 3;
const batches = chunkArray(queries, batchSize);

for (const batch of batches) {
  const results = await Promise.all(
    batch.map(query => searchWeb({ query, maxResults: 5 }))
  );
  
  // 处理结果
  processBatchResults(results);
  
  // 添加延迟避免速率限制
  await delay(1000);
}
```

#### 超时处理
```javascript
// 设置合理的超时时间
const searchWithTimeout = async (query, timeoutMs = 10000) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
  );
  
  return Promise.race([
    searchWeb({ query }),
    timeoutPromise
  ]);
};
```

### 3. 错误处理

#### 渐进式降级
```javascript
async function robustSearch(query) {
  const searchMethods = [
    () => searchGoogle({ query }),
    () => searchDuckDuckGo({ query }),
    () => searchWikipedia({ query })
  ];
  
  for (const searchMethod of searchMethods) {
    try {
      const result = await searchMethod();
      if (result.success && result.data.results.length > 0) {
        return result;
      }
    } catch (error) {
      console.warn(`Search method failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('All search methods failed');
}
```

#### 重试机制
```javascript
async function searchWithRetry(query, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await searchWeb({ query });
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // 指数退避
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## 安全和隐私

### 1. 数据保护

#### 敏感信息过滤
```javascript
// 过滤敏感信息
function sanitizeQuery(query) {
  const sensitivePatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // 信用卡号
    /\b\d{3}-\d{2}-\d{4}\b/, // 社会保险号
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ // 邮箱
  ];
  
  let sanitized = query;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  
  return sanitized;
}
```

#### 日志安全
```javascript
// 安全的日志记录
function logSearchQuery(query, userId) {
  const hashedQuery = hashString(query);
  const hashedUserId = hashString(userId);
  
  logger.info('Search performed', {
    queryHash: hashedQuery,
    userHash: hashedUserId,
    timestamp: new Date().toISOString()
  });
}
```

### 2. API密钥管理

#### 密钥轮换
```javascript
// 定期检查和轮换API密钥
class APIKeyManager {
  constructor() {
    this.keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30天
  }
  
  async checkKeyExpiration(keyName) {
    const keyInfo = await this.getKeyInfo(keyName);
    const now = Date.now();
    
    if (now - keyInfo.createdAt > this.keyRotationInterval) {
      await this.rotateKey(keyName);
    }
  }
}
```

#### 权限最小化
```javascript
// 只请求必要的权限
const apiConfig = {
  google: {
    scopes: ['https://www.googleapis.com/auth/cse'], // 只搜索权限
    quotaUser: 'search-service'
  },
  github: {
    scopes: ['public_repo'], // 只读公共仓库
    permissions: ['read']
  }
};
```

## 监控和调试

### 1. 性能监控

#### 关键指标跟踪
```javascript
class PerformanceMonitor {
  trackSearchPerformance(toolName, query, startTime, endTime, success) {
    const metrics = {
      tool: toolName,
      queryLength: query.length,
      responseTime: endTime - startTime,
      success: success,
      timestamp: new Date().toISOString()
    };
    
    this.recordMetrics(metrics);
  }
  
  generateReport() {
    return {
      averageResponseTime: this.calculateAverageResponseTime(),
      successRate: this.calculateSuccessRate(),
      mostUsedTools: this.getMostUsedTools(),
      errorPatterns: this.analyzeErrorPatterns()
    };
  }
}
```

#### 健康检查
```javascript
async function healthCheck() {
  const checks = [
    { name: 'Google API', test: () => testGoogleAPI() },
    { name: 'NewsAPI', test: () => testNewsAPI() },
    { name: 'Database', test: () => testDatabase() },
    { name: 'Cache', test: () => testCache() }
  ];
  
  const results = await Promise.all(
    checks.map(async check => {
      try {
        await check.test();
        return { name: check.name, status: 'healthy' };
      } catch (error) {
        return { name: check.name, status: 'unhealthy', error: error.message };
      }
    })
  );
  
  return results;
}
```

### 2. 调试技巧

#### 详细日志
```javascript
// 启用详细调试日志
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(message, data) {
  if (DEBUG) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
  }
}

// 使用示例
debugLog('Starting search', { query, tool: 'searchWeb' });
```

#### 请求追踪
```javascript
// 为每个请求生成唯一ID
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function trackedSearch(query) {
  const requestId = generateRequestId();
  
  try {
    logger.info('Search started', { requestId, query });
    const result = await searchWeb({ query });
    logger.info('Search completed', { requestId, resultCount: result.data.results.length });
    return result;
  } catch (error) {
    logger.error('Search failed', { requestId, error: error.message });
    throw error;
  }
}
```

## 扩展和定制

### 1. 自定义工具

#### 创建新工具
```javascript
// 创建自定义搜索工具
function createCustomTool(name, searchFunction) {
  return {
    name,
    description: `Custom search tool: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', default: 10 }
      },
      required: ['query']
    },
    execute: async (args) => {
      try {
        return await searchFunction(args);
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  };
}
```

#### 工具组合
```javascript
// 组合多个工具创建复合搜索
async function comprehensiveSearch(query) {
  const searches = [
    searchWeb({ query, maxResults: 5 }),
    searchNews({ query, maxResults: 3 }),
    searchAcademic({ query, maxResults: 2 })
  ];
  
  const results = await Promise.allSettled(searches);
  
  return {
    success: true,
    data: {
      query,
      combinedResults: results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value.data.results),
      sources: ['web', 'news', 'academic']
    }
  };
}
```

### 2. 结果后处理

#### 内容增强
```javascript
// 增强搜索结果
async function enhanceResults(results) {
  return Promise.all(results.map(async result => {
    // 提取关键词
    const keywords = await extractKeywords(result.summary);
    
    // 计算相关性分数
    const relevanceScore = calculateRelevance(result, originalQuery);
    
    // 获取额外元数据
    const metadata = await getAdditionalMetadata(result.url);
    
    return {
      ...result,
      keywords,
      relevanceScore,
      metadata
    };
  }));
}
```

#### 结果聚合
```javascript
// 智能结果聚合
function aggregateResults(multipleResults) {
  const aggregated = {};
  
  multipleResults.forEach(sourceResults => {
    sourceResults.data.results.forEach(result => {
      const key = generateResultKey(result);
      
      if (!aggregated[key]) {
        aggregated[key] = {
          ...result,
          sources: [sourceResults.data.source],
          confidence: 1
        };
      } else {
        aggregated[key].sources.push(sourceResults.data.source);
        aggregated[key].confidence += 1;
      }
    });
  });
  
  return Object.values(aggregated)
    .sort((a, b) => b.confidence - a.confidence);
}
```

## 总结

遵循这些最佳实践将帮助您：

1. **提高搜索质量**: 通过优化查询和选择合适的工具
2. **增强系统性能**: 通过缓存、并发控制和错误处理
3. **确保安全性**: 通过数据保护和API密钥管理
4. **便于维护**: 通过监控、日志和调试
5. **支持扩展**: 通过自定义工具和结果处理

记住，最佳实践会随着系统的发展而演进，定期审查和更新您的实现是很重要的。

---

**最后更新**: 2025-01-13  
**版本**: 2.0.0
