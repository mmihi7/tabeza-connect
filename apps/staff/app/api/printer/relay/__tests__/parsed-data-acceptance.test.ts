/**
 * Unit Tests for parsedData Field Acceptance
 * **Feature Spec: local-receipt-parsing**
 * 
 * **Validates: Requirements 5.1, 5.2**
 * **Task: 6.1 - Modify API route to accept parsedData field**
 * 
 * These tests verify that the API route correctly accepts parsedData as an optional field
 * and makes rawData optional in the request payload.
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

// Mock the parseReceipt function (should not be called when parsedData is provided)
const mockParseReceipt = jest.fn(async () => ({
  items: [],
  total: 0,
  rawText: 'Fallback parse',
}));

jest.mock('@tabeza/shared/services/receiptParser', () => ({
  parseReceipt: mockParseReceipt
}));

describe('Print Relay API - parsedData Field Acceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: { id: 'test-job-id' },
      error: null
    });
  });

  describe('Requirement 5.1: Accept parsedData as optional field', () => {
    it('should accept request with parsedData and no rawData', async () => {
      const payload = {
        barId: 'test-bar-id',
        driverId: 'test-driver-id',
        parsedData: {
          items: [
            { name: 'Tusker Lager', quantity: 2, price: 300 }
          ],
          total: 600,
          subtotal: 600,
          tax: 0,
          receiptNumber: 'RCP-001',
          timestamp: '2024-01-15 14:30:00',
          rawText: 'Receipt text here'
        },
        printerName: 'Test Printer',
        documentName: 'Receipt',
        metadata: {
          confidence: 'high',
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
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBe('test-job-id');
      
      // Verify database insert was called with parsedData
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          bar_id: 'test-bar-id',
          driver_id: 'test-driver-id',
          parsed_data: payload.parsedData,
          raw_data: null, // rawData should be null when not provided
          metadata: expect.objectContaining({
            confidence: 'high',
            parsingMethod: 'local'
          })
        })
      );
      
      // parseReceipt should NOT be called when parsedData is provided
      expect(mockParseReceipt).not.toHaveBeenCalled();
    });

    it('should use parsedData directly without parsing when provided', async () => {
      const parsedData = {
        items: [
          { name: 'Item 1', quantity: 1, price: 100 },
          { name: 'Item 2', quantity: 2, price: 200 }
        ],
        total: 500,
        subtotal: 500,
        tax: 0,
        receiptNumber: 'RCP-002',
        timestamp: '2024-01-15 15:00:00',
        rawText: 'Receipt content'
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData,
        metadata: {
          confidence: 'high',
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
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify the exact parsedData was stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData
        })
      );
    });
  });

  describe('Requirement 5.2: Make rawData optional', () => {
    it('should accept request without rawData when parsedData is provided', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [],
          total: 100,
          rawText: 'Receipt'
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

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify raw_data is null when not provided
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_data: null
        })
      );
    });

    it('should reject request when both parsedData and rawData are missing', async () => {
      const payload = {
        barId: 'test-bar-id',
        printerName: 'Test Printer'
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

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('either parsedData or rawData must be provided');
      expect(data.category).toBe('validation');
    });

    it('should accept request with both parsedData and rawData (parsedData takes priority)', async () => {
      const parsedData = {
        items: [{ name: 'Item', quantity: 1, price: 100 }],
        total: 100,
        rawText: 'Parsed receipt'
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData,
        rawData: 'base64encodeddata==',
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
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify parsedData was used (not parsed from rawData)
      expect(mockParseReceipt).not.toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData,
          raw_data: 'base64encodeddata=='
        })
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should still accept old format with only rawData (no parsedData)', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Receipt text').toString('base64'),
        printerName: 'Test Printer'
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
      
      // parseReceipt should be called for backward compatibility
      expect(mockParseReceipt).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should reject request without barId', async () => {
      const payload = {
        parsedData: {
          items: [],
          total: 100,
          rawText: 'Receipt'
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

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('barId is required');
      expect(data.category).toBe('validation');
    });
  });
});
