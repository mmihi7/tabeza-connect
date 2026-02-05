/**
 * TABEZA Validation Library
 * Pure validation logic extracted for cross-system consistency
 * 
 * This package contains only pure functions with no OS dependencies,
 * making it suitable for both cloud (Vercel) and agent (Windows) systems.
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

// Main validation classes
export { BusinessRuleValidator } from './core/business-rule-validator';
// Note: CrossSystemValidator and ReceiptDataValidator are integrated into validators.ts
// export { CrossSystemValidator } from './core/cross-system-validator';
// export { ReceiptDataValidator } from './core/receipt-data-validator';

// Data sanitization functions
export {
  sanitizeReceiptData,
  sanitizePhoneNumber,
  sanitizeAmount,
  sanitizeText,
  normalizeReceiptData,
  applySanitizationRules
} from './core/data-sanitizer';

// Validation utilities
export {
  validateReceiptData,
  validateBusinessRules,
  validateDataConsistency,
  validateCrossSystemCompatibility,
  validateReceiptStructure,
  validateReceiptCalculations,
  validateReceiptTimestamps
} from './core/validators';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type {
  // Core validation types
  ValidationResult,
  TabezaValidationErrorType as ValidationError,
  ValidationWarning,
  BusinessRuleValidation,
  BusinessRuleResult,
  SanitizationOptions,
  SanitizationResult,
  CrossSystemValidation,
  ReceiptValidationConfig,
  ReceiptValidationResult,
  
  // Utility types
  ValidationSeverity,
  BusinessRuleSeverity,
  SystemType,
  IssueSeverity,
  
  // Rule types
  ValidationRule,
  SanitizationRule,
  
  // Parameter types
  ValidateReceiptDataParams,
  ValidateBusinessRulesParams,
  SanitizeDataParams,
  CrossSystemValidationParams
} from './types';

// Error types
export {
  TabezaValidationError,
  SanitizationError,
  BusinessRuleViolationError,
  CrossSystemCompatibilityError
} from './types';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export {
  // Validation patterns
  VALIDATION_PATTERNS,
  
  // Validation limits
  VALIDATION_LIMITS,
  
  // Business rules
  BUSINESS_RULES,
  
  // Business rule weights
  BUSINESS_RULE_WEIGHTS,
  
  // Sanitization rules
  SANITIZATION_RULES,
  
  // Error messages
  ERROR_MESSAGES,
  
  // System compatibility rules
  CLOUD_COMPATIBILITY_RULES,
  AGENT_COMPATIBILITY_RULES,
  
  // Validation categories
  VALIDATION_CATEGORIES
} from './constants';

// Default configurations
export {
  DEFAULT_VALIDATION_CONFIG,
  DEFAULT_SANITIZATION_OPTIONS,
  VALIDATION_THRESHOLDS
} from './types';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import type { CompleteReceiptSession } from '@tabeza/receipt-schema';
import type { ValidationResult, BusinessRuleResult, CrossSystemValidation } from './types';
import { VALIDATION_CATEGORIES } from './constants';

/**
 * Quick validation for a receipt with default settings
 */
export function quickValidateReceipt(receipt: CompleteReceiptSession): ValidationResult {
  const { validateReceiptData } = require('./core/validators');
  return validateReceiptData({ receipt });
}

/**
 * Quick business rule validation
 */
export function quickValidateBusinessRules(receipt: CompleteReceiptSession): BusinessRuleResult {
  const { validateBusinessRules } = require('./core/validators');
  return validateBusinessRules({ receipt });
}

/**
 * Quick cross-system compatibility check
 */
export function quickValidateCrossSystem(data: any): CrossSystemValidation {
  const { validateCrossSystemCompatibility } = require('./core/validators');
  return validateCrossSystemCompatibility({ 
    data, 
    targetSystems: ['CLOUD', 'AGENT'] 
  });
}

/**
 * Quick data sanitization
 */
