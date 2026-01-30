/**
 * TABEZA Tax Rules Engine - Type Definitions
 * Pure types for tax calculations and compliance validation
 */

import { z } from 'zod';

// ============================================================================
// CORE TAX TYPES
// ============================================================================

export const VATCalculationSchema = z.object({
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  vatAmount: z.number().nonnegative('VAT amount cannot be negative'),
  total: z.number().nonnegative('Total cannot be negative'),
  rate: z.number().min(0).max(1, 'VAT rate must be between 0 and 1'),
  inclusive: z.boolean(),
  category: z.string().optional()
});

export const ExciseTaxCalculationSchema = z.object({
  baseAmount: z.number().nonnegative('Base amount cannot be negative'),
  exciseAmount: z.number().nonnegative('Excise amount cannot be negative'),
  rate: z.number().nonnegative('Excise rate cannot be negative'),
  rateType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  category: z.string()
});

export const TaxableItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  amount: z.number().positive('Amount must be positive'),
  quantity: z.number().positive('Quantity must be positive').default(1),
  category: z.string().min(1, 'Category is required'),
  sku: z.string().optional(),
  vatRate: z.number().min(0).max(1).optional(),
  exciseRate: z.number().nonnegative().optional(),
  exciseRateType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional()
});

export const TaxCalculationResultSchema = z.object({
  items: z.array(z.object({
    item: TaxableItemSchema,
    vat: VATCalculationSchema,
    excise: ExciseTaxCalculationSchema.optional()
  })),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    totalVAT: z.number().nonnegative(),
    totalExcise: z.number().nonnegative(),
    grandTotal: z.number().nonnegative()
  }),
  jurisdiction: z.string(),
  calculatedAt: z.string().datetime()
});

// ============================================================================
// COMPLIANCE TYPES
// ============================================================================

export const KRAPinValidationSchema = z.object({
  pin: z.string(),
  valid: z.boolean(),
  format: z.enum(['INDIVIDUAL', 'COMPANY', 'INVALID']),
  errors: z.array(z.string())
});

export const ComplianceValidationSchema = z.object({
  isCompliant: z.boolean(),
  jurisdiction: z.string(),
  issues: z.array(z.string()),
  warnings: z.array(z.string()),
  score: z.number().min(0).max(100),
  validatedAt: z.string().datetime()
});

// ============================================================================
// TAX RATES & RULES
// ============================================================================

export const TaxRateSchema = z.object({
  category: z.string(),
  vatRate: z.number().min(0).max(1),
  exciseRate: z.number().nonnegative().optional(),
  exciseRateType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  description: z.string().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional()
});

export const JurisdictionRulesSchema = z.object({
  jurisdiction: z.string(),
  currency: z.string(),
  standardVATRate: z.number().min(0).max(1),
  zeroRatedCategories: z.array(z.string()),
  exemptCategories: z.array(z.string()),
  taxRates: z.array(TaxRateSchema),
  pinValidationRules: z.object({
    format: z.string(), // Regex pattern
    length: z.number().int().positive(),
    checkDigit: z.boolean()
  }),
  complianceRules: z.array(z.object({
    rule: z.string(),
    description: z.string(),
    severity: z.enum(['ERROR', 'WARNING', 'INFO'])
  }))
});

// ============================================================================
// TYPESCRIPT TYPES (Derived from schemas)
// ============================================================================

export type VATCalculation = z.infer<typeof VATCalculationSchema>;
export type ExciseTaxCalculation = z.infer<typeof ExciseTaxCalculationSchema>;
export type TaxableItem = z.infer<typeof TaxableItemSchema>;
export type TaxCalculationResult = z.infer<typeof TaxCalculationResultSchema>;
export type KRAPinValidation = z.infer<typeof KRAPinValidationSchema>;
export type ComplianceValidation = z.infer<typeof ComplianceValidationSchema>;
export type TaxRate = z.infer<typeof TaxRateSchema>;
export type JurisdictionRules = z.infer<typeof JurisdictionRulesSchema>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SupportedJurisdiction = 'KE' | 'UG' | 'TZ' | 'RW';

export type TaxCategory = 
  | 'FOOD_BASIC'
  | 'FOOD_PREPARED'
  | 'BEVERAGE_NON_ALCOHOLIC'
  | 'BEVERAGE_ALCOHOLIC'
  | 'ALCOHOL'
  | 'TOBACCO'
  | 'FUEL'
  | 'MEDICAL'
  | 'EDUCATION'
  | 'TRANSPORT'
  | 'ACCOMMODATION'
  | 'RETAIL'
  | 'SERVICE'
  | 'OTHER';

export type VATRateType = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';

export type ExciseRateType = 'PERCENTAGE' | 'FIXED_AMOUNT';

// ============================================================================
// CALCULATION PARAMETERS
// ============================================================================

export interface VATCalculationParams {
  amount: number;
  rate: number;
  inclusive?: boolean;
  category?: string;
}

export interface ExciseTaxCalculationParams {
  amount: number;
  rate: number;
  rateType: ExciseRateType;
  category: string;
}

export interface TaxCalculationParams {
  items: TaxableItem[];
  jurisdiction: SupportedJurisdiction;
  merchantKRAPin?: string;
  calculationDate?: string;
}

export interface ComplianceValidationParams {
  receipt: {
    merchant: {
      kraPin?: string;
      name: string;
      registrationNo?: string;
    };
    items: Array<{
      name: string;
      amount: number;
      category?: string;
      vatRate?: number;
    }>;
    totals: {
      subtotal: number;
      tax: number;
      total: number;
    };
  };
  jurisdiction: SupportedJurisdiction;
  strictMode?: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class TaxCalculationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TaxCalculationError';
  }
}

export class ComplianceValidationError extends Error {
  constructor(
    message: string,
    public violations: string[],
    public jurisdiction: string
  ) {
    super(message);
    this.name = 'ComplianceValidationError';
  }
}

export class UnsupportedJurisdictionError extends Error {
  constructor(jurisdiction: string) {
    super(`Jurisdiction '${jurisdiction}' is not supported`);
    this.name = 'UnsupportedJurisdictionError';
  }
}