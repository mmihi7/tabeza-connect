# TABEZA Validation Library

Pure validation logic extracted from the TABEZA system for cross-system consistency. This package contains only pure functions with no OS dependencies, making it suitable for both cloud (Vercel) and agent (Windows) systems.

## Features

- **Pure Logic**: No OS dependencies, serverless-compatible
- **Business Rules**: Comprehensive business rule validation
- **Data Sanitization**: Clean and normalize data across systems
- **Cross-System Consistency**: Ensure identical validation results in cloud and agent
- **Receipt Validation**: Validate receipt data structure and business logic
- **Type Safety**: Full TypeScript support with Zod validation

## Installation

```bash
npm install @tabeza/validation
```

## Usage

### Basic Validation

```typescript
import { validateReceiptData, sanitizeReceiptData } from '@tabeza/validation';

// Validate receipt data
const validation = validateReceiptData(receiptData);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}

// Sanitize data
const cleanData = sanitizeReceiptData(rawReceiptData);
```

### Business Rule Validation

```typescript
import { BusinessRuleValidator } from '@tabeza/validation';

const validator = new BusinessRuleValidator();

// Validate business rules
const result = validator.validateBusinessRules(receiptSession);
console.log('Compliance score:', result.score);
console.log('Issues:', result.issues);
```

### Data Sanitization

```typescript
import { 
  sanitizePhoneNumber, 
  sanitizeAmount, 
  sanitizeText,
  normalizeReceiptData 
} from '@tabeza/validation';

// Sanitize individual fields
const phone = sanitizePhoneNumber('+254 712 345 678'); // '254712345678'
const amount = sanitizeAmount('1,234.56'); // 1234.56
const text = sanitizeText('  Hello World!  '); // 'Hello World!'

// Normalize entire receipt
const normalized = normalizeReceiptData(receiptData);
```

### Cross-System Validation

```typescript
import { CrossSystemValidator } from '@tabeza/validation';

const validator = new CrossSystemValidator();

// Ensure data is valid across both cloud and agent systems
const validation = validator.validateForBothSystems(data);
console.log('Cloud compatible:', validation.cloudCompatible);
console.log('Agent compatible:', validation.agentCompatible);
```

## API Reference

### Core Validators

- `validateReceiptData(data)` - Validate receipt data structure
- `validateBusinessRules(session)` - Validate business logic rules
- `validateDataConsistency(data)` - Ensure data consistency
- `validateCrossSystemCompatibility(data)` - Check cross-system compatibility

### Data Sanitizers

- `sanitizeReceiptData(data)` - Clean receipt data
- `sanitizePhoneNumber(phone)` - Normalize phone numbers
- `sanitizeAmount(amount)` - Clean monetary amounts
- `sanitizeText(text)` - Clean text fields
- `normalizeReceiptData(data)` - Normalize entire receipt

### Business Rule Validators

- `BusinessRuleValidator` - Main business rule validation class
- `validateReceiptTotals(receipt)` - Validate receipt calculations
- `validateSessionIntegrity(session)` - Validate session data integrity
- `validatePaymentConsistency(payments)` - Validate payment data

### Cross-System Utilities

- `CrossSystemValidator` - Cross-system validation class
- `ensureCloudCompatibility(data)` - Ensure cloud system compatibility
- `ensureAgentCompatibility(data)` - Ensure agent system compatibility

## Validation Rules

### Receipt Data Rules

- Receipt must have valid structure
- All required fields must be present
- Amounts must be non-negative
- Totals must match item calculations
- Timestamps must be valid ISO 8601

### Business Logic Rules

- Session must have at least one event
- Payment amounts must not exceed totals
- Refunds cannot exceed original amounts
- Void events must reference existing events
- Session status must be consistent with events

### Data Consistency Rules

- Phone numbers must be in E.164 format
- Amounts must have maximum 2 decimal places
- Text fields must not contain control characters
- IDs must follow TABEZA format conventions
- Timestamps must be in UTC

## Architecture

This package follows the TABEZA architectural principle: **"Pure logic in the cloud, infrastructure on the agent."**

- ✅ **Serverless Compatible**: No file system or OS dependencies
- ✅ **Pure Functions**: Deterministic validation with no side effects
- ✅ **Cross-System**: Identical validation results in both Vercel cloud and Windows agent
- ✅ **Testable**: Comprehensive property-based testing with fast-check

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Development

```bash
# Build the package
npm run build

# Watch for changes
npm run dev

# Lint code
npm run lint
```

## Integration

### Cloud System (Vercel)

```typescript
import { validateReceiptData } from '@tabeza/validation';

// Use in API routes
export async function POST(request: Request) {
  const data = await request.json();
  const validation = validateReceiptData(data);
  
  if (!validation.valid) {
    return Response.json({ errors: validation.errors }, { status: 400 });
  }
  
  // Process valid data...
}
```

### Agent System (Windows)

```typescript
import { sanitizeReceiptData, validateBusinessRules } from '@tabeza/validation';

// Use in receipt processing
class ReceiptProcessor {
  async processReceipt(rawData: any) {
    // Sanitize data first
    const cleanData = sanitizeReceiptData(rawData);
    
    // Validate business rules
    const validation = validateBusinessRules(cleanData);
    
    if (validation.score < 70) {
      this.logger.warn('Low validation score', { score: validation.score });
    }
    
    return cleanData;
  }
}
```

## License

MIT - Part of the TABEZA ecosystem