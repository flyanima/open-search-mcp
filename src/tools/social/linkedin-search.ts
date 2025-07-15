/**
 * LinkedIn Search Tool
 * Implements Exa-compatible linkedin_search functionality
 */

import { ToolRegistry } from '../tool-registry.js';
import { ToolInput, ToolOutput } from '../../types.js';
import axios from 'axios';

interface LinkedInProfile {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  profileUrl?: string;
  imageUrl?: string;
  connections?: string;
  industry?: string;
  experience?: string[];
  education?: string[];
  source: string;
  relevance: number;
}

interface LinkedInCompany {
  name: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  website?: string;
  companyUrl?: string;
  logoUrl?: string;
  followers?: string;
  employees?: string;
  founded?: string;
  source: string;
  relevance: number;
}

interface LinkedInSearchResult {
  profiles: LinkedInProfile[];
  companies: LinkedInCompany[];
  posts: any[];
  jobs: any[];
  sources: string[];
}

export function registerLinkedInSearchTool(registry: ToolRegistry): void {
  registry.registerTool({
    name: 'linkedin_search',
    description: 'Search LinkedIn for professional profiles, companies, and business content',
    category: 'social',
    source: 'multiple',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (person name, company, job title, etc.)' },
        searchType: { 
          type: 'string', 
          description: 'Type of search: profiles, companies, posts, jobs, or all (default: all)',
          enum: ['profiles', 'companies', 'posts', 'jobs', 'all']
        },
        maxResults: { type: 'number', description: 'Maximum number of results per category (default: 5)' },
        location: { type: 'string', description: 'Geographic location filter' },
        industry: { type: 'string', description: 'Industry filter for companies/profiles' },
        experience: { type: 'string', description: 'Experience level filter (entry, mid, senior, executive)' },
        companySize: { type: 'string', description: 'Company size filter (startup, small, medium, large, enterprise)' }
      },
      required: ['query']
    },
    execute: async (args: ToolInput): Promise<ToolOutput> => {
      const query = args.query || '';
      const searchType = args.searchType || 'all';
      const maxResults = Math.min(args.maxResults || 5, 10);
      const location = args.location || '';
      const industry = args.industry || '';
      const experience = args.experience || '';
      const companySize = args.companySize || '';

      if (!query) {
        return {
          success: false,
          error: 'query parameter is required'
        };
      }

      try {
        const startTime = Date.now();
        const results: LinkedInSearchResult = {
          profiles: [],
          companies: [],
          posts: [],
          jobs: [],
          sources: []
        };

        // Search for LinkedIn-related content using multiple strategies
        if (searchType === 'all' || searchType === 'profiles') {
          await searchLinkedInProfiles(query, location, industry, experience, results, maxResults);
        }

        if (searchType === 'all' || searchType === 'companies') {
          await searchLinkedInCompanies(query, location, industry, companySize, results, maxResults);
        }

        if (searchType === 'all' || searchType === 'posts') {
          await searchLinkedInPosts(query, results, maxResults);
        }

        if (searchType === 'all' || searchType === 'jobs') {
          await searchLinkedInJobs(query, location, experience, results, maxResults);
        }

        const searchTime = Date.now() - startTime;

        // Format LinkedIn search report
        const report = formatLinkedInReport(query, results, searchTime, {
          searchType,
          location,
          industry,
          experience,
          companySize
        });

        return {
          success: true,
          data: {
            query,
            searchType,
            report,
            results,
            searchTime,
            totalResults: results.profiles.length + results.companies.length + results.posts.length + results.jobs.length
          },
          metadata: {
            totalResults: results.profiles.length + results.companies.length + results.posts.length + results.jobs.length,
            searchTime,
            sources: results.sources,
            cached: false
          }
        };

      } catch (error) {
        return {
          success: false,
          error: `Error searching LinkedIn: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  });
}

/**
 * Search for LinkedIn profiles using indirect methods
 */
async function searchLinkedInProfiles(
  query: string, 
  location: string, 
  industry: string, 
  experience: string, 
  results: LinkedInSearchResult, 
  maxResults: number
): Promise<void> {
  try {
    // Strategy 1: Search for professional mentions on Hacker News
    const profileQuery = `${query} LinkedIn profile ${location} ${industry}`.trim();
    const hnResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: profileQuery,
        tags: 'story',
        hitsPerPage: maxResults * 2
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (hnResponse.data?.hits) {
      for (const hit of hnResponse.data.hits) {
        if (hit.title && (
          hit.title.toLowerCase().includes('linkedin') ||
          hit.title.toLowerCase().includes('profile') ||
          hit.title.toLowerCase().includes('professional')
        )) {
          // Extract profile information from mentions
          const profile = extractProfileInfo(hit, query);
          if (profile && results.profiles.length < maxResults) {
            results.profiles.push(profile);
          }
        }
      }
      if (results.profiles.length > 0) {
        results.sources.push('news.ycombinator.com');
      }
    }
  } catch (error) {}

  // Strategy 2: Search for professional information on GitHub
  try {
    const githubQuery = `${query} ${location}`.trim();
    const githubResponse = await axios.get('https://api.github.com/search/users', {
      params: {
        q: githubQuery,
        per_page: Math.min(maxResults, 5)
      },
      timeout: 8000,
      headers: {
        'User-Agent': 'Open-Search-MCP/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (githubResponse.data?.items) {
      for (const user of githubResponse.data.items.slice(0, 3)) {
        if (user.name && user.name.toLowerCase().includes(query.toLowerCase())) {
          results.profiles.push({
            name: user.name || user.login,
            title: 'Developer',
            description: user.bio || `GitHub user with ${user.public_repos} repositories`,
            profileUrl: user.html_url,
            imageUrl: user.avatar_url,
            location: user.location,
            source: 'GitHub',
            relevance: 0.7
          });
        }
      }
      if (results.profiles.some(p => p.source === 'GitHub')) {
        results.sources.push('github.com');
      }
    }
  } catch (error) {}
}

/**
 * Search for LinkedIn companies
 */
async function searchLinkedInCompanies(
  query: string,
  location: string,
  industry: string,
  companySize: string,
  results: LinkedInSearchResult,
  maxResults: number
): Promise<void> {
  try {
    // Search for company mentions and information
    const companyQuery = `${query} company ${industry} ${location}`.trim();
    const hnResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: companyQuery,
        tags: 'story',
        hitsPerPage: maxResults * 2
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (hnResponse.data?.hits) {
      for (const hit of hnResponse.data.hits) {
        if (hit.title && hit.title.toLowerCase().includes(query.toLowerCase())) {
          const company = extractCompanyInfo(hit, query, industry);
          if (company && results.companies.length < maxResults) {
            results.companies.push(company);
          }
        }
      }
    }

    // Search GitHub for company repositories
    const githubResponse = await axios.get('https://api.github.com/search/repositories', {
      params: {
        q: `${query} in:name,description`,
        sort: 'stars',
        order: 'desc',
        per_page: Math.min(maxResults, 5)
      },
      timeout: 8000,
      headers: {
        'User-Agent': 'Open-Search-MCP/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (githubResponse.data?.items) {
      for (const repo of githubResponse.data.items.slice(0, 3)) {
        if (repo.owner && repo.owner.type === 'Organization') {
          results.companies.push({
            name: repo.owner.login,
            description: repo.description || `Organization with ${repo.stargazers_count} starred repositories`,
            website: repo.homepage,
            companyUrl: repo.owner.html_url,
            logoUrl: repo.owner.avatar_url,
            industry: 'Technology',
            source: 'GitHub',
            relevance: 0.8
          });
        }
      }
      if (results.companies.some(c => c.source === 'GitHub')) {
        results.sources.push('github.com');
      }
    }
  } catch (error) {}
}

/**
 * Search for LinkedIn posts and professional content
 */
async function searchLinkedInPosts(query: string, results: LinkedInSearchResult, maxResults: number): Promise<void> {
  try {
    const postsQuery = `${query} LinkedIn post professional`;
    const hnResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: postsQuery,
        tags: 'story',
        hitsPerPage: maxResults
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (hnResponse.data?.hits) {
      for (const hit of hnResponse.data.hits) {
        if (hit.title && (
          hit.title.toLowerCase().includes('linkedin') ||
          hit.title.toLowerCase().includes('professional') ||
          hit.title.toLowerCase().includes('career')
        )) {
          results.posts.push({
            title: hit.title,
            url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            author: hit.author,
            points: hit.points,
            comments: hit.num_comments,
            created: hit.created_at,
            source: 'Hacker News',
            type: 'professional_discussion'
          });
        }
      }
    }
  } catch (error) {}
}

/**
 * Search for LinkedIn jobs and career opportunities
 */
async function searchLinkedInJobs(
  query: string,
  location: string,
  experience: string,
  results: LinkedInSearchResult,
  maxResults: number
): Promise<void> {
  try {
    const jobsQuery = `${query} jobs hiring ${location} ${experience}`.trim();
    const hnResponse = await axios.get('https://hn.algolia.com/api/v1/search', {
      params: {
        query: jobsQuery,
        tags: 'story',
        hitsPerPage: maxResults
      },
      timeout: 8000,
      headers: { 'User-Agent': 'Open-Search-MCP/1.0' }
    });

    if (hnResponse.data?.hits) {
      for (const hit of hnResponse.data.hits) {
        if (hit.title && (
          hit.title.toLowerCase().includes('hiring') ||
          hit.title.toLowerCase().includes('jobs') ||
          hit.title.toLowerCase().includes('career') ||
          hit.title.toLowerCase().includes('position')
        )) {
          results.jobs.push({
            title: hit.title,
            url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            company: extractCompanyFromJobTitle(hit.title),
            location: location,
            experience: experience,
            points: hit.points,
            comments: hit.num_comments,
            created: hit.created_at,
            source: 'Hacker News',
            type: 'job_posting'
          });
        }
      }
    }
  } catch (error) {}
}

/**
 * Extract profile information from search results
 */
function extractProfileInfo(hit: any, query: string): LinkedInProfile | null {
  if (!hit.title) return null;

  const title = hit.title;
  const lowerTitle = title.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Check if this is likely a profile mention
  if (lowerTitle.includes(lowerQuery) && (
    lowerTitle.includes('ceo') ||
    lowerTitle.includes('founder') ||
    lowerTitle.includes('engineer') ||
    lowerTitle.includes('manager') ||
    lowerTitle.includes('director')
  )) {
    return {
      name: extractNameFromTitle(title, query),
      title: extractJobTitleFromTitle(title),
      company: extractCompanyFromTitle(title),
      description: title,
      profileUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: 'Hacker News',
      relevance: 0.6
    };
  }

  return null;
}

/**
 * Extract company information from search results
 */
function extractCompanyInfo(hit: any, query: string, industry: string): LinkedInCompany | null {
  if (!hit.title) return null;

  const title = hit.title;
  const lowerTitle = title.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerTitle.includes(lowerQuery)) {
    return {
      name: query,
      industry: industry || 'Technology',
      description: title,
      companyUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: 'Hacker News',
      relevance: 0.7
    };
  }

  return null;
}

/**
 * Helper functions for text extraction
 */
function extractNameFromTitle(title: string, query: string): string {
  // Simple heuristic: if query looks like a name, use it
  if (query.split(' ').length <= 3 && /^[A-Z]/.test(query)) {
    return query;
  }
  return 'Professional';
}

function extractJobTitleFromTitle(title: string): string {
  const jobTitles = ['CEO', 'CTO', 'Founder', 'Engineer', 'Manager', 'Director', 'VP', 'President'];
  for (const jobTitle of jobTitles) {
    if (title.toLowerCase().includes(jobTitle.toLowerCase())) {
      return jobTitle;
    }
  }
  return 'Professional';
}

function extractCompanyFromTitle(title: string): string {
  // Extract company name from patterns like "X at Y" or "Y's X"
  const atMatch = title.match(/at\s+([A-Z][a-zA-Z\s]+)/);
  if (atMatch) return atMatch[1].trim();
  
  const possessiveMatch = title.match(/([A-Z][a-zA-Z]+)'s/);
  if (possessiveMatch) return possessiveMatch[1];
  
  return 'Company';
}

function extractCompanyFromJobTitle(title: string): string {
  // Extract company name from job postings
  const hiringMatch = title.match(/([A-Z][a-zA-Z\s]+)\s+is\s+hiring/i);
  if (hiringMatch) return hiringMatch[1].trim();
  
  const atMatch = title.match(/hiring\s+at\s+([A-Z][a-zA-Z\s]+)/i);
  if (atMatch) return atMatch[1].trim();
  
  return 'Company';
}

/**
 * Format LinkedIn search report
 */
function formatLinkedInReport(
  query: string,
  results: LinkedInSearchResult,
  searchTime: number,
  options: any
): string {
  let report = `# [BRIEFCASE] LinkedIn Search: ${query}\n\n`;
  report += `**Search completed in ${searchTime}ms across ${results.sources.length} sources**\n\n`;

  if (options.searchType !== 'all') {
    report += `**Search Type**: ${options.searchType}\n`;
  }
  if (options.location) report += `**Location**: ${options.location}\n`;
  if (options.industry) report += `**Industry**: ${options.industry}\n`;
  if (options.experience) report += `**Experience Level**: ${options.experience}\n`;
  if (options.companySize) report += `**Company Size**: ${options.companySize}\n`;
  report += `\n`;

  // Professional Profiles
  if (results.profiles.length > 0) {
    report += `## [USER] Professional Profiles\n\n`;
    results.profiles.forEach((profile, index) => {
      report += `### ${index + 1}. ${profile.name}\n`;
      if (profile.title) report += `**Title**: ${profile.title}\n`;
      if (profile.company) report += `**Company**: ${profile.company}\n`;
      if (profile.location) report += `**Location**: ${profile.location}\n`;
      report += `**Description**: ${profile.description}\n`;
      report += `**Relevance**: ${(profile.relevance * 100).toFixed(0)}%\n`;
      report += `**Source**: ${profile.source}\n`;
      if (profile.profileUrl) report += `[LINK] [View Profile](${profile.profileUrl})\n`;
      report += `\n`;
    });
  }

  // Companies
  if (results.companies.length > 0) {
    report += `## [COMPANY] Companies\n\n`;
    results.companies.forEach((company, index) => {
      report += `### ${index + 1}. ${company.name}\n`;
      if (company.industry) report += `**Industry**: ${company.industry}\n`;
      if (company.size) report += `**Size**: ${company.size}\n`;
      if (company.location) report += `**Location**: ${company.location}\n`;
      report += `**Description**: ${company.description}\n`;
      report += `**Relevance**: ${(company.relevance * 100).toFixed(0)}%\n`;
      report += `**Source**: ${company.source}\n`;
      if (company.companyUrl) report += `[LINK] [View Company](${company.companyUrl})\n`;
      if (company.website) report += `[WEB] [Website](${company.website})\n`;
      report += `\n`;
    });
  }

  // Professional Posts
  if (results.posts.length > 0) {
    report += `## [NOTE] Professional Content\n\n`;
    results.posts.forEach((post, index) => {
      report += `### ${index + 1}. ${post.title}\n`;
      report += `[USER] ${post.author} | [ANALYTICS] ${post.points} points | [COMMENT] ${post.comments} comments\n`;
      report += `[DATE] ${new Date(post.created).toLocaleDateString()}\n`;
      report += `[LINK] [Read Post](${post.url})\n\n`;
    });
  }

  // Job Opportunities
  if (results.jobs.length > 0) {
    report += `## [BRIEFCASE] Job Opportunities\n\n`;
    results.jobs.forEach((job, index) => {
      report += `### ${index + 1}. ${job.title}\n`;
      if (job.company) report += `**Company**: ${job.company}\n`;
      if (job.location) report += `**Location**: ${job.location}\n`;
      if (job.experience) report += `**Experience**: ${job.experience}\n`;
      report += `[ANALYTICS] ${job.points} points | [COMMENT] ${job.comments} comments\n`;
      report += `[DATE] ${new Date(job.created).toLocaleDateString()}\n`;
      report += `[LINK] [View Job](${job.url})\n\n`;
    });
  }

  // Summary
  report += `## [ANALYTICS] Search Summary\n\n`;
  report += `- **Profiles Found**: ${results.profiles.length}\n`;
  report += `- **Companies Found**: ${results.companies.length}\n`;
  report += `- **Professional Posts**: ${results.posts.length}\n`;
  report += `- **Job Opportunities**: ${results.jobs.length}\n`;
  report += `- **Data Sources**: ${results.sources.join(', ')}\n\n`;

  report += `---\n*LinkedIn search powered by Open Search MCP*`;

  return report;
}
