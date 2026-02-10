# Requirements Document

## Introduction

This specification defines the requirements for reverting the receipt parsing implementation from an EC2-hosted parsing service back to direct DeepSeek API integration. The system currently uses an EC2 instance to parse receipts, but we need to return to the original DeepSeek direct API approach for simplicity, cost-effectiveness, and maintainability.

## Glossary

- **Receipt_Parser**: The service responsible for extracting structured data from receipt text
- **DeepSeek_API**: The AI service that provides receipt parsing capabilities via OpenAI-compatible API
- **EC2_Service**: The self-hosted parsing service running on AWS EC2 (to be removed)
- **Printer_Service**: The local service that monitors print jobs and relays them to Tabeza cloud
- **OpenAI_SDK**: The standard SDK used to communicate with OpenAI-compatible APIs
- **Regex_Fallback**: The backup parsing method used when AI parsing is unavailable
- **ParsedReceipt**: The structured data format containing items, total, and receipt number

## Requirements

### Requirement 1: DeepSeek API Integration

**User Story:** As a developer, I want the receipt parser to use DeepSeek API directly, so that we have a simpler, more maintainable parsing solution without EC2 dependencies.

#### Acceptance Criteria

1. WHEN the Receipt_Parser is invoked, THE System SHALL call DeepSeek API using the OpenAI SDK
2. WHEN making API calls, THE System SHALL use the DEEPSEEK_API_KEY environment variable
3. WHEN the API key is missing, THE System SHALL fall back to regex parsing without errors
4. THE System SHALL use the DeepSeek endpoint at https://api.deepseek.com/v1
5. THE System SHALL use the deepseek-chat model for parsing
6. THE System SHALL enforce JSON response format using response_format parameter

### Requirement 2: Environment Configuration

**User Story:** As a system administrator, I want clear environment variable configuration, so that I can easily set up the parsing service.

#### Acceptance Criteria

1. THE System SHALL use DEEPSEEK_API_KEY as the environment variable name
2. WHEN EC2_PARSER_URL is present in environment files, THE System SHALL remove it
3. WHEN TABEZA_PARSER_URL is present in printer service, THE System SHALL remove it
4. THE .env.example file SHALL document DEEPSEEK_API_KEY with setup instructions
5. THE System SHALL NOT require any EC2-related configuration

### Requirement 3: Printer Service Integration

**User Story:** As a venue operator, I want the printer service to work without EC2 dependencies, so that receipt parsing is simpler and more reliable.

#### Acceptance Criteria

1. WHEN the Printer_Service processes a receipt, THE System SHALL NOT call EC2 parser endpoints
2. THE Printer_Service SHALL remove all EC2 parser integration code
3. THE Printer_Service SHALL remove TABEZA_PARSER_URL configuration
4. THE Printer_Service SHALL send raw receipt data to cloud without pre-parsing
5. THE Cloud API SHALL handle receipt parsing using DeepSeek

### Requirement 4: Backward Compatibility

**User Story:** As a developer, I want the parsing interface to remain unchanged, so that existing code continues to work without modifications.

#### Acceptance Criteria

1. THE parseReceipt function SHALL maintain its existing signature
2. THE ParsedReceipt interface SHALL remain unchanged
3. WHEN parsing succeeds, THE System SHALL return the same data structure as before
4. WHEN parsing fails, THE System SHALL fall back to regex parsing as before
5. THE System SHALL log parsing results in the same format as before

### Requirement 5: Error Handling and Fallback

**User Story:** As a system operator, I want graceful error handling, so that receipt parsing continues to work even when DeepSeek is unavailable.

#### Acceptance Criteria

1. WHEN DeepSeek API is unavailable, THE System SHALL fall back to regex parsing
2. WHEN the API key is invalid, THE System SHALL log a warning and use regex fallback
3. WHEN API calls timeout after 10 seconds, THE System SHALL use regex fallback
4. WHEN API returns invalid JSON, THE System SHALL use regex fallback
5. THE System SHALL log all fallback events for monitoring

### Requirement 6: Code Cleanup

**User Story:** As a developer, I want all EC2-related code removed, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. THE System SHALL remove the ec2-receipt-parser-service directory
2. THE System SHALL remove the ec2-receipt-parser-service.zip file
3. THE System SHALL remove the .kiro/specs/ec2-receipt-parser-migration directory
4. THE System SHALL remove all parseWithEC2 functions
5. THE System SHALL remove all EC2-related comments and documentation references

### Requirement 7: Documentation Updates

**User Story:** As a new developer, I want clear documentation on DeepSeek setup, so that I can configure the system correctly.

#### Acceptance Criteria

1. THE DEEPSEEK-SETUP-GUIDE.md file SHALL remain up-to-date
2. THE .env.example file SHALL include DEEPSEEK_API_KEY with clear instructions
3. THE System SHALL remove all EC2 setup instructions from documentation
4. THE README files SHALL reference DeepSeek setup instead of EC2
5. THE System SHALL document the OpenAI SDK usage pattern

### Requirement 8: Testing Updates

**User Story:** As a developer, I want tests to validate DeepSeek integration, so that I can ensure the parser works correctly.

#### Acceptance Criteria

1. THE test files SHALL mock DeepSeek API calls instead of EC2 endpoints
2. THE tests SHALL validate OpenAI SDK integration
3. THE tests SHALL verify fallback behavior when API is unavailable
4. THE tests SHALL validate ParsedReceipt interface compliance
5. THE tests SHALL verify timeout handling (10 seconds)