export function quickSanitizeData(data: any): any {
  const { sanitizeReceiptData } = require('./core/data-sanitizer');
  return sanitizeReceiptData(data);
}

/**
 * Comprehensive validation (structure + business rules + cross-system)
 */
export function comprehensiveValidation(receipt: CompleteReceiptSession): {
  structure: ValidationResult;
  businessRules: BusinessRuleResult;
  crossSystem: CrossSystemValidation;
  overallScore: number;
  isValid: boolean;
} {
  const structure = quickValidateReceipt(receipt);
  const businessRules = quickValidateBusinessRules(receipt);
  const crossSystem = quickValidateCrossSystem(receipt);
  
  const overallScore = Math.round(
    (structure.score + businessRules.score + crossSystem.consistencyScore) / 3
  );
  
  const isValid = structure.valid && businessRules.valid && 
                  crossSystem.cloudCompatible && crossSystem.agentCompatible;
  
  return {
    structure,
    businessRules,
    crossSystem,
    overallScore,
    isValid
  };
}

/**
 * Validate and sanitize in one operation
 */
export function validateAndSanitize(receipt: CompleteReceiptSession): {
  sanitized: CompleteReceiptSession;
  validation: ValidationResult;
  changes: Array<{ field: string; reason: string }>;
} {
  const { sanitizeReceiptData } = require('./core/data-sanitizer');
  const { validateReceiptData } = require('./core/validators');
  
  const sanitizationResult = sanitizeReceiptData(receipt);
  const validation = validateReceiptData({ receipt: sanitizationResult.sanitized });
  
  return {
    sanitized: sanitizationResult.sanitized,
    validation,
    changes: sanitizationResult.changes
  };
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(receipt: CompleteReceiptSession): {
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'CRITICAL';
  issues: string[];
  recommendations: string[];
  validatedAt: string;
} {
  const { VALIDATION_THRESHOLDS } = require('./types');
  const comprehensive = comprehensiveValidation(receipt);
  
  let status: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'CRITICAL';
  if (comprehensive.overallScore >= VALIDATION_THRESHOLDS.EXCELLENT) status = 'EXCELLENT';
  else if (comprehensive.overallScore >= VALIDATION_THRESHOLDS.GOOD) status = 'GOOD';
  else if (comprehensive.overallScore >= VALIDATION_THRESHOLDS.ACCEPTABLE) status = 'ACCEPTABLE';
  else if (comprehensive.overallScore >= VALIDATION_THRESHOLDS.POOR) status = 'POOR';
  else status = 'CRITICAL';
  
  const issues = [
    ...comprehensive.structure.errors,
    ...comprehensive.businessRules.rules
      .filter((rule: any) => !rule.passed)
      .map((rule: any) => rule.message),
    ...comprehensive.crossSystem.issues
      .filter((issue: any) => issue.severity === 'BLOCKING')
      .map((issue: any) => issue.issue)
  ];
  
  const recommendations = [
    ...comprehensive.structure.warnings,
    ...comprehensive.crossSystem.issues
      .filter((issue: any) => issue.recommendation)
      .map((issue: any) => issue.recommendation!)
  ];
  
  return {
    score: comprehensive.overallScore,
    status,
    issues,
    recommendations,
    validatedAt: new Date().toISOString()
  };
}

// ============================================================================
// VERSION & METADATA
// ============================================================================

export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@tabeza/validation';
export const DESCRIPTION = 'Pure validation logic - cross-system consistency';

/**
 * Get package information
 */
export function getPackageInfo() {
  return {
    name: PACKAGE_NAME,
    version: VERSION,
    description: DESCRIPTION,
    features: [
      'Receipt data validation',
      'Business rule validation',
      'Data sanitization and normalization',
      'Cross-system compatibility validation',
      'Pure functions - no OS dependencies',
      'Serverless compatible',
      'Property-based testing support'
    ],
    validationCategories: Object.values(VALIDATION_CATEGORIES),
    architecture: 'Pure logic extraction for cloud/agent separation'
  };
}