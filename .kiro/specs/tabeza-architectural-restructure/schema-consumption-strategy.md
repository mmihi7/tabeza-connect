# Schema Consumption Strategy for Agent System

## Overview

This document outlines the comprehensive strategy for how the Windows agent system will consume npm packages from the cloud system, including package consumption approach, version compatibility checking, and local development linking strategy.

## NPM Package Consumption Approach

### Package Architecture

The agent system will consume the following npm packages from the cloud system:

1. **@tabeza/receipt-schema** - Core data models and validation schemas
2. **@tabeza/escpos-parser** - Pure ESC/POS parsing logic
3. **@tabeza/tax-rules** - KRA compliance and tax calculation logic
4. **@tabeza/validation** - Cross-system validation utilities

### Package Resolution Strategy

#### Production Environment
```typescript
// package.json dependencies
{
  "dependencies": {
    "@tabeza/receipt-schema": "^1.0.0",
    "@tabeza/escpos-parser": "^1.0.0", 
    "@tabeza/tax-rules": "^1.0.0",
    "@tabeza/validation": "^1.0.0"
  }
}
```

#### Development Environment
```typescript
// package.json with local linking support
{
  "dependencies": {
    "@tabeza/receipt-schema": "file:../tabeza-cloud/packages/receipt-schema",
    "@tabeza/escpos-parser": "file:../tabeza-cloud/packages/escpos-parser",
    "@tabeza/tax-rules": "file:../tabeza-cloud/packages/tax-rules", 
    "@tabeza/validation": "file:../tabeza-cloud/packages/validation"
  }
}
```

### Schema Consumer Implementation

#### SchemaConsumer.ts
```typescript
interface PackageInfo {
  name: string;
  version: string;
  publishedAt: Date;
  dependencies: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

interface ConsumptionConfig {
  packages: string[];
  registryUrl: string;
  authToken?: string;
  updateCheckInterval: number;
  autoUpdate: boolean;
  compatibilityMode: 'strict' | 'loose' | 'development';
  fallbackVersions: Record<string, string>;
}

class SchemaConsumer {
  private config: ConsumptionConfig;
  private installedPackages: Map<string, PackageInfo>;
  private updateChecker: NodeJS.Timer;
  
  constructor(config: ConsumptionConfig);
  
  // Package lifecycle management
  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;
  
  // Package installation and updates
  async installPackage(packageName: string, version?: string): Promise<InstallResult>;
  async updatePackage(packageName: string, targetVersion?: string): Promise<UpdateResult>;
  async updateAllPackages(): Promise<UpdateAllResult>;
  async uninstallPackage(packageName: string): Promise<void>;
  
  // Package information and status
  async getInstalledVersion(packageName: string): Promise<string | null>;
  async getLatestVersion(packageName: string): Promise<string>;
  async getPackageInfo(packageName: string): Promise<PackageInfo>;
  async listInstalledPackages(): Promise<PackageInfo[]>;
  
  // Update checking and notifications
  async checkForUpdates(): Promise<UpdateCheckResult>;
  async enableAutoUpdates(): Promise<void>;
  async disableAutoUpdates(): Promise<void>;
  
  // Development support
  async linkLocalPackage(packageName: string, localPath: string): Promise<void>;
  async unlinkLocalPackage(packageName: string): Promise<void>;
  async isLinkedLocally(packageName: string): Promise<boolean>;
  
  // Event handling
  onPackageInstalled(handler: (packageName: string, version: string) => void): void;
  onPackageUpdated(handler: (packageName: string, oldVersion: string, newVersion: string) => void): void;
  onUpdateAvailable(handler: (packageName: string, currentVersion: string, latestVersion: string) => void): void;
  onInstallError(handler: (packageName: string, error: Error) => void): void;
}

interface InstallResult {
  success: boolean;
  packageName: string;
  version: string;
  installPath: string;
  dependencies: string[];
  warnings: string[];
  errors: string[];
}

interface UpdateResult {
  success: boolean;
  packageName: string;
  oldVersion: string;
  newVersion: string;
  changesApplied: string[];
  migrationRequired: boolean;
  warnings: string[];
  errors: string[];
}

interface UpdateCheckResult {
  hasUpdates: boolean;
  availableUpdates: Array<{
    packageName: string;
    currentVersion: string;
    latestVersion: string;
    updateType: 'major' | 'minor' | 'patch';
    breaking: boolean;
    releaseNotes?: string;
  }>;
}
```

