# TABEZA Virtual Printer Architecture

## Overview

The TABEZA Virtual Printer Interface is a comprehensive, POS-agnostic receipt capture and processing system designed specifically for African markets. It bridges traditional POS systems with modern digital receipt delivery while maintaining existing merchant workflows.

## Design Principles

### 1. **POS-Agnostic**
- Works with any POS system or printer
- No modifications required to existing hardware
- Supports multiple print formats (ESC/POS, Plain Text, PDF, Images)

### 2. **Africa-Ready**
- Handles intermittent connectivity
- Optimized for low bandwidth
- Supports mobile money integration
- Multi-language support (English, Swahili, local languages)

### 3. **Workflow Preservation**
- Merchants keep their existing processes
- Physical receipts continue printing normally
- Digital features are additive, not disruptive

### 4. **Regulatory Compliance**
- Optional eTIMS integration with proper legal framing
- Merchant acknowledgment required
- Advisory vs. strict compliance modes

### 5. **Security First**
- Receipt hashing and digital signatures
- Tamper detection and fraud prevention
- Secure credential storage

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TABEZA Virtual Printer Interface             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   POS System    │───▶│  Print Capture   │───▶│   Format    │ │
│  │   (Any Brand)   │    │     Layer        │    │  Detector   │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                         │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ Physical Printer│◀───│  Dual Output     │◀───│  Receipt    │ │
│  │   (Unchanged)   │    │    Manager       │    │   Parser    │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                 │                       │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │ Digital Receipt │◀───│   QR Code &      │    │ Canonical   │ │
│  │   Delivery      │    │   Delivery       │    │ Receipt     │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                         │       │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │  TABEZA Cloud   │◀───│   Sync Queue     │◀───│  Security   │ │
│  │    Platform     │    │  (Offline-Ready) │    │ & Integrity │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│                                                         │       │
│                         ┌──────────────────┐    ┌─────────────┐ │
│                         │   Compliance     │◀───│   eTIMS     │ │
│                         │    Manager       │    │ Integration │ │
│                         └──────────────────┘    └─────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Print Capture Layer (`print-capture.ts`)
**Purpose**: Intercepts print jobs from various sources

**Capabilities**:
- Windows Print Spooler monitoring
- Linux/macOS CUPS integration
- USB/Network printer communication
- Platform-specific implementations

**Key Features**:
- Real-time print job detection
- Printer filtering by name/model
- Metadata extraction (document name, user, etc.)
- Error handling and recovery

### 2. Format Detection Engine (`format-detector.ts`)
**Purpose**: Automatically identifies print data formats

**Supported Formats**:
- **ESC/POS**: Thermal printer commands (EPSON, Star, etc.)
- **Plain Text**: Standard text receipts
- **PDF**: PDF receipt documents
- **Images**: PNG, JPEG, BMP receipt images

**Detection Methods**:
- Magic byte analysis
- Control code pattern matching
- Content heuristics
- Confidence scoring

### 3. Receipt Parser (`receipt-parser.ts`)
**Purpose**: Converts raw print data to structured format

**Parsing Techniques**:
- Regex-based pattern matching
- Line positioning analysis
- Keyword heuristics
- Context-aware extraction

**Output**: Canonical Receipt Data Model (CRDM)

### 4. Canonical Receipt Data Model (`types/receipt.ts`)
**Purpose**: Standardized receipt format with Zod validation

**Core Structure**:
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

### 5. Dual Output Manager (`dual-output-manager.ts`)
**Purpose**: Maintains existing workflows while adding digital features

**Dual Processing**:
1. **Physical Output**: Forward to original printer (unchanged)
2. **Digital Output**: Generate QR codes and digital delivery

**Delivery Methods**:
- SMS with receipt summary
- Email with full receipt
- WhatsApp with formatted message
- QR code for web access

### 6. Sync & Offline Queue (`sync-queue.ts`)
**Purpose**: Handles intermittent connectivity common in African markets

**Features**:
- Priority-based queuing (Critical > High > Medium > Low)
- Intelligent retry with exponential backoff
- Batch synchronization
- Connection monitoring
- Queue size management

**Retry Strategy**:
- Immediate retry on failure
- Exponential backoff: 30s → 1m → 2m → 5m → 10m → 30m → 1h
- Priority-based retry scheduling
- Automatic cleanup of old items

### 7. Security & Integrity Layer (`security-manager.ts`)
**Purpose**: Ensures receipt authenticity and prevents fraud

**Security Features**:
- SHA-256 receipt hashing
- HMAC digital signatures
- Tamper detection algorithms
- Fraud pattern analysis
- Secure receipt ID generation

**Integrity Checks**:
- Hash verification
- Signature validation
- Timestamp verification
- Content integrity validation

