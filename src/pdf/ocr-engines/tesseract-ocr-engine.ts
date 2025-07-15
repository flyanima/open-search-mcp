import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { createLogger } from '../../utils/logger.js';
import { OCRResult, OCROptions } from './claude-ocr-engine.js';

const logger = createLogger('TesseractOCREngine');

/**
 * Tesseract OCR Engine - Wrapper for existing Tesseract functionality
 */
export class TesseractOCREngine {
  name = 'tesseract';
  private worker: any = null;
  private isInitialized = false;

  constructor() {
    // Initialization will be done lazily
  }

  /**
   * Initialize Tesseract worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.isInitialized && this.worker) {
      return;
    }

    try {
      logger.info('Initializing Tesseract OCR worker...');
      this.worker = await createWorker('eng');
      this.isInitialized = true;
      logger.info('Tesseract OCR worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Tesseract worker:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Check if Tesseract OCR engine is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initializeWorker();
      }
      return this.isInitialized && this.worker !== null;
    } catch (error) {
      logger.warn('Tesseract OCR not available:', error);
      return false;
    }
  }

  /**
   * Convert PDF to images using multiple methods
   */
  private async convertPDFToImages(pdfPath: string, maxPages: number = 5): Promise<string[]> {
    const tempDir = path.join(path.dirname(pdfPath), 'temp_ocr');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const imagePaths: string[] = [];

    // Try multiple conversion methods
    const conversionMethods = [
      () => this.convertWithPdf2pic(pdfPath, tempDir, maxPages),
      () => this.convertWithPdfPoppler(pdfPath, tempDir, maxPages)
    ];

    for (const method of conversionMethods) {
      try {
        const paths = await method();
        if (paths.length > 0) {
          logger.info(`Successfully converted ${paths.length} pages to images`);
          return paths;
        }
      } catch (error) {
        logger.warn('PDF conversion method failed, trying next method:', error);
      }
    }

    logger.error('All PDF to image conversion methods failed');
    return [];
  }

  private async convertWithPdf2pic(pdfPath: string, tempDir: string, maxPages: number): Promise<string[]> {
    const pdf2pic = await import('pdf2pic');
    const imagePaths: string[] = [];

    const isWindows = process.platform === 'win32';
    const convert = pdf2pic.fromPath(pdfPath, {
      density: isWindows ? 100 : 150,
      saveFilename: "tesseract_page",
      savePath: tempDir,
      format: isWindows ? "jpg" : "png",
      width: isWindows ? 800 : 1200,
      height: isWindows ? 1000 : 1600
    });

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const result = await convert(pageNum, { responseType: "image" });
        if (result && (result as any).path) {
          imagePaths.push((result as any).path);
          logger.info(`Successfully converted page ${pageNum} with pdf2pic`);
        }
      } catch (pageError) {
        logger.warn(`Failed to convert page ${pageNum} with pdf2pic:`, pageError);
        break;
      }
    }

    return imagePaths;
  }

  private async convertWithPdfPoppler(pdfPath: string, tempDir: string, maxPages: number): Promise<string[]> {
    try {
      const pdfPoppler = await import('pdf-poppler');
      const imagePaths: string[] = [];

      const options = {
        format: 'jpeg' as const,
        out_dir: tempDir,
        out_prefix: 'tesseract_page',
        page: null as any // Convert all pages up to maxPages
      };

      // Convert PDF to images
      const results = await pdfPoppler.convert(pdfPath, options);

      // Get the generated image paths
      for (let i = 1; i <= Math.min(maxPages, results.length || maxPages); i++) {
        const imagePath = path.join(tempDir, `tesseract_page-${i}.jpg`);
        if (fs.existsSync(imagePath)) {
          imagePaths.push(imagePath);
        }
      }

      return imagePaths;
    } catch (error) {
      logger.warn('pdf-poppler conversion failed:', error);
      return [];
    }
  }

  /**
   * Process PDF with Tesseract OCR
   */
  async processPDF(pdfPath: string, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    logger.info(`Starting Tesseract OCR processing for: ${path.basename(pdfPath)}`);

    // Initialize worker if needed
    if (!this.isInitialized) {
      await this.initializeWorker();
    }

    const maxPages = options.maxPages || 5;
    let combinedText = '';
    let totalConfidence = 0;
    let processedPages = 0;

    try {
      // Convert PDF to images
      const imagePaths = await this.convertPDFToImages(pdfPath, maxPages);
      
      if (imagePaths.length === 0) {
        throw new Error('Failed to convert PDF pages to images');
      }

      // Process each image with Tesseract
      for (const imagePath of imagePaths) {
        try {
          logger.info(`Processing image: ${path.basename(imagePath)}`);
          
          const { data: { text, confidence } } = await this.worker.recognize(imagePath);

          if (text && text.trim().length > 0) {
            combinedText += text + '\n\n';
            totalConfidence += confidence;
            processedPages++;
            
            logger.info(`Extracted ${text.length} characters with ${confidence}% confidence`);
          }

          // Clean up temporary image file
          try {
            fs.unlinkSync(imagePath);
          } catch (cleanupError) {
            logger.warn(`Failed to cleanup image file: ${imagePath}`);
          }

        } catch (ocrError) {
          logger.error(`OCR failed for image ${imagePath}:`, ocrError);
          continue;
        }
      }

      // Clean up temp directory
      try {
        const tempDir = path.dirname(imagePaths[0]);
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp directory:', cleanupError);
      }

      const processingTime = Date.now() - startTime;
      const averageConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;

      const result: OCRResult = {
        text: combinedText.trim(),
        confidence: averageConfidence / 100, // Convert to 0-1 scale
        processingTime,
        engine: 'tesseract',
        metadata: {
          pageCount: processedPages,
          language: options.language || 'eng'
        }
      };

      logger.info(`Tesseract OCR completed: ${processedPages} pages, ${combinedText.length} characters, ${processingTime}ms`);
      return result;

    } catch (error) {
      logger.error('Tesseract OCR processing failed:', error);
      throw new Error(`Tesseract OCR failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get engine information
   */
  getEngineInfo() {
    return {
      name: 'Tesseract OCR',
      version: '4.x',
      capabilities: [
        'Multi-language support',
        'Open source',
        'Local processing',
        'No API costs'
      ],
      cost: 'free',
      availability: this.isInitialized
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        this.worker = null;
        this.isInitialized = false;
        logger.info('Tesseract worker terminated');
      } catch (error) {
        logger.error('Error terminating Tesseract worker:', error);
      }
    }
  }
}

export default TesseractOCREngine;
