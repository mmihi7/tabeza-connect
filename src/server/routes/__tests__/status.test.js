/**
 * Unit Tests for Status API Route
 */

const express = require('express');
const request = require('supertest');
const statusRouter = require('../status');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('Status API Route', () => {
  let app;
  let mockCaptureService;
  let mockConfig;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Mock capture service
    mockCaptureService = {
      isRunning: true,
      lastActivity: '2026-03-02T10:00:00.000Z',
      queueManager: {
        getStats: jest.fn().mockReturnValue({
          pending: 5,
          uploaded: 100,
          failed: 2
        })
      }
    };

    // Mock config
    mockConfig = {
      barId: 'test-bar-123',
      apiUrl: 'https://tabeza.co.ke',
      watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
      httpPort: 8765
    };

    // Set app locals
    app.locals.captureService = mockCaptureService;
    app.locals.config = mockConfig;

    // Mount router
    app.use('/api/status', statusRouter);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/status', () => {
    it('should return status with template exists', async () => {
      // Mock template file exists
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({
        version: '1.2',
        posSystem: 'AccelPOS'
      }));

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'online',
        jobCount: 100,
        lastActivity: '2026-03-02T10:00:00.000Z',
        barId: 'test-bar-123',
        templateStatus: {
          exists: true,
          version: '1.2'
        },
        queueStats: {
          pending: 5,
          uploaded: 100,
          failed: 2
        }
      });
    });

    it('should return status with template missing', async () => {
      // Mock template file does not exist
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.templateStatus).toEqual({
        exists: false,
        version: null
      });
    });

    it('should return status with malformed template', async () => {
      // Mock template file exists but is malformed
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.templateStatus).toEqual({
        exists: true,
        version: 'malformed'
      });
    });

    it('should return offline status when service not running', async () => {
      mockCaptureService.isRunning = false;
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('offline');
    });

    it('should handle missing capture service', async () => {
      app.locals.captureService = null;

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Service not initialized');
    });

    it('should handle missing queue manager', async () => {
      mockCaptureService.queueManager = null;
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.queueStats).toEqual({
        pending: 0,
        uploaded: 0,
        failed: 0
      });
    });

    it('should handle null Bar ID', async () => {
      mockConfig.barId = null;
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.barId).toBeNull();
    });
  });
});
