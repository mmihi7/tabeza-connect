# Visual Regression Testing for Theme Consistency

This directory contains comprehensive visual regression tests that ensure theme consistency across all venue configurations and screen sizes in the Tabeza application.

## Overview

The visual regression tests implement **Requirements 5.1, 5.2, 5.3** from the onboarding-flow-fix specification:

- **5.1**: Blue theme for Basic mode with printer-focused icons
- **5.2**: Yellow theme for Venue+POS mode with hybrid icons  
- **5.3**: Green theme for Venue+Tabeza mode with full-service icons

### Core Truth Compliance

All tests adhere to the fundamental system law:

> **CORE TRUTH**: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

## Test Structure

### Test Files

1. **`theme-consistency.spec.ts`** - Main theme consistency tests across all configurations
2. **`onboarding-modal.spec.ts`** - Onboarding modal visual consistency and responsive design
3. **`venue-configuration-display.spec.ts`** - Configuration display component visual tests
4. **`test-utils.ts`** - Shared utilities and helper functions

### Configuration Coverage

The tests cover all valid venue configurations:

| Venue Mode | Authority Mode | Theme | Icons | Description |
|------------|----------------|-------|-------|-------------|
| Basic | POS | Blue | 🖨️📱💳 | Transaction & Receipt Bridge |
| Venue | POS | Yellow | 📋🖨️💬 | Customer Interaction + POS Integration |
| Venue | Tabeza | Green | 📋💬💳📊 | Full Service Platform |

### Screen Size Coverage

Tests run across multiple screen sizes to ensure responsive design:

- **Mobile Small**: 320×568px
- **Mobile Large**: 414×896px  
- **Tablet Small**: 768×1024px
- **Tablet Large**: 1024×1366px
- **Desktop Small**: 1366×768px
- **Desktop Large**: 1920×1080px

## Running Tests

### Local Development

```bash
# Run all visual tests
cd packages/shared
pnpm test:visual

# Update baseline screenshots
pnpm test:visual:update

# Run tests in UI mode
pnpm test:visual:ui

# Run specific test file
npx playwright test theme-consistency.spec.ts

# Run tests for specific browser
npx playwright test --project="Desktop Chrome"
```

### Using the Test Runner Script

```bash
# Run all tests with HTML report
node dev-tools/scripts/run-visual-tests.js

# Update snapshots
node dev-tools/scripts/run-visual-tests.js --update-snapshots

# Run in UI mode
node dev-tools/scripts/run-visual-tests.js --ui

# Run specific project
node dev-tools/scripts/run-visual-tests.js --project "iPhone 12"

# Run tests matching pattern
node dev-tools/scripts/run-visual-tests.js --grep "theme consistency"
```

### CI/CD Integration

```bash
# Run tests in CI environment
node dev-tools/scripts/ci-visual-tests.js

# Set specific project for CI
VISUAL_TEST_PROJECT="Desktop Chrome" node dev-tools/scripts/ci-visual-tests.js
```

## Test Categories

### 1. Theme Consistency Tests

**File**: `theme-consistency.spec.ts`

- Tests theme switching across all configuration combinations
- Verifies correct colors, icons, and descriptions for each theme
- Tests theme transitions when configuration changes
- Validates responsive design at all breakpoints

**Key Test Cases**:
- Theme colors and styling consistency
- Icon display and positioning
- Theme indicator visibility
- Configuration-specific theming

### 2. Onboarding Modal Tests

**File**: `onboarding-modal.spec.ts`

- Tests onboarding modal visual consistency across all states
- Verifies responsive design of modal at different screen sizes
- Tests error states and validation feedback display
- Validates accessibility features and focus states

**Key Test Cases**:
- Modal display in forced vs optional modes
- Step-by-step flow visual consistency
- Error message display and styling
- Responsive modal positioning

### 3. Configuration Display Tests

**File**: `venue-configuration-display.spec.ts`

- Tests venue configuration display component
- Verifies feature lists and workflow limitations display
- Tests theme integration in configuration summaries
- Validates responsive grid layouts

**Key Test Cases**:
- Enabled/disabled feature styling
- Workflow limitation display
- Configuration summary formatting
- Theme-specific styling application

## Test Utilities

### `test-utils.ts`

Provides shared utilities for consistent testing:

- **Configuration Mocking**: Standard venue configurations
- **Animation Disabling**: Ensures consistent screenshots
- **Theme Verification**: Validates theme application
- **Responsive Testing**: Helper for breakpoint testing
- **Network Simulation**: Mock network conditions
- **Accessibility Testing**: Keyboard navigation and focus

### Key Utilities

