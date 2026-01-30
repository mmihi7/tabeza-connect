# Compliance Architecture - The Right Way

## 🎯 The Problem We Fixed

**Before**: The virtual printer had direct eTIMS compliance logic embedded at the edge layer.

**Why This Was Wrong**:
- Regulatory coupling at hardware/edge layer
- Harder certification & updates  
- Risk of printer delays when KRA is down
- Legal exposure (edge device making tax decisions)
- Violates the core principle: **Printer captures truth. Server decides compliance.**

## ✅ The Solution: Regulation-Agnostic Edge Layer

### What We Removed
- `compliance-manager.ts` - Direct eTIMS integration
- Regulatory decision-making logic
- KRA API calls from the printer
- Compliance configuration management

### What We Added
- `compliance-hook.ts` - Metadata-only compliance hints
- Clean separation of concerns
- Server-side compliance responsibility

## 🏗️ New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE LAYER (Printer)                        │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   POS System    │───▶│  Print Capture   │───▶│   Format    │ │
│  │   (Any Brand)   │    │     Layer        │    │  Detector   │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                         │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ Physical Printer│◀───│  Dual Output     │◀───│  Receipt    │ │
│  │   (Unchanged)   │    │    Manager       │    │   Parser    │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                 │                       │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ Digital Receipt │◀───│   QR Code &      │    │ Canonical   │ │
│  │   Delivery      │    │   Delivery       │    │ Receipt +   │ │
│  └─────────────────┘    └──────────────────┘    │ Hints Only  │ │
│                                                 └─────────────┘ │
│                         ┌──────────────────┐            │       │
│                         │   Sync Queue     │◀───────────┘       │
│                         │  (Offline-Ready) │                    │
│                         └──────────────────┘                    │
│                                 │                               │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER LAYER (Cloud)                        │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │  Receipt with   │───▶│   Compliance     │───▶│    eTIMS    │ │
│  │  Hints Received │    │    Engine        │    │ Integration │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                 │                       │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Audit Log     │◀───│  Business Rules  │    │ KRA Daraja  │ │
│  │   & Storage     │    │   & Validation   │    │ API Client  │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Implementation Details

### Edge Layer: Compliance Hook (Metadata Only)

```typescript
// compliance-hook.ts
export interface ComplianceHint {
  jurisdiction?: 'KE' | 'UG' | 'TZ' | 'RW';
  receipt_type?: 'SALE' | 'REFUND' | 'VOID' | 'ADJUSTMENT';
  business_category?: 'RESTAURANT' | 'RETAIL' | 'SERVICE' | 'OTHER';
  requires_tax_submission?: boolean;
  customer_type?: 'B2B' | 'B2C';
}

export function attachComplianceHints(receipt: any, hints: ComplianceHint): any {
  return {
    ...receipt,
    _compliance: {
      hints,
      captured_at: new Date().toISOString(),
      capture_source: 'PRINTER',
      processing_flags: {
        requires_review: hints.requires_tax_submission || false,
        high_value: receipt.totals?.total > 100000,
        cross_border: false
      }
    }
  };
}
```

**Key Principles**:
- ✅ NO regulatory logic
- ✅ NO API calls to KRA
- ✅ NO compliance decisions
- ✅ ONLY metadata hints
- ✅ Server makes all compliance decisions

### Server Layer: Where Compliance Lives

```
services/compliance-etims/
├── etims-client.ts      # KRA API integration
├── transform.ts         # Receipt → eTIMS format
├── submit.ts           # Submission logic
├── retry.ts            # Failure handling
└── audit-log.ts        # Compliance audit trail
```

## 🎯 Benefits of This Architecture

### 1. **Regulatory Safety**
- Edge devices don't make tax decisions
- Compliance logic centralized and auditable
- Easier to update when regulations change
- Clear legal responsibility boundaries

