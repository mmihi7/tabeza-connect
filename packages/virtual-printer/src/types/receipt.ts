/**
 * TABEZA Canonical Receipt Data Model (CRDM)
 * The heart of TABEZA - standardized receipt format
 */

import { z } from 'zod';

// Merchant Information Schema
export const MerchantSchema = z.object({
  id: z.string(),
  name: z.string(),
  kra_pin: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional()
});

// Transaction Information Schema
export const TransactionSchema = z.object({
  receipt_no: z.string(),
  datetime: z.string(), // ISO 8601 format
  currency: z.string().default('KES'),
  payment_method: z.enum(['CASH', 'MPESA', 'CARD', 'BANK', 'OTHER']).optional(),
  pos_reference: z.string().optional(),
  cashier: z.string().optional()
});

// Receipt Item Schema
export const ReceiptItemSchema = z.object({
  name: z.string(),
  sku: z.string().optional(),
  qty: z.number(),
  unit_price: z.number(),
  total_price: z.number(),
  tax_rate: z.number().optional(),
  tax_amount: z.number().optional(),
  discount: z.number().optional(),
  category: z.string().optional()
});

// Receipt Totals Schema
export const ReceiptTotalsSchema = z.object({
  subtotal: z.number(),
  tax: z.number().default(0),
  discount: z.number().default(0),
  service_charge: z.number().default(0),
  total: z.number()
});

// Receipt Footer Schema
export const ReceiptFooterSchema = z.object({
  message: z.string().optional(),
  terms: z.string().optional(),
  return_policy: z.string().optional(),
  contact_info: z.string().optional()
});

// Main Canonical Receipt Schema
export const CanonicalReceiptSchema = z.object({
  receipt_id: z.string(),
  merchant: MerchantSchema,
  transaction: TransactionSchema,
  items: z.array(ReceiptItemSchema),
  totals: ReceiptTotalsSchema,
  footer: ReceiptFooterSchema.optional(),
  signature: z.string(),
  etims_status: z.enum(['NOT_ENABLED', 'PENDING', 'SUBMITTED', 'FAILED', 'COMPLIANT']).default('NOT_ENABLED'),
  created_at: z.string(),
  updated_at: z.string()
});

// TypeScript types derived from schemas
export type Merchant = z.infer<typeof MerchantSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type ReceiptTotals = z.infer<typeof ReceiptTotalsSchema>;
export type ReceiptFooter = z.infer<typeof ReceiptFooterSchema>;
export type CanonicalReceipt = z.infer<typeof CanonicalReceiptSchema>;

// Print Format Detection Types
export type PrintFormat = 'ESC_POS' | 'PLAIN_TEXT' | 'PDF' | 'IMAGE' | 'UNKNOWN';

export interface FormatDetectionResult {
  format: PrintFormat;
  confidence: number;
  metadata?: Record<string, any>;
}

// Raw Print Job Interface
export interface RawPrintJob {
  printer_id: string;
  merchant_id: string;
  raw_format: PrintFormat;
  raw_payload: string; // base64 encoded
  printed_at: string;
  job_id?: string;
}

// Parsing Result Interface
export interface ParsingResult {
  status: 'parsed' | 'failed' | 'partial';
  confidence: number;
  receipt?: CanonicalReceipt;
  missing_fields?: string[];
  errors?: string[];
  raw_text?: string;
}

// eTIMS Compliance Types (metadata only)
export type EtimsStatus = 'NOT_ENABLED' | 'PENDING' | 'SUBMITTED' | 'FAILED' | 'COMPLIANT';

export interface EtimsSubmission {
  receipt_id: string;
  submission_id: string;
  status: EtimsStatus;
  submitted_at: string;
  response_data?: Record<string, any>;
  error_message?: string;
}

// Printer Registration Interface
export interface PrinterRegistration {
  merchant_id: string;
  model: string;
  connection: 'USB' | 'NETWORK' | 'BLUETOOTH' | 'SERIAL';
  capabilities: PrintFormat[];
  location?: string;
  description?: string;
}

// Receipt Delivery Options
export interface ReceiptDelivery {
  method: 'sms' | 'email' | 'whatsapp' | 'qr_code';
  recipient: string;
  template?: string;
  options?: Record<string, any>;
}