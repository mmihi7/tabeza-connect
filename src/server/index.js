/**
 * HTTP Server for Management UI
 * 
 * Serves the Management UI dashboard and provides REST API endpoints
 * for configuration, monitoring, and template generation.
 * 
 * CRITICAL: This server is OPTIONAL. If it fails to start, the capture
 * service MUST continue running. HTTP server failure must not stop receipt
 * capture and upload functionality.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

class HTTPServer {
  constructor(config, captureService) {
    this.config = config;
    this.captureService = captureService;
    this.app = null;
    this.server = null;
    this.port = config.httpPort || 8765;
  }

  /**
   * Initialize Express application with middleware
   */
  initializeApp() {
    this.app = express();

    // CORS middleware for localhost origins
    this.app.use(cors({
      origin: [
        'http://localhost:8765',
        'http://127.0.0.1:8765',
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/
      ],
      credentials: true
    }));

    // Body parser middleware for JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Register routes and static files
    this.registerStatic();
    this.registerRoutes();

    // Error handling middleware (must be last)
    this.app.use(this.errorMiddleware.bind(this));
  }

  /**
   * Register static file serving for Management UI
   */
  registerStatic() {
    const publicPath = path.join(__dirname, 'public');
    this.app.use(express.static(publicPath));
    
    // Serve index.html for root path
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  /**
   * Register API routes
   */
  registerRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Store config and captureService in app.locals for route access
    this.app.locals.config = this.config;
    this.app.locals.captureService = this.captureService;

    // Mount API route modules
    const statusRoutes = require('./routes/status');
    const configRoutes = require('./routes/config');
    const logsRoutes = require('./routes/logs');
    const testPrintRoutes = require('./routes/test-print');
    const templateRoutes = require('./routes/template');
    
    this.app.use('/api/status', statusRoutes);
    this.app.use('/api/config', configRoutes);
    this.app.use('/api/logs', logsRoutes);
    this.app.use('/api/test-print', testPrintRoutes);
    this.app.use('/api/template', templateRoutes);
    this.app.use('/api/receipts', templateRoutes); // receipts/recent is in template.js
  }

  /**
   * Error handling middleware for unhandled exceptions
   */
  errorMiddleware(err, req, res, next) {
    console.error('[HTTPServer] Unhandled error:', err);
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
      }
    });
  }

  /**
   * Start the HTTP server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Initialize Express app
        this.initializeApp();

        // Attempt to bind to port
        this.server = this.app.listen(this.port, 'localhost', () => {
          console.log(`[HTTPServer] Management UI available at http://localhost:${this.port}`);
          resolve();
        });

        // Handle port already in use error
        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`[HTTPServer] ERROR: Port ${this.port} is already in use`);
            console.error('[HTTPServer] Another application is using this port.');
            console.error('[HTTPServer] Please close the other application or change the port in configuration.');
            reject(new Error(`Port ${this.port} already in use`));
          } else {
            console.error('[HTTPServer] Server error:', err);
            reject(err);
          }
        });

      } catch (err) {
        console.error('[HTTPServer] Failed to initialize server:', err);
        reject(err);
      }
    });
  }

  /**
   * Stop the HTTP server gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        console.log('[HTTPServer] Server not running, nothing to stop');
        resolve();
        return;
      }

      console.log('[HTTPServer] Shutting down gracefully...');
      
      this.server.close((err) => {
        if (err) {
          console.error('[HTTPServer] Error during shutdown:', err);
        } else {
          console.log('[HTTPServer] Server stopped successfully');
        }
        this.server = null;
        resolve();
      });

      // Force close after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        if (this.server) {
          console.warn('[HTTPServer] Forcing server shutdown after timeout');
          this.server = null;
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Check if server is running
   * @returns {boolean}
   */
  isRunning() {
    return this.server !== null && this.server.listening;
  }
}

module.exports = HTTPServer;
