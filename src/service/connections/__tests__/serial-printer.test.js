// serial-printer.test.js
// Unit tests for SerialPrinterConnection class
// Tests serial port printer connection, data transfer, status detection, and error handling

const SerialPrinterConnection = require('../serial-printer');

// Mock the serialport module
jest.mock('serialport');
const { SerialPort } = require('serialport');

describe('SerialPrinterConnection', () => {
    let connection;
    let mockPort;
    
    beforeEach(() => {
        // Create mock serial port
        mockPort = {
            isOpen: false,
            open: jest.fn((callback) => {
                mockPort.isOpen = true;
                callback(null);
            }),
            close: jest.fn((callback) => {
                mockPort.isOpen = false;
                if (callback) callback(null);
            }),
            write: jest.fn((data, callback) => {
                callback(null);
            }),
            drain: jest.fn((callback) => {
                callback(null);
            }),
            on: jest.fn()
        };
        
        // Mock SerialPort constructor
        SerialPort.mockImplementation(() => mockPort);
        
        // Create connection instance
        connection = new SerialPrinterConnection({
            portName: 'COM1',
            baudRate: 9600
        });
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Constructor', () => {
        test('should initialize with port name and baud rate', () => {
            expect(connection.portName).toBe('COM1');
            expect(connection.baudRate).toBe(9600);
            expect(connection.dataBits).toBe(8);
            expect(connection.stopBits).toBe(1);
            expect(connection.parity).toBe('none');
            expect(connection.port).toBeNull();
        });
        
        test('should use default baud rate if not specified', () => {
            const conn = new SerialPrinterConnection({ portName: 'COM1' });
            expect(conn.baudRate).toBe(9600);
        });
        
        test('should use default data bits if not specified', () => {
            const conn = new SerialPrinterConnection({ portName: 'COM1' });
            expect(conn.dataBits).toBe(8);
        });
        
        test('should use default stop bits if not specified', () => {
            const conn = new SerialPrinterConnection({ portName: 'COM1' });
            expect(conn.stopBits).toBe(1);
        });
        
        test('should use default parity if not specified', () => {
            const conn = new SerialPrinterConnection({ portName: 'COM1' });
            expect(conn.parity).toBe('none');
        });
        
        test('should accept custom serial port settings', () => {
            const conn = new SerialPrinterConnection({
                portName: 'COM2',
                baudRate: 115200,
                dataBits: 7,
                stopBits: 2,
                parity: 'even'
            });
            
            expect(conn.portName).toBe('COM2');
            expect(conn.baudRate).toBe(115200);
            expect(conn.dataBits).toBe(7);
            expect(conn.stopBits).toBe(2);
            expect(conn.parity).toBe('even');
        });
    });
    
    describe('connect()', () => {
        test('should connect successfully', async () => {
            await connection.connect();
            
            expect(SerialPort).toHaveBeenCalledWith({
                path: 'COM1',
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                autoOpen: false
            });
            expect(mockPort.open).toHaveBeenCalled();
            expect(connection.port).toBe(mockPort);
        });
        
        test('should handle port open error', async () => {
            mockPort.open.mockImplementation((callback) => {
                callback(new Error('Port access denied'));
            });
            
            await expect(connection.connect()).rejects.toThrow('Failed to open COM1: Port access denied');
        });
        
        test('should handle port not found error', async () => {
            mockPort.open.mockImplementation((callback) => {
                const error = new Error('Port not found');
                error.code = 'ENOENT';
                callback(error);
            });
            
            await expect(connection.connect()).rejects.toThrow('Failed to open COM1: Port not found');
        });
        
        test('should handle port already open error', async () => {
            mockPort.open.mockImplementation((callback) => {
                const error = new Error('Port is already open');
                error.code = 'EBUSY';
                callback(error);
            });
            
            await expect(connection.connect()).rejects.toThrow('Failed to open COM1: Port is already open');
        });
        
        test('should register error handler', async () => {
            await connection.connect();
            
            expect(mockPort.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
        
        test('should handle error event during connection', async () => {
            let errorHandler;
            mockPort.on.mockImplementation((event, handler) => {
                if (event === 'error') {
                    errorHandler = handler;
                }
            });
            
            const connectPromise = connection.connect();
            
            // Trigger error before open completes
            if (errorHandler) {
                errorHandler(new Error('Serial port error'));
            }
            
            await expect(connectPromise).rejects.toThrow('Serial port error');
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
            expect(mockPort.write).toHaveBeenCalledWith(testData, expect.any(Function));
            expect(mockPort.drain).toHaveBeenCalled();
        });
        
        test('should throw error if port not open', async () => {
            connection.port = null;
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Port not open');
        });
        
        test('should throw error if port is closed', async () => {
            mockPort.isOpen = false;
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Port not open');
        });
        
        test('should handle write error', async () => {
            mockPort.write.mockImplementation((data, callback) => {
                callback(new Error('Write failed'));
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Write failed: Write failed');
        });
        
        test('should handle drain error', async () => {
            mockPort.drain.mockImplementation((callback) => {
                callback(new Error('Drain failed'));
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Drain failed: Drain failed');
        });
        
        test('should handle empty buffer', async () => {
            const emptyBuffer = Buffer.from('');
            
            const bytesSent = await connection.send(emptyBuffer);
            
            expect(bytesSent).toBe(0);
            expect(mockPort.write).toHaveBeenCalled();
        });
        
        test('should handle large data transfer', async () => {
            const largeData = Buffer.alloc(50000, 'A');
            
            const bytesSent = await connection.send(largeData);
            
            expect(bytesSent).toBe(50000);
            expect(mockPort.write).toHaveBeenCalledWith(largeData, expect.any(Function));
        });
        
        test('should wait for drain to complete', async () => {
            let drainCallback;
            mockPort.drain.mockImplementation((callback) => {
                drainCallback = callback;
                // Simulate async drain
                setTimeout(() => callback(null), 10);
            });
            
            const sendPromise = connection.send(Buffer.from('test'));
            
            // Verify drain was called
            expect(mockPort.drain).toHaveBeenCalled();
            
            await sendPromise;
        });
    });
    
    describe('getStatus()', () => {
        beforeEach(async () => {
            await connection.connect();
        });
        
        test('should return ready status when port is open', async () => {
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
            expect(mockPort.write).toHaveBeenCalledWith(expectedQuery, expect.any(Function));
        });
        
        test('should return error status if port not open', async () => {
            connection.port = null;
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'Port not open'
            });
        });
        
        test('should return error status if port is closed', async () => {
            mockPort.isOpen = false;
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'Port not open'
            });
        });
        
        test('should return error status on send failure', async () => {
            mockPort.write.mockImplementation((data, callback) => {
                callback(new Error('Port error'));
            });
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'Write failed: Port error'
            });
        });
    });
    
    describe('disconnect()', () => {
        test('should disconnect successfully', async () => {
            await connection.connect();
            
            await connection.disconnect();
            
            expect(mockPort.close).toHaveBeenCalled();
        });
        
        test('should handle disconnect when not connected', async () => {
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle disconnect when port is already closed', async () => {
            await connection.connect();
            mockPort.isOpen = false;
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle close error gracefully', async () => {
            await connection.connect();
            
            mockPort.close.mockImplementation((callback) => {
                callback(new Error('Close failed'));
            });
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle close without callback', async () => {
            await connection.connect();
            
            mockPort.close.mockImplementation(() => {
                mockPort.isOpen = false;
            });
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
    });
    
    describe('Error Scenarios', () => {
        test('should handle port disconnection during transfer', async () => {
            await connection.connect();
            
            mockPort.write.mockImplementation((data, callback) => {
                const error = new Error('Port disconnected');
                error.code = 'ENODEV';
                callback(error);
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Write failed: Port disconnected');
        });
        
        test('should handle buffer overflow error', async () => {
            await connection.connect();
            
            mockPort.write.mockImplementation((data, callback) => {
                const error = new Error('Buffer overflow');
                error.code = 'EOVERFLOW';
                callback(error);
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Write failed: Buffer overflow');
        });
        
        test('should handle timeout error', async () => {
            await connection.connect();
            
            mockPort.drain.mockImplementation((callback) => {
                const error = new Error('Operation timed out');
                error.code = 'ETIMEDOUT';
                callback(error);
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Drain failed: Operation timed out');
        });
    });
    
    describe('Different Serial Port Configurations', () => {
        test('should connect with 115200 baud rate', async () => {
            const highSpeedConnection = new SerialPrinterConnection({
                portName: 'COM1',
                baudRate: 115200
            });
            
            await highSpeedConnection.connect();
            
            expect(SerialPort).toHaveBeenCalledWith(
                expect.objectContaining({ baudRate: 115200 })
            );
        });
        
        test('should connect with even parity', async () => {
            const parityConnection = new SerialPrinterConnection({
                portName: 'COM1',
                baudRate: 9600,
                parity: 'even'
            });
            
            await parityConnection.connect();
            
            expect(SerialPort).toHaveBeenCalledWith(
                expect.objectContaining({ parity: 'even' })
            );
        });
        
        test('should connect with 7 data bits', async () => {
            const dataBitsConnection = new SerialPrinterConnection({
                portName: 'COM1',
                baudRate: 9600,
                dataBits: 7
            });
            
            await dataBitsConnection.connect();
            
            expect(SerialPort).toHaveBeenCalledWith(
                expect.objectContaining({ dataBits: 7 })
            );
        });
        
        test('should connect with 2 stop bits', async () => {
            const stopBitsConnection = new SerialPrinterConnection({
                portName: 'COM1',
                baudRate: 9600,
                stopBits: 2
            });
            
            await stopBitsConnection.connect();
            
            expect(SerialPort).toHaveBeenCalledWith(
                expect.objectContaining({ stopBits: 2 })
            );
        });
        
        test('should connect to different COM ports', async () => {
            const ports = ['COM1', 'COM2', 'COM3', 'COM4'];
            
            for (const portName of ports) {
                const conn = new SerialPrinterConnection({ portName });
                await conn.connect();
                
                expect(SerialPort).toHaveBeenCalledWith(
                    expect.objectContaining({ path: portName })
                );
            }
        });
    });
    
    describe('Concurrent Operations', () => {
        test('should handle multiple send operations sequentially', async () => {
            await connection.connect();
            
            const data1 = Buffer.from('Data 1');
            const data2 = Buffer.from('Data 2');
            const data3 = Buffer.from('Data 3');
            
            await connection.send(data1);
            await connection.send(data2);
            await connection.send(data3);
            
            expect(mockPort.write).toHaveBeenCalledTimes(3);
            expect(mockPort.drain).toHaveBeenCalledTimes(3);
        });
    });
});
