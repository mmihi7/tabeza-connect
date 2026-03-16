// win-printer.js
// Windows Printer Connection - Uses Windows print API

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

class WindowsPrinterConnection {
    constructor(config) {
        this.printerName = config.printerName || 'EPSON L3210 Series';
        this.tempDir = path.join('C:\\TabezaPrints', 'temp');
    }

    async connect() {
        try {
            // Ensure temp directory exists
            await fs.promises.mkdir(this.tempDir, { recursive: true });
            
            // Test if printer exists
            const { stdout } = await execPromise(`powershell -Command "Get-Printer -Name '${this.printerName}' -ErrorAction SilentlyContinue"`);
            
            if (!stdout.trim()) {
                throw new Error(`Printer '${this.printerName}' not found`);
            }
            
            console.log(`[WindowsPrinter] Connected to ${this.printerName}`);
            return true;
        } catch (err) {
            console.error('[WindowsPrinter] Connection failed:', err.message);
            throw err;
        }
    }

    async send(data) {
        try {
            // Create a temporary file with the print data
            const tempFile = path.join(this.tempDir, `print_${Date.now()}.prn`);
            await fs.promises.writeFile(tempFile, data);
            
            // Use PowerShell's Out-Printer to send raw data to the printer
            // This is the most reliable method for raw printing
            const command = `powershell -Command "Get-Content -Path '${tempFile}' -Raw | Out-Printer -Name '${this.printerName}'"`;
            
            await execPromise(command);
            
            // Clean up temp file
            await fs.promises.unlink(tempFile).catch(() => {});
            
            console.log(`[WindowsPrinter] Sent ${data.length} bytes to ${this.printerName}`);
            return data.length;
        } catch (err) {
            console.error('[WindowsPrinter] Send failed:', err.message);
            throw err;
        }
    }

    async getStatus() {
        try {
            // Get printer status using PowerShell
            const { stdout } = await execPromise(
                `powershell -Command "$printer = Get-Printer -Name '${this.printerName}'; $printer.PrinterStatus"`
            );
            
            const status = stdout.trim();
            
            // Treat any non-error state as ready — Windows returns various status strings
            const notReady = status.includes('Error') || status.includes('Offline') || status.includes('Unknown');
            const paperOut = status.includes('OutOfPaper') || status.includes('PaperOut');
            return {
                ready: !notReady,
                paperOut: paperOut,
                error: notReady,
                errorMessage: notReady ? `Printer status: ${status}` : null
            };
        } catch (err) {
            return {
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: err.message
            };
        }
    }

    async disconnect() {
        console.log('[WindowsPrinter] Disconnected');
    }
}

module.exports = WindowsPrinterConnection;
