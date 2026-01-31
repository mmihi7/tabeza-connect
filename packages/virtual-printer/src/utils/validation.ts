/**
 * Validation utilities for receipts and configurations
 */

import { CanonicalReceipt, CanonicalReceiptSchema } from '../types/receipt';

export function validateReceipt(receipt: any): { isValid: boolean; errors: string[] } {
  try {
    CanonicalReceiptSchema.parse(receipt);
    return { isValid: true, errors: [] };
  } catch (error: any) {
    return {
      isValid: false,
      errors: error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || ['Validation failed']
    };
  }
}

export function validateMerchantId(merchantId: string): boolean {
  return typeof merchantId === 'string' && merchantId.length > 0;
}