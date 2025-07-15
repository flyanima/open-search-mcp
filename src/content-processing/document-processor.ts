/**
 * 文档处理引擎 - 支持多种文档格式的智能处理
 * 包括PDF、Word、Excel、PowerPoint等格式的内容提取和分析
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { Logger } from '../utils/logger.js';

export interface DocumentMetadata {
  filename: string;
  fileSize: number;
  mimeType: string;
  format: DocumentFormat;
  pageCount?: number;
  wordCount?: number;
  author?: string;
  title?: string;
  subject?: string;
  creator?: string;
  createdDate?: string;
  modifiedDate?: string;
  language?: string;
  extractedAt: string;
}

export interface ProcessedDocument {
  metadata: DocumentMetadata;
  content: {
    text: string;
    markdown?: string;
    html?: string;
    structured?: any;
  };
  pages?: DocumentPage[];
  images?: ExtractedImage[];
  tables?: ExtractedTable[];
  links?: ExtractedLink[];
  quality: {
    score: number;
    factors: QualityFactor[];
  };
  processingTime: number;
}

export interface DocumentPage {
  pageNumber: number;
  text: string;
  images?: ExtractedImage[];
  tables?: ExtractedTable[];
  boundingBox?: BoundingBox;
}

export interface ExtractedImage {
  id: string;
  description?: string;
  base64?: string;
  url?: string;
  boundingBox?: BoundingBox;
  pageNumber?: number;
}

export interface ExtractedTable {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  pageNumber?: number;
  boundingBox?: BoundingBox;
}

export interface ExtractedLink {
  text: string;
  url: string;
  pageNumber?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QualityFactor {
  name: string;
  score: number;
  description: string;
}

export type DocumentFormat = 
  | 'pdf' 
  | 'docx' 
  | 'doc' 
  | 'xlsx' 
  | 'xls' 
  | 'pptx' 
  | 'ppt' 
  | 'txt' 
  | 'rtf' 
  | 'odt' 
  | 'ods' 
  | 'odp'
  | 'unknown';

export interface ProcessingOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  extractLinks?: boolean;
  ocrEnabled?: boolean;
  preserveFormatting?: boolean;
  pageRange?: {
    start: number;
    end: number;
  };
  outputFormats?: ('text' | 'markdown' | 'html' | 'structured')[];
  quality?: 'fast' | 'balanced' | 'high';
}

export class DocumentProcessor {
  private logger: Logger;
  private supportedFormats: Set<string>;

  constructor() {
    this.logger = new Logger('DocumentProcessor');
    this.supportedFormats = new Set([
      'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 
      'txt', 'rtf', 'odt', 'ods', 'odp'
    ]);
  }

  /**
   * Process document file
   */
  async processDocument(
    filePath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Processing document: ${filePath}`);

      // 1. 验证文件存在性和格式
      await this.validateFile(filePath);
      
      // 2. 检测文档格式
      const format = await this.detectFormat(filePath);
      
      // 3. 提取基础元数据
      const metadata = await this.extractMetadata(filePath, format);
      
      // 4. 根据格式选择处理器
      const processor = this.getProcessor(format);
      
      // 5. 提取内容
      const extractedContent = await processor.extract(filePath, options);
      
      // 6. 后处理和质量评估
      const processedContent = await this.postProcess(extractedContent, options);
      const quality = this.assessQuality(processedContent, metadata);
      
      const processingTime = Date.now() - startTime;
      
      const result: ProcessedDocument = {
        metadata,
        content: processedContent.content,
        pages: processedContent.pages,
        images: processedContent.images,
        tables: processedContent.tables,
        links: processedContent.links,
        quality,
        processingTime
      };

      this.logger.info(`Document processed successfully in ${processingTime}ms`);
      return result;

    } catch (error) {
      this.logger.error(`Document processing failed for ${filePath}:`, error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 批量处理文档
   */
  async processDocuments(
    filePaths: string[],
    options: ProcessingOptions & { concurrency?: number } = {}
  ): Promise<ProcessedDocument[]> {
    const concurrency = options.concurrency || 3;
    const results: ProcessedDocument[] = [];
    
    this.logger.info(`Starting batch document processing: ${filePaths.length} files`);

    // 分批处理
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const batch = filePaths.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          return await this.processDocument(filePath, options);
        } catch (error) {
          this.logger.warn(`Failed to process ${filePath}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      });
    }

    this.logger.info(`Batch processing completed: ${results.length}/${filePaths.length} successful`);
    return results;
  }

  /**
   * 从Buffer处理文档
   */
  async processDocumentFromBuffer(
    buffer: Buffer,
    filename: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    // 创建临时文件
    const tempPath = path.join(process.cwd(), 'temp', `${Date.now()}_${filename}`);
    
    try {
      // 确保临时目录存在
      await fs.mkdir(path.dirname(tempPath), { recursive: true });
      
      // 写入临时文件
      await fs.writeFile(tempPath, buffer);
      
      // 处理文档
      const result = await this.processDocument(tempPath, options);
      
      return result;
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp file ${tempPath}:`, error);
      }
    }
  }

  /**
   * 验证文件
   */
  private async validateFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }
      
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
      
      if (stats.size > 100 * 1024 * 1024) { // 100MB limit
        throw new Error('File too large (max 100MB)');
      }
      
    } catch (error) {
      throw new Error(`File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 检测文档格式
   */
  private async detectFormat(filePath: string): Promise<DocumentFormat> {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    
    if (this.supportedFormats.has(ext)) {
      return ext as DocumentFormat;
    }
    
    // 尝试通过文件头检测
    const buffer = Buffer.alloc(16);
    const file = await fs.open(filePath, 'r');
    
    try {
      await file.read(buffer, 0, 16, 0);
      
      // PDF magic number
      if (buffer.toString('ascii', 0, 4) === '%PDF') {
        return 'pdf';
      }
      
      // Office documents (ZIP-based)
      if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
        return 'docx'; // Could be docx, xlsx, pptx
      }
      
      // Legacy Office documents
      if (buffer[0] === 0xD0 && buffer[1] === 0xCF) {
        return 'doc'; // Could be doc, xls, ppt
      }
      
    } finally {
      await file.close();
    }
    
    return 'unknown';
  }

  /**
   * 提取基础元数据
   */
  private async extractMetadata(filePath: string, format: DocumentFormat): Promise<DocumentMetadata> {
    const stats = await fs.stat(filePath);
    const filename = path.basename(filePath);
    
    const metadata: DocumentMetadata = {
      filename,
      fileSize: stats.size,
      mimeType: this.getMimeType(format),
      format,
      createdDate: stats.birthtime.toISOString(),
      modifiedDate: stats.mtime.toISOString(),
      extractedAt: new Date().toISOString()
    };

    // 尝试提取更详细的元数据
    try {
      const detailedMetadata = await this.extractDetailedMetadata(filePath, format);
      Object.assign(metadata, detailedMetadata);
    } catch (error) {
      this.logger.warn(`Failed to extract detailed metadata for ${filePath}:`, error);
    }

    return metadata;
  }

  /**
   * 获取处理器
   */
  private getProcessor(format: DocumentFormat): DocumentFormatProcessor {
    switch (format) {
      case 'pdf':
        return new PDFProcessor();
      case 'docx':
      case 'doc':
        return new WordProcessor();
      case 'xlsx':
      case 'xls':
        return new ExcelProcessor();
      case 'pptx':
      case 'ppt':
        return new PowerPointProcessor();
      case 'txt':
        return new TextProcessor();
      default:
        return new GenericProcessor();
    }
  }

  /**
   * 后处理
   */
  private async postProcess(
    extractedContent: any,
    options: ProcessingOptions
  ): Promise<any> {
    const result = { ...extractedContent };

    // 生成不同格式
    if (options.outputFormats?.includes('markdown')) {
      result.content.markdown = this.convertToMarkdown(extractedContent.content.text);
    }

    if (options.outputFormats?.includes('html')) {
      result.content.html = this.convertToHTML(extractedContent.content.text);
    }

    if (options.outputFormats?.includes('structured')) {
      result.content.structured = this.extractStructuredData(extractedContent);
    }

    return result;
  }

  /**
   * 质量评估
   */
  private assessQuality(content: any, metadata: DocumentMetadata): { score: number; factors: QualityFactor[] } {
    const factors: QualityFactor[] = [];
    let totalScore = 0;

    // 内容长度评分
    const textLength = content.content.text.length;
    const lengthScore = Math.min(textLength / 1000, 1) * 0.3;
    factors.push({
      name: 'content_length',
      score: lengthScore,
      description: `Document has ${textLength} characters`
    });
    totalScore += lengthScore;

    // 结构化内容评分
    const structureScore = (content.tables?.length || 0) * 0.1 + (content.images?.length || 0) * 0.05;
    factors.push({
      name: 'structure',
      score: Math.min(structureScore, 0.3),
      description: `Document has ${content.tables?.length || 0} tables and ${content.images?.length || 0} images`
    });
    totalScore += Math.min(structureScore, 0.3);

    // 元数据完整性评分
    const metadataScore = (metadata.title ? 0.1 : 0) + (metadata.author ? 0.1 : 0) + (metadata.subject ? 0.1 : 0);
    factors.push({
      name: 'metadata',
      score: metadataScore,
      description: 'Metadata completeness'
    });
    totalScore += metadataScore;

    // 格式支持评分
    const formatScore = metadata.format !== 'unknown' ? 0.2 : 0;
    factors.push({
      name: 'format_support',
      score: formatScore,
      description: `Format ${metadata.format} is supported`
    });
    totalScore += formatScore;

    return {
      score: Math.min(totalScore, 1),
      factors
    };
  }

  /**
   * 工具方法
   */
  private getMimeType(format: DocumentFormat): string {
    const mimeTypes: Record<DocumentFormat, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      txt: 'text/plain',
      rtf: 'application/rtf',
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      odp: 'application/vnd.oasis.opendocument.presentation',
      unknown: 'application/octet-stream'
    };

    return mimeTypes[format] || 'application/octet-stream';
  }

  private async extractDetailedMetadata(filePath: string, format: DocumentFormat): Promise<Partial<DocumentMetadata>> {
    // 这里应该使用具体的库来提取元数据
    // 例如：pdf-parse, mammoth, xlsx等
    return {};
  }

  private convertToMarkdown(text: string): string {
    // 简单的文本到Markdown转换
    return text.replace(/\n\n/g, '\n\n');
  }

  private convertToHTML(text: string): string {
    // 简单的文本到HTML转换
    return `<div>${text.replace(/\n/g, '<br>')}</div>`;
  }

  private extractStructuredData(content: any): any {
    return {
      text: content.content.text,
      tables: content.tables || [],
      images: content.images || [],
      links: content.links || []
    };
  }
}

