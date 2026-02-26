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

const sqlite3 = require('sqlite3').verbose();
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
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Enable WAL mode for concurrent access
          this.db.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) {
              reject(err);
            } else {
              // Enable foreign keys
              this.db.run('PRAGMA foreign_keys = ON;', (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  /**
   * Create database schema with receipts table and indexes
   */
  async createSchema() {
    return new Promise((resolve, reject) => {
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

      this.db.run(createTableSQL, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create indexes for efficient querying
        const indexes = [
          'CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);',
          'CREATE INDEX IF NOT EXISTS idx_receipts_captured_at ON receipts(capturedAt);',
          'CREATE INDEX IF NOT EXISTS idx_receipts_bar_id ON receipts(barId);',
          'CREATE INDEX IF NOT EXISTS idx_receipts_retry_count ON receipts(retryCount);',
          'CREATE INDEX IF NOT EXISTS idx_receipts_status_captured_at ON receipts(status, capturedAt);'
        ];

        let completed = 0;
        const total = indexes.length;

        indexes.forEach((indexSQL, i) => {
          this.db.run(indexSQL, (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            completed++;
            if (completed === total) {
              resolve();
            }
          });
        });
      });
    });
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
    return new Promise((resolve, reject) => {
      // Validate required fields
      this.validateReceipt(receipt);
      
      // Generate unique ID
      const receiptId = this.generateId();
      
      // Check queue size limit
      this.getQueueSize().then(size => {
        if (size >= MAX_QUEUE_SIZE) {
          reject(new Error(`Queue size limit reached (${MAX_QUEUE_SIZE}). Cannot add new receipts.`));
          return;
        }

        const sql = `
          INSERT INTO receipts (
            id, barId, rawText, parsedData, status, retryCount, capturedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
          receiptId,
          receipt.barId,
          receipt.rawText || null,
          receipt.parsedData ? JSON.stringify(receipt.parsedData) : null,
          'pending',
          0,
          receipt.capturedAt || new Date().toISOString()
        ];

        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
            return;
          }

          // Update statistics
          this.stats.enqueued++;
          this.stats.lastEnqueue = new Date().toISOString();

          console.log(`✅ Receipt added to queue: ${receiptId}`);
          resolve(receiptId);
        }.bind(this));
      }).catch(reject);
    });
  }

  /**
   * Get pending receipts for upload
   * 
   * @param {number} limit - Maximum number of receipts to return
   * @returns {Promise<Array>} - Array of pending receipts
   */
  async getPending(limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM receipts 
        WHERE status = 'pending' 
        ORDER BY capturedAt ASC 
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // Parse JSON fields
        const receipts = rows.map(row => ({
          ...row,
          parsedData: row.parsedData ? JSON.parse(row.parsedData) : null
        }));

        resolve(receipts);
      });
    });
  }

  /**
   * Mark a receipt as uploaded
   * 
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<void>}
   */
  async markUploaded(receiptId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE receipts 
        SET status = 'uploaded', 
            uploadedAt = CURRENT_TIMESTAMP,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [receiptId], function(err) {
        if (err) {
          reject(err);
          return;
        }

        if (this.changes === 0) {
          console.warn(`⚠️  Receipt ${receiptId} not found in queue`);
          resolve();
          return;
        }

        // Update statistics
        this.stats.uploaded++;

        console.log(`✅ Receipt marked as uploaded: ${receiptId}`);
        resolve();
      }.bind(this));
    });
  }

  /**
   * Mark a receipt as failed
   * 
   * @param {string} receiptId - Receipt ID
   * @param {string} error - Error message
   * @returns {Promise<void>}
   */
  async markFailed(receiptId, error = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE receipts 
        SET status = 'failed',
            lastUploadAttempt = CURRENT_TIMESTAMP,
            lastUploadError = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [error, receiptId], function(err) {
        if (err) {
          reject(err);
          return;
        }

        if (this.changes === 0) {
          console.warn(`⚠️  Receipt ${receiptId} not found in queue`);
          resolve();
          return;
        }

        // Update statistics
        this.stats.failed++;

        console.log(`❌ Receipt marked as failed: ${receiptId}`);
        resolve();
      }.bind(this));
    });
  }

  /**
   * Increment retry count for a receipt
   * 
   * @param {string} receiptId - Receipt ID
   * @returns {Promise<void>}
   */
  async incrementRetry(receiptId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE receipts 
        SET retryCount = retryCount + 1,
            lastUploadAttempt = CURRENT_TIMESTAMP,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(sql, [receiptId], function(err) {
        if (err) {
          reject(err);
          return;
        }

        if (this.changes === 0) {
          console.warn(`⚠️  Receipt ${receiptId} not found in queue`);
          resolve();
          return;
        }

        resolve();
      });
    });
  }

  /**
   * Get queue statistics
   * 
   * @returns {Promise<Object>} - Queue statistics
   */
  async getQueueStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          status,
          COUNT(*) as count
        FROM receipts 
        GROUP BY status
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

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

        resolve(stats);
      });
    });
  }

  /**
   * Get current queue size (pending receipts)
   * 
   * @returns {Promise<number>}
   */
  async getQueueSize() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM receipts WHERE status = "pending"';
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(row.count);
      });
    });
  }

  /**
   * Cleanup old uploaded receipts
   * Removes uploaded receipts older than MAX_UPLOADED_AGE_DAYS
   * 
   * @returns {Promise<number>} - Number of receipts cleaned up
   */
  async cleanup() {
    return new Promise((resolve, reject) => {
      console.log('🧹 Cleaning up old uploaded receipts...');
      
      const sql = `
        DELETE FROM receipts 
        WHERE status = 'uploaded' 
        AND uploadedAt < datetime('now', '-${MAX_UPLOADED_AGE_DAYS} days')
      `;

      this.db.run(sql, [], function(err) {
        if (err) {
          reject(err);
          return;
        }

        // Update statistics
        this.stats.cleanedUp += this.changes;
        this.stats.lastCleanup = new Date().toISOString();

        if (this.changes > 0) {
          console.log(`✅ Cleaned up ${this.changes} old uploaded receipts`);
        } else {
          console.log('✅ No old receipts to clean up');
        }

        resolve(this.changes);
      }.bind(this));
    });
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
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('🔒 SQLite queue database closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = QueueManager;
