/**
 * Property-Based Tests for Configuration Validation
 * 
 * Feature: management-ui-and-missing-features
 * Property 17: Configuration Validation
 * 
 * **Validates: Requirements 8.9, 8.10**
 * 
 * For any configuration update request, the Configuration Page should validate
 * that Bar ID is non-empty and API URL is a valid HTTPS URL before allowing
 * the save operation.
 */

const fc = require('fast-check');
const express = require('express');
const request = require('supertest');
const configRouter = require('../config');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('Property 17: Configuration Validation', () => {
  let app;
  let mockConfig;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Mock config
    mockConfig = {
      barId: 'test-bar-123',
      apiUrl: 'https://tabeza.co.ke',
      watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
      httpPort: 8765
    };

    // Set app locals
    app.locals.config = mockConfig;

    // Mount router
    app.use('/api/config', configRouter);

    // Mock fs methods
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    fs.writeFileSync.mockImplementation(() => {});
    fs.mkdirSync.mockImplementation(() => {});

    // Clear all mocks
    jest.clearAllMocks();
  });

  /**
   * Property: Bar ID validation rejects empty strings
   * 
   * For any string that is empty or contains only whitespace,
   * the configuration endpoint should reject it with a 400 error.
   */
  it('should reject empty or whitespace-only Bar IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('  \t  \n  ')
        ),
        async (barId) => {
          const response = await request(app)
            .post('/api/config')
            .send({ barId });

          // Should reject with 400 status
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toContain('Bar ID cannot be empty');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Bar ID validation accepts non-empty strings
   * 
   * For any non-empty string (after trimming), the configuration
   * endpoint should accept it.
   */
  it('should accept non-empty Bar IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (barId) => {
          const response = await request(app)
            .post('/api/config')
            .send({ barId });

          // Should accept with 200 status
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API URL validation rejects non-HTTPS URLs
   * 
   * For any URL that does not use the HTTPS protocol,
   * the configuration endpoint should reject it with a 400 error.
   */
  it('should reject non-HTTPS API URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.webUrl({ validSchemes: ['http'] }),
          fc.constant('http://tabeza.co.ke'),
          fc.constant('http://api.tabeza.co.ke'),
          fc.constant('ftp://tabeza.co.ke'),
          fc.constant('ws://tabeza.co.ke')
        ),
        async (apiUrl) => {
          const response = await request(app)
            .post('/api/config')
            .send({ apiUrl });

          // Should reject with 400 status
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toContain('must use HTTPS');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API URL validation accepts valid HTTPS URLs
   * 
   * For any valid HTTPS URL, the configuration endpoint should accept it.
   */
  it('should accept valid HTTPS API URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ validSchemes: ['https'] }),
        async (apiUrl) => {
          const response = await request(app)
            .post('/api/config')
            .send({ apiUrl });

          // Should accept with 200 status
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API URL validation rejects invalid URLs
   * 
   * For any string that is not a valid URL, the configuration
   * endpoint should reject it with a 400 error.
   */
  it('should reject invalid API URLs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant('not-a-url'),
          fc.constant('just-text'),
          fc.constant('://missing-protocol'),
          fc.constant('https://'),
          fc.string().filter(s => {
            try {
              new URL(s);
              return false; // Valid URL, skip
            } catch {
              return true; // Invalid URL, use it
            }
          })
        ),
        async (apiUrl) => {
          const response = await request(app)
            .post('/api/config')
            .send({ apiUrl });

          // Should reject with 400 status
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toMatch(/not a valid URL|must use HTTPS/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HTTP port validation rejects invalid ports
   * 
   * For any port number outside the range 1024-65535,
   * the configuration endpoint should reject it with a 400 error.
   */
  it('should reject invalid HTTP ports', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.integer({ max: 1023 }),
          fc.integer({ min: 65536 }),
          fc.constant(-1),
          fc.constant(0)
        ),
        async (httpPort) => {
          const response = await request(app)
            .post('/api/config')
            .send({ httpPort });

          // Should reject with 400 status
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toContain('between 1024 and 65535');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: HTTP port validation accepts valid ports
   * 
   * For any port number in the range 1024-65535,
   * the configuration endpoint should accept it.
   */
  it('should accept valid HTTP ports', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1024, max: 65535 }),
        async (httpPort) => {
          const response = await request(app)
            .post('/api/config')
            .send({ httpPort });

          // Should accept with 200 status
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation is independent for each field
   * 
   * For any combination of valid and invalid fields,
   * only the invalid fields should cause rejection.
   */
  it('should validate each field independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barId: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          apiUrl: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined }),
          httpPort: fc.option(fc.integer({ min: 1024, max: 65535 }), { nil: undefined })
        }),
        async (updates) => {
          const response = await request(app)
            .post('/api/config')
            .send(updates);

          // If all provided fields are valid, should succeed
          const hasInvalidBarId = updates.barId !== undefined && updates.barId.trim() === '';
          const hasInvalidUrl = updates.apiUrl !== undefined && !updates.apiUrl.startsWith('https://');
          const hasInvalidPort = updates.httpPort !== undefined && 
            (updates.httpPort < 1024 || updates.httpPort > 65535);

          if (!hasInvalidBarId && !hasInvalidUrl && !hasInvalidPort) {
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
          } else {
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
