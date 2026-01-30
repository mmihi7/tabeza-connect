/**
 * TABEZA Receipt Schema Builders
 * Factory functions for creating valid receipt sessions and events
 */

import { 
  ReceiptSession, 
  ReceiptEvent, 
  CompleteReceiptSession,
  SessionTotals,
  AuditEvent,
  Merchant,
  Device,
  LineItem,
  Payment
} from './session';

// ============================================================================
// SESSION BUILDERS
// ============================================================================

/**
 * Create a new receipt session
 */
export function createReceiptSession(params: {
  merchantId: string;
  merchantName: string;
  printerId: string;
  tableNumber?: string;
  customerIdentifier?: string;
  kraPin?: string;
  location?: string;
}): ReceiptSession {
  const now = new Date().toISOString();
  const sessionRef = generateSessionReference();
  
  return {
    tabeza_receipt_id: generateTabezaReceiptId(),
    session_reference: sessionRef,
    merchant: {
      id: params.merchantId,
      name: params.merchantName,
      kra_pin: params.kraPin,
      location: params.location
    },
    device: {
      printer_id: params.printerId
    },
    opened_at: now,
    currency: 'KES',
    status: 'OPEN',
    table_number: params.tableNumber,
    customer_identifier: params.customerIdentifier
  };
}

/**
 * Create a receipt event within a session
 */
export function createReceiptEvent(params: {
  sessionId: string;
  type: 'SALE' | 'REFUND' | 'VOID' | 'ADJUSTMENT' | 'PARTIAL_BILL';
  sequence: number;
  items: LineItem[];
  payment?: Payment;
  sourceReceiptNo?: string;
  rawHash: string;
  parsedConfidence: number;
}): ReceiptEvent {
  const totals = calculateEventTotals(params.items);
  
  return {
    event_id: generateEventId(),
    session_id: params.sessionId,
    source_receipt_no: params.sourceReceiptNo,
    printed_at: new Date().toISOString(),
    type: params.type,
    sequence: params.sequence,
    items: params.items,
    totals,
    payment: params.payment,
    raw_hash: params.rawHash,
    parsed_confidence: params.parsedConfidence
  };
}

/**
 * Create session totals from events
 */
export function createSessionTotals(events: ReceiptEvent[]): SessionTotals {
  const aggregated = events.reduce((acc, event) => {
    // Handle different event types
    const multiplier = event.type === 'REFUND' || event.type === 'VOID' ? -1 : 1;
    
    return {
      subtotal: acc.subtotal + (event.totals.subtotal * multiplier),
      tax: acc.tax + (event.totals.tax * multiplier),
      discount: acc.discount + (event.totals.discount * multiplier),
      service_charge: acc.service_charge + (event.totals.service_charge * multiplier),
      total: acc.total + (event.totals.total * multiplier)
    };
  }, { subtotal: 0, tax: 0, discount: 0, service_charge: 0, total: 0 });

  // Calculate payments
  const paid = events
    .filter(event => event.payment?.status === 'COMPLETED')
    .reduce((sum, event) => sum + (event.payment?.amount || 0), 0);

  // Count events by type
  const eventCounts = events.reduce((counts, event) => {
    counts.total_events++;
    switch (event.type) {
      case 'SALE':
      case 'PARTIAL_BILL':
        counts.sale_events++;
        break;
      case 'REFUND':
        counts.refund_events++;
        break;
      case 'VOID':
        counts.void_events++;
        break;
    }
    return counts;
  }, { total_events: 0, sale_events: 0, refund_events: 0, void_events: 0 });

  return {
    ...aggregated,
    paid,
    balance: aggregated.total - paid,
    ...eventCounts,
    computed_at: new Date().toISOString()
  };
}

/**
 * Create a complete receipt session
 */
export function createCompleteSession(
  session: ReceiptSession,
  events: ReceiptEvent[],
  totals?: SessionTotals
): CompleteReceiptSession {
  const now = new Date().toISOString();
  
  return {
    session,
    events,
    totals,
    created_at: now,
    updated_at: now,
    version: '1.0.0'
  };
}

// ============================================================================
// AUDIT BUILDERS
// ============================================================================

/**
 * Create an audit event
 */
