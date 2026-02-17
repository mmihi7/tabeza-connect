# Implementation Plan: GitHub Release Automation

## Overview

This implementation plan converts the GitHub release automation design into actionable coding tasks. The workflow will automate the complete release process for TabezaConnect, from tag detection through installer distribution, ensuring download links in the staff app always work correctly.

## Tasks

- [x] 1. Create GitHub Actions workflow file
  - [x] 1.1 Create workflow file structure
    - Create `.github/workflows/release.yml` in TabezaConnect repository
    - Configure workflow name and description
    - Set up Windows runner environment (windows-latest)
    - _Requirements: 1.1, 2.7, 7.5_

  - [x] 1.2 Add version extraction and validation logic
    - Extract version from git tag using bash parameter expansion
    - Validate semantic versioning format with regex
    - Update package.json version to match tag
    - Export version as environment variable for downstream steps
    - _Requirements: 1.1, 1.2, 1.4, 4.1, 4.4_

  - [ ]* 1.3 Write property test for version extraction
    - **Property 1: Version Tag Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 1.4 Add manual workflow trigger with inputs
    - Configure workflow_dispatch trigger
    - Add version input parameter with validation
    - Add create_tag boolean input
    - Implement tag creation logic for manual triggers
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 1.5 Write property test for manual trigger
    - **Property 4: Release Idempotency**
    - **Validates: Requirements 1.5**

  - [x] 1.6 Configure workflow triggers
    - Add push trigger for tags matching pattern `v*.*.*`
    - Configure checkout action with full git history
    - Set up Node.js 18 with npm caching
    - _Requirements: 1.1, 1.3_

  - [x] 1.7 Add build step to create ZIP artifact
    - Run `npm install` to install root dependencies
    - Run `cd src/service && npm install` for service dependencies
    - Execute `npm run download:nodejs` to get Node.js runtime
    - Execute `npm run build:installer` to create ZIP
    - Verify ZIP path: `dist/TabezaConnect-Setup-v{version}.zip`
    - Verify ZIP filename matches version from tag
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [x] 1.8 Upload ZIP as workflow artifact
    - Use `actions/upload-artifact@v3` to upload ZIP
    - Set artifact name to `tabezaconnect-installer`
    - Specify path: `dist/TabezaConnect-Setup-v*.zip`
    - Set retention days to 90
    - _Requirements: 2.8_

- [x] 2. Implement artifact validation step
  - [x] 2.1 Create validation script
    - Create `.github/scripts/validate-artifact.sh` in TabezaConnect repository
    - Write PowerShell/bash script to check ZIP file exists at `dist/TabezaConnect-Setup-v*.zip`
    - Implement file size bounds checking (20-50 MB)
    - Add ZIP integrity test using `Expand-Archive -Path $zipFile -DestinationPath $tempDir` (PowerShell) or `unzip -t` (bash)
    - Verify presence of required files (install.bat, README.txt, nodejs/)
    - Verify ZIP filename matches pattern: `TabezaConnect-Setup-v{version}.zip`
    - Reject mismatched version numbers between tag and filename
    - Generate detailed error messages for each validation failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 4.2_

  - [ ]* 2.2 Write property test for artifact validation
    - **Property 2: Artifact Completeness**
    - **Validates: Requirements 7.3**

  - [ ]* 2.3 Write property test for size bounds
    - **Property 7: Artifact Size Bounds**
    - **Validates: Requirements 7.2**

  - [x] 2.4 Add validation step to workflow
    - Download artifact from previous step using `actions/download-artifact@v3`
    - Call validation script after build step
    - Fail workflow if validation fails
    - Output validation results to workflow logs
    - _Requirements: 7.4_

  - [x] 2.5 Upload validated ZIP to GitHub release
    - Download artifact from previous step (if not already downloaded)
    - Configure `softprops/action-gh-release@v1` with:
      * `files: 'dist/TabezaConnect-Setup-v*.zip'`
      * `fail_on_unmatched_files: true`
      * `token: ${{ secrets.GITHUB_TOKEN }}`
    - Verify upload completes successfully
    - Verify asset appears in release with correct filename
    - Test download URL format: `https://github.com/billoapp/TabezaConnect/releases/download/v{version}/TabezaConnect-Setup-v{version}.zip`
    - Verify `/latest/` redirect points to correct version
    - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [x] 3. Implement release notes generation
  - [x] 3.1 Create release notes generator script
    - Find previous release tag using git describe
    - Extract commits between tags using git log
    - Categorize commits by conventional commit prefixes (feat:, fix:, docs:)
    - Format into markdown sections
    - Handle first release case (no previous tag)
    - Output to GitHub Actions output variable
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.2 Write property test for release notes generation
    - **Property 8: Release Notes Completeness**
    - **Validates: Requirements 6.1, 6.5**

  - [x] 3.3 Integrate release notes into workflow
    - Add release notes generation step
    - Pass generated notes to release creation step
    - _Requirements: 3.4_

- [x] 4. Checkpoint - Ensure workflow builds and uploads successfully
  - [x] 4.1 Test complete workflow end-to-end
    - Push test tag (e.g., v1.0.1-test) to TabezaConnect repository
    - Monitor workflow execution in GitHub Actions
    - Verify ZIP appears in release assets
    - Download ZIP from release URL and verify integrity
    - Extract ZIP and verify all required files present
    - Verify download URL is immediately accessible: `https://github.com/billoapp/TabezaConnect/releases/download/v1.0.1-test/TabezaConnect-Setup-v1.0.1-test.zip`
    - Verify `/latest/` URL redirects correctly
    - Delete test release after verification
    - _Requirements: All_

