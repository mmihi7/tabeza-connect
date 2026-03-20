// printer-adapter.js
// Physical Printer Adapter - Forwards captured print jobs to physical printers
// Part of the virtual printer capture architecture

const EventEmitter = require('events');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const USBPrinterConnection = require('./connections/usb-printer');
const NetworkPrinterConnection = require('./connections/network-printer');
const SerialPrinterConnection = require('./connections/serial-printer');
const WindowsPrinterConnection = require('./connections/win-printer');
const { forPrefix } = require('../utils/logger');

const fwdLog = forPrefix('[FORWARD]');

// Debug logging to file (kept for low-level diagnostics)
const debugFile = 'C:\\TabezaPrints\\adapter-debug.log';
function debugLog(msg) {
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(debugFile, `[${timestamp}] ${msg}\n`);
    } catch (e) {}
}

debugLog('=== Printer Adapter Module Loaded ===');

class PhysicalPrinterAdapter extends EventEmitter {
    constructor(config = {}) {
        super();
        
        debugLog('CONSTRUCTOR - Called with config');
        debugLog('CONSTRUCTOR - Config has printers: ' + !!(config && config.printers));
        if (config && config.printers) {
            debugLog('CONSTRUCTOR - Printers count: ' + config.printers.length);
            debugLog('CONSTRUCTOR - Printers: ' + JSON.stringify(config.printers));
        }
        
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
        
        debugLog('CONSTRUCTOR - Completed');
    }
    
    async start() {
        debugLog('START - Method called');
        if (this.isRunning) {
            debugLog('START - Already running');
            fwdLog.warn('Already running');
            return;
        }
        
        fwdLog.step('Starting PhysicalPrinterAdapter...');
        debugLog('START - Beginning startup');
        
        try {
            debugLog('START - Loading printer config');
            await this.loadPrinterConfig();
            
            debugLog('START - Starting config watcher');
            this.startConfigWatcher();
            
            this.isRunning = true;
            debugLog('START - Starting forwarding worker');
            this.startForwardingWorker();
            
            fwdLog.ok('PhysicalPrinterAdapter started');
            debugLog('START - Completed successfully');
            this.emit('started');
        } catch (error) {
            debugLog('START - ERROR: ' + error.message);
            debugLog('START - Stack: ' + error.stack);
            fwdLog.error('Failed to start', error.message);
            throw error;
        }
    }
    
    async stop() {
        debugLog('STOP - Method called');
        if (!this.isRunning) {
            debugLog('STOP - Not running');
            fwdLog.warn('Not running');
            return;
        }
        
        fwdLog.step('Stopping PhysicalPrinterAdapter...');
        debugLog('STOP - Beginning shutdown');
        
        this.isRunning = false;
        
        if (this.configWatcher) {
            debugLog('STOP - Closing config watcher');
            this.configWatcher.close();
            this.configWatcher = null;
        }
        
        this._workerRunning = false;
        
        debugLog('STOP - Closing printer connections. Count: ' + this.printers.size);
        for (const [name, printer] of this.printers.entries()) {
            try {
                if (printer.connection && printer.connection.disconnect) {
                    debugLog('STOP - Disconnecting printer: ' + name);
                    await printer.connection.disconnect();
                }
            } catch (err) {
                debugLog('STOP - Error disconnecting ' + name + ': ' + err.message);
                fwdLog.error(`Error disconnecting ${name}`, err.message);
            }
        }
        
        this.printers.clear();
        debugLog('STOP - Printers cleared');
        
        fwdLog.ok('PhysicalPrinterAdapter stopped');
        debugLog('STOP - Completed');
        this.emit('stopped');
    }
    
