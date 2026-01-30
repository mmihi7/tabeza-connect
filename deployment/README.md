# TABEZA Deployment Validation System

This directory contains deployment configuration and validation scripts for the TABEZA architectural restructure. The system ensures proper separation between cloud and agent components while maintaining deployment independence.

## Directory Structure

```
deployment/
├── cloud/                          # Cloud system deployment configuration
│   ├── vercel.json                 # Vercel deployment configuration
│   └── github-actions.yml          # CI/CD pipeline for cloud system
├── agent/                          # Agent system deployment configuration
│   └── msi-installer-spec.md       # MSI installer specification
├── packages/                       # Shared package publishing configuration
│   ├── npm-publishing-config.json  # NPM publishing configuration
│   ├── publish-packages.sh         # Package publishing script (Unix)
│   └── publish-packages.ps1        # Package publishing script (Windows)
├── scripts/                        # Validation scripts
│   ├── validate-cloud-purity.js    # Cloud system purity validator
│   ├── validate-agent-self-contained.js # Agent system validator
│   ├── validate-schema-publishing.js    # Schema publishing validator
│   └── run-all-validations.js      # Comprehensive validation runner
└── README.md                       # This file
```

## Validation Scripts

### 1. Cloud System Purity Validator (`validate-cloud-purity.js`)

**Purpose**: Ensures the cloud system contains no OS-specific dependencies that would prevent Vercel deployment.

**Validates**:
- Package.json dependencies for forbidden OS-specific modules
- Source code for OS API usage (fs, path, os, child_process)
- Build output for server-side OS dependencies
- Environment variables for Windows-specific paths

**Usage**:
```bash
node deployment/scripts/validate-cloud-purity.js
```

**Requirements Validated**: 1.4, 1.5

### 2. Agent System Self-Containment Validator (`validate-agent-self-contained.js`)

**Purpose**: Validates that the agent system is self-contained and ready for MSI packaging.

**Validates**:
- Required Windows Service components
- SQLite database schema and migrations
- NPM package dependencies bundling
- Offline operation capability
- Service installation scripts

**Usage**:
```bash
node deployment/scripts/validate-agent-self-contained.js
```

**Requirements Validated**: 1.5, 5.3

### 3. Schema Publishing Validator (`validate-schema-publishing.js`)

**Purpose**: Ensures shared packages can be successfully published to npm and consumed by both systems.

**Validates**:
- Package structure and metadata
- Build output completeness
- Dependency resolution
- NPM publish readiness (dry run)
- Import/consumption capability

**Usage**:
```bash
node deployment/scripts/validate-schema-publishing.js
```

**Requirements Validated**: 5.3

### 4. Comprehensive Validation Runner (`run-all-validations.js`)

**Purpose**: Runs all validation scripts and provides a comprehensive deployment readiness report.

**Features**:
- Parallel execution of validation scripts
- Comprehensive summary reporting
- CI/CD integration support
- Detailed error reporting and recommendations

**Usage**:
```bash
node deployment/scripts/run-all-validations.js
```

## Deployment Pipelines

### Cloud System (Vercel)

The cloud system deploys to Vercel using the configuration in `cloud/vercel.json`:

- **Apps**: Customer PWA and Staff Dashboard
- **Packages**: Pure business logic packages only
- **Build**: Automated package building and transpilation
- **Validation**: Automatic purity validation in CI/CD

**GitHub Actions Workflow**: `cloud/github-actions.yml`
- Validates cloud purity before deployment
- Builds and tests all packages
- Deploys to Vercel preview/production environments

### Agent System (MSI Installer)

The agent system packages as a Windows MSI installer:

- **Components**: Windows Service, SQLite database, NPM packages
- **Installation**: Automated service registration and configuration
- **Updates**: Version-aware schema consumption
- **Offline**: Full offline operation capability

**Specification**: `agent/msi-installer-spec.md`

### Shared Packages (NPM Registry)

Shared packages publish to npm registry for consumption by both systems:

- **Publishing Order**: Dependencies-first publishing
- **Versioning**: Independent semantic versioning
- **Distribution**: Public npm registry with CDN mirrors
- **Security**: Package signing and vulnerability scanning

**Configuration**: `packages/npm-publishing-config.json`
**Scripts**: `packages/publish-packages.sh` (Unix) / `packages/publish-packages.ps1` (Windows)

## Usage Examples

### Development Workflow

1. **Validate cloud system purity**:
   ```bash
   node deployment/scripts/validate-cloud-purity.js
   ```

2. **Build and validate packages**:
   ```bash
   pnpm run build:packages
   node deployment/scripts/validate-schema-publishing.js
   ```

3. **Run comprehensive validation**:
   ```bash
   node deployment/scripts/run-all-validations.js
   ```

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Validate Deployment Readiness
  run: node deployment/scripts/run-all-validations.js
  
- name: Publish Packages (if validation passes)
  run: ./deployment/packages/publish-packages.sh
  if: success()
```

### Package Publishing

**Dry run** (test without publishing):
```bash
DRY_RUN=true node deployment/scripts/validate-schema-publishing.js
```

**Publish packages**:
```bash
# Unix/Linux/macOS
./deployment/packages/publish-packages.sh

# Windows PowerShell
.\deployment\packages\publish-packages.ps1
```

## Configuration

### Environment Variables

- `NPM_REGISTRY`: NPM registry URL (default: https://registry.npmjs.org/)
- `DRY_RUN`: Set to 'true' for testing without actual publishing
- `VERCEL_TOKEN`: Vercel deployment token (for CI/CD)
- `NPM_TOKEN`: NPM authentication token (for publishing)

### Validation Configuration

Validation scripts use configuration files:
- `packages/npm-publishing-config.json`: Package publishing settings
- `cloud/vercel.json`: Vercel deployment settings
- Individual package.json files: Package-specific settings

## Error Handling

### Common Issues

1. **Cloud System Purity Violations**:
   - Remove OS-specific dependencies from cloud packages
   - Use Next.js APIs instead of Node.js APIs where possible
   - Move OS-dependent code to agent system

2. **Agent System Missing Components**:
   - Ensure all required Windows Service files are present
   - Verify SQLite schema and migration files exist
   - Check NPM package bundling is complete

3. **Schema Publishing Failures**:
   - Verify package.json metadata is complete
   - Ensure build outputs exist (run `pnpm run build:packages`)
   - Check NPM authentication (`npm whoami`)

### Troubleshooting

1. **Check validation results**:
   ```bash
   cat deployment/validation-summary.json
   ```

2. **Run individual validations**:
   ```bash
   node deployment/scripts/validate-cloud-purity.js
   node deployment/scripts/validate-schema-publishing.js
   ```

3. **Verify build outputs**:
   ```bash
   pnpm run build:packages
   ls -la packages/*/dist/
   ```

## Integration with Architectural Restructure

This deployment validation system supports the TABEZA architectural restructure by:

1. **Enforcing Boundaries**: Validates clean separation between cloud and agent systems
2. **Ensuring Portability**: Verifies packages can be consumed across system boundaries
3. **Deployment Independence**: Validates each system can deploy independently
4. **Quality Assurance**: Provides comprehensive validation before deployment

The validation system is designed to be run continuously during development and as part of CI/CD pipelines to ensure architectural integrity is maintained throughout the restructure process.

## Future Enhancements

- **Performance Testing**: Add performance validation for package loading
- **Security Scanning**: Integrate vulnerability scanning for dependencies
- **Cross-Platform Testing**: Validate packages work across different Node.js versions
- **Documentation Generation**: Auto-generate API documentation from validated packages