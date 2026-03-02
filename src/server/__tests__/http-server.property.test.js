/**
 * Property-Based Tests for HTTP Server
 * 
 * Property 16: HTTP Server Fault Isolation
 * For any HTTP server startup failure, the Capture Service should continue
 * running and processing receipts without interruption.
 */

const fc = require('fast-check');
const HTTPServer = require('../index');
const net = require('net');

describe('Property 16: HTTP Server Fault Isolation', () => {
  /**
   * Helper to create a mock capture service that tracks its state
   */
  function createMockCaptureService() {
    return {
      isRunning: true,
      receiptsProcessed: 0,
      
      processReceipt: function() {
        if (this.isRunning) {
          this.receiptsProcessed++;
          return true;
        }
        return false;
      },
      
      stop: function() {
        this.isRunning = false;
      },
      
      getStatus: function() {
        return {
          status: this.isRunning ? 'online' : 'offline',
          jobCount: this.receiptsProcessed,
          lastActivity: new Date().toISOString()
        };
      }
    };
  }

  /**
   * Helper to occupy a port so HTTP server startup will fail
   */
  function occupyPort(port) {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(port, 'localhost', () => {
        resolve(server);
      });
      server.on('error', reject);
    });
  }

  afterEach(() => {
    // Clean up any servers
    jest.clearAllMocks();
  });

  test('Property 16: Capture service continues when HTTP server fails to start (port in use)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8000, max: 9000 }), // Random port
        fc.integer({ min: 1, max: 10 }),      // Number of receipts to process
        async (port, receiptCount) => {
          // Occupy the port to force HTTP server failure
          const blockingServer = await occupyPort(port);
          
          try {
            // Create capture service
            const captureService = createMockCaptureService();
            
            // Create HTTP server with occupied port
            const config = { httpPort: port };
            const httpServer = new HTTPServer(config, captureService);
            
            // Attempt to start HTTP server (should fail)
            let httpServerFailed = false;
            try {
              await httpServer.start();
            } catch (err) {
              httpServerFailed = true;
              // Verify it's a port conflict error
              expect(err.message).toContain('already in use');
            }
            
            // CRITICAL: HTTP server must have failed
            expect(httpServerFailed).toBe(true);
            expect(httpServer.isRunning()).toBe(false);
            
            // CRITICAL: Capture service must still be running
            expect(captureService.isRunning).toBe(true);
            
            // Process receipts with capture service
            for (let i = 0; i < receiptCount; i++) {
              const processed = captureService.processReceipt();
              expect(processed).toBe(true);
            }
            
            // Verify all receipts were processed despite HTTP server failure
            expect(captureService.receiptsProcessed).toBe(receiptCount);
            
            // Verify capture service status is still online
            const status = captureService.getStatus();
            expect(status.status).toBe('online');
            expect(status.jobCount).toBe(receiptCount);
            
          } finally {
            // Clean up blocking server
            await new Promise(resolve => blockingServer.close(resolve));
          }
        }
      ),
      {
        numRuns: 20,
        endOnFailure: true
      }
    );
  });

  test('Property 16: Capture service continues when HTTP server crashes after startup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8000, max: 9000 }), // Random port
        fc.integer({ min: 1, max: 10 }),      // Receipts before crash
        fc.integer({ min: 1, max: 10 }),      // Receipts after crash
        async (port, receiptsBefore, receiptsAfter) => {
          const captureService = createMockCaptureService();
          const config = { httpPort: port };
          const httpServer = new HTTPServer(config, captureService);
          
          try {
            // Start HTTP server successfully
            await httpServer.start();
            expect(httpServer.isRunning()).toBe(true);
            
            // Process some receipts while HTTP server is running
            for (let i = 0; i < receiptsBefore; i++) {
              captureService.processReceipt();
            }
            
            expect(captureService.receiptsProcessed).toBe(receiptsBefore);
            
            // Simulate HTTP server crash
            await httpServer.stop();
            expect(httpServer.isRunning()).toBe(false);
            
            // CRITICAL: Capture service must still be running
            expect(captureService.isRunning).toBe(true);
            
            // Process more receipts after HTTP server stopped
            for (let i = 0; i < receiptsAfter; i++) {
              const processed = captureService.processReceipt();
              expect(processed).toBe(true);
            }
            
            // Verify total receipts processed
            const totalReceipts = receiptsBefore + receiptsAfter;
            expect(captureService.receiptsProcessed).toBe(totalReceipts);
            
            // Verify capture service is still online
            const status = captureService.getStatus();
            expect(status.status).toBe('online');
            expect(status.jobCount).toBe(totalReceipts);
            
          } finally {
            if (httpServer.isRunning()) {
              await httpServer.stop();
            }
          }
        }
      ),
      {
        numRuns: 20,
        endOnFailure: true
      }
    );
  });

  test('Property 16: Multiple HTTP server restart attempts do not affect capture service', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8000, max: 9000 }), // Random port
        fc.integer({ min: 2, max: 5 }),       // Number of restart attempts
        fc.integer({ min: 1, max: 5 }),       // Receipts per cycle
        async (port, restartAttempts, receiptsPerCycle) => {
          const captureService = createMockCaptureService();
          const config = { httpPort: port };
          
          let totalReceipts = 0;
          
          for (let attempt = 0; attempt < restartAttempts; attempt++) {
            const httpServer = new HTTPServer(config, captureService);
            
            try {
              // Start HTTP server
              await httpServer.start();
              expect(httpServer.isRunning()).toBe(true);
              
              // Process receipts
              for (let i = 0; i < receiptsPerCycle; i++) {
                captureService.processReceipt();
                totalReceipts++;
              }
              
              // Stop HTTP server
              await httpServer.stop();
              expect(httpServer.isRunning()).toBe(false);
              
              // CRITICAL: Capture service must still be running
              expect(captureService.isRunning).toBe(true);
              expect(captureService.receiptsProcessed).toBe(totalReceipts);
              
            } finally {
              if (httpServer.isRunning()) {
                await httpServer.stop();
              }
            }
          }
          
          // Verify capture service processed all receipts across all cycles
          expect(captureService.receiptsProcessed).toBe(totalReceipts);
          expect(captureService.isRunning).toBe(true);
        }
      ),
      {
        numRuns: 15,
        endOnFailure: true
      }
    );
  });

  test('Property 16: HTTP server initialization errors do not stop capture service', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Number of receipts to process
        async (receiptCount) => {
          const captureService = createMockCaptureService();
          
          // Create HTTP server with invalid configuration to force initialization error
          const config = { httpPort: -1 }; // Invalid port
          const httpServer = new HTTPServer(config, captureService);
          
          // Mock initializeApp to throw error
          jest.spyOn(httpServer, 'initializeApp').mockImplementation(() => {
            throw new Error('Initialization failed');
          });
          
          // Attempt to start HTTP server (should fail)
          let httpServerFailed = false;
          try {
            await httpServer.start();
          } catch (err) {
            httpServerFailed = true;
          }
          
          // CRITICAL: HTTP server must have failed
          expect(httpServerFailed).toBe(true);
          expect(httpServer.isRunning()).toBe(false);
          
          // CRITICAL: Capture service must still be running
          expect(captureService.isRunning).toBe(true);
          
          // Process receipts
          for (let i = 0; i < receiptCount; i++) {
            const processed = captureService.processReceipt();
            expect(processed).toBe(true);
          }
          
          // Verify all receipts were processed
          expect(captureService.receiptsProcessed).toBe(receiptCount);
          expect(captureService.getStatus().status).toBe('online');
        }
      ),
      {
        numRuns: 20,
        endOnFailure: true
      }
    );
  });
});
