/**
 * Unit tests for Windows Print Spooler Monitor
 * 
 * Tests Requirements: 3.1, 3.2, 3.3
 */

const SpoolMonitor = require('../spoolMonitor');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

describe('SpoolMonitor', () => {
  let testSpoolPath;
  let monitor;
  
  beforeEach(async () => {
    // Create temporary test directory
    testSpoolPath = path.join(os.tmpdir(), `tabeza-test-spool-${Date.now()}`);
    await fs.mkdir(testSpoolPath, { recursive: true });
  });
  
  afterEach(async () => {
    // Stop monitor if running
    if (monitor && monitor.isRunning) {
      await monitor.stop();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testSpoolPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Initialization', () => {
    it('should create monitor with default options', () => {
      monitor = new SpoolMonitor();
      
      expect(monitor.spoolPath).toBe('C:\\Windows\\System32\\spool\\PRINTERS');
      expect(monitor.fileTypes).toEqual(['.SPL', '.SHD']);
      expect(monitor.isRunning).toBe(false);
    });
    
    it('should create monitor with custom options', () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL'],
        pollInterval: 2000,
        detectionLatency: 1000,
      });
      
      expect(monitor.spoolPath).toBe(testSpoolPath);
      expect(monitor.fileTypes).toEqual(['.SPL']);
      expect(monitor.pollInterval).toBe(2000);
      expect(monitor.detectionLatency).toBe(1000);
    });
  });
  
  describe('File Detection', () => {
    it('should detect new .SPL files within 500ms', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL', '.SHD'],
        pollInterval: 100,
      });
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create test file
      const startTime = Date.now();
      const testFile = path.join(testSpoolPath, 'test.SPL');
      await fs.writeFile(testFile, 'test data');
      
      // Wait for detection
      await waitFor(() => detected.mock.calls.length > 0, { timeout: 2000 });
      
      const detectionTime = Date.now() - startTime;
      expect(detectionTime).toBeLessThan(500);
      expect(detected).toHaveBeenCalledWith(testFile);
    });
    
    it('should detect new .SHD files', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL', '.SHD'],
        pollInterval: 100,
      });
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create test file
      const testFile = path.join(testSpoolPath, 'test.SHD');
      await fs.writeFile(testFile, 'test data');
      
      // Wait for detection
      await waitFor(() => detected.mock.calls.length > 0, { timeout: 2000 });
      
      expect(detected).toHaveBeenCalledWith(testFile);
    });
    
    it('should ignore non-spool files', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL', '.SHD'],
        pollInterval: 100,
      });
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create non-spool file
      const testFile = path.join(testSpoolPath, 'test.txt');
      await fs.writeFile(testFile, 'test data');
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(detected).not.toHaveBeenCalled();
    });
  });
  
  describe('Write Completion Detection', () => {
    it('should wait for file write completion before processing', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL'],
        pollInterval: 100,
      });
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create file and write data in chunks (simulating slow write)
      const testFile = path.join(testSpoolPath, 'test.SPL');
      const writeStream = fsSync.createWriteStream(testFile);
      
      writeStream.write('chunk1');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      writeStream.write('chunk2');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      writeStream.write('chunk3');
      writeStream.end();
      
      // Wait for detection (should happen after write completes)
      await waitFor(() => detected.mock.calls.length > 0, { timeout: 5000 });
      
      expect(detected).toHaveBeenCalledWith(testFile);
      
      // Verify file is complete
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('chunk1chunk2chunk3');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle permission denied errors gracefully', async () => {
      // Create monitor pointing to restricted directory
      monitor = new SpoolMonitor({
        spoolPath: 'C:\\Windows\\System32\\config', // Restricted directory
        fileTypes: ['.SPL'],
        pollInterval: 100,
      });
      
      // Should not throw, but should log error
      await expect(monitor.start()).resolves.not.toThrow();
      
      // Should fall back to polling mode
      expect(monitor.usePollingFallback).toBe(true);
    });
    
    it('should handle non-existent directory error', async () => {
      monitor = new SpoolMonitor({
        spoolPath: 'C:\\NonExistent\\Directory',
        fileTypes: ['.SPL'],
        pollInterval: 100,
      });
      
      // Should throw for non-existent directory
      await expect(monitor.start()).rejects.toThrow();
    });
    
    it('should continue monitoring after processing errors', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL'],
        pollInterval: 100,
      });
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create first file
      const testFile1 = path.join(testSpoolPath, 'test1.SPL');
      await fs.writeFile(testFile1, 'test data 1');
      
      await waitFor(() => detected.mock.calls.length > 0, { timeout: 2000 });
      
      // Create second file (should still be detected)
      const testFile2 = path.join(testSpoolPath, 'test2.SPL');
      await fs.writeFile(testFile2, 'test data 2');
      
      await waitFor(() => detected.mock.calls.length > 1, { timeout: 2000 });
      
      expect(detected).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Polling Fallback', () => {
    it('should use polling fallback if file watcher fails', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL'],
        pollInterval: 200,
      });
      
      // Force polling mode
      monitor.usePollingFallback = true;
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create test file
      const testFile = path.join(testSpoolPath, 'test.SPL');
      await fs.writeFile(testFile, 'test data');
      
      // Wait for detection (polling is slower)
      await waitFor(() => detected.mock.calls.length > 0, { timeout: 3000 });
      
      expect(detected).toHaveBeenCalledWith(testFile);
    });
  });
  
  describe('Statistics', () => {
    it('should track detection statistics', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL'],
        pollInterval: 100,
      });
      
      await monitor.start();
      
      // Create test files
      const testFile1 = path.join(testSpoolPath, 'test1.SPL');
      const testFile2 = path.join(testSpoolPath, 'test2.SPL');
      
      await fs.writeFile(testFile1, 'test data 1');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fs.writeFile(testFile2, 'test data 2');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const stats = monitor.getStats();
      
      expect(stats.filesDetected).toBeGreaterThanOrEqual(2);
      expect(stats.filesProcessed).toBeGreaterThanOrEqual(2);
      expect(stats.isRunning).toBe(true);
      expect(stats.lastDetection).toBeTruthy();
    });
  });
  
  describe('Duplicate Prevention', () => {
    it('should not process the same file twice', async () => {
      monitor = new SpoolMonitor({
        spoolPath: testSpoolPath,
        fileTypes: ['.SPL'],
        pollInterval: 100,
      });
      
      const detected = jest.fn();
      monitor.on('file-detected', detected);
      
      await monitor.start();
      
      // Create test file
      const testFile = path.join(testSpoolPath, 'test.SPL');
      await fs.writeFile(testFile, 'test data');
      
      // Wait for detection
      await waitFor(() => detected.mock.calls.length > 0, { timeout: 2000 });
      
      // Wait a bit more to ensure no duplicate detection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(detected).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper function to wait for condition
async function waitFor(condition, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}
