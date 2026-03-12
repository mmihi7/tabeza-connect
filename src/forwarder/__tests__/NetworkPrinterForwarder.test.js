/**
 * Unit tests for NetworkPrinterForwarder
 * 
 * Tests network printer communication with mocked TCP sockets.
 */

const NetworkPrinterForwarder = require('../NetworkPrinterForwarder');
const EventEmitter = require('events');

// Mock net module
jest.mock('net', () => {
  class MockSocket extends EventEmitter {
    constructor() {
      super();
      this.destroyed = false;
      this._shouldFailConnect = MockSocket._shouldFailConnect;
      this._shouldTimeout = MockSocket._shouldTimeout;
      this._shouldFailWrite = MockSocket._shouldFailWrite;
    }
    
    setTimeout(timeout) {
      this.timeout = timeout;
    }
    
    connect(port, host) {
      setTimeout(() => {
        if (this._shouldFailConnect) {
          this.emit('error', new Error('Connection refused'));
        } else if (this._shouldTimeout) {
          this.emit('timeout');
        } else {
          this.emit('connect');
        }
      }, 10);
    }
    
    write(data, callback) {
      setTimeout(() => {
        if (this._shouldFailWrite) {
          callback(new Error('Write failed'));
        } else {
          callback(null);
        }
      }, 10);
    }
    
    end() {
      setTimeout(() => {
        this.emit('close');
      }, 10);
    }
    
    destroy() {
      this.destroyed = true;
      this.emit('close');
    }
  }
  
  MockSocket._shouldFailConnect = false;
  MockSocket._shouldTimeout = false;
  MockSocket._shouldFailWrite = false;
  
  return {
    Socket: MockSocket
  };
});

const net = require('net');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('NetworkPrinterForwarder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    net.Socket._shouldFailConnect = false;
    net.Socket._shouldTimeout = false;
    net.Socket._shouldFailWrite = false;
  });
  
  describe('Constructor', () => {
    test('should create instance with valid config', () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100',
        networkPort: 9100
      }, mockLogger);
      
      expect(forwarder.config.type).toBe('network');
      expect(forwarder.config.ip).toBe('192.168.1.100');
      expect(forwarder.config.networkPort).toBe(9100);
    });
    
    test('should use default port if not specified', () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      expect(forwarder.config.networkPort).toBe(9100);
    });
  });
  
  describe('Connection Management', () => {
    test('should open TCP connection to network printer', async () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      await forwarder.openConnection();
      
      expect(forwarder.isConnected).toBe(true);
      expect(forwarder.socket).toBeDefined();
    });
    
    test('should not reopen if already connected', async () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      await forwarder.openConnection();
      const firstSocket = forwarder.socket;
      
      await forwarder.openConnection();
      const secondSocket = forwarder.socket;
      
      expect(firstSocket).toBe(secondSocket);
    });
    
    test('should handle connection failure', async () => {
      net.Socket._shouldFailConnect = true;
      
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      await expect(forwarder.openConnection())
        .rejects.toThrow('Network printer connection error');
      
      expect(forwarder.isConnected).toBe(false);
    });
    
    test('should handle connection timeout', async () => {
      net.Socket._shouldTimeout = true;
      
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100',
        timeout: 1000
      }, mockLogger);
      
      await expect(forwarder.openConnection())
        .rejects.toThrow('Network printer connection timeout');
      
      expect(forwarder.isConnected).toBe(false);
    });
    
    test('should close TCP connection', async () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      await forwarder.openConnection();
      expect(forwarder.isConnected).toBe(true);
      
      await forwarder.closeConnection();
      expect(forwarder.isConnected).toBe(false);
    });
  });
  
  describe('Data Forwarding', () => {
    test('should forward data to network printer', async () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      const testData = Buffer.from('test print data');
      await forwarder.forwardToDevice(testData);
      
      // Connection should be closed after successful forward
      expect(forwarder.isConnected).toBe(false);
    });
    
    test('should handle write failure', async () => {
      net.Socket._shouldFailWrite = true;
      
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      const testData = Buffer.from('test print data');
      
      await expect(forwarder.forwardToDevice(testData))
        .rejects.toThrow('Failed to write to network printer');
    });
    
    test('should timeout if write takes too long', async () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100',
        timeout: 100
      }, mockLogger);
      
      // Mock write to never complete
      forwarder.openConnection = jest.fn().mockResolvedValue();
      forwarder.socket = {
        write: jest.fn((data, callback) => {
          // Never call callback - simulate hang
        }),
        once: jest.fn(),
        destroyed: false
      };
      forwarder.closeConnection = jest.fn().mockResolvedValue();
      
      const testData = Buffer.from('test print data');
      
      await expect(forwarder.forwardToDevice(testData))
        .rejects.toThrow('Network printer forward timeout');
    });
    
    test('should create new connection for each print job', async () => {
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
      }, mockLogger);
      
      const testData = Buffer.from('test print data');
      
      await forwarder.forwardToDevice(testData);
      const firstSocket = forwarder.socket;
      
      await forwarder.forwardToDevice(testData);
      const secondSocket = forwarder.socket;
      
      // Should be different sockets (new connection each time)
      expect(firstSocket).not.toBe(secondSocket);
    });
  });
  
  describe('Connection Testing', () => {
    test('should test printer connectivity successfully', async () => {
      const result = await NetworkPrinterForwarder.testConnection(
        '192.168.1.100',
        9100,
        1000
      );
      
      expect(result).toBe(true);
    });
    
    test('should return false on connection failure', async () => {
      net.Socket._shouldFailConnect = true;
      
      const result = await NetworkPrinterForwarder.testConnection(
        '192.168.1.100',
        9100,
        1000
      );
      
      expect(result).toBe(false);
    });
    
    test('should return false on timeout', async () => {
      net.Socket._shouldTimeout = true;
      
      const result = await NetworkPrinterForwarder.testConnection(
        '192.168.1.100',
        9100,
        100
      );
      
      expect(result).toBe(false);
    });
  });
  
  describe('Integration with Base Class', () => {
    test('should use retry logic from base class', async () => {
      net.Socket._shouldFailWrite = true;
      
      const forwarder = new NetworkPrinterForwarder({
        ip: '192.168.1.100'
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
