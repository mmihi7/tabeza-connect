# Design Document

## Overview

This design document describes the reversion of the receipt parsing implementation from an EC2-hosted service back to direct DeepSeek API integration. The change simplifies the architecture by removing the EC2 dependency and using the OpenAI SDK to communicate directly with DeepSeek's API endpoint.

The core principle is to maintain backward compatibility while removing all EC2-related code and configuration. The system will use the same ParsedReceipt interface and fallback behavior, but will call DeepSeek directly instead of routing through an EC2 instance.

## Architecture

### Current Architecture (EC2-based)

```
┌─────────────────┐
│ Receipt Parser  │
│  (receiptParser │──────┐
│      .ts)       │      │
└─────────────────┘      │
                         │ HTTP POST
                         ▼
                  ┌──────────────┐
                  │ EC2 Instance │
                  │   (port      │
                  │    3100)     │
                  └──────────────┘
                         │
                         │ Calls DeepSeek
                         ▼
                  ┌──────────────┐
                  │  DeepSeek    │
                  │     API      │
                  └──────────────┘
```

### Target Architecture (Direct DeepSeek)

```
┌─────────────────┐
│ Receipt Parser  │
│  (receiptParser │
│      .ts)       │
└─────────────────┘
         │
         │ OpenAI SDK
         │ (DeepSeek endpoint)
         ▼
  ┌──────────────┐
  │  DeepSeek    │
  │     API      │
  └──────────────┘
```

### Benefits of Direct Integration

1. **Simpler Architecture**: No EC2 instance to manage, deploy, or monitor
2. **Lower Latency**: Direct API calls eliminate the EC2 proxy hop
3. **Cost Effective**: No EC2 hosting costs, only pay for DeepSeek API usage
4. **Easier Maintenance**: One less service to maintain and debug
5. **Better Reliability**: Fewer points of failure in the system

## Components and Interfaces

### 1. Receipt Parser Service (`packages/shared/services/receiptParser.ts`)

**Purpose**: Parse receipt text into structured data using DeepSeek API

**Key Functions**:

```typescript
// Main parsing function
export async function parseReceipt(
  receiptText: string, 
  barId: string, 
  documentName?: string
): Promise<ParsedReceipt>

// DeepSeek API integration
async function parseWithDeepSeek(
  receiptText: string, 
  barId: string, 
  documentName?: string
): Promise<ParsedReceipt | null>

// Fallback parser
function parseWithRegex(receiptText: string): ParsedReceipt
```

**Implementation Details**:

- Use OpenAI SDK with DeepSeek base URL
- Set 10-second timeout using AbortController
- Return null on failure to trigger regex fallback
- Log token usage and parsing results
- Handle all error cases gracefully

### 2. OpenAI SDK Integration

**Configuration**:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1'
});
```

**API Call Pattern**:

```typescript
const response = await client.chat.completions.create({
  model: 'deepseek-chat',
  response_format: { type: 'json_object' },
  messages: [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: receiptText
    }
  ],
  temperature: 0.1,
  max_tokens: 2000
});
```

### 3. System Prompt

The system prompt instructs DeepSeek to extract structured data:

```
You are a receipt parser. Extract structured data from receipts and return valid JSON.

Extract:
- items: Array of {name: string, price: number}
- total: number (total amount)
- receiptNumber: string (if present)

Rules:
- Return ONLY valid JSON
- Use exact field names
- Convert all prices to numbers
- Handle missing data gracefully
- Ignore non-item lines (headers, footers, etc.)

