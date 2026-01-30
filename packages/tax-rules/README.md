# TABEZA Tax Rules Engine

Pure tax calculation logic extracted from the TABEZA system for serverless compatibility. This package contains only pure functions with no OS dependencies, making it suitable for both cloud (Vercel) and agent (Windows) systems.

## Features

- **Pure Logic**: No OS dependencies, serverless-compatible
- **KRA Compliance**: Kenya Revenue Authority tax calculation rules
- **VAT Calculations**: Standard and zero-rated VAT handling
- **PIN Validation**: KRA PIN format validation
- **Multi-Jurisdiction**: Extensible to other East African countries
- **Type Safety**: Full TypeScript support with Zod validation

## Installation

```bash
npm install @tabeza/tax-rules
```

## Usage

### Basic Tax Calculation

```typescript
import { calculateVAT, validateKRAPin } from '@tabeza/tax-rules';

// Calculate VAT for an item
const vatResult = calculateVAT({
  amount: 1000,
  rate: 0.16, // 16% VAT
  inclusive: false
});

console.log(vatResult);
// {
//   subtotal: 1000,
//   vatAmount: 160,
//   total: 1160,
//   rate: 0.16,
//   inclusive: false
// }

// Validate KRA PIN
const pinValidation = validateKRAPin('P051234567M');
console.log(pinValidation.valid); // true or false
```

### Tax Rule Engine

```typescript
import { TaxRuleEngine } from '@tabeza/tax-rules';

const engine = new TaxRuleEngine('KE'); // Kenya jurisdiction

// Calculate taxes for multiple items
const items = [
  { name: 'Beer', amount: 500, category: 'ALCOHOL' },
  { name: 'Soda', amount: 200, category: 'BEVERAGE' },
  { name: 'Bread', amount: 100, category: 'FOOD_BASIC' }
];

const taxCalculation = engine.calculateTaxes(items);
console.log(taxCalculation);
```

### Compliance Validation

```typescript
import { validateCompliance } from '@tabeza/tax-rules';

const receipt = {
  merchant: { kraPin: 'P051234567M' },
  items: [...],
  totals: { subtotal: 800, tax: 128, total: 928 }
};

const compliance = validateCompliance(receipt, 'KE');
console.log(compliance.isCompliant); // boolean
console.log(compliance.issues); // string[]
```

## API Reference

### Core Functions

- `calculateVAT(params)` - Calculate VAT for a single amount
- `calculateExciseTax(params)` - Calculate excise tax for applicable items
- `validateKRAPin(pin)` - Validate Kenya Revenue Authority PIN format
- `validateCompliance(receipt, jurisdiction)` - Validate tax compliance

### Tax Rule Engine

- `TaxRuleEngine(jurisdiction)` - Create engine for specific jurisdiction
- `engine.calculateTaxes(items)` - Calculate taxes for multiple items
- `engine.getApplicableRates(category)` - Get tax rates for item category
- `engine.validateReceipt(receipt)` - Validate receipt tax calculations

### Types

All functions are fully typed with TypeScript. Import types as needed:

```typescript
import type {
  VATCalculation,
  TaxCalculationResult,
  ComplianceValidation,
  TaxableItem,
  TaxRates
} from '@tabeza/tax-rules';
```

## Supported Jurisdictions

- **KE** (Kenya) - Full KRA compliance support
- **UG** (Uganda) - Basic VAT support
- **TZ** (Tanzania) - Basic VAT support  
- **RW** (Rwanda) - Basic VAT support

## Architecture

This package follows the TABEZA architectural principle: **"Pure logic in the cloud, infrastructure on the agent."**

- ✅ **Serverless Compatible**: No file system or OS dependencies
- ✅ **Pure Functions**: Deterministic calculations with no side effects
- ✅ **Cross-System**: Usable in both Vercel cloud and Windows agent
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

## License

MIT - Part of the TABEZA ecosystem