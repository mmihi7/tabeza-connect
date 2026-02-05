# TABEZA Receipt Schema v1

**Session-based, multi-order transaction truth infrastructure**

## Overview

The TABEZA Receipt Schema is designed around a fundamental insight: **TABEZA is session-based, not single-receipt based**. Unlike traditional POS systems that generate one receipt per transaction, TABEZA handles complex scenarios where:

- A single customer session may contain multiple POS print events
- Each print event represents an order, partial bill, refund, or adjustment
- The session maintains shared headers and final settlement totals
- This works perfectly for restaurants, bars, supermarkets, and handles split bills

## Key Concepts

### 🎯 Session-Based Architecture

```
Receipt Session (Header - Once per session)
├── Receipt Event 1 (First order)
├── Receipt Event 2 (Additional items)  
├── Receipt Event 3 (Partial payment)
├── Receipt Event 4 (Refund)
└── Session Totals (Final settlement)
```

### 📋 Core Components

1. **Receipt Session**: Header information set once per session
2. **Receipt Events**: Each POS print = one event (orders, payments, refunds)
3. **Session Totals**: Computed when session closes
4. **Audit Events**: Immutable audit trail for compliance

## Installation

```bash
# In a pnpm workspace
pnpm add @tabeza/receipt-schema

# Standalone
npm install @tabeza/receipt-schema
```

## Quick Start

```typescript
import {
  createReceiptSession,
  createReceiptEvent,
  createSessionTotals,
  createCompleteSession,
  validateCompleteSession
} from '@tabeza/receipt-schema';

// 1. Create a session
const session = createReceiptSession({
  merchantId: 'restaurant-001',
  merchantName: 'Mama Njeri Restaurant',
  printerId: 'epson-tm-t20',
  tableNumber: '7',
  kraPin: 'P051234567A'
});

// 2. Add events (each POS print)
const order1 = createReceiptEvent({
  sessionId: session.tabeza_receipt_id,
  type: 'SALE',
  sequence: 1,
  items: [
    { name: 'Ugali', qty: 2, unit_price: 50, total_price: 100 },
    { name: 'Sukuma Wiki', qty: 1, unit_price: 80, total_price: 80 }
  ],
  rawHash: 'order1-hash',
  parsedConfidence: 0.98
});

const payment = createReceiptEvent({
  sessionId: session.tabeza_receipt_id,
  type: 'PARTIAL_BILL',
  sequence: 2,
  items: [],
  payment: {
    method: 'MPESA',
    amount: 180,
    currency: 'KES',
    reference: 'QH7RTXM2',
    status: 'COMPLETED'
  },
  rawHash: 'payment-hash',
  parsedConfidence: 1.0
});

// 3. Calculate totals and close session
const events = [order1, payment];
const totals = createSessionTotals(events);
const closedSession = { ...session, status: 'CLOSED', closed_at: new Date().toISOString() };
const completeSession = createCompleteSession(closedSession, events, totals);

// 4. Validate
const validation = validateCompleteSession(completeSession);
console.log('Valid:', validation.valid);
console.log('Score:', validation.score);
```

## Real-World Examples

### Restaurant Workflow

```typescript
// Table orders multiple items over time, pays once
const session = createReceiptSession({
  merchantId: 'restaurant-001',
  merchantName: 'Nyama Choma Palace',
  printerId: 'epson-001',
  tableNumber: '12'
});

// First order
const appetizers = createReceiptEvent({
  sessionId: session.tabeza_receipt_id,
  type: 'SALE',
  sequence: 1,
  items: [{ name: 'Samosas', qty: 4, unit_price: 50, total_price: 200 }],
  rawHash: 'hash1',
  parsedConfidence: 0.95
});

// Main course
const mainCourse = createReceiptEvent({
  sessionId: session.tabeza_receipt_id,
  type: 'SALE', 
  sequence: 2,
  items: [
    { name: 'Nyama Choma', qty: 1, unit_price: 800, total_price: 800 },
    { name: 'Ugali', qty: 2, unit_price: 50, total_price: 100 }
  ],
  rawHash: 'hash2',
  parsedConfidence: 0.92
});

// Final payment
const payment = createReceiptEvent({
  sessionId: session.tabeza_receipt_id,
  type: 'PARTIAL_BILL',
  sequence: 3,
  items: [],
  payment: {
    method: 'MPESA',
    amount: 1100,
    currency: 'KES',
    reference: 'QK8MNTX5',
    status: 'COMPLETED'
  },
  rawHash: 'hash3',
  parsedConfidence: 1.0
});
```

### Bar Tab Workflow

