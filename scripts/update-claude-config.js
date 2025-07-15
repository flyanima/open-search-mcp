/**
 * 更新Claude Desktop配置使用简化版本的服务器
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
  
  let configPath;
  
  switch (platform) {
    case 'win32':
      configPath = path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
      break;
    case 'darwin':
      configPath = path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      break;
    case 'linux':
      configPath = path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
      break;
    default:
      throw new Error(`不支持的操作系统: ${platform}`);
  }
  
  return configPath;
}

// 获取项目路径
function getProjectPath() {
  return path.resolve(__dirname, '..');
}

async function updateConfig() {
  try {
    console.log('🔧 更新Claude Desktop配置使用简化版本服务器...\n');
    
    const configPath = getClaudeConfigPath();
    const projectPath = getProjectPath();
    const serverPath = path.join(projectPath, 'dist', 'v2-server-simple.js');
    
    console.log(`📁 配置文件路径: ${configPath}`);
    console.log(`🚀 服务器路径: ${serverPath}`);
    
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
    
    console.log('\n📖 下一步:');
    console.log('1. 完全关闭Claude Desktop');
    console.log('2. 重新启动Claude Desktop');
    console.log('3. 检查工具是否正常加载');
    
  } catch (error) {
    console.error('❌ 配置更新失败:', error.message);
  }
}

updateConfig();
