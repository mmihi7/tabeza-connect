/**
 * TABEZA Receipt Schema Validators
 * Business logic validation for receipt sessions and events
 */

import { 
  ReceiptSession, 
  ReceiptEvent, 
  CompleteReceiptSession,
  LineItem,
  validateEventTotals,
  validateSessionTotals
} from './session';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100 confidence score
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

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Validate a receipt session
 */
export function validateReceiptSession(session: ReceiptSession): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let score = 100;

  // Required field validation
  if (!session.tabeza_receipt_id) {
    errors.push({
      field: 'tabeza_receipt_id',
      message: 'TABEZA receipt ID is required',
      severity: 'critical',
      code: 'MISSING_RECEIPT_ID'
    });
    score -= 20;
  }

  if (!session.session_reference) {
    errors.push({
      field: 'session_reference',
      message: 'Session reference is required',
      severity: 'critical',
      code: 'MISSING_SESSION_REF'
    });
    score -= 20;
  }

  // Merchant validation
  if (!session.merchant.name || session.merchant.name.trim().length === 0) {
    errors.push({
      field: 'merchant.name',
      message: 'Merchant name is required',
      severity: 'critical',
      code: 'MISSING_MERCHANT_NAME'
    });
    score -= 15;
  }

  // KRA PIN validation (if provided)
  if (session.merchant.kra_pin && !/^P\d{9}[A-Z]$/.test(session.merchant.kra_pin)) {
    warnings.push({
      field: 'merchant.kra_pin',
      message: 'KRA PIN format appears invalid',
      suggestion: 'KRA PIN should follow format P#########L (P + 9 digits + letter)',
      code: 'INVALID_KRA_PIN_FORMAT'
    });
    score -= 5;
  }

  // Device validation
  if (!session.device.printer_id) {
    errors.push({
      field: 'device.printer_id',
      message: 'Printer ID is required',
      severity: 'major',
      code: 'MISSING_PRINTER_ID'
    });
    score -= 10;
  }

  // Timestamp validation
  try {
    const openedAt = new Date(session.opened_at);
    if (isNaN(openedAt.getTime())) {
      errors.push({
        field: 'opened_at',
        message: 'Invalid opened_at timestamp',
        severity: 'major',
        code: 'INVALID_TIMESTAMP'
      });
      score -= 10;
    } else {
      // Check if timestamp is in the future
      if (openedAt > new Date()) {
        warnings.push({
          field: 'opened_at',
          message: 'Session opened timestamp is in the future',
          suggestion: 'Verify system clock is correct',
          code: 'FUTURE_TIMESTAMP'
        });
        score -= 3;
      }
    }
  } catch (error) {
    errors.push({
      field: 'opened_at',
      message: 'Invalid opened_at timestamp format',
      severity: 'major',
      code: 'INVALID_TIMESTAMP_FORMAT'
    });
    score -= 10;
  }

  // Status validation
  if (session.status === 'CLOSED' && !session.closed_at) {
    errors.push({
      field: 'closed_at',
      message: 'Closed sessions must have a closed_at timestamp',
      severity: 'major',
      code: 'MISSING_CLOSE_TIMESTAMP'
    });
    score -= 10;
  }

  return {
    valid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    score: Math.max(0, score)
  };
}

// ============================================================================
// EVENT VALIDATION
// ============================================================================

/**
 * Validate a receipt event
 */
