# Implementation Plan: Local Receipt Parsing

## Overview

This implementation moves receipt parsing from the cloud to TabezaConnect (local Windows service). The approach is to create a new Receipt_Parser module with configurable regex templates, integrate it into the existing capture flow, modify the upload payload to include parsed data, and update the cloud API to accept parsed data with backward compatibility.

## Tasks

- [-] 1. Create Receipt_Parser module with core parsing logic
  - [x] 1.1 Implement parseReceipt function with template-based extraction
    - Create `packages/printer-service/lib/receiptParser.js`
    - Implement field extraction using regex patterns (items, total, subtotal, tax, receiptNumber, timestamp)
    - Implement confidence level determination (high/medium/low based on extracted fields)
    - Return structured JSON with all fields and rawText
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 1.2 Write property test for parser return structure
    - **Property 1: Parser Return Structure**
    - **Validates: Requirements 1.1**
  
  - [ ]* 1.3 Write property test for confidence level determination
    - **Property 2: Confidence Level Determination**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  
  - [x] 1.4 Implement error handling with never-reject guarantee
    - Return low confidence data on parsing failure
    - Never throw exceptions for any input
    - Log parsing errors locally
    - _Requirements: 1.8, 7.1, 7.2, 7.3_
  
  - [ ]* 1.5 Write property test for never-throw guarantee
    - **Property 5: Never Throw Exceptions**
    - **Validates: Requirements 1.8, 7.1, 7.3**

- [x] 2. Implement template configuration system
  - [x] 2.1 Create default parsing template for common POS formats
    - Define regex patterns for receiptNumber, timestamp, items, subtotal, tax, total
    - Support multi-line item extraction with startMarker and endMarker
    - Test with Tusker Lager sample receipt
    - _Requirements: 1.7, 2.2, 2.4, 2.6, 2.7_
  
  - [x] 2.2 Add template loading from config.json
    - Read parsingTemplate section from config.json
    - Fall back to default template if not configured
    - Support multiple template formats per venue
    - _Requirements: 2.1, 2.3, 2.5_
  
  - [ ]* 2.3 Write property test for template configuration usage
    - **Property 3: Template Configuration Usage**
    - **Validates: Requirements 1.5, 2.3**
  
  - [ ]* 2.4 Write property test for default template fallback
    - **Property 7: Default Template Fallback**
    - **Validates: Requirements 2.5**
  
  - [x] 2.5 Implement regex pattern validation
    - Validate patterns before applying them
    - Fall back to default pattern if invalid
    - Log validation errors
    - _Requirements: 8.4, 8.5_
  
  - [ ]* 2.6 Write property test for regex pattern validation
    - **Property 22: Regex Pattern Validation**
    - **Validates: Requirements 8.4, 8.5**

- [x] 3. Integrate parser into existing capture flow
  - [x] 3.1 Modify Simple_Capture to call Receipt_Parser
    - After ESCPOSProcessor converts bytes to text, call parseReceipt
    - Pass parsed JSON to Upload_Worker instead of raw base64
    - Preserve existing stability check logic (3-check algorithm)
    - Preserve existing file monitoring behavior
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 3.2 Ensure parsing failures don't block upload
    - Enqueue receipts with low confidence data when parsing fails
    - Never reject a receipt due to parsing failure
    - _Requirements: 3.7, 7.4, 7.5_
  
  - [ ]* 3.3 Write property test for unconditional receipt processing
    - **Property 11: Unconditional Receipt Processing**
    - **Validates: Requirements 3.7, 7.4, 7.5, 7.6, 7.7**
  
  - [ ]* 3.4 Write unit tests for capture flow integration
    - Test end-to-end flow: file → parse → upload
    - Test error recovery: parsing failure → low confidence upload
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint - Ensure local parsing works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Modify Upload_Worker to send parsed data
  - [x] 5.1 Update payload structure to include parsedData
    - Add parsedData as primary field in upload payload
    - Make rawData optional (include for debugging)
    - Add confidence level to metadata
    - Add parsingMethod to metadata ('local')
    - _Requirements: 4.1, 4.2, 4.3, 4.6_
  
  - [x] 5.2 Preserve existing retry and queue logic
    - Maintain exponential backoff retry logic
    - Maintain queue processing behavior
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 5.3 Write property test for parsed data in payload
    - **Property 12: Parsed Data in Payload**
    - **Validates: Requirements 4.1, 4.6**
  
  - [ ]* 5.4 Write property test for optional raw data
    - **Property 13: Optional Raw Data**
    - **Validates: Requirements 4.2**
  
  - [ ]* 5.5 Write unit tests for Upload_Worker modifications
    - Test payload structure with parsedData
    - Test metadata includes confidence and parsingMethod
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Update Cloud API to accept parsed data
  - [x] 6.1 Modify API route to accept parsedData field
    - Update `apps/staff/app/api/printer/relay/route.ts`
    - Accept parsedData as optional field in request payload
    - Make rawData optional in request payload
    - Update TypeScript interface for PrintJobPayload
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.2 Implement parsed data priority logic
    - When parsedData is provided, use it directly without parsing
    - When parsedData is not provided, fall back to parsing rawData
    - Prioritize parsedData over rawData when both present
    - _Requirements: 5.3, 5.4, 6.2, 6.6_
  
  - [x] 6.3 Store parsed data in print_jobs table
    - Store parsedData in print_jobs.parsed_data column
    - Store confidence level in metadata
    - Store parsingMethod in metadata
    - _Requirements: 5.5_
  
  - [ ]* 6.4 Write property test for cloud API accepts parsed data
    - **Property 16: Cloud API Accepts Parsed Data**
    - **Validates: Requirements 5.1, 5.3**
  
  - [ ]* 6.5 Write property test for cloud API optional raw data
    - **Property 17: Cloud API Optional Raw Data**
    - **Validates: Requirements 5.2**
  
  - [ ]* 6.6 Write property test for parsing method priority
    - **Property 20: Parsing Method Priority**
    - **Validates: Requirements 6.2, 6.6**

