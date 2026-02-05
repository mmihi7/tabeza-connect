/**
 * TABEZA Validation Library - Data Sanitizer
 * Pure data sanitization functions extracted from virtual-printer
 */

import type { CompleteReceiptSession } from '@tabeza/receipt-schema';
import type { 
  SanitizationOptions, 
  SanitizationResult, 
  SanitizeDataParams 
} from '../types';
import { SANITIZATION_RULES, VALIDATION_PATTERNS } from '../constants';

/**
 * Sanitize receipt data by removing/fixing common issues
 */
export function sanitizeReceiptData(
  receipt: CompleteReceiptSession, 
  options: SanitizationOptions = {
    trimWhitespace: true,
    normalizeUnicode: true,
    removeControlChars: true,
    validateFormat: true,
    strictMode: false
  }
): { 
  sanitized: CompleteReceiptSession; 
  changes: Array<{ field: string; reason: string; originalValue?: any; sanitizedValue?: any; }>; 
  warnings: string[];
  original?: any;
} {
  const changes: Array<{ field: string; reason: string }> = [];
  const sanitized = JSON.parse(JSON.stringify(receipt)); // Deep clone

  try {
    // Sanitize session data
    if (sanitized.session) {
      const sessionChanges = sanitizeSessionData(sanitized.session);
      changes.push(...sessionChanges);
    }

    // Sanitize events
    if (sanitized.events && Array.isArray(sanitized.events)) {
      sanitized.events.forEach((event: any, index: number) => {
        const eventChanges = sanitizeEventData(event, index);
        changes.push(...eventChanges);
      });
    }

    // Sanitize totals
    if (sanitized.totals) {
      const totalsChanges = sanitizeTotalsData(sanitized.totals);
      changes.push(...totalsChanges);
    }

    // Sanitize metadata
    const metadataChanges = sanitizeMetadata(sanitized);
    changes.push(...metadataChanges);

    return {
      sanitized,
      changes,
      warnings: [],
      original: receipt
    };

  } catch (error) {
    return {
      sanitized: receipt,
      changes: [],
      warnings: [error instanceof Error ? error.message : 'Unknown sanitization error'],
      original: receipt
    };
  }
}

/**
 * Sanitize phone number to standard format
 */
export function sanitizePhoneNumber(phone: string): string {
  if (typeof phone !== 'string') return phone;
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle Kenya numbers
  if (cleaned.match(/^0[17]\d{8}$/)) {
    return '254' + cleaned.substring(1);
  }
  if (cleaned.match(/^254[17]\d{8}$/)) {
    return cleaned;
  }
  if (cleaned.match(/^\+254[17]\d{8}$/)) {
    return cleaned.substring(1);
  }
  
  return phone; // Return original if no pattern matches
}

/**
 * Sanitize amount to proper decimal format
 */
export function sanitizeAmount(amount: any): number {
  if (typeof amount === 'number') {
    return Math.round(amount * 100) / 100; // Round to 2 decimal places
  }
  
  if (typeof amount === 'string') {
    // Remove commas and parse
    const cleaned = amount.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    
    if (!isNaN(parsed)) {
      return Math.round(parsed * 100) / 100;
    }
  }
  
  return 0; // Default to 0 for invalid amounts
}

/**
 * Sanitize text by removing control characters and normalizing whitespace
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return text;
  
  return text
    .replace(VALIDATION_PATTERNS.CONTROL_CHARS, '')
    .replace(VALIDATION_PATTERNS.EXCESSIVE_WHITESPACE, ' ')
    .replace(VALIDATION_PATTERNS.LEADING_TRAILING_WHITESPACE, '');
}

/**
 * Normalize receipt data structure
 */
