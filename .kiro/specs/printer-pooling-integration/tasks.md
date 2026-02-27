# Implementation Plan: Printer Pooling Integration

## Overview

This plan implements a simplified printer pooling capture mode for TabezaConnect. The implementation creates a new SimpleCapture class that monitors a single capture file (order.prn) written by a Windows printer pool, then integrates it into the existing TabezaConnect service architecture alongside LocalQueue and UploadWorker (both already implemented).

The implementation uses JavaScript (Node.js) to match the existing TabezaConnect codebase.

## Tasks

- [x] 1. Create SimpleCapture class
  - [x] 1.1 Implement core SimpleCapture class with file watching
    - Create `TabezaConnect/src/service/simpleCapture.js`
    - Implement constructor with configuration options (captureFile, tempFolder, localQueue, barId, deviceId, stabilityChecks, stabilityDelay)
    - Initialize EventEmitter for event handling
    - Initialize statistics tracking object
    - Add CORE TRUTH comment: "Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse."
    - _Requirements: 1.1, 1.3, 6.1, 6.3, 6.4, 6.5, 6.6, 6.7, 14.1, 14.2_
  
  - [x] 1.2 Implement file watching with chokidar
    - Implement `start()` method to initialize chokidar watcher
    - Create temp folder if it doesn't exist
    - Configure watcher to monitor captureFile with ignoreInitial: true
    - Register 'change' and 'error' event handlers
    - Emit 'started' event when watching begins
    - Create empty capture file if it doesn't exist at startup
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.7_
  
  - [x] 1.3 Implement file stability detection
    - Implement `handleFileChange(path)` method to initiate stability checks
    - Implement `checkFileStability(state)` method with 3-check algorithm
    - Track file size and modification time across checks
    - Reset counter to 3 if file changes during checks
    - Clear previous timeout when new change detected
    - Handle file disappearance during checks gracefully
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 1.4 Implement file capture and storage
    - Implement `processStableFile(filePath)` method
    - Generate unique timestamp-based filename (capture_{timestamp}.prn)
    - Copy file to temp folder preserving binary content
    - Do NOT delete or modify original capture file
    - Create receipt object with all required fields (barId, deviceId, timestamp, escposBytes, metadata)
    - Enqueue receipt to LocalQueue
    - Update statistics counters
    - Emit 'file-captured' event with receipt ID
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  
  - [x] 1.5 Implement graceful shutdown
    - Implement `stop()` method to close watcher
    - Clear all pending stability timeouts
    - Wait for in-progress stability checks to complete
    - Emit 'stopped' event
    - Set isRunning flag to false
    - _Requirements: 8.1, 8.2, 8.3, 8.7_
  
  - [x] 1.6 Implement statistics and monitoring
    - Implement `getStats()` method returning current statistics
    - Track filesDetected, filesCaptured, filesSkipped, errors counters
    - Track lastCapture timestamp
    - Track lastError message
    - Emit 'error' event when errors occur
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  
  - [x] 1.7 Implement error handling
    - Handle file read errors during stability checks
    - Handle temp folder write errors
    - Handle LocalQueue enqueue errors with retry logic
    - Log errors without crashing the service
    - Continue monitoring after individual file errors
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 2. Integrate SimpleCapture into main service
  - [x] 2.1 Add pooling mode detection to index.js
    - Import SimpleCapture class at top of file
    - Add global `simpleCapture` variable declaration
    - Modify `startWatcher()` to detect captureMode === 'pooling'
    - Add conditional branch for pooling mode initialization
    - _Requirements: 6.1, 6.2, 11.1, 11.3_
  
  - [x] 2.2 Implement pooling mode initialization
    - Create `startPoolingCapture()` async function
    - Read captureFile path from config with default 'C:\\TabezaPrints\\order.prn'
    - Read tempFolder path from config with default '{watchFolder}\\captures'
    - Initialize SimpleCapture with config values
    - Register event handlers for 'file-captured' and 'error' events
    - Call simpleCapture.start() and return instance
    - _Requirements: 6.3, 6.4, 6.8, 11.1, 11.2, 11.7_
  
  - [x] 2.3 Update status API endpoint
    - Modify `/api/status` route to include pooling statistics
    - Call simpleCapture.getStats() when pooling mode is active
    - Include pooling stats in response JSON
    - _Requirements: 7.4, 11.6_
  
  - [x] 2.4 Update shutdown function
    - Add simpleCapture shutdown logic to `shutdown()` function
    - Call simpleCapture.stop() if instance exists
    - Wait for graceful shutdown before proceeding
    - Set simpleCapture to null after stopping
    - _Requirements: 8.1, 8.6_

