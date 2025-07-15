#!/usr/bin/env node

/**
 * Alpha Vantage 生产环境设置脚本
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Alpha Vantage Production Setup\n');

// 检查环境变量
function checkEnvironment() {
  console.log('1. 📋 Checking environment configuration...');
  
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.log('❌ ALPHA_VANTAGE_API_KEY not set');
    console.log('💡 Please set your API key:');
    console.log('   export ALPHA_VANTAGE_API_KEY="your_alpha_vantage_api_key_here"');
    return false;
  }
  
  console.log('✅ ALPHA_VANTAGE_API_KEY configured');
  console.log(`🔑 Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  return true;
}

// 检查文件结构
function checkFileStructure() {
  console.log('\n2. 📁 Checking file structure...');
  
  const requiredFiles = [
    'src/api/clients/alpha-vantage-search-client.ts',
    'src/utils/financial-search-router.ts',
    'src/tools/financial/alpha-vantage-financial-info-search.ts',
    'src/tools/financial/alpha-vantage-financial-news-search.ts',
    'src/tools/financial/alpha-vantage-market-calendar-search.ts',
    'src/tools/financial/register-alpha-vantage-search-tools.ts'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - Missing!`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// 检查依赖
function checkDependencies() {
  console.log('\n3. 📦 Checking dependencies...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredDeps = ['axios', 'typescript'];
    let allDepsInstalled = true;
    
    requiredDeps.forEach(dep => {
      if (dependencies[dep]) {
        console.log(`✅ ${dep}: ${dependencies[dep]}`);
      } else {
        console.log(`❌ ${dep} - Not installed!`);
        allDepsInstalled = false;
      }
    });
    
    return allDepsInstalled;
  } catch (error) {
    console.log('❌ Could not read package.json');
    return false;
  }
}

// 测试API连接
async function testAPIConnection() {
  console.log('\n4. 🌐 Testing API connection...');
  
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.log('❌ No API key to test');
    return false;
  }
  
  try {
    const testUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${apiKey}`;
    const response = await fetch(testUrl);
    const data = await response.json();
    
    if (data['Error Message']) {
      console.log('❌ API Error:', data['Error Message']);
      return false;
    }
    
    if (data['Note']) {
      console.log('⚠️  API Note:', data['Note']);
      return false;
    }
    
    if (data['Global Quote']) {
      console.log('✅ API connection successful');
      console.log(`📊 Test result: AAPL at $${data['Global Quote']['05. price']}`);
      return true;
    }
    
    console.log('❌ Unexpected API response');
    return false;
    
  } catch (error) {
    console.log('❌ API connection failed:', error.message);
    return false;
  }
}

// 创建配置文件
function createConfigFiles() {
  console.log('\n5. 📝 Creating configuration files...');
  
  // 创建 .env 文件
  const envContent = `# Alpha Vantage Configuration
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here

# Rate Limits (Free Tier)
ALPHA_VANTAGE_RATE_LIMIT_PER_MINUTE=5
ALPHA_VANTAGE_RATE_LIMIT_PER_DAY=500

# Optional: Enable debug logging
# DEBUG=AlphaVantage*
`;

  try {
    if (!fs.existsSync('.env')) {
      fs.writeFileSync('.env', envContent);
      console.log('✅ Created .env file');
    } else {
      console.log('ℹ️  .env file already exists');
    }
  } catch (error) {
    console.log('❌ Could not create .env file:', error.message);
  }
  
  // 创建启动脚本
  const startScript = `#!/bin/bash
# Alpha Vantage Quick Start Script

echo "🚀 Starting Open Search MCP with Alpha Vantage"

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check API key
if [ -z "$ALPHA_VANTAGE_API_KEY" ]; then
  echo "❌ ALPHA_VANTAGE_API_KEY not set"
  exit 1
fi

echo "✅ API Key configured"

# Build and start
npm run build && npm start
`;

  try {
    fs.writeFileSync('start-with-alpha-vantage.sh', startScript);
    fs.chmodSync('start-with-alpha-vantage.sh', '755');
    console.log('✅ Created start-with-alpha-vantage.sh');
  } catch (error) {
    console.log('❌ Could not create start script:', error.message);
  }
}

// 生成使用指南
function generateUsageGuide() {
  console.log('\n6. 📖 Generating usage guide...');
  
  const usageGuide = `# Alpha Vantage 使用指南

## 🎯 支持的查询类型

### 股票信息查询
- "苹果股价" / "AAPL stock price" → 获取Apple实时股价
- "特斯拉公司" / "Tesla company" → 搜索Tesla公司信息
- "微软股票" / "MSFT stock" → 获取Microsoft股票信息

### 财经新闻查询
- "特斯拉新闻" / "Tesla news" → 获取Tesla最新新闻+AI情感分析
- "苹果新闻" / "Apple news" → 获取Apple相关新闻
- "今日涨幅榜" / "market movers" → 获取市场涨跌排行
- "科技股新闻" / "tech stocks news" → 获取科技板块新闻

### 外汇和商品查询
- "美元汇率" / "USD to CNY rate" → 获取美元兑人民币汇率
- "欧元汇率" / "EUR rate" → 获取欧元汇率
- "原油价格" / "oil price" → 获取WTI原油价格
- "布伦特原油" / "Brent oil" → 获取布伦特原油价格

### 市场日历查询
- "财报日历" / "earnings calendar" → 获取即将发布的财报
- "IPO日历" / "IPO calendar" → 获取即将上市的公司
- "本周财报" / "this week earnings" → 获取本周财报安排

## ⚡ 使用限制

- **免费版**: 每分钟5次请求，每天500次请求
- **响应时间**: 通常1-3秒
- **数据更新**: 实时数据，延迟<1分钟

## 🔧 故障排除

### 常见错误
1. **API密钥错误**: 检查ALPHA_VANTAGE_API_KEY环境变量
2. **速率限制**: 等待1分钟后重试
3. **查询无结果**: 尝试使用更具体的关键词

### 获取帮助
- 查看日志输出了解详细错误信息
- 确认API密钥有效性
- 检查网络连接

## 📊 监控建议

- 定期检查API使用量
- 监控响应时间和成功率
- 考虑升级到Premium版本（如需要）
`;

  try {
    fs.writeFileSync('ALPHA_VANTAGE_USAGE_GUIDE.md', usageGuide);
    console.log('✅ Created ALPHA_VANTAGE_USAGE_GUIDE.md');
  } catch (error) {
    console.log('❌ Could not create usage guide:', error.message);
  }
}

// 主函数
async function main() {
  console.log('Alpha Vantage Production Setup for Open Search MCP');
  console.log('==================================================\n');
  
  const checks = [
    checkEnvironment(),
    checkFileStructure(),
    checkDependencies()
  ];
  
  const apiTest = await testAPIConnection();
  checks.push(apiTest);
  
  createConfigFiles();
  generateUsageGuide();
  
  console.log('\n📋 Setup Summary:');
  console.log('==================');
  
  const allPassed = checks.every(check => check);
  
  if (allPassed) {
    console.log('✅ All checks passed!');
    console.log('\n🚀 Ready to deploy Alpha Vantage tools!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run build');
    console.log('2. Run: npm start');
    console.log('3. Test with queries like "苹果股价" or "Tesla news"');
    console.log('4. Monitor API usage and performance');
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.');
    console.log('\n💡 Common solutions:');
    console.log('- Set ALPHA_VANTAGE_API_KEY environment variable');
    console.log('- Run: npm install');
    console.log('- Check file permissions');
    console.log('- Verify API key validity');
  }
  
  console.log('\n📖 See ALPHA_VANTAGE_USAGE_GUIDE.md for detailed usage instructions');
}

// 运行设置
main().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
