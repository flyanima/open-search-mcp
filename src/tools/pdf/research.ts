/**
 * PDF Research Tools
 * Implements specialized PDF search and analysis tools
 */

import { ToolInput, ToolOutput } from '../../types.js';
import { createTool } from '../tool-registry.js';
import type { ToolRegistry } from '../tool-registry.js';
import { Logger } from '../../utils/logger.js';
import { PDFProcessor, PDFSearchOptions } from '../../pdf/pdf-processor.js';

const logger = new Logger('PDFResearchTools');

/**
 * PDF Research Tool - Specialized PDF search and analysis
 */
async function pdfResearch(args: ToolInput): Promise<ToolOutput> {
  const {
    query,
    maxDocuments = 10,
    documentType = 'any',
    includeOCR = false,
    forceOCR = false,
    sources = ['all'],
    dateRange,
    analysisDepth = 'medium'
  } = args;
  
  try {
    logger.info(`Starting PDF research for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    const pdfProcessor = new PDFProcessor();
    
    // Configure search options
    const searchOptions: PDFSearchOptions = {
      query,
      maxDocuments,
      documentType: documentType as any,
      includeOCR,
      forceOCR,
      sources: Array.isArray(sources) ? sources : [sources],
      dateRange
    };
    
    // Search for relevant PDFs
    const pdfDocuments = await pdfProcessor.searchPDFs(searchOptions);
    
    if (pdfDocuments.length === 0) {
      return {
        success: true,
        data: {
          query,
          documents: [],
          totalFound: 0,
          message: 'No PDF documents found for the given query',
          searchedAt: new Date().toISOString()
        },
        metadata: {
          sources: ['pdf-research'],
          cached: false
        }
      };
    }
    
    // Process PDFs based on analysis depth
    const processedDocuments = [];
    const maxToProcess = analysisDepth === 'shallow' ? Math.min(3, pdfDocuments.length) :
                       analysisDepth === 'medium' ? Math.min(5, pdfDocuments.length) :
                       Math.min(10, pdfDocuments.length);
    
    for (let i = 0; i < maxToProcess; i++) {
      const pdfDoc = pdfDocuments[i];
      logger.info(`Processing PDF ${i + 1}/${maxToProcess}: ${pdfDoc.title}`);
      
      try {
        const processedPDF = await pdfProcessor.processPDF(pdfDoc, includeOCR, forceOCR);
        
        if (processedPDF) {
          // Create summary based on analysis depth
          const summary = createPDFSummary(processedPDF, analysisDepth as string);
          
          processedDocuments.push({
            id: processedPDF.id,
            title: processedPDF.title,
            url: processedPDF.url,
            source: processedPDF.source,
            summary,
            metadata: {
              pages: processedPDF.content.pages,
              author: processedPDF.metadata.author,
              creationDate: processedPDF.metadata.creationDate,
              processingMethod: processedPDF.processing.method,
              ocrConfidence: processedPDF.processing.ocrConfidence
            },
            structure: {
              sectionsCount: processedPDF.structure.sections.length,
              referencesCount: processedPDF.structure.references.length,
              figuresCount: processedPDF.structure.figures.length,
              tablesCount: processedPDF.structure.tables.length
            },
            relevanceScore: pdfDoc.relevanceScore
          });
        }
      } catch (error) {
        logger.warn(`Failed to process PDF: ${pdfDoc.title}`, error);
        
        // Add basic info even if processing failed
        processedDocuments.push({
          id: pdfDoc.id,
          title: pdfDoc.title,
          url: pdfDoc.url,
          source: pdfDoc.source,
          summary: 'PDF processing failed - document available for manual review',
          metadata: {
            processingError: true
          },
          relevanceScore: pdfDoc.relevanceScore
        });
      }
    }
    
    // Generate research insights
    const insights = generateResearchInsights(processedDocuments, query);
    
    const result: ToolOutput = {
      success: true,
      data: {
        query,
        documents: processedDocuments,
        totalFound: pdfDocuments.length,
        totalProcessed: processedDocuments.length,
        insights,
        searchOptions: {
          documentType,
          includeOCR,
          forceOCR,
          sources: searchOptions.sources,
          analysisDepth
        },
        searchedAt: new Date().toISOString()
      },
      metadata: {
        sources: ['pdf-research'],
        cached: false
      }
    };

    logger.info(`PDF research completed: ${processedDocuments.length} documents processed for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed PDF research for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to conduct PDF research: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['pdf-research'],
        cached: false
      }
    };
  }
}

/**
 * PDF Discovery Tool - Find PDFs without full processing
 */
