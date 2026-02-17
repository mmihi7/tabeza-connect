# Design Document: GitHub Release Automation for TabezaConnect

## Overview

This design implements an automated GitHub release workflow for TabezaConnect, the Windows printer service that enables POS integration for Tabeza venues. The system automates the entire release process from tag creation to installer distribution, ensuring that download links in the staff app always work correctly.

The automation is critical for Tabeza's operational model where:
- Tabeza Basic mode (POS-authoritative) requires printer drivers
- Tabeza Venue mode with POS authority requires printer drivers
- Manual service always exists alongside the single digital authority (POS or Tabeza)

The current manual process is error-prone and causes "file not found" errors for users attempting to download the installer from the staff app.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│  Developer      │
│  Pushes Tag     │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────────────────────┐
│           GitHub Actions Workflow                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │   Trigger    │───▶│    Build     │───▶│ Validate │ │
│  │   Detection  │    │   Installer  │    │ Artifact │ │
│  └──────────────┘    └──────────────┘    └──────┬───┘ │
│                                                   │     │
│  ┌──────────────┐    ┌──────────────┐           │     │
│  │   Publish    │◀───│   Generate   │◀──────────┘     │
│  │   Release    │    │Release Notes │                  │
│  └──────┬───────┘    └──────────────┘                  │
└─────────┼────────────────────────────────────────────┘
          │
          v
┌─────────────────────────────────────────┐
│      GitHub Release                     │
│  ┌───────────────────────────────────┐ │
│  │ TabezaConnect-Setup-v1.0.0.zip    │ │
│  │ Release Notes                      │ │
│  │ Download URL: /releases/latest/... │ │
│  └───────────────────────────────────┘ │
└─────────────────┬───────────────────────┘
                  │
                  v
┌─────────────────────────────────────────┐
│      Staff App Download Links           │
│  https://github.com/.../latest/download │
└─────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Tag Detection**: Workflow triggers on `v*` tag push
2. **Version Extraction**: Parse semantic version from tag
3. **Environment Setup**: Install Node.js and dependencies
4. **Build Process**: Execute installer build scripts
5. **Artifact Validation**: Verify ZIP file integrity and contents
6. **Release Notes**: Generate changelog from commits
7. **Release Creation**: Publish GitHub release with artifacts
8. **URL Activation**: Make `/latest/` download URL available

## Components and Interfaces

### 1. Workflow Trigger Component

**Responsibility**: Detect version tags and initiate the release process

**Interface**:
```yaml
on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version number (e.g., 1.0.0)'
        required: true
        type: string
```

**Behavior**:
- Listens for git tags matching semantic versioning pattern
- Supports manual triggering with version input
- Validates tag format before proceeding
- Extracts version number for downstream use

### 2. Build Environment Component

**Responsibility**: Set up the Windows build environment with required tools

**Interface**:
```yaml
runs-on: windows-latest
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '18'
      cache: 'npm'
```

**Behavior**:
- Uses Windows runner for native Windows builds
- Installs Node.js 18 (LTS version)
- Caches npm dependencies for faster builds
- Checks out repository with full git history for changelog generation

### 3. Version Management Component

**Responsibility**: Extract and validate version numbers across the build

**Interface**:
```bash
# Extract version from tag
VERSION=${GITHUB_REF#refs/tags/v}

# Validate semantic versioning
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
  echo "Invalid version format"
  exit 1
fi

# Update package.json
npm version $VERSION --no-git-tag-version
```

**Behavior**:
- Extracts version from `refs/tags/v1.0.0` format
- Validates against semantic versioning regex
- Updates package.json to match tag version
- Supports pre-release versions (e.g., 1.0.0-beta)
- Fails fast on invalid version formats

### 4. Installer Build Component

**Responsibility**: Execute the build process to create the installer package

**Interface**:
```bash
# Install root dependencies
npm install

# Install service dependencies
cd src/service
npm install
cd ../..

# Download Node.js runtime
npm run download:nodejs

# Build installer package
npm run build:installer
```

**Behavior**:
- Installs dependencies in correct order
- Downloads Node.js portable runtime
- Copies service files to installer directory
- Installs production dependencies in service bundle
- Creates installer batch file
- Packages everything into ZIP archive
- Outputs to `dist/TabezaConnect-Setup-v{version}.zip`

