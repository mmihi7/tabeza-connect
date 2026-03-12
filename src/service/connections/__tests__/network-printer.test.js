// network-printer.test.js
// Unit tests for NetworkPrinterConnection class
// Tests network printer connection, TCP communication, status detection, and error handling

const NetworkPrinterConnection = require('../network-printer');
const net = require('net');
const EventEmitter = require('events');

// Mock the net module
jest.mock('net');

describe('NetworkPrinterConnection', () => {
    let connection;
    let mockSocket;
    
    beforeEach(() => {
        // Create mock socket
        mockSocket = new EventEmitter();
        mockSocket.connect = jest.fn();
        mockSocket.write = jest.fn((data, callback) => {
            if (callback) callback();
            return true;
        });
        mockSocket.end = jest.fn((callback) => {
            if (callback) callback();
        });
        mockSocket.destroy = jest.fn();
        mockSocket.setTimeout = jest.fn();
        mockSocket.once = jest.fn();
        mockSocket.destroyed = false;
        mockSocket.bufferSize = 0;
        
        // Mock net.Socket constructor
        net.Socket = jest.fn(() => mockSocket);
        
        // Create connection instance
        connection = new NetworkPrinterConnection({
            host: '192.168.1.100',
            port: 9100
        });
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Constructor', () => {
        test('should initialize with host and port', () => {
            expect(connection.host).toBe('192.168.1.100');
            expect(connection.port).toBe(9100);
            expect(connection.socket).toBeNull();
            expect(connection.timeout).toBe(5000);
        });
        
        test('should use default port 9100 if not specified', () => {
            const conn = new NetworkPrinterConnection({ host: '192.168.1.100' });
            expect(conn.port).toBe(9100);
        });
        
        test('should use custom timeout if specified', () => {
            const conn = new NetworkPrinterConnection({
                host: '192.168.1.100',
                port: 9100,
                timeout: 10000
            });
            expect(conn.timeout).toBe(10000);
        });
    });
    
    describe('connect()', () => {
        test('should connect successfully', async () => {
            const connectPromise = connection.connect();
            
            // Simulate successful connection
            setImmediate(() => {
                const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error');
                if (!connectHandler) {
                    // Trigger connect event
                    mockSocket.emit('connect');
                }
            });
            
            await connectPromise;
            
            expect(net.Socket).toHaveBeenCalled();
            expect(mockSocket.setTimeout).toHaveBeenCalledWith(5000);
            expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.100');
        });
        
        test('should disable timeout after successful connection', async () => {
            const connectPromise = connection.connect();
            
            setImmediate(() => {
                mockSocket.emit('connect');
            });
            
            await connectPromise;
            
            // Should be called twice: once with timeout, once with 0 to disable
            expect(mockSocket.setTimeout).toHaveBeenCalledWith(0);
        });
        
        test('should handle connection timeout', async () => {
            const connectPromise = connection.connect();
            
            setImmediate(() => {
                mockSocket.emit('timeout');
            });
            
            await expect(connectPromise).rejects.toThrow('Connection timeout');
            expect(mockSocket.destroy).toHaveBeenCalled();
        });
        
        test('should handle connection error', async () => {
            const connectPromise = connection.connect();
            
            setImmediate(() => {
                mockSocket.emit('error', new Error('Connection refused'));
            });
            
            await expect(connectPromise).rejects.toThrow('Connection failed: Connection refused');
        });
        
        test('should handle network unreachable error', async () => {
            const connectPromise = connection.connect();
            
            setImmediate(() => {
                const error = new Error('Network unreachable');
                error.code = 'ENETUNREACH';
                mockSocket.emit('error', error);
            });
            
            await expect(connectPromise).rejects.toThrow('Connection failed: Network unreachable');
        });
        
        test('should handle host not found error', async () => {
            const connectPromise = connection.connect();
            
            setImmediate(() => {
                const error = new Error('getaddrinfo ENOTFOUND');
                error.code = 'ENOTFOUND';
                mockSocket.emit('error', error);
            });
            
            await expect(connectPromise).rejects.toThrow('Connection failed: getaddrinfo ENOTFOUND');
        });
    });
    
    describe('send()', () => {
        beforeEach(async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
        });
        
        test('should send data successfully', async () => {
            const testData = Buffer.from('Test print data');
            
            const bytesSent = await connection.send(testData);
            
            expect(bytesSent).toBe(testData.length);
            expect(mockSocket.write).toHaveBeenCalledWith(testData, expect.any(Function));
        });
        
        test('should throw error if not connected', async () => {
            connection.socket = null;
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Not connected');
        });
        
        test('should throw error if socket is destroyed', async () => {
            mockSocket.destroyed = true;
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Not connected');
        });
        
        test('should handle write error', async () => {
            mockSocket.write.mockImplementation((data, callback) => {
                callback(new Error('Write failed'));
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Send failed: Write failed');
        });
        
        test('should wait for drain if buffer is full', async () => {
            mockSocket.bufferSize = 1000; // Simulate full buffer
            
            const sendPromise = connection.send(Buffer.from('test'));
            
            // Simulate drain event
            setImmediate(() => {
                mockSocket.emit('drain');
            });
            
            const bytesSent = await sendPromise;
            expect(bytesSent).toBe(4);
        });
        
        test('should resolve immediately if buffer is empty', async () => {
            mockSocket.bufferSize = 0;
            
            const bytesSent = await connection.send(Buffer.from('test'));
            
            expect(bytesSent).toBe(4);
        });
        
        test('should handle large data transfer', async () => {
            const largeData = Buffer.alloc(100000, 'A');
            
            const bytesSent = await connection.send(largeData);
            
            expect(bytesSent).toBe(100000);
            expect(mockSocket.write).toHaveBeenCalledWith(largeData, expect.any(Function));
        });
        
        test('should handle empty buffer', async () => {
            const emptyBuffer = Buffer.from('');
            
            const bytesSent = await connection.send(emptyBuffer);
            
            expect(bytesSent).toBe(0);
        });
    });
    
    describe('getStatus()', () => {
        beforeEach(async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
        });
        
        test('should return ready status when connected', async () => {
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
            expect(mockSocket.write).toHaveBeenCalledWith(expectedQuery, expect.any(Function));
        });
        
        test('should return error status if not connected', async () => {
            connection.socket = null;
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'Not connected'
            });
        });
        
        test('should return error status if socket is destroyed', async () => {
            mockSocket.destroyed = true;
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'Not connected'
            });
        });
        
        test('should return error status on send failure', async () => {
            mockSocket.write.mockImplementation((data, callback) => {
                callback(new Error('Network error'));
            });
            
            const status = await connection.getStatus();
            
            expect(status).toEqual({
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: 'Send failed: Network error'
            });
        });
    });
    
    describe('disconnect()', () => {
        test('should disconnect successfully', async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
            
            await connection.disconnect();
            
            expect(mockSocket.end).toHaveBeenCalled();
            expect(mockSocket.destroy).toHaveBeenCalled();
        });
        
        test('should handle disconnect when not connected', async () => {
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle disconnect when socket is already destroyed', async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
            
            mockSocket.destroyed = true;
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
        
        test('should handle end error gracefully', async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
            
            mockSocket.end.mockImplementation(() => {
                throw new Error('End failed');
            });
            
            await expect(connection.disconnect()).resolves.not.toThrow();
        });
    });
    
    describe('Error Scenarios', () => {
        test('should handle connection reset during transfer', async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
            
            mockSocket.write.mockImplementation((data, callback) => {
                const error = new Error('Connection reset by peer');
                error.code = 'ECONNRESET';
                callback(error);
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Send failed: Connection reset by peer');
        });
        
        test('should handle broken pipe error', async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
            
            mockSocket.write.mockImplementation((data, callback) => {
                const error = new Error('Broken pipe');
                error.code = 'EPIPE';
                callback(error);
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Send failed: Broken pipe');
        });
        
        test('should handle timeout during data transfer', async () => {
            const connectPromise = connection.connect();
            setImmediate(() => mockSocket.emit('connect'));
            await connectPromise;
            
            mockSocket.write.mockImplementation((data, callback) => {
                const error = new Error('Operation timed out');
                error.code = 'ETIMEDOUT';
                callback(error);
            });
            
            await expect(connection.send(Buffer.from('test'))).rejects.toThrow('Send failed: Operation timed out');
        });
    });
    
    describe('Connection with Different Ports', () => {
        test('should connect to custom port', async () => {
            const customConnection = new NetworkPrinterConnection({
                host: '192.168.1.100',
                port: 8080
            });
            
            const connectPromise = customConnection.connect();
            setImmediate(() => {
                const socket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value;
                socket.emit('connect');
            });
            await connectPromise;
            
            const socket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value;
            expect(socket.connect).toHaveBeenCalledWith(8080, '192.168.1.100');
        });
        
        test('should connect to IPv6 address', async () => {
            const ipv6Connection = new NetworkPrinterConnection({
                host: '::1',
                port: 9100
            });
            
            const connectPromise = ipv6Connection.connect();
            setImmediate(() => {
                const socket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value;
                socket.emit('connect');
            });
            await connectPromise;
            
            const socket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value;
            expect(socket.connect).toHaveBeenCalledWith(9100, '::1');
        });
    });
});
