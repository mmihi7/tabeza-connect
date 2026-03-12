/**
 * Unit tests for USBPrinterForwarder
 * 
 * Tests USB/serial port communication with mocked serialport library.
 */

const USBPrinterForwarder = require('../USBPrinterForwarder');

// Mock serialport
jest.mock('serialport', () => {
  const EventEmitter = require('events');
  
  class MockSerialPort extends EventEmitter {
    constructor(options) {
      super();
      this.path = options.path;
      this.baudRate = options.baudRate;
      this.isOpen = false;
      this._shouldFailOpen = MockSerialPort._shouldFailOpen;
      this._shouldFailWrite = MockSerialPort._shouldFailWrite;
    }
    
    open(callback) {
      setTimeout(() => {
        if (this._shouldFailOpen) {
          callback(new Error('Failed to open port'));
        } else {
          this.isOpen = true;
          callback(null);
        }
      }, 10);
    }
    
    write(data, callback) {
      setTimeout(() => {
        if (this._shouldFailWrite) {
          callback(new Error('Failed to write'));
        } else {
          callback(null);
        }
      }, 10);
    }
    
    drain(callback) {
      setTimeout(() => {
        callback(null);
      }, 10);
    }
    
    close(callback) {
      setTimeout(() => {
        this.isOpen = false;
        this.emit('close');
        callback(null);
      }, 10);
    }
    
    static async list() {
      return [
        {
          path: 'COM3',
          manufacturer: 'Test Manufacturer',
          serialNumber: '12345',
          pnpId: 'USB\\VID_1234&PID_5678',
          vendorId: '1234',
          productId: '5678'
        }
      ];
    }
  }
  
  MockSerialPort._shouldFailOpen = false;
  MockSerialPort._shouldFailWrite = false;
  
  return { SerialPort: MockSerialPort };
});

const { SerialPort } = require('serialport');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('USBPrinterForwarder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SerialPort._shouldFailOpen = false;
    SerialPort._shouldFailWrite = false;
  });
  
  describe('Constructor', () => {
    test('should create instance with valid config', () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3',
        baudRate: 9600
      }, mockLogger);
      
      expect(forwarder.config.type).toBe('usb');
      expect(forwarder.config.port).toBe('COM3');
      expect(forwarder.config.baudRate).toBe(9600);
    });
    
    test('should use default baud rate if not specified', () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      expect(forwarder.config.baudRate).toBe(9600);
    });
  });
  
  describe('Connection Management', () => {
    test('should open serial port connection', async () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      await forwarder.openConnection();
      
      expect(forwarder.isConnected).toBe(true);
      expect(forwarder.serialPort).toBeDefined();
      expect(forwarder.serialPort.isOpen).toBe(true);
    });
    
    test('should not reopen if already connected', async () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      await forwarder.openConnection();
      const firstPort = forwarder.serialPort;
      
      await forwarder.openConnection();
      const secondPort = forwarder.serialPort;
      
      expect(firstPort).toBe(secondPort);
    });
    
    test('should handle connection failure', async () => {
      SerialPort._shouldFailOpen = true;
      
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      await expect(forwarder.openConnection())
        .rejects.toThrow('Failed to open serial port COM3');
      
      expect(forwarder.isConnected).toBe(false);
    });
    
    test('should close serial port connection', async () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      await forwarder.openConnection();
      expect(forwarder.isConnected).toBe(true);
      
      await forwarder.closeConnection();
      expect(forwarder.isConnected).toBe(false);
    });
  });
  
  describe('Data Forwarding', () => {
    test('should forward data to USB printer', async () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      const testData = Buffer.from('test print data');
      await forwarder.forwardToDevice(testData);
      
      expect(forwarder.isConnected).toBe(true);
    });
    
    test('should handle write failure', async () => {
      SerialPort._shouldFailWrite = true;
      
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      const testData = Buffer.from('test print data');
      
      await expect(forwarder.forwardToDevice(testData))
        .rejects.toThrow('Failed to write to serial port');
    });
    
    test('should timeout if write takes too long', async () => {
      const forwarder = new USBPrinterForwarder({
        port: 'COM3',
        timeout: 100
      }, mockLogger);
      
      // Mock write to never complete
      forwarder.openConnection = jest.fn().mockResolvedValue();
      forwarder.serialPort = {
        write: jest.fn((data, callback) => {
          // Never call callback - simulate hang
        })
      };
      
      const testData = Buffer.from('test print data');
      
      await expect(forwarder.forwardToDevice(testData))
        .rejects.toThrow('USB printer forward timeout');
    });
  });
  
  describe('Port Listing', () => {
    test('should list available serial ports', async () => {
      const ports = await USBPrinterForwarder.listPorts();
      
      expect(Array.isArray(ports)).toBe(true);
      expect(ports.length).toBeGreaterThan(0);
      expect(ports[0]).toHaveProperty('path');
      expect(ports[0]).toHaveProperty('manufacturer');
    });
  });
  
  describe('Integration with Base Class', () => {
    test('should use retry logic from base class', async () => {
      SerialPort._shouldFailWrite = true;
      
      const forwarder = new USBPrinterForwarder({
        port: 'COM3'
      }, mockLogger);
      
      // Mock sleep to avoid waiting
      forwarder.sleep = jest.fn().mockResolvedValue();
      forwarder.saveFailedPrint = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test data');
      
      await expect(forwarder.forward(testData)).rejects.toThrow();
      
      // Should have attempted multiple times
      expect(forwarder.sleep).toHaveBeenCalled();
    });
  });
});
