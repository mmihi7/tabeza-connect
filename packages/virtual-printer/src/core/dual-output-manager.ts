/**
 * Dual Output Manager
 * Forwards print jobs to physical printers while generating QR codes for digital delivery
 * Ensures merchants maintain their existing workflow
 */

import { EventEmitter } from 'events';
import { CanonicalReceipt, ReceiptDelivery } from '../types/receipt';
import { CapturedPrintJob } from './print-capture';

export interface DualOutputConfig {
  forwardToPhysicalPrinter: boolean;
  generateQRCode: boolean;
  qrCodeFormat: 'url' | 'data' | 'both';
  deliveryMethods: ('sms' | 'email' | 'whatsapp' | 'qr_code')[];
  physicalPrinterSettings: {
    preserveFormatting: boolean;
    addQRToReceipt: boolean;
    qrPosition: 'top' | 'bottom' | 'separate';
  };
}

export interface ProcessedOutput {
  jobId: string;
  physicalPrintStatus: 'forwarded' | 'failed' | 'skipped';
  qrCode?: {
    data: string;
    url: string;
    format: string;
  };
  deliveryResults: {
    method: string;
    status: 'sent' | 'failed' | 'pending';
    recipient?: string;
    error?: string;
  }[];
  processedAt: string;
}

export class DualOutputManager extends EventEmitter {
  private config: DualOutputConfig;
  private qrBaseUrl: string;

  constructor(config: DualOutputConfig, qrBaseUrl: string = 'https://tabeza.app/receipt/') {
    super();
    this.config = config;
    this.qrBaseUrl = qrBaseUrl;
  }

  /**
   * Process captured print job with dual output
   */
  async processJob(
    capturedJob: CapturedPrintJob,
    parsedReceipt: CanonicalReceipt,
    deliveryOptions?: ReceiptDelivery[]
  ): Promise<ProcessedOutput> {
    console.log(`Processing dual output for job: ${capturedJob.jobId}`);

    const output: ProcessedOutput = {
      jobId: capturedJob.jobId,
      physicalPrintStatus: 'skipped',
      deliveryResults: [],
      processedAt: new Date().toISOString()
    };

    try {
      // 1. Forward to physical printer if enabled
      if (this.config.forwardToPhysicalPrinter) {
        output.physicalPrintStatus = await this.forwardToPhysicalPrinter(capturedJob, parsedReceipt);
      }

      // 2. Generate QR code if enabled
      if (this.config.generateQRCode) {
        output.qrCode = await this.generateQRCode(parsedReceipt);
      }

      // 3. Handle digital delivery
      if (deliveryOptions && deliveryOptions.length > 0) {
        output.deliveryResults = await this.handleDelivery(parsedReceipt, deliveryOptions, output.qrCode);
      }

      this.emit('job-processed', output);
      return output;

    } catch (error) {
      console.error(`Error processing dual output for job ${capturedJob.jobId}:`, error);
      this.emit('job-error', { jobId: capturedJob.jobId, error });
      throw error;
    }
  }

  /**
   * Forward print job to physical printer
   */
  private async forwardToPhysicalPrinter(
    capturedJob: CapturedPrintJob,
    parsedReceipt: CanonicalReceipt
  ): Promise<'forwarded' | 'failed'> {
    try {
      console.log(`Forwarding job ${capturedJob.jobId} to physical printer: ${capturedJob.printerName}`);

      let printData = capturedJob.rawData;

      // Add QR code to receipt if configured
      if (this.config.physicalPrinterSettings.addQRToReceipt) {
        printData = await this.addQRToPhysicalReceipt(printData, parsedReceipt);
      }

      // In a real implementation, this would send the data to the actual printer
      // For now, we'll simulate the forwarding
      await this.simulatePhysicalPrint(capturedJob.printerId, printData);

      console.log(`Successfully forwarded job ${capturedJob.jobId} to physical printer`);
      return 'forwarded';

    } catch (error) {
      console.error(`Failed to forward job ${capturedJob.jobId} to physical printer:`, error);
      return 'failed';
    }
  }

