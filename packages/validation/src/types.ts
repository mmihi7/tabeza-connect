/**
 * TABEZA Validation Library - Type Definitions
 * Pure types for validation and data sanitization
 */

import { z } from 'zod';
import type { CompleteReceiptSession } from '@tabeza/receipt-schema';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  score: z.number().min(0).max(100),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  validatedAt: z.string().datetime()
});

export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  severity: z.enum(['ERROR', 'WARNING', 'INFO']),
  context: z.record(z.any()).optional()
});

export const ValidationWarningSchema = z.object({
  field: z.string(),
  message: z.string(),
  suggestion: z.string().optional(),
  context: z.record(z.any()).optional()
});

// ============================================================================
// BUSINESS RULE VALIDATION TYPES
// ============================================================================

export const BusinessRuleValidationSchema = z.object({
  ruleName: z.string(),
  passed: z.boolean(),
  message: z.string(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  details: z.record(z.any()).optional()
});

export const BusinessRuleResultSchema = z.object({
  valid: z.boolean(),
  score: z.number().min(0).max(100),
  rules: z.array(BusinessRuleValidationSchema),
  summary: z.object({
    totalRules: z.number(),
    passedRules: z.number(),
    failedRules: z.number(),
    criticalIssues: z.number(),
    highIssues: z.number(),
    mediumIssues: z.number(),
    lowIssues: z.number()
  }),
  validatedAt: z.string().datetime()
});

// ============================================================================
// DATA SANITIZATION TYPES
// ============================================================================

export const SanitizationOptionsSchema = z.object({
  trimWhitespace: z.boolean().default(true),
  normalizeUnicode: z.boolean().default(true),
  removeControlChars: z.boolean().default(true),
  validateFormat: z.boolean().default(true),
  strictMode: z.boolean().default(false)
});

export const SanitizationResultSchema = z.object({
  original: z.any(),
  sanitized: z.any(),
  changes: z.array(z.object({
    field: z.string(),
    originalValue: z.any(),
    sanitizedValue: z.any(),
    reason: z.string()
  })),
  warnings: z.array(z.string())
});

// ============================================================================
// CROSS-SYSTEM VALIDATION TYPES
// ============================================================================

export const CrossSystemValidationSchema = z.object({
  cloudCompatible: z.boolean(),
  agentCompatible: z.boolean(),
  consistencyScore: z.number().min(0).max(100),
  issues: z.array(z.object({
    system: z.enum(['CLOUD', 'AGENT', 'BOTH']),
    issue: z.string(),
    severity: z.enum(['BLOCKING', 'WARNING', 'INFO']),
    recommendation: z.string().optional()
  })),
  validatedAt: z.string().datetime()
});

// ============================================================================
// RECEIPT VALIDATION TYPES
// ============================================================================

export const ReceiptValidationConfigSchema = z.object({
  validateStructure: z.boolean().default(true),
  validateBusinessRules: z.boolean().default(true),
  validateCalculations: z.boolean().default(true),
  validateTimestamps: z.boolean().default(true),
  validateReferences: z.boolean().default(true),
  strictMode: z.boolean().default(false),
  allowPartialData: z.boolean().default(false)
});

export const ReceiptValidationResultSchema = z.object({
  valid: z.boolean(),
  score: z.number().min(0).max(100),
  structureValidation: ValidationResultSchema,
  businessRuleValidation: BusinessRuleResultSchema,
  calculationValidation: ValidationResultSchema,
  crossSystemValidation: CrossSystemValidationSchema,
  summary: z.object({
    totalChecks: z.number(),
    passedChecks: z.number(),
    failedChecks: z.number(),
    overallScore: z.number().min(0).max(100)
  }),
  validatedAt: z.string().datetime()
});

// ============================================================================
// TYPESCRIPT TYPES (Derived from schemas)
// ============================================================================

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ValidationWarning = z.infer<typeof ValidationWarningSchema>;
export type BusinessRuleValidation = z.infer<typeof BusinessRuleValidationSchema>;
export type BusinessRuleResult = z.infer<typeof BusinessRuleResultSchema>;
export type SanitizationOptions = z.infer<typeof SanitizationOptionsSchema>;
export type SanitizationResult = z.infer<typeof SanitizationResultSchema>;
export type CrossSystemValidation = z.infer<typeof CrossSystemValidationSchema>;
export type ReceiptValidationConfig = z.infer<typeof ReceiptValidationConfigSchema>;
export type ReceiptValidationResult = z.infer<typeof ReceiptValidationResultSchema>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type BusinessRuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SystemType = 'CLOUD' | 'AGENT' | 'BOTH';
export type IssueSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

// ============================================================================
// VALIDATION RULE TYPES
// ============================================================================

export interface ValidationRule {
  name: string;
  description: string;
  severity: BusinessRuleSeverity;
  validate: (data: any) => boolean;
  getMessage: (data: any) => string;
  getDetails?: (data: any) => Record<string, any>;
}

export interface SanitizationRule {
  name: string;
  description: string;
  sanitize: (value: any) => any;
  validate?: (value: any) => boolean;
}

// ============================================================================
// PARAMETER TYPES
// ============================================================================

export interface ValidateReceiptDataParams {
  receipt: CompleteReceiptSession;
  config?: ReceiptValidationConfig;
}

export interface ValidateBusinessRulesParams {
  receipt: CompleteReceiptSession;
  strictMode?: boolean;
  customRules?: ValidationRule[];
}

export interface SanitizeDataParams {
  data: any;
  options?: SanitizationOptions;
  customRules?: SanitizationRule[];
}

export interface CrossSystemValidationParams {
  data: any;
  targetSystems: SystemType[];
  strictMode?: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class TabezaValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'TabezaValidationError';
  }
}

export class SanitizationError extends Error {
  constructor(
    message: string,
    public field: string,
    public originalValue: any,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SanitizationError';
  }
}

export class BusinessRuleViolationError extends Error {
  constructor(
    message: string,
    public ruleName: string,
    public severity: BusinessRuleSeverity,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}

export class CrossSystemCompatibilityError extends Error {
  constructor(
    message: string,
    public incompatibleSystems: SystemType[],
    public issues: string[],
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CrossSystemCompatibilityError';
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_VALIDATION_CONFIG: ReceiptValidationConfig = {
  validateStructure: true,
  validateBusinessRules: true,
  validateCalculations: true,
  validateTimestamps: true,
  validateReferences: true,
  strictMode: false,
  allowPartialData: false
};

export const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  trimWhitespace: true,
  normalizeUnicode: true,
  removeControlChars: true,
  validateFormat: true,
  strictMode: false
};

// ============================================================================
// VALIDATION THRESHOLDS
// ============================================================================

export const VALIDATION_THRESHOLDS = {
  EXCELLENT: 95,
  GOOD: 85,
  ACCEPTABLE: 70,
  POOR: 50,
  CRITICAL: 30
} as const;

export const BUSINESS_RULE_WEIGHTS = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 10,
  LOW: 5
} as const;