/**
 * Print Monitor
 * Monitors the print capture directory for new print jobs
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { watch, FSWatcher } from 'chokidar';
import { Logger } from '../utils/logger';
import { ReceiptProcessor, CapturedPrintJob } from './receipt-processor.js';

export class PrintMonitor extends EventEmitter {
  private captureDirectory: string;
  private receiptProcessor: ReceiptProcessor;
  private logger = Logger.getInstance();
  private watcher: FSWatcher | null = null;
  private isRunning = false;
  private processingJobs = new Set<string>();

  constructor(captureDirectory: string, receiptProcessor: ReceiptProcessor) {
    super();
    this.captureDirectory = captureDirectory;
    this.receiptProcessor = receiptProcessor;
    this.ensureDirectory();
  }

  /**
   * Start monitoring the print capture directory
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.logger.info('Starting print monitor...', { captureDirectory: this.captureDirectory });

    try {
      // Set up file system watcher
      this.watcher = watch(this.captureDirectory, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000, // Wait 1 second for file to stabilize
          pollInterval: 100
        }
      });

      // Handle new files
      this.watcher.on('add', (filePath: string) => {
        this.handleNewFile(filePath);
      });

      // Handle errors
      this.watcher.on('error', (error: Error) => {
        this.logger.error('Print monitor watcher error:', error);
        this.emit('error', error);
      });

      this.isRunning = true;
      this.logger.info('Print monitor started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start print monitor:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping print monitor...');

    try {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      // Wait for any processing jobs to complete
      while (this.processingJobs.size > 0) {
        this.logger.info(`Waiting for ${this.processingJobs.size} jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.isRunning = false;
      this.logger.info('Print monitor stopped');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping print monitor:', error);
      throw error;
    }
  }

  /**
   * Handle new file in capture directory
   */
  private async handleNewFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const jobId = this.generateJobId(filename);

    // Skip if already processing this file
    if (this.processingJobs.has(jobId)) {
      return;
    }

    this.processingJobs.add(jobId);

    try {
      this.logger.info('New print job detected', { filename, filePath });

      // Validate file
      if (!this.isValidPrintFile(filePath)) {
        this.logger.warn('Invalid print file, skipping', { filename });
        return;
      }

      // Read file data
      const rawData = await this.readFileWithRetry(filePath);
      if (!rawData || rawData.length === 0) {
        this.logger.warn('Empty print file, skipping', { filename });
        return;
      }

      // Create print job object
      const printJob: CapturedPrintJob = {
        id: jobId,
        filename,
        filePath,
        rawData,
        capturedAt: new Date(),
        fileSize: rawData.length
      };

      this.logger.info('Processing print job', { 
        jobId, 
        filename, 
        fileSize: rawData.length 
      });

      // Process the print job
      await this.receiptProcessor.processJob(printJob);

      // Clean up the file
      await this.cleanupFile(filePath);

      this.emit('job-captured', printJob);
      this.logger.info('Print job processed successfully', { jobId });

    } catch (error) {
      this.logger.error('Error processing print job:', error, { filename });
      this.emit('job-error', { jobId, filename, error });

      // Try to clean up the file even if processing failed
      try {
        await this.cleanupFile(filePath);
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup file after error:', cleanupError);
      }

    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  /**
   * Read file with retry logic
   */
  private async readFileWithRetry(filePath: string, maxRetries: number = 3): Promise<Buffer | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if file still exists
        if (!fs.existsSync(filePath)) {
          this.logger.warn('File disappeared before reading', { filePath });
          return null;
        }

        // Read the file
        const data = fs.readFileSync(filePath);
        return data;

      } catch (error: any) {
        this.logger.warn(`File read attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          this.logger.error('Failed to read file after all retries:', error);
          return null;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return null;
  }

  /**
   * Validate if file is a valid print file
   */
  private isValidPrintFile(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      
      // Check file size (must be > 0 and < 10MB)
      if (stats.size === 0 || stats.size > 10 * 1024 * 1024) {
        return false;
      }

      // Check file extension (allow common print file extensions)
      const ext = path.extname(filePath).toLowerCase();
      const validExtensions = ['.prn', '.txt', '.ps', '.pcl', '.pdf', ''];
      
      return validExtensions.includes(ext);

    } catch (error) {
      this.logger.warn('Error validating print file:', error);
      return false;
    }
  }

  /**
   * Clean up processed file
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug('Cleaned up print file', { filePath });
      }
    } catch (error) {
      this.logger.error('Failed to cleanup print file:', error, { filePath });
      // Don't throw - cleanup failure shouldn't stop processing
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(filename: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    return `job_${timestamp}_${cleanFilename}_${random}`;
  }

  /**
   * Ensure capture directory exists
   */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.captureDirectory)) {
      fs.mkdirSync(this.captureDirectory, { recursive: true });
      this.logger.info('Created print capture directory', { captureDirectory: this.captureDirectory });
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    isRunning: boolean;
    captureDirectory: string;
    processingJobs: number;
    directoryExists: boolean;
  } {
    return {
      isRunning: this.isRunning,
      captureDirectory: this.captureDirectory,
      processingJobs: this.processingJobs.size,
      directoryExists: fs.existsSync(this.captureDirectory)
    };
  }

  /**
   * Force process all files in capture directory (for testing)
   */
  async processExistingFiles(): Promise<void> {
    if (!fs.existsSync(this.captureDirectory)) {
      return;
    }

    const files = fs.readdirSync(this.captureDirectory);
    this.logger.info(`Processing ${files.length} existing files in capture directory`);

    for (const filename of files) {
      const filePath = path.join(this.captureDirectory, filename);
      await this.handleNewFile(filePath);
    }
  }
}