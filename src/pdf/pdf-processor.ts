/**
 * PDF Processing Module
 * Handles PDF discovery, download, parsing, and OCR
 */

import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { createWorker } from 'tesseract.js';
import PDFParser from 'pdf2json';
import pdf2pic from 'pdf2pic';
import { OCRManager } from './ocr-engines/ocr-manager.js';

const logger = new Logger('PDFProcessor');

export interface PDFDocument {
  id: string;
  title: string;
  url: string;
  source: string;
  relevanceScore: number;
  fileSize?: number;
  downloadUrl?: string;
  metadata?: {
    searchEngine?: string;
    strategy?: string;
    domain?: string;
    [key: string]: any;
  };
}

export interface ProcessedPDF {
  id: string;
  title: string;
  url: string;
  source: string;
  content: {
    text: string;
    pages: number;
    extractedAt: string;
  };
  metadata: {
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  structure: {
    sections: PDFSection[];
    references: string[];
    figures: string[];
    tables: string[];
  };
  processing: {
    method: 'text-extraction' | 'ocr' | 'hybrid';
    ocrConfidence?: number;
    processingTime: number;
  };
}

export interface PDFSection {
  title: string;
  content: string;
  pageStart: number;
  pageEnd: number;
  level: number; // heading level (1-6)
}

export interface PDFSearchOptions {
  query: string;
  maxDocuments: number;
  documentType: 'academic' | 'report' | 'manual' | 'any';
  includeOCR: boolean;
  forceOCR?: boolean; // Force OCR even for good quality text (for testing)
  sources: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export class PDFProcessor {
  private downloadDir: string;
  private cacheDir: string;
  private ocrManager: OCRManager;

  constructor() {
    this.downloadDir = path.join(process.cwd(), 'downloads', 'pdfs');
    this.cacheDir = path.join(process.cwd(), 'cache', 'pdfs');
    this.ocrManager = new OCRManager({
      primaryEngine: 'auto',
      fallbackEngines: ['claude', 'gemini', 'tesseract'],
      enableFallback: true,
      claudeApiKey: process.env.ANTHROPIC_API_KEY,
      geminiApiKey: process.env.GOOGLE_API_KEY
    });
    this.ensureDirectories();
  }

  /**
   * Search for PDFs across multiple academic and web sources
   */
  async searchPDFs(options: PDFSearchOptions): Promise<PDFDocument[]> {
    logger.info(`Searching for PDFs: ${options.query}`);
    
    const results: PDFDocument[] = [];
    
    try {
      // Search academic sources
      if (options.sources.includes('arxiv') || options.sources.includes('all')) {
        const arxivResults = await this.searchArXivPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...arxivResults);
      }

      if (options.sources.includes('pubmed') || options.sources.includes('all')) {
        const pubmedResults = await this.searchPubMedPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...pubmedResults);
      }

      // Search IEEE Xplore
      if (options.sources.includes('ieee') || options.sources.includes('all')) {
        const ieeeResults = await this.searchIEEEPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...ieeeResults);
      }

      // Search Google Scholar
      if (options.sources.includes('scholar') || options.sources.includes('all')) {
        const scholarResults = await this.searchGoogleScholarPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...scholarResults);
      }