  /**
   * Add QR code to physical receipt
   */
  private async addQRToPhysicalReceipt(
    originalData: Buffer,
    parsedReceipt: CanonicalReceipt
  ): Promise<Buffer> {
    const qrCode = await this.generateQRCode(parsedReceipt);
    const qrText = `\n\nDigital Receipt: ${qrCode.url}\nScan QR code for digital copy\n`;

    // Convert original data to string, add QR info, convert back to buffer
    const originalText = originalData.toString('utf8');
    
    switch (this.config.physicalPrinterSettings.qrPosition) {
      case 'top':
        return Buffer.from(qrText + '\n' + originalText, 'utf8');
      case 'bottom':
        return Buffer.from(originalText + '\n' + qrText, 'utf8');
      case 'separate':
        // Print QR on separate receipt
        await this.printSeparateQR(qrCode);
        return originalData;
      default:
        return Buffer.from(originalText + '\n' + qrText, 'utf8');
    }
  }

  /**
   * Generate QR code for digital receipt
   */
  private async generateQRCode(receipt: CanonicalReceipt): Promise<{
    data: string;
    url: string;
    format: string;
  }> {
    const receiptUrl = `${this.qrBaseUrl}${receipt.receipt_id}`;
    
    let qrData: string;
    switch (this.config.qrCodeFormat) {
      case 'url':
        qrData = receiptUrl;
        break;
      case 'data':
        qrData = JSON.stringify({
          id: receipt.receipt_id,
          merchant: receipt.merchant.name,
          total: receipt.totals.total,
          date: receipt.transaction.datetime
        });
        break;
      case 'both':
        qrData = JSON.stringify({
          url: receiptUrl,
          receipt: {
            id: receipt.receipt_id,
            merchant: receipt.merchant.name,
            total: receipt.totals.total,
            date: receipt.transaction.datetime
          }
        });
        break;
      default:
        qrData = receiptUrl;
    }

    return {
      data: qrData,
      url: receiptUrl,
      format: this.config.qrCodeFormat
    };
  }

