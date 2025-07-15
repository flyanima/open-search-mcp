/**
 * Competitor Finder Tool
 * Implements Exa-compatible competitor_finder functionality
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';

interface CompetitorInfo {
  name: string;
  description: string;
  website?: string;
  industry?: string;
  size?: string;
  funding?: string;
  similarity: number;
  source: string;
  url: string;
}

interface CompetitorAnalysis {
  directCompetitors: CompetitorInfo[];
  indirectCompetitors: CompetitorInfo[];
  marketAnalysis: any[];
  industryTrends: any[];
  sources: string[];
}

export function registerCompetitorFinderTool(registry: ToolRegistry): void {
  registry.registerTool({
    name: 'competitor_finder',
    description: 'Find and analyze competitors for a given company, including direct and indirect competitors',
    category: 'company',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company name to find competitors for' },
        industry: { type: 'string', description: 'Industry sector (optional, helps narrow search)' },
        includeIndirect: { type: 'boolean', description: 'Include indirect competitors (default: true)' },
        maxResults: { type: 'number', description: 'Maximum number of competitors to find (default: 10)' },
        region: { type: 'string', description: 'Geographic region to focus on (global, us, eu, asia, etc.)' },
        companySize: { type: 'string', description: 'Company size filter (startup, small, medium, large, enterprise)' }
      },
      required: ['companyName']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const companyName = args.companyName || '';
      const industry = args.industry || '';
      const includeIndirect = args.includeIndirect !== false;
      const maxResults = Math.min(args.maxResults || 10, 20);
      const region = args.region || 'global';
      const companySize = args.companySize || '';

      if (!companyName) {
        return {
          success: false,
          error: 'companyName parameter is required'
        };
      }

      try {
        const startTime = Date.now();
        const analysis: CompetitorAnalysis = {
          directCompetitors: [],
          indirectCompetitors: [],
          marketAnalysis: [],
          industryTrends: [],
          sources: []
        };

        // 1. Search for direct competitors
        await findDirectCompetitors(companyName, industry, analysis, maxResults);

        // 2. Search for indirect competitors (if requested)
        if (includeIndirect) {
          await findIndirectCompetitors(companyName, industry, analysis, maxResults);
        }

        // 3. Gather market analysis data
        await gatherMarketAnalysis(companyName, industry, analysis);

        // 4. Find industry trends
        await findIndustryTrends(companyName, industry, analysis);

        const searchTime = Date.now() - startTime;

        // Format competitor analysis report
        const report = formatCompetitorReport(companyName, analysis, searchTime, {
          industry,
          includeIndirect,
          region,
          companySize
        });

        return {
          success: true,
          data: {
            companyName,
            industry,
            report,
            analysis,
            searchTime,
            totalCompetitors: analysis.directCompetitors.length + analysis.indirectCompetitors.length
          },
          metadata: {
            totalResults: analysis.directCompetitors.length + analysis.indirectCompetitors.length,
            searchTime,
            sources: analysis.sources,
            cached: false
          }
        };

      } catch (error) {
        return {
          success: false,
          error: `Error finding competitors: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  });
}

/**
 * Find direct competitors using multiple search strategies
 */
async function findDirectCompetitors(companyName: string, industry: string, analysis: CompetitorAnalysis, maxResults: number): Promise<void> {
  // Strategy 1: Search for "X vs Y" comparisons
  try {
    const vsQuery = `${companyName} vs competitors alternative`;
    const hnResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: vsQuery,
        tags: 'story',
        hitsPerPage: maxResults
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (hnResponse.data?.hits) {
      for (const hit of hnResponse.data.hits) {
        if (hit.title && (hit.title.toLowerCase().includes(' vs ') || hit.title.toLowerCase().includes('alternative'))) {
          // Extract competitor names from titles like "X vs Y" or "Alternatives to X"
          const competitors = extractCompetitorNames(hit.title, companyName);
          
          for (const competitor of competitors) {
            if (!analysis.directCompetitors.find(c => c.name.toLowerCase() === competitor.toLowerCase())) {
              analysis.directCompetitors.push({
                name: competitor,
                description: hit.title,
                similarity: 0.8, // High similarity for direct mentions
                source: 'Hacker News',
                url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`
              });
            }
          }
        }
      }
      if (analysis.directCompetitors.length > 0) {
        analysis.sources.push('news.ycombinator.com');
      }
    }
  } catch (error) {}

  // Strategy 2: Search for industry-specific competitors
  if (industry) {
    try {
      const industryQuery = `${industry} companies like ${companyName}`;
      const searchResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
        params: {
          query: industryQuery,
          tags: 'story',
          hitsPerPage: maxResults
        },
        timeout: 8000,
        headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
      });

      if (searchResponse.data?.hits) {
        for (const hit of searchResponse.data.hits.slice(0, 5)) {
          if (hit.title && !hit.title.toLowerCase().includes(companyName.toLowerCase())) {
            // Extract potential competitor names from industry discussions
            const potentialCompetitors = extractCompanyNamesFromText(hit.title);
            
            for (const competitor of potentialCompetitors.slice(0, 2)) {
              if (!analysis.directCompetitors.find(c => c.name.toLowerCase() === competitor.toLowerCase()) &&
                  !analysis.indirectCompetitors.find(c => c.name.toLowerCase() === competitor.toLowerCase())) {
                analysis.directCompetitors.push({
                  name: competitor,
                  description: `Industry competitor mentioned in: ${hit.title}`,
                  industry,
                  similarity: 0.7,
                  source: 'Hacker News',
                  url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`
                });
              }
            }
          }
        }
      }
    } catch (error) {}
  }
}

