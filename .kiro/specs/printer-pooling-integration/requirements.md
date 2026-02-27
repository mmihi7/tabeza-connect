# Requirements Document: Printer Pooling Integration

## Introduction

This document specifies the requirements for integrating a simplified printer pooling capture mode into TabezaConnect. The pooling mode enables TabezaConnect to passively observe POS receipts by monitoring a single capture file that receives print data from a Windows printer pool. This approach maintains the core truth that the POS system is the authoritative source for orders while Tabeza provides digital receipt delivery and payment capabilities.

The system leverages Windows printer pooling to handle all printing operations, while TabezaConnect focuses solely on capturing, queuing, and uploading receipt data to the cloud. This separation of concerns ensures reliability and simplicity.

## Glossary

- **POS_System**: The point-of-sale system that creates financial orders and is the authoritative source for receipts
- **Printer_Pool**: Windows printer pooling feature that routes print jobs to multiple destinations (physical printer + capture file)
- **Capture_File**: The file (order.prn) that receives print data from the printer pool
- **SimpleCapture**: The TabezaConnect component that monitors the capture file and processes receipts
- **LocalQueue**: Persistent queue that stores receipts awaiting upload
- **UploadWorker**: Background service that uploads queued receipts to Tabeza Cloud with retry logic
- **Stability_Check**: Process of verifying a file has finished receiving data by checking size/modification time
- **Temp_Folder**: Directory where stable capture files are copied with unique timestamps
- **Receipt**: Digital representation of a POS receipt including ESC/POS bytes and metadata
- **TabezaConnect**: The Windows service that bridges POS systems with Tabeza Cloud

## Requirements

### Requirement 1: File Monitoring

**User Story:** As a bar owner, I want TabezaConnect to automatically detect when my POS prints a receipt, so that customers receive digital receipts without manual intervention.

#### Acceptance Criteria

1. WHEN TabezaConnect starts in pooling mode, THE SimpleCapture SHALL monitor the configured capture file for changes
2. WHEN the capture file is modified, THE SimpleCapture SHALL detect the change within 1 second
3. WHILE SimpleCapture is running, THE SimpleCapture SHALL continuously monitor the capture file without interruption
4. IF the capture file does not exist at startup, THEN THE SimpleCapture SHALL create an empty file at the configured path
5. WHEN the capture file path is invalid or inaccessible, THE SimpleCapture SHALL log an error and fail to start

### Requirement 2: File Stability Detection

**User Story:** As a system administrator, I want TabezaConnect to wait until a receipt file is completely written before processing it, so that partial or corrupted receipts are never uploaded.

#### Acceptance Criteria

1. WHEN a file change is detected, THE SimpleCapture SHALL perform stability checks before processing
2. THE SimpleCapture SHALL perform exactly 3 consecutive stability checks with 100ms delay between checks
3. WHEN file size and modification time remain unchanged across 3 consecutive checks, THE SimpleCapture SHALL consider the file stable
4. WHEN file size or modification time changes during stability checks, THE SimpleCapture SHALL reset the stability counter to 3
5. WHEN a file becomes stable, THE SimpleCapture SHALL process it exactly once
6. IF a file disappears during stability checks, THEN THE SimpleCapture SHALL cancel the stability check and log a warning

### Requirement 3: Receipt Capture and Storage

**User Story:** As a bar owner, I want each POS receipt to be captured and stored reliably, so that no customer receipts are lost even if the internet connection is temporarily unavailable.

#### Acceptance Criteria

1. WHEN a file is determined stable, THE SimpleCapture SHALL copy the file to the temp folder with a unique timestamp-based filename
2. THE SimpleCapture SHALL generate unique filenames using the format `capture_{timestamp}.prn` where timestamp is milliseconds since epoch
3. WHEN copying a file, THE SimpleCapture SHALL preserve the complete binary content without modification
4. THE SimpleCapture SHALL NOT delete or modify the original capture file after processing
5. WHEN a file is successfully copied, THE SimpleCapture SHALL create a receipt object containing bar ID, device ID, timestamp, and base64-encoded ESC/POS bytes
6. THE SimpleCapture SHALL enqueue each receipt to the LocalQueue immediately after creation
7. WHEN enqueueing fails, THE SimpleCapture SHALL log the error and increment the error counter

### Requirement 4: Queue Integration

**User Story:** As a system administrator, I want receipts to be queued persistently, so that they survive service restarts and are eventually uploaded even during network outages.

#### Acceptance Criteria

