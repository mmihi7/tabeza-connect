/**
 * Integration tests for Printer Forwarder
 * 
 * Tests end-to-end printer forwarding scenarios including:
 * - Complete forward workflow
 * - Retry and recovery
 * - Failed print handling
 * - Status tracking across multiple operations
 */

const { createPrinterForwarder } = require('../index');
const fs = require('fs').promises;
const path = require('path');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Printer Forwarder Integration Tests', () => {
  let testDataDir;
  
  beforeAll(async () => {
    // Create test data directory
    testDataDir = path.join(__dirname, 'test-data');
    await fs.mkdir(testDataDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Clean up test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('End-to-End Forward Workflow', () => {
    test('should complete full forward cycle with USB printer', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      // Mock the device forward to succeed
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('ESC/POS test data');
      const metadata = {
        filename: 'test-receipt.prn',
        timestamp: new Date().toISOString()
      };
      
      await forwarder.forward(testData, metadata);
      
      // Verify forward was called
      expect(forwarder.forwardToDevice).toHaveBeenCalledWith(testData);
      
      // Verify status updated
      const status = forwarder.getStatus();
      expect(status.online).toBe(true);
      expect(status.totalForwarded).toBe(1);
      expect(status.totalFailed).toBe(0);
      expect(status.lastSuccess).toBeInstanceOf(Date);
      expect(status.lastError).toBeNull();
    });
    
    test('should complete full forward cycle with network printer', async () => {
      const forwarder = createPrinterForwarder({
        type: 'network',
        ip: '192.168.1.100'
      }, mockLogger);
      
      // Mock the device forward to succeed
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('ESC/POS test data');
      
      await forwarder.forward(testData);
      
      // Verify forward was called
      expect(forwarder.forwardToDevice).toHaveBeenCalledWith(testData);
      
      // Verify status updated
      const status = forwarder.getStatus();
      expect(status.online).toBe(true);
      expect(status.totalForwarded).toBe(1);
    });
  });
  
  describe('Retry and Recovery', () => {
    test('should retry and eventually succeed', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      // Mock to fail twice then succeed
      let attempts = 0;
      forwarder.forwardToDevice = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve();
      });
      
      // Mock sleep to avoid waiting
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      await forwarder.forward(testData);
      
      // Should have attempted 3 times
      expect(forwarder.forwardToDevice).toHaveBeenCalledTimes(3);
      
      // Should have slept twice (after first two failures)
      expect(forwarder.sleep).toHaveBeenCalledTimes(2);
      
      // Final status should be success
      const status = forwarder.getStatus();
      expect(status.online).toBe(true);
      expect(status.totalForwarded).toBe(1);
      expect(status.totalFailed).toBe(0);
    });
    
    test('should handle intermittent failures across multiple jobs', async () => {
      const forwarder = createPrinterForwarder({
        type: 'network',
        ip: '192.168.1.100'
      }, mockLogger);
      
      // Mock to alternate between success and failure
      let callCount = 0;
      forwarder.forwardToDevice = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Intermittent failure'));
        }
        return Promise.resolve();
      });
      
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      // First job - should succeed on first attempt
      await forwarder.forward(testData);
      expect(forwarder.getStatus().totalForwarded).toBe(1);
      
      // Second job - should fail on first attempt, succeed on retry
      await forwarder.forward(testData);
      expect(forwarder.getStatus().totalForwarded).toBe(2);
      
      // Third job - should succeed on first attempt
      await forwarder.forward(testData);
      expect(forwarder.getStatus().totalForwarded).toBe(3);
    });
  });
  
  describe('Failed Print Handling', () => {
    test('should save failed print after exhausting retries', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      // Override failed prints directory for testing
      forwarder.failedPrintsDir = testDataDir;
      
      // Mock to always fail
      forwarder.forwardToDevice = jest.fn().mockRejectedValue(
        new Error('Printer offline')
      );
      
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('failed print data');
      const metadata = {
        filename: 'failed-receipt.prn',
        timestamp: new Date().toISOString()
      };
      
      await expect(forwarder.forward(testData, metadata)).rejects.toThrow();
      
      // Verify status updated
      const status = forwarder.getStatus();
      expect(status.online).toBe(false);
      expect(status.totalFailed).toBe(1);
      expect(status.lastError).toBe('Printer offline');
      
      // Verify files were created
      const files = await fs.readdir(testDataDir);
      const prnFiles = files.filter(f => f.endsWith('.prn'));
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      expect(prnFiles.length).toBeGreaterThan(0);
      expect(jsonFiles.length).toBeGreaterThan(0);
      
      // Verify .prn file contains correct data
      const prnFile = path.join(testDataDir, prnFiles[0]);
      const savedData = await fs.readFile(prnFile);
      expect(savedData.equals(testData)).toBe(true);
      
      // Verify .json file contains metadata
      const jsonFile = path.join(testDataDir, jsonFiles[0]);
      const savedMetadata = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
      expect(savedMetadata.error).toBe('Printer offline');
      expect(savedMetadata.size).toBe(testData.length);
      expect(savedMetadata.printerConfig.type).toBe('usb');
    });
    
    test('should continue accepting new jobs after failure', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      forwarder.failedPrintsDir = testDataDir;
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      // First job fails
      forwarder.forwardToDevice = jest.fn().mockRejectedValue(
        new Error('Printer offline')
      );
      
      const testData = Buffer.from('test data');
      await expect(forwarder.forward(testData)).rejects.toThrow();
      
      expect(forwarder.getStatus().totalFailed).toBe(1);
      
      // Second job succeeds
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      
      await forwarder.forward(testData);
      
      const status = forwarder.getStatus();
      expect(status.totalForwarded).toBe(1);
      expect(status.totalFailed).toBe(1);
      expect(status.online).toBe(true);
    });
  });
  
  describe('Status Tracking Across Operations', () => {
    test('should accurately track multiple successful forwards', async () => {
      const forwarder = createPrinterForwarder({
        type: 'network',
        ip: '192.168.1.100'
      }, mockLogger);
      
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      // Forward 5 jobs
      for (let i = 0; i < 5; i++) {
        await forwarder.forward(testData);
      }
      
      const status = forwarder.getStatus();
      expect(status.totalForwarded).toBe(5);
      expect(status.totalFailed).toBe(0);
      expect(status.online).toBe(true);
    });
    
    test('should track mixed success and failure', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      forwarder.failedPrintsDir = testDataDir;
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      // 3 successful forwards
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      await forwarder.forward(testData);
      await forwarder.forward(testData);
      await forwarder.forward(testData);
      
      // 2 failed forwards
      forwarder.forwardToDevice = jest.fn().mockRejectedValue(
        new Error('Printer error')
      );
      await expect(forwarder.forward(testData)).rejects.toThrow();
      await expect(forwarder.forward(testData)).rejects.toThrow();
      
      // 1 more successful forward
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      await forwarder.forward(testData);
      
      const status = forwarder.getStatus();
      expect(status.totalForwarded).toBe(4);
      expect(status.totalFailed).toBe(2);
      expect(status.online).toBe(true); // Last operation was success
    });
  });
  
  describe('Connection Lifecycle', () => {
    test('should properly close connection after use', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      forwarder.closeConnection = jest.fn().mockResolvedValue();
      forwarder.connection = {}; // Simulate connection
      
      const testData = Buffer.from('test data');
      await forwarder.forward(testData);
      
      await forwarder.close();
      
      expect(forwarder.closeConnection).toHaveBeenCalled();
    });
  });
  
  describe('Large Data Handling', () => {
    test('should handle large print jobs', async () => {
      const forwarder = createPrinterForwarder({
        type: 'network',
        ip: '192.168.1.100'
      }, mockLogger);
      
      forwarder.forwardToDevice = jest.fn().mockResolvedValue();
      
      // Create 100KB test data
      const largeData = Buffer.alloc(100 * 1024, 'X');
      
      await forwarder.forward(largeData);
      
      expect(forwarder.forwardToDevice).toHaveBeenCalledWith(largeData);
      expect(forwarder.getStatus().totalForwarded).toBe(1);
    });
  });
  
  describe('Concurrent Operations', () => {
    test('should handle multiple concurrent forward requests', async () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      // Mock with delay to simulate real operation
      forwarder.forwardToDevice = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 50));
      });
      
      const testData = Buffer.from('test data');
      
      // Start 3 concurrent forwards
      const promises = [
        forwarder.forward(testData),
        forwarder.forward(testData),
        forwarder.forward(testData)
      ];
      
      await Promise.all(promises);
      
      const status = forwarder.getStatus();
      expect(status.totalForwarded).toBe(3);
    });
  });
});
