# Design Document: Onboarding Flow Redesign

## Overview

The onboarding flow redesign transforms the current backwards flow into a progressive, user-centric experience. Instead of forcing venue mode selection in settings, the new flow starts with "What do you want?" and guides users through appropriate setup paths. The design maintains the Core Truth model (Manual service always exists, digital authority is singular) while providing immediate value and optional completion steps.

## Architecture

### Flow Architecture

The redesigned onboarding follows a decision-tree architecture with three main paths:

1. **Welcome Screen** → Mode Selection (Basic vs Venue)
2. **Basic Path** → Essential Info → Dashboard + Settings Toast
3. **Venue Path** → Essential Info → POS Decision → Dashboard + Settings Toast

### Component Architecture

```
OnboardingFlow/
├── WelcomeScreen/
│   ├── ModeSelector
│   ├── LearnMoreModal
│   └── ProgressIndicator
├── BasicSetup/
│   ├── VenueInfoForm
│   ├── MpesaSetup
│   └── PrinterSetup
├── VenueSetup/
│   ├── VenueInfoForm
│   ├── POSDecisionStep
│   └── MpesaSetup
└── CompletionFlow/
    ├── DashboardRedirect
    └── SettingsToast
```

### State Management Architecture

The onboarding state is managed through a centralized store with persistence:

```typescript
interface OnboardingState {
  currentStep: OnboardingStep;
  venueMode: 'basic' | 'venue' | null;
  authorityMode: 'pos' | 'tabeza' | null;
  venueInfo: VenueInfo;
  setupProgress: SetupProgress;
  isComplete: boolean;
}
```

## Components and Interfaces

### WelcomeScreen Component

**Purpose**: Present clear mode selection with educational content

**Interface**:
```typescript
interface WelcomeScreenProps {
  onModeSelect: (mode: 'basic' | 'venue') => void;
  onLearnMore: (mode: 'basic' | 'venue') => void;
}

interface ModeOption {
  id: 'basic' | 'venue';
  title: string;
  description: string;
  features: string[];
  icon: ReactNode;
  theme: 'blue' | 'green';
}
```

**Key Features**:
- Visual distinction between Basic (🔵 blue) and Venue (🟢 green) modes
- "Learn more" modals with detailed explanations
- Clear feature comparisons
- Progress indicator showing step 1 of 3-4

### BasicSetup Component

**Purpose**: Streamlined setup for POS + M-Pesa users

**Interface**:
```typescript
interface BasicSetupProps {
  onComplete: (config: BasicConfig) => void;
  onBack: () => void;
}

interface BasicConfig {
  venueName: string;
  location: string;
  mpesaConfig: MpesaConfig;
  printerConfig: PrinterConfig;
}
```

**Flow Steps**:
1. Venue name and location
2. M-Pesa configuration
3. Printer setup and testing
4. Automatic configuration: `venue_mode: 'basic'`, `authority_mode: 'pos'`

### VenueSetup Component

**Purpose**: Comprehensive setup with POS decision point

**Interface**:
```typescript
interface VenueSetupProps {
  onComplete: (config: VenueConfig) => void;
  onBack: () => void;
}

interface VenueConfig {
  venueName: string;
  location: string;
  hasPOS: boolean;
  mpesaConfig: MpesaConfig;
  authorityMode: 'pos' | 'tabeza';
}
```

**Flow Steps**:
1. Venue name and location
2. POS system decision ("Do you have a POS?")
3. M-Pesa configuration
4. Automatic configuration based on POS decision

### POSDecisionStep Component

**Purpose**: Determine authority mode for Venue setup

**Interface**:
```typescript
interface POSDecisionStepProps {
  onDecision: (hasPOS: boolean) => void;
  onBack: () => void;
}

interface POSOption {
  hasPOS: boolean;
  title: string;
  description: string;
  implications: string[];
  authorityMode: 'pos' | 'tabeza';
}
```

