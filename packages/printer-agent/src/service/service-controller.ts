/**
 * Service Controller
 * Main orchestrator that manages all service components
 */

import { EventEmitter } from 'events';
import { PrintMonitor } from '../core/print-monitor';
import { ReceiptProcessor } from '../core/receipt-processor';
import { SessionManager } from '../core/session-manager';
import { LocalStore } from '../core/local-store';
import { SyncEngine } from '../core/sync-engine';
import { HealthMonitor } from '../core/health-monitor';
import { ServiceConfig } from '../config/service-config';
import { Logger } from '../utils/logger';

export class ServiceController extends EventEmitter {
  private config: ServiceConfig;
  private logger = Logger.getInstance();
  private isRunning = false;

  // Core components
  private localStore!: LocalStore;
  private sessionManager!: SessionManager;
  private receiptProcessor!: ReceiptProcessor;
  private printMonitor!: PrintMonitor;
  private syncEngine!: SyncEngine;
  private healthMonitor!: HealthMonitor;

  constructor(config: ServiceConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the service and all components
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Service is already running');
    }

    this.logger.info('Starting TABEZA Printer Agent service...');

    try {
      // 1. Initialize local storage
      this.logger.info('Initializing local storage...');
      this.localStore = new LocalStore(this.config.dataDirectory);
      await this.localStore.initialize();

      // 2. Initialize session manager
      this.logger.info('Initializing session manager...');
      this.sessionManager = new SessionManager(this.localStore);

      // 3. Initialize receipt processor
      this.logger.info('Initializing receipt processor...');
      this.receiptProcessor = new ReceiptProcessor(
        this.sessionManager,
        this.localStore
      );

      // 4. Initialize print monitor
      this.logger.info('Initializing print monitor...');
      this.printMonitor = new PrintMonitor(
        this.config.printCaptureDirectory,
        this.receiptProcessor
      );

      // 5. Initialize sync engine
      this.logger.info('Initializing sync engine...');
      this.syncEngine = new SyncEngine(
        this.localStore,
        this.config.apiEndpoint,
        this.config.syncInterval
      );

      // 6. Initialize health monitor
      this.logger.info('Initializing health monitor...');
      this.healthMonitor = new HealthMonitor({
        localStore: this.localStore,
        printMonitor: this.printMonitor,
        syncEngine: this.syncEngine
      });

      // 7. Start all components
      await this.startComponents();

      this.isRunning = true;
      this.logger.info('TABEZA Printer Agent service started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start service:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the service and all components
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping TABEZA Printer Agent service...');

    try {
      // Stop components in reverse order
      if (this.healthMonitor) {
        await this.healthMonitor.stop();
      }

      if (this.syncEngine) {
        await this.syncEngine.stop();
      }

      if (this.printMonitor) {
        await this.printMonitor.stop();
      }

      if (this.receiptProcessor) {
        await this.receiptProcessor.stop();
      }

      if (this.localStore) {
        await this.localStore.close();
      }

      this.isRunning = false;
      this.logger.info('TABEZA Printer Agent service stopped successfully');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping service:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    components: Record<string, any>;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      components: {
        localStore: this.localStore?.getStatus() || 'not initialized',
        printMonitor: this.printMonitor?.getStatus() || 'not initialized',
        syncEngine: this.syncEngine?.getStatus() || 'not initialized',
        healthMonitor: this.healthMonitor?.getStatus() || 'not initialized'
      },
      uptime: process.uptime()
    };
  }

  /**
   * Start all components
   */
  private async startComponents(): Promise<void> {
    // Start print monitoring
    await this.printMonitor.start();
    this.logger.info('Print monitor started');

    // Start sync engine
    await this.syncEngine.start();
    this.logger.info('Sync engine started');

    // Start health monitoring
    await this.healthMonitor.start();
    this.logger.info('Health monitor started');

    // Set up component event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers between components
   */
  private setupEventHandlers(): void {
    // Print monitor events
    this.printMonitor.on('job-captured', (jobData: any) => {
      this.logger.debug('Print job captured', { jobId: jobData.id });
    });

    this.printMonitor.on('error', (error: any) => {
      this.logger.error('Print monitor error:', error);
    });

    // Sync engine events
    this.syncEngine.on('sync-started', () => {
      this.logger.debug('Sync started');
    });

    this.syncEngine.on('sync-completed', (stats: any) => {
      this.logger.debug('Sync completed', stats);
    });

    this.syncEngine.on('sync-error', (error: any) => {
      this.logger.warn('Sync error (will retry):', error);
    });

    // Health monitor events
    this.healthMonitor.on('health-check', (status: any) => {
      if (status.status !== 'healthy') {
        this.logger.warn('Health check warning:', status);
      }
    });

    this.healthMonitor.on('component-failure', (component: any, error: any) => {
      this.logger.error(`Component failure: ${component}`, error);
      // Could implement auto-restart logic here
    });
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.localStore) {
        await this.localStore.close();
      }
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}