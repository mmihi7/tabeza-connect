/**
 * Sync Engine
 * Handles offline-first cloud synchronization
 */

import { EventEmitter } from 'events';
import { LocalStore, SyncQueueItem } from './local-store';
import { Logger } from '../utils/logger';

export interface SyncStats {
  totalSynced: number;
  totalFailed: number;
  queueSize: number;
  lastSyncAt?: string;
  isOnline: boolean;
  syncInProgress: boolean;
}

export class SyncEngine extends EventEmitter {
  private localStore: LocalStore;
  private logger = Logger.getInstance();
  private apiEndpoint: string;
  private syncInterval: number;
  private isRunning = false;
  private syncInProgress = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private stats: SyncStats;

  constructor(localStore: LocalStore, apiEndpoint: string, syncInterval: number) {
    super();
    this.localStore = localStore;
    this.apiEndpoint = apiEndpoint;
    this.syncInterval = syncInterval;
    this.stats = {
      totalSynced: 0,
      totalFailed: 0,
      queueSize: 0,
      isOnline: false,
      syncInProgress: false
    };
  }

  /**
   * Start the sync engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.logger.info('Starting sync engine...', { 
      apiEndpoint: this.apiEndpoint,
      syncInterval: this.syncInterval 
    });

    try {
      // Check initial connectivity
      await this.checkConnectivity();
      
      // Start periodic sync
      this.startPeriodicSync();
      
      this.isRunning = true;
      this.logger.info('Sync engine started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start sync engine:', error);
      throw error;
    }
  }

  /**
   * Stop the sync engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping sync engine...');

    try {
      // Stop periodic sync
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }

      // Wait for current sync to complete
      while (this.syncInProgress) {
        this.logger.info('Waiting for sync to complete...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.isRunning = false;
      this.logger.info('Sync engine stopped');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping sync engine:', error);
      throw error;
    }
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        this.logger.error('Periodic sync failed:', error);
      }
    }, this.syncInterval);
  }

  /**
   * Perform synchronization
   */
  async performSync(): Promise<void> {
    if (this.syncInProgress) {
      this.logger.debug('Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    this.stats.syncInProgress = true;
    this.emit('sync-started');

    try {
      // Check connectivity first
      const isOnline = await this.checkConnectivity();
      if (!isOnline) {
        this.logger.debug('Offline, skipping sync');
        return;
      }

      // Get items to sync
      const items = this.localStore.getNextSyncItems(10);
      this.stats.queueSize = items.length;

      if (items.length === 0) {
        this.logger.debug('No items to sync');
        return;
      }

      this.logger.info(`Syncing ${items.length} items...`);

      // Process each item
      let syncedCount = 0;
      let failedCount = 0;

      for (const item of items) {
        try {
          await this.syncItem(item);
          this.localStore.updateSyncQueueItem(item.id, 'completed');
          syncedCount++;
          this.stats.totalSynced++;
          this.emit('item-synced', item);
        } catch (error) {
          this.logger.error('Failed to sync item:', error, { itemId: item.id });
          this.localStore.updateSyncQueueItem(item.id, 'failed');
          failedCount++;
          this.stats.totalFailed++;
        }
      }

      this.stats.lastSyncAt = new Date().toISOString();
      
      this.logger.info('Sync completed', { 
        synced: syncedCount, 
        failed: failedCount 
      });

      this.emit('sync-completed', { synced: syncedCount, failed: failedCount });

    } catch (error) {
      this.logger.error('Sync process failed:', error);
      this.emit('sync-error', error);
    } finally {
      this.syncInProgress = false;
      this.stats.syncInProgress = false;
    }
  }

  /**
   * Sync individual item to cloud
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const endpoint = this.getEndpointForItemType(item.type);
    const data = JSON.parse(item.data);

    this.logger.debug('Syncing item', { 
      itemId: item.id, 
      type: item.type, 
      endpoint 
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TABEZA_API_KEY || ''}`,
          'User-Agent': 'TABEZA-PrinterAgent/1.0.0'
        },
        body: JSON.stringify({
          id: item.id,
          type: item.type,
          data: data,
          timestamp: item.created_at,
          agent_version: '1.0.0'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { id?: string };
      this.logger.debug('Item synced successfully', { 
        itemId: item.id, 
        responseId: result.id 
      });

    } catch (error) {
      this.logger.error('Failed to sync item to cloud:', error, { itemId: item.id });
      throw error;
    }
  }

  /**
   * Get API endpoint for item type
   */
  private getEndpointForItemType(type: string): string {
    const baseUrl = this.apiEndpoint.replace(/\/$/, ''); // Remove trailing slash
    
    switch (type) {
      case 'receipt':
        return `${baseUrl}/api/printer-agent/receipts`;
      case 'session':
        return `${baseUrl}/api/printer-agent/sessions`;
      case 'health':
        return `${baseUrl}/api/printer-agent/health`;
      default:
        return `${baseUrl}/api/printer-agent/data`;
    }
  }

  /**
   * Check internet connectivity
   */
  private async checkConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.apiEndpoint}/health`, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const isOnline = response.ok;
      
      if (this.stats.isOnline !== isOnline) {
        this.stats.isOnline = isOnline;
        this.logger.info(`Connection status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        this.emit('connection-changed', isOnline);
      }

      return isOnline;

    } catch (error) {
      if (this.stats.isOnline) {
        this.stats.isOnline = false;
        this.logger.warn('Connection lost');
        this.emit('connection-changed', false);
      }
      return false;
    }
  }

  /**
   * Force immediate sync
   */
  async forceSync(): Promise<void> {
    this.logger.info('Forcing immediate sync...');
    await this.performSync();
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    // Update queue size
    const queueItems = this.localStore.getNextSyncItems(1000); // Get large batch to count
    this.stats.queueSize = queueItems.length;
    
    return { ...this.stats };
  }

  /**
   * Get sync engine status
   */
  getStatus(): {
    isRunning: boolean;
    isOnline: boolean;
    syncInProgress: boolean;
    stats: SyncStats;
  } {
    return {
      isRunning: this.isRunning,
      isOnline: this.stats.isOnline,
      syncInProgress: this.syncInProgress,
      stats: this.getStats()
    };
  }

  /**
   * Clean up old completed sync items
   */
  async cleanupOldItems(): Promise<number> {
    const cleaned = this.localStore.cleanupSyncQueue(7); // Clean items older than 7 days
    
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} old sync items`);
    }
    
    return cleaned;
  }

  /**
   * Retry failed sync items
   */
  async retryFailedItems(): Promise<void> {
    this.logger.info('Retrying failed sync items...');
    
    // Reset failed items to pending (with attempt limit)
    const failedItems = this.localStore.getNextSyncItems(100).filter(item => 
      item.status === 'failed' && item.attempts < 3
    );

    for (const item of failedItems) {
      this.localStore.updateSyncQueueItem(item.id, 'pending');
    }

    if (failedItems.length > 0) {
      this.logger.info(`Reset ${failedItems.length} failed items for retry`);
      await this.performSync();
    }
  }
}