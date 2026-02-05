/**
 * TABEZA Receipt Schema Version Management
 * Handles schema version compatibility, validation, and migration utilities
 */
import { z } from 'zod';
export declare const CURRENT_SCHEMA_VERSION = "1.0.0";
export declare const MINIMUM_SUPPORTED_VERSION = "1.0.0";
/**
 * Semantic version schema
 */
export declare const SemanticVersionSchema: z.ZodString;
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
/**
 * Registry of all schema versions and their metadata
 */
export declare const VERSION_REGISTRY: Record<string, SchemaVersionMetadata>;
/**
 * Parse semantic version string into components
 */
export declare function parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
    build?: string;
};
/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export declare function compareVersions(v1: string, v2: string): number;
/**
 * Check if a version is compatible with the current schema
 */
export declare function checkVersionCompatibility(requestedVersion: string): VersionCompatibilityResult;
/**
 * Get migration path between two versions
 */
export declare function getMigrationPath(fromVersion: string, toVersion: string): string[];
/**
 * Check if data structure is compatible with a specific version
 */
export declare function isDataCompatible(data: any, targetVersion: string): boolean;
/**
 * Migrate data from one version to another
 */
export declare function migrateData(data: any, fromVersion: string, toVersion: string): any;
/**
 * Validate version compatibility for agent systems
 */
export declare function validateAgentCompatibility(agentVersion: string): {
    compatible: boolean;
    message: string;
    action: 'none' | 'warning' | 'upgrade_required' | 'downgrade_required';
};
/**
 * Breaking change detection
 */
export declare function hasBreakingChanges(fromVersion: string, toVersion: string): boolean;
/**
 * Get all breaking changes between versions
 */
export declare function getBreakingChanges(fromVersion: string, toVersion: string): string[];
/**
 * Get migration instructions between versions
 */
export declare function getMigrationInstructions(fromVersion: string, toVersion: string): string[];
//# sourceMappingURL=version.d.ts.map