export function createAuditEvent(params: {
  type: 'SESSION_OPENED' | 'RECEIPT_CAPTURED' | 'SESSION_CLOSED' | 'PAYMENT_PROCESSED' | 'ETIMS_SUBMITTED' | 'COMPLIANCE_CHECKED' | 'DATA_CORRECTED';
  entityId: string;
  entityType: 'SESSION' | 'EVENT' | 'PAYMENT';
  actor?: string;
  source: 'PRINTER' | 'STAFF' | 'SYSTEM' | 'API';
  data?: Record<string, any>;
  previousHash?: string;
}): AuditEvent {
  const auditData = {
    id: generateAuditId(),
    type: params.type,
    entity_id: params.entityId,
    entity_type: params.entityType,
    timestamp: new Date().toISOString(),
    actor: params.actor,
    source: params.source,
    data: params.data,
    previous_hash: params.previousHash,
    hash: '' // Will be calculated after creation
  };

  // Calculate hash
  auditData.hash = calculateAuditHash(auditData);
  
  return auditData;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate event totals from line items
 */
function calculateEventTotals(items: LineItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const tax = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0);
  const discount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  
  return {
    subtotal,
    tax,
    discount,
    service_charge: 0, // Usually applied at session level
    total: subtotal + tax - discount
  };
}

/**
 * Generate unique TABEZA receipt ID
 */
function generateTabezaReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `tbz_${timestamp}_${random}`;
}

/**
 * Generate session reference (public-facing, QR-friendly)
 */
function generateSessionReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate event ID
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `evt_${timestamp}_${random}`;
}

/**
 * Generate audit event ID
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `aud_${timestamp}_${random}`;
}

/**
 * Calculate hash for audit event (simplified)
 */
function calculateAuditHash(auditEvent: Omit<AuditEvent, 'hash'>): string {
  const crypto = require('crypto');
  const content = JSON.stringify({
    type: auditEvent.type,
    entity_id: auditEvent.entity_id,
    timestamp: auditEvent.timestamp,
    data: auditEvent.data,
    previous_hash: auditEvent.previous_hash
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate line item calculations
 */
export function validateLineItem(item: LineItem): boolean {
  const expectedTotal = item.qty * item.unit_price - (item.discount_amount || 0);
  return Math.abs(expectedTotal - item.total_price) < 0.01;
}

/**
 * Validate all line items in an array
 */
export function validateLineItems(items: LineItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  items.forEach((item, index) => {
    if (!validateLineItem(item)) {
      errors.push(`Item ${index + 1} (${item.name}): Total price calculation is incorrect`);
    }
    
    if (item.qty <= 0) {
      errors.push(`Item ${index + 1} (${item.name}): Quantity must be positive`);
    }
    
    if (item.unit_price < 0) {
      errors.push(`Item ${index + 1} (${item.name}): Unit price cannot be negative`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a test receipt session for development/testing
 */
export function createTestSession(merchantName: string = 'Test Restaurant'): CompleteReceiptSession {
  const session = createReceiptSession({
    merchantId: 'test-merchant-001',
    merchantName,
    printerId: 'test-printer-001',
    tableNumber: '5',
    kraPin: 'P051234567A'
  });

  const items: LineItem[] = [
    {
      name: 'Ugali',
      qty: 1,
      unit_price: 150,
      total_price: 150
    },
    {
      name: 'Sukuma Wiki',
      qty: 1,
      unit_price: 100,
      total_price: 100
    },
    {
      name: 'Nyama Choma',
      qty: 1,
      unit_price: 350,
      total_price: 350
    }
  ];

  const event = createReceiptEvent({
    sessionId: session.tabeza_receipt_id,
    type: 'SALE',
    sequence: 1,
    items,
    rawHash: 'test-hash-123',
    parsedConfidence: 0.95,
    payment: {
      method: 'MPESA',
      amount: 600,
      currency: 'KES',
      reference: 'QH7RTXM2',
      status: 'COMPLETED'
    }
  });

  const totals = createSessionTotals([event]);
  
  return createCompleteSession(
    { ...session, status: 'CLOSED', closed_at: new Date().toISOString() },
    [event],
    totals
  );
}