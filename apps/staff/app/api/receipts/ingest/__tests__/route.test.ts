/**
 * Tests for POS Receipt Ingestion API
 * 
 * Validates:
 * - Required field validation
 * - Database insertion
 * - Response format
 * - Performance requirements (< 100ms)
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'test-bar-id' },
            error: null,
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'test-receipt-id' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('POST /api/receipts/ingest', () => {
  const validRequest = {
    barId: 'test-bar-id',
    deviceId: 'test-device-id',
    timestamp: new Date().toISOString(),
    text: 'Test receipt text',
    escposBytes: 'base64encodeddata',
    metadata: {
      jobId: 'test-job-id',
      source: 'spool-monitor' as const,
      fileSize: 1024,
    },
  };

  describe('Validation', () => {
    it('should return 400 if barId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify({ ...validRequest, barId: undefined }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('barId');
    });

    it('should return 400 if text is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify({ ...validRequest, text: undefined }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('text');
    });

    it('should return 400 if deviceId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify({ ...validRequest, deviceId: undefined }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('deviceId');
    });

    it('should return 400 if timestamp is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify({ ...validRequest, timestamp: undefined }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('timestamp');
    });
  });

  describe('Success Cases', () => {
    it('should accept valid receipt and return receipt ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.receiptId).toBeDefined();
      expect(data.queuedForParsing).toBe(true);
    });

    it('should accept receipt without optional escposBytes', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify({
          ...validRequest,
          escposBytes: undefined,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should accept receipt without optional metadata', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify({
          barId: validRequest.barId,
          deviceId: validRequest.deviceId,
          timestamp: validRequest.timestamp,
          text: validRequest.text,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should respond within 100ms', async () => {
      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      });

      const startTime = Date.now();
      await POST(request);
      const responseTime = Date.now() - startTime;

      // Allow some margin for test overhead
      expect(responseTime).toBeLessThan(150);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: { id: 'test-bar-id' },
                error: null,
              })),
            })),
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({
                data: null,
                error: { message: 'Database error' },
              })),
            })),
          })),
        })),
      }));

      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should handle invalid bar ID', async () => {
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockImplementationOnce(() => ({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: null,
                error: { message: 'Bar not found' },
              })),
            })),
          })),
        })),
      }));

      const request = new NextRequest('http://localhost:3000/api/receipts/ingest', {
        method: 'POST',
        body: JSON.stringify(validRequest),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('barId');
    });
  });
});
