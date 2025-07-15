/**
 * Claude Desktop 配置设置脚本
 * 帮助用户正确配置Open Search MCP v2.0到Claude Desktop
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Claude Desktop 配置设置向导');
console.log('='.repeat(60));

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

// 生成MCP配置
function generateMCPConfig() {
  const projectPath = getProjectPath();
  const serverPath = path.join(projectPath, 'dist', 'v2-server.js');
  
  return {
    "open-search-mcp": {
      "command": "node",
      "args": [serverPath],
      "env": {
        "NODE_ENV": "production"
      }
    }
  };
}

// 读取现有配置
function readExistingConfig(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.log(`⚠️ 读取现有配置失败: ${error.message}`);
  }
  
  return {};
}

// 合并配置
function mergeConfig(existingConfig, newMCPConfig) {
  const config = { ...existingConfig };
  
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  
  // 合并MCP服务器配置
  config.mcpServers = {
    ...config.mcpServers,
    ...newMCPConfig
  };
  
  return config;
}

// 写入配置文件
function writeConfig(configPath, config) {
  try {
    // 确保目录存在
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 写入配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ 写入配置失败: ${error.message}`);
    return false;
  }
}

// 验证项目构建状态
async function verifyProjectBuild() {
  const projectPath = getProjectPath();
  const serverPath = path.join(projectPath, 'dist', 'v2-server.js');

  if (!fs.existsSync(serverPath)) {
    console.log('❌ 项目未构建，正在构建...');
    const { execSync } = await import('child_process');
    try {
      execSync('npm run build', { cwd: projectPath, stdio: 'inherit' });
      console.log('✅ 项目构建完成');
    } catch (error) {
      console.error('❌ 项目构建失败:', error.message);
      return false;
    }
  } else {
    console.log('✅ 项目已构建');
  }

  return true;
}

// 显示配置信息
function displayConfigInfo(configPath, config) {
  console.log('\n📋 配置信息:');
  console.log(`配置文件路径: ${configPath}`);
  console.log(`项目路径: ${getProjectPath()}`);
  console.log(`服务器路径: ${path.join(getProjectPath(), 'dist', 'v2-server.js')}`);
  
  console.log('\n🔧 MCP服务器配置:');
  Object.keys(config.mcpServers || {}).forEach(serverName => {
    console.log(`  - ${serverName}`);
  });
  
  console.log('\n📝 完整配置内容:');
  console.log(JSON.stringify(config, null, 2));
}

// 显示使用说明
function displayUsageInstructions() {
  console.log('\n📖 使用说明:');
  console.log('1. 完全关闭Claude Desktop应用');
  console.log('2. 重新启动Claude Desktop');
  console.log('3. 在Claude Desktop中应该能看到以下4个工具:');
  console.log('   - 🔍 multi_api_search (多API聚合搜索)');
  console.log('   - 🏗️ searx_cluster_search (Searx集群搜索)');
  console.log('   - 📊 enhanced_content_extraction (增强内容提取)');
  console.log('   - 🧠 deep_research (深度研究引擎)');
  
  console.log('\n💡 使用示例:');
  console.log('   "请使用deep_research工具研究人工智能的发展趋势"');
  console.log('   "请使用enhanced_content_extraction提取这个网页的内容"');
  
  console.log('\n🔍 故障排除:');
  console.log('   - 如果工具没有出现，请检查Claude Desktop的开发者工具控制台');
  console.log('   - 确保Node.js版本为18+');
  console.log('   - 确保配置文件JSON格式正确');
  console.log('   - 可以访问 http://localhost:6274 在MCP Inspector中测试工具');
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始配置Claude Desktop...\n');
    
    // 1. 验证项目构建状态
    if (!(await verifyProjectBuild())) {
      console.error('❌ 项目构建失败，无法继续配置');
      return;
    }
    
    // 2. 获取配置路径
    const configPath = getClaudeConfigPath();
    console.log(`📁 Claude Desktop配置路径: ${configPath}`);
    
    // 3. 读取现有配置
    console.log('📖 读取现有配置...');
    const existingConfig = readExistingConfig(configPath);
    
    // 4. 生成新的MCP配置
    console.log('⚙️ 生成MCP配置...');
    const newMCPConfig = generateMCPConfig();
    
    // 5. 合并配置
    console.log('🔄 合并配置...');
    const finalConfig = mergeConfig(existingConfig, newMCPConfig);
    
    // 6. 写入配置文件
    console.log('💾 写入配置文件...');
    if (writeConfig(configPath, finalConfig)) {
      console.log('✅ 配置写入成功!');
    } else {
      console.error('❌ 配置写入失败');
      return;
    }
    
    // 7. 显示配置信息
    displayConfigInfo(configPath, finalConfig);
    
    // 8. 显示使用说明
    displayUsageInstructions();
    
    console.log('\n🎉 Claude Desktop配置完成!');
    console.log('请重启Claude Desktop以使配置生效。');
    
  } catch (error) {
    console.error('❌ 配置过程中发生错误:', error.message);
    console.error('请手动配置Claude Desktop，参考以下配置:');
    
    const projectPath = getProjectPath();
    const serverPath = path.join(projectPath, 'dist', 'v2-server.js');
    
    console.log('\n手动配置内容:');
    console.log(JSON.stringify({
      "mcpServers": {
        "open-search-mcp": {
          "command": "node",
          "args": [serverPath],
          "env": {
            "NODE_ENV": "production"
          }
        }
      }
    }, null, 2));
  }
}

// 运行配置
main().catch(console.error);
