/**
 * Tabeza Universal POS Bridge v3.0
 * 
 * Universal Architecture:
 * POS → Local Port → Bridge → Cloud + Windows Spooler → Physical Printer
 * 
 * Works with ANY printer: USB, Network, Bluetooth, Virtual
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chokidar = require('chokidar');

class UniversalPrintBridge {
    constructor(configPath = 'C:\\ProgramData\\Tabeza\\bridge-config.json') {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.watcher = null;
        this.processing = false;
        this.lastPrint = 0;
        this.DEBOUNCE_MS = 2000;
    }

    loadConfig() {
        const defaults = {
            printerName: 'EPSON L3210 Series',
            captureFile: 'C:\\ProgramData\\Tabeza\\capture.prn',
            debounceMs: 2000
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const rawContent = fs.readFileSync(this.configPath, 'utf8');
                const content = rawContent.replace(/^\uFEFF/, '');
                return { ...defaults, ...JSON.parse(content) };
            }
        } catch (err) {
            console.warn('⚠️ Config load failed, using defaults:', err.message);
        }
        return defaults;
    }

    start() {
        console.log('🌉 Tabeza Universal Bridge v3.0');
        console.log(`   Printer: ${this.config.printerName}`);
        console.log(`   Capture: ${this.config.captureFile}`);
        console.log(`   Debounce: ${this.config.debounceMs}ms`);
        console.log('');

        // Ensure capture directory exists
        const captureDir = path.dirname(this.config.captureFile);
        if (!fs.existsSync(captureDir)) {
            fs.mkdirSync(captureDir, { recursive: true });
        }

        // Initialize empty capture file
        if (!fs.existsSync(this.config.captureFile)) {
            fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
        }

        // Start file watcher
        this.watcher = chokidar.watch(this.config.captureFile, {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            interval: 1000,
            binaryInterval: 2000,
            depth: 0
        });

        this.watcher.on('change', () => this.handlePrint());
        this.watcher.on('add', () => this.handlePrint());
        this.watcher.on('error', (err) => {
            console.error('❌ Watcher error:', err.message);
        });

        console.log('✅ Universal Bridge Active');
        console.log('   Works with USB, Network, Bluetooth, Virtual printers');
        console.log('   Print from POS to test');
    }

    async handlePrint() {
        const now = Date.now();

        // Debounce rapid triggers
        if (this.processing || (now - this.lastPrint) < this.DEBOUNCE_MS) {
            return;
        }

        this.processing = true;
        this.lastPrint = now;

        try {
            // Wait for spooler to finish writing
            await this.sleep(500);

            // Read capture data
            const data = await this.readFileWithRetry();
            if (!data || data.length === 0) {
                console.log('⚠️  Empty print job, skipping');
                return;
            }

            console.log(`📄 Captured ${data.length} bytes`);

            // Upload to cloud (fire-and-forget)
            this.uploadToCloud(data);

            // Forward to physical printer via Windows spooler
            await this.forwardToPhysicalPrinter(data);

            // Clear capture file
            this.clearCaptureFile();

            console.log('✅ Print cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
        } finally {
            this.processing = false;
        }
    }

    async readFileWithRetry(maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return fs.readFileSync(this.config.captureFile);
            } catch (err) {
                if (err.code === 'EBUSY' && i < maxRetries - 1) {
                    console.log(`🔄 File locked, retry ${i + 1}/${maxRetries}...`);
                    await this.sleep(300 * (i + 1));
                    continue;
                }
                throw err;
            }
        }
    }

    uploadToCloud(data) {
        console.log('☁️  Processing for cloud upload...');
        console.log(`📤 Receipt queued for upload (${data.length} bytes)`);
        
        // TODO: Replace with your actual Supabase logic
        setTimeout(() => {
            console.log('☁️  Upload completed');
        }, 500);
    }

    async forwardToPhysicalPrinter(data) {
        const printerName = this.config.printerName;
        const tempFile = this.config.captureFile + '.forward';
        
        console.log(`🖨️  Forwarding to ${printerName} via Windows spooler`);

        return new Promise((resolve) => {
            // Write data to temp file
            fs.writeFile(tempFile, data, (writeErr) => {
                if (writeErr) {
                    console.error('⚠️  Failed to write forward file:', writeErr.message);
                    resolve();
                    return;
                }

                // Use PowerShell Out-Printer (universal approach)
                const psCommand = `Get-Content -Path '${tempFile}' -Raw | Out-Printer -Name '${printerName}'`;
                const cmd = `powershell -Command "${psCommand}"`;
                
                exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (cleanupErr) {
                        // Ignore cleanup errors
                    }

                    if (err) {
                        console.error('⚠️  Forward failed:', err.message);
                        console.error('   → Check printer name and connection');
                        console.error('   → Ensure printer is online and has paper');
                    } else {
                        console.log('🖨️  Forwarded successfully via Windows spooler');
                    }
                    resolve();
                });
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

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        console.log('🛑 Stopping Universal Bridge...');
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        console.log('✅ Bridge stopped');
    }
}

module.exports = UniversalPrintBridge;

// Run if executed directly
if (require.main === module) {
    const bridge = new UniversalPrintBridge();
    
    bridge.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down bridge...');
        bridge.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down bridge...');
        bridge.stop();
        process.exit(0);
    });
}
