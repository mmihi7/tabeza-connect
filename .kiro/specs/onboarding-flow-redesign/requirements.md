# Requirements Document

## Introduction

The current onboarding flow is backwards - it forces venue mode selection in settings instead of starting with "What do you want?" upfront. This creates a poor user experience where users must navigate through settings to complete basic setup. The redesigned onboarding flow should be natural, progressive, and immediately useful, allowing users to reach their dashboard quickly while providing optional completion steps.

## Glossary

- **Onboarding_Flow**: The initial setup process for new venue owners
- **Venue_Mode**: The operational configuration (Basic or Venue) that determines available features
- **Authority_Mode**: The system responsible for creating financial orders (POS or Tabeza)
- **Dashboard**: The main staff interface after successful onboarding
- **Settings_Toast**: A non-blocking notification encouraging users to complete optional setup
- **Welcome_Screen**: The first screen users see during onboarding
- **Basic_Setup**: Simplified onboarding path for POS + M-Pesa + QR code users
- **Venue_Setup**: Full onboarding path with POS integration decision

## Requirements

### Requirement 1: Progressive Onboarding Entry Point

**User Story:** As a new venue owner, I want to immediately understand my setup options, so that I can choose the right path for my business needs.

#### Acceptance Criteria

1. WHEN a user starts onboarding, THE Welcome_Screen SHALL display two clear options: Basic and Venue
2. WHEN a user views setup options, THE System SHALL provide "learn more" links for each option
3. WHEN a user selects an option, THE System SHALL immediately begin the appropriate setup flow
4. THE Welcome_Screen SHALL clearly explain the difference between Basic and Venue modes
5. THE Welcome_Screen SHALL use visual indicators to distinguish between setup types

### Requirement 2: Streamlined Basic Setup Flow

**User Story:** As a venue owner with an existing POS system, I want a simple setup process, so that I can start using Tabeza immediately without complex configuration.

#### Acceptance Criteria

1. WHEN a user selects Basic setup, THE System SHALL collect only essential information: name, location, and M-Pesa details
2. WHEN Basic setup is completed, THE System SHALL automatically configure venue_mode as 'basic' and authority_mode as 'pos'
3. WHEN Basic setup is completed, THE System SHALL redirect directly to the Dashboard
4. THE Basic_Setup SHALL require printer integration setup
5. THE Basic_Setup SHALL disable customer ordering and staff ordering features

### Requirement 3: Comprehensive Venue Setup Flow

**User Story:** As a venue owner wanting full customer interaction, I want a guided setup process, so that I can configure the right authority model for my business.

#### Acceptance Criteria

1. WHEN a user selects Venue setup, THE System SHALL collect basic information: name and location
2. WHEN basic information is collected, THE System SHALL ask "Do you have a POS system?"
3. WHEN the user answers the POS question, THE System SHALL configure the appropriate authority_mode
4. WHEN Venue setup is completed, THE System SHALL redirect to the Dashboard
5. IF the user has a POS, THE System SHALL set authority_mode to 'pos' and disable staff ordering
6. IF the user has no POS, THE System SHALL set authority_mode to 'tabeza' and enable full ordering

### Requirement 4: Non-Blocking Settings Completion

**User Story:** As a venue owner, I want to start using the system immediately after basic setup, so that I can begin operations while completing optional configuration later.

#### Acceptance Criteria

1. WHEN a user reaches the Dashboard after onboarding, THE System SHALL display a Settings_Toast encouraging completion of optional setup
2. WHEN the Settings_Toast is displayed, THE System SHALL not block access to core functionality
3. WHEN a user dismisses the Settings_Toast, THE System SHALL not show it again for the current session
4. THE Settings_Toast SHALL provide a direct link to relevant settings sections
5. THE Settings_Toast SHALL be visually distinct but not intrusive

### Requirement 5: Settings Integration Without Forced Modals

**User Story:** As a venue owner, I want to access settings naturally, so that I can modify my configuration without being forced through modal dialogs.

#### Acceptance Criteria

1. WHEN a user accesses Settings, THE System SHALL not display forced modal dialogs
2. WHEN a user needs to change venue mode, THE System SHALL provide clear warnings about the implications
3. WHEN a user modifies authority settings, THE System SHALL validate the configuration before saving
4. THE Settings SHALL maintain the current venue mode and authority mode display
5. THE Settings SHALL allow configuration changes through standard form interfaces

### Requirement 6: Configuration Validation and Consistency

**User Story:** As a system administrator, I want configuration validation, so that venues cannot be left in invalid states.

#### Acceptance Criteria

1. WHEN a venue is configured, THE System SHALL enforce exactly one digital authority (POS or Tabeza)
2. WHEN Basic mode is selected, THE System SHALL require POS authority and printer integration
3. WHEN Venue mode with POS is selected, THE System SHALL disable staff ordering in Tabeza
4. WHEN Venue mode without POS is selected, THE System SHALL enable full Tabeza ordering
5. THE System SHALL prevent invalid configuration combinations and display clear error messages

### Requirement 7: Onboarding State Persistence

**User Story:** As a venue owner, I want my onboarding progress saved, so that I can resume setup if interrupted.

#### Acceptance Criteria

1. WHEN a user begins onboarding, THE System SHALL save progress after each completed step
2. WHEN a user returns to an incomplete onboarding, THE System SHALL resume from the last completed step
3. WHEN onboarding is completed, THE System SHALL mark the venue as fully onboarded
4. THE System SHALL persist venue_mode and authority_mode selections immediately upon confirmation
5. THE System SHALL handle network interruptions gracefully during onboarding

### Requirement 8: User Experience and Visual Design

**User Story:** As a venue owner, I want an intuitive onboarding experience, so that I can complete setup without confusion.

#### Acceptance Criteria

1. WHEN users navigate the onboarding flow, THE System SHALL provide clear progress indicators
2. WHEN users make selections, THE System SHALL provide immediate visual feedback
3. WHEN users encounter errors, THE System SHALL display helpful error messages with recovery suggestions
4. THE System SHALL use consistent visual themes based on the selected venue mode
5. THE System SHALL provide contextual help and explanations throughout the flow