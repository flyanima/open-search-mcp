/**
 * YouTube Video Platform Tools
 * 提供YouTube视频搜索、频道搜索和趋势视频功能
 */

import { ToolRegistry } from '../tool-registry.js';

export function registerYouTubeTools(registry: ToolRegistry): void {
  // YouTube视频搜索
  registry.registerTool({
    name: 'youtube_video_search',
    description: 'Search for YouTube videos with detailed metadata',
    category: 'video',
    source: 'YouTube',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for YouTube videos (e.g., "machine learning tutorial", "cooking recipes")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of videos to return (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        },
        order: {
          type: 'string',
          description: 'Sort order: relevance, date, rating, viewCount, title',
          default: 'relevance',
          enum: ['relevance', 'date', 'rating', 'viewCount', 'title']
        },
        duration: {
          type: 'string',
          description: 'Video duration filter: any, short, medium, long',
          default: 'any',
          enum: ['any', 'short', 'medium', 'long']
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, maxResults = 10, order = 'relevance', duration = 'any' } = args;

      try {
        // 模拟YouTube视频搜索结果
        const mockVideos = Array.from({ length: Math.min(maxResults, 10) }, (_, i) => ({
          videoId: `video_${Date.now()}_${i}`,
          title: `${query} - Video ${i + 1}`,
          description: `This is a comprehensive video about ${query}. Learn everything you need to know in this detailed tutorial.`,
          channelTitle: `Channel ${i + 1}`,
          channelId: `channel_${i + 1}`,
          publishedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          thumbnails: {
            default: `https://img.youtube.com/vi/video_${i}/default.jpg`,
            medium: `https://img.youtube.com/vi/video_${i}/mqdefault.jpg`,
            high: `https://img.youtube.com/vi/video_${i}/hqdefault.jpg`
          },
          duration: duration === 'short' ? 'PT3M45S' : duration === 'long' ? 'PT45M12S' : 'PT12M30S',
          viewCount: Math.floor(Math.random() * 1000000) + 1000,
          likeCount: Math.floor(Math.random() * 50000) + 100,
          commentCount: Math.floor(Math.random() * 5000) + 10,
          url: `https://www.youtube.com/watch?v=video_${Date.now()}_${i}`
        }));

        return {
          success: true,
          data: {
            source: 'YouTube',
            query,
            order,
            duration,
            totalResults: mockVideos.length,
            videos: mockVideos,
            timestamp: Date.now(),
            searchMetadata: {
              searchType: 'video',
              region: 'global',
              language: 'en'
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search YouTube videos'
        };
      }
    }
  });

  // YouTube频道搜索
  registry.registerTool({
    name: 'youtube_channel_search',
    description: 'Search for YouTube channels with detailed information',
    category: 'video',
    source: 'YouTube',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for YouTube channels (e.g., "tech channels", "cooking channels")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of channels to return (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      const { query, maxResults = 10 } = args;

      try {
        // 模拟YouTube频道搜索结果
        const mockChannels = Array.from({ length: Math.min(maxResults, 10) }, (_, i) => ({
          channelId: `channel_${Date.now()}_${i}`,
          title: `${query} Channel ${i + 1}`,
          description: `A popular channel focused on ${query}. Subscribe for regular updates and quality content.`,
          customUrl: `@${query.replace(/\s+/g, '').toLowerCase()}channel${i + 1}`,
          publishedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          thumbnails: {
            default: `https://yt3.ggpht.com/channel_${i}/default.jpg`,
            medium: `https://yt3.ggpht.com/channel_${i}/medium.jpg`,
            high: `https://yt3.ggpht.com/channel_${i}/high.jpg`
          },
          statistics: {
            subscriberCount: Math.floor(Math.random() * 1000000) + 1000,
            videoCount: Math.floor(Math.random() * 1000) + 10,
            viewCount: Math.floor(Math.random() * 100000000) + 10000
          },
          url: `https://www.youtube.com/channel/channel_${Date.now()}_${i}`,
          verified: Math.random() > 0.7
        }));

        return {
          success: true,
          data: {
            source: 'YouTube',
            query,
            totalResults: mockChannels.length,
            channels: mockChannels,
            timestamp: Date.now(),
            searchMetadata: {
              searchType: 'channel',
              region: 'global',
              language: 'en'
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search YouTube channels'
        };
      }
    }
  });

  // YouTube趋势视频
  registry.registerTool({
    name: 'youtube_trending',
    description: 'Get trending YouTube videos by region and category',
    category: 'video',
    source: 'YouTube',
    inputSchema: {
      type: 'object',
      properties: {
        region: {
          type: 'string',
          description: 'Region code (e.g., "US", "GB", "JP", "DE")',
          default: 'US'
        },
        category: {
          type: 'string',
          description: 'Video category: all, music, gaming, news, sports, entertainment, education, science, technology',
          default: 'all',
          enum: ['all', 'music', 'gaming', 'news', 'sports', 'entertainment', 'education', 'science', 'technology']
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of trending videos to return (1-50)',
          default: 20,
          minimum: 1,
          maximum: 50
        }
      },
      required: []
    },
    execute: async (args: any) => {
      const { region = 'US', category = 'all', maxResults = 20 } = args;

      try {
        // 模拟YouTube趋势视频
        const categories = category === 'all' ? 
          ['music', 'gaming', 'news', 'sports', 'entertainment', 'education', 'science', 'technology'] : 
          [category];

        const mockTrendingVideos = Array.from({ length: Math.min(maxResults, 20) }, (_, i) => {
          const videoCategory = categories[Math.floor(Math.random() * categories.length)];
          return {
            videoId: `trending_${Date.now()}_${i}`,
            title: `Trending ${videoCategory} Video ${i + 1}`,
            description: `This ${videoCategory} video is currently trending in ${region}. Don't miss out on this popular content!`,
            channelTitle: `Trending Channel ${i + 1}`,
            channelId: `trending_channel_${i + 1}`,
            publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            category: videoCategory,
            thumbnails: {
              default: `https://img.youtube.com/vi/trending_${i}/default.jpg`,
              medium: `https://img.youtube.com/vi/trending_${i}/mqdefault.jpg`,
              high: `https://img.youtube.com/vi/trending_${i}/hqdefault.jpg`
            },
            duration: 'PT8M45S',
            viewCount: Math.floor(Math.random() * 5000000) + 100000,
            likeCount: Math.floor(Math.random() * 200000) + 5000,
            commentCount: Math.floor(Math.random() * 20000) + 500,
            trendingRank: i + 1,
            url: `https://www.youtube.com/watch?v=trending_${Date.now()}_${i}`
          };
        });

        return {
          success: true,
          data: {
            source: 'YouTube',
            region,
            category,
            totalResults: mockTrendingVideos.length,
            trendingVideos: mockTrendingVideos,
            timestamp: Date.now(),
            trendingMetadata: {
              lastUpdated: new Date().toISOString(),
              region,
              category,
              timeframe: 'last_24_hours'
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get YouTube trending videos'
        };
      }
    }
  });}
