# Application Scope & Mapping (FINAL, 2 Apps Only)

## Purpose
To lock scope and prevent feature leakage.

## 1️⃣ Tabeza Basic
**Transaction & Receipt Bridge**

### Goal
Enable venues to go live immediately using existing workflows.

### Authority Model
- **POS-Authoritative only**
- Manual ordering always present

### Capabilities
- POS printer integration (mandatory)
- Transaction context creation
- Digital receipt delivery
- Customer payments
- Simple vendor dashboard
- Order & payment history

### Explicitly Disabled
- Menus
- Customer ordering
- Staff ordering
- Promotions

### Ideal For
- Bars
- Restaurants
- Supermarkets
- High-throughput venues

## 2️⃣ Tabeza Venue
**Customer Interaction & Service Layer**

### Goal
Enable direct customer interaction without forcing POS APIs.

### Authority Model
Supports exactly one at a time:
- **POS-Authoritative + Manual**
- **Tabeza-Authoritative + Manual**

### Capabilities
- Standalone menus (not POS-linked)
- Customer order requests
- Two-way messaging
- Timed availability
- Payments
- Digital receipts

### Critical Constraints (Enforced)

#### If POS is active:
- staff ordering in Tabeza is **disabled**
- menus create **requests only**
- receipts **originate from POS**

#### If POS is absent:
- **Tabeza creates orders and receipts**

## Implementation Notes

### Database Schema Requirements
- `venue_mode` enum: `'basic'`, `'venue'`
- `authority_mode` enum: `'pos'`, `'tabeza'`
- `pos_integration_enabled` boolean
- `printer_required` boolean (true for Basic, conditional for Venue)

### UI/UX Enforcement
- Onboarding must determine mode before setup
- Settings must prevent invalid configurations
- Staff interface adapts based on authority mode
- Customer interface respects authority constraints

### Code Comments Required
```typescript
// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.
```