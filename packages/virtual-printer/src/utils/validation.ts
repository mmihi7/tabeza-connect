/**
 * Validation utilities for receipt data and configurations
 */

import { CanonicalReceipt, CanonicalReceiptSchema } from '../types/receipt';
import { ZodError } from 'zod';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate receipt against schema and business rules
 */
export function validateReceipt(receipt: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Schema validation
    CanonicalReceiptSchema.parse(receipt);
  } catch (error) {
    if (error instanceof ZodError) {
      result.isValid = false;
      result.errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    } else {
      result.isValid = false;
      result.errors.push('Unknown validation error');
    }
  }

  // Business rule validations
  if (result.isValid) {
    const businessValidation = validateBusinessRules(receipt as CanonicalReceipt);
    result.errors.push(...businessValidation.errors);
    result.warnings.push(...businessValidation.warnings);
    result.isValid = businessValidation.errors.length === 0;
  }

  return result;
}

/**
 * Validate business rules
 */
function validateBusinessRules(receipt: CanonicalReceipt): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Total calculation validation
  const itemsTotal = receipt.items.reduce((sum, item) => sum + item.total_price, 0);
  const expectedTotal = receipt.totals.subtotal + receipt.totals.tax - receipt.totals.discount + receipt.totals.service_charge;
  
  if (Math.abs(itemsTotal - receipt.totals.subtotal) > 0.01) {
    errors.push('Subtotal does not match sum of item totals');
  }

  if (Math.abs(expectedTotal - receipt.totals.total) > 0.01) {
    errors.push('Total calculation is incorrect');
  }

  // 2. Item validation
  for (let i = 0; i < receipt.items.length; i++) {
    const item = receipt.items[i];
    
    if (item.qty <= 0) {
      errors.push(`Item ${i + 1}: Quantity must be positive`);
    }
    
    if (item.unit_price < 0) {
      errors.push(`Item ${i + 1}: Unit price cannot be negative`);
    }
    
    if (Math.abs(item.qty * item.unit_price - item.total_price) > 0.01) {
      errors.push(`Item ${i + 1}: Total price calculation is incorrect`);
    }
    
    if (!item.name || item.name.trim().length === 0) {
      errors.push(`Item ${i + 1}: Name is required`);
    }
    
    if (item.name.length > 100) {
      warnings.push(`Item ${i + 1}: Name is very long (${item.name.length} characters)`);
    }
  }

  // 3. Merchant validation
  if (!receipt.merchant.name || receipt.merchant.name.trim().length === 0) {
    errors.push('Merchant name is required');
  }

  if (receipt.merchant.kra_pin && !/^P\d{9}[A-Z]$/.test(receipt.merchant.kra_pin)) {
    warnings.push('KRA PIN format appears invalid (should be P#########L)');
  }

  // 4. Transaction validation
  if (!receipt.transaction.receipt_no || receipt.transaction.receipt_no.trim().length === 0) {
    errors.push('Receipt number is required');
  }

  const receiptDate = new Date(receipt.transaction.datetime);
  const now = new Date();
  
  if (receiptDate > now) {
    warnings.push('Receipt date is in the future');
  }
  
  if ((now.getTime() - receiptDate.getTime()) > 365 * 24 * 60 * 60 * 1000) {
    warnings.push('Receipt is more than 1 year old');
  }

  // 5. Currency validation
  if (receipt.transaction.currency !== 'KES') {
    warnings.push(`Non-KES currency detected: ${receipt.transaction.currency}`);
  }

  // 6. Tax validation
  if (receipt.totals.tax > 0) {
    const expectedTax = receipt.totals.subtotal * 0.16; // 16% VAT
    if (Math.abs(receipt.totals.tax - expectedTax) > receipt.totals.subtotal * 0.05) {
      warnings.push('Tax amount seems unusual (expected ~16% VAT)');
    }
  }

  // 7. Discount validation
  if (receipt.totals.discount > receipt.totals.subtotal) {
    errors.push('Discount cannot exceed subtotal');
  }

  if (receipt.totals.discount < 0) {
    errors.push('Discount cannot be negative');
  }

  return { errors, warnings };
}

/**
 * Sanitize receipt data by removing/fixing common issues
 */
