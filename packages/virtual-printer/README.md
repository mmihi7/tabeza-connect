# TABEZA Virtual Printer Interface

A comprehensive, POS-agnostic receipt capture and processing system designed for African markets. The TABEZA Virtual Printer Interface intercepts print jobs from any POS system, converts them to a canonical format, and provides digital receipt delivery while maintaining existing merchant workflows.

## 🌍 Africa-Ready Features

- **Intermittent Connectivity**: Robust offline queue with intelligent sync
- **Multiple Languages**: Support for English, Swahili, and local languages
- **Mobile Money Integration**: M-Pesa and other mobile payment receipt processing
- **eTIMS Compliance**: Optional KRA eTIMS integration with proper legal framing
- **Low Bandwidth**: Optimized for African internet conditions

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   POS System    │───▶│  Print Capture   │───▶│ Format Detector │
│   (Any Brand)   │    │     Layer        │    │   & Parser      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Physical Printer│◀───│  Dual Output     │◀───│ Canonical       │
│   (Unchanged)   │    │    Manager       │    │ Receipt Model   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Digital Receipt │◀───│   QR Code &      │    │   Security &    │
│   Delivery      │    │   Delivery       │    │   Integrity     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  TABEZA Cloud   │◀───│   Sync Queue     │◀───│   Compliance    │
│    Platform     │    │  (Offline-Ready) │    │   Manager       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install @tabeza/virtual-printer
```

### Basic Usage

```typescript
import { createVirtualPrinter } from '@tabeza/virtual-printer';

// Create virtual printer instance
const virtualPrinter = createVirtualPrinter('your-merchant-id', {
  forwardToPhysicalPrinter: true,  // Keep existing workflow
  generateQRCode: true,            // Enable digital receipts
  enableEtims: false               // Optional compliance
});

// Start capturing print jobs
await virtualPrinter.start();

// Listen for processed receipts
virtualPrinter.on('job-completed', (result) => {
  console.log('Receipt processed:', result.receipt.receipt_id);
  console.log('QR Code:', result.output.qrCode?.url);
});
```

### Manual Receipt Processing

```typescript
import { ReceiptParser, createTestReceipt } from '@tabeza/virtual-printer';

const parser = new ReceiptParser();

// Process raw print data
const result = await parser.parse(rawPrintData, 'merchant-id');

if (result.status === 'parsed') {
  console.log('Receipt:', result.receipt);
}
```

## 📋 Core Components

### 1. Print Capture Layer
Intercepts print jobs from various sources:
- **Windows**: Print Spooler monitoring
- **Linux/macOS**: CUPS integration
- **USB/Network**: Direct printer communication

### 2. Format Detection Engine
Automatically detects print data formats:
- ESC/POS thermal printer commands
- Plain text receipts
- PDF documents
- Image formats

### 3. Receipt Parser
Converts raw print data to structured format:
- Regex-based pattern matching
- Line positioning analysis
- Keyword heuristics
- Confidence scoring

### 4. Canonical Receipt Data Model (CRDM)
Standardized receipt format with Zod validation:

```typescript
interface CanonicalReceipt {
  receipt_id: string;
  merchant: Merchant;
  transaction: Transaction;
  items: ReceiptItem[];
  totals: ReceiptTotals;
  signature: string;
  etims_status: EtimsStatus;
  created_at: string;
  updated_at: string;
}
```

### 5. Dual Output Manager
Maintains existing workflows while adding digital features:
- Forward to physical printer (unchanged)
- Generate QR codes for digital access
- Multiple delivery methods (SMS, Email, WhatsApp)

### 6. Sync & Offline Queue
Handles African connectivity challenges:
- Intelligent retry with exponential backoff
- Priority-based queuing
- Batch synchronization
- Connection monitoring

### 7. Security & Integrity Layer
Ensures receipt authenticity:
- SHA-256 hashing
- HMAC digital signatures
- Tamper detection
- Fraud pattern analysis

### 8. Compliance Manager
Optional eTIMS integration:
- Toggle-based activation
- Advisory vs. strict modes
- Proper legal disclaimers
- Merchant acknowledgment required

## 🔧 Configuration

### Development Configuration

```typescript
import { createDevelopmentConfig, VirtualPrinterEngine } from '@tabeza/virtual-printer';

const config = createDevelopmentConfig('dev-merchant');
const printer = new VirtualPrinterEngine(config);
```

### Production Configuration

```typescript
import { createDefaultConfig, VirtualPrinterEngine } from '@tabeza/virtual-printer';

const config = createDefaultConfig('merchant-id', 'your-secret-key');

// Customize for production
config.dualOutput.deliveryMethods = ['sms', 'email', 'qr_code'];
config.sync.maxQueueSize = 10000;
config.security.enableTimestampValidation = true;

const printer = new VirtualPrinterEngine(config);
```

## 📱 Digital Receipt Delivery

### QR Code Generation

```typescript
// URL-based QR codes
config.dualOutput.qrCodeFormat = 'url';