### 2. **Operational Reliability**
- Printers never blocked by KRA downtime
- Offline-first receipt capture
- Compliance processed asynchronously
- No regulatory coupling at edge

### 3. **Scalability & Maintenance**
- Single compliance service for all merchants
- Centralized regulatory updates
- Easier certification and auditing
- Clean separation of concerns

### 4. **Flexibility**
- Support multiple jurisdictions
- Different compliance modes per merchant
- Easy to add new regulatory requirements
- A/B testing of compliance strategies

## 🔄 Data Flow

### 1. Receipt Capture (Edge)
```
POS → Print Capture → Parser → Canonical Receipt + Hints → Sync Queue
```

### 2. Compliance Processing (Server)
```
Receipt + Hints → Compliance Engine → Business Rules → eTIMS API → Audit Log
```

### 3. Error Handling
```
eTIMS Failure → Retry Queue → Merchant Notification → Manual Review
```

## 🛡️ Security & Audit

### Edge Layer
- Receipt signing and integrity
- Tamper detection
- Secure transmission to server

### Server Layer  
- Compliance audit trails
- Regulatory submission logs
- Business rule validation
- Legal compliance reporting

## 📋 Migration Guide

### For Existing Implementations

1. **Remove Direct eTIMS Calls**
   ```typescript
   // ❌ Before
   await etimsClient.submit(receipt);
   
   // ✅ After  
   const hints = createDefaultHints(receipt);
   const receiptWithHints = attachComplianceHints(receipt, hints);
   await syncQueue.enqueue('receipt', receiptWithHints);
   ```

2. **Move Compliance Logic to Server**
   ```typescript
   // Server-side compliance service
   export class ComplianceService {
     async processReceipt(receiptWithHints: CanonicalReceipt) {
       const hints = getComplianceMetadata(receiptWithHints);
       
       if (hints?.requires_tax_submission) {
         await this.submitToETIMS(receiptWithHints);
       }
     }
   }
   ```

3. **Update Configuration**
   ```typescript
   // ❌ Before: Compliance config in printer
   const printer = createVirtualPrinter(merchantId, {
     enableEtims: true,
     etimsApiUrl: 'https://api.kra.go.ke/etims'
   });
   
   // ✅ After: Clean printer config
   const printer = createVirtualPrinter(merchantId, {
     forwardToPhysicalPrinter: true,
     generateQRCode: true
   });
   ```

## 🎯 Next Steps

### Recommended Implementation Order

1. **✅ DONE**: Remove compliance logic from virtual printer
2. **🔄 NEXT**: Create `packages/receipt-schema` for shared types
3. **📋 TODO**: Implement server-side compliance service
4. **📋 TODO**: Create printer-agent OS service
5. **📋 TODO**: Design audit & immutability model

### Server-Side Compliance Service Structure

```
services/compliance/
├── src/
│   ├── engines/
│   │   ├── etims-ke.ts          # Kenya eTIMS
│   │   ├── efris-ug.ts          # Uganda eFRIS  
│   │   └── vfd-tz.ts            # Tanzania VFD
│   ├── core/
│   │   ├── compliance-engine.ts
│   │   ├── business-rules.ts
│   │   └── audit-logger.ts
│   └── api/
│       ├── submit-receipt.ts
│       └── compliance-status.ts
└── tests/
    ├── etims-integration.test.ts
    └── business-rules.test.ts
```

## 🏆 Conclusion

This architectural fix transforms the virtual printer from a regulatory-coupled system to a clean, regulation-agnostic edge device that follows the core principle:

> **The printer captures truth. The server decides compliance.**

This makes the system:
- ✅ **Safer**: No regulatory decisions at edge
- ✅ **More reliable**: Never blocked by compliance APIs  
- ✅ **Easier to maintain**: Centralized compliance logic
- ✅ **More scalable**: Support multiple jurisdictions
- ✅ **Legally sound**: Clear responsibility boundaries

The virtual printer is now a pure receipt capture and processing system, exactly as it should be.