- [x] 3. Update configuration
  - [x] 3.1 Add pooling configuration to config.json
    - Add `captureMode: "pooling"` option to config schema
    - Add `pooling` configuration section with captureFile, tempFolder, stabilityChecks, stabilityDelay
    - Document default values in comments
    - Ensure backward compatibility with existing config
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8_

- [x] 4. Checkpoint - Ensure basic integration works
  - Manually test that SimpleCapture can be instantiated
  - Verify file watching starts without errors
  - Verify config.json is read correctly
  - Ask the user if questions arise

- [ ] 5. Create property-based tests
  - [ ]* 5.1 Write property test for file stability detection
    - **Property 1: Stable Files Processed Exactly Once**
    - **Validates: Requirements 2.3, 2.5**
    - Use fast-check to generate file change sequences
    - Verify stable files (3 identical checks) are processed exactly once
    - Verify unstable files are not processed
  
  - [ ]* 5.2 Write property test for file content preservation
    - **Property 2: File Content Preservation (Round-Trip)**
    - **Validates: Requirements 3.3**
    - Use fast-check to generate random binary data
    - Write to capture file, wait for processing
    - Verify temp file content matches original byte-for-byte
  
  - [ ]* 5.3 Write property test for unique filename generation
    - **Property 4: Unique Temp Filenames**
    - **Validates: Requirements 3.2**
    - Capture multiple files in rapid succession
    - Verify all generated temp filenames are unique
    - Check for timestamp collisions
  
  - [ ]* 5.4 Write property test for queue persistence
    - **Property 7: Queue Persistence (Round-Trip)**
    - **Validates: Requirements 4.2, 4.4**
    - Enqueue receipts, stop service, restart service
    - Verify all receipts are still in queue after restart
  
  - [ ]* 5.5 Write property test for FIFO ordering
    - **Property 8: FIFO Queue Ordering**
    - **Validates: Requirements 5.1**
    - Enqueue multiple receipts in specific order
    - Dequeue and verify order matches enqueue order
  
  - [ ]* 5.6 Write property test for upload retry
    - **Property 9: Upload Retry with Exponential Backoff**
    - **Validates: Requirements 5.3**
    - Mock upload failures
    - Verify retry attempts with increasing delays
    - Verify exponential backoff pattern
  
  - [ ]* 5.7 Write property test for statistics accuracy
    - **Property 11: Statistics Counter Accuracy**
    - **Validates: Requirements 7.1**
    - Perform sequence of capture operations
    - Verify counters match actual operation counts
  
  - [ ]* 5.8 Write property test for passive observation
    - **Property 14: Passive Observation Only**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4**
    - Monitor capture file during processing
    - Verify file is never modified or deleted
    - Verify only read and copy operations occur

- [ ] 6. Create integration tests
  - [ ]* 6.1 Write end-to-end integration test
    - Test complete flow: file change → capture → queue → upload
    - Mock Tabeza Cloud API endpoint
    - Write test data to capture file
    - Verify receipt appears in cloud
    - Verify temp file is created
    - Verify original file is preserved
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_
  
  - [ ]* 6.2 Write graceful shutdown integration test
    - Start capture service
    - Trigger file change during processing
    - Send shutdown signal
    - Verify current operation completes
    - Verify no data loss
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [ ]* 6.3 Write error recovery integration test
    - Test recovery from temp folder write errors
    - Test recovery from queue full errors
    - Test recovery from file disappearance
    - Verify service continues monitoring after errors
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 7. Create unit tests
  - [ ]* 7.1 Write unit tests for SimpleCapture constructor
    - Test initialization with valid config
    - Test initialization with missing required fields
    - Test default value application
  
  - [ ]* 7.2 Write unit tests for stability detection
    - Test 3-check stability algorithm
    - Test counter reset on file change
    - Test timeout clearing
    - Test file disappearance handling
  
  - [ ]* 7.3 Write unit tests for receipt creation
    - Test receipt object structure
    - Test base64 encoding of ESC/POS bytes
    - Test metadata inclusion
    - Test timestamp format (ISO 8601)
  
  - [ ]* 7.4 Write unit tests for statistics tracking
    - Test counter increments
    - Test timestamp updates
    - Test error tracking
    - Test getStats() return format

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all integration tests
  - Run all property-based tests
  - Verify no regressions in existing functionality
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- SimpleCapture class does not exist yet and must be created from scratch
- LocalQueue and UploadWorker are already implemented and functional
- All code will be written in JavaScript (Node.js) to match existing codebase
- Property tests validate universal correctness properties from design document
- Integration tests validate end-to-end workflows
- Unit tests validate individual component behavior
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
