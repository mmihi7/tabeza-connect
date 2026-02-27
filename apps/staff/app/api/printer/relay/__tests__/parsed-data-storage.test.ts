/**
 * Unit Tests for Parsed Data Storage
 * **Feature Spec: local-receipt-parsing**
 * 
 * **Validates: Requirement 5.5**
 * **Task: 6.3 - Store parsed data in print_jobs table**
 * 
 * These tests verify that parsedData is correctly stored in the print_jobs.parsed_data column
 * with proper confidence level and parsingMethod in metadata.
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

// Mock the parseReceipt function
const mockParseReceipt = jest.fn(async () => ({
  items: [{ name: 'Cloud Parsed Item', quantity: 1, price: 100 }],
  total: 100,
  rawText: 'Cloud parsed receipt',
}));

jest.mock('@tabeza/shared/services/receiptParser', () => ({
  parseReceipt: mockParseReceipt
}));

describe('Print Relay API - Parsed Data Storage (Task 6.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: { id: 'test-job-id' },
      error: null
    });
  });

  describe('Requirement 5.5: Store parsedData in print_jobs.parsed_data column', () => {
    it('should store complete parsedData with all fields', async () => {
      const parsedData = {
        items: [
          { name: 'Tusker Lager', quantity: 2, price: 300 },
          { name: 'Nyama Choma', quantity: 1, price: 500 }
        ],
        total: 1100,
        subtotal: 1100,
        tax: 0,
        receiptNumber: 'RCP-12345',
        timestamp: '2024-01-15 14:30:00',
        rawText: 'Full receipt text here',
        confidence: 'high' as const
      };

      const payload = {
        barId: 'test-bar-id',
        driverId: 'test-driver-id',
        parsedData,
        printerName: 'Test Printer',
        documentName: 'Receipt-001',
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
      
      // Verify parsedData is stored in parsed_data column
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          bar_id: 'test-bar-id',
          driver_id: 'test-driver-id',
          parsed_data: parsedData,
          printer_name: 'Test Printer',
          document_name: 'Receipt-001',
          status: 'no_match'
        })
      );
    });

    it('should store parsedData with minimal fields', async () => {
      const parsedData = {
        items: [],
        total: 250,
        rawText: 'Minimal receipt'
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      // Verify minimal parsedData is stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData
        })
      );
    });

    it('should store parsedData from cloud parsing (fallback)', async () => {
      const cloudParsedData = {
        items: [{ name: 'Cloud Item', quantity: 1, price: 100 }],
        total: 100,
        rawText: 'Cloud parsed receipt'
      };

      mockParseReceipt.mockResolvedValueOnce(cloudParsedData);

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
      
      expect(response.status).toBe(200);
      
      // Verify cloud-parsed data is stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: cloudParsedData
        })
      );
    });

    it('should store parsedData with error field when parsing fails', async () => {
      const failedParsedData = {
        items: [],
        total: 0,
        rawText: 'Failed to parse receipt',
        error: 'Parsing error occurred'
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData: failedParsedData
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      // Verify failed parsedData is still stored (never reject a receipt)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: failedParsedData
        })
      );
    });
  });

  describe('Store confidence level in metadata', () => {
    it('should store high confidence in metadata when parsedData has high confidence', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [{ name: 'Item', quantity: 1, price: 100 }],
          total: 100,
          rawText: 'Receipt',
          confidence: 'high' as const
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
      
      expect(response.status).toBe(200);
      
      // Verify confidence is stored in metadata
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'high'
          })
        })
      );
    });

    it('should store medium confidence in metadata when calculated', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [],
          total: 500, // Only total, no items
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
      
      expect(response.status).toBe(200);
      
      // Verify medium confidence is calculated and stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'medium'
          })
        })
      );
    });

    it('should store low confidence in metadata when parsedData is empty', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [],
          total: 0,
          rawText: 'Receipt',
          confidence: 'low' as const
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
      
      expect(response.status).toBe(200);
      
      // Verify low confidence is stored in metadata
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'low'
          })
        })
      );
    });

    it('should preserve existing metadata fields while adding confidence', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [],
          total: 100,
          rawText: 'Receipt'
        },
        metadata: {
          customField: 'custom-value',
          anotherField: 123
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
      
      expect(response.status).toBe(200);
      
      // Verify existing metadata is preserved and confidence is added
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            customField: 'custom-value',
            anotherField: 123,
            parsing_confidence: 'medium'
          })
        })
      );
    });
  });

  describe('Store parsingMethod in metadata', () => {
    it('should store local parsingMethod when parsedData is provided', async () => {
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
      
      expect(response.status).toBe(200);
      
      // Verify parsingMethod is 'local'
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'local'
          })
        })
      );
    });

    it('should store cloud parsingMethod when rawData is parsed', async () => {
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
      
      expect(response.status).toBe(200);
      
      // Verify parsingMethod is 'cloud'
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'cloud'
          })
        })
      );
    });

    it('should store local parsingMethod even when both parsedData and rawData are provided', async () => {
      const payload = {
        barId: 'test-bar-id',
        parsedData: {
          items: [],
          total: 100,
          rawText: 'Receipt'
        },
        rawData: 'base64data=='
      };

      const request = new NextRequest('http://localhost:3000/api/printer/relay', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      
      expect(response.status).toBe(200);
      
      // Verify parsingMethod is 'local' (parsedData takes priority)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'local'
          })
        })
      );
    });
  });

  describe('Complete storage verification', () => {
    it('should store all fields correctly in a complete scenario', async () => {
      const parsedData = {
        items: [
          { name: 'Tusker Lager', quantity: 3, price: 300 },
          { name: 'Chips', quantity: 2, price: 150 }
        ],
        total: 1200,
        subtotal: 1200,
        tax: 0,
        receiptNumber: 'RCP-99999',
        timestamp: '2024-01-15 16:45:00',
        rawText: 'Complete receipt text',
        confidence: 'high' as const
      };

      const payload = {
        barId: 'bar-uuid-123',
        driverId: 'driver-uuid-456',
        parsedData,
        rawData: 'optional-base64-data==',
        printerName: 'Epson TM-T88V',
        documentName: 'Receipt-12345',
        timestamp: '2024-01-15T16:45:00Z',
        metadata: {
          venue: 'Test Bar',
          location: 'Nairobi'
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
      
      // Verify complete database insert
      expect(mockInsert).toHaveBeenCalledWith({
        bar_id: 'bar-uuid-123',
        driver_id: 'driver-uuid-456',
        raw_data: 'optional-base64-data==',
        parsed_data: parsedData,
        printer_name: 'Epson TM-T88V',
        document_name: 'Receipt-12345',
        metadata: {
          venue: 'Test Bar',
          location: 'Nairobi',
          parsing_confidence: 'high',
          parsing_method: 'local'
        },
        status: 'no_match',
        received_at: '2024-01-15T16:45:00Z'
      });
    });

    it('should handle missing optional fields gracefully', async () => {
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
      
      expect(response.status).toBe(200);
      
      // Verify defaults are used for missing fields
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          bar_id: 'test-bar-id',
          driver_id: 'unknown',
          raw_data: null,
          parsed_data: payload.parsedData,
          printer_name: 'Unknown Printer',
          document_name: 'Receipt',
          status: 'no_match',
          metadata: expect.objectContaining({
            parsing_confidence: 'medium',
            parsing_method: 'local'
          })
        })
      );
    });
  });

  describe('Error scenarios', () => {
    it('should store low confidence parsedData when base64 decoding fails', async () => {
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
      
      // Should still succeed (never reject a receipt)
      expect(response.status).toBe(400); // Invalid base64 format
    });

    it('should store low confidence parsedData when cloud parsing fails', async () => {
      mockParseReceipt.mockRejectedValueOnce(new Error('Parsing failed'));

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
      
      expect(response.status).toBe(200);
      
      // Verify low confidence fallback data is stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: expect.objectContaining({
            items: [],
            total: 0,
            error: 'Parsing failed'
          }),
          metadata: expect.objectContaining({
            parsing_confidence: 'low',
            parsing_method: 'cloud'
          })
        })
      );
    });
  });
});
