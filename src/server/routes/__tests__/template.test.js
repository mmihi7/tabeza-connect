/**
 * Unit Tests for Template and Receipts API Routes
 */

const express = require('express');
const request = require('supertest');
const templateRouter = require('../template');
const fs = require('fs');
const axios = require('axios');

// Mock fs and axios modules
jest.mock('fs');
jest.mock('axios');

describe('Template and Receipts API Routes', () => {
  let app;
  let mockConfig;
  let mockCaptureService;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Mock config
    mockConfig = {
      barId: 'test-bar-123',
      apiUrl: 'https://tabeza.co.ke'
    };

    // Mock capture service
    mockCaptureService = {
      queueManager: {
        pendingPath: 'C:\\ProgramData\\Tabeza\\queue\\pending',
        uploadedPath: 'C:\\ProgramData\\Tabeza\\queue\\uploaded'
      }
    };

    // Set app locals
    app.locals.config = mockConfig;
    app.locals.captureService = mockCaptureService;

    // Mount router
    app.use('/api/template', templateRouter);
    app.use('/api/receipts', templateRouter);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/template/status', () => {
    it('should return template exists with version', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        version: '1.2',
        posSystem: 'AccelPOS',
        patterns: {
          item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
          total_line: '^TOTAL\\s+([0-9,]+\\.\\d{2})$'
        }
      }));

      const response = await request(app).get('/api/template/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        exists: true,
        version: '1.2',
        posSystem: 'AccelPOS',
        path: 'C:\\ProgramData\\Tabeza\\template.json',
        patterns: ['item_line', 'total_line']
      });
    });

    it('should return template does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/template/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        exists: false,
        version: null,
        path: 'C:\\ProgramData\\Tabeza\\template.json'
      });
    });

    it('should handle malformed template', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      const response = await request(app).get('/api/template/status');

      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(response.body.version).toBe('malformed');
      expect(response.body.error).toContain('malformed');
    });
  });

  describe('POST /api/template/generate', () => {
    const validReceipts = [
      'Receipt 1 content',
      'Receipt 2 content',
      'Receipt 3 content'
    ];

    it('should generate template successfully', async () => {
      const mockTemplate = {
        version: '1.2',
        posSystem: 'AccelPOS',
        patterns: {
          item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
          total_line: '^TOTAL\\s+([0-9,]+\\.\\d{2})$'
        }
      };

      axios.post.mockResolvedValue({
        data: { template: mockTemplate }
      });

      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: validReceipts });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('generated and saved');
      expect(response.body.template.version).toBe('1.2');
      expect(response.body.template.patterns).toEqual(['item_line', 'total_line']);

      // Verify API was called correctly
      expect(axios.post).toHaveBeenCalledWith(
        'https://tabeza.co.ke/api/receipts/generate-template',
        {
          receipts: validReceipts,
          barId: 'test-bar-123'
        },
        expect.any(Object)
      );

      // Verify template was written to disk
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should reject less than 3 receipts', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: ['Receipt 1', 'Receipt 2'] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exactly 3 receipt samples');
    });

    it('should reject more than 3 receipts', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: ['R1', 'R2', 'R3', 'R4'] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exactly 3 receipt samples');
    });

    it('should reject empty receipt', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: ['Receipt 1', '', 'Receipt 3'] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Receipt 2 is empty');
    });

    it('should reject non-string receipt', async () => {
      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: ['Receipt 1', 123, 'Receipt 3'] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Receipt 2 is empty or invalid');
    });

    it('should handle missing API URL', async () => {
      mockConfig.apiUrl = null;

      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: validReceipts });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('API URL not configured');
    });

    it('should handle connection refused error', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.post.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: validReceipts });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot connect');
    });

    it('should handle API error response', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Invalid receipts' }
        }
      });

      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: validReceipts });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid receipts');
    });

    it('should handle invalid template from API', async () => {
      axios.post.mockResolvedValue({
        data: { template: { version: '1.0' } } // Missing patterns
      });

      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: validReceipts });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('invalid template');
    });

    it('should create template directory if missing', async () => {
      axios.post.mockResolvedValue({
        data: {
          template: {
            version: '1.0',
            patterns: { item_line: 'test' }
          }
        }
      });

      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/template/generate')
        .send({ receipts: validReceipts });

      expect(response.status).toBe(200);
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('GET /api/receipts/recent', () => {
    it('should return recent receipts from both folders', async () => {
      fs.existsSync.mockReturnValue(true);
      
      // Mock pending files
      fs.readdirSync.mockImplementation((path) => {
        if (path.includes('pending')) {
          return ['receipt1.json', 'receipt2.json'];
        }
        if (path.includes('uploaded')) {
          return ['receipt3.json'];
        }
        return [];
      });

      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('receipt1')) {
          return JSON.stringify({
            id: '1',
            timestamp: '2026-03-02T10:00:00.000Z',
            receipt: { total: 100 }
          });
        }
        if (path.includes('receipt2')) {
          return JSON.stringify({
            id: '2',
            timestamp: '2026-03-02T11:00:00.000Z',
            receipt: { total: 200 }
          });
        }
        if (path.includes('receipt3')) {
          return JSON.stringify({
            id: '3',
            timestamp: '2026-03-02T12:00:00.000Z',
            receipt: { total: 300 }
          });
        }
      });

      const response = await request(app).get('/api/receipts/recent');

      expect(response.status).toBe(200);
      expect(response.body.receipts).toHaveLength(3);
      expect(response.body.count).toBe(3);
      
      // Should be sorted by timestamp (most recent first)
      expect(response.body.receipts[0].id).toBe('3');
      expect(response.body.receipts[0].status).toBe('uploaded');
      expect(response.body.receipts[2].id).toBe('1');
      expect(response.body.receipts[2].status).toBe('pending');
    });

    it('should handle missing queue manager', async () => {
      mockCaptureService.queueManager = null;

      const response = await request(app).get('/api/receipts/recent');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('not initialized');
    });

    it('should handle missing folders', async () => {
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/receipts/recent');

      expect(response.status).toBe(200);
      expect(response.body.receipts).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should skip corrupted receipt files', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['good.json', 'bad.json']);
      
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('good')) {
          return JSON.stringify({ id: '1', timestamp: '2026-03-02T10:00:00.000Z' });
        }
        if (path.includes('bad')) {
          return 'invalid json';
        }
      });

      const response = await request(app).get('/api/receipts/recent');

      expect(response.status).toBe(200);
      expect(response.body.receipts).toHaveLength(1);
      expect(response.body.receipts[0].id).toBe('1');
    });

    it('should limit to 20 most recent receipts', async () => {
      fs.existsSync.mockReturnValue(true);
      
      // Create 30 receipt files
      const files = Array.from({ length: 30 }, (_, i) => `receipt${i}.json`);
      fs.readdirSync.mockReturnValue(files);
      
      fs.readFileSync.mockImplementation((path) => {
        const match = path.match(/receipt(\d+)/);
        const num = parseInt(match[1]);
        return JSON.stringify({
          id: `${num}`,
          timestamp: new Date(2026, 2, 2, 10, num).toISOString()
        });
      });

      const response = await request(app).get('/api/receipts/recent');

      expect(response.status).toBe(200);
      expect(response.body.receipts).toHaveLength(20);
      expect(response.body.count).toBe(20);
    });
  });
});
