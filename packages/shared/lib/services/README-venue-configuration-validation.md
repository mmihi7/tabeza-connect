# Venue Configuration Validation Service

## Overview

This service implements Core Truth constraint validation for venue mode combinations as defined in the onboarding-flow-fix specification. It ensures that all venue configurations conform to the fundamental operating law of Tabeza.

## Core Truth Constraints

**CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.**

### Constraint Rules

1. **Basic mode MUST use POS authority with printer required**
2. **Venue mode MUST use exactly one digital authority (POS OR Tabeza)**
3. **Manual ordering always coexists (implicit, not validated here)**

## Configuration Matrix

| Venue Mode | Authority Mode | POS Integration | Staff Ordering | Customer Ordering | Printer Required |
|------------|----------------|-----------------|----------------|-------------------|------------------|
| Basic      | POS            | ✅ Required     | ❌ Disabled    | ❌ Disabled       | ✅ Required      |
| Venue      | POS            | ✅ Enabled      | ❌ Disabled    | 📝 Requests Only  | ⚠️ Optional      |
| Venue      | Tabeza         | ❌ Disabled     | ✅ Enabled     | ✅ Full Orders    | ❌ Not Used      |

## API Reference

### Core Functions

#### `validateVenueConfiguration(input: VenueConfigurationInput): ValidationResult`

Validates a venue configuration against Core Truth constraints.

```typescript
const result = validateVenueConfiguration({
  venue_mode: 'basic',
  authority_mode: 'pos'
});

if (result.isValid) {
  console.log('Configuration is valid:', result.correctedConfig);
} else {
  console.log('Validation errors:', result.errors);
}
```

#### `generateCorrectedConfiguration(input: VenueConfigurationInput): VenueConfiguration`

Generates a corrected configuration with proper Core Truth defaults applied.

```typescript
const config = generateCorrectedConfiguration({
  venue_mode: 'venue',
  authority_mode: 'tabeza'
});
// Returns: { venue_mode: 'venue', authority_mode: 'tabeza', pos_integration_enabled: false, printer_required: false, ... }
```

#### `validateConfigurationChange(current: VenueConfiguration, newConfig: VenueConfigurationInput): ValidationResult`

Validates configuration changes and checks for potentially destructive operations.

```typescript
const result = validateConfigurationChange(currentConfig, {
  venue_mode: 'basic',
  authority_mode: 'pos'
});

if (result.warnings.length > 0) {
  console.log('Configuration change warnings:', result.warnings);
}
```

### Utility Functions

#### `isValidCoreConfiguration(config: VenueConfiguration): boolean`

Checks if a configuration is valid for the Core Truth model.

#### `getConfigurationDescription(config: VenueConfiguration): string`

Returns a human-readable description of the configuration.

#### `getThemeConfiguration(config: VenueConfiguration)`

Returns theme configuration for UI display:
- **Basic Mode**: Blue theme with printer-focused icons
- **Venue Mode + POS**: Yellow theme with hybrid workflow icons  
- **Venue Mode + Tabeza**: Green theme with full-service icons

#### `getDefaultMigrationConfiguration(): VenueConfiguration`

Returns the default configuration for migrating existing venues (Venue + Tabeza).

## Usage Examples

### Client-Side Validation (React Hook)

```typescript
import { useVenueConfigurationValidation } from '@/hooks/useVenueConfigurationValidation';

function OnboardingComponent() {
  const { validateConfiguration, getTheme } = useVenueConfigurationValidation();
  
  const handleModeSelection = (mode: 'basic' | 'venue') => {
    const result = validateConfiguration({
      venue_mode: mode,
      authority_mode: mode === 'basic' ? 'pos' : undefined
    });
    
    if (result.isValid) {
      const theme = getTheme(result.correctedConfig!);
      // Apply theme to UI
    }
  };
}
```

### Server-Side Validation (API Route)

```typescript
import { validateVenueConfiguration } from '@tabeza/shared';

export async function POST(request: NextRequest) {
  const { configuration } = await request.json();
  
  const result = validateVenueConfiguration(configuration);
  
  if (!result.isValid) {
    return NextResponse.json({
      success: false,
      errors: result.errors
    }, { status: 400 });
  }
  
  // Save the corrected configuration
  await saveConfiguration(result.correctedConfig);
}
```

### Migration Script

```typescript
import { getDefaultMigrationConfiguration, isValidCoreConfiguration } from '@tabeza/shared';

async function migrateExistingVenues() {
  const defaultConfig = getDefaultMigrationConfiguration();
  
  // Verify the default configuration is valid
  if (!isValidCoreConfiguration(defaultConfig)) {
    throw new Error('Default migration configuration is invalid');
  }
  
  // Apply to existing venues
  await updateVenues(defaultConfig);
}
```

## Integration Points

### VenueModeOnboarding Component

The onboarding component uses these validation functions to:
- Validate mode selections in real-time
- Display validation errors and warnings
- Generate corrected configurations
- Prevent completion with invalid configurations

### Settings Page

The settings page uses validation to:
- Prevent invalid configuration changes
- Show warnings for destructive changes
- Validate existing configurations on load

### Migration API

The venue migration API uses validation to:
- Ensure default configurations are valid
- Validate existing venues before migration
- Generate audit logs with validated configurations

## Error Handling

All validation functions return structured results with:
- `isValid`: Boolean indicating validation success
- `errors`: Array of validation error messages
- `warnings`: Array of warning messages for potentially destructive changes
- `correctedConfig`: Valid configuration with Core Truth rules applied (if validation passes)

## Testing

The service includes comprehensive unit tests covering:
- All valid configuration combinations
- All invalid configuration combinations
- Configuration change scenarios
- Edge cases and error conditions

Run tests with:
```bash
cd packages/shared && pnpm test venue-configuration-validation.test.ts
```