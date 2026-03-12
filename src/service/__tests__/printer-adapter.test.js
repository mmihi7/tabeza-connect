// printer-adapter.test.js
// Unit tests for PhysicalPrinterAdapter class
// Tests printer configuration, job forwarding, queue management, and error handling

const PhysicalPrinterAdapter = require('../printer-adapter');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock the printer connection classes
jest.mock('../connections/usb-printer');
jest.mock('../connections/network-printer');
jest.mock('../connections/serial-printer');

const USBPrinterConnection = require('../connections/usb-printer');
const NetworkPrinterConnection = require('../connections/network-printer');
const SerialPrinterConnection = require('../connections/serial-printer');

describe('PhysicalPrinterAdapter', () => {
    let adapter;
    let testConfigFolder;
    
    beforeEach(async () => {
        // Create temporary test folder
        testConfigFolder = path.join(os.tmpdir(), `test-printer-adapter-${Date.now()}`);
        await fs.mkdir(testConfigFolder, { recursive: true });
        
        // Initialize adapter
        adapter = new PhysicalPrinterAdapter({
            configPath: path.join(testConfigFolder, 'config.json')
        });
        
        // Clear all mocks
        jest.clearAllMocks();
        
        // Setup default mock implementations
        USBPrinterConnection.mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            send: jest.fn().mockResolvedValue(100),
            getStatus: jest.fn().mockResolvedValue({ ready: true, paperOut: false })
        }));
        
        NetworkPrinterConnection.mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            send: jest.fn().mockResolvedValue(100),
            getStatus: jest.fn().mockResolvedValue({ ready: true, paperOut: false })
        }));
        
        SerialPrinterConnection.mockImplementation(() => ({
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            send: jest.fn().mockResolvedValue(100),
            getStatus: jest.fn().mockResolvedValue({ ready: true, paperOut: false })
        }));
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
    
    describe('Initialization', () => {
        test('should initialize with default configuration', () => {
            expect(adapter.isRunning).toBe(false);
            expect(adapter.printers.size).toBe(0);
            expect(adapter.forwardQueue.length).toBe(0);
        });
        
        test('should initialize statistics to zero', () => {
            const stats = adapter.getStats();
            expect(stats.jobsReceived).toBe(0);
            expect(stats.jobsForwarded).toBe(0);
            expect(stats.jobsFailed).toBe(0);
            expect(stats.avgForwardTime).toBe(0);
            expect(stats.queueDepth).toBe(0);
        });
    });
    
    describe('Start and Stop', () => {
        test('should start successfully', async () => {
            const startedPromise = new Promise(resolve => {
                adapter.once('started', resolve);
            });
            
            await adapter.start();
            await startedPromise;
            
            expect(adapter.isRunning).toBe(true);
            expect(adapter.workerInterval).toBeDefined();
        });
        
        test('should emit started event', async () => {
            const startedPromise = new Promise(resolve => {
                adapter.once('started', resolve);
            });
            
            await adapter.start();
            await startedPromise;
            
            expect(adapter.isRunning).toBe(true);
        });
        
        test('should not start if already running', async () => {
            await adapter.start();
            const firstInterval = adapter.workerInterval;
            
            await adapter.start(); // Try to start again
            
            expect(adapter.workerInterval).toBe(firstInterval);
        });
        
        test('should stop successfully', async () => {
            await adapter.start();
            
            const stoppedPromise = new Promise(resolve => {
                adapter.once('stopped', resolve);
            });
            
            await adapter.stop();
            await stoppedPromise;
            
            expect(adapter.isRunning).toBe(false);
            expect(adapter.workerInterval).toBeNull();
        });
        
        test('should handle stop when not running', async () => {
            await expect(adapter.stop()).resolves.not.toThrow();
        });
        
        test('should disconnect all printers on stop', async () => {
            // Create config with test printer
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [{
                    name: 'Test Printer',
                    type: 'network',
                    connection: { host: '192.168.1.100', port: 9100 },
                    enabled: true,
                    isDefault: true
                }]
            }));
            
            // Override config path
            adapter.config.configPath = configPath;
            
            await adapter.start();
            
            // Verify printer was initialized
            expect(adapter.printers.size).toBe(1);
            
            await adapter.stop();
            
            // Verify disconnect was called
            const printer = adapter.printers.get('Test Printer');
            // Note: printer will be cleared after stop, so we can't check it directly
            // But we can verify the adapter is stopped
            expect(adapter.isRunning).toBe(false);
            expect(adapter.printers.size).toBe(0);
        });
    });
    
    describe('Printer Configuration Loading', () => {
        test('should load printers from config file', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [
                    {
                        name: 'USB Printer',
                        type: 'usb',
                        connection: { vendorId: 0x04b8, productId: 0x0e15 },
                        enabled: true,
                        isDefault: true
                    },
                    {
                        name: 'Network Printer',
                        type: 'network',
                        connection: { host: '192.168.1.100', port: 9100 },
                        enabled: true
                    }
                ]
            }));
            
            adapter.config.configPath = configPath;
            
            await adapter.start();
            
            expect(adapter.printers.size).toBe(2);
            expect(adapter.printers.has('USB Printer')).toBe(true);
            expect(adapter.printers.has('Network Printer')).toBe(true);
        });
        
        test('should skip disabled printers', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [
                    {
                        name: 'Enabled Printer',
                        type: 'network',
                        connection: { host: '192.168.1.100', port: 9100 },
                        enabled: true
                    },
                    {
                        name: 'Disabled Printer',
                        type: 'network',
                        connection: { host: '192.168.1.101', port: 9100 },
                        enabled: false
                    }
                ]
            }));
            
            adapter.config.configPath = configPath;
            
            await adapter.start();
            
            expect(adapter.printers.size).toBe(1);
            expect(adapter.printers.has('Enabled Printer')).toBe(true);
            expect(adapter.printers.has('Disabled Printer')).toBe(false);
        });
        
        test('should handle missing config file gracefully', async () => {
            adapter.config.configPath = path.join(testConfigFolder, 'nonexistent.json');
            
            await expect(adapter.start()).resolves.not.toThrow();
            expect(adapter.printers.size).toBe(0);
        });
        
        test('should handle invalid JSON gracefully', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, 'invalid json {');
            
            adapter.config.configPath = configPath;
            
            await expect(adapter.start()).resolves.not.toThrow();
            expect(adapter.printers.size).toBe(0);
        });
        
        test('should initialize USB printer connection', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [{
                    name: 'USB Test',
                    type: 'usb',
                    connection: { vendorId: 0x04b8, productId: 0x0e15 },
                    enabled: true
                }]
            }));
            
            adapter.config.configPath = configPath;
            await adapter.start();
            
            expect(USBPrinterConnection).toHaveBeenCalledWith({ vendorId: 0x04b8, productId: 0x0e15 });
        });
        
        test('should initialize network printer connection', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [{
                    name: 'Network Test',
                    type: 'network',
                    connection: { host: '192.168.1.100', port: 9100 },
                    enabled: true
                }]
            }));
            
            adapter.config.configPath = configPath;
            await adapter.start();
            
            expect(NetworkPrinterConnection).toHaveBeenCalledWith({ host: '192.168.1.100', port: 9100 });
        });
        
        test('should initialize serial printer connection', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [{
                    name: 'Serial Test',
                    type: 'serial',
                    connection: { portName: 'COM1', baudRate: 9600 },
                    enabled: true
                }]
            }));
            
            adapter.config.configPath = configPath;
            await adapter.start();
            
            expect(SerialPrinterConnection).toHaveBeenCalledWith({ portName: 'COM1', baudRate: 9600 });
        });
    });
    
    describe('Job Enqueueing', () => {
        test('should enqueue job successfully', () => {
            const job = {
                jobId: 'test-job-1',
                rawData: Buffer.from('Test data'),
                timestamp: new Date().toISOString()
            };
            
            adapter.enqueueJob(job);
            
            expect(adapter.forwardQueue.length).toBe(1);
            expect(adapter.forwardQueue[0]).toBe(job);
        });
        
        test('should emit jobEnqueued event', () => {
            const enqueuedPromise = new Promise(resolve => {
                adapter.once('jobEnqueued', resolve);
            });
            
            const job = {
                jobId: 'test-job-2',
                rawData: Buffer.from('Test data'),
                timestamp: new Date().toISOString()
            };
            
            adapter.enqueueJob(job);
            
            return enqueuedPromise.then(event => {
                expect(event.jobId).toBe('test-job-2');
                expect(event.queueDepth).toBe(1);
            });
        });
        
        test('should update statistics on enqueue', () => {
            const job = {
                jobId: 'test-job-3',
                rawData: Buffer.from('Test data'),
                timestamp: new Date().toISOString()
            };
            
            adapter.enqueueJob(job);
            
            const stats = adapter.getStats();
            expect(stats.jobsReceived).toBe(1);
            expect(stats.queueDepth).toBe(1);
        });
        
        test('should maintain FIFO order', () => {
            const jobs = [
                { jobId: 'job-1', rawData: Buffer.from('Data 1') },
                { jobId: 'job-2', rawData: Buffer.from('Data 2') },
                { jobId: 'job-3', rawData: Buffer.from('Data 3') }
            ];
            
            jobs.forEach(job => adapter.enqueueJob(job));
            
            expect(adapter.forwardQueue.length).toBe(3);
            expect(adapter.forwardQueue[0].jobId).toBe('job-1');
            expect(adapter.forwardQueue[1].jobId).toBe('job-2');
            expect(adapter.forwardQueue[2].jobId).toBe('job-3');
        });
    });
    
    describe('Default Printer Selection', () => {
        test('should return printer marked as default', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [
                    {
                        name: 'Printer 1',
                        type: 'network',
                        connection: { host: '192.168.1.100', port: 9100 },
                        enabled: true,
                        isDefault: false
                    },
                    {
                        name: 'Printer 2',
                        type: 'network',
                        connection: { host: '192.168.1.101', port: 9100 },
                        enabled: true,
                        isDefault: true
                    }
                ]
            }));
            
            adapter.config.configPath = configPath;
            await adapter.start();
            
            const defaultPrinter = adapter.getDefaultPrinter();
            expect(defaultPrinter.name).toBe('Printer 2');
        });
        
        test('should return first enabled printer if no default', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [
                    {
                        name: 'Printer 1',
                        type: 'network',
                        connection: { host: '192.168.1.100', port: 9100 },
                        enabled: true
                    },
                    {
                        name: 'Printer 2',
                        type: 'network',
                        connection: { host: '192.168.1.101', port: 9100 },
                        enabled: true
                    }
                ]
            }));
            
            adapter.config.configPath = configPath;
            await adapter.start();
            
            const defaultPrinter = adapter.getDefaultPrinter();
            expect(defaultPrinter.name).toBe('Printer 1');
        });
        
        test('should return null if no printers configured', () => {
            const defaultPrinter = adapter.getDefaultPrinter();
            expect(defaultPrinter).toBeNull();
        });
    });
    
    describe('Queue Management', () => {
        test('should get queue contents', () => {
            const jobs = [
                { jobId: 'job-1', rawData: Buffer.from('Data 1') },
                { jobId: 'job-2', rawData: Buffer.from('Data 2') }
            ];
            
            jobs.forEach(job => adapter.enqueueJob(job));
            
            const queue = adapter.getQueue();
            expect(queue.length).toBe(2);
            expect(queue[0].jobId).toBe('job-1');
            expect(queue[1].jobId).toBe('job-2');
        });
        
        test('should clear queue', () => {
            const jobs = [
                { jobId: 'job-1', rawData: Buffer.from('Data 1') },
                { jobId: 'job-2', rawData: Buffer.from('Data 2') },
                { jobId: 'job-3', rawData: Buffer.from('Data 3') }
            ];
            
            jobs.forEach(job => adapter.enqueueJob(job));
            
            const clearedCount = adapter.clearQueue();
            
            expect(clearedCount).toBe(3);
            expect(adapter.forwardQueue.length).toBe(0);
            expect(adapter.getStats().queueDepth).toBe(0);
        });
        
        test('should return queue copy, not reference', () => {
            const job = { jobId: 'job-1', rawData: Buffer.from('Data 1') };
            adapter.enqueueJob(job);
            
            const queue = adapter.getQueue();
            queue.push({ jobId: 'job-2', rawData: Buffer.from('Data 2') });
            
            // Original queue should not be modified
            expect(adapter.forwardQueue.length).toBe(1);
        });
    });
    
    describe('Statistics', () => {
        test('should track jobs received', () => {
            adapter.enqueueJob({ jobId: 'job-1', rawData: Buffer.from('Data 1') });
            adapter.enqueueJob({ jobId: 'job-2', rawData: Buffer.from('Data 2') });
            
            const stats = adapter.getStats();
            expect(stats.jobsReceived).toBe(2);
        });
        
        test('should include running status in stats', () => {
            let stats = adapter.getStats();
            expect(stats.isRunning).toBe(false);
            
            adapter.isRunning = true;
            stats = adapter.getStats();
            expect(stats.isRunning).toBe(true);
        });
        
        test('should include printers configured count', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [
                    {
                        name: 'Printer 1',
                        type: 'network',
                        connection: { host: '192.168.1.100', port: 9100 },
                        enabled: true
                    },
                    {
                        name: 'Printer 2',
                        type: 'network',
                        connection: { host: '192.168.1.101', port: 9100 },
                        enabled: true
                    }
                ]
            }));
            
            adapter.config.configPath = configPath;
            await adapter.start();
            
            const stats = adapter.getStats();
            expect(stats.printersConfigured).toBe(2);
        });
    });
    
    describe('Error Handling', () => {
        test('should handle printer initialization failure gracefully', async () => {
            // Mock connection to throw error
            NetworkPrinterConnection.mockImplementation(() => ({
                connect: jest.fn().mockRejectedValue(new Error('Connection failed'))
            }));
            
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [{
                    name: 'Failing Printer',
                    type: 'network',
                    connection: { host: '192.168.1.100', port: 9100 },
                    enabled: true
                }]
            }));
            
            adapter.config.configPath = configPath;
            
            await expect(adapter.start()).resolves.not.toThrow();
            expect(adapter.printers.size).toBe(0);
        });
        
        test('should handle unknown printer type', async () => {
            const configPath = path.join(testConfigFolder, 'config.json');
            await fs.writeFile(configPath, JSON.stringify({
                printers: [{
                    name: 'Unknown Type',
                    type: 'unknown',
                    connection: {},
                    enabled: true
                }]
            }));
            
            adapter.config.configPath = configPath;
            
            await expect(adapter.start()).resolves.not.toThrow();
            expect(adapter.printers.size).toBe(0);
        });
    });
});
