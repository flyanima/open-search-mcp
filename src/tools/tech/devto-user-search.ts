import { ToolInput, ToolOutput } from '../../types.js';
import { Logger } from '../../utils/logger.js';

/**
 * Dev.to 用户搜索工具
 * 搜索Dev.to平台上的开发者和技术作者
 */

const logger = new Logger('DevtoUserSearch');

export async function devtoUserSearch(args: ToolInput): Promise<ToolOutput> {
  try {
    const query = args.query || args.username || '';
    
    if (!query) {
      return {
        success: false,
        error: 'Please provide a username or search query',
        data: null
      };
    }
    
    logger.info(`Searching Dev.to users: "${query}"`);
    
    // Dev.to API doesn't have a direct user search endpoint
    // We'll search for users by getting their profile if exact username is provided
    // Or search for articles by username and extract user info
    
    let userResults = [];
    
    try {
      // Try to get user by exact username
      const userResponse = await fetch(`https://dev.to/api/users/by_username?url=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'OpenSearchMCP/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userResults.push({
          id: userData.id,
          username: userData.username,
          name: userData.name || userData.username,
          summary: userData.summary || 'No summary available',
          location: userData.location || '',
          website_url: userData.website_url || '',
          profile_image: userData.profile_image || userData.profile_image_90 || '',
          github_username: userData.github_username || '',
          twitter_username: userData.twitter_username || '',
          joined_at: userData.joined_at || '',
          profile_url: `https://dev.to/${userData.username}`,
          type: 'exact_match'
        });
      }
    } catch (error) {
      logger.info('Exact username search failed, trying article-based search');
    }
    
    // If no exact match or we want more results, search through articles
    if (userResults.length === 0) {
      try {
        const articlesResponse = await fetch(`https://dev.to/api/articles?per_page=30`, {
          headers: {
            'User-Agent': 'OpenSearchMCP/1.0',
            'Accept': 'application/json'
          }
        });
        
        if (articlesResponse.ok) {
          const articles = await articlesResponse.json();
          const queryLower = query.toLowerCase();
          
          // Extract unique users from articles that match the query
          const userMap = new Map();
          
          articles.forEach((article: any) => {
            const user = article.user;
            if (user && (
              user.username?.toLowerCase().includes(queryLower) ||
              user.name?.toLowerCase().includes(queryLower)
            )) {
              if (!userMap.has(user.username)) {
                userMap.set(user.username, {
                  id: user.user_id || user.id,
                  username: user.username,
                  name: user.name || user.username,
                  summary: 'Dev.to contributor',
                  location: '',
                  website_url: user.website_url || '',
                  profile_image: user.profile_image || user.profile_image_90 || '',
                  github_username: user.github_username || '',
                  twitter_username: user.twitter_username || '',
                  joined_at: '',
                  profile_url: `https://dev.to/${user.username}`,
                  type: 'article_based',
                  recent_article: {
                    title: article.title,
                    url: article.url || `https://dev.to${article.path}`,
                    published_at: article.published_at
                  }
                });
              }
            }
          });
          
          userResults = Array.from(userMap.values()).slice(0, 10);
        }
      } catch (error) {
        logger.error('Article-based user search failed:', error);
      }
    }
    
    // If still no results, provide helpful suggestions
    if (userResults.length === 0) {
      return {
        success: true,
        data: {
          results: [],
          total: 0,
          query,
          summary: `No users found for "${query}". Try searching for exact usernames or popular Dev.to contributors.`,
          suggestions: [
            'Try searching for exact usernames (e.g., "ben", "jess", "andy")',
            'Search for articles first to discover authors',
            'Use the Dev.to website for more comprehensive user search'
          ],
          source: 'dev.to',
          timestamp: new Date().toISOString()
        }
      };
    }
    
    const summary = `Found ${userResults.length} Dev.to user${userResults.length === 1 ? '' : 's'} for "${query}"`;
    
    return {
      success: true,
      data: {
        results: userResults,
        total: userResults.length,
        query,
        summary,
        source: 'dev.to',
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error('Dev.to user search error:', error);
    return {
      success: false,
      error: `Dev.to user search failed: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
}

/**
 * 工具注册信息
 */
export const devtoUserSearchTool = {
  name: 'devto_user_search',
  description: 'Search for developers and technical authors on Dev.to platform by username or name',
  category: 'tech-search',
  source: 'dev.to',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Username or name to search for'
      },
      username: {
        type: 'string',
        description: 'Specific username to look up (alternative to query)'
      }
    },
    required: ['query']
  },
  execute: devtoUserSearch,
  examples: [
    {
      query: 'ben',
      description: 'Search for user with username "ben"'
    },
    {
      username: 'jess',
      description: 'Look up specific user "jess"'
    },
    {
      query: 'javascript',
      description: 'Find users with "javascript" in their name or username'
    }
  ]
};
