/**
 * MCP连接诊断脚本
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getProjectPath() {
  return path.resolve(__dirname, '..');
}

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

async function diagnose() {
  console.log('🔍 MCP连接诊断开始...\n');
  
  const projectPath = getProjectPath();
  const configPath = getClaudeConfigPath();
  
  // 1. 检查基本环境
  console.log('📋 环境检查:');
  console.log(`  Node.js版本: ${process.version}`);
  console.log(`  操作系统: ${os.platform()} ${os.arch()}`);
  console.log(`  项目路径: ${projectPath}`);
  console.log(`  配置路径: ${configPath}`);
  
  // 2. 检查文件存在性
  console.log('\n📁 文件检查:');
  const filesToCheck = [
    'dist/minimal-server.js',
    'dist/v2-server-simple.js',
    'dist/v2-server.js',
    'package.json'
  ];
  
  for (const file of filesToCheck) {
    const fullPath = path.join(projectPath, file);
    const exists = fs.existsSync(fullPath);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    
    if (exists && file.endsWith('.js')) {
      const stats = fs.statSync(fullPath);
      console.log(`      大小: ${stats.size} bytes, 修改时间: ${stats.mtime.toLocaleString()}`);
    }
  }
  
  // 3. 检查Claude配置
  console.log('\n⚙️ Claude Desktop配置检查:');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('  ✅ 配置文件存在且格式正确');
      
      if (config.mcpServers && config.mcpServers['open-search-mcp']) {
        const mcpConfig = config.mcpServers['open-search-mcp'];
        console.log('  ✅ open-search-mcp配置存在');
        console.log(`      命令: ${mcpConfig.command}`);
        console.log(`      参数: ${JSON.stringify(mcpConfig.args)}`);
        
        // 检查服务器文件是否存在
        const serverPath = mcpConfig.args[0];
        if (fs.existsSync(serverPath)) {
          console.log('  ✅ 服务器文件存在');
        } else {
          console.log('  ❌ 服务器文件不存在');
        }
      } else {
        console.log('  ❌ open-search-mcp配置不存在');
      }
    } catch (error) {
      console.log(`  ❌ 配置文件格式错误: ${error.message}`);
    }
  } else {
    console.log('  ❌ 配置文件不存在');
  }
  
  // 4. 测试服务器启动
  console.log('\n🚀 服务器启动测试:');
  const serverPath = path.join(projectPath, 'dist', 'minimal-server.js');
  
  if (!fs.existsSync(serverPath)) {
    console.log('  ❌ 最小化服务器文件不存在');
    return;
  }
  
  return new Promise((resolve) => {
    console.log('  🔄 启动最小化服务器...');
    
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: projectPath
    });
    
    let hasOutput = false;
    let hasError = false;
    
    server.stdout.on('data', (data) => {
      hasOutput = true;
      console.log(`  📤 stdout: ${data.toString().trim()}`);
    });
    
    server.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        hasOutput = true;
        console.log(`  📤 stderr: ${text}`);
      }
    });
    
    server.on('error', (error) => {
      hasError = true;
      console.log(`  ❌ 启动错误: ${error.message}`);
    });
    
    server.on('spawn', () => {
      console.log('  ✅ 服务器进程已启动');
    });
    
    // 等待2秒后关闭
    setTimeout(() => {
      server.kill('SIGTERM');
      
      setTimeout(() => {
        if (!hasError) {
          console.log('  ✅ 服务器可以正常启动');
        }
        
        if (!hasOutput) {
          console.log('  ℹ️ 服务器启动后无输出（这是正常的，MCP服务器通常静默运行）');
        }
        
        console.log('\n💡 诊断建议:');
        
        if (hasError) {
          console.log('  ❌ 服务器启动失败，请检查代码错误');
        } else {
          console.log('  ✅ 服务器可以正常启动');
          console.log('  📋 下一步操作:');
          console.log('    1. 完全关闭Claude Desktop');
          console.log('    2. 重新启动Claude Desktop');
          console.log('    3. 等待10-15秒让MCP服务器连接');
          console.log('    4. 查看是否出现"test_search"工具');
          console.log('    5. 如果仍然失败，请在Claude Desktop中按F12查看开发者工具');
        }
        
        resolve();
      }, 500);
    }, 2000);
  });
}

diagnose().catch(console.error);
