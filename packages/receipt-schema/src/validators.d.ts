/**
 * TABEZA Receipt Schema Validators
 * Business logic validation for receipt sessions and events
 */
import { ReceiptSession, ReceiptEvent, CompleteReceiptSession } from './session';
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    score: number;
}
export interface ValidationError {
    field: string;
    message: string;
    severity: 'critical' | 'major' | 'minor';
    code: string;
}
export interface ValidationWarning {
    field: string;
    message: string;
    suggestion: string;
    code: string;
}
/**
 * Validate a receipt session
 */
export declare function validateReceiptSession(session: ReceiptSession): ValidationResult;
/**
 * Validate a receipt event
 */
export declare function validateReceiptEvent(event: ReceiptEvent): ValidationResult;
/**
 * Validate a complete receipt session
 */
export declare function validateCompleteSession(completeSession: CompleteReceiptSession): ValidationResult;
/**
 * Validate business rules for a complete session
 */
export declare function validateBusinessRules(completeSession: CompleteReceiptSession): ValidationResult;
//# sourceMappingURL=validators.d.ts.map