    /**
     * Start watching config.json for changes
     */
    startConfigWatcher() {
        debugLog('CONFIG WATCHER - Starting');
        const chokidar = require('chokidar');
        const configPath = path.join('C:\\TabezaPrints', 'config.json');
        
        console.log('[PhysicalPrinterAdapter] Starting config file watcher');
        debugLog('CONFIG WATCHER - Watching: ' + configPath);
        
        this.configWatcher = chokidar.watch(configPath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        
        this.configWatcher.on('change', async () => {
            debugLog('CONFIG WATCHER - File changed');
            fwdLog.info('Config file changed, reloading...');
            try {
                await this.reloadConfig();
                debugLog('CONFIG WATCHER - Reload completed');
            } catch (err) {
                debugLog('CONFIG WATCHER - Reload error: ' + err.message);
                fwdLog.error('Error reloading config', err.message);
            }
        });
        
        this.configWatcher.on('error', (error) => {
            debugLog('CONFIG WATCHER - Error: ' + error.message);
            fwdLog.error('Config watcher error', error.message);
        });
        
        debugLog('CONFIG WATCHER - Started');
    }
    
    async loadPrinterConfig() {
        // Prefer printers already in the constructor config (passed from IntegratedCaptureService)
        if (this.config && Array.isArray(this.config.printers) && this.config.printers.length > 0) {
            debugLog('LOAD CONFIG - Using printers from constructor config, count: ' + this.config.printers.length);
            fwdLog.info(`Using ${this.config.printers.length} printer(s) from service config`);
            for (const printerConfig of this.config.printers) {
                if (printerConfig.enabled !== false) {
                    await this.initializePrinter(printerConfig);
                }
            }
            return;
        }

        // Fall back to reading config.json from disk
        const configPath = path.join('C:\\TabezaPrints', 'config.json');
        debugLog('LOAD CONFIG - Path: ' + configPath);
        
        try {
            debugLog('LOAD CONFIG - Reading file');
            const configData = await fsp.readFile(configPath, 'utf8');
            debugLog('LOAD CONFIG - File read, size: ' + configData.length + ' bytes');
            
            const config = JSON.parse(configData);
            debugLog('LOAD CONFIG - JSON parsed successfully');
            debugLog('LOAD CONFIG - Has printers property: ' + !!(config && config.printers));
            
            if (config.printers && Array.isArray(config.printers)) {
                debugLog('LOAD CONFIG - Printers array found, length: ' + config.printers.length);
                fwdLog.info(`Loaded ${config.printers.length} printer(s) from config`);
                
                for (let i = 0; i < config.printers.length; i++) {
                    debugLog('LOAD CONFIG - Printer ' + i + ': ' + JSON.stringify(config.printers[i]));
                }
                
                debugLog('LOAD CONFIG - Initializing printers');
                for (const printerConfig of config.printers) {
                    if (printerConfig.enabled !== false) {
                        await this.initializePrinter(printerConfig);
                    } else {
                        debugLog('LOAD CONFIG - Printer ' + printerConfig.name + ' is disabled, skipping');
                    }
                }
                debugLog('LOAD CONFIG - Printer initialization complete');
            } else {
                debugLog('LOAD CONFIG - No printers array in config or not an array');
                fwdLog.warn('No printers configured');
            }
        } catch (err) {
            debugLog('LOAD CONFIG - ERROR: ' + err.message);
            debugLog('LOAD CONFIG - Stack: ' + err.stack);
            if (err.code === 'ENOENT') {
                fwdLog.warn('No config file found — using defaults');
            } else {
                fwdLog.error('Error loading config', err.message);
            }
        }
    }
    
    /**
     * Reload printer configuration from config.json
     * Closes existing connections and reinitializes printers
     */
    async reloadConfig() {
        debugLog('RELOAD CONFIG - Starting');
        fwdLog.step('Reloading configuration...');
        
        debugLog('RELOAD CONFIG - Closing existing connections. Count: ' + this.printers.size);
        for (const [name, printer] of this.printers.entries()) {
            try {
                if (printer.connection && printer.connection.disconnect) {
                    debugLog('RELOAD CONFIG - Disconnecting: ' + name);
                    await printer.connection.disconnect();
                }
            } catch (err) {
                debugLog('RELOAD CONFIG - Error disconnecting ' + name + ': ' + err.message);
                fwdLog.error(`Error disconnecting ${name}`, err.message);
            }
        }
        
        this.printers.clear();
        debugLog('RELOAD CONFIG - Printers map cleared');
        
        await this.loadPrinterConfig();
        
        fwdLog.ok('Configuration reloaded');
        debugLog('RELOAD CONFIG - Completed');
        this.emit('configReloaded');
    }
    
    async initializePrinter(config) {
        debugLog('INIT PRINTER - Starting for: ' + config.name);
        debugLog('INIT PRINTER - Type: ' + config.type);
        debugLog('INIT PRINTER - Config: ' + JSON.stringify(config));
        
        try {
            let connection;
            
            switch (config.type) {
                case 'usb':
                    debugLog('INIT PRINTER - Creating USB connection');
                    connection = new USBPrinterConnection(config.connection);
                    break;
                case 'network':
                    debugLog('INIT PRINTER - Creating network connection');
                    connection = new NetworkPrinterConnection(config.connection);
                    break;
                case 'serial':
                    debugLog('INIT PRINTER - Creating serial connection');
                    connection = new SerialPrinterConnection(config.connection);
                    break;
		case 'windows':
                    debugLog('INIT PRINTER - Creating Windows printer connection');
                    connection = new WindowsPrinterConnection({ printerName: config.name });
                    break;
                default:
                    debugLog('INIT PRINTER - Unknown type: ' + config.type);
                    throw new Error(`Unknown printer type: ${config.type}`);
            }
            
            debugLog('INIT PRINTER - Connection object created, connecting...');
            await connection.connect();
            debugLog('INIT PRINTER - Connected successfully');
            
            this.printers.set(config.name, {
                connection,
                config,
                enabled: true,
                isDefault: config.isDefault || false
            });
            
            debugLog('INIT PRINTER - Stored in map. Map size now: ' + this.printers.size);
            fwdLog.ok(`Initialized printer: ${config.name} (${config.type})`);
            
        } catch (err) {
            debugLog('INIT PRINTER - ERROR: ' + err.message);
            debugLog('INIT PRINTER - Stack: ' + err.stack);
            fwdLog.error(`Failed to initialize ${config.name}`, err.message);
        }
    }
    
    startForwardingWorker() {
        debugLog('FORWARD WORKER - Starting');
        fwdLog.step('Starting forwarding worker (poll: 2000ms)');
        this._workerRunning = true;
        this._runWorkerLoop();
    }

    async _runWorkerLoop() {
        while (this._workerRunning) {
            if (this.forwardQueue.length > 0) {
                await this.processForwardQueue();
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async processForwardQueue() {
        if (this.forwardQueue.length === 0) return;

        const job = this.forwardQueue[0];
        debugLog('PROCESS QUEUE - Processing job: ' + job.jobId + ', queue depth: ' + this.forwardQueue.length);
        fwdLog.step(`Processing jobId=${job.jobId} (queue depth: ${this.forwardQueue.length})`);

        try {
            const startTime = Date.now();
            await this.forwardJob(job);
            const forwardTime = Date.now() - startTime;

            this.stats.jobsForwarded++;
            this.stats.avgForwardTime =
                (this.stats.avgForwardTime * (this.stats.jobsForwarded - 1) + forwardTime) /
                this.stats.jobsForwarded;

            this.forwardQueue.shift();
            this.stats.queueDepth = this.forwardQueue.length;

            fwdLog.ok(`Forwarded jobId=${job.jobId} in ${forwardTime}ms (${this.forwardQueue.length} remaining)`);
            this.emit('jobForwarded', { jobId: job.jobId, forwardTime });

        } catch (err) {
            debugLog('PROCESS QUEUE - Forward failed: ' + err.message);
            fwdLog.error(`Forward failed for jobId=${job.jobId}: ${err.message}`);

            job.forwardAttempts = (job.forwardAttempts || 0) + 1;
            job.lastForwardError = err.message;

            if (job.forwardAttempts >= 5) {
                this.forwardQueue.shift();
                this.stats.jobsFailed++;
                this.stats.queueDepth = this.forwardQueue.length;
                fwdLog.error(`jobId=${job.jobId} failed after 5 attempts — moving to failed queue`);
                await this.moveToFailedQueue(job);
                this.emit('jobFailed', { jobId: job.jobId, error: err.message });
            } else {
                const backoffDelay = 5000 * Math.pow(2, job.forwardAttempts - 1);
                fwdLog.warn(`Retry ${job.forwardAttempts}/5 for jobId=${job.jobId} in ${backoffDelay}ms`);
                this.forwardQueue.shift();
                this.forwardQueue.push(job);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    
    async forwardJob(job) {
        debugLog('FORWARD JOB - Getting default printer');
        const defaultPrinter = this.getDefaultPrinter();
        
        if (!defaultPrinter) {
            debugLog('FORWARD JOB - No default printer configured');
            throw new Error('No default printer configured');
        }
        
        debugLog('FORWARD JOB - Default printer: ' + defaultPrinter.name);
        fwdLog.step(`Forwarding jobId=${job.jobId} → ${defaultPrinter.name}`);
        
        debugLog('FORWARD JOB - Checking printer status');
        const status = await defaultPrinter.connection.getStatus();
        debugLog('FORWARD JOB - Status: ' + JSON.stringify(status));
        
        if (!status.ready) {
            debugLog('FORWARD JOB - Printer not ready: ' + (status.errorMessage || 'Unknown'));
            throw new Error(`Printer not ready: ${status.errorMessage || 'Unknown error'}`);
        }
        
        if (status.paperOut) {
            debugLog('FORWARD JOB - Printer out of paper');
            throw new Error('Printer out of paper');
        }
        
        debugLog('FORWARD JOB - Sending data, size: ' + job.rawData.length + ' bytes');
        const bytesSent = await defaultPrinter.connection.send(job.rawData);
        
        debugLog('FORWARD JOB - Sent ' + bytesSent + ' bytes successfully');
        fwdLog.ok(`jobId=${job.jobId} sent ${bytesSent} bytes to ${defaultPrinter.name}`);
    }
    
    getDefaultPrinter() {
        debugLog('GET DEFAULT - Called, printers in map: ' + this.printers.size);
        
        // List all printers in map
        for (const [name, printer] of this.printers.entries()) {
            debugLog('GET DEFAULT - Printer in map: ' + name + ', enabled: ' + printer.enabled + ', isDefault: ' + printer.isDefault);
        }
        
        // Return first enabled printer marked as default
        for (const [name, printer] of this.printers.entries()) {
            if (printer.enabled && printer.isDefault) {
                debugLog('GET DEFAULT - Found default printer: ' + name);
                return { name, ...printer };
            }
        }
        
        // If no default, return first enabled printer
        for (const [name, printer] of this.printers.entries()) {
            if (printer.enabled) {
                debugLog('GET DEFAULT - No default, using first enabled: ' + name);
                return { name, ...printer };
            }
        }
        
        debugLog('GET DEFAULT - No printers found in map');
        return null;
    }
    
    async moveToFailedQueue(job) {
        debugLog('MOVE TO FAILED - Job: ' + job.jobId);
        try {
            const failedDir = path.join('C:\\TabezaPrints', 'failed_prints');
            await fsp.mkdir(failedDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const failedFile = path.join(failedDir, `${timestamp}_${job.jobId}.json`);
            
            await fsp.writeFile(failedFile, JSON.stringify(job, null, 2), 'utf8');
            
            debugLog('MOVE TO FAILED - Moved to: ' + failedFile);
            console.log(`[PhysicalPrinterAdapter] Moved failed job to: ${failedFile}`);
        } catch (err) {
            debugLog('MOVE TO FAILED - Error: ' + err.message);
            console.error(`[PhysicalPrinterAdapter] Error moving job to failed queue:`, err.message);
        }
    }
    
    enqueueJob(job) {
        debugLog('ENQUEUE - Job: ' + job.jobId + ', current queue depth: ' + this.forwardQueue.length);

        // Deduplicate: if this jobId is already queued, skip it
        const alreadyQueued = this.forwardQueue.some(j => j.jobId === job.jobId);
        if (alreadyQueued) {
            debugLog('ENQUEUE - DUPLICATE SKIPPED: jobId=' + job.jobId + ' already in queue');
            fwdLog.warn(`Duplicate jobId=${job.jobId} ignored — already in queue`);
            return;
        }

        this.forwardQueue.push(job);
        this.stats.jobsReceived++;
        this.stats.queueDepth = this.forwardQueue.length;

        fwdLog.step(`Enqueued jobId=${job.jobId} — queue depth: ${this.forwardQueue.length}`);
        debugLog('ENQUEUE - New queue depth: ' + this.forwardQueue.length);

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
        debugLog('CLEAR QUEUE - Removed ' + count + ' jobs');
        
        return count;
    }
    
    async getFailedJobs() {
        try {
            const failedDir = path.join('C:\\TabezaPrints', 'failed_prints');
            
            // Check if directory exists
            try {
                await fsp.access(failedDir);
            } catch (err) {
                // Directory doesn't exist, return empty array
                return [];
            }
            
            const files = await fsp.readdir(failedDir);
            const failedJobs = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(failedDir, file);
                        const content = await fsp.readFile(filePath, 'utf8');
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
                await fsp.access(failedDir);
            } catch (err) {
                // Directory doesn't exist, nothing to retry
                return { success: true, retriedCount: 0, message: 'No failed jobs found' };
            }
            
            const files = await fsp.readdir(failedDir);
            let retriedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(failedDir, file);
                        const content = await fsp.readFile(filePath, 'utf8');
                        const job = JSON.parse(content);
                        
                        // Reset retry counter and error
                        job.forwardAttempts = 0;
                        job.lastForwardError = null;
                        
                        // Re-enqueue the job
                        this.enqueueJob(job);
                        
                        // Delete the failed job file
                        await fsp.unlink(filePath);
                        
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

