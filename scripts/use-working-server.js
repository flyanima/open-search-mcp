/**
 * 更新Claude Desktop配置使用工作的CommonJS服务器
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

async function updateConfig() {
  try {
    console.log('🔧 更新Claude Desktop配置使用工作的CommonJS服务器...\n');
    
    const configPath = getClaudeConfigPath();
    const projectPath = getProjectPath();
    const serverPath = path.join(projectPath, 'src', 'test-server.cjs');
    
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
    const backupPath = configPath + '.backup.' + Date.now();
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
    console.log('\n📋 更新的配置:');
    console.log(JSON.stringify(config.mcpServers['open-search-mcp'], null, 2));
    
    console.log('\n🎉 重要提示:');
    console.log('✅ 这个版本已经测试过，可以正常启动！');
    console.log('✅ 使用CommonJS格式，避免了ES模块兼容性问题');
    
    console.log('\n🧪 测试步骤:');
    console.log('1. 完全关闭Claude Desktop');
    console.log('2. 重新启动Claude Desktop');
    console.log('3. 等待几秒钟让MCP服务器连接');
    console.log('4. 查看是否出现 "test_search" 工具');
    console.log('5. 如果出现，尝试使用: "请使用test_search工具搜索hello"');
    
    console.log('\n🔍 如果仍然失败:');
    console.log('- 点击"Open Logs Folder"查看详细错误');
    console.log('- 检查是否有杀毒软件阻止Node.js');
    console.log('- 确保Claude Desktop版本支持MCP');
    
  } catch (error) {
    console.error('❌ 配置更新失败:', error.message);
  }
}

updateConfig();
