/**
 * Virtual Printer Engine
 * Main orchestrator that coordinates all components
 * Provides the primary interface for the TABEZA Virtual Printer
 */

import { EventEmitter } from 'events';
import { FormatDetector } from './format-detector';
import { ReceiptParser } from './receipt-parser';
import { attachComplianceHints, createDefaultHints } from './compliance-hook';
import { PrintCaptureLayer, PrintCaptureConfig, CapturedPrintJob } from './print-capture';
import { DualOutputManager, DualOutputConfig, ProcessedOutput } from './dual-output-manager';
import { SyncQueue, SyncConfig, DEFAULT_SYNC_CONFIG } from './sync-queue';
import { SecurityManager, SecurityConfig, DEFAULT_SECURITY_CONFIG } from './security-manager';
import { CompleteReceiptSession as CanonicalReceipt } from '@tabeza/receipt-schema';
import { ReceiptDelivery } from '../types/receipt';

// Legacy type alias for backward compatibility - removed duplicate interface

export interface VirtualPrinterConfig {
  merchantId: string;
  printCapture: PrintCaptureConfig;
  dualOutput: DualOutputConfig;
  sync: SyncConfig;
  security: SecurityConfig;
}

export interface ProcessingStats {
  totalJobsProcessed: number;
  successfulParsing: number;
  failedParsing: number;
  queuedForSync: number;
  averageProcessingTime: number;
  lastProcessedAt?: string;
}

export class VirtualPrinterEngine extends EventEmitter {
  private config: VirtualPrinterConfig;
  private formatDetector!: FormatDetector;
  private receiptParser!: ReceiptParser;
  private printCapture!: PrintCaptureLayer;
  private dualOutput!: DualOutputManager;
  private syncQueue!: SyncQueue;
  private securityManager!: SecurityManager;
  private isRunning: boolean = false;
  private stats: ProcessingStats;

  constructor(config: VirtualPrinterConfig) {
    super();
    this.config = config;
    this.stats = {
      totalJobsProcessed: 0,
      successfulParsing: 0,
      failedParsing: 0,
      queuedForSync: 0,
      averageProcessingTime: 0
    };

    this.initializeComponents();
    this.setupEventHandlers();
  }

  /**
   * Initialize all components
   */
  private initializeComponents(): void {
    console.log('Initializing TABEZA Virtual Printer Engine...');

    // Core processing components
    this.formatDetector = new FormatDetector();
    this.receiptParser = new ReceiptParser();
    
    // Infrastructure components
    this.printCapture = new PrintCaptureLayer(this.config.printCapture);
    this.dualOutput = new DualOutputManager(this.config.dualOutput);
    this.syncQueue = new SyncQueue(this.config.sync);
    this.securityManager = new SecurityManager(this.config.security);

    console.log('All components initialized successfully');
  }

