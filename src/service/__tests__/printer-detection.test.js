// printer-detection.test.js
// Unit tests for printer detection functionality in PhysicalPrinterAdapter
// Tests USB, network, and serial printer auto-detection

const PhysicalPrinterAdapter = require('../printer-adapter');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock the printer connection classes and their dependencies
jest.mock('../connections/usb-printer');
jest.mock('../connections/network-printer');
jest.mock('../connections/serial-printer');
jest.mock('usb');
jest.mock('serialport');

const usb = require('usb');
const { SerialPort } = require('serialport');

describe('PhysicalPrinterAdapter - Printer Detection', () => {
    let adapter;
    let testConfigFolder;
    
    beforeEach(async () => {
        // Create temporary test folder
        testConfigFolder = path.join(os.tmpdir(), `test-printer-detection-${Date.now()}`);
        await fs.mkdir(testConfigFolder, { recursive: true });
        
        // Initialize adapter
        adapter = new PhysicalPrinterAdapter({
            configPath: path.join(testConfigFolder, 'config.json')
        });
        
        // Clear all mocks
        jest.clearAllMocks();
    });
    
    afterEach(async () => {
        // Stop adapter
        if (adapter && adapter.isRunning) {
            await adapter.stop();
        }
        
        // Clean up test folder
        try {
            await fs.rm(testConfigFolder, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });
    
    describe('detectPrinters()', () => {
        test('should return empty array when no printers found', async () => {
            // Mock empty results
            usb.getDeviceList = jest.fn().mockReturnValue([]);
            SerialPort.list = jest.fn().mockResolvedValue([]);
            
            const detected = await adapter.detectPrinters();
            
            expect(detected).toEqual([]);
        });
        
        test('should detect all printer types', async () => {
            // Mock USB printer
            const mockUSBDevice = {
                deviceDescriptor: {
                    idVendor: 0x04b8,
                    idProduct: 0x0e15,
                    bDeviceClass: 0x07, // Printer class
                    iProduct: 1
                },
                open: jest.fn(),
                close: jest.fn(),
                getStringDescriptor: jest.fn((index, callback) => {
                    callback(null, 'Epson TM-T88V');
                })
            };
            usb.getDeviceList = jest.fn().mockReturnValue([mockUSBDevice]);
            
            // Mock serial printer
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: 'COM1',
                    manufacturer: 'FTDI',
                    serialNumber: '12345',
                    vendorId: '0403',
                    productId: '6001'
                }
            ]);
            
            const detected = await adapter.detectPrinters();
            
            // Should find USB and serial printers (network scan is slow, so it may not complete)
            expect(detected.length).toBeGreaterThanOrEqual(2);
            
            // Check USB printer
            const usbPrinter = detected.find(p => p.type === 'usb');
            expect(usbPrinter).toBeDefined();
            expect(usbPrinter.connection.vendorId).toBe(0x04b8);
            expect(usbPrinter.connection.productId).toBe(0x0e15);
            
            // Check serial printer
            const serialPrinter = detected.find(p => p.type === 'serial');
            expect(serialPrinter).toBeDefined();
            expect(serialPrinter.connection.portName).toBe('COM1');
        });
        
        test('should handle detection errors gracefully', async () => {
            // Mock errors
            usb.getDeviceList = jest.fn().mockImplementation(() => {
                throw new Error('USB access denied');
            });
            SerialPort.list = jest.fn().mockRejectedValue(new Error('Serial port error'));
            
            const detected = await adapter.detectPrinters();
            
            // Should return empty array instead of throwing
            expect(detected).toEqual([]);
        });
    });
    
    describe('detectUSBPrinters()', () => {
        test('should detect USB printer with printer class', async () => {
            const mockDevice = {
                deviceDescriptor: {
                    idVendor: 0x04b8,
                    idProduct: 0x0e15,
                    bDeviceClass: 0x07, // Printer class
                    iProduct: 1
                },
                open: jest.fn(),
                close: jest.fn(),
                getStringDescriptor: jest.fn((index, callback) => {
                    callback(null, 'Epson TM-T88V');
                })
            };
            
            usb.getDeviceList = jest.fn().mockReturnValue([mockDevice]);
            
            const detected = await adapter.detectUSBPrinters();
            
            expect(detected).toHaveLength(1);
            expect(detected[0]).toEqual({
                name: 'Epson TM-T88V',
                type: 'usb',
                connection: {
                    vendorId: 0x04b8,
                    productId: 0x0e15
                }
            });
        });
        
        test('should detect USB printer with printer interface', async () => {
            const mockDevice = {
                deviceDescriptor: {
                    idVendor: 0x04b8,
                    idProduct: 0x0e15,
                    bDeviceClass: 0x00, // No device class
                    iProduct: 0
                },
                open: jest.fn(),
                close: jest.fn(),
                configDescriptor: {
                    interfaces: [
                        [
                            { bInterfaceClass: 0x07 } // Printer interface
                        ]
                    ]
                }
            };
            
            usb.getDeviceList = jest.fn().mockReturnValue([mockDevice]);
            
            const detected = await adapter.detectUSBPrinters();
            
            expect(detected).toHaveLength(1);
            expect(detected[0].type).toBe('usb');
            expect(detected[0].connection.vendorId).toBe(0x04b8);
        });
        
        test('should skip non-printer USB devices', async () => {
            const mockDevices = [
                {
                    deviceDescriptor: {
                        idVendor: 0x1234,
                        idProduct: 0x5678,
                        bDeviceClass: 0x08 // Mass storage, not printer
                    }
                },
                {
                    deviceDescriptor: {
                        idVendor: 0x04b8,
                        idProduct: 0x0e15,
                        bDeviceClass: 0x07 // Printer
                    },
                    open: jest.fn(),
                    close: jest.fn()
                }
            ];
            
            usb.getDeviceList = jest.fn().mockReturnValue(mockDevices);
            
            const detected = await adapter.detectUSBPrinters();
            
            expect(detected).toHaveLength(1);
            expect(detected[0].connection.vendorId).toBe(0x04b8);
        });
        
        test('should handle USB device name retrieval error', async () => {
            const mockDevice = {
                deviceDescriptor: {
                    idVendor: 0x04b8,
                    idProduct: 0x0e15,
                    bDeviceClass: 0x07,
                    iProduct: 1
                },
                open: jest.fn(),
                close: jest.fn(),
                getStringDescriptor: jest.fn((index, callback) => {
                    callback(new Error('Access denied'));
                })
            };
            
            usb.getDeviceList = jest.fn().mockReturnValue([mockDevice]);
            
            const detected = await adapter.detectUSBPrinters();
            
            expect(detected).toHaveLength(1);
            // Should use default name format
            expect(detected[0].name).toContain('USB Printer');
        });
        
        test('should handle USB scan error', async () => {
            usb.getDeviceList = jest.fn().mockImplementation(() => {
                throw new Error('USB subsystem error');
            });
            
            const detected = await adapter.detectUSBPrinters();
            
            expect(detected).toEqual([]);
        });
    });
    
    describe('detectNetworkPrinters()', () => {
        test('should scan common printer IPs', async () => {
            // Mock network interfaces
            const originalNetworkInterfaces = os.networkInterfaces;
            os.networkInterfaces = jest.fn().mockReturnValue({
                'Ethernet': [
                    {
                        family: 'IPv4',
                        address: '192.168.1.50',
                        internal: false
                    }
                ]
            });
            
            const detected = await adapter.detectNetworkPrinters();
            
            // Should attempt to scan common IPs in the subnet
            expect(detected).toBeInstanceOf(Array);
            
            // Restore original function
            os.networkInterfaces = originalNetworkInterfaces;
        });
        
        test('should skip internal interfaces', async () => {
            const originalNetworkInterfaces = os.networkInterfaces;
            os.networkInterfaces = jest.fn().mockReturnValue({
                'Loopback': [
                    {
                        family: 'IPv4',
                        address: '127.0.0.1',
                        internal: true // Internal interface
                    }
                ]
            });
            
            const detected = await adapter.detectNetworkPrinters();
            
            // Should not scan internal interfaces
            expect(detected).toEqual([]);
            
            os.networkInterfaces = originalNetworkInterfaces;
        });
        
        test('should skip IPv6 addresses', async () => {
            const originalNetworkInterfaces = os.networkInterfaces;
            os.networkInterfaces = jest.fn().mockReturnValue({
                'Ethernet': [
                    {
                        family: 'IPv6',
                        address: 'fe80::1',
                        internal: false
                    }
                ]
            });
            
            const detected = await adapter.detectNetworkPrinters();
            
            // Should only scan IPv4 addresses
            expect(detected).toEqual([]);
            
            os.networkInterfaces = originalNetworkInterfaces;
        });
        
        test('should handle network scan timeout', async () => {
            const originalNetworkInterfaces = os.networkInterfaces;
            os.networkInterfaces = jest.fn().mockReturnValue({
                'Ethernet': [
                    {
                        family: 'IPv4',
                        address: '192.168.1.50',
                        internal: false
                    }
                ]
            });
            
            // Network scan should complete even if connections timeout
            const detected = await adapter.detectNetworkPrinters();
            
            expect(detected).toBeInstanceOf(Array);
            
            os.networkInterfaces = originalNetworkInterfaces;
        });
    });
    
    describe('detectSerialPrinters()', () => {
        test('should detect serial printers on COM ports', async () => {
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: 'COM1',
                    manufacturer: 'FTDI',
                    serialNumber: '12345',
                    vendorId: '0403',
                    productId: '6001'
                },
                {
                    path: 'COM3',
                    manufacturer: 'Prolific',
                    serialNumber: '67890'
                }
            ]);
            
            const detected = await adapter.detectSerialPrinters();
            
            expect(detected).toHaveLength(2);
            expect(detected[0]).toEqual({
                name: 'Serial Printer on COM1',
                type: 'serial',
                connection: {
                    portName: 'COM1',
                    baudRate: 9600
                },
                info: {
                    manufacturer: 'FTDI',
                    serialNumber: '12345',
                    vendorId: '0403',
                    productId: '6001'
                }
            });
        });
        
        test('should detect ports without manufacturer info', async () => {
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: 'COM2'
                    // No manufacturer info
                }
            ]);
            
            const detected = await adapter.detectSerialPrinters();
            
            expect(detected).toHaveLength(1);
            expect(detected[0].connection.portName).toBe('COM2');
        });
        
        test('should skip non-COM ports', async () => {
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: '/dev/ttyUSB0' // Linux path, not COM port
                }
            ]);
            
            const detected = await adapter.detectSerialPrinters();
            
            // Should skip non-COM ports on Windows
            expect(detected).toEqual([]);
        });
        
        test('should handle serial port list error', async () => {
            SerialPort.list = jest.fn().mockRejectedValue(new Error('Serial port access denied'));
            
            const detected = await adapter.detectSerialPrinters();
            
            expect(detected).toEqual([]);
        });
        
        test('should include all port information', async () => {
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: 'COM1',
                    manufacturer: 'FTDI',
                    serialNumber: 'ABC123',
                    vendorId: '0403',
                    productId: '6001',
                    pnpId: 'USB\\VID_0403&PID_6001'
                }
            ]);
            
            const detected = await adapter.detectSerialPrinters();
            
            expect(detected[0].info).toEqual({
                manufacturer: 'FTDI',
                serialNumber: 'ABC123',
                vendorId: '0403',
                productId: '6001'
            });
        });
    });
    
    describe('Printer Detection Integration', () => {
        test('should combine results from all detection methods', async () => {
            // Mock USB printer
            const mockUSBDevice = {
                deviceDescriptor: {
                    idVendor: 0x04b8,
                    idProduct: 0x0e15,
                    bDeviceClass: 0x07
                },
                open: jest.fn(),
                close: jest.fn()
            };
            usb.getDeviceList = jest.fn().mockReturnValue([mockUSBDevice]);
            
            // Mock serial printer
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: 'COM1',
                    manufacturer: 'FTDI'
                }
            ]);
            
            const detected = await adapter.detectPrinters();
            
            // Should have at least USB and serial printers
            expect(detected.length).toBeGreaterThanOrEqual(2);
            
            const types = detected.map(p => p.type);
            expect(types).toContain('usb');
            expect(types).toContain('serial');
        });
        
        test('should continue detection even if one method fails', async () => {
            // USB detection fails
            usb.getDeviceList = jest.fn().mockImplementation(() => {
                throw new Error('USB error');
            });
            
            // Serial detection succeeds
            SerialPort.list = jest.fn().mockResolvedValue([
                {
                    path: 'COM1',
                    manufacturer: 'FTDI'
                }
            ]);
            
            const detected = await adapter.detectPrinters();
            
            // Should still return serial printer
            expect(detected.length).toBeGreaterThanOrEqual(1);
            expect(detected[0].type).toBe('serial');
        });
        
        test('should log detection results', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            usb.getDeviceList = jest.fn().mockReturnValue([]);
            SerialPort.list = jest.fn().mockResolvedValue([]);
            
            await adapter.detectPrinters();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Scanning for printers')
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Total printers detected')
            );
            
            consoleSpy.mockRestore();
        });
    });
});
