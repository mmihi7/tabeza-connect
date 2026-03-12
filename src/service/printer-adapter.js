// printer-adapter.js
// Physical Printer Adapter - Forwards captured print jobs to physical printers
// Part of the virtual printer capture architecture

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const USBPrinterConnection = require('./connections/usb-printer');
const NetworkPrinterConnection = require('./connections/network-printer');
const SerialPrinterConnection = require('./connections/serial-printer');

class PhysicalPrinterAdapter extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = config;
        this.printers = new Map(); // printerName -> PrinterConnection
        this.forwardQueue = []; // FIFO queue of jobs awaiting forwarding
        this.isRunning = false;
        this.workerInterval = null;
        this.configWatcher = null; // File watcher for config.json
        
        this.stats = {
            jobsReceived: 0,
            jobsForwarded: 0,
            jobsFailed: 0,
            avgForwardTime: 0,
            queueDepth: 0
        };
    }
    
    async start() {
        if (this.isRunning) {
            console.log('[PhysicalPrinterAdapter] Already running');
            return;
        }
        
        console.log('[PhysicalPrinterAdapter] Starting...');
        
        // Load printer configuration
        await this.loadPrinterConfig();
        
        // Start configuration file watcher
        this.startConfigWatcher();
        
        // Start forwarding worker
        this.isRunning = true;
        this.startForwardingWorker();
        
        console.log('[PhysicalPrinterAdapter] Started');
        this.emit('started');
    }
    
    async stop() {
        if (!this.isRunning) {
            console.log('[PhysicalPrinterAdapter] Not running');
            return;
        }
        
        console.log('[PhysicalPrinterAdapter] Stopping...');
        
        this.isRunning = false;
        
        // Stop configuration watcher
        if (this.configWatcher) {
            this.configWatcher.close();
            this.configWatcher = null;
        }
        
        // Stop forwarding worker
        if (this.workerInterval) {
            clearInterval(this.workerInterval);
            this.workerInterval = null;
        }
        
        // Close all printer connections
        for (const [name, printer] of this.printers.entries()) {
            try {
                if (printer.disconnect) {
                    await printer.disconnect();
                }
            } catch (err) {
                console.error(`[PhysicalPrinterAdapter] Error disconnecting ${name}:`, err.message);
            }
        }
        
        this.printers.clear();
        
        console.log('[PhysicalPrinterAdapter] Stopped');
        this.emit('stopped');
    }
    
    /**
     * Start watching config.json for changes
     */
    startConfigWatcher() {
        const chokidar = require('chokidar');
        const configPath = path.join('C:\\TabezaPrints', 'config.json');
        
        console.log('[PhysicalPrinterAdapter] Starting config file watcher');
        
        this.configWatcher = chokidar.watch(configPath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        
        this.configWatcher.on('change', async () => {
            console.log('[PhysicalPrinterAdapter] Config file changed, reloading...');
            try {
                await this.reloadConfig();
            } catch (err) {
                console.error('[PhysicalPrinterAdapter] Error reloading config:', err.message);
            }
        });
        
        this.configWatcher.on('error', (error) => {
            console.error('[PhysicalPrinterAdapter] Config watcher error:', error.message);
        });
    }
    
    async loadPrinterConfig() {
        // Load printer configuration from config.json
        const configPath = path.join('C:\\TabezaPrints', 'config.json');
        
        try {
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            if (config.printers && Array.isArray(config.printers)) {
                console.log(`[PhysicalPrinterAdapter] Loaded ${config.printers.length} printer(s) from config`);
                
                // Initialize printer connections
                for (const printerConfig of config.printers) {
                    if (printerConfig.enabled !== false) {
                        await this.initializePrinter(printerConfig);
                    }
                }
            } else {
                console.log('[PhysicalPrinterAdapter] No printers configured');
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log('[PhysicalPrinterAdapter] No config file found - using defaults');
            } else {
                console.error('[PhysicalPrinterAdapter] Error loading config:', err.message);
            }
        }
    }
    
    /**
     * Reload printer configuration from config.json
     * Closes existing connections and reinitializes printers
     */
    async reloadConfig() {
        console.log('[PhysicalPrinterAdapter] Reloading configuration...');
        
        // Close all existing printer connections
        for (const [name, printer] of this.printers.entries()) {
            try {
                if (printer.connection && printer.connection.disconnect) {
                    await printer.connection.disconnect();
                }
            } catch (err) {
                console.error(`[PhysicalPrinterAdapter] Error disconnecting ${name}:`, err.message);
            }
        }
        
        // Clear printers map
        this.printers.clear();
        
        // Reload configuration
        await this.loadPrinterConfig();
        
        console.log('[PhysicalPrinterAdapter] Configuration reloaded successfully');
        this.emit('configReloaded');
    }
    
    async initializePrinter(config) {
        try {
            let connection;
            
            switch (config.type) {
                case 'usb':
                    connection = new USBPrinterConnection(config.connection);
                    break;
                case 'network':
                    connection = new NetworkPrinterConnection(config.connection);
                    break;
                case 'serial':
                    connection = new SerialPrinterConnection(config.connection);
                    break;
                default:
                    throw new Error(`Unknown printer type: ${config.type}`);
            }
            
            // Connect to printer
            await connection.connect();
            
            // Store connection
            this.printers.set(config.name, {
                connection,
                config,
                enabled: true,
                isDefault: config.isDefault || false
            });
            
            console.log(`[PhysicalPrinterAdapter] Initialized printer: ${config.name} (${config.type})`);
            
        } catch (err) {
            console.error(`[PhysicalPrinterAdapter] Failed to initialize ${config.name}:`, err.message);
        }
    }
    
    startForwardingWorker() {
        console.log('[PhysicalPrinterAdapter] Starting forwarding worker');
        
        // Poll queue every 2 seconds
        this.workerInterval = setInterval(() => {
            this.processForwardQueue();
        }, 2000);
    }
    
    async processForwardQueue() {
        if (this.forwardQueue.length === 0) {
            return;
        }
        
        const job = this.forwardQueue[0]; // Peek at first job (FIFO)
        
        try {
            const startTime = Date.now();
            
            // Forward job to physical printer
            await this.forwardJob(job);
            
            const forwardTime = Date.now() - startTime;
            
            // Update statistics
            this.stats.jobsForwarded++;
            this.stats.avgForwardTime = 
                (this.stats.avgForwardTime * (this.stats.jobsForwarded - 1) + forwardTime) / 
                this.stats.jobsForwarded;
            
            // Remove from queue
            this.forwardQueue.shift();
            this.stats.queueDepth = this.forwardQueue.length;
            
            console.log(`[PhysicalPrinterAdapter] Forwarded job ${job.jobId} in ${forwardTime}ms (${this.forwardQueue.length} remaining)`);
            
            this.emit('jobForwarded', { jobId: job.jobId, forwardTime });
            
        } catch (err) {
            console.error(`[PhysicalPrinterAdapter] Forward failed for job ${job.jobId}:`, err.message);
            
            // Increment retry count
            job.forwardAttempts = (job.forwardAttempts || 0) + 1;
            job.lastForwardError = err.message;
            
            if (job.forwardAttempts >= 5) {
                // Move to failed queue after 5 attempts
                this.forwardQueue.shift();
                this.stats.jobsFailed++;
                this.stats.queueDepth = this.forwardQueue.length;
                
                console.error(`[PhysicalPrinterAdapter] Job ${job.jobId} failed after 5 attempts - moving to failed queue`);
                
                await this.moveToFailedQueue(job);
                
                this.emit('jobFailed', { jobId: job.jobId, error: err.message });
            } else {
                // Exponential backoff: 5s, 10s, 20s, 40s
                const backoffDelay = 5000 * Math.pow(2, job.forwardAttempts - 1);
                
                console.log(`[PhysicalPrinterAdapter] Retry ${job.forwardAttempts}/5 for job ${job.jobId} in ${backoffDelay}ms`);
                
                // Move to end of queue for retry
                this.forwardQueue.shift();
                this.forwardQueue.push(job);
                
                // Wait before next attempt
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    
    async forwardJob(job) {
        // Get default printer from config
        const defaultPrinter = this.getDefaultPrinter();
        
        if (!defaultPrinter) {
            throw new Error('No default printer configured');
        }
        
        console.log(`[PhysicalPrinterAdapter] Forwarding job ${job.jobId} to ${defaultPrinter.name}`);
        
        // Check printer status
        const status = await defaultPrinter.connection.getStatus();
        
        if (!status.ready) {
            throw new Error(`Printer not ready: ${status.errorMessage || 'Unknown error'}`);
        }
        
        if (status.paperOut) {
            throw new Error('Printer out of paper');
        }
        
        // Send raw data to printer
        const bytesSent = await defaultPrinter.connection.send(job.rawData);
        
        console.log(`[PhysicalPrinterAdapter] Job ${job.jobId} forwarded successfully (${bytesSent} bytes)`);
    }
    
    getDefaultPrinter() {
        // Return first enabled printer marked as default
        for (const [name, printer] of this.printers.entries()) {
            if (printer.enabled && printer.isDefault) {
                return { name, ...printer };
            }
        }
        
        // If no default, return first enabled printer
        for (const [name, printer] of this.printers.entries()) {
            if (printer.enabled) {
                return { name, ...printer };
            }
        }
        
        return null;
    }
    
    async moveToFailedQueue(job) {
        try {
            const failedDir = path.join('C:\\TabezaPrints', 'failed_prints');
            await fs.mkdir(failedDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const failedFile = path.join(failedDir, `${timestamp}_${job.jobId}.json`);
            
            await fs.writeFile(failedFile, JSON.stringify(job, null, 2), 'utf8');
            
            console.log(`[PhysicalPrinterAdapter] Moved failed job to: ${failedFile}`);
        } catch (err) {
            console.error(`[PhysicalPrinterAdapter] Error moving job to failed queue:`, err.message);
        }
    }
    
    enqueueJob(job) {
        this.forwardQueue.push(job);
        this.stats.jobsReceived++;
        this.stats.queueDepth = this.forwardQueue.length;
        
        console.log(`[PhysicalPrinterAdapter] Enqueued job ${job.jobId} (queue depth: ${this.forwardQueue.length})`);
        
        this.emit('jobEnqueued', { jobId: job.jobId, queueDepth: this.forwardQueue.length });
    }
    
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            queueDepth: this.forwardQueue.length,
            printersConfigured: this.printers.size
        };
    }
    
    getQueue() {
        return [...this.forwardQueue];
    }
    
    clearQueue() {
        const count = this.forwardQueue.length;
        this.forwardQueue = [];
        this.stats.queueDepth = 0;
        
        console.log(`[PhysicalPrinterAdapter] Cleared queue (${count} jobs removed)`);
        
        return count;
    }
    
    async getFailedJobs() {
        try {
            const failedDir = path.join('C:\\TabezaPrints', 'failed_prints');
            
            // Check if directory exists
            try {
                await fs.access(failedDir);
            } catch (err) {
                // Directory doesn't exist, return empty array
                return [];
            }
            
            const files = await fs.readdir(failedDir);
            const failedJobs = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(failedDir, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const job = JSON.parse(content);
                        
                        failedJobs.push({
                            filename: file,
                            jobId: job.jobId,
                            timestamp: job.timestamp,
                            forwardAttempts: job.forwardAttempts,
                            lastForwardError: job.lastForwardError,
                            dataSize: job.rawData ? Buffer.from(job.rawData).length : 0
                        });
                    } catch (err) {
                        console.error(`[PhysicalPrinterAdapter] Error reading failed job ${file}:`, err.message);
                    }
                }
            }
            
            // Sort by timestamp (newest first)
            failedJobs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return failedJobs;
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] Error getting failed jobs:', err.message);
            return [];
        }
    }
    
    async retryFailedJobs() {
        try {
            const failedDir = path.join('C:\\TabezaPrints', 'failed_prints');
            
            // Check if directory exists
            try {
                await fs.access(failedDir);
            } catch (err) {
                // Directory doesn't exist, nothing to retry
                return { success: true, retriedCount: 0, message: 'No failed jobs found' };
            }
            
            const files = await fs.readdir(failedDir);
            let retriedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(failedDir, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const job = JSON.parse(content);
                        
                        // Reset retry counter and error
                        job.forwardAttempts = 0;
                        job.lastForwardError = null;
                        
                        // Re-enqueue the job
                        this.enqueueJob(job);
                        
                        // Delete the failed job file
                        await fs.unlink(filePath);
                        
                        retriedCount++;
                        
                        console.log(`[PhysicalPrinterAdapter] Re-queued failed job: ${job.jobId}`);
                    } catch (err) {
                        console.error(`[PhysicalPrinterAdapter] Error retrying failed job ${file}:`, err.message);
                    }
                }
            }
            
            return {
                success: true,
                retriedCount,
                message: `Successfully re-queued ${retriedCount} failed job(s)`
            };
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] Error retrying failed jobs:', err.message);
            return {
                success: false,
                retriedCount: 0,
                message: `Error: ${err.message}`
            };
        }
    }
    
    async detectPrinters() {
        console.log('[PhysicalPrinterAdapter] Scanning for printers...');
        
        const detected = [];
        
        // Detect USB printers
        try {
            const usbPrinters = await this.detectUSBPrinters();
            detected.push(...usbPrinters);
            console.log(`[PhysicalPrinterAdapter] Found ${usbPrinters.length} USB printer(s)`);
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] USB detection failed:', err.message);
        }
        
        // Detect network printers (scan common IPs)
        try {
            const networkPrinters = await this.detectNetworkPrinters();
            detected.push(...networkPrinters);
            console.log(`[PhysicalPrinterAdapter] Found ${networkPrinters.length} network printer(s)`);
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] Network detection failed:', err.message);
        }
        
        // Detect serial printers
        try {
            const serialPrinters = await this.detectSerialPrinters();
            detected.push(...serialPrinters);
            console.log(`[PhysicalPrinterAdapter] Found ${serialPrinters.length} serial printer(s)`);
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] Serial detection failed:', err.message);
        }
        
        console.log(`[PhysicalPrinterAdapter] Total printers detected: ${detected.length}`);
        
        return detected;
    }
    
    async detectUSBPrinters() {
        const usb = require('usb');
        const detected = [];
        
        try {
            const devices = usb.getDeviceList();
            
            for (const device of devices) {
                const descriptor = device.deviceDescriptor;
                
                // Check if device is a printer (class 0x07)
                if (descriptor.bDeviceClass === 0x07 || 
                    (descriptor.bDeviceClass === 0x00 && await this.isPrinterInterface(device))) {
                    
                    let name = `USB Printer ${descriptor.idVendor}:${descriptor.idProduct}`;
                    
                    // Try to get device name
                    try {
                        device.open();
                        if (descriptor.iProduct) {
                            name = await new Promise((resolve) => {
                                device.getStringDescriptor(descriptor.iProduct, (err, data) => {
                                    device.close();
                                    resolve(err ? name : data);
                                });
                            });
                        } else {
                            device.close();
                        }
                    } catch (err) {
                        // Ignore errors getting name
                    }
                    
                    detected.push({
                        name,
                        type: 'usb',
                        connection: {
                            vendorId: descriptor.idVendor,
                            productId: descriptor.idProduct
                        }
                    });
                }
            }
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] USB scan error:', err.message);
        }
        
        return detected;
    }
    
    async isPrinterInterface(device) {
        try {
            device.open();
            const config = device.configDescriptor;
            const hasPrinterInterface = config.interfaces.some(iface => 
                iface.some(alt => alt.bInterfaceClass === 0x07)
            );
            device.close();
            return hasPrinterInterface;
        } catch (err) {
            return false;
        }
    }
    
    async detectNetworkPrinters() {
        const net = require('net');
        const os = require('os');
        const detected = [];
        
        // Get local network subnet
        const interfaces = os.networkInterfaces();
        const subnets = [];
        
        for (const name in interfaces) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    const parts = iface.address.split('.');
                    const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
                    if (!subnets.includes(subnet)) {
                        subnets.push(subnet);
                    }
                }
            }
        }
        
        // Scan common printer IPs in each subnet
        const commonIPs = [100, 101, 102, 150, 200, 250];
        const scanPromises = [];
        
        for (const subnet of subnets) {
            for (const lastOctet of commonIPs) {
                const ip = `${subnet}.${lastOctet}`;
                scanPromises.push(this.checkNetworkPrinter(ip, 9100));
            }
        }
        
        const results = await Promise.allSettled(scanPromises);
        
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                detected.push(result.value);
            }
        }
        
        return detected;
    }
    
    async checkNetworkPrinter(host, port) {
        return new Promise((resolve) => {
            const socket = new (require('net')).Socket();
            const timeout = 100; // 100ms timeout for fast scanning
            
            socket.setTimeout(timeout);
            
            socket.on('connect', async () => {
                // Send ESC/POS identity query
                const identityQuery = Buffer.from([0x1D, 0x49, 0x01]); // GS I 1
                socket.write(identityQuery);
                
                // Wait for response
                socket.once('data', (data) => {
                    socket.destroy();
                    resolve({
                        name: `Network Printer at ${host}`,
                        type: 'network',
                        connection: { host, port }
                    });
                });
                
                setTimeout(() => {
                    socket.destroy();
                    resolve({
                        name: `Network Printer at ${host}`,
                        type: 'network',
                        connection: { host, port }
                    });
                }, 500);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(null);
            });
            
            socket.on('error', () => {
                socket.destroy();
                resolve(null);
            });
            
            socket.connect(port, host);
        });
    }
    
    async detectSerialPrinters() {
        const { SerialPort } = require('serialport');
        const detected = [];
        
        try {
            const ports = await SerialPort.list();
            
            for (const port of ports) {
                // Check if it's likely a printer (has manufacturer info or is a COM port)
                if (port.manufacturer || port.path.startsWith('COM')) {
                    detected.push({
                        name: `Serial Printer on ${port.path}`,
                        type: 'serial',
                        connection: {
                            portName: port.path,
                            baudRate: 9600
                        },
                        info: {
                            manufacturer: port.manufacturer,
                            serialNumber: port.serialNumber,
                            vendorId: port.vendorId,
                            productId: port.productId
                        }
                    });
                }
            }
        } catch (err) {
            console.error('[PhysicalPrinterAdapter] Serial scan error:', err.message);
        }
        
        return detected;
    }
}

module.exports = PhysicalPrinterAdapter;