1. WHEN SimpleCapture starts, THE SimpleCapture SHALL verify that LocalQueue is initialized and operational
2. WHEN a receipt is enqueued, THE LocalQueue SHALL persist the receipt to disk immediately
3. THE LocalQueue SHALL return a unique receipt ID for each enqueued receipt
4. WHEN the service restarts, THE LocalQueue SHALL retain all previously enqueued receipts that have not been uploaded
5. THE UploadWorker SHALL dequeue receipts from LocalQueue independently of the capture process

### Requirement 5: Cloud Upload with Retry

**User Story:** As a bar owner, I want receipts to be uploaded to Tabeza Cloud reliably, so that customers receive their digital receipts even if there are temporary network issues.

#### Acceptance Criteria

1. THE UploadWorker SHALL process queued receipts in the order they were enqueued
2. WHEN uploading a receipt, THE UploadWorker SHALL send the receipt data to the configured Tabeza Cloud API endpoint
3. IF an upload fails, THEN THE UploadWorker SHALL retry with exponential backoff
4. WHEN a receipt is successfully uploaded, THE UploadWorker SHALL mark it as uploaded in the LocalQueue
5. THE UploadWorker SHALL operate independently of the SimpleCapture process
6. WHILE the service is running, THE UploadWorker SHALL continuously process queued receipts

### Requirement 6: Configuration Management

**User Story:** As a system administrator, I want to configure the pooling mode settings, so that I can adapt the system to different POS setups and file system layouts.

#### Acceptance Criteria

1. THE TabezaConnect SHALL support a `captureMode` configuration option with value `pooling`
2. WHEN captureMode is set to `pooling`, THE TabezaConnect SHALL start SimpleCapture instead of other capture modes
3. THE TabezaConnect SHALL read the capture file path from configuration with default value `C:\TabezaPrints\order.prn`
4. THE TabezaConnect SHALL read the temp folder path from configuration with default value `{watchFolder}\captures`
5. THE TabezaConnect SHALL read stability check count from configuration with default value 3
6. THE TabezaConnect SHALL read stability delay from configuration with default value 100ms
7. THE TabezaConnect SHALL read bar ID and device ID from configuration for receipt metadata
8. WHERE configuration values are missing, THE TabezaConnect SHALL use documented default values

### Requirement 7: Statistics and Monitoring

**User Story:** As a system administrator, I want to monitor the capture service status and statistics, so that I can verify it is working correctly and troubleshoot issues.

#### Acceptance Criteria

1. THE SimpleCapture SHALL maintain counters for files detected, files captured, files skipped, and errors
2. THE SimpleCapture SHALL record the timestamp of the last successful capture
3. THE SimpleCapture SHALL record the message of the last error encountered
4. WHEN the status API endpoint is called, THE TabezaConnect SHALL return current pooling statistics
5. THE SimpleCapture SHALL emit a `file-captured` event with receipt ID when a file is successfully captured
6. THE SimpleCapture SHALL emit an `error` event when an error occurs during capture
7. THE SimpleCapture SHALL emit a `started` event when file watching begins

### Requirement 8: Graceful Shutdown

**User Story:** As a system administrator, I want the service to shut down cleanly, so that no receipts are lost or corrupted during service restarts or system shutdowns.

#### Acceptance Criteria

1. WHEN a shutdown signal is received, THE SimpleCapture SHALL stop accepting new file change events
2. WHEN shutting down, THE SimpleCapture SHALL complete any in-progress stability checks before stopping
3. WHEN shutting down, THE SimpleCapture SHALL close the file watcher
4. WHEN shutting down, THE UploadWorker SHALL complete the current upload operation before stopping
5. WHEN shutting down, THE LocalQueue SHALL flush any pending writes to disk
6. THE TabezaConnect SHALL wait for all components to shut down gracefully before exiting
7. WHEN shutdown is complete, THE SimpleCapture SHALL emit a `stopped` event

### Requirement 9: Error Handling and Recovery

**User Story:** As a system administrator, I want the service to handle errors gracefully and recover automatically, so that temporary issues do not require manual intervention.

#### Acceptance Criteria

1. IF the capture file becomes temporarily inaccessible, THEN THE SimpleCapture SHALL log a warning and continue monitoring
2. IF the temp folder is not writable, THEN THE SimpleCapture SHALL fail to start with a clear error message
3. IF file copy operations fail, THEN THE SimpleCapture SHALL log the error, increment the error counter, and continue monitoring
4. IF LocalQueue is full, THEN THE SimpleCapture SHALL wait and retry enqueueing after a delay
5. WHEN file read errors occur during stability checks, THE SimpleCapture SHALL cancel the stability check and continue monitoring
6. THE SimpleCapture SHALL NOT crash or stop monitoring due to individual file processing errors

