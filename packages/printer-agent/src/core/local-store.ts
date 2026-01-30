/**
 * Local Store
 * SQLite-based local storage for receipt data and sync queue
 */

import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { Logger } from '../utils/logger';
import { CompleteReceiptSession } from '@tabeza/receipt-schema';

export interface StoredReceiptEvent {
  id: string;
  session_id: string;
  raw_data: Buffer;
  processed_data: string; // JSON
  captured_at: string;
  processed_at?: string;
  sync_status: 'pending' | 'synced' | 'failed';
  sync_attempts: number;
  last_sync_attempt?: string;
  error_message?: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'receipt' | 'session' | 'health';
  data: string; // JSON
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  attempts: number;
  last_attempt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class LocalStore {
  private db!: Database.Database; // Use definite assignment assertion
  private logger = Logger.getInstance();
  private dbPath: string;

  constructor(dataDirectory: string) {
    this.dbPath = path.join(dataDirectory, 'tabeza-agent.db');
    
    // Ensure directory exists
    if (!fs.existsSync(dataDirectory)) {
      fs.mkdirSync(dataDirectory, { recursive: true });
    }
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      
      await this.createTables();
      await this.createIndexes();
      
      this.logger.info('Local store initialized', { dbPath: this.dbPath });
    } catch (error) {
      this.logger.error('Failed to initialize local store:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    // Receipt events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipt_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        raw_data BLOB NOT NULL,
        processed_data TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        processed_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_attempts INTEGER NOT NULL DEFAULT 0,
        last_sync_attempt TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Receipt sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipt_sessions (
        id TEXT PRIMARY KEY,
        session_reference TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        session_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_attempts INTEGER NOT NULL DEFAULT 0,
        last_sync_attempt TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Sync queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `);

    // Audit log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        data TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    this.logger.info('Database tables created');
  }

  /**
   * Create database indexes
   */
  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_receipt_events_session_id ON receipt_events(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_receipt_events_sync_status ON receipt_events(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_receipt_events_captured_at ON receipt_events(captured_at)',
      'CREATE INDEX IF NOT EXISTS idx_receipt_sessions_status ON receipt_sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_receipt_sessions_sync_status ON receipt_sessions(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)'
    ];

    for (const indexSql of indexes) {
      this.db.exec(indexSql);
    }

    this.logger.info('Database indexes created');
  }

  /**
   * Store a receipt event
   */
  async storeReceiptEvent(event: {
    id: string;
    sessionId: string;
    rawData: Buffer;
    processedData: CompleteReceiptSession;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO receipt_events (
        id, session_id, raw_data, processed_data, captured_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        event.id,
        event.sessionId,
        event.rawData,
        JSON.stringify(event.processedData),
        new Date().toISOString()
      );

      this.logger.debug('Receipt event stored', { id: event.id, sessionId: event.sessionId });
    } catch (error) {
      this.logger.error('Failed to store receipt event:', error);
      throw error;
    }
  }

  /**
   * Get pending receipt events for sync
   */
  getPendingSyncEvents(limit: number = 50): StoredReceiptEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM receipt_events 
      WHERE sync_status = 'pending' OR sync_status = 'failed'
      ORDER BY captured_at ASC 
      LIMIT ?
    `);

    return stmt.all(limit) as StoredReceiptEvent[];
  }

  /**
   * Update sync status for receipt event
   */
  updateEventSyncStatus(
    eventId: string, 
    status: 'pending' | 'synced' | 'failed',
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE receipt_events 
      SET sync_status = ?, sync_attempts = sync_attempts + 1, 
          last_sync_attempt = ?, error_message = ?
      WHERE id = ?
    `);

    stmt.run(status, new Date().toISOString(), errorMessage || null, eventId);
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(item: {
    id: string;
    type: 'receipt' | 'session' | 'health';
    data: any;
    priority?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (id, type, data, priority)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      item.id,
      item.type,
      JSON.stringify(item.data),
      item.priority || 'medium'
    );

    this.logger.debug('Item added to sync queue', { id: item.id, type: item.type });
  }

  /**
   * Get next items from sync queue
   */
  getNextSyncItems(limit: number = 10): SyncQueueItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status = 'pending'
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at ASC
      LIMIT ?
    `);

    return stmt.all(limit) as SyncQueueItem[];
  }

  /**
   * Update sync queue item status
   */
  updateSyncQueueItem(
    itemId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): void {
    const stmt = this.db.prepare(`
      UPDATE sync_queue 
      SET status = ?, attempts = attempts + 1, last_attempt = ?
      WHERE id = ?
    `);

    stmt.run(status, new Date().toISOString(), itemId);
  }

  /**
   * Remove completed sync queue items
   */
  cleanupSyncQueue(olderThanDays: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const stmt = this.db.prepare(`
      DELETE FROM sync_queue 
      WHERE status = 'completed' AND created_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  /**
   * Log audit event
   */
  logAuditEvent(event: {
    eventType: string;
    entityId?: string;
    entityType?: string;
    data?: any;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (event_type, entity_id, entity_type, data)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      event.eventType,
      event.entityId || null,
      event.entityType || null,
      event.data ? JSON.stringify(event.data) : null
    );
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalEvents: number;
    pendingSync: number;
    syncedEvents: number;
    queueSize: number;
    dbSize: number;
  } {
    const totalEvents = this.db.prepare('SELECT COUNT(*) as count FROM receipt_events').get() as { count: number };
    const pendingSync = this.db.prepare('SELECT COUNT(*) as count FROM receipt_events WHERE sync_status = "pending"').get() as { count: number };
    const syncedEvents = this.db.prepare('SELECT COUNT(*) as count FROM receipt_events WHERE sync_status = "synced"').get() as { count: number };
    const queueSize = this.db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE status = "pending"').get() as { count: number };

    let dbSize = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      dbSize = stats.size;
    } catch (error) {
      this.logger.warn('Could not get database file size:', error);
    }

    return {
      totalEvents: totalEvents.count,
      pendingSync: pendingSync.count,
      syncedEvents: syncedEvents.count,
      queueSize: queueSize.count,
      dbSize
    };
  }

  /**
   * Get service status
   */
  getStatus(): { connected: boolean; stats: any } {
    try {
      const stats = this.getStats();
      return { connected: true, stats };
    } catch (error) {
      return { connected: false, stats: null };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.logger.info('Local store closed');
    }
  }
}