# Agent System Component Specifications

## Overview

This document provides detailed specifications for the Windows agent system components, including Windows Service architecture, SQLite database schema and operations, and print spooler integration approach.

## Windows Service Architecture

### Service Lifecycle Management

#### WindowsService.ts
```typescript
interface WindowsServiceConfig {
  name: string;
  displayName: string;
  description: string;
  script: string;
  nodeOptions?: string[];
  env?: Record<string, string>;
  logOnAs?: {
    domain?: string;
    account: string;
    password: string;
  };
  dependencies?: string[];
  startType: 'auto' | 'manual' | 'disabled';
  recoveryActions?: {
    firstFailure: 'restart' | 'reboot' | 'none';
    secondFailure: 'restart' | 'reboot' | 'none';
    subsequentFailures: 'restart' | 'reboot' | 'none';
    resetPeriod: number; // seconds
    restartDelay: number; // milliseconds
  };
}

class WindowsService {
  private config: WindowsServiceConfig;
  private service: any; // node-windows Service instance
  
  constructor(config: WindowsServiceConfig);
  
  // Service lifecycle operations
  async install(): Promise<void>;
  async uninstall(): Promise<void>;
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async restart(): Promise<void>;
  
  // Service status and monitoring
  async getStatus(): Promise<ServiceStatus>;
  async isInstalled(): Promise<boolean>;
  async isRunning(): Promise<boolean>;
  
  // Event handling
  onInstall(callback: () => void): void;
  onUninstall(callback: () => void): void;
  onStart(callback: () => void): void;
  onStop(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  
  // Configuration management
  updateConfig(config: Partial<WindowsServiceConfig>): Promise<void>;
  getConfig(): WindowsServiceConfig;
}

interface ServiceStatus {
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'paused';
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
}
```

#### ServiceInstaller.ts
```typescript
interface InstallationOptions {
  force?: boolean;
  skipDependencyCheck?: boolean;
  createEventLogSource?: boolean;
  registerPerformanceCounters?: boolean;
  setupFirewallRules?: boolean;
}

class ServiceInstaller {
  private config: WindowsServiceConfig;
  
  constructor(config: WindowsServiceConfig);
  
  // Installation operations
  async install(options?: InstallationOptions): Promise<InstallationResult>;
  async uninstall(options?: { force?: boolean }): Promise<void>;
  async upgrade(newVersion: string): Promise<UpgradeResult>;
  
  // Pre-installation validation
  async validateEnvironment(): Promise<ValidationResult>;
  async checkDependencies(): Promise<DependencyCheckResult>;
  async checkPermissions(): Promise<PermissionCheckResult>;
  
  // Post-installation setup
  async setupEventLogSource(): Promise<void>;
  async registerPerformanceCounters(): Promise<void>;
  async setupFirewallRules(): Promise<void>;
  
  // Installation status
  async getInstallationInfo(): Promise<InstallationInfo>;
}

interface InstallationResult {
  success: boolean;
  serviceId: string;
  installPath: string;
  warnings: string[];
  errors: string[];
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  resolution?: string;
}
```

#### ServiceController.ts
```typescript
class ServiceController {
  private serviceName: string;
  
  constructor(serviceName: string);
  
  // Service control operations
  async start(timeout?: number): Promise<void>;
  async stop(timeout?: number): Promise<void>;
  async restart(timeout?: number): Promise<void>;
  async pause(): Promise<void>;
  async resume(): Promise<void>;
  
  // Service monitoring
  async getStatus(): Promise<ServiceStatus>;
  async getPerformanceCounters(): Promise<PerformanceCounters>;
  async getEventLogs(since?: Date): Promise<EventLogEntry[]>;
  
  // Service configuration
  async updateStartupType(type: 'auto' | 'manual' | 'disabled'): Promise<void>;
  async updateRecoveryOptions(options: RecoveryOptions): Promise<void>;
  async updateLogOnAccount(account: LogOnAccount): Promise<void>;
  
  // Health monitoring
  async performHealthCheck(): Promise<HealthCheckResult>;
  async collectDiagnostics(): Promise<DiagnosticsReport>;
}

interface PerformanceCounters {
  cpuUsage: number;
  memoryUsage: number;
  handleCount: number;
  threadCount: number;
  workingSet: number;
  privateBytes: number;
}

interface EventLogEntry {
  timestamp: Date;
  level: 'error' | 'warning' | 'information';
  source: string;
  eventId: number;
  message: string;
  details?: any;
}
```