```typescript
// Multiple rounds of drinks, partial payments, final settlement
const barSession = createReceiptSession({
  merchantId: 'bar-001',
  merchantName: 'Tabeza Sports Bar',
  printerId: 'star-tsp100',
  tableNumber: '8',
  customerIdentifier: 'device-xyz789'
});

// Round 1
const round1 = createReceiptEvent({
  sessionId: barSession.tabeza_receipt_id,
  type: 'SALE',
  sequence: 1,
  items: [{ name: 'Tusker', qty: 3, unit_price: 200, total_price: 600 }],
  rawHash: 'round1-hash',
  parsedConfidence: 0.94
});

// Round 2  
const round2 = createReceiptEvent({
  sessionId: barSession.tabeza_receipt_id,
  type: 'SALE',
  sequence: 2,
  items: [{ name: 'Nyama Choma', qty: 1, unit_price: 500, total_price: 500 }],
  rawHash: 'round2-hash',
  parsedConfidence: 0.91
});

// Partial payment
const partialPayment = createReceiptEvent({
  sessionId: barSession.tabeza_receipt_id,
  type: 'PARTIAL_BILL',
  sequence: 3,
  items: [],
  payment: {
    method: 'MPESA',
    amount: 600,
    currency: 'KES',
    reference: 'QJ7KRTX9',
    status: 'COMPLETED'
  },
  rawHash: 'payment1-hash',
  parsedConfidence: 1.0
});

// Final settlement
const finalPayment = createReceiptEvent({
  sessionId: barSession.tabeza_receipt_id,
  type: 'PARTIAL_BILL',
  sequence: 4,
  items: [],
  payment: {
    method: 'CASH',
    amount: 500,
    currency: 'KES',
    status: 'COMPLETED'
  },
  rawHash: 'payment2-hash',
  parsedConfidence: 1.0
});
```

## Validation & Business Rules

The schema includes comprehensive validation:

```typescript
import { 
  validateCompleteSession, 
  validateBusinessRules,
  calculateHealthScore 
} from '@tabeza/receipt-schema';

const validation = validateCompleteSession(completeSession);
const businessValidation = validateBusinessRules(completeSession);
const health = calculateHealthScore(completeSession);

console.log('Structural validation:', validation.valid);
console.log('Business rules:', businessValidation.valid);
console.log('Health score:', health.score);
console.log('Issues:', health.issues);
console.log('Recommendations:', health.recommendations);
```

### Built-in Business Rules

- ✅ Refunds cannot exceed original sales
- ✅ Large transactions should have payment references
- ✅ KRA-registered merchants should have proper tax calculations
- ✅ Sessions shouldn't be open for more than 24 hours
- ✅ Event sequences must be continuous
- ✅ Mathematical validation of all totals

## Compliance Integration

The schema works seamlessly with compliance systems:

```typescript
import { attachComplianceHints } from '@tabeza/virtual-printer';

// Add compliance hints (metadata only)
const hints = {
  jurisdiction: 'KE',
  receipt_type: 'SALE',
  business_category: 'RESTAURANT',
  requires_tax_submission: true
};

const receiptWithHints = attachComplianceHints(completeSession, hints);
// Server-side compliance service processes the hints
```

## TypeScript Support

Full TypeScript support with comprehensive types:

```typescript
import type {
  ReceiptSession,
  ReceiptEvent,
  CompleteReceiptSession,
  LineItem,
  Payment,
  ValidationResult
} from '@tabeza/receipt-schema';
```

## Testing Utilities

Built-in test helpers:

```typescript
import { createTestSession, isValidForProcessing } from '@tabeza/receipt-schema';

// Create test data
const testSession = createTestSession('Test Restaurant');

// Quick validation
const isValid = isValidForProcessing(testSession);
```

## Architecture Benefits

### 🎯 **Session-Based Truth**
- Handles complex multi-order scenarios
- Perfect for restaurants, bars, retail
- Supports split bills and partial payments

### 🔒 **Audit-Ready**
- Immutable event chain
- Comprehensive validation
- Business rule enforcement

### 🌍 **Africa-Ready**
- KES currency support
- KRA PIN validation
- M-Pesa payment integration
- Multi-jurisdiction compliance hints

### 🚀 **Scalable**
- Works with any POS system
- Supports offline scenarios
- Extensible for new business types

## API Reference

### Core Functions

- `createReceiptSession()` - Create new session
- `createReceiptEvent()` - Add event to session
- `createSessionTotals()` - Calculate final totals
- `createCompleteSession()` - Combine session + events + totals

### Validation Functions

- `validateReceiptSession()` - Validate session structure
- `validateReceiptEvent()` - Validate individual event
- `validateCompleteSession()` - Full session validation
- `validateBusinessRules()` - Business logic validation

### Utility Functions

- `isValidForProcessing()` - Quick validation check
- `calculateHealthScore()` - Get session health metrics
- `getSessionSummary()` - Extract key session info
- `createTestSession()` - Generate test data

## Schema Version

Current version: **1.0.0**

```typescript
import { SCHEMA_VERSION, getSchemaInfo } from '@tabeza/receipt-schema';

console.log('Schema version:', SCHEMA_VERSION);
console.log('Schema info:', getSchemaInfo());
```

## Contributing

This schema is part of the TABEZA ecosystem. For contributions:

1. Follow the session-based architecture principles
2. Maintain backward compatibility
3. Add comprehensive tests
4. Update documentation

## License

Part of the TABEZA project. See main project license.