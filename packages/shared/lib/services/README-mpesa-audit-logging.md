# M-Pesa Audit Logging Implementation

## Overview

This document describes the implementation of Task 6: Essential logging and observability for the M-Pesa payment system audit. The audit logging system provides comprehensive tracking of all M-Pesa payment events with proper data redaction and security measures.

## Requirements Implemented

- **Requirement 6.4**: Log STK request payload (redacted), STK response, raw callback JSON
- **Requirement 7.1**: Log all M-Pesa payment creation, callback processing, and completion events
- **Requirement 7.2**: Log all payment state transitions with tab_id, tab_payment_id, checkout_request_id

## Components

### MpesaAuditLogger Class

The main audit logging service that handles all M-Pesa payment event logging.

**Key Features:**
- Automatic data redaction for sensitive information
- Phone number masking (254712345678 → 254*******78)
- Password and credential redaction
- Comprehensive event tracking
- Error handling and graceful degradation

### Audit Event Types

The system logs the following M-Pesa payment events:

1. **payment_initiated** - When a payment request is created
2. **payment_stk_sent** - When STK Push is sent to Safaricom
3. **payment_callback_received** - When callback is received from Safaricom
4. **payment_callback_processed** - When callback processing completes
5. **payment_verified** - When payment verification occurs
6. **payment_completed** - When payment is successfully completed
7. **payment_failed** - When payment fails at any stage
8. **payment_flagged_for_review** - When payment requires manual review
9. **payment_state_transition** - When payment status changes

### Data Redaction

The audit logger automatically redacts sensitive information:

**STK Request Payload:**
- `Password` field → `[REDACTED]`
- Phone numbers → Masked format (254*******78)
- Preserves non-sensitive debugging information

**Callback Data:**
- Phone numbers in metadata → Masked format
- Preserves transaction details for audit purposes

**General:**
- All phone numbers → First 3 and last 2 digits visible
- Short phone numbers → `[MASKED]`

## Integration Points

### Payment Initiation API (`apps/customer/app/api/payments/mpesa/route.ts`)

Logs the following events:
- Payment initiation with request details
- STK Push request and response (redacted)
- State transitions (initiated → stk_sent → success/failed)
- Payment failures with error details

### Callback Handler (`apps/customer/app/api/mpesa/callback/route.ts`)

Logs the following events:
- Raw callback receipt with full JSON data
- Callback processing results
- Payment verification steps
- Final payment completion or failure
- State transitions during callback processing

## Usage Examples

### Basic Event Logging

```typescript
import { logMpesaPaymentEvent } from '@tabeza/shared/lib/services/mpesa-audit-logger';

await logMpesaPaymentEvent('payment_initiated', {
  tab_id: 'tab-123',
  tab_payment_id: 'payment-456',
  bar_id: 'bar-789',
  amount: 100,
  phone_number: '254712345678',
  environment: 'sandbox'
});
```

### State Transition Logging

```typescript
import { logMpesaStateTransition } from '@tabeza/shared/lib/services/mpesa-audit-logger';

await logMpesaStateTransition({
  tab_id: 'tab-123',
  tab_payment_id: 'payment-456',
  checkout_request_id: 'checkout-789',
  previous_status: 'initiated',
  new_status: 'stk_sent',
  transition_reason: 'STK Push successful'
});
```

### STK Push Logging

```typescript
await logMpesaPaymentEvent('payment_stk_sent', {
  tab_id: 'tab-123',
  tab_payment_id: 'payment-456',
  checkout_request_id: 'checkout-789',
  stk_request_payload: {
    // Full payload - sensitive data will be redacted automatically
    BusinessShortCode: '174379',
    Password: 'sensitive-password', // Will be redacted
    PhoneNumber: '254712345678', // Will be masked
    Amount: 100
  },
  stk_response: {
    ResponseCode: '0',
    CheckoutRequestID: 'checkout-789'
  },
  response_time_ms: 1500
});
```

## Database Schema

All audit logs are stored in the existing `audit_logs` table:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id),
  tab_id UUID REFERENCES tabs(id),
  staff_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit Log Details Structure

The `details` JSONB field contains:

```json
{
  "tab_payment_id": "payment-456",
  "checkout_request_id": "checkout-789",
  "amount": 100,
  "phone_number": "254*******78",
  "environment": "sandbox",
  "stk_request_payload": {
    "BusinessShortCode": "174379",
    "Password": "[REDACTED]",
    "Amount": 100,
    "PhoneNumber": "254*******78"
  },
  "stk_response": {
    "ResponseCode": "0",
    "CheckoutRequestID": "checkout-789"
  },
  "response_time_ms": 1500,
  "logged_at": "2026-01-29T07:55:48.264Z",
  "log_version": "1.0"
}
```

## Security Considerations

1. **Data Redaction**: All sensitive data is automatically redacted before storage
2. **Phone Number Masking**: Phone numbers are masked to protect customer privacy
3. **Credential Protection**: Passwords and API keys are never stored in logs
4. **Error Handling**: Logging failures don't affect payment processing
5. **Access Control**: Audit logs inherit database-level access controls

## Monitoring and Alerting

The audit logging system provides data for:

- Payment flow monitoring and debugging
- Performance analysis (response times)
- Error pattern identification
- Compliance reporting
- Security incident investigation

## Testing

Comprehensive unit tests cover:

- Event logging functionality
- Data redaction and masking
- Error handling and graceful degradation
- Phone number masking edge cases
- Database interaction mocking

Run tests with:
```bash
pnpm --filter @tabeza/shared test mpesa-audit-logger.test.ts
```

## Performance Impact

The audit logging system is designed for minimal performance impact:

- Asynchronous logging operations
- Graceful error handling (no payment blocking)
- Efficient data redaction algorithms
- Singleton logger instance for memory efficiency

## Future Enhancements

Potential improvements for future iterations:

1. **Log Aggregation**: Integration with external logging services
2. **Real-time Monitoring**: Dashboard for payment flow visualization
3. **Automated Alerting**: Notification system for payment anomalies
4. **Log Retention**: Automated cleanup of old audit logs
5. **Enhanced Analytics**: Payment pattern analysis and reporting