import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../../utils/logger.js';
import { OCRManager } from '../../pdf/ocr-engines/ocr-manager.js';

const logger = createLogger('OCRHealthCheck');

/**
 * OCR Health Check Tool
 * Provides detailed status and debugging information for the multi-engine OCR system
 */
export const ocrHealthCheckTool: Tool = {
  name: 'ocr_health_check',
  description: 'Check the health and status of the multi-engine OCR system including Claude, Gemini, and Tesseract engines',
  inputSchema: {
    type: 'object',
    properties: {
      includeEngineDetails: {
        type: 'boolean',
        description: 'Include detailed information about each OCR engine',
        default: true
      },
      testConnectivity: {
        type: 'boolean', 
        description: 'Test API connectivity for Claude and Gemini engines',
        default: false
      }
    }
  }
};

export async function executeOCRHealthCheck(args: any) {
  const startTime = Date.now();
  
  try {
    logger.info('Starting OCR health check...');
    
    // Initialize OCR Manager
    const ocrManager = new OCRManager({
      primaryEngine: 'auto',
      fallbackEngines: ['claude', 'gemini', 'tesseract'],
      enableFallback: true,
      claudeApiKey: process.env.ANTHROPIC_API_KEY,
      geminiApiKey: process.env.GOOGLE_API_KEY
    });

    // Get engine status
    const engineStatus = await ocrManager.getEngineStatus();
    
    // Prepare health check result
    const healthCheck: any = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      version: '2.0.0',
      processingTime: Date.now() - startTime,
      
      // Engine Overview
      engineSummary: {
        totalEngines: engineStatus.engineDetails ? Object.keys(engineStatus.engineDetails).length : 0,
        availableEngines: engineStatus.available.length,
        unavailableEngines: engineStatus.unavailable.length,
        primaryEngine: engineStatus.primary,
        fallbackEnabled: engineStatus.fallbackEnabled
      },
      
      // Available Engines
      availableEngines: engineStatus.available,
      unavailableEngines: engineStatus.unavailable,
      
      // Environment Configuration
      environmentConfig: {
        claudeApiKey: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
        geminiApiKey: process.env.GOOGLE_API_KEY ? 'configured' : 'missing',
        claudeModel: process.env.CLAUDE_MODEL || 'default (claude-3-5-sonnet-20241022)',
        geminiModel: process.env.GEMINI_MODEL || 'default (gemini-2.0-flash-exp)',
        ocrPrimaryEngine: process.env.OCR_PRIMARY_ENGINE || 'auto',
        ocrFallbackEngines: process.env.OCR_FALLBACK_ENGINES || 'claude,gemini,tesseract'
      },
      
      // System Capabilities
      capabilities: {
        multiModelSupport: true,
        claudeVisionOCR: engineStatus.available.includes('claude'),
        geminiVisionOCR: engineStatus.available.includes('gemini'),
        tesseractOCR: engineStatus.available.includes('tesseract'),
        automaticFallback: true,
        forceOCRSupport: true,
        crossPlatformCompatibility: true
      }
    };

    // Add detailed engine information if requested
    if (args.includeEngineDetails && engineStatus.engineDetails) {
      healthCheck.engineDetails = engineStatus.engineDetails;
    }

    // Test connectivity if requested
    if (args.testConnectivity) {
      logger.info('Testing engine connectivity...');
      
      const connectivityTests = {
        claude: false,
        gemini: false,
        tesseract: true // Always available locally
      };

      // Test Claude connectivity
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const { ClaudeOCREngine } = await import('../../pdf/ocr-engines/claude-ocr-engine.js');
          const claudeEngine = new ClaudeOCREngine();
          connectivityTests.claude = await claudeEngine.isAvailable();
        } catch (error) {
          logger.warn('Claude connectivity test failed:', error);
        }
      }

      // Test Gemini connectivity
      if (process.env.GOOGLE_API_KEY) {
        try {
          const { GeminiOCREngine } = await import('../../pdf/ocr-engines/gemini-ocr-engine.js');
          const geminiEngine = new GeminiOCREngine();
          connectivityTests.gemini = await geminiEngine.isAvailable();
        } catch (error) {
          logger.warn('Gemini connectivity test failed:', error);
        }
      }

      healthCheck.connectivityTests = connectivityTests;
    }

    // Determine overall health status
    if (engineStatus.available.length === 0) {
      healthCheck.status = 'critical';
    } else if (engineStatus.available.length === 1 && engineStatus.available[0] === 'tesseract') {
      healthCheck.status = 'degraded';
    } else {
      healthCheck.status = 'healthy';
    }

    // Add recommendations
    const recommendations = [];
    
    if (!process.env.ANTHROPIC_API_KEY) {
      recommendations.push('Set ANTHROPIC_API_KEY to enable Claude Vision OCR');
    }
    
    if (!process.env.GOOGLE_API_KEY) {
      recommendations.push('Set GOOGLE_API_KEY to enable Gemini Vision OCR');
    }
    
    if (engineStatus.available.length === 1) {
      recommendations.push('Configure additional OCR engines for better reliability');
    }
    
    if (recommendations.length > 0) {
      healthCheck.recommendations = recommendations;
    }

    logger.info(`OCR health check completed in ${Date.now() - startTime}ms`);
    
    return {
      success: true,
      data: healthCheck
    };

  } catch (error) {
    logger.error('OCR health check failed:', error);
    
    return {
      success: false,
      error: `OCR health check failed: ${(error as Error).message}`,
      data: {
        timestamp: new Date().toISOString(),
        status: 'error',
        processingTime: Date.now() - startTime,
        errorDetails: {
          message: (error as Error).message,
          stack: (error as Error).stack
        }
      }
    };
  }
}