## Version Compatibility Checking

### Compatibility Matrix

```typescript
interface CompatibilityMatrix {
  agentVersion: string;
  supportedSchemaVersions: VersionRange[];
  supportedParserVersions: VersionRange[];
  supportedTaxRulesVersions: VersionRange[];
  supportedValidationVersions: VersionRange[];
  deprecatedVersions: string[];
  blockedVersions: string[];
}

interface VersionRange {
  min: string;
  max: string;
  inclusive: boolean;
}

// Example compatibility matrix
const COMPATIBILITY_MATRIX: CompatibilityMatrix = {
  agentVersion: "1.0.0",
  supportedSchemaVersions: [
    { min: "1.0.0", max: "1.9.9", inclusive: true },
    { min: "2.0.0", max: "2.2.9", inclusive: true }
  ],
  supportedParserVersions: [
    { min: "1.0.0", max: "1.9.9", inclusive: true }
  ],
  supportedTaxRulesVersions: [
    { min: "1.0.0", max: "1.9.9", inclusive: true }
  ],
  supportedValidationVersions: [
    { min: "1.0.0", max: "1.9.9", inclusive: true }
  ],
  deprecatedVersions: ["1.0.0", "1.1.0"],
  blockedVersions: ["1.0.5", "1.2.3"] // Known broken versions
};
```

### Version Checker Implementation

#### VersionChecker.ts
```typescript
interface CompatibilityCheckResult {
  compatible: boolean;
  packageName: string;
  currentVersion: string;
  agentVersion: string;
  issues: CompatibilityIssue[];
  recommendations: string[];
}

interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  affectedFeatures?: string[];
  resolution?: string;
  migrationRequired?: boolean;
}

class VersionChecker {
  private compatibilityMatrix: CompatibilityMatrix;
  private agentVersion: string;
  
  constructor(agentVersion: string, compatibilityMatrix: CompatibilityMatrix);
  
  // Compatibility checking
  async checkPackageCompatibility(packageName: string, version: string): Promise<CompatibilityCheckResult>;
  async checkAllPackagesCompatibility(): Promise<CompatibilityCheckResult[]>;
  async validateSystemCompatibility(): Promise<SystemCompatibilityResult>;
  
  // Version analysis
  async analyzeVersionDifference(packageName: string, fromVersion: string, toVersion: string): Promise<VersionAnalysis>;
  async getBreakingChanges(packageName: string, fromVersion: string, toVersion: string): Promise<BreakingChange[]>;
  async getMigrationPath(packageName: string, fromVersion: string, toVersion: string): Promise<MigrationPath>;
  
  // Version recommendations
  async getRecommendedVersion(packageName: string): Promise<string>;
  async getUpgradePath(packageName: string, targetVersion?: string): Promise<UpgradePath>;
  async getSafeUpdateVersions(packageName: string): Promise<string[]>;
  
  // Compatibility matrix management
  async updateCompatibilityMatrix(matrix: CompatibilityMatrix): Promise<void>;
  async validateCompatibilityMatrix(): Promise<ValidationResult>;
  getCompatibilityMatrix(): CompatibilityMatrix;
  
  // Utility methods
  isVersionInRange(version: string, range: VersionRange): boolean;
  isVersionDeprecated(packageName: string, version: string): boolean;
  isVersionBlocked(packageName: string, version: string): boolean;
  compareVersions(version1: string, version2: string): number;
}

interface SystemCompatibilityResult {
  compatible: boolean;
  overallHealth: 'healthy' | 'warning' | 'critical';
  packageResults: CompatibilityCheckResult[];
  systemIssues: CompatibilityIssue[];
  recommendedActions: string[];
}

interface VersionAnalysis {
  updateType: 'major' | 'minor' | 'patch';
  breaking: boolean;
  newFeatures: string[];
  bugFixes: string[];
  deprecations: string[];
  removals: string[];
  securityFixes: string[];
}

interface BreakingChange {
  type: 'api' | 'schema' | 'behavior' | 'dependency';
  description: string;
  affectedComponents: string[];
  migrationRequired: boolean;
  migrationInstructions?: string;
}

interface MigrationPath {
  required: boolean;
  steps: MigrationStep[];
  estimatedDuration: number; // minutes
  riskLevel: 'low' | 'medium' | 'high';
  rollbackPossible: boolean;
}

interface MigrationStep {
  order: number;
  description: string;
  type: 'automatic' | 'manual' | 'verification';
  command?: string;
  validation?: string;
  rollbackCommand?: string;
}
```