### 5. Artifact Validation Component

**Responsibility**: Verify the built installer meets quality requirements

**Interface**:
```bash
validate_artifact() {
  local zip_file=$1
  local min_size=$((20 * 1024 * 1024))  # 20 MB
  local max_size=$((50 * 1024 * 1024))  # 50 MB
  
  # Check file exists
  if [ ! -f "$zip_file" ]; then
    echo "ERROR: ZIP file not found"
    return 1
  fi
  
  # Check file size
  local size=$(stat -c%s "$zip_file")
  if [ $size -lt $min_size ] || [ $size -gt $max_size ]; then
    echo "ERROR: ZIP file size out of bounds"
    return 1
  fi
  
  # Check ZIP integrity
  unzip -t "$zip_file" > /dev/null
  if [ $? -ne 0 ]; then
    echo "ERROR: ZIP file is corrupted"
    return 1
  fi
  
  # Check required files
  local required_files=("install.bat" "README.txt" "nodejs/")
  for file in "${required_files[@]}"; do
    unzip -l "$zip_file" | grep -q "$file"
    if [ $? -ne 0 ]; then
      echo "ERROR: Missing required file: $file"
      return 1
    fi
  done
  
  echo "✅ Artifact validation passed"
  return 0
}
```

**Behavior**:
- Verifies ZIP file exists
- Checks file size is within expected range (20-50 MB)
- Tests ZIP integrity with unzip
- Verifies presence of critical files
- Fails build if any validation fails
- Provides detailed error messages

### 6. Release Notes Generator Component

**Responsibility**: Generate human-readable release notes from git history

**Interface**:
```yaml
- name: Generate Release Notes
  id: release_notes
  run: |
    # Get previous tag
    PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    
    # Generate changelog
    if [ -z "$PREV_TAG" ]; then
      # First release - include all commits
      CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges)
    else
      # Incremental release - commits since last tag
      CHANGELOG=$(git log $PREV_TAG..HEAD --pretty=format:"- %s (%h)" --no-merges)
    fi
    
    # Categorize commits
    FEATURES=$(echo "$CHANGELOG" | grep -i "feat:" || echo "")
    FIXES=$(echo "$CHANGELOG" | grep -i "fix:" || echo "")
    DOCS=$(echo "$CHANGELOG" | grep -i "docs:" || echo "")
    OTHER=$(echo "$CHANGELOG" | grep -v -i "feat:\|fix:\|docs:" || echo "")
    
    # Format release notes
    NOTES="## What's Changed\n\n"
    [ -n "$FEATURES" ] && NOTES+="### Features\n$FEATURES\n\n"
    [ -n "$FIXES" ] && NOTES+="### Bug Fixes\n$FIXES\n\n"
    [ -n "$DOCS" ] && NOTES+="### Documentation\n$DOCS\n\n"
    [ -n "$OTHER" ] && NOTES+="### Other Changes\n$OTHER\n\n"
    
    echo "notes<<EOF" >> $GITHUB_OUTPUT
    echo -e "$NOTES" >> $GITHUB_OUTPUT
    echo "EOF" >> $GITHUB_OUTPUT
```

**Behavior**:
- Finds previous release tag
- Extracts commits between tags
- Categorizes commits by conventional commit prefixes
- Formats into markdown sections
- Handles first release (no previous tag)
- Outputs to GitHub Actions output variable

### 7. Release Publisher Component

**Responsibility**: Create and publish the GitHub release with artifacts

**Interface**:
```yaml
- name: Create Release
  uses: softprops/action-gh-release@v1
  with:
    files: dist/TabezaConnect-Setup-v*.zip
    body: ${{ steps.release_notes.outputs.notes }}
    draft: false
    prerelease: ${{ contains(github.ref, '-') }}
    generate_release_notes: false
    fail_on_unmatched_files: true
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Behavior**:
- Uses official GitHub release action
- Attaches ZIP file from dist directory
- Includes generated release notes
- Marks as pre-release if version contains hyphen
- Fails if ZIP file not found
- Uses automatic GITHUB_TOKEN for authentication
- Makes release publicly accessible
- Sets as latest release automatically

### 8. Manual Trigger Component

**Responsibility**: Support manual release creation without pushing tags

**Interface**:
```yaml
workflow_dispatch:
  inputs:
    version:
      description: 'Version number (e.g., 1.0.0)'
      required: true
      type: string
    create_tag:
      description: 'Create git tag'
      required: false
      type: boolean
      default: true