export function validateReceiptEvent(event: ReceiptEvent): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let score = 100;

  // Required fields
  if (!event.event_id) {
    errors.push({
      field: 'event_id',
      message: 'Event ID is required',
      severity: 'critical',
      code: 'MISSING_EVENT_ID'
    });
    score -= 20;
  }

  if (!event.session_id) {
    errors.push({
      field: 'session_id',
      message: 'Session ID is required',
      severity: 'critical',
      code: 'MISSING_SESSION_ID'
    });
    score -= 20;
  }

  if (!event.raw_hash) {
    errors.push({
      field: 'raw_hash',
      message: 'Raw hash is required for audit trail',
      severity: 'critical',
      code: 'MISSING_RAW_HASH'
    });
    score -= 15;
  }

  // Sequence validation
  if (event.sequence <= 0) {
    errors.push({
      field: 'sequence',
      message: 'Event sequence must be positive',
      severity: 'major',
      code: 'INVALID_SEQUENCE'
    });
    score -= 10;
  }

  // Confidence validation
  if (event.parsed_confidence < 0 || event.parsed_confidence > 1) {
    errors.push({
      field: 'parsed_confidence',
      message: 'Parsed confidence must be between 0 and 1',
      severity: 'major',
      code: 'INVALID_CONFIDENCE'
    });
    score -= 10;
  } else if (event.parsed_confidence < 0.5) {
    warnings.push({
      field: 'parsed_confidence',
      message: 'Low parsing confidence detected',
      suggestion: 'Consider manual review of this event',
      code: 'LOW_CONFIDENCE'
    });
    score -= 5;
  }

  // Line items validation
  const itemValidation = validateLineItems(event.items);
  if (!itemValidation.valid) {
    itemValidation.errors.forEach(error => {
      errors.push({
        field: 'items',
        message: error,
        severity: 'major',
        code: 'INVALID_LINE_ITEM'
      });
    });
    score -= 10;
  }

  // Totals validation
  if (!validateEventTotals(event.totals)) {
    errors.push({
      field: 'totals',
      message: 'Event totals calculation is incorrect',
      severity: 'critical',
      code: 'INVALID_TOTALS'
    });
    score -= 20;
  }

  // Payment validation (if present)
  if (event.payment) {
    if (event.payment.amount <= 0) {
      errors.push({
        field: 'payment.amount',
        message: 'Payment amount must be positive',
        severity: 'major',
        code: 'INVALID_PAYMENT_AMOUNT'
      });
      score -= 10;
    }

    if (event.payment.method === 'MPESA' && !event.payment.reference) {
      warnings.push({
        field: 'payment.reference',
        message: 'M-Pesa payments should include transaction reference',
        suggestion: 'Include M-Pesa transaction code for better audit trail',
        code: 'MISSING_MPESA_REFERENCE'
      });
      score -= 3;
    }
  }

  // Type-specific validation
  if (event.type === 'REFUND' || event.type === 'VOID') {
    if (!event.source_receipt_no) {
      warnings.push({
        field: 'source_receipt_no',
        message: 'Refunds and voids should reference original receipt',
        suggestion: 'Include original receipt number for audit trail',
        code: 'MISSING_REFUND_REFERENCE'
      });
      score -= 3;
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    score: Math.max(0, score)
  };
}

// ============================================================================
// LINE ITEM VALIDATION
// ============================================================================

/**
 * Validate line items
 */
