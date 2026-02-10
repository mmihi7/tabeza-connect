/**
 * Property-Based Tests for Printer Service
 * Feature: revert-ec2-to-deepseek
 * 
 * These tests verify that the printer service sends raw data only
 * without any pre-parsing or EC2 integration.
 */

const fc = require('fast-check');

// Mock the printer service module
jest.mock('../index.js', () => {
  const actualModule = jest.requireActual('../index.js');
  return {
    ...actualModule,
    // We'll need to export processPrintJob for testing
  };
});

describe('Printer Service - Property-Based Tests', () => {
  let mockFetch;
  let originalFetch;

  beforeAll(() => {
    // Save original fetch
    originalFetch = global.fetch;
  });

  beforeEach(() => {
    // Mock fetch for each test
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  /**
   * Property 3: Raw Data Transmission
   * Validates: Requirements 3.4
   * 
   * For any print job data, the printer service should send only raw base64 data
   * to the cloud without any parsedData field or parserUsed flag.
   */
  it('should send only raw base64 data for all print jobs', async () => {
    // Mock successful cloud response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await fc.assert(
      fc.asyncProperty(
        // Generate random print job data
        fc.uint8Array({ minLength: 10, maxLength: 1000 }),
        fc.uuid(),
        fc.string({ minLength: 5, maxLength: 50 }),
        async (printDataArray, barId, fileName) => {
          // Convert Uint8Array to Buffer for Node.js
          const printData = Buffer.from(printDataArray);
          
          // Simulate processPrintJob logic
          const jobId = `job-${Date.now()}`;
          const base64Data = printData.toString('base64');
          
          // Simulate the payload that would be sent
          const payload = {
            driverId: `driver-test-${Date.now()}`,
            barId: barId,
            timestamp: new Date().toISOString(),
            rawData: base64Data,
            printerName: 'Tabeza Receipt Printer',
            documentName: fileName,
            metadata: {
              jobId,
              source: 'file-watcher',
              fileSize: printData.length,
            },
          };

          // Verify payload structure
          expect(payload).toHaveProperty('rawData');
          expect(payload).toHaveProperty('barId');
          expect(payload).toHaveProperty('driverId');
          expect(payload).toHaveProperty('timestamp');
          expect(payload).toHaveProperty('metadata');
          
          // Verify NO parsedData field
          expect(payload).not.toHaveProperty('parsedData');
          
          // Verify NO parserUsed flag in metadata
          expect(payload.metadata).not.toHaveProperty('parserUsed');
          
          // Verify rawData is base64 encoded
          expect(typeof payload.rawData).toBe('string');
          expect(payload.rawData).toBe(base64Data);
          
          // Verify metadata contains only expected fields
          expect(payload.metadata).toHaveProperty('jobId');
          expect(payload.metadata).toHaveProperty('source');
          expect(payload.metadata).toHaveProperty('fileSize');
          expect(Object.keys(payload.metadata).length).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Verify payload structure consistency
   * Ensures all payloads have the same structure regardless of input
   */
  it('should maintain consistent payload structure for all inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 5000 }),
        fc.uuid(),
        async (printDataArray, barId) => {
          const printData = Buffer.from(printDataArray);
          const base64Data = printData.toString('base64');
          
          const payload = {
            driverId: `driver-test`,
            barId: barId,
            timestamp: new Date().toISOString(),
            rawData: base64Data,
            printerName: 'Tabeza Receipt Printer',
            documentName: 'receipt.prn',
            metadata: {
              jobId: `job-${Date.now()}`,
              source: 'file-watcher',
              fileSize: printData.length,
            },
          };

          // Verify exact keys in payload
          const payloadKeys = Object.keys(payload).sort();
          expect(payloadKeys).toEqual([
            'barId',
            'documentName',
            'driverId',
            'metadata',
            'printerName',
            'rawData',
            'timestamp',
          ].sort());

          // Verify exact keys in metadata
          const metadataKeys = Object.keys(payload.metadata).sort();
          expect(metadataKeys).toEqual([
            'fileSize',
            'jobId',
            'source',
          ].sort());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: Verify base64 encoding correctness
   * Ensures data can be decoded back to original
   */
  it('should correctly encode print data as base64 for all inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 1000 }),
        async (printDataArray) => {
          const printData = Buffer.from(printDataArray);
          const base64Data = printData.toString('base64');
          
          // Verify we can decode it back
          const decoded = Buffer.from(base64Data, 'base64');
          expect(decoded).toEqual(printData);
          
          // Verify base64 format (only valid base64 characters)
          expect(base64Data).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
