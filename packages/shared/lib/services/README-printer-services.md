# Printer Services

## Overview

The Printer Services module provides authority-based printer driver detection, ESC/POS protocol communication, and printer service management for Tabeza's thermal printer integration.

**CORE TRUTH**: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

## Key Principle

Printer services are **ONLY** active for POS authority modes:
- ✅ **Basic mode** (POS authority): Printer services REQUIRED
- ✅ **Venue + POS mode**: Printer services REQUIRED  
- ❌ **Venue + Tabeza mode**: Printer services BYPASSED

## Architecture

### Components

1. **PrinterServiceTypes** (`printer-service-types.ts`)
   - Core type definitions for printer services
   - Platform detection types
   - ESC/POS protocol types
   - POS print interception types (Essential Tabeza Basic workflow)

2. **AuthorityModeValidator** (`printer-authority-validator.ts`)
   - Validates printer requirements based on venue configuration
   - Enforces Core Truth constraints
   - Provides authority-based service activation logic

3. **PrinterServiceManager** (`printer-service-manager.ts`)
   - Main service interface for printer operations
   - Driver detection and installation guidance
   - Printer connection management (placeholder for Task 3)
   - Printer testing (placeholder for Task 5)
   - Status monitoring (placeholder for Task 6)

## Usage

### Basic Setup

```typescript
import {
  createPrinterServiceManager,
  createAuthorityModeValidator,
  shouldInitializePrinterService
} from '@tabeza/shared/lib/services/printer-services';

// Check if printer service should be initialized
const venueMode = 'basic';
const authorityMode = 'pos';

if (shouldInitializePrinterService(venueMode, authorityMode)) {
  // Initialize printer service
  const config = {
    venue_mode: venueMode,
    authority_mode: authorityMode,
    pos_integration_enabled: true,
    printer_required: true,
    onboarding_completed: true
  };
  
  const printerService = createPrinterServiceManager(config);
}
```

### Authority Validation

```typescript
import { createAuthorityModeValidator } from '@tabeza/shared/lib/services/printer-services';

const validator = createAuthorityModeValidator();

// Validate printer requirement
const requirement = validator.validatePrinterRequirement(venueConfig);

if (requirement.required) {
  console.log(requirement.description);
  // Show printer driver installation guidance
}

// Check if printer setup should be skipped
if (validator.shouldSkipPrinterSetup('venue', 'tabeza')) {
  // Skip printer setup entirely for Venue + Tabeza mode
}
```

### Driver Detection

```typescript
import { createPrinterServiceManager } from '@tabeza/shared/lib/services/printer-services';

const printerService = createPrinterServiceManager(config);

// Detect printer drivers
const detectionResult = await printerService.detectDrivers();

if (detectionResult.driversRequired && !detectionResult.driversDetected) {
  // Show installation guidance
  const guidance = printerService.getInstallationGuidance(detectionResult.platform);
  
  console.log('Download URL:', guidance.downloadUrl);
  console.log('Instructions:', guidance.instructions);
}
```

### Service Configuration

```typescript
// Get current service configuration
const serviceConfig = printerService.getServiceConfig();

console.log('Venue Mode:', serviceConfig.venueMode);
console.log('Authority Mode:', serviceConfig.authorityMode);
console.log('Printer Required:', serviceConfig.printerRequired);

// Update configuration
const newConfig = {
  venue_mode: 'venue',
  authority_mode: 'pos',
  pos_integration_enabled: true,
  printer_required: false,
  onboarding_completed: true
};

printerService.updateConfiguration(newConfig);
```

## Authority-Based Service Activation

### Basic Mode (POS Authority)

```typescript
const config = {
  venue_mode: 'basic',
  authority_mode: 'pos',
  pos_integration_enabled: true,
  printer_required: true,
  onboarding_completed: true
};

const service = createPrinterServiceManager(config);

// All printer services are ACTIVE
service.isServiceRequired('basic', 'pos'); // true
await service.detectDrivers(); // Detects drivers
await service.establishConnection(printerConfig); // Connects to printer
await service.testPrinter(connection); // Tests printer
```

### Venue + POS Mode

```typescript
const config = {
  venue_mode: 'venue',
  authority_mode: 'pos',
  pos_integration_enabled: true,
  printer_required: false,
  onboarding_completed: true
};

const service = createPrinterServiceManager(config);

// All printer services are ACTIVE
service.isServiceRequired('venue', 'pos'); // true
await service.detectDrivers(); // Detects drivers
await service.establishConnection(printerConfig); // Connects to printer
```

