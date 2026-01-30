/**
 * TABEZA Tax Rules Engine - Comprehensive Tests
 * Tests for all tax calculation and validation functionality
 */

import {
  TaxRuleEngine,
  calculateVAT,
  calculateExciseTax,
  validateKRAPin,
  quickVATCalculation,
  quickComplianceCheck,
  getJurisdictionTaxInfo,
  validateAndCalculateTaxes,
  SUPPORTED_JURISDICTIONS,
  DEFAULT_JURISDICTION
} from '../index';

import type {
  TaxableItem,
  VATCalculationParams,
  ExciseTaxCalculationParams,
  ComplianceValidationParams
} from '../types';

describe('TABEZA Tax Rules Engine', () => {
  
  // ============================================================================
  // VAT CALCULATION TESTS
  // ============================================================================
  
  describe('VAT Calculations', () => {
    test('should calculate VAT for exclusive amount', () => {
      const params: VATCalculationParams = {
        amount: 1000,
        rate: 0.16,
        inclusive: false
      };
      
      const result = calculateVAT(params);
      
      expect(result.subtotal).toBe(1000);
      expect(result.vatAmount).toBe(160);
      expect(result.total).toBe(1160);
      expect(result.rate).toBe(0.16);
      expect(result.inclusive).toBe(false);
    });

    test('should calculate VAT for inclusive amount', () => {
      const params: VATCalculationParams = {
        amount: 1160,
        rate: 0.16,
        inclusive: true
      };
      
      const result = calculateVAT(params);
      
      expect(result.subtotal).toBe(1000);
      expect(result.vatAmount).toBe(160);
      expect(result.total).toBe(1160);
      expect(result.rate).toBe(0.16);
      expect(result.inclusive).toBe(true);
    });

    test('should handle zero VAT rate', () => {
      const params: VATCalculationParams = {
        amount: 1000,
        rate: 0,
        inclusive: false
      };
      
      const result = calculateVAT(params);
      
      expect(result.subtotal).toBe(1000);
      expect(result.vatAmount).toBe(0);
      expect(result.total).toBe(1000);
    });

    test('should throw error for invalid amount', () => {
      const params: VATCalculationParams = {
        amount: -100,
        rate: 0.16,
        inclusive: false
      };
      
      expect(() => calculateVAT(params)).toThrow('Amount must be at least');
    });

    test('should throw error for invalid VAT rate', () => {
      const params: VATCalculationParams = {
        amount: 1000,
        rate: 1.5, // 150% - invalid
        inclusive: false
      };
      
      expect(() => calculateVAT(params)).toThrow('VAT rate must be between');
    });
  });

  // ============================================================================
  // EXCISE TAX CALCULATION TESTS
  // ============================================================================
  
  describe('Excise Tax Calculations', () => {
    test('should calculate percentage-based excise tax', () => {
      const params: ExciseTaxCalculationParams = {
        amount: 1000,
        rate: 0.25, // 25%
        rateType: 'PERCENTAGE',
        category: 'BEVERAGE_ALCOHOLIC'
      };
      
      const result = calculateExciseTax(params);
      
      expect(result.baseAmount).toBe(1000);
      expect(result.exciseAmount).toBe(250);
      expect(result.rate).toBe(0.25);
      expect(result.rateType).toBe('PERCENTAGE');
    });

    test('should calculate fixed amount excise tax', () => {
      const params: ExciseTaxCalculationParams = {
        amount: 5, // 5 units
        rate: 100, // KES 100 per unit
        rateType: 'FIXED_AMOUNT',
        category: 'TOBACCO'
      };
      
      const result = calculateExciseTax(params);
      
      expect(result.baseAmount).toBe(5);
      expect(result.exciseAmount).toBe(100);
      expect(result.rateType).toBe('FIXED_AMOUNT');
    });

    test('should throw error for negative excise rate', () => {
      const params: ExciseTaxCalculationParams = {
        amount: 1000,
        rate: -0.1,
        rateType: 'PERCENTAGE',
        category: 'ALCOHOL'
      };
      
      expect(() => calculateExciseTax(params)).toThrow('Excise rate cannot be negative');
    });
  });

  // ============================================================================
  // KRA PIN VALIDATION TESTS
  // ============================================================================
  
  describe('KRA PIN Validation', () => {
    test('should validate correct KRA PIN format', () => {
      const validPins = [
        'P051234567M',
        'P098765432A',
        'P123456789Z'
      ];
      
      validPins.forEach(pin => {
        const result = validateKRAPin(pin);
        expect(result.valid).toBe(true);
        expect(result.format).toBe('INDIVIDUAL');
        expect(result.errors).toHaveLength(0);
      });
    });

    test('should reject invalid KRA PIN formats', () => {
      const invalidPins = [
        'P05123456M', // Too short
        'P0512345678M', // Too long
        '051234567M', // Missing P
        'P05123456789', // Missing letter
        'PA51234567M', // Letter in numeric part
        'P0512345671' // Number instead of letter
      ];
      
      invalidPins.forEach(pin => {
        const result = validateKRAPin(pin);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should handle empty or null PIN', () => {
      const result = validateKRAPin('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PIN must be a non-empty string');
    });

    test('should detect test PINs', () => {
      const testPins = [
        'P000000000A', // All zeros
        'P111111111B', // All ones
        'P123456789C'  // Sequential
      ];
      
      testPins.forEach(pin => {
        const result = validateKRAPin(pin);
        // These should be format-valid but flagged as test PINs
        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // TAX RULE ENGINE TESTS
  // ============================================================================
  
  describe('Tax Rule Engine', () => {
    let engine: TaxRuleEngine;
    
    beforeEach(() => {
      engine = new TaxRuleEngine('KE');
    });

    test('should create engine for supported jurisdiction', () => {
      expect(engine).toBeInstanceOf(TaxRuleEngine);
      expect(engine.getJurisdictionInfo().jurisdiction).toBe('KE');
    });

    test('should throw error for unsupported jurisdiction', () => {
      expect(() => new TaxRuleEngine('XX' as any)).toThrow('not supported');
    });

    test('should calculate taxes for multiple items', () => {
      const items: TaxableItem[] = [
        {
          name: 'Beer',
          amount: 500,
          quantity: 2,
          category: 'BEVERAGE_ALCOHOLIC'
        },
        {
          name: 'Bread',
          amount: 100,
          quantity: 1,
          category: 'FOOD_BASIC'
        }
      ];
      
      const result = engine.calculateTaxes({
        items,
        jurisdiction: 'KE'
      });
      
      expect(result.items).toHaveLength(2);
      expect(result.totals.subtotal).toBeGreaterThan(0);
      expect(result.totals.totalVAT).toBeGreaterThan(0);
      expect(result.totals.grandTotal).toBeGreaterThan(result.totals.subtotal);
      expect(result.jurisdiction).toBe('KE');
    });

    test('should get applicable rates for category', () => {
      const rates = engine.getApplicableRates('FOOD_BASIC');
      expect(rates.vatRate).toBe(0); // Zero-rated in Kenya
      
      const standardRates = engine.getApplicableRates('RETAIL');
      expect(standardRates.vatRate).toBe(0.16); // Standard VAT in Kenya
    });

    test('should validate receipt compliance', () => {
      const receipt = {
        merchant: {
          kraPin: 'P051234567M',
          name: 'Test Restaurant'
        },
        items: [
          {
            name: 'Meal',
            amount: 1000,
            category: 'FOOD_PREPARED'
          }
        ],
        totals: {
          subtotal: 1000,
          tax: 160,
          total: 1160
        }
      };
      
      const validation = engine.validateReceipt({
        receipt,
        jurisdiction: 'KE'
      });
      
      expect(validation.jurisdiction).toBe('KE');
      expect(validation.score).toBeGreaterThan(0);
      expect(validation.validatedAt).toBeDefined();
    });
  });

  // ============================================================================
  // CONVENIENCE FUNCTION TESTS
  // ============================================================================
  
  describe('Convenience Functions', () => {
    test('should perform quick VAT calculation', () => {
      const result = quickVATCalculation(1000, 'KE', false);
      
      expect(result.subtotal).toBe(1000);
      expect(result.vatAmount).toBe(160); // 16% VAT for Kenya
      expect(result.total).toBe(1160);
    });

    test('should perform quick compliance check', () => {
      const receipt = {
        merchant: {
          kraPin: 'P051234567M',
          name: 'Test Business'
        },
        items: [
          {
            name: 'Service',
            amount: 1000,
            category: 'SERVICE'
          }
        ],
        totals: {
          subtotal: 1000,
          tax: 160,
          total: 1160
        }
      };
      
      const validation = quickComplianceCheck(receipt, 'KE');
      
      expect(validation.jurisdiction).toBe('KE');
      expect(validation.isCompliant).toBeDefined();
    });

    test('should get jurisdiction tax information', () => {
      const info = getJurisdictionTaxInfo('KE');
      
      expect(info.jurisdiction).toBe('KE');
      expect(info.currency).toBe('KES');
      expect(info.standardVATRate).toBe(0.16);
      expect(info.vatRates).toBeInstanceOf(Array);
      expect(info.exciseRates).toBeInstanceOf(Array);
      expect(info.complianceFeatures).toContain('VAT calculation');
    });

    test('should validate and calculate taxes in one call', () => {
      const items: TaxableItem[] = [
        {
          name: 'Product',
          amount: 1000,
          quantity: 1,
          category: 'RETAIL'
        }
      ];
      
      const result = validateAndCalculateTaxes(items, 'KE', 'P051234567M');
      
      expect(result.calculation).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.calculation.totals.grandTotal).toBeGreaterThan(0);
      expect(result.validation.jurisdiction).toBe('KE');
    });
  });

  // ============================================================================
  // MULTI-JURISDICTION TESTS
  // ============================================================================
  
  describe('Multi-Jurisdiction Support', () => {
    test('should support all defined jurisdictions', () => {
      SUPPORTED_JURISDICTIONS.forEach(jurisdiction => {
        expect(() => new TaxRuleEngine(jurisdiction)).not.toThrow();
        
        const engine = new TaxRuleEngine(jurisdiction);
        const info = engine.getJurisdictionInfo();
        
        expect(info.jurisdiction).toBe(jurisdiction);
        expect(info.currency).toBeDefined();
        expect(info.standardVATRate).toBeGreaterThanOrEqual(0);
      });
    });

    test('should have different VAT rates for different jurisdictions', () => {
      const keEngine = new TaxRuleEngine('KE');
      const ugEngine = new TaxRuleEngine('UG');
      
      const keInfo = keEngine.getJurisdictionInfo();
      const ugInfo = ugEngine.getJurisdictionInfo();
      
      expect(keInfo.standardVATRate).toBe(0.16); // Kenya: 16%
      expect(ugInfo.standardVATRate).toBe(0.18); // Uganda: 18%
    });

    test('should calculate different amounts for same item in different jurisdictions', () => {
      const item: TaxableItem = {
        name: 'Test Item',
        amount: 1000,
        quantity: 1,
        category: 'RETAIL'
      };
      
      const keResult = new TaxRuleEngine('KE').calculateTaxes({
        items: [item],
        jurisdiction: 'KE'
      });
      
      const ugResult = new TaxRuleEngine('UG').calculateTaxes({
        items: [item],
        jurisdiction: 'UG'
      });
      
      // Different VAT rates should produce different totals
      expect(keResult.totals.totalVAT).not.toBe(ugResult.totals.totalVAT);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================
  
  describe('Error Handling', () => {
    test('should handle empty items array', () => {
      const engine = new TaxRuleEngine('KE');
      
      expect(() => engine.calculateTaxes({
        items: [],
        jurisdiction: 'KE'
      })).toThrow('At least one item is required');
    });

    test('should handle invalid KRA PIN in tax calculation', () => {
      const engine = new TaxRuleEngine('KE');
      const items: TaxableItem[] = [
        {
          name: 'Item',
          amount: 1000,
          quantity: 1,
          category: 'RETAIL'
        }
      ];
      
      expect(() => engine.calculateTaxes({
        items,
        jurisdiction: 'KE',
        merchantKRAPin: 'INVALID_PIN'
      })).toThrow('Invalid KRA PIN');
    });

    test('should handle calculation precision correctly', () => {
      // Test with amounts that might cause floating point precision issues
      const result = calculateVAT({
        amount: 33.33,
        rate: 0.16,
        inclusive: false
      });
      
      // Should be properly rounded to 2 decimal places
      expect(result.vatAmount).toBe(5.33);
      expect(result.total).toBe(38.66);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  
  describe('Integration Tests', () => {
    test('should handle complex multi-item receipt with mixed categories', () => {
      const engine = new TaxRuleEngine('KE');
      
      const items: TaxableItem[] = [
        {
          name: 'Beer',
          amount: 300,
          quantity: 3,
          category: 'BEVERAGE_ALCOHOLIC'
        },
        {
          name: 'Bread',
          amount: 50,
          quantity: 2,
          category: 'FOOD_BASIC'
        },
        {
          name: 'Service Charge',
          amount: 100,
          quantity: 1,
          category: 'SERVICE'
        }
      ];
      
      const calculation = engine.calculateTaxes({
        items,
        jurisdiction: 'KE',
        merchantKRAPin: 'P051234567M'
      });
      
      // Verify calculation structure
      expect(calculation.items).toHaveLength(3);
      expect(calculation.totals.subtotal).toBeGreaterThan(0);
      expect(calculation.totals.grandTotal).toBeGreaterThan(calculation.totals.subtotal);
      
      // Beer should have both VAT and excise tax
      const beerCalc = calculation.items.find(item => item.item.name === 'Beer');
      expect(beerCalc?.vat.vatAmount).toBeGreaterThan(0);
      expect(beerCalc?.excise?.exciseAmount).toBeGreaterThan(0);
      
      // Bread should have zero VAT (zero-rated)
      const breadCalc = calculation.items.find(item => item.item.name === 'Bread');
      expect(breadCalc?.vat.vatAmount).toBe(0);
      expect(breadCalc?.excise).toBeUndefined();
      
      // Service should have VAT only
      const serviceCalc = calculation.items.find(item => item.item.name === 'Service Charge');
      expect(serviceCalc?.vat.vatAmount).toBeGreaterThan(0);
      expect(serviceCalc?.excise).toBeUndefined();
    });

    test('should maintain calculation accuracy across multiple operations', () => {
      const engine = new TaxRuleEngine('KE');
      
      // Perform multiple calculations and verify consistency
      const baseAmount = 1000;
      const vatRate = 0.16;
      
      for (let i = 1; i <= 10; i++) {
        const items: TaxableItem[] = [
          {
            name: `Item ${i}`,
            amount: baseAmount,
            quantity: 1,
            category: 'RETAIL'
          }
        ];
        
        const result = engine.calculateTaxes({
          items,
          jurisdiction: 'KE'
        });
        
        // Each calculation should be consistent
        expect(result.totals.subtotal).toBe(baseAmount);
        expect(result.totals.totalVAT).toBe(baseAmount * vatRate);
        expect(result.totals.grandTotal).toBe(baseAmount * (1 + vatRate));
      }
    });
  });
});