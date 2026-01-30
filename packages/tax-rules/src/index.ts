/**
 * TABEZA Tax Rules Engine
 * Pure tax calculation logic extracted for serverless compatibility
 * 
 * This package contains only pure functions with no OS dependencies,
 * making it suitable for both cloud (Vercel) and agent (Windows) systems.
 */

import type { 
  VATCalculation, 
  ExciseTaxCalculation, 
  TaxableItem, 
  TaxCalculationResult, 
  ComplianceValidation,
  SupportedJurisdiction,
  ExciseRateType,
  ComplianceValidationParams
} from './types';
import { SUPPORTED_JURISDICTIONS } from './constants';
import { TaxRuleEngine } from './core/tax-rule-engine';
import { calculateVAT, getApplicableVATRates } from './core/vat-calculator';
import { getExciseTaxRates } from './core/excise-calculator';

// ============================================================================
// CORE EXPORTS
// ============================================================================

// Main tax rule engine
export { TaxRuleEngine } from './core/tax-rule-engine';

// Individual calculators
export {
  calculateVAT,
  calculateVATForItems,
  getVATRateForItem,
  validateVATCalculation,
  calculateEffectiveVATRate,
  isVATExempt,
  getApplicableVATRates
} from './core/vat-calculator';

export {
  calculateExciseTax,
  calculateExciseTaxForItems,
  getExciseInfoForItem,
  isSubjectToExciseTax,
  getExciseTaxRates,
  calculateTotalExciseTax,
  validateExciseTaxCalculation,
  getExciseTaxCategories,
  calculateExciseImpact
} from './core/excise-calculator';

export {
  validateKRAPin,
  extractKRAPinInfo,
  generateSampleKRAPin,
  validateMultipleKRAPins,
  isTestKRAPin,
  formatKRAPinForDisplay,
  getKRAPinValidationRules,
  validateKRAPinWithBusinessRules
} from './core/kra-pin-validator';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type {
  // Core tax types
  VATCalculation,
  ExciseTaxCalculation,
  TaxableItem,
  TaxCalculationResult,
  KRAPinValidation,
  ComplianceValidation,
  TaxRate,
  JurisdictionRules,
  
  // Utility types
  SupportedJurisdiction,
  TaxCategory,
  VATRateType,
  ExciseRateType,
  
  // Parameter types
  VATCalculationParams,
  ExciseTaxCalculationParams,
  TaxCalculationParams,
  ComplianceValidationParams
} from './types';

// Error types
export {
  TaxCalculationError,
  ComplianceValidationError,
  UnsupportedJurisdictionError
} from './types';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export {
  // Supported jurisdictions
  SUPPORTED_JURISDICTIONS,
  
  // Tax categories
  TAX_CATEGORIES,
  
  // Jurisdiction rules
  JURISDICTION_RULES,
  KENYA_TAX_RULES,
  UGANDA_TAX_RULES,
  TANZANIA_TAX_RULES,
  RWANDA_TAX_RULES,
  
  // Default values
  DEFAULT_VAT_RATE,
  DEFAULT_JURISDICTION,
  VAT_CALCULATION_PRECISION,
  EXCISE_CALCULATION_PRECISION,
  
  // Validation constants
  MIN_TAX_RATE,
  MAX_TAX_RATE,
  MIN_AMOUNT,
  MAX_AMOUNT,
  
  // KRA PIN patterns
  KRA_PIN_PATTERNS,
  
  // Category mappings
  CATEGORY_KEYWORDS,
  
  // Error messages
  ERROR_MESSAGES
} from './constants';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick VAT calculation for a single amount
 */
export function quickVATCalculation(
  amount: number,
  jurisdiction: SupportedJurisdiction = 'KE',
  inclusive: boolean = false
): VATCalculation {
  const engine = new TaxRuleEngine(jurisdiction);
  const rules = engine.getJurisdictionInfo();
  
  return calculateVAT({
    amount,
    rate: rules.standardVATRate,
    inclusive
  });
}

/**
 * Quick compliance check for a receipt
 */
export function quickComplianceCheck(
  receipt: ComplianceValidationParams['receipt'],
  jurisdiction: SupportedJurisdiction = 'KE'
): ComplianceValidation {
  const engine = new TaxRuleEngine(jurisdiction);
  return engine.validateReceipt({ receipt, jurisdiction });
}

/**
 * Get tax information for a jurisdiction
 */
export function getJurisdictionTaxInfo(jurisdiction: SupportedJurisdiction): {
  jurisdiction: SupportedJurisdiction;
  currency: string;
  standardVATRate: number;
  vatRates: Array<{ category: string; rate: number; description?: string }>;
  exciseRates: Array<{ category: string; rate: number; rateType: ExciseRateType; description?: string }>;
  complianceFeatures: string[];
} {
  const engine = new TaxRuleEngine(jurisdiction);
  const info = engine.getJurisdictionInfo();
  const vatRates = getApplicableVATRates(jurisdiction);
  const exciseRates = getExciseTaxRates(jurisdiction);
  
  return {
    ...info,
    vatRates,
    exciseRates,
    complianceFeatures: info.supportedFeatures
  };
}

/**
 * Validate and calculate taxes for items in one call
 */
export function validateAndCalculateTaxes(
  items: TaxableItem[],
  jurisdiction: SupportedJurisdiction = 'KE',
  merchantKRAPin?: string
): {
  calculation: TaxCalculationResult;
  validation: ComplianceValidation;
} {
  const engine = new TaxRuleEngine(jurisdiction);
  
  // Calculate taxes
  const calculation = engine.calculateTaxes({
    items,
    jurisdiction,
    merchantKRAPin
  });
  
  // Create receipt format for validation
  const receipt = {
    merchant: {
      kraPin: merchantKRAPin,
      name: 'Validation Merchant'
    },
    items: items.map(item => ({
      name: item.name,
      amount: item.amount * item.quantity,
      category: item.category,
      vatRate: item.vatRate
    })),
    totals: {
      subtotal: calculation.totals.subtotal,
      tax: calculation.totals.totalVAT + calculation.totals.totalExcise,
      total: calculation.totals.grandTotal
    }
  };
  
  // Validate compliance
  const validation = engine.validateReceipt({ receipt, jurisdiction });
  
  return { calculation, validation };
}

// ============================================================================
// VERSION & METADATA
// ============================================================================

export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@tabeza/tax-rules';
export const DESCRIPTION = 'Pure tax calculation logic - serverless compatible';

/**
 * Get package information
 */
export function getPackageInfo() {
  return {
    name: PACKAGE_NAME,
    version: VERSION,
    description: DESCRIPTION,
    features: [
      'VAT calculation for multiple jurisdictions',
      'Excise tax calculation',
      'KRA PIN validation (Kenya)',
      'Tax compliance validation',
      'Pure functions - no OS dependencies',
      'Serverless compatible',
      'Property-based testing support'
    ],
    supportedJurisdictions: SUPPORTED_JURISDICTIONS,
    architecture: 'Pure logic extraction for cloud/agent separation'
  };
}