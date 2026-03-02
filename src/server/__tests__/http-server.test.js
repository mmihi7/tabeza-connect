/**
 * Unit tests for HTTP Server
 * 
 * Tests server startup, shutdown, middleware, static file serving,
 * CORS headers, and error handling.
 */

const HTTPServer = require('../index');
const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

describe('HTTPServer', () => {
  let server;
  let mockConfig;
  let mockCaptureService;

  beforeEach(() => {
    mockConfig = {
      httpPort: 8765,
      barId: 'test-bar-id',
      apiUrl: 'https://test.tabeza.co.ke'
    };

    mockCaptureService = {
      getStatus: jest.fn().mockReturnValue({
        status: 'online',
        jobCount: 42,
        lastActivity: new Date().toISOString()
      })
    };

    server = new HTTPServer(mockConfig, mockCaptureService);
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
    }
  });

  describe('Server Startup', () => {
    test('should initialize Express app', () => {
      server.initializeApp();
      expect(server.app).toBeDefined();
      expect(typeof server.app).toBe('function'); // Express app is a function
    });

    test('should start server on configured port', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
      expect(server.server.listening).toBe(true);
    });

    test('should bind to localhost only', async () => {
      await server.start();
      const address = server.server.address();
      expect(address.address).toBe('127.0.0.1');
    });

    test('should use default port 8765 if not configured', async () => {
      const serverNoPort = new HTTPServer({}, mockCaptureService);
      await serverNoPort.start();
      expect(serverNoPort.port).toBe(8765);
      await serverNoPort.stop();
    });

    test('should reject if port already in use', async () => {
      // Start first server
      await server.start();

      // Try to start second server on same port
      const server2 = new HTTPServer(mockConfig, mockCaptureService);
      
      await expect(server2.start()).rejects.toThrow('Port 8765 already in use');
    });

    test('should handle server initialization errors', async () => {
      // Mock Express to throw error
      jest.spyOn(server, 'initializeApp').mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      await expect(server.start()).rejects.toThrow('Initialization failed');
    });
  });

  describe('Server Shutdown', () => {
    test('should stop server gracefully', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
      expect(server.server).toBeNull();
    });

    test('should handle stop when server not running', async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });

    test('should force close after timeout', async () => {
      await server.start();
      
      // Mock server.close to never call callback
      const originalClose = server.server.close;
      server.server.close = jest.fn();

      const stopPromise = server.stop();
      
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(5000);
      
      await stopPromise;
      expect(server.server).toBeNull();
    }, 10000);
  });

  describe('Static File Serving', () => {
    beforeEach(async () => {
      // Create mock public directory
      const publicPath = path.join(__dirname, '../public');
      if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
      }
      
      // Create mock index.html
      fs.writeFileSync(
        path.join(publicPath, 'index.html'),
        '<html><body>Management UI</body></html>'
      );

      await server.start();
    });

    afterEach(() => {
      // Clean up mock files
      const publicPath = path.join(__dirname, '../public');
      if (fs.existsSync(publicPath)) {
        fs.rmSync(publicPath, { recursive: true, force: true });
      }
    });

    test('should serve index.html at root path', async () => {
      const response = await request(server.app)
        .get('/')
        .expect(200);

      expect(response.text).toContain('Management UI');
    });

    test('should serve static files from public directory', async () => {
      const response = await request(server.app)
        .get('/index.html')
        .expect(200);

      expect(response.text).toContain('Management UI');
    });

    test('should return 404 for non-existent files', async () => {
      await request(server.app)
        .get('/nonexistent.html')
        .expect(404);
    });
  });

  describe('CORS Headers', () => {
    beforeEach(async () => {
      await server.start();
    });

    test('should allow localhost:8765 origin', async () => {
      const response = await request(server.app)
        .get('/health')
        .set('Origin', 'http://localhost:8765')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8765');
    });

    test('should allow 127.0.0.1:8765 origin', async () => {
      const response = await request(server.app)
        .get('/health')
        .set('Origin', 'http://127.0.0.1:8765')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8765');
    });

    test('should allow localhost with any port', async () => {
      const response = await request(server.app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should include credentials in CORS', async () => {
      const response = await request(server.app)
        .get('/health')
        .set('Origin', 'http://localhost:8765')
        .expect(200);

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Body Parser Middleware', () => {
    beforeEach(async () => {
      // Add test route that echoes body
      server.initializeApp();
      server.app.post('/test-json', (req, res) => {
        res.json(req.body);
      });
      await server.start();
    });

    test('should parse JSON body', async () => {
      const testData = { name: 'Test', value: 123 };
      
      const response = await request(server.app)
        .post('/test-json')
        .send(testData)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body).toEqual(testData);
    });

    test('should handle large JSON payloads up to 10mb', async () => {
      const largeData = { data: 'x'.repeat(1024 * 1024) }; // 1MB string
      
      const response = await request(server.app)
        .post('/test-json')
        .send(largeData)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.data.length).toBe(1024 * 1024);
    });

    test('should parse URL-encoded body', async () => {
      const response = await request(server.app)
        .post('/test-json')
        .send('name=Test&value=123')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(200);

      expect(response.body).toEqual({ name: 'Test', value: '123' });
    });
  });

  describe('Error Middleware', () => {
    beforeEach(async () => {
      server.initializeApp();
      
      // Add route that throws error
      server.app.get('/test-error', (req, res, next) => {
        const error = new Error('Test error');
        error.status = 400;
        next(error);
      });

      // Add route that throws unhandled error
      server.app.get('/test-unhandled', (req, res, next) => {
        throw new Error('Unhandled error');
      });

      await server.start();
    });

    test('should handle errors with custom status', async () => {
      const response = await request(server.app)
        .get('/test-error')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Test error');
    });

    test('should handle unhandled errors with 500 status', async () => {
      const response = await request(server.app)
        .get('/test-unhandled')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Unhandled error');
    });

    test('should include stack trace in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(server.app)
        .get('/test-error')
        .expect(400);

      expect(response.body.error.stack).toBeDefined();
      
      delete process.env.NODE_ENV;
    });

    test('should not include stack trace in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(server.app)
        .get('/test-error')
        .expect(400);

      expect(response.body.error.stack).toBeUndefined();
      
      delete process.env.NODE_ENV;
    });
  });

  describe('Health Check Endpoint', () => {
    beforeEach(async () => {
      await server.start();
    });

    test('should respond to health check', async () => {
      const response = await request(server.app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('isRunning()', () => {
    test('should return false when server not started', () => {
      expect(server.isRunning()).toBe(false);
    });

    test('should return true when server is running', async () => {
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    test('should return false after server stopped', async () => {
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });
});
