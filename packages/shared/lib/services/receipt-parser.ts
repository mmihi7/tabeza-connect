/**
 * Receipt Parser Service
 * 
 * Parses ESC/POS thermal printer data and extracts structured receipt information
 * Supports multiple POS systems and receipt formats
 */

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  modifiers?: string[];
}

export interface ParsedReceipt {
  items: ParsedReceiptItem[];
  subtotal: number;
  tax?: number;
  taxRate?: number;
  discount?: number;
  serviceCharge?: number;
  total: number;
  receiptNumber?: string;
  tableNumber?: string;
  timestamp?: string;
  paymentMethod?: string;
  cashier?: string;
  rawText: string;
  confidence: number; // 0-1, how confident we are in the parsing
}

/**
 * Parse ESC/POS receipt data
 */
export function parseESCPOSReceipt(data: Buffer): ParsedReceipt {
  // Convert ESC/POS to text
  const text = escposToText(data);
  
  // Parse structured data from text
  return parseReceiptText(text);
}

/**
 * Convert ESC/POS binary data to plain text
 */
function escposToText(data: Buffer): string {
  let text = '';
  let i = 0;
  
  while (i < data.length) {
    const byte = data[i];
    
    // Handle ESC sequences
    if (byte === 0x1B) { // ESC
      i++; // Skip ESC
      if (i >= data.length) break;
      
      const command = data[i];
      i++; // Skip command
      
      // Handle specific ESC commands that have parameters
      switch (command) {
        case 0x40: // Initialize printer
        case 0x45: // Bold on/off
        case 0x61: // Alignment
          // These commands have 1 parameter
          i++;
          break;
        case 0x21: // Select print mode
        case 0x2D: // Underline
          i++;
          break;
        default:
          // Unknown command, skip
          break;
      }
      continue;
    }
    
    // Handle GS sequences
    if (byte === 0x1D) { // GS
      i++; // Skip GS
      if (i >= data.length) break;
      
      const command = data[i];
      i++; // Skip command
      
      // Most GS commands have parameters
      if (i < data.length) {
        i++; // Skip parameter
      }
      continue;
    }
    
    // Handle FS sequences
    if (byte === 0x1C) { // FS
      i += 2; // Skip FS and command
      continue;
    }
    
    // Handle printable characters
    if (byte >= 0x20 && byte <= 0x7E) {
      text += String.fromCharCode(byte);
    } else if (byte === 0x0A) { // Line feed
      text += '\n';
    } else if (byte === 0x0D) { // Carriage return
      // Skip, we use \n for newlines
    } else if (byte === 0x09) { // Tab
      text += '\t';
    }
    
    i++;
  }
  
  return text;
}

/**
 * Parse receipt text and extract structured data
 */