## SQLite Database Schema and Operations

### Database Schema

```sql
-- Agent configuration and metadata
CREATE TABLE agent_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Print job capture and processing
CREATE TABLE print_jobs (
  id TEXT PRIMARY KEY,
  printer_name TEXT NOT NULL,
  job_name TEXT,
  document_name TEXT,
  raw_data BLOB NOT NULL,
  raw_data_size INTEGER NOT NULL,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_started_at DATETIME,
  processing_completed_at DATETIME,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Parsing results
  parsed_data TEXT, -- JSON string of parsed receipt data
  parsing_confidence REAL,
  parsing_method TEXT,
  parsing_version TEXT,
  
  -- Session correlation
  session_id TEXT,
  sequence_number INTEGER,
  
  -- Sync status
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'synced', 'failed'
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt DATETIME,
  sync_error TEXT,
  cloud_receipt_id TEXT,
  
  FOREIGN KEY (session_id) REFERENCES receipt_sessions(id)
);

-- Receipt session management
CREATE TABLE receipt_sessions (
  id TEXT PRIMARY KEY,
  printer_name TEXT NOT NULL,
  merchant_id TEXT,
  merchant_name TEXT,
  session_start DATETIME NOT NULL,
  session_end DATETIME,
  status TEXT DEFAULT 'open', -- 'open', 'closed', 'cancelled'
  table_number TEXT,
  customer_identifier TEXT,
  kra_pin TEXT,
  
  -- Totals and summary
  total_items INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0.0,
  tax_amount REAL DEFAULT 0.0,
  
  -- Sync status
  sync_status TEXT DEFAULT 'pending',
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt DATETIME,
  sync_error TEXT,
  cloud_session_id TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync queue for offline operations
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  data_type TEXT NOT NULL, -- 'receipt_session', 'receipt_event', 'health_status', 'config_update'
  operation TEXT NOT NULL, -- 'create', 'update', 'delete'
  payload TEXT NOT NULL, -- JSON string
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
  -- Scheduling
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Retry logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt DATETIME,
  next_attempt DATETIME,
  
  -- Status and error tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  error_message TEXT,
  error_code TEXT,
  
  -- Dependencies
  depends_on TEXT, -- Comma-separated list of sync_queue IDs
  
  -- Metadata
  metadata TEXT -- JSON string for additional context
);

-- Health monitoring and metrics
CREATE TABLE health_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,
  tags TEXT, -- JSON string of key-value pairs
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_health_metrics_name_time (metric_name, timestamp),
  INDEX idx_health_metrics_timestamp (timestamp)
);

-- Event log for audit and debugging
CREATE TABLE event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL, -- 'debug', 'info', 'warn', 'error', 'fatal'
  source TEXT NOT NULL, -- Component that generated the event
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT, -- JSON string with additional context
  
  -- Correlation
  session_id TEXT,
  job_id TEXT,
  sync_queue_id TEXT,
  
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_event_log_level_time (level, timestamp),
  INDEX idx_event_log_source_time (source, timestamp),
  INDEX idx_event_log_session (session_id),
  INDEX idx_event_log_job (job_id)
);

-- Schema version tracking
CREATE TABLE schema_versions (
  component TEXT PRIMARY KEY, -- 'database', 'receipt_schema', 'escpos_parser', etc.
  version TEXT NOT NULL,
  installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  migration_log TEXT -- JSON array of applied migrations
);

-- Backup metadata
CREATE TABLE backup_metadata (
  id TEXT PRIMARY KEY,
  backup_type TEXT NOT NULL, -- 'full', 'incremental', 'differential'
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  
  -- Backup content summary
  tables_included TEXT, -- JSON array of table names
  record_counts TEXT, -- JSON object with table -> count mapping
  
  -- Restoration info
  restored_at DATETIME,
  restoration_notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_print_jobs_status ON print_jobs(processing_status);
CREATE INDEX idx_print_jobs_sync ON print_jobs(sync_status);
CREATE INDEX idx_print_jobs_printer ON print_jobs(printer_name);
CREATE INDEX idx_print_jobs_captured ON print_jobs(captured_at);

CREATE INDEX idx_sessions_status ON receipt_sessions(status);
CREATE INDEX idx_sessions_sync ON receipt_sessions(sync_status);
CREATE INDEX idx_sessions_printer ON receipt_sessions(printer_name);
CREATE INDEX idx_sessions_start ON receipt_sessions(session_start);

CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_priority ON sync_queue(priority);
CREATE INDEX idx_sync_queue_scheduled ON sync_queue(scheduled_at);
CREATE INDEX idx_sync_queue_type ON sync_queue(data_type);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_receipt_sessions_timestamp 
  AFTER UPDATE ON receipt_sessions
  BEGIN
    UPDATE receipt_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Triggers for automatic cleanup
CREATE TRIGGER cleanup_old_event_logs
  AFTER INSERT ON event_log
  WHEN (SELECT COUNT(*) FROM event_log) > 10000
  BEGIN
    DELETE FROM event_log 
    WHERE timestamp < datetime('now', '-30 days')
    AND level NOT IN ('error', 'fatal');
  END;
```

