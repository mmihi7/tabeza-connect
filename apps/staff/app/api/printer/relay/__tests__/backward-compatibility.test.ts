/**
 * Unit Tests for Backward Compatibility with Old Payload Format
 * **Feature Spec: local-receipt-parsing**
 * 
 * **Validates: Requirements 6.1, 6.3, 6.4, 5.4**
 * **Task: 7.1 - Add fallback logic for old payload format**
 * 
 * These tests verify that the API route maintains backward compatibility with older
 * TabezaConnect versions that only send rawData (no parsedData).
 */

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

// Mock the parseReceipt function (cloud parsing fallback)
const mockParseReceipt = jest.fn(async () => ({
  items: [
    { name: 'Tusker Lager', quantity: 2, price: 300 }
  ],
  total: 600,
  subtotal: 600,
  tax: 0,
  receiptNumber: 'RCP-CLOUD-001',
  timestamp: '2024-01-15 14:30:00',
  rawText: 'Cloud parsed receipt text',
  confidence: 'high'
}));

jest.mock('@tabeza/shared/services/receiptParser', () => ({
  parseReceipt: mockParseReceipt
}));

// Spy on console.log to verify logging
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

describe('Print Relay API - Backward Compatibility (Task 7.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockClear();
    mockSingle.mockResolvedValue({
      data: { id: 'test-job-id' },
      error: null
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Requirement 6.1: Accept requests with only rawData (no parsedData)', () => {
    it('should accept old format payload with only rawData', async () => {
      const receiptText = 'Tusker Lager\n2 x 300.00 = 600.00\nTotal: 600.00';
      const payload = {
        barId: 'test-bar-id',
        driverId: 'test-driver-id',
        rawData: Buffer.from(receiptText).toString('base64'),
        printerName: 'Test Printer',
        documentName: 'Receipt-001',
        timestamp: '2024-01-15T14:30:00Z',
        metadata: {
          source: 'old-tabeza-connect'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify successful response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBe('test-job-id');
    });

    it('should accept old format with minimal fields', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Simple receipt').toString('base64')
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Requirement 5.4: Parse rawData using existing logic when parsedData missing', () => {
    it('should call parseReceipt when parsedData is not provided', async () => {
      const receiptText = 'Receipt content for parsing';
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from(receiptText).toString('base64'),
        documentName: 'Receipt-002'
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      await response.json();

      // Verify parseReceipt was called with decoded text
      expect(mockParseReceipt).toHaveBeenCalledWith(
        receiptText,
        'test-bar-id',
        'Receipt-002'
      );
    });

    it('should use parsed result from cloud parsing in database insert', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Receipt text').toString('base64')
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      await response.json();

      // Verify database insert includes cloud-parsed data
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                name: 'Tusker Lager',
                quantity: 2,
                price: 300
              })
            ]),
            total: 600,
            receiptNumber: 'RCP-CLOUD-001'
          })
        })
      );
    });

    it('should handle parsing failures gracefully (never reject receipt)', async () => {
      // Mock parseReceipt to throw an error
      mockParseReceipt.mockRejectedValueOnce(new Error('Parsing failed'));

      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Malformed receipt').toString('base64')
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed (never reject a receipt)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should store with low confidence fallback data
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: expect.objectContaining({
            items: [],
            total: 0,
            error: 'Parsing failed'
          }),
          metadata: expect.objectContaining({
            parsing_confidence: 'low'
          })
        })
      );
    });
  });

  describe('Requirement 6.4: Log which parsing method was used (local vs cloud)', () => {
    it('should log "cloud" parsing method when using rawData fallback', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Receipt text').toString('base64')
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      await response.json();

      // Verify cloud parsing method is logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No parsed data from printer service, parsing locally (cloud parsing)')
      );

      // Verify parsing method is stored in metadata
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'cloud'
          })
        })
      );
    });

    it('should log "local" parsing method when parsedData is provided', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [{ name: 'Item', quantity: 1, price: 100 }],
          total: 100,
          rawText: 'Receipt',
          confidence: 'high'
        },
        metadata: {
          parsingMethod: 'local'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      await response.json();

      // Verify local parsing method is logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using parsed data from printer service (local parsing)'),
        expect.objectContaining({
          parsingMethod: 'local'
        })
      );

      // Verify parsing method is stored in metadata
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'local'
          })
        })
      );
    });

    it('should include parsing method in database insert logging', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Receipt').toString('base64')
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      await response.json();

      // Verify database insert logging includes parsing_method
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempting database insert'),
        expect.objectContaining({
          sanitizedData: expect.objectContaining({
            parsing_method: 'cloud'
          })
        })
      );
    });
  });

  describe('Requirement 6.3: Maintain backward compatibility', () => {
    it('should process old payload format identically to before (except with better parsing)', async () => {
      const receiptText = 'Old format receipt\nTotal: 500.00';
      const payload = {
        driverId: 'driver-123',
        barId: 'bar-456',
        timestamp: '2024-01-15T10:00:00Z',
        rawData: Buffer.from(receiptText).toString('base64'),
        printerName: 'Legacy Printer',
        documentName: 'Receipt-Legacy',
        metadata: {
          legacyField: 'value'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify successful processing
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify all fields are preserved
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          bar_id: 'bar-456',
          driver_id: 'driver-123',
          raw_data: payload.rawData,
          printer_name: 'Legacy Printer',
          document_name: 'Receipt-Legacy',
          received_at: '2024-01-15T10:00:00Z',
          status: 'no_match',
          metadata: expect.objectContaining({
            legacyField: 'value',
            parsing_method: 'cloud',
            parsing_confidence: expect.any(String)
          })
        })
      );
    });

    it('should handle base64 decoding errors gracefully (never reject)', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: 'invalid-base64-!@#$%'
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed (never reject a receipt)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Should store with low confidence fallback
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: expect.objectContaining({
            items: [],
            total: 0,
            rawText: 'Failed to decode base64 data'
          }),
          metadata: expect.objectContaining({
            parsing_confidence: 'low',
            parsing_method: 'cloud'
          })
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty rawData gracefully', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: ''
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      // Should reject due to validation (empty string is not valid base64)
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid base64 data format');
    });

    it('should prioritize parsedData over rawData when both are present', async () => {
      const parsedData = {
        items: [{ name: 'Local Item', quantity: 1, price: 100 }],
        total: 100,
        rawText: 'Local parsed',
        confidence: 'high'
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData,
        rawData: Buffer.from('Different receipt text').toString('base64')
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      await response.json();

      // Should NOT call parseReceipt (parsedData takes priority)
      expect(mockParseReceipt).not.toHaveBeenCalled();

      // Should use parsedData
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData,
          metadata: expect.objectContaining({
            parsing_method: 'local'
          })
        })
      );
    });
  });
});
