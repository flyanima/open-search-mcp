/**
 * Hugging Face API Tools Registration
 * 注册Hugging Face AI模型API工具到MCP服务器
 */

import { ToolRegistry } from '../tool-registry.js';
import axios from 'axios';

/**
 * Hugging Face API客户端
 */
class HuggingFaceAPIClient {
  private apiKey: string;
  private baseURL = 'https://api-inference.huggingface.co';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async makeRequest(endpoint: string, data: any = {}, method: string = 'POST') {
    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        data,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30秒超时，AI推理可能需要更长时间
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async searchModels(query: string, limit: number = 10) {
    try {
      const response = await axios.get('https://huggingface.co/api/models', {
        params: {
          search: query,
          limit,
          sort: 'downloads',
          direction: -1
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async getModelInfo(modelId: string) {
    try {
      const response = await axios.get(`https://huggingface.co/api/models/${modelId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {throw error;
    }
  }

  async textGeneration(modelId: string, inputs: string, parameters: any = {}) {
    return await this.makeRequest(`/models/${modelId}`, {
      inputs,
      parameters: {
        max_length: 100,
        temperature: 0.7,
        ...parameters
      }
    });
  }

  async textClassification(modelId: string, inputs: string) {
    return await this.makeRequest(`/models/${modelId}`, {
      inputs
    });
  }

  async questionAnswering(modelId: string, question: string, context: string) {
    return await this.makeRequest(`/models/${modelId}`, {
      inputs: {
        question,
        context
      }
    });
  }

  async summarization(modelId: string, inputs: string, parameters: any = {}) {
    return await this.makeRequest(`/models/${modelId}`, {
      inputs,
      parameters: {
        max_length: 150,
        min_length: 30,
        ...parameters
      }
    });
  }
}

/**
 * 注册所有Hugging Face API工具
 */
export function registerHuggingFaceTools(registry: ToolRegistry): void {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  
  if (!apiKey) {return;
  }

  const client = new HuggingFaceAPIClient(apiKey);

  // 1. 模型搜索
  registry.registerTool({
    name: 'huggingface_model_search',
    description: 'Search for AI models on Hugging Face Hub',
    category: 'ai',
    source: 'huggingface.co',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for AI models (e.g., "text generation", "sentiment analysis", "translation")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of models to return (1-50)',
          default: 10,
          minimum: 1,
          maximum: 50
        }
      },
      required: ['query']
    },
    execute: async (args: any) => {
      try {
        const models = await client.searchModels(args.query, args.maxResults || 10);
        
        const processedModels = models.map((model: any) => ({
          id: model.id,
          name: model.id.split('/').pop(),
          author: model.id.split('/')[0],
          downloads: model.downloads,
          likes: model.likes,
          tags: model.tags,
          pipeline_tag: model.pipeline_tag,
          library_name: model.library_name,
          created_at: model.created_at,
          last_modified: model.last_modified,
          url: `https://huggingface.co/${model.id}`
        }));
        
        return {
          success: true,
          data: {
            source: 'Hugging Face Hub',
            query: args.query,
            results: processedModels,
            totalResults: processedModels.length,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to search models'
        };
      }
    }
  });

  // 2. 模型详细信息
  registry.registerTool({
    name: 'huggingface_model_info',
    description: 'Get detailed information about a specific Hugging Face model',
    category: 'ai',
    source: 'huggingface.co',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: {
          type: 'string',
          description: 'Model ID (e.g., "microsoft/DialoGPT-medium", "bert-base-uncased")'
        }
      },
      required: ['modelId']
    },
    execute: async (args: any) => {
      try {
        const modelInfo = await client.getModelInfo(args.modelId);
        
        return {
          success: true,
          data: {
            source: 'Hugging Face Hub',
            modelId: args.modelId,
            info: {
              id: modelInfo.id,
              downloads: modelInfo.downloads,
              likes: modelInfo.likes,
              tags: modelInfo.tags,
              pipeline_tag: modelInfo.pipeline_tag,
              library_name: modelInfo.library_name,
              description: modelInfo.description,
              created_at: modelInfo.created_at,
              last_modified: modelInfo.last_modified,
              siblings: modelInfo.siblings?.length || 0,
              config: modelInfo.config,
              url: `https://huggingface.co/${modelInfo.id}`
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get model info'
        };
      }
    }
  });

  // 3. 文本生成
  registry.registerTool({
    name: 'huggingface_text_generation',
    description: 'Generate text using Hugging Face language models',
    category: 'ai',
    source: 'huggingface.co',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text prompt for generation'
        },
        modelId: {
          type: 'string',
          description: 'Model ID for text generation (default: microsoft/DialoGPT-small)',
          default: 'microsoft/DialoGPT-small'
        },
        maxLength: {
          type: 'number',
          description: 'Maximum length of generated text (1-500)',
          default: 100,
          minimum: 1,
          maximum: 500
        },
        temperature: {
          type: 'number',
          description: 'Sampling temperature (0.1-2.0)',
          default: 0.7,
          minimum: 0.1,
          maximum: 2.0
        }
      },
      required: ['prompt']
    },
    execute: async (args: any) => {
      try {
        const modelId = args.modelId || 'microsoft/DialoGPT-small';
        const result = await client.textGeneration(modelId, args.prompt, {
          max_length: args.maxLength,
          temperature: args.temperature
        });
        
        return {
          success: true,
          data: {
            source: 'Hugging Face Inference API',
            modelId,
            prompt: args.prompt,
            generated_text: result[0]?.generated_text || result.generated_text,
            parameters: {
              max_length: args.maxLength,
              temperature: args.temperature
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate text'
        };
      }
    }
  });

  // 4. 文本分类/情感分析
  registry.registerTool({
    name: 'huggingface_sentiment_analysis',
    description: 'Analyze sentiment of text using Hugging Face models',
    category: 'ai',
    source: 'huggingface.co',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to analyze for sentiment'
        },
        modelId: {
          type: 'string',
          description: 'Model ID for sentiment analysis (default: distilbert-base-uncased-finetuned-sst-2-english)',
          default: 'distilbert-base-uncased-finetuned-sst-2-english'
        }
      },
      required: ['text']
    },
    execute: async (args: any) => {
      try {
        const modelId = args.modelId || 'distilbert-base-uncased-finetuned-sst-2-english';
        const result = await client.textClassification(modelId, args.text);
        
        return {
          success: true,
          data: {
            source: 'Hugging Face Inference API',
            modelId,
            text: args.text,
            sentiment: result,
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to analyze sentiment'
        };
      }
    }
  });

