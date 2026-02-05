/**
 * Property-based tests for factory function configuration
 * **Feature: virtual-printer-completion, Property 1: Factory function configuration consistency**
 * **Validates: Requirements 1.3, 1.4**
 */

import * as fc from 'fast-check';
import { createVirtualPrinter, generateSecretKey } from '../factory';
import { VirtualPrinterEngine } from '../../core/virtual-printer-engine';

describe('Factory Function Configuration Properties', () => {
  /**
   * Basic test: Verify function exists and can be called
   */
  test('should export createVirtualPrinter function', () => {
    expect(typeof createVirtualPrinter).toBe('function');
  });

  /**
   * Basic test: Verify generateSecretKey function
   */
  test('should generate valid secret key', () => {
    const secretKey1 = generateSecretKey();
    const secretKey2 = generateSecretKey();

    // Should generate different keys each time
    expect(secretKey1).not.toBe(secretKey2);
    
    // Should be hex strings of correct length (64 characters for 32 bytes)
    expect(secretKey1).toMatch(/^[a-f0-9]{64}$/);
    expect(secretKey2).toMatch(/^[a-f0-9]{64}$/);
  });

  /**
   * Unit test: Verify correct parameter order
   * This test ensures the function signature matches the expected order:
   * (barId, supabaseUrl, supabaseKey, options)
   */
  test('should accept parameters in correct order: barId, supabaseUrl, supabaseKey, options', () => {
    const barId = 'test-bar-id-123';
    const supabaseUrl = 'https://test.supabase.co';
    const supabaseKey = 'test-key-123';
    const options = {
      forwardToPhysicalPrinter: false,
      generateQRCode: true,
      printerFilters: ['*']
    };

    // This should not throw an error
    expect(() => {
      createVirtualPrinter(barId, supabaseUrl, supabaseKey, options);
    }).not.toThrow();
  });

  /**
   * **Property 1: Factory function configuration consistency**
   * **Validates: Requirements 1.3, 1.4**
   * 
   * For any valid barId, supabaseUrl, and supabaseKey, calling createVirtualPrinter 
   * should return a VirtualPrinterEngine instance that uses the provided barId 
   * for all database operations
   */
  test('Property 1: Factory function configuration consistency', () => {
    fc.assert(
      fc.property(
        // Generate valid barId (UUID-like string)
        fc.string({ minLength: 10, maxLength: 50 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
        // Generate valid Supabase URL
        fc.string({ minLength: 20, maxLength: 100 }).map(s => `https://${s.replace(/[^a-zA-Z0-9-]/g, '')}.supabase.co`),
        // Generate valid Supabase key (base64-like)
        fc.string({ minLength: 50, maxLength: 200 }).filter(s => /^[a-zA-Z0-9+/=]+$/.test(s)),
        (barId, supabaseUrl, supabaseKey) => {
          // Act: Create virtual printer instance with minimal parameters
          const engine = createVirtualPrinter(barId, supabaseUrl, supabaseKey);

          // Assert: Should return VirtualPrinterEngine instance
          expect(engine).toBeInstanceOf(VirtualPrinterEngine);

          // Assert: Engine should be configured with the provided barId
          // We can access the config through the engine's internal state
          const config = (engine as any).config;
          expect(config).toBeDefined();
          expect(config.barId).toBe(barId);
          expect(config.supabaseUrl).toBe(supabaseUrl);
          expect(config.supabaseKey).toBe(supabaseKey);

          // Assert: Secret key should be set (generated since not provided)
          expect(config.security.secretKey).toBeDefined();
          expect(typeof config.security.secretKey).toBe('string');
          expect(config.security.secretKey.length).toBe(64);
          expect(config.security.secretKey).toMatch(/^[a-f0-9]{64}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Secret key generation consistency
   * Tests that generated secret keys are always valid and unique
   */
  test('Property: Secret key generation consistency', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          // Act: Generate multiple secret keys
          const keys = Array.from({ length: count }, () => generateSecretKey());

          // Assert: All keys should be valid hex strings
          keys.forEach(key => {
            expect(key).toMatch(/^[a-f0-9]{64}$/);
            expect(key.length).toBe(64);
          });

          // Assert: All keys should be unique
          const uniqueKeys = new Set(keys);
          expect(uniqueKeys.size).toBe(keys.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});