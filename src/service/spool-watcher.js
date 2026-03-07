// spool-watcher.js
// Monitors C:\TabezaPrints\spool\ for new print jobs from clawPDF
// Part of the clawPDF-based virtual printer capture architecture

const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class SpoolWatcher extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.spoolFolder = config.spoolFolder || 'C:\\TabezaPrints\\spool';
        this.stabilizationDelay = config.stabilizationDelay || 500; // ms to wait after file creation
        this.filePattern = config.filePattern || /\.ps$/i; // PostScript files from clawPDF
        this.isRunning = false;
        this.watcher = null;
        this.processingFiles = new Set(); // Track files currently being processed
        this.processedFiles = new Set(); // Track files already processed
        this.stabilizationTimers = new Map(); // Track stabilization timers
        
        // Forwarding queue (FIFO) - Phase 3 will implement the full adapter
        // For now, this is a simple in-memory queue accessible to the forwarding worker
        this.forwardQueue = []; // Array of jobs awaiting forwarding to physical printer
        
        this.stats = {
            filesDetected: 0,
            filesProcessed: 0,
            filesFailed: 0,
            lastFileAt: null,
            jobsQueued: 0,
            queueDepth: 0
        };
    }
    
    /**
     * Start watching the spool folder
     */
    async start() {
        if (this.isRunning) {
            console.log('[SpoolWatcher] Already running');
            return;
        }
        
        try {
            // Ensure spool folder exists
            await fs.mkdir(this.spoolFolder, { recursive: true });
            console.log(`[SpoolWatcher] Spool folder ready: ${this.spoolFolder}`);
            
            // Initialize chokidar watcher
            this.watcher = chokidar.watch(this.spoolFolder, {
                ignored: /(^|[\/\\])\../, // Ignore dotfiles
                persistent: true,
                ignoreInitial: false, // Process existing files on startup
                awaitWriteFinish: {
                    stabilityThreshold: this.stabilizationDelay,
                    pollInterval: 100
                },
                depth: 0 // Only watch the spool folder, not subdirectories
            });
            
            // Set up event handlers
            this.watcher
                .on('add', (filePath) => this.handleFileAdded(filePath))
                .on('error', (error) => this.handleError(error))
                .on('ready', () => {
                    this.isRunning = true;
                    console.log('[SpoolWatcher] Ready and watching for print jobs');
                    this.emit('ready');
                });
            
        } catch (error) {
            console.error('[SpoolWatcher] Failed to start:', error);
            throw error;
        }
    }
    
    /**
     * Stop watching the spool folder
     */
    async stop() {
        if (!this.isRunning) {
            console.log('[SpoolWatcher] Not running');
            return;
        }
        
        try {
            // Clear all stabilization timers
            for (const timer of this.stabilizationTimers.values()) {
                clearTimeout(timer);
            }
            this.stabilizationTimers.clear();
            
            // Close watcher
            if (this.watcher) {
                await this.watcher.close();
                this.watcher = null;
            }
            
            this.isRunning = false;
            console.log('[SpoolWatcher] Stopped');
            this.emit('stopped');
            
        } catch (error) {
            console.error('[SpoolWatcher] Error during stop:', error);
            throw error;
        }
    }
    
    /**
     * Handle new file detected in spool folder
     */
    async handleFileAdded(filePath) {
        const fileName = path.basename(filePath);
        
        // Check if file matches pattern (e.g., .ps files)
        if (!this.filePattern.test(fileName)) {
            console.log(`[SpoolWatcher] Ignoring non-matching file: ${fileName}`);
            return;
        }
        
        // Skip if already processed or currently processing
        if (this.processedFiles.has(filePath) || this.processingFiles.has(filePath)) {
            console.log(`[SpoolWatcher] Skipping already processed/processing file: ${fileName}`);
            return;
        }
        
        this.stats.filesDetected++;
        this.stats.lastFileAt = new Date().toISOString();
        
        console.log(`[SpoolWatcher] New print job detected: ${fileName}`);
        
        // Mark as processing
        this.processingFiles.add(filePath);
        
        try {
            // Wait for file to stabilize (ensure clawPDF finished writing)
            console.log(`[SpoolWatcher] Waiting for file to stabilize: ${fileName}`);
            await this.waitForFileStable(filePath);
            
            // Check if file is still locked by another process
            const isLocked = await this.isFileLocked(filePath);
            if (isLocked) {
                console.warn(`[SpoolWatcher] File is locked, waiting additional time: ${fileName}`);
                // Wait a bit more and try again
                await new Promise(resolve => setTimeout(resolve, 200));
                
                const stillLocked = await this.isFileLocked(filePath);
                if (stillLocked) {
                    throw new Error(`File remains locked after stabilization: ${fileName}`);
                }
            }
            
            // Check if file still exists and is accessible
            const fileStats = await fs.stat(filePath);
            
            if (fileStats.size === 0) {
                console.warn(`[SpoolWatcher] Skipping empty file: ${fileName}`);
                this.processingFiles.delete(filePath);
                return;
            }
            
            console.log(`[SpoolWatcher] File ready for processing: ${fileName} (${fileStats.size} bytes)`);
            
            // Process the spool file
            const result = await this.handleSpoolFile({
                filePath,
                fileName,
                size: fileStats.size,
                timestamp: new Date().toISOString()
            });
            
            if (result.success) {
                // Mark as processed
                this.processedFiles.add(filePath);
                this.stats.filesProcessed++;
                
                console.log(`[SpoolWatcher] Successfully processed: ${fileName}`);
                
                // Emit success event with result details
                this.emit('printJobProcessed', result);
            } else {
                // Processing failed
                this.stats.filesFailed++;
                console.error(`[SpoolWatcher] Failed to process: ${fileName}`);
                
                // Emit error event
                this.emit('error', { 
                    filePath, 
                    fileName, 
                    error: result.error 
                });
            }
            
        } catch (error) {
            console.error(`[SpoolWatcher] Error processing file ${fileName}:`, error.message);
            this.stats.filesFailed++;
            this.emit('error', { filePath, fileName, error: error.message });
        } finally {
            this.processingFiles.delete(filePath);
        }
    }
    
    /**
     * Wait for file to be stable (no longer being written)
     */
    async waitForFileStable(filePath) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.stabilizationTimers.delete(filePath);
                resolve();
            }, this.stabilizationDelay);
            
            this.stabilizationTimers.set(filePath, timer);
        });
    }
    
    /**
     * Check if file is locked (being written by another process)
     */
    async isFileLocked(filePath) {
        try {
            const fileHandle = await fs.open(filePath, 'r+');
            await fileHandle.close();
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') {
                return true;
            }
            throw error;
        }
    }
    
    /**
     * Handle watcher errors
     */
    handleError(error) {
        console.error('[SpoolWatcher] Watcher error:', error);
        this.emit('error', error);
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            processingCount: this.processingFiles.size,
            processedCount: this.processedFiles.size,
            queueDepth: this.forwardQueue.length
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            filesDetected: 0,
            filesProcessed: 0,
            filesFailed: 0,
            lastFileAt: null,
            jobsQueued: 0,
            queueDepth: 0
        };
        this.processedFiles.clear();
    }
    
    /**
     * Get forwarding queue
     * Accessible to the PhysicalPrinterAdapter (Phase 3)
     * @returns {Array} Array of jobs awaiting forwarding
     */
    getForwardQueue() {
        return this.forwardQueue;
    }
    
    /**
     * Dequeue next job for forwarding
     * FIFO ordering - oldest job first
     * @returns {Object|null} Next job to forward, or null if queue is empty
     */
    dequeueForwardJob() {
        if (this.forwardQueue.length === 0) {
            return null;
        }
        
        const job = this.forwardQueue.shift();
        this.stats.queueDepth = this.forwardQueue.length;
        
        console.log(`[SpoolWatcher] Dequeued job for forwarding: ${job.jobId} (${this.forwardQueue.length} remaining)`);
        
        return job;
    }
    
    /**
     * Clear forwarding queue
     * Used for testing or emergency cleanup
     */
    clearForwardQueue() {
        const count = this.forwardQueue.length;
        this.forwardQueue = [];
        this.stats.queueDepth = 0;
        
        console.log(`[SpoolWatcher] Cleared forwarding queue (${count} jobs removed)`);
        
        return count;
    }
    
    /**
     * Handle spool file processing
     * Implements Requirement 2.2: Process Print Jobs
     * 
     * This method:
     * 1. Reads spool file content (raw PostScript data)
     * 2. Saves as C:\TabezaPrints\order_{timestamp}.prn (overwrite)
     * 3. Archives spool file to processed\ folder with timestamp
     * 4. Queues job for forwarding to physical printer
     * 5. Deletes spool file after successful processing
     * 
     * @param {Object} jobData - Print job data from handleFileAdded
     * @param {string} jobData.filePath - Full path to spool file
     * @param {string} jobData.fileName - Name of spool file
     * @param {number} jobData.size - Size of spool file in bytes
     * @param {string} jobData.timestamp - ISO timestamp when job was detected
     * @returns {Promise<Object>} Processing result with status and details
     */
    async handleSpoolFile(jobData) {
        const { filePath, fileName, size, timestamp } = jobData;
        
        console.log(`[SpoolWatcher] Processing spool file: ${fileName}`);
        
        try {
            // Step 1: Read spool file content (raw PostScript data)
            console.log(`[SpoolWatcher] Reading spool file: ${filePath}`);
            const rawData = await fs.readFile(filePath);
            
            if (rawData.length === 0) {
                throw new Error('Spool file is empty');
            }
            
            if (rawData.length !== size) {
                console.warn(`[SpoolWatcher] File size mismatch: expected ${size}, got ${rawData.length}`);
            }
            
            console.log(`[SpoolWatcher] Read ${rawData.length} bytes from spool file`);
            
            // Step 2: Save as C:\TabezaPrints\order_{timestamp}.prn
            // Format: YYYYMMDD-HHMMSS-mmm (Requirement 2.4)
            const now = new Date();
            const captureTimestamp = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, '0'),
                String(now.getDate()).padStart(2, '0'),
                '-',
                String(now.getHours()).padStart(2, '0'),
                String(now.getMinutes()).padStart(2, '0'),
                String(now.getSeconds()).padStart(2, '0'),
                '-',
                String(now.getMilliseconds()).padStart(3, '0')
            ].join('');
            
            const captureFileName = `order_${captureTimestamp}.prn`;
            const captureFilePath = path.join('C:\\TabezaPrints', captureFileName);
            
            console.log(`[SpoolWatcher] Writing to capture file: ${captureFilePath}`);
            
            // Atomic write: write to temp file, then rename
            const tempFilePath = `${captureFilePath}.tmp`;
            await fs.writeFile(tempFilePath, rawData);
            
            // Rename temp file to final name (atomic operation on Windows)
            try {
                await fs.rename(tempFilePath, captureFilePath);
            } catch (renameErr) {
                // If rename fails, try to delete temp file
                try {
                    await fs.unlink(tempFilePath);
                } catch (_) {}
                throw renameErr;
            }
            
            console.log(`[SpoolWatcher] Capture file written: ${captureFileName} (${rawData.length} bytes)`);
            
            // Step 3: Archive spool file to processed\ folder with timestamp
            const processedDir = path.join(path.dirname(filePath), '..', 'processed');
            await fs.mkdir(processedDir, { recursive: true });
            
            const archiveFileName = `${captureTimestamp}_${fileName}`;
            const archiveFilePath = path.join(processedDir, archiveFileName);
            
            console.log(`[SpoolWatcher] Archiving spool file to: ${archiveFilePath}`);
            await fs.copyFile(filePath, archiveFilePath);
            
            console.log(`[SpoolWatcher] Spool file archived: ${archiveFileName}`);
            
            // Step 4: Queue job for forwarding to physical printer
            const forwardJob = {
                jobId: path.parse(fileName).name, // Use spool filename without extension as job ID
                captureFile: captureFilePath,
                captureFileName: captureFileName,
                spoolFile: filePath,
                spoolFileName: fileName,
                archiveFile: archiveFilePath,
                timestamp: timestamp,
                capturedAt: new Date().toISOString(),
                size: rawData.length,
                rawData: rawData // Include raw data for forwarding
            };
            
            console.log(`[SpoolWatcher] Queueing job for forwarding: ${forwardJob.jobId}`);
            
            // Add to forwarding queue (FIFO)
            // The PhysicalPrinterAdapter (Phase 3) will dequeue and forward these jobs
            this.forwardQueue.push(forwardJob);
            this.stats.jobsQueued++;
            this.stats.queueDepth = this.forwardQueue.length;
            
            console.log(`[SpoolWatcher] Job queued for forwarding: ${forwardJob.jobId} (queue depth: ${this.forwardQueue.length})`);
            
            // Emit event for forwarding (printer adapter will listen to this)
            this.emit('forwardJob', forwardJob);
            
            // Step 5: Delete spool file after successful processing
            console.log(`[SpoolWatcher] Deleting spool file: ${filePath}`);
            await fs.unlink(filePath);
            
            console.log(`[SpoolWatcher] Spool file deleted: ${fileName}`);
            
            // Return success result
            const result = {
                success: true,
                jobId: forwardJob.jobId,
                captureFile: captureFilePath,
                archiveFile: archiveFilePath,
                size: rawData.length,
                timestamp: timestamp,
                capturedAt: forwardJob.capturedAt
            };
            
            console.log(`[SpoolWatcher] Successfully processed spool file: ${fileName}`);
            
            return result;
            
        } catch (error) {
            console.error(`[SpoolWatcher] Error processing spool file ${fileName}:`, error.message);
            
            // Move to failed folder if possible
            try {
                const failedDir = path.join(path.dirname(filePath), '..', 'failed');
                await fs.mkdir(failedDir, { recursive: true });
                
                const failedTimestamp = new Date().toISOString()
                    .replace(/[:.]/g, '-')
                    .replace('T', '-')
                    .slice(0, 23)
                    .replace('Z', '');
                
                const failedFileName = `${failedTimestamp}_${fileName}`;
                const failedFilePath = path.join(failedDir, failedFileName);
                
                await fs.copyFile(filePath, failedFilePath);
                await fs.unlink(filePath);
                
                console.log(`[SpoolWatcher] Moved failed spool file to: ${failedFilePath}`);
            } catch (moveErr) {
                console.error(`[SpoolWatcher] Failed to move spool file to failed folder:`, moveErr.message);
            }
            
            // Return error result
            return {
                success: false,
                error: error.message,
                fileName: fileName,
                timestamp: timestamp
            };
        }
    }
}

module.exports = SpoolWatcher;
