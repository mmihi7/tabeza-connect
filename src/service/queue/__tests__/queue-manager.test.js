/**
 * Unit tests for QueueManager
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const QueueManager = require('../queue-manager');

describe('QueueManager', () => {
  let tempDir;
  let queueManager;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-test-'));
    queueManager = new QueueManager(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    test('should create queue folders if they do not exist', () => {
      expect(fs.existsSync(path.join(tempDir, 'pending'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'uploaded'))).toBe(true);
    });

    test('should not fail if folders already exist', () => {
      // Create another instance with same path
      const qm2 = new QueueManager(tempDir);
      expect(qm2).toBeDefined();
    });
  });

  describe('enqueue()', () => {
    test('should write JSON file with UUID to pending folder', () => {
      const receipt = {
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        confidence: 0.95,
        receipt: {
          items: [{ name: 'Test Item', qty: 1, price: 100 }],
          total: 100,
          receiptNumber: 'RCP-001'
        }
      };

      const id = queueManager.enqueue(receipt);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const filepath = path.join(tempDir, 'pending', `${id}.json`);
      expect(fs.existsSync(filepath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      expect(content.id).toBe(id);
      expect(content.barId).toBe('test-bar');
      expect(content.uploadAttempts).toBe(0);
      expect(content.lastUploadError).toBe(null);
      expect(content.enqueuedAt).toBeDefined();
    });

    test('should handle receipt without confidence', () => {
      const receipt = {
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: false,
        receipt: { rawText: 'test' }
      };

      const id = queueManager.enqueue(receipt);
      const filepath = path.join(tempDir, 'pending', `${id}.json`);
      const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      
      expect(content.confidence).toBe(0);
    });
  });

  describe('dequeue()', () => {
    test('should return null when queue is empty', () => {
      const result = queueManager.dequeue();
      expect(result).toBe(null);
    });

    test('should return oldest pending file by enqueuedAt', () => {
      // Enqueue multiple receipts with delays
      const id1 = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      // Wait a bit to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) { /* wait */ }

      const id2 = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:01:00.000Z',
        parsed: true,
        receipt: { items: [], total: 200 }
      });

      const result = queueManager.dequeue();
      
      expect(result).toBeDefined();
      expect(result.id).toBe(id1); // Should return oldest
      expect(result._filepath).toBeDefined();
    });

    test('should skip corrupted queue files', () => {
      // Create a corrupted file
      const corruptedPath = path.join(tempDir, 'pending', 'corrupted.json');
      fs.writeFileSync(corruptedPath, 'invalid json{', 'utf8');

      // Enqueue a valid receipt
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      const result = queueManager.dequeue();
      
      expect(result).toBeDefined();
      expect(result.id).toBe(id);
    });
  });

  describe('markUploaded()', () => {
    test('should move file from pending to uploaded', () => {
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      const pendingPath = path.join(tempDir, 'pending', `${id}.json`);
      const uploadedPath = path.join(tempDir, 'uploaded', `${id}.json`);

      expect(fs.existsSync(pendingPath)).toBe(true);
      expect(fs.existsSync(uploadedPath)).toBe(false);

      queueManager.markUploaded(id);

      expect(fs.existsSync(pendingPath)).toBe(false);
      expect(fs.existsSync(uploadedPath)).toBe(true);
    });

    test('should not fail if file does not exist', () => {
      expect(() => {
        queueManager.markUploaded('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('markFailed()', () => {
    test('should update uploadAttempts and lastUploadError', () => {
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      queueManager.markFailed(id, 'Network timeout');

      const filepath = path.join(tempDir, 'pending', `${id}.json`);
      const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      expect(content.uploadAttempts).toBe(1);
      expect(content.lastUploadError).toBe('Network timeout');
      expect(content.lastAttemptAt).toBeDefined();
    });

    test('should increment uploadAttempts on multiple failures', () => {
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      queueManager.markFailed(id, 'Error 1');
      queueManager.markFailed(id, 'Error 2');
      queueManager.markFailed(id, 'Error 3');

      const filepath = path.join(tempDir, 'pending', `${id}.json`);
      const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      expect(content.uploadAttempts).toBe(3);
      expect(content.lastUploadError).toBe('Error 3');
    });

    test('should not fail if file does not exist', () => {
      expect(() => {
        queueManager.markFailed('non-existent-id', 'Error');
      }).not.toThrow();
    });
  });

  describe('scanPending()', () => {
    test('should return empty array when no pending files', () => {
      const result = queueManager.scanPending();
      expect(result).toEqual([]);
    });

    test('should return all pending receipts sorted by enqueuedAt', () => {
      const id1 = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      const start = Date.now();
      while (Date.now() - start < 10) { /* wait */ }

      const id2 = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:01:00.000Z',
        parsed: true,
        receipt: { items: [], total: 200 }
      });

      const results = queueManager.scanPending();

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(id1);
      expect(results[1].id).toBe(id2);
      expect(results[0]._filepath).toBeDefined();
    });

    test('should skip corrupted files during scan', () => {
      const corruptedPath = path.join(tempDir, 'pending', 'corrupted.json');
      fs.writeFileSync(corruptedPath, 'invalid json{', 'utf8');

      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      const results = queueManager.scanPending();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(id);
    });
  });

  describe('getStats()', () => {
    test('should return zero counts when queue is empty', () => {
      const stats = queueManager.getStats();
      
      expect(stats.pending).toBe(0);
      expect(stats.uploaded).toBe(0);
      expect(stats.failed).toBe(0);
    });

    test('should count pending and uploaded files', () => {
      const id1 = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      const id2 = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:01:00.000Z',
        parsed: true,
        receipt: { items: [], total: 200 }
      });

      queueManager.markUploaded(id1);

      const stats = queueManager.getStats();

      expect(stats.pending).toBe(1);
      expect(stats.uploaded).toBe(1);
      expect(stats.failed).toBe(0);
    });

    test('should count failed items (uploadAttempts >= 4)', () => {
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      // Mark as failed 4 times
      queueManager.markFailed(id, 'Error 1');
      queueManager.markFailed(id, 'Error 2');
      queueManager.markFailed(id, 'Error 3');
      queueManager.markFailed(id, 'Error 4');

      const stats = queueManager.getStats();

      expect(stats.pending).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('Atomic Write', () => {
    test('should use atomic write for enqueue', () => {
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      const filepath = path.join(tempDir, 'pending', `${id}.json`);
      const tempPath = `${filepath}.tmp`;

      // Temp file should not exist after successful write
      expect(fs.existsSync(tempPath)).toBe(false);
      expect(fs.existsSync(filepath)).toBe(true);
    });

    test('should use atomic write for markFailed', () => {
      const id = queueManager.enqueue({
        barId: 'test-bar',
        driverId: 'driver-TEST',
        timestamp: '2026-03-02T10:00:00.000Z',
        parsed: true,
        receipt: { items: [], total: 100 }
      });

      queueManager.markFailed(id, 'Test error');

      const filepath = path.join(tempDir, 'pending', `${id}.json`);
      const tempPath = `${filepath}.tmp`;

      expect(fs.existsSync(tempPath)).toBe(false);
      expect(fs.existsSync(filepath)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle disk full scenario in enqueue', () => {
      // Mock fs.writeFileSync to throw ENOSPC error
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn(() => {
        const error = new Error('Disk full');
        error.code = 'ENOSPC';
        throw error;
      });

      expect(() => {
        queueManager.enqueue({
          barId: 'test-bar',
          driverId: 'driver-TEST',
          timestamp: '2026-03-02T10:00:00.000Z',
          parsed: true,
          receipt: { items: [], total: 100 }
        });
      }).toThrow('Disk full');

      // Restore original function
      fs.writeFileSync = originalWriteFileSync;
    });

    test('should handle corrupted queue files gracefully', () => {
      const corruptedPath = path.join(tempDir, 'pending', 'corrupted.json');
      fs.writeFileSync(corruptedPath, 'invalid json{', 'utf8');

      // Should not throw
      expect(() => {
        queueManager.dequeue();
      }).not.toThrow();

      expect(() => {
        queueManager.scanPending();
      }).not.toThrow();

      expect(() => {
        queueManager.getStats();
      }).not.toThrow();
    });
  });
});
