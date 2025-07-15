/**
 * Enhanced Content Extractor - LLM-driven intelligent data extraction
 * Based on Firecrawl architecture, implementing structured data extraction and intelligent content processing
 */

import axios, { AxiosInstance } from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Logger } from '../utils/logger.js';

export interface ExtractionOptions {
  formats: ('markdown' | 'json' | 'html' | 'screenshot')[];
  onlyMainContent: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  timeout?: number;
  enableJavaScript?: boolean;
  userAgent?: string;
}

export interface ExtractedData<T = any> {
  url: string;
  extractedData: T;
  metadata: ContentMetadata;
  formats: {
    markdown?: string;
    json?: any;
    html?: string;
    screenshot?: string;
  };
  confidence: number;
  processingTime: number;
}

export interface ContentMetadata {
  title: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  language?: string;
  wordCount: number;
  readingTime: number;
  contentType: 'article' | 'product' | 'forum' | 'academic' | 'news' | 'other';
  quality: {
    score: number;
    factors: QualityFactor[];
  };
  extractedAt: string;
}

export interface QualityFactor {
  name: string;
  score: number;
  description: string;
}

export class EnhancedContentExtractor {
  private httpClient: AxiosInstance;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('EnhancedContentExtractor');
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
  }

  /**
   * 使用结构化schema提取数据
   */
  async extractWithSchema<T>(
    url: string,
    schema: any,
    options: ExtractionOptions = { formats: ['json'], onlyMainContent: true }
  ): Promise<ExtractedData<T>> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting schema-based extraction for: ${url}`);

      // 1. 获取网页内容
      const rawContent = await this.fetchContent(url, options);
      
      // 2. 解析和清理内容
      const cleanedContent = await this.parseAndCleanContent(rawContent, options);
      
      // 3. 使用schema进行结构化提取
      const extractedData = await this.applySchemaExtraction<T>(cleanedContent, schema);
      
      // 4. 生成多种格式
      const formats = await this.generateFormats(cleanedContent, options.formats);
      
      // 5. 计算质量评分
      const quality = this.calculateQualityScore(cleanedContent);
      
      // 6. 构建元数据
      const metadata = this.buildMetadata(cleanedContent, quality);
      
      const processingTime = Date.now() - startTime;
      
      const result: ExtractedData<T> = {
        url,
        extractedData,
        metadata,
        formats,
        confidence: this.calculateConfidence(extractedData, quality),
        processingTime
      };

      this.logger.info(`Schema extraction completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      this.logger.error(`Schema extraction failed for ${url}:`, error);
      throw new Error(`Failed to extract data with schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 使用自然语言prompt提取数据
   */
  async extractWithPrompt(
    url: string,
    prompt: string,
    systemPrompt?: string,
    options: ExtractionOptions = { formats: ['json'], onlyMainContent: true }
  ): Promise<ExtractedData> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting prompt-based extraction for: ${url}`);

      // 1. 获取和处理内容
      const rawContent = await this.fetchContent(url, options);
      const cleanedContent = await this.parseAndCleanContent(rawContent, options);
      
      // 2. 使用LLM进行智能提取
      const extractedData = await this.applyPromptExtraction(cleanedContent, prompt, systemPrompt);
      
      // 3. 生成格式和元数据
      const formats = await this.generateFormats(cleanedContent, options.formats);
      const quality = this.calculateQualityScore(cleanedContent);
      const metadata = this.buildMetadata(cleanedContent, quality);
      
      const processingTime = Date.now() - startTime;
      
      return {
        url,
        extractedData,
        metadata,
        formats,
        confidence: this.calculateConfidence(extractedData, quality),
        processingTime
      };

    } catch (error) {
      this.logger.error(`Prompt extraction failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * 批量提取多个URL
   */
  async batchExtract<T>(
    urls: string[],
    schema: any,
    options: ExtractionOptions & { concurrency?: number } = { formats: ['json'], onlyMainContent: true }
  ): Promise<ExtractedData<T>[]> {
    const concurrency = options.concurrency || 5;
    const results: ExtractedData<T>[] = [];
    
    this.logger.info(`Starting batch extraction for ${urls.length} URLs with concurrency ${concurrency}`);

    // 分批处理
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (url) => {
        try {
          return await this.extractWithSchema<T>(url, schema, options);
        } catch (error) {
          this.logger.warn(`Failed to extract from ${url}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      });

      // 添加延迟避免过于频繁的请求
      if (i + concurrency < urls.length) {
        await this.delay(1000);
      }
    }

    this.logger.info(`Batch extraction completed: ${results.length}/${urls.length} successful`);
    return results;
  }

  /**
   * 获取网页内容
   */
  private async fetchContent(url: string, options: ExtractionOptions): Promise<string> {
    const config = {
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    };

    const response = await this.httpClient.get(url, config);
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
  }

  /**
   * Parse and clean content
   */
  private async parseAndCleanContent(html: string, options: ExtractionOptions): Promise<any> {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    let content: any = {
      title: document.title || '',
      html: html,
      text: '',
      markdown: ''
    };

    if (options.onlyMainContent) {
      // 使用Readability提取主要内容
      const reader = new Readability(document);
      const article = reader.parse();
      
      if (article) {
        content.title = article.title || content.title;
        content.text = article.textContent || '';
        content.html = article.content || '';
        content.excerpt = article.excerpt || '';
        content.byline = article.byline || '';
        content.length = article.length || 0;
      }
    } else {
      content.text = document.body?.textContent || '';
    }

    // 应用标签过滤
    if (options.includeTags || options.excludeTags) {
      content = this.applyTagFiltering(content, options);
    }

    return content;
  }

  /**
   * 应用schema提取
   */
  private async applySchemaExtraction<T>(content: any, schema: any): Promise<T> {
    // 这里应该集成LLM进行结构化提取
    // 暂时返回基础提取结果
    const extracted = {
      title: content.title,
      content: content.text,
      summary: content.excerpt || content.text.substring(0, 200),
      metadata: {
        wordCount: content.text.split(' ').length,
        author: content.byline
      }
    };

    return extracted as T;
  }

  /**
   * 应用prompt提取
   */
  private async applyPromptExtraction(content: any, prompt: string, systemPrompt?: string): Promise<any> {
    // 这里应该调用LLM API进行智能提取
    // 暂时返回基础提取结果
    return {
      extractedContent: content.text,
      prompt: prompt,
      systemPrompt: systemPrompt,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * 生成多种格式
   */
  private async generateFormats(content: any, formats: string[]): Promise<any> {
    const result: any = {};

    for (const format of formats) {
      switch (format) {
        case 'markdown':
          result.markdown = this.convertToMarkdown(content);
          break;
        case 'json':
          result.json = this.convertToJSON(content);
          break;
        case 'html':
          result.html = content.html;
          break;
        case 'screenshot':
          // 截图功能需要浏览器支持
          result.screenshot = null;
          break;
      }
    }

    return result;
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(content: any): { score: number; factors: QualityFactor[] } {
    const factors: QualityFactor[] = [];
    let totalScore = 0;

    // 内容长度评分
    const wordCount = content.text.split(' ').length;
    const lengthScore = Math.min(wordCount / 500, 1) * 0.3;
    factors.push({
      name: 'content_length',
      score: lengthScore,
      description: `Content has ${wordCount} words`
    });
    totalScore += lengthScore;

    // 结构化程度评分
    const structureScore = content.html ? 0.2 : 0;
    factors.push({
      name: 'structure',
      score: structureScore,
      description: 'Content has HTML structure'
    });
    totalScore += structureScore;

    // 可读性评分
    const readabilityScore = content.excerpt ? 0.3 : 0.1;
    factors.push({
      name: 'readability',
      score: readabilityScore,
      description: 'Content readability assessment'
    });
    totalScore += readabilityScore;

    // 元数据完整性评分
    const metadataScore = (content.title ? 0.1 : 0) + (content.byline ? 0.1 : 0);
    factors.push({
      name: 'metadata',
      score: metadataScore,
      description: 'Metadata completeness'
    });
    totalScore += metadataScore;

    return {
      score: Math.min(totalScore, 1),
      factors
    };
  }

  /**
   * 构建元数据
   */
  private buildMetadata(content: any, quality: any): ContentMetadata {
    const wordCount = content.text.split(' ').length;
    
    return {
      title: content.title || 'Untitled',
      description: content.excerpt,
      author: content.byline,
      language: this.detectLanguage(content.text),
      wordCount,
      readingTime: Math.ceil(wordCount / 200),
      contentType: this.detectContentType(content),
      quality,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(extractedData: any, quality: any): number {
    let confidence = quality.score;
    
    // 根据提取数据的完整性调整置信度
    if (extractedData && typeof extractedData === 'object') {
      const keys = Object.keys(extractedData);
      confidence += keys.length * 0.05;
    }

    return Math.min(confidence, 1);
  }

  /**
   * Utility methods
   */
  private applyTagFiltering(content: any, options: ExtractionOptions): any {
    // 实现标签过滤逻辑
    return content;
  }

  private convertToMarkdown(content: any): string {
    // 实现HTML到Markdown的转换
    return content.text || '';
  }

  private convertToJSON(content: any): any {
    return {
      title: content.title,
      content: content.text,
      html: content.html,
      metadata: {
        wordCount: content.text.split(' ').length,
        extractedAt: new Date().toISOString()
      }
    };
  }

  private detectLanguage(text: string): string {
    // Simple language detection
    return 'en';
  }

  private detectContentType(content: any): ContentMetadata['contentType'] {
    // Simple content type detection
    return 'article';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
