# Implementation Plan: Fix Close Tab Errors

## Overview

This implementation plan addresses the critical tab closing errors in both customer and staff applications. The work is organized into discrete tasks that build incrementally, starting with database validation, then API implementation, followed by UI updates, and finally comprehensive testing.

## Tasks

- [x] 1. Validate and create database close_tab function
  - Check if close_tab function exists in database
  - If missing, create the function with proper signature and logic
  - Test function manually with SQL queries
  - Verify function handles NULL and positive write-off amounts correctly
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 2. Implement customer app close tab API endpoint
  - [x] 2.1 Create API route file at `apps/customer/app/api/tabs/close/route.ts`
    - Set up POST handler with request validation
    - Extract tabId from request body
    - Extract device identifier from request headers/cookies
    - _Requirements: 3.1, 3.2_
  
  - [x] 2.2 Implement tab validation logic
    - Query tab from database with device_identifier match
    - Return 404 if tab not found
    - Return 401 if device identifier doesn't match
    - _Requirements: 1.5, 3.2_
  
  - [x] 2.3 Implement balance and pending orders checks
    - Calculate tab balance (confirmed orders - successful payments)
    - Check for pending staff orders awaiting approval
    - Check for pending customer orders not yet served
    - Return 400 with details if balance > 0 or pending orders exist
    - _Requirements: 1.2, 3.4_
  
  - [x] 2.4 Implement close_tab RPC call
    - Call supabase.rpc('close_tab', { p_tab_id: tabId, p_write_off_amount: null })
    - Handle RPC errors with proper error categorization
    - Return 200 with success message on successful closure
    - Return 500 with sanitized error message on database errors
    - _Requirements: 1.1, 3.3, 3.5, 3.6_
  
  - [x] 2.5 Write property test for API endpoint validation chain
    - **Property 6: API Endpoint Validation Chain**
    - **Validates: Requirements 3.2, 3.3, 3.6**
  
  - [x] 2.6 Write property test for device authorization
    - **Property 5: Device Authorization Enforcement**
    - **Validates: Requirements 1.5, 3.2**

- [x] 3. Update customer app menu page to use new API endpoint
  - [x] 3.1 Update close tab handler in `apps/customer/app/menu/page.tsx`
    - Replace existing fetch call with correct endpoint path
    - Add proper error handling for different status codes
    - Display user-friendly error messages based on error type
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [x] 3.2 Implement redirect on successful closure
    - Clear session storage (cart, tab data)
    - Navigate to home page after successful closure
    - _Requirements: 1.3_
  
  - [x] 3.3 Write unit tests for customer close tab flow
    - Test successful closure with zero balance
    - Test rejection with positive balance
    - Test rejection with pending orders
    - Test authorization failure
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 4. Checkpoint - Test customer app close tab functionality
  - Manually test closing tab with zero balance
  - Manually test attempting to close tab with positive balance
  - Manually test attempting to close tab with pending orders
  - Verify error messages are clear and helpful
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Enhance staff app close tab error handling
  - [x] 5.1 Create error handling utility in `apps/staff/app/tabs/[id]/page.tsx`
    - Implement handleCloseTabError function with error categorization
    - Map database errors to user-friendly messages
    - Determine if errors are retryable
    - _Requirements: 2.5, 4.1, 4.3_
  
  - [x] 5.2 Update executeCloseTab function
    - Wrap RPC call in try-catch with enhanced error handling
    - Use handleCloseTabError to process errors
    - Display detailed error messages with troubleshooting guidance
    - Show retry option for retryable errors
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 5.3 Improve validation checks before closure
    - Enhance hasPendingStaffOrders check with order details
    - Enhance hasPendingCustomerOrders check with order details
    - Display specific order information in error messages
    - _Requirements: 2.3, 2.4, 4.2_
  
  - [x] 5.4 Write property test for staff close tab with zero balance
    - **Property 1: Zero Balance Tab Closure**
    - **Validates: Requirements 1.1, 2.1, 5.3, 5.5**
  
  - [x] 5.5 Write property test for staff overdue transition
    - **Property 3: Positive Balance Overdue Transition for Staff**
    - **Validates: Requirements 2.2, 5.4, 5.6**

- [x] 6. Implement comprehensive error handling
  - [x] 6.1 Create shared error handling utilities in `packages/shared/`
    - Create error types and interfaces
    - Implement error message sanitization function
    - Implement error logging function
    - _Requirements: 4.4, 4.5_
  
  - [x] 6.2 Add error logging to API endpoint
    - Log all database errors to audit_logs table
    - Include timestamp, tab ID, error type, and sanitized message
    - _Requirements: 4.4_
  
  - [x] 6.3 Add error logging to staff app
    - Log all RPC errors to audit_logs table
    - Include staff user ID in log entries
    - _Requirements: 4.4_
  
  - [x] 6.4 Write property test for error message safety
    - **Property 8: Error Message Safety**
    - **Validates: Requirements 4.5**
  
  - [x] 6.5 Write property test for error logging completeness
    - **Property 9: Error Logging Completeness**
    - **Validates: Requirements 4.4**

- [x] 7. Checkpoint - Test staff app close tab functionality
  - Manually test closing tab with zero balance
  - Manually test pushing tab to overdue with positive balance
  - Manually test prevention of closure with pending orders
  - Verify error messages include troubleshooting guidance
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement property-based tests for core properties
  - [x] 8.1 Write property test for positive balance rejection
    - **Property 2: Positive Balance Rejection for Customers**
    - **Validates: Requirements 1.2, 3.4**
  
  - [x] 8.2 Write property test for pending orders blocking closure
    - **Property 4: Pending Orders Block Closure**
    - **Validates: Requirements 2.3, 2.4, 4.2**
  
  - [x] 8.3 Write property test for success response format
    - **Property 7: Success Response Format**
    - **Validates: Requirements 3.5**
  
  - [x] 8.4 Write property test for RPC idempotency
    - **Property 10: RPC Function Idempotency**
    - **Validates: Requirements 5.3, 5.4**

- [x] 9. Integration testing and bug fixes
  - [x] 9.1 Test end-to-end customer close tab flow
    - Create test tab with zero balance
    - Close tab via customer app
    - Verify tab status in database
    - Verify redirect to home page
    - _Requirements: 1.1, 1.3_
  
  - [x] 9.2 Test end-to-end staff close tab flow
    - Create test tab with zero balance
    - Close tab via staff app
    - Verify tab status in database
    - _Requirements: 2.1_
  
  - [x] 9.3 Test end-to-end staff overdue flow
    - Create test tab with positive balance
    - Push to overdue via staff app
    - Verify tab status is 'overdue'
    - Verify moved_to_overdue_at timestamp is set
    - _Requirements: 2.2_
  
  - [x] 9.4 Fix any bugs discovered during integration testing
    - Document bugs found
    - Implement fixes
    - Re-test affected flows

- [x] 10. Final checkpoint and documentation
  - Run all unit tests and property tests
  - Verify all tests pass with 100+ iterations for property tests
  - Update API documentation with new endpoint
  - Document error codes and messages for client developers
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Database function validation is critical and must be completed first
- Error handling improvements benefit both apps and should be prioritized
