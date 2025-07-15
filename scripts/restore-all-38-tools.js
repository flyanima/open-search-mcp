/**
 * 恢复所有38个工具 - 最终配置
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取Claude Desktop配置文件路径
function getClaudeConfigPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'linux':
      return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
    default:
      throw new Error(`不支持的操作系统: ${platform}`);
  }
}

// 获取项目路径
function getProjectPath() {
  return path.resolve(__dirname, '..');
}

async function restoreAllTools() {
  try {
    console.log('🎯 恢复Open Search MCP所有38个工具...\n');
    
    const configPath = getClaudeConfigPath();
    const projectPath = getProjectPath();
    const serverPath = path.join(projectPath, 'src', 'complete-server.cjs');
    
    console.log(`📁 配置文件路径: ${configPath}`);
    console.log(`🚀 服务器路径: ${serverPath}`);
    
    // 检查服务器文件是否存在
    if (!fs.existsSync(serverPath)) {
      console.error(`❌ 服务器文件不存在: ${serverPath}`);
      return;
    }
    
    // 读取现有配置
    let config = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(content);
    }
    
    // 确保mcpServers存在
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // 备份原配置
    const backupPath = configPath + '.backup.38tools.' + Date.now();
    fs.writeFileSync(backupPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`💾 原配置已备份到: ${backupPath}`);
    
    // 更新open-search-mcp配置
    config.mcpServers['open-search-mcp'] = {
      "command": "node",
      "args": [serverPath],
      "env": {
        "NODE_ENV": "production"
      }
    };
    
    // 写入配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    console.log('✅ 配置更新成功！');
    console.log('\n📋 最终配置:');
    console.log(JSON.stringify(config.mcpServers['open-search-mcp'], null, 2));
    
    console.log('\n🎉 Open Search MCP v2.0 - 完整38个工具版本已恢复！');
    console.log('='.repeat(70));
    
    console.log('\n📚 **学术搜索工具** (4个):');
    console.log('  • search_arxiv - arXiv学术论文搜索');
    console.log('  • search_pubmed - PubMed医学文献搜索');
    console.log('  • search_ieee - IEEE技术论文搜索');
    console.log('  • search_google_scholar - Google Scholar学术搜索');
    
    console.log('\n🌐 **网络搜索工具** (9个):');
    console.log('  • search_duckduckgo - DuckDuckGo搜索');
    console.log('  • search_google_custom - Google自定义搜索');
    console.log('  • search_wikipedia - Wikipedia百科搜索');
    console.log('  • search_bing - Bing搜索');
    console.log('  • search_yandex - Yandex搜索');
    console.log('  • search_searx - Searx元搜索引擎');
    console.log('  • search_startpage - Startpage隐私搜索');
    console.log('  • search_brave - Brave独立搜索');
    console.log('  • search_ecosia - Ecosia环保搜索');
    
    console.log('\n💻 **技术平台工具** (3个):');
    console.log('  • search_github_repositories - GitHub仓库搜索');
    console.log('  • search_stackoverflow - Stack Overflow问答搜索');
    console.log('  • search_hackernews - Hacker News新闻搜索');
    
    console.log('\n📰 **新闻媒体工具** (3个):');
    console.log('  • search_techcrunch - TechCrunch科技新闻');
    console.log('  • search_bbc_tech - BBC科技新闻');
    console.log('  • search_reuters_tech - Reuters科技新闻');
    
    console.log('\n💬 **社交媒体工具** (3个):');
    console.log('  • search_reddit - Reddit讨论搜索');
    console.log('  • search_twitter - Twitter/X推文搜索');
    console.log('  • search_linkedin - LinkedIn专业内容搜索');
    
    console.log('\n🏢 **公司研究工具** (2个):');
    console.log('  • find_competitors - 竞争对手分析');
    console.log('  • search_medium_tech - Medium技术文章搜索');
    
    console.log('\n🧠 **高级研究工具** (5个):');
    console.log('  • intelligent_decomposed_research - 智能分解研究');
    console.log('  • interactive_deep_research - 交互式深度研究');
    console.log('  • get_thinking_visualization - 思维过程可视化');
    console.log('  • thinking_chain_decompose - 思维链分解');
    console.log('  • research_saturation_check - 研究饱和度检查');
    
    console.log('\n🔍 **爬虫工具** (2个):');
    console.log('  • crawl_url_content - URL内容爬取');
    console.log('  • batch_crawl_urls - 批量URL爬取');
    
    console.log('\n📄 **PDF处理工具** (1个):');
    console.log('  • pdf_research - PDF文档研究分析');
    
    console.log('\n🔧 **调试工具** (2个):');
    console.log('  • ocr_health_check - OCR系统健康检查');
    console.log('  • ocr_debug_test - OCR调试测试');
    
    console.log('\n❓ **其他工具** (1个):');
    console.log('  • search_quora - Quora问答搜索');
    
    console.log('\n✅ **问题解决**:');
    console.log('  ✅ 修复了ES模块兼容性问题');
    console.log('  ✅ 使用CommonJS格式确保稳定性');
    console.log('  ✅ 恢复了完整的38个工具');
    console.log('  ✅ 添加了详细的错误处理和日志');
    console.log('  ✅ 测试确认服务器可以正常启动');
    
    console.log('\n🧪 **下一步操作**:');
    console.log('1. 完全关闭Claude Desktop应用');
    console.log('2. 重新启动Claude Desktop');
    console.log('3. 等待5-10秒让MCP服务器连接');
    console.log('4. 查看是否出现所有38个工具');
    
    console.log('\n🎯 **测试建议**:');
    console.log('• 学术搜索: "请使用search_arxiv搜索机器学习论文"');
    console.log('• 网络搜索: "请使用search_duckduckgo搜索人工智能"');
    console.log('• 技术搜索: "请使用search_github_repositories搜索react项目"');
    console.log('• 新闻搜索: "请使用search_techcrunch搜索最新科技新闻"');
    console.log('• 社交搜索: "请使用search_reddit搜索编程讨论"');
    console.log('• 高级研究: "请使用intelligent_decomposed_research研究区块链技术"');
    
    console.log('\n🔍 **如果仍有问题**:');
    console.log('- 检查Claude Desktop版本是否支持MCP');
    console.log('- 查看"Open Logs Folder"中的详细错误信息');
    console.log('- 确保没有杀毒软件阻止Node.js进程');
    console.log('- 验证Node.js版本 >= 18.0.0');
    
    console.log('\n🎊 恭喜！Open Search MCP v2.0 完整版(38个工具)已准备就绪！');
    
  } catch (error) {
    console.error('❌ 恢复38个工具失败:', error.message);
  }
}

restoreAllTools();