Example output:
{
  "items": [
    {"name": "Tusker Lager 500ml", "price": 250.00},
    {"name": "Nyama Choma", "price": 800.00}
  ],
  "total": 1050.00,
  "receiptNumber": "RCP-123456"
}
```

### 4. Printer Service Updates

**Current EC2 Integration** (to be removed):

```javascript
// EC2 parser integration
async function parseWithEC2(receiptText, barId, documentName) {
  const response = await fetch(`${config.parserUrl}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: receiptText, barId, documentName })
  });
  return await response.json();
}
```

**Target Implementation**:

```javascript
// Remove EC2 parsing - let cloud handle it
async function processPrintJob(printData, fileName = 'receipt.prn') {
  const jobId = `job-${Date.now()}`;
  const base64Data = Buffer.from(printData).toString('base64');
  
  // Send raw data to cloud - no pre-parsing
  await sendToCloud({
    driverId: config.driverId,
    barId: config.barId,
    timestamp: new Date().toISOString(),
    rawData: base64Data,
    printerName: 'Tabeza Receipt Printer',
    documentName: fileName,
    metadata: { jobId, source: 'file-watcher', fileSize: printData.length }
  });
  
  return jobId;
}
```

## Data Models

### ParsedReceipt Interface

```typescript
interface ParsedReceipt {
  items: Array<{ name: string; price: number }>;
  total: number;
  receiptNumber?: string;
  rawText: string;
}
```

This interface remains unchanged to maintain backward compatibility.

### DeepSeek API Response

```typescript
interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string; // JSON string to parse
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### Environment Configuration

**Before (EC2)**:
```bash
EC2_PARSER_URL=http://YOUR_EC2_IP:3100
TABEZA_PARSER_URL=http://YOUR_EC2_IP:3100
```

**After (DeepSeek)**:
```bash
DEEPSEEK_API_KEY=sk-your-api-key-here
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, I identified the following testable properties. Several criteria are examples or edge cases rather than universal properties:

**Properties (universal rules)**:
- 1.1: DeepSeek API called for all receipts
- 1.3: Missing API key triggers regex fallback for all receipts
- 3.4: Printer service sends raw data for all receipts
- 4.3: Output structure matches ParsedReceipt for all successful parses
- 4.4: Parsing failures trigger regex fallback for all receipts
- 5.1, 5.2, 5.3, 5.4: Various error conditions trigger regex fallback for all receipts

**Redundancy Analysis**:
- Properties 5.1, 5.2, 5.3, and 5.4 can be combined into one comprehensive "error handling triggers fallback" property
- Property 1.3 is a specific case of the general error handling property
- Property 4.4 is also covered by the general error handling property

**Consolidated Properties**:
1. DeepSeek API integration for all receipts
2. Error handling triggers regex fallback for all receipts (covers 1.3, 4.4, 5.1, 5.2, 5.3, 5.4)
3. Printer service sends raw data for all receipts
4. Output structure compliance for all successful parses

### Correctness Properties

Property 1: DeepSeek API Integration
*For any* receipt text, when the DEEPSEEK_API_KEY is configured, the system should call the DeepSeek API using the OpenAI SDK with the correct endpoint and model parameters.
**Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6**

Property 2: Comprehensive Error Fallback
*For any* receipt text, when DeepSeek API fails for any reason (missing API key, invalid key, timeout, unavailable service, invalid JSON response), the system should fall back to regex parsing and return a valid ParsedReceipt without throwing errors.
**Validates: Requirements 1.3, 4.4, 5.1, 5.2, 5.3, 5.4**

Property 3: Raw Data Transmission
*For any* print job processed by the printer service, the system should send raw base64-encoded data to the cloud without pre-parsing or adding parsed data fields.
**Validates: Requirements 3.4**

Property 4: Output Structure Compliance
*For any* receipt text that is successfully parsed (either by DeepSeek or regex), the returned object should conform to the ParsedReceipt interface with items array, total number, optional receiptNumber, and rawText fields.
**Validates: Requirements 4.1, 4.2, 4.3**



## Error Handling

### Error Categories

1. **Configuration Errors**
   - Missing DEEPSEEK_API_KEY
   - Invalid API key format
   - Action: Log warning, use regex fallback

2. **Network Errors**
   - API endpoint unreachable
   - Connection timeout (10 seconds)
   - Network interruption
   - Action: Log error, use regex fallback

3. **API Errors**
   - 401 Unauthorized (invalid API key)
   - 429 Rate limit exceeded
   - 500 Internal server error
   - Action: Log error with status code, use regex fallback

4. **Response Errors**
   - Invalid JSON in response
   - Missing required fields
   - Malformed data structure
   - Action: Log warning, use regex fallback

### Error Handling Flow

```
┌─────────────────────┐
│ parseReceipt()      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check API Key       │
│ Configured?         │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
    Yes         No
     │           │
     ▼           ▼
┌─────────┐  ┌──────────┐
│ Call    │  │ Use      │
│ DeepSeek│  │ Regex    │
└────┬────┘  └──────────┘
     │
     ▼
┌─────────────────────┐
│ Set 10s Timeout     │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
  Success    Timeout/Error
     │           │
     ▼           ▼
┌─────────┐  ┌──────────┐
│ Parse   │  │ Use      │
│ JSON    │  │ Regex    │
└────┬────┘  └──────────┘
     │
     ▼
┌─────────────────────┐
│ Validate Structure  │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
   Valid     Invalid
     │           │
     ▼           ▼
┌─────────┐  ┌──────────┐
│ Return  │  │ Use      │
│ Result  │  │ Regex    │
└─────────┘  └──────────┘
```

### Logging Strategy

**Success Logs**:
```typescript
console.log('✅ AI parsed receipt (DeepSeek):', {
  itemCount: result.items.length,
  total: result.total,
  tokensUsed: usage.total_tokens,
  barId,
  documentName
});
```

**Fallback Logs**:
```typescript
console.log('ℹ️  DEEPSEEK_API_KEY not set, using regex parser');
console.warn('DeepSeek API timeout (10s), falling back to regex');
console.warn('DeepSeek API error:', error.message, 'falling back to regex');
console.log('📋 Using regex fallback parser');
```

### Timeout Implementation

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await client.chat.completions.create({
    // ... parameters
  }, {
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  // Process response
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    console.warn('DeepSeek API timeout (10s), falling back to regex');
  }
  return null; // Trigger regex fallback
}
```

## Testing Strategy

### Dual Testing Approach

The testing strategy uses both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Test with sample receipts (simple, complex, malformed)
- Test error scenarios (missing API key, network errors, timeouts)
- Test configuration (environment variables, API client setup)
- Test cleanup (verify EC2 code removed)

**Property Tests**: Verify universal properties across all inputs
- Test that all receipts trigger DeepSeek API when configured
- Test that all error conditions trigger regex fallback
- Test that all outputs conform to ParsedReceipt interface
- Test that printer service always sends raw data

### Test Configuration

**Property-Based Testing Library**: fast-check (JavaScript/TypeScript)

**Configuration**:
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: `Feature: revert-ec2-to-deepseek, Property {number}: {property_text}`

### Test Structure

**Unit Tests** (`packages/shared/services/__tests__/receiptParser.test.ts`):

```typescript
describe('Receipt Parser - DeepSeek Integration', () => {
  describe('Configuration', () => {
    it('should use DEEPSEEK_API_KEY from environment');
    it('should use DeepSeek endpoint');
    it('should use deepseek-chat model');
    it('should enforce JSON response format');
  });

  describe('Successful Parsing', () => {
    it('should parse simple receipt');
    it('should parse complex receipt with multiple items');
    it('should extract receipt number when present');
    it('should return ParsedReceipt structure');
  });

  describe('Error Handling', () => {
    it('should fall back to regex when API key missing');
    it('should fall back to regex on network error');
    it('should fall back to regex on timeout');
    it('should fall back to regex on invalid JSON');
    it('should fall back to regex on API error');
  });

  describe('Cleanup Verification', () => {
    it('should not reference EC2_PARSER_URL');
    it('should not have parseWithEC2 function');
    it('should not have EC2-related comments');
  });
});
```

**Property Tests**:

```typescript
import fc from 'fast-check';

describe('Receipt Parser - Property Tests', () => {
  // Feature: revert-ec2-to-deepseek, Property 1: DeepSeek API Integration
  it('should call DeepSeek API for all receipts when configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10 }), // Random receipt text
        fc.uuid(), // Random bar ID
        async (receiptText, barId) => {
          // Mock DeepSeek API
          const mockClient = jest.fn();
          // Verify API called with correct parameters
          await parseReceipt(receiptText, barId);
          expect(mockClient).toHaveBeenCalledWith(
            expect.objectContaining({
              model: 'deepseek-chat',
              response_format: { type: 'json_object' }
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: revert-ec2-to-deepseek, Property 2: Comprehensive Error Fallback
  it('should fall back to regex for all error conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10 }),
        fc.uuid(),
        fc.constantFrom('missing_key', 'invalid_key', 'timeout', 'network_error', 'invalid_json'),
        async (receiptText, barId, errorType) => {
          // Simulate error condition
          // Verify regex fallback used
          const result = await parseReceipt(receiptText, barId);
          expect(result).toHaveProperty('items');
          expect(result).toHaveProperty('total');
          expect(result).toHaveProperty('rawText');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: revert-ec2-to-deepseek, Property 4: Output Structure Compliance
  it('should return valid ParsedReceipt for all successful parses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10 }),
        fc.uuid(),
        async (receiptText, barId) => {
          const result = await parseReceipt(receiptText, barId);
          
          // Verify structure
          expect(result).toHaveProperty('items');
          expect(Array.isArray(result.items)).toBe(true);
          expect(result).toHaveProperty('total');
          expect(typeof result.total).toBe('number');
          expect(result).toHaveProperty('rawText');
          expect(result.rawText).toBe(receiptText);
          
          // Verify items structure
          result.items.forEach(item => {
            expect(item).toHaveProperty('name');
            expect(item).toHaveProperty('price');
            expect(typeof item.name).toBe('string');
            expect(typeof item.price).toBe('number');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

**Printer Service Tests**:

```typescript
describe('Printer Service - EC2 Removal', () => {
  it('should not call EC2 parser endpoints');
  it('should send raw data without parsed fields');
  it('should not reference TABEZA_PARSER_URL');
  it('should not have parseWithEC2 function');
});
```

### Manual Testing Checklist

1. **Environment Setup**
   - [ ] Add DEEPSEEK_API_KEY to .env.local
   - [ ] Remove EC2_PARSER_URL from .env.local
   - [ ] Verify .env.example updated

2. **Receipt Parsing**
   - [ ] Test with simple receipt
   - [ ] Test with complex receipt
   - [ ] Test with malformed receipt
   - [ ] Verify DeepSeek API called
   - [ ] Verify regex fallback works

3. **Error Scenarios**
   - [ ] Test with missing API key
   - [ ] Test with invalid API key
   - [ ] Test with network disconnected
   - [ ] Verify all errors fall back to regex

4. **Printer Service**
   - [ ] Test print job processing
   - [ ] Verify raw data sent to cloud
   - [ ] Verify no EC2 calls made
   - [ ] Check configuration page works

5. **Cleanup Verification**
   - [ ] Verify EC2 directory removed
   - [ ] Verify EC2 zip file removed
   - [ ] Verify EC2 spec directory removed
   - [ ] Search codebase for "EC2" references
   - [ ] Search codebase for "parseWithEC2"

### Test Execution

```bash
# Run unit tests
cd packages/shared && pnpm test

# Run tests with coverage
cd packages/shared && pnpm test:coverage

# Run specific test file
cd packages/shared && pnpm test receiptParser.test.ts

# Run property tests only
cd packages/shared && pnpm test -- --testNamePattern="Property Tests"
```
