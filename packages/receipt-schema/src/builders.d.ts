/**
 * TABEZA Receipt Schema Builders
 * Factory functions for creating valid receipt sessions and events
 */
import { ReceiptSession, ReceiptEvent, CompleteReceiptSession, SessionTotals, AuditEvent, LineItem, Payment } from './session';
/**
 * Create a new receipt session
 */
export declare function createReceiptSession(params: {
    merchantId: string;
    merchantName: string;
    printerId: string;
    tableNumber?: string;
    customerIdentifier?: string;
    kraPin?: string;
    location?: string;
}): ReceiptSession;
/**
 * Create a receipt event within a session
 */
export declare function createReceiptEvent(params: {
    sessionId: string;
    type: 'SALE' | 'REFUND' | 'VOID' | 'ADJUSTMENT' | 'PARTIAL_BILL';
    sequence: number;
    items: LineItem[];
    payment?: Payment;
    sourceReceiptNo?: string;
    rawHash: string;
    parsedConfidence: number;
}): ReceiptEvent;
/**
 * Create session totals from events
 */
export declare function createSessionTotals(events: ReceiptEvent[]): SessionTotals;
/**
 * Create a complete receipt session
 */
export declare function createCompleteSession(session: ReceiptSession, events: ReceiptEvent[], totals?: SessionTotals): CompleteReceiptSession;
/**
 * Create an audit event
 */
export declare function createAuditEvent(params: {
    type: 'SESSION_OPENED' | 'RECEIPT_CAPTURED' | 'SESSION_CLOSED' | 'PAYMENT_PROCESSED' | 'ETIMS_SUBMITTED' | 'COMPLIANCE_CHECKED' | 'DATA_CORRECTED';
    entityId: string;
    entityType: 'SESSION' | 'EVENT' | 'PAYMENT';
    actor?: string;
    source: 'PRINTER' | 'STAFF' | 'SYSTEM' | 'API';
    data?: Record<string, any>;
    previousHash?: string;
}): AuditEvent;
/**
 * Validate line item calculations
 */
export declare function validateLineItem(item: LineItem): boolean;
/**
 * Validate all line items in an array
 */
export declare function validateLineItems(items: LineItem[]): {
    valid: boolean;
    errors: string[];
};
/**
 * Create a test receipt session for development/testing
 */
export declare function createTestSession(merchantName?: string): CompleteReceiptSession;
//# sourceMappingURL=builders.d.ts.map