**Decision Logic**:
- **Yes, I have a POS** → `authority_mode: 'pos'`, disable staff ordering
- **No POS system** → `authority_mode: 'tabeza'`, enable full ordering

### SettingsToast Component

**Purpose**: Non-blocking encouragement for optional setup completion

**Interface**:
```typescript
interface SettingsToastProps {
  venueMode: 'basic' | 'venue';
  completionStatus: CompletionStatus;
  onDismiss: () => void;
  onNavigateToSettings: (section?: string) => void;
}

interface CompletionStatus {
  menuSetup: boolean;
  paymentMethods: boolean;
  businessHours: boolean;
  staffAccounts: boolean;
}
```

**Behavior**:
- Appears after dashboard redirect
- Shows relevant incomplete items
- Dismissible for current session
- Direct links to specific settings sections

## Data Models

### OnboardingProgress Model

```typescript
interface OnboardingProgress {
  id: string;
  barId: string;
  currentStep: OnboardingStep;
  venueMode: 'basic' | 'venue' | null;
  authorityMode: 'pos' | 'tabeza' | null;
  completedSteps: OnboardingStep[];
  venueInfo: Partial<VenueInfo>;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

enum OnboardingStep {
  WELCOME = 'welcome',
  BASIC_INFO = 'basic_info',
  POS_DECISION = 'pos_decision',
  MPESA_SETUP = 'mpesa_setup',
  PRINTER_SETUP = 'printer_setup',
  COMPLETE = 'complete'
}
```

### VenueConfiguration Model

```typescript
interface VenueConfiguration {
  venueMode: 'basic' | 'venue';
  authorityMode: 'pos' | 'tabeza';
  posIntegrationEnabled: boolean;
  printerRequired: boolean;
  customerOrderingEnabled: boolean;
  staffOrderingEnabled: boolean;
  menuManagementEnabled: boolean;
}
```

### OnboardingValidation Model