/**
 * 文档格式处理器接口
 */
interface DocumentFormatProcessor {
  extract(filePath: string, options: ProcessingOptions): Promise<any>;
}

/**
 * 具体处理器实现（简化版本）
 */
class PDFProcessor implements DocumentFormatProcessor {
  async extract(filePath: string, options: ProcessingOptions): Promise<any> {
    // 这里应该使用pdf-parse或类似库
    return {
      content: { text: 'PDF content placeholder' },
      pages: [],
      images: [],
      tables: [],
      links: []
    };
  }
}

class WordProcessor implements DocumentFormatProcessor {
  async extract(filePath: string, options: ProcessingOptions): Promise<any> {
    // 这里应该使用mammoth或类似库
    return {
      content: { text: 'Word document content placeholder' },
      pages: [],
      images: [],
      tables: [],
      links: []
    };
  }
}

class ExcelProcessor implements DocumentFormatProcessor {
  async extract(filePath: string, options: ProcessingOptions): Promise<any> {
    // 这里应该使用xlsx或类似库
    return {
      content: { text: 'Excel content placeholder' },
      pages: [],
      images: [],
      tables: [],
      links: []
    };
  }
}

class PowerPointProcessor implements DocumentFormatProcessor {
  async extract(filePath: string, options: ProcessingOptions): Promise<any> {
    // 这里应该使用相应的PowerPoint处理库
    return {
      content: { text: 'PowerPoint content placeholder' },
      pages: [],
      images: [],
      tables: [],
      links: []
    };
  }
}

class TextProcessor implements DocumentFormatProcessor {
  async extract(filePath: string, options: ProcessingOptions): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      content: { text: content },
      pages: [],
      images: [],
      tables: [],
      links: []
    };
  }
}

class GenericProcessor implements DocumentFormatProcessor {
  async extract(filePath: string, options: ProcessingOptions): Promise<any> {
    return {
      content: { text: 'Unsupported format' },
      pages: [],
      images: [],
      tables: [],
      links: []
    };
  }
}
