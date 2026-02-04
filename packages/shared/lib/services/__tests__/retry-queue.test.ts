/**
 * Retry Queue Service Tests
 * 
 * Tests for retry queue functionality with network-aware operation handling.
 */

import { RetryQueueManager, getRetryQueueManager, enqueueOperation, registerRetryHandler } from '../retry-queue';
import { NetworkStatusManager } from '../network-status';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock network status manager
jest.mock('../network-status');
const MockNetworkStatusManager = NetworkStatusManager as jest.MockedClass<typeof NetworkStatusManager>;

describe('RetryQueueManager', () => {
  let manager: RetryQueueManager;
  let mockNetworkManager: jest.Mocked<NetworkStatusManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock network manager
    mockNetworkManager = {
      isOnline: jest.fn().mockReturnValue(true),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g'
      })
    } as any;

    MockNetworkStatusManager.mockImplementation(() => mockNetworkManager);

    manager = new RetryQueueManager({
      maxRetries: 3,
      baseDelayMs: 100,
      enablePersistence: true
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize with empty queue', () => {
      expect(manager.getQueueSize()).toBe(0);
      expect(manager.isEmpty()).toBe(true);
    });

    it('should load persisted queue on initialization', () => {
      const queueData = [
        ['test-id', {
          id: 'test-id',
          type: 'test_operation',
          data: { test: 'data' },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: Date.now(),
          priority: 'normal'
        }]
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(queueData));

      const persistentManager = new RetryQueueManager({ enablePersistence: true });
      
      expect(persistentManager.getQueueSize()).toBe(1);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tabeza_retry_queue');
      
      persistentManager.destroy();
    });

    it('should handle corrupted persisted data', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const persistentManager = new RetryQueueManager({ enablePersistence: true });
      
      expect(persistentManager.getQueueSize()).toBe(0);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tabeza_retry_queue');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to load retry queue:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
      persistentManager.destroy();
    });
  });

  describe('operation management', () => {
    it('should enqueue operations', () => {
      const operationId = manager.enqueue('test_operation', { test: 'data' });
      
      expect(operationId).toBeDefined();
      expect(manager.getQueueSize()).toBe(1);
      expect(manager.isEmpty()).toBe(false);
    });

    it('should enqueue operations with custom options', () => {
      const operationId = manager.enqueue('test_operation', { test: 'data' }, {
        id: 'custom-id',
        priority: 'high',
        maxRetries: 5
      });
      
      expect(operationId).toBe('custom-id');
      
      const operation = manager.getOperation('custom-id');
      expect(operation).toBeDefined();
      expect(operation!.priority).toBe('high');
      expect(operation!.maxRetries).toBe(5);
    });

    it('should dequeue operations', () => {
      const operationId = manager.enqueue('test_operation', { test: 'data' });
      
      expect(manager.dequeue(operationId)).toBe(true);
      expect(manager.getQueueSize()).toBe(0);
      expect(manager.dequeue('non-existent')).toBe(false);
    });

    it('should get operations by type', () => {
      manager.enqueue('type_a', { data: 1 });
      manager.enqueue('type_b', { data: 2 });
      manager.enqueue('type_a', { data: 3 });

      const typeAOperations = manager.getOperationsByType('type_a');
      expect(typeAOperations).toHaveLength(2);
      expect(typeAOperations.every(op => op.type === 'type_a')).toBe(true);
    });

    it('should clear all operations', () => {
      manager.enqueue('test_operation', { test: 'data' });
      manager.enqueue('another_operation', { test: 'data' });
      
      manager.clear();
      expect(manager.getQueueSize()).toBe(0);
    });

    it('should clear operations by type', () => {
      manager.enqueue('type_a', { data: 1 });
      manager.enqueue('type_b', { data: 2 });
      manager.enqueue('type_a', { data: 3 });

      manager.clearByType('type_a');
      
      expect(manager.getQueueSize()).toBe(1);
      expect(manager.getOperationsByType('type_a')).toHaveLength(0);
      expect(manager.getOperationsByType('type_b')).toHaveLength(1);
    });
  });

  describe('handler registration', () => {
    it('should register operation handlers', () => {
      const handler = jest.fn().mockResolvedValue('success');
      
      manager.registerHandler('test_operation', handler);
      
      // Handler should be registered (internal state)
      expect(manager['handlers'].has('test_operation')).toBe(true);
    });
  });

  describe('queue processing', () => {
    it('should process operations when online', async () => {
      const handler = jest.fn().mockResolvedValue('success');
      const onSuccess = jest.fn();
      
      const processingManager = new RetryQueueManager({
        onOperationSuccess: onSuccess
      });
      
      processingManager.registerHandler('test_operation', handler);
      processingManager.enqueue('test_operation', { test: 'data' });
      
      await processingManager.processNow();
      
      expect(handler).toHaveBeenCalledWith({ test: 'data' });
      expect(onSuccess).toHaveBeenCalled();
      expect(processingManager.getQueueSize()).toBe(0);
      
      processingManager.destroy();
    });

    it('should not process operations when offline', async () => {
      mockNetworkManager.isOnline.mockReturnValue(false);
      
      await expect(manager.processNow()).rejects.toThrow('Cannot process queue while offline');
    });

    it('should retry failed operations', async () => {
      const handler = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');
      
      const onRetried = jest.fn();
      
      const retryManager = new RetryQueueManager({
        baseDelayMs: 10, // Very short delay for testing
        onOperationRetried: onRetried
      });
      
      retryManager.registerHandler('test_operation', handler);
      const operationId = retryManager.enqueue('test_operation', { test: 'data' });
      
      // Process first attempt (should fail)
      await retryManager.processNow();
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(retryManager.getQueueSize()).toBe(1); // Still in queue for retry
      
      const operation = retryManager.getOperation(operationId);
      expect(operation!.retryCount).toBe(1);
      expect(operation!.lastError).toBe('First failure');
      
      retryManager.destroy();
    });

    it('should remove operations after max retries', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const onFailed = jest.fn();
      
      const failManager = new RetryQueueManager({
        maxRetries: 2,
        baseDelayMs: 10,
        onOperationFailed: onFailed
      });
      
      failManager.registerHandler('test_operation', handler);
      failManager.enqueue('test_operation', { test: 'data' });
      
      // Process multiple times to exceed max retries
      for (let i = 0; i < 3; i++) {
        await failManager.processNow();
        // Small delay to allow retry scheduling
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      expect(handler).toHaveBeenCalledTimes(2); // maxRetries
      expect(onFailed).toHaveBeenCalled();
      expect(failManager.getQueueSize()).toBe(0); // Removed after max retries
      
      failManager.destroy();
    });

    it('should handle missing handlers gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      manager.enqueue('unknown_operation', { test: 'data' });
      await manager.processNow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'No handler registered for operation type: unknown_operation'
      );
      expect(manager.getQueueSize()).toBe(0); // Operation removed
      
      consoleErrorSpy.mockRestore();
    });

    it('should process operations by priority', async () => {
      const handler = jest.fn().mockResolvedValue('success');
      const processOrder: string[] = [];
      
      const priorityHandler = jest.fn().mockImplementation(async (data) => {
        processOrder.push(data.id);
        return 'success';
      });
      
      const priorityManager = new RetryQueueManager();
      priorityManager.registerHandler('test_operation', priorityHandler);
      
      // Enqueue operations with different priorities
      priorityManager.enqueue('test_operation', { id: 'low' }, { priority: 'low' });
      priorityManager.enqueue('test_operation', { id: 'high' }, { priority: 'high' });
      priorityManager.enqueue('test_operation', { id: 'normal' }, { priority: 'normal' });
      
      await priorityManager.processNow();
      
      // High priority should be processed first
      expect(processOrder[0]).toBe('high');
      
      priorityManager.destroy();
    });
  });

  describe('network status integration', () => {
    it('should start processing when network comes online', () => {
      const networkListener = mockNetworkManager.addListener.mock.calls[0][0];
      
      // Simulate network coming online
      networkListener({ isOnline: true });
      
      expect(manager['isProcessing']).toBe(true);
    });

    it('should stop processing when network goes offline', () => {
      manager.startProcessing();
      const networkListener = mockNetworkManager.addListener.mock.calls[0][0];
      
      // Simulate network going offline
      networkListener({ isOnline: false });
      
      expect(manager['isProcessing']).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should persist queue to localStorage', () => {
      const persistentManager = new RetryQueueManager({ enablePersistence: true });
      
      persistentManager.enqueue('test_operation', { test: 'data' });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tabeza_retry_queue',
        expect.stringContaining('test_operation')
      );
      
      persistentManager.destroy();
    });

    it('should not persist when disabled', () => {
      const nonPersistentManager = new RetryQueueManager({ enablePersistence: false });
      
      nonPersistentManager.enqueue('test_operation', { test: 'data' });
      
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      
      nonPersistentManager.destroy();
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const persistentManager = new RetryQueueManager({ enablePersistence: true });
      persistentManager.enqueue('test_operation', { test: 'data' });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to persist retry queue:', expect.any(Error));
      
      consoleWarnSpy.mockRestore();
      persistentManager.destroy();
    });
  });

  describe('cleanup', () => {
    it('should clean up old operations on load', () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      
      const queueData = [
        ['old-id', {
          id: 'old-id',
          type: 'test_operation',
          data: { test: 'old' },
          timestamp: oldTimestamp,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: oldTimestamp,
          priority: 'normal'
        }],
        ['recent-id', {
          id: 'recent-id',
          type: 'test_operation',
          data: { test: 'recent' },
          timestamp: recentTimestamp,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: recentTimestamp,
          priority: 'normal'
        }]
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(queueData));

      const cleanupManager = new RetryQueueManager({ enablePersistence: true });
      
      expect(cleanupManager.getQueueSize()).toBe(1); // Only recent operation
      expect(cleanupManager.getOperation('recent-id')).toBeDefined();
      expect(cleanupManager.getOperation('old-id')).toBeUndefined();
      
      cleanupManager.destroy();
    });
  });
});

describe('Global retry queue functions', () => {
  beforeEach(() => {
    // Reset global manager
    if ((global as any).globalRetryQueue) {
      (global as any).globalRetryQueue = null;
    }
  });

  it('should create global retry queue manager', () => {
    const manager = getRetryQueueManager();
    expect(manager).toBeInstanceOf(RetryQueueManager);
    
    // Should return same instance on subsequent calls
    const manager2 = getRetryQueueManager();
    expect(manager2).toBe(manager);
    
    manager.destroy();
  });

  it('should enqueue operation using global function', () => {
    const operationId = enqueueOperation('test_operation', { test: 'data' });
    
    expect(operationId).toBeDefined();
    expect(getRetryQueueManager().getQueueSize()).toBe(1);
    
    getRetryQueueManager().destroy();
  });

  it('should register handler using global function', () => {
    const handler = jest.fn();
    
    registerRetryHandler('test_operation', handler);
    
    expect(getRetryQueueManager()['handlers'].has('test_operation')).toBe(true);
    
    getRetryQueueManager().destroy();
  });
});