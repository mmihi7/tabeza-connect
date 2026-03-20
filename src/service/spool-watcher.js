// spool-watcher.js
// Monitors C:\TabezaPrints\raw\ for new .prn files written by capture.exe (via Redmon)
// Emits forwardJob events so PhysicalPrinterAdapter can print to EPSON L3210 via Windows API
//
// CORE TRUTH: Manual service always exists.
// Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.

'use strict';

const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { forPrefix } = require('../utils/logger');

const log = forPrefix('[SPOOL]');

class SpoolWatcher extends EventEmitter {
    constructor(config = {}) {
        super();

        this.spoolFolder        = config.spoolFolder        || 'C:\\TabezaPrints\\raw';
        this.stabilizationDelay = config.stabilizationDelay || 500;
        this.filePattern        = config.filePattern        || /\.prn$/i;
        this.isRunning          = false;
        this.watcher            = null;
        this.processingFiles    = new Set();
        this.processedFiles     = new Set();
        this.stabilizationTimers = new Map();

        this.stats = {
            filesDetected:  0,
            filesProcessed: 0,
            filesFailed:    0,
            lastFileAt:     null,
            jobsQueued:     0,
            queueDepth:     0,
        };
    }

    async start() {
        if (this.isRunning) {
            log.warn('Already running');
            return;
        }

        await fs.mkdir(this.spoolFolder, { recursive: true });
        log.step(`Watching ${this.spoolFolder} for .prn files`);

        this.watcher = chokidar.watch(this.spoolFolder, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: this.stabilizationDelay,
                pollInterval: 100,
            },
            depth: 0,
        });

        this.watcher
            .on('add',   (filePath) => this.handleFileAdded(filePath))
            .on('error', (error)    => this.handleError(error))
            .on('ready', () => {
                this.isRunning = true;
                log.ok('Ready — waiting for print jobs');
                this.emit('ready');
            });
    }

    async stop() {
        if (!this.isRunning) return;

        for (const timer of this.stabilizationTimers.values()) clearTimeout(timer);
        this.stabilizationTimers.clear();

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }

        this.isRunning = false;
        log.info('Stopped');
        this.emit('stopped');
    }

    async handleFileAdded(filePath) {
        const fileName = path.basename(filePath);

        if (!this.filePattern.test(fileName)) return;
        if (this.processedFiles.has(filePath) || this.processingFiles.has(filePath)) {
            log.warn(`Skipping already processed file: ${fileName}`);
            return;
        }

        // List all .prn files in directory for debugging
        try {
            const allFiles = await fs.readdir(this.spoolFolder);
            const prnFiles = allFiles.filter(f => f.endsWith('.prn'));
            log.info(`📁 Current .prn files: ${prnFiles.join(', ')}`);
        } catch (err) {
            log.error(`Failed to list directory: ${err.message}`);
        }

        this.stats.filesDetected++;
        this.stats.lastFileAt = new Date().toISOString();
        this.processingFiles.add(filePath);
        this.processedFiles.add(filePath); // Mark immediately to block duplicate events

        log.step(`Detected: ${fileName} (total detected: ${this.stats.filesDetected})`);
        log.info(`Processing set size: ${this.processingFiles.size}, Processed set size: ${this.processedFiles.size}`);

        try {
            log.debug(`Stabilising (${this.stabilizationDelay}ms)...`);
            await this.waitForFileStable(filePath);

            const isLocked = await this.isFileLocked(filePath);
            if (isLocked) {
                log.warn(`File locked — waiting 200ms: ${fileName}`);
                await new Promise(resolve => setTimeout(resolve, 200));
                if (await this.isFileLocked(filePath)) {
                    throw new Error(`File remains locked: ${fileName}`);
                }
            }

            const fileStats = await fs.stat(filePath);
            if (fileStats.size === 0) {
                log.warn(`Skipping empty file: ${fileName}`);
                this.processingFiles.delete(filePath);
                return;
            }

            log.info(`Processing: ${fileName} (${fileStats.size} bytes)`);

            const result = await this.handleSpoolFile({
                filePath,
                fileName,
                size: fileStats.size,
                timestamp: new Date().toISOString(),
            });

            if (result.success) {
                this.processedFiles.add(filePath);
                this.stats.filesProcessed++;
                log.ok(`Forwarded jobId=${result.jobId} (${result.size} bytes) → printer queue`);
                this.emit('printJobProcessed', result);
            } else {
                this.stats.filesFailed++;
                log.error(`Failed: ${result.error}`);
                this.emit('error', { filePath, fileName, error: result.error });
            }

        } catch (error) {
            log.error(`Error processing ${fileName}: ${error.message}`);
            this.stats.filesFailed++;
            this.emit('error', { filePath, fileName, error: error.message });
        } finally {
            this.processingFiles.delete(filePath);
        }
    }

    async waitForFileStable(filePath) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.stabilizationTimers.delete(filePath);
                resolve();
            }, this.stabilizationDelay);
            this.stabilizationTimers.set(filePath, timer);
        });
    }

    async isFileLocked(filePath) {
        try {
            const fh = await fs.open(filePath, 'r+');
            await fh.close();
            return false;
        } catch (error) {
            if (error.code === 'EBUSY' || error.code === 'EPERM') return true;
            throw error;
        }
    }

    handleError(error) {
        log.error(`Watcher error: ${error.message || error}`);
        this.emit('error', error);
    }

    /**
     * Process a .prn file from raw\:
     * 1. Read raw bytes
     * 2. Archive to processed\ (timestamped copy)
     * 3. Emit forwardJob → PhysicalPrinterAdapter.enqueueJob()
     * 4. Delete from raw\
     */
    async handleSpoolFile(jobData) {
        const { filePath, fileName, timestamp } = jobData;

        try {
            const rawData = await fs.readFile(filePath);

            if (rawData.length === 0) {
                return { success: false, error: 'Spool file is empty', fileName, timestamp };
            }

            // Timestamped archive filename
            const now = new Date();
            const ts = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, '0'),
                String(now.getDate()).padStart(2, '0'),
                '-',
                String(now.getHours()).padStart(2, '0'),
                String(now.getMinutes()).padStart(2, '0'),
                String(now.getSeconds()).padStart(2, '0'),
                '-',
                String(now.getMilliseconds()).padStart(3, '0'),
            ].join('');

            // Archive to processed\
            const processedDir = path.join(path.dirname(filePath), '..', 'processed');
            await fs.mkdir(processedDir, { recursive: true });
            const archiveFilePath = path.join(processedDir, `${ts}_${fileName}`);
            await fs.copyFile(filePath, archiveFilePath);
            log.info(`Archived → processed\\${ts}_${fileName}`);

            // Build forward job
            const forwardJob = {
                jobId:         path.parse(fileName).name,
                spoolFileName: fileName,
                archiveFile:   archiveFilePath,
                timestamp,
                capturedAt:    new Date().toISOString(),
                size:          rawData.length,
                rawData,
            };

            log.step(`Emitting forwardJob → jobId=${forwardJob.jobId}`);
            this.emit('forwardJob', forwardJob);
            this.stats.jobsQueued++;

            // Delete from raw\
            await fs.unlink(filePath);
            log.debug(`Deleted from raw\\: ${fileName}`);

            return {
                success:     true,
                jobId:       forwardJob.jobId,
                archiveFile: archiveFilePath,
                size:        rawData.length,
                timestamp,
                capturedAt:  forwardJob.capturedAt,
            };

        } catch (error) {
            log.error(`handleSpoolFile failed for ${fileName}: ${error.message}`);

            // Move to failed\
            try {
                const failedDir = path.join(path.dirname(filePath), '..', 'failed');
                await fs.mkdir(failedDir, { recursive: true });
                const failedTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23);
                const failedPath = path.join(failedDir, `${failedTs}_${fileName}`);
                await fs.copyFile(filePath, failedPath);
                await fs.unlink(filePath);
                log.warn(`Moved to failed\\: ${failedTs}_${fileName}`);
            } catch (_) {}

            return { success: false, error: error.message, fileName, timestamp };
        }
    }

    getStats() {
        return {
            ...this.stats,
            isRunning:       this.isRunning,
            processingCount: this.processingFiles.size,
            processedCount:  this.processedFiles.size,
        };
    }

    resetStats() {
        this.stats = {
            filesDetected:  0,
            filesProcessed: 0,
            filesFailed:    0,
            lastFileAt:     null,
            jobsQueued:     0,
            queueDepth:     0,
        };
        this.processedFiles.clear();
    }
}

module.exports = SpoolWatcher;
