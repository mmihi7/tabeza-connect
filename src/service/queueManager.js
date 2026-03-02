/**
 * SQLite Queue Manager
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to venue — never the reverse.
 * 
 * This module implements a persistent local queue using SQLite for captured receipts.
 * The queue survives system reboots and service restarts, ensuring no
 * receipt data is lost during internet outages or service interruptions.
 * 
 * Database: C:\ProgramData\Tabeza\queue.db
 * 
 * Requirements: Design "Component 7: Local Queue Manager", "Model 2: CapturedReceipt"
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;

// Default database path
const DEFAULT_DB_PATH = 'C:\\ProgramData\\Tabeza\\queue.db';

// Queue limits
const MAX_QUEUE_SIZE = 1000; // Maximum number of pending receipts
const MAX_UPLOADED_AGE_DAYS = 30; // Days to keep uploaded receipts

class QueueManager {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.db = null;
    
    // Statistics
    this.stats = {
      enqueued: 0,
      dequeued: 0,
      uploaded: 0,
      failed: 0,
      cleanedUp: 0,
      errors: 0,
      lastEnqueue: null,
      lastDequeue: null,
      lastCleanup: null,
    };
  }

  /**
   * Initialize the queue manager
   * Creates database, tables, and indexes
   */
  async initialize() {
    console.log('🗂️  Initializing SQLite queue manager...');
    console.log(`   Database path: ${this.dbPath}`);
    
    try {
      // Ensure directory exists
      await this.ensureDatabaseDirectory();
      
      // Open database connection
      await this.openDatabase();
      
      // Create tables and indexes
      await this.createSchema();
      
      // Get initial statistics
      const stats = await this.getQueueStats();
      console.log(`✅ SQLite queue initialized (${stats.pending} pending, ${stats.uploaded} uploaded)`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize SQLite queue:', error.message);
      throw error;
    }
  }

  /**
   * Ensure database directory exists
   */
  async ensureDatabaseDirectory() {
    const dbDir = path.dirname(this.dbPath);
    try {
      await fs.access(dbDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📁 Creating database directory: ${dbDir}`);
        await fs.mkdir(dbDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Open database connection with WAL mode for concurrent access
   */
  async openDatabase() {
    try {
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for concurrent access
      this.db.pragma('journal_mode = WAL');
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      console.log('🔒 Database connection opened');
    } catch (error) {
      throw new Error(`Failed to open database: ${error.message}`);
    }
  }

  /**
   * Create database schema with receipts table and indexes
   */
  async createSchema() {
    try {
      // Create receipts table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS receipts (
          id TEXT PRIMARY KEY,
          barId TEXT NOT NULL,
          rawText TEXT,
          parsedData TEXT, -- JSON string
          status TEXT NOT NULL DEFAULT 'pending', -- pending, uploaded, failed
          retryCount INTEGER NOT NULL DEFAULT 0,
          capturedAt DATETIME NOT NULL,
          uploadedAt DATETIME,
          lastUploadAttempt DATETIME,
          lastUploadError TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      this.db.exec(createTableSQL);

      // Create indexes for efficient querying
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);',
        'CREATE INDEX IF NOT EXISTS idx_receipts_captured_at ON receipts(capturedAt);',
        'CREATE INDEX IF NOT EXISTS idx_receipts_bar_id ON receipts(barId);',
        'CREATE INDEX IF NOT EXISTS idx_receipts_retry_count ON receipts(retryCount);',
        'CREATE INDEX IF NOT EXISTS idx_receipts_status_captured_at ON receipts(status, capturedAt);'
      ];

      indexes.forEach(indexSQL => {
        this.db.exec(indexSQL);
      });

      console.log('✅ Database schema created');
    } catch (error) {
      throw new Error(`Failed to create schema: ${error.message}`);
    }
  }

  /**
   * Add a receipt to the queue
   * 
   * @param {Object} receipt - Receipt data
   * @param {string} receipt.barId - Bar ID
   * @param {string} receipt.rawText - Raw receipt text
   * @param {Object} receipt.parsedData - Parsed receipt data (optional)
   * @param {Date} receipt.capturedAt - Capture timestamp
   * @returns {Promise<string>} - Receipt ID
   */
  async add(receipt) {
    try {
      // Validate required fields
      this.validateReceipt(receipt);
      
      // Generate unique ID
      const receiptId = this.generateId();
      
      // Check queue size limit
      const size = await this.getQueueSize();
      if (size >= MAX_QUEUE_SIZE) {
        throw new Error(`Queue size limit reached (${MAX_QUEUE_SIZE}). Cannot add new receipts.`);
      }

      const sql = `
        INSERT INTO receipts (
          id, barId, rawText, parsedData, status, retryCount, capturedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const stmt = this.db.prepare(sql);
      const params = [
        receiptId,
        receipt.barId,
        receipt.rawText || null,
        receipt.parsedData ? JSON.stringify(receipt.parsedData) : null,
        'pending',
        0,
        receipt.capturedAt || new Date().toISOString()
      ];

      stmt.run(params);

      // Update statistics
      this.stats.enqueued++;
      this.stats.lastEnqueue = new Date().toISOString();

      console.log(`✅ Receipt added to queue: ${receiptId}`);
      return receiptId;
    } catch (error) {
      throw new Error(`Failed to add receipt: ${error.message}`);
    }
  }

  /**
   * Get pending receipts for upload
   * 
   * @param {number} limit - Maximum number of receipts to return
   * @returns {Promise<Array>} - Array of pending receipts
   */
  async getPending(limit = 50) {
    try {
      const sql = `
        SELECT * FROM receipts 
        WHERE status = 'pending' 
        ORDER BY capturedAt ASC 
        LIMIT ?
      `;

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(limit);

      // Parse JSON fields
      const receipts = rows.map(row => ({
        ...row,
        parsedData: row.parsedData ? JSON.parse(row.parsedData) : null
      }));

      return receipts;
    } catch (error) {
      throw new Error(`Failed to get pending receipts: ${error.message}`);
    }
  }

  /**
   * Mark a receipt as uploaded
   * 
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<void>}
   */
  async markUploaded(receiptId) {
    try {
      const sql = `
        UPDATE receipts 
        SET status = 'uploaded', 
            uploadedAt = CURRENT_TIMESTAMP,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const stmt = this.db.prepare(sql);
      const result = stmt.run(receiptId);

      if (result.changes === 0) {
        console.warn(`⚠️  Receipt ${receiptId} not found in queue`);
        return;
      }

      // Update statistics
      this.stats.uploaded++;

      console.log(`✅ Receipt marked as uploaded: ${receiptId}`);
    } catch (error) {
      throw new Error(`Failed to mark receipt as uploaded: ${error.message}`);
    }
  }

  /**
   * Mark a receipt as failed
   * 
   * @param {string} receiptId - Receipt ID
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async markFailed(receiptId, error = null) {
    try {
      const sql = `
        UPDATE receipts 
        SET status = 'failed',
            lastUploadAttempt = CURRENT_TIMESTAMP,
            lastUploadError = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const stmt = this.db.prepare(sql);
      const result = stmt.run(error, receiptId);

      if (result.changes === 0) {
        console.warn(`⚠️  Receipt ${receiptId} not found in queue`);
        return;
      }

      // Update statistics
      this.stats.failed++;

      console.log(`❌ Receipt marked as failed: ${receiptId}`);
    } catch (error) {
      throw new Error(`Failed to mark receipt as failed: ${error.message}`);
    }
  }

  /**
   * Increment retry count for a receipt
   * 
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<void>}
   */
  async incrementRetry(receiptId) {
    try {
      const sql = `
        UPDATE receipts 
        SET retryCount = retryCount + 1,
            lastUploadAttempt = CURRENT_TIMESTAMP,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const stmt = this.db.prepare(sql);
      const result = stmt.run(receiptId);

      if (result.changes === 0) {
        console.warn(`⚠️  Receipt ${receiptId} not found in queue`);
        return;
      }
    } catch (error) {
      throw new Error(`Failed to increment retry count: ${error.message}`);
    }
  }

  /**
   * Get queue statistics
   * 
   * @returns {Promise<Object>} - Queue statistics
   */
  async getQueueStats() {
    try {
      const sql = `
        SELECT 
          status,
          COUNT(*) as count
        FROM receipts 
        GROUP BY status
      `;

      const stmt = this.db.prepare(sql);
      const rows = stmt.all();

      const stats = {
        pending: 0,
        uploaded: 0,
        failed: 0,
        total: 0
      };

      rows.forEach(row => {
        stats[row.status] = row.count;
        stats.total += row.count;
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get queue statistics: ${error.message}`);
    }
  }

  /**
   * Get current queue size (pending receipts)
   * 
   * @returns {Promise<number>}
   */
  async getQueueSize() {
    try {
      const sql = 'SELECT COUNT(*) as count FROM receipts WHERE status = "pending"';
      
      const stmt = this.db.prepare(sql);
      const row = stmt.get();
      
      return row.count;
    } catch (error) {
      throw new Error(`Failed to get queue size: ${error.message}`);
    }
  }

  /**
   * Cleanup old uploaded receipts
   * Removes uploaded receipts older than MAX_UPLOADED_AGE_DAYS
   * 
   * @returns {Promise<number>} - Number of receipts cleaned up
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up old uploaded receipts...');
      
      const sql = `
        DELETE FROM receipts 
        WHERE status = 'uploaded' 
        AND uploadedAt < datetime('now', '-${MAX_UPLOADED_AGE_DAYS} days')
      `;

      const stmt = this.db.prepare(sql);
      const result = stmt.run();

      // Update statistics
      this.stats.cleanedUp += result.changes;
      this.stats.lastCleanup = new Date().toISOString();

      if (result.changes > 0) {
        console.log(`✅ Cleaned up ${result.changes} old uploaded receipts`);
      } else {
        console.log('✅ No old receipts to clean up');
      }

      return result.changes;
    } catch (error) {
      throw new Error(`Failed to cleanup old receipts: ${error.message}`);
    }
  }

  /**
   * Get detailed statistics
   * 
   * @returns {Promise<Object>} - Detailed statistics
   */
  async getStats() {
    const queueStats = await this.getQueueStats();
    
    return {
      ...this.stats,
      ...queueStats,
      dbPath: this.dbPath,
      maxQueueSize: MAX_QUEUE_SIZE,
      maxUploadedAgeDays: MAX_UPLOADED_AGE_DAYS,
    };
  }

  /**
   * Validate receipt data
   * 
   * @param {Object} receipt - Receipt data
   * @throws {Error} - If validation fails
   */
  validateReceipt(receipt) {
    const required = ['barId'];
    
    for (const field of required) {
      if (!receipt[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate that either rawText or parsedData is provided
    if (!receipt.rawText && !receipt.parsedData) {
      throw new Error('Receipt must have either rawText or parsedData');
    }

    // Validate rawText is not empty if provided
    if (receipt.rawText !== null && receipt.rawText !== undefined) {
      if (typeof receipt.rawText !== 'string' || receipt.rawText.trim().length === 0) {
        throw new Error('Receipt rawText cannot be empty string');
      }
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close database connection
   */
  async close() {
    try {
      if (this.db) {
        this.db.close();
        console.log('🔒 SQLite queue database closed');
      }
    } catch (error) {
      console.error('❌ Error closing database:', error.message);
    }
  }
}

module.exports = QueueManager;
