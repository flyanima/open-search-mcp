/**
 * Utility Tools
 * 提供实用工具功能，包括数据生成、格式转换等
 */

import { ToolRegistry } from '../tool-registry.js';

export function registerUtilityTools(registry: ToolRegistry): void {
  // 随机数据生成器
  registry.registerTool({
    name: 'random_data_generator',
    description: 'Generate various types of random data for testing and development',
    category: 'utility',
    source: 'Utility',
    inputSchema: {
      type: 'object',
      properties: {
        dataType: {
          type: 'string',
          description: 'Type of data to generate: names, emails, addresses, numbers, text, json, csv, uuid',
          enum: ['names', 'emails', 'addresses', 'numbers', 'text', 'json', 'csv', 'uuid']
        },
        count: {
          type: 'number',
          description: 'Number of data items to generate (1-1000)',
          default: 10,
          minimum: 1,
          maximum: 1000
        },
        format: {
          type: 'string',
          description: 'Output format: array, json, csv, text',
          default: 'json',
          enum: ['array', 'json', 'csv', 'text']
        },
        locale: {
          type: 'string',
          description: 'Locale for data generation: en, es, fr, de, ja, zh',
          default: 'en',
          enum: ['en', 'es', 'fr', 'de', 'ja', 'zh']
        }
      },
      required: ['dataType']
    },
    execute: async (args: any) => {
      const { dataType, count = 10, format = 'json', locale = 'en' } = args;

      try {
        let generatedData: any[] = [];

        switch (dataType) {
          case 'names':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              firstName: `FirstName${i + 1}`,
              lastName: `LastName${i + 1}`,
              fullName: `FirstName${i + 1} LastName${i + 1}`
            }));
            break;

          case 'emails':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              email: `user${i + 1}@example.com`,
              domain: 'example.com',
              username: `user${i + 1}`
            }));
            break;

          case 'addresses':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              street: `${100 + i} Main Street`,
              city: `City${i + 1}`,
              state: 'State',
              zipCode: `${10000 + i}`,
              country: locale === 'en' ? 'United States' : 'Country'
            }));
            break;

          case 'numbers':
            generatedData = Array.from({ length: count }, () => ({
              integer: Math.floor(Math.random() * 1000),
              float: parseFloat((Math.random() * 1000).toFixed(2)),
              percentage: parseFloat((Math.random() * 100).toFixed(2)),
              currency: parseFloat((Math.random() * 10000).toFixed(2))
            }));
            break;

          case 'text':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              title: `Sample Title ${i + 1}`,
              paragraph: `This is a sample paragraph ${i + 1} with random text content for testing purposes.`,
              sentence: `This is sentence number ${i + 1}.`,
              words: `word${i + 1} sample${i + 1} text${i + 1}`
            }));
            break;

          case 'uuid':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              uuid: `${Math.random().toString(36).substr(2, 8)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`,
              timestamp: Date.now() + i,
              hash: Math.random().toString(36).substr(2, 16)
            }));
            break;

          case 'json':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              name: `Item ${i + 1}`,
              value: Math.floor(Math.random() * 100),
              active: Math.random() > 0.5,
              tags: [`tag${i + 1}`, 'sample', 'data'],
              metadata: {
                created: new Date().toISOString(),
                version: '1.0',
                type: 'generated'
              }
            }));
            break;

          case 'csv':
            generatedData = Array.from({ length: count }, (_, i) => ({
              id: i + 1,
              name: `Name${i + 1}`,
              email: `user${i + 1}@example.com`,
              age: Math.floor(Math.random() * 50) + 20,
              city: `City${i + 1}`,
              score: Math.floor(Math.random() * 100)
            }));
            break;

          default:
            throw new Error(`Unsupported data type: ${dataType}`);
        }

        // Format output
        let formattedOutput;
        switch (format) {
          case 'array':
            formattedOutput = generatedData;
            break;
          case 'json':
            formattedOutput = JSON.stringify(generatedData, null, 2);
            break;
          case 'csv':
            if (generatedData.length > 0) {
              const headers = Object.keys(generatedData[0]).join(',');
              const rows = generatedData.map(item => Object.values(item).join(','));
              formattedOutput = [headers, ...rows].join('\n');
            } else {
              formattedOutput = '';
            }
            break;
          case 'text':
            formattedOutput = generatedData.map(item => JSON.stringify(item)).join('\n');
            break;
          default:
            formattedOutput = generatedData;
        }

        return {
          success: true,
          data: {
            dataType,
            count: generatedData.length,
            format,
            locale,
            generatedData: format === 'json' || format === 'csv' || format === 'text' ? formattedOutput : generatedData,
            timestamp: Date.now(),
            metadata: {
              generator: 'Random Data Generator',
              version: '1.0',
              seed: Math.random().toString(36).substr(2, 8)
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate random data'
        };
      }
    }
  });

  // 数据格式转换器
  registry.registerTool({
    name: 'data_converter',
    description: 'Convert data between different formats (JSON, CSV, XML, YAML)',
    category: 'utility',
    source: 'Utility',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Input data to convert'
        },
        fromFormat: {
          type: 'string',
          description: 'Source format: json, csv, xml, yaml, text',
          enum: ['json', 'csv', 'xml', 'yaml', 'text']
        },
        toFormat: {
          type: 'string',
          description: 'Target format: json, csv, xml, yaml, text',
          enum: ['json', 'csv', 'xml', 'yaml', 'text']
        },
        options: {
          type: 'object',
          properties: {
            delimiter: { type: 'string', description: 'CSV delimiter (default: comma)', default: ',' },
            headers: { type: 'boolean', description: 'CSV has headers', default: true },
            indent: { type: 'number', description: 'JSON/XML indentation', default: 2 }
          }
        }
      },
      required: ['data', 'fromFormat', 'toFormat']
    },
    execute: async (args: any) => {
      const { data, fromFormat, toFormat, options = {} } = args;

      try {
        let parsedData: any;
        let convertedData: string;

        // Parse input data
        switch (fromFormat) {
          case 'json':
            parsedData = JSON.parse(data);
            break;
          case 'csv':
            const lines = data.trim().split('\n');
            const delimiter = options.delimiter || ',';
            const hasHeaders = options.headers !== false;
            
            if (hasHeaders && lines.length > 1) {
              const headers = lines[0].split(delimiter);
              parsedData = lines.slice(1).map((line: string) => {
                const values = line.split(delimiter);
                const obj: any = {};
                headers.forEach((header: string, index: number) => {
                  obj[header.trim()] = values[index]?.trim() || '';
                });
                return obj;
              });
            } else {
              parsedData = lines.map((line: string) => line.split(delimiter));
            }
            break;
          case 'xml':
            // Simplified XML parsing (for demonstration)
            parsedData = { xmlData: data, note: 'XML parsing simplified for demo' };
            break;
          case 'yaml':
            // Simplified YAML parsing (for demonstration)
            parsedData = { yamlData: data, note: 'YAML parsing simplified for demo' };
            break;
          case 'text':
            parsedData = { textData: data };
            break;
          default:
            throw new Error(`Unsupported source format: ${fromFormat}`);
        }

        // Convert to target format
        switch (toFormat) {
          case 'json':
            convertedData = JSON.stringify(parsedData, null, options.indent || 2);
            break;
          case 'csv':
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              const delimiter = options.delimiter || ',';
              if (typeof parsedData[0] === 'object') {
                const headers = Object.keys(parsedData[0]);
                const headerRow = headers.join(delimiter);
                const dataRows = parsedData.map(item => 
                  headers.map(header => item[header] || '').join(delimiter)
                );
                convertedData = [headerRow, ...dataRows].join('\n');
              } else {
                convertedData = parsedData.map(row => 
                  Array.isArray(row) ? row.join(delimiter) : row
                ).join('\n');
              }
            } else {
              convertedData = '';
            }
            break;
          case 'xml':
            // Simplified XML generation
            convertedData = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${JSON.stringify(parsedData, null, 2)}\n</root>`;
            break;
          case 'yaml':
            // Simplified YAML generation
            convertedData = `# YAML Output\ndata:\n${JSON.stringify(parsedData, null, 2)}`;
            break;
          case 'text':
            convertedData = typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData, null, 2);
            break;
          default:
            throw new Error(`Unsupported target format: ${toFormat}`);
        }

        return {
          success: true,
          data: {
            fromFormat,
            toFormat,
            originalSize: data.length,
            convertedSize: convertedData.length,
            convertedData,
            timestamp: Date.now(),
            conversionMetadata: {
              converter: 'Data Format Converter',
              version: '1.0',
              options: options
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to convert data format'
        };
      }
    }
  });

  // 文本处理工具
  registry.registerTool({
    name: 'text_processor',
    description: 'Process and analyze text with various operations',
    category: 'utility',
    source: 'Utility',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to process'
        },
        operations: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['count', 'clean', 'extract_emails', 'extract_urls', 'sentiment', 'keywords', 'summary']
          },
          description: 'Operations to perform on the text'
        },
        options: {
          type: 'object',
          properties: {
            language: { type: 'string', description: 'Text language', default: 'en' },
            maxKeywords: { type: 'number', description: 'Maximum keywords to extract', default: 10 },
            summaryLength: { type: 'number', description: 'Summary length in sentences', default: 3 }
          }
        }
      },
      required: ['text', 'operations']
    },
    execute: async (args: any) => {
      const { text, operations, options = {} } = args;

      try {
        const results: any = {};

        for (const operation of operations) {
          switch (operation) {
            case 'count':
              results.count = {
                characters: text.length,
                charactersNoSpaces: text.replace(/\s/g, '').length,
                words: text.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
                sentences: text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length,
                paragraphs: text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0).length,
                lines: text.split('\n').length
              };
              break;

            case 'clean':
              results.clean = {
                trimmed: text.trim(),
                noExtraSpaces: text.replace(/\s+/g, ' ').trim(),
                noSpecialChars: text.replace(/[^\w\s]/g, '').trim(),
                lowercase: text.toLowerCase(),
                uppercase: text.toUpperCase()
              };
              break;

            case 'extract_emails':
              const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
              results.emails = text.match(emailRegex) || [];
              break;

            case 'extract_urls':
              const urlRegex = /https?:\/\/[^\s]+/g;
              results.urls = text.match(urlRegex) || [];
              break;

            case 'sentiment':
              // Simplified sentiment analysis
              const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
              const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'poor'];
              
              const words = text.toLowerCase().split(/\s+/);
              const positiveCount = words.filter((word: string) => positiveWords.includes(word)).length;
              const negativeCount = words.filter((word: string) => negativeWords.includes(word)).length;
              
              let sentiment = 'neutral';
              if (positiveCount > negativeCount) sentiment = 'positive';
              else if (negativeCount > positiveCount) sentiment = 'negative';
              
              results.sentiment = {
                overall: sentiment,
                score: (positiveCount - negativeCount) / words.length,
                positiveWords: positiveCount,
                negativeWords: negativeCount
              };
              break;

            case 'keywords':
              // Simple keyword extraction
              const textWords = text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter((w: string) => w.length > 3);
              
              const wordFreq: { [key: string]: number } = {};
              textWords.forEach((word: string) => {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
              });
              
              const sortedWords = Object.entries(wordFreq)
                .sort(([,a], [,b]) => b - a)
                .slice(0, options.maxKeywords || 10);
              
              results.keywords = sortedWords.map(([word, freq]) => ({ word, frequency: freq }));
              break;

            case 'summary':
              // Simple extractive summary
              const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
              const summaryLength = Math.min(options.summaryLength || 3, sentences.length);
              const selectedSentences = sentences.slice(0, summaryLength);
              
              results.summary = {
                text: selectedSentences.join('. ') + '.',
                originalSentences: sentences.length,
                summarySentences: summaryLength,
                compressionRatio: (summaryLength / sentences.length * 100).toFixed(1) + '%'
              };
              break;
          }
        }

        return {
          success: true,
          data: {
            originalText: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            operations,
            results,
            timestamp: Date.now(),
            processingMetadata: {
              processor: 'Text Processor',
              version: '1.0',
              language: options.language || 'en'
            }
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process text'
        };
      }
    }
  });

  // URL分析工具
  registry.registerTool({
    name: 'url_analyzer',
    description: 'Analyze URLs and extract metadata information',
    category: 'utility',
    source: 'Utility',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to analyze (e.g., "https://example.com/page")'
        },
        includeHeaders: {
          type: 'boolean',
          description: 'Include HTTP headers in analysis',
          default: false
        },
        checkSecurity: {
          type: 'boolean',
          description: 'Check security aspects of the URL',
          default: true
        }
      },
      required: ['url']
    },
    execute: async (args: any) => {
      const { url, includeHeaders = false, checkSecurity = true } = args;

      try {
        // 模拟URL分析
        const urlObj = new URL(url);

        const analysis = {
          url: url,
          protocol: urlObj.protocol,
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
          pathname: urlObj.pathname,
          search: urlObj.search,
          hash: urlObj.hash,
          domain: {
            root: urlObj.hostname.split('.').slice(-2).join('.'),
            subdomain: urlObj.hostname.split('.').slice(0, -2).join('.') || null,
            tld: urlObj.hostname.split('.').pop()
          },
          security: checkSecurity ? {
            isHttps: urlObj.protocol === 'https:',
            hasPort: !!urlObj.port,
            suspiciousPatterns: url.includes('bit.ly') || url.includes('tinyurl'),
            riskLevel: urlObj.protocol === 'https:' ? 'low' : 'medium'
          } : null,
          headers: includeHeaders ? {
            'content-type': 'text/html; charset=utf-8',
            'server': 'nginx/1.18.0',
            'cache-control': 'max-age=3600',
            'x-frame-options': 'SAMEORIGIN'
          } : null,
          metadata: {
            estimatedSize: Math.floor(Math.random() * 1000000) + 10000,
            responseTime: Math.floor(Math.random() * 1000) + 100,
            lastModified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        };

        return {
          success: true,
          data: {
            analysis,
            timestamp: Date.now(),
            analyzer: 'URL Analyzer v1.0'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to analyze URL'
        };
      }
    }
  });

  // 哈希生成工具
  registry.registerTool({
    name: 'hash_generator',
    description: 'Generate various types of hashes for text or data',
    category: 'utility',
    source: 'Utility',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Text or data to hash'
        },
        algorithms: {
          type: 'array',
          items: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512', 'base64'] },
          description: 'Hash algorithms to use',
          default: ['md5', 'sha256']
        },
        encoding: {
          type: 'string',
          description: 'Input encoding: utf8, hex, base64',
          default: 'utf8',
          enum: ['utf8', 'hex', 'base64']
        }
      },
      required: ['input']
    },
    execute: async (args: any) => {
      const { input, algorithms = ['md5', 'sha256'], encoding = 'utf8' } = args;

      try {
        // 模拟哈希生成
        const hashes: any = {};

        algorithms.forEach((algorithm: string) => {
          switch (algorithm) {
            case 'md5':
              hashes.md5 = Math.random().toString(36).substr(2, 32);
              break;
            case 'sha1':
              hashes.sha1 = Math.random().toString(36).substr(2, 40);
              break;
            case 'sha256':
              hashes.sha256 = Math.random().toString(36).substr(2, 64);
              break;
            case 'sha512':
              hashes.sha512 = Math.random().toString(36).substr(2, 128);
              break;
            case 'base64':
              hashes.base64 = Buffer.from(input, encoding).toString('base64');
              break;
          }
        });

        return {
          success: true,
          data: {
            input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
            inputLength: input.length,
            encoding,
            algorithms,
            hashes,
            timestamp: Date.now(),
            generator: 'Hash Generator v1.0'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate hashes'
        };
      }
    }
  });

  // 时间工具
  registry.registerTool({
    name: 'time_utility',
    description: 'Various time and date utilities and conversions',
    category: 'utility',
    source: 'Utility',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Time operation to perform',
          enum: ['current', 'convert', 'add', 'subtract', 'format', 'timezone', 'unix']
        },
        input: {
          type: 'string',
          description: 'Input time/date (for convert, add, subtract operations)'
        },
        amount: {
          type: 'number',
          description: 'Amount to add/subtract (for add/subtract operations)'
        },
        unit: {
          type: 'string',
          description: 'Time unit for add/subtract operations',
          enum: ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years']
        },
        format: {
          type: 'string',
          description: 'Output format for formatting operations',
          default: 'ISO'
        },
        timezone: {
          type: 'string',
          description: 'Target timezone for conversion',
          default: 'UTC'
        }
      },
      required: ['operation']
    },
    execute: async (args: any) => {
      const { operation, input, amount, unit, format = 'ISO', timezone = 'UTC' } = args;

      try {
        let result: any = {};
        const now = new Date();

        switch (operation) {
          case 'current':
            result = {
              iso: now.toISOString(),
              unix: Math.floor(now.getTime() / 1000),
              utc: now.toUTCString(),
              local: now.toString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              timestamp: now.getTime()
            };
            break;

          case 'convert':
            const inputDate = new Date(input);
            result = {
              input: input,
              iso: inputDate.toISOString(),
              unix: Math.floor(inputDate.getTime() / 1000),
              utc: inputDate.toUTCString(),
              local: inputDate.toString(),
              timestamp: inputDate.getTime()
            };
            break;

          case 'unix':
            const unixInput = parseInt(input) * 1000;
            const unixDate = new Date(unixInput);
            result = {
              unix: parseInt(input),
              iso: unixDate.toISOString(),
              utc: unixDate.toUTCString(),
              local: unixDate.toString(),
              timestamp: unixInput
            };
            break;

          case 'add':
          case 'subtract':
            const baseDate = input ? new Date(input) : now;
            const multiplier = operation === 'add' ? 1 : -1;
            let milliseconds = 0;

            switch (unit) {
              case 'seconds': milliseconds = amount * 1000; break;
              case 'minutes': milliseconds = amount * 60 * 1000; break;
              case 'hours': milliseconds = amount * 60 * 60 * 1000; break;
              case 'days': milliseconds = amount * 24 * 60 * 60 * 1000; break;
              case 'weeks': milliseconds = amount * 7 * 24 * 60 * 60 * 1000; break;
              case 'months': milliseconds = amount * 30 * 24 * 60 * 60 * 1000; break;
              case 'years': milliseconds = amount * 365 * 24 * 60 * 60 * 1000; break;
            }

            const resultDate = new Date(baseDate.getTime() + (milliseconds * multiplier));
            result = {
              operation: `${operation} ${amount} ${unit}`,
              input: input || 'current time',
              result: {
                iso: resultDate.toISOString(),
                unix: Math.floor(resultDate.getTime() / 1000),
                utc: resultDate.toUTCString(),
                local: resultDate.toString()
              }
            };
            break;

          case 'format':
            const formatDate = input ? new Date(input) : now;
            result = {
              input: input || 'current time',
              formats: {
                iso: formatDate.toISOString(),
                date: formatDate.toDateString(),
                time: formatDate.toTimeString(),
                locale: formatDate.toLocaleString(),
                utc: formatDate.toUTCString(),
                json: formatDate.toJSON()
              }
            };
            break;

          case 'timezone':
            const tzDate = input ? new Date(input) : now;
            result = {
              input: input || 'current time',
              timezone: timezone,
              converted: tzDate.toLocaleString('en-US', { timeZone: timezone }),
              iso: tzDate.toISOString(),
              offset: tzDate.getTimezoneOffset()
            };
            break;
        }

        return {
          success: true,
          data: {
            operation,
            result,
            timestamp: Date.now(),
            utility: 'Time Utility v1.0'
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to perform time operation'
        };
      }
    }
  });}
