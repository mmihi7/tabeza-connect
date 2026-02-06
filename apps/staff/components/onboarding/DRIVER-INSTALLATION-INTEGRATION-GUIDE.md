# Driver Installation Guidance Integration Guide

## Overview

This guide explains how to integrate the `DriverInstallationGuidance` component into the `BasicSetup` onboarding flow for Tabeza Basic mode and Venue mode with POS authority.

## Core Principle

**CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.**

Driver installation is ONLY required when POS authority is active:
- ✅ **Basic mode** → Always requires drivers (POS authority only)
- ✅ **Venue mode + POS authority** → Requires drivers for POS integration
- ❌ **Venue mode + Tabeza authority** → No drivers needed (digital-only)

## Integration Steps

### Step 1: Import the Component

```typescript
// In BasicSetup.tsx
import DriverInstallationGuidance from './DriverInstallationGuidance';
```

### Step 2: Add Driver Installation Step

Update the `SetupStep` type to include the driver installation step:

```typescript
type SetupStep = 
  | 'venue-info' 
  | 'mpesa-config' 
  | 'driver-installation'  // NEW STEP
  | 'printer-setup' 
  | 'summary';
```

### Step 3: Add Callback Handler

Add a handler for when drivers are confirmed:

```typescript
const handleDriversConfirmed = () => {
  // Drivers confirmed, proceed to printer setup
  setCurrentStep('printer-setup');
};

const handleDriverInstallationSkip = () => {
  // Error occurred or unsupported platform, return to previous step
  setCurrentStep('mpesa-config');
};
```

### Step 4: Add Render Function

Create a render function for the driver installation step:

```typescript
const renderDriverInstallationStep = () => (
  <div className="max-w-2xl mx-auto">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Install Printer Drivers
      </h2>
      <p className="text-gray-600">
        Tabeza printer drivers are required for POS integration
      </p>
    </div>
    
    <DriverInstallationGuidance
      onDriversConfirmed={handleDriversConfirmed}
      onSkip={handleDriverInstallationSkip}
    />
  </div>
);
```

### Step 5: Update Navigation Logic

Update the `handleNext` function to include the driver installation step:

```typescript
const handleNext = () => {
  let isValid = false;
  
  switch (currentStep) {
    case 'venue-info':
      isValid = validateVenueInfo();
      if (isValid) setCurrentStep('mpesa-config');
      break;
      
    case 'mpesa-config':
      isValid = validateMpesaConfig();
      if (isValid) setCurrentStep('driver-installation'); // NEW: Go to driver installation
      break;
      
    case 'driver-installation':
      // This step is handled by the DriverInstallationGuidance component
      // It will call handleDriversConfirmed when ready
      break;
      
    case 'printer-setup':
      isValid = validatePrinterConfig();
      if (isValid) setCurrentStep('summary');
      break;
      
    case 'summary':
      handleComplete();
      break;
  }
};
```

Update the `handleBack` function:

```typescript
const handleBack = () => {
  switch (currentStep) {
    case 'venue-info':
      onBack();
      break;
      
    case 'mpesa-config':
      setCurrentStep('venue-info');
      break;
      
    case 'driver-installation':
      setCurrentStep('mpesa-config'); // NEW: Back to M-Pesa config
      break;
      
    case 'printer-setup':
      setCurrentStep('driver-installation'); // NEW: Back to driver installation
      break;
      
    case 'summary':
      setCurrentStep('printer-setup');
      break;
  }
};
```

### Step 6: Update Progress Indicator

Update the progress indicator to include the driver installation step:

