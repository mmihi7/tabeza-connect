/**
 * TABEZA Receipt Schema Version Management
 * Handles schema version compatibility, validation, and migration utilities
 */

import { z } from 'zod';

// ============================================================================
// VERSION TYPES & SCHEMAS
// ============================================================================

export const CURRENT_SCHEMA_VERSION = '1.0.0';
export const MINIMUM_SUPPORTED_VERSION = '1.0.0';

/**
 * Semantic version schema
 */
export const SemanticVersionSchema = z.string().regex(
  /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?(?:\+[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?$/,
  'Invalid semantic version format'
);

/**
 * Version compatibility result
 */
export interface VersionCompatibilityResult {
  compatible: boolean;
  currentVersion: string;
  requestedVersion: string;
  reason?: string;
  migrationRequired: boolean;
  migrationPath?: string[];
  warnings: string[];
}

/**
 * Schema version metadata
 */
export interface SchemaVersionMetadata {
  version: string;
  releaseDate: string;
  breakingChanges: string[];
  deprecations: string[];
  newFeatures: string[];
  migrationNotes?: string;
}

// ============================================================================
// VERSION REGISTRY
// ============================================================================

/**
 * Registry of all schema versions and their metadata
 */
export const VERSION_REGISTRY: Record<string, SchemaVersionMetadata> = {
  '1.0.0': {
    version: '1.0.0',
    releaseDate: '2025-01-30',
    breakingChanges: [],
    deprecations: [],
    newFeatures: [
      'Initial release',
      'Session-based receipt modeling',
      'Multi-order transaction support',
      'Comprehensive validation',
      'Audit trail capabilities'
    ],
    migrationNotes: 'Initial release - no migration required'
  }
};

// ============================================================================
// VERSION VALIDATION FUNCTIONS
// ============================================================================

/**
 * Parse semantic version string into components
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string; build?: string } {
  const result = SemanticVersionSchema.safeParse(version);
  if (!result.success) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*))?(?:\+([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*))?$/);
  if (!match) {
    throw new Error(`Failed to parse version: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5]
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);

  // Compare major version
  if (version1.major !== version2.major) {
    return version1.major > version2.major ? 1 : -1;
  }

  // Compare minor version
  if (version1.minor !== version2.minor) {
    return version1.minor > version2.minor ? 1 : -1;
  }

  // Compare patch version
  if (version1.patch !== version2.patch) {
    return version1.patch > version2.patch ? 1 : -1;
  }

  // Handle prerelease versions
  if (version1.prerelease && !version2.prerelease) return -1;
  if (!version1.prerelease && version2.prerelease) return 1;
  if (version1.prerelease && version2.prerelease) {
    return version1.prerelease.localeCompare(version2.prerelease);
  }

  return 0;
}

/**
 * Check if a version is compatible with the current schema
 */
export function checkVersionCompatibility(requestedVersion: string): VersionCompatibilityResult {
  const warnings: string[] = [];
  
  try {
    // Validate version format
    SemanticVersionSchema.parse(requestedVersion);
  } catch (error) {
    return {
      compatible: false,
      currentVersion: CURRENT_SCHEMA_VERSION,
      requestedVersion,
      reason: `Invalid version format: ${requestedVersion}`,
      migrationRequired: false,
      warnings
    };
  }

  // Check if version exists in registry
  if (!VERSION_REGISTRY[requestedVersion]) {
    return {
      compatible: false,
      currentVersion: CURRENT_SCHEMA_VERSION,
      requestedVersion,
      reason: `Unknown schema version: ${requestedVersion}`,
      migrationRequired: false,
      warnings
    };
  }

  const comparison = compareVersions(requestedVersion, CURRENT_SCHEMA_VERSION);
  const minComparison = compareVersions(requestedVersion, MINIMUM_SUPPORTED_VERSION);

  // Check if version is too old
  if (minComparison < 0) {
    return {
      compatible: false,
      currentVersion: CURRENT_SCHEMA_VERSION,
      requestedVersion,
      reason: `Version ${requestedVersion} is no longer supported. Minimum supported version is ${MINIMUM_SUPPORTED_VERSION}`,
      migrationRequired: true,
      migrationPath: getMigrationPath(requestedVersion, CURRENT_SCHEMA_VERSION),
      warnings
    };
  }

  // Check if version is newer than current
  if (comparison > 0) {
    return {
      compatible: false,
      currentVersion: CURRENT_SCHEMA_VERSION,
      requestedVersion,
      reason: `Version ${requestedVersion} is newer than current version ${CURRENT_SCHEMA_VERSION}. Please upgrade the schema package.`,
      migrationRequired: false,
      warnings
    };
  }

  // Check if migration is needed
  const migrationRequired = comparison !== 0;
  const migrationPath = migrationRequired ? getMigrationPath(requestedVersion, CURRENT_SCHEMA_VERSION) : undefined;

  // Add warnings for deprecated features
  const versionMetadata = VERSION_REGISTRY[requestedVersion];
  if (versionMetadata.deprecations.length > 0) {
    warnings.push(`Version ${requestedVersion} contains deprecated features: ${versionMetadata.deprecations.join(', ')}`);
  }

  return {
    compatible: true,
    currentVersion: CURRENT_SCHEMA_VERSION,
    requestedVersion,
    migrationRequired,
    migrationPath,
    warnings
  };
}

/**
 * Get migration path between two versions
 */
export function getMigrationPath(fromVersion: string, toVersion: string): string[] {
  const from = parseVersion(fromVersion);
  const to = parseVersion(toVersion);
  const path: string[] = [];

  // For now, we only support direct migration to current version
  // In future versions, this would build a step-by-step migration path
  if (compareVersions(fromVersion, toVersion) !== 0) {
    path.push(`${fromVersion} -> ${toVersion}`);
  }

  return path;
}

// ============================================================================
// BACKWARD COMPATIBILITY UTILITIES
// ============================================================================

/**
 * Check if data structure is compatible with a specific version
 */
export function isDataCompatible(data: any, targetVersion: string): boolean {
  const compatibility = checkVersionCompatibility(targetVersion);
  if (!compatibility.compatible) {
    return false;
  }

  // For now, we assume all data is compatible within supported versions
  // In future versions, this would perform actual data structure validation
  return true;
}

/**
 * Migrate data from one version to another
 */
export function migrateData(data: any, fromVersion: string, toVersion: string): any {
  const compatibility = checkVersionCompatibility(fromVersion);
  if (!compatibility.compatible) {
    throw new Error(`Cannot migrate from incompatible version: ${fromVersion}`);
  }

  // For now, return data as-is since we only have one version
  // In future versions, this would perform actual data transformation
  return data;
}

/**
 * Validate version compatibility for agent systems
 */
export function validateAgentCompatibility(agentVersion: string): {
  compatible: boolean;
  message: string;
  action: 'none' | 'warning' | 'upgrade_required' | 'downgrade_required';
} {
  const compatibility = checkVersionCompatibility(agentVersion);

  if (!compatibility.compatible) {
    if (compatibility.reason?.includes('newer than current')) {
      return {
        compatible: false,
        message: `Agent version ${agentVersion} is newer than schema version ${CURRENT_SCHEMA_VERSION}. Please upgrade the schema package.`,
        action: 'upgrade_required'
      };
    } else if (compatibility.reason?.includes('no longer supported')) {
      return {
        compatible: false,
        message: `Agent version ${agentVersion} is no longer supported. Please upgrade to version ${MINIMUM_SUPPORTED_VERSION} or later.`,
        action: 'upgrade_required'
      };
    } else {
      return {
        compatible: false,
        message: compatibility.reason || 'Unknown compatibility issue',
        action: 'upgrade_required'
      };
    }
  }

  if (compatibility.warnings.length > 0) {
    return {
      compatible: true,
      message: `Agent version ${agentVersion} is compatible but has warnings: ${compatibility.warnings.join(', ')}`,
      action: 'warning'
    };
  }

  return {
    compatible: true,
    message: `Agent version ${agentVersion} is fully compatible`,
    action: 'none'
  };
}

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Breaking change detection
 */
export function hasBreakingChanges(fromVersion: string, toVersion: string): boolean {
  const from = parseVersion(fromVersion);
  const to = parseVersion(toVersion);

  // Major version changes are always breaking
  if (from.major !== to.major) {
    return true;
  }

  // Check registry for explicit breaking changes
  const versions = Object.keys(VERSION_REGISTRY)
    .filter(v => compareVersions(v, fromVersion) > 0 && compareVersions(v, toVersion) <= 0)
    .sort(compareVersions);

  return versions.some(version => VERSION_REGISTRY[version].breakingChanges.length > 0);
}

/**
 * Get all breaking changes between versions
 */
export function getBreakingChanges(fromVersion: string, toVersion: string): string[] {
  const versions = Object.keys(VERSION_REGISTRY)
    .filter(v => compareVersions(v, fromVersion) > 0 && compareVersions(v, toVersion) <= 0)
    .sort(compareVersions);

  const breakingChanges: string[] = [];
  versions.forEach(version => {
    breakingChanges.push(...VERSION_REGISTRY[version].breakingChanges);
  });

  return breakingChanges;
}

/**
 * Get migration instructions between versions
 */
export function getMigrationInstructions(fromVersion: string, toVersion: string): string[] {
  const versions = Object.keys(VERSION_REGISTRY)
    .filter(v => compareVersions(v, fromVersion) > 0 && compareVersions(v, toVersion) <= 0)
    .sort(compareVersions);

  const instructions: string[] = [];
  versions.forEach(version => {
    const metadata = VERSION_REGISTRY[version];
    if (metadata.migrationNotes) {
      instructions.push(`${version}: ${metadata.migrationNotes}`);
    }
  });

  return instructions;
}