### Startup Validation Process

#### StartupValidator.ts
```typescript
class StartupValidator {
  private versionChecker: VersionChecker;
  private schemaConsumer: SchemaConsumer;
  
  constructor(versionChecker: VersionChecker, schemaConsumer: SchemaConsumer);
  
  // Startup validation sequence
  async validateStartup(): Promise<StartupValidationResult>;
  async performPreStartupChecks(): Promise<PreStartupCheckResult>;
  async validatePackageIntegrity(): Promise<IntegrityCheckResult>;
  async validateSchemaCompatibility(): Promise<SchemaCompatibilityResult>;
  
  // Error handling and recovery
  async handleCompatibilityErrors(errors: CompatibilityIssue[]): Promise<RecoveryResult>;
  async attemptAutomaticRecovery(): Promise<RecoveryResult>;
  async generateRecoveryPlan(issues: CompatibilityIssue[]): Promise<RecoveryPlan>;
  
  // User interaction
  async promptUserForAction(issue: CompatibilityIssue): Promise<UserAction>;
  async displayCompatibilityReport(result: SystemCompatibilityResult): Promise<void>;
  async confirmMigration(migrationPath: MigrationPath): Promise<boolean>;
}

interface StartupValidationResult {
  success: boolean;
  canStart: boolean;
  issues: CompatibilityIssue[];
  warnings: string[];
  recoveryActions: RecoveryAction[];
  userInteractionRequired: boolean;
}

interface RecoveryAction {
  type: 'update_package' | 'downgrade_package' | 'install_missing' | 'migrate_data' | 'reset_config';
  description: string;
  automatic: boolean;
  command?: string;
  confirmation?: string;
}

interface UserAction {
  action: 'continue' | 'update' | 'downgrade' | 'abort' | 'ignore';
  packageName?: string;
  targetVersion?: string;
  confirmed: boolean;
}
```

## Local Development Linking Strategy

### Development Environment Setup

#### Development Configuration
```typescript
interface DevelopmentConfig {
  cloudSystemPath: string;
  linkingMode: 'npm_link' | 'file_reference' | 'symlink';
  watchForChanges: boolean;
  autoRestart: boolean;
  hotReload: boolean;
  developmentPackages: string[];
}

class DevelopmentLinker {
  private config: DevelopmentConfig;
  private linkedPackages: Map<string, LinkInfo>;
  private fileWatchers: Map<string, fs.FSWatcher>;
  
  constructor(config: DevelopmentConfig);
  
  // Development linking
  async setupDevelopmentEnvironment(): Promise<void>;
  async linkAllPackages(): Promise<LinkResult[]>;
  async linkPackage(packageName: string): Promise<LinkResult>;
  async unlinkPackage(packageName: string): Promise<void>;
  async unlinkAllPackages(): Promise<void>;
  
  // File watching and hot reload
  async enableHotReload(): Promise<void>;
  async disableHotReload(): Promise<void>;
  async restartOnChanges(packageName: string): Promise<void>;
  
  // Development utilities
  async validateLinkIntegrity(): Promise<LinkValidationResult>;
  async syncPackageVersions(): Promise<void>;
  async generateDevelopmentReport(): Promise<DevelopmentReport>;
  
  // Environment switching
  async switchToProduction(): Promise<void>;
  async switchToDevelopment(): Promise<void>;
  async getCurrentMode(): Promise<'development' | 'production'>;
}

interface LinkInfo {
  packageName: string;
  localPath: string;
  linkedAt: Date;
  method: 'npm_link' | 'file_reference' | 'symlink';
  watching: boolean;
}

interface LinkResult {
  success: boolean;
  packageName: string;
  method: string;
  localPath: string;
  errors: string[];
  warnings: string[];
}
```

