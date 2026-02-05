/**
 * TABEZA Tax Rules Engine - VAT Calculator
 * Pure VAT calculation functions with no OS dependencies
 */

import type { 
  VATCalculation, 
  VATCalculationParams,
  TaxableItem,
  SupportedJurisdiction 
} from '../types';
import { 
  VAT_CALCULATION_PRECISION,
  MIN_TAX_RATE,
  MAX_TAX_RATE,
  MIN_AMOUNT,
  JURISDICTION_RULES 
} from '../constants';
import { TaxCalculationError } from '../types';

/**
 * Calculate VAT for a single amount
 */
export function calculateVAT(params: VATCalculationParams): VATCalculation {
  const { amount, rate, inclusive = false, category } = params;

  // Validation
  if (amount < MIN_AMOUNT) {
    throw new TaxCalculationError(
      `Amount must be at least ${MIN_AMOUNT}`,
      'INVALID_AMOUNT',
      { amount, minimum: MIN_AMOUNT }
    );
  }

  if (rate < MIN_TAX_RATE || rate > MAX_TAX_RATE) {
    throw new TaxCalculationError(
      `VAT rate must be between ${MIN_TAX_RATE} and ${MAX_TAX_RATE}`,
      'INVALID_VAT_RATE',
      { rate, minimum: MIN_TAX_RATE, maximum: MAX_TAX_RATE }
    );
  }

  let subtotal: number;
  let vatAmount: number;
  let total: number;

  if (inclusive) {
    // Amount includes VAT - extract it
    total = amount;
    subtotal = amount / (1 + rate);
    vatAmount = amount - subtotal;
  } else {
    // Amount excludes VAT - add it
    subtotal = amount;
    vatAmount = amount * rate;
    total = amount + vatAmount;
  }

  // Round to specified precision
  subtotal = Math.round(subtotal * Math.pow(10, VAT_CALCULATION_PRECISION)) / Math.pow(10, VAT_CALCULATION_PRECISION);
  vatAmount = Math.round(vatAmount * Math.pow(10, VAT_CALCULATION_PRECISION)) / Math.pow(10, VAT_CALCULATION_PRECISION);
  total = Math.round(total * Math.pow(10, VAT_CALCULATION_PRECISION)) / Math.pow(10, VAT_CALCULATION_PRECISION);

  return {
    subtotal,
    vatAmount,
    total,
    rate,
    inclusive,
    category
  };
}

/**
 * Calculate VAT for multiple items
 */
export function calculateVATForItems(
  items: TaxableItem[],
  jurisdiction: SupportedJurisdiction
): Array<{ item: TaxableItem; vat: VATCalculation }> {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    throw new TaxCalculationError(
      `Unsupported jurisdiction: ${jurisdiction}`,
      'UNSUPPORTED_JURISDICTION',
      { jurisdiction }
    );
  }

  return items.map(item => {
    // Determine VAT rate for this item
    const vatRate = getVATRateForItem(item, jurisdiction);
    
    // Calculate total amount for this item
    const itemTotal = item.amount * item.quantity;
    
    // Calculate VAT
    const vat = calculateVAT({
      amount: itemTotal,
      rate: vatRate,
      inclusive: false, // Assume amounts are exclusive unless specified
      category: item.category
    });

    return { item, vat };
  });
}

/**
 * Get VAT rate for a specific item based on jurisdiction rules
 */
export function getVATRateForItem(
  item: TaxableItem,
  jurisdiction: SupportedJurisdiction
): number {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    throw new TaxCalculationError(
      `Unsupported jurisdiction: ${jurisdiction}`,
      'UNSUPPORTED_JURISDICTION',
      { jurisdiction }
    );
  }

  // Use explicit VAT rate if provided
  if (item.vatRate !== undefined) {
    return item.vatRate;
  }

  // Check if category is zero-rated
  if (rules.zeroRatedCategories.includes(item.category)) {
    return 0.00;
  }

  // Check if category is exempt (treated as zero-rated for calculation)
  if (rules.exemptCategories.includes(item.category)) {
    return 0.00;
  }

  // Find specific rate for category
  const categoryRate = rules.taxRates.find(rate => rate.category === item.category);
  if (categoryRate) {
    return categoryRate.vatRate;
  }

  // Default to standard VAT rate
  return rules.standardVATRate;
}

/**
 * Validate VAT calculation accuracy
 */
export function validateVATCalculation(
  subtotal: number,
  vatAmount: number,
  total: number,
  rate: number,
  inclusive: boolean = false
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Recalculate to check accuracy
  try {
    const calculated = calculateVAT({
      amount: inclusive ? total : subtotal,
      rate,
      inclusive
    });

    const tolerance = 0.01; // 1 cent tolerance for rounding

    if (Math.abs(calculated.subtotal - subtotal) > tolerance) {
      errors.push(`Subtotal mismatch: expected ${calculated.subtotal}, got ${subtotal}`);
    }

    if (Math.abs(calculated.vatAmount - vatAmount) > tolerance) {
      errors.push(`VAT amount mismatch: expected ${calculated.vatAmount}, got ${vatAmount}`);
    }

    if (Math.abs(calculated.total - total) > tolerance) {
      errors.push(`Total mismatch: expected ${calculated.total}, got ${total}`);
    }

  } catch (error) {
    errors.push(`Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate effective VAT rate from amounts
 */
export function calculateEffectiveVATRate(
  subtotal: number,
  vatAmount: number
): number {
  if (subtotal <= 0) {
    return 0;
  }

  const rate = vatAmount / subtotal;
  return Math.round(rate * Math.pow(10, VAT_CALCULATION_PRECISION + 2)) / Math.pow(10, VAT_CALCULATION_PRECISION + 2);
}

/**
 * Check if an item category is VAT exempt in a jurisdiction
 */
export function isVATExempt(
  category: string,
  jurisdiction: SupportedJurisdiction
): boolean {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    return false;
  }

  return rules.exemptCategories.includes(category) || 
         rules.zeroRatedCategories.includes(category);
}

/**
 * Get all applicable VAT rates for a jurisdiction
 */
export function getApplicableVATRates(
  jurisdiction: SupportedJurisdiction
): Array<{ category: string; rate: number; description?: string }> {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    throw new TaxCalculationError(
      `Unsupported jurisdiction: ${jurisdiction}`,
      'UNSUPPORTED_JURISDICTION',
      { jurisdiction }
    );
  }

  const rates: Array<{ category: string; rate: number; description?: string }> = [];

  // Add standard rate
  rates.push({
    category: 'STANDARD',
    rate: rules.standardVATRate,
    description: 'Standard VAT rate'
  });

  // Add zero-rated categories
  rules.zeroRatedCategories.forEach(category => {
    rates.push({
      category,
      rate: 0.00,
      description: 'Zero-rated category'
    });
  });

  // Add exempt categories
  rules.exemptCategories.forEach(category => {
    rates.push({
      category,
      rate: 0.00,
      description: 'VAT exempt category'
    });
  });

  // Add specific category rates
  rules.taxRates.forEach(taxRate => {
    rates.push({
      category: taxRate.category,
      rate: taxRate.vatRate,
      description: taxRate.description
    });
  });

  return rates;
}