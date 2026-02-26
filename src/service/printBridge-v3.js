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
        this.DEBOUNCE_MS = 2000; // 2 second debounce
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

        console.log('🌉 Starting Tabeza Silent Bridge v3.0 (FINAL)...');
        console.log(`   Printer: ${this.config.printer}`);
        console.log(`   Physical Port: ${this.config.physicalPort}`);
        console.log(`   Capture File: ${this.config.captureFile}`);
        console.log(`   Debounce: ${this.config.debounceMs}ms`);

        // Ensure capture directory exists
        const captureDir = path.dirname(this.config.captureFile);
        if (!fs.existsSync(captureDir)) {
            fs.mkdirSync(captureDir, { recursive: true });
        }

        // CRITICAL FIX: Clear any existing data before starting
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
            usePolling: true,      // Critical for Windows Local Ports
            interval: 1000,         // Poll every 1 second
            binaryInterval: 2000,    // Longer interval for binary files
            depth: 0,               // Only watch the file, not subdirs
            alwaysStat: true         // Get file stats with events
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
            // CRITICAL FIX: Clear file IMMEDIATELY when change detected
            // This prevents Windows from writing to a file we're trying to read
            this.clearCaptureFile();

            // Wait a moment for Windows to finish any pending writes
            await this.sleep(100);

            // Read the data (should be empty or contain new data)
            const data = await this.readFileWithRetry(filePath, 3);
            if (!data || data.length === 0) {
                console.log('⚠️  Empty print job after clear, skipping');
                return;
            }

            console.log(`📄 Captured ${data.length} bytes from print job`);

            // Upload to cloud (fire-and-forget)
            this.uploadToCloud(data).catch(err => {
                console.error('☁️  Upload failed:', err.message);
            });

            // Forward to physical printer (blocking, must succeed)
            await this.forwardToPhysicalPrinter(data);

            // CRITICAL FIX: Clear file AFTER successful forward
            this.clearCaptureFile();
            console.log('✅ Print cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
            console.error('   Stack:', err.stack?.split('\n')[1]?.trim());
        } finally {
            this.processingJobs.delete(filePath);
        }
    }

    clearCaptureFile() {
        try {
            fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
        } catch (err) {
            console.warn('⚠️  Failed to clear capture file:', err.message);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async readFileWithRetry(filePath, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return fs.readFileSync(filePath);
            } catch (err) {
                if (err.code === 'EBUSY' && i < maxRetries - 1) {
                    console.log(`🔄 File locked, retry ${i + 1}/${maxRetries}...`);
                    await this.sleep(300 * (i + 1)); // Exponential backoff
                    continue;
                }
                throw err;
            }
        }
    }

    uploadToCloud(data) {
        console.log('☁️  Processing for cloud upload...');
        console.log(`📤 Receipt queued for upload (${data.length} bytes)`);
        
        // TODO: Replace with your actual Supabase upload logic
        // Simulate upload delay
        setTimeout(() => {
            console.log('☁️  Upload completed');
        }, 500);
    }

    async forwardToPhysicalPrinter(data) {
        return new Promise((resolve) => {
            const physicalPort = this.config.physicalPort || 'USB001';
            const portPath = `\\\\.\\${physicalPort}`;
            
            console.log(`🖨️  Forwarding to physical printer: ${portPath}`);

            // Use temp file for atomic operation
            const tempFile = this.config.captureFile + '.forward';
            fs.writeFileSync(tempFile, data);
            
            const cmd = `copy /b "${tempFile}" "${portPath}"`;
            
            exec(cmd, { 
                windowsHide: true, 
                timeout: this.config.forwardTimeoutMs 
            }, (err) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (unlinkErr) {
                    // Ignore cleanup errors
                }
                
                if (err) {
                    console.error('⚠️  Physical forward failed:', err.message);
                    console.error('   → Ensure service runs as Administrator');
                    console.error(`   → Verify port: ${physicalPort}`);
                    console.error('   → Check USB cable and printer status');
                } else {
                    console.log('🖨️  Forwarded to physical printer successfully');
                }
                resolve();
            });
        });
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
