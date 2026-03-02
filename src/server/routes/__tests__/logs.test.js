/**
 * Unit Tests for Logs API Route
 */

const express = require('express');
const request = require('supertest');
const logsRouter = require('../logs');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

describe('Logs API Route', () => {
  let app;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());

    // Mount router
    app.use('/api/logs', logsRouter);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/logs', () => {
    it('should return recent log lines', async () => {
      const logContent = Array.from({ length: 150 }, (_, i) => 
        `[INFO] Log line ${i + 1}`
      ).join('\n');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(logContent);

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body.lines).toHaveLength(100); // Last 100 lines
      expect(response.body.totalLines).toBe(150);
      expect(response.body.lines[0]).toBe('[INFO] Log line 51'); // First of last 100
      expect(response.body.lines[99]).toBe('[INFO] Log line 150'); // Last line
    });

    it('should return all lines if less than 100', async () => {
      const logContent = Array.from({ length: 50 }, (_, i) => 
        `[INFO] Log line ${i + 1}`
      ).join('\n');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(logContent);

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body.lines).toHaveLength(50);
      expect(response.body.totalLines).toBe(50);
    });

    it('should handle missing log file', async () => {
      fs.existsSync.mockReturnValue(false);

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body.lines).toEqual([]);
      expect(response.body.message).toBe('No logs available yet');
    });

    it('should filter out empty lines', async () => {
      const logContent = '[INFO] Line 1\n\n\n[INFO] Line 2\n   \n[INFO] Line 3';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(logContent);

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body.lines).toHaveLength(3);
      expect(response.body.lines).toEqual([
        '[INFO] Line 1',
        '[INFO] Line 2',
        '[INFO] Line 3'
      ]);
    });

    it('should handle permission denied error', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        throw error;
      });

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Permission denied');
      expect(response.body.message).toContain('insufficient permissions');
    });

    it('should handle other file read errors', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Disk error');
      });

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to read logs');
      expect(response.body.message).toBe('Disk error');
    });

    it('should handle empty log file', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body.lines).toEqual([]);
      expect(response.body.totalLines).toBe(0);
    });
  });
});
