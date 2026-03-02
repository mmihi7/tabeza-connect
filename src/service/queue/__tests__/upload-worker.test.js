/**
 * Unit Tests for Upload Worker
 */

const UploadWorker = require('../upload-worker');
const QueueManager = require('../queue-manager');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('UploadWorker', () => {
  let worker;
  let mockQueueManager;
  let mockConfig;
  let mockAxiosInstance;

  beforeEach(() => {
    // Create mock queue manager
    mockQueueManager = {
      dequeue: jest.fn(),
      markUploaded: jest.fn(),
      markFailed: jest.fn()
    };

    // Create mock config
    mockConfig = {
      apiUrl: 'https://test.tabeza.co.ke',
      barId: 'test-bar-123'
    };

    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn()
    };

    axios.create.mockReturnValue(mockAxiosInstance);

    // Create worker instance
    worker = new UploadWorker(mockQueueManager, mockConfig);
  });

  afterEach(() => {
    if (worker.isRunning) {
      worker.stop();
    }
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(worker.queueManager).toBe(mockQueueManager);
      expect(worker.config).toBe(mockConfig);
      expect(worker.isRunning).toBe(false);
      expect(worker.maxAttempts).toBe(4);
      expect(worker.backoffDelays).toEqual([5000, 10000, 20000, 40000]);
    });

    it('should create axios instance with 30s timeout', () => {
      expect(axios.create).toHaveBeenCalledWith({
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });
  });

  describe('start()', () => {
    it('should start the polling loop', () => {
      jest.useFakeTimers();
      
      worker.start();
      
      expect(worker.isRunning).toBe(true);
      expect(worker.pollInterval).not.toBeNull();
      
      jest.useRealTimers();
    });

    it('should not start if already running', () => {
      jest.useFakeTimers();
      
      worker.start();
      const firstInterval = worker.pollInterval;
      
      worker.start();
      
      expect(worker.pollInterval).toBe(firstInterval);
      
      jest.useRealTimers();
    });
  });

  describe('stop()', () => {
    it('should stop the polling loop', () => {
      jest.useFakeTimers();
      
      worker.start();
      expect(worker.isRunning).toBe(true);
      
      worker.stop();
      
      expect(worker.isRunning).toBe(false);
      expect(worker.pollInterval).toBeNull();
      
      jest.useRealTimers();
    });

    it('should handle stop when not running', () => {
      expect(() => worker.stop()).not.toThrow();
    });
  });

  describe('processNext() - Successful Upload', () => {
    it('should upload receipt and mark as uploaded on success', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: {
          items: [{ name: 'Item 1', qty: 2, price: 100 }],
          total: 200,
          receiptNumber: 'RCP-001'
        },
        uploadAttempts: 0
      };

      mockQueueManager.dequeue.mockReturnValue(mockReceipt);
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      worker.isRunning = true;
      const result = await worker.processNext();

      expect(result).toBe(true);
      expect(mockQueueManager.dequeue).toHaveBeenCalled();
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test.tabeza.co.ke/api/receipts/ingest',
        expect.objectContaining({
          barId: 'bar-456',
          driverId: 'driver-PC01',
          parsed: true,
          confidence: 0.95
        })
      );
      expect(mockQueueManager.markUploaded).toHaveBeenCalledWith('receipt-123');
      expect(mockQueueManager.markFailed).not.toHaveBeenCalled();
    });

    it('should return false when queue is empty', async () => {
      mockQueueManager.dequeue.mockReturnValue(null);

      worker.isRunning = true;
      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      expect(mockQueueManager.markUploaded).not.toHaveBeenCalled();
    });

    it('should return false when worker is not running', async () => {
      worker.isRunning = false;
      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockQueueManager.dequeue).not.toHaveBeenCalled();
    });
  });

  describe('processNext() - Failed Upload with Retry', () => {
    it('should retry on 5xx error with backoff', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 },
        uploadAttempts: 0
      };

      mockQueueManager.dequeue.mockReturnValue(mockReceipt);
      
      const error = new Error('Server error');
      error.response = { status: 500, statusText: 'Internal Server Error' };
      mockAxiosInstance.post.mockRejectedValue(error);

      worker.isRunning = true;
      
      // Mock sleep to avoid waiting
      jest.spyOn(worker, '_sleep').mockResolvedValue();

      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockQueueManager.markFailed).toHaveBeenCalledWith(
        'receipt-123',
        'HTTP 500: Internal Server Error'
      );
      expect(worker._sleep).toHaveBeenCalledWith(5000); // First backoff delay
      expect(mockQueueManager.markUploaded).not.toHaveBeenCalled();
    });

    it('should retry on network timeout', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 },
        uploadAttempts: 1
      };

      mockQueueManager.dequeue.mockReturnValue(mockReceipt);
      
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      mockAxiosInstance.post.mockRejectedValue(error);

      worker.isRunning = true;
      jest.spyOn(worker, '_sleep').mockResolvedValue();

      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockQueueManager.markFailed).toHaveBeenCalledWith('receipt-123', 'Timeout');
      expect(worker._sleep).toHaveBeenCalledWith(10000); // Second backoff delay
    });

    it('should retry on connection refused', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 },
        uploadAttempts: 2
      };

      mockQueueManager.dequeue.mockReturnValue(mockReceipt);
      
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      mockAxiosInstance.post.mockRejectedValue(error);

      worker.isRunning = true;
      jest.spyOn(worker, '_sleep').mockResolvedValue();

      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockQueueManager.markFailed).toHaveBeenCalled();
      expect(worker._sleep).toHaveBeenCalledWith(20000); // Third backoff delay
    });
  });

  describe('processNext() - Failed Upload without Retry', () => {
    it('should not retry on 4xx error', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 },
        uploadAttempts: 0
      };

      mockQueueManager.dequeue.mockReturnValue(mockReceipt);
      
      const error = new Error('Bad request');
      error.response = { status: 400, statusText: 'Bad Request' };
      mockAxiosInstance.post.mockRejectedValue(error);

      worker.isRunning = true;
      jest.spyOn(worker, '_sleep').mockResolvedValue();

      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockQueueManager.markFailed).toHaveBeenCalledWith(
        'receipt-123',
        'Permanent failure: HTTP 400: Bad Request'
      );
      expect(worker._sleep).not.toHaveBeenCalled();
      expect(mockQueueManager.markUploaded).not.toHaveBeenCalled();
    });

    it('should skip receipt when max attempts reached', async () => {
      const mockReceipt = {
        id: 'receipt-123',
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 },
        uploadAttempts: 4 // Max attempts reached
      };

      mockQueueManager.dequeue.mockReturnValue(mockReceipt);

      worker.isRunning = true;
      const result = await worker.processNext();

      expect(result).toBe(false);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      expect(mockQueueManager.markFailed).not.toHaveBeenCalled();
      expect(mockQueueManager.markUploaded).not.toHaveBeenCalled();
    });
  });

  describe('uploadReceipt()', () => {
    it('should POST receipt to correct endpoint', async () => {
      const receipt = {
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: {
          items: [{ name: 'Item 1', qty: 2, price: 100 }],
          total: 200,
          receiptNumber: 'RCP-001',
          templateVersion: '1.2',
          parseTimeMs: 3
        }
      };

      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      const result = await worker.uploadReceipt(receipt);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://test.tabeza.co.ke/api/receipts/ingest',
        {
          barId: 'bar-456',
          driverId: 'driver-PC01',
          timestamp: '2024-01-01T10:00:00Z',
          parsed: true,
          confidence: 0.95,
          receipt: {
            items: [{ name: 'Item 1', qty: 2, price: 100 }],
            total: 200,
            receiptNumber: 'RCP-001',
            templateVersion: '1.2',
            parseTimeMs: 3
          },
          metadata: {
            source: 'pooling-capture',
            templateVersion: '1.2',
            parseTimeMs: 3
          }
        }
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw enhanced error with status code on HTTP error', async () => {
      const receipt = {
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 }
      };

      const axiosError = new Error('Request failed');
      axiosError.response = { status: 404, statusText: 'Not Found' };
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(worker.uploadReceipt(receipt)).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should throw original error on network error', async () => {
      const receipt = {
        barId: 'bar-456',
        driverId: 'driver-PC01',
        timestamp: '2024-01-01T10:00:00Z',
        parsed: true,
        confidence: 0.95,
        receipt: { items: [], total: 0 }
      };

      const networkError = new Error('Network error');
      networkError.code = 'ECONNREFUSED';
      mockAxiosInstance.post.mockRejectedValue(networkError);

      await expect(worker.uploadReceipt(receipt)).rejects.toThrow('Network error');
    });
  });

  describe('getBackoffDelay()', () => {
    it('should return correct delay for attempt 1', () => {
      expect(worker.getBackoffDelay(1)).toBe(5000);
    });

    it('should return correct delay for attempt 2', () => {
      expect(worker.getBackoffDelay(2)).toBe(10000);
    });

    it('should return correct delay for attempt 3', () => {
      expect(worker.getBackoffDelay(3)).toBe(20000);
    });

    it('should return correct delay for attempt 4', () => {
      expect(worker.getBackoffDelay(4)).toBe(40000);
    });

    it('should cap at max delay for attempts beyond 4', () => {
      expect(worker.getBackoffDelay(5)).toBe(40000);
      expect(worker.getBackoffDelay(10)).toBe(40000);
    });
  });

  describe('_shouldRetry()', () => {
    it('should return false for 4xx errors', () => {
      const error = new Error('Bad request');
      error.statusCode = 400;
      
      expect(worker._shouldRetry(error, 1)).toBe(false);
      expect(worker._shouldRetry(error, 2)).toBe(false);
    });

    it('should return true for 5xx errors', () => {
      const error = new Error('Server error');
      error.statusCode = 500;
      
      expect(worker._shouldRetry(error, 1)).toBe(true);
      expect(worker._shouldRetry(error, 2)).toBe(true);
    });

    it('should return false when max attempts reached', () => {
      const error = new Error('Server error');
      error.statusCode = 500;
      
      expect(worker._shouldRetry(error, 4)).toBe(false);
      expect(worker._shouldRetry(error, 5)).toBe(false);
    });

    it('should return true for network timeout', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      
      expect(worker._shouldRetry(error, 1)).toBe(true);
    });

    it('should return true for connection refused', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      
      expect(worker._shouldRetry(error, 1)).toBe(true);
    });

    it('should return true for connection reset', () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      
      expect(worker._shouldRetry(error, 1)).toBe(true);
    });

    it('should return true for host not found', () => {
      const error = new Error('Host not found');
      error.code = 'ENOTFOUND';
      
      expect(worker._shouldRetry(error, 1)).toBe(true);
    });

    it('should return true for axios timeout', () => {
      const error = new Error('Timeout');
      error.code = 'ECONNABORTED';
      
      expect(worker._shouldRetry(error, 1)).toBe(true);
    });

    it('should return false for unknown errors', () => {
      const error = new Error('Unknown error');
      
      expect(worker._shouldRetry(error, 1)).toBe(false);
    });
  });

  describe('_sleep()', () => {
    it('should sleep for specified milliseconds', async () => {
      jest.useFakeTimers();
      
      const sleepPromise = worker._sleep(1000);
      
      jest.advanceTimersByTime(1000);
      
      await sleepPromise;
      
      jest.useRealTimers();
    });
  });
});
