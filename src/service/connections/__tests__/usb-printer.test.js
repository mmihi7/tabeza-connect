// usb-printer.test.js
// Unit tests for USBPrinterConnection class
// Tests USB printer connection, data transfer, status detection, and error handling

const USBPrinterConnection = require('../usb-printer');

// Mock the usb module
jest.mock('usb');
const usb = require('usb');

describe('USBPrinterConnection', () => {
    let connection;
    let mockDevice;
    let mockInterface;
    let mockEndpoint;
    
    beforeEach(() => {
        // Setup mock USB device
        mockEndpoint = {
            direction: 'out',
            transferType: usb.LIBUSB_TRANSFER_TYPE_BULK,
            transfer: jest.fn((data, callback) => callback(null))
        };
        
        mockInterface = {
            endpoints: [mockEndpoint],
            isKernelDriverActive: jest.fn().mockReturnValue(false),
            detachKernelDriver: jest.fn(),
            claim: jest.fn(),
            release: jest.fn((callback) => callback())
        };
        
        mockDevice = {
            deviceDescriptor: {
                idVendor: 0x04b8,
                idProduct: 0x0e15
            },
            open: jest.fn(),
            close: jest.fn(),
            interface: jest.fn().mockReturnValue(mockInterface)
        };
        
        // Mock usb.findByIds
        usb.findByIds = jest.fn().mockReturnValue(mockDevice);
        usb.LIBUSB_TRANSFER_TYPE_BULK = 2;
        
        // Create connection instance
        connection = new USBPrinterConnection({
            vendorId: 0x04b8,
            productId: 0x0e15
        });
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Constructor', () => {
        test('should initialize with vendor and product IDs', () => {
            expect(connection.vendorId).toBe(0x04b8);
            expect(connection.productId).toBe(0x0e15);
            expect(connection.device).toBeNull();
            expect(connection.endpoint).toBeNull();
            expect(connection.interface).toBeNull();
        });
    });
    
    describe('connect()', () => {
        test('should connect to USB device successfully', async () => {
            const result = await connection.connect();
            
            expect(result).toBe(true);
            expect(usb.findByIds).toHaveBeenCalledWith(0x04b8, 0x0e15);
            expect(mockDevice.open).toHaveBeenCalled();
            expect(mockInterface.claim).toHaveBeenCalled();
            expect(connection.device).toBe(mockDevice);
            expect(connection.endpoint).toBe(mockEndpoint);
        });
        
        test('should throw error if device not found', async () => {
            usb.findByIds.mockReturnValue(null);
            
            await expect(connection.connect()).rejects.toThrow('USB printer not found: 1208:3605');
        });
        
        test('should detach kernel driver if active', async () => {
            mockInterface.isKernelDriverActive.mockReturnValue(true);
            
            await connection.connect();
            
            expect(mockInterface.detachKernelDriver).toHaveBeenCalled();
        });
        
        test('should not detach kernel driver if not active', async () => {
            mockInterface.isKernelDriverActive.mockReturnValue(false);
            
            await connection.connect();
            
            expect(mockInterface.detachKernelDriver).not.toHaveBeenCalled();
        });
        
        test('should throw error if no bulk OUT endpoint found', async () => {
            mockInterface.endpoints = [
                { direction: 'in', transferType: usb.LIBUSB_TRANSFER_TYPE_BULK }
            ];
            
            await expect(connection.connect()).rejects.toThrow('No bulk OUT endpoint found');
        });
        
        test('should handle device open error', async () => {
            mockDevice.open.mockImplementation(() => {
                throw new Error('Device access denied');
            });
            
            await expect(connection.connect()).rejects.toThrow('Device access denied');
        });
        
        test('should handle interface claim error', async () => {
            mockInterface.claim.mockImplementation(() => {
                throw new Error('Interface busy');
            });
            
            await expect(connection.connect()).rejects.toThrow('Interface busy');
        });
    });
    
    describe('send()', () => {
        beforeEach(async () => {
            await connection.connect();
        });
        
        test('should send data successfully', async () => {
            const testData = Buffer.from('Test print data');
            
            const bytesSent = await connection.send(testData);
            
            expect(bytesSent).toBe(testData.length);
            expect(mockEndpoint.transfer).toHaveBeenCalledWith(
                testData,
                expect.any(Function)
            );
        });
        
        test('should throw error if not connected', async () => {
            connection.endpoint = null;
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Not connected');
        });
        
        test('should handle transfer error', async () => {
            mockEndpoint.transfer.mockImplementation((data, callback) => {
                callback(new Error('Transfer timeout'));
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('USB transfer failed: Transfer timeout');
        });
        
        test('should handle empty buffer', async () => {
            const emptyBuffer = Buffer.from('');
            
            const bytesSent = await connection.send(emptyBuffer);
            
            expect(bytesSent).toBe(0);
            expect(mockEndpoint.transfer).toHaveBeenCalled();
        });
        
        test('should handle large data transfer', async () => {
            const largeData = Buffer.alloc(10000, 'A');
            
            const bytesSent = await connection.send(largeData);
            
            expect(bytesSent).toBe(10000);
            expect(mockEndpoint.transfer).toHaveBeenCalledWith(
                largeData,
                expect.any(Function)
            );
        });
    });
    
    describe('getStatus()', () => {
        beforeEach(async () => {
            await connection.connect();
        });
        
        test('should return ready status when printer is ready', async () => {
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: true,
                paperOut: false,
                error: false
            });
        });
        
        test('should send ESC/POS status query', async () => {
            await connection.getStatus();
            
            const expectedQuery = Buffer.from([0x1B, 0x76]); // ESC v
            expect(mockEndpoint.transfer).toHaveBeenCalledWith(
                expectedQuery,
                expect.any(Function)
            );
        });
        
        test('should return error status on send failure', async () => {
            mockEndpoint.transfer.mockImplementation((data, callback) => {
                callback(new Error('Device not responding'));
            });
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'USB transfer failed: Device not responding'
            });
        });
    });
    
    describe('disconnect()', () => {
        test('should disconnect successfully', async () => {
            await connection.connect();
            
            await connection.disconnect();
            
            expect(mockInterface.release).toHaveBeenCalled();
            expect(mockDevice.close).toHaveBeenCalled();
        });
        
        test('should handle disconnect when not connected', async () => {
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle release error gracefully', async () => {
            await connection.connect();
            
            mockInterface.release.mockImplementation((callback) => {
                callback(new Error('Release failed'));
            });
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle close error gracefully', async () => {
            await connection.connect();
            
            mockDevice.close.mockImplementation(() => {
                throw new Error('Close failed');
            });
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
    });
    
    describe('Error Scenarios', () => {
        test('should handle device disconnection during transfer', async () => {
            await connection.connect();
            
            mockEndpoint.transfer.mockImplementation((data, callback) => {
                callback(new Error('LIBUSB_ERROR_NO_DEVICE'));
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('USB transfer failed: LIBUSB_ERROR_NO_DEVICE');
        });
        
        test('should handle device busy error', async () => {
            mockInterface.claim.mockImplementation(() => {
                throw new Error('LIBUSB_ERROR_BUSY');
            });
            
            await expect(connection.connect()).rejects.toThrow('LIBUSB_ERROR_BUSY');
        });
        
        test('should handle permission denied error', async () => {
            mockDevice.open.mockImplementation(() => {
                throw new Error('LIBUSB_ERROR_ACCESS');
            });
            
            await expect(connection.connect()).rejects.toThrow('LIBUSB_ERROR_ACCESS');
        });
    });
    
    describe('Multiple Endpoints', () => {
        test('should select correct bulk OUT endpoint', async () => {
            const bulkInEndpoint = {
                direction: 'in',
                transferType: usb.LIBUSB_TRANSFER_TYPE_BULK
            };
            
            const bulkOutEndpoint = {
                direction: 'out',
                transferType: usb.LIBUSB_TRANSFER_TYPE_BULK,
                transfer: jest.fn((data, callback) => callback(null))
            };
            
            const interruptEndpoint = {
                direction: 'in',
                transferType: usb.LIBUSB_TRANSFER_TYPE_INTERRUPT
            };
            
            mockInterface.endpoints = [bulkInEndpoint, interruptEndpoint, bulkOutEndpoint];
            
            await connection.connect();
            
            expect(connection.endpoint).toBe(bulkOutEndpoint);
        });
    });
});
