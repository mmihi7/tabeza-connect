# Implementation Plan: Revert EC2 to DeepSeek Direct API

## Overview

This implementation plan reverts the receipt parsing system from EC2-hosted service back to direct DeepSeek API integration. The approach is to systematically remove EC2 dependencies, restore DeepSeek direct API calls, update environment configuration, and clean up all EC2-related files and documentation.

## Tasks

- [x] 1. Update receipt parser service to use DeepSeek API directly
  - [x] 1.1 Install OpenAI SDK dependency
    - Add `openai` package to `packages/shared/package.json`
    - Run `pnpm install` to install dependencies
    - _Requirements: 1.1, 1.2_
  
  - [x] 1.2 Rewrite parseWithDeepSeek function
    - Replace `parseWithEC2()` with `parseWithDeepSeek()` function
    - Initialize OpenAI client with DeepSeek endpoint
    - Use `process.env.DEEPSEEK_API_KEY` for authentication
    - Set base URL to `https://api.deepseek.com/v1`
    - Configure model as `deepseek-chat`
    - Set `response_format: { type: 'json_object' }`
    - Implement 10-second timeout using AbortController
    - Return null on any error to trigger regex fallback
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_
  
  - [x] 1.3 Update system prompt for DeepSeek
    - Create clear, concise system prompt for receipt parsing
    - Specify exact JSON output format
    - Include extraction rules for items, total, receiptNumber
    - Set temperature to 0.1 for consistent results
    - Set max_tokens to 2000
    - _Requirements: 1.1_
  
  - [x] 1.4 Update error handling and logging
    - Log when DEEPSEEK_API_KEY is not set
    - Log successful DeepSeek parsing with token usage
    - Log timeout events (10 seconds)
    - Log API errors with status codes
    - Log fallback to regex parser
    - Ensure all errors trigger regex fallback without throwing
    - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 1.5 Write property test for DeepSeek API integration
    - **Property 1: DeepSeek API Integration**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6**
    - Generate random receipt texts and bar IDs
    - Mock OpenAI SDK client
    - Verify API called with correct endpoint and model
    - Verify response_format includes json_object
    - Run 100 iterations
  
  - [x] 1.6 Write property test for error fallback
    - **Property 2: Comprehensive Error Fallback**
    - **Validates: Requirements 1.3, 4.4, 5.1, 5.2, 5.3, 5.4**
    - Generate random receipt texts
    - Simulate various error conditions (missing key, timeout, network error, invalid JSON)
    - Verify regex fallback used in all cases
    - Verify no errors thrown
    - Run 100 iterations
  
  - [x] 1.7 Write property test for output structure compliance
    - **Property 4: Output Structure Compliance**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate random receipt texts
    - Parse with both DeepSeek and regex
    - Verify all outputs conform to ParsedReceipt interface
    - Verify items array, total number, rawText present
    - Verify optional receiptNumber handled correctly
    - Run 100 iterations

- [x] 2. Update printer service to remove EC2 integration
  - [x] 2.1 Remove EC2 parser integration code
    - Remove `parseWithEC2()` function from `packages/printer-service/index.js`
    - Remove EC2 parser calls in `processPrintJob()` function
    - Remove `parserUrl` from configuration object
    - Remove `parserConfigured` from status endpoint
    - _Requirements: 3.1, 3.2, 6.4_
  
  - [x] 2.2 Update processPrintJob to send raw data only
    - Remove `parsedData` field from cloud payload
    - Remove `parserUsed` flag from metadata
    - Send only raw base64 data, barId, driverId, timestamp, metadata
    - Update comments to reflect cloud-side parsing
    - _Requirements: 3.4_
  
  - [x] 2.3 Remove TABEZA_PARSER_URL configuration
    - Remove `parserUrl` from config object
    - Remove `parserUrl` parameter from `/api/configure` endpoint
    - Remove `parserUrl` from `saveConfig()` and `loadConfig()`
    - Remove `parserUrl` from startup console output
    - _Requirements: 2.2, 2.3, 3.3_
  
  - [x] 2.4 Write property test for raw data transmission
    - **Property 3: Raw Data Transmission**
    - **Validates: Requirements 3.4**
    - Generate random print job data
    - Process through printer service
    - Verify payload contains only raw base64 data
    - Verify no parsedData field present
    - Run 100 iterations

- [x] 3. Update environment configuration
  - [x] 3.1 Update .env.example file
    - Remove `EC2_PARSER_URL` variable
    - Add `DEEPSEEK_API_KEY` variable with clear instructions
    - Add comment: "# DeepSeek AI Receipt Parser"
    - Add comment: "# Get your API key from https://platform.deepseek.com"
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 3.2 Update DEEPSEEK-SETUP-GUIDE.md
    - Verify guide is accurate for direct API integration
    - Update any outdated references
    - Ensure OpenAI SDK usage is documented
    - Verify cost breakdown is current
    - _Requirements: 7.1, 7.5_

- [x] 4. Checkpoint - Verify core functionality works
  - Ensure all tests pass
  - Test receipt parsing with DeepSeek API key
  - Test fallback to regex when API key missing
  - Test printer service sends raw data
  - Ask the user if questions arise

- [x] 5. Clean up EC2-related files and directories
  - [x] 5.1 Remove EC2 service directory
    - Delete `ec2-receipt-parser-service/` directory and all contents
    - Verify directory no longer exists
    - _Requirements: 6.1_
  
  - [x] 5.2 Remove EC2 deployment package
    - Delete `ec2-receipt-parser-service.zip` file
    - Verify file no longer exists
    - _Requirements: 6.2_
  
  - [x] 5.3 Remove EC2 migration spec
    - Delete `.kiro/specs/ec2-receipt-parser-migration/` directory
    - Verify directory no longer exists
    - _Requirements: 6.3_
  
  - [x] 5.4 Search and remove EC2 references in code
    - Search codebase for "EC2_PARSER_URL"
    - Search codebase for "parseWithEC2"
    - Search codebase for "EC2 parser"
    - Remove any remaining references
    - _Requirements: 6.4, 6.5_
  
  - [x] 5.5 Update documentation to remove EC2 references
    - Search README files for EC2 mentions
    - Update to reference DeepSeek setup instead
    - Remove EC2 setup instructions
    - Verify DEEPSEEK-SETUP-GUIDE.md is referenced
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 6. Update test files
  - [x] 6.1 Update receiptParser.test.ts
    - Remove EC2 endpoint mocks
    - Add DeepSeek API mocks using OpenAI SDK
    - Update test cases to verify DeepSeek integration
    - Add tests for OpenAI client initialization
    - Add tests for timeout handling
    - Add tests for error fallback scenarios
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 6.2 Create test script for manual verification
    - Create `dev-tools/scripts/test-deepseek-parsing.js`
    - Test with sample receipt text
    - Verify DeepSeek API called
    - Verify regex fallback works
    - Log results clearly
    - _Requirements: 8.2, 8.3_

- [x] 7. Final checkpoint - Comprehensive verification
  - Run all unit tests and property tests
  - Verify no EC2 references remain in codebase
  - Test receipt parsing end-to-end
  - Test printer service functionality
  - Verify environment configuration correct
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100 iterations each
- Unit tests validate specific examples and edge cases
- The OpenAI SDK is used for DeepSeek integration (standard pattern)
- All error conditions must gracefully fall back to regex parsing
- Backward compatibility is maintained through the ParsedReceipt interface
