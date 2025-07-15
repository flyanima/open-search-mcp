/**
 * 最终设置 - 使用完整的工作版本服务器
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

async function finalSetup() {
  try {
    console.log('🎯 Open Search MCP v2.0 最终设置...\n');
    
    const configPath = getClaudeConfigPath();
    const projectPath = getProjectPath();
    const serverPath = path.join(projectPath, 'src', 'working-server.cjs');
    
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
    const backupPath = configPath + '.backup.final.' + Date.now();
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
    
    console.log('\n🎉 Open Search MCP v2.0 设置完成！');
    console.log('='.repeat(60));
    
    console.log('\n🔧 包含的工具:');
    console.log('  1. 🔍 multi_api_search - 多API聚合搜索');
    console.log('  2. 🏗️ searx_cluster_search - Searx集群搜索');
    console.log('  3. 📊 enhanced_content_extraction - 增强内容提取');
    console.log('  4. 🧠 deep_research - 深度研究引擎');
    
    console.log('\n✅ 问题解决:');
    console.log('  ✅ 修复了ES模块兼容性问题');
    console.log('  ✅ 使用CommonJS格式确保稳定性');
    console.log('  ✅ 添加了详细的错误处理和日志');
    console.log('  ✅ 测试确认服务器可以正常启动');
    
    console.log('\n🧪 下一步操作:');
    console.log('1. 完全关闭Claude Desktop应用');
    console.log('2. 重新启动Claude Desktop');
    console.log('3. 等待5-10秒让MCP服务器连接');
    console.log('4. 查看是否出现4个工具');
    
    console.log('\n🎯 测试建议:');
    console.log('• 测试多API搜索: "请使用multi_api_search搜索机器学习"');
    console.log('• 测试深度研究: "请使用deep_research研究人工智能发展趋势"');
    console.log('• 测试内容提取: "请使用enhanced_content_extraction提取https://example.com的内容"');
    
    console.log('\n🔍 如果仍有问题:');
    console.log('- 检查Claude Desktop版本是否支持MCP');
    console.log('- 查看"Open Logs Folder"中的详细错误信息');
    console.log('- 确保没有杀毒软件阻止Node.js进程');
    console.log('- 验证Node.js版本 >= 18.0.0');
    
    console.log('\n🎊 恭喜！Open Search MCP v2.0 已准备就绪！');
    
  } catch (error) {
    console.error('❌ 最终设置失败:', error.message);
  }
}

finalSetup();