  /**
   * Setup event handlers between components
   */
  private setupEventHandlers(): void {
    // Print capture events
    this.printCapture.on('job-captured', this.handleCapturedJob.bind(this));
    this.printCapture.on('capture-started', () => {
      console.log('Print capture started');
      this.emit('capture-started');
    });
    this.printCapture.on('capture-stopped', () => {
      console.log('Print capture stopped');
      this.emit('capture-stopped');
    });

    // Sync queue events
    this.syncQueue.on('connection-changed', (isOnline: boolean) => {
      console.log(`Connection status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      this.emit('connection-changed', isOnline);
    });

    this.syncQueue.on('sync-started', () => {
      this.emit('sync-started');
    });

    this.syncQueue.on('sync-completed', () => {
      this.emit('sync-completed');
    });

    this.syncQueue.on('item-synced', (item) => {
      this.emit('item-synced', item);
    });

    // Dual output events
    this.dualOutput.on('job-processed', (output: ProcessedOutput) => {
      this.emit('job-processed', output);
    });

    this.dualOutput.on('job-error', (error) => {
      this.emit('processing-error', error);
    });
  }

  /**
   * Start the virtual printer engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Virtual printer engine is already running');
    }

    console.log('Starting TABEZA Virtual Printer Engine...');

    try {
      // Start print capture
      await this.printCapture.startCapture();
      
      this.isRunning = true;
      console.log('Virtual printer engine started successfully');
      this.emit('started');

    } catch (error) {
      console.error('Failed to start virtual printer engine:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the virtual printer engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping TABEZA Virtual Printer Engine...');

    try {
      // Stop components
      await this.printCapture.stopCapture();
      this.syncQueue.stop();

      this.isRunning = false;
      console.log('Virtual printer engine stopped successfully');
      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping virtual printer engine:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Handle captured print job
   */
  private async handleCapturedJob(capturedJob: CapturedPrintJob): Promise<void> {
    const startTime = Date.now();
    console.log(`Processing captured job: ${capturedJob.jobId}`);

    try {
      this.stats.totalJobsProcessed++;

      // 1. Parse the captured print data
      const parsingResult = await this.receiptParser.parse(
        capturedJob.rawData,
        capturedJob.merchantId
      );

      if (parsingResult.status === 'failed') {
        this.stats.failedParsing++;
        console.error(`Failed to parse job ${capturedJob.jobId}:`, parsingResult.errors);
        this.emit('parsing-failed', { jobId: capturedJob.jobId, errors: parsingResult.errors });
        return;
      }

      this.stats.successfulParsing++;
      const receipt = parsingResult.receipt!;

      // 2. Apply security measures
      const signature = this.securityManager.signReceipt(receipt);
      (receipt as any).signature = signature.signature;

      // 3. Attach compliance hints (metadata only)
      const complianceHints = createDefaultHints(receipt);
      const receiptWithCompliance = attachComplianceHints(receipt, complianceHints);

      // 4. Queue for sync
      await this.syncQueue.enqueue('receipt', receiptWithCompliance, 'medium');
      this.stats.queuedForSync++;

      // 5. Process dual output
      const deliveryOptions = await this.getDeliveryOptions(receiptWithCompliance);
      const processedOutput = await this.dualOutput.processJob(
        capturedJob,
        receiptWithCompliance,
        deliveryOptions
      );

      // 6. Update statistics
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime);

      console.log(`Successfully processed job ${capturedJob.jobId} in ${processingTime}ms`);
      this.emit('job-completed', {
        jobId: capturedJob.jobId,
        receipt: receiptWithCompliance,
        output: processedOutput,
        processingTime
      });

    } catch (error) {
      console.error(`Error processing job ${capturedJob.jobId}:`, error);
      this.emit('job-error', {
        jobId: capturedJob.jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get delivery options for receipt (placeholder)
   */
  private async getDeliveryOptions(receipt: CanonicalReceipt): Promise<ReceiptDelivery[]> {
    // In a real implementation, this would check merchant settings
    // and customer preferences to determine delivery methods
    return [];
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(processingTime: number): void {
    // Update average processing time
    const totalTime = this.stats.averageProcessingTime * (this.stats.totalJobsProcessed - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalJobsProcessed;
    this.stats.lastProcessedAt = new Date().toISOString();
  }

  /**
   * Get current statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get detailed system status
   */
  getSystemStatus(): {
    isRunning: boolean;
    components: {
      printCapture: any;
      syncQueue: any;
      dualOutput: any;
    };
    stats: ProcessingStats;
  } {
    return {
      isRunning: this.isRunning,
      components: {
        printCapture: this.printCapture.getStatus(),
        syncQueue: this.syncQueue.getStats(),
        dualOutput: this.dualOutput.getConfig()
      },
      stats: this.getStats()
    };
  }

  /**
   * Process receipt manually (for testing or API integration)
   */
  async processReceiptManually(
    rawData: Buffer | string,
    merchantId: string,
    deliveryOptions?: ReceiptDelivery[]
  ): Promise<{
    receipt: CanonicalReceipt;
    signature: any;
    qrCode?: any;
    deliveryResults?: any[];
  }> {
    console.log('Processing receipt manually...');

    // Parse receipt
    const parsingResult = await this.receiptParser.parse(rawData, merchantId);
    if (parsingResult.status === 'failed') {
      throw new Error(`Parsing failed: ${parsingResult.errors?.join(', ')}`);
    }

    const receipt = parsingResult.receipt!;

    // Apply security
    const signature = this.securityManager.signReceipt(receipt);
    (receipt as any).signature = signature.signature;

    // Attach compliance hints
    const complianceHints = createDefaultHints(receipt);
    const receiptWithCompliance = attachComplianceHints(receipt, complianceHints);

    // Generate QR code
    const qrCode = await this.dualOutput['generateQRCode'](receiptWithCompliance);

    // Handle delivery if requested
    let deliveryResults;
    if (deliveryOptions && deliveryOptions.length > 0) {
      deliveryResults = await this.dualOutput['handleDelivery'](receiptWithCompliance, deliveryOptions, qrCode);
    }

    // Queue for sync
    await this.syncQueue.enqueue('receipt', receiptWithCompliance, 'high');

    return {
      receipt: receiptWithCompliance,
      signature,
      qrCode,
      deliveryResults
    };
  }

  /**
   * Force sync all queued items
   */
  async forceSync(): Promise<void> {
    await this.syncQueue.forcSync();
  }

  /**
   * Verify receipt integrity
   */
  verifyReceiptIntegrity(receipt: CanonicalReceipt, signature: any): any {
    // Convert CompleteReceiptSession to the format expected by security manager
    const legacyFormat = {
      receipt_id: receipt.session.tabeza_receipt_id,
      merchant: {
        id: receipt.session.merchant.id,
        name: receipt.session.merchant.name,
        kra_pin: receipt.session.merchant.kra_pin,
        location: receipt.session.merchant.location,
        address: receipt.session.merchant.address,
        phone: receipt.session.merchant.phone,
        email: receipt.session.merchant.email
      },
      transaction: {
        timestamp: receipt.session.opened_at,
        currency: receipt.session.currency,
        reference: receipt.session.session_reference
      },
      items: receipt.events.flatMap(event => event.items || []),
      totals: receipt.totals || {
        subtotal: 0,
        tax: 0,
        discount: 0,
        service_charge: 0,
        total: 0
      },
      footer: {
        notes: 'Session-based receipt',
        qr_code: receipt.session.session_reference
      }
    };
    
    return this.securityManager.verifyReceipt(legacyFormat as any, signature);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VirtualPrinterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    if (newConfig.printCapture) {
      this.printCapture.updateConfig(newConfig.printCapture);
    }
    
    if (newConfig.dualOutput) {
      this.dualOutput.updateConfig(newConfig.dualOutput);
    }
    
    if (newConfig.security) {
      this.securityManager.updateConfig(newConfig.security);
    }

    console.log('Virtual printer configuration updated');
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration (sanitized)
   */
  getConfig(): Omit<VirtualPrinterConfig, 'security'> & { security: any } {
    const { security, ...safeConfig } = this.config;
    return {
      ...safeConfig,
      security: this.securityManager.getConfig()
    };
  }
}

/**
 * Create default virtual printer configuration
 */
export function createDefaultConfig(merchantId: string, secretKey: string): VirtualPrinterConfig {
  return {
    merchantId,
    printCapture: {
      platform: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux',
      captureMethod: process.platform === 'win32' ? 'spooler' : 'cups',
      merchantId
    },
    dualOutput: {
      forwardToPhysicalPrinter: true,
      generateQRCode: true,
      qrCodeFormat: 'url',
      deliveryMethods: ['qr_code'],
      physicalPrinterSettings: {
        preserveFormatting: true,
        addQRToReceipt: true,
        qrPosition: 'bottom'
      }
    },
    sync: DEFAULT_SYNC_CONFIG,
    security: {
      ...DEFAULT_SECURITY_CONFIG,
      secretKey
    }
  };
}