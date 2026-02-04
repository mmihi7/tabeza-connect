# Design Document

## Overview

This design addresses the critical onboarding flow issue where new venues can bypass mandatory venue mode selection. The current implementation has a logical flaw in the onboarding trigger condition that prevents new venues from seeing the required configuration modal.

The solution involves fixing the onboarding trigger logic, implementing proper state management for new vs existing venues, and ensuring robust validation throughout the configuration process.

## Architecture

### Current State Analysis

The existing implementation has these components:
- `VenueModeOnboarding` component with 3-step flow (mode → authority → summary)
- Settings page with venue mode state management
- Database schema with venue mode columns and constraints
- Onboarding trigger logic with a critical flaw

### Root Cause Identification

The current onboarding trigger condition is:
```typescript
if (!loading && !onboardingCompleted && !isNewUser) {
  setShowVenueModeModal(true);
}
```

This condition is logically flawed because:
1. `!isNewUser` prevents the modal from showing for new users
2. `isNewUser` is set based on incomplete restaurant info, not onboarding status
3. The condition conflates "new user setup" with "venue mode onboarding"

### Proposed Architecture

The solution separates concerns:
1. **Restaurant Information Setup**: Basic venue details (name, location, etc.)
2. **Venue Mode Onboarding**: Authority and operational configuration
3. **Settings Access Control**: Proper gating based on completion status

## Components and Interfaces

### Core Components

#### 1. OnboardingGate Component
```typescript
interface OnboardingGateProps {
  children: React.ReactNode;
  onboardingCompleted: boolean;
  onComplete: (config: VenueConfiguration) => void;
}
```

Responsibilities:
- Wraps settings content and controls access
- Shows forced modal when onboarding incomplete
- Prevents dismissal until completion
- Handles loading and error states

#### 2. Enhanced VenueModeOnboarding Component
```typescript
interface VenueModeOnboardingProps {
  onComplete: (config: VenueConfiguration) => void;
  onCancel?: () => void; // Optional for forced mode
  isForced?: boolean; // Indicates non-dismissible mode
  existingConfig?: Partial<VenueConfiguration>; // For editing
}
```

Enhancements:
- Support for forced (non-dismissible) mode
- Better error handling and validation
- Progress persistence across page reloads
- Clear visual indicators for required vs optional fields

#### 3. Settings Page State Management

```typescript
interface SettingsState {
  // Venue configuration
  venueMode: 'basic' | 'venue';
  authorityMode: 'pos' | 'tabeza';
  posIntegrationEnabled: boolean;
  printerRequired: boolean;
  onboardingCompleted: boolean;
  
  // UI state
  loading: boolean;
  showOnboardingModal: boolean;
  isEditingConfig: boolean;
  
  // Restaurant info (separate concern)
  restaurantInfoComplete: boolean;
  editMode: boolean;
}
```

### Data Models

#### VenueConfiguration Interface
```typescript
interface VenueConfiguration {
  venue_mode: 'basic' | 'venue';
  authority_mode: 'pos' | 'tabeza';
  pos_integration_enabled: boolean;
  printer_required: boolean;
  onboarding_completed: boolean;
  authority_configured_at: string;
  mode_last_changed_at: string;
}
```