```

**Behavior**:
- Accepts version number as input
- Optionally creates git tag
- Validates version format
- Follows same build process as automatic triggers
- Useful for hotfixes and emergency releases

## Data Models

### Version Information

```typescript
interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  tag: string;           // e.g., "v1.0.0"
  version: string;       // e.g., "1.0.0"
  isPrerelease: boolean;
}
```

### Build Artifact

```typescript
interface BuildArtifact {
  filename: string;      // e.g., "TabezaConnect-Setup-v1.0.0.zip"
  path: string;          // e.g., "dist/TabezaConnect-Setup-v1.0.0.zip"
  size: number;          // Size in bytes
  checksum: string;      // SHA256 checksum
  contents: {
    nodejs: boolean;     // Node.js runtime present
    service: boolean;    // Service files present
    installer: boolean;  // install.bat present
    readme: boolean;     // README.txt present
  };
}
```

### Release Metadata

```typescript
interface ReleaseMetadata {
  version: VersionInfo;
  artifact: BuildArtifact;
  releaseNotes: string;
  createdAt: Date;
  downloadUrl: string;
  isLatest: boolean;
  commitSha: string;
}
```

### Workflow Context

```typescript
interface WorkflowContext {
  trigger: 'tag_push' | 'manual';
  repository: string;
  ref: string;
  sha: string;
  actor: string;
  runId: number;
  runNumber: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Version Tag Consistency

*For any* successful release, the version number in the git tag, package.json, and ZIP filename SHALL be identical.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 2: Artifact Completeness

*For any* generated installer ZIP file, it SHALL contain all required components: Node.js runtime, service files, installer batch file, and README.

**Validates: Requirements 7.3**

### Property 3: Download URL Availability

*For any* published release, the download URL pattern `https://github.com/billoapp/TabezaConnect/releases/latest/download/TabezaConnect-Setup-v{version}.zip` SHALL return the artifact with HTTP 200 status.

**Validates: Requirements 5.1, 5.2**

### Property 4: Release Idempotency

*For any* version tag, if the release workflow is triggered multiple times, it SHALL produce the same release artifact (same checksum).

**Validates: Requirements 1.5**

### Property 5: Build Reproducibility

*For any* given git commit and version tag, building the installer on different Windows runners SHALL produce byte-identical ZIP files.

**Validates: Requirements 7.5**

### Property 6: Version Ordering

*For any* two releases with versions v1 and v2, if v1 < v2 in semantic versioning order, then v2 SHALL be marked as the latest release.

**Validates: Requirements 3.3, 5.2**

### Property 7: Artifact Size Bounds

*For any* valid installer ZIP file, its size SHALL be between 20 MB and 50 MB.

**Validates: Requirements 7.2**

### Property 8: Release Notes Completeness

*For any* release, the release notes SHALL include all commits between the previous tag and the current tag.

**Validates: Requirements 6.1, 6.5**

### Property 9: Pre-release Detection

*For any* version tag containing a hyphen (e.g., v1.0.0-beta), the release SHALL be marked as pre-release and SHALL NOT update the `/latest/` URL.

**Validates: Requirements 3.5**

### Property 10: Failure Atomicity

*For any* workflow run that fails, no GitHub release SHALL be created and no artifacts SHALL be published.

**Validates: Requirements 9.4**

## Error Handling

### Build Failures

**Scenario**: Node.js download fails, dependency installation fails, or ZIP creation fails

**Handling**:
- Workflow fails immediately at the failing step
- No release is created
- Error message includes specific failure reason
- Git tag remains but no release is attached
- Developer receives notification with logs

**Recovery**:
- Fix the underlying issue
- Re-push the tag or manually trigger workflow
- Previous failed run is marked as failed in history

### Validation Failures

**Scenario**: ZIP file is corrupted, missing files, or wrong size

**Handling**:
- Validation step fails with detailed error
- Build artifacts are preserved for debugging
- Workflow status shows validation failure
- No release is published

**Recovery**:
- Review validation logs
- Fix build scripts if needed
- Delete and re-push tag

### Version Conflicts

**Scenario**: Tag version doesn't match package.json, or release already exists

**Handling**:
- Version extraction step validates format
- Workflow updates package.json to match tag
- If release exists, it is replaced (not duplicated)

**Recovery**:
- Ensure tag follows semantic versioning
- Delete existing release if needed
- Re-run workflow

### Network Failures

**Scenario**: GitHub API rate limits, download failures, or connectivity issues

**Handling**:
- Retry logic for transient failures (3 attempts)
- Exponential backoff between retries
- Clear error messages for permanent failures

**Recovery**:
- Wait for rate limit reset
- Re-trigger workflow manually
- Check GitHub status page

### Manual Trigger Errors

**Scenario**: Invalid version input or missing permissions

**Handling**:
- Input validation before workflow starts
- Clear error message for invalid formats
- Permission check before creating tags

**Recovery**:
- Correct version format
- Ensure proper repository permissions
- Use tag push instead of manual trigger

## Testing Strategy

### Unit Testing

**Build Script Tests**:
- Test version extraction from various tag formats
- Test package.json version update logic
- Test ZIP file creation with mock files
- Test validation logic with valid and invalid ZIPs

**Validation Tests**:
- Test size bounds checking
- Test file existence checking
- Test ZIP integrity verification
- Test error message formatting

### Integration Testing

**Workflow Tests**:
- Test complete workflow on test repository
- Test with various version formats (1.0.0, 1.0.0-beta, 2.0.0-rc.1)
- Test manual trigger with different inputs
- Test failure scenarios (missing files, invalid versions)

**End-to-End Tests**:
- Push test tag to repository
- Verify release is created
- Download artifact from release URL
- Extract and verify contents
- Test installer on clean Windows VM

### Property-Based Testing

Each correctness property will be implemented as a property-based test with minimum 100 iterations:

**Property 1 Test**: Generate random semantic versions, run workflow, verify version consistency across all artifacts.

**Property 2 Test**: Generate random service file combinations, build installer, verify all required files present.

**Property 3 Test**: Generate random version tags, create releases, verify download URLs return 200 status.

**Property 4 Test**: Run workflow multiple times with same tag, verify artifacts have identical checksums.

**Property 5 Test**: Build same commit on different runners, verify byte-identical outputs.

**Property 7 Test**: Generate installers with various Node.js versions and service files, verify size within bounds.

**Property 9 Test**: Generate random pre-release versions, verify pre-release flag is set correctly.

### Manual Testing

**Release Process**:
1. Create test branch
2. Push version tag (e.g., v1.0.1-test)
3. Verify workflow triggers
4. Monitor build progress
5. Verify release creation
6. Download and test installer
7. Verify download URL works from staff app
8. Clean up test release

**Failure Scenarios**:
1. Push invalid tag format
2. Corrupt build script
3. Remove required files
4. Test network failure simulation
5. Verify error messages and recovery

### Continuous Validation

**Post-Release Checks**:
- Automated download URL health check
- Artifact integrity verification
- Size and checksum validation
- Release notes quality check

**Monitoring**:
- Track workflow success rate
- Monitor build duration trends
- Alert on repeated failures
- Track download statistics

## Implementation Notes

### GitHub Actions Limitations

- Windows runners have 6-hour timeout
- Artifact storage limited to 90 days for free tier
- Rate limits apply to GitHub API calls
- Concurrent workflow runs may be limited

### Security Considerations

- GITHUB_TOKEN has automatic permissions for releases
- No secrets needed for public releases
- ZIP files are publicly downloadable
- No authentication required for downloads

### Performance Optimization

- Cache npm dependencies between runs
- Use shallow git clone when possible
- Parallel dependency installation
- Compress artifacts efficiently

### Maintenance

- Update Node.js version annually
- Review and update action versions quarterly
- Monitor GitHub Actions changelog
- Test workflow after GitHub platform updates
