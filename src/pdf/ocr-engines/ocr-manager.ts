import { createLogger } from '../../utils/logger.js';
import { ClaudeOCREngine, OCRResult, OCROptions } from './claude-ocr-engine.js';
import { TesseractOCREngine } from './tesseract-ocr-engine.js';
import { GeminiOCREngine } from './gemini-ocr-engine.js';
import { DeepSeekOCREngine } from './deepseek-ocr-engine.js';
import { OpenRouterOCREngine } from './openrouter-ocr-engine.js';

const logger = createLogger('OCRManager');

export interface OCREngine {
  name: string;
  processPDF(pdfPath: string, options?: OCROptions): Promise<OCRResult>;
  isAvailable(): Promise<boolean>;
  getEngineInfo(): any;
}

export interface OCRManagerConfig {
  primaryEngine: 'tesseract' | 'claude' | 'gemini' | 'deepseek' | 'openrouter' | 'auto';
  fallbackEngines: string[];
  enableFallback: boolean;
  claudeApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  maxRetries: number;
  timeoutMs: number;
  fastMode?: boolean; // 新增快速模式
}

/**
 * OCR Manager - Handles multiple OCR engines with fallback support
 */
export class OCRManager {
  private engines: Map<string, OCREngine> = new Map();
  private config: OCRManagerConfig;

  constructor(config: Partial<OCRManagerConfig> = {}) {
    this.config = {
      primaryEngine: 'deepseek', // 优先使用DeepSeek (成本效益最高)
      fallbackEngines: ['openrouter', 'tesseract', 'claude', 'gemini'],
      enableFallback: true,
      maxRetries: 2,
      timeoutMs: config.fastMode ? 30000 : 120000, // 快速模式30秒，正常模式2分钟 (大幅优化)
      fastMode: false,
      ...config
    };

    this.initializeEngines();
  }

  private initializeEngines(): void {
    logger.info('Initializing OCR engines...');

    // Initialize Tesseract OCR Engine
    try {
      const tesseractEngine = new TesseractOCREngine();
      this.engines.set('tesseract', tesseractEngine);
      logger.info('Tesseract OCR engine registered');
    } catch (error) {
      logger.error('Failed to initialize Tesseract engine:', error);
    }

    // Initialize Claude OCR Engine
    try {
      const claudeEngine = new ClaudeOCREngine(this.config.claudeApiKey);
      this.engines.set('claude', claudeEngine);
      logger.info('Claude OCR engine registered');
    } catch (error) {
      logger.error('Failed to initialize Claude engine:', error);
    }

    // Initialize Gemini OCR Engine
    try {
      const geminiEngine = new GeminiOCREngine(this.config.geminiApiKey);
      this.engines.set('gemini', geminiEngine);
      logger.info('Gemini OCR engine registered');
    } catch (error) {
      logger.error('Failed to initialize Gemini engine:', error);
    }

    // Initialize DeepSeek OCR Engine (优先引擎)
    try {
      const deepseekEngine = new DeepSeekOCREngine();
      this.engines.set('deepseek', deepseekEngine);
      logger.info('DeepSeek OCR engine registered (cost-efficient primary engine)');
    } catch (error) {
      logger.error('Failed to initialize DeepSeek engine:', error);
    }

    // Initialize OpenRouter OCR Engine (多模型备选)
    try {
      const openrouterEngine = new OpenRouterOCREngine();
      this.engines.set('openrouter', openrouterEngine);
      logger.info('OpenRouter OCR engine registered (multi-model fallback engine)');
    } catch (error) {
      logger.error('Failed to initialize OpenRouter engine:', error);
    }

    logger.info(`OCR Manager initialized with ${this.engines.size} engines`);
  }