### Requirement 10: Receipt Data Format

**User Story:** As a cloud service developer, I want receipts to contain all necessary metadata and content, so that the cloud can parse and process them correctly.

#### Acceptance Criteria

1. THE SimpleCapture SHALL include bar ID in every receipt object
2. THE SimpleCapture SHALL include device ID in every receipt object
3. THE SimpleCapture SHALL include ISO 8601 timestamp in every receipt object
4. THE SimpleCapture SHALL include base64-encoded ESC/POS bytes in every receipt object
5. THE SimpleCapture SHALL include metadata with source type `pooling` in every receipt object
6. THE SimpleCapture SHALL include capture file name in receipt metadata
7. THE SimpleCapture SHALL include temp file name in receipt metadata
8. THE SimpleCapture SHALL include file size in bytes in receipt metadata
9. THE SimpleCapture SHALL set text field to null (cloud will parse ESC/POS bytes)

### Requirement 11: Service Integration

**User Story:** As a developer, I want the pooling mode to integrate seamlessly with existing TabezaConnect architecture, so that it works alongside other capture modes and shares common infrastructure.

#### Acceptance Criteria

1. WHEN captureMode is `pooling`, THE TabezaConnect SHALL initialize LocalQueue before starting SimpleCapture
2. WHEN captureMode is `pooling`, THE TabezaConnect SHALL initialize UploadWorker before starting SimpleCapture
3. THE TabezaConnect SHALL support multiple capture modes (pooling, spooler, bridge) with only one active at a time
4. THE SimpleCapture SHALL use the same LocalQueue implementation as other capture modes
5. THE SimpleCapture SHALL use the same UploadWorker implementation as other capture modes
6. THE TabezaConnect SHALL include pooling statistics in the status API response when pooling mode is active
7. WHEN SimpleCapture emits events, THE TabezaConnect SHALL log them appropriately

### Requirement 12: Windows Printer Pool Integration

**User Story:** As a bar owner, I want to use Windows printer pooling to send receipts to both my physical printer and TabezaConnect, so that I maintain my existing printing workflow while gaining digital receipt capabilities.

#### Acceptance Criteria

1. THE system documentation SHALL instruct users to configure a Windows printer pool named "Tabeza POS Connect"
2. THE system documentation SHALL instruct users to add their physical printer to the pool
3. THE system documentation SHALL instruct users to add a file printer targeting the capture file to the pool
4. THE POS_System SHALL print to the "Tabeza POS Connect" printer pool
5. THE Printer_Pool SHALL route print jobs to both the physical printer and the capture file simultaneously
6. THE SimpleCapture SHALL NOT interfere with Windows printer pool operations
7. THE SimpleCapture SHALL NOT depend on printer pool configuration (only monitors the capture file)

### Requirement 13: Performance and Resource Usage

**User Story:** As a system administrator, I want the capture service to use minimal system resources, so that it does not impact POS system performance.

#### Acceptance Criteria

1. THE SimpleCapture SHALL use native file system events for monitoring (not polling)
2. THE SimpleCapture SHALL perform stability checks with 100ms delays to minimize CPU usage
3. WHEN no file changes occur, THE SimpleCapture SHALL consume negligible CPU resources
4. THE SimpleCapture SHALL process typical receipts (under 10KB) in under 500ms from stability detection to enqueue
5. THE SimpleCapture SHALL clean up stability state objects after processing to prevent memory leaks
6. THE SimpleCapture SHALL limit temp folder size by relying on UploadWorker to process files promptly

### Requirement 14: Authority Model Compliance

**User Story:** As a product manager, I want the pooling mode to respect the core truth that POS is the authoritative source, so that the system maintains architectural consistency with Tabeza's design principles.

#### Acceptance Criteria

1. THE SimpleCapture SHALL operate in a purely passive observation mode
2. THE SimpleCapture SHALL NOT modify, delete, or interfere with POS print operations
3. THE SimpleCapture SHALL NOT create or author financial orders
4. THE SimpleCapture SHALL NOT validate or interpret receipt content (cloud handles parsing)
5. THE POS_System SHALL remain the sole authority for receipt content and financial data
6. THE SimpleCapture SHALL forward raw ESC/POS bytes to cloud without interpretation
7. THE system SHALL maintain the principle that manual service always exists alongside digital capture