```typescript
const getStepNumber = () => {
  switch (currentStep) {
    case 'venue-info': return 1;
    case 'mpesa-config': return 2;
    case 'driver-installation': return 3; // NEW
    case 'printer-setup': return 4;       // Updated from 3
    case 'summary': return 5;             // Updated from 4
    default: return 1;
  }
};

const renderProgressIndicator = () => (
  <div className="flex items-center justify-center mb-8">
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((step) => ( // Updated from [1, 2, 3, 4]
        <React.Fragment key={step}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            step <= getStepNumber() 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            {step}
          </div>
          {step < 5 && ( // Updated from step < 4
            <div className={`w-16 h-1 rounded ${
              step < getStepNumber() ? 'bg-blue-500' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  </div>
);
```

### Step 7: Add Conditional Rendering

Add the driver installation step to the render logic:

```typescript
return (
  <div className="max-w-4xl mx-auto p-6">
    {renderProgressIndicator()}
    
    {currentStep === 'venue-info' && renderVenueInfoStep()}
    {currentStep === 'mpesa-config' && renderMpesaConfigStep()}
    {currentStep === 'driver-installation' && renderDriverInstallationStep()} {/* NEW */}
    {currentStep === 'printer-setup' && renderPrinterSetupStep()}
    {currentStep === 'summary' && renderSummaryStep()}

    <div className="flex justify-between mt-8">
      <button
        onClick={handleBack}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        Back
      </button>
      
      {/* Hide Next button on driver installation step - component handles its own navigation */}
      {currentStep !== 'driver-installation' && (
        <button
          onClick={handleNext}
          disabled={isProcessing}
          className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
            isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {currentStep === 'summary' ? 'Complete Setup' : 'Continue'}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  </div>
);
```

## Complete Integration Example

Here's a complete example showing the key changes:

```typescript
// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Printer, Phone, MapPin, Store, Check, AlertCircle } from 'lucide-react';
import DriverInstallationGuidance from './DriverInstallationGuidance';

// ... existing interfaces ...

type SetupStep = 'venue-info' | 'mpesa-config' | 'driver-installation' | 'printer-setup' | 'summary';

const BasicSetup: React.FC<BasicSetupProps> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('venue-info');
  // ... existing state ...

  // NEW: Driver installation handlers
  const handleDriversConfirmed = () => {
    setCurrentStep('printer-setup');
  };

  const handleDriverInstallationSkip = () => {
    setCurrentStep('mpesa-config');
  };

  // ... existing validation functions ...

  const handleNext = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 'venue-info':
        isValid = validateVenueInfo();
        if (isValid) setCurrentStep('mpesa-config');
        break;
      case 'mpesa-config':
        isValid = validateMpesaConfig();
        if (isValid) setCurrentStep('driver-installation'); // NEW
        break;
      case 'driver-installation':
        // Handled by DriverInstallationGuidance component
        break;
      case 'printer-setup':
        isValid = validatePrinterConfig();
        if (isValid) setCurrentStep('summary');
        break;
      case 'summary':
        handleComplete();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'venue-info':
        onBack();
        break;
      case 'mpesa-config':
        setCurrentStep('venue-info');
        break;
      case 'driver-installation':
        setCurrentStep('mpesa-config'); // NEW
        break;
      case 'printer-setup':
        setCurrentStep('driver-installation'); // NEW
        break;
      case 'summary':
        setCurrentStep('printer-setup');
        break;
    }
  };

  // ... existing render functions ...

  // NEW: Driver installation step
  const renderDriverInstallationStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Install Printer Drivers
        </h2>
        <p className="text-gray-600">
          Tabeza printer drivers are required for POS integration
        </p>
      </div>
      
      <DriverInstallationGuidance
        onDriversConfirmed={handleDriversConfirmed}
        onSkip={handleDriverInstallationSkip}
      />
    </div>
  );

  const getStepNumber = () => {
    switch (currentStep) {
      case 'venue-info': return 1;
      case 'mpesa-config': return 2;
      case 'driver-installation': return 3; // NEW
      case 'printer-setup': return 4;
      case 'summary': return 5;
      default: return 1;
    }
  };

  const renderProgressIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((step) => ( // Updated
          <React.Fragment key={step}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step <= getStepNumber() 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step}
            </div>
            {step < 5 && (
              <div className={`w-16 h-1 rounded ${
                step < getStepNumber() ? 'bg-blue-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {renderProgressIndicator()}
      
      {currentStep === 'venue-info' && renderVenueInfoStep()}
      {currentStep === 'mpesa-config' && renderMpesaConfigStep()}
      {currentStep === 'driver-installation' && renderDriverInstallationStep()} {/* NEW */}
      {currentStep === 'printer-setup' && renderPrinterSetupStep()}
      {currentStep === 'summary' && renderSummaryStep()}

      <div className="flex justify-between mt-8">
        <button
          onClick={handleBack}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        
        {currentStep !== 'driver-installation' && (
          <button
            onClick={handleNext}
            disabled={isProcessing}
            className={`px-6 py-3 rounded-lg transition flex items-center gap-2 ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {currentStep === 'summary' ? 'Complete Setup' : 'Continue'}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default BasicSetup;
```

## Authority-Based Conditional Rendering (Future Enhancement)

For Venue mode, you may want to conditionally show the driver installation step based on authority mode:

```typescript
interface BasicSetupProps {
  onComplete: (config: BasicSetupConfig) => void;
  onBack: () => void;
  venueMode: 'basic' | 'venue';
  authorityMode?: 'pos' | 'tabeza'; // Only for venue mode
}

const BasicSetup: React.FC<BasicSetupProps> = ({ 
  onComplete, 
  onBack, 
  venueMode,
  authorityMode 
}) => {
  // Determine if driver installation is required
  const requiresDriverInstallation = 
    venueMode === 'basic' || 
    (venueMode === 'venue' && authorityMode === 'pos');

  const handleNext = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 'venue-info':
        isValid = validateVenueInfo();
        if (isValid) setCurrentStep('mpesa-config');
        break;
        
      case 'mpesa-config':
        isValid = validateMpesaConfig();
        if (isValid) {
          // Skip driver installation if not required
          if (requiresDriverInstallation) {
            setCurrentStep('driver-installation');
          } else {
            setCurrentStep('printer-setup');
          }
        }
        break;
        
      // ... rest of the logic
    }
  };

  // Only render driver installation step if required
  {requiresDriverInstallation && currentStep === 'driver-installation' && renderDriverInstallationStep()}
};
```

## Testing the Integration

### Manual Testing Checklist

1. **Basic Mode Flow:**
   - [ ] Start Basic mode onboarding
   - [ ] Complete venue info step
   - [ ] Complete M-Pesa config step
   - [ ] Driver installation step appears
   - [ ] Platform is detected correctly
   - [ ] Download button works
   - [ ] Installation instructions appear
   - [ ] Confirmation button works
   - [ ] Verification steps appear
   - [ ] Continue button proceeds to printer setup
   - [ ] Back button returns to M-Pesa config

2. **Unsupported Platform:**
   - [ ] Test on Linux/mobile device
   - [ ] Error message displays
   - [ ] Return to Setup button works
   - [ ] Returns to M-Pesa config step

3. **Troubleshooting:**
   - [ ] Troubleshooting section toggles
   - [ ] Platform-specific steps display
   - [ ] Help section shows support email

### Automated Testing

Run the test suite:

```bash
# Run all onboarding tests
cd apps/staff && npm test -- onboarding

# Run specific driver installation tests
cd apps/staff && npm test -- DriverInstallationGuidance.test.tsx

# Run with coverage
cd apps/staff && npm test -- --coverage DriverInstallationGuidance.test.tsx
```

## Troubleshooting

### Issue: Component not rendering

**Solution:** Ensure the import path is correct and the component is exported:

```typescript
// DriverInstallationGuidance.tsx
export default DriverInstallationGuidance;

// BasicSetup.tsx
import DriverInstallationGuidance from './DriverInstallationGuidance';
```

### Issue: Shared package types not found

**Solution:** Ensure the shared package is properly linked:

```bash
# From workspace root
pnpm install

# Verify shared package is linked
cd apps/staff && ls -la node_modules/@tabeza/shared
```

### Issue: Tests failing with module not found

**Solution:** Check jest.config.js has correct module mappings:

```javascript
moduleNameMapper: {
  '^@tabeza/shared$': '<rootDir>/../../packages/shared',
  '^@tabeza/shared/(.*)$': '<rootDir>/../../packages/shared/$1',
}
```

## Next Steps

1. **Integrate into BasicSetup.tsx** - Apply the changes shown in this guide
2. **Test the integration** - Follow the manual testing checklist
3. **Update VenueSetup.tsx** - Add similar integration for Venue mode with POS authority
4. **Add property tests** - Implement property-based tests for the integration (Task 2.3)

## Support

For questions or issues:
- Email: support@tabeza.co.ke
- Documentation: See TASK-2.2-IMPLEMENTATION-SUMMARY.md
- Tests: See `__tests__/DriverInstallationGuidance.test.tsx`

