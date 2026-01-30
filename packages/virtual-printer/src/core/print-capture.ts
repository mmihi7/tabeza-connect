/**
 * Print Capture Layer
 * Intercepts print jobs from various sources (Windows Print Spooler, Linux CUPS, USB/Network)
 * Platform-agnostic interface for capturing print data
 */

import { EventEmitter } from 'events';
import { RawPrintJob, PrintFormat } from '../types/receipt';

export interface PrintCaptureConfig {
  platform: 'windows' | 'linux' | 'macos';
  captureMethod: 'spooler' | 'cups' | 'usb' | 'network';
  printerFilters?: string[]; // Filter by printer names
  merchantId: string;
}

export interface CapturedPrintJob {
  jobId: string;
  printerId: string;
  printerName: string;
  merchantId: string;
  rawData: Buffer;
  capturedAt: string;
  metadata: {
    platform: string;
    captureMethod: string;
    documentName?: string;
    userName?: string;
    pageCount?: number;
    jobSize: number;
  };
}

export class PrintCaptureLayer extends EventEmitter {
  private config: PrintCaptureConfig;
  private isCapturing: boolean = false;
  private captureHandlers: Map<string, any> = new Map();

  constructor(config: PrintCaptureConfig) {
    super();
    this.config = config;
  }

  /**
   * Start capturing print jobs
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Print capture is already running');
    }

    console.log(`Starting print capture on ${this.config.platform} using ${this.config.captureMethod}`);

    switch (this.config.platform) {
      case 'windows':
        await this.startWindowsCapture();
        break;
      case 'linux':
        await this.startLinuxCapture();
        break;
      case 'macos':
        await this.startMacOSCapture();
        break;
      default:
        throw new Error(`Unsupported platform: ${this.config.platform}`);
    }

    this.isCapturing = true;
    this.emit('capture-started');
  }

  /**
   * Stop capturing print jobs
   */
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    console.log('Stopping print capture');

    // Clean up platform-specific handlers
    for (const [key, handler] of this.captureHandlers) {
      try {
        if (handler.stop) {
          await handler.stop();
        }
      } catch (error) {
        console.error(`Error stopping capture handler ${key}:`, error);
      }
    }

    this.captureHandlers.clear();
    this.isCapturing = false;
    this.emit('capture-stopped');
  }

  /**
   * Windows Print Spooler capture
   */
  private async startWindowsCapture(): Promise<void> {
    if (this.config.captureMethod === 'spooler') {
      // In a real implementation, this would use Windows APIs or WMI
      // to monitor the print spooler for new jobs
      console.log('Starting Windows Print Spooler monitoring...');
      
      // Mock implementation - would use actual Windows APIs
      const mockHandler = {
        stop: () => Promise.resolve()
      };
      
      this.captureHandlers.set('windows-spooler', mockHandler);
      
      // Simulate print job detection
      this.simulatePrintJobCapture();
    } else {
      throw new Error(`Unsupported capture method for Windows: ${this.config.captureMethod}`);
    }
  }

  /**
   * Linux CUPS capture
   */
  private async startLinuxCapture(): Promise<void> {
    if (this.config.captureMethod === 'cups') {
      console.log('Starting Linux CUPS monitoring...');
      
      // In a real implementation, this would monitor CUPS job files
      // or use CUPS APIs to intercept print jobs
      const mockHandler = {
        stop: () => Promise.resolve()
      };
      
      this.captureHandlers.set('linux-cups', mockHandler);
      
      // Simulate print job detection
      this.simulatePrintJobCapture();
    } else {
      throw new Error(`Unsupported capture method for Linux: ${this.config.captureMethod}`);
    }
  }

  /**
   * macOS capture
   */
  private async startMacOSCapture(): Promise<void> {
    if (this.config.captureMethod === 'cups') {
      console.log('Starting macOS CUPS monitoring...');
      
      // macOS uses CUPS similar to Linux
      const mockHandler = {
        stop: () => Promise.resolve()
      };
      
      this.captureHandlers.set('macos-cups', mockHandler);
      
      // Simulate print job detection
      this.simulatePrintJobCapture();
    } else {
      throw new Error(`Unsupported capture method for macOS: ${this.config.captureMethod}`);
    }
  }

  /**
   * Process captured print job
   */
  private async processCapturedJob(rawData: Buffer, metadata: any): Promise<void> {
    const capturedJob: CapturedPrintJob = {
      jobId: this.generateJobId(),
      printerId: metadata.printerId || 'unknown',
      printerName: metadata.printerName || 'Unknown Printer',
      merchantId: this.config.merchantId,
      rawData,
      capturedAt: new Date().toISOString(),
      metadata: {
        platform: this.config.platform,
        captureMethod: this.config.captureMethod,
        documentName: metadata.documentName,
        userName: metadata.userName,
        pageCount: metadata.pageCount,
        jobSize: rawData.length
      }
    };

    // Apply printer filters if configured
    if (this.config.printerFilters && this.config.printerFilters.length > 0) {
      const matchesFilter = this.config.printerFilters.some(filter => 
        capturedJob.printerName.toLowerCase().includes(filter.toLowerCase())
      );
      
      if (!matchesFilter) {
        console.log(`Skipping print job from ${capturedJob.printerName} - doesn't match filters`);
        return;
      }
    }

    console.log(`Captured print job: ${capturedJob.jobId} from ${capturedJob.printerName}`);
    this.emit('job-captured', capturedJob);
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `pj_${timestamp}_${random}`;
  }

  /**
   * Simulate print job capture for testing
   */
  private simulatePrintJobCapture(): void {
    // This is for testing - remove in production
    setTimeout(() => {
      const mockReceiptData = `
POPOS RESTAURANT
123 Main Street
Nairobi, Kenya

Receipt #: 12345
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

Items:
Ugali                    150.00
Sukuma Wiki              100.00
Nyama Choma              350.00

Subtotal:                600.00
Tax (16%):                96.00
Total:                   696.00

Payment: MPESA
Thank you for dining with us!
      `.trim();

      const rawData = Buffer.from(mockReceiptData, 'utf8');
      
      this.processCapturedJob(rawData, {
        printerId: 'pos-printer-001',
        printerName: 'EPSON TM-T88V',
        documentName: 'Receipt',
        userName: 'cashier',
        pageCount: 1
      });
    }, 5000); // Simulate a print job after 5 seconds
  }

  /**
   * Get capture status
   */
  getStatus(): { isCapturing: boolean; platform: string; method: string; activeHandlers: string[] } {
    return {
      isCapturing: this.isCapturing,
      platform: this.config.platform,
      method: this.config.captureMethod,
      activeHandlers: Array.from(this.captureHandlers.keys())
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PrintCaptureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Print capture configuration updated:', this.config);
  }
}

/**
 * Factory function to create platform-specific print capture instance
 */
export function createPrintCapture(config: PrintCaptureConfig): PrintCaptureLayer {
  return new PrintCaptureLayer(config);
}

/**
 * Detect current platform
 */
export function detectPlatform(): 'windows' | 'linux' | 'macos' {
  const platform = process.platform;
  
  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get recommended capture method for platform
 */
export function getRecommendedCaptureMethod(platform: 'windows' | 'linux' | 'macos'): string {
  switch (platform) {
    case 'windows':
      return 'spooler';
    case 'linux':
    case 'macos':
      return 'cups';
    default:
      throw new Error(`No recommended capture method for platform: ${platform}`);
  }
}