### Database Operations

#### Database.ts
```typescript
interface DatabaseConfig {
  path: string;
  maxSize: number; // MB
  backupInterval: number; // milliseconds
  vacuumInterval: number; // milliseconds
  pragmas: Record<string, any>;
}

class Database {
  private db: sqlite3.Database;
  private config: DatabaseConfig;
  
  constructor(config: DatabaseConfig);
  
  // Connection management
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async isConnected(): boolean;
  
  // Transaction management
  async beginTransaction(): Promise<Transaction>;
  async executeInTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  
  // Query operations
  async query<T>(sql: string, params?: any[]): Promise<T[]>;
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  async execute(sql: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  
  // Batch operations
  async executeBatch(statements: BatchStatement[]): Promise<BatchResult>;
  
  // Schema management
  async getCurrentVersion(): Promise<string>;
  async applyMigrations(migrations: Migration[]): Promise<MigrationResult>;
  async validateSchema(): Promise<SchemaValidationResult>;
  
  // Maintenance operations
  async vacuum(): Promise<void>;
  async analyze(): Promise<void>;
  async checkIntegrity(): Promise<IntegrityCheckResult>;
  async getStatistics(): Promise<DatabaseStatistics>;
  
  // Backup and recovery
  async createBackup(path: string, type: BackupType): Promise<BackupResult>;
  async restoreFromBackup(path: string): Promise<RestoreResult>;
  
  // Performance monitoring
  async getQueryPlan(sql: string): Promise<QueryPlan>;
  async getSlowQueries(threshold: number): Promise<SlowQuery[]>;
}

interface Transaction {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

interface Migration {
  version: string;
  description: string;
  up: string;
  down: string;
}
```

## Print Spooler Integration Approach

### Print Spooler Monitoring

#### SpoolerMonitor.ts
```typescript
interface PrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  status: PrinterStatus;
  attributes: PrinterAttributes;
  location?: string;
  comment?: string;
}

interface PrintJobInfo {
  jobId: number;
  printerName: string;
  documentName: string;
  userName: string;
  status: JobStatus;
  priority: number;
  position: number;
  totalPages: number;
  pagesPrinted: number;
  submitted: Date;
  size: number; // bytes
}

class SpoolerMonitor {
  private monitoringInterval: number;
  private supportedPrinters: string[];
  private eventHandlers: Map<string, Function[]>;
  
  constructor(config: SpoolerMonitorConfig);
  
  // Monitoring lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async restart(): Promise<void>;
  isRunning(): boolean;
  
  // Printer discovery and management
  async discoverPrinters(): Promise<PrinterInfo[]>;
  async addPrinterToMonitoring(printerName: string): Promise<void>;
  async removePrinterFromMonitoring(printerName: string): Promise<void>;
  async updatePrinterList(): Promise<void>;
  
  // Job monitoring
  async getCurrentJobs(): Promise<PrintJobInfo[]>;
  async getJobHistory(since?: Date): Promise<PrintJobInfo[]>;
  async getJobDetails(jobId: number): Promise<PrintJobDetails>;
  
  // Event handling
  onJobSubmitted(handler: (job: PrintJobInfo) => void): void;
  onJobStarted(handler: (job: PrintJobInfo) => void): void;
  onJobCompleted(handler: (job: PrintJobInfo) => void): void;
  onJobDeleted(handler: (job: PrintJobInfo) => void): void;
  onJobError(handler: (job: PrintJobInfo, error: Error) => void): void;
  onPrinterAdded(handler: (printer: PrinterInfo) => void): void;
  onPrinterRemoved(handler: (printer: PrinterInfo) => void): void;
  onPrinterStatusChanged(handler: (printer: PrinterInfo) => void): void;
  
  // Configuration
  updateConfig(config: Partial<SpoolerMonitorConfig>): Promise<void>;
  getConfig(): SpoolerMonitorConfig;
}

interface SpoolerMonitorConfig {
  monitoringInterval: number;
  supportedPrinters: string[]; // Printer name patterns
  captureRawData: boolean;
  maxJobHistoryDays: number;
  enableJobFiltering: boolean;
  jobFilters: JobFilter[];
}

interface JobFilter {
  field: 'documentName' | 'userName' | 'printerName' | 'size';
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'greaterThan' | 'lessThan';
  value: string | number;
  action: 'include' | 'exclude';
}
```

