const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chokidar = require('chokidar');

class PrintBridge {
    constructor(configPath = 'C:\\ProgramData\\Tabeza\\bridge-config.json') {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.watcher = null;
        this.processingJobs = new Set();
        this.lastProcessedTime = 0;
        this.DEBOUNCE_MS = 2000;
        this.isShuttingDown = false;
    }

    loadConfig() {
        const defaults = {
            printer: 'EPSON L3210 Series',
            physicalPort: 'USB001',
            captureFile: 'C:\\ProgramData\\Tabeza\\capture.prn',
            debounceMs: 2000,
            forwardTimeoutMs: 15000
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const loaded = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                return { ...defaults, ...loaded };
            }
        } catch (err) {
            console.warn('⚠️  Config load failed, using defaults:', err.message);
        }
        return defaults;
    }

    start() {
        if (this.isShuttingDown) return;

        console.log('🌉 Starting Tabeza Silent Bridge v3.1 (FILE-LOCK-FIX)...');
        console.log(`   Printer: ${this.config.printer}`);
        console.log(`   Physical Port: ${this.config.physicalPort}`);
        console.log(`   Capture File: ${this.config.captureFile}`);

        // Ensure capture directory exists
        const captureDir = path.dirname(this.config.captureFile);
        if (!fs.existsSync(captureDir)) {
            fs.mkdirSync(captureDir, { recursive: true });
        }

        // Clear any existing data before starting
        this.clearCaptureFile();

        // Start file watcher
        this.startWatcher();

        console.log('✅ Bridge Active. Monitoring for print jobs...');
        console.log('⚠️  CRITICAL: Service must run as Administrator!');
    }

    startWatcher() {
        this.watcher = chokidar.watch(this.config.captureFile, {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            interval: 1000,
            binaryInterval: 2000,
            depth: 0,
            alwaysStat: true
        });

        this.watcher.on('change', (filePath, stats) => this.handlePrint(filePath, stats));
        this.watcher.on('add', (filePath, stats) => this.handlePrint(filePath, stats));
        this.watcher.on('error', (err) => {
            console.error('❌ Watcher error:', err.message);
        });
    }

    async handlePrint(filePath, stats) {
        const now = Date.now();

        // Debounce: ignore rapid triggers
        if (now - this.lastProcessedTime < this.config.debounceMs) {
            console.log('⏭️  Debouncing rapid trigger...');
            return;
        }

        // Prevent concurrent processing
        if (this.processingJobs.has(filePath)) {
            console.log('⏳  Already processing, skipping...');
            return;
        }

        this.processingJobs.add(filePath);
        this.lastProcessedTime = now;

        try {
            // STEP 1: Wait for spooler to finish writing
            await this.waitForFileReady(filePath, 5000);

            // STEP 2: Read file content to memory (with retries)
            const data = await this.readFileWithRetry(filePath, 5);
            if (!data || data.length === 0) {
                console.log('⚠️  Empty print job, skipping');
                return;
            }

            console.log(`📄 Captured ${data.length} bytes from print job`);

            // STEP 3: Clear the file (best effort, don't fail if locked)
            this.clearCaptureFileSafe();

            // STEP 4: Process from MEMORY (not file) - avoids lock issues
            // Upload to cloud (non-blocking)
            this.uploadToCloud(data).catch(err => {
                console.error('☁️  Upload failed:', err.message);
            });

            // Forward to physical printer (blocking)
            await this.forwardToPhysicalPrinter(data);

            console.log('✅ Print cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
        } finally {
            this.processingJobs.delete(filePath);
        }
    }

    clearCaptureFileSafe() {
        try {
            // Small delay to ensure spooler releases handle
            setTimeout(() => {
                try {
                    fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
                    console.log('🧹 Capture file cleared');
                } catch (clearErr) {
                    console.warn('⚠️  Clear failed (non-fatal):', clearErr.message);
                    // Continue anyway - data already in memory
                }
            }, 100);
        } catch (err) {
            console.warn('⚠️  Clear setup failed:', err.message);
        }
    }

    waitForFileReady(filePath, timeoutMs = 5000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                try {
                    const stats = fs.statSync(filePath);
                    if (Date.now() - stats.mtimeMs > 500) {
                        resolve();
                    } else if (Date.now() - start > timeoutMs) {
                        console.log('⚠️  File ready timeout, proceeding anyway');
                        resolve();
                    } else {
                        setTimeout(check, 200);
                    }
                } catch (e) {
                    resolve();
                }
            };
            setTimeout(check, 300);
        });
    }

    async readFileWithRetry(filePath, maxRetries = 5) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return fs.readFileSync(filePath);
            } catch (err) {
                if (err.code === 'EBUSY' && i < maxRetries - 1) {
                    console.log(`🔄 File locked, retry ${i + 1}/${maxRetries}...`);
                    await new Promise(r => setTimeout(r, 400 * (i + 1)));
                    continue;
                }
                throw err;
            }
        }
    }

    uploadToCloud(data) {
        return new Promise((resolve, reject) => {
            console.log('☁️  Processing for cloud upload...');
            console.log(`📤 Receipt queued for upload (${data.length} bytes)`);
            
            // TODO: Replace with your actual Supabase upload logic
            // Simulate upload delay
            setTimeout(() => {
                console.log('☁️  Upload completed');
                resolve();
            }, 500);
        });
    }

    async forwardToPhysicalPrinter(data) {
        return new Promise((resolve) => {
            const physicalPort = this.config.physicalPort || 'USB001';
            const portPath = `\\\\.\\${physicalPort}`;
            
            console.log(`🖨️  Forwarding ${data.length} bytes to ${portPath}`);

            // Write data to a TEMP file for copy command (avoids lock on original)
            const tempFile = this.config.captureFile + '.tmp';
            try {
                fs.writeFileSync(tempFile, data);
            } catch (err) {
                console.error('⚠️  Failed to create temp forward file:', err.message);
                resolve();
                return;
            }

            const cmd = `copy /b "${tempFile}" "${portPath}"`;
            
            exec(cmd, { windowsHide: true, timeout: 15000 }, (err) => {
                // Clean up temp file
                try { 
                    fs.unlinkSync(tempFile); 
                } catch (_) {}

                if (err) {
                    console.error('⚠️  Physical forward failed:', err.message);
                    console.error('   → Run service as Administrator');
                    console.error(`   → Verify port: ${physicalPort}`);
                } else {
                    console.log('🖨️  Forwarded to physical printer successfully');
                }
                resolve();
            });
        });
    }

    clearCaptureFile() {
        try {
            fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
        } catch (err) {
            console.warn('⚠️  Failed to clear capture file:', err.message);
        }
    }

    stop() {
        console.log('🛑 Shutting down bridge...');
        this.isShuttingDown = true;
        
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        
        this.processingJobs.clear();
        console.log('✅ Bridge stopped');
    }
}

module.exports = PrintBridge;

// Run if executed directly
if (require.main === module) {
    const bridge = new PrintBridge();
    
    bridge.start();
    
    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down bridge...');
        await bridge.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down bridge...');
        await bridge.stop();
        process.exit(0);
    });
    
    process.on('uncaughtException', (err) => {
        console.error('💥 Uncaught Exception:', err.message);
        console.error(err.stack);
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
}
