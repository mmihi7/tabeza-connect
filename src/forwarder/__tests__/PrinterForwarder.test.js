/**
 * Unit tests for PrinterForwarder base class
 * 
 * Tests configuration validation, retry logic, status tracking, and error handling.
 */

const PrinterForwarder = require('../PrinterForwarder');
const fs = require('fs').promises;
const path = require('path');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Concrete implementation for testing
class TestPrinterForwarder extends PrinterForwarder {
  constructor(config, logger, shouldFail = false) {
    super(config, logger);
    this.shouldFail = shouldFail;
    this.forwardAttempts = 0;
  }
  
  async forwardToDevice(rawBytes) {
    this.forwardAttempts++;
    if (this.shouldFail) {
      throw new Error('Simulated device error');
    }
    // Simulate successful forward
    return Promise.resolve();
  }
}

describe('PrinterForwarder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Configuration Validation', () => {
    test('should throw error if config is missing', () => {
      expect(() => new TestPrinterForwarder(null, mockLogger))
        .toThrow('Printer configuration is required');
    });
    
    test('should throw error if type is invalid', () => {
      expect(() => new TestPrinterForwarder({ type: 'invalid' }, mockLogger))
        .toThrow('Invalid printer type: invalid');
    });
    
    test('should throw error if network printer missing IP', () => {
      expect(() => new TestPrinterForwarder({ type: 'network' }, mockLogger))
        .toThrow('IP address is required for network printers');
    });
    
    test('should throw error if IP format is invalid', () => {
      expect(() => new TestPrinterForwarder({ 
        type: 'network', 
        ip: 'invalid-ip' 
      }, mockLogger))
        .toThrow('Invalid IP address format');
    });
    
    test('should throw error if USB printer missing port', () => {
      expect(() => new TestPrinterForwarder({ type: 'usb' }, mockLogger))
        .toThrow('Port is required for usb printers');
    });
    
    test('should accept valid USB configuration', () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      expect(forwarder.config.type).toBe('usb');
      expect(forwarder.config.port).toBe('COM3');
      expect(forwarder.config.timeout).toBe(5000); // default
    });
    
    test('should accept valid network configuration', () => {
      const forwarder = new TestPrinterForwarder({
        type: 'network',
        ip: '192.168.1.100'
      }, mockLogger);
      
      expect(forwarder.config.type).toBe('network');
      expect(forwarder.config.ip).toBe('192.168.1.100');
      expect(forwarder.config.networkPort).toBe(9100); // default
    });
    
    test('should apply custom timeout', () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3',
        timeout: 10000
      }, mockLogger);
      
      expect(forwarder.config.timeout).toBe(10000);
    });
  });
  
  describe('Forward Method', () => {
    test('should successfully forward data on first attempt', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger, false);
      
      const testData = Buffer.from('test data');
      await forwarder.forward(testData);
      
      expect(forwarder.forwardAttempts).toBe(1);
      expect(forwarder.status.online).toBe(true);
      expect(forwarder.status.totalForwarded).toBe(1);
      expect(forwarder.status.totalFailed).toBe(0);
      expect(forwarder.status.lastError).toBeNull();
    });
    
    test('should throw error if rawBytes is not a Buffer', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      await expect(forwarder.forward('not a buffer'))
        .rejects.toThrow('rawBytes must be a Buffer');
    });
    
    test('should throw error if rawBytes is empty', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      await expect(forwarder.forward(Buffer.alloc(0)))
        .rejects.toThrow('Cannot forward empty print job');
    });
    
    test('should update status on successful forward', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      const testData = Buffer.from('test data');
      await forwarder.forward(testData);
      
      const status = forwarder.getStatus();
      expect(status.online).toBe(true);
      expect(status.totalForwarded).toBe(1);
      expect(status.lastSuccess).toBeInstanceOf(Date);
    });
  });
  
  describe('Retry Logic', () => {
    test('should retry on failure with exponential backoff', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger, true); // Will always fail
      
      // Mock sleep to avoid waiting
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      // Mock saveFailedPrint to avoid file I/O
      forwarder.saveFailedPrint = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      await expect(forwarder.forward(testData))
        .rejects.toThrow('Failed to forward print job after 6 attempts');
      
      // Should attempt 6 times (initial + 5 retries)
      expect(forwarder.forwardAttempts).toBe(6);
      
      // Should call sleep with correct delays
      expect(forwarder.sleep).toHaveBeenCalledTimes(5); // No sleep on first attempt
      expect(forwarder.sleep).toHaveBeenNthCalledWith(1, 5000);
      expect(forwarder.sleep).toHaveBeenNthCalledWith(2, 10000);
      expect(forwarder.sleep).toHaveBeenNthCalledWith(3, 20000);
      expect(forwarder.sleep).toHaveBeenNthCalledWith(4, 40000);
      expect(forwarder.sleep).toHaveBeenNthCalledWith(5, 60000);
    });
    
    test('should succeed on retry after initial failures', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger, true);
      
      // Make it fail twice then succeed
      let attempts = 0;
      forwarder.forwardToDevice = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve();
      });
      
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      await forwarder.forward(testData);
      
      expect(forwarder.forwardToDevice).toHaveBeenCalledTimes(3);
      expect(forwarder.status.online).toBe(true);
      expect(forwarder.status.totalForwarded).toBe(1);
    });
    
    test('should update status on failure after all retries', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger, true);
      
      forwarder.sleep = jest.fn().mockResolvedValue();
      forwarder.saveFailedPrint = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      await expect(forwarder.forward(testData)).rejects.toThrow();
      
      const status = forwarder.getStatus();
      expect(status.online).toBe(false);
      expect(status.totalFailed).toBe(1);
      expect(status.lastError).toBe('Simulated device error');
    });
  });
  
  describe('Failed Print Handling', () => {
    test('should save failed print to disk', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger, true);
      
      forwarder.sleep = jest.fn().mockResolvedValue();
      
      // Mock file system operations
      const mkdirMock = jest.spyOn(fs, 'mkdir').mockResolvedValue();
      const writeFileMock = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      await expect(forwarder.forward(testData)).rejects.toThrow();
      
      // Should create directory
      expect(mkdirMock).toHaveBeenCalled();
      
      // Should write both .prn and .json files
      expect(writeFileMock).toHaveBeenCalledTimes(2);
      
      // Verify .prn file contains raw data
      const prnCall = writeFileMock.mock.calls.find(call => 
        call[0].endsWith('.prn')
      );
      expect(prnCall[1]).toEqual(testData);
      
      // Verify .json file contains metadata
      const jsonCall = writeFileMock.mock.calls.find(call => 
        call[0].endsWith('.json')
      );
      const metadata = JSON.parse(jsonCall[1]);
      expect(metadata.error).toBe('Simulated device error');
      expect(metadata.size).toBe(testData.length);
      
      mkdirMock.mockRestore();
      writeFileMock.mockRestore();
    });
  });
  
  describe('Status Tracking', () => {
    test('should return current status', () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      const status = forwarder.getStatus();
      
      expect(status).toHaveProperty('online');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('lastSuccess');
      expect(status).toHaveProperty('totalForwarded');
      expect(status).toHaveProperty('totalFailed');
    });
    
    test('should track multiple forwards', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      const testData = Buffer.from('test data');
      
      await forwarder.forward(testData);
      await forwarder.forward(testData);
      await forwarder.forward(testData);
      
      const status = forwarder.getStatus();
      expect(status.totalForwarded).toBe(3);
    });
  });
  
  describe('Close Method', () => {
    test('should call closeConnection if connection exists', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      forwarder.connection = {}; // Simulate connection
      forwarder.closeConnection = jest.fn().mockResolvedValue();
      
      await forwarder.close();
      
      expect(forwarder.closeConnection).toHaveBeenCalled();
    });
    
    test('should handle closeConnection errors gracefully', async () => {
      const forwarder = new TestPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      forwarder.connection = {};
      forwarder.closeConnection = jest.fn().mockRejectedValue(
        new Error('Close error')
      );
      
      // Should not throw
      await expect(forwarder.close()).resolves.toBeUndefined();
      
      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error closing printer connection',
        expect.objectContaining({ error: 'Close error' })
      );
    });
  });
});