#### PrintCapture.ts
```typescript
interface CaptureConfig {
  outputFormat: 'raw' | 'emf' | 'xps' | 'pdf';
  compressionLevel: number;
  maxFileSize: number; // MB
  tempDirectory: string;
  cleanupInterval: number; // milliseconds
}

class PrintCapture {
  private config: CaptureConfig;
  private activeCaptures: Map<number, CaptureSession>;
  
  constructor(config: CaptureConfig);
  
  // Capture operations
  async startCapture(jobId: number): Promise<CaptureSession>;
  async stopCapture(jobId: number): Promise<CaptureResult>;
  async getCaptureStatus(jobId: number): Promise<CaptureStatus>;
  
  // Data extraction
  async extractRawData(jobId: number): Promise<Buffer>;
  async extractMetadata(jobId: number): Promise<PrintJobMetadata>;
  async extractPreview(jobId: number): Promise<Buffer>; // PNG image
  
  // Format conversion
  async convertToText(rawData: Buffer): Promise<string>;
  async convertToImage(rawData: Buffer): Promise<Buffer>;
  async convertToPDF(rawData: Buffer): Promise<Buffer>;
  
  // Cleanup and maintenance
  async cleanupTempFiles(): Promise<void>;
  async compressOldCaptures(): Promise<void>;
  async validateCaptureIntegrity(captureId: string): Promise<boolean>;
}

interface CaptureSession {
  jobId: number;
  sessionId: string;
  startTime: Date;
  printerName: string;
  documentName: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  tempFilePath?: string;
  dataSize: number;
  error?: Error;
}

interface CaptureResult {
  sessionId: string;
  success: boolean;
  dataPath: string;
  dataSize: number;
  format: string;
  checksum: string;
  metadata: PrintJobMetadata;
  error?: Error;
}

interface PrintJobMetadata {
  jobId: number;
  printerName: string;
  documentName: string;
  userName: string;
  submittedAt: Date;
  completedAt?: Date;
  totalPages: number;
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  colorMode: 'color' | 'grayscale' | 'monochrome';
  resolution: { x: number; y: number };
  driverVersion: string;
}
```

#### PrinterDriver.ts
```typescript
interface DriverCapabilities {
  supportedFormats: string[];
  maxResolution: { x: number; y: number };
  colorSupport: boolean;
  duplexSupport: boolean;
  paperSizes: string[];
  customPaperSupport: boolean;
}

class PrinterDriver {
  private printerName: string;
  private driverInfo: DriverInfo;
  
  constructor(printerName: string);
  
  // Driver information
  async getDriverInfo(): Promise<DriverInfo>;
  async getCapabilities(): Promise<DriverCapabilities>;
  async getStatus(): Promise<PrinterStatus>;
  
  // Communication
  async sendCommand(command: string): Promise<string>;
  async sendRawData(data: Buffer): Promise<void>;
  async queryStatus(): Promise<PrinterStatusDetails>;
  
  // Configuration
  async getConfiguration(): Promise<PrinterConfiguration>;
  async updateConfiguration(config: Partial<PrinterConfiguration>): Promise<void>;
  async resetToDefaults(): Promise<void>;
  
  // Maintenance
  async performSelfTest(): Promise<SelfTestResult>;
  async cleanPrintHeads(): Promise<void>;
  async calibrate(): Promise<CalibrationResult>;
  
  // Error handling
  async getLastError(): Promise<PrinterError>;
  async clearErrors(): Promise<void>;
  async getDiagnostics(): Promise<DiagnosticsInfo>;
}

interface DriverInfo {
  name: string;
  version: string;
  manufacturer: string;
  model: string;
  installDate: Date;
  driverPath: string;
  configFile?: string;
}

interface PrinterStatus {
  online: boolean;
  ready: boolean;
  printing: boolean;
  error: boolean;
  warning: boolean;
  paperOut: boolean;
  tonerLow: boolean;
  doorOpen: boolean;
  jammed: boolean;
}

interface PrinterConfiguration {
  defaultPaperSize: string;
  defaultOrientation: 'portrait' | 'landscape';
  defaultResolution: { x: number; y: number };
  defaultColorMode: 'color' | 'grayscale' | 'monochrome';
  duplexEnabled: boolean;
  collationEnabled: boolean;
  stapling: boolean;
  punching: boolean;
}
```

