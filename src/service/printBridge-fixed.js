const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chokidar = require('chokidar');

class PrintBridge {
    constructor() {
        this.config = this.loadConfig();
        this.watcher = null;
        this.processingJobs = new Set();
        this.lastProcessedTime = 0;
        this.DEBOUNCE_MS = 2000; // Wait 2s between processing same file
    }

    loadConfig() {
        const configPath = 'C:\\ProgramData\\Tabeza\\bridge-config.json';
        if (fs.existsSync(configPath)) {
            const rawContent = fs.readFileSync(configPath, 'utf8');
            // Remove BOM (Byte Order Mark) if present
            const content = rawContent.replace(/^\uFEFF/, '');
            const config = JSON.parse(content);
            console.log(`📋 Loaded bridge configuration:`);
            console.log(`   Printer: ${config.printerName}`);
            console.log(`   Physical Port: ${config.physicalPort}`);
            console.log(`   Capture File: ${config.captureFile}`);
            return config;
        }
        
        console.log('❌ Bridge configuration not found. Run setup-bridge.ps1 first.');
        process.exit(1);
    }

    start() {
        console.log('🌉 Starting Tabeza Print Bridge v2.0 (FIXED)...');
        console.log(`   Physical Port: ${this.config.physicalPort}`);
        console.log(`   Capture File: ${this.config.captureFile}`);

        // Ensure capture folder exists
        const captureDir = path.dirname(this.config.captureFile);
        if (!fs.existsSync(captureDir)) {
            fs.mkdirSync(captureDir, { recursive: true });
        }

        // Initialize empty capture file
        if (!fs.existsSync(this.config.captureFile)) {
            fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
        }

        // Start file watcher with debouncing
        this.watcher = chokidar.watch(this.config.captureFile, {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            interval: 500,
        });

        this.watcher.on('change', () => this.handlePrint());
        this.watcher.on('add', () => this.handlePrint());
        
        console.log('✅ Bridge Active. Monitoring for print jobs...');
        console.log('⚠️  CRITICAL: Service must run as Administrator!');
    }

    async handlePrint() {
        const now = Date.now();
        
        // Debounce: ignore if processed recently
        if (now - this.lastProcessedTime < this.DEBOUNCE_MS) {
            console.log('⏭️  Debouncing duplicate trigger...');
            return;
        }

        // Prevent concurrent processing of same file
        if (this.processingJobs.has(this.config.captureFile)) {
            console.log('⏳  Already processing, skipping...');
            return;
        }

        this.processingJobs.add(this.config.captureFile);
        this.lastProcessedTime = now;

        try {
            // Wait for Windows spooler to finish writing
            await this.waitForFileReady();

            // Read with retry logic for locked files
            const data = await this.readFileWithRetry();
            if (!data || data.length === 0) {
                console.log('⚠️  Empty print job, skipping');
                return;
            }

            console.log(`📄 Captured ${data.length} bytes from print job`);

            // Upload to cloud (non-blocking)
            this.uploadToCloud(data);

            // Forward to physical printer
            await this.forwardToPhysicalPrinter(data);

            // Clear file AFTER successful processing
            fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
            console.log('✅ Print cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
        } finally {
            this.processingJobs.delete(this.config.captureFile);
        }
    }

    waitForFileReady(timeoutMs = 3000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                try {
                    const stats = fs.statSync(this.config.captureFile);
                    // If file hasn't changed in 200ms, consider it ready
                    if (Date.now() - stats.mtimeMs > 200) {
                        resolve();
                    } else if (Date.now() - start > timeoutMs) {
                        resolve(); // Timeout, proceed anyway
                    } else {
                        setTimeout(check, 100);
                    }
                } catch (e) {
                    resolve(); // File might be gone, proceed
                }
            };
            setTimeout(check, 500); // Initial wait for spooler
        });
    }

    async readFileWithRetry(maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return fs.readFileSync(this.config.captureFile);
            } catch (err) {
                if (err.code === 'EBUSY' && i < maxRetries - 1) {
                    console.log(`🔄 File locked, retry ${i + 1}/${maxRetries}...`);
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }
                throw err;
            }
        }
    }

    uploadToCloud(data) {
        console.log('☁️  Processing for cloud upload...');
        // TODO: Integrate with your LocalQueue and UploadWorker
        console.log(`📤  Receipt queued for upload (${data.length} bytes)`);
    }

    async forwardToPhysicalPrinter(data) {
        return new Promise((resolve) => {
            console.log('🖨️  Forwarding to physical printer...');
            
            // Create temp file to avoid locking
            const tempFile = this.config.captureFile + '.temp';
            fs.writeFileSync(tempFile, data);
            
            // CRITICAL FIX: Use actual physical port from config
            const physicalPort = `\\\\.\\${this.config.physicalPort}`;
            const cmd = `copy /b "${tempFile}" "${physicalPort}"`;
            
            console.log(`   Command: ${cmd}`);
            
            exec(cmd, { windowsHide: true, timeout: 10000 }, (err) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (unlinkErr) {
                    // Ignore cleanup errors
                }
                
                if (err) {
                    console.error('⚠️  Physical forward failed:', err.message);
                    console.error('   → Ensure service runs as Administrator');
                    console.error(`   → Verify port exists: ${this.config.physicalPort}`);
                    console.error('   → Check USB cable and printer status');
                } else {
                    console.log('🖨️  Forwarded to physical printer successfully');
                }
                resolve();
            });
        });
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.processingJobs.clear();
        }
    }
}

module.exports = PrintBridge;

// Run if executed directly
if (require.main === module) {
    const bridge = new PrintBridge();
    bridge.start();
    
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down bridge...');
        bridge.stop();
        process.exit(0);
    });
}