  /**
   * Handle digital delivery of receipts
   */
  private async handleDelivery(
    receipt: CanonicalReceipt,
    deliveryOptions: ReceiptDelivery[],
    qrCode?: { data: string; url: string; format: string }
  ): Promise<{ method: string; status: 'sent' | 'failed' | 'pending'; recipient?: string; error?: string }[]> {
    const results = [];

    for (const delivery of deliveryOptions) {
      try {
        console.log(`Delivering receipt via ${delivery.method} to ${delivery.recipient}`);

        const result = await this.deliverReceipt(receipt, delivery, qrCode);
        results.push({
          method: delivery.method,
          status: result.success ? 'sent' : 'failed',
          recipient: delivery.recipient,
          error: result.error
        });

      } catch (error) {
        results.push({
          method: delivery.method,
          status: 'failed',
          recipient: delivery.recipient,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results as { method: string; status: "failed" | "sent" | "pending"; recipient?: string; error?: string; }[];
  }

  /**
   * Deliver receipt via specific method
   */
  private async deliverReceipt(
    receipt: CanonicalReceipt,
    delivery: ReceiptDelivery,
    qrCode?: { data: string; url: string; format: string }
  ): Promise<{ success: boolean; error?: string }> {
    switch (delivery.method) {
      case 'sms':
        return await this.sendSMS(receipt, delivery.recipient, qrCode);
      case 'email':
        return await this.sendEmail(receipt, delivery.recipient, qrCode);
      case 'whatsapp':
        return await this.sendWhatsApp(receipt, delivery.recipient, qrCode);
      case 'qr_code':
        return await this.generateQRDelivery(receipt, qrCode);
      default:
        return { success: false, error: `Unsupported delivery method: ${delivery.method}` };
    }
  }

  /**
   * Send receipt via SMS
   */
  private async sendSMS(
    receipt: CanonicalReceipt,
    phoneNumber: string,
    qrCode?: { data: string; url: string; format: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const message = `Receipt from ${receipt.merchant.name}\nTotal: KES ${receipt.totals.total}\nDigital copy: ${qrCode?.url || 'N/A'}`;
      
      // In a real implementation, integrate with SMS provider (Twilio, Africa's Talking, etc.)
      console.log(`SMS to ${phoneNumber}: ${message}`);
      
      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'SMS sending failed' };
    }
  }

  /**
   * Send receipt via email
   */
  private async sendEmail(
    receipt: CanonicalReceipt,
    email: string,
    qrCode?: { data: string; url: string; format: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subject = `Receipt from ${receipt.merchant.name} - ${receipt.transaction.receipt_no}`;
      const body = this.generateEmailBody(receipt, qrCode);
      
      // In a real implementation, integrate with email provider
      console.log(`Email to ${email}: ${subject}`);
      console.log(body);
      
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Email sending failed' };
    }
  }

  /**
   * Send receipt via WhatsApp
   */
  private async sendWhatsApp(
    receipt: CanonicalReceipt,
    phoneNumber: string,
    qrCode?: { data: string; url: string; format: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const message = `🧾 Receipt from *${receipt.merchant.name}*\n\nTotal: *KES ${receipt.totals.total}*\nDate: ${new Date(receipt.transaction.datetime).toLocaleDateString()}\n\n📱 View digital receipt: ${qrCode?.url || 'N/A'}`;
      
      // In a real implementation, integrate with WhatsApp Business API
      console.log(`WhatsApp to ${phoneNumber}: ${message}`);
      
      // Simulate WhatsApp sending
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'WhatsApp sending failed' };
    }
  }

  /**
   * Generate QR code delivery
   */
  private async generateQRDelivery(
    receipt: CanonicalReceipt,
    qrCode?: { data: string; url: string; format: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // In a real implementation, this would generate an actual QR code image
      console.log(`Generated QR code for receipt ${receipt.receipt_id}: ${qrCode?.data}`);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'QR code generation failed' };
    }
  }

  /**
   * Generate email body for receipt
   */
  private generateEmailBody(
    receipt: CanonicalReceipt,
    qrCode?: { data: string; url: string; format: string }
  ): string {
    return `
Dear Customer,

Thank you for your purchase at ${receipt.merchant.name}.

Receipt Details:
- Receipt Number: ${receipt.transaction.receipt_no}
- Date: ${new Date(receipt.transaction.datetime).toLocaleDateString()}
- Total Amount: KES ${receipt.totals.total}

Items:
${receipt.items.map(item => `- ${item.name} x${item.qty}: KES ${item.total_price}`).join('\n')}

${qrCode ? `\nView your digital receipt: ${qrCode.url}` : ''}

Best regards,
${receipt.merchant.name}

---
This receipt was generated by TABEZA Virtual Printer
    `.trim();
  }

  /**
   * Simulate physical printing
   */
  private async simulatePhysicalPrint(printerId: string, data: Buffer): Promise<void> {
    console.log(`Simulating print to ${printerId}, data size: ${data.length} bytes`);
    // In a real implementation, this would send data to the actual printer
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Print separate QR code receipt
   */
  private async printSeparateQR(qrCode: { data: string; url: string; format: string }): Promise<void> {
    const qrReceipt = `
DIGITAL RECEIPT
${qrCode.url}

Scan QR code above for
digital copy of your receipt

Powered by TABEZA
    `.trim();

    console.log('Printing separate QR receipt:', qrReceipt);
    // In a real implementation, send this to the printer
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DualOutputConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Dual output configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): DualOutputConfig {
    return { ...this.config };
  }
}