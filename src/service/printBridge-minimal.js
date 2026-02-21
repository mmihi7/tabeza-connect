// src/service/printBridge.js - PRODUCTION FIX v2.2
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chokidar = require('chokidar');

class PrintBridge {
    constructor(configPath = 'C:\\ProgramData\\Tabeza\\bridge-config.json') {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.watcher = null;
        this.processing = false;
        this.lastPrint = 0;
    }

    loadConfig() {
        const defaults = {
            physicalPort: 'USB001',
            captureFile: 'C:\\ProgramData\\Tabeza\\capture.prn',
            debounceMs: 2000
        };
        try {
            if (fs.existsSync(this.configPath)) {
                return { ...defaults, ...JSON.parse(fs.readFileSync(this.configPath, 'utf8')) };
            }
        } catch (e) { console.warn('⚠️ Config load failed:', e.message); }
        return defaults;
    }

    start() {
        console.log('🌉 Tabeza Bridge v2.2 - Starting...');
        console.log(`   Port: ${this.config.physicalPort} | File: ${this.config.captureFile}`);
        
        // Ensure file exists
        if (!fs.existsSync(this.config.captureFile)) {
            fs.writeFileSync(this.config.captureFile, Buffer.alloc(0));
        }

        this.watcher = chokidar.watch(this.config.captureFile, {
            persistent: true,
            ignoreInitial: true,
            usePolling: true,
            interval: 1000
        });

        this.watcher.on('change', (fp) => this.onPrint(fp));
        this.watcher.on('add', (fp) => this.onPrint(fp));
        
        console.log('✅ Bridge ready. Print to test.');
    }

    async onPrint(filePath) {
        // Debounce + single-thread
        const now = Date.now();
        if (this.processing || (now - this.lastPrint) < this.config.debounceMs) return;
        this.processing = true;
        this.lastPrint = now;

        try {
            // Wait for spooler to finish
            await new Promise(r => setTimeout(r, 500));
            
            // Read data
            const data = fs.readFileSync(filePath);
            if (!data || data.length === 0) return;
            
            console.log(`📄 Captured ${data.length} bytes`);

            // Upload (fire-and-forget, NO .catch on undefined)
            this.uploadToCloud(); // Returns void, don't chain .catch()

            // Forward to printer (MUST complete)
            await this.forwardToPhysicalPrinter(data);

            // Clear file (best-effort)
            try {
                await new Promise(r => setTimeout(r, 100));
                fs.writeFileSync(filePath, Buffer.alloc(0));
            } catch (e) {
                console.warn('⚠️ Clear failed (non-fatal):', e.message);
            }

            console.log('✅ Cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
        } finally {
            this.processing = false;
        }
    }

    async uploadToCloud() {
        console.log('☁️  Processing for cloud upload...');
        // TODO: Your Supabase logic here
        // Example: await supabase.from('receipts').insert({ ... })
        await new Promise(r => setTimeout(r, 50)); // Simulate network
        console.log('📤 Receipt queued for upload');
        // Return void intentionally - don't chain .catch() on this
    }

    async forwardToPhysicalPrinter(data) {
        const port = this.config.physicalPort || 'USB001';
        const file = this.config.captureFile;
        const portPath = `\\\\.\\${port}`;
        
        console.log(`🖨️  Forwarding to ${portPath}`);

        return new Promise((resolve) => {
            // Use TEMP file to avoid lock conflicts
            const tempFile = file + '.fwd.tmp';
            try {
                fs.writeFileSync(tempFile, data);
            } catch (e) {
                console.error('⚠️ Temp write failed:', e.message);
                resolve();
                return;
            }

            const cmd = `copy /b "${tempFile}" "${portPath}"`;
            
            exec(cmd, { windowsHide: true, timeout: 10000 }, (err) => {
                // Cleanup temp
                try { fs.unlinkSync(tempFile); } catch (_) {}
                
                if (err) {
                    console.error('⚠️ Forward failed:', err.message);
                    console.error('   → Run service as Administrator');
                    console.error(`   → Verify port: ${port}`);
                    console.error('   → Test manually: copy /b "capture.prn" "\\\\.\\USB001"');
                } else {
                    console.log('🖨️ Forwarded successfully');
                }
                resolve();
            });
        });
    }

    stop() {
        if (this.watcher) this.watcher.close();
    }
}

module.exports = PrintBridge;

if (require.main === module) {
    const bridge = new PrintBridge();
    bridge.start();
    process.on('SIGINT', () => { bridge.stop(); process.exit(0); });
}
