# Requirements Document

## Introduction

This feature moves receipt parsing from the cloud to TabezaConnect (local Windows service). Currently, TabezaConnect captures ESC/POS data from POS printers and uploads raw base64-encoded data to the cloud, where parsing occurs. This causes PostgreSQL null byte errors (code 22P05), large upload payloads, wasted bandwidth, and inefficient processing. By parsing receipts locally using configurable regex templates before uploading, we eliminate these issues and reduce cloud processing overhead.

## Glossary

- **TabezaConnect**: Windows service that captures receipt data from POS printers
- **ESC/POS**: Standard command language for thermal receipt printers
- **Receipt_Parser**: New module that extracts structured data from receipt text using regex templates
- **Parsing_Template**: Configurable regex patterns for extracting receipt fields (items, total, tax, etc.)
- **Upload_Worker**: Existing module that uploads receipt data to the cloud API
- **Simple_Capture**: Existing module that monitors printer output and captures receipt data
- **ESCPOSProcessor**: Existing module that converts ESC/POS bytes to text
- **Cloud_API**: Tabeza staff app API endpoint that receives receipt data
- **Parsed_Data**: Structured JSON containing extracted receipt fields
- **Confidence_Level**: Quality indicator for parsing results (high, medium, low)

## Requirements

### Requirement 1: Local Receipt Parser Module

**User Story:** As a venue operator, I want receipts to be parsed locally before upload, so that I avoid null byte errors and reduce bandwidth usage.

#### Acceptance Criteria

1. THE Receipt_Parser SHALL accept receipt text as input and return structured JSON with items, total, subtotal, tax, receipt number, and timestamp
2. WHEN parsing succeeds with all fields extracted, THE Receipt_Parser SHALL return confidence level "high"
3. WHEN parsing succeeds with partial fields extracted, THE Receipt_Parser SHALL return confidence level "medium"
4. WHEN parsing fails or extracts minimal data, THE Receipt_Parser SHALL return confidence level "low"
5. THE Receipt_Parser SHALL use configurable regex templates for field extraction
6. THE Receipt_Parser SHALL support multiple template formats per venue
7. THE Receipt_Parser SHALL provide a default template that works for common POS systems
8. WHEN parsing fails, THE Receipt_Parser SHALL return low confidence data without throwing errors

### Requirement 2: Template Configuration System

**User Story:** As a venue operator, I want to customize parsing templates for my specific POS system, so that receipt parsing is accurate for my receipt format.

#### Acceptance Criteria

1. THE TabezaConnect SHALL store parsing templates in config.json under "parsingTemplate" section
2. THE Parsing_Template SHALL include patterns for: receiptNumber, items, total, subtotal, tax, timestamp
3. THE TabezaConnect SHALL allow template customization during setup or via config file editing
4. THE TabezaConnect SHALL provide sensible default templates for common POS formats
5. WHEN no custom template is configured, THE Receipt_Parser SHALL use the default template
6. THE Parsing_Template SHALL support regex capture groups for field extraction
7. THE Parsing_Template SHALL support multi-line item extraction patterns

### Requirement 3: Integration with Existing Capture Flow

**User Story:** As a system integrator, I want local parsing to integrate seamlessly with the existing capture flow, so that no existing functionality is broken.

#### Acceptance Criteria

1. WHEN Simple_Capture detects a stable receipt file, THE Simple_Capture SHALL use ESCPOSProcessor to convert bytes to text
2. WHEN text conversion succeeds, THE Simple_Capture SHALL call Receipt_Parser to extract structured data
3. WHEN parsing completes, THE Simple_Capture SHALL pass parsed JSON to Upload_Worker instead of raw base64
4. THE Simple_Capture SHALL preserve existing stability check logic (3-check algorithm)
5. THE Simple_Capture SHALL preserve existing file monitoring behavior
6. THE Simple_Capture SHALL preserve existing error handling and retry logic
7. WHEN parsing fails, THE Simple_Capture SHALL still enqueue the receipt with low confidence parsed data

### Requirement 4: Upload Worker Modifications

**User Story:** As a system developer, I want Upload_Worker to send parsed data instead of raw data, so that cloud processing is minimal.

#### Acceptance Criteria

1. THE Upload_Worker SHALL send parsedData in the payload as the primary field
2. THE Upload_Worker SHALL make rawData optional in the payload
3. THE Upload_Worker SHALL include confidence level in metadata
4. THE Upload_Worker SHALL preserve existing retry logic (exponential backoff)
5. THE Upload_Worker SHALL preserve existing queue processing behavior
6. WHEN parsedData is available, THE Upload_Worker SHALL include it in the API request
7. THE Upload_Worker SHALL maintain backward compatibility with existing payload structure