#### Database Schema Updates
The existing schema is correct, but we need to ensure proper default values:
```sql
-- Ensure new venues require onboarding
ALTER TABLE bars ALTER COLUMN onboarding_completed SET DEFAULT false;

-- Add index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_bars_onboarding_incomplete 
ON bars(onboarding_completed) WHERE onboarding_completed = false;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated to eliminate redundancy:

- Properties 2.2, 2.3, and 2.4 all relate to migration behavior and can be combined into a comprehensive migration property
- Properties 3.1, 3.2, and 3.3 all test configuration rules and can be combined into a single configuration validation property
- Properties 5.1, 5.2, and 5.3 all test UI theming and can be combined into a single theming property
- Properties 7.1 and 7.2 both test timestamp updates and can be combined

### Core Properties

**Property 1: Forced Onboarding Modal Display**
*For any* venue with onboarding_completed=false, accessing the settings page should immediately display a non-dismissible onboarding modal that blocks all other settings access
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

**Property 2: Onboarding Completion State Transition**
*For any* venue completing the onboarding flow, the system should update onboarding_completed=true, record timestamps, and enable normal settings access
**Validates: Requirements 1.5, 7.3**

**Property 3: Existing Venue Migration**
*For any* existing venue without venue mode configuration, the system should set venue_mode='venue', authority_mode='tabeza', pos_integration_enabled=false, printer_required=false, and onboarding_completed=true
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

**Property 4: Configuration Rule Enforcement**
*For any* venue mode selection, the system should automatically set the correct dependent fields: Basic mode sets authority_mode='pos' and printer_required=true; Venue+POS sets pos_integration_enabled=true; Venue+Tabeza sets pos_integration_enabled=false
**Validates: Requirements 3.1, 3.2, 3.3**

**Property 5: Configuration Validation**
*For any* configuration save attempt, the system should validate against Core Truth constraints and reject invalid combinations with clear error messages
**Validates: Requirements 3.4, 3.5, 6.3**

**Property 6: Settings Access Control**
*For any* completed venue, the settings page should display current configuration and allow modification through the venue mode modal
**Validates: Requirements 4.1, 4.2**

**Property 7: Configuration Change Validation**
*For any* configuration change, the system should validate against existing data, require confirmation for destructive changes, and update timestamps
**Validates: Requirements 4.3, 4.4, 4.5, 7.1, 7.2**

**Property 8: UI Theming Consistency**
*For any* venue configuration, the system should display the correct theme: Basic mode shows blue theme with printer icons, Venue+POS shows yellow theme with hybrid icons, Venue+Tabeza shows green theme with full-service icons
**Validates: Requirements 5.1, 5.2, 5.3**

**Property 9: Configuration Display Clarity**
*For any* venue configuration, the system should clearly show enabled/disabled features and explain workflow limitations to users
**Validates: Requirements 5.4, 5.5**

**Property 10: Error Handling and Recovery**
*For any* error during onboarding (database, network, validation), the system should display clear error messages, preserve progress where possible, log detailed information, and provide recovery mechanisms
**Validates: Requirements 6.1, 6.2, 6.4, 6.5**

**Property 11: Audit Trail Completeness**
*For any* configuration event (creation, modification, validation failure), the system should record appropriate timestamps and log entries with sufficient detail for debugging
**Validates: Requirements 7.4, 7.5**

<function_calls>
<invoke name="prework">
<parameter name="featureName">onboarding-flow-fix

## Error Handling

### Onboarding Flow Errors

**Database Connection Failures**
- Display user-friendly error message
- Provide retry mechanism with exponential backoff
- Log detailed error information for debugging
- Preserve partial progress in local storage

**Validation Errors**
- Show inline validation messages for each field
- Highlight invalid configurations with clear explanations
- Provide suggestions for fixing invalid combinations
- Prevent form submission until all issues resolved

**Network Interruptions**
- Detect network status changes
- Queue configuration changes for retry when connection restored
- Show offline indicator and explain current state
- Preserve form state across page reloads

### Settings Page Errors

**Configuration Load Failures**
- Show loading skeleton while retrying
- Fall back to cached configuration if available
- Display error state with manual refresh option
- Log errors for monitoring and debugging

**Save Operation Failures**
- Show specific error messages for different failure types
- Provide retry mechanism with user confirmation
- Prevent data loss by preserving unsaved changes
- Roll back UI state if save fails

### Recovery Mechanisms

**Admin Recovery Tools**
- Database query to reset onboarding state
- Bulk migration script for fixing invalid configurations
- Audit log analysis for troubleshooting issues
- Manual configuration override for emergency fixes

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific onboarding flow scenarios (new venue, existing venue, error cases)
- UI component behavior (modal display, form validation, theme switching)
- Database operations (migration scripts, configuration saves)
- Error handling edge cases (network failures, invalid data)

**Property-Based Tests** focus on:
- Universal properties across all venue configurations
- Configuration validation rules across all possible inputs
- State transitions and data integrity across random scenarios
- UI consistency across different configuration combinations

### Property-Based Testing Configuration

Using **fast-check** library for TypeScript property-based testing:
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: onboarding-flow-fix, Property {number}: {property_text}**

### Test Categories

**Onboarding Flow Tests**
- Property tests for forced modal behavior across all incomplete venues
- Unit tests for specific user interaction scenarios
- Integration tests for complete onboarding workflows

**Configuration Validation Tests**
- Property tests for Core Truth constraint enforcement
- Unit tests for specific invalid configuration scenarios
- Integration tests for configuration change workflows

**UI Consistency Tests**
- Property tests for theming rules across all configurations
- Unit tests for specific component rendering scenarios
- Visual regression tests for theme consistency

**Error Handling Tests**
- Property tests for error recovery across all failure scenarios
- Unit tests for specific error conditions
- Integration tests for end-to-end error workflows

**Migration Tests**
- Property tests for existing venue migration across all data states
- Unit tests for specific migration scenarios
- Integration tests for complete migration workflows

### Testing Implementation Notes

Each correctness property must be implemented as a single property-based test that validates the universal behavior across all valid inputs. Unit tests complement these by testing specific examples, edge cases, and error conditions that property tests might not easily generate.

The combination ensures both broad coverage (property tests) and specific scenario validation (unit tests), providing confidence that the onboarding flow works correctly across all possible venue configurations and user interactions.