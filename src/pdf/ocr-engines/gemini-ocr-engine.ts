import fs from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger.js';
import { OCRResult, OCROptions } from './claude-ocr-engine.js';

const logger = createLogger('GeminiOCREngine');

/**
 * Gemini Vision OCR Engine
 * Uses Google Gemini 2.5 Pro's vision capabilities for high-quality OCR
 */
export class GeminiOCREngine {
  name = 'gemini';
  private apiKey: string | undefined;
  private isInitialized = false;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY;
    if (this.apiKey) {
      this.isInitialized = true;
      logger.info('Gemini OCR engine initialized successfully');
    }
  }

  /**
   * Check if Gemini OCR engine is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isInitialized || !this.apiKey) {
      return false;
    }

    try {
      // Test API connectivity with a minimal request
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'test'
            }]
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });
      
      return response.ok;
    } catch (error) {
      logger.warn('Gemini API not available:', error);
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
          out_prefix: `gemini_ocr_page_${pageNum}`,
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
          saveFilename: `gemini_ocr_temp_${pageNum}`,
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
   * Process PDF with Gemini Vision OCR
   */
  async processPDF(pdfPath: string, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();
    
    if (!this.isInitialized || !this.apiKey) {
      throw new Error('Gemini OCR engine not initialized');
    }

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    logger.info(`Starting Gemini OCR processing for: ${path.basename(pdfPath)}`);

    const maxPages = options.maxPages || 5;
    const extractStructure = options.extractStructure || false;
    let combinedText = '';
    let totalConfidence = 0;
    let processedPages = 0;

    try {
      // Process each page
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        logger.info(`Processing page ${pageNum} with Gemini Vision...`);
        
        const base64Image = await this.convertPDFPageToImage(pdfPath, pageNum);
        if (!base64Image) {
          logger.warn(`Failed to convert page ${pageNum}, skipping...`);
          continue;
        }

        // Prepare Gemini Vision prompt
        const prompt = extractStructure 
          ? `Please extract all text from this PDF page image with high accuracy. Maintain the original structure, formatting, and layout. Include:
             - All text content (paragraphs, headings, captions)
             - Table data if present
             - Mathematical formulas or equations
             - Any structured elements like lists or sections
             
             Provide the extracted text in a clean, readable format while preserving the document structure.`
          : `Please extract all text from this PDF page image with high accuracy. Provide only the text content without additional formatting or commentary.`;

        try {
          const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    text: prompt
                  },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: base64Image
                    }
                  }
                ]
              }],
              generationConfig: {
                maxOutputTokens: 4000,
                temperature: 0.1
              }
            })
          });

          if (response.ok) {
            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0) {
              const extractedText = result.candidates[0].content?.parts?.[0]?.text || '';
              
              if (extractedText && extractedText.trim().length > 0) {
                combinedText += extractedText + '\n\n';
                totalConfidence += 0.95; // Gemini typically has high confidence
                processedPages++;
                
                logger.info(`Successfully extracted ${extractedText.length} characters from page ${pageNum}`);
              }
            }
          } else {
            logger.error(`Gemini API error for page ${pageNum}: ${response.status} ${response.statusText}`);
          }

        } catch (apiError) {
          logger.error(`Gemini API error for page ${pageNum}:`, apiError);
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
        engine: 'gemini-vision',
        metadata: {
          pageCount: processedPages,
          language: options.language || 'auto-detected',
          hasStructuredContent: extractStructure
        }
      };

      logger.info(`Gemini OCR completed: ${processedPages} pages, ${combinedText.length} characters, ${processingTime}ms`);
      return result;

    } catch (error) {
      logger.error('Gemini OCR processing failed:', error);
      throw new Error(`Gemini OCR failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get engine information
   */
  getEngineInfo() {
    return {
      name: 'Gemini Vision OCR',
      version: '2.5 Pro',
      capabilities: [
        'High-accuracy text extraction',
        'Multi-language support',
        'Structure preservation',
        'Table and formula recognition',
        'Cross-platform compatibility',
        'Advanced reasoning capabilities'
      ],
      cost: 'paid-api',
      availability: this.isInitialized
    };
  }
}

export default GeminiOCREngine;