### Requirement 5: Cloud API Modifications

**User Story:** As a cloud service maintainer, I want the API to accept parsed data from TabezaConnect, so that I can skip local parsing and avoid null byte errors.

#### Acceptance Criteria

1. THE Cloud_API SHALL accept parsedData as a primary field in the request payload
2. THE Cloud_API SHALL make rawData optional in the request payload
3. WHEN parsedData is provided, THE Cloud_API SHALL use it directly without parsing
4. WHEN parsedData is not provided, THE Cloud_API SHALL fall back to parsing rawData locally
5. THE Cloud_API SHALL store parsedData directly in print_jobs.parsed_data column
6. THE Cloud_API SHALL preserve existing error handling and logging
7. THE Cloud_API SHALL maintain backward compatibility with older TabezaConnect versions

### Requirement 6: Backward Compatibility

**User Story:** As a system administrator, I want older TabezaConnect versions to continue working, so that I can upgrade gradually without service disruption.

#### Acceptance Criteria

1. WHEN Cloud_API receives a request without parsedData, THE Cloud_API SHALL parse rawData using existing logic
2. WHEN Cloud_API receives a request with parsedData, THE Cloud_API SHALL skip rawData parsing
3. THE Cloud_API SHALL accept both old and new payload formats
4. THE Cloud_API SHALL log which parsing method was used (local vs cloud)
5. THE TabezaConnect SHALL continue to include rawData in uploads for debugging purposes
6. THE Cloud_API SHALL prioritize parsedData over rawData when both are present

### Requirement 7: Error Handling and Resilience

**User Story:** As a venue operator, I want receipt capture to never fail, so that no receipts are lost even if parsing has issues.

#### Acceptance Criteria

1. WHEN Receipt_Parser fails to parse, THE Receipt_Parser SHALL return low confidence data with empty fields
2. WHEN Receipt_Parser fails, THE Receipt_Parser SHALL log parsing errors locally
3. THE TabezaConnect SHALL never reject a receipt due to parsing failure
4. WHEN parsing fails, THE Simple_Capture SHALL still enqueue the receipt with rawData
5. THE Upload_Worker SHALL upload receipts regardless of parsing confidence level
6. THE Cloud_API SHALL accept receipts with low confidence parsing
7. THE Cloud_API SHALL store all receipts in print_jobs table regardless of parsing quality

### Requirement 8: Parser Testing and Validation

**User Story:** As a developer, I want to test parsing with real POS receipts, so that I can verify accuracy before deployment.

#### Acceptance Criteria

1. THE Receipt_Parser SHALL provide a test mode that accepts sample receipt text
2. THE Receipt_Parser SHALL log parsing results with field extraction details
3. THE TabezaConnect SHALL include sample receipts for testing default templates
4. THE Receipt_Parser SHALL validate regex patterns before applying them
5. WHEN a regex pattern is invalid, THE Receipt_Parser SHALL log an error and use default pattern
6. THE Receipt_Parser SHALL provide parsing statistics (success rate, confidence distribution)
7. THE TabezaConnect SHALL include a test script for validating parsing templates

### Requirement 9: Parser Pretty Printer

**User Story:** As a developer, I want to format parsed data back into readable receipt text, so that I can verify parsing accuracy and debug issues.

#### Acceptance Criteria

1. THE Receipt_Parser SHALL provide a formatReceipt function that converts parsed data to text
2. THE formatReceipt function SHALL format items with name, quantity, and price
3. THE formatReceipt function SHALL format totals, subtotals, and tax
4. THE formatReceipt function SHALL format receipt number and timestamp
5. THE formatReceipt function SHALL preserve receipt structure and spacing
6. FOR ALL valid parsed data objects, THE Receipt_Parser SHALL format them into readable text
7. THE formatReceipt function SHALL handle missing fields gracefully

### Requirement 10: Round-Trip Property

**User Story:** As a quality assurance engineer, I want to verify that parsing and formatting are consistent, so that I can catch parsing bugs early.

#### Acceptance Criteria

1. FOR ALL valid receipts, parsing then formatting then parsing SHALL produce equivalent parsed data
2. THE Receipt_Parser SHALL preserve all extracted fields through round-trip conversion
3. THE Receipt_Parser SHALL maintain field types (numbers, strings, dates) through round-trip
4. WHEN round-trip fails, THE Receipt_Parser SHALL log the discrepancy
5. THE Receipt_Parser SHALL provide a test utility for round-trip validation
6. THE round-trip test SHALL compare parsed data structures for equivalence
7. THE round-trip test SHALL allow for minor formatting differences (whitespace, decimal precision)