```typescript
interface OnboardingValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  requiredSteps: OnboardingStep[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

Now I need to use the prework tool to analyze the acceptance criteria before writing the Correctness Properties section.

<function_calls>
<invoke name="prework">
<parameter name="featureName">onboarding-flow-redesign

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Welcome Screen Mode Options
*For any* onboarding session, when the welcome screen is displayed, it should contain exactly two mode options: Basic and Venue, each with learn more functionality
**Validates: Requirements 1.1, 1.2**

### Property 2: Mode Selection Navigation
*For any* mode selection (Basic or Venue), selecting the mode should immediately initiate the appropriate setup flow without intermediate screens
**Validates: Requirements 1.3**

### Property 3: Basic Setup Field Restriction
*For any* Basic setup flow, the form should contain only the essential fields: venue name, location, and M-Pesa details, with no additional optional fields
**Validates: Requirements 2.1**

### Property 4: Basic Setup Auto-Configuration
*For any* completed Basic setup, the system should automatically set venue_mode to 'basic' and authority_mode to 'pos' without user intervention
**Validates: Requirements 2.2**

### Property 5: Setup Completion Navigation
*For any* completed onboarding flow (Basic or Venue), the system should redirect directly to the Dashboard without intermediate confirmation screens
**Validates: Requirements 2.3, 3.4**

### Property 6: Venue Setup POS Decision Sequence
*For any* Venue setup flow, after collecting basic information (name and location), the next step should be the POS system question
**Validates: Requirements 3.1, 3.2**

### Property 7: Authority Mode Configuration Based on POS Decision
*For any* POS decision in Venue setup, answering "Yes" should set authority_mode to 'pos' and disable staff ordering, while answering "No" should set authority_mode to 'tabeza' and enable full ordering
**Validates: Requirements 3.3, 3.5, 3.6**

### Property 8: Settings Toast Non-Blocking Behavior
*For any* dashboard access after onboarding completion, the Settings Toast should be displayed but not prevent access to any core dashboard functionality
**Validates: Requirements 4.1, 4.2**

### Property 9: Settings Toast Session Dismissal
*For any* Settings Toast dismissal, the toast should not reappear during the same browser session
**Validates: Requirements 4.3**

### Property 10: Settings Modal Elimination
*For any* settings page access, no forced modal dialogs should automatically appear
**Validates: Requirements 5.1**

### Property 11: Configuration Validation Enforcement
*For any* venue configuration, the system should enforce exactly one digital authority (either POS or Tabeza, never both or neither) and prevent invalid combinations
**Validates: Requirements 6.1, 6.5**

### Property 12: Basic Mode Constraints
*For any* venue configured in Basic mode, the system should require POS authority and printer integration while disabling customer and staff ordering features
**Validates: Requirements 2.4, 2.5, 6.2**

### Property 13: Onboarding Progress Persistence
*For any* onboarding step completion, the progress should be immediately saved and resumable if the session is interrupted
**Validates: Requirements 7.1, 7.2, 7.4**

### Property 14: Network Resilience During Onboarding
*For any* network interruption during onboarding, the system should handle the interruption gracefully and allow continuation when connectivity is restored
**Validates: Requirements 7.5**

### Property 15: Visual Feedback Consistency
*For any* user interaction during onboarding (selections, form submissions, navigation), the system should provide immediate visual feedback and maintain consistent theming based on the selected venue mode
**Validates: Requirements 8.2, 8.4**

## Error Handling

### Network Error Handling

**Connection Loss During Onboarding**:
- Implement retry mechanisms with exponential backoff
- Cache form data locally to prevent data loss
- Display clear connection status indicators
- Allow offline form completion with sync on reconnection

**API Failure Handling**:
- Graceful degradation for non-critical API calls
- Clear error messages with actionable recovery steps
- Automatic retry for transient failures
- Manual retry options for persistent failures

### Validation Error Handling

**Form Validation Errors**:
- Real-time validation with immediate feedback
- Clear field-level error messages
- Prevention of form submission with invalid data
- Contextual help for complex validation rules

**Configuration Validation Errors**:
- Pre-submission validation to prevent invalid states
- Clear explanations of configuration constraints
- Suggested corrections for invalid combinations
- Rollback mechanisms for failed configuration changes

### User Experience Error Handling

**Browser Compatibility Issues**:
- Progressive enhancement for older browsers
- Graceful fallbacks for unsupported features
- Clear messaging about browser requirements
- Alternative flows for limited functionality

**Session Management Errors**:
- Automatic session refresh for expired tokens
- Clear authentication error messages
- Seamless re-authentication flows
- Progress preservation across session boundaries

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Component rendering with specific props
- Form validation with known invalid inputs
- Navigation flows with specific user paths
- Error handling with simulated failure conditions

**Property-Based Tests**: Verify universal properties across all inputs
- Configuration validation across all possible combinations
- Form behavior with randomly generated valid/invalid data
- Navigation consistency across different user paths
- State persistence across various interruption scenarios

### Property-Based Testing Configuration

- **Testing Library**: fast-check for TypeScript/JavaScript
- **Minimum Iterations**: 100 per property test
- **Test Tagging**: Each property test references its design document property
- **Tag Format**: **Feature: onboarding-flow-redesign, Property {number}: {property_text}**

### Testing Coverage Areas

**Onboarding Flow Testing**:
- Welcome screen rendering and interaction
- Mode selection and flow initiation
- Form validation and submission
- Progress persistence and resumption
- Configuration validation and enforcement

**Integration Testing**:
- Database persistence during onboarding
- API integration for venue creation
- Settings page integration with onboarding state
- Dashboard integration with completion status

**User Experience Testing**:
- Visual consistency across different modes
- Responsive design across device sizes
- Accessibility compliance for all interactions
- Performance under various network conditions

**Error Scenario Testing**:
- Network interruption handling
- Invalid configuration prevention
- Form validation error recovery
- Session timeout and recovery