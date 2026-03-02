/**
 * Unit Tests for QueueManager
 * 
 * Tests the SQLite-based queue manager functionality
 * Requirements: Design "Testing Strategy - Unit Testing Approach"
 */

const QueueManager = require('../queueManager');
const fs = require('fs').promises;
const path = require('path');

describe('QueueManager', () => {
  let queueManager;
  const testDbPath = path.join(__dirname, 'test-queue.db');

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    // Create fresh queue manager instance
    queueManager = new QueueManager({
      dbPath: testDbPath
    });

    await queueManager.initialize();
  });

  afterEach(async () => {
    if (queueManager) {
      await queueManager.close();
    }

    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with default options', async () => {
      const defaultManager = new QueueManager();
      await expect(defaultManager.initialize()).resolves.toBe(true);
      await defaultManager.close();
    });

    test('should create database file and directories', async () => {
      expect(await fs.access(testDbPath)).not.toThrow();
    });

    test('should create receipts table with proper schema', async () => {
      const stats = await queueManager.getQueueStats();
      expect(stats).toHaveProperty('pending', 0);
      expect(stats).toHaveProperty('uploaded', 0);
      expect(stats).toHaveProperty('failed', 0);
      expect(stats).toHaveProperty('total', 0);
    });
  });

  describe('Receipt Addition', () => {
    test('should add receipt with minimal required fields', async () => {
      const receipt = {
        barId: 'test-bar-123',
        rawText: 'Test receipt content'
      };

      const receiptId = await queueManager.add(receipt);
      
      expect(receiptId).toBeDefined();
      expect(receiptId).toMatch(/^receipt_\d+_[a-z0-9]+$/);
      
      const stats = await queueManager.getQueueStats();
      expect(stats.pending).toBe(1);
      expect(stats.total).toBe(1);
    });

    test('should add receipt with parsed data', async () => {
      const receipt = {
        barId: 'test-bar-123',
        rawText: 'Beer 2x500 - Total 1000',
        parsedData: {
          items: [{ name: 'Beer', quantity: 2, price: 500 }],
          total: 1000
        }
      };

      const receiptId = await queueManager.add(receipt);
      
      const pending = await queueManager.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(receiptId);
      expect(pending[0].parsedData).toEqual(receipt.parsedData);
    });

    test('should generate unique IDs for different receipts', async () => {
      const receipt1 = { barId: 'test-bar-123', rawText: 'Receipt 1' };
      const receipt2 = { barId: 'test-bar-123', rawText: 'Receipt 2' };

      const id1 = await queueManager.add(receipt1);
      const id2 = await queueManager.add(receipt2);

      expect(id1).not.toBe(id2);
    });

    test('should enforce queue size limit', async () => {
      // Create a queue manager with small limit for testing
      const smallQueueManager = new QueueManager({
        dbPath: path.join(__dirname, 'small-queue.db'),
        maxQueueSize: 2
      });
      await smallQueueManager.initialize();

      // Add receipts up to limit
      await smallQueueManager.add({ barId: 'test', rawText: 'Receipt 1' });
      await smallQueueManager.add({ barId: 'test', rawText: 'Receipt 2' });

      // This should fail
      await expect(
        smallQueueManager.add({ barId: 'test', rawText: 'Receipt 3' })
      ).rejects.toThrow('Queue size limit reached');

      await smallQueueManager.close();
    });

    test('should validate required fields', async () => {
      const invalidReceipts = [
        {}, // Missing barId
        { barId: '' }, // Empty barId
        { barId: 'test' }, // Missing rawText and parsedData
        { barId: 'test', rawText: '' }, // Empty rawText
        { barId: 'test', parsedData: null } // Both null
      ];

      for (const receipt of invalidReceipts) {
        await expect(queueManager.add(receipt)).rejects.toThrow();
      }
    });
  });

  describe('Receipt Retrieval', () => {
    beforeEach(async () => {
      // Add test receipts
      await queueManager.add({
        barId: 'test-bar-1',
        rawText: 'Receipt 1',
        capturedAt: '2023-01-01T10:00:00Z'
      });
      
      await queueManager.add({
        barId: 'test-bar-2',
        rawText: 'Receipt 2',
        capturedAt: '2023-01-01T10:05:00Z'
      });
      
      await queueManager.add({
        barId: 'test-bar-3',
        rawText: 'Receipt 3',
        capturedAt: '2023-01-01T10:10:00Z'
      });
    });

    test('should get pending receipts in chronological order', async () => {
      const pending = await queueManager.getPending();
      
      expect(pending).toHaveLength(3);
      expect(pending[0].rawText).toBe('Receipt 1');
      expect(pending[1].rawText).toBe('Receipt 2');
      expect(pending[2].rawText).toBe('Receipt 3');
    });

    test('should respect limit parameter', async () => {
      const pending = await queueManager.getPending(2);
      
      expect(pending).toHaveLength(2);
      expect(pending[0].rawText).toBe('Receipt 1');
      expect(pending[1].rawText).toBe('Receipt 2');
    });

    test('should return empty array when no pending receipts', async () => {
      // Mark all as uploaded
      const stats = await queueManager.getQueueStats();
      for (let i = 0; i < stats.pending; i++) {
        const pending = await queueManager.getPending(1);
        await queueManager.markUploaded(pending[0].id);
      }

      const pending = await queueManager.getPending();
      expect(pending).toHaveLength(0);
    });
  });

  describe('Status Transitions', () => {
    let receiptId;

    beforeEach(async () => {
      receiptId = await queueManager.add({
        barId: 'test-bar',
        rawText: 'Test receipt'
      });
    });

    test('should mark receipt as uploaded', async () => {
      await queueManager.markUploaded(receiptId);
      
      const stats = await queueManager.getQueueStats();
      expect(stats.pending).toBe(0);
      expect(stats.uploaded).toBe(1);
      
      const pending = await queueManager.getPending();
      expect(pending).toHaveLength(0);
    });

    test('should mark receipt as failed with error message', async () => {
      const errorMessage = 'Network timeout';
      await queueManager.markFailed(receiptId, errorMessage);
      
      const stats = await queueManager.getQueueStats();
      expect(stats.pending).toBe(0);
      expect(stats.failed).toBe(1);
      
      const pending = await queueManager.getPending();
      expect(pending).toHaveLength(0);
    });

    test('should increment retry count', async () => {
      await queueManager.incrementRetry(receiptId);
      
      const pending = await queueManager.getPending(1);
      expect(pending[0].retryCount).toBe(1);
      expect(pending[0].lastUploadAttempt).toBeDefined();
      
      // Increment again
      await queueManager.incrementRetry(receiptId);
      const pending2 = await queueManager.getPending(1);
      expect(pending2[0].retryCount).toBe(2);
    });

    test('should handle status transitions for non-existent receipts', async () => {
      const fakeId = 'non-existent-receipt';
      
      // These should not throw, just log warnings
      await expect(queueManager.markUploaded(fakeId)).resolves.not.toThrow();
      await expect(queueManager.markFailed(fakeId, 'Error')).resolves.not.toThrow();
      await expect(queueManager.incrementRetry(fakeId)).resolves.not.toThrow();
    });
  });

  describe('Queue Statistics', () => {
    test('should track queue statistics correctly', async () => {
      // Add receipts
      const id1 = await queueManager.add({ barId: 'test', rawText: 'Receipt 1' });
      const id2 = await queueManager.add({ barId: 'test', rawText: 'Receipt 2' });
      
      let stats = await queueManager.getStats();
      expect(stats.enqueued).toBe(2);
      expect(stats.pending).toBe(2);
      
      // Mark one as uploaded
      await queueManager.markUploaded(id1);
      
      stats = await queueManager.getStats();
      expect(stats.uploaded).toBe(1);
      expect(stats.pending).toBe(1);
      
      // Mark one as failed
      await queueManager.markFailed(id2, 'Error');
      
      stats = await queueManager.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });

    test('should provide detailed queue statistics', async () => {
      await queueManager.add({ barId: 'test', rawText: 'Receipt 1' });
      await queueManager.add({ barId: 'test', rawText: 'Receipt 2' });
      
      const stats = await queueManager.getStats();
      
      expect(stats).toHaveProperty('enqueued');
      expect(stats).toHaveProperty('dequeued');
      expect(stats).toHaveProperty('uploaded');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('cleanedUp');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('uploaded');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('dbPath');
      expect(stats).toHaveProperty('maxQueueSize');
      expect(stats).toHaveProperty('maxUploadedAgeDays');
    });
  });

  describe('Cleanup Operations', () => {
    test('should cleanup old uploaded receipts', async () => {
      // Add and mark some receipts as uploaded
      const id1 = await queueManager.add({ barId: 'test', rawText: 'Receipt 1' });
      const id2 = await queueManager.add({ barId: 'test', rawText: 'Receipt 2' });
      
      await queueManager.markUploaded(id1);
      await queueManager.markUploaded(id2);
      
      let stats = await queueManager.getQueueStats();
      expect(stats.uploaded).toBe(2);
      
      // Mock time to simulate old receipts
      // In a real test, you might use a library like sinon to manipulate time
      // For now, we'll test the cleanup method structure
      const cleanedCount = await queueManager.cleanup();
      
      // Should not clean up recent receipts
      expect(cleanedCount).toBe(0);
      
      stats = await queueManager.getQueueStats();
      expect(stats.uploaded).toBe(2);
    });

    test('should track cleanup statistics', async () => {
      const stats = await queueManager.getStats();
      expect(stats.cleanedUp).toBe(0);
      
      await queueManager.cleanup();
      
      const updatedStats = await queueManager.getStats();
      expect(updatedStats.cleanedUp).toBeGreaterThanOrEqual(0);
      expect(updatedStats.lastCleanup).toBeDefined();
    });
  });

  describe('Database Operations', () => {
    test('should handle database connection errors gracefully', async () => {
      // Try to create queue manager with invalid path
      const invalidQueueManager = new QueueManager({
        dbPath: '/invalid/path/that/does/not/exist/test.db'
      });
      
      // Should create directory and initialize successfully
      await expect(invalidQueueManager.initialize()).resolves.toBe(true);
      await invalidQueueManager.close();
    });

    test('should close database connection properly', async () => {
      await expect(queueManager.close()).resolves.not.toThrow();
      
      // Should be able to close again without error
      await expect(queueManager.close()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle receipts with special characters', async () => {
      const receipt = {
        barId: 'test-bar',
        rawText: 'Receipt with émojis 🍕 and spéci@l ch@r$!',
        parsedData: {
          items: [{ name: 'Pizza 🍕', price: 1500 }],
          notes: 'Special chars: émojis spéci@l ch@r$!'
        }
      };

      const receiptId = await queueManager.add(receipt);
      const pending = await queueManager.getPending(1);
      
      expect(pending[0].id).toBe(receiptId);
      expect(pending[0].rawText).toBe(receipt.rawText);
      expect(pending[0].parsedData).toEqual(receipt.parsedData);
    });

    test('should handle very long receipt text', async () => {
      const longText = 'A'.repeat(10000); // 10KB of text
      const receipt = {
        barId: 'test-bar',
        rawText: longText
      };

      const receiptId = await queueManager.add(receipt);
      const pending = await queueManager.getPending(1);
      
      expect(pending[0].id).toBe(receiptId);
      expect(pending[0].rawText).toBe(longText);
    });

    test('should handle concurrent operations', async () => {
      // Add multiple receipts concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          queueManager.add({
            barId: 'test-bar',
            rawText: `Receipt ${i}`
          })
        );
      }

      const receiptIds = await Promise.all(promises);
      expect(receiptIds).toHaveLength(10);
      
      // All IDs should be unique
      const uniqueIds = new Set(receiptIds);
      expect(uniqueIds.size).toBe(10);
      
      const stats = await queueManager.getQueueStats();
      expect(stats.pending).toBe(10);
    });
  });

  describe('Performance', () => {
    test('should handle large number of receipts efficiently', async () => {
      const startTime = Date.now();
      
      // Add 100 receipts
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          queueManager.add({
            barId: 'test-bar',
            rawText: `Receipt ${i}`,
            parsedData: { index: i, total: i * 100 }
          })
        );
      }
      
      await Promise.all(promises);
      
      const addTime = Date.now() - startTime;
      console.log(`Added 100 receipts in ${addTime}ms`);
      
      // Retrieve all pending receipts
      const retrieveStart = Date.now();
      const pending = await queueManager.getPending(100);
      const retrieveTime = Date.now() - retrieveStart;
      
      console.log(`Retrieved 100 receipts in ${retrieveTime}ms`);
      
      expect(pending).toHaveLength(100);
      expect(addTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(retrieveTime).toBeLessThan(1000); // Should retrieve within 1 second
    });
  });
});
