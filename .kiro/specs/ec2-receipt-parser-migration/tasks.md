# Implementation Plan: EC2 Receipt Parser Migration

## Overview

This implementation plan migrates receipt parsing from direct DeepSeek API calls to an EC2-hosted parsing service. The migration involves updating the receipt parser service, printer service, relay endpoint, environment configuration, and documentation. The implementation follows a sequential approach to ensure each component is updated and tested before moving to the next.

## Tasks

- [ ] 1. Update receipt parser service to use EC2
  - Update `packages/shared/services/receiptParser.ts` to call EC2 instead of DeepSeek
  - Add `barId` and `documentName` parameters to function signatures (breaking change)
  - Implement `parseWithEC2()` function with 10-second timeout
  - Add `mapEC2ToParsedReceipt()` with null guards
  - Update fallback gate from `items.length > 0` to `total > 0`
  - Remove DeepSeek API key logic and token usage logging
  - Update error handling and logging
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 1.1 Write property test for EC2 request format validation
  - **Property 1: EC2 Request Format Validation**
  - **Validates: Requirements 1.1, 4.1, 4.5**

- [ ]* 1.2 Write property test for timeout enforcement
  - **Property 2: Timeout Enforcement**
  - **Validates: Requirements 1.5, 3.3**

- [ ]* 1.3 Write property test for comprehensive fallback behavior
  - **Property 3: Comprehensive Fallback Behavior**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3**

- [ ]* 1.4 Write property test for interface preservation
  - **Property 4: Interface Preservation**
  - **Validates: Requirements 3.5**

- [ ]* 1.5 Write property test for environment variable handling
  - **Property 5: Environment Variable Handling**
  - **Validates: Requirements 2.2**

- [ ]* 1.6 Write property test for EC2 response parsing
  - **Property 6: EC2 Response Parsing**
  - **Validates: Requirements 4.2, 4.3, 4.4**

- [ ]* 1.7 Write unit tests for null handling and empty items
  - Test null values in EC2 response are handled gracefully
  - Test empty items array with valid total is accepted
  - Test mapEC2ToParsedReceipt throws on missing required fields
  - _Requirements: 3.5, 4.3_

- [ ] 2. Update printer service for EC2 integration
  - [ ] 2.1 Add EC2 parser configuration to printer service
    - Add `parserUrl` field to config object
    - Add `TABEZA_PARSER_URL` environment variable support
    - Update `saveConfig()` and `loadConfig()` to persist `parserUrl`
    - Update `/api/configure` endpoint to accept `parserUrl`
    - Update `/api/status` endpoint to show parser connection status
    - _Requirements: 7.1_

  - [ ] 2.2 Implement parseWithEC2 in printer service
    - Create `parseWithEC2()` function that calls EC2 `/parse` endpoint
    - Implement 10-second timeout using `AbortSignal.timeout(10000)`
    - Handle errors gracefully (return null on failure)
    - Log parsing attempts and results
    - _Requirements: 7.1, 7.3_

  - [ ] 2.3 Update processPrintJob to call EC2 parser
    - Call `parseWithEC2()` before sending to cloud
    - Attach `parsedData` to relay payload
    - Add `parserUsed` flag to metadata
    - Ensure parser failure doesn't block receipt saving
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 2.4 Write property test for printer service non-blocking behavior
  - **Property 9: Printer Service Non-Blocking**
  - **Validates: Requirements 7.3, 7.4, 7.5**

- [ ]* 2.5 Write property test for printer service data flow
  - **Property 10: Printer Service Data Flow**
  - **Validates: Requirements 7.1, 7.2, 7.5**

- [ ] 3. Update relay endpoint to handle parsedData
  - Update `apps/staff/app/api/printer/relay/route.ts` to accept `parsedData` from request body
  - Save `parsedData` to database if present
  - Set status to `'parsed'` if parsedData present, `'pending'` if null
  - Update logging to indicate whether parsedData was received
  - Do NOT add fallback parseReceipt() call
  - _Requirements: 7.2, 7.3_

- [ ] 4. Update environment configuration
  - [ ] 4.1 Update environment files
    - Add `EC2_PARSER_URL` to `.env.example` with placeholder
    - Update `.env.local` with actual EC2 IP address
    - Remove `DEEPSEEK_API_KEY` from `.env.example`
    - _Requirements: 2.1, 2.3, 2.5_

  - [ ] 4.2 Update all callers of parseReceipt
    - Search codebase for all `parseReceipt()` calls
    - Update each call to pass `barId` parameter
    - Update any TypeScript types that reference the old signature
    - _Requirements: 1.1, 4.1_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Run unit tests for receipt parser
  - Run property tests (minimum 100 iterations each)
  - Verify printer service starts without errors
  - Verify relay endpoint accepts parsedData
  - Ask the user if questions arise

- [ ] 6. Update documentation
  - [ ] 6.1 Create EC2 parser setup guide
    - Rename `DEEPSEEK-SETUP-GUIDE.md` to `EC2-PARSER-SETUP-GUIDE.md`
    - Update content to reference EC2 setup instead of DeepSeek API
    - Document how to obtain EC2 IP address
    - Document EC2 parser API endpoints (`/health` and `/parse`)
    - Add troubleshooting section for EC2 connectivity issues
    - Document fallback behavior when EC2 is unavailable
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 6.2 Update printer service documentation
    - Update `PRINTER-SERVICE-USER-GUIDE.md` to include EC2 parser configuration
    - Add section on configuring `TABEZA_PARSER_URL`
    - Document the `parserUsed` metadata flag
    - _Requirements: 7.1, 7.5_

- [ ] 7. Integration testing
  - [ ] 7.1 Test EC2 parser connectivity
    - Verify EC2 service is running on port 3100
    - Test `/health` endpoint returns correct status
    - Test `/parse` endpoint with sample receipt
    - Verify structured output matches expected format
    - _Requirements: 8.1, 8.2_

  - [ ] 7.2 Test end-to-end receipt parsing flow
    - Configure printer service with EC2_PARSER_URL
    - Send test print through printer service
    - Verify EC2 parser is called
    - Verify parsedData included in relay payload
    - Verify receipt saved to database with parsed data
    - _Requirements: 7.1, 7.2, 8.5_

  - [ ] 7.3 Test fallback behavior
    - Stop EC2 service temporarily
    - Send receipt through printer service
    - Verify regex fallback is used
    - Verify receipt still saved with null parsedData
    - Verify metadata.parserUsed is false
    - Restart EC2 service and verify recovery
    - _Requirements: 3.1, 3.2, 3.3, 8.3_

  - [ ] 7.4 Test timeout handling
    - Configure EC2 service to respond slowly (>10 seconds)
    - Send receipt through printer service
    - Verify timeout occurs at 10 seconds
    - Verify fallback to regex parsing
    - Verify receipt still saved
    - _Requirements: 1.5, 3.3, 8.4_

- [ ] 8. Final checkpoint - Verify production readiness
  - Run full test suite (unit + property + integration)
  - Verify all environment variables configured correctly
  - Test with real receipts from multiple venues
  - Verify EC2 service health and monitoring
  - Verify documentation is complete and accurate
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples, edge cases, and null handling
- Integration tests verify end-to-end flows with real EC2 service
- Breaking change: `parseReceipt()` now requires `barId` parameter - all callers must be updated
