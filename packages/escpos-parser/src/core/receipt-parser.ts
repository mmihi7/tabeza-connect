/**
 * Receipt Parsing Engine
 * Pure parsing logic extracted from virtual-printer
 * Converts raw print output into structured receipt data
 * No OS dependencies - serverless compatible
 */

import type { 
  ParsingResult, 
  ParsingOptions, 
  ParsingContext, 
  PatternMatch, 
  HeuristicResult,
  RawPrintData
} from '../types';
import { FormatDetector } from './format-detector';
import { 
  RECEIPT_PATTERNS, 
  PARSING_ERROR_CODES, 
  DEFAULT_PARSING_OPTIONS,
  PROCESSING_LIMITS,
  DEFAULT_CURRENCY
} from '../constants';
import { 
  createReceiptSession, 
  createReceiptEvent, 
  createSessionTotals,
  createCompleteSession,
  type CompleteReceiptSession,
  type LineItem,
  type EventTotals,
  type Payment
} from '@tabeza/receipt-schema';

export class ReceiptParser {
  private formatDetector: FormatDetector;

  constructor() {
    this.formatDetector = new FormatDetector();
  }

  /**
   * Main parsing method - converts raw print data to canonical receipt
   */
  async parse(
    rawData: Buffer | string | RawPrintData, 
    options: ParsingOptions
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    
    try {
      // Normalize input data
      const normalizedData = this.normalizeInput(rawData);
      const mergedOptions = { ...DEFAULT_PARSING_OPTIONS, ...options };
      
      // Validate input size
      if (normalizedData.data.length > PROCESSING_LIMITS.MAX_FILE_SIZE) {
        return this.createFailedResult('Input data too large', startTime);
      }

      // Create parsing context
      const context = this.createParsingContext(normalizedData, mergedOptions);
      
      // Detect format first
      const formatResult = this.formatDetector.detect(normalizedData.data);
      context.format = formatResult.format;
      context.confidence = formatResult.confidence;
      
      if (formatResult.confidence < (mergedOptions.minConfidence || 0.3)) {
        return this.createFailedResult(
          `Unable to detect print format with sufficient confidence (${formatResult.confidence})`,
          startTime,
          context
        );
      }

      // Parse based on detected format
      let text: string;
      try {
        text = await this.extractTextFromFormat(normalizedData.data, formatResult.format, mergedOptions);
      } catch (error) {
        if (mergedOptions.fallbackToPlainText) {
          text = normalizedData.data.toString('utf8');
          context.format = 'PLAIN_TEXT';
          context.warnings.push('Fell back to plain text parsing due to format parsing error');
        } else {
          throw error;
        }
      }

      // Check processing time limit
      if (Date.now() - startTime > (mergedOptions.maxProcessingTime || PROCESSING_LIMITS.MAX_PROCESSING_TIME)) {
        return this.createFailedResult('Processing timeout exceeded', startTime, context);
      }

      // Extract receipt components from text
      const receipt = await this.extractReceiptData(text, context, mergedOptions);
      const validationResult = this.validateReceipt(receipt, mergedOptions);

      const processingTime = Date.now() - startTime;
      const finalConfidence = this.calculateFinalConfidence(
        formatResult.confidence,
        validationResult.score,
        context
      );

      return {
        status: validationResult.errors.length === 0 ? 'success' : 
                validationResult.errors.length < 3 ? 'partial' : 'failed',
        receipt,
        confidence: finalConfidence,
        errors: validationResult.errors,
        warnings: [...context.warnings, ...validationResult.warnings],
        metadata: {
          format: context.format,
          processingTime,
          linesProcessed: context.totalLines,
          itemsFound: receipt.events.reduce((sum, event) => sum + (event.items?.length || 0), 0),
          totalsFound: !!receipt.totals,
          merchantInfoFound: !!receipt.session.merchant.name
        }
      };

    } catch (error) {
      return this.createFailedResult(
        error instanceof Error ? error.message : 'Unknown parsing error',
        startTime
      );
    }
  }