  // 5. 文本摘要
  registry.registerTool({
    name: 'huggingface_text_summarization',
    description: 'Summarize text using Hugging Face summarization models',
    category: 'ai',
    source: 'huggingface.co',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to summarize'
        },
        modelId: {
          type: 'string',
          description: 'Model ID for summarization (default: facebook/bart-large-cnn)',
          default: 'facebook/bart-large-cnn'
        },
        maxLength: {
          type: 'number',
          description: 'Maximum length of summary (30-500)',
          default: 150,
          minimum: 30,
          maximum: 500
        },
        minLength: {
          type: 'number',
          description: 'Minimum length of summary (10-100)',
          default: 30,
          minimum: 10,
          maximum: 100
        }
      },
      required: ['text']
    },
    execute: async (args: any) => {
      try {
        const modelId = args.modelId || 'facebook/bart-large-cnn';
        const result = await client.summarization(modelId, args.text, {
          max_length: args.maxLength,
          min_length: args.minLength
        });
        
        return {
          success: true,
          data: {
            source: 'Hugging Face Inference API',
            modelId,
            original_text: args.text,
            summary: result[0]?.summary_text || result.summary_text,
            parameters: {
              max_length: args.maxLength,
              min_length: args.minLength
            },
            timestamp: Date.now(),
            apiUsed: true
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to summarize text'
        };
      }
    }
  });

}
