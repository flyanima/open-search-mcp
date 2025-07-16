/**
 * Web Crawler Tools
 * 提供网页爬虫和内容提取功能
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * 网页爬虫客户端
 */
class WebCrawlerClient {
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async fetchPage(url: string, options: any = {}) {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 15000,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });

      return {
        html: response.data,
        status: response.status,
        headers: response.headers,
        url: response.config.url || url
      };
    } catch (error) {
      throw error;
    }
  }

  extractContent(html: string, options: any = {}) {
    const $ = cheerio.load(html);
    
    // 移除脚本和样式标签
    $('script, style, nav, footer, aside, .advertisement, .ads').remove();
    
    const result: any = {
      title: $('title').text().trim() || $('h1').first().text().trim() || 'No title found',
      description: $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content') || 
                   'No description found',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      author: $('meta[name="author"]').attr('content') || 
              $('meta[property="article:author"]').attr('content') || '',
      publishDate: $('meta[property="article:published_time"]').attr('content') || 
                   $('meta[name="date"]').attr('content') || '',
      url: $('meta[property="og:url"]').attr('content') || '',
      image: $('meta[property="og:image"]').attr('content') || 
             $('img').first().attr('src') || ''
    };

    // 提取主要内容
    if (options.extractText) {
      // 尝试多种内容选择器
      const contentSelectors = [
        'article',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
        'main',
        '.main-content',
        '#content',
        '.container'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const content = $(selector).text().trim();
        if (content && content.length > mainContent.length) {
          mainContent = content;
        }
      }

      // 如果没有找到主要内容，提取body中的文本
      if (!mainContent) {
        mainContent = $('body').text().trim();
      }

      // 清理文本
      mainContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      result.content = mainContent.substring(0, options.maxContentLength || 5000);
      result.contentLength = mainContent.length;
    }

    // 提取链接
    if (options.extractLinks) {
      const links: any[] = [];
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href && text) {
          links.push({
            url: href,
            text: text,
            isExternal: href.startsWith('http') && !href.includes(new URL(result.url || '').hostname)
          });
        }
      });
      result.links = links.slice(0, options.maxLinks || 50);
    }

    // 提取图片
    if (options.extractImages) {
      const images: any[] = [];
      $('img[src]').each((_, element) => {
        const src = $(element).attr('src');
        const alt = $(element).attr('alt') || '';
        if (src) {
          images.push({
            url: src,
            alt: alt,
            title: $(element).attr('title') || ''
          });
        }
      });
      result.images = images.slice(0, options.maxImages || 20);
    }

    return result;
  }

  async crawlMultiplePages(urls: string[], options: any = {}) {
    const results = [];
    const maxConcurrent = options.maxConcurrent || 3;
    
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (url) => {
        try {
          const pageData = await this.fetchPage(url, options);
          const content = this.extractContent(pageData.html, options);
          return {
            url,
            success: true,
            data: {
              ...content,
              status: pageData.status,
              finalUrl: pageData.url
            }
          };
        } catch (error) {
          return {
            url,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 添加延迟以避免过于频繁的请求
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, options.delay || 1000));
      }
    }

    return results;
  }
}

export function registerWebCrawlerTools(registry: ToolRegistry): void {
  const client = new WebCrawlerClient();

  // 单页面爬虫工具
  registry.registerTool({
    name: 'crawl_url_content',
    description: 'Crawl and extract content from a single web page',
    category: 'utility',
    source: 'Web Crawler',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the web page to crawl'
        },
        extractText: {
          type: 'boolean',
          description: 'Extract main text content',
          default: true
        },
        extractLinks: {
          type: 'boolean',
          description: 'Extract all links from the page',
          default: false
        },
        extractImages: {
          type: 'boolean',
          description: 'Extract all images from the page',
          default: false
        },
        maxContentLength: {
          type: 'number',
          description: 'Maximum length of extracted content',
          default: 5000,
          minimum: 100,
          maximum: 20000
        }
      },
      required: ['url']
    },
    execute: async (args: any) => {
      const { url, extractText = true, extractLinks = false, extractImages = false, maxContentLength = 5000 } = args;

      try {
        const startTime = Date.now();
        
        // 验证URL格式
        try {
          new URL(url);
        } catch {
          return {
            success: false,
            error: 'Invalid URL format'
          };
        }

        const pageData = await client.fetchPage(url);
        const content = client.extractContent(pageData.html, {
          extractText,
          extractLinks,
          extractImages,
          maxContentLength,
          maxLinks: 50,
          maxImages: 20
        });

        const crawlTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            source: 'Web Crawler',
            url,
            finalUrl: pageData.url,
            status: pageData.status,
            crawlTime,
            content: {
              ...content,
              extractedAt: new Date().toISOString()
            },
            metadata: {
              extractText,
              extractLinks,
              extractImages,
              contentLength: content.contentLength || 0,
              linksCount: content.links?.length || 0,
              imagesCount: content.images?.length || 0
            },
            timestamp: Date.now()
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Web crawling failed: ${error instanceof Error ? error.message : String(error)}`,
          data: {
            source: 'Web Crawler',
            url,
            suggestions: [
              'Check if the URL is accessible',
              'Verify the website allows crawling',
              'Try again in a few moments',
              'Check your internet connection'
            ]
          }
        };
      }
    }
  });

  // 多页面爬虫工具
  registry.registerTool({
    name: 'batch_crawl_urls',
    description: 'Crawl and extract content from multiple web pages',
    category: 'utility',
    source: 'Web Crawler',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of URLs to crawl',
          maxItems: 10
        },
        extractText: {
          type: 'boolean',
          description: 'Extract main text content',
          default: true
        },
        extractLinks: {
          type: 'boolean',
          description: 'Extract all links from pages',
          default: false
        },
        maxConcurrent: {
          type: 'number',
          description: 'Maximum concurrent requests',
          default: 3,
          minimum: 1,
          maximum: 5
        },
        delay: {
          type: 'number',
          description: 'Delay between batches in milliseconds',
          default: 1000,
          minimum: 500,
          maximum: 5000
        }
      },
      required: ['urls']
    },
    execute: async (args: any) => {
      const { urls, extractText = true, extractLinks = false, maxConcurrent = 3, delay = 1000 } = args;

      try {
        const startTime = Date.now();
        
        // 验证URLs
        for (const url of urls) {
          try {
            new URL(url);
          } catch {
            return {
              success: false,
              error: `Invalid URL format: ${url}`
            };
          }
        }

        const results = await client.crawlMultiplePages(urls, {
          extractText,
          extractLinks,
          maxConcurrent,
          delay,
          maxContentLength: 3000 // 减少单页内容长度以处理多页
        });

        const crawlTime = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;

        return {
          success: true,
          data: {
            source: 'Web Crawler',
            totalUrls: urls.length,
            successCount,
            failureCount: urls.length - successCount,
            crawlTime,
            results,
            summary: {
              successRate: Math.round((successCount / urls.length) * 100),
              averageTimePerPage: Math.round(crawlTime / urls.length),
              totalContentExtracted: results.filter(r => r.success).length
            },
            timestamp: Date.now()
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `Multiple page crawling failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
