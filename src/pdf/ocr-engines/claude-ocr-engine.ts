import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger.js';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('ClaudeOCREngine');

export interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
  engine: string;
  metadata?: {
    pageCount: number;
    language?: string;
    hasStructuredContent?: boolean;
  };
}

export interface OCROptions {
  language?: string;
  maxPages?: number;
  extractStructure?: boolean;
  enhanceAccuracy?: boolean;
}

/**
 * Claude Vision OCR Engine
 * Uses Claude 3.5 Sonnet's vision capabilities for high-quality OCR
 */
export class ClaudeOCREngine {
  name = 'claude';
  private client: Anthropic | null = null;
  private isInitialized = false;

  constructor(private apiKey?: string) {
    if (apiKey) {
      this.initializeClient();
    }
  }

  private initializeClient(): void {
    try {
      this.client = new Anthropic({
        apiKey: this.apiKey || process.env.ANTHROPIC_API_KEY
      });
      this.isInitialized = true;
      logger.info('Claude OCR engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Claude OCR engine:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if Claude OCR engine is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isInitialized || !this.client) {
      return false;
    }

    try {
      // Test API connectivity with a minimal request
      const model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

      await this.client.messages.create({
        model: model,
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'test'
        }]
      });
      return true;
    } catch (error) {
      logger.warn('Claude API not available:', error);
      return false;
    }
  }

  /**
   * Convert PDF page to base64 image using alternative methods
   */
  private async convertPDFPageToImage(pdfPath: string, pageNum: number): Promise<string | null> {
    try {
      // Try multiple conversion methods for cross-platform compatibility
      
      // Method 1: Try pdf-poppler (better Windows compatibility)
      try {
        const { convert } = await import('pdf-poppler') as any;
        const options = {
          format: 'jpeg',
          out_dir: path.dirname(pdfPath),
          out_prefix: `claude_ocr_page_${pageNum}`,
          page: pageNum,
          single_file: true
        };
        
        const result = await convert(pdfPath, options);
        if (result && result.length > 0) {
          const imagePath = result[0];
          const imageBuffer = fs.readFileSync(imagePath);
          const base64 = imageBuffer.toString('base64');
          
          // Clean up temporary file
          fs.unlinkSync(imagePath);
          
          logger.info(`Successfully converted PDF page ${pageNum} using pdf-poppler`);
          return base64;
        }
      } catch (popplerError) {
        logger.warn(`pdf-poppler conversion failed for page ${pageNum}:`, popplerError);
      }

      // Method 2: Try pdf2pic as fallback
      try {
        const pdf2pic = await import('pdf2pic');
        const convert = pdf2pic.fromPath(pdfPath, {
          density: 150,
          saveFilename: `claude_ocr_temp_${pageNum}`,
          savePath: path.dirname(pdfPath),
          format: 'jpeg',
          width: 1200,
          height: 1600
        });

        const result = await convert(pageNum, { responseType: 'image' });
        if (result && (result as any).path) {
          const imagePath = (result as any).path;
          const imageBuffer = fs.readFileSync(imagePath);
          const base64 = imageBuffer.toString('base64');
          
          // Clean up temporary file
          fs.unlinkSync(imagePath);
          
          logger.info(`Successfully converted PDF page ${pageNum} using pdf2pic`);
          return base64;
        }
      } catch (pdf2picError) {
        logger.warn(`pdf2pic conversion failed for page ${pageNum}:`, pdf2picError);
      }

      logger.error(`All PDF conversion methods failed for page ${pageNum}`);
      return null;

    } catch (error) {
      logger.error(`PDF page conversion error for page ${pageNum}:`, error);
      return null;
    }
  }

  /**
   * Process PDF with Claude Vision OCR
   */
  async processPDF(pdfPath: string, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();
    
    if (!this.isInitialized || !this.client) {
      throw new Error('Claude OCR engine not initialized');
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    logger.info(`Starting Claude OCR processing for: ${path.basename(pdfPath)}`);

    const maxPages = options.maxPages || 5;
    const extractStructure = options.extractStructure || false;
    let combinedText = '';
    let totalConfidence = 0;
    let processedPages = 0;

    try {
      // Process each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        logger.info(`Processing page ${pageNum} with Claude Vision...`);
        
        const base64Image = await this.convertPDFPageToImage(pdfPath, pageNum);
        if (!base64Image) {
          logger.warn(`Failed to convert page ${pageNum}, skipping...`);
          continue;
        }

        // Prepare Claude Vision prompt
        const prompt = extractStructure 
          ? `Please extract all text from this PDF page image with high accuracy. Maintain the original structure, formatting, and layout. Include:
             - All text content (paragraphs, headings, captions)
             - Table data if present
             - Mathematical formulas or equations
             - Any structured elements like lists or sections
             
             Provide the extracted text in a clean, readable format while preserving the document structure.`
          : `Please extract all text from this PDF page image with high accuracy. Provide only the text content without additional formatting or commentary.`;

        try {
          // Support multiple Claude models including Claude 4
          const model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

          const response = await this.client.messages.create({
            model: model,
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image
                  }
                }
              ]
            }]
          });

          if (response.content && response.content.length > 0) {
            const extractedText = response.content[0].type === 'text' 
              ? response.content[0].text 
              : '';
            
            if (extractedText && extractedText.trim().length > 0) {
              combinedText += extractedText + '\n\n';
              totalConfidence += 0.95; // Claude typically has high confidence
              processedPages++;
              
              logger.info(`Successfully extracted ${extractedText.length} characters from page ${pageNum}`);
            }
          }

        } catch (apiError) {
          logger.error(`Claude API error for page ${pageNum}:`, apiError);
          continue;
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const processingTime = Date.now() - startTime;
      const averageConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;

      const result: OCRResult = {
        text: combinedText.trim(),
        confidence: averageConfidence,
        processingTime,
        engine: 'claude-vision',
        metadata: {
          pageCount: processedPages,
          language: options.language || 'auto-detected',
          hasStructuredContent: extractStructure
        }
      };

      logger.info(`Claude OCR completed: ${processedPages} pages, ${combinedText.length} characters, ${processingTime}ms`);
      return result;

    } catch (error) {
      logger.error('Claude OCR processing failed:', error);
      throw new Error(`Claude OCR failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get engine information
   */
  getEngineInfo() {
    return {
      name: 'Claude Vision OCR',
      version: '1.0.0',
      capabilities: [
        'High-accuracy text extraction',
        'Multi-language support',
        'Structure preservation',
        'Table and formula recognition',
        'Cross-platform compatibility'
      ],
      cost: 'paid-api',
      availability: this.isInitialized
    };
  }
}

export default ClaudeOCREngine;
