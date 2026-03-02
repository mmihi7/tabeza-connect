/**
 * Property-based tests for QueueManager
 * 
 * Tests correctness properties:
 * - Property 9: Queue File Creation
 * - Property 13: Queue Exactly-Once Semantics
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QueueManager = require('../queue-manager');

describe('QueueManager - Property-Based Tests', () => {
  let tempDir;
  let queueManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'queue-prop-test-'));
    queueManager = new QueueManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Property 9: Queue File Creation
   * 
   * For any parsed receipt, the Queue System should write a JSON file to the pending folder
   * with a UUID filename containing all required fields: id, barId, driverId, timestamp,
   * parsed, confidence, receipt, enqueuedAt, uploadAttempts, lastUploadError.
   */
  test('Property 9: Queue File Creation - all required fields present', () => {
    fc.assert(
      fc.property(
        fc.record({
          barId: fc.string({ minLength: 1, maxLength: 50 }),
          driverId: fc.string({ minLength: 1, maxLength: 50 }),
          timestamp: fc.date().map(d => d.toISOString()),
          parsed: fc.boolean(),
          confidence: fc.double({ min: 0, max: 1 }),
          receipt: fc.record({
            items: fc.array(fc.record({
              name: fc.string({ minLength: 1 }),
              qty: fc.integer({ min: 1, max: 100 }),
              price: fc.double({ min: 0.01, max: 10000 })
            })),
            total: fc.double({ min: 0, max: 100000 }),
            receiptNumber: fc.string({ minLength: 1 }),
            rawText: fc.string()
          })
        }),
        (receipt) => {
          const id = queueManager.enqueue(receipt);
          
          // Verify file exists
          const filepath = path.join(tempDir, 'pending', `${id}.json`);
          expect(fs.existsSync(filepath)).toBe(true);
          
          // Verify all required fields
          const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          expect(content.id).toBe(id);
          expect(content.barId).toBe(receipt.barId);
          expect(content.driverId).toBe(receipt.driverId);
          expect(content.timestamp).toBe(receipt.timestamp);
          expect(content.parsed).toBe(receipt.parsed);
          expect(content.confidence).toBe(receipt.confidence);
          expect(content.receipt).toEqual(receipt.receipt);
          expect(content.enqueuedAt).toBeDefined();
          expect(typeof content.enqueuedAt).toBe('string');
          expect(content.uploadAttempts).toBe(0);
          expect(content.lastUploadError).toBe(null);
          
          // Verify enqueuedAt is valid ISO timestamp
          expect(() => new Date(content.enqueuedAt)).not.toThrow();
          expect(new Date(content.enqueuedAt).toISOString()).toBe(content.enqueuedAt);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 9: Queue File Creation - UUID format validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          barId: fc.string({ minLength: 1 }),
          driverId: fc.string({ minLength: 1 }),
          timestamp: fc.date().map(d => d.toISOString()),
          parsed: fc.boolean(),
          receipt: fc.object()
        }),
        (receipt) => {
          const id = queueManager.enqueue(receipt);
          
          // Verify UUID format (8-4-4-4-12 hex digits)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(id).toMatch(uuidRegex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Queue Exactly-Once Semantics
   * 
   * For any receipt, uploading the same receipt multiple times should result in the same
   * cloud state, and once a receipt is moved to uploaded\, it should never be re-uploaded
   * even after service restart.
   */
  test('Property 13: Exactly-Once Semantics - uploaded receipts not in pending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            barId: fc.string({ minLength: 1 }),
            driverId: fc.string({ minLength: 1 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            receipt: fc.object()
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (receipts) => {
          // Enqueue all receipts
          const ids = receipts.map(r => queueManager.enqueue(r));
          
          // Mark some as uploaded (randomly)
          const uploadedIds = ids.filter(() => Math.random() > 0.5);
          uploadedIds.forEach(id => queueManager.markUploaded(id));
          
          // Scan pending queue
          const pending = queueManager.scanPending();
          const pendingIds = pending.map(item => item.id);
          
          // Verify no uploaded receipt is in pending
          uploadedIds.forEach(id => {
            expect(pendingIds).not.toContain(id);
          });
          
          // Verify uploaded receipts are in uploaded folder
          uploadedIds.forEach(id => {
            const uploadedPath = path.join(tempDir, 'uploaded', `${id}.json`);
            expect(fs.existsSync(uploadedPath)).toBe(true);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 13: Exactly-Once Semantics - dequeue returns each receipt once', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            barId: fc.string({ minLength: 1 }),
            driverId: fc.string({ minLength: 1 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            receipt: fc.object()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (receipts) => {
          // Enqueue all receipts
          const ids = receipts.map(r => queueManager.enqueue(r));
          
          // Dequeue and mark uploaded
          const dequeuedIds = [];
          let item;
          while ((item = queueManager.dequeue()) !== null) {
            dequeuedIds.push(item.id);
            queueManager.markUploaded(item.id);
          }
          
          // Verify each receipt was dequeued exactly once
          expect(dequeuedIds.sort()).toEqual(ids.sort());
          
          // Verify no duplicates
          const uniqueIds = [...new Set(dequeuedIds)];
          expect(uniqueIds.length).toBe(dequeuedIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 13: Exactly-Once Semantics - restart resilience', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            barId: fc.string({ minLength: 1 }),
            driverId: fc.string({ minLength: 1 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            receipt: fc.object()
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (receipts) => {
          // Enqueue all receipts
          const ids = receipts.map(r => queueManager.enqueue(r));
          
          // Simulate service restart by creating new QueueManager instance
          const queueManager2 = new QueueManager(tempDir);
          
          // Scan pending queue after restart
          const pending = queueManager2.scanPending();
          const pendingIds = pending.map(item => item.id);
          
          // Verify all receipts are still in pending
          expect(pendingIds.sort()).toEqual(ids.sort());
          
          // Dequeue and upload all
          let item;
          while ((item = queueManager2.dequeue()) !== null) {
            queueManager2.markUploaded(item.id);
          }
          
          // Simulate another restart
          const queueManager3 = new QueueManager(tempDir);
          const pendingAfterUpload = queueManager3.scanPending();
          
          // Verify no receipts in pending after upload
          expect(pendingAfterUpload).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 13: Exactly-Once Semantics - failed receipts remain in pending', () => {
    fc.assert(
      fc.property(
        fc.record({
          barId: fc.string({ minLength: 1 }),
          driverId: fc.string({ minLength: 1 }),
          timestamp: fc.date().map(d => d.toISOString()),
          parsed: fc.boolean(),
          receipt: fc.object()
        }),
        fc.integer({ min: 1, max: 10 }),
        (receipt, failureCount) => {
          const id = queueManager.enqueue(receipt);
          
          // Mark as failed multiple times
          for (let i = 0; i < failureCount; i++) {
            queueManager.markFailed(id, `Error ${i + 1}`);
          }
          
          // Verify receipt is still in pending
          const pendingPath = path.join(tempDir, 'pending', `${id}.json`);
          expect(fs.existsSync(pendingPath)).toBe(true);
          
          // Verify not in uploaded
          const uploadedPath = path.join(tempDir, 'uploaded', `${id}.json`);
          expect(fs.existsSync(uploadedPath)).toBe(false);
          
          // Verify uploadAttempts is correct
          const content = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
          expect(content.uploadAttempts).toBe(failureCount);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 13: Exactly-Once Semantics - atomic operations prevent corruption', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            barId: fc.string({ minLength: 1 }),
            driverId: fc.string({ minLength: 1 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            receipt: fc.object()
          }),
          { minLength: 5, maxLength: 10 }
        ),
        (receipts) => {
          // Enqueue all receipts
          const ids = receipts.map(r => queueManager.enqueue(r));
          
          // Verify no .tmp files exist (atomic write completed)
          const pendingFiles = fs.readdirSync(path.join(tempDir, 'pending'));
          const tmpFiles = pendingFiles.filter(f => f.endsWith('.tmp'));
          expect(tmpFiles).toHaveLength(0);
          
          // Verify all files are valid JSON
          ids.forEach(id => {
            const filepath = path.join(tempDir, 'pending', `${id}.json`);
            expect(() => {
              JSON.parse(fs.readFileSync(filepath, 'utf8'));
            }).not.toThrow();
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 13: Exactly-Once Semantics - dequeue order is deterministic', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            barId: fc.string({ minLength: 1 }),
            driverId: fc.string({ minLength: 1 }),
            timestamp: fc.date().map(d => d.toISOString()),
            parsed: fc.boolean(),
            receipt: fc.object()
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (receipts) => {
          // Enqueue all receipts with delays to ensure different enqueuedAt
          const ids = [];
          receipts.forEach((receipt, index) => {
            const id = queueManager.enqueue(receipt);
            ids.push(id);
            
            // Small delay to ensure different timestamps
            if (index < receipts.length - 1) {
              const start = Date.now();
              while (Date.now() - start < 5) { /* wait */ }
            }
          });
          
          // Dequeue all without marking uploaded
          const dequeuedOrder = [];
          for (let i = 0; i < receipts.length; i++) {
            const item = queueManager.dequeue();
            if (item) {
              dequeuedOrder.push(item.id);
            }
          }
          
          // Verify dequeue returns in enqueuedAt order (oldest first)
          expect(dequeuedOrder).toEqual(ids);
        }
      ),
      { numRuns: 30 }
    );
  });
});
