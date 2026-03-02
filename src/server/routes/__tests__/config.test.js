/**
 * Unit Tests for Config API Route
 */

const express = require('express');
const request = require('supertest');
const configRouter = require('../config');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('Config API Route', () => {
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
      httpPort: 8765,
      source: 'registry'
    };

    // Set app locals
    app.locals.config = mockConfig;

    // Mount router
    app.use('/api/config', configRouter);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/config', () => {
    it('should return current configuration', async () => {
      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        barId: 'test-bar-123',
        apiUrl: 'https://tabeza.co.ke',
        watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
        httpPort: 8765,
        source: 'registry'
      });
    });

    it('should handle missing config', async () => {
      app.locals.config = null;

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Configuration not loaded');
    });

    it('should return empty string for missing Bar ID', async () => {
      mockConfig.barId = null;

      const response = await request(app).get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.barId).toBe('');
    });
  });

  describe('POST /api/config', () => {
    beforeEach(() => {
      // Mock fs methods
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
    });

    it('should update configuration successfully', async () => {
      const updates = {
        barId: 'new-bar-456',
        apiUrl: 'https://api.tabeza.co.ke',
        watchFolder: 'D:\\Tabeza\\Prints',
        httpPort: 9000
      };

      const response = await request(app)
        .post('/api/config')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
      
      // Verify writeFileSync was called
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should reject empty Bar ID', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ barId: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Bar ID cannot be empty');
    });

    it('should reject whitespace-only Bar ID', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ barId: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Bar ID cannot be empty');
    });

    it('should reject non-HTTPS API URL', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ apiUrl: 'http://tabeza.co.ke' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('must use HTTPS');
    });

    it('should reject invalid API URL', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ apiUrl: 'not-a-url' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not a valid URL');
    });

    it('should reject invalid HTTP port (too low)', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ httpPort: 80 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('between 1024 and 65535');
    });

    it('should reject invalid HTTP port (too high)', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ httpPort: 70000 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('between 1024 and 65535');
    });

    it('should reject non-numeric HTTP port', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ httpPort: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('between 1024 and 65535');
    });

    it('should create config directory if missing', async () => {
      fs.existsSync.mockReturnValue(false);

      const response = await request(app)
        .post('/api/config')
        .send({ barId: 'new-bar' });

      expect(response.status).toBe(200);
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should handle malformed existing config file', async () => {
      fs.readFileSync.mockReturnValue('invalid json');

      const response = await request(app)
        .post('/api/config')
        .send({ barId: 'new-bar' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should update in-memory config', async () => {
      const response = await request(app)
        .post('/api/config')
        .send({ barId: 'updated-bar' });

      expect(response.status).toBe(200);
      expect(mockConfig.barId).toBe('updated-bar');
    });

    it('should handle file write errors', async () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const response = await request(app)
        .post('/api/config')
        .send({ barId: 'new-bar' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to update');
    });
  });
});
