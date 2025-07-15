import { ToolInput, ToolOutput } from '../../types.js';
import { Logger } from '../../utils/logger.js';

/**
 * Dev.to 标签搜索工具
 * 搜索和浏览Dev.to平台上的技术标签和话题
 */

const logger = new Logger('DevtoTagSearch');

export async function devtoTagSearch(args: ToolInput): Promise<ToolOutput> {
  try {
    const query = args.query || args.tag || '';
    const maxResults = Math.min(args.max_results || 20, 100);
    
    logger.info(`Searching Dev.to tags: "${query}"`);
    
    // Dev.to doesn't have a direct tag search API, but we can get popular tags
    // and filter them, or get articles by tag
    
    if (query) {
      // Search for articles with the specific tag to validate it exists
      const articlesResponse = await fetch(`https://dev.to/api/articles?tag=${encodeURIComponent(query)}&per_page=5`, {
        headers: {
          'User-Agent': 'OpenSearchMCP/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (!articlesResponse.ok) {
        throw new Error(`Dev.to API error: ${articlesResponse.status} ${articlesResponse.statusText}`);
      }
      
      const articles = await articlesResponse.json();
      
      if (articles.length > 0) {
        // Extract tag information from articles
        const tagStats = new Map();
        
        articles.forEach((article: any) => {
          if (article.tag_list) {
            article.tag_list.forEach((tag: string) => {
              const tagLower = tag.toLowerCase();
              if (tagLower.includes(query.toLowerCase())) {
                if (!tagStats.has(tag)) {
                  tagStats.set(tag, {
                    name: tag,
                    article_count: 0,
                    recent_articles: []
                  });
                }
                const tagData = tagStats.get(tag);
                tagData.article_count++;
                if (tagData.recent_articles.length < 3) {
                  tagData.recent_articles.push({
                    title: article.title,
                    url: article.url || `https://dev.to${article.path}`,
                    author: article.user?.name || 'Unknown',
                    published_at: article.published_at
                  });
                }
              }
            });
          }
        });
        
        const results = Array.from(tagStats.values()).map(tag => ({
          ...tag,
          url: `https://dev.to/t/${tag.name.toLowerCase()}`,
          description: `Tag with ${tag.article_count}+ articles on Dev.to`,
          color: generateTagColor(tag.name),
          bg_color: generateTagBgColor(tag.name)
        }));
        
        return {
          success: true,
          data: {
            results,
            total: results.length,
            query,
            summary: `Found ${results.length} tag${results.length === 1 ? '' : 's'} matching "${query}" on Dev.to`,
            source: 'dev.to',
            timestamp: new Date().toISOString()
          }
        };
      }
    }
    
    // If no specific query or no results, return popular/trending tags
    const popularTags = [
      { name: 'javascript', description: 'JavaScript programming language', article_count: '50000+' },
      { name: 'react', description: 'React JavaScript library', article_count: '25000+' },
      { name: 'python', description: 'Python programming language', article_count: '20000+' },
      { name: 'webdev', description: 'Web development', article_count: '30000+' },
      { name: 'tutorial', description: 'Programming tutorials', article_count: '15000+' },
      { name: 'beginners', description: 'Content for beginners', article_count: '12000+' },
      { name: 'node', description: 'Node.js runtime', article_count: '8000+' },
      { name: 'css', description: 'Cascading Style Sheets', article_count: '10000+' },
      { name: 'html', description: 'HyperText Markup Language', article_count: '5000+' },
      { name: 'programming', description: 'General programming', article_count: '20000+' },
      { name: 'typescript', description: 'TypeScript language', article_count: '6000+' },
      { name: 'vue', description: 'Vue.js framework', article_count: '4000+' },
      { name: 'angular', description: 'Angular framework', article_count: '3000+' },
      { name: 'devops', description: 'Development Operations', article_count: '5000+' },
      { name: 'aws', description: 'Amazon Web Services', article_count: '4000+' },
      { name: 'docker', description: 'Docker containerization', article_count: '3000+' },
      { name: 'git', description: 'Git version control', article_count: '2000+' },
      { name: 'opensource', description: 'Open source projects', article_count: '8000+' },
      { name: 'career', description: 'Career advice', article_count: '5000+' },
      { name: 'productivity', description: 'Productivity tips', article_count: '3000+' }
    ];
    
    let filteredTags = popularTags;
    
    if (query) {
      const queryLower = query.toLowerCase();
      filteredTags = popularTags.filter(tag => 
        tag.name.toLowerCase().includes(queryLower) ||
        tag.description.toLowerCase().includes(queryLower)
      );
    }
    
    const results = filteredTags.slice(0, maxResults).map(tag => ({
      name: tag.name,
      description: tag.description,
      article_count: tag.article_count,
      url: `https://dev.to/t/${tag.name}`,
      color: generateTagColor(tag.name),
      bg_color: generateTagBgColor(tag.name),
      type: 'popular_tag'
    }));
    
    const summary = query 
      ? `Found ${results.length} popular Dev.to tags matching "${query}"`
      : `Showing ${results.length} popular Dev.to tags`;
    
    return {
      success: true,
      data: {
        results,
        total: results.length,
        query: query || '',
        summary,
        source: 'dev.to',
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error('Dev.to tag search error:', error);
    return {
      success: false,
      error: `Dev.to tag search failed: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
}

/**
 * Generate a color for a tag based on its name
 */
function generateTagColor(tagName: string): string {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];
  
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Generate a background color for a tag
 */
function generateTagBgColor(tagName: string): string {
  const bgColors = [
    '#dbeafe', '#fee2e2', '#d1fae5', '#fef3c7', '#ede9fe',
    '#cffafe', '#ecfccb', '#fed7aa', '#fce7f3', '#e0e7ff'
  ];
  
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return bgColors[Math.abs(hash) % bgColors.length];
}

/**
 * 工具注册信息
 */
export const devtoTagSearchTool = {
  name: 'devto_tag_search',
  description: 'Search and explore technical tags and topics on Dev.to platform',
  category: 'tech-search',
  source: 'dev.to',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Tag name or keyword to search for'
      },
      tag: {
        type: 'string',
        description: 'Specific tag to look up (alternative to query)'
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (1-100, default: 20)',
        minimum: 1,
        maximum: 100,
        default: 20
      }
    },
    required: []
  },
  execute: devtoTagSearch,
  examples: [
    {
      query: 'javascript',
      description: 'Search for JavaScript-related tags'
    },
    {
      tag: 'react',
      description: 'Get information about the React tag'
    },
    {
      query: 'machine learning',
      max_results: 10,
      description: 'Find machine learning related tags'
    },
    {
      max_results: 15,
      description: 'Get popular Dev.to tags'
    }
  ]
};