async function pdfDiscovery(args: ToolInput): Promise<ToolOutput> {
  const { 
    query, 
    maxResults = 20, 
    sources = ['all'],
    documentType = 'any'
  } = args;
  
  try {
    logger.info(`Starting PDF discovery for: ${query}`);
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query parameter is required and must be a string');
    }
    
    const pdfProcessor = new PDFProcessor();
    
    const searchOptions: PDFSearchOptions = {
      query,
      maxDocuments: maxResults,
      documentType: documentType as any,
      includeOCR: false, // Discovery doesn't need OCR
      sources: Array.isArray(sources) ? sources : [sources]
    };
    
    const pdfDocuments = await pdfProcessor.searchPDFs(searchOptions);
    
    const result: ToolOutput = {
      success: true,
      data: {
        query,
        documents: pdfDocuments.map(doc => ({
          id: doc.id,
          title: doc.title,
          url: doc.url,
          source: doc.source,
          relevanceScore: doc.relevanceScore,
          downloadUrl: doc.downloadUrl,
          fileSize: doc.fileSize
        })),
        totalFound: pdfDocuments.length,
        searchOptions: {
          documentType,
          sources: searchOptions.sources
        },
        searchedAt: new Date().toISOString()
      },
      metadata: {
        sources: ['pdf-discovery'],
        cached: false
      }
    };

    logger.info(`PDF discovery completed: ${pdfDocuments.length} documents found for ${query}`);
    return result;

  } catch (error) {
    logger.error(`Failed PDF discovery for ${query}:`, error);
    
    return {
      success: false,
      error: `Failed to discover PDFs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: null,
      metadata: {
        sources: ['pdf-discovery'],
        cached: false
      }
    };
  }
}

/**
 * Create PDF summary based on analysis depth
 */
function createPDFSummary(processedPDF: any, depth: string): string {
  const content = processedPDF.content.text;
  
  if (!content || content.length === 0) {
    return 'No text content available for this PDF document.';
  }
  
  // Extract first few sentences as summary
  const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
  
  let summaryLength: number;
  switch (depth) {
    case 'shallow':
      summaryLength = 2;
      break;
    case 'deep':
      summaryLength = 8;
      break;
    default: // medium
      summaryLength = 4;
  }
  
  const summary = sentences.slice(0, summaryLength).join('. ').trim();
  return summary || 'Content available but summary extraction failed.';
}

/**
 * Generate research insights from processed documents
 */
function generateResearchInsights(documents: any[], query: string): any {
  const insights = {
    totalDocuments: documents.length,
    sourceDistribution: {} as Record<string, number>,
    averageRelevance: 0,
    documentTypes: {} as Record<string, number>,
    processingStats: {
      successful: 0,
      failed: 0,
      ocrUsed: 0
    },
    keyFindings: [] as string[]
  };
  
  let totalRelevance = 0;
  
  documents.forEach(doc => {
    // Source distribution
    insights.sourceDistribution[doc.source] = (insights.sourceDistribution[doc.source] || 0) + 1;
    
    // Relevance calculation
    totalRelevance += doc.relevanceScore || 0;
    
    // Processing stats
    if (doc.metadata.processingError) {
      insights.processingStats.failed++;
    } else {
      insights.processingStats.successful++;
      if (doc.metadata.processingMethod === 'ocr' || doc.metadata.processingMethod === 'hybrid') {
        insights.processingStats.ocrUsed++;
      }
    }
  });
  
  insights.averageRelevance = documents.length > 0 ? totalRelevance / documents.length : 0;
  
  // Generate key findings
  if (documents.length > 0) {
    insights.keyFindings.push(`Found ${documents.length} relevant PDF documents`);
    
    const topSource = Object.entries(insights.sourceDistribution)
      .sort(([,a], [,b]) => b - a)[0];
    if (topSource) {
      insights.keyFindings.push(`Primary source: ${topSource[0]} (${topSource[1]} documents)`);
    }
    
    if (insights.processingStats.ocrUsed > 0) {
      insights.keyFindings.push(`${insights.processingStats.ocrUsed} documents required OCR processing`);
    }
    
    if (insights.averageRelevance > 0.8) {
      insights.keyFindings.push('High relevance documents found');
    } else if (insights.averageRelevance > 0.6) {
      insights.keyFindings.push('Moderate relevance documents found');
    }
  }
  
  return insights;
}

/**
 * Register all PDF research tools
 */
export function registerPDFResearchTools(registry: ToolRegistry): void {
  logger.info('Registering PDF research tools...');

  // PDF Research tool
  const pdfResearchTool = createTool(
    'analyze_pdf',
    'Conduct comprehensive PDF research with document discovery, processing, and analysis',
    'pdf',
    'pdf-research',
    pdfResearch,
    {
      cacheTTL: 3600, // 1 hour cache
      rateLimit: 10,  // 10 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxDocuments', 'documentType', 'includeOCR', 'forceOCR', 'sources', 'dateRange', 'analysisDepth']
    }
  );

  pdfResearchTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Research query for PDF document search'
      },
      maxDocuments: {
        type: 'number',
        description: 'Maximum number of documents to find (default: 10)'
      },
      documentType: {
        type: 'string',
        description: 'Type of documents to search for',
        enum: ['academic', 'report', 'manual', 'any']
      },
      includeOCR: {
        type: 'boolean',
        description: 'Enable OCR for scanned PDFs (default: false)'
      },
      forceOCR: {
        type: 'boolean',
        description: 'Force OCR processing even for good quality text - useful for testing OCR functionality (default: false)'
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sources to search (arxiv, pubmed, web, all)'
      },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end: { type: 'string', description: 'End date (YYYY-MM-DD)' }
        },
        description: 'Date range filter for documents'
      },
      analysisDepth: {
        type: 'string',
        description: 'Depth of analysis (shallow, medium, deep)',
        enum: ['shallow', 'medium', 'deep']
      }
    },
    required: ['query']
  };

  registry.registerTool(pdfResearchTool);

  // PDF Discovery tool
  const pdfDiscoveryTool = createTool(
    'pdf_discovery',
    'Discover PDF documents without full processing - fast PDF search and listing',
    'pdf',
    'pdf-discovery',
    pdfDiscovery,
    {
      cacheTTL: 1800, // 30 minutes cache
      rateLimit: 15,  // 15 requests per minute
      requiredParams: ['query'],
      optionalParams: ['maxResults', 'sources', 'documentType']
    }
  );

  pdfDiscoveryTool.inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for PDF document discovery'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)'
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sources to search (arxiv, pubmed, web, all)'
      },
      documentType: {
        type: 'string',
        description: 'Type of documents to search for',
        enum: ['academic', 'report', 'manual', 'any']
      }
    },
    required: ['query']
  };

  registry.registerTool(pdfDiscoveryTool);

  logger.info('PDF research tools registered successfully');
}
