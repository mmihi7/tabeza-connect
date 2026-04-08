// win-printer.js
// Windows Raw Printer Connection — Sends ESC/POS bytes directly via Win32 WritePrinter API
// Bypasses GDI/Out-Printer which mangles binary data and splits on newlines

'use strict';

const { execFile } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const { forPrefix } = require('../../utils/logger');

const execFilePromise = util.promisify(execFile);
const log = forPrefix('[PRINTER]');

// PowerShell script that sends raw bytes to a printer using Win32 WritePrinter API
// This is the only correct way to send ESC/POS to a Windows printer without GDI mangling
const RAW_PRINT_PS = `
param([string]$PrinterName, [string]$FilePath)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter {
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPTStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPTStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPTStr)] public string pDataType;
    }

    public static bool SendRawBytes(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        try {
            var di = new DOCINFO { pDocName = "TabezaReceipt", pOutputFile = null, pDataType = "RAW" };
            if (StartDocPrinter(hPrinter, 1, ref di) == 0) return false;
            try {
                if (!StartPagePrinter(hPrinter)) return false;
                int written;
                bool ok = WritePrinter(hPrinter, bytes, bytes.Length, out written);
                EndPagePrinter(hPrinter);
                return ok && written == bytes.Length;
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@ -Language CSharp

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ok = [RawPrinter]::SendRawBytes($PrinterName, $bytes)
if ($ok) { Write-Host "OK:$($bytes.Length)" } else { Write-Host "FAIL"; exit 1 }
`;

class WindowsPrinterConnection {
    constructor({ printerName }, config = {}) {
        this.printerName = printerName;
        this.config = config;
        this.tempDir = path.join('C:\\TabezaPrints', 'temp');
        this._psScriptPath = path.join(__dirname, 'raw-print.ps1');
        
        // Deduplication cache to prevent multiple sends of same data
        this._recentSends = new Map();
        this._dedupeWindow = config.dedupeWindow ?? 30000; // default 30 seconds
        log.debug(`Duplicate detection window set to ${this._dedupeWindow}ms`);
        
        // Print quality configuration (ESC/POS density, heating, speed)
        this._printQuality = config.printQuality || { density: 8, heating: 80, speed: 2 };
        log.debug(`Print quality settings: density=${this._printQuality.density}, heating=${this._printQuality.heating}, speed=${this._printQuality.speed}`);
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Generate ESC/POS commands for print quality settings (density, heating, speed).
     * Returns a Buffer that can be prepended to receipt data.
     * @private
     */
    _applyPrintQuality() {
        const { density, heating, speed } = this._printQuality;
        // Clamp values to valid ranges
        const d1 = Math.max(0, Math.min(8, density));
        const h1 = Math.max(0, Math.min(255, heating));
        const s1 = Math.max(0, Math.min(2, speed));

        // GS ( L pL pH m fn d1 d2 - Print density
        const densityCmd = Buffer.from([
            0x1d, 0x28, 0x4c, // GS ( L
            0x04, 0x00,       // pL=4, pH=0 (4 bytes follow)
            0x00,             // m=0
            0x01,             // fn=1 (print density)
            d1, 0x00          // d1, d2 (d2 reserved, set to 0)
        ]);
        // GS ( H pL pH m fn d1 d2 - Heating time
        const heatingCmd = Buffer.from([
            0x1d, 0x28, 0x48, // GS ( H
            0x04, 0x00,
            0x00,
            0x01,             // fn=1 (heating?)
            h1, 0x00
        ]);
        // GS ( S pL pH m fn d1 d2 - Print speed
        const speedCmd = Buffer.from([
            0x1d, 0x28, 0x53, // GS ( S
            0x04, 0x00,
            0x00,
            0x01,             // fn=1 (speed?)
            s1, 0x00
        ]);

        log.debug(`Applying print quality: density=${d1}, heating=${h1}, speed=${s1}`);
        return Buffer.concat([densityCmd, heatingCmd, speedCmd]);
    }

    async connect() {
        try {
            // Write PS script to disk (idempotent)
            await fs.promises.writeFile(this._psScriptPath, RAW_PRINT_PS, 'utf8');

            log.step(`Connecting to "${this.printerName}"...`);
            const { stdout } = await execFilePromise('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command',
                `Get-Printer -Name '${this.printerName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`
            ]);

            if (!stdout || !stdout.trim()) {
                throw new Error(`Printer '${this.printerName}' not found`);
            }

            log.ok(`Connected to "${this.printerName}"`);
            return true;
        } catch (err) {
            log.error(`Connection failed: ${err.message}`);
            throw err;
        }
    }