/**
 * Find indirect competitors and market alternatives
 */
async function findIndirectCompetitors(companyName: string, industry: string, analysis: CompetitorAnalysis, maxResults: number): Promise<void> {
  try {
    const alternativeQuery = `alternatives to ${companyName} similar tools`;
    const response = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: alternativeQuery,
        tags: 'story',
        hitsPerPage: maxResults
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (response.data?.hits) {
      for (const hit of response.data.hits) {
        if (hit.title && (
          hit.title.toLowerCase().includes('alternative') ||
          hit.title.toLowerCase().includes('similar') ||
          hit.title.toLowerCase().includes('replacement')
        )) {
          const alternatives = extractCompetitorNames(hit.title, companyName);
          
          for (const alternative of alternatives) {
            if (!analysis.directCompetitors.find(c => c.name.toLowerCase() === alternative.toLowerCase()) &&
                !analysis.indirectCompetitors.find(c => c.name.toLowerCase() === alternative.toLowerCase())) {
              analysis.indirectCompetitors.push({
                name: alternative,
                description: `Alternative solution: ${hit.title}`,
                similarity: 0.6, // Lower similarity for indirect competitors
                source: 'Hacker News',
                url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`
              });
            }
          }
        }
      }
    }
  } catch (error) {}
}

/**
 * Gather market analysis data
 */
async function gatherMarketAnalysis(companyName: string, industry: string, analysis: CompetitorAnalysis): Promise<void> {
  try {
    const marketQuery = `${companyName} market analysis competition`;
    const response = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: marketQuery,
        tags: 'story',
        hitsPerPage: 5
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (response.data?.hits) {
      for (const hit of response.data.hits) {
        if (hit.title && (
          hit.title.toLowerCase().includes('market') ||
          hit.title.toLowerCase().includes('analysis') ||
          hit.title.toLowerCase().includes('competition')
        )) {
          analysis.marketAnalysis.push({
            title: hit.title,
            url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            points: hit.points,
            comments: hit.num_comments,
            created: hit.created_at,
            source: 'Hacker News'
          });
        }
      }
    }
  } catch (error) {}
}

/**
 * Find industry trends
 */
async function findIndustryTrends(companyName: string, industry: string, analysis: CompetitorAnalysis): Promise<void> {
  if (!industry) return;

  try {
    const trendsQuery = `${industry} trends 2024 2025`;
    const response = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: trendsQuery,
        tags: 'story',
        hitsPerPage: 5
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (response.data?.hits) {
      for (const hit of response.data.hits) {
        if (hit.title && hit.title.toLowerCase().includes('trend')) {
          analysis.industryTrends.push({
            title: hit.title,
            url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            points: hit.points,
            comments: hit.num_comments,
            created: hit.created_at,
            source: 'Hacker News'
          });
        }
      }
    }
  } catch (error) {}
}

/**
 * Extract competitor names from comparison titles
 */
function extractCompetitorNames(title: string, originalCompany: string): string[] {
  const competitors: string[] = [];
  const lowerTitle = title.toLowerCase();
  const lowerCompany = originalCompany.toLowerCase();

  // Pattern: "X vs Y"
  const vsMatch = lowerTitle.match(/(.+?)\s+vs\s+(.+)/);
  if (vsMatch) {
    const [, company1, company2] = vsMatch;
    if (!company1.includes(lowerCompany)) competitors.push(company1.trim());
    if (!company2.includes(lowerCompany)) competitors.push(company2.trim());
  }

  // Pattern: "Alternatives to X"
  const altMatch = lowerTitle.match(/alternatives?\s+to\s+(.+)/);
  if (altMatch && !altMatch[1].includes(lowerCompany)) {
    // Extract company names from the rest of the title
    const restOfTitle = title.substring(altMatch.index! + altMatch[0].length);
    const extractedNames = extractCompanyNamesFromText(restOfTitle);
    competitors.push(...extractedNames);
  }

  return competitors.filter(name => name.length > 2 && name.length < 50);
}

/**
 * Extract potential company names from text
 */
function extractCompanyNamesFromText(text: string): string[] {
  // Simple heuristic: look for capitalized words that could be company names
  const words = text.split(/\s+/);
  const potentialNames: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w]/g, '');
    if (word.length > 2 && /^[A-Z]/.test(word)) {
      // Check if it's followed by another capitalized word (compound names)
      if (i + 1 < words.length && /^[A-Z]/.test(words[i + 1])) {
        potentialNames.push(`${word} ${words[i + 1].replace(/[^\w]/g, '')}`);
        i++; // Skip next word
      } else {
        potentialNames.push(word);
      }
    }
  }

  return potentialNames.slice(0, 5); // Limit to avoid noise
}

/**
 * Format competitor analysis report
 */
function formatCompetitorReport(
  companyName: string,
  analysis: CompetitorAnalysis,
  searchTime: number,
  options: any
): string {
  let report = `# [TROPHY] Competitor Analysis: ${companyName}\n\n`;
  report += `**Analysis completed in ${searchTime}ms across ${analysis.sources.length} sources**\n\n`;

  if (options.industry) {
    report += `**Industry**: ${options.industry}\n\n`;
  }

  // Direct Competitors
  if (analysis.directCompetitors.length > 0) {
    report += `## Direct Competitors\n\n`;
    analysis.directCompetitors.forEach((competitor, index) => {
      report += `### ${index + 1}. ${competitor.name}\n`;
      report += `**Similarity**: ${(competitor.similarity * 100).toFixed(0)}%\n`;
      report += `**Description**: ${competitor.description}\n`;
      if (competitor.industry) report += `**Industry**: ${competitor.industry}\n`;
      report += `**Source**: ${competitor.source}\n`;
      report += `[LINK] [Learn More](${competitor.url})\n\n`;
    });
  }

  // Indirect Competitors
  if (analysis.indirectCompetitors.length > 0) {
    report += `## [REFRESH] Indirect Competitors & Alternatives\n\n`;
    analysis.indirectCompetitors.forEach((competitor, index) => {
      report += `### ${index + 1}. ${competitor.name}\n`;
      report += `**Similarity**: ${(competitor.similarity * 100).toFixed(0)}%\n`;
      report += `**Description**: ${competitor.description}\n`;
      report += `**Source**: ${competitor.source}\n`;
      report += `[LINK] [Learn More](${competitor.url})\n\n`;
    });
  }

  // Market Analysis
  if (analysis.marketAnalysis.length > 0) {
    report += `## [ANALYTICS] Market Analysis\n\n`;
    analysis.marketAnalysis.forEach(item => {
      report += `### ${item.title}\n`;
      report += `[ANALYTICS] ${item.points} points | [COMMENT] ${item.comments} comments\n`;
      report += `[LINK] [Read Analysis](${item.url})\n\n`;
    });
  }

  // Industry Trends
  if (analysis.industryTrends.length > 0) {
    report += `## [TRENDING] Industry Trends\n\n`;
    analysis.industryTrends.forEach(trend => {
      report += `### ${trend.title}\n`;
      report += `[ANALYTICS] ${trend.points} points | [COMMENT] ${trend.comments} comments\n`;
      report += `[LINK] [Read Trend](${trend.url})\n\n`;
    });
  }

  // Summary
  report += `## [CLIPBOARD] Analysis Summary\n\n`;
  report += `- **Direct Competitors Found**: ${analysis.directCompetitors.length}\n`;
  report += `- **Indirect Competitors Found**: ${analysis.indirectCompetitors.length}\n`;
  report += `- **Market Analysis Articles**: ${analysis.marketAnalysis.length}\n`;
  report += `- **Industry Trend Articles**: ${analysis.industryTrends.length}\n`;
  report += `- **Data Sources**: ${analysis.sources.join(', ')}\n\n`;

  report += `---\n*Competitor analysis powered by Open Search MCP*`;

  return report;
}