export function sanitizeReceiptData(receipt: any): CanonicalReceipt {
  const sanitized = { ...receipt };

  // Sanitize merchant data
  if (sanitized.merchant) {
    sanitized.merchant.name = sanitized.merchant.name?.trim() || 'Unknown Merchant';
    sanitized.merchant.kra_pin = sanitized.merchant.kra_pin?.trim().toUpperCase() || undefined;
    sanitized.merchant.location = sanitized.merchant.location?.trim() || undefined;
    sanitized.merchant.address = sanitized.merchant.address?.trim() || undefined;
    sanitized.merchant.phone = sanitized.merchant.phone?.trim() || undefined;
    sanitized.merchant.email = sanitized.merchant.email?.trim().toLowerCase() || undefined;
  }

  // Sanitize transaction data
  if (sanitized.transaction) {
    sanitized.transaction.receipt_no = sanitized.transaction.receipt_no?.trim() || 'UNKNOWN';
    sanitized.transaction.currency = sanitized.transaction.currency?.toUpperCase() || 'KES';
    
    // Ensure datetime is ISO string
    if (sanitized.transaction.datetime) {
      try {
        sanitized.transaction.datetime = new Date(sanitized.transaction.datetime).toISOString();
      } catch {
        sanitized.transaction.datetime = new Date().toISOString();
      }
    }
  }

  // Sanitize items
  if (sanitized.items && Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items
      .filter((item: any) => item && typeof item === 'object')
      .map((item: any) => ({
        ...item,
        name: item.name?.trim() || 'Unknown Item',
        qty: Math.max(1, Number(item.qty) || 1),
        unit_price: Math.max(0, Number(item.unit_price) || 0),
        total_price: Math.max(0, Number(item.total_price) || 0),
        sku: item.sku?.trim() || undefined,
        category: item.category?.trim() || undefined,
        tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
        tax_amount: item.tax_amount ? Number(item.tax_amount) : undefined,
        discount: item.discount ? Math.max(0, Number(item.discount)) : undefined
      }));
  }

  // Sanitize totals
  if (sanitized.totals) {
    sanitized.totals.subtotal = Math.max(0, Number(sanitized.totals.subtotal) || 0);
    sanitized.totals.tax = Math.max(0, Number(sanitized.totals.tax) || 0);
    sanitized.totals.discount = Math.max(0, Number(sanitized.totals.discount) || 0);
    sanitized.totals.service_charge = Math.max(0, Number(sanitized.totals.service_charge) || 0);
    sanitized.totals.total = Math.max(0, Number(sanitized.totals.total) || 0);
  }

  // Sanitize footer
  if (sanitized.footer) {
    sanitized.footer.message = sanitized.footer.message?.trim() || undefined;
    sanitized.footer.terms = sanitized.footer.terms?.trim() || undefined;
    sanitized.footer.return_policy = sanitized.footer.return_policy?.trim() || undefined;
    sanitized.footer.contact_info = sanitized.footer.contact_info?.trim() || undefined;
  }

  // Ensure required fields
  sanitized.receipt_id = sanitized.receipt_id || `tbr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  sanitized.signature = sanitized.signature || '';
  sanitized.etims_status = sanitized.etims_status || 'NOT_ENABLED';
  sanitized.created_at = sanitized.created_at || new Date().toISOString();
  sanitized.updated_at = sanitized.updated_at || new Date().toISOString();

  return sanitized as CanonicalReceipt;
}

/**
 * Validate KRA PIN format
 */
export function validateKraPin(pin: string): boolean {
  if (!pin || typeof pin !== 'string') {
    return false;
  }
  
  // KRA PIN format: P followed by 9 digits followed by a letter
  return /^P\d{9}[A-Z]$/.test(pin.trim().toUpperCase());
}

/**
 * Validate phone number (Kenyan format)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  const cleaned = phone.replace(/\s+/g, '');
  
  // Kenyan phone number formats
  const patterns = [
    /^\+254[17]\d{8}$/, // +254 format
    /^254[17]\d{8}$/,   // 254 format
    /^0[17]\d{8}$/      // 0 format
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
}

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Validate receipt number format
 */
export function validateReceiptNumber(receiptNo: string): boolean {
  if (!receiptNo || typeof receiptNo !== 'string') {
    return false;
  }
  
  const cleaned = receiptNo.trim();
  
  // Should be alphanumeric with optional hyphens/underscores
  return /^[A-Z0-9\-_]+$/i.test(cleaned) && cleaned.length >= 3 && cleaned.length <= 50;
}

/**
 * Validate currency code
 */
export function validateCurrency(currency: string): boolean {
  if (!currency || typeof currency !== 'string') {
    return false;
  }
  
  // ISO 4217 currency codes (3 letters)
  const supportedCurrencies = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS'];
  return supportedCurrencies.includes(currency.toUpperCase());
}

/**
 * Comprehensive receipt validation with detailed feedback
 */
export function validateReceiptComprehensive(receipt: any): {
  isValid: boolean;
  score: number; // 0-100
  errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
  suggestions: string[];
} {
  const result = {
    isValid: true,
    score: 100,
    errors: [] as Array<{ field: string; message: string; severity: 'error' | 'warning' }>,
    suggestions: [] as string[]
  };

  let deductions = 0;

  // Basic validation
  const basicValidation = validateReceipt(receipt);
  
  for (const error of basicValidation.errors) {
    result.errors.push({ field: 'general', message: error, severity: 'error' });
    deductions += 20;
  }
  
  for (const warning of basicValidation.warnings) {
    result.errors.push({ field: 'general', message: warning, severity: 'warning' });
    deductions += 5;
  }

  // Additional detailed checks
  if (receipt.merchant?.kra_pin && !validateKraPin(receipt.merchant.kra_pin)) {
    result.errors.push({ 
      field: 'merchant.kra_pin', 
      message: 'Invalid KRA PIN format', 
      severity: 'warning' 
    });
    deductions += 5;
    result.suggestions.push('Ensure KRA PIN follows format P#########L');
  }

  if (receipt.merchant?.phone && !validatePhoneNumber(receipt.merchant.phone)) {
    result.errors.push({ 
      field: 'merchant.phone', 
      message: 'Invalid phone number format', 
      severity: 'warning' 
    });
    deductions += 3;
    result.suggestions.push('Use Kenyan phone number format (+254XXXXXXXXX)');
  }

  if (receipt.merchant?.email && !validateEmail(receipt.merchant.email)) {
    result.errors.push({ 
      field: 'merchant.email', 
      message: 'Invalid email format', 
      severity: 'warning' 
    });
    deductions += 3;
  }

  // Calculate final score and validity
  result.score = Math.max(0, 100 - deductions);
  result.isValid = result.errors.filter(e => e.severity === 'error').length === 0;

  // Add suggestions based on score
  if (result.score < 80) {
    result.suggestions.push('Consider reviewing receipt data for accuracy');
  }
  
  if (result.score < 60) {
    result.suggestions.push('Multiple validation issues detected - manual review recommended');
  }

  return result;
}