  /**
   * Parse ESC/POS data by removing control codes and extracting text
   */
  async parseEscPos(data: Buffer, options: ParsingOptions): Promise<ParsingResult> {
    const text = await this.extractTextFromEscPos(data);
    return this.parse(text, options);
  }

  /**
   * Parse plain text data
   */
  async parsePlainText(data: string, options: ParsingOptions): Promise<ParsingResult> {
    return this.parse(data, options);
  }

  /**
   * Normalize input data to consistent format
   */
  private normalizeInput(rawData: Buffer | string | RawPrintData): RawPrintData {
    if (typeof rawData === 'object' && 'data' in rawData) {
      return rawData;
    }

    const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData, 'utf8');
    
    return {
      data,
      timestamp: new Date().toISOString(),
      jobId: `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    };
  }

  /**
   * Create parsing context for stateful parsing
   */
  private createParsingContext(data: RawPrintData, options: ParsingOptions): ParsingContext {
    const text = data.data.toString('utf8');
    const lines = text.split('\n');

    return {
      merchantId: options.merchantId,
      currentLine: 0,
      totalLines: lines.length,
      format: 'UNKNOWN',
      confidence: 0,
      errors: [],
      warnings: [],
      extractedData: {}
    };
  }

  /**
   * Extract text from different formats
   */
  private async extractTextFromFormat(
    data: Buffer, 
    format: string, 
    options: ParsingOptions
  ): Promise<string> {
    switch (format) {
      case 'ESC_POS':
        return this.extractTextFromEscPos(data);
      case 'PLAIN_TEXT':
        return data.toString('utf8');
      case 'PDF':
        throw new Error('PDF parsing requires additional dependencies - not available in pure logic package');
      case 'IMAGE':
        throw new Error('Image OCR parsing requires additional dependencies - not available in pure logic package');
      default:
        if (options.fallbackToPlainText) {
          return data.toString('utf8');
        }
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Extract text from ESC/POS data by removing control codes
   */
  private async extractTextFromEscPos(data: Buffer): Promise<string> {
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
          case 0x21: // ESC ! (Character size)
            i += 3; // ESC ! + parameter
            break;
          case 0x64: // ESC d (Print and feed)
            if (i + 2 < data.length) {
              const lines = data[i + 2];
              text += '\n'.repeat(Math.min(lines, 10)); // Limit excessive line feeds
              i += 3;
            } else {
              i += 2;
            }
            break;
          default:
            // Skip unknown ESC command (assume 2 bytes)
            i += 2;
        }
      }
      // Handle GS sequences
      else if (byte === 0x1D && i + 1 < data.length) {
        const command = data[i + 1];
        
        switch (command) {
          case 0x56: // GS V (Cut paper)
            i += 3; // Skip GS V and parameter
            break;
          case 0x21: // GS ! (Character size)
            i += 3;
            break;
          default:
            i += 2;
        }
      }
      // Handle FS sequences
      else if (byte === 0x1C) {
        i += 2; // Skip FS commands
      }
      // Handle printable characters
      else if (byte >= 0x20 && byte <= 0x7E) {
        text += String.fromCharCode(byte);
        i++;
      }
      // Handle line feeds and carriage returns
      else if (byte === 0x0A) {
        text += '\n';
        i++;
      }
      else if (byte === 0x0D) {
        // Skip carriage return (we use LF for line breaks)
        i++;
      }
      // Handle tabs
      else if (byte === 0x09) {
        text += ' '; // Convert tabs to spaces
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
   * Extract structured receipt data from raw text
   */
  private async extractReceiptData(
    text: string, 
    context: ParsingContext, 
    options: ParsingOptions
  ): Promise<CompleteReceiptSession> {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, PROCESSING_LIMITS.MAX_LINES); // Limit processing

    context.totalLines = lines.length;

    // Extract components using pattern matching and heuristics
    const merchantInfo = this.extractMerchantInfo(lines, context);
    const transactionInfo = this.extractTransactionInfo(lines, context);
    const items = this.extractItems(lines, context, options);
    const totals = this.extractTotals(lines, context);
    const payment = this.extractPaymentInfo(lines, context);

    // Create receipt session
    const session = createReceiptSession({
      merchantId: context.merchantId,
      merchantName: merchantInfo.name,
      printerId: `printer_${Date.now()}`,
      sessionReference: transactionInfo.receiptNo || `session_${Date.now()}`,
      tableNumber: transactionInfo.tableNumber,
      customerIdentifier: transactionInfo.customerIdentifier,
      kraPin: merchantInfo.kraPin,
      location: merchantInfo.location,
      address: merchantInfo.address,
      phone: merchantInfo.phone,
      email: merchantInfo.email
    });

    // Create receipt event
    const event = createReceiptEvent({
      sessionId: session.tabeza_receipt_id,
      sequence: 1,
      type: 'SALE',
      items: items,
      totals: totals,
      payment: payment,
      rawHash: this.generateHash(text),
      parsedConfidence: context.confidence,
      sourceReceiptNo: transactionInfo.receiptNo,
      printedAt: transactionInfo.datetime || new Date().toISOString()
    });

    // Create session totals
    const sessionTotals = createSessionTotals([event]);

    // Create complete session
    return createCompleteSession(session, [event], sessionTotals);
  }

  /**
   * Extract merchant information from receipt lines
   */
  private extractMerchantInfo(lines: string[], context: ParsingContext) {
    let name = '';
    let kraPin: string | undefined;
    let location: string | undefined;
    let address: string | undefined;
    let phone: string | undefined;
    let email: string | undefined;

    // Look in first 10 lines for merchant info
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      
      // Skip separator lines
      if (/^[\-=_*\s]{3,}$/.test(line)) {
        continue;
      }
      
      // First substantial line is likely the merchant name
      if (!name && line.length > 2 && !/^\d+$/.test(line)) {
        name = line;
        context.extractedData.merchantInfo = { name };
      }
      
      // Look for KRA PIN
      const kraMatch = line.match(RECEIPT_PATTERNS.KRA_PIN);
      if (kraMatch) {
        kraPin = kraMatch[1];
      }
      
      // Look for phone number
      const phoneMatch = line.match(RECEIPT_PATTERNS.PHONE_NUMBER);
      if (phoneMatch) {
        phone = phoneMatch[1].replace(/\s/g, '');
      }
      
      // Look for email
      const emailMatch = line.match(RECEIPT_PATTERNS.EMAIL);
      if (emailMatch) {
        email = emailMatch[1];
      }
      
      // Look for address/location
      if (/(?:address|location|branch)/i.test(line)) {
        address = line;
      }
    }

    return {
      name: name || 'Unknown Merchant',
      kraPin,
      location,
      address,
      phone,
      email
    };
  }

  /**
   * Extract transaction information
   */
  private extractTransactionInfo(lines: string[], context: ParsingContext) {
    let receiptNo: string | undefined;
    let datetime: string | undefined;
    let tableNumber: string | undefined;
    let customerIdentifier: string | undefined;

    for (const line of lines) {
      // Receipt number patterns
      const receiptMatch = line.match(RECEIPT_PATTERNS.RECEIPT_NUMBER);
      if (receiptMatch) {
        receiptNo = receiptMatch[1];
      }

      // Date/time patterns
      const dateMatch = line.match(RECEIPT_PATTERNS.DATE_TIME);
      if (dateMatch) {
        try {
          const date = new Date(dateMatch[1]);
          if (!isNaN(date.getTime())) {
            datetime = date.toISOString();
          }
        } catch (e) {
          context.warnings.push(`Invalid date format: ${dateMatch[1]}`);
        }
      }

      // Table number
      const tableMatch = line.match(/(?:table|tbl)[\s#:]*(\d+)/i);
      if (tableMatch) {
        tableNumber = tableMatch[1];
      }
    }

    return {
      receiptNo,
      datetime,
      tableNumber,
      customerIdentifier
    };
  }

  /**
   * Extract line items from receipt
   */
  private extractItems(lines: string[], context: ParsingContext, options: ParsingOptions): LineItem[] {
    const items: LineItem[] = [];
    
    for (let i = 0; i < lines.length && items.length < PROCESSING_LIMITS.MAX_ITEMS; i++) {
      const line = lines[i];
      
      // Skip lines that are clearly totals
      if (this.isTotal(line)) {
        continue;
      }

      // Pattern 1: "Item Name    Qty  Price"
      const itemWithQtyMatch = line.match(/^(.+?)\s+(\d+)\s+(\d+\.?\d*)$/);
      if (itemWithQtyMatch) {
        const [, name, qty, totalPrice] = itemWithQtyMatch;
        const quantity = parseInt(qty);
        const total = parseFloat(totalPrice);
        
        items.push({
          name: name.trim(),
          qty: quantity,
          unit_price: total / quantity,
          total_price: total
        });
        continue;
      }

      // Pattern 2: "Item Name              123.45"
      const simpleItemMatch = line.match(/^(.+?)\s+(\d+\.?\d*)$/);
      if (simpleItemMatch && !this.isTotal(line)) {
        const [, name, price] = simpleItemMatch;
        const total = parseFloat(price);
        
        items.push({
          name: name.trim(),
          qty: 1,
          unit_price: total,
          total_price: total
        });
      }

      // Pattern 3: "Qty x Item Name @ Price"
      const qtyItemPriceMatch = line.match(/(\d+)\s*x\s*(.+?)\s*@\s*(\d+\.?\d*)/i);
      if (qtyItemPriceMatch) {
        const [, qty, name, unitPrice] = qtyItemPriceMatch;
        const quantity = parseInt(qty);
        const unit = parseFloat(unitPrice);
        
        items.push({
          name: name.trim(),
          qty: quantity,
          unit_price: unit,
          total_price: quantity * unit
        });
      }
    }

    context.extractedData.items = items;
    return items;
  }

  /**
   * Extract totals from receipt
   */
  private extractTotals(lines: string[], context: ParsingContext): EventTotals {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;
    let serviceCharge = 0;
    let total = 0;

    for (const line of lines) {
      // Subtotal
      const subtotalMatch = line.match(RECEIPT_PATTERNS.SUBTOTAL);
      if (subtotalMatch) {
        subtotal = this.parseAmount(subtotalMatch[1]);
      }

      // Tax/VAT
      const taxMatch = line.match(RECEIPT_PATTERNS.TAX);
      if (taxMatch) {
        tax = this.parseAmount(taxMatch[1]);
      }

      // Service charge
      const serviceMatch = line.match(/(?:service|srv)[\s:]*([0-9,]+\.?\d{0,2})/i);
      if (serviceMatch) {
        serviceCharge = this.parseAmount(serviceMatch[1]);
      }

      // Total
      const totalMatch = line.match(RECEIPT_PATTERNS.TOTAL);
      if (totalMatch) {
        total = this.parseAmount(totalMatch[1]);
      }
    }

    // Calculate missing values
    if (subtotal === 0 && total > 0) {
      subtotal = total - tax - serviceCharge + discount;
    }
    
    if (total === 0 && subtotal > 0) {
      total = subtotal + tax + serviceCharge - discount;
    }

    const totals = {
      subtotal,
      tax,
      discount,
      service_charge: serviceCharge,
      total
    };

    context.extractedData.totals = totals;
    return totals;
  }

  /**
   * Extract payment information
   */
  private extractPaymentInfo(lines: string[], context: ParsingContext): Payment | undefined {
    for (const line of lines) {
      // M-Pesa payment
      const mpesaMatch = line.match(RECEIPT_PATTERNS.MPESA);
      if (mpesaMatch) {
        return {
          method: 'MPESA',
          reference: mpesaMatch[1],
          amount: context.extractedData.totals?.total || 0,
          currency: DEFAULT_CURRENCY,
          status: 'COMPLETED'
        };
      }

      // Cash payment
      const cashMatch = line.match(RECEIPT_PATTERNS.CASH);
      if (cashMatch) {
        return {
          method: 'CASH',
          amount: this.parseAmount(cashMatch[1]),
          currency: DEFAULT_CURRENCY,
          status: 'COMPLETED'
        };
      }
    }

    return undefined;
  }

  /**
   * Check if a line represents a total rather than an item
   */
  private isTotal(line: string): boolean {
    return /(?:total|subtotal|tax|vat|discount|amount|balance|service|charge)/i.test(line);
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string): number {
    // Remove commas and parse
    const cleaned = amountStr.replace(/,/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Generate hash for raw data integrity
   */
  private generateHash(data: string): string {
    // Simple hash function for browser compatibility
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate receipt completeness and quality
   */
  private validateReceipt(receipt: CompleteReceiptSession, options: ParsingOptions) {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    // Check merchant name
    if (!receipt.session.merchant.name || receipt.session.merchant.name === 'Unknown Merchant') {
      errors.push('Merchant name not found');
      score -= 0.2;
    }

    // Check items
    if (receipt.events.length === 0 || !receipt.events[0].items || receipt.events[0].items.length === 0) {
      errors.push('No items found');
      score -= 0.3;
    }

    // Check totals
    if (!receipt.totals || receipt.totals.total <= 0) {
      errors.push('Total amount not found or invalid');
      score -= 0.3;
    }

    // Check receipt number
    if (!receipt.session.session_reference.startsWith('session_')) {
      warnings.push('Receipt number not found, using generated reference');
      score -= 0.1;
    }

    // Validate totals consistency
    if (receipt.totals && receipt.events[0]?.totals) {
      const eventTotal = receipt.events[0].totals.total;
      const sessionTotal = receipt.totals.total;
      
      if (Math.abs(eventTotal - sessionTotal) > 0.01) {
        warnings.push('Total amount inconsistency detected');
        score -= 0.1;
      }
    }

    return {
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Calculate final confidence score
   */
  private calculateFinalConfidence(
    formatConfidence: number,
    validationScore: number,
    context: ParsingContext
  ): number {
    const baseConfidence = (formatConfidence + validationScore) / 2;
    
    // Adjust based on extracted data quality
    let adjustment = 0;
    
    if (context.extractedData.merchantInfo) adjustment += 0.1;
    if (context.extractedData.items && context.extractedData.items.length > 0) adjustment += 0.1;
    if (context.extractedData.totals) adjustment += 0.1;
    
    // Penalize for errors and warnings
    adjustment -= context.errors.length * 0.1;
    adjustment -= context.warnings.length * 0.05;
    
    return Math.max(0.1, Math.min(1.0, baseConfidence + adjustment));
  }

  /**
   * Create failed parsing result
   */
  private createFailedResult(
    error: string, 
    startTime: number, 
    context?: ParsingContext
  ): ParsingResult {
    return {
      status: 'failed',
      confidence: 0,
      errors: [{ 
        code: PARSING_ERROR_CODES.PARSING_TIMEOUT,
        message: error,
        severity: 'error'
      }],
      warnings: context?.warnings || [],
      metadata: {
        format: context?.format || 'UNKNOWN',
        processingTime: Date.now() - startTime,
        linesProcessed: context?.totalLines || 0,
        itemsFound: 0,
        totalsFound: false,
        merchantInfoFound: false
      }
    };
  }
}