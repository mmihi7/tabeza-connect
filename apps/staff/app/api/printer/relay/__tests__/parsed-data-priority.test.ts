/**
 * Unit Tests for Parsed Data Priority Logic
 * **Feature Spec: local-receipt-parsing**
 * 
 * **Validates: Requirements 5.3, 5.4, 6.2, 6.6**
 * **Task: 6.2 - Implement parsed data priority logic**
 * 
 * These tests verify that the API route correctly prioritizes parsedData over rawData
 * and implements the correct fallback logic when parsedData is not provided.
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

// Mock the parseReceipt function (should only be called when parsedData is NOT provided)
const mockParseReceipt = jest.fn(async () => ({
  items: [{ name: 'Cloud Parsed Item', quantity: 1, price: 100 }],
  total: 100,
  rawText: 'Cloud parsed receipt',
}));

jest.mock('@tabeza/shared/services/receiptParser', () => ({
  parseReceipt: mockParseReceipt
}));

describe('Print Relay API - Parsed Data Priority Logic (Task 6.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: { id: 'test-job-id' },
      error: null
    });
  });

  describe('Requirement 5.3: Use parsedData directly without parsing', () => {
    it('should use parsedData directly when provided (no rawData)', async () => {
      const parsedData = {
        items: [
          { name: 'Local Parsed Item', quantity: 2, price: 250 }
        ],
        total: 500,
        subtotal: 500,
        tax: 0,
        receiptNumber: 'LOCAL-001',
        timestamp: '2024-01-15 14:30:00',
        rawText: 'Local parsed receipt',
        confidence: 'high' as const
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData,
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
      
      // Verify parseReceipt was NOT called (parsedData used directly)
      expect(mockParseReceipt).not.toHaveBeenCalled();
      
      // Verify the exact parsedData was stored
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData,
          metadata: expect.objectContaining({
            parsing_confidence: 'high',
            parsing_method: 'local'
          })
        })
      );
    });

    it('should use confidence from parsedData when provided', async () => {
      const parsedData = {
        items: [],
        total: 100,
        rawText: 'Receipt',
        confidence: 'medium' as const
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
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Verify confidence from parsedData is used
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'medium',
            parsing_method: 'local'
          })
        })
      );
    });

    it('should calculate confidence when not provided in parsedData', async () => {
      const parsedData = {
        items: [
          { name: 'Item 1', quantity: 1, price: 100 }
        ],
        total: 100,
        rawText: 'Receipt'
        // No confidence field
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
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Verify confidence is calculated (items + total = high)
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'high',
            parsing_method: 'local'
          })
        })
      );
    });
  });

  describe('Requirement 5.4: Fall back to parsing rawData when parsedData not provided', () => {
    it('should parse rawData when parsedData is not provided', async () => {
      const payload = {
        barId: 'test-bar-id',
        rawData: Buffer.from('Receipt text for cloud parsing').toString('base64'),
        printerName: 'Test Printer',
        documentName: 'Receipt'
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
      
      // Verify parseReceipt WAS called (fallback to cloud parsing)
      expect(mockParseReceipt).toHaveBeenCalledWith(
        'Receipt text for cloud parsing',
        'test-bar-id',
        'Receipt'
      );
      
      // Verify parsing method is 'cloud'
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'cloud'
          })
        })
      );
    });

    it('should set parsingMethod to cloud when using fallback parsing', async () => {
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
      
      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_method: 'cloud'
          })
        })
      );
    });
  });

  describe('Requirement 6.2, 6.6: Prioritize parsedData over rawData when both present', () => {
    it('should use parsedData and ignore rawData when both are provided', async () => {
      const parsedData = {
        items: [
          { name: 'Priority Item', quantity: 1, price: 500 }
        ],
        total: 500,
        rawText: 'Local parsed receipt',
        confidence: 'high' as const
      };

      const payload = {
        barId: 'test-bar-id',
        parsedData,
        rawData: Buffer.from('This should be ignored').toString('base64'),
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
      
      // Verify parseReceipt was NOT called (parsedData takes priority)
      expect(mockParseReceipt).not.toHaveBeenCalled();
      
      // Verify parsedData was used, not rawData
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData,
          raw_data: Buffer.from('This should be ignored').toString('base64'),
          metadata: expect.objectContaining({
            parsing_confidence: 'high',
            parsing_method: 'local'
          })
        })
      );
    });

    it('should store both parsedData and rawData when both provided', async () => {
      const parsedData = {
        items: [],
        total: 100,
        rawText: 'Parsed'
      };
      const rawData = 'base64data==';

      const payload = {
        barId: 'test-bar-id',
        parsedData,
        rawData
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
      
      // Both should be stored, but parsedData is used for processing
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData,
          raw_data: rawData
        })
      );
    });
  });

  describe('Requirement 6.4: Log parsing method used', () => {
    it('should log local parsing method when parsedData is used', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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

      await POST(request);
      
      // Verify logging includes parsingMethod
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Attempting database insert:'),
        expect.objectContaining({
          sanitizedData: expect.objectContaining({
            parsing_method: 'local'
          })
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log cloud parsing method when rawData is parsed', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

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

      await POST(request);
      
      // Verify logging includes parsingMethod
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('💾 Attempting database insert:'),
        expect.objectContaining({
          sanitizedData: expect.objectContaining({
            parsing_method: 'cloud'
          })
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle parsedData with low confidence', async () => {
      const parsedData = {
        items: [],
        total: 0,
        rawText: 'Failed parse',
        confidence: 'low' as const
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
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parsed_data: parsedData,
          metadata: expect.objectContaining({
            parsing_confidence: 'low',
            parsing_method: 'local'
          })
        })
      );
    });

    it('should calculate medium confidence for items without total', async () => {
      const parsedData = {
        items: [
          { name: 'Item', quantity: 1, price: 100 }
        ],
        total: 0, // No total
        rawText: 'Receipt'
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
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'medium'
          })
        })
      );
    });

    it('should calculate medium confidence for total without items', async () => {
      const parsedData = {
        items: [],
        total: 500,
        rawText: 'Receipt'
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
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'medium'
          })
        })
      );
    });

    it('should calculate low confidence for empty parsedData', async () => {
      const parsedData = {
        items: [],
        total: 0,
        rawText: 'Receipt'
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
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            parsing_confidence: 'low'
          })
        })
      );
    });
  });
});