    async send(data) {
        // --- FIX: Append paper cut and feed command ---
        // This ensures the printer properly cuts the receipt and ejects the page.
        const fiveLineFeeds = Buffer.from('\n\n\n\n\n');
        const partialCutCommand = Buffer.from([0x1d, 0x56, 0x42, 0x30]); // GS V 1 (partial cut)
        const fullCutCommand = Buffer.from([0x1d, 0x56, 0x41, 0x00]); // GS V A (full cut)

        // Apply print quality commands (density, heating, speed)
        const qualityPrefix = this._applyPrintQuality();
        // Combine quality prefix, original receipt data, line feeds, and cut command
        const dataWithCut = Buffer.concat([qualityPrefix, data, fiveLineFeeds, partialCutCommand]);
        // --- END FIX ---

        // Create hash of data for deduplication
        const dataHash = require('crypto').createHash('md5').update(dataWithCut).digest('hex');
        const now = Date.now();
        
        // Check if we recently sent this exact same data
        const lastSent = this._recentSends.get(dataHash);
        if (lastSent && (now - lastSent) < this._dedupeWindow) {
            log.warn(`Duplicate send blocked: ${dataHash.slice(0, 8)}... (sent ${(now - lastSent)}ms ago)`);
            return data.length; // Pretend it was sent
        }
        
        // Mark as sent
        this._recentSends.set(dataHash, now);
        
        // Clean old entries
        for (const [hash, timestamp] of this._recentSends.entries()) {
            if (now - timestamp > this._dedupeWindow * 2) {
                this._recentSends.delete(hash);
            }
        }
        
        const tempFile = path.join(this.tempDir, `print_${Date.now()}.prn`);
        log.step(`Sending ${dataWithCut.length} bytes to "${this.printerName}" via WritePrinter (raw)`);
        try {
            await fs.promises.writeFile(tempFile, dataWithCut);

            const escaped = this.printerName.replace(/'/g, "''");
            const { stdout, stderr } = await execFilePromise('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                '-File', this._psScriptPath,
                '-PrinterName', this.printerName,
                '-FilePath', tempFile
            ], { timeout: 15000 });

            const out = (stdout || '').trim();
            log.debug(`WritePrinter result: "${out}"`);

            if (!out.startsWith('OK:')) {
                const errMsg = (stderr || '').trim() || out || 'Unknown error';
                throw new Error(`WritePrinter failed: ${errMsg}`);
            }

            log.ok(`Sent ${dataWithCut.length} bytes → "${this.printerName}" (raw)`);
            return data.length;
        } catch (err) {
            log.error(`Send failed: ${err.message}`);
            // Remove from deduplication cache on failure so it can be retried
            this._recentSends.delete(dataHash);
            throw err;
        } finally {
            fs.promises.unlink(tempFile).catch(() => {});
        }
    }

    async getStatus() {
        try {
            const { stdout } = await execFilePromise('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command',
                `Get-Printer -Name '${this.printerName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PrinterStatus`
            ]);

            const status = (stdout || '').trim();
            const isError    = status === '2'   || status.toLowerCase().includes('error');
            const isOffline  = status === '128'  || status.toLowerCase().includes('offline');
            const isPaperOut = status === '5'    || status.toLowerCase().includes('paper');
            const ready = !isError && !isOffline;

            log.debug(`Status check "${this.printerName}": ${status} → ready=${ready}, paperOut=${isPaperOut}`);
            return {
                ready,
                paperOut:     isPaperOut,
                error:        isError || isOffline,
                errorMessage: (isError || isOffline) ? `Printer status: ${status}` : null,
            };
        } catch (err) {
            log.warn(`Status check failed: ${err.message}`);
            return { ready: false, paperOut: false, error: true, errorMessage: err.message };
        }
    }

    async disconnect() {
        log.info(`Disconnected from "${this.printerName}"`);
    }
}

module.exports = WindowsPrinterConnection;