### 8. Compliance Manager (`compliance-manager.ts`)
**Purpose**: Optional eTIMS integration with proper legal framing

**Compliance Features**:
- Toggle-based activation
- Advisory vs. strict modes
- Merchant acknowledgment required
- Legal disclaimer display
- Back-submission capability

**eTIMS Integration**:
- KRA API integration
- Invoice format transformation
- QR code generation
- Submission tracking
- Error handling

## Data Flow

### 1. Print Job Capture
```
POS System → Print Spooler/CUPS → Print Capture Layer → Raw Print Data
```

### 2. Format Detection & Parsing
```
Raw Print Data → Format Detector → Receipt Parser → Canonical Receipt
```

### 3. Security & Compliance
```
Canonical Receipt → Security Manager → Signed Receipt → Compliance Manager → eTIMS (Optional)
```

### 4. Dual Output Processing
```
Signed Receipt → Dual Output Manager → Physical Printer + Digital Delivery
```

### 5. Sync & Storage
```
Processed Receipt → Sync Queue → TABEZA Cloud Platform
```

## Configuration Management

### Development Configuration
```typescript
const config = createDevelopmentConfig('merchant-id');
// - Disabled physical printing
// - Enabled QR codes
// - Shorter retry intervals
// - Relaxed security settings
```

### Production Configuration
```typescript
const config = createDefaultConfig('merchant-id', 'secret-key');
// - Enabled physical printing
// - Full security features
// - Production retry intervals
// - eTIMS integration ready
```

### Custom Configuration
```typescript
const printer = createVirtualPrinter('merchant-id', {
  forwardToPhysicalPrinter: true,
  generateQRCode: true,
  enableEtims: false,
  printerFilters: ['EPSON', 'Star']
});
```

## Error Handling & Recovery

### 1. Parse Failures
- Graceful degradation to partial parsing
- Confidence scoring for reliability
- Manual review flagging for low confidence

### 2. Network Issues
- Automatic queuing for offline processing
- Intelligent retry with backoff
- Priority-based sync ordering

### 3. Compliance Failures
- Advisory mode: Log and continue
- Strict mode: Block until resolved
- Merchant notification system

### 4. Security Violations
- Tamper detection alerts
- Fraud pattern notifications
- Automatic quarantine of suspicious receipts

## Performance Characteristics

### Processing Speed
- Format detection: <50ms
- Receipt parsing: <200ms
- Security signing: <10ms
- Total processing: <500ms average

### Memory Usage
- Base engine: ~50MB
- Per receipt: ~1KB
- Queue storage: Configurable (default 1000 items)

### Network Efficiency
- Batch synchronization
- Compression for large payloads
- Delta sync for updates
- Offline-first architecture

## Scalability Considerations

### Horizontal Scaling
- Stateless processing engine
- Queue-based architecture
- Load balancer compatible

### Vertical Scaling
- Configurable batch sizes
- Memory-efficient parsing
- Streaming for large files

### Multi-tenant Support
- Merchant isolation
- Per-tenant configuration
- Shared infrastructure

## Security Model

### Data Protection
- Encryption at rest and in transit
- Secure credential storage
- PII anonymization options

### Access Control
- Merchant-scoped data access
- Role-based permissions
- API key authentication

### Audit Trail
- Complete processing logs
- Security event tracking
- Compliance audit reports

## Deployment Options

### Standalone Installation
- Single merchant deployment
- Local processing only
- Minimal cloud dependency

### Cloud-Connected
- Multi-merchant support
- Full sync capabilities
- Analytics and reporting

### Hybrid Mode
- Local processing with cloud backup
- Selective sync based on rules
- Disaster recovery support

## Integration Points

### POS System Integration
- No modifications required
- Print driver interception
- Passive monitoring approach

### TABEZA Platform Integration
- REST API endpoints
- WebSocket real-time updates
- Webhook notifications

### Third-party Integrations
- SMS providers (Africa's Talking, Twilio)
- Email services (SendGrid, Mailgun)
- WhatsApp Business API
- Payment processors (M-Pesa, etc.)

## Future Enhancements

### Planned Features
- OCR for image receipts
- Machine learning for parsing improvement
- Multi-language receipt parsing
- Advanced fraud detection
- Real-time analytics dashboard

### Extensibility Points
- Custom format detectors
- Plugin architecture for parsers
- Custom delivery methods
- Third-party compliance systems

## Conclusion

The TABEZA Virtual Printer Interface represents a comprehensive solution for modernizing receipt processing in African markets. By maintaining existing merchant workflows while adding powerful digital capabilities, it provides a seamless bridge between traditional POS systems and modern customer expectations.

The architecture prioritizes reliability, security, and regulatory compliance while remaining flexible enough to adapt to diverse market needs and technical environments.