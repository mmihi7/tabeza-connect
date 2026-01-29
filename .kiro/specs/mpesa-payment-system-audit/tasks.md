# Implementation Plan: M-Pesa Payment System Audit (MVP)

## Overview

This implementation plan creates a safe, correct, shippable M-Pesa flow by enhancing the existing system with minimal, focused improvements. The approach prioritizes database constraints for safety, proper callback handling, and essential logging while avoiding enterprise overkill.

## Tasks

- [x] 1. Database foundation - ensure tab_payments table safety
  - Verify tab_payments table has required columns (id, tab_id, amount, status, checkout_request_id, mpesa_receipt, created_at)
  - Add hard constraints: UNIQUE (checkout_request_id) and UNIQUE (tab_id) WHERE status IN ('initiated', 'stk_sent')
  - Update status values to: 'initiated', 'stk_sent', 'success', 'failed'
  - _Requirements: 4.1, 4.2, 1.4_

- [x] 2. Payment initiation API route enhancement
  - [x] 2.1 Implement payment validation logic
    - Validate tab exists and is open
    - Validate amount > 0 and amount ≤ tab balance
    - _Requirements: 1.2, 5.1_

  - [x] 2.2 Create tab_payments record with proper flow
    - Create tab_payments row with status='initiated'
    - Load M-Pesa config for the bar using existing loadMpesaConfigFromBar
    - Generate OAuth token on demand
    - Send STK Push and store CheckoutRequestID
    - Update status to 'stk_sent'
    - _Requirements: 1.1, 1.3_

- [x] 3. OAuth token handling (keep simple)
  - Implement on-demand OAuth token generation using existing mpesa-oauth service
  - Use GET /oauth/v1/generate?grant_type=client_credentials with Basic auth
  - Fail payment immediately if OAuth fails (no retries yet)
  - _Requirements: 3.1, 6.3_

- [x] 4. Enhanced callback handling (critical path)
  - [x] 4.1 Implement robust callback parsing and validation
    - Parse CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata
    - Find tab_payments by checkout_request_id
    - Handle not found cases gracefully (log + return 200)
    - _Requirements: 3.2, 3.3_

  - [x] 4.2 Implement callback processing logic
    - For ResultCode === 0: extract receipt + amount, update payment to 'success', resolve tab
    - For other ResultCodes: update payment to 'failed'
    - Ensure callback idempotency through database constraints
    - _Requirements: 3.4, 5.4, 5.5_

- [x] 5. Inline verification rules (no separate service)
  - On success callback: verify amount matches tab_payments.amount
  - Verify payment is still in 'stk_sent' status
  - On mismatch: mark payment 'failed' and log error
  - _Requirements: 5.1, 5.2_

- [x] 6. Essential logging and observability
  - Log STK request payload (redacted), STK response, raw callback JSON
  - Log all payment state transitions with tab_id, tab_payment_id, checkout_request_id
  - Use existing audit_logs table for payment events
  - _Requirements: 6.4, 7.1, 7.2_

- [x] 7. Sandbox configuration validation
  - Ensure sandbox uses shortcode 174379 and Safaricom test MSISDNs
  - Verify consumer key/secret per app configuration
  - Validate HTTPS callback URL requirement
  - _Requirements: 3.1, 6.1_

- [x] 8. End-to-end integration test
  - Test complete flow: open tab → initiate payment → receive callback → tab closes
  - Test callback idempotency (second callback does nothing)
  - Verify integration with existing tab resolution system
  - _Requirements: 2.1, 2.5_

- [x] 9. Final checkpoint - production readiness
  - Ensure all database constraints are working
  - Verify error handling provides clear messages
  - Test with both sandbox and production configurations
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- One payment attempt = one database row principle
- Database constraints handle most idempotency and race condition prevention
- Focus on correctness and safety over complex architecture
- Build upon existing M-Pesa configuration and tab resolution systems
- No property-based tests, generic managers, or callback signature validation in MVP
- Receipt uniqueness constraints and retry orchestration can be added later