      // Search ResearchGate
      if (options.sources.includes('researchgate') || options.sources.includes('all')) {
        const rgResults = await this.searchResearchGatePDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...rgResults);
      }

      // Search SSRN
      if (options.sources.includes('ssrn') || options.sources.includes('all')) {
        const ssrnResults = await this.searchSSRNPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...ssrnResults);
      }

      // Search government sources
      if (options.sources.includes('government') || options.sources.includes('all')) {
        const govResults = await this.searchGovernmentPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...govResults);
      }

      // Search technical documentation
      if (options.sources.includes('technical') || options.sources.includes('all')) {
        const techResults = await this.searchTechnicalPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...techResults);
      }

      // Search general web sources
      if (options.sources.includes('web') || options.sources.includes('all')) {
        const webResults = await this.searchWebPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...webResults);
      }

      // Universal PDF search (comprehensive web search)
      if (options.sources.includes('universal') || options.sources.includes('all')) {
        const universalResults = await this.searchUniversalPDFs(options.query, options.maxDocuments, options.dateRange);
        results.push(...universalResults);
      }
      
      // Remove duplicates and sort by relevance
      const uniqueResults = this.removeDuplicatePDFs(results);
      const sortedResults = uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      logger.info(`Found ${sortedResults.length} PDF documents for: ${options.query}`);
      return sortedResults.slice(0, options.maxDocuments);
      
    } catch (error) {
      logger.error(`Failed to search PDFs for ${options.query}:`, error);
      return [];
    }
  }

  /**
   * Download and process a PDF document
   */
  async processPDF(pdfDoc: PDFDocument, includeOCR: boolean = false, forceOCR: boolean = false, debugOptions?: any): Promise<ProcessedPDF | null> {
    logger.info(`Processing PDF: ${pdfDoc.title}`);
    
    try {
      const startTime = Date.now();
      
      // Check cache first (skip cache if force OCR is enabled)
      if (!forceOCR) {
        const cachedResult = await this.getCachedPDF(pdfDoc.id);
        if (cachedResult) {
          logger.info(`Using cached PDF: ${pdfDoc.title}`);
          return cachedResult;
        }
      } else {
        logger.info(`Skipping cache due to force OCR: ${pdfDoc.title}`);
      }
      
      // Download PDF
      const filePath = await this.downloadPDF(pdfDoc);
      if (!filePath) {
        logger.warn(`Failed to download PDF: ${pdfDoc.title}`);
        return null;
      }
      
      // Extract text content
      const textContent = await this.extractTextFromPDF(filePath);
      
      // If text extraction failed or returned minimal content, try OCR
      let finalContent = textContent;
      let processingMethod: 'text-extraction' | 'ocr' | 'hybrid' = 'text-extraction';
      let ocrConfidence: number | undefined;

      // Determine if OCR is needed
      const needsOCR = this.shouldUseOCR(textContent, includeOCR, forceOCR, debugOptions);

      if (needsOCR) {
        logger.info(`Attempting OCR for PDF: ${pdfDoc.title} (reason: ${needsOCR.reason})`);
        const ocrResult = await this.performOCR(filePath, debugOptions);
        if (ocrResult && ocrResult.text.length > 50) { // Minimum viable OCR result
          if (textContent && textContent.length > 100) {
            // Combine text extraction and OCR results
            finalContent = textContent + '\n\n--- OCR SUPPLEMENT ---\n\n' + ocrResult.text;
            processingMethod = 'hybrid';
          } else {
            // Use OCR as primary source
            finalContent = ocrResult.text;
            processingMethod = 'ocr';
          }
          ocrConfidence = ocrResult.confidence;
          logger.info(`OCR successful with confidence: ${ocrConfidence.toFixed(2)}%`);
        } else {
          logger.warn('OCR failed to extract meaningful text');
        }
      }
      
      // Extract metadata
      const metadata = await this.extractPDFMetadata(filePath);
      
      // Extract structure
      const structure = await this.extractPDFStructure(finalContent);
      
      // Count pages
      const pageCount = await this.getPDFPageCount(filePath);
      
      const processingTime = Date.now() - startTime;
      
      const processedPDF: ProcessedPDF = {
        id: pdfDoc.id,
        title: pdfDoc.title,
        url: pdfDoc.url,
        source: pdfDoc.source,
        content: {
          text: finalContent,
          pages: pageCount,
          extractedAt: new Date().toISOString()
        },
        metadata,
        structure,
        processing: {
          method: processingMethod,
          ocrConfidence,
          processingTime
        }
      };
      
      // Cache the result
      await this.cachePDF(processedPDF);
      
      logger.info(`Successfully processed PDF: ${pdfDoc.title} (${processingTime}ms)`);
      return processedPDF;
      
    } catch (error) {
      logger.error(`Failed to process PDF ${pdfDoc.title}:`, error);
      return null;
    }
  }

  /**
   * Search arXiv for PDF documents
   */
  private async searchArXivPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      let searchQuery = `all:${encodeURIComponent(query)}`;

      // Add date range filter if provided
      if (dateRange) {
        if (dateRange.start) {
          const startDate = dateRange.start.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
          searchQuery += ` AND submittedDate:[${startDate}0000 TO `;

          if (dateRange.end) {
            const endDate = dateRange.end.replace(/-/g, '');
            searchQuery += `${endDate}2359]`;
          } else {
            searchQuery += `99991231]`;
          }
        } else if (dateRange.end) {
          const endDate = dateRange.end.replace(/-/g, '');
          searchQuery += ` AND submittedDate:[19910101 TO ${endDate}2359]`;
        }
      }

      const searchUrl = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

      logger.info(`ArXiv search URL: ${searchUrl}`);

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const results = this.parseArXivResponse(xmlText);

      // Apply client-side date filtering as backup
      const filteredResults = this.filterResultsByDate(results, dateRange);

      logger.info(`ArXiv search: ${results.length} raw results -> ${filteredResults.length} after date filtering`);

      return filteredResults;

    } catch (error) {
      logger.warn(`Failed to search arXiv PDFs:`, error);
      return [];
    }
  }

  /**
   * Search PubMed for PDF documents
   */
  private async searchPubMedPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      let searchTerm = encodeURIComponent(query);

      // Add date range filter if provided
      if (dateRange) {
        if (dateRange.start && dateRange.end) {
          // Convert YYYY-MM-DD to YYYY/MM/DD format for PubMed
          const startDate = dateRange.start.replace(/-/g, '/');
          const endDate = dateRange.end.replace(/-/g, '/');
          searchTerm += encodeURIComponent(` AND ("${startDate}"[Date - Publication] : "${endDate}"[Date - Publication])`);
        } else if (dateRange.start) {
          const startDate = dateRange.start.replace(/-/g, '/');
          searchTerm += encodeURIComponent(` AND "${startDate}"[Date - Publication] : 3000[Date - Publication]`);
        } else if (dateRange.end) {
          const endDate = dateRange.end.replace(/-/g, '/');
          searchTerm += encodeURIComponent(` AND 1900[Date - Publication] : "${endDate}"[Date - Publication]`);
        }
      }

      // PubMed doesn't directly provide PDFs, but we can search for papers and try to find PDF links
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchTerm}&retmax=${maxResults}&retmode=json&sort=pub_date`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`PubMed API error: ${response.status}`);
      }

      const data = await response.json();
      const results = await this.parsePubMedResponse(data, query);

      // Apply client-side date filtering as backup
      const filteredResults = this.filterResultsByDate(results, dateRange);

      logger.info(`PubMed search: ${results.length} raw results -> ${filteredResults.length} after date filtering`);

      return filteredResults;

    } catch (error) {
      logger.warn(`Failed to search PubMed PDFs:`, error);
      return [];
    }
  }

  /**
   * Search web for PDF documents using search engines
   */
  private async searchWebPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      let searchQueries = [
        `"${query}" filetype:pdf`,
        `${query} PDF download`,
        `${query} research paper PDF`
      ];

      // Add date range to search queries if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQueries = searchQueries.map(q => `${q} ${dateFilter}`);
        }
      }

      const results: PDFDocument[] = [];

      for (const searchQuery of searchQueries) {
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const html = await response.text();
          const extractedResults = this.extractPDFLinksFromSearch(html, query);
          // Apply client-side date filtering if needed
          const filteredResults = this.filterResultsByDate(extractedResults, dateRange);
          results.push(...filteredResults);
        }
      }

      return results.slice(0, maxResults);
      
    } catch (error) {
      logger.warn(`Failed to search web PDFs:`, error);
      return [];
    }
  }

  /**
   * Parse arXiv XML response
   */
  private parseArXivResponse(xmlText: string): PDFDocument[] {
    const results: PDFDocument[] = [];
    
    try {
      // Simple XML parsing for arXiv entries
      const entryMatches = xmlText.match(/<entry>(.*?)<\/entry>/gs);
      
      if (entryMatches) {
        entryMatches.forEach((entry, index) => {
          const titleMatch = entry.match(/<title>(.*?)<\/title>/s);
          const idMatch = entry.match(/<id>(.*?)<\/id>/);
          const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/s);
          
          if (titleMatch && idMatch) {
            const title = titleMatch[1].replace(/\s+/g, ' ').trim();
            const arxivId = idMatch[1].split('/').pop()?.replace('abs/', '');
            
            if (arxivId) {
              results.push({
                id: `arxiv-${arxivId}`,
                title,
                url: `https://arxiv.org/abs/${arxivId}`,
                source: 'arXiv',
                relevanceScore: 1.0 - (index * 0.1), // Decrease relevance for later results
                downloadUrl: `https://arxiv.org/pdf/${arxivId}.pdf`
              });
            }
          }
        });
      }
      
    } catch (error) {
      logger.warn(`Failed to parse arXiv response:`, error);
    }
    
    return results;
  }

  /**
   * Parse PubMed response and attempt to find PDF links
   */
  private async parsePubMedResponse(data: any, query: string): Promise<PDFDocument[]> {
    const results: PDFDocument[] = [];

    try {
      if (data.esearchresult && data.esearchresult.idlist) {
        // Limit to first 5 PMIDs to avoid overwhelming the API
        const pmids = data.esearchresult.idlist.slice(0, 5);

        // Fetch detailed information for each PMID
        for (let i = 0; i < pmids.length; i++) {
          const pmid = pmids[i];
          const articleInfo = await this.fetchPubMedArticleInfo(pmid);

          if (articleInfo) {
            results.push({
              id: `pubmed-${pmid}`,
              title: articleInfo.title || `PubMed Article ${pmid}`,
              url: articleInfo.pdfUrl || `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
              source: 'PubMed',
              relevanceScore: 1.0 - (i * 0.1)
            });
          }

          // Add delay to respect API rate limits
          if (i < pmids.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

    } catch (error) {
      logger.warn(`Failed to parse PubMed response:`, error);
    }

    return results;
  }

  /**
   * Fetch detailed information for a PubMed article and try to find PDF links
   */
  private async fetchPubMedArticleInfo(pmid: string): Promise<{ title: string; pdfUrl?: string } | null> {
    try {
      // Fetch article summary
      const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
      const summaryResponse = await fetch(summaryUrl);

      if (!summaryResponse.ok) {
        logger.warn(`Failed to fetch PubMed summary for ${pmid}: ${summaryResponse.status}`);
        return null;
      }

      const summaryData = await summaryResponse.json();
      const article = summaryData.result?.[pmid];

      if (!article) {
        return null;
      }

      const title = article.title || `PubMed Article ${pmid}`;

      // Try to find PDF through multiple strategies
      let pdfUrl: string | undefined;

      // Strategy 1: Check for PMC ID (PubMed Central)
      if (article.pmcrefcount && article.pmcrefcount > 0) {
        pdfUrl = await this.findPMCPdfUrl(pmid);
      }

      // Strategy 2: Try to find DOI and resolve to publisher PDF
      if (!pdfUrl && article.elocationid) {
        const doi = this.extractDOI(article.elocationid);
        if (doi) {
          pdfUrl = await this.findPdfFromDOI(doi);
        }
      }

      // Strategy 3: Search for open access versions
      if (!pdfUrl) {
        pdfUrl = await this.searchOpenAccessPdf(title, pmid);
      }

      return {
        title: title.replace(/\.$/, ''), // Remove trailing period
        pdfUrl
      };

    } catch (error) {
      logger.warn(`Failed to fetch PubMed article info for ${pmid}:`, error);
      return null;
    }
  }

  /**
   * Try to find PDF URL from PubMed Central (PMC)
   */
  private async findPMCPdfUrl(pmid: string): Promise<string | undefined> {
    try {
      // Search for PMC ID
      const linkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pmc&id=${pmid}&retmode=json`;
      const linkResponse = await fetch(linkUrl);

      if (linkResponse.ok) {
        const linkData = await linkResponse.json();
        const pmcIds = linkData.linksets?.[0]?.linksetdbs?.find((db: any) => db.dbto === 'pmc')?.links;

        if (pmcIds && pmcIds.length > 0) {
          const pmcId = pmcIds[0];

          // Try multiple PMC PDF URL formats
          const possibleUrls = [
            `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/pdf/`,
            `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/pdf/${pmcId}.pdf`,
            `https://europepmc.org/articles/PMC${pmcId}?pdf=render`,
            `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/bin/`,
          ];

          // For now, return the first format and let the download handler try alternatives
          return possibleUrls[0];
        }
      }
    } catch (error) {
      logger.warn(`Failed to find PMC PDF for ${pmid}:`, error);
    }

    return undefined;
  }

  /**
   * Extract DOI from PubMed elocationid field
   */
  private extractDOI(elocationid: string): string | null {
    const doiMatch = elocationid.match(/10\.\d+\/[^\s]+/);
    return doiMatch ? doiMatch[0] : null;
  }

  /**
   * Try to find PDF from DOI
   */
  private async findPdfFromDOI(doi: string): Promise<string | undefined> {
    try {
      // Try common open access repositories
      const openAccessUrls = [
        `https://arxiv.org/search/?query=${encodeURIComponent(doi)}&searchtype=all`,
        `https://www.biorxiv.org/search/${encodeURIComponent(doi)}`,
        `https://europepmc.org/search?query=DOI:${encodeURIComponent(doi)}`
      ];

      // For now, return a constructed URL that might work
      // In a full implementation, you would scrape these pages to find actual PDF links
      return `https://doi.org/${doi}`;

    } catch (error) {
      logger.warn(`Failed to find PDF from DOI ${doi}:`, error);
    }

    return undefined;
  }

  /**
   * Search for open access PDF versions
   */
  private async searchOpenAccessPdf(title: string, pmid: string): Promise<string | undefined> {
    try {
      // Search for open access versions using the title
      const searchQuery = `"${title}" filetype:pdf site:ncbi.nlm.nih.gov OR site:europepmc.org OR site:arxiv.org`;
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const html = await response.text();
        const pdfUrls = this.extractPDFLinksFromSearch(html, title);

        if (pdfUrls.length > 0) {
          return pdfUrls[0].url;
        }
      }
    } catch (error) {
      logger.warn(`Failed to search open access PDF for ${pmid}:`, error);
    }

    return undefined;
  }

  /**
   * Extract PDF links from search engine results
   */
  private extractPDFLinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];
    
    try {
      // Look for PDF URLs in search results
      const pdfUrlPattern = /https?:\/\/[^\s"<>]+\.pdf/gi;
      const urls = html.match(pdfUrlPattern) || [];
      
      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');
        
        results.push({
          id: `web-pdf-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: 'Web Search',
          relevanceScore: 0.8 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });
      
    } catch (error) {
      logger.warn(`Failed to extract PDF links from search:`, error);
    }
    
    return results;
  }

  /**
   * Remove duplicate PDF documents
   */
  private removeDuplicatePDFs(pdfs: PDFDocument[]): PDFDocument[] {
    const seen = new Set<string>();
    return pdfs.filter(pdf => {
      const key = pdf.url.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    [this.downloadDir, this.cacheDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Get cached PDF processing result
   */
  private async getCachedPDF(id: string): Promise<ProcessedPDF | null> {
    try {
      const cacheFile = path.join(this.cacheDir, `${id}.json`);
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        logger.info(`Found cached PDF: ${id}`);
        return cached;
      }
    } catch (error) {
      logger.warn(`Failed to read cached PDF ${id}:`, error);
    }
    return null;
  }

  /**
   * Download PDF from URL
   */
  private async downloadPDF(pdfDoc: PDFDocument): Promise<string | null> {
    try {
      const downloadUrl = pdfDoc.downloadUrl || pdfDoc.url;
      const filename = `${pdfDoc.id}.pdf`;
      const filePath = path.join(this.downloadDir, filename);

      // Check if already downloaded
      if (fs.existsSync(filePath)) {
        logger.info(`PDF already downloaded: ${filename}`);
        return filePath;
      }

      logger.info(`Downloading PDF: ${downloadUrl}`);

      // Special handling for PMC URLs
      if (downloadUrl.includes('pmc/articles') && downloadUrl.includes('/pdf/')) {
        return await this.downloadPMCPdf(downloadUrl, filePath, pdfDoc.title);
      }

      const response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Check if we got HTML instead of PDF (common with redirects)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') || buffer.byteLength < 10000) {
        const text = new TextDecoder().decode(buffer.slice(0, 1000));
        if (text.includes('<html') || text.includes('<!DOCTYPE')) {
          logger.warn(`Received HTML instead of PDF from ${downloadUrl}`);
          return null;
        }
      }

      fs.writeFileSync(filePath, Buffer.from(buffer));

      logger.info(`PDF downloaded successfully: ${filename} (${buffer.byteLength} bytes)`);
      return filePath;

    } catch (error) {
      logger.error(`Failed to download PDF ${pdfDoc.title}:`, error);
      return null;
    }
  }

  /**
   * Special handling for PMC PDF downloads
   */
  private async downloadPMCPdf(url: string, filePath: string, title: string): Promise<string | null> {
    try {
      // Extract PMC ID from URL
      const pmcMatch = url.match(/PMC(\d+)/);
      if (!pmcMatch) {
        logger.warn(`Could not extract PMC ID from URL: ${url}`);
        return null;
      }

      const pmcId = pmcMatch[1];

      // Try different PMC PDF URL formats
      const pmcUrls = [
        `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/pdf/`,
        `https://europepmc.org/articles/PMC${pmcId}?pdf=render`,
        `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/pdf/main.pdf`,
        `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/bin/`,
      ];

      for (const pmcUrl of pmcUrls) {
        try {
          logger.info(`Trying PMC URL: ${pmcUrl}`);

          const response = await fetch(pmcUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/pdf,*/*',
              'Referer': `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcId}/`
            }
          });

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || '';

            // Check if we got a real PDF
            if (buffer.byteLength > 10000 && !contentType.includes('text/html')) {
              const pdfHeader = new Uint8Array(buffer.slice(0, 4));
              if (pdfHeader[0] === 0x25 && pdfHeader[1] === 0x50 && pdfHeader[2] === 0x44 && pdfHeader[3] === 0x46) {
                fs.writeFileSync(filePath, Buffer.from(buffer));
                logger.info(`PMC PDF downloaded successfully: ${buffer.byteLength} bytes`);
                return filePath;
              }
            }
          }

        } catch (urlError) {
          logger.warn(`Failed to download from ${pmcUrl}:`, urlError);
        }
      }

      logger.warn(`All PMC URL attempts failed for PMC${pmcId}`);
      return null;

    } catch (error) {
      logger.error(`PMC PDF download failed for ${title}:`, error);
      return null;
    }
  }

  /**
   * Extract text from PDF using pdf2json
   */
  private async extractTextFromPDF(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const pdfParser = new (PDFParser as any)(null, 1);

        pdfParser.on('pdfParser_dataError', (errData: any) => {
          logger.warn(`PDF parsing error for ${filePath}:`, errData.parserError);
          resolve(''); // Return empty string instead of failing
        });

        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            let fullText = '';

            if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
              for (const page of pdfData.Pages) {
                if (page.Texts && Array.isArray(page.Texts)) {
                  let pageText = '';
                  let lastY = -1;

                  // Sort text items by Y position to maintain reading order
                  const sortedTexts = page.Texts.sort((a: any, b: any) => (b.y || 0) - (a.y || 0));

                  for (const textItem of sortedTexts) {
                    if (textItem.R && Array.isArray(textItem.R)) {
                      // Check if this is a new line (different Y position)
                      const currentY = textItem.y || 0;
                      if (lastY !== -1 && Math.abs(currentY - lastY) > 0.5) {
                        pageText += '\n';
                      }
                      lastY = currentY;

                      for (const run of textItem.R) {
                        if (run.T) {
                          // Decode URI component and add space
                          pageText += decodeURIComponent(run.T) + ' ';
                        }
                      }
                    }
                  }
                  fullText += pageText + '\n'; // Add newline after each page
                }
              }
            }

            // Clean up the text while preserving line structure
            fullText = fullText
              .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space, but preserve newlines
              .replace(/\n\s*\n/g, '\n') // Remove empty lines
              .replace(/\n /g, '\n') // Remove spaces at the beginning of lines
              .trim();

            logger.info(`Extracted ${fullText.length} characters from PDF: ${path.basename(filePath)}`);
            resolve(fullText);

          } catch (parseError) {
            logger.warn(`Error processing PDF data for ${filePath}:`, parseError);
            resolve('');
          }
        });

        pdfParser.loadPDF(filePath);

      } catch (error) {
        logger.warn(`Failed to extract text from PDF ${filePath}:`, error);
        resolve('');
      }
    });
  }

  /**
   * Perform OCR on PDF using OCR Manager (supports multiple engines)
   */
  private async performOCR(filePath: string, debugOptions?: any): Promise<{ text: string; confidence: number; engine?: string } | null> {
    try {
      logger.info(`Starting advanced OCR for PDF: ${filePath}`);

      // Prepare OCR options with debug parameters
      const ocrOptions = {
        maxPages: 5,
        extractStructure: true,
        enhanceAccuracy: true,
        preferredEngine: debugOptions?.ocrEngine || 'auto',
        forceEngine: debugOptions?.testGemini ? 'gemini' : undefined,
        debugMode: debugOptions?.debugOCR || false
      };

      logger.info(`OCR options:`, ocrOptions);

      // Use the new OCR Manager for intelligent engine selection
      const result = await this.ocrManager.processPDF(filePath, ocrOptions);

      if (result && result.text && result.text.trim().length > 0) {
        logger.info(`OCR successful with ${result.engine}: ${result.text.length} characters, ${result.confidence.toFixed(3)} confidence`);
        return {
          text: result.text,
          confidence: result.confidence * 100, // Convert to percentage for compatibility
          engine: result.engine
        };
      } else {
        logger.warn('OCR failed to extract meaningful text');
        return null;
      }



    } catch (error) {
      logger.error(`OCR failed for PDF ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Analyze document structure and extract key sections
   */
  private analyzeDocumentStructure(text: string): {
    sections: string[];
    abstract: string;
    references: string[];
    summary: string;
  } {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const sections: string[] = [];
    const references: string[] = [];
    let abstract = '';



    // Extract sections (look for numbered sections or common headings)
    for (const line of lines) {
      const trimmed = line.trim();

      // Enhanced section header detection with more patterns
      if (
        /^\d+\.?\s+[A-Z]/.test(trimmed) || // "1. Introduction" or "1 Introduction"
        /^\d+\.\d+\.?\s+[A-Z]/.test(trimmed) || // "1.1 Subsection" or "1.1. Subsection"
        /^Chapter\s+\d+/i.test(trimmed) || // "Chapter 1", "Chapter 2"
        /^(Abstract|Introduction|Methodology|Methods|Results|Discussion|Conclusion|References|Background|Related Work|Experiments|Evaluation|Future Work|Acknowledgments|Preface|Contents|Bibliography|Notation)/i.test(trimmed) ||
        /^[A-Z][A-Z\s]{8,}$/.test(trimmed) || // ALL CAPS headers (reduced minimum length)
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed) && trimmed.length > 5 && trimmed.length < 80 || // Title Case headers
        /^Appendix\s+[A-Z]/i.test(trimmed) || // "Appendix A", "Appendix B"
        // Match patterns like "2.1 Basic definitions and the notion of convexity"
        /^\d+\.\d+\s+[A-Z][a-z]/.test(trimmed) ||
        // Match patterns like "CHAPTER 1. INTRODUCTION"
        /^CHAPTER\s+\d+/i.test(trimmed)
      ) {
        sections.push(trimmed);
      }

      // Extract abstract (first substantial paragraph after "Abstract")
      if (!abstract && /abstract/i.test(trimmed) && trimmed.length < 50) {
        const abstractIndex = lines.indexOf(line);
        if (abstractIndex < lines.length - 1) {
          const nextLines = lines.slice(abstractIndex + 1, abstractIndex + 5);
          abstract = nextLines.join(' ').substring(0, 500) + '...';
        }
      }

      // Enhanced reference detection with more citation patterns
      if (
        /^\[\d+\]/.test(trimmed) || // [1] Reference format
        /^\d+\./.test(trimmed) && trimmed.length > 50 || // Numbered references
        /\(\d{4}\)/.test(trimmed) && trimmed.length > 30 || // Contains year in parentheses
        /^[A-Z][a-z]+,\s+[A-Z]/.test(trimmed) && /\d{4}/.test(trimmed) || // "Author, A. (2023)"
        /et\s+al\./.test(trimmed) && /\d{4}/.test(trimmed) || // "Smith et al. (2023)"
        /^[A-Z][a-z]+\s+and\s+[A-Z][a-z]+/.test(trimmed) && /\d{4}/.test(trimmed) || // "Smith and Jones (2023)"
        /doi:|DOI:|arXiv:|arxiv:/i.test(trimmed) // DOI or arXiv references
      ) {
        references.push(trimmed.substring(0, 200));
      }
    }

    // Generate summary (first few meaningful sentences)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ').substring(0, 300) + '...';

    return {
      sections: sections.slice(0, 10), // Limit to first 10 sections
      abstract: abstract || summary,
      references: references.slice(0, 5), // Limit to first 5 references
      summary
    };
  }

  /**
   * Extract PDF metadata using pdf2json
   */
  private async extractPDFMetadata(filePath: string): Promise<any> {
    try {
      // Placeholder implementation
      // In a full implementation, you would use PDF.js to extract metadata

      const stats = fs.statSync(filePath);
      return {
        fileSize: stats.size,
        creationDate: stats.birthtime.toISOString(),
        modificationDate: stats.mtime.toISOString(),
        title: path.basename(filePath, '.pdf')
      };

    } catch (error) {
      logger.warn(`Failed to extract metadata from PDF ${filePath}:`, error);
      return {};
    }
  }

  /**
   * Extract PDF structure (sections, references, etc.)
   */
  private async extractPDFStructure(content: string): Promise<any> {
    try {
      const structure = {
        sections: [] as PDFSection[],
        references: [] as string[],
        figures: [] as string[],
        tables: [] as string[]
      };

      if (!content) {
        return structure;
      }

      // Use our enhanced document structure analysis
      const analysis = this.analyzeDocumentStructure(content);

      // Convert analysis results to the expected structure format
      structure.sections = analysis.sections.map((section, index) => ({
        title: section,
        content: '', // Could be enhanced to extract section content
        pageStart: 1,
        pageEnd: 1,
        level: this.determineSectionLevel(section)
      })) as PDFSection[];

      structure.references = analysis.references;
      structure.figures = this.extractFigureReferences(content);
      structure.tables = this.extractTableReferences(content);

      // Add enhanced analysis results
      (structure as any).abstract = analysis.abstract;
      (structure as any).summary = analysis.summary;

      return structure;

    } catch (error) {
      logger.warn(`Failed to extract PDF structure:`, error);
      return { sections: [], references: [], figures: [], tables: [] };
    }
  }

  /**
   * Get PDF page count using pdf2json
   */
  private async getPDFPageCount(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      try {
        const pdfParser = new (PDFParser as any)(null, 1);

        pdfParser.on('pdfParser_dataError', () => {
          resolve(1); // Default to 1 page on error
        });

        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          const pageCount = pdfData.Pages ? pdfData.Pages.length : 1;
          resolve(pageCount);
        });

        pdfParser.loadPDF(filePath);

      } catch (error) {
        logger.warn(`Failed to get page count for PDF ${filePath}:`, error);
        resolve(1);
      }
    });
  }

  /**
   * Cache processed PDF result
   */
  private async cachePDF(processedPDF: ProcessedPDF): Promise<void> {
    try {
      const cacheFile = path.join(this.cacheDir, `${processedPDF.id}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(processedPDF, null, 2));
      logger.info(`Cached PDF processing result: ${processedPDF.id}`);

    } catch (error) {
      logger.warn(`Failed to cache PDF ${processedPDF.id}:`, error);
    }
  }

  /**
   * Check if a line is a heading
   */
  private isHeading(line: string): boolean {
    // Simple heuristics for heading detection
    return (
      line.length < 100 && // Headings are usually short
      (
        /^[A-Z][A-Z\s]+$/.test(line) || // ALL CAPS
        /^\d+\.?\s+[A-Z]/.test(line) || // Numbered headings
        /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(line) // Title Case
      )
    );
  }

  /**
   * Get heading level (1-6)
   */
  private getHeadingLevel(line: string): number {
    if (/^\d+\.?\s+/.test(line)) {
      const match = line.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        return Math.min(num, 6);
      }
    }
    return 1; // Default level
  }

  /**
   * Extract references from content
   */
  private extractReferences(content: string): string[] {
    const references: string[] = [];

    // Look for reference sections
    const refSectionMatch = content.match(/references?\s*\n(.*?)(?:\n\n|\n[A-Z]|\n\d+\.|\n$)/is);
    if (refSectionMatch) {
      const refText = refSectionMatch[1];
      const refLines = refText.split('\n').filter(line => line.trim().length > 20);
      references.push(...refLines.slice(0, 20)); // Limit to 20 references
    }

    return references;
  }

  /**
   * Extract figure references from content
   */
  private extractFigures(content: string): string[] {
    const figures: string[] = [];
    const figureMatches = content.match(/figure\s+\d+[:\.]?\s*[^\n]*/gi);
    if (figureMatches) {
      figures.push(...figureMatches.slice(0, 10)); // Limit to 10 figures
    }
    return figures;
  }

  /**
   * Extract table references from content
   */
  private extractTables(content: string): string[] {
    const tables: string[] = [];
    const tableMatches = content.match(/table\s+\d+[:\.]?\s*[^\n]*/gi);
    if (tableMatches) {
      tables.push(...tableMatches.slice(0, 10)); // Limit to 10 tables
    }
    return tables;
  }

  /**
   * Determine section level based on formatting
   */
  private determineSectionLevel(section: string): number {
    if (/^\d+\.?\s/.test(section)) {
      const match = section.match(/^(\d+)/);
      return match ? Math.min(parseInt(match[1]), 6) : 1;
    }
    if (/^(Abstract|Introduction|Conclusion)/i.test(section)) return 1;
    if (/^(Methodology|Results|Discussion)/i.test(section)) return 2;
    return 3;
  }

  /**
   * Extract figure references from text
   */
  private extractFigureReferences(content: string): string[] {
    const figureRefs: string[] = [];
    const figureRegex = /Figure\s+\d+[:\.]?\s*[^\n]*/gi;
    const matches = content.match(figureRegex);
    if (matches) {
      figureRefs.push(...matches.slice(0, 10)); // Limit to 10 figures
    }
    return figureRefs;
  }

  /**
   * Extract table references from text
   */
  private extractTableReferences(content: string): string[] {
    const tableRefs: string[] = [];
    const tableRegex = /Table\s+\d+[:\.]?\s*[^\n]*/gi;
    const matches = content.match(tableRegex);
    if (matches) {
      tableRefs.push(...matches.slice(0, 10)); // Limit to 10 tables
    }
    return tableRefs;
  }

  /**
   * Build date filter string for search queries
   */
  private buildDateFilter(dateRange: { start?: string; end?: string }): string {
    const currentYear = new Date().getFullYear();

    if (dateRange.start && dateRange.end) {
      const startYear = new Date(dateRange.start).getFullYear();
      const endYear = new Date(dateRange.end).getFullYear();
      if (startYear === endYear) {
        return `${startYear}`;
      } else {
        return `${startYear}..${endYear}`;
      }
    } else if (dateRange.start) {
      const startYear = new Date(dateRange.start).getFullYear();
      return `${startYear}..${currentYear}`;
    } else if (dateRange.end) {
      const endYear = new Date(dateRange.end).getFullYear();
      return `2000..${endYear}`;
    }

    return '';
  }

  /**
   * Filter PDF results by date range (client-side filtering)
   */
  private filterResultsByDate(results: PDFDocument[], dateRange?: { start?: string; end?: string }): PDFDocument[] {
    if (!dateRange || (!dateRange.start && !dateRange.end)) {
      return results;
    }

    logger.info(`Applying strict date filter: ${dateRange.start} to ${dateRange.end}`);

    const filtered = results.filter(doc => {
      // Try to extract date from document metadata or URL
      const docDate = this.extractDateFromDocument(doc);
      if (!docDate) {
        logger.warn(`No date found for document: ${doc.title.substring(0, 50)}... - EXCLUDING`);
        return false; // More strict: exclude if no date found
      }

      const docTime = docDate.getTime();
      const docDateStr = docDate.toISOString().split('T')[0];

      if (dateRange.start) {
        const startTime = new Date(dateRange.start).getTime();
        if (docTime < startTime) {
          logger.info(`Document excluded: ${doc.title.substring(0, 30)}... (${docDateStr}) is before ${dateRange.start}`);
          return false;
        }
      }

      if (dateRange.end) {
        // Add one day to end date to include the entire end day
        const endDate = new Date(dateRange.end);
        endDate.setDate(endDate.getDate() + 1);
        const endTime = endDate.getTime();
        if (docTime >= endTime) {
          logger.info(`Document excluded: ${doc.title.substring(0, 30)}... (${docDateStr}) is after ${dateRange.end}`);
          return false;
        }
      }

      logger.info(`Document included: ${doc.title.substring(0, 30)}... (${docDateStr}) is within range`);
      return true;
    });

    logger.info(`Strict date filtering: ${results.length} -> ${filtered.length} documents`);
    return filtered;
  }

  /**
   * Extract date from document metadata or URL
   */
  private extractDateFromDocument(doc: PDFDocument): Date | null {
    try {
      logger.info(`Extracting date from document: ${doc.title.substring(0, 30)}... URL: ${doc.url}`);

      // Try to extract date from arXiv URL pattern (YYMM.NNNNN format)
      const arxivMatch = doc.url.match(/\/(\d{4})\.(\d{4,5})/);
      if (arxivMatch) {
        const yearMonth = arxivMatch[1];
        const year = parseInt(yearMonth.substring(0, 2));
        const month = parseInt(yearMonth.substring(2, 4));

        // Convert YY to full year
        // arXiv started in 1991, so:
        // 91-99 = 1991-1999, 00-06 = 2000-2006, 07-99 = 2007-2099
        let fullYear: number;
        if (year >= 91) {
          fullYear = 1900 + year;  // 91-99 -> 1991-1999
        } else {
          fullYear = 2000 + year;  // 00-89 -> 2000-2089
        }

        // Use string construction to avoid timezone issues
        const dateStr = `${fullYear}-${month.toString().padStart(2, '0')}-01`;
        const extractedDate = new Date(dateStr);
        logger.info(`ArXiv date extracted: ${extractedDate.toISOString().split('T')[0]} from ${yearMonth} (year=${year}->${fullYear}, month=${month})`);
        return extractedDate;
      }

      // Try to extract date from PubMed or other URLs with year patterns
      const yearMatch = doc.url.match(/\/(\d{4})\//);
      if (yearMatch) {
        const extractedDate = new Date(parseInt(yearMatch[1]), 0);
        logger.info(`URL year extracted: ${extractedDate.toISOString().split('T')[0]}`);
        return extractedDate;
      }

      // Try to extract year from title
      const titleYearMatch = doc.title.match(/\b(19|20)\d{2}\b/);
      if (titleYearMatch) {
        const extractedDate = new Date(parseInt(titleYearMatch[0]), 0);
        logger.info(`Title year extracted: ${extractedDate.toISOString().split('T')[0]}`);
        return extractedDate;
      }

      // Try to extract date from summary or metadata if available
      if ((doc as any).summary) {
        const summaryYearMatch = (doc as any).summary.match(/\b(19|20)\d{2}\b/);
        if (summaryYearMatch) {
          const extractedDate = new Date(parseInt(summaryYearMatch[0]), 0);
          logger.info(`Summary year extracted: ${extractedDate.toISOString().split('T')[0]}`);
          return extractedDate;
        }
      }

      logger.warn(`No date pattern found for document: ${doc.title.substring(0, 30)}...`);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Error extracting date from document: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Determine if OCR should be used based on text extraction results
   */
  private shouldUseOCR(textContent: string, includeOCR: boolean, forceOCR?: boolean, debugOptions?: any): { reason: string } | false {
    if (!includeOCR) {
      return false;
    }

    // Debug options override
    if (debugOptions?.bypassTextCheck) {
      logger.info(`Bypass text check enabled - forcing OCR`);
      return { reason: 'Bypass text check enabled for debugging' };
    }

    if (debugOptions?.testGemini) {
      logger.info(`Gemini test mode enabled - forcing OCR with Gemini engine`);
      return { reason: 'Gemini test mode enabled' };
    }

    // Force OCR for testing purposes
    if (forceOCR) {
      logger.info(`Force OCR enabled - bypassing quality checks`);
      return { reason: 'Force OCR enabled for testing' };
    }

    logger.info(`Evaluating OCR need for text content (${textContent.length} chars)`);

    // No text extracted at all
    if (!textContent || textContent.trim().length === 0) {
      return { reason: 'No text extracted from PDF' };
    }

    // Very minimal text (likely a scanned document) - lowered threshold
    if (textContent.length < 500) {
      return { reason: `Minimal text extracted (${textContent.length} < 500 characters)` };
    }

    // Check for signs of poor text extraction
    const lines = textContent.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);

    // Too few lines might indicate extraction issues - lowered threshold
    if (nonEmptyLines.length < 10) {
      return { reason: `Very few text lines extracted (${nonEmptyLines.length} < 10 lines)` };
    }

    // Check for garbled text (high ratio of non-alphabetic characters) - lowered threshold
    const alphaChars = textContent.match(/[a-zA-Z]/g)?.length || 0;
    const totalChars = textContent.replace(/\s/g, '').length;
    const alphaRatio = totalChars > 0 ? alphaChars / totalChars : 0;

    if (alphaRatio < 0.6) {
      return { reason: `Text appears garbled (alphabetic ratio: ${alphaRatio.toFixed(2)} < 0.6)` };
    }

    // Check for repeated extraction artifacts
    const repeatedPatterns = textContent.match(/(.{10,})\1{3,}/g);
    if (repeatedPatterns && repeatedPatterns.length > 2) {
      return { reason: 'Detected repeated extraction artifacts' };
    }

    // Check for suspicious character patterns that indicate scanning artifacts
    const suspiciousChars = textContent.match(/[^\w\s\.\,\!\?\;\:\-\(\)\[\]\{\}\"\']/g)?.length || 0;
    const suspiciousRatio = totalChars > 0 ? suspiciousChars / totalChars : 0;

    if (suspiciousRatio > 0.1) {
      return { reason: `High suspicious character ratio: ${suspiciousRatio.toFixed(2)} > 0.1` };
    }

    // Check average word length (scanned docs often have broken words)
    const words = textContent.split(/\s+/).filter(word => word.length > 0);
    const avgWordLength = words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;

    if (avgWordLength < 3 || avgWordLength > 15) {
      return { reason: `Unusual average word length: ${avgWordLength.toFixed(1)} (expected 3-15)` };
    }

    // Check for very short lines (common in poorly extracted text)
    const shortLines = nonEmptyLines.filter(line => line.trim().length < 20).length;
    const shortLineRatio = nonEmptyLines.length > 0 ? shortLines / nonEmptyLines.length : 0;

    if (shortLineRatio > 0.7) {
      return { reason: `Too many short lines: ${shortLineRatio.toFixed(2)} > 0.7` };
    }

    logger.info(`OCR not needed: text quality appears good (${alphaRatio.toFixed(2)} alpha ratio, ${avgWordLength.toFixed(1)} avg word length)`);
    return false;
  }

  /**
   * Search IEEE Xplore for PDF documents
   */
  private async searchIEEEPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      // IEEE Xplore search using web scraping approach
      let searchQuery = `"${query}" site:ieeexplore.ieee.org filetype:pdf`;

      // Add date range filter if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`IEEE search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractIEEELinksFromSearch(html, query);

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(results, dateRange);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.warn(`Failed to search IEEE PDFs:`, error);
      return [];
    }
  }

  /**
   * Search Google Scholar for PDF documents
   */
  private async searchGoogleScholarPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      // Google Scholar search using web scraping approach
      let searchQuery = `"${query}" site:scholar.google.com OR site:arxiv.org OR site:researchgate.net filetype:pdf`;

      // Add date range filter if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Google Scholar search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractScholarLinksFromSearch(html, query);

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(results, dateRange);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.warn(`Failed to search Google Scholar PDFs:`, error);
      return [];
    }
  }

  /**
   * Search ResearchGate for PDF documents
   */
  private async searchResearchGatePDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      // ResearchGate search using web scraping approach
      let searchQuery = `"${query}" site:researchgate.net filetype:pdf`;

      // Add date range filter if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`ResearchGate search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractResearchGateLinksFromSearch(html, query);

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(results, dateRange);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.warn(`Failed to search ResearchGate PDFs:`, error);
      return [];
    }
  }

  /**
   * Search SSRN for PDF documents
   */
  private async searchSSRNPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      // SSRN search using web scraping approach
      let searchQuery = `"${query}" site:ssrn.com filetype:pdf`;

      // Add date range filter if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`SSRN search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractSSRNLinksFromSearch(html, query);

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(results, dateRange);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.warn(`Failed to search SSRN PDFs:`, error);
      return [];
    }
  }

  /**
   * Search government sources for PDF documents
   */
  private async searchGovernmentPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      // Government sources search
      let searchQuery = `"${query}" (site:gov OR site:nih.gov OR site:cdc.gov OR site:nasa.gov OR site:nist.gov OR site:energy.gov OR site:epa.gov OR site:fda.gov OR site:usda.gov OR site:treasury.gov OR site:whitehouse.gov OR site:congress.gov) filetype:pdf`;

      // Add date range filter if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Government search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractGovernmentLinksFromSearch(html, query);

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(results, dateRange);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.warn(`Failed to search government PDFs:`, error);
      return [];
    }
  }

  /**
   * Search technical documentation sources for PDF documents
   */
  private async searchTechnicalPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      // Technical documentation search
      let searchQuery = `"${query}" (site:docs.microsoft.com OR site:developer.mozilla.org OR site:docs.aws.amazon.com OR site:cloud.google.com OR site:docs.docker.com OR site:kubernetes.io OR site:github.io OR site:readthedocs.io OR "technical manual" OR "API documentation" OR "user guide" OR "installation guide") filetype:pdf`;

      // Add date range filter if provided
      if (dateRange) {
        const dateFilter = this.buildDateFilter(dateRange);
        if (dateFilter) {
          searchQuery += ` ${dateFilter}`;
        }
      }

      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Technical documentation search failed: ${response.status}`);
      }

      const html = await response.text();
      const results = this.extractTechnicalLinksFromSearch(html, query);

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(results, dateRange);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.warn(`Failed to search technical PDFs:`, error);
      return [];
    }
  }

  /**
   * Extract IEEE links from search results
   */
  private extractIEEELinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Look for IEEE Xplore PDF URLs
      const ieeeUrlPattern = /https?:\/\/ieeexplore\.ieee\.org\/[^\s"<>]+\.pdf/gi;
      const urls = html.match(ieeeUrlPattern) || [];

      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');

        results.push({
          id: `ieee-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: 'IEEE Xplore',
          relevanceScore: 0.9 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });

    } catch (error) {
      logger.warn(`Failed to extract IEEE links:`, error);
    }

    return results;
  }

  /**
   * Extract Google Scholar links from search results
   */
  private extractScholarLinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Look for academic PDF URLs from various sources
      const scholarUrlPattern = /https?:\/\/[^\s"<>]*(arxiv\.org|researchgate\.net|scholar\.google\.com|academia\.edu)[^\s"<>]*\.pdf/gi;
      const urls = html.match(scholarUrlPattern) || [];

      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');
        const domain = new URL(cleanUrl).hostname;

        results.push({
          id: `scholar-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: `Scholar (${domain})`,
          relevanceScore: 0.85 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });

    } catch (error) {
      logger.warn(`Failed to extract Scholar links:`, error);
    }

    return results;
  }

  /**
   * Extract ResearchGate links from search results
   */
  private extractResearchGateLinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Look for ResearchGate PDF URLs
      const rgUrlPattern = /https?:\/\/[^\s"<>]*researchgate\.net[^\s"<>]*\.pdf/gi;
      const urls = html.match(rgUrlPattern) || [];

      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');

        results.push({
          id: `rg-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: 'ResearchGate',
          relevanceScore: 0.8 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });

    } catch (error) {
      logger.warn(`Failed to extract ResearchGate links:`, error);
    }

    return results;
  }

  /**
   * Extract SSRN links from search results
   */
  private extractSSRNLinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Look for SSRN PDF URLs
      const ssrnUrlPattern = /https?:\/\/[^\s"<>]*ssrn\.com[^\s"<>]*\.pdf/gi;
      const urls = html.match(ssrnUrlPattern) || [];

      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');

        results.push({
          id: `ssrn-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: 'SSRN',
          relevanceScore: 0.85 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });

    } catch (error) {
      logger.warn(`Failed to extract SSRN links:`, error);
    }

    return results;
  }

  /**
   * Extract government links from search results
   */
  private extractGovernmentLinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Look for government PDF URLs
      const govUrlPattern = /https?:\/\/[^\s"<>]*\.gov[^\s"<>]*\.pdf/gi;
      const urls = html.match(govUrlPattern) || [];

      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');
        const domain = new URL(cleanUrl).hostname;

        results.push({
          id: `gov-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: `Government (${domain})`,
          relevanceScore: 0.9 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });

    } catch (error) {
      logger.warn(`Failed to extract government links:`, error);
    }

    return results;
  }

  /**
   * Extract technical documentation links from search results
   */
  private extractTechnicalLinksFromSearch(html: string, query: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Look for technical documentation PDF URLs
      const techUrlPattern = /https?:\/\/[^\s"<>]*(docs\.|developer\.|github\.io|readthedocs\.io)[^\s"<>]*\.pdf/gi;
      const urls = html.match(techUrlPattern) || [];

      urls.forEach((url, index) => {
        const cleanUrl = url.replace(/['"<>]/g, '');
        const filename = path.basename(cleanUrl, '.pdf');
        const domain = new URL(cleanUrl).hostname;

        results.push({
          id: `tech-${Date.now()}-${index}`,
          title: filename.replace(/[-_]/g, ' '),
          url: cleanUrl,
          source: `Technical (${domain})`,
          relevanceScore: 0.75 - (index * 0.1),
          downloadUrl: cleanUrl
        });
      });

    } catch (error) {
      logger.warn(`Failed to extract technical links:`, error);
    }

    return results;
  }

  /**
   * Universal PDF search engine - searches for PDFs across the entire web
   */
  private async searchUniversalPDFs(query: string, maxResults: number, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    try {
      logger.info(`Starting universal PDF search for: ${query}`);

      // Multiple search strategies for comprehensive coverage
      const searchStrategies = [
        this.searchWithFiletypePDF(query, dateRange),
        this.searchWithPDFKeywords(query, dateRange),
        this.searchWithAcademicSites(query, dateRange),
        this.searchWithCorporateSites(query, dateRange),
        this.searchWithEducationalSites(query, dateRange)
      ];

      // Execute all strategies in parallel
      const strategyResults = await Promise.allSettled(searchStrategies);

      const allResults: PDFDocument[] = [];

      strategyResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
          logger.info(`Strategy ${index + 1} found ${result.value.length} PDFs`);
        } else {
          logger.warn(`Strategy ${index + 1} failed:`, result.reason);
        }
      });

      // Remove duplicates based on URL
      const uniqueResults = this.removeDuplicatePDFs(allResults);

      // Sort by relevance score
      uniqueResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      // Apply client-side date filtering
      const filteredResults = this.filterResultsByDate(uniqueResults, dateRange);

      logger.info(`Universal search found ${filteredResults.length} unique PDFs`);

      return filteredResults.slice(0, maxResults);

    } catch (error) {
      logger.error(`Universal PDF search failed:`, error);
      return [];
    }
  }

  /**
   * Search strategy 1: Direct filetype:pdf search
   */
  private async searchWithFiletypePDF(query: string, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    let searchQuery = `"${query}" filetype:pdf`;

    if (dateRange) {
      const dateFilter = this.buildDateFilter(dateRange);
      if (dateFilter) {
        searchQuery += ` ${dateFilter}`;
      }
    }

    return this.executeUniversalSearch(searchQuery, 'filetype');
  }

  /**
   * Search strategy 2: PDF-related keywords
   */
  private async searchWithPDFKeywords(query: string, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    let searchQuery = `"${query}" ("download PDF" OR "view PDF" OR "PDF document" OR ".pdf")`;

    if (dateRange) {
      const dateFilter = this.buildDateFilter(dateRange);
      if (dateFilter) {
        searchQuery += ` ${dateFilter}`;
      }
    }

    return this.executeUniversalSearch(searchQuery, 'keywords');
  }

  /**
   * Search strategy 3: Academic and research sites
   */
  private async searchWithAcademicSites(query: string, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    let searchQuery = `"${query}" (site:edu OR site:ac.uk OR site:ac.jp OR site:uni- OR site:university OR "research paper" OR "academic paper") filetype:pdf`;

    if (dateRange) {
      const dateFilter = this.buildDateFilter(dateRange);
      if (dateFilter) {
        searchQuery += ` ${dateFilter}`;
      }
    }

    return this.executeUniversalSearch(searchQuery, 'academic');
  }

  /**
   * Search strategy 4: Corporate and industry sites
   */
  private async searchWithCorporateSites(query: string, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    let searchQuery = `"${query}" ("white paper" OR "technical report" OR "case study" OR "industry report" OR "company report") filetype:pdf`;

    if (dateRange) {
      const dateFilter = this.buildDateFilter(dateRange);
      if (dateFilter) {
        searchQuery += ` ${dateFilter}`;
      }
    }

    return this.executeUniversalSearch(searchQuery, 'corporate');
  }

  /**
   * Search strategy 5: Educational and training materials
   */
  private async searchWithEducationalSites(query: string, dateRange?: { start?: string; end?: string }): Promise<PDFDocument[]> {
    let searchQuery = `"${query}" ("course material" OR "lecture notes" OR "tutorial" OR "manual" OR "guide" OR "handbook") filetype:pdf`;

    if (dateRange) {
      const dateFilter = this.buildDateFilter(dateRange);
      if (dateFilter) {
        searchQuery += ` ${dateFilter}`;
      }
    }

    return this.executeUniversalSearch(searchQuery, 'educational');
  }

  /**
   * Execute universal search using multiple search engines
   */
  private async executeUniversalSearch(searchQuery: string, strategy: string): Promise<PDFDocument[]> {
    const results: PDFDocument[] = [];

    // Use multiple search engines for better coverage
    const searchEngines = [
      { name: 'DuckDuckGo', url: 'https://duckduckgo.com/html/' },
      { name: 'Bing', url: 'https://www.bing.com/search' },
      { name: 'Startpage', url: 'https://www.startpage.com/sp/search' }
    ];

    for (const engine of searchEngines) {
      try {
        const engineResults = await this.searchWithEngine(engine, searchQuery, strategy);
        results.push(...engineResults);
      } catch (error) {
        logger.warn(`${engine.name} search failed for strategy ${strategy}:`, error);
      }
    }

    return results;
  }

  /**
   * Search with a specific search engine
   */
  private async searchWithEngine(engine: { name: string; url: string }, searchQuery: string, strategy: string): Promise<PDFDocument[]> {
    const results: PDFDocument[] = [];

    try {
      let searchUrl: string;

      if (engine.name === 'DuckDuckGo') {
        searchUrl = `${engine.url}?q=${encodeURIComponent(searchQuery)}`;
      } else if (engine.name === 'Bing') {
        searchUrl = `${engine.url}?q=${encodeURIComponent(searchQuery)}`;
      } else if (engine.name === 'Startpage') {
        searchUrl = `${engine.url}?query=${encodeURIComponent(searchQuery)}`;
      } else {
        throw new Error(`Unsupported search engine: ${engine.name}`);
      }

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        throw new Error(`${engine.name} search failed: ${response.status}`);
      }

      const html = await response.text();
      const extractedResults = this.extractUniversalPDFLinks(html, searchQuery, engine.name, strategy);

      results.push(...extractedResults);

    } catch (error) {
      logger.warn(`Failed to search with ${engine.name}:`, error);
    }

    return results;
  }

  /**
   * Extract PDF links from universal search results
   */
  private extractUniversalPDFLinks(html: string, query: string, engineName: string, strategy: string): PDFDocument[] {
    const results: PDFDocument[] = [];

    try {
      // Enhanced PDF URL pattern to catch more variations
      const pdfUrlPatterns = [
        /https?:\/\/[^\s"<>]+\.pdf(?:\?[^\s"<>]*)?/gi,
        /https?:\/\/[^\s"<>]*\/[^\s"<>]*\.pdf(?:\?[^\s"<>]*)?/gi,
        /https?:\/\/[^\s"<>]*download[^\s"<>]*\.pdf/gi,
        /https?:\/\/[^\s"<>]*file[^\s"<>]*\.pdf/gi,
        /https?:\/\/[^\s"<>]*document[^\s"<>]*\.pdf/gi
      ];

      const allUrls = new Set<string>();

      pdfUrlPatterns.forEach(pattern => {
        const matches = html.match(pattern) || [];
        matches.forEach(url => {
          const cleanUrl = url.replace(/['"<>]/g, '').trim();
          if (cleanUrl.length > 10 && this.isValidPDFUrl(cleanUrl)) {
            allUrls.add(cleanUrl);
          }
        });
      });

      Array.from(allUrls).forEach((url, index) => {
        try {
          const urlObj = new URL(url);
          const filename = path.basename(urlObj.pathname, '.pdf') || `document-${index}`;
          const domain = urlObj.hostname;

          // Calculate relevance score based on strategy and position
          let relevanceScore = 0.7 - (index * 0.05);

          // Boost score based on strategy match
          if (strategy === 'filetype' && url.includes('.pdf')) relevanceScore += 0.2;
          if (strategy === 'academic' && (domain.includes('edu') || domain.includes('ac.'))) relevanceScore += 0.15;
          if (strategy === 'corporate' && url.toLowerCase().includes('whitepaper')) relevanceScore += 0.1;
          if (strategy === 'educational' && (url.toLowerCase().includes('tutorial') || url.toLowerCase().includes('guide'))) relevanceScore += 0.1;

          results.push({
            id: `universal-${engineName.toLowerCase()}-${Date.now()}-${index}`,
            title: this.generateTitleFromUrl(filename, url, query),
            url: url,
            source: `Universal (${engineName})`,
            relevanceScore: Math.min(relevanceScore, 1.0),
            downloadUrl: url,
            metadata: {
              searchEngine: engineName,
              strategy: strategy,
              domain: domain
            }
          });

        } catch (error) {
          logger.warn(`Failed to process URL ${url}:`, error);
        }
      });

    } catch (error) {
      logger.warn(`Failed to extract universal PDF links:`, error);
    }

    return results;
  }

  /**
   * Validate if a URL is likely to be a valid PDF
   */
  private isValidPDFUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Check if URL ends with .pdf
      if (urlObj.pathname.toLowerCase().endsWith('.pdf')) {
        return true;
      }

      // Check for PDF-related parameters
      if (urlObj.searchParams.has('pdf') ||
          urlObj.searchParams.get('format') === 'pdf' ||
          urlObj.searchParams.get('type') === 'pdf') {
        return true;
      }

      // Check for PDF-related path segments
      const pathSegments = urlObj.pathname.toLowerCase().split('/');
      if (pathSegments.some(segment => segment.includes('pdf') || segment.includes('download') || segment.includes('file'))) {
        return true;
      }

      return false;

    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a meaningful title from URL and context
   */
  private generateTitleFromUrl(filename: string, url: string, query: string): string {
    try {
      // Clean up filename
      let title = filename.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

      // If title is too generic, try to extract from URL path
      if (title.length < 3 || /^(document|file|download|pdf)\d*$/i.test(title)) {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

        // Try to find a meaningful part
        for (let i = pathParts.length - 2; i >= 0; i--) {
          const part = pathParts[i].replace(/[-_]/g, ' ').trim();
          if (part.length > 3 && !/^\d+$/.test(part)) {
            title = part;
            break;
          }
        }
      }

      // If still generic, use query context
      if (title.length < 3) {
        title = `${query} - Document`;
      }

      // Capitalize first letter of each word
      title = title.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return title;

    } catch (error) {
      return `${query} - PDF Document`;
    }
  }

}
