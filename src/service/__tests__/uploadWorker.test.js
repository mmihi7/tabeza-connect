/**
 * Upload Worker Tests
 * 
 * Tests for the async upload worker that processes the local queue
 * and uploads receipts to the cloud API.
 */

const UploadWorker = require('../uploadWorker');
const LocalQueue = require('../localQueue');
const fs = require('fs').promises;
const path = require('path');

// Mock fetch globally
global.fetch = jest.fn();

describe('UploadWorker', () => {
  let uploadWorker;
  let localQueue;
  let testQueuePath;
  
  const mockConfig = {
    apiEndpoint: 'https://api.tabeza.test',
    barId: 'test-bar-123',
    deviceId: 'test-device-456',
    pollInterval: 100, // Fast polling for tests
  };
  
  beforeEach(async () => {
    // Create test queue directory
    testQueuePath = path.join(__dirname, '../../test-queue-upload');
    
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
  
  describe('Constructor', () => {
    test('should create worker with valid config', () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      expect(uploadWorker.localQueue).toBe(localQueue);
      expect(uploadWorker.apiEndpoint).toBe(mockConfig.apiEndpoint);
      expect(uploadWorker.barId).toBe(mockConfig.barId);
      expect(uploadWorker.deviceId).toBe(mockConfig.deviceId);
      expect(uploadWorker.isRunning).toBe(false);
    });
    
    test('should throw error if localQueue is missing', () => {
      expect(() => {
        new UploadWorker({
          apiEndpoint: mockConfig.apiEndpoint,
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
        });
      }).toThrow('localQueue is required');
    });
    
    test('should throw error if apiEndpoint is missing', () => {
      expect(() => {
        new UploadWorker({
          localQueue,
          barId: mockConfig.barId,
          deviceId: mockConfig.deviceId,
        });
      }).toThrow('apiEndpoint is required');
    });
    
    test('should throw error if barId is missing', () => {
      expect(() => {
        new UploadWorker({
          localQueue,
          apiEndpoint: mockConfig.apiEndpoint,
          deviceId: mockConfig.deviceId,
        });
      }).toThrow('barId is required');
    });
    
    test('should throw error if deviceId is missing', () => {
      expect(() => {
        new UploadWorker({
          localQueue,
          apiEndpoint: mockConfig.apiEndpoint,
          barId: mockConfig.barId,
        });
      }).toThrow('deviceId is required');
    });
  });
  
  describe('Start and Stop', () => {
    test('should start worker successfully', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      const startedSpy = jest.fn();
      uploadWorker.on('started', startedSpy);
      
      await uploadWorker.start();
      
      expect(uploadWorker.isRunning).toBe(true);
      expect(uploadWorker.workerInterval).not.toBeNull();
      expect(startedSpy).toHaveBeenCalled();
    });
    
    test('should not start if already running', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      await uploadWorker.start();
      
      const consoleSpy = jest.spyOn(console, 'log');
      await uploadWorker.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Upload worker already running');
      
      consoleSpy.mockRestore();
    });
    
    test('should stop worker successfully', async () => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      await uploadWorker.start();
      
      const stoppedSpy = jest.fn();
      uploadWorker.on('stopped', stoppedSpy);
      
      await uploadWorker.stop();
      
      expect(uploadWorker.isRunning).toBe(false);
      expect(uploadWorker.workerInterval).toBeNull();
      expect(stoppedSpy).toHaveBeenCalled();
    });
    
    test('should resume processing queued receipts on startup', async () => {
      // Enqueue a receipt
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: { test: true },
      });
      
      // Mock successful upload
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, receiptId: 'test-123' }),
      });
      
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
      
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Queue should be empty
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      // Receipt should be uploaded
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(1);
    });
  });
  
  describe('Upload Receipt', () => {
    beforeEach(() => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
    });
    
    test('should upload receipt successfully', async () => {
      const receipt = {
        id: 'test-receipt-123',
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        escposBytes: 'base64data',
        metadata: { test: true },
        enqueuedAt: new Date().toISOString(),
        uploadAttempts: 0,
      };
      
      // Mock successful API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      await uploadWorker.uploadReceipt(receipt);
      
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockConfig.apiEndpoint}/api/receipts/ingest`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );
      
      // Check payload
      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload.barId).toBe(mockConfig.barId);
      expect(payload.deviceId).toBe(mockConfig.deviceId);
      expect(payload.text).toBe('Test receipt');
      expect(payload.metadata.source).toBe('spool-monitor');
    });
    
    test('should throw error on HTTP error response', async () => {
      const receipt = {
        id: 'test-receipt-123',
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
        enqueuedAt: new Date().toISOString(),
      };
      
      // Mock error response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      
      await expect(uploadWorker.uploadReceipt(receipt)).rejects.toThrow('HTTP 500');
    });
    
    test('should throw error on network failure', async () => {
      const receipt = {
        id: 'test-receipt-123',
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
        enqueuedAt: new Date().toISOString(),
      };
      
      // Mock network error
      const networkError = new Error('Network error');
      networkError.code = 'ENOTFOUND';
      global.fetch.mockRejectedValueOnce(networkError);
      
      await expect(uploadWorker.uploadReceipt(receipt)).rejects.toThrow('Network error');
    });
    
    test('should timeout after configured duration', async () => {
      const receipt = {
        id: 'test-receipt-123',
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
        enqueuedAt: new Date().toISOString(),
      };
      
      // Create worker with short timeout
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
        uploadTimeout: 100, // 100ms timeout
      });
      
      // Mock slow response
      global.fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      
      await expect(uploadWorker.uploadReceipt(receipt)).rejects.toThrow('Upload timeout');
    });
  });
  
  describe('Exponential Backoff Retry', () => {
    beforeEach(() => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
    });
    
    test('should retry with exponential backoff on failure', async () => {
      // Enqueue receipt
      const receiptId = await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      const receipt = await localQueue.dequeue();
      
      // Mock failures then success
      global.fetch
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-123' }),
        });
      
      const retrySpy = jest.fn();
      uploadWorker.on('upload-retry', retrySpy);
      
      const startTime = Date.now();
      await uploadWorker.uploadReceiptWithRetry(receipt);
      const duration = Date.now() - startTime;
      
      // Should have retried twice (5s + 10s = 15s total delay)
      expect(retrySpy).toHaveBeenCalledTimes(2);
      expect(duration).toBeGreaterThanOrEqual(15000);
      
      // Receipt should be marked as uploaded
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
    });
    
    test('should give up after max retries', async () => {
      // Enqueue receipt
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      const receipt = await localQueue.dequeue();
      
      // Mock all failures
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const failedSpy = jest.fn();
      uploadWorker.on('upload-failed', failedSpy);
      
      await uploadWorker.uploadReceiptWithRetry(receipt);
      
      // Should have failed after 4 retries
      expect(failedSpy).toHaveBeenCalledTimes(1);
      expect(uploadWorker.stats.uploadsFailed).toBe(4); // Initial + 3 retries
      
      // Receipt should still be in queue (not removed)
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(1);
    });
    
    test('should emit upload-success event on success', async () => {
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      const receipt = await localQueue.dequeue();
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      const successSpy = jest.fn();
      uploadWorker.on('upload-success', successSpy);
      
      await uploadWorker.uploadReceiptWithRetry(receipt);
      
      expect(successSpy).toHaveBeenCalledWith(receipt.id);
    });
  });
  
  describe('Queue Processing', () => {
    beforeEach(() => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
    });
    
    test('should process multiple receipts in queue', async () => {
      // Enqueue multiple receipts
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Receipt 1',
        metadata: {},
      });
      
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Receipt 2',
        metadata: {},
      });
      
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Receipt 3',
        metadata: {},
      });
      
      // Mock successful uploads
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // All receipts should be uploaded
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
      
      const uploadedCount = await localQueue.getUploadedCount();
      expect(uploadedCount).toBe(3);
      
      expect(uploadWorker.stats.uploadsSucceeded).toBe(3);
    });
    
    test('should handle empty queue gracefully', async () => {
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should not crash
      expect(uploadWorker.isRunning).toBe(true);
      expect(uploadWorker.stats.uploadsAttempted).toBe(0);
    });
    
    test('should continue processing after partial failure', async () => {
      // Enqueue receipts
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Receipt 1',
        metadata: {},
      });
      
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Receipt 2',
        metadata: {},
      });
      
      // Mock first upload fails, second succeeds
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, receiptId: 'cloud-123' }),
        });
      
      await uploadWorker.start();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Second receipt should be uploaded
      expect(uploadWorker.stats.uploadsSucceeded).toBe(1);
    });
  });
  
  describe('Statistics', () => {
    beforeEach(() => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
    });
    
    test('should track upload statistics', async () => {
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      await uploadWorker.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const stats = await uploadWorker.getStats();
      
      expect(stats.uploadsAttempted).toBe(1);
      expect(stats.uploadsSucceeded).toBe(1);
      expect(stats.uploadsFailed).toBe(0);
      expect(stats.isRunning).toBe(true);
      expect(stats.queueSize).toBe(0);
      expect(stats.lastUploadSuccess).toBeTruthy();
    });
    
    test('should track failure statistics', async () => {
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      await uploadWorker.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const stats = await uploadWorker.getStats();
      
      expect(stats.uploadsFailed).toBeGreaterThan(0);
      expect(stats.lastUploadFailure).toBeTruthy();
      expect(stats.lastError).toBeTruthy();
    });
  });
  
  describe('Force Process', () => {
    beforeEach(() => {
      uploadWorker = new UploadWorker({
        localQueue,
        ...mockConfig,
      });
    });
    
    test('should force process queue immediately', async () => {
      await localQueue.enqueue({
        barId: mockConfig.barId,
        deviceId: mockConfig.deviceId,
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
        metadata: {},
      });
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, receiptId: 'cloud-123' }),
      });
      
      await uploadWorker.start();
      await uploadWorker.forceProcess();
      
      const queueSize = await localQueue.getQueueSize();
      expect(queueSize).toBe(0);
    });
  });
});
