# Agent Repository Structure Design

## Overview

This document outlines the planned directory structure, package.json configuration, and npm linking strategy for the Windows agent repository that will be extracted from the current TABEZA monorepo.

## Repository Structure

```
tabeza-agent/
├── README.md                           # Agent system overview and setup
├── package.json                        # Root package configuration
├── tsconfig.json                       # TypeScript configuration
├── .gitignore                          # Git ignore patterns
├── .env.example                        # Environment variables template
├── installer/                          # MSI installer configuration
│   ├── installer.wxs                   # WiX installer definition
│   ├── build-installer.ps1             # PowerShell build script
│   └── assets/                         # Installer assets (icons, etc.)
├── src/                                # Source code
│   ├── main.ts                         # Application entry point
│   ├── service/                        # Windows Service components
│   │   ├── WindowsService.ts           # Service lifecycle management
│   │   ├── ServiceInstaller.ts         # Service installation utilities
│   │   └── ServiceController.ts        # Service control operations
│   ├── print/                          # Print spooler integration
│   │   ├── SpoolerMonitor.ts           # Print spooler monitoring
│   │   ├── PrintCapture.ts             # Print job capture engine
│   │   ├── PrinterDriver.ts            # Printer driver communication
│   │   └── JobQueue.ts                 # Print job queue management
│   ├── processing/                     # Receipt processing
│   │   ├── ReceiptProcessor.ts         # Main processing logic
│   │   ├── SessionManager.ts           # Receipt session correlation
│   │   ├── DataValidator.ts            # Data validation and enrichment
│   │   └── ConfidenceScorer.ts         # Parsing confidence scoring
│   ├── storage/                        # Local data persistence
│   │   ├── Database.ts                 # SQLite database wrapper
│   │   ├── migrations/                 # Database schema migrations
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_sync_queue.sql
│   │   │   └── migration-runner.ts
│   │   ├── models/                     # Database models
│   │   │   ├── LocalReceiptJob.ts
│   │   │   ├── SyncQueueItem.ts
│   │   │   └── AgentConfig.ts
│   │   └── backup/                     # Backup and recovery
│   │       ├── BackupManager.ts
│   │       └── RecoveryManager.ts
│   ├── sync/                           # Cloud synchronization
│   │   ├── SyncManager.ts              # Main sync orchestrator
│   │   ├── QueueManager.ts             # Offline queue management
│   │   ├── CloudApiClient.ts           # Cloud API communication
│   │   ├── RetryManager.ts             # Retry logic with backoff
│   │   └── ConnectionMonitor.ts        # Network connectivity monitoring
│   ├── schema/                         # Schema consumption
│   │   ├── SchemaConsumer.ts           # npm package consumption
│   │   ├── VersionChecker.ts           # Version compatibility checking
│   │   ├── MigrationExecutor.ts        # Schema migration execution
│   │   └── UpdateManager.ts            # Automatic schema updates
│   ├── health/                         # Health monitoring
│   │   ├── HealthMonitor.ts            # System health monitoring
│   │   ├── DiagnosticsCollector.ts     # Diagnostic data collection
│   │   ├── MetricsReporter.ts          # Performance metrics reporting
│   │   └── RecoveryManager.ts          # Automatic recovery procedures
│   ├── config/                         # Configuration management
│   │   ├── ConfigManager.ts            # Configuration file management
│   │   ├── EnvironmentValidator.ts     # Environment validation
│   │   └── defaults.json               # Default configuration values
│   └── utils/                          # Utility functions
│       ├── Logger.ts                   # Logging utilities
│       ├── ErrorHandler.ts             # Error handling utilities
│       ├── WindowsEventLog.ts          # Windows Event Log integration
│       └── FileSystemUtils.ts          # File system utilities
├── tests/                              # Test suites
│   ├── unit/                           # Unit tests
│   │   ├── service/                    # Service layer tests
│   │   ├── print/                      # Print integration tests
│   │   ├── processing/                 # Processing logic tests
│   │   ├── storage/                    # Storage layer tests
│   │   └── sync/                       # Sync logic tests
│   ├── integration/                    # Integration tests
│   │   ├── end-to-end/                 # E2E workflow tests
│   │   ├── cloud-sync/                 # Cloud synchronization tests
│   │   └── schema-compatibility/       # Schema version tests
│   ├── fixtures/                       # Test data and fixtures
│   │   ├── sample-receipts/            # Sample receipt data
│   │   ├── mock-print-jobs/            # Mock print job data
│   │   └── test-schemas/               # Test schema versions
│   └── helpers/                        # Test helper utilities
│       ├── MockPrintSpooler.ts         # Print spooler mocking
│       ├── TestDatabase.ts             # Test database utilities
│       └── CloudApiMock.ts             # Cloud API mocking
├── docs/                               # Documentation
│   ├── installation.md                 # Installation guide
│   ├── configuration.md                # Configuration reference
│   ├── troubleshooting.md              # Troubleshooting guide
│   ├── api-reference.md                # Internal API reference
│   └── architecture.md                 # Agent architecture overview
├── scripts/                            # Build and deployment scripts
│   ├── build.ps1                       # Build script
│   ├── test.ps1                        # Test execution script
│   ├── package.ps1                     # Packaging script
│   └── deploy.ps1                      # Deployment script
└── node_modules/                       # npm dependencies
```

