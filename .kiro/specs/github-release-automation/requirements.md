# Requirements Document

## Introduction

This specification defines the automated GitHub release workflow for TabezaConnect, the Windows printer service that enables POS integration for Tabeza venues. The automation addresses the critical issue where download links in the staff app return "file not found" errors because GitHub releases are created manually and inconsistently.

TabezaConnect is mandatory for:
- All Tabeza Basic mode venues (POS-authoritative)
- Tabeza Venue mode venues with POS authority

The printer service enables digital receipt mirroring from POS systems, which is a core requirement for venues operating with POS authority under Tabeza's single digital authority model.

## Glossary

- **TabezaConnect**: Windows service that monitors a watch folder for receipt files and forwards them to Tabeza's API
- **GitHub_Release**: A tagged version of the repository with attached binary artifacts
- **Installer_Package**: The ZIP file containing Node.js runtime, service files, and installation scripts
- **Version_Tag**: Git tag following semantic versioning (e.g., v1.0.0)
- **Build_Artifact**: The compiled installer ZIP file produced by the build process
- **Release_Workflow**: GitHub Actions workflow that automates the release process
- **Staff_App**: The Tabeza staff management interface that provides download links
- **POS_Authority**: Operating mode where the POS system is the single digital order authority
- **Tabeza_Basic**: Venue mode requiring POS integration and printer drivers

## Requirements

### Requirement 1: Automated Release Triggering

**User Story:** As a developer, I want releases to be created automatically when I push a version tag, so that I don't have to manually create releases through the GitHub UI.

#### Acceptance Criteria

1. WHEN a developer pushes a git tag matching the pattern `v*.*.*`, THE Release_Workflow SHALL trigger automatically
2. WHEN the tag does not match semantic versioning pattern, THE Release_Workflow SHALL reject the tag with a clear error message
3. WHEN multiple tags are pushed simultaneously, THE Release_Workflow SHALL process each tag independently
4. THE Release_Workflow SHALL extract the version number from the tag for use in artifact naming
5. WHEN a tag is deleted and re-pushed, THE Release_Workflow SHALL replace the existing release

### Requirement 2: Installer Build Automation

**User Story:** As a developer, I want the installer to be built automatically during the release process, so that I don't have to run build scripts manually before creating releases.

#### Acceptance Criteria

1. WHEN the Release_Workflow triggers, THE Build_System SHALL install all required dependencies
2. THE Build_System SHALL download the Node.js runtime bundle
3. THE Build_System SHALL copy service files to the installer directory
4. THE Build_System SHALL install production dependencies in the service directory
5. THE Build_System SHALL create the installer batch file with configuration prompts
6. THE Build_System SHALL package all files into a ZIP archive
7. WHEN the build fails at any step, THE Release_Workflow SHALL abort and report the failure
8. THE Build_Artifact SHALL be named `TabezaConnect-Setup-v{version}.zip` where version matches the git tag

### Requirement 3: GitHub Release Creation

**User Story:** As a developer, I want GitHub releases to be created automatically with the installer attached, so that download links in the staff app work immediately.

#### Acceptance Criteria

1. WHEN the build completes successfully, THE Release_Workflow SHALL create a GitHub_Release with the tag version
2. THE GitHub_Release SHALL include the Build_Artifact as a downloadable asset
3. THE GitHub_Release SHALL be marked as the latest release
4. THE GitHub_Release SHALL include auto-generated release notes from commit messages
5. WHEN the release is a pre-release version (e.g., v1.0.0-beta), THE Release_Workflow SHALL mark it as pre-release
6. THE GitHub_Release SHALL be publicly accessible without authentication

### Requirement 4: Version Consistency

**User Story:** As a developer, I want version numbers to be consistent across all files and URLs, so that users always download the correct version.

#### Acceptance Criteria

1. THE Build_System SHALL extract the version number from the git tag
2. THE Build_System SHALL use the extracted version in the ZIP filename
3. THE Build_System SHALL update the installer batch file with the correct version number
4. THE Build_System SHALL update package.json version field to match the tag
5. WHEN version numbers are inconsistent, THE Build_System SHALL fail with a clear error message

### Requirement 5: Download URL Stability

**User Story:** As a staff app user, I want download links to always point to the latest stable release, so that I can install the printer service without errors.

#### Acceptance Criteria

1. THE GitHub_Release SHALL be accessible via the URL pattern `https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v{version}.zip`
2. WHEN a new release is published, THE `/latest/` URL SHALL automatically redirect to the newest version
3. THE Staff_App SHALL use the `/latest/` URL pattern for download links
4. WHEN no releases exist, THE download URL SHALL return a 404 error with a helpful message
5. THE GitHub_Release SHALL remain accessible even after newer versions are published

### Requirement 6: Release Notes Generation

**User Story:** As a venue owner, I want to see what changed in each release, so that I can decide whether to upgrade.

#### Acceptance Criteria

1. THE Release_Workflow SHALL generate release notes from git commit messages between tags
2. THE release notes SHALL include a list of commits with their messages
3. THE release notes SHALL group commits by type (features, fixes, documentation)
4. THE release notes SHALL include a link to the full changelog
5. WHEN this is the first release, THE release notes SHALL include all commits from the initial commit

### Requirement 7: Build Validation

**User Story:** As a developer, I want the build process to validate the installer before releasing, so that broken installers are never published.

#### Acceptance Criteria

1. THE Build_System SHALL verify that the ZIP file was created successfully
2. THE Build_System SHALL verify that the ZIP file size is within expected bounds (20-50 MB)
3. THE Build_System SHALL verify that required files exist in the ZIP (install.bat, README.txt, nodejs folder)
4. WHEN validation fails, THE Release_Workflow SHALL abort and report specific validation errors
5. THE Build_System SHALL run on a clean Windows environment to ensure reproducibility

### Requirement 8: Manual Release Fallback

**User Story:** As a developer, I want to be able to trigger releases manually when needed, so that I can create releases without pushing tags.

#### Acceptance Criteria

1. THE Release_Workflow SHALL support manual triggering via GitHub Actions UI
2. WHEN manually triggered, THE workflow SHALL prompt for a version number
3. THE workflow SHALL validate the manually entered version number
4. THE workflow SHALL create a git tag automatically if one doesn't exist
5. THE manual release process SHALL follow the same build and validation steps as automatic releases

### Requirement 9: Failure Notifications

**User Story:** As a developer, I want to be notified when releases fail, so that I can fix issues quickly.

#### Acceptance Criteria

1. WHEN the Release_Workflow fails, THE system SHALL send a notification to the repository maintainers
2. THE notification SHALL include the failure reason and relevant logs
3. THE notification SHALL include a link to the failed workflow run
4. WHEN a release fails, THE system SHALL NOT create a GitHub_Release
5. WHEN a release fails, THE system SHALL NOT delete the git tag

### Requirement 10: Multi-Version Support

**User Story:** As a developer, I want to maintain multiple release versions simultaneously, so that users can download older versions if needed.

#### Acceptance Criteria

1. THE Release_Workflow SHALL preserve all previous releases when creating new ones
2. THE GitHub_Release SHALL support version-specific download URLs
3. THE Staff_App SHALL provide links to both latest and specific versions
4. WHEN a critical bug is found, THE system SHALL support creating patch releases for older versions
5. THE Release_Workflow SHALL support creating releases for maintenance branches
