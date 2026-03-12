/**
 * Upload Worker Integration Tests
 * 
 * End-to-end integration tests for the upload worker that verify
 * the complete flow from queue to cloud API.
 * 
 * Tests cover:
 * - Complete upload flow (enqueue → upload → mark uploaded)
 * - Offline/online transitions
 * - Queue persistence across restarts
 * - Concurrent receipt processing
 * - Error recovery scenarios
 */

const UploadWorker = require('../uploadWorker');
const LocalQueue = require('../localQueue');
const fs = require('fs').promises;
const path = require('path');

// Mock fetch globally
global.fetch = jest.fn();

describe('Upload Worker Integration Tests', () => {
  let uploadWorker;
  let localQueue;
  let testQueuePath;
  
  const mockConfig = {
    apiEndpoint: 'https://api.tabeza.test',
    barId: 'test-bar-integration',
    deviceId: 'test-device-integration',
    pollInterval: 100, // Fast polling for tests
  };
  
  beforeEach(async () => {
    // Create test queue directory
    testQueuePath = path.join(__dirname, '../../test-queue-integration');
    
    // Clean up if exists
    try {
      await fs.rm(testQueuePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
    
    // Create local queue
    localQueue = new LocalQueue({ queuePath: testQueuePath });
    await localQueue.initialize();
    
    // Reset fetch mock
    global.fetch.mockReset();
  });
  
  afterEach(async () => {
    // Stop worker if running
    if (uploadWorker && uploadWorker.isRunning) {
      await uploadWorker.stop();
    }
    
    // Clean up test queue
    try {
      await fs.rm(testQueuePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });
  
  describe('End-to-End Upload Flow', () => {
    test('should complete full flow: enqueue → upload → mark uploaded', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Mock successful API response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      // Enqueue a receipt
      const receiptId = await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        parsed: true,
        confidence: 0.95,
        receipt: {
          items: [{ name: 'Test Item', qty: 1, price: 100.00 }],
          total: 100.00,
          receiptNumber: 'RCP-001',
          rawText: 'Test receipt',
        },
        metadata: {
          templateVersion: '1.0',
        },
      });
      
      // Verify receipt is in pending queue
      let queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(1);
      
      // Start worker
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify receipt was uploaded
      queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(1);
      
      // Verify API was called with correct payload
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/api/receipts/ingest`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      
      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload.barId).toBe(mockConfig.barId);
      expect(payload.driverId).toBe(mockConfig.deviceId);
      expect(payload.parsed).toBe(true);
      expect(payload.confidence).toBe(0.95);
      expect(payload.metadata.source).toBe('redmon-capture');
    });
    
    test('should process multiple receipts in sequence', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Mock successful API responses
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      // Enqueue multiple receipts
      const receiptIds = [];
      for (let i = 1; i <= 5; i++) {
        const id = await localQueue.enqueue({
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          text: `Receipt ${i}`,
          metadata: { order: i },
        });
        receiptIds.push(id);
      }
      
      // Verify all receipts are in queue
      let queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(5);
      
      // Start worker
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Verify all receipts were uploaded
      queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(5);
      
      // Verify API was called 5 times
      expect(global.fetch).toHaveBeenCalledTimes(5);
      
      // Verify statistics
      const stats = await uploadWorker.getStats();
      expect(stats.uploadsAttempted).toBe(5);
      expect(stats.uploadsSucceeded).toBe(5);
      expect(stats.uploadsFailed).toBe(0);
    });
  });
  
  describe('Offline/Online Transitions', () => {
    test('should queue receipts when offline and upload when online', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Simulate offline - all requests fail
      global.fetch.mockRejectedValue(new Error('Network error: offline'));
      
      // Enqueue receipts while "offline"
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Offline receipt 1',
        metadata: {},
      });
      
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Offline receipt 2',
        metadata: {},
      });
      
      // Start worker (will fail to upload)
      await uploadWorker.start();
      
      // Wait for failed attempts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Receipts should still be in queue (failed after retries)
      let queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(2);
      
      // Simulate coming back online
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      // Force process queue
      await uploadWorker.forceProcess();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Receipts should now be uploaded
      queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(2);
    });
    
    test('should handle intermittent connectivity', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Enqueue receipts
      for (let i = 1; i <= 3; i++) {
        await localQueue.enqueue({
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          text: `Receipt ${i}`,
          metadata: {},
        });
      }
      
      // Simulate intermittent connectivity: fail, succeed, fail, succeed, succeed
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-1' }),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-3' }),
        });
      
      await uploadWorker.start();
      
      // Wait for processing with retries
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Eventually all receipts should be uploaded
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(3);
    });
  });
  
  describe('Queue Persistence and Recovery', () => {
    test('should resume processing after service restart', async () => {
      // First worker instance
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Enqueue receipts
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Receipt before restart',
        metadata: {},
      });
      
      // Verify receipt is in queue
      let queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(1);
      
      // Stop worker (simulating service stop)
      await uploadWorker.stop();
      
      // Verify receipt persisted
      queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(1);
      
      // Create new worker instance (simulating service restart)
      const newWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Mock successful upload
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      // Start new worker
      await newWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Receipt should be uploaded
      queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(1);
      
      await newWorker.stop();
    });
    
    test('should maintain queue integrity across crashes', async () => {
      // Enqueue receipts directly (simulating receipts added before crash)
      const receiptIds = [];
      for (let i = 1; i <= 10; i++) {
        const id = await localQueue.enqueue({
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          text: `Receipt ${i}`,
          metadata: { order: i },
        });
        receiptIds.push(id);
      }
      
      // Verify all receipts are in queue
      let queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(10);
      
      // Create worker and start (simulating recovery after crash)
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // All receipts should be uploaded
      queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(10);
    });
  });
  
  describe('Error Recovery', () => {
    test('should recover from temporary API errors', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      // Simulate temporary API error (500) then success
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-123' }),
        });
      
      await uploadWorker.start();
      
      // Wait for retry and success
      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for 5s retry delay
      
      // Receipt should eventually be uploaded
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(1);
    });
    
    test('should handle partial batch failures', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      // Enqueue multiple receipts
      for (let i = 1; i <= 5; i++) {
        await localQueue.enqueue({
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          text: `Receipt ${i}`,
          metadata: { order: i },
        });
      }
      
      // Simulate: success, fail (max retries), success, success, success
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-1' }),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-3' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-4' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-5' }),
        });
      
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 4 receipts should be uploaded, 1 should remain in queue (failed after max retries)
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(1);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(4);
      
      // Verify statistics
      const stats = await uploadWorker.getStats();
      expect(stats.uploadsSucceeded).toBe(4);
      expect(stats.uploadsFailed).toBeGreaterThan(0);
    });
  });
  
  describe('Performance and Throughput', () => {
    test('should process 10 receipts per second when online', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
        pollInterval: 50, // Very fast polling
      });
      
      // Enqueue 20 receipts
      for (let i = 1; i <= 20; i++) {
        await localQueue.enqueue({
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
          timestamp: new Date(Date.now() + i * 100).toISOString(),
          text: `Receipt ${i}`,
          metadata: {},
        });
      }
      
      // Mock fast API responses (50ms each)
      global.fetch.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-123' }),
        };
      });
      
      const startTime = Date.now();
      
      await uploadWorker.start();
      
      // Wait for all receipts to be processed
      while (await localQueue.getQueueSize() > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const duration = Date.now() - startTime;
      
      // Should process 20 receipts in less than 2 seconds (10/sec = 2s for 20)
      expect(duration).toBeLessThan(2500); // Allow some margin
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(20);
    });
    
    test('should handle queue of 100 receipts', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
        pollInterval: 50,
      });
      
      // Enqueue 100 receipts
      for (let i = 1; i <= 100; i++) {
        await localQueue.enqueue({
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
          timestamp: new Date(Date.now() + i * 100).toISOString(),
          text: `Receipt ${i}`,
          metadata: {},
        });
      }
      
      // Mock fast API responses
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      await uploadWorker.start();
      
      // Wait for all receipts to be processed (with timeout)
      const timeout = 15000; // 15 seconds max
      const startTime = Date.now();
      
      while (await localQueue.getQueueSize() > 0) {
        if (Date.now() - startTime > timeout) {
          throw new Error('Timeout waiting for queue to process');
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(100);
      
      // Verify statistics
      const stats = await uploadWorker.getStats();
      expect(stats.uploadsSucceeded).toBe(100);
      expect(stats.uploadsFailed).toBe(0);
    });
  });
});
