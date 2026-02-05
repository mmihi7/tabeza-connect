/**
 * TABEZA Tax Rules Engine - Excise Tax Calculator
 * Pure excise tax calculation functions for applicable items
 */

import type { 
  ExciseTaxCalculation, 
  ExciseTaxCalculationParams,
  TaxableItem,
  SupportedJurisdiction,
  ExciseRateType
} from '../types';
import { 
  EXCISE_CALCULATION_PRECISION,
  MIN_AMOUNT,
  JURISDICTION_RULES 
} from '../constants';
import { TaxCalculationError } from '../types';

/**
 * Calculate excise tax for a single amount
 */
export function calculateExciseTax(params: ExciseTaxCalculationParams): ExciseTaxCalculation {
  const { amount, rate, rateType, category } = params;

  // Validation
  if (amount < MIN_AMOUNT) {
    throw new TaxCalculationError(
      `Amount must be at least ${MIN_AMOUNT}`,
      'INVALID_AMOUNT',
      { amount, minimum: MIN_AMOUNT }
    );
  }

  if (rate < 0) {
    throw new TaxCalculationError(
      'Excise rate cannot be negative',
      'INVALID_EXCISE_RATE',
      { rate }
    );
  }

  let exciseAmount: number;

  if (rateType === 'PERCENTAGE') {
    // Percentage-based excise tax
    exciseAmount = amount * rate;
  } else {
    // Fixed amount excise tax (per unit/kg/litre)
    // For simplicity, assume amount represents quantity
    exciseAmount = rate;
  }

  // Round to specified precision
  exciseAmount = Math.round(exciseAmount * Math.pow(10, EXCISE_CALCULATION_PRECISION)) / Math.pow(10, EXCISE_CALCULATION_PRECISION);

  return {
    baseAmount: amount,
    exciseAmount,
    rate,
    rateType,
    category
  };
}

/**
 * Calculate excise tax for multiple items
 */
export function calculateExciseTaxForItems(
  items: TaxableItem[],
  jurisdiction: SupportedJurisdiction
): Array<{ item: TaxableItem; excise: ExciseTaxCalculation | null }> {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    throw new TaxCalculationError(
      `Unsupported jurisdiction: ${jurisdiction}`,
      'UNSUPPORTED_JURISDICTION',
      { jurisdiction }
    );
  }

  return items.map(item => {
    const exciseInfo = getExciseInfoForItem(item, jurisdiction);
    
    if (!exciseInfo) {
      return { item, excise: null };
    }

    // Calculate total amount for this item
    const itemTotal = item.amount * item.quantity;
    
    // Calculate excise tax
    const excise = calculateExciseTax({
      amount: exciseInfo.rateType === 'FIXED_AMOUNT' ? item.quantity : itemTotal,
      rate: exciseInfo.rate,
      rateType: exciseInfo.rateType,
      category: item.category
    });

    return { item, excise };
  });
}

/**
 * Get excise tax information for a specific item
 */
export function getExciseInfoForItem(
  item: TaxableItem,
  jurisdiction: SupportedJurisdiction
): { rate: number; rateType: ExciseRateType } | null {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    throw new TaxCalculationError(
      `Unsupported jurisdiction: ${jurisdiction}`,
      'UNSUPPORTED_JURISDICTION',
      { jurisdiction }
    );
  }

  // Use explicit excise rate if provided
  if (item.exciseRate !== undefined && item.exciseRateType) {
    return {
      rate: item.exciseRate,
      rateType: item.exciseRateType
    };
  }

  // Find excise rate for category
  const categoryRate = rules.taxRates.find(rate => 
    rate.category === item.category && 
    rate.exciseRate !== undefined &&
    rate.exciseRateType !== undefined
  );

  if (categoryRate && categoryRate.exciseRate !== undefined && categoryRate.exciseRateType) {
    return {
      rate: categoryRate.exciseRate,
      rateType: categoryRate.exciseRateType
    };
  }

  // No excise tax applicable
  return null;
}

/**
 * Check if an item is subject to excise tax
 */
export function isSubjectToExciseTax(
  item: TaxableItem,
  jurisdiction: SupportedJurisdiction
): boolean {
  return getExciseInfoForItem(item, jurisdiction) !== null;
}

/**
 * Get all excise tax rates for a jurisdiction
 */
export function getExciseTaxRates(
  jurisdiction: SupportedJurisdiction
): Array<{
  category: string;
  rate: number;
  rateType: ExciseRateType;
  description?: string;
}> {
  const rules = JURISDICTION_RULES[jurisdiction];
  if (!rules) {
    throw new TaxCalculationError(
      `Unsupported jurisdiction: ${jurisdiction}`,
      'UNSUPPORTED_JURISDICTION',
      { jurisdiction }
    );
  }

  return rules.taxRates
    .filter(rate => rate.exciseRate !== undefined && rate.exciseRateType)
    .map(rate => ({
      category: rate.category,
      rate: rate.exciseRate!,
      rateType: rate.exciseRateType!,
      description: rate.description
    }));
}

/**
 * Calculate total excise tax for multiple calculations
 */
export function calculateTotalExciseTax(
  exciseCalculations: (ExciseTaxCalculation | null)[]
): number {
  return exciseCalculations
    .filter((calc): calc is ExciseTaxCalculation => calc !== null)
    .reduce((total, calc) => total + calc.exciseAmount, 0);
}

/**
 * Validate excise tax calculation
 */
export function validateExciseTaxCalculation(
  baseAmount: number,
  exciseAmount: number,
  rate: number,
  rateType: ExciseRateType
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const calculated = calculateExciseTax({
      amount: baseAmount,
      rate,
      rateType,
      category: 'VALIDATION' // Placeholder category for validation
    });

    const tolerance = 0.01; // 1 cent tolerance for rounding

    if (Math.abs(calculated.exciseAmount - exciseAmount) > tolerance) {
      errors.push(`Excise amount mismatch: expected ${calculated.exciseAmount}, got ${exciseAmount}`);
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
 * Get excise tax categories for a jurisdiction
 */
export function getExciseTaxCategories(
  jurisdiction: SupportedJurisdiction
): string[] {
  const rates = getExciseTaxRates(jurisdiction);
  return [...new Set(rates.map(rate => rate.category))];
}

/**
 * Calculate excise tax impact on final price
 */
export function calculateExciseImpact(
  basePrice: number,
  exciseRate: number,
  exciseRateType: ExciseRateType,
  vatRate: number = 0
): {
  basePrice: number;
  exciseAmount: number;
  priceAfterExcise: number;
  vatOnTotal: number;
  finalPrice: number;
} {
  // Calculate excise tax
  const excise = calculateExciseTax({
    amount: basePrice,
    rate: exciseRate,
    rateType: exciseRateType,
    category: 'CALCULATION'
  });

  const priceAfterExcise = basePrice + excise.exciseAmount;
  
  // VAT is typically calculated on price including excise
  const vatOnTotal = priceAfterExcise * vatRate;
  const finalPrice = priceAfterExcise + vatOnTotal;

  return {
    basePrice,
    exciseAmount: excise.exciseAmount,
    priceAfterExcise,
    vatOnTotal,
    finalPrice
  };
}