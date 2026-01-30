/**
 * Service Configuration
 * Manages all configuration for the TABEZA Printer Agent
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';

export interface ServiceConfigData {
  // Service identity
  serviceName: string;
  displayName: string;
  description: string;
  
  // Directories
  dataDirectory: string;
  logDirectory: string;
  printCaptureDirectory: string;
  
  // Cloud sync
  apiEndpoint: string;
  syncInterval: number;
  offlineRetentionDays: number;
  
  // Print monitoring
  monitorAllPrinters: boolean;
  excludedPrinters: string[];
  
  // Security
  encryptLocalData: boolean;
  requireTLS: boolean;
  
  // Performance
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  
  // Health monitoring
  healthCheckInterval: number;
  maxRestartAttempts: number;
}

export class ServiceConfig {
  private static instance: ServiceConfig;
  private config: ServiceConfigData;
  private logger = Logger.getInstance();

  private constructor(config: ServiceConfigData) {
    this.config = config;
  }

  /**
   * Load configuration from file or create default
   */
  static load(): ServiceConfig {
    if (ServiceConfig.instance) {
      return ServiceConfig.instance;
    }

    const configPath = path.join(
      process.env.ProgramData || 'C:\\ProgramData',
      'TABEZA',
      'config.json'
    );

    let config: ServiceConfigData;

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        config = { ...ServiceConfig.getDefaultConfig(), ...JSON.parse(configData) };
      } else {
        config = ServiceConfig.getDefaultConfig();
        ServiceConfig.saveConfig(config, configPath);
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      config = ServiceConfig.getDefaultConfig();
    }

    ServiceConfig.instance = new ServiceConfig(config);
    return ServiceConfig.instance;
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): ServiceConfigData {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const baseDir = path.join(programData, 'TABEZA');

    return {
      // Service identity
      serviceName: 'TabezaPrinterAgent',
      displayName: 'TABEZA Printer Agent',
      description: 'Captures and processes receipt data from POS systems',
      
      // Directories
      dataDirectory: path.join(baseDir, 'Data'),
      logDirectory: path.join(baseDir, 'Logs'),
      printCaptureDirectory: path.join(baseDir, 'PrintCapture'),
      
      // Cloud sync
      apiEndpoint: process.env.TABEZA_API_ENDPOINT || 'https://api.tabeza.com',
      syncInterval: 30000, // 30 seconds
      offlineRetentionDays: 30,
      
      // Print monitoring
      monitorAllPrinters: true,
      excludedPrinters: [
        'Microsoft Print to PDF',
        'Microsoft XPS Document Writer',
        'Fax'
      ],
      
      // Security
      encryptLocalData: true,
      requireTLS: true,
      
      // Performance
      maxConcurrentJobs: 10,
      jobTimeoutMs: 30000, // 30 seconds
      
      // Health monitoring
      healthCheckInterval: 60000, // 1 minute
      maxRestartAttempts: 3
    };
  }

  /**
   * Save configuration to file
   */
  private static saveConfig(config: ServiceConfigData, configPath: string): void {
    try {
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Get configuration value
   */
  get<K extends keyof ServiceConfigData>(key: K): ServiceConfigData[K] {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll(): ServiceConfigData {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  update(updates: Partial<ServiceConfigData>): void {
    this.config = { ...this.config, ...updates };
    
    // Save updated config
    const configPath = path.join(this.config.dataDirectory, '..', 'config.json');
    ServiceConfig.saveConfig(this.config, configPath);
    
    this.logger.info('Configuration updated', updates);
  }

  /**
   * Ensure all required directories exist
   */
  ensureDirectories(): void {
    const directories = [
      this.config.dataDirectory,
      this.config.logDirectory,
      this.config.printCaptureDirectory
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
    }
  }

  // Convenience getters
  get serviceName(): string { return this.config.serviceName; }
  get displayName(): string { return this.config.displayName; }
  get description(): string { return this.config.description; }
  get dataDirectory(): string { return this.config.dataDirectory; }
  get logDirectory(): string { return this.config.logDirectory; }
  get printCaptureDirectory(): string { return this.config.printCaptureDirectory; }
  get apiEndpoint(): string { return this.config.apiEndpoint; }
  get syncInterval(): number { return this.config.syncInterval; }
}