function validateLineItems(items: LineItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  items.forEach((item, index) => {
    // Name validation
    if (!item.name || item.name.trim().length === 0) {
      errors.push(`Item ${index + 1}: Name is required`);
    }

    // Quantity validation
    if (item.qty <= 0) {
      errors.push(`Item ${index + 1} (${item.name}): Quantity must be positive`);
    }

    // Price validation
    if (item.unit_price < 0) {
      errors.push(`Item ${index + 1} (${item.name}): Unit price cannot be negative`);
    }

    if (item.total_price < 0) {
      errors.push(`Item ${index + 1} (${item.name}): Total price cannot be negative`);
    }

    // Calculation validation
    const expectedTotal = (item.qty * item.unit_price) - (item.discount_amount || 0);
    if (Math.abs(expectedTotal - item.total_price) > 0.01) {
      errors.push(`Item ${index + 1} (${item.name}): Total price calculation is incorrect`);
    }

    // Tax validation
    if (item.tax_rate && (item.tax_rate < 0 || item.tax_rate > 1)) {
      errors.push(`Item ${index + 1} (${item.name}): Tax rate must be between 0 and 1`);
    }

    if (item.tax_amount && item.tax_amount < 0) {
      errors.push(`Item ${index + 1} (${item.name}): Tax amount cannot be negative`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// COMPLETE SESSION VALIDATION
// ============================================================================

/**
 * Validate a complete receipt session
 */
export function validateCompleteSession(completeSession: CompleteReceiptSession): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let score = 100;

  // Validate session
  const sessionValidation = validateReceiptSession(completeSession.session);
  errors.push(...sessionValidation.errors);
  warnings.push(...sessionValidation.warnings);
  score = Math.min(score, sessionValidation.score);

  // Validate events
  completeSession.events.forEach((event: ReceiptEvent, index: number) => {
    const eventValidation = validateReceiptEvent(event);
    
    // Add event-specific context to errors
    eventValidation.errors.forEach(error => {
      errors.push({
        ...error,
        field: `events[${index}].${error.field}`,
        message: `Event ${index + 1}: ${error.message}`
      });
    });

    eventValidation.warnings.forEach(warning => {
      warnings.push({
        ...warning,
        field: `events[${index}].${warning.field}`,
        message: `Event ${index + 1}: ${warning.message}`
      });
    });

    score = Math.min(score, eventValidation.score);
  });

  // Validate event sequence
  const sequences = completeSession.events.map((e: ReceiptEvent) => e.sequence).sort((a: number, b: number) => a - b);
  for (let i = 0; i < sequences.length; i++) {
    if (sequences[i] !== i + 1) {
      errors.push({
        field: 'events',
        message: `Event sequence gap detected: expected ${i + 1}, found ${sequences[i]}`,
        severity: 'major',
        code: 'SEQUENCE_GAP'
      });
      score -= 10;
      break;
    }
  }

  // Validate session totals (if present)
  if (completeSession.totals) {
    if (!validateSessionTotals(completeSession.totals, completeSession.events)) {
      errors.push({
        field: 'totals',
        message: 'Session totals do not match aggregated events',
        severity: 'critical',
        code: 'INVALID_SESSION_TOTALS'
      });
      score -= 20;
    }

    // Check if session should be closed
    if (completeSession.session.status === 'OPEN' && completeSession.totals) {
      warnings.push({
        field: 'session.status',
        message: 'Session has totals but is still marked as open',
        suggestion: 'Consider closing the session',
        code: 'OPEN_SESSION_WITH_TOTALS'
      });
      score -= 3;
    }
  }

  // Validate closed sessions have totals
  if (completeSession.session.status === 'CLOSED' && !completeSession.totals) {
    errors.push({
      field: 'totals',
      message: 'Closed sessions must have computed totals',
      severity: 'major',
      code: 'MISSING_SESSION_TOTALS'
    });
    score -= 15;
  }

  return {
    valid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    score: Math.max(0, score)
  };
}

// ============================================================================
// BUSINESS RULE VALIDATION
// ============================================================================

/**
 * Validate business rules for a complete session
 */
export function validateBusinessRules(completeSession: CompleteReceiptSession): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let score = 100;

  // Rule: Sessions should not be open for more than 24 hours
  if (completeSession.session.status === 'OPEN') {
    const openedAt = new Date(completeSession.session.opened_at);
    const now = new Date();
    const hoursOpen = (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursOpen > 24) {
      warnings.push({
        field: 'session.opened_at',
        message: `Session has been open for ${Math.round(hoursOpen)} hours`,
        suggestion: 'Consider closing long-running sessions',
        code: 'LONG_RUNNING_SESSION'
      });
      score -= 5;
    }
  }

  // Rule: Large transactions should have payment references
  const totalAmount = completeSession.totals?.total || 0;
  if (totalAmount > 10000) { // KES 10,000+
    const hasPaymentReference = completeSession.events.some(event => 
      event.payment && event.payment.reference
    );
    
    if (!hasPaymentReference) {
      warnings.push({
        field: 'events',
        message: 'Large transactions should include payment references',
        suggestion: 'Include M-Pesa codes or card references for audit trail',
        code: 'LARGE_TRANSACTION_NO_REFERENCE'
      });
      score -= 3;
    }
  }

  // Rule: Refunds should not exceed original sale amounts
  const saleTotal = completeSession.events
    .filter(e => e.type === 'SALE')
    .reduce((sum, e) => sum + e.totals.total, 0);
  
  const refundTotal = completeSession.events
    .filter(e => e.type === 'REFUND')
    .reduce((sum, e) => sum + e.totals.total, 0);

  if (refundTotal > saleTotal) {
    errors.push({
      field: 'events',
      message: 'Total refunds exceed total sales',
      severity: 'major',
      code: 'REFUND_EXCEEDS_SALES'
    });
    score -= 15;
  }

  // Rule: Sessions with KRA PIN should have proper tax calculations
  if (completeSession.session.merchant.kra_pin) {
    const hasProperTax = completeSession.events.every((event: ReceiptEvent) => 
      event.totals.tax >= 0 && event.totals.tax <= event.totals.subtotal * 0.2 // Max 20% tax
    );
    
    if (!hasProperTax) {
      warnings.push({
        field: 'events',
        message: 'Tax calculations may be incorrect for KRA-registered merchant',
        suggestion: 'Verify tax rates and calculations',
        code: 'SUSPICIOUS_TAX_CALCULATION'
      });
      score -= 5;
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    score: Math.max(0, score)
  };
}