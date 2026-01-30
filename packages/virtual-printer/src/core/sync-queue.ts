/**
 * Sync & Offline Queue Manager
 * Handles intermittent connectivity common in African markets
 * Queues receipts for sync when connection is restored
 */

import { EventEmitter } from 'events';
import { CanonicalReceipt } from '../types/receipt';
import { ProcessedOutput } from './dual-output-manager';

export interface QueuedItem {
  id: string;
  type: 'receipt' | 'delivery' | 'compliance';
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  error?: string;
}

export interface SyncConfig {
  maxQueueSize: number;
  retryIntervals: number[]; // Retry intervals in seconds
  batchSize: number;
  connectionCheckInterval: number; // seconds
  priorityWeights: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface SyncStats {
  queueSize: number;
  pendingItems: number;
  failedItems: number;
  syncedToday: number;
  lastSyncAt?: string;
  connectionStatus: 'online' | 'offline' | 'checking';
  averageRetryTime: number;
}

export class SyncQueue extends EventEmitter {
  private config: SyncConfig;
  private queue: Map<string, QueuedItem> = new Map();
  private isOnline: boolean = false;
  private isSyncing: boolean = false;
  private connectionCheckTimer?: NodeJS.Timeout;
  private syncTimer?: NodeJS.Timeout;
  private stats: SyncStats;

  constructor(config: SyncConfig) {
    super();
    this.config = config;
    this.stats = {
      queueSize: 0,
      pendingItems: 0,
      failedItems: 0,
      syncedToday: 0,
      connectionStatus: 'checking',
      averageRetryTime: 0
    };

    this.startConnectionMonitoring();
  }

  /**
   * Add item to sync queue
   */
  async enqueue(
    type: 'receipt' | 'delivery' | 'compliance',
    data: any,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    // Check queue size limit
    if (this.queue.size >= this.config.maxQueueSize) {
      // Remove oldest low-priority items to make space
      this.cleanupQueue();
      
      if (this.queue.size >= this.config.maxQueueSize) {
        throw new Error('Sync queue is full. Cannot add more items.');
      }
    }

    const item: QueuedItem = {
      id: this.generateItemId(),
      type,
      data,
      priority,
      attempts: 0,
      maxAttempts: this.getMaxAttemptsForPriority(priority),
      createdAt: new Date().toISOString()
    };

    this.queue.set(item.id, item);
    this.updateStats();

    console.log(`Queued ${type} item with priority ${priority}: ${item.id}`);
    this.emit('item-queued', item);

    // Try immediate sync if online
    if (this.isOnline && !this.isSyncing) {
      this.startSync();
    }

    return item.id;
  }

