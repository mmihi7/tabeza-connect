# Implementation Plan: Onboarding Flow Redesign

## Overview

This implementation transforms the current backwards onboarding flow into a progressive, user-centric experience. The new flow starts with clear mode selection (Basic vs Venue) and guides users through appropriate setup paths, eliminating forced modals and providing immediate dashboard access with optional completion steps.

## Tasks

- [x] 1. Create new onboarding flow components and routing
  - [x] 1.1 Create WelcomeScreen component with mode selection
    - Implement Basic vs Venue mode selection with visual distinction
    - Add "learn more" modals for each option with detailed explanations
    - Include progress indicators and consistent theming
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  
  - [x] 1.2 Write property test for WelcomeScreen mode options
    - **Property 1: Welcome Screen Mode Options**
    - **Validates: Requirements 1.1, 1.2**
  
  - [x] 1.3 Create BasicSetup component with streamlined flow
    - Implement venue info form (name, location only)
    - Add M-Pesa configuration step
    - Add printer setup and testing step with Tabeza driver installation (from tabeza.co.ke)
    - Auto-configure venue_mode='basic' and authority_mode='pos'
    - Validate printer driver installation before completion
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 1.4 Write property test for BasicSetup field restriction
    - **Property 3: Basic Setup Field Restriction**
    - **Validates: Requirements 2.1**
  
  - [x] 1.5 Create VenueSetup component with POS decision flow
    - Implement venue info form (name, location)
    - Add POS decision step ("Do you have a POS system?")
    - Add M-Pesa configuration step
    - Configure authority_mode based on POS decision
    - Add conditional printer driver installation step (required if POS selected)
    - Include printer driver download link (tabeza.co.ke) for POS integration
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_
  
  - [x] 1.6 Write property test for Venue setup POS decision sequence
    - **Property 6: Venue Setup POS Decision Sequence**
    - **Validates: Requirements 3.1, 3.2**

- [-] 2. Implement onboarding state management and persistence
  - [-] 2.1 Create OnboardingState management with TypeScript interfaces
    - Define OnboardingProgress, VenueConfiguration, and OnboardingValidation models
    - Implement state persistence to localStorage and database
    - Add progress tracking and step validation
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [ ] 2.2 Write property test for onboarding progress persistence
    - **Property 13: Onboarding Progress Persistence**
    - **Validates: Requirements 7.1, 7.2, 7.4**
  
  - [ ] 2.3 Implement configuration validation service
    - Add validation for venue_mode and authority_mode combinations
    - Prevent invalid configurations (Basic mode must have POS authority)
    - Implement constraint enforcement (exactly one digital authority)
    - Add printer driver validation for POS authority modes
    - Validate printer_required field consistency with venue/authority modes
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [ ] 2.4 Write property test for configuration validation enforcement
    - **Property 11: Configuration Validation Enforcement**
    - **Validates: Requirements 6.1, 6.5**

- [ ] 3. Checkpoint - Ensure core onboarding components work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement navigation and completion flow
  - [ ] 4.1 Create onboarding routing and navigation logic
    - Implement mode selection navigation (Basic/Venue paths)
    - Add automatic dashboard redirect after completion
    - Handle back navigation and flow resumption
    - _Requirements: 1.3, 2.3, 3.4_
  
  - [ ] 4.2 Write property test for mode selection navigation
    - **Property 2: Mode Selection Navigation**
    - **Validates: Requirements 1.3**
  
  - [ ] 4.3 Create SettingsToast component for optional completion
    - Implement non-blocking toast notification
    - Add session-based dismissal functionality
    - Include direct links to relevant settings sections
    - Show completion status for different setup areas
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 4.4 Write property test for Settings Toast non-blocking behavior
    - **Property 8: Settings Toast Non-Blocking Behavior**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 5. Update settings page to remove forced modals
  - [ ] 5.1 Remove forced modal dialogs from settings page
    - Eliminate VenueModeOnboarding modal from settings
    - Maintain venue mode and authority mode display
    - Add warnings for venue mode changes
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [ ] 5.2 Write property test for settings modal elimination
    - **Property 10: Settings Modal Elimination**
    - **Validates: Requirements 5.1**
  
  - [ ] 5.3 Implement settings form validation
    - Add validation before saving authority settings
    - Prevent invalid configuration combinations
    - Display clear error messages with recovery suggestions
    - Add printer driver requirement warnings for POS authority changes
    - Include tabeza.co.ke driver download links in error messages
    - _Requirements: 5.3, 5.5_