  /**
   * Get available engines
   */
  async getAvailableEngines(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, engine] of this.engines) {
      try {
        if (await engine.isAvailable()) {
          available.push(name);
        }
      } catch (error) {
        logger.warn(`Engine ${name} availability check failed:`, error);
      }
    }

    return available;
  }

  /**
   * Determine the best engine to use
   */
  private async selectEngine(): Promise<string | null> {
    const availableEngines = await this.getAvailableEngines();
    
    if (availableEngines.length === 0) {
      logger.error('No OCR engines available');
      return null;
    }

    // If primary engine is available, use it
    if (this.config.primaryEngine !== 'auto' && availableEngines.includes(this.config.primaryEngine)) {
      return this.config.primaryEngine;
    }

    // Auto-select best available engine (优先考虑成本效益)
    const enginePriority = ['deepseek', 'openrouter', 'claude', 'gemini', 'tesseract']; // DeepSeek优先，OpenRouter备选
    
    for (const engineName of enginePriority) {
      if (availableEngines.includes(engineName)) {
        logger.info(`Auto-selected OCR engine: ${engineName}`);
        return engineName;
      }
    }

    // Fallback to first available engine
    return availableEngines[0];
  }

  /**
   * Process PDF with automatic engine selection and fallback
   */
  async processPDF(pdfPath: string, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();
    logger.info(`Starting OCR processing for: ${pdfPath} (fast mode: ${this.config.fastMode})`);

    // 快速模式优化：限制页面数和处理时间
    if (this.config.fastMode) {
      options = {
        ...options,
        maxPages: Math.min(options.maxPages || 2, 2), // 快速模式最多2页
        enhanceAccuracy: false // 快速模式不使用增强精度
      };
    }

    const selectedEngine = await this.selectEngine();
    if (!selectedEngine) {
      throw new Error('No OCR engines available');
    }

    const engineOrder = [selectedEngine];
    
    // Add fallback engines if enabled
    if (this.config.enableFallback) {
      for (const fallbackEngine of this.config.fallbackEngines) {
        if (fallbackEngine !== selectedEngine && this.engines.has(fallbackEngine)) {
          engineOrder.push(fallbackEngine);
        }
      }
    }

    let lastError: Error | null = null;

    // Try engines in order
    for (const engineName of engineOrder) {
      const engine = this.engines.get(engineName);
      if (!engine) continue;

      try {
        logger.info(`Attempting OCR with ${engineName} engine...`);
        
        // Check if engine is still available
        if (!(await engine.isAvailable())) {
          logger.warn(`Engine ${engineName} is no longer available, skipping...`);
          continue;
        }

        // Process with timeout
        const result = await Promise.race([
          engine.processPDF(pdfPath, options),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('OCR timeout')), this.config.timeoutMs)
          )
        ]);

        // Validate result
        if (result && result.text && result.text.trim().length > 0) {
          logger.info(`OCR successful with ${engineName}: ${result.text.length} characters extracted`);
          return {
            ...result,
            engine: engineName
          };
        } else {
          logger.warn(`Engine ${engineName} returned empty result`);
        }

      } catch (error) {
        lastError = error as Error;
        logger.error(`OCR failed with ${engineName}:`, error);
        
        // If this is not the last engine, continue to next
        if (engineName !== engineOrder[engineOrder.length - 1]) {
          logger.info(`Falling back to next OCR engine...`);
          continue;
        }
      }
    }

    // All engines failed
    throw new Error(`All OCR engines failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get engine statistics and status
   */
  async getEngineStatus(): Promise<{
    available: string[];
    unavailable: string[];
    primary: string;
    fallbackEnabled: boolean;
    engineDetails: Record<string, any>;
  }> {
    const available: string[] = [];
    const unavailable: string[] = [];
    const engineDetails: Record<string, any> = {};

    for (const [name, engine] of this.engines) {
      try {
        const isAvailable = await engine.isAvailable();
        const info = engine.getEngineInfo();
        
        engineDetails[name] = {
          ...info,
          available: isAvailable
        };

        if (isAvailable) {
          available.push(name);
        } else {
          unavailable.push(name);
        }
      } catch (error) {
        unavailable.push(name);
        engineDetails[name] = {
          name,
          available: false,
          error: (error as Error).message
        };
      }
    }

    return {
      available,
      unavailable,
      primary: this.config.primaryEngine,
      fallbackEnabled: this.config.enableFallback,
      engineDetails
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OCRManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('OCR Manager configuration updated:', this.config);
  }

  /**
   * Add custom OCR engine
   */
  addEngine(name: string, engine: OCREngine): void {
    this.engines.set(name, engine);
    logger.info(`Custom OCR engine '${name}' added`);
  }

  /**
   * Remove OCR engine
   */
  removeEngine(name: string): boolean {
    const removed = this.engines.delete(name);
    if (removed) {
      logger.info(`OCR engine '${name}' removed`);
    }
    return removed;
  }
}

export default OCRManager;