#### JobQueue.ts
```typescript
interface QueuedJob {
  id: string;
  printJobId: number;
  printerName: string;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  submittedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  error?: Error;
  metadata: any;
}

class JobQueue {
  private queue: PriorityQueue<QueuedJob>;
  private processing: Map<string, QueuedJob>;
  private maxConcurrentJobs: number;
  
  constructor(config: JobQueueConfig);
  
  // Queue management
  async enqueue(job: Omit<QueuedJob, 'id' | 'status' | 'submittedAt'>): Promise<string>;
  async dequeue(): Promise<QueuedJob | null>;
  async peek(): Promise<QueuedJob | null>;
  async remove(jobId: string): Promise<boolean>;
  
  // Job processing
  async processNext(): Promise<void>;
  async processJob(job: QueuedJob): Promise<void>;
  async retryJob(jobId: string): Promise<void>;
  async cancelJob(jobId: string): Promise<void>;
  
  // Queue status
  async getQueueSize(): Promise<number>;
  async getProcessingCount(): Promise<number>;
  async getJobStatus(jobId: string): Promise<QueuedJob | null>;
  async getQueueStats(): Promise<QueueStats>;
  
  // Queue maintenance
  async cleanupCompletedJobs(olderThan: Date): Promise<number>;
  async reprocessFailedJobs(): Promise<number>;
  async validateQueueIntegrity(): Promise<ValidationResult>;
  
  // Event handling
  onJobQueued(handler: (job: QueuedJob) => void): void;
  onJobStarted(handler: (job: QueuedJob) => void): void;
  onJobCompleted(handler: (job: QueuedJob) => void): void;
  onJobFailed(handler: (job: QueuedJob, error: Error) => void): void;
  onJobCancelled(handler: (job: QueuedJob) => void): void;
}

interface JobQueueConfig {
  maxConcurrentJobs: number;
  maxQueueSize: number;
  defaultPriority: number;
  retryDelayMs: number;
  maxRetries: number;
  cleanupInterval: number;
  persistQueue: boolean;
  queueFilePath?: string;
}

interface QueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;
  averageProcessingTime: number;
  throughputPerHour: number;
  errorRate: number;
}
```

## Integration Architecture

### Component Interaction Flow

1. **Service Startup**:
   - WindowsService initializes and registers with Windows Service Manager
   - Database connection established and schema validated
   - SpoolerMonitor starts monitoring configured printers
   - SyncManager initializes and begins health checks with cloud system

2. **Print Job Processing**:
   - SpoolerMonitor detects new print job
   - PrintCapture extracts raw print data
   - JobQueue enqueues job for processing
   - ReceiptProcessor parses data using pure logic packages
   - Database stores processed receipt data
   - SyncManager queues data for cloud synchronization

3. **Cloud Synchronization**:
   - SyncManager processes queue based on priority
   - CloudApiClient sends data to cloud system
   - Retry logic handles temporary failures
   - Database updated with sync status

4. **Health Monitoring**:
   - HealthMonitor collects system metrics
   - DiagnosticsCollector gathers diagnostic information
   - MetricsReporter sends health data to cloud system
   - RecoveryManager handles automatic recovery procedures

5. **Schema Management**:
   - SchemaConsumer checks for package updates
   - VersionChecker validates compatibility
   - MigrationExecutor applies necessary migrations
   - UpdateManager handles automatic updates (if enabled)

This architecture ensures robust, scalable, and maintainable Windows agent system that integrates seamlessly with the cloud system while maintaining complete operational independence.