## Package.json Configuration

```json
{
  "name": "tabeza-agent",
  "version": "1.0.0",
  "description": "Windows agent for TABEZA receipt processing system",
  "main": "dist/main.js",
  "private": true,
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "os": ["win32"],
  "cpu": ["x64", "ia32"],
  "scripts": {
    "build": "tsc && npm run copy-assets",
    "build:prod": "tsc --build --clean && tsc && npm run copy-assets",
    "copy-assets": "xcopy src\\assets dist\\assets /E /I /Y",
    "start": "node dist/main.js",
    "dev": "ts-node src/main.ts",
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "service:install": "node dist/main.js --install",
    "service:uninstall": "node dist/main.js --uninstall",
    "service:start": "node dist/main.js --start",
    "service:stop": "node dist/main.js --stop",
    "installer:build": "powershell -ExecutionPolicy Bypass -File installer/build-installer.ps1",
    "schema:update": "npm update @tabeza/receipt-schema @tabeza/escpos-parser @tabeza/tax-rules @tabeza/validation",
    "schema:check": "node dist/schema/VersionChecker.js",
    "backup:create": "node dist/storage/backup/BackupManager.js --create",
    "backup:restore": "node dist/storage/backup/RecoveryManager.js --restore",
    "diagnostics": "node dist/health/DiagnosticsCollector.js --full-report"
  },
  "dependencies": {
    "@tabeza/receipt-schema": "^1.0.0",
    "@tabeza/escpos-parser": "^1.0.0",
    "@tabeza/tax-rules": "^1.0.0",
    "@tabeza/validation": "^1.0.0",
    "sqlite3": "^5.1.6",
    "node-windows": "^1.0.0-beta.8",
    "axios": "^1.6.0",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1",
    "node-cron": "^3.0.3",
    "semver": "^7.5.4",
    "zod": "^3.22.4",
    "dotenv": "^16.3.1",
    "lodash": "^4.17.21",
    "retry": "^0.13.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/lodash": "^4.14.202",
    "@types/retry": "^0.12.5",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.1",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "ts-jest": "^29.1.1",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.1",
    "@typescript-eslint/parser": "^6.13.1",
    "fast-check": "^3.15.0",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16"
  },
  "keywords": [
    "tabeza",
    "receipt-processing",
    "windows-service",
    "print-spooler",
    "pos-integration"
  ],
  "author": "TABEZA Team",
  "license": "UNLICENSED",
  "repository": {
    "type": "git",
    "url": "https://github.com/tabeza/tabeza-agent.git"
  },
  "bugs": {
    "url": "https://github.com/tabeza/tabeza-agent/issues"
  },
  "homepage": "https://github.com/tabeza/tabeza-agent#readme"
}
```

## NPM Linking Strategy

### Development Scenario

For local development where both cloud system and agent system are being developed simultaneously:

