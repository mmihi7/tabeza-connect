/**
 * Receipt Processor
 * Processes captured print jobs and extracts receipt data
 * 
 * NOTE: This is a temporary implementation during architectural restructure.
 * The full implementation will be moved to the agent system repository.
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

// Temporary interfaces until full extraction
export interface CapturedPrintJob {
  id: string;
  filename: string;
  filePath: string;
  rawData: Buffer;
  capturedAt: Date;
  fileSize: number;
}

export interface ProcessedReceipt {
  jobId: string;
  receiptData: any;
  confidence: number;
  processingTime: number;
  errors: string[];
  warnings: string[];
}

/**
 * Receipt Processor Class
 * Handles processing of captured print jobs
 */
export class ReceiptProcessor extends EventEmitter {
  private logger = Logger.getInstance();
  private isProcessing = false;
  private processingQueue: CapturedPrintJob[] = [];

  constructor() {
    super();
  }

  /**
   * Process a captured print job
   */
  async processJob(job: CapturedPrintJob): Promise<ProcessedReceipt> {
    const startTime = Date.now();
    this.logger.info('Processing print job', { jobId: job.id, fileSize: job.fileSize });

    try {
      // Basic processing - this will be enhanced with extracted parsing logic
      const receiptData = await this.extractReceiptData(job);
      const confidence = this.calculateConfidence(receiptData);
      
      const result: ProcessedReceipt = {
        jobId: job.id,
        receiptData,
        confidence,
        processingTime: Date.now() - startTime,
        errors: [],
        warnings: []
      };

      // Validate the extracted data (using extracted validation logic when available)
      const validation = this.validateReceiptData(receiptData);
      result.errors = validation.errors;
      result.warnings = validation.warnings;

      this.logger.info('Print job processed successfully', { 
        jobId: job.id, 
        confidence, 
        processingTime: result.processingTime 
      });

      this.emit('job-processed', result);
      return result;

    } catch (error) {
      this.logger.error('Failed to process print job:', error, { jobId: job.id });
      
      const result: ProcessedReceipt = {
        jobId: job.id,
        receiptData: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown processing error'],
        warnings: []
      };

      this.emit('job-error', result);
      return result;
    }
  }

  /**
   * Extract receipt data from raw print job
   * TODO: This will use the extracted ESC/POS parser logic
   */
  private async extractReceiptData(job: CapturedPrintJob): Promise<any> {
    // Temporary basic extraction - will be replaced with extracted parsing logic
    const rawText = job.rawData.toString('utf8');
    
    // Basic receipt structure
    const receiptData = {
      receipt_id: `tbr_${job.id}`,
      raw_data: rawText,
      extracted_at: new Date().toISOString(),
      source_file: job.filename,
      merchant: {
        name: this.extractMerchantName(rawText),
        location: this.extractMerchantLocation(rawText)
      },
      items: this.extractItems(rawText),
      totals: this.extractTotals(rawText),
      transaction: {
        datetime: job.capturedAt.toISOString(),
        receipt_no: this.extractReceiptNumber(rawText)
      }
    };

    return receiptData;
  }

  /**
   * Calculate confidence score for extracted data
   */
  private calculateConfidence(receiptData: any): number {
    let confidence = 0;
    
    // Basic confidence calculation
    if (receiptData.merchant?.name) confidence += 20;
    if (receiptData.items?.length > 0) confidence += 30;
    if (receiptData.totals?.total > 0) confidence += 25;
    if (receiptData.transaction?.receipt_no) confidence += 15;
    if (receiptData.transaction?.datetime) confidence += 10;

    return Math.min(100, confidence);
  }

  /**
   * Validate extracted receipt data
   * TODO: This will use the extracted validation logic
   */
  private validateReceiptData(receiptData: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation - will be replaced with extracted validation logic
    if (!receiptData) {
      errors.push('No receipt data extracted');
      return { errors, warnings };
    }

    if (!receiptData.merchant?.name) {
      warnings.push('Merchant name not found');
    }

    if (!receiptData.items || receiptData.items.length === 0) {
      warnings.push('No items found in receipt');
    }

    if (!receiptData.totals?.total || receiptData.totals.total <= 0) {
      warnings.push('Invalid or missing total amount');
    }

    return { errors, warnings };
  }

  // ============================================================================
  // BASIC EXTRACTION METHODS (Temporary)
  // These will be replaced with the extracted ESC/POS parser logic
  // ============================================================================

  private extractMerchantName(text: string): string {
    // Basic merchant name extraction
    const lines = text.split('\n');
    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      const trimmed = line.trim();
      if (trimmed.length > 3 && trimmed.length < 50 && !trimmed.includes('*')) {
        return trimmed;
      }
    }
    return 'Unknown Merchant';
  }

  private extractMerchantLocation(text: string): string {
    // Basic location extraction
    const locationPatterns = [
      /location[:\s]+(.+)/i,
      /address[:\s]+(.+)/i,
      /branch[:\s]+(.+)/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return '';
  }

  private extractItems(text: string): any[] {
    // Basic item extraction
    const items: any[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Look for lines with price patterns
      const priceMatch = line.match(/(.+?)\s+(\d+(?:\.\d{2})?)\s*$/);
      if (priceMatch) {
        const name = priceMatch[1].trim();
        const price = parseFloat(priceMatch[2]);
        
        if (name.length > 2 && price > 0) {
          items.push({
            name,
            qty: 1,
            unit_price: price,
            total_price: price
          });
        }
      }
    }

    return items;
  }

  private extractTotals(text: string): any {
    // Basic totals extraction
    const totalPatterns = [
      /total[:\s]+(\d+(?:\.\d{2})?)/i,
      /amount[:\s]+(\d+(?:\.\d{2})?)/i,
      /grand\s+total[:\s]+(\d+(?:\.\d{2})?)/i
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        const total = parseFloat(match[1]);
        return {
          subtotal: total,
          tax: 0,
          discount: 0,
          service_charge: 0,
          total
        };
      }
    }

    return {
      subtotal: 0,
      tax: 0,
      discount: 0,
      service_charge: 0,
      total: 0
    };
  }

  private extractReceiptNumber(text: string): string {
    // Basic receipt number extraction
    const receiptPatterns = [
      /receipt\s*#?[:\s]*([A-Z0-9\-_]+)/i,
      /ref\s*#?[:\s]*([A-Z0-9\-_]+)/i,
      /no\s*#?[:\s]*([A-Z0-9\-_]+)/i
    ];

    for (const pattern of receiptPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return `AUTO_${Date.now()}`;
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isProcessing: boolean;
    queueLength: number;
  } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length
    };
  }
}