```typescript
// Disable animations for consistent screenshots
await disableAnimations(page);

// Mock venue configuration
await mockVenueConfiguration(page, STANDARD_CONFIGURATIONS.BASIC_MODE);

// Wait for theme application
await waitForThemeApplication(page, 'blue');

// Test responsive design
await testResponsiveDesign(page, async (screenSize) => {
  // Test callback for each screen size
});

// Verify theme consistency
await verifyThemeConsistency(page, 'basic');
```

## Screenshot Management

### Baseline Screenshots

Baseline screenshots are stored in `test-results/` directory and organized by:
- Test file name
- Browser/device project
- Screen size
- Configuration type

### Updating Baselines

When UI changes are intentional:

```bash
# Update all baselines
pnpm test:visual:update

# Update specific test baselines
npx playwright test theme-consistency.spec.ts --update-snapshots

# Update for specific project
npx playwright test --project="Desktop Chrome" --update-snapshots
```

### Screenshot Comparison

- **Threshold**: 0.2 (20% difference tolerance)
- **Mode**: Strict comparison
- **Animations**: Disabled for consistency
- **Diff Generation**: Automatic for failed comparisons

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Visual Regression Tests
  run: node dev-tools/scripts/ci-visual-tests.js
  env:
    PLAYWRIGHT_BASE_URL: ${{ env.PREVIEW_URL }}
    VISUAL_TEST_PROJECT: "Desktop Chrome"

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: visual-test-results
    path: packages/shared/visual-test-results/
```

### Vercel Integration

```json
{
  "buildCommand": "pnpm build && node dev-tools/scripts/ci-visual-tests.js",
  "outputDirectory": "dist",
  "installCommand": "pnpm install && npx playwright install"
}
```

## Troubleshooting

### Common Issues

1. **Flaky Screenshots**
   - Ensure animations are disabled
   - Check for loading states
   - Verify network stability

2. **Theme Not Applied**
   - Wait for theme application with `waitForThemeApplication()`
   - Check API mocking setup
   - Verify component mounting

3. **Responsive Layout Issues**
   - Test at exact breakpoint sizes
   - Allow time for layout changes
   - Check CSS media queries

### Debug Mode

```bash
# Run tests in headed mode to see browser
npx playwright test --headed

# Run with debug mode
npx playwright test --debug

# Generate trace files
npx playwright test --trace on
```

## Performance Considerations

### Test Optimization

- **Parallel Execution**: Limited in CI to avoid resource issues
- **Selective Testing**: Use `--grep` to run specific tests
- **Project Filtering**: Test specific browsers/devices only
- **Timeout Management**: Appropriate timeouts for CI environments

### Resource Management

- **Memory Usage**: Monitor for large screenshot collections
- **Storage**: Regular cleanup of old test results
- **Network**: Mock external services to reduce flakiness

## Maintenance

### Regular Tasks

1. **Baseline Updates**: When intentional UI changes are made
2. **Test Review**: Ensure tests cover new features
3. **Performance Monitoring**: Check test execution times
4. **Artifact Cleanup**: Remove old test results and screenshots

### Adding New Tests

1. Create test file in `lib/visual-tests/`
2. Use utilities from `test-utils.ts`
3. Follow naming conventions for screenshots
4. Add appropriate test categories and descriptions
5. Update this README with new test information

## Reporting

### HTML Reports

Generated automatically at `visual-test-results/index.html`:
- Test execution summary
- Screenshot comparisons
- Failure details with diffs
- Performance metrics

### JSON Reports

Machine-readable results at `visual-test-results/results.json`:
- Test statistics
- Individual test results
- Timing information
- Artifact locations

### CI Integration

- **GitHub Actions**: Automatic annotations and artifact uploads
- **Slack Notifications**: Configurable webhook integration
- **Email Reports**: Optional email notifications for failures

## Best Practices

### Writing Visual Tests

1. **Consistent Setup**: Use `setupTestEnvironment()` in beforeEach
2. **Animation Handling**: Always disable animations
3. **Wait Strategies**: Use appropriate wait conditions
4. **Screenshot Naming**: Use descriptive, consistent names
5. **Test Isolation**: Ensure tests don't affect each other

### Maintaining Tests

1. **Regular Reviews**: Check for outdated or redundant tests
2. **Baseline Management**: Keep baselines up to date
3. **Performance Monitoring**: Watch for slow or flaky tests
4. **Documentation**: Keep README and comments current

### CI/CD Best Practices

1. **Selective Execution**: Run relevant tests for changes
2. **Artifact Management**: Collect and store important results
3. **Notification Strategy**: Alert on failures, not successes
4. **Resource Limits**: Respect CI environment constraints