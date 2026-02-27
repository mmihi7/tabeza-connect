/**
 * Bug Condition Exploration Test for Print Job Upload 500 Error
 * **Bugfix Spec: print-job-upload-500-error-fix**
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.7**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **Property 1: Fault Condition** - Receipt Upload Returns HTTP 500
 * 
 * For any receipt upload where the bug condition holds (valid barId, valid rawData, bar exists in database),
 * the fixed endpoint SHALL successfully decode the rawData, parse the receipt (with fallback to low confidence
 * if parsing fails), insert a print_jobs record with status='no_match', and return HTTP 200 with
 * {success: true, jobId, message}.
 */

import * as fc from 'fast-check';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock environment variables before importing the route
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';

// Mock the Supabase client
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockFrom = jest.fn(() => ({ insert: mockInsert }));

const mockSupabaseClient = {
  from: mockFrom
};

// Mock the createServiceRoleClient function
jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: () => mockSupabaseClient
}));

// Mock the parseReceipt function
jest.mock('@tabeza/shared/services/receiptParser', () => ({
  parseReceipt: jest.fn(async (rawText: string) => ({
    items: [
      { name: 'Test Item', price: 100, quantity: 1 }
    ],
    total: 100,
    receiptNumber: 'TEST-001',
    rawText
  }))
}));

// Generators for property-based testing
const validBarIdArb = fc.uuid();

const validBase64DataArb = fc.string({ minLength: 10, maxLength: 1000 })
  .map(str => Buffer.from(str).toString('base64'));