### Venue + Tabeza Mode

```typescript
const config = {
  venue_mode: 'venue',
  authority_mode: 'tabeza',
  pos_integration_enabled: false,
  printer_required: false,
  onboarding_completed: true
};

const service = createPrinterServiceManager(config);

// All printer services are BYPASSED
service.isServiceRequired('venue', 'tabeza'); // false
await service.detectDrivers(); // Returns driversRequired: false

// These will throw errors:
await service.establishConnection(printerConfig); // Error: Not available for tabeza authority
await service.testPrinter(connection); // Error: Not available for tabeza authority
```

## Utility Functions

```typescript
import {
  isPrinterDriverRequired,
  isESCPOSActive,
  isPrintQueueActive,
  isPrinterStatusMonitoringActive,
  getPrinterRequirementDescription
} from '@tabeza/shared/lib/services/printer-services';

// Check if printer drivers are required
if (isPrinterDriverRequired('basic', 'pos')) {
  // Show driver installation UI
}

// Check if ESC/POS communication should be active
if (isESCPOSActive('pos')) {
  // Initialize ESC/POS communication
}

// Check if print queue should be active
if (isPrintQueueActive('pos')) {
  // Initialize print queue
}

// Check if status monitoring should be active
if (isPrinterStatusMonitoringActive('pos')) {
  // Start status monitoring
}

// Get human-readable description
const description = getPrinterRequirementDescription(config);
console.log(description);
```

## Error Handling

```typescript
import {
  InvalidAuthorityConfigurationError,
  PrinterRequirementMismatchError,
  DriverDetectionError,
  UnsupportedPlatformError,
  PrinterConnectionError
} from '@tabeza/shared/lib/services/printer-services';

try {
  const service = createPrinterServiceManager(config);
} catch (error) {
  if (error instanceof InvalidAuthorityConfigurationError) {
    // Handle invalid configuration
    console.error('Invalid venue/authority configuration');
  } else if (error instanceof PrinterRequirementMismatchError) {
    // Handle printer requirement mismatch
    console.error('Printer requirement does not match authority mode');
  }
}

try {
  await service.detectDrivers();
} catch (error) {
  if (error instanceof DriverDetectionError) {
    // Handle driver detection failure
    console.error('Failed to detect drivers');
  } else if (error instanceof UnsupportedPlatformError) {
    // Handle unsupported platform
    console.error('Platform does not support printer drivers');
  }
}
```

## Installation Guidance

The service provides platform-specific installation guidance for Tabeza printer drivers:

### Supported Platforms

- **Windows**: Full driver support with installer
- **macOS**: Full driver support with .pkg installer
- **Linux**: Full driver support with CUPS integration
- **iOS**: Not supported (requires desktop setup)
- **Android**: Not supported (requires desktop setup)

### Download Links

All drivers are available at: `https://tabeza.co.ke/downloads/printer-drivers`

Platform-specific URLs:
- Windows: `https://tabeza.co.ke/downloads/printer-drivers/windows`
- macOS: `https://tabeza.co.ke/downloads/printer-drivers/macos`
- Linux: `https://tabeza.co.ke/downloads/printer-drivers/linux`

## Testing

The module includes comprehensive unit tests:

```bash
# Run printer authority validator tests
pnpm test printer-authority-validator.test.ts

# Run printer service manager tests
pnpm test printer-service-manager.test.ts
```

## Future Enhancements

The following features are placeholders and will be implemented in subsequent tasks:

- **Task 2**: Web-based driver detection service
- **Task 3**: ESC/POS protocol communication manager
- **Task 5**: Real printer testing service
- **Task 6**: Printer status monitoring and queue management
- **Task 11**: POS receipt distribution modal system (Essential Tabeza Basic workflow)

## Core Truth Compliance

This module strictly enforces the Core Truth constraint:

✅ **Printer services ONLY active for POS authority**
✅ **Venue + Tabeza mode completely bypasses printer services**
✅ **Invalid configurations are prevented at initialization**
✅ **Authority mode changes are validated**

## Related Documentation

- [Venue Configuration Validation](./README-venue-configuration-validation.md)
- [Core Truth & Authority Model](../../../../.kiro/steering/core-truth-authority-model.md)
- [Application Scope Mapping](../../../../.kiro/steering/application-scope-mapping.md)
- [Onboarding Decision Flow](../../../../.kiro/steering/onboarding-decision-flow.md)
