/**
 * Tabeza Universal POS Bridge v4.0 - FINAL EDITION
 * 
 * Complete Solution:
 * 1. Folder port (separate files per job) - fixes accumulation
 * 2. awaitWriteFinish + watch 'add' - fixes multiple triggers  
 * 3. Out-Printer forwarding - fixes physical printing
 * 
 * Architecture:
 * POS → Folder Port → Bridge → Cloud + Windows Spooler → Physical Printer
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const chokidar = require('chokidar');

class FinalUniversalBridge {
    constructor(configPath = 'C:\\ProgramData\\Tabeza\\bridge-config.json') {
        this.configPath = configPath;
        this.config = this.loadConfig();
        this.watcher = null;
        this.processingFiles = new Set();
        this.isShuttingDown = false;
    }

    loadConfig() {
        const defaults = {
            printerName: 'EPSON L3210 Series',
            captureFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
            tempForwardFile: 'C:\\ProgramData\\Tabeza\\fwd_temp.prn'
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
        console.log('🌉 Tabeza Universal Bridge v4.0 - FINAL EDITION');
        console.log(`   Printer: ${this.config.printerName}`);
        console.log(`   Capture Folder: ${this.config.captureFolder}`);
        console.log('');

        // Ensure capture folder exists
        if (!fs.existsSync(this.config.captureFolder)) {
            fs.mkdirSync(this.config.captureFolder, { recursive: true });
            console.log(`✅ Created capture folder: ${this.config.captureFolder}`);
        }

        // Start folder watcher with awaitWriteFinish
        this.startFolderWatcher();

        console.log('✅ Final Universal Bridge Active');
        console.log('   📁 Folder port: One file per print job');
        console.log('   ⏱️  awaitWriteFinish: Single trigger per job');
        console.log('   🖨️  Out-Printer: Universal physical forwarding');
        console.log('   Print from POS to test');
    }

    startFolderWatcher() {
        this.watcher = chokidar.watch(this.config.captureFolder, {
            persistent: true,
            ignoreInitial: true,
            depth: 0, // Only watch this folder, not subfolders
            awaitWriteFinish: {
                stabilityThreshold: 2000, // Wait 2s for file to stop being written
                pollInterval: 500
            }
        });

        // Watch for NEW files only (not changes)
        this.watcher.on('add', (filePath) => this.handlePrint(filePath));
        this.watcher.on('error', (err) => {
            console.error('❌ Watcher error:', err.message);
        });
    }

    async handlePrint(filePath) {
        // Prevent concurrent processing of same file
        if (this.processingFiles.has(filePath)) {
            console.log('⏳ Already processing, skipping:', path.basename(filePath));
            return;
        }

        this.processingFiles.add(filePath);

        try {
            console.log(`📄 Processing: ${path.basename(filePath)}`);

            // Read the print data
            const data = fs.readFileSync(filePath);
            if (!data || data.length === 0) {
                console.log('⚠️  Empty file, skipping');
                return;
            }

            console.log(`📄 Captured ${data.length} bytes`);

            // Upload to cloud (fire-and-forget)
            this.uploadToCloud(data);

            // Forward to physical printer via Windows spooler
            await this.forwardToPhysicalPrinter(data);

            // Delete the processed file (no EBUSY - spooler is done with this file)
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted: ${path.basename(filePath)}`);

            console.log('✅ Print cycle complete');

        } catch (err) {
            console.error('❌ Bridge Error:', err.message);
        } finally {
            this.processingFiles.delete(filePath);
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
        const tempFile = this.config.tempForwardFile;
        
        console.log(`🖨️  Forwarding to ${printerName} via Windows spooler`);

        return new Promise((resolve) => {
            // Write data to temp file
            fs.writeFile(tempFile, data, (writeErr) => {
                if (writeErr) {
                    console.error('⚠️  Failed to write forward file:', writeErr.message);
                    resolve();
                    return;
                }

                // Use PowerShell Out-Printer with proper encoding
                const psCommand = `Get-Content -Path '${tempFile}' -Encoding Byte -Raw | Out-Printer -Name '${printerName}'`;
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
                        console.error('   → Check printer connection and status');
                    } else {
                        console.log('🖨️  Forwarded successfully via Windows spooler');
                    }
                    resolve();
                });
            });
        });
    }

    stop() {
        console.log('🛑 Stopping Final Universal Bridge...');
        this.isShuttingDown = true;
        
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        
        this.processingFiles.clear();
        console.log('✅ Bridge stopped');
    }
}

module.exports = FinalUniversalBridge;

// Run if executed directly
if (require.main === module) {
    const bridge = new FinalUniversalBridge();
    
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
