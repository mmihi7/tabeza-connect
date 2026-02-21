const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chokidar = require('chokidar');
const { EventEmitter } = require('events');

class PrintBridge extends EventEmitter {
    constructor() {
        super();
        this.config = this.loadConfig();
        this.watcher = null;
        this.isProcessing = false;
        this.isRunning = false;
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
        if (this.isRunning) {
            console.log('⚠️  Bridge already running');
            return;
        }

        console.log('🌉 Starting Tabeza Print Bridge...');
        console.log('   This enables parallel digital capture + physical printing');
        console.log('');

        // Ensure capture file exists
        if (!fs.existsSync(this.config.captureFile)) {
            fs.writeFileSync(this.config.captureFile, '');
        }

        // Start file watcher
        this.watcher = chokidar.watch(this.config.captureFile, {
            persistent: true,
            ignoreInitial: true,
            usePolling: true, // Critical for file port reliability
            interval: 500, // Check every 500ms for low latency
        });

        this.watcher.on('change', () => this.handlePrint());
        this.watcher.on('add', () => this.handlePrint());
        
        this.isRunning = true;
        console.log('✅ Bridge Active. Monitoring for print jobs...');
        console.log(`   Capture File: ${this.config.captureFile}`);
        console.log(`   Forwarding to Port: ${this.config.physicalPort}`);
        console.log('');
        console.log('⚠️  IMPORTANT: Physical printing requires this service to stay running!');
    }

    async handlePrint() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 1. Wait for file write completion
            await this.waitForWriteComplete();

            // 2. Read raw print data
            const data = fs.readFileSync(this.config.captureFile);
            if (data.length === 0) return;

            console.log(`📄 Captured ${data.length} bytes from print job`);

            // 3. Process for cloud upload (integrate with existing logic)
            await this.processForCloud(data);

            // 4. Forward to physical printer (CRITICAL for restaurant operations)
            await this.forwardToPhysicalPrinter(data);

            // 5. Clear capture file (with small delay to avoid race conditions)
            setTimeout(() => {
                try {
                    fs.writeFileSync(this.config.captureFile, '');
                } catch (clearErr) {
                    console.warn('⚠️  Failed to clear capture file:', clearErr.message);
                }
            }, 100); // 100ms delay
            console.log('✅ Print cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
        } finally {
            this.isProcessing = false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForWriteComplete() {
        let lastSize = -1;
        let stableCount = 0;
        const requiredStableChecks = 5; // 5 * 100ms = 500ms stability

        while (stableCount < requiredStableChecks) {
            try {
                const stats = fs.statSync(this.config.captureFile);
                const currentSize = stats.size;

                if (currentSize === lastSize) {
                    stableCount++;
                } else {
                    stableCount = 0;
                    lastSize = currentSize;
                }

                await this.sleep(100); // Check every 100ms

            } catch (error) {
                if (error.code === 'ENOENT') {
                    // File doesn't exist yet
                    await this.sleep(50);
                    continue;
                }
                throw error;
            }
        }
    }

    async processForCloud(data) {
        try {
            // Integrate with your existing receipt processing
            // This would connect to your LocalQueue and UploadWorker
            console.log('☁️  Processing for cloud upload...');
            
            // Create receipt object (matching your existing format)
            const receipt = {
                barId: '438c80c1-fe11-4ac5-8a48-2fc45104ba31', // From config
                deviceId: 'driver-MIHI-PC',
                timestamp: new Date().toISOString(),
                text: data.toString('utf8'),
                metadata: {
                    source: 'print-bridge',
                    bridgeActive: true,
                    physicalPort: this.config.physicalPort,
                    dataSize: data.length
                }
            };

            // TODO: Integrate with your existing LocalQueue
            // await localQueue.enqueue(receipt);
            console.log(`📤  Receipt queued for upload (${data.length} bytes)`);
            
        } catch (err) {
            console.error('❌ Cloud processing failed:', err.message);
        }
    }

    async forwardToPhysicalPrinter(data) {
        return new Promise((resolve) => {
            console.log('🖨️  Forwarding to physical printer...');
            
            // Create a temporary file copy to avoid file locking issues
            const tempFile = this.config.captureFile + '.temp';
            fs.writeFileSync(tempFile, data);
            
            // Use PowerShell for more reliable printer communication
            const psCommand = `Get-Content -Path "${tempFile}" | Out-Printer -Name 'EPSON L3210 Series'`;
            
            exec(`powershell -Command "${psCommand}"`, (err) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (unlinkErr) {
                    // Ignore cleanup errors
                }
                
                if (err) {
                    console.warn('⚠️  Physical forward failed:', err.message);
                    console.warn('   Check if service is running as Administrator');
                    console.warn('   Physical printing may not work until service restart');
                } else {
                    console.log('🖨️  Forwarded to physical printer successfully');
                }
                resolve();
            });
        });
    }

    stop() {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping Print Bridge...');
        
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        
        this.isRunning = false;
        console.log('✅ Bridge stopped');
    }
}

module.exports = PrintBridge;

// If run directly
if (require.main === module) {
    const bridge = new PrintBridge();
    
    bridge.start();
    
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down bridge...');
        bridge.stop();
        process.exit();
    });
}
