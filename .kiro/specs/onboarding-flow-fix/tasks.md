# Implementation Plan: Onboarding Flow Fix

## Overview

This implementation plan fixes the critical onboarding flow issue where new venues can bypass mandatory venue mode selection. The approach involves fixing the onboarding trigger logic, implementing proper state management, and ensuring robust validation throughout the configuration process.

## Tasks

- [x] 1. Fix core onboarding trigger logic
  - [x] 1.1 Identify and fix the flawed onboarding condition in settings page
    - Remove the `!isNewUser` condition that prevents new venues from seeing the modal
    - Separate restaurant info completion from venue mode onboarding concerns
    - Update the trigger logic to: `if (!loading && !onboardingCompleted)`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Write property test for forced onboarding modal display

    - **Property 1: Forced Onboarding Modal Display**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. Enhance VenueModeOnboarding component for forced mode
  - [x] 2.1 Add forced mode support to VenueModeOnboarding component
    - Add `isForced` prop to disable cancel/close functionality
    - Remove X button and prevent ESC key dismissal in forced mode
    - Add visual indicators for required vs optional completion
    - _Requirements: 1.3, 1.4_

  - [x] 2.2 Implement progress persistence across page reloads
    - Store partial onboarding progress in localStorage
    - Restore progress when component remounts
    - Clear stored progress on successful completion
    - _Requirements: 6.2_

  - [ ]* 2.3 Write property test for onboarding completion state transition
    - **Property 2: Onboarding Completion State Transition**
    - **Validates: Requirements 1.5, 7.3**

- [x] 3. Implement existing venue migration logic
  - [x] 3.1 Create database migration script for existing venues
    - Update venues without venue_mode to set default configuration
    - Set venue_mode='venue', authority_mode='tabeza', onboarding_completed=true
    - Add proper error handling and rollback capabilities
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Add migration check to settings page load
    - Detect venues that need migration on settings page access
    - Apply migration automatically for qualifying venues
    - Log migration events for audit purposes
    - _Requirements: 2.4, 2.5_

  - [ ]* 3.3 Write property test for existing venue migration
    - **Property 3: Existing Venue Migration**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 4. Checkpoint - Ensure core onboarding logic works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement configuration validation and rules
  - [x] 5.1 Add Core Truth constraint validation
    - Implement validation functions for venue mode combinations
    - Ensure Basic mode always sets POS authority and printer requirement
    - Ensure Venue mode sets correct POS integration flags
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 5.2 Add configuration validation UI feedback
    - Show inline validation errors for invalid combinations
    - Provide clear explanations for why configurations are invalid
    - Suggest corrections for common configuration mistakes
    - _Requirements: 3.4, 6.3_

  - [ ]* 5.3 Write property test for configuration rule enforcement
    - **Property 4: Configuration Rule Enforcement**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 5.4 Write property test for configuration validation
    - **Property 5: Configuration Validation**
    - **Validates: Requirements 3.4, 3.5, 6.3**

- [x] 6. Enhance settings page integration
  - [x] 6.1 Add venue mode configuration display section
    - Show current venue mode and authority configuration
    - Display configuration description and workflow explanation
    - Add "Change Configuration" button for completed venues
    - _Requirements: 4.1, 4.2_

  - [x] 6.2 Implement configuration change validation
    - Validate configuration changes against existing data
    - Require confirmation for potentially destructive changes (Venue→Basic)
    - Update timestamps when configuration changes are made
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ]* 6.3 Write property test for settings access control
    - **Property 6: Settings Access Control**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 6.4 Write property test for configuration change validation
    - **Property 7: Configuration Change Validation**
    - **Validates: Requirements 4.3, 4.4, 4.5, 7.1, 7.2**

- [x] 7. Implement UI theming and visual consistency
  - [x] 7.1 Add theme switching based on venue configuration
    - Implement blue theme for Basic mode with printer-focused icons
    - Implement yellow theme for Venue+POS mode with hybrid icons
    - Implement green theme for Venue+Tabeza mode with full-service icons
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.2 Add configuration summary and feature explanations
    - Show enabled/disabled features clearly in configuration summary
    - Explain workflow limitations based on current configuration
    - Provide helpful tooltips and guidance text
    - _Requirements: 5.4, 5.5_

  - [ ]* 7.3 Write property test for UI theming consistency
    - **Property 8: UI Theming Consistency**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 7.4 Write property test for configuration display clarity
    - **Property 9: Configuration Display Clarity**
    - **Validates: Requirements 5.4, 5.5**

- [x] 8. Checkpoint - Ensure UI and validation works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement comprehensive error handling
  - [x] 9.1 Add database error handling for onboarding operations
    - Implement retry logic with exponential backoff
    - Show user-friendly error messages for database failures
    - Log detailed error information for debugging
    - _Requirements: 6.1, 6.4_

  - [x] 9.2 Add network error handling and offline support
    - Detect network status changes during onboarding
    - Queue configuration changes for retry when connection restored
    - Preserve form state and progress during network interruptions
    - _Requirements: 6.2_

  - [x] 9.3 Add admin recovery tools for stuck onboarding states
    - Create database queries to reset onboarding state
    - Add bulk migration script for fixing invalid configurations
    - Implement manual configuration override for emergency fixes
    - _Requirements: 6.5_

  - [ ]* 9.4 Write property test for error handling and recovery
    - **Property 10: Error Handling and Recovery**
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5**

- [ ] 10. Implement audit logging and monitoring
  - [x] 10.1 Add comprehensive audit logging for configuration events
    - Log onboarding completion events with user details
    - Log configuration changes with before/after states
    - Log validation failures with detailed error information
    - _Requirements: 7.3, 7.4_

  - [x] 10.2 Add configuration history display
    - Show timestamps for when configuration was last changed
    - Display configuration history in settings page
    - Provide audit trail for troubleshooting issues
    - _Requirements: 7.5_

  - [ ]* 10.3 Write property test for audit trail completeness
    - **Property 11: Audit Trail Completeness**
    - **Validates: Requirements 7.4, 7.5**

- [ ] 11. Integration testing and final validation
  - [x] 11.1 Create integration tests for complete onboarding workflows
    - Test new venue onboarding from start to finish
    - Test existing venue migration scenarios
    - Test configuration change workflows
    - _Requirements: All requirements_

  - [x] 11.2 Add visual regression tests for theme consistency
    - Test theme switching across all configuration combinations
    - Verify visual consistency of onboarding modal
    - Test responsive design across different screen sizes
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 11.3 Write comprehensive end-to-end property tests
    - Test complete user journeys across all venue configurations
    - Verify data integrity across all onboarding scenarios
    - Test error recovery across all failure conditions

- [-] 12. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and allow for user feedback
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests verify complete workflows and user journeys work correctly