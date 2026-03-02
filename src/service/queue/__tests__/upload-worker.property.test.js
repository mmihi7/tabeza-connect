/**
 * Property-Based Tests for Upload Worker
 * 
 * Tests universal properties that should hold across all inputs.
 */

const fc = require('fast-check');
const UploadWorker = require('../upload-worker');
const QueueManager = require('../queue-manager');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock axios
jest.mock('axios');

describe('Upload Worker - Property-Based Tests', () => {
  let tempDir;
  let queueManager;
  let worker;
  let mockAxiosInstance;

  beforeEach(() => {
    // Create temp directory for queue
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-worker-test-'));
    queueManager = new QueueManager(tempDir);

    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn()
    };
    axios.create.mockReturnValue(mockAxiosInstance);

    // Create worker
    const config = {
      apiUrl: 'https://test.tabeza.co.ke',
      barId: 'test-bar-123'
    };
    worker = new UploadWorker(queueManager, config);
  });

  afterEach(() => {
    if (worker.isRunning) {
      worker.stop();
    }

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    jest.clearAllMocks();
  });

  /**
   * Property 10: Upload Success State Transition
   * 
   * For any pending receipt that uploads successfully (HTTP 2xx), 
   * the Upload Worker should move the file from pending\ to uploaded\ 
   * and not attempt to upload it again.
   */
  describe('Property 10: Upload Success State Transition', () => {
    it('should move successfully uploaded receipts from pending to uploaded', async () => {
      // Feature: management-ui-and-missing-features, Property 10: Upload Success State Transition
      
      await fc.assert(
        fc.asyncProperty(
          // Generate random receipt data
          fc.record({
            barId: fc.string({ minLength: 1, maxLength: 50 }),
            driverId: fc.string({ minLength: 1, maxLength: 50 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            confidence: fc.double({ min: 0, max: 1 }),
            receipt: fc.record({
              items: fc.array(fc.record({
                name: fc.string({ minLength: 1, maxLength: 100 }),
                qty: fc.integer({ min: 1, max: 100 }),
                price: fc.double({ min: 0.01, max: 10000 })
              }), { maxLength: 20 }),
              total: fc.double({ min: 0, max: 100000 }),
              receiptNumber: fc.string({ minLength: 1, maxLength: 50 }),
              rawText: fc.string({ maxLength: 1000 })
            })
          }),
          async (receiptData) => {
            // Enqueue receipt
            const id = queueManager.enqueue(receiptData);
            
            // Mock successful upload
            mockAxiosInstance.post.mockResolvedValue({ 
              data: { success: true },
              status: 200 
            });

            // Process the receipt
            worker.isRunning = true;
            const result = await worker.processNext();

            // Verify success
            expect(result).toBe(true);

            // Verify file moved from pending to uploaded
            const pendingPath = path.join(tempDir, 'pending', `${id}.json`);
            const uploadedPath = path.join(tempDir, 'uploaded', `${id}.json`);
            
            expect(fs.existsSync(pendingPath)).toBe(false);
            expect(fs.existsSync(uploadedPath)).toBe(true);

            // Verify receipt not uploaded again on next poll
            mockAxiosInstance.post.mockClear();
            const nextResult = await worker.processNext();
            
            // Should return false (no pending items)
            expect(nextResult).toBe(false);
            expect(mockAxiosInstance.post).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 } // Reduced runs for async tests
      );
    });

    it('should handle multiple successful uploads in sequence', async () => {
      // Feature: management-ui-and-missing-features, Property 10: Upload Success State Transition
      
      await fc.assert(
        fc.asyncProperty(
          // Generate array of receipts
          fc.array(
            fc.record({
              barId: fc.string({ minLength: 1, maxLength: 50 }),
              driverId: fc.string({ minLength: 1, maxLength: 50 }),
              timestamp: fc.date().map(d => d.toISOString()),
              parsed: fc.boolean(),
              confidence: fc.double({ min: 0, max: 1 }),
              receipt: fc.record({
                items: fc.array(fc.record({
                  name: fc.string({ minLength: 1, maxLength: 50 }),
                  qty: fc.integer({ min: 1, max: 10 }),
                  price: fc.double({ min: 0.01, max: 1000 })
                }), { maxLength: 5 }),
                total: fc.double({ min: 0, max: 10000 }),
                receiptNumber: fc.string({ minLength: 1, maxLength: 20 })
              })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (receipts) => {
            // Enqueue all receipts
            const ids = receipts.map(r => queueManager.enqueue(r));
            
            // Mock successful uploads
            mockAxiosInstance.post.mockResolvedValue({ 
              data: { success: true },
              status: 200 
            });

            worker.isRunning = true;

            // Process all receipts
            for (let i = 0; i < receipts.length; i++) {
              const result = await worker.processNext();
              expect(result).toBe(true);
            }

            // Verify all files moved to uploaded
            ids.forEach(id => {
              const pendingPath = path.join(tempDir, 'pending', `${id}.json`);
              const uploadedPath = path.join(tempDir, 'uploaded', `${id}.json`);
              
              expect(fs.existsSync(pendingPath)).toBe(false);
              expect(fs.existsSync(uploadedPath)).toBe(true);
            });

            // Verify no more pending items
            const stats = queueManager.getStats();
            expect(stats.pending).toBe(0);
            expect(stats.uploaded).toBe(receipts.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 11: Upload Retry with Exponential Backoff
   * 
   * For any pending receipt that fails to upload, the Upload Worker should 
   * increment the uploadAttempts counter and retry with exponential backoff 
   * delays (5s, 10s, 20s, 40s) for up to 4 attempts.
   */
  describe('Property 11: Upload Retry with Exponential Backoff', () => {
    it('should retry failed uploads with exponential backoff', async () => {
      // Feature: management-ui-and-missing-features, Property 11: Upload Retry with Exponential Backoff
      
      await fc.assert(
        fc.asyncProperty(
          // Generate receipt and error scenario
          fc.record({
            receipt: fc.record({
              barId: fc.string({ minLength: 1, maxLength: 50 }),
              driverId: fc.string({ minLength: 1, maxLength: 50 }),
              timestamp: fc.date().map(d => d.toISOString()),
              parsed: fc.boolean(),
              confidence: fc.double({ min: 0, max: 1 }),
              receipt: fc.record({
                items: fc.array(fc.record({
                  name: fc.string({ minLength: 1, maxLength: 50 }),
                  qty: fc.integer({ min: 1, max: 10 }),
                  price: fc.double({ min: 0.01, max: 1000 })
                }), { maxLength: 5 }),
                total: fc.double({ min: 0, max: 10000 })
              })
            }),
            errorType: fc.constantFrom('5xx', 'timeout', 'connection_refused')
          }),
          async ({ receipt, errorType }) => {
            // Enqueue receipt
            const id = queueManager.enqueue(receipt);
            
            // Mock failure based on error type
            let error;
            if (errorType === '5xx') {
              error = new Error('Server error');
              error.response = { status: 500, statusText: 'Internal Server Error' };
            } else if (errorType === 'timeout') {
              error = new Error('Timeout');
              error.code = 'ETIMEDOUT';
            } else {
              error = new Error('Connection refused');
              error.code = 'ECONNREFUSED';
            }
            
            mockAxiosInstance.post.mockRejectedValue(error);

            // Mock sleep to avoid waiting
            jest.spyOn(worker, '_sleep').mockResolvedValue();

            worker.isRunning = true;

            // Process receipt (will fail and retry)
            const result = await worker.processNext();
            expect(result).toBe(false);

            // Verify backoff delay was calculated
            expect(worker._sleep).toHaveBeenCalledWith(5000); // First attempt

            // Verify uploadAttempts incremented
            const item = queueManager.dequeue();
            expect(item).not.toBeNull();
            expect(item.uploadAttempts).toBe(1);
            expect(item.lastUploadError).toBeTruthy();

            // Verify file still in pending
            const pendingPath = path.join(tempDir, 'pending', `${id}.json`);
            expect(fs.existsSync(pendingPath)).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should use correct backoff delays for each attempt', async () => {
      // Feature: management-ui-and-missing-features, Property 11: Upload Retry with Exponential Backoff
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1, maxLength: 50 }),
            driverId: fc.string({ minLength: 1, maxLength: 50 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            confidence: fc.double({ min: 0, max: 1 }),
            receipt: fc.record({
              items: fc.array(fc.record({
                name: fc.string({ minLength: 1, maxLength: 50 }),
                qty: fc.integer({ min: 1, max: 10 }),
                price: fc.double({ min: 0.01, max: 1000 })
              }), { maxLength: 5 }),
              total: fc.double({ min: 0, max: 10000 })
            })
          }),
          async (receiptData) => {
            const id = queueManager.enqueue(receiptData);
            
            // Mock 5xx error
            const error = new Error('Server error');
            error.response = { status: 503, statusText: 'Service Unavailable' };
            mockAxiosInstance.post.mockRejectedValue(error);

            jest.spyOn(worker, '_sleep').mockResolvedValue();
            worker.isRunning = true;

            const expectedDelays = [5000, 10000, 20000, 40000];

            // Process 4 times (max attempts)
            for (let attempt = 0; attempt < 4; attempt++) {
              const result = await worker.processNext();
              expect(result).toBe(false);
              
              // Verify correct backoff delay
              expect(worker._sleep).toHaveBeenCalledWith(expectedDelays[attempt]);
              
              worker._sleep.mockClear();
            }

            // Verify max attempts reached
            const item = queueManager.dequeue();
            expect(item.uploadAttempts).toBe(4);

            // Next process should skip (max attempts reached)
            const skipResult = await worker.processNext();
            expect(skipResult).toBe(false);
            expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4); // No 5th attempt
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not retry on 4xx errors', async () => {
      // Feature: management-ui-and-missing-features, Property 11: Upload Retry with Exponential Backoff
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            receipt: fc.record({
              barId: fc.string({ minLength: 1, maxLength: 50 }),
              driverId: fc.string({ minLength: 1, maxLength: 50 }),
              timestamp: fc.date().map(d => d.toISOString()),
              parsed: fc.boolean(),
              confidence: fc.double({ min: 0, max: 1 }),
              receipt: fc.record({
                items: fc.array(fc.record({
                  name: fc.string({ minLength: 1, maxLength: 50 }),
                  qty: fc.integer({ min: 1, max: 10 }),
                  price: fc.double({ min: 0.01, max: 1000 })
                }), { maxLength: 5 }),
                total: fc.double({ min: 0, max: 10000 })
              })
            }),
            statusCode: fc.integer({ min: 400, max: 499 })
          }),
          async ({ receipt, statusCode }) => {
            const id = queueManager.enqueue(receipt);
            
            // Mock 4xx error
            const error = new Error('Client error');
            error.response = { status: statusCode, statusText: 'Client Error' };
            mockAxiosInstance.post.mockRejectedValue(error);

            jest.spyOn(worker, '_sleep').mockResolvedValue();
            worker.isRunning = true;

            const result = await worker.processNext();
            expect(result).toBe(false);

            // Verify no backoff delay (no retry)
            expect(worker._sleep).not.toHaveBeenCalled();

            // Verify marked as failed
            const item = queueManager.dequeue();
            expect(item.uploadAttempts).toBe(1);
            expect(item.lastUploadError).toContain('Permanent failure');
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 12: Queue Restart Resilience
   * 
   * For any set of pending receipts in the queue folder, when the Capture Service 
   * restarts, the Upload Worker should resume processing all pending files in 
   * chronological order (by enqueuedAt).
   */
  describe('Property 12: Queue Restart Resilience', () => {
    it('should resume processing pending receipts after restart', async () => {
      // Feature: management-ui-and-missing-features, Property 12: Queue Restart Resilience
      
      await fc.assert(
        fc.asyncProperty(
          // Generate array of receipts with different timestamps
          fc.array(
            fc.record({
              barId: fc.string({ minLength: 1, maxLength: 50 }),
              driverId: fc.string({ minLength: 1, maxLength: 50 }),
              timestamp: fc.date().map(d => d.toISOString()),
              parsed: fc.boolean(),
              confidence: fc.double({ min: 0, max: 1 }),
              receipt: fc.record({
                items: fc.array(fc.record({
                  name: fc.string({ minLength: 1, maxLength: 50 }),
                  qty: fc.integer({ min: 1, max: 10 }),
                  price: fc.double({ min: 0.01, max: 1000 })
                }), { maxLength: 5 }),
                total: fc.double({ min: 0, max: 10000 })
              })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (receipts) => {
            // Enqueue all receipts
            const ids = receipts.map(r => queueManager.enqueue(r));
            
            // Simulate restart by creating new worker instance
            const newWorker = new UploadWorker(queueManager, {
              apiUrl: 'https://test.tabeza.co.ke',
              barId: 'test-bar-123'
            });

            // Mock successful uploads
            mockAxiosInstance.post.mockResolvedValue({ 
              data: { success: true },
              status: 200 
            });

            newWorker.isRunning = true;

            // Scan pending queue (simulates restart)
            const pending = queueManager.scanPending();
            expect(pending.length).toBe(receipts.length);

            // Verify chronological order (oldest first)
            for (let i = 1; i < pending.length; i++) {
              const prev = new Date(pending[i - 1].enqueuedAt);
              const curr = new Date(pending[i].enqueuedAt);
              expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
            }

            // Process all pending receipts
            for (let i = 0; i < receipts.length; i++) {
              const result = await newWorker.processNext();
              expect(result).toBe(true);
            }

            // Verify all moved to uploaded
            const stats = queueManager.getStats();
            expect(stats.pending).toBe(0);
            expect(stats.uploaded).toBe(receipts.length);

            newWorker.stop();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve upload attempts across restarts', async () => {
      // Feature: management-ui-and-missing-features, Property 12: Queue Restart Resilience
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1, maxLength: 50 }),
            driverId: fc.string({ minLength: 1, maxLength: 50 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            confidence: fc.double({ min: 0, max: 1 }),
            receipt: fc.record({
              items: fc.array(fc.record({
                name: fc.string({ minLength: 1, maxLength: 50 }),
                qty: fc.integer({ min: 1, max: 10 }),
                price: fc.double({ min: 0.01, max: 1000 })
              }), { maxLength: 5 }),
              total: fc.double({ min: 0, max: 10000 })
            })
          }),
          async (receiptData) => {
            const id = queueManager.enqueue(receiptData);
            
            // Mock failure
            const error = new Error('Server error');
            error.response = { status: 500, statusText: 'Internal Server Error' };
            mockAxiosInstance.post.mockRejectedValue(error);

            jest.spyOn(worker, '_sleep').mockResolvedValue();
            worker.isRunning = true;

            // Fail twice
            await worker.processNext();
            await worker.processNext();

            // Verify 2 attempts
            let item = queueManager.dequeue();
            expect(item.uploadAttempts).toBe(2);

            // Simulate restart with new worker
            const newWorker = new UploadWorker(queueManager, {
              apiUrl: 'https://test.tabeza.co.ke',
              barId: 'test-bar-123'
            });

            jest.spyOn(newWorker, '_sleep').mockResolvedValue();
            newWorker.isRunning = true;

            // Fail again
            await newWorker.processNext();

            // Verify 3 attempts (preserved across restart)
            item = queueManager.dequeue();
            expect(item.uploadAttempts).toBe(3);

            newWorker.stop();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
