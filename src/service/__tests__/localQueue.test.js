/**
 * Local Queue Unit Tests
 * 
 * Tests the local persistent queue implementation for receipt storage.
 * 
 * Requirements tested: 5.1, 5.2, 5.3, 5.5
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const LocalQueue = require('../localQueue');

describe('LocalQueue', () => {
  let queue;
  let testQueuePath;
  
  beforeEach(async () => {
    // Create temporary queue directory
    testQueuePath = path.join(os.tmpdir(), `tabeza-queue-test-${Date.now()}`);
    queue = new LocalQueue({ queuePath: testQueuePath });
    await queue.initialize();
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testQueuePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Initialization', () => {
    test('should create queue directories', async () => {
      const pendingExists = fsSync.existsSync(path.join(testQueuePath, 'pending'));
      const uploadedExists = fsSync.existsSync(path.join(testQueuePath, 'uploaded'));
      
      expect(pendingExists).toBe(true);
      expect(uploadedExists).toBe(true);
    });
    
    test('should check permissions', async () => {
      // Should not throw
      await expect(queue.checkPermissions()).resolves.toBe(true);
    });
    
    test('should return initial queue size', async () => {
      const size = await queue.getQueueSize();
      expect(size).toBe(0);
    });
  });
  
  describe('Enqueue', () => {
    test('should enqueue a valid receipt', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt\nItem 1: $10.00\nTotal: $10.00',
        metadata: {
          source: 'test',
        },
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      expect(receiptId).toBeDefined();
      expect(typeof receiptId).toBe('string');
      
      // Verify file was created
      const filePath = path.join(testQueuePath, 'pending', `${receiptId}.json`);
      const fileExists = fsSync.existsSync(filePath);
      expect(fileExists).toBe(true);
      
      // Verify file content
      const fileData = await fs.readFile(filePath, 'utf8');
      const savedReceipt = JSON.parse(fileData);
      
      expect(savedReceipt.id).toBe(receiptId);
      expect(savedReceipt.barId).toBe(receipt.barId);
      expect(savedReceipt.deviceId).toBe(receipt.deviceId);
      expect(savedReceipt.text).toBe(receipt.text);
      expect(savedReceipt.enqueuedAt).toBeDefined();
      expect(savedReceipt.uploadAttempts).toBe(0);
    });
    
    test('should enqueue receipt with ESC/POS data', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        escposBytes: Buffer.from('test escpos data').toString('base64'),
        text: 'Test receipt',
        metadata: {},
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      // Verify ESC/POS data was saved
      const filePath = path.join(testQueuePath, 'pending', `${receiptId}.json`);
      const fileData = await fs.readFile(filePath, 'utf8');
      const savedReceipt = JSON.parse(fileData);
      
      expect(savedReceipt.escposBytes).toBe(receipt.escposBytes);
    });
    
    test('should reject receipt without required fields', async () => {
      const invalidReceipt = {
        barId: 'bar-123',
        // Missing deviceId, timestamp, text
      };
      
      await expect(queue.enqueue(invalidReceipt)).rejects.toThrow('Missing required field');
    });
    
    test('should reject receipt with invalid timestamp', async () => {
      const invalidReceipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: 'invalid-timestamp',
        text: 'Test receipt',
      };
      
      await expect(queue.enqueue(invalidReceipt)).rejects.toThrow('Invalid timestamp format');
    });
    
    test('should reject receipt with empty text', async () => {
      const invalidReceipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: '   ', // Empty after trim
      };
      
      await expect(queue.enqueue(invalidReceipt)).rejects.toThrow('Receipt text cannot be empty');
    });
    
    test('should update statistics after enqueue', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const statsBefore = await queue.getStats();
      await queue.enqueue(receipt);
      const statsAfter = await queue.getStats();
      
      expect(statsAfter.enqueued).toBe(statsBefore.enqueued + 1);
      expect(statsAfter.lastEnqueue).toBeDefined();
      expect(statsAfter.queueSize).toBe(1);
    });
  });
  
  describe('Dequeue', () => {
    test('should return null when queue is empty', async () => {
      const receipt = await queue.dequeue();
      expect(receipt).toBeNull();
    });
    
    test('should dequeue the oldest receipt', async () => {
      // Enqueue multiple receipts
      const receipt1 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 1',
      };
      
      const receipt2 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 2',
      };
      
      const id1 = await queue.enqueue(receipt1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const id2 = await queue.enqueue(receipt2);
      
      // Dequeue should return the first receipt
      const dequeued = await queue.dequeue();
      
      expect(dequeued).toBeDefined();
      expect(dequeued.id).toBe(id1);
      expect(dequeued.text).toBe('Receipt 1');
    });
    
    test('should not remove receipt from queue', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      // Dequeue
      await queue.dequeue();
      
      // File should still exist
      const filePath = path.join(testQueuePath, 'pending', `${receiptId}.json`);
      const fileExists = fsSync.existsSync(filePath);
      expect(fileExists).toBe(true);
    });
    
    test('should update statistics after dequeue', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      await queue.enqueue(receipt);
      
      const statsBefore = await queue.getStats();
      await queue.dequeue();
      const statsAfter = await queue.getStats();
      
      expect(statsAfter.dequeued).toBe(statsBefore.dequeued + 1);
      expect(statsAfter.lastDequeue).toBeDefined();
    });
  });
  
  describe('Mark Uploaded', () => {
    test('should move receipt from pending to uploaded', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      // Mark as uploaded
      await queue.markUploaded(receiptId);
      
      // Pending file should be removed
      const pendingPath = path.join(testQueuePath, 'pending', `${receiptId}.json`);
      const pendingExists = fsSync.existsSync(pendingPath);
      expect(pendingExists).toBe(false);
      
      // Uploaded file should exist
      const uploadedPath = path.join(testQueuePath, 'uploaded', `${receiptId}.json`);
      const uploadedExists = fsSync.existsSync(uploadedPath);
      expect(uploadedExists).toBe(true);
      
      // Verify uploaded file has uploadedAt timestamp
      const fileData = await fs.readFile(uploadedPath, 'utf8');
      const uploadedReceipt = JSON.parse(fileData);
      expect(uploadedReceipt.uploadedAt).toBeDefined();
      expect(uploadedReceipt.status).toBe('uploaded');
    });
    
    test('should handle marking non-existent receipt', async () => {
      // Should not throw
      await expect(queue.markUploaded('non-existent-id')).resolves.not.toThrow();
    });
    
    test('should update statistics after marking uploaded', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      const statsBefore = await queue.getStats();
      await queue.markUploaded(receiptId);
      const statsAfter = await queue.getStats();
      
      expect(statsAfter.uploaded).toBe(statsBefore.uploaded + 1);
      expect(statsAfter.queueSize).toBe(0);
      expect(statsAfter.uploadedCount).toBe(1);
    });
  });
  
  describe('Update Upload Attempt', () => {
    test('should increment upload attempts', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      // Update attempt
      await queue.updateUploadAttempt(receiptId);
      
      // Verify attempt count
      const filePath = path.join(testQueuePath, 'pending', `${receiptId}.json`);
      const fileData = await fs.readFile(filePath, 'utf8');
      const updatedReceipt = JSON.parse(fileData);
      
      expect(updatedReceipt.uploadAttempts).toBe(1);
      expect(updatedReceipt.lastUploadAttempt).toBeDefined();
    });
    
    test('should store error message', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      
      // Update attempt with error
      const errorMessage = 'Network timeout';
      await queue.updateUploadAttempt(receiptId, errorMessage);
      
      // Verify error was stored
      const filePath = path.join(testQueuePath, 'pending', `${receiptId}.json`);
      const fileData = await fs.readFile(filePath, 'utf8');
      const updatedReceipt = JSON.parse(fileData);
      
      expect(updatedReceipt.lastUploadError).toBe(errorMessage);
    });
  });
  
  describe('Queue Size', () => {
    test('should return correct queue size', async () => {
      expect(await queue.getQueueSize()).toBe(0);
      
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      await queue.enqueue(receipt);
      expect(await queue.getQueueSize()).toBe(1);
      
      await queue.enqueue(receipt);
      expect(await queue.getQueueSize()).toBe(2);
    });
    
    test('should decrease after marking uploaded', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      expect(await queue.getQueueSize()).toBe(1);
      
      await queue.markUploaded(receiptId);
      expect(await queue.getQueueSize()).toBe(0);
    });
  });
  
  describe('Cleanup', () => {
    test('should remove old uploaded receipts', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      await queue.markUploaded(receiptId);
      
      // Manually modify uploadedAt to be old
      const uploadedPath = path.join(testQueuePath, 'uploaded', `${receiptId}.json`);
      const fileData = await fs.readFile(uploadedPath, 'utf8');
      const uploadedReceipt = JSON.parse(fileData);
      
      // Set uploadedAt to 8 days ago (older than 7 day limit)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      uploadedReceipt.uploadedAt = oldDate.toISOString();
      
      await fs.writeFile(uploadedPath, JSON.stringify(uploadedReceipt, null, 2), 'utf8');
      
      // Run cleanup
      const cleanedCount = await queue.cleanup();
      
      expect(cleanedCount).toBe(1);
      
      // File should be removed
      const fileExists = fsSync.existsSync(uploadedPath);
      expect(fileExists).toBe(false);
    });
    
    test('should not remove recent uploaded receipts', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      await queue.markUploaded(receiptId);
      
      // Run cleanup
      const cleanedCount = await queue.cleanup();
      
      expect(cleanedCount).toBe(0);
      
      // File should still exist
      const uploadedPath = path.join(testQueuePath, 'uploaded', `${receiptId}.json`);
      const fileExists = fsSync.existsSync(uploadedPath);
      expect(fileExists).toBe(true);
    });
    
    test('should update statistics after cleanup', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      await queue.markUploaded(receiptId);
      
      // Make it old
      const uploadedPath = path.join(testQueuePath, 'uploaded', `${receiptId}.json`);
      const fileData = await fs.readFile(uploadedPath, 'utf8');
      const uploadedReceipt = JSON.parse(fileData);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      uploadedReceipt.uploadedAt = oldDate.toISOString();
      await fs.writeFile(uploadedPath, JSON.stringify(uploadedReceipt, null, 2), 'utf8');
      
      const statsBefore = await queue.getStats();
      await queue.cleanup();
      const statsAfter = await queue.getStats();
      
      expect(statsAfter.cleanedUp).toBe(statsBefore.cleanedUp + 1);
      expect(statsAfter.lastCleanup).toBeDefined();
    });
  });
  
  describe('Get All Pending', () => {
    test('should return empty array when queue is empty', async () => {
      const pending = await queue.getAllPending();
      expect(pending).toEqual([]);
    });
    
    test('should return all pending receipts', async () => {
      const receipt1 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 1',
      };
      
      const receipt2 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 2',
      };
      
      await queue.enqueue(receipt1);
      await queue.enqueue(receipt2);
      
      const pending = await queue.getAllPending();
      
      expect(pending).toHaveLength(2);
      expect(pending[0].text).toBe('Receipt 1');
      expect(pending[1].text).toBe('Receipt 2');
    });
    
    test('should return receipts sorted by enqueued time', async () => {
      const receipt1 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 1',
      };
      
      const receipt2 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 2',
      };
      
      await queue.enqueue(receipt1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await queue.enqueue(receipt2);
      
      const pending = await queue.getAllPending();
      
      expect(pending[0].text).toBe('Receipt 1');
      expect(pending[1].text).toBe('Receipt 2');
      
      const time1 = new Date(pending[0].enqueuedAt).getTime();
      const time2 = new Date(pending[1].enqueuedAt).getTime();
      expect(time1).toBeLessThan(time2);
    });
  });
  
  describe('Persistence', () => {
    test('should survive queue reinitialization', async () => {
      // Enqueue receipts
      const receipt1 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 1',
      };
      
      const receipt2 = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Receipt 2',
      };
      
      await queue.enqueue(receipt1);
      await queue.enqueue(receipt2);
      
      // Create new queue instance (simulates service restart)
      const newQueue = new LocalQueue({ queuePath: testQueuePath });
      await newQueue.initialize();
      
      // Queue size should be preserved
      const queueSize = await newQueue.getQueueSize();
      expect(queueSize).toBe(2);
      
      // Should be able to dequeue receipts
      const dequeued = await newQueue.dequeue();
      expect(dequeued).toBeDefined();
      expect(dequeued.text).toBe('Receipt 1');
    });
  });
  
  describe('Statistics', () => {
    test('should return comprehensive statistics', async () => {
      const receipt = {
        barId: 'bar-123',
        deviceId: 'device-456',
        timestamp: new Date().toISOString(),
        text: 'Test receipt',
      };
      
      const receiptId = await queue.enqueue(receipt);
      await queue.dequeue();
      await queue.markUploaded(receiptId);
      
      const stats = await queue.getStats();
      
      expect(stats.enqueued).toBe(1);
      expect(stats.dequeued).toBe(1);
      expect(stats.uploaded).toBe(1);
      expect(stats.queueSize).toBe(0);
      expect(stats.uploadedCount).toBe(1);
      expect(stats.lastEnqueue).toBeDefined();
      expect(stats.lastDequeue).toBeDefined();
      expect(stats.queuePath).toBe(testQueuePath);
    });
  });
});
