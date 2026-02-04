# Requirements Document

## Introduction

This specification addresses the critical onboarding flow issue in the Tabeza restaurant management system where new venues can bypass the mandatory venue mode selection process. The system currently allows new bars to access settings without completing the essential venue mode onboarding that determines their operational configuration (Basic vs Venue, POS vs Tabeza authority).

## Glossary

- **Venue_Mode**: Application scope configuration - 'basic' (POS bridge) or 'venue' (full service)
- **Authority_Mode**: Digital order authority - 'pos' (external POS system) or 'tabeza' (internal system)
- **Onboarding_Completed**: Boolean flag indicating venue has completed mode selection
- **New_Venue**: A bar record without completed onboarding configuration
- **Existing_Venue**: A bar record with completed onboarding configuration
- **Settings_Page**: Staff interface for managing venue configuration
- **VenueModeOnboarding_Component**: React component handling the 3-step onboarding flow
- **Forced_Modal**: Non-dismissible modal that blocks access until completion

## Requirements

### Requirement 1: Mandatory Onboarding Enforcement

**User Story:** As a new restaurant owner, I must complete venue mode selection during initial setup, so that my staff understand the correct workflow and customers receive the right experience.

#### Acceptance Criteria

1. WHEN a new venue accesses the settings page THEN the system SHALL display a forced onboarding modal immediately
2. WHEN the onboarding modal is displayed THEN the system SHALL prevent access to all settings until completion
3. WHEN a user attempts to close the onboarding modal THEN the system SHALL prevent dismissal without completion
4. WHEN onboarding is incomplete THEN the system SHALL block navigation to other settings sections
5. WHEN onboarding is completed THEN the system SHALL update the onboarding_completed flag and allow normal access

### Requirement 2: Existing Venue Migration

**User Story:** As an existing restaurant owner, I want my venue automatically configured with default settings, so that I can continue operating without interruption.

#### Acceptance Criteria

1. WHEN the system detects an existing venue without venue mode configuration THEN the system SHALL set venue_mode='venue' and authority_mode='tabeza'
2. WHEN migrating existing venues THEN the system SHALL set onboarding_completed=true
3. WHEN migrating existing venues THEN the system SHALL set pos_integration_enabled=false and printer_required=false
4. WHEN migration is complete THEN the system SHALL allow normal settings access
5. WHEN existing venues access settings THEN the system SHALL display their current configuration

### Requirement 3: Onboarding Flow Validation

**User Story:** As a system administrator, I want the onboarding flow to enforce valid configurations, so that venues cannot enter invalid operational states.

#### Acceptance Criteria

1. WHEN Basic mode is selected THEN the system SHALL automatically set authority_mode='pos' and printer_required=true
2. WHEN Venue mode with POS authority is selected THEN the system SHALL set pos_integration_enabled=true
3. WHEN Venue mode with Tabeza authority is selected THEN the system SHALL set pos_integration_enabled=false
4. WHEN invalid configurations are attempted THEN the system SHALL prevent saving and display error messages
5. WHEN configuration is saved THEN the system SHALL validate against Core Truth constraints

### Requirement 4: Settings Page Integration

**User Story:** As a restaurant owner, I want to modify my venue configuration after initial setup, so that I can adapt to changing business needs.

#### Acceptance Criteria

1. WHEN a completed venue accesses settings THEN the system SHALL display current venue mode configuration
2. WHEN a user clicks "Change Configuration" THEN the system SHALL display the venue mode modal
3. WHEN configuration changes are made THEN the system SHALL validate against existing data
4. WHEN switching from Venue to Basic mode THEN the system SHALL require confirmation about data implications
5. WHEN configuration is updated THEN the system SHALL update mode_last_changed_at timestamp

### Requirement 5: User Experience Consistency

**User Story:** As a restaurant staff member, I want clear visual indicators of our venue's operational mode, so that I understand which features are available.

#### Acceptance Criteria

1. WHEN Basic mode is active THEN the system SHALL display blue theme with printer-focused icons
2. WHEN Venue mode with POS authority is active THEN the system SHALL display yellow theme with hybrid workflow icons
3. WHEN Venue mode with Tabeza authority is active THEN the system SHALL display green theme with full-service icons
4. WHEN displaying configuration summary THEN the system SHALL show enabled/disabled features clearly
5. WHEN mode constraints apply THEN the system SHALL explain workflow limitations to users

### Requirement 6: Error Prevention and Recovery

**User Story:** As a system administrator, I want robust error handling during onboarding, so that venues cannot get stuck in invalid states.

#### Acceptance Criteria

1. WHEN database errors occur during onboarding THEN the system SHALL display clear error messages and allow retry
2. WHEN network errors interrupt onboarding THEN the system SHALL preserve partial progress and allow continuation
3. WHEN invalid configurations are detected THEN the system SHALL prevent saving and suggest corrections
4. WHEN onboarding fails THEN the system SHALL log detailed error information for debugging
5. WHEN recovery is needed THEN the system SHALL provide admin tools to reset onboarding state

### Requirement 7: Data Integrity and Audit

**User Story:** As a system administrator, I want complete audit trails of venue configuration changes, so that I can track and troubleshoot issues.

#### Acceptance Criteria

1. WHEN venue mode is configured THEN the system SHALL record authority_configured_at timestamp
2. WHEN configuration changes are made THEN the system SHALL update mode_last_changed_at timestamp
3. WHEN onboarding is completed THEN the system SHALL log the completion event with user details
4. WHEN invalid states are prevented THEN the system SHALL log the validation failure details
5. WHEN configuration is viewed THEN the system SHALL display configuration history timestamps