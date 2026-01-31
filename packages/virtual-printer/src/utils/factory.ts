/**
 * Factory utilities for creating virtual printer instances and test data
 */

import { VirtualPrinterEngine, createDefaultConfig } from '../core/virtual-printer-engine';
import { CanonicalReceipt } from '../types/receipt';
import { randomBytes } from 'crypto';

/**
 * Create a virtual printer instance with sensible defaults
 */
export function createVirtualPrinter(
  barId: string,
  supabaseUrl: string,
  supabaseKey: string,
  options: {
    secretKey?: string;
    forwardToPhysicalPrinter?: boolean;
    generateQRCode?: boolean;
    printerFilters?: string[];
  } = {}
): VirtualPrinterEngine {
  const secretKey = options.secretKey || generateSecretKey();
  const config = createDefaultConfig(barId, barId, supabaseUrl, supabaseKey, secretKey);
  
  // Apply options
  if (options.forwardToPhysicalPrinter !== undefined) {
    config.dualOutput.forwardToPhysicalPrinter = options.forwardToPhysicalPrinter;
  }
  if (options.generateQRCode !== undefined) {
    config.dualOutput.generateQRCode = options.generateQRCode;
  }
  if (options.printerFilters) {
    config.printCapture.printerFilters = options.printerFilters;
  }

  return new VirtualPrinterEngine(config);
}

/**
 * Generate a secure secret key
 */
export function generateSecretKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a test receipt for development and testing
 */
export function createTestReceipt(
  barId: string,
  options: {
    merchantName?: string;
    items?: Array<{
      name: string;
      qty: number;
      price: number;
    }>;
    paymentMethod?: 'CASH' | 'MPESA' | 'CARD';
    includeKraPin?: boolean;
  } = {}
): CanonicalReceipt {
  const now = new Date().toISOString();
  const receiptNo = `RCP${Date.now()}`;
  
  const items = options.items || [
    { name: 'Test Item 1', qty: 2, price: 100 },
    { name: 'Test Item 2', qty: 1, price: 250 }
  ];

  const receiptItems = items.map(item => ({
    name: item.name,
    qty: item.qty,
    unit_price: item.price,
    total_price: item.qty * item.price,
    tax_rate: 0.16,
    tax_amount: (item.qty * item.price) * 0.16
  }));

  const subtotal = receiptItems.reduce((sum, item) => sum + item.total_price, 0);
  const tax = receiptItems.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
  const total = subtotal + tax;

  return {
    receipt_id: `receipt_${Date.now()}`,
    merchant: {
      id: barId,
      name: options.merchantName || 'Test Merchant',
      kra_pin: options.includeKraPin ? 'P051234567M' : undefined,
      location: 'Test Location',
      address: '123 Test Street, Test City',
      phone: '+254700000000',
      email: 'test@merchant.com'
    },
    transaction: {
      receipt_no: receiptNo,
      datetime: now,
      currency: 'KES',
      payment_method: options.paymentMethod || 'CASH',
      cashier: 'Test Cashier'
    },
    items: receiptItems,
    totals: {
      subtotal,
      tax,
      discount: 0,
      service_charge: 0,
      total
    },
    signature: 'test_signature_' + Date.now(),
    etims_status: 'NOT_ENABLED',
    created_at: now,
    updated_at: now
  };
}

/**
 * Create test print data in various formats
 */
export function createTestPrintData(format: 'ESC_POS' | 'PLAIN_TEXT' | 'PDF' = 'PLAIN_TEXT'): Buffer {
  switch (format) {
    case 'ESC_POS':
      // ESC/POS commands for a simple receipt
      const escPosData = Buffer.concat([
        Buffer.from([0x1B, 0x40]), // Initialize printer
        Buffer.from([0x1B, 0x61, 0x01]), // Center align
        Buffer.from('TEST MERCHANT\n'),
        Buffer.from([0x1B, 0x61, 0x00]), // Left align
        Buffer.from('Receipt: RCP123456\n'),
        Buffer.from('Date: 2024-01-01 12:00:00\n'),
        Buffer.from('--------------------------------\n'),
        Buffer.from('Item 1           2x   100.00\n'),
        Buffer.from('Item 2           1x   250.00\n'),
        Buffer.from('--------------------------------\n'),
        Buffer.from('Total:                 350.00\n'),
        Buffer.from([0x1D, 0x56, 0x00]) // Cut paper
      ]);
      return escPosData;
    
    case 'PDF':
      // Minimal PDF header (not a real PDF, just for testing)
      return Buffer.from('%PDF-1.4\nTest Receipt Content\n%%EOF');
    
    case 'PLAIN_TEXT':
    default:
      return Buffer.from(`
TEST MERCHANT
Receipt: RCP123456
Date: 2024-01-01 12:00:00
--------------------------------
Item 1           2x   100.00
Item 2           1x   250.00
--------------------------------
Total:                 350.00
      `.trim());
  }
}

/**
 * Create a development/testing configuration
 */
export function createDevelopmentConfig(barId: string, supabaseUrl: string, supabaseKey: string) {
  return {
    barId,
    supabaseUrl,
    supabaseKey,
    printCapture: {
      platform: 'linux',
      captureMethod: 'cups',
      barId,
      printerFilters: []
    },
    dualOutput: {
      forwardToPhysicalPrinter: false,
      generateQRCode: true,
      qrCodeFormat: 'both',
      deliveryMethods: ['qr_code'],
      physicalPrinterSettings: {
        preserveFormatting: true,
        addQRToReceipt: true,
        qrPosition: 'bottom'
      }
    },
    sync: {
      maxQueueSize: 100,
      retryIntervals: [1000, 5000, 15000],
      batchSize: 5,
      connectionCheckInterval: 30000,
      priorityWeights: {
        critical: 1.0,
        high: 0.8,
        medium: 0.5,
        low: 0.2
      }
    },
    security: {
      hashAlgorithm: 'sha256',
      signatureAlgorithm: 'hmac-sha256',
      secretKey: generateSecretKey(),
      enableTimestampValidation: false, // Disabled for development
      maxReceiptAge: 86400000,
      enableIntegrityChecks: true
    }
  };
}