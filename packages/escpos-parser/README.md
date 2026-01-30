# TABEZA ESC/POS Parser

Pure ESC/POS parsing logic extracted from TABEZA Virtual Printer for serverless compatibility. This package contains only pure functions with no OS dependencies, making it suitable for both cloud (Vercel) and agent (Windows) systems.

## 🎯 Design Principles

- **Pure Functions Only**: No file system, OS, or hardware dependencies
- **Serverless Compatible**: Runs in Vercel, AWS Lambda, and other serverless environments
- **Cross-System Usability**: Works in both cloud and on-premises systems
- **High Performance**: Optimized for fast parsing with configurable timeouts
- **Comprehensive Testing**: Property-based testing ensures correctness across all inputs

## 🚀 Quick Start

### Installation

```bash
npm install @tabeza/escpos-parser
```

### Basic Usage

```typescript
import { parseReceiptData, detectPrintFormat } from '@tabeza/escpos-parser';

// Detect format of print data
const formatResult = detectPrintFormat(rawPrintData);
console.log('Detected format:', formatResult.format);
console.log('Confidence:', formatResult.confidence);

// Parse receipt data
const parsingResult = await parseReceiptData(rawPrintData, 'merchant-123');

if (parsingResult.status === 'success') {
  console.log('Receipt parsed successfully!');
  console.log('Items found:', parsingResult.metadata.itemsFound);
  console.log('Confidence:', parsingResult.confidence);
}
```

### Advanced Usage

```typescript
import { ReceiptParser, FormatDetector, createParsingOptions } from '@tabeza/escpos-parser';

// Create parser instances
const formatDetector = new FormatDetector();
const receiptParser = new ReceiptParser();

// Configure parsing options
const options = createParsingOptions('merchant-123', {
  strictMode: false,
  minConfidence: 0.7,
  enableHeuristics: true,
  maxProcessingTime: 3000
});

// Detect format first
const formatResult = formatDetector.detect(rawData);

// Parse with custom options
const parsingResult = await receiptParser.parse(rawData, options);
```

## 📋 Supported Formats

- **ESC/POS**: Thermal printer commands (EPSON, Star, etc.)
- **Plain Text**: Standard text receipts with structured content
- **PDF**: PDF document metadata (content extraction requires additional tools)
- **Image**: Image format metadata (OCR requires additional tools)

## 🔧 API Reference

### Core Functions

#### `detectPrintFormat(data: Buffer | string): FormatDetectionResult`

Detects the format of print data.

```typescript
const result = detectPrintFormat(printData);
// Returns: { format: 'ESC_POS', confidence: 0.95, indicators: [...] }
```

#### `parseReceiptData(data: Buffer | string, merchantId: string, options?: ParsingOptions): Promise<ParsingResult>`

Parses receipt data into structured format.

```typescript
const result = await parseReceiptData(printData, 'merchant-123', {
  minConfidence: 0.6,
  enableHeuristics: true
});
```

#### `validateParsingResult(result: ParsingResult): boolean`

Validates that a parsing result meets quality standards.

```typescript
const isValid = validateParsingResult(parsingResult);
```

### Classes

#### `FormatDetector`

Detects print data formats using pattern analysis.

```typescript
const detector = new FormatDetector();
const result = detector.detect(data);
```

**Methods:**
- `detect(data: Buffer | string): FormatDetectionResult`
- `analyzeContent(data: string): ContentAnalysis`
- `checkEscPosCommands(data: Buffer): boolean`

#### `ReceiptParser`

Parses receipt data into canonical format.

```typescript
const parser = new ReceiptParser();
const result = await parser.parse(data, options);
```

**Methods:**
- `parse(data: Buffer | string, options: ParsingOptions): Promise<ParsingResult>`
- `parseEscPos(data: Buffer, options: ParsingOptions): Promise<ParsingResult>`
- `parsePlainText(data: string, options: ParsingOptions): Promise<ParsingResult>`

### Types

#### `ParsingResult`

```typescript
interface ParsingResult {
  status: 'success' | 'partial' | 'failed';
  receipt?: CompleteReceiptSession;
  confidence: number;
  errors?: ParsingError[];
  warnings?: string[];
  metadata: {
    format: PrintFormat;
    processingTime: number;
    linesProcessed: number;
    itemsFound: number;
    totalsFound: boolean;
    merchantInfoFound: boolean;
  };
}
```

#### `ParsingOptions`

```typescript
interface ParsingOptions {
  merchantId: string;
  strictMode?: boolean;
  minConfidence?: number;
  maxProcessingTime?: number;
  enableHeuristics?: boolean;
  fallbackToPlainText?: boolean;
  preserveRawData?: boolean;
  customPatterns?: RegExp[];
}
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Property-Based Tests

```bash
npm run test:property
```

### Coverage Report

```bash
npm run test:coverage
```

## 🔍 Format Detection

The parser uses multiple indicators to detect print formats:

### ESC/POS Detection
- Control characters (0x1B, 0x00-0x1F)
- Print commands (cut, feed, formatting)
- Binary data patterns

### Plain Text Detection
- Readable ASCII content
- Receipt structure patterns
- Line-based formatting

### Confidence Scoring

- **0.9-1.0**: Excellent - Format clearly identified
- **0.7-0.9**: Good - High confidence with minor ambiguity
- **0.5-0.7**: Acceptable - Reasonable confidence
- **0.3-0.5**: Poor - Low confidence, may need manual review
- **0.0-0.3**: Failed - Unable to determine format reliably

## 🎛️ Configuration

### Default Options

```typescript
const DEFAULT_OPTIONS = {
  strictMode: false,
  minConfidence: 0.6,
  maxProcessingTime: 5000,
  enableHeuristics: true,
  fallbackToPlainText: true,
  preserveRawData: false
};
```

### Custom Patterns

Add custom regex patterns for specific receipt formats:

```typescript
const options = {
  merchantId: 'merchant-123',
  customPatterns: [
    /CUSTOM RECEIPT PATTERN/i,
    /SPECIAL ITEM FORMAT: (.+) - (\d+\.\d{2})/
  ]
};
```

## 🚫 What This Package Does NOT Do

- **File System Operations**: No reading/writing files
- **Network Requests**: No HTTP calls or external APIs
- **OS Integration**: No printer drivers or system calls
- **Image Processing**: No OCR or image analysis (metadata only)
- **PDF Content Extraction**: No PDF parsing (metadata only)

## 🔗 Integration

### With Cloud Systems (Vercel)

```typescript
// API route example
export async function POST(request: Request) {
  const { printData, merchantId } = await request.json();
  
  const result = await parseReceiptData(printData, merchantId);
  
  return Response.json(result);
}
```

### With Agent Systems (Windows)

```typescript
// Windows Service integration
import { parseReceiptData } from '@tabeza/escpos-parser';

class ReceiptProcessor {
  async processCapture(rawData: Buffer, merchantId: string) {
    const result = await parseReceiptData(rawData, merchantId);
    
    // Store in local SQLite database
    await this.localStore.saveReceipt(result.receipt);
    
    return result;
  }
}
```

## 📊 Performance

- **Typical Processing Time**: 10-100ms per receipt
- **Memory Usage**: <10MB per parsing operation
- **Throughput**: 100+ receipts/second on modern hardware
- **Timeout Protection**: Configurable maximum processing time

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Part of the TABEZA ecosystem** - Bridging traditional POS systems with modern digital receipt delivery.