// Data-embedded QR codes
config.dualOutput.qrCodeFormat = 'data';

// Both URL and data
config.dualOutput.qrCodeFormat = 'both';
```

### Delivery Methods

```typescript
import { ReceiptDelivery } from '@tabeza/virtual-printer';

const deliveryOptions: ReceiptDelivery[] = [
  {
    method: 'sms',
    recipient: '+254700123456',
    template: 'receipt-sms'
  },
  {
    method: 'email',
    recipient: 'customer@example.com',
    template: 'receipt-email'
  },
  {
    method: 'whatsapp',
    recipient: '+254700123456',
    options: { business_account: true }
  }
];
```

## 🛡️ Security Features

### Receipt Signing

```typescript
import { SecurityManager } from '@tabeza/virtual-printer';

const security = new SecurityManager({
  hashAlgorithm: 'sha256',
  signatureAlgorithm: 'hmac-sha256',
  secretKey: 'your-32-char-secret-key',
  enableTimestampValidation: true,
  maxReceiptAge: 86400 // 24 hours
});

const signature = security.signReceipt(receipt);
const audit = security.verifyReceipt(receipt, signature);
```

### Fraud Detection

```typescript
const tamperingCheck = security.detectTampering(receipt);

if (tamperingCheck.suspicious) {
  console.log('Risk Level:', tamperingCheck.riskLevel);
  console.log('Indicators:', tamperingCheck.indicators);
}
```

## 📊 eTIMS Compliance

### Enable eTIMS (Optional)

```typescript
await virtualPrinter.updateMerchantCompliance('merchant-id', {
  etims: {
    enabled: true,
    mode: 'advisory', // or 'strict'
    acknowledged: true // Merchant must acknowledge legal disclaimer
  }
});
```

### Legal Disclaimer

```typescript
const disclaimer = virtualPrinter.getComplianceDisclaimer();
console.log(disclaimer);
// Displays full legal notice about eTIMS responsibilities
```

## 🔄 Offline & Sync

### Queue Management

```typescript
import { SyncQueue, DEFAULT_SYNC_CONFIG } from '@tabeza/virtual-printer';

const syncQueue = new SyncQueue(DEFAULT_SYNC_CONFIG);

// Add items to queue
await syncQueue.enqueue('receipt', receiptData, 'high');

// Monitor sync status
syncQueue.on('connection-changed', (isOnline) => {
  console.log('Connection:', isOnline ? 'ONLINE' : 'OFFLINE');
});

// Get queue statistics
const stats = syncQueue.getStats();
console.log('Queue size:', stats.queueSize);
console.log('Pending items:', stats.pendingItems);
```

## 🧪 Testing & Development

### Create Test Data

```typescript
import { createTestReceipt, createTestPrintData } from '@tabeza/virtual-printer';

// Generate test receipt
const testReceipt = createTestReceipt('test-merchant', {
  merchantName: 'Test Restaurant',
  paymentMethod: 'MPESA',
  includeKraPin: true
});

// Generate test print data
const escPosData = createTestPrintData('ESC_POS');
const plainTextData = createTestPrintData('PLAIN_TEXT');
```

### Validation

```typescript
import { validateReceipt, sanitizeReceiptData } from '@tabeza/virtual-printer';

// Validate receipt
const validation = validateReceipt(receiptData);
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}

// Sanitize data
const cleanReceipt = sanitizeReceiptData(dirtyReceiptData);
```

## 📈 Monitoring & Analytics

### System Status

```typescript
const status = virtualPrinter.getSystemStatus();
console.log('Running:', status.isRunning);
console.log('Stats:', status.stats);
console.log('Queue:', status.components.syncQueue);
```

### Processing Statistics

```typescript
const stats = virtualPrinter.getStats();
console.log('Total processed:', stats.totalJobsProcessed);
console.log('Success rate:', stats.successfulParsing / stats.totalJobsProcessed);
console.log('Average time:', stats.averageProcessingTime, 'ms');
```

## 🌐 Supported Formats

- **ESC/POS**: Thermal printer commands (EPSON, Star, etc.)
- **Plain Text**: Standard text receipts
- **PDF**: PDF receipt documents
- **Images**: PNG, JPEG, BMP receipt images

## 🔌 Platform Support

- **Windows**: Print Spooler integration
- **Linux**: CUPS integration
- **macOS**: CUPS integration
- **Docker**: Containerized deployment

## 📞 Support & Documentation

- **GitHub**: [github.com/tabeza/virtual-printer](https://github.com/tabeza/virtual-printer)
- **Documentation**: [docs.tabeza.app/virtual-printer](https://docs.tabeza.app/virtual-printer)
- **Support**: support@tabeza.app

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

We welcome contributions! Please see CONTRIBUTING.md for guidelines.

---

**TABEZA Virtual Printer Interface** - Bridging traditional POS systems with modern digital receipt delivery, designed specifically for African markets.