- [ ] 6. Implement network resilience and error handling
  - [ ] 6.1 Add network error handling during onboarding
    - Implement retry mechanisms with exponential backoff
    - Cache form data locally to prevent data loss
    - Display connection status indicators
    - Handle API failures gracefully
    - _Requirements: 7.5_
  
  - [ ] 6.2 Write property test for network resilience
    - **Property 14: Network Resilience During Onboarding**
    - **Validates: Requirements 7.5**
  
  - [ ] 6.3 Implement comprehensive error handling
    - Add form validation with real-time feedback
    - Handle browser compatibility issues
    - Implement session management error recovery
    - Add contextual help throughout the flow
    - _Requirements: 8.3, 8.5_

- [ ] 7. Implement visual feedback and theming
  - [ ] 7.1 Add visual feedback and progress indicators
    - Implement immediate visual feedback for user interactions
    - Add progress indicators throughout onboarding flow
    - Apply consistent theming based on venue mode selection
    - Add loading states and transition animations
    - _Requirements: 8.1, 8.2, 8.4_
  
  - [ ] 7.2 Write property test for visual feedback consistency
    - **Property 15: Visual Feedback Consistency**
    - **Validates: Requirements 8.2, 8.4**
  
  - [ ] 7.3 Implement mode-specific theming
    - Apply Basic mode blue theme (🔵) with printer-focused icons
    - Apply Venue mode green theme (🟢) with full-service icons
    - Apply Venue+POS yellow theme (🟡) with hybrid workflow icons
    - Ensure consistent visual indicators throughout flow

- [ ] 8. Integration and API updates
  - [ ] 8.1 Update venue creation API endpoints
    - Modify venue creation to handle new onboarding flow
    - Add support for venue_mode and authority_mode configuration
    - Implement automatic feature enabling/disabling based on mode
    - Add printer_required field handling and validation
    - Update database schema if needed (venue_mode, authority_mode, printer_required)
    - _Requirements: 2.2, 2.5, 3.5, 3.6_
  
  - [ ] 8.2 Write property test for Basic setup auto-configuration
    - **Property 4: Basic Setup Auto-Configuration**
    - **Validates: Requirements 2.2**
  
  - [ ] 8.3 Update dashboard integration
    - Ensure dashboard works with new onboarding completion flow
    - Integrate SettingsToast display after onboarding
    - Update dashboard to respect venue mode constraints
    - _Requirements: 2.5, 6.3, 6.4_
  
  - [ ] 8.4 Write property test for authority mode configuration
    - **Property 7: Authority Mode Configuration Based on POS Decision**
    - **Validates: Requirements 3.3, 3.5, 3.6**
  
  - [ ] 8.5 Implement printer driver integration components
    - Create PrinterDriverSetup component for driver installation guidance
    - Add driver download links and installation instructions (tabeza.co.ke)
    - Implement printer connectivity testing functionality
    - Add printer driver validation before POS authority activation
    - Create printer status indicators and troubleshooting guides
    - _Requirements: 2.4, 3.5_
  
  - [ ] 8.6 Write property test for printer driver validation
    - **Property 16: Printer Driver Validation for POS Authority**
    - **Validates: Requirements 2.4, 3.5**

- [ ] 9. Final checkpoint and integration testing
  - [ ] 9.1 Ensure all onboarding flows work end-to-end
    - Test Basic setup flow from welcome to dashboard (including printer driver validation)
    - Test Venue setup flow with both POS options (with and without printer drivers)
    - Verify settings integration without forced modals
    - Test network interruption and recovery scenarios
    - Validate printer driver requirement enforcement
  
  - [ ] 9.2 Write integration tests for complete onboarding flows
    - Test Basic setup complete flow
    - Test Venue setup with POS flow
    - Test Venue setup without POS flow
    - Test settings toast integration
  
  - [ ] 9.3 Final checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains the Core Truth model: Manual service always exists, digital authority is singular
- All components should include TypeScript interfaces and proper error handling
- Visual theming should be consistent with the venue mode selection throughout the flow
- Printer driver integration is mandatory for POS authority modes (Basic and Venue+POS)
- Tabeza printer drivers must be downloaded from tabeza.co.ke before POS integration can be activated
- All POS-related onboarding steps must validate printer driver installation and connectivity