export function normalizeReceiptData(receipt: CompleteReceiptSession): CompleteReceiptSession {
  const normalized = JSON.parse(JSON.stringify(receipt));

  // Normalize timestamps to ISO format
  if (normalized.created_at) {
    normalized.created_at = new Date(normalized.created_at).toISOString();
  }
  if (normalized.updated_at) {
    normalized.updated_at = new Date(normalized.updated_at).toISOString();
  }

  // Normalize session timestamps
  if (normalized.session) {
    if (normalized.session.opened_at) {
      normalized.session.opened_at = new Date(normalized.session.opened_at).toISOString();
    }
    if (normalized.session.closed_at) {
      normalized.session.closed_at = new Date(normalized.session.closed_at).toISOString();
    }
  }

  // Normalize event timestamps
  if (normalized.events) {
    normalized.events.forEach((event: any) => {
      if (event.printed_at) {
        event.printed_at = new Date(event.printed_at).toISOString();
      }
    });
  }

  return normalized;
}

/**
 * Apply sanitization rules to data
 */
export function applySanitizationRules(data: any, rules: string[] = []): any {
  const rulesToApply = rules.length > 0 
    ? SANITIZATION_RULES.filter(rule => rules.includes(rule.name))
    : SANITIZATION_RULES;

  let sanitized = data;

  for (const rule of rulesToApply) {
    try {
      sanitized = applySanitizationRuleRecursively(sanitized, rule);
    } catch (error) {
      console.warn(`Failed to apply sanitization rule ${rule.name}:`, error);
    }
  }

  return sanitized;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sanitizeSessionData(session: any): Array<{ field: string; reason: string }> {
  const changes: Array<{ field: string; reason: string }> = [];

  // Sanitize merchant data
  if (session.merchant) {
    const originalName = session.merchant.name;
    session.merchant.name = sanitizeText(session.merchant.name || 'Unknown Merchant');
    if (originalName !== session.merchant.name) {
      changes.push({ field: 'session.merchant.name', reason: 'Normalized text formatting' });
    }

    if (session.merchant.kra_pin) {
      const originalPin = session.merchant.kra_pin;
      session.merchant.kra_pin = session.merchant.kra_pin.trim().toUpperCase();
      if (originalPin !== session.merchant.kra_pin) {
        changes.push({ field: 'session.merchant.kra_pin', reason: 'Normalized KRA PIN format' });
      }
    }

    if (session.merchant.phone) {
      const originalPhone = session.merchant.phone;
      session.merchant.phone = sanitizePhoneNumber(session.merchant.phone);
      if (originalPhone !== session.merchant.phone) {
        changes.push({ field: 'session.merchant.phone', reason: 'Normalized phone number format' });
      }
    }

    if (session.merchant.email) {
      const originalEmail = session.merchant.email;
      session.merchant.email = session.merchant.email.trim().toLowerCase();
      if (originalEmail !== session.merchant.email) {
        changes.push({ field: 'session.merchant.email', reason: 'Normalized email format' });
      }
    }
  }

  // Sanitize currency
  if (session.currency) {
    const originalCurrency = session.currency;
    session.currency = session.currency.toUpperCase();
    if (originalCurrency !== session.currency) {
      changes.push({ field: 'session.currency', reason: 'Normalized currency code' });
    }
  }

  return changes;
}

function sanitizeEventData(event: any, eventIndex: number): Array<{ field: string; reason: string }> {
  const changes: Array<{ field: string; reason: string }> = [];

  // Sanitize items
  if (event.items && Array.isArray(event.items)) {
    event.items = event.items
      .filter((item: any) => item && typeof item === 'object')
      .map((item: any, itemIndex: number) => {
        const sanitizedItem = { ...item };
        
        // Sanitize item name
        const originalName = sanitizedItem.name;
        sanitizedItem.name = sanitizeText(sanitizedItem.name || 'Unknown Item');
        if (originalName !== sanitizedItem.name) {
          changes.push({ 
            field: `events[${eventIndex}].items[${itemIndex}].name`, 
            reason: 'Normalized item name' 
          });
        }

        // Sanitize quantities and prices
        const originalQty = sanitizedItem.qty;
        sanitizedItem.qty = Math.max(1, Number(sanitizedItem.qty) || 1);
        if (originalQty !== sanitizedItem.qty) {
          changes.push({ 
            field: `events[${eventIndex}].items[${itemIndex}].qty`, 
            reason: 'Ensured positive quantity' 
          });
        }

        const originalUnitPrice = sanitizedItem.unit_price;
        sanitizedItem.unit_price = sanitizeAmount(sanitizedItem.unit_price);
        if (originalUnitPrice !== sanitizedItem.unit_price) {
          changes.push({ 
            field: `events[${eventIndex}].items[${itemIndex}].unit_price`, 
            reason: 'Normalized amount format' 
          });
        }

        const originalTotalPrice = sanitizedItem.total_price;
        sanitizedItem.total_price = sanitizeAmount(sanitizedItem.total_price);
        if (originalTotalPrice !== sanitizedItem.total_price) {
          changes.push({ 
            field: `events[${eventIndex}].items[${itemIndex}].total_price`, 
            reason: 'Normalized amount format' 
          });
        }

        // Sanitize optional fields
        if (sanitizedItem.sku) {
          sanitizedItem.sku = sanitizeText(sanitizedItem.sku);
        }
        if (sanitizedItem.category) {
          sanitizedItem.category = sanitizeText(sanitizedItem.category);
        }

        return sanitizedItem;
      });
  }

  // Sanitize event totals
  if (event.totals) {
    const totalsChanges = sanitizeTotalsData(event.totals, `events[${eventIndex}].totals`);
    changes.push(...totalsChanges);
  }

  return changes;
}

function sanitizeTotalsData(totals: any, prefix: string = 'totals'): Array<{ field: string; reason: string }> {
  const changes: Array<{ field: string; reason: string }> = [];

  const amountFields = ['subtotal', 'tax', 'discount', 'service_charge', 'total', 'paid', 'balance'];
  
  for (const field of amountFields) {
    if (totals[field] !== undefined) {
      const originalValue = totals[field];
      totals[field] = sanitizeAmount(totals[field]);
      if (originalValue !== totals[field]) {
        changes.push({ 
          field: `${prefix}.${field}`, 
          reason: 'Normalized amount format' 
        });
      }
    }
  }

  return changes;
}

function sanitizeMetadata(receipt: any): Array<{ field: string; reason: string }> {
  const changes: Array<{ field: string; reason: string }> = [];

  // Ensure required metadata fields
  if (!receipt.created_at) {
    receipt.created_at = new Date().toISOString();
    changes.push({ field: 'created_at', reason: 'Added missing timestamp' });
  }

  if (!receipt.updated_at) {
    receipt.updated_at = new Date().toISOString();
    changes.push({ field: 'updated_at', reason: 'Added missing timestamp' });
  }

  // Normalize timestamps
  try {
    const originalCreated = receipt.created_at;
    receipt.created_at = new Date(receipt.created_at).toISOString();
    if (originalCreated !== receipt.created_at) {
      changes.push({ field: 'created_at', reason: 'Normalized timestamp format' });
    }
  } catch {
    receipt.created_at = new Date().toISOString();
    changes.push({ field: 'created_at', reason: 'Fixed invalid timestamp' });
  }

  try {
    const originalUpdated = receipt.updated_at;
    receipt.updated_at = new Date(receipt.updated_at).toISOString();
    if (originalUpdated !== receipt.updated_at) {
      changes.push({ field: 'updated_at', reason: 'Normalized timestamp format' });
    }
  } catch {
    receipt.updated_at = new Date().toISOString();
    changes.push({ field: 'updated_at', reason: 'Fixed invalid timestamp' });
  }

  return changes;
}

function applySanitizationRuleRecursively(obj: any, rule: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string' || typeof obj === 'number') {
    return rule.sanitize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => applySanitizationRuleRecursively(item, rule));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = applySanitizationRuleRecursively(value, rule);
    }
    return result;
  }

  return obj;
}