  /**
   * Start connection monitoring
   */
  private startConnectionMonitoring(): void {
    this.connectionCheckTimer = setInterval(async () => {
      const wasOnline = this.isOnline;
      this.isOnline = await this.checkConnection();
      
      if (this.isOnline !== wasOnline) {
        this.stats.connectionStatus = this.isOnline ? 'online' : 'offline';
        console.log(`Connection status changed: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        this.emit('connection-changed', this.isOnline);

        // Start sync when coming back online
        if (this.isOnline && this.queue.size > 0 && !this.isSyncing) {
          console.log('Connection restored, starting sync...');
          this.startSync();
        }
      }
    }, this.config.connectionCheckInterval * 1000);

    // Initial connection check
    this.checkConnection().then(online => {
      this.isOnline = online;
      this.stats.connectionStatus = online ? 'online' : 'offline';
    });
  }

  /**
   * Check internet connection
   */
  private async checkConnection(): Promise<boolean> {
    try {
      // Try multiple endpoints for reliability
      const endpoints = [
        'https://www.google.com',
        'https://www.cloudflare.com',
        'https://1.1.1.1'
      ];

      const promises = endpoints.map(endpoint => 
        fetch(endpoint, { 
          method: 'HEAD', 
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
      );

      // If any endpoint responds, we're online
      await Promise.race(promises); // Use Promise.race instead of Promise.any for better compatibility
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start sync process
   */
  private async startSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline || this.queue.size === 0) {
      return;
    }

    this.isSyncing = true;
    console.log(`Starting sync process with ${this.queue.size} items in queue`);
    this.emit('sync-started');

    try {
      const batch = this.getNextBatch();
      
      for (const item of batch) {
        try {
          await this.syncItem(item);
          this.queue.delete(item.id);
          this.stats.syncedToday++;
          this.emit('item-synced', item);
        } catch (error) {
          await this.handleSyncError(item, error);
        }
      }

      this.updateStats();
      this.stats.lastSyncAt = new Date().toISOString();

      // Schedule next sync if there are more items
      if (this.queue.size > 0) {
        this.scheduleNextSync();
      }

    } catch (error) {
      console.error('Sync process error:', error);
      this.emit('sync-error', error);
    } finally {
      this.isSyncing = false;
      this.emit('sync-completed');
    }
  }

  /**
   * Get next batch of items to sync
   */
  private getNextBatch(): QueuedItem[] {
    const items = Array.from(this.queue.values());
    
    // Sort by priority and creation time
    items.sort((a, b) => {
      const priorityDiff = this.config.priorityWeights[b.priority] - this.config.priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Filter items ready for retry
    const readyItems = items.filter(item => {
      if (item.attempts === 0) return true;
      if (!item.nextRetryAt) return true;
      return new Date(item.nextRetryAt) <= new Date();
    });

    return readyItems.slice(0, this.config.batchSize);
  }

  /**
   * Sync individual item
   */
  private async syncItem(item: QueuedItem): Promise<void> {
    console.log(`Syncing ${item.type} item: ${item.id} (attempt ${item.attempts + 1})`);
    
    item.attempts++;
    item.lastAttemptAt = new Date().toISOString();

    switch (item.type) {
      case 'receipt':
        await this.syncReceipt(item.data);
        break;
      case 'delivery':
        await this.syncDelivery(item.data);
        break;
      case 'compliance':
        await this.syncCompliance(item.data);
        break;
      default:
        throw new Error(`Unknown sync item type: ${item.type}`);
    }
  }

  /**
   * Sync receipt to server
   */
  private async syncReceipt(receipt: CanonicalReceipt): Promise<void> {
    // In a real implementation, this would POST to the TABEZA API
    console.log(`Syncing receipt ${receipt.receipt_id} to server...`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Server temporarily unavailable');
    }
    
    console.log(`Receipt ${receipt.receipt_id} synced successfully`);
  }

  /**
   * Sync delivery status
   */
  private async syncDelivery(deliveryData: any): Promise<void> {
    console.log(`Syncing delivery data...`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log('Delivery data synced successfully');
  }

  /**
   * Sync compliance data
   */
  private async syncCompliance(complianceData: any): Promise<void> {
    console.log(`Syncing compliance data...`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    console.log('Compliance data synced successfully');
  }

  /**
   * Handle sync error
   */
  private async handleSyncError(item: QueuedItem, error: any): Promise<void> {
    console.error(`Sync failed for item ${item.id}:`, error);
    
    item.error = error instanceof Error ? error.message : 'Unknown error';

    if (item.attempts >= item.maxAttempts) {
      console.log(`Item ${item.id} exceeded max attempts, removing from queue`);
      this.queue.delete(item.id);
      this.stats.failedItems++;
      this.emit('item-failed', item);
    } else {
      // Schedule retry
      const retryDelay = this.getRetryDelay(item.attempts);
      item.nextRetryAt = new Date(Date.now() + retryDelay * 1000).toISOString();
      console.log(`Scheduling retry for item ${item.id} in ${retryDelay} seconds`);
      this.emit('item-retry-scheduled', item);
    }
  }

  /**
   * Get retry delay based on attempt number
   */
  private getRetryDelay(attempts: number): number {
    const index = Math.min(attempts - 1, this.config.retryIntervals.length - 1);
    return this.config.retryIntervals[index];
  }

  /**
   * Get max attempts based on priority
   */
  private getMaxAttemptsForPriority(priority: string): number {
    switch (priority) {
      case 'critical': return 10;
      case 'high': return 7;
      case 'medium': return 5;
      case 'low': return 3;
      default: return 5;
    }
  }

  /**
   * Schedule next sync
   */
  private scheduleNextSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Find the earliest retry time
    const items = Array.from(this.queue.values());
    const nextRetryTimes = items
      .map(item => item.nextRetryAt ? new Date(item.nextRetryAt).getTime() : Date.now())
      .filter(time => time > Date.now());

    if (nextRetryTimes.length > 0) {
      const nextRetryTime = Math.min(...nextRetryTimes);
      const delay = Math.max(1000, nextRetryTime - Date.now()); // At least 1 second

      this.syncTimer = setTimeout(() => {
        if (this.isOnline && !this.isSyncing) {
          this.startSync();
        }
      }, delay);

      console.log(`Next sync scheduled in ${Math.round(delay / 1000)} seconds`);
    }
  }

  /**
   * Clean up queue by removing old low-priority items
   */
  private cleanupQueue(): void {
    const items = Array.from(this.queue.values());
    
    // Remove failed low-priority items first
    const lowPriorityFailed = items
      .filter(item => item.priority === 'low' && item.attempts >= item.maxAttempts)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const item of lowPriorityFailed.slice(0, 10)) {
      this.queue.delete(item.id);
      console.log(`Cleaned up failed low-priority item: ${item.id}`);
    }

    // If still full, remove oldest low-priority items
    if (this.queue.size >= this.config.maxQueueSize) {
      const lowPriorityItems = items
        .filter(item => item.priority === 'low')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (const item of lowPriorityItems.slice(0, 5)) {
        this.queue.delete(item.id);
        console.log(`Cleaned up old low-priority item: ${item.id}`);
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const items = Array.from(this.queue.values());
    
    this.stats.queueSize = this.queue.size;
    this.stats.pendingItems = items.filter(item => item.attempts === 0).length;
    this.stats.failedItems = items.filter(item => item.attempts >= item.maxAttempts).length;
    
    // Calculate average retry time
    const retryTimes = items
      .filter(item => item.lastAttemptAt && item.createdAt)
      .map(item => new Date(item.lastAttemptAt!).getTime() - new Date(item.createdAt).getTime());
    
    this.stats.averageRetryTime = retryTimes.length > 0 
      ? retryTimes.reduce((sum, time) => sum + time, 0) / retryTimes.length / 1000
      : 0;
  }

  /**
   * Generate unique item ID
   */
  private generateItemId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `sq_${timestamp}_${random}`;
  }

  /**
   * Get queue statistics
   */
  getStats(): SyncStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get queue items
   */
  getQueueItems(): QueuedItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Remove item from queue
   */
  removeItem(itemId: string): boolean {
    const removed = this.queue.delete(itemId);
    if (removed) {
      this.updateStats();
      this.emit('item-removed', itemId);
    }
    return removed;
  }

  /**
   * Clear all items from queue
   */
  clearQueue(): void {
    const count = this.queue.size;
    this.queue.clear();
    this.updateStats();
    console.log(`Cleared ${count} items from sync queue`);
    this.emit('queue-cleared', count);
  }

  /**
   * Force sync now (if online)
   */
  async forcSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot force sync while offline');
    }
    
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    await this.startSync();
  }

  /**
   * Stop sync queue
   */
  stop(): void {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
    }
    
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    console.log('Sync queue stopped');
    this.emit('stopped');
  }
}

/**
 * Default sync configuration optimized for African connectivity
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxQueueSize: 1000,
  retryIntervals: [30, 60, 120, 300, 600, 1800, 3600], // 30s to 1h
  batchSize: 10,
  connectionCheckInterval: 30, // Check every 30 seconds
  priorityWeights: {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25
  }
};