1. **Schema Development Linking**:
   ```bash
   # In cloud system (tabeza monorepo)
   cd packages/receipt-schema
   npm link
   
   # In agent system
   npm link @tabeza/receipt-schema
   ```

2. **Pure Logic Package Linking**:
   ```bash
   # Link all pure logic packages for development
   cd packages/escpos-parser && npm link
   cd packages/tax-rules && npm link
   cd packages/validation && npm link
   
   # In agent system
   npm link @tabeza/escpos-parser
   npm link @tabeza/tax-rules
   npm link @tabeza/validation
   ```

3. **Development Workflow**:
   - Changes in cloud system packages are immediately available in agent
   - No need to publish packages during development
   - Hot reloading works across repository boundaries
   - Version compatibility checking disabled in development mode

### Production Scenario

For production deployments where packages are consumed from npm registry:

1. **Package Publication**:
   ```bash
   # Publish from cloud system
   cd packages/receipt-schema && npm publish
   cd packages/escpos-parser && npm publish
   cd packages/tax-rules && npm publish
   cd packages/validation && npm publish
   ```

2. **Agent Installation**:
   ```bash
   # Install published packages
   npm install @tabeza/receipt-schema@latest
   npm install @tabeza/escpos-parser@latest
   npm install @tabeza/tax-rules@latest
   npm install @tabeza/validation@latest
   ```

3. **Version Management**:
   - Semantic versioning for all shared packages
   - Agent validates compatibility on startup
   - Automatic update notifications for new versions
   - Graceful degradation for version mismatches

### Hybrid Scenario

For scenarios where some packages are linked and others are published:

1. **Selective Linking**:
   ```bash
   # Link only schema for active development
   npm link @tabeza/receipt-schema
   
   # Use published versions for stable packages
   npm install @tabeza/escpos-parser@1.2.3
   npm install @tabeza/tax-rules@1.1.0
   npm install @tabeza/validation@1.0.5
   ```

2. **Configuration Management**:
   - Environment variable to control linking behavior
   - Development vs production package resolution
   - Automatic detection of linked vs installed packages

## Build and Deployment Configuration

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

### Environment Configuration

```bash
# .env.example
# Agent Configuration
AGENT_ID=tabeza-agent-001
AGENT_NAME=TABEZA Receipt Agent
AGENT_VERSION=1.0.0

# Cloud System Integration
CLOUD_API_BASE_URL=https://api.tabeza.com
CLOUD_API_KEY=your-api-key-here
CLOUD_SYNC_INTERVAL=30000

# Database Configuration
DATABASE_PATH=./data/agent.db
DATABASE_BACKUP_INTERVAL=3600000
DATABASE_MAX_SIZE_MB=100

# Print Spooler Configuration
PRINT_SPOOLER_MONITOR_INTERVAL=1000
PRINT_JOB_TIMEOUT=30000
SUPPORTED_PRINTERS=*

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs/agent.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Health Monitoring
HEALTH_CHECK_INTERVAL=60000
METRICS_REPORTING_INTERVAL=300000
RECOVERY_MAX_ATTEMPTS=3

# Schema Management
SCHEMA_UPDATE_CHECK_INTERVAL=86400000
SCHEMA_COMPATIBILITY_MODE=strict
AUTO_SCHEMA_UPDATES=false
```

## Key Design Decisions

### 1. Windows-First Architecture
- Optimized for Windows Service deployment
- Native Windows Event Log integration
- PowerShell scripts for administration
- MSI installer for professional deployment

### 2. Offline-First Design
- Local SQLite database for persistence
- Queue-based synchronization with retry logic
- Graceful degradation during network outages
- Priority-based sync for critical data

### 3. Modular Component Architecture
- Clear separation of concerns
- Dependency injection for testability
- Plugin-like architecture for extensibility
- Clean interfaces between layers

### 4. Schema-Driven Development
- npm packages as single source of truth
- Version compatibility validation
- Automatic migration support
- Development vs production linking strategies

### 5. Production-Ready Operations
- Comprehensive logging and monitoring
- Health checks and diagnostics
- Backup and recovery procedures
- Professional installer and service management

This structure ensures the agent system is completely self-contained while maintaining clean integration with the cloud system through well-defined interfaces and shared schema packages.