### Development Workflow Scripts

#### Development Scripts (package.json)
```json
{
  "scripts": {
    "dev:setup": "node scripts/setup-development.js",
    "dev:link": "node scripts/link-packages.js",
    "dev:unlink": "node scripts/unlink-packages.js",
    "dev:watch": "node scripts/watch-packages.js",
    "dev:sync": "node scripts/sync-versions.js",
    "dev:validate": "node scripts/validate-links.js",
    "dev:switch-prod": "node scripts/switch-to-production.js",
    "dev:switch-dev": "node scripts/switch-to-development.js",
    "dev:status": "node scripts/development-status.js"
  }
}
```

#### setup-development.js
```javascript
const { DevelopmentLinker } = require('../dist/development/DevelopmentLinker');
const config = require('../config/development.json');

async function setupDevelopment() {
  const linker = new DevelopmentLinker(config);
  
  console.log('Setting up development environment...');
  
  try {
    await linker.setupDevelopmentEnvironment();
    const results = await linker.linkAllPackages();
    
    console.log('Development environment setup complete:');
    results.forEach(result => {
      if (result.success) {
        console.log(`✓ ${result.packageName} linked successfully`);
      } else {
        console.log(`✗ ${result.packageName} failed to link:`, result.errors);
      }
    });
    
    if (config.watchForChanges) {
      await linker.enableHotReload();
      console.log('Hot reload enabled');
    }
    
  } catch (error) {
    console.error('Failed to setup development environment:', error);
    process.exit(1);
  }
}

setupDevelopment();
```

### Package Update Automation

#### UpdateManager.ts
```typescript
interface UpdatePolicy {
  autoUpdate: boolean;
  updateSchedule: string; // cron expression
  updateTypes: ('major' | 'minor' | 'patch')[];
  requireConfirmation: boolean;
  backupBeforeUpdate: boolean;
  rollbackOnFailure: boolean;
  notificationChannels: string[];
}

class UpdateManager {
  private policy: UpdatePolicy;
  private scheduler: NodeJS.Timer;
  private schemaConsumer: SchemaConsumer;
  private versionChecker: VersionChecker;
  
  constructor(policy: UpdatePolicy, schemaConsumer: SchemaConsumer, versionChecker: VersionChecker);
  
  // Update scheduling
  async startScheduledUpdates(): Promise<void>;
  async stopScheduledUpdates(): Promise<void>;
  async scheduleUpdate(packageName: string, targetVersion: string, scheduledAt: Date): Promise<void>;
  
  // Update execution
  async performScheduledUpdate(): Promise<UpdateExecutionResult>;
  async updatePackage(packageName: string, targetVersion?: string): Promise<UpdateResult>;
  async updateAllPackages(): Promise<UpdateAllResult>;
  
  // Update validation and rollback
  async validateUpdate(packageName: string, newVersion: string): Promise<UpdateValidationResult>;
  async rollbackUpdate(packageName: string): Promise<RollbackResult>;
  async createUpdateBackup(): Promise<BackupResult>;
  
  // Notification and reporting
  async notifyUpdateAvailable(updates: UpdateCheckResult): Promise<void>;
  async notifyUpdateCompleted(results: UpdateResult[]): Promise<void>;
  async generateUpdateReport(): Promise<UpdateReport>;
  
  // Policy management
  updatePolicy(policy: Partial<UpdatePolicy>): Promise<void>;
  getPolicy(): UpdatePolicy;
}

interface UpdateExecutionResult {
  success: boolean;
  updatesApplied: UpdateResult[];
  updatesFailed: UpdateResult[];
  rollbacksPerformed: RollbackResult[];
  totalDuration: number;
  nextScheduledUpdate?: Date;
}
```

