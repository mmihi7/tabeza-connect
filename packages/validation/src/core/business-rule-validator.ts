/**
 * TABEZA Validation Library - Business Rule Validator
 * Extracted business rule validation logic from virtual-printer
 */

import type { CompleteReceiptSession } from '@tabeza/receipt-schema';
import type { 
  BusinessRuleResult, 
  ValidationRule, 
  BusinessRuleSeverity,
  ValidateBusinessRulesParams 
} from '../types';
import { BUSINESS_RULES, BUSINESS_RULE_WEIGHTS } from '../constants';

/**
 * Business Rule Validator Class
 * Handles validation of business rules against receipt data
 */
export class BusinessRuleValidator {
  private customRules: ValidationRule[] = [];
  private strictMode: boolean = false;

  constructor(options: { customRules?: ValidationRule[]; strictMode?: boolean } = {}) {
    this.customRules = options.customRules || [];
    this.strictMode = options.strictMode || false;
  }

  /**
   * Validate business rules against a receipt
   */
  validate(receipt: CompleteReceiptSession): BusinessRuleResult {
    const allRules = [...BUSINESS_RULES, ...this.customRules];
    const ruleResults = [];
    let score = 100;
    
    const summary = {
      totalRules: allRules.length,
      passedRules: 0,
      failedRules: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0
    };

    for (const rule of allRules) {
      try {
        const passed = rule.validate(receipt);
        const ruleResult = {
          ruleName: rule.name,
          passed,
          message: passed ? `${rule.description} - PASSED` : rule.getMessage(receipt),
          severity: rule.severity,
          details: rule.getDetails ? rule.getDetails(receipt) : undefined
        };

        ruleResults.push(ruleResult);

        if (passed) {
          summary.passedRules++;
        } else {
          summary.failedRules++;
          
          // Deduct score based on severity
          const deduction = BUSINESS_RULE_WEIGHTS[rule.severity];
          score -= deduction;
          
          // Count issues by severity
          switch (rule.severity) {
            case 'CRITICAL':
              summary.criticalIssues++;
              break;
            case 'HIGH':
              summary.highIssues++;
              break;
            case 'MEDIUM':
              summary.mediumIssues++;
              break;
            case 'LOW':
              summary.lowIssues++;
              break;
          }
        }
      } catch (error) {
        ruleResults.push({
          ruleName: rule.name,
          passed: false,
          message: `Rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'HIGH' as BusinessRuleSeverity
        });
        summary.failedRules++;
        summary.highIssues++;
        score -= BUSINESS_RULE_WEIGHTS.HIGH;
      }
    }

    return {
      valid: summary.failedRules === 0,
      score: Math.max(0, score),
      rules: ruleResults,
      summary,
      validatedAt: new Date().toISOString()
    };
  }

  /**
   * Add custom business rule
   */
  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove custom business rule
   */
  removeRule(ruleName: string): boolean {
    const index = this.customRules.findIndex(rule => rule.name === ruleName);
    if (index >= 0) {
      this.customRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules (built-in + custom)
   */
  getAllRules(): ValidationRule[] {
    return [...BUSINESS_RULES, ...this.customRules];
  }

  /**
   * Get rule by name
   */
  getRule(ruleName: string): ValidationRule | undefined {
    return this.getAllRules().find(rule => rule.name === ruleName);
  }

  /**
   * Validate specific rule against receipt
   */
  validateRule(ruleName: string, receipt: CompleteReceiptSession): {
    passed: boolean;
    message: string;
    severity: BusinessRuleSeverity;
  } | null {
    const rule = this.getRule(ruleName);
    if (!rule) {
      return null;
    }

    try {
      const passed = rule.validate(receipt);
      return {
        passed,
        message: passed ? `${rule.description} - PASSED` : rule.getMessage(receipt),
        severity: rule.severity
      };
    } catch (error) {
      return {
        passed: false,
        message: `Rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'HIGH' as BusinessRuleSeverity
      };
    }
  }

  /**
   * Get validation summary
   */
  getSummary(receipt: CompleteReceiptSession): {
    totalRules: number;
    passedRules: number;
    failedRules: number;
    criticalIssues: number;
    score: number;
    worstSeverity: BusinessRuleSeverity | null;
  } {
    const result = this.validate(receipt);
    
    const severityOrder: BusinessRuleSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const worstSeverity = result.rules
      .filter(rule => !rule.passed)
      .reduce((worst: BusinessRuleSeverity | null, rule) => {
        if (!worst) return rule.severity;
        const currentIndex = severityOrder.indexOf(rule.severity);
        const worstIndex = severityOrder.indexOf(worst);
        return currentIndex < worstIndex ? rule.severity : worst;
      }, null);

    return {
      totalRules: result.summary.totalRules,
      passedRules: result.summary.passedRules,
      failedRules: result.summary.failedRules,
      criticalIssues: result.summary.criticalIssues,
      score: result.score,
      worstSeverity
    };
  }

  /**
   * Set strict mode
   */
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
  }

  /**
   * Get strict mode status
   */
  isStrictMode(): boolean {
    return this.strictMode;
  }
}