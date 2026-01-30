/**
 * Health Monitor
 * Monitors service health and component status
 */

import { EventEmitter } from 'events';
import { LocalStore } from './local-store';
import { PrintMonitor } from './print-monitor';
import { SyncEngine } from './sync-engine';
import { Logger } from '../utils/logger';
import * as os from 'os';
import * as fs from 'fs';

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  uptime: number;
  components: {
    localStore: ComponentHealth;
    printMonitor: ComponentHealth;
    syncEngine: ComponentHealth;
    system: SystemHealth;
  };
  issues: HealthIssue[];
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  lastCheck: string;
  details: any;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface HealthIssue {
  component: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  details?: any;
}

export interface HealthMonitorConfig {
  localStore: LocalStore;
  printMonitor: PrintMonitor;
  syncEngine: SyncEngine;
}

export class HealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private logger = Logger.getInstance();
  private isRunning = false;
  private healthTimer: NodeJS.Timeout | null = null;
  private checkInterval = 60000; // 1 minute
  private lastHealthStatus: HealthStatus | null = null;

  constructor(config: HealthMonitorConfig) {
    super();
    this.config = config;
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.logger.info('Starting health monitor...');

    try {
      // Perform initial health check
      await this.performHealthCheck();
      
      // Start periodic health checks
      this.startPeriodicChecks();
      
      this.isRunning = true;
      this.logger.info('Health monitor started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start health monitor:', error);
      throw error;
    }
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping health monitor...');

    try {
      if (this.healthTimer) {
        clearInterval(this.healthTimer);
        this.healthTimer = null;
      }

      this.isRunning = false;
      this.logger.info('Health monitor stopped');
      this.emit('stopped');

    } catch (error) {
      this.logger.error('Error stopping health monitor:', error);
      throw error;
    }
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    this.healthTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, this.checkInterval);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const issues: HealthIssue[] = [];

    try {
      // Check each component
      const localStoreHealth = await this.checkLocalStore();
      const printMonitorHealth = await this.checkPrintMonitor();
      const syncEngineHealth = await this.checkSyncEngine();
      const systemHealth = await this.checkSystemHealth();

      // Collect issues
      if (localStoreHealth.status !== 'healthy') {
        issues.push({
          component: 'localStore',
          severity: localStoreHealth.status === 'critical' ? 'critical' : 'warning',
          message: 'Local storage issues detected',
          timestamp,
          details: localStoreHealth.details
        });
      }

      if (printMonitorHealth.status !== 'healthy') {
        issues.push({
          component: 'printMonitor',
          severity: printMonitorHealth.status === 'critical' ? 'critical' : 'warning',
          message: 'Print monitoring issues detected',
          timestamp,
          details: printMonitorHealth.details
        });
      }

      if (syncEngineHealth.status !== 'healthy') {
        issues.push({
          component: 'syncEngine',
          severity: syncEngineHealth.status === 'critical' ? 'critical' : 'warning',
          message: 'Sync engine issues detected',
          timestamp,
          details: syncEngineHealth.details
        });
      }

      if (systemHealth.status !== 'healthy') {
        issues.push({
          component: 'system',
          severity: systemHealth.status === 'critical' ? 'critical' : 'warning',
          message: 'System resource issues detected',
          timestamp,
          details: systemHealth
        });
      }

      // Determine overall status
      let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (issues.some(issue => issue.severity === 'critical')) {
        overallStatus = 'critical';
      } else if (issues.length > 0) {
        overallStatus = 'warning';
      }

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp,
        uptime: process.uptime(),
        components: {
          localStore: localStoreHealth,
          printMonitor: printMonitorHealth,
          syncEngine: syncEngineHealth,
          system: systemHealth
        },
        issues
      };

      // Store health status
      await this.storeHealthStatus(healthStatus);

      // Emit events if status changed
      if (!this.lastHealthStatus || this.lastHealthStatus.status !== overallStatus) {
        this.logger.info(`Health status changed: ${overallStatus}`, { issuesCount: issues.length });
        this.emit('health-status-changed', healthStatus);
      }

      this.lastHealthStatus = healthStatus;
      this.emit('health-check', healthStatus);

      return healthStatus;

    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Check local store health
   */
  private async checkLocalStore(): Promise<ComponentHealth> {
    const timestamp = new Date().toISOString();

    try {
      const status = this.config.localStore.getStatus();
      const stats = this.config.localStore.getStats();

      // Check for issues
      let componentStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!status.connected) {
        componentStatus = 'critical';
        issues.push('Database connection lost');
      }

      if (stats.pendingSync > 1000) {
        componentStatus = componentStatus === 'critical' ? 'critical' : 'warning';
        issues.push(`High pending sync count: ${stats.pendingSync}`);
      }

      if (stats.dbSize > 100 * 1024 * 1024) { // 100MB
        componentStatus = componentStatus === 'critical' ? 'critical' : 'warning';
        issues.push(`Large database size: ${Math.round(stats.dbSize / 1024 / 1024)}MB`);
      }

      return {
        status: componentStatus,
        lastCheck: timestamp,
        details: {
          connected: status.connected,
          stats,
          issues
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        lastCheck: timestamp,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check print monitor health
   */
  private async checkPrintMonitor(): Promise<ComponentHealth> {
    const timestamp = new Date().toISOString();

    try {
      const status = this.config.printMonitor.getStatus();

      let componentStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!status.isRunning) {
        componentStatus = 'critical';
        issues.push('Print monitor not running');
      }

      if (!status.directoryExists) {
        componentStatus = 'critical';
        issues.push('Print capture directory does not exist');
      }

      if (status.processingJobs > 10) {
        componentStatus = componentStatus === 'critical' ? 'critical' : 'warning';
        issues.push(`High processing job count: ${status.processingJobs}`);
      }

      return {
        status: componentStatus,
        lastCheck: timestamp,
        details: {
          ...status,
          issues
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        lastCheck: timestamp,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check sync engine health
   */
  private async checkSyncEngine(): Promise<ComponentHealth> {
    const timestamp = new Date().toISOString();

    try {
      const status = this.config.syncEngine.getStatus();
      const stats = this.config.syncEngine.getStats();

      let componentStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (!status.isRunning) {
        componentStatus = 'critical';
        issues.push('Sync engine not running');
      }

      if (!status.isOnline) {
        componentStatus = componentStatus === 'critical' ? 'critical' : 'warning';
        issues.push('Offline - no internet connection');
      }

      if (stats.queueSize > 100) {
        componentStatus = componentStatus === 'critical' ? 'critical' : 'warning';
        issues.push(`High sync queue size: ${stats.queueSize}`);
      }

      if (stats.totalFailed > stats.totalSynced * 0.1) { // More than 10% failure rate
        componentStatus = componentStatus === 'critical' ? 'critical' : 'warning';
        issues.push(`High sync failure rate: ${stats.totalFailed}/${stats.totalSynced + stats.totalFailed}`);
      }

      return {
        status: componentStatus,
        lastCheck: timestamp,
        details: {
          ...status,
          stats,
          issues
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        lastCheck: timestamp,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<SystemHealth> {
    try {
      // CPU usage (simplified)
      const loadAverage = os.loadavg();
      const cpuUsage = loadAverage[0] / os.cpus().length * 100;

      // Memory usage
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryPercentage = (usedMemory / totalMemory) * 100;

      // Disk usage (for data directory)
      const dataDirectory = process.env.ProgramData || 'C:\\ProgramData';
      let diskUsed = 0;
      let diskTotal = 0;
      let diskPercentage = 0;

      try {
        const stats = fs.statSync(dataDirectory);
        // This is a simplified approach - in production, you'd use a proper disk usage library
        diskUsed = stats.size || 0;
        diskTotal = 1024 * 1024 * 1024; // 1GB placeholder
        diskPercentage = (diskUsed / diskTotal) * 100;
      } catch (error) {
        // Ignore disk check errors
      }

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (cpuUsage > 90 || memoryPercentage > 90 || diskPercentage > 90) {
        status = 'critical';
      } else if (cpuUsage > 70 || memoryPercentage > 70 || diskPercentage > 70) {
        status = 'warning';
      }

      return {
        status,
        cpu: {
          usage: cpuUsage,
          loadAverage
        },
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: memoryPercentage
        },
        disk: {
          used: diskUsed,
          total: diskTotal,
          percentage: diskPercentage
        }
      };

    } catch (error) {
      return {
        status: 'critical',
        cpu: { usage: 0, loadAverage: [0, 0, 0] },
        memory: { used: 0, total: 0, percentage: 0 },
        disk: { used: 0, total: 0, percentage: 0 }
      };
    }
  }

  /**
   * Store health status in local database
   */
  private async storeHealthStatus(healthStatus: HealthStatus): Promise<void> {
    try {
      await this.config.localStore.addToSyncQueue({
        id: `health_${Date.now()}`,
        type: 'health',
        data: healthStatus,
        priority: 'low'
      });

      // Also log audit event for critical issues
      if (healthStatus.status === 'critical') {
        this.config.localStore.logAuditEvent({
          eventType: 'HEALTH_CRITICAL',
          data: {
            issues: healthStatus.issues,
            uptime: healthStatus.uptime
          }
        });
      }

    } catch (error) {
      this.logger.error('Failed to store health status:', error);
    }
  }

  /**
   * Get current health status
   */
  getCurrentHealth(): HealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * Get health monitor status
   */
  getStatus(): {
    isRunning: boolean;
    lastCheck?: string;
    checkInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastHealthStatus?.timestamp,
      checkInterval: this.checkInterval
    };
  }

  /**
   * Force immediate health check
   */
  async forceHealthCheck(): Promise<HealthStatus> {
    this.logger.info('Forcing immediate health check...');
    return await this.performHealthCheck();
  }
}