- [~] 5. Enhance release creation step
  - [~] 5.1 Update release action configuration
    - Use `softprops/action-gh-release@v1`
    - Configure `files: 'dist/TabezaConnect-Setup-v*.zip'` to upload ZIP
    - Verify asset appears at: `/releases/download/v{version}/TabezaConnect-Setup-v{version}.zip`
    - Set `draft: false` for immediate publication
    - Set `prerelease: ${{ contains(github.ref, '-') }}` to detect pre-release versions
    - Enable `fail_on_unmatched_files: true` to catch missing artifacts
    - Pass release notes from previous step using `body: ${{ steps.release_notes.outputs.notes }}`
    - Set `generate_release_notes: false` to use custom notes
    - Verify final download URL format and accessibility
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 5.1, 5.2_

  - [ ]* 5.2 Write property test for download URL availability
    - **Property 3: Download URL Availability**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 5.3 Write property test for pre-release detection
    - **Property 9: Pre-release Detection**
    - **Validates: Requirements 3.5**

- [~] 6. Add build reproducibility measures
  - [~] 6.1 Configure npm caching
    - Add cache: 'npm' to setup-node action
    - Cache node_modules between runs
    - _Requirements: 7.5_

  - [~] 6.2 Pin dependency versions
    - Update package.json with exact versions
    - Lock Node.js version to 18.x
    - Document version requirements
    - _Requirements: 7.5_

  - [ ]* 6.3 Write property test for build reproducibility
    - **Property 5: Build Reproducibility**
    - **Validates: Requirements 7.5**

- [~] 7. Implement failure handling and notifications
  - [~] 7.1 Add error handling to workflow steps
    - Set continue-on-error: false for critical steps
    - Add error message formatting
    - Preserve artifacts on failure for debugging
    - _Requirements: 2.7, 9.4, 9.5_

  - [ ]* 7.2 Write property test for failure atomicity
    - **Property 10: Failure Atomicity**
    - **Validates: Requirements 9.4**

  - [~] 7.3 Configure GitHub Actions notifications
    - Verify default email notifications are enabled
    - Document notification settings for maintainers
    - Add workflow status badge to README
    - _Requirements: 9.1, 9.2, 9.3_

- [~] 8. Update staff app download links (Separate PR - Tabz repository)
  - **Note**: These tasks are for the staff app repository (Tabz), not TabezaConnect. Create a separate PR after TabezaConnect workflow is working.
  
  - [~] 8.1 Update PrinterStatusIndicator component
    - File: `Tabz/apps/staff/components/PrinterStatusIndicator.tsx`
    - Verify download URL uses `/latest/` pattern: `https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v1.0.0.zip`
    - Update to dynamic version if needed or keep static version reference
    - Add version display if needed
    - Test download link functionality
    - _Requirements: 5.3_

  - [~] 8.2 Update printer setup page
    - File: `Tabz/apps/staff/app/setup/printer/page.tsx`
    - Verify download URL uses `/latest/` pattern
    - Add link to specific version if needed
    - Update installation instructions
    - Test download flow from staff app
    - _Requirements: 5.3, 10.3_

  - [~] 8.3 Update driver detection service
    - File: `Tabz/packages/shared/lib/services/driver-detection-service.ts`
    - Verify download URL configuration uses `/latest/` pattern
    - Update version checking logic if needed
    - Ensure URL format matches GitHub release pattern
    - _Requirements: 5.3_

- [~] 9. Add multi-version support
  - [~] 9.1 Document version-specific URL pattern
    - Add documentation for accessing specific versions
    - Document /latest/ vs /download/v{version}/ patterns
    - _Requirements: 10.2_

  - [~] 9.2 Test maintenance branch releases
    - Create test maintenance branch
    - Push tag to maintenance branch
    - Verify release is created correctly
    - _Requirements: 10.4, 10.5_

  - [ ]* 9.3 Write property test for version ordering
    - **Property 6: Version Ordering**
    - **Validates: Requirements 3.3, 5.2**

  - [ ]* 9.4 Write property test for release preservation
    - Test that creating new releases doesn't delete old ones
    - Verify all releases remain accessible
    - **Validates: Requirements 10.1**

- [~] 10. Final checkpoint - Test complete release workflow
  - [~] 10.1 Verify production release workflow
    - Create production release tag (e.g., v1.0.0)
    - Monitor workflow execution
    - Verify release appears on GitHub releases page
    - Download installer from release URL
    - Test installer on clean Windows VM
    - Verify download URL works from staff app (after Task 8 is complete)
    - Monitor for any errors or issues
    - _Requirements: All_
  
  - [~] 10.2 Verify URL patterns and accessibility
    - Test version-specific URL: `https://github.com/billoapp/TabezaConnect/releases/download/v1.0.0/TabezaConnect-Setup-v1.0.0.zip`
    - Test `/latest/` URL: `https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v1.0.0.zip`
    - Verify both URLs return HTTP 200 and download the ZIP
    - Verify `/latest/` redirects to newest non-prerelease version
    - Test from different networks (not just localhost)
    - _Requirements: 5.1, 5.2, 5.3_

- [~] 11. Create test release
  - [~] 11.1 Create test tag and verify workflow
    - Push test tag (e.g., v1.0.1-test)
    - Monitor workflow execution
    - Verify release is created
    - Download and test installer
    - Verify download URL works from staff app
    - Clean up test release
    - _Requirements: All_

  - [~] 11.2 Document release process
    - Create RELEASING.md with step-by-step instructions
    - Document manual trigger process
    - Document troubleshooting steps
    - Add examples for different version types
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations each
- The workflow must run on Windows runners for native Windows builds
- All version numbers must follow semantic versioning (major.minor.patch)
- Pre-release versions use hyphen suffix (e.g., 1.0.0-beta)
- The `/latest/` URL pattern automatically redirects to the newest non-prerelease version
