# TABEZA Architectural Restructure Rollback Procedures

This directory contains rollback procedures for the TABEZA architectural restructure migration. These procedures allow you to safely revert changes if issues are encountered during the migration process.

## Overview

The architectural restructure involves several phases, each with its own rollback procedure:

1. **Pure Logic Extraction** - Rollback extracted packages to original locations
2. **Infrastructure Removal** - Restore removed infrastructure components
3. **Package Publishing** - Unpublish packages and revert to workspace dependencies
4. **Build Configuration** - Restore original build and deployment configurations
5. **Agent Repository Creation** - Remove agent repository and restore components

## Rollback Phases

### Phase 1: Pure Logic Extraction Rollback
- **File**: `rollback-pure-logic-extraction.js`
- **Purpose**: Restore extracted pure logic to original packages
- **Safety**: High - only moves code, doesn't delete

### Phase 2: Infrastructure Component Rollback  
- **File**: `rollback-infrastructure-removal.js`
- **Purpose**: Restore removed infrastructure components
- **Safety**: Medium - requires backup restoration

### Phase 3: Package Publishing Rollback
- **File**: `rollback-package-publishing.js` 
- **Purpose**: Unpublish packages and revert dependencies
- **Safety**: High - npm packages can be unpublished

### Phase 4: Build Configuration Rollback
- **File**: `rollback-build-configuration.js`
- **Purpose**: Restore original build and deployment configs
- **Safety**: High - configuration files are backed up

### Phase 5: Agent Repository Rollback
- **File**: `rollback-agent-repository.js`
- **Purpose**: Remove agent repository and restore components
- **Safety**: Medium - requires careful git history handling

## Usage

### Quick Rollback (All Phases)
```bash
node deployment/rollback/rollback-all-phases.js
```

### Selective Rollback
```bash
# Rollback specific phase
node deployment/rollback/rollback-pure-logic-extraction.js
node deployment/rollback/rollback-infrastructure-removal.js
node deployment/rollback/rollback-package-publishing.js
node deployment/rollback/rollback-build-configuration.js
node deployment/rollback/rollback-agent-repository.js
```

### Validation After Rollback
```bash
# Validate rollback was successful
node deployment/rollback/validate-rollback.js
```

## Safety Measures

1. **Automatic Backups**: All rollback scripts create backups before making changes
2. **Validation**: Each rollback script validates the current state before proceeding
3. **Dry Run Mode**: All scripts support `--dry-run` flag for testing
4. **Incremental Rollback**: Rollback can be performed phase by phase
5. **Rollback Validation**: Comprehensive validation ensures rollback success

## Prerequisites

- Git repository must be clean (no uncommitted changes)
- Node.js and pnpm must be installed
- All migration backups must be present
- Network access for npm operations (if needed)

## Emergency Procedures

If automated rollback fails:

1. **Manual Git Reset**: `git reset --hard <pre-migration-commit>`
2. **Restore from Backup**: Copy files from `deployment/rollback/backups/`
3. **Clean Install**: Delete `node_modules` and run `pnpm install`
4. **Validate System**: Run full test suite to ensure functionality

## Backup Locations

- **Code Backups**: `deployment/rollback/backups/code/`
- **Configuration Backups**: `deployment/rollback/backups/config/`
- **Package Backups**: `deployment/rollback/backups/packages/`
- **Git History**: `deployment/rollback/backups/git/`

## Support

If rollback procedures fail or you encounter issues:

1. Check the rollback logs in `deployment/rollback/logs/`
2. Review the validation results
3. Consult the troubleshooting guide
4. Contact the development team with error details

## Testing Rollback Procedures

Rollback procedures should be tested in a safe environment:

```bash
# Test rollback in isolated environment
node deployment/rollback/test-rollback-procedures.js
```

This creates a temporary copy of the repository and tests all rollback procedures without affecting the main codebase.