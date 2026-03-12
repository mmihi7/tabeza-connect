/**
 * Unit tests for printer forwarder factory
 * 
 * Tests the createPrinterForwarder factory function.
 */

const {
  PrinterForwarder,
  USBPrinterForwarder,
  NetworkPrinterForwarder,
  createPrinterForwarder
} = require('../index');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Printer Forwarder Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Module Exports', () => {
    test('should export all forwarder classes', () => {
      expect(PrinterForwarder).toBeDefined();
      expect(USBPrinterForwarder).toBeDefined();
      expect(NetworkPrinterForwarder).toBeDefined();
      expect(createPrinterForwarder).toBeDefined();
    });
  });
  
  describe('createPrinterForwarder', () => {
    test('should create USB forwarder for usb type', () => {
      const forwarder = createPrinterForwarder({
        type: 'usb',
        port: 'COM3'
      }, mockLogger);
      
      expect(forwarder).toBeInstanceOf(USBPrinterForwarder);
      expect(forwarder.config.type).toBe('usb');
    });
    
    test('should create USB forwarder for serial type', () => {
      const forwarder = createPrinterForwarder({
        type: 'serial',
        port: 'COM3'
      }, mockLogger);
      
      expect(forwarder).toBeInstanceOf(USBPrinterForwarder);
      expect(forwarder.config.type).toBe('serial');
    });
    
    test('should create Network forwarder for network type', () => {
      const forwarder = createPrinterForwarder({
        type: 'network',
        ip: '192.168.1.100'
      }, mockLogger);
      
      expect(forwarder).toBeInstanceOf(NetworkPrinterForwarder);
      expect(forwarder.config.type).toBe('network');
    });
    
    test('should throw error if config is missing', () => {
      expect(() => createPrinterForwarder(null, mockLogger))
        .toThrow('Printer configuration with type is required');
    });
    
    test('should throw error if type is missing', () => {
      expect(() => createPrinterForwarder({}, mockLogger))
        .toThrow('Printer configuration with type is required');
    });
    
    test('should throw error for unsupported type', () => {
      expect(() => createPrinterForwarder({
        type: 'bluetooth'
      }, mockLogger))
        .toThrow('Unsupported printer type: bluetooth');
    });
  });
});
