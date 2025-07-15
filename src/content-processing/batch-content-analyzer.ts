/**
 * 批量内容分析引擎 - 并行处理多个URL的内容提取
 * 支持异步任务管理、状态跟踪、智能重试和性能监控
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedContentExtractor, ExtractedData, ExtractionOptions } from './enhanced-content-extractor.js';
import { Logger } from '../utils/logger.js';

export type BatchJobId = string;

export interface AnalysisConfig {
  extractionSchema?: any;
  prompt?: string;
  systemPrompt?: string;
  formats: OutputFormat[];
  concurrency: number;
  retryConfig: RetryConfig;
  timeoutMs: number;
  enableStreaming?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff?: boolean;
}

export interface OutputFormat {
  type: 'markdown' | 'json' | 'html' | 'screenshot';
  options?: any;
}

export interface BatchStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    remaining: number;
    percentage: number;
  };
  estimatedTimeRemaining?: number;
  errors?: ProcessingError[];
  startedAt: string;
  completedAt?: string;
  performance: {
    averageProcessingTime: number;
    throughputPerSecond: number;
    totalProcessingTime: number;
  };
}

export interface BatchResults {
  jobId: string;
  results: AnalysisResult[];
  summary: {
    totalUrls: number;
    successfulExtractions: number;
    failedExtractions: number;
    averageConfidence: number;
    totalProcessingTime: number;
  };
  errors: ProcessingError[];
}

export interface AnalysisResult {
  url: string;
  success: boolean;
  data?: ExtractedData;
  error?: ProcessingError;
  processingTime: number;
  retryCount: number;
}

export interface ProcessingError {
  url: string;
  error: string;
  timestamp: string;
  retryCount: number;
  errorType: 'network' | 'parsing' | 'timeout' | 'unknown';
}

export class BatchContentAnalyzer extends EventEmitter {
  private contentExtractor: EnhancedContentExtractor;
  private logger: Logger;
  private activeJobs: Map<BatchJobId, BatchJob> = new Map();
  private jobQueue: BatchJob[] = [];
  private isProcessing: boolean = false;

  constructor() {
    super();
    this.contentExtractor = new EnhancedContentExtractor();
    this.logger = new Logger('BatchContentAnalyzer');
  }

  /**
   * 启动批量分析任务
   */
  async startBatchAnalysis(
    urls: string[],
    analysisConfig: AnalysisConfig
  ): Promise<BatchJobId> {
    const jobId = uuidv4();
    
    const job: BatchJob = {
      id: jobId,
      urls: [...urls],
      config: analysisConfig,
      status: 'queued',
      results: [],
      errors: [],
      startedAt: new Date().toISOString(),
      progress: {
        total: urls.length,
        completed: 0,
        failed: 0,
        remaining: urls.length,
        percentage: 0
      },
      performance: {
        averageProcessingTime: 0,
        throughputPerSecond: 0,
        totalProcessingTime: 0
      },
      streamingResults: analysisConfig.enableStreaming ? [] : undefined
    };

    this.activeJobs.set(jobId, job);
    this.jobQueue.push(job);

    this.logger.info(`Batch analysis job ${jobId} queued with ${urls.length} URLs`);

    // 启动处理队列
    this.processQueue();

    return jobId;
  }

  /**
   * 检查批量任务状态
   */
  async checkBatchStatus(jobId: BatchJobId): Promise<BatchStatus> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      estimatedTimeRemaining: this.calculateEstimatedTime(job),
      errors: job.errors,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      performance: job.performance
    };
  }

  /**
   * 获取批量任务结果
   */
  async getBatchResults(jobId: BatchJobId): Promise<BatchResults> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'completed' && job.status !== 'failed') {
      throw new Error(`Job ${jobId} is not completed yet`);
    }

    const successfulResults = job.results.filter(r => r.success);
    const averageConfidence = successfulResults.length > 0 
      ? successfulResults.reduce((sum, r) => sum + (r.data?.confidence || 0), 0) / successfulResults.length
      : 0;

    return {
      jobId: job.id,
      results: job.results,
      summary: {
        totalUrls: job.urls.length,
        successfulExtractions: successfulResults.length,
        failedExtractions: job.results.filter(r => !r.success).length,
        averageConfidence,
        totalProcessingTime: job.performance.totalProcessingTime
      },
      errors: job.errors
    };
  }

  /**
   * 流式批量分析
   */
  async* streamBatchAnalysis(
    urls: string[],
    config: AnalysisConfig
  ): AsyncIterator<AnalysisResult> {
    const jobId = await this.startBatchAnalysis(urls, { ...config, enableStreaming: true });
    
    // 监听结果事件
    while (true) {
      const status = await this.checkBatchStatus(jobId);
      
      if (status.status === 'completed' || status.status === 'failed') {
        break;
      }

      // 等待新结果
      await this.delay(100);
      
      const job = this.activeJobs.get(jobId);
      if (job && job.streamingResults && job.streamingResults.length > 0) {
        const result = job.streamingResults.shift();
        if (result) {
          yield result;
        }
      }
    }
  }

  /**
   * 取消批量任务
   */
  async cancelBatchJob(jobId: BatchJobId): Promise<void> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      throw new Error(`Job ${jobId} is already ${job.status}`);
    }

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();

    this.logger.info(`Batch job ${jobId} cancelled`);
    this.emit('jobCancelled', jobId);
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.jobQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (job) {
        await this.processJob(job);
      }
    }

    this.isProcessing = false;
  }

  /**
   * 处理单个任务
   */
  private async processJob(job: BatchJob): Promise<void> {
    job.status = 'processing';
    const startTime = Date.now();

    this.logger.info(`Starting batch job ${job.id} with ${job.urls.length} URLs`);
    this.emit('jobStarted', job.id);

    try {
      // 创建并发处理池
      const semaphore = new Semaphore(job.config.concurrency);
      const processingPromises = job.urls.map(url => 
        this.processUrl(url, job, semaphore)
      );

      // 等待所有URL处理完成
      await Promise.allSettled(processingPromises);

      // 更新任务状态
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.performance.totalProcessingTime = Date.now() - startTime;

      this.logger.info(`Batch job ${job.id} completed: ${job.progress.completed}/${job.progress.total} successful`);
      this.emit('jobCompleted', job.id);

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      
      this.logger.error(`Batch job ${job.id} failed:`, error);
      this.emit('jobFailed', job.id, error);
    }
  }

  /**
   * 处理单个URL
   */
  private async processUrl(url: string, job: BatchJob, semaphore: Semaphore): Promise<void> {
    await semaphore.acquire();

    try {
      const result = await this.processUrlWithRetry(url, job);
      
      job.results.push(result);
      
      if (result.success) {
        job.progress.completed++;
      } else {
        job.progress.failed++;
      }
      
      job.progress.remaining--;
      job.progress.percentage = (job.progress.completed + job.progress.failed) / job.progress.total * 100;

      // 更新性能指标
      this.updatePerformanceMetrics(job, result.processingTime);

      // 流式输出
      if (job.config.enableStreaming && job.streamingResults) {
        job.streamingResults.push(result);
      }

      this.emit('urlProcessed', job.id, result);

    } finally {
      semaphore.release();
    }
  }

  /**
   * 带重试的URL处理
   */
  private async processUrlWithRetry(url: string, job: BatchJob): Promise<AnalysisResult> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= job.config.retryConfig.maxRetries) {
      try {
        const startTime = Date.now();
        
        let extractedData: ExtractedData;
        
        if (job.config.extractionSchema) {
          extractedData = await this.contentExtractor.extractWithSchema(
            url,
            job.config.extractionSchema,
            this.buildExtractionOptions(job.config)
          );
        } else if (job.config.prompt) {
          extractedData = await this.contentExtractor.extractWithPrompt(
            url,
            job.config.prompt,
            job.config.systemPrompt,
            this.buildExtractionOptions(job.config)
          );
        } else {
          throw new Error('Either extractionSchema or prompt must be provided');
        }

        const processingTime = Date.now() - startTime;

        return {
          url,
          success: true,
          data: extractedData,
          processingTime,
          retryCount
        };

      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount <= job.config.retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(retryCount, job.config.retryConfig);
          await this.delay(delay);
          
          this.logger.warn(`Retrying URL ${url} (attempt ${retryCount}/${job.config.retryConfig.maxRetries})`);
        }
      }
    }

    // 记录错误
    const processingError: ProcessingError = {
      url,
      error: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      retryCount,
      errorType: this.classifyError(lastError)
    };

    job.errors.push(processingError);

    return {
      url,
      success: false,
      error: processingError,
      processingTime: 0,
      retryCount
    };
  }

  /**
   * 工具方法
   */
  private buildExtractionOptions(config: AnalysisConfig): ExtractionOptions {
    return {
      formats: config.formats.map(f => f.type),
      onlyMainContent: true,
      timeout: config.timeoutMs
    };
  }

  private calculateRetryDelay(retryCount: number, retryConfig: RetryConfig): number {
    if (retryConfig.exponentialBackoff) {
      return retryConfig.backoffMs * Math.pow(2, retryCount - 1);
    }
    return retryConfig.backoffMs;
  }

  private classifyError(error: Error | null): ProcessingError['errorType'] {
    if (!error) return 'unknown';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('parse') || message.includes('invalid')) return 'parsing';
    
    return 'unknown';
  }

  private calculateEstimatedTime(job: BatchJob): number | undefined {
    if (job.progress.completed === 0) return undefined;
    
    const avgTime = job.performance.averageProcessingTime;
    return avgTime * job.progress.remaining;
  }

  private updatePerformanceMetrics(job: BatchJob, processingTime: number): void {
    const completed = job.progress.completed + job.progress.failed;
    
    job.performance.averageProcessingTime = 
      (job.performance.averageProcessingTime * (completed - 1) + processingTime) / completed;
    
    const elapsedTime = Date.now() - new Date(job.startedAt).getTime();
    job.performance.throughputPerSecond = completed / (elapsedTime / 1000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 信号量实现
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      if (resolve) resolve();
    } else {
      this.permits++;
    }
  }
}

/**
 * 内部任务接口
 */
interface BatchJob {
  id: string;
  urls: string[];
  config: AnalysisConfig;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  results: AnalysisResult[];
  errors: ProcessingError[];
  startedAt: string;
  completedAt?: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    remaining: number;
    percentage: number;
  };
  performance: {
    averageProcessingTime: number;
    throughputPerSecond: number;
    totalProcessingTime: number;
  };
  streamingResults?: AnalysisResult[];
}