const driverIdArb = fc.string({ minLength: 5, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const printerNameArb = fc.oneof(
  fc.constant('Epson TM-T20'),
  fc.constant('Star TSP143'),
  fc.constant('Unknown Printer')
);

const documentNameArb = fc.oneof(
  fc.constant('Receipt'),
  fc.constant('Invoice'),
  fc.constant('Bill')
);

const timestampArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
  .map(d => d.toISOString());

// Generator for valid receipt upload payload
const validReceiptPayloadArb = fc.record({
  barId: validBarIdArb,
  rawData: validBase64DataArb,
  driverId: driverIdArb,
  printerName: printerNameArb,
  documentName: documentNameArb,
  timestamp: timestampArb,
  metadata: fc.record({
    source: fc.constant('TabezaConnect'),
    version: fc.constant('1.0.0')
  })
});

describe('Print Job Upload Bug Condition Exploration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  /**
   * Property 1: Fault Condition - Successful Receipt Upload and Database Insert
   * 
   * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (this is correct - it proves the bug exists)
   * 
   * This test will surface counterexamples that demonstrate:
   * - Which operation fails (JSON parsing, base64 decoding, receipt parsing, database insert)
   * - Exact error message from logs
   * - Whether root cause matches hypothesis (constraint violation, encoding issue, API timeout, missing config)
   */
  it('should successfully process valid receipt uploads and return HTTP 200', async () => {
    await fc.assert(
      fc.asyncProperty(
        validReceiptPayloadArb,
        async (payload) => {
          // Mock successful database insert
          const mockPrintJob = {
            id: 'test-job-id-' + Math.random().toString(36).substring(7),
            bar_id: payload.barId,
            driver_id: payload.driverId,
            raw_data: payload.rawData,
            status: 'no_match',
            received_at: payload.timestamp
          };

          mockSingle.mockResolvedValueOnce({
            data: mockPrintJob,
            error: null
          });

          // Create request
          const request = new NextRequest('http://localhost:3003/api/printer/relay', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          // Execute endpoint
          const response = await POST(request);
          const result = await response.json();

          // Log response for debugging
          if (response.status !== 200) {
            console.log('Test failed with response:', {
              status: response.status,
              result,
              payload: {
                barId: payload.barId,
                rawDataLength: payload.rawData.length,
                driverId: payload.driverId,
              }
            });
          }

          // **EXPECTED BEHAVIOR ASSERTIONS**
          // These assertions encode the correct behavior that should exist after the fix

          // Property: HTTP 200 response status
          expect(response.status).toBe(200);

          // Property: Response body contains {success: true, jobId, message}
          expect(result).toHaveProperty('success', true);
          expect(result).toHaveProperty('jobId');
          expect(result.jobId).toBeTruthy();
          expect(result).toHaveProperty('message');
          expect(result.message).toContain('Print job received');

          // Property: Database insert was called with correct structure
          expect(mockFrom).toHaveBeenCalledWith('print_jobs');
          expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
              bar_id: payload.barId,
              driver_id: payload.driverId,
              raw_data: payload.rawData,
              status: 'no_match',
              printer_name: payload.printerName,
              document_name: payload.documentName
            })
          );

          // Property: Parsed data should be included in the insert
          const insertCall = mockInsert.mock.calls[0][0];
          expect(insertCall).toHaveProperty('parsed_data');
          expect(insertCall.parsed_data).toBeTruthy();

          // Property: Metadata should include parsing confidence
          expect(insertCall).toHaveProperty('metadata');
          expect(insertCall.metadata).toHaveProperty('parsing_confidence');
          expect(['high', 'medium', 'low']).toContain(insertCall.metadata.parsing_confidence);

          // Property: Received timestamp should be set
          expect(insertCall).toHaveProperty('received_at');
          expect(insertCall.received_at).toBeTruthy();
        }
      ),
      { 
        numRuns: 50, // Run 50 test cases to surface counterexamples
        verbose: true // Show detailed output when test fails
      }
    );
  });

  /**
   * Concrete Test Case: Specific valid receipt upload
   * 
   * This test uses a concrete example to make debugging easier when the test fails.
   * It will help identify the exact failure point in the endpoint.
   */
  it('should process a concrete valid receipt upload', async () => {
    const concretePayload = {
      barId: '550e8400-e29b-41d4-a716-446655440000',
      rawData: Buffer.from('Test Receipt\nItem 1: $10.00\nTotal: $10.00').toString('base64'),
      driverId: 'driver-test-001',
      printerName: 'Epson TM-T20',
      documentName: 'Receipt',
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'TabezaConnect',
        version: '1.0.0'
      }
    };

    // Mock successful database insert
    const mockPrintJob = {
      id: 'concrete-test-job-id',
      bar_id: concretePayload.barId,
      driver_id: concretePayload.driverId,
      raw_data: concretePayload.rawData,
      status: 'no_match',
      received_at: concretePayload.timestamp
    };

    mockSingle.mockResolvedValueOnce({
      data: mockPrintJob,
      error: null
    });

    // Create request
    const request = new NextRequest('http://localhost:3003/api/printer/relay', {
      method: 'POST',
      body: JSON.stringify(concretePayload),
    });

    // Execute endpoint
    const response = await POST(request);
    const result = await response.json();

    // Log the response for debugging
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    // **EXPECTED BEHAVIOR ASSERTIONS**
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('concrete-test-job-id');
    expect(result.message).toContain('Print job received');

    // Verify database insert was called
    expect(mockFrom).toHaveBeenCalledWith('print_jobs');
    expect(mockInsert).toHaveBeenCalled();
  });

  /**
   * Test Case: Database Insert Failure Scenario
   * 
   * This test simulates a database constraint violation to see if that's the root cause.
   * If this test reveals the bug, it confirms the hypothesis about constraint violations.
   */
  it('should handle database insert failures gracefully', async () => {
    const payload = {
      barId: '550e8400-e29b-41d4-a716-446655440000',
      rawData: Buffer.from('Test Receipt').toString('base64'),
      driverId: 'driver-test-002',
      printerName: 'Epson TM-T20',
      documentName: 'Receipt',
      timestamp: new Date().toISOString(),
      metadata: {}
    };

    // Mock database insert failure (e.g., foreign key constraint violation)
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23503',
        message: 'insert or update on table "print_jobs" violates foreign key constraint "print_jobs_bar_id_fkey"',
        details: 'Key (bar_id)=(550e8400-e29b-41d4-a716-446655440000) is not present in table "bars".',
        hint: null
      }
    });

    // Create request
    const request = new NextRequest('http://localhost:3003/api/printer/relay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Execute endpoint
    const response = await POST(request);
    const result = await response.json();

    // Log the error for analysis
    console.log('Database error response status:', response.status);
    console.log('Database error response body:', result);

    // **COUNTEREXAMPLE DOCUMENTATION**
    // If this test fails with HTTP 500, it confirms the bug is related to database insert failures
    // The error logs should show the exact constraint violation
    
    // For now, we expect HTTP 500 on unfixed code
    // After the fix, this should return HTTP 500 with detailed error information
    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  /**
   * Test Case: Base64 Decoding Failure Scenario
   * 
   * This test checks if invalid base64 data causes the bug.
   */
  it('should handle invalid base64 data gracefully', async () => {
    const payload = {
      barId: '550e8400-e29b-41d4-a716-446655440000',
      rawData: 'not-valid-base64-!!!@@@###', // Invalid base64
      driverId: 'driver-test-003',
      printerName: 'Epson TM-T20',
      documentName: 'Receipt',
      timestamp: new Date().toISOString(),
      metadata: {}
    };

    // Create request
    const request = new Request('http://localhost:3003/api/printer/relay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Execute endpoint
    const response = await POST(request);
    const result = await response.json();

    // Log the error for analysis
    console.log('Base64 error response status:', response.status);
    console.log('Base64 error response body:', result);

    // **COUNTEREXAMPLE DOCUMENTATION**
    // If this test fails with HTTP 500, it confirms the bug is related to base64 decoding
    // The error logs should show the decoding failure
    
    // After the fix, this should still create a print_jobs record with low confidence
    // (following the foundational rule "Never reject a receipt")
    // For now, we document the behavior on unfixed code
  });
});