## Error Handling and Recovery

### Schema Compatibility Error Handling

```typescript
class SchemaErrorHandler {
  private recoveryStrategies: Map<string, RecoveryStrategy>;
  
  constructor();
  
  // Error classification
  classifyError(error: Error): ErrorClassification;
  
  // Recovery strategies
  async handleVersionMismatch(packageName: string, expectedVersion: string, actualVersion: string): Promise<RecoveryResult>;
  async handleMissingPackage(packageName: string): Promise<RecoveryResult>;
  async handleCorruptedPackage(packageName: string): Promise<RecoveryResult>;
  async handleNetworkError(operation: string): Promise<RecoveryResult>;
  
  // Fallback mechanisms
  async useFallbackVersion(packageName: string): Promise<boolean>;
  async enableCompatibilityMode(): Promise<void>;
  async disableNonEssentialFeatures(): Promise<void>;
  
  // User guidance
  async generateErrorReport(error: Error): Promise<ErrorReport>;
  async suggestResolution(error: Error): Promise<ResolutionSuggestion>;
}

interface ErrorClassification {
  category: 'version' | 'network' | 'corruption' | 'permission' | 'configuration';
  severity: 'critical' | 'high' | 'medium' | 'low';
  recoverable: boolean;
  userActionRequired: boolean;
}

interface RecoveryStrategy {
  name: string;
  description: string;
  automatic: boolean;
  execute: () => Promise<RecoveryResult>;
  validate: () => Promise<boolean>;
  rollback?: () => Promise<void>;
}
```

## Configuration Management

### Schema Configuration

```typescript
interface SchemaConfig {
  packages: {
    [packageName: string]: {
      version: string;
      source: 'npm' | 'local' | 'git';
      localPath?: string;
      gitUrl?: string;
      gitBranch?: string;
      updatePolicy: 'auto' | 'manual' | 'scheduled';
      compatibility: 'strict' | 'loose';
    };
  };
  registry: {
    url: string;
    authToken?: string;
    timeout: number;
    retries: number;
  };
  development: {
    enabled: boolean;
    cloudSystemPath: string;
    linkingMethod: 'npm_link' | 'file_reference';
    watchForChanges: boolean;
    hotReload: boolean;
  };
  updates: {
    checkInterval: number;
    autoUpdate: boolean;
    backupBeforeUpdate: boolean;
    notificationChannels: string[];
  };
}

// Default configuration
const DEFAULT_SCHEMA_CONFIG: SchemaConfig = {
  packages: {
    "@tabeza/receipt-schema": {
      version: "^1.0.0",
      source: "npm",
      updatePolicy: "auto",
      compatibility: "strict"
    },
    "@tabeza/escpos-parser": {
      version: "^1.0.0", 
      source: "npm",
      updatePolicy: "auto",
      compatibility: "strict"
    },
    "@tabeza/tax-rules": {
      version: "^1.0.0",
      source: "npm", 
      updatePolicy: "auto",
      compatibility: "strict"
    },
    "@tabeza/validation": {
      version: "^1.0.0",
      source: "npm",
      updatePolicy: "auto", 
      compatibility: "strict"
    }
  },
  registry: {
    url: "https://registry.npmjs.org",
    timeout: 30000,
    retries: 3
  },
  development: {
    enabled: false,
    cloudSystemPath: "../tabeza-cloud",
    linkingMethod: "npm_link",
    watchForChanges: true,
    hotReload: true
  },
  updates: {
    checkInterval: 86400000, // 24 hours
    autoUpdate: false,
    backupBeforeUpdate: true,
    notificationChannels: ["log", "event"]
  }
};
```

This comprehensive schema consumption strategy ensures the agent system can reliably consume and manage npm packages from the cloud system while supporting both development and production scenarios with robust error handling and recovery mechanisms.