function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  const items: ParsedReceiptItem[] = [];
  let subtotal = 0;
  let tax: number | undefined;
  let taxRate: number | undefined;
  let discount: number | undefined;
  let serviceCharge: number | undefined;
  let total = 0;
  let receiptNumber: string | undefined;
  let tableNumber: string | undefined;
  let timestamp: string | undefined;
  let paymentMethod: string | undefined;
  let cashier: string | undefined;
  let confidence = 0.5; // Start with medium confidence
  
  // Parse line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Extract receipt number
    if (!receiptNumber && (lowerLine.includes('receipt') || lowerLine.includes('invoice') || lowerLine.includes('bill'))) {
      const match = line.match(/(?:receipt|invoice|bill|#)\s*:?\s*(\d{3,})/i);
      if (match) {
        receiptNumber = match[1];
        confidence += 0.1;
      }
    }
    
    // Extract table number
    if (!tableNumber && (lowerLine.includes('table') || lowerLine.includes('tbl'))) {
      const match = line.match(/(?:table|tbl)\s*:?\s*(\d+)/i);
      if (match) {
        tableNumber = match[1];
        confidence += 0.15; // Table number is very important for matching
      }
    }
    
    // Extract timestamp
    if (!timestamp && (lowerLine.includes('date') || lowerLine.includes('time'))) {
      // Try to extract date/time
      const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
      const timeMatch = line.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i);
      if (dateMatch || timeMatch) {
        timestamp = line;
        confidence += 0.05;
      }
    }
    
    // Extract cashier
    if (!cashier && lowerLine.includes('cashier')) {
      const match = line.match(/cashier\s*:?\s*(.+)/i);
      if (match) {
        cashier = match[1].trim();
      }
    }
    
    // Extract payment method
    if (!paymentMethod && (lowerLine.includes('payment') || lowerLine.includes('paid'))) {
      if (lowerLine.includes('cash')) paymentMethod = 'cash';
      else if (lowerLine.includes('card')) paymentMethod = 'card';
      else if (lowerLine.includes('mpesa') || lowerLine.includes('m-pesa')) paymentMethod = 'mpesa';
    }
    
    // Extract items (format: "Item Name    Qty x Price    Total")
    // Common patterns:
    // "Beer                 2 x 150.00    300.00"
    // "Chicken Wings                      450.00"
    // "Soda                 1             50.00"
    
    const itemPattern1 = /^(.+?)\s+(\d+)\s*x\s*(\d+\.?\d*)\s+(\d+\.?\d*)$/;
    const itemPattern2 = /^(.+?)\s+(\d+)\s+(\d+\.?\d*)$/;
    const itemPattern3 = /^(.+?)\s+(\d+\.?\d*)$/;
    
    let match = line.match(itemPattern1);
    if (match) {
      const [, name, qtyStr, priceStr, totalStr] = match;
      items.push({
        name: name.trim(),
        quantity: parseInt(qtyStr),
        unitPrice: parseFloat(priceStr),
        total: parseFloat(totalStr),
      });
      confidence += 0.05;
      continue;
    }
    
    match = line.match(itemPattern2);
    if (match) {
      const [, name, qtyStr, totalStr] = match;
      const qty = parseInt(qtyStr);
      const total = parseFloat(totalStr);
      items.push({
        name: name.trim(),
        quantity: qty,
        unitPrice: total / qty,
        total,
      });
      confidence += 0.05;
      continue;
    }
    
    // Check if this looks like an item line (has a price at the end)
    match = line.match(itemPattern3);
    if (match && !lowerLine.includes('total') && !lowerLine.includes('tax') && 
        !lowerLine.includes('subtotal') && !lowerLine.includes('discount') &&
        !lowerLine.includes('service')) {
      const [, name, priceStr] = match;
      const price = parseFloat(priceStr);
      
      // Only add if price is reasonable (not a date or other number)
      if (price > 0 && price < 100000) {
        items.push({
          name: name.trim(),
          quantity: 1,
          unitPrice: price,
          total: price,
        });
        confidence += 0.03;
      }
    }
    
    // Extract subtotal
    if (lowerLine.includes('subtotal') || lowerLine.includes('sub total')) {
      const match = line.match(/(\d+\.?\d*)/);
      if (match) {
        subtotal = parseFloat(match[1]);
        confidence += 0.1;
      }
    }
    
    // Extract tax
    if (lowerLine.includes('tax') && !lowerLine.includes('total')) {
      const match = line.match(/(\d+\.?\d*)/);
      if (match) {
        tax = parseFloat(match[1]);
        confidence += 0.05;
      }
      
      // Try to extract tax rate
      const rateMatch = line.match(/(\d+)%/);
      if (rateMatch) {
        taxRate = parseFloat(rateMatch[1]);
      }
    }
    
    // Extract discount
    if (lowerLine.includes('discount')) {
      const match = line.match(/(\d+\.?\d*)/);
      if (match) {
        discount = parseFloat(match[1]);
      }
    }
    
    // Extract service charge
    if (lowerLine.includes('service')) {
      const match = line.match(/(\d+\.?\d*)/);
      if (match) {
        serviceCharge = parseFloat(match[1]);
      }
    }
    
    // Extract total (look for "TOTAL", "GRAND TOTAL", "AMOUNT DUE", etc.)
    if (lowerLine.includes('total') && !lowerLine.includes('subtotal')) {
      const match = line.match(/(\d+\.?\d*)/);
      if (match) {
        const value = parseFloat(match[1]);
        // Use the largest total value found
        if (value > total) {
          total = value;
          confidence += 0.15; // Total is very important
        }
      }
    }
  }
  
  // Calculate subtotal from items if not found
  if (subtotal === 0 && items.length > 0) {
    subtotal = items.reduce((sum, item) => sum + item.total, 0);
  }
  
  // Calculate total if not found
  if (total === 0) {
    total = subtotal;
    if (tax) total += tax;
    if (serviceCharge) total += serviceCharge;
    if (discount) total -= discount;
  }
  
  // Adjust confidence based on what we found
  if (items.length > 0) confidence += 0.1;
  if (total > 0) confidence += 0.1;
  if (receiptNumber) confidence += 0.05;
  
  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);
  
  return {
    items,
    subtotal,
    tax,
    taxRate,
    discount,
    serviceCharge,
    total,
    receiptNumber,
    tableNumber,
    timestamp,
    paymentMethod,
    cashier,
    rawText: text,
    confidence,
  };
}

/**
 * Validate parsed receipt
 */
export function validateReceipt(receipt: ParsedReceipt): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (receipt.items.length === 0) {
    errors.push('No items found in receipt');
  }
  
  if (receipt.total <= 0) {
    errors.push('Invalid total amount');
  }
  
  if (receipt.confidence < 0.3) {
    errors.push('Low confidence in parsing accuracy');
  }
  
  // Validate item totals
  for (const item of receipt.items) {
    const expectedTotal = item.quantity * item.unitPrice;
    if (Math.abs(expectedTotal - item.total) > 0.01) {
      errors.push(`Item "${item.name}" has incorrect total`);
    }
  }
  
  // Validate subtotal
  const calculatedSubtotal = receipt.items.reduce((sum, item) => sum + item.total, 0);
  if (receipt.subtotal > 0 && Math.abs(calculatedSubtotal - receipt.subtotal) > 0.01) {
    errors.push('Subtotal does not match sum of items');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
