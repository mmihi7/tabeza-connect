/**
 * Receipt Parsing Engine
 * Converts raw print output into logical receipt blocks
 * Uses regex rules, line positioning, and keyword heuristics
 */

import { CanonicalReceipt, ParsingResult, PrintFormat, ReceiptItem } from '../types/receipt';
import { FormatDetector } from './format-detector';

export class ReceiptParser {
  private formatDetector: FormatDetector;

  constructor() {
    this.formatDetector = new FormatDetector();
  }

  /**
   * Main parsing method - converts raw print data to canonical receipt
   */
  async parse(rawData: Buffer | string, merchantId: string): Promise<ParsingResult> {
    try {
      const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData, 'base64');
      
      // Detect format first
      const formatResult = this.formatDetector.detect(data);
      
      if (formatResult.confidence < 0.3) {
        return {
          status: 'failed',
          confidence: formatResult.confidence,
          errors: ['Unable to detect print format with sufficient confidence']
        };
      }

      // Parse based on detected format
      let text: string;
      switch (formatResult.format) {
        case 'ESC_POS':
          text = await this.parseESCPOS(data);
          break;
        case 'PLAIN_TEXT':
          text = data.toString('utf8');
          break;
        case 'PDF':
          text = await this.parsePDF(data);
          break;
        case 'IMAGE':
          text = await this.parseImage(data);
          break;
        default:
          return {
            status: 'failed',
            confidence: 0,
            errors: ['Unsupported format: ' + formatResult.format]
          };
      }

      // Extract receipt components from text
      const receipt = await this.extractReceiptData(text, merchantId);
      const missingFields = this.validateReceipt(receipt);

      return {
        status: missingFields.length === 0 ? 'parsed' : 'partial',
        confidence: this.calculateConfidence(receipt, missingFields),
        receipt,
        missing_fields: missingFields,
        raw_text: text
      };

    } catch (error) {
      return {
        status: 'failed',
        confidence: 0,
        errors: [error instanceof Error ? error.message : 'Unknown parsing error']
      };
    }
  }

  /**
   * Parse ESC/POS data by removing control codes and extracting text
   */
  private async parseESCPOS(data: Buffer): Promise<string> {
    let text = '';
    let i = 0;

    while (i < data.length) {
      const byte = data[i];

      // Handle ESC sequences
      if (byte === 0x1B && i + 1 < data.length) {
        const command = data[i + 1];
        
        // Skip common ESC commands
        switch (command) {
          case 0x40: // ESC @ (Initialize)
          case 0x45: // ESC E (Bold)
          case 0x61: // ESC a (Alignment)
            i += 2;
            break;
          case 0x64: // ESC d (Print and feed)
            if (i + 2 < data.length) {
              const lines = data[i + 2];
              text += '\n'.repeat(lines);
              i += 3;
            } else {
              i += 2;
            }
            break;
          default:
            i += 2; // Skip unknown ESC command
        }
      }
      // Handle GS sequences
      else if (byte === 0x1D && i + 1 < data.length) {
        const command = data[i + 1];
        
        switch (command) {
          case 0x56: // GS V (Cut paper)
            i += 3; // Skip GS V and parameter
            break;
          default:
            i += 2;
        }
      }
      // Handle printable characters
      else if (byte >= 0x20 && byte <= 0x7E) {
        text += String.fromCharCode(byte);
        i++;
      }
      // Handle line feeds and carriage returns
      else if (byte === 0x0A || byte === 0x0D) {
        text += '\n';
        i++;
      }
      // Skip other control characters
      else {
        i++;
      }
    }

    return text.trim();
  }

  /**
   * Parse PDF data (placeholder - would use pdf-parse library)
   */
  private async parsePDF(data: Buffer): Promise<string> {
    // In a real implementation, use pdf-parse or similar
    throw new Error('PDF parsing not yet implemented');
  }

  /**
   * Parse image data using OCR (placeholder - would use tesseract.js or similar)
   */
  private async parseImage(data: Buffer): Promise<string> {
    // In a real implementation, use OCR library
    throw new Error('Image OCR parsing not yet implemented');
  }

  /**
   * Extract structured receipt data from raw text
   */
  private async extractReceiptData(text: string, merchantId: string): Promise<CanonicalReceipt> {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Generate receipt ID
    const receiptId = this.generateReceiptId();
    const now = new Date().toISOString();

    // Extract merchant info (usually at the top)
    const merchant = this.extractMerchantInfo(lines, merchantId);
    
    // Extract transaction info
    const transaction = this.extractTransactionInfo(lines);
    
    // Extract items
    const items = this.extractItems(lines);
    
    // Extract totals
    const totals = this.extractTotals(lines);
    
    // Extract footer
    const footer = this.extractFooter(lines);

    // Generate signature
    const signature = this.generateSignature({
      merchant,
      transaction,
      items,
      totals
    });

    return {
      receipt_id: receiptId,
      merchant,
      transaction,
      items,
      totals,
      footer,
      signature,
      etims_status: 'NOT_ENABLED',
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Extract merchant information from receipt lines
   */
  private extractMerchantInfo(lines: string[], merchantId: string) {
    // Look for merchant name (usually first few lines)
    let name = 'Unknown Merchant';
    let kra_pin: string | undefined = undefined;
    let location: string | undefined = undefined;

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      
      // Skip very short lines or lines with only symbols
      if (line.length < 3 || /^[=\-_*]+$/.test(line)) {
        continue;
      }
      
      // First substantial line is likely the merchant name
      if (name === 'Unknown Merchant' && line.length > 3) {
        name = line;
      }
      
      // Look for KRA PIN
      if (/pin[:\s]*[a-z0-9]+/i.test(line)) {
        const match = line.match(/pin[:\s]*([a-z0-9]+)/i);
        if (match) {
          kra_pin = match[1];
        }
      }
      
      // Look for location indicators
      if (/location|address|branch/i.test(line)) {
        location = line;
      }
    }

    return {
      id: merchantId,
      name,
      kra_pin,
      location
    };
  }

  /**
   * Extract transaction information
   */
  private extractTransactionInfo(lines: string[]) {
    let receipt_no = 'UNKNOWN';
    let datetime = new Date().toISOString();
    let payment_method: 'CASH' | 'MPESA' | 'CARD' | 'BANK' | 'OTHER' | undefined = undefined;

    for (const line of lines) {
      // Receipt number patterns
      const receiptMatch = line.match(/(?:receipt|rcpt|ref)[:\s#]*([a-z0-9]+)/i);
      if (receiptMatch) {
        receipt_no = receiptMatch[1];
      }

      // Date patterns
      const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
      if (dateMatch) {
        try {
          const date = new Date(dateMatch[1]);
          if (!isNaN(date.getTime())) {
            datetime = date.toISOString();
          }
        } catch (e) {
          // Keep default datetime
        }
      }

      // Payment method
      if (/mpesa|m-pesa/i.test(line)) {
        payment_method = 'MPESA';
      } else if (/cash/i.test(line)) {
        payment_method = 'CASH';
      } else if (/card|visa|mastercard/i.test(line)) {
        payment_method = 'CARD';
      }
    }

    return {
      receipt_no,
      datetime,
      currency: 'KES',
      payment_method
    };
  }

  /**
   * Extract line items from receipt
   */
  private extractItems(lines: string[]): ReceiptItem[] {
    const items: ReceiptItem[] = [];
    
    for (const line of lines) {
      // Look for item patterns: "Item Name    Qty  Price"
      // or "Item Name              123.45"
      const itemMatch = line.match(/^(.+?)\s+(\d+)\s+(\d+\.?\d*)$/);
      if (itemMatch) {
        const [, name, qty, price] = itemMatch;
        items.push({
          name: name.trim(),
          qty: parseInt(qty),
          unit_price: parseFloat(price) / parseInt(qty),
          total_price: parseFloat(price)
        });
        continue;
      }

      // Alternative pattern: "Item Name              123.45"
      const simpleItemMatch = line.match(/^(.+?)\s+(\d+\.?\d*)$/);
      if (simpleItemMatch && !this.isTotal(line)) {
        const [, name, price] = simpleItemMatch;
        items.push({
          name: name.trim(),
          qty: 1,
          unit_price: parseFloat(price),
          total_price: parseFloat(price)
        });
      }
    }

    return items;
  }

  /**
   * Extract totals from receipt
   */
  private extractTotals(lines: string[]) {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    let total = 0;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Subtotal
      const subtotalMatch = line.match(/subtotal[:\s]*(\d+\.?\d*)/i);
      if (subtotalMatch) {
        subtotal = parseFloat(subtotalMatch[1]);
      }

      // Tax
      const taxMatch = line.match(/(?:tax|vat)[:\s]*(\d+\.?\d*)/i);
      if (taxMatch) {
        tax = parseFloat(taxMatch[1]);
      }

      // Discount
      const discountMatch = line.match(/discount[:\s]*(\d+\.?\d*)/i);
      if (discountMatch) {
        discount = parseFloat(discountMatch[1]);
      }

      // Total
      const totalMatch = line.match(/total[:\s]*(\d+\.?\d*)/i);
      if (totalMatch) {
        total = parseFloat(totalMatch[1]);
      }
    }

    // If no subtotal found, calculate from items total
    if (subtotal === 0 && total > 0) {
      subtotal = total - tax + discount;
    }

    return {
      subtotal,
      tax,
      discount,
      total: total || subtotal + tax - discount
    };
  }

  /**
   * Extract footer information
   */
  private extractFooter(lines: string[]) {
    const footerLines = lines.slice(-5); // Last 5 lines
    const message = footerLines.find(line => 
      /thank you|thanks|visit again|welcome/i.test(line)
    );

    return message ? { message } : undefined;
  }

  /**
   * Check if a line represents a total rather than an item
   */
  private isTotal(line: string): boolean {
    return /total|subtotal|tax|vat|discount|amount|balance/i.test(line);
  }

  /**
   * Generate unique receipt ID
   */
  private generateReceiptId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `tbr_${timestamp}_${random}`;
  }

  /**
   * Generate receipt signature for integrity
   */
  private generateSignature(data: any): string {
    const crypto = require('crypto');
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate receipt completeness
   */
  private validateReceipt(receipt: CanonicalReceipt): string[] {
    const missing: string[] = [];

    if (!receipt.merchant.name || receipt.merchant.name === 'Unknown Merchant') {
      missing.push('merchant_name');
    }

    if (!receipt.transaction.receipt_no || receipt.transaction.receipt_no === 'UNKNOWN') {
      missing.push('receipt_number');
    }

    if (receipt.items.length === 0) {
      missing.push('items');
    }

    if (receipt.totals.total <= 0) {
      missing.push('total_amount');
    }

    return missing;
  }

  /**
   * Calculate parsing confidence based on completeness
   */
  private calculateConfidence(receipt: CanonicalReceipt, missingFields: string[]): number {
    const totalFields = 10; // Approximate number of important fields
    const foundFields = totalFields - missingFields.length;
    return Math.max(0.1, foundFields / totalFields);
  }
}