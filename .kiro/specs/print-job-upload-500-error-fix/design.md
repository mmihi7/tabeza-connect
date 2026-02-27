# Print Job Upload 500 Error Fix - Bugfix Design

## Overview

The `/api/printer/relay` endpoint receives receipt uploads from TabezaConnect but returns HTTP 500 errors with the generic message "Failed to process print job". This prevents POS-authoritative venues from delivering digital receipts to customers, breaking a critical component of Tabeza Basic mode. The bug manifests when TabezaConnect uploads valid receipt payloads, but the endpoint fails during processing without logging sufficient diagnostic information.

The fix approach is to enhance error logging at each critical operation (JSON parsing, base64 decoding, receipt parsing, database insert) to identify the exact failure point, then address the root cause. The foundational rule "Never reject a receipt. Always accept, always store." must be preserved - even if parsing fails, the print job should be created with low confidence.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when TabezaConnect uploads a receipt with valid payload structure but the endpoint returns HTTP 500
- **Property (P)**: The desired behavior when valid receipts are uploaded - successful database insert with status 'no_match' and HTTP 200 response
- **Preservation**: Existing error handling for invalid requests (HTTP 400), parsing confidence logic, and the foundational rule must remain unchanged
- **TabezaConnect**: The Windows service that monitors POS printer output and uploads receipts to the relay endpoint
- **Captain's Orders**: The staff interface that queries `print_jobs` WHERE `status = 'no_match'` to display unmatched receipts
- **Service Role Client**: Supabase client using `SUPABASE_SECRET_KEY` that bypasses RLS policies
- **Parsing Confidence**: Classification of receipt parsing quality (high, medium, low) based on extracted items and total

## Bug Details

### Fault Condition

The bug manifests when TabezaConnect uploads a receipt with valid payload structure to `/api/printer/relay`. The endpoint is either (1) failing to decode base64 rawData, (2) throwing unhandled exceptions during receipt parsing, (3) encountering database constraint violations during insert, or (4) missing required environment variables causing unexpected behavior.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PrintJobUploadRequest
  OUTPUT: boolean
  
  RETURN input.barId IS NOT NULL
         AND input.rawData IS NOT NULL
         AND input.rawData IS valid base64 string
         AND corresponding bar exists in database
         AND endpoint returns HTTP 500 with "Failed to process print job"
END FUNCTION
```

### Examples

- **Example 1**: TabezaConnect uploads receipt with `{barId: "valid-uuid", rawData: "base64-encoded-receipt", driverId: "driver-123"}` → Endpoint returns HTTP 500 → Receipt never appears in Captain's Orders
- **Example 2**: TabezaConnect uploads receipt with parsedData included → Endpoint returns HTTP 500 → Error log shows only "Error processing print relay:" without details
- **Example 3**: TabezaConnect retries failed upload with exponential backoff (5s, 10s, 20s, 40s) → All retries return HTTP 500 → Queue builds up with pending receipts
- **Edge Case**: Receipt with malformed base64 rawData → Should log decoding error with data sample → Should still create print_jobs record with low confidence

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- HTTP 400 responses for requests with missing required fields (barId or rawData) must continue to work
- Parsing confidence determination (high, medium, low) based on extracted items and total must remain unchanged
- Foundational rule "Never reject a receipt. Always accept, always store." must be preserved
- Service role client bypassing RLS policies must continue to function
- Receipt parsing fallback chain (DeepSeek → regex) must remain unchanged
- TabezaConnect heartbeat mechanism must continue to work without interference
- UploadWorker exponential backoff retry strategy must remain unchanged
- Test receipt delivery HTML page must continue to accept and process test receipts

**Scope:**
All inputs that do NOT involve valid receipt uploads (invalid requests, heartbeats, test receipts) should be completely unaffected by this fix. This includes:
- Requests with missing barId or rawData (HTTP 400 validation)
- Heartbeat status updates from TabezaConnect
- Test receipts from the HTML test page
- Receipts that successfully upload (if any exist)

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Database Constraint Violation**: The insert into `print_jobs` may be failing due to:
   - Foreign key constraint on `bar_id` (bar doesn't exist or UUID format mismatch)
   - Check constraint on `status` field (though 'no_match' is valid)
   - Data type mismatch between payload and schema (e.g., metadata not being valid JSONB)
   - NULL constraint violation on required fields

2. **Base64 Decoding Failure**: The `Buffer.from(rawData, 'base64')` operation may be throwing if:
   - rawData contains invalid base64 characters
   - rawData is not actually base64-encoded
   - rawData is corrupted during transmission

3. **Receipt Parsing Exception**: The `parseReceipt()` function may be throwing unhandled exceptions:
   - DeepSeek API timeout or error (10s timeout configured)
   - Regex parsing failure on malformed receipt text
   - Missing environment variables for DeepSeek API

4. **Missing Environment Variables**: The `createServiceRoleClient()` throws if `SUPABASE_SECRET_KEY` is missing:
   - Environment variable not set in production
   - Variable name mismatch (e.g., using wrong key name)

5. **Supabase Client Configuration**: The service role client may have issues:
   - `NEXT_PUBLIC_SUPABASE_URL` not set or incorrect
   - Network connectivity to Supabase
   - Rate limiting or quota exceeded

## Correctness Properties

Property 1: Fault Condition - Successful Receipt Upload and Database Insert

_For any_ receipt upload where the bug condition holds (valid barId, valid rawData, bar exists in database), the fixed endpoint SHALL successfully decode the rawData, parse the receipt (with fallback to low confidence if parsing fails), insert a print_jobs record with status 'no_match', and return HTTP 200 with `{success: true, jobId, message}`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.7**

Property 2: Preservation - Error Handling and Logging Behavior

_For any_ input that is NOT a valid receipt upload (missing required fields, invalid base64, non-existent bar), the fixed endpoint SHALL produce the same behavior as the original endpoint, preserving HTTP 400 responses for validation errors and maintaining the foundational rule "Never reject a receipt" by creating low-confidence print jobs even when parsing fails.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/staff/app/api/printer/relay/route.ts`

