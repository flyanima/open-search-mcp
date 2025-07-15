/**
 * API凭证管理器 - 统一管理所有API密钥和权限
 * 解决API配置问题，提供验证和自动配置功能
 */

import { Logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('APICredentials');

interface APICredentials {
  // 搜索引擎API
  googleApiKey?: string;
  googleSearchEngineId?: string;
  bingApiKey?: string;
  
  // 社交媒体API
  redditClientId?: string;
  redditClientSecret?: string;
  redditUserAgent?: string;
  
  // AI模型API
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  huggingfaceApiToken?: string;
  
  // 新闻媒体API
  newsApiKey?: string;
  
  // 其他API
  githubToken?: string;
  
  // 验证状态
  validated?: Record<string, boolean>;
}

export class APICredentialsManager {
  private static instance: APICredentialsManager;
  private credentials: APICredentials = {};
  private configPath: string;

  private constructor() {
    this.configPath = path.join(process.cwd(), '.env');
    this.loadCredentials();
  }

  static getInstance(): APICredentialsManager {
    if (!APICredentialsManager.instance) {
      APICredentialsManager.instance = new APICredentialsManager();
    }
    return APICredentialsManager.instance;
  }

  /**
   * 加载API凭证
   */
  private loadCredentials(): void {
    logger.info('Loading API credentials...');

    // 从环境变量加载
    this.credentials = {
      googleApiKey: process.env.GOOGLE_API_KEY,
      googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
      bingApiKey: process.env.BING_API_KEY,
      
      redditClientId: process.env.REDDIT_CLIENT_ID,
      redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
      redditUserAgent: process.env.REDDIT_USER_AGENT || 'Open-Search-MCP/2.0',
      
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      huggingfaceApiToken: process.env.HUGGINGFACE_API_TOKEN,
      
      newsApiKey: process.env.NEWS_API_KEY,
      githubToken: process.env.GITHUB_TOKEN,
      
      validated: {}
    };

    this.logCredentialStatus();
  }

  /**
   * 记录凭证状态
   */
  private logCredentialStatus(): void {
    const status = {
      google: !!(this.credentials.googleApiKey && this.credentials.googleSearchEngineId),
      bing: !!this.credentials.bingApiKey,
      reddit: !!(this.credentials.redditClientId && this.credentials.redditClientSecret),
      anthropic: !!this.credentials.anthropicApiKey,
      openai: !!this.credentials.openaiApiKey,
      gemini: !!this.credentials.geminiApiKey,
      huggingface: !!this.credentials.huggingfaceApiToken,
      news: !!this.credentials.newsApiKey,
      github: !!this.credentials.githubToken
    };

    logger.info('API Credentials Status:', status);

    const configuredCount = Object.values(status).filter(Boolean).length;
    const totalCount = Object.keys(status).length;
    
    logger.info(`API Configuration: ${configuredCount}/${totalCount} services configured`);
  }

  /**
   * 获取特定服务的凭证
   */
  getCredentials(service: string): any {
    switch (service.toLowerCase()) {
      case 'google':
        return {
          apiKey: this.credentials.googleApiKey,
          searchEngineId: this.credentials.googleSearchEngineId
        };
      case 'reddit':
        return {
          clientId: this.credentials.redditClientId,
          clientSecret: this.credentials.redditClientSecret,
          userAgent: this.credentials.redditUserAgent
        };
      case 'anthropic':
        return { apiKey: this.credentials.anthropicApiKey };
      case 'openai':
        return { apiKey: this.credentials.openaiApiKey };
      case 'gemini':
        return { apiKey: this.credentials.geminiApiKey };
      case 'huggingface':
        return { token: this.credentials.huggingfaceApiToken };
      case 'news':
        return { apiKey: this.credentials.newsApiKey };
      case 'github':
        return { token: this.credentials.githubToken };
      case 'bing':
        return { apiKey: this.credentials.bingApiKey };
      default:
        return null;
    }
  }

  /**
   * 检查服务是否已配置
   */
  isConfigured(service: string): boolean {
    const creds = this.getCredentials(service);
    if (!creds) return false;

    switch (service.toLowerCase()) {
      case 'google':
        return !!(creds.apiKey && creds.searchEngineId);
      case 'reddit':
        return !!(creds.clientId && creds.clientSecret);
      default:
        return !!(creds.apiKey || creds.token);
    }
  }

  /**
   * 验证API凭证
   */
  async validateCredentials(service: string): Promise<boolean> {
    if (!this.isConfigured(service)) {
      logger.warn(`${service} API not configured`);
      return false;
    }

    try {
      const isValid = await this.testAPIConnection(service);
      if (this.credentials.validated) {
        this.credentials.validated[service] = isValid;
      }
      
      logger.info(`${service} API validation: ${isValid ? 'SUCCESS' : 'FAILED'}`);
      return isValid;
    } catch (error) {
      logger.error(`${service} API validation failed:`, error);
      return false;
    }
  }

  /**
   * 测试API连接
   */
  private async testAPIConnection(service: string): Promise<boolean> {
    const creds = this.getCredentials(service);
    
    switch (service.toLowerCase()) {
      case 'google':
        return this.testGoogleAPI(creds);
      case 'reddit':
        return this.testRedditAPI(creds);
      case 'anthropic':
        return this.testAnthropicAPI(creds);
      case 'github':
        return this.testGitHubAPI(creds);
      default:
        logger.warn(`No validation test available for ${service}`);
        return true; // 假设配置正确
    }
  }

  /**
   * 测试Google API
   */
  private async testGoogleAPI(creds: any): Promise<boolean> {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${creds.apiKey}&cx=${creds.searchEngineId}&q=test&num=1`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试Reddit API
   */
  private async testRedditAPI(creds: any): Promise<boolean> {
    try {
      const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': creds.userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试Anthropic API
   */
  private async testAnthropicAPI(creds: any): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': creds.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        })
      });
      return response.status !== 401; // 401表示API密钥无效
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试GitHub API
   */
  private async testGitHubAPI(creds: any): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${creds.token}`,
          'User-Agent': 'Open-Search-MCP/2.0'
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成配置报告
   */
  generateConfigReport(): any {
    const services = ['google', 'reddit', 'anthropic', 'openai', 'gemini', 'huggingface', 'news', 'github', 'bing'];
    const report = {
      timestamp: new Date().toISOString(),
      totalServices: services.length,
      configuredServices: 0,
      validatedServices: 0,
      services: {} as Record<string, any>
    };

    for (const service of services) {
      const isConfigured = this.isConfigured(service);
      const isValidated = this.credentials.validated?.[service] || false;
      
      if (isConfigured) report.configuredServices++;
      if (isValidated) report.validatedServices++;
      
      report.services[service] = {
        configured: isConfigured,
        validated: isValidated,
        status: isValidated ? 'valid' : (isConfigured ? 'untested' : 'missing')
      };
    }

    return report;
  }

  /**
   * 创建配置模板
   */
  createConfigTemplate(): string {
    return `# Open Search MCP API Configuration
# Copy this to .env file and fill in your API keys

# Google Custom Search (Required for news search)
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# Reddit API (Required for Reddit search)
REDDIT_CLIENT_ID=your_reddit_client_id_here
REDDIT_CLIENT_SECRET=your_reddit_client_secret_here
REDDIT_USER_AGENT=Open-Search-MCP/2.0

# AI Model APIs (Optional but recommended)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_API_TOKEN=your_huggingface_token_here

# Other APIs (Optional)
NEWS_API_KEY=your_news_api_key_here
GITHUB_TOKEN=your_github_token_here
BING_API_KEY=your_bing_api_key_here

# Instructions:
# 1. Get Google API key from: https://console.developers.google.com/
# 2. Get Reddit API credentials from: https://www.reddit.com/prefs/apps
# 3. Get Anthropic API key from: https://console.anthropic.com/
# 4. Get other API keys from respective provider websites
`;
  }
}

export default APICredentialsManager;