- [x] 7. Implement backward compatibility
  - [x] 7.1 Add fallback logic for old payload format
    - Accept requests with only rawData (no parsedData)
    - Parse rawData using existing logic when parsedData missing
    - Log which parsing method was used (local vs cloud)
    - _Requirements: 6.1, 6.3, 6.4, 5.4_
  
  - [x] 7.2 Preserve existing error handling and logging
    - Maintain existing structured error responses
    - Maintain existing error categories
    - _Requirements: 5.6_
  
  - [ ]* 7.3 Write property test for backward compatible payloads
    - **Property 15: Backward Compatible Payloads**
    - **Validates: Requirements 4.7, 5.7, 6.1, 6.3**
  
  - [ ]* 7.4 Write property test for cloud API fallback parsing
    - **Property 18: Cloud API Fallback Parsing**
    - **Validates: Requirements 5.4, 6.1**
  
  - [ ]* 7.5 Write unit tests for backward compatibility
    - Test old payload format (rawData only) is accepted
    - Test cloud parsing is used when parsedData missing
    - Test logging includes parsing method
    - _Requirements: 6.1, 6.3, 6.4_

- [x] 8. Checkpoint - Ensure cloud API changes work with both old and new clients
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement formatReceipt function for pretty printing
  - [x] 9.1 Create formatReceipt function in Receipt_Parser
    - Convert parsed data back to readable receipt text
    - Format items with name, quantity, and price
    - Format totals, subtotals, and tax
    - Format receipt number and timestamp
    - Handle missing fields gracefully
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_
  
  - [ ]* 9.2 Write property test for format receipt function
    - **Property 23: Format Receipt Function**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6**
  
  - [ ]* 9.3 Write property test for format handles missing fields
    - **Property 24: Format Handles Missing Fields**
    - **Validates: Requirements 9.7**
  
  - [ ]* 9.4 Write unit tests for formatReceipt
    - Test formatting with all fields present
    - Test formatting with missing fields
    - Test output readability
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 10. Implement round-trip validation
  - [x] 10.1 Add round-trip test utility
    - Parse → Format → Parse should produce equivalent data
    - Allow minor differences in whitespace and decimal precision
    - Log discrepancies when round-trip fails
    - _Requirements: 10.1, 10.4, 10.6, 10.7_
  
  - [ ]* 10.2 Write property test for round-trip parsing consistency
    - **Property 25: Round-Trip Parsing Consistency**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.7**
  
  - [ ]* 10.3 Write unit tests for round-trip validation
    - Test with sample receipts
    - Test field preservation through round-trip
    - Test type preservation (numbers, strings, dates)
    - _Requirements: 10.2, 10.3, 10.5_

- [ ] 11. Add testing infrastructure and sample data
  - [x] 11.1 Create test-receipts directory with sample receipts
    - Add tusker-test-receipt.txt (default template format)
    - Add captain-orders-receipt.txt (alternative format)
    - Add minimal-receipt.txt (only total, no items)
    - Add malformed-receipt.txt (invalid format)
    - Add empty-receipt.txt (empty file)
    - _Requirements: 8.3_
  
  - [x] 11.2 Add test mode for Receipt_Parser
    - Accept sample receipt text for testing
    - Log parsing results with field extraction details
    - Provide parsing statistics (success rate, confidence distribution)
    - _Requirements: 8.1, 8.2, 8.6_
  
  - [x] 11.3 Create test script for validating parsing templates
    - Script to test custom templates against sample receipts
    - Output parsing results and confidence levels
    - _Requirements: 8.7_
  
  - [-]* 11.4 Write unit tests for test infrastructure
    - Test sample receipt loading
    - Test parsing statistics calculation
    - Test template validation script
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12. Final integration and validation
  - [ ] 12.1 Run all property-based tests with 100 iterations
    - Verify all 25 properties pass
    - Check for any edge cases or failures
    - _Requirements: All_
  
  - [ ] 12.2 Run integration tests end-to-end
    - Test complete flow: POS → TabezaConnect → Cloud API → Database
    - Test with multiple sample receipts
    - Verify backward compatibility with old clients
    - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.3_
  
  - [ ] 12.3 Verify error handling and resilience
    - Test parsing failures don't block uploads
    - Test invalid templates fall back to default
    - Test API accepts all receipts regardless of confidence
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 13. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Implementation uses JavaScript/Node.js as specified in design document
- TabezaConnect is a Windows service in the printer-service package
- Cloud API is in apps/staff/app/api/printer/relay/route.ts
- All changes maintain backward compatibility with existing TabezaConnect versions
