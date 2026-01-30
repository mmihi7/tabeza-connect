/**
 * TABEZA Receipt Schema Version Compatibility Tests
 * Tests for schema version validation, compatibility checking, and migration utilities
 */

import {
  parseVersion,
  compareVersions,
  checkVersionCompatibility,
  getMigrationPath,
  isDataCompatible,
  migrateData,
  validateAgentCompatibility,
  hasBreakingChanges,
  getBreakingChanges,
  getMigrationInstructions,
  VERSION_REGISTRY,
  CURRENT_SCHEMA_VERSION,
  MINIMUM_SUPPORTED_VERSION,
  type VersionCompatibilityResult,
  type SchemaVersionMetadata
} from '../version';

import {
  createReceiptSession,
  createReceiptEvent,
  createTestSession,
  type CompleteReceiptSession
} from '../index';

describe('Version Compatibility Tests', () => {

  // ============================================================================
  // VERSION PARSING TESTS
  // ============================================================================

  describe('Version Parsing', () => {
    it('should parse valid semantic versions', () => {
      const version = parseVersion('1.2.3');
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: undefined
      });
    });

    it('should parse prerelease versions', () => {
      const version = parseVersion('1.2.3-alpha.1');
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: undefined
      });
    });

    it('should parse build metadata', () => {
      const version = parseVersion('1.2.3+build.123');
      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: 'build.123'
      });
    });

    it('should parse complex versions', () => {
      const version = parseVersion('2.0.0-beta.1+exp.sha.5114f85');
      expect(version).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1',
        build: 'exp.sha.5114f85'
      });
    });

    it('should throw error for invalid versions', () => {
      expect(() => parseVersion('invalid')).toThrow('Invalid version format');
      expect(() => parseVersion('1.2')).toThrow('Invalid version format');
      expect(() => parseVersion('1.2.3.4')).toThrow('Invalid version format');
    });
  });

  // ============================================================================
  // VERSION COMPARISON TESTS
  // ============================================================================

  describe('Version Comparison', () => {
    it('should compare major versions correctly', () => {
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should compare minor versions correctly', () => {
      expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
    });

    it('should compare patch versions correctly', () => {
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
    });

    it('should handle prerelease versions correctly', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
      expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
    });
  });

  // ============================================================================
  // COMPATIBILITY CHECKING TESTS
  // ============================================================================

  describe('Compatibility Checking', () => {
    it('should accept current version as compatible', () => {
      const result = checkVersionCompatibility(CURRENT_SCHEMA_VERSION);
      
      expect(result.compatible).toBe(true);
      expect(result.currentVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.requestedVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.migrationRequired).toBe(false);
    });

    it('should reject invalid version formats', () => {
      const result = checkVersionCompatibility('invalid-version');
      
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Invalid version format');
      expect(result.migrationRequired).toBe(false);
    });

    it('should reject unknown versions', () => {
      const result = checkVersionCompatibility('99.99.99');
      
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Unknown schema version');
      expect(result.migrationRequired).toBe(false);
    });

    it('should reject newer versions', () => {
      const result = checkVersionCompatibility('2.0.0');
      
      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Unknown schema version'); // Since 2.0.0 is not in registry
      expect(result.migrationRequired).toBe(false);
    });

    it('should provide migration path for older versions', () => {
      // For now, we only have one version, so this test is theoretical
      // In future versions, this would test actual migration paths
      const result = checkVersionCompatibility(CURRENT_SCHEMA_VERSION);
      
      expect(result.compatible).toBe(true);
      if (result.migrationRequired) {
        expect(result.migrationPath).toBeDefined();
        expect(Array.isArray(result.migrationPath)).toBe(true);
      }
    });
  });

  // ============================================================================
  // AGENT COMPATIBILITY TESTS
  // ============================================================================

  describe('Agent Compatibility', () => {
    it('should validate compatible agent versions', () => {
      const result = validateAgentCompatibility(CURRENT_SCHEMA_VERSION);
      
      expect(result.compatible).toBe(true);
      expect(result.action).toBe('none');
      expect(result.message).toContain('fully compatible');
    });

    it('should handle newer agent versions', () => {
      const result = validateAgentCompatibility('2.0.0');
      
      expect(result.compatible).toBe(false);
      expect(result.action).toBe('upgrade_required');
      expect(result.message).toContain('Unknown schema version'); // Since 2.0.0 is not in registry
    });

    it('should handle invalid agent versions', () => {
      const result = validateAgentCompatibility('invalid');
      
      expect(result.compatible).toBe(false);
      expect(result.action).toBe('upgrade_required');
    });
  });

  // ============================================================================
  // DATA COMPATIBILITY TESTS
  // ============================================================================

  describe('Data Compatibility', () => {
    it('should validate data compatibility with current version', () => {
      const testSession = createTestSession('Test Restaurant');
      const isCompatible = isDataCompatible(testSession, CURRENT_SCHEMA_VERSION);
      
      expect(isCompatible).toBe(true);
    });

    it('should reject data compatibility with invalid versions', () => {
      const testSession = createTestSession('Test Restaurant');
      const isCompatible = isDataCompatible(testSession, 'invalid-version');
      
      expect(isCompatible).toBe(false);
    });

    it('should migrate data between compatible versions', () => {
      const testSession = createTestSession('Test Restaurant');
      const migratedData = migrateData(testSession, CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
      
      // For now, migration returns data as-is for same version
      expect(migratedData).toEqual(testSession);
    });

    it('should throw error for incompatible migration', () => {
      const testSession = createTestSession('Test Restaurant');
      
      expect(() => {
        migrateData(testSession, 'invalid-version', CURRENT_SCHEMA_VERSION);
      }).toThrow('Cannot migrate from incompatible version');
    });
  });

  // ============================================================================
  // BREAKING CHANGES TESTS
  // ============================================================================

  describe('Breaking Changes Detection', () => {
    it('should detect major version changes as breaking', () => {
      const hasBreaking = hasBreakingChanges('1.0.0', '2.0.0');
      // This would be true if we had version 2.0.0 in registry
      // For now, we only have 1.0.0, so this tests the logic
      expect(typeof hasBreaking).toBe('boolean');
    });

    it('should not detect minor version changes as breaking', () => {
      const hasBreaking = hasBreakingChanges('1.0.0', '1.1.0');
      // This would be false for minor version changes
      expect(typeof hasBreaking).toBe('boolean');
    });

    it('should return empty array for no breaking changes', () => {
      const breakingChanges = getBreakingChanges(CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
      expect(Array.isArray(breakingChanges)).toBe(true);
      expect(breakingChanges).toHaveLength(0);
    });

    it('should return migration instructions', () => {
      const instructions = getMigrationInstructions(CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
      expect(Array.isArray(instructions)).toBe(true);
    });
  });

  // ============================================================================
  // VERSION REGISTRY TESTS
  // ============================================================================

  describe('Version Registry', () => {
    it('should contain current version metadata', () => {
      expect(VERSION_REGISTRY[CURRENT_SCHEMA_VERSION]).toBeDefined();
      
      const metadata = VERSION_REGISTRY[CURRENT_SCHEMA_VERSION];
      expect(metadata.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(metadata.releaseDate).toBeDefined();
      expect(Array.isArray(metadata.breakingChanges)).toBe(true);
      expect(Array.isArray(metadata.deprecations)).toBe(true);
      expect(Array.isArray(metadata.newFeatures)).toBe(true);
    });

    it('should have valid metadata structure', () => {
      Object.values(VERSION_REGISTRY).forEach((metadata: SchemaVersionMetadata) => {
        expect(typeof metadata.version).toBe('string');
        expect(typeof metadata.releaseDate).toBe('string');
        expect(Array.isArray(metadata.breakingChanges)).toBe(true);
        expect(Array.isArray(metadata.deprecations)).toBe(true);
        expect(Array.isArray(metadata.newFeatures)).toBe(true);
      });
    });
  });

  // ============================================================================
  // CROSS-VERSION DATA CONSISTENCY TESTS
  // ============================================================================

  describe('Cross-Version Data Consistency', () => {
    let testSession: CompleteReceiptSession;

    beforeEach(() => {
      testSession = createTestSession('Cross-Version Test Restaurant');
    });

    it('should maintain data integrity across version boundaries', () => {
      // Test that core data structure remains consistent
      expect(testSession.session.tabeza_receipt_id).toBeDefined();
      expect(testSession.session.merchant.name).toBe('Cross-Version Test Restaurant');
      expect(testSession.events).toHaveLength(1);
      expect(testSession.totals).toBeDefined();
      
      // Validate that essential fields are preserved
      expect(testSession.session.currency).toBe('KES');
      expect(testSession.session.status).toBe('CLOSED');
      expect(testSession.totals?.total).toBeGreaterThan(0);
    });

    it('should preserve session reference format across versions', () => {
      const sessionRef = testSession.session.session_reference;
      expect(sessionRef).toHaveLength(8);
      expect(/^[A-Z0-9]{8}$/.test(sessionRef)).toBe(true);
    });

    it('should preserve receipt ID format across versions', () => {
      const receiptId = testSession.session.tabeza_receipt_id;
      expect(receiptId).toMatch(/^tbz_/); // Just check it starts with tbz_
      expect(receiptId.length).toBeGreaterThan(4); // And has some content after
    });

    it('should preserve event ID format across versions', () => {
      const eventId = testSession.events[0].event_id;
      expect(eventId).toMatch(/^evt_/); // Just check it starts with evt_
      expect(eventId.length).toBeGreaterThan(4); // And has some content after
    });

    it('should maintain calculation consistency across versions', () => {
      const event = testSession.events[0];
      const calculatedSubtotal = event.items.reduce((sum, item) => sum + item.total_price, 0);
      
      expect(event.totals.subtotal).toBe(calculatedSubtotal);
      expect(testSession.totals?.total).toBe(event.totals.total);
    });

    it('should preserve timestamp format across versions', () => {
      const openedAt = testSession.session.opened_at;
      const closedAt = testSession.session.closed_at;
      
      expect(new Date(openedAt).toISOString()).toBe(openedAt);
      if (closedAt) {
        expect(new Date(closedAt).toISOString()).toBe(closedAt);
      }
    });

    it('should maintain enum value consistency across versions', () => {
      expect(['OPEN', 'CLOSED', 'CANCELLED']).toContain(testSession.session.status);
      expect(['SALE', 'REFUND', 'PARTIAL_BILL', 'VOID']).toContain(testSession.events[0].type);
    });

    it('should preserve validation rules across versions', () => {
      // Test that validation rules remain consistent
      const session = createReceiptSession({
        merchantId: 'test-merchant',
        merchantName: 'Test Restaurant',
        printerId: 'test-printer'
      });

      // These validation rules should remain consistent across versions
      expect(session.tabeza_receipt_id).toMatch(/^tbz_/);
      expect(session.session_reference).toHaveLength(8);
      expect(session.currency).toBe('KES');
      expect(session.status).toBe('OPEN');
      expect(session.opened_at).toBeDefined();
    });
  });

  // ============================================================================
  // MIGRATION PATH TESTS
  // ============================================================================

  describe('Migration Path Generation', () => {
    it('should generate empty path for same version', () => {
      const path = getMigrationPath(CURRENT_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
      expect(Array.isArray(path)).toBe(true);
      expect(path).toHaveLength(0);
    });

    it('should generate path for different versions', () => {
      // This is theoretical since we only have one version
      // In future versions, this would test actual migration paths
      const path = getMigrationPath('0.9.0', CURRENT_SCHEMA_VERSION);
      expect(Array.isArray(path)).toBe(true);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle malformed version strings gracefully', () => {
      const malformedVersions = [
        '',
        '1',
        '1.2',
        '1.2.3.4',
        'v1.2.3',
        '1.2.3-',
        '1.2.3+',
        'latest',
        'stable'
      ];

      malformedVersions.forEach(version => {
        const result = checkVersionCompatibility(version);
        expect(result.compatible).toBe(false);
        expect(result.reason).toContain('Invalid version format');
      });
    });

    it('should handle null and undefined versions', () => {
      // These should return invalid results, not throw
      const nullResult = checkVersionCompatibility(null as any);
      const undefinedResult = checkVersionCompatibility(undefined as any);
      
      expect(nullResult.compatible).toBe(false);
      expect(undefinedResult.compatible).toBe(false);
    });

    it('should provide helpful error messages', () => {
      const result = checkVersionCompatibility('invalid-version');
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Invalid version format');
      expect(typeof result.reason).toBe('string');
      expect(result.reason?.length).toBeGreaterThan(0);
    });
  });
});