**Function**: `POST`

**Specific Changes**:

1. **Enhanced Error Logging**: Add detailed logging at each critical operation
   - Wrap JSON parsing in try-catch with specific error logging
   - Log base64 decoding attempts with data length and sample
   - Log receipt parsing attempts with error details
   - Log database insert attempts with complete Supabase error object
   - Include operation name, error type, error message, stack trace, and relevant payload details

2. **Base64 Decoding Validation**: Add validation before decoding
   - Check if rawData is a valid base64 string using regex
   - Log rawData length and first 100 characters if decoding fails
   - Catch decoding errors and log them separately from parsing errors

3. **Receipt Parsing Error Handling**: Improve parsing error handling
   - Wrap parseReceipt() call in try-catch with detailed logging
   - Log DeepSeek API errors separately from regex parsing errors
   - Ensure parsing failures still result in print_jobs record creation (low confidence)
   - Log parsing confidence determination logic

4. **Database Insert Error Logging**: Enhance Supabase error logging
   - Log complete error object including code, message, details, hint
   - Log the printJobData object being inserted (sanitized)
   - Check for foreign key violations and log bar_id validation
   - Check for constraint violations and log which constraint failed

5. **Environment Variable Validation**: Add startup validation
   - Check for SUPABASE_SECRET_KEY before processing requests
   - Check for NEXT_PUBLIC_SUPABASE_URL
   - Log environment variable status on endpoint initialization
   - Return HTTP 503 if required variables are missing

6. **Structured Error Response**: Improve error response format
   - Include error category (validation, decoding, parsing, database)
   - Include operation that failed
   - Include sanitized error details (no sensitive data)
   - Maintain HTTP 500 for server errors, HTTP 400 for client errors

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by attempting uploads and examining detailed error logs, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Use the test receipt delivery HTML page and TabezaConnect to send receipts to the UNFIXED endpoint. Examine the enhanced error logs to identify which operation fails (JSON parsing, base64 decoding, receipt parsing, or database insert). Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Valid Receipt Upload**: Send receipt with valid barId, rawData, driverId → Observe which operation fails in logs (will fail on unfixed code)
2. **Invalid Base64 Test**: Send receipt with malformed base64 rawData → Observe base64 decoding error in logs (may fail on unfixed code)
3. **Non-Existent Bar Test**: Send receipt with barId that doesn't exist in database → Observe foreign key constraint violation in logs (will fail on unfixed code)
4. **Missing Environment Variable Test**: Temporarily unset SUPABASE_SECRET_KEY → Observe environment variable error in logs (will fail on unfixed code)
5. **Parsing Failure Test**: Send receipt with unparseable content → Observe parsing error but successful insert with low confidence (should succeed even on unfixed code per foundational rule)

**Expected Counterexamples**:
- Database insert fails with foreign key constraint violation on bar_id
- Base64 decoding fails with invalid character error
- Receipt parsing throws unhandled exception from DeepSeek timeout
- Service role client creation fails due to missing SUPABASE_SECRET_KEY
- Possible causes: constraint violation, encoding issue, API timeout, missing config

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := POST_fixed(input)
  ASSERT result.status = 200
  ASSERT result.body.success = true
  ASSERT result.body.jobId IS NOT NULL
  ASSERT print_jobs record exists with status = 'no_match'
  ASSERT receipt appears in Captain's Orders
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT POST_original(input) = POST_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for invalid requests, heartbeats, and test receipts, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Invalid Request Preservation**: Observe that requests with missing barId return HTTP 400 on unfixed code, then write test to verify this continues after fix
2. **Parsing Confidence Preservation**: Observe that parsing confidence logic (high, medium, low) works correctly on unfixed code, then write test to verify this continues after fix
3. **Foundational Rule Preservation**: Observe that parsing failures still create print_jobs records on unfixed code, then write test to verify this continues after fix
4. **Service Role Client Preservation**: Observe that service role client bypasses RLS on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test base64 decoding with valid and invalid input
- Test receipt parsing with various receipt formats
- Test database insert with valid and invalid barId
- Test error logging at each operation stage
- Test environment variable validation
- Test HTTP 400 responses for missing required fields
- Test HTTP 500 responses with detailed error information

### Property-Based Tests

- Generate random receipt payloads with valid structure and verify successful upload
- Generate random invalid payloads (missing fields, invalid base64) and verify appropriate error responses
- Generate random barId values (valid UUIDs, invalid UUIDs, non-existent) and verify foreign key handling
- Test that all valid receipts result in print_jobs records with status 'no_match'

### Integration Tests

- Test full flow from TabezaConnect upload to Captain's Orders display
- Test retry mechanism with transient failures (network errors)
- Test retry mechanism with permanent failures (invalid barId)
- Test that enhanced logging provides sufficient diagnostic information
- Test that parsing failures still result in print_jobs creation (foundational rule)
- Test that test receipt delivery HTML page continues to work
