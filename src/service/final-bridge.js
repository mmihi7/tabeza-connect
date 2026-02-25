/**
 * Tabeza Universal POS Bridge v4.2
 *
 * KEY CHANGE v4.2: No hardcoded printer name.
 * Printer resolution order at startup:
 *   1. config.json bridge.printerName  (if set and not the old placeholder)
 *   2. detected-printer.json           (written by installer detect-thermal-printer.ps1)
 *   3. Auto-scan Windows printers      (scores by thermal/receipt keywords)
 *   4. Windows default printer         (last resort)
 *   → Resolved name is saved back to config.json so next restart is instant.
 *
 * Architecture:
 * POS → Folder Port (TabezaPrints\) → Bridge → Cloud API + Windows Spooler (RAW) → Printer
 */

// ────────────────────────────────────────────────────────────────────────────
// 🚀 ULTRA-FAST STARTUP: Signal ready IMMEDIATELY
// Windows SCM requires service to signal 'running' within 30s
// This must be the VERY FIRST thing that happens
// ────────────────────────────────────────────────────────────────────────────

// Signal ready to Windows SCM BEFORE any other operations
if (typeof process !== 'undefined' && process.send) {
    // We're running as a Windows service
    process.send({ type: 'started', message: 'Tabeza Bridge started' });
    console.log('✅ Service signaled ready to Windows SCM');
}

const fs      = require('fs');
const path    = require('path');
const { exec, execSync } = require('child_process');
const https   = require('https');
const chokidar = require('chokidar');

// ─── Constants ────────────────────────────────────────────────────────────────

// Old hardcoded placeholder — treat as "not set" so detection runs
const GENERIC_PLACEHOLDER = 'EPSON L3210 Series';

// Keywords that indicate a thermal/receipt printer
const THERMAL_KEYWORDS = [
    'thermal', 'receipt', 'pos', 'epson tm', 'epson t',
    'star ', 'bixolon', 'citizen', 'custom', 'sewoo',
    'rongta', 'xprinter', 'zjiang', 'gprinter', 'hprt',
    'snbc', 'tmt', 'tsp', 'rp-', 'rp3', 'ct-', 'L3210'
];

const DATA_DIR         = 'C:\\ProgramData\\Tabeza';
const DEFAULT_CONFIG   = `${DATA_DIR}\\config.json`;
const DETECTED_PRINTER = `${DATA_DIR}\\detected-printer.json`;

// ─── Printer Resolution ───────────────────────────────────────────────────────

function getWindowsPrinters() {
    try {
        const out = execSync(
            'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
            { timeout: 3000, encoding: 'utf8' }
        );
        return out.split('\n').map(l => l.trim()).filter(Boolean);
    } catch (err) {
        console.warn('⚠️  Could not query Windows printers:', err.message);
        return [];
    }
}

function thermalScore(name) {
    const lower = name.toLowerCase();
    let score = 0;
    for (const kw of THERMAL_KEYWORDS) {
        if (lower.includes(kw)) score += 10;
    }
    // Penalise virtual/non-physical printers
    if (['fax','pdf','xps','onenote','microsoft','send to','adobe','snagit']
            .some(kw => lower.includes(kw))) {
        score -= 50;
    }
    return score;
}

/**
 * Work out which printer to use.
 * Returns { name: String, source: String }
 * Throws if no printer can be found at all.
 */
function resolvePrinter(configuredName) {

    // 1. Explicit name in config (and not the old placeholder)
    if (configuredName && configuredName.trim() && configuredName.trim() !== GENERIC_PLACEHOLDER) {
        console.log(`🖨️  Printer from config.json: "${configuredName.trim()}"`);
        return { name: configuredName.trim(), source: 'config' };
    }

    // 2. Installer's detected-printer.json
    try {
        if (fs.existsSync(DETECTED_PRINTER)) {
            const raw  = fs.readFileSync(DETECTED_PRINTER, 'utf8').replace(/^\uFEFF/, '');
            const det  = JSON.parse(raw);
            // detect-thermal-printer.ps1 may use different casing for the key
            const name = (det.printerName || det.PrinterName || det.name || det.Name || '').trim();
            if (name && name !== GENERIC_PLACEHOLDER) {
                console.log(`🖨️  Printer from detected-printer.json: "${name}"`);
                return { name, source: 'detected' };
            }
        }
    } catch (err) {
        console.warn('⚠️  Could not read detected-printer.json:', err.message);
    }

    // 3. Auto-scan Windows installed printers
    console.log('🔍 No printer configured — scanning Windows for thermal/receipt printers...');
    const printers = getWindowsPrinters();
    console.log(`   Installed printers (${printers.length}): ${printers.join(' | ') || '(none)'}`);

    const candidates = printers
        .map(n => ({ name: n, score: thermalScore(n) }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
        console.log(`🖨️  Auto-selected: "${candidates[0].name}"  (thermal score: ${candidates[0].score})`);
        if (candidates.length > 1) {
            console.log(`   Other candidates: ${candidates.slice(1).map(c => `"${c.name}"`).join(', ')}`);
        }
        return { name: candidates[0].name, source: 'auto-detect' };
    }

    // 4. Fall back to whatever Windows default printer is set
    try {
        const def = execSync(
            'powershell -NoProfile -Command "(Get-WmiObject -Query \'SELECT * FROM Win32_Printer WHERE Default=True\').Name"',
            { timeout: 10000, encoding: 'utf8' }
        ).trim();
        if (def) {
            console.warn(`⚠️  No thermal printer found — falling back to Windows default: "${def}"`);
            console.warn(`   Set bridge.printerName in config.json to override.`);
            return { name: def, source: 'windows-default' };
        }
    } catch (_) {}

    throw new Error(
        'No printer found. Please install a printer driver and set bridge.printerName in ' +
        DEFAULT_CONFIG + '. Run: Get-Printer | Select Name   to see available printers.'
    );
}

// ─── Bridge Class ─────────────────────────────────────────────────────────────

class FinalUniversalBridge {
    constructor(configPath = DEFAULT_CONFIG) {
        this.configPath      = configPath;
        this.config          = this.loadConfig();
        this.watcher         = null;
        this.processingFiles = new Set();
        this.isShuttingDown  = false;
        this.isRunning       = false;
        this.lastActivity    = null;
        this.filesProcessed  = 0;
    }

    loadConfig() {
        const defaults = {
            bridge: {
                enabled:       true,
                printerName:   '',   // intentionally empty — resolved dynamically at start()
                captureFolder: `${DATA_DIR}\\TabezaPrints`,
                tempFolder:    `${DATA_DIR}\\temp`
            },
            barId:  '',
            apiUrl: 'https://tabeza.co.ke'
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const raw    = fs.readFileSync(this.configPath, 'utf8').replace(/^\uFEFF/, '');
                const config = JSON.parse(raw);
                return {
                    ...defaults,
                    bridge: { ...defaults.bridge, ...(config.bridge || {}) },
                    barId:  config.barId  || defaults.barId,
                    apiUrl: config.apiUrl || defaults.apiUrl
                };
            }
        } catch (err) {
            console.warn('⚠️  Config load failed, using defaults:', err.message);
        }
        return defaults;
    }

    savePrinterToConfig(printerName) {
        try {
            let existing = {};
            if (fs.existsSync(this.configPath)) {
                existing = JSON.parse(
                    fs.readFileSync(this.configPath, 'utf8').replace(/^\uFEFF/, '')
                );
            }
            existing.bridge             = existing.bridge || {};
            existing.bridge.printerName = printerName;
            fs.writeFileSync(this.configPath, JSON.stringify(existing, null, 2), 'utf8');
            console.log(`💾 Printer name saved to config.json`);
        } catch (err) {
            console.warn('⚠️  Could not save printer to config.json:', err.message);
        }
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️  Bridge already running');
            return;
        }
        if (!this.config.bridge.enabled) {
            console.log('ℹ️  Bridge disabled in config');
            return;
        }

        console.log('🌉 Tabeza Universal Bridge v4.2');
        console.log(`   Bar ID  : ${this.config.barId || '(not set)'}`);
        console.log(`   API     : ${this.config.apiUrl}`);
        console.log(`   Capture : ${this.config.bridge.captureFolder}`);

        // ── Error 1053 fix ──────────────────────────────────────────────────────────────
        // Windows SCM requires the service to signal 'running' within 30s.
        // resolvePrinter() calls execSync to query Windows printers which can
        // take 10-20s in Session 0, blowing the deadline => Error 1053.
        //
        // Fix: start the folder watcher immediately so SCM is satisfied,
        // then detect the printer in the background via setImmediate().
        // Any print job arriving before detection finishes will log a warning
        // and skip gracefully until printerName is populated.
        // ────────────────────────────────────────────────────────────────────────────

        // Create folders immediately (fast, no external calls)
        [this.config.bridge.captureFolder, this.config.bridge.tempFolder].forEach(folder => {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
                console.log(`✅ Created: ${folder}`);
            }
        });

        // Signal ready to Windows SCM right now - ULTRA FAST STARTUP
        this.isRunning = true;
        console.log('✅ Bridge Active — Watching for print jobs');
        
        // Fast startup mode: skip printer detection if already configured
        if (this.config.bridge.printerName && this.config.bridge.printerName.trim() !== GENERIC_PLACEHOLDER) {
            console.log(`🖨️  Using configured printer: "${this.config.bridge.printerName.trim()}"`);
        } else {
            // Always try detection first, but don't fail startup if it fails
            console.log('   Printer detection running in background...\n');
        }

        // Start watcher and printer detection ASYNC after service signals ready
        setImmediate(() => {
            this.startFolderWatcher();
            if (!this.config.bridge.printerName || this.config.bridge.printerName.trim() === GENERIC_PLACEHOLDER) {
                this.resolvePrinterAsync();
            }
        });
    }

    /**
     * Printer detection runs here, in the background, after SCM is satisfied.
     * Retries every 30s if it fails (handles printer plugged in late).
     */
    resolvePrinterAsync() {
        try {
            // Use synchronous detection to avoid async/await issues in pkg
            const resolved = resolvePrinter(this.config.bridge.printerName);
            this.config.bridge.printerName = resolved.name;
            console.log(`🖨️  Printer ready: "${resolved.name}"  [${resolved.source}]`);
            if (resolved.source !== 'config') {
                this.savePrinterToConfig(resolved.name);
            }
        } catch (err) {
            console.warn(`⚠️  Printer detection failed: ${err.message}`);
            console.warn('   Retrying in 30s... (plug in printer or set bridge.printerName in config.json)');
            setTimeout(() => {
                if (this.isRunning && !this.config.bridge.printerName) {
                    this.resolvePrinterAsync();
                }
            }, 30000);
        }
    }
    startFolderWatcher() {
        const captureFolder = this.config.bridge.captureFolder;
        const originalPort  = this.config.bridge.originalPort || null;

        // Watch the folder for new files AND changes to existing files.
        // CRITICAL: POS folder ports overwrite a single fixed file (e.g. receipt.prn)
        // rather than creating new files each job. Chokidar 'add' never fires for
        // overwrites — we must also listen for 'change'.
        this.watcher = chokidar.watch(captureFolder, {
            persistent:    true,
            ignoreInitial: true,
            depth:         0,
            awaitWriteFinish: {
                stabilityThreshold: 1500,  // wait for POS to finish writing
                pollInterval:       300
            }
        });

        const onFile = (filePath) => {
            // Ignore subfolders and non-.prn files that aren't the port file
            if (fs.statSync(filePath).isDirectory()) return;
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.txt' || ext === '.md') return;  // ignore README etc
            this.handlePrint(filePath);
        };

        this.watcher.on('add',    onFile);  // new file dropped in folder
        this.watcher.on('change', onFile);  // existing file overwritten (fixed-name port)
        this.watcher.on('error',  err => console.error('❌ Watcher error:', err.message));

        console.log(`👀 Watching: ${captureFolder}`);
        if (originalPort) {
            console.log(`   Port file: ${originalPort} (overwrite mode)`);
        }
    }

    async handlePrint(filePath) {
        if (this.processingFiles.has(filePath)) {
            console.log('⏳ Already processing:', path.basename(filePath));
            return;
        }

        // If printer detection hasn't finished yet, wait up to 60s for it
        if (!this.config.bridge.printerName) {
            console.log('⏳ Printer not yet detected, waiting up to 60s...');
            const deadline = Date.now() + 60000;
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (this.config.bridge.printerName || Date.now() > deadline) {
                        clearInterval(check);
                        resolve();
                    }
                }, 1000);
            });
            if (!this.config.bridge.printerName) {
                console.error('❌ No printer detected after 60s — skipping job:', path.basename(filePath));
                return;
            }
        }

        this.processingFiles.add(filePath);

        try {
            console.log(`\n📄 New job: ${path.basename(filePath)}`);
            const data = fs.readFileSync(filePath);

            if (!data || data.length === 0) {
                console.log('⚠️  Empty file, skipping');
                return;
            }
            console.log(`   Size: ${data.length} bytes`);

            this.lastActivity = new Date().toISOString();
            this.filesProcessed++;

            // Cloud upload and physical print run in parallel
            const [cloudResult, printResult] = await Promise.allSettled([
                this.uploadToCloud(data),
                this.forwardToPhysicalPrinter(data)
            ]);

            if (cloudResult.status === 'rejected')
                console.error('⚠️  Cloud upload failed:', cloudResult.reason?.message || cloudResult.reason);
            if (printResult.status === 'rejected')
                console.error('⚠️  Physical print failed:', printResult.reason?.message || printResult.reason);

            try { fs.unlinkSync(filePath); } catch (e) {
                console.warn('⚠️  Could not delete job file:', e.message);
            }

            console.log('✅ Print cycle complete\n');

        } catch (err) {
            console.error('❌ Bridge error:', err.message);
        } finally {
            this.processingFiles.delete(filePath);
        }
    }

    // ─── Cloud Upload ─────────────────────────────────────────────────────────

    uploadToCloud(data) {
        return new Promise((resolve) => {
            const { barId, apiUrl } = this.config;

            if (!barId) {
                console.warn('⚠️  No barId configured — skipping cloud upload');
                return resolve();
            }

            const payload = JSON.stringify({
                barId,
                timestamp:   new Date().toISOString(),
                receiptData: data.toString('base64'),
                source:      'bridge-v4.2'
            });

            const urlObj  = new URL(`${apiUrl}/api/receipt`);
            const options = {
                hostname: urlObj.hostname,
                port:     urlObj.port || 443,
                path:     urlObj.pathname,
                method:   'POST',
                headers:  {
                    'Content-Type':   'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 10000
            };

            console.log(`☁️  Uploading to cloud (barId: ${barId})...`);
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`☁️  Cloud OK (HTTP ${res.statusCode})`);
                    } else {
                        console.warn(`⚠️  Cloud HTTP ${res.statusCode}: ${body.slice(0, 200)}`);
                    }
                    resolve();
                });
            });
            req.on('error',   err => { console.warn('⚠️  Cloud error:', err.message); resolve(); });
            req.on('timeout', ()  => { req.destroy(); console.warn('⚠️  Cloud timed out'); resolve(); });
            req.write(payload);
            req.end();
        });
    }

    // ─── Physical Printer ─────────────────────────────────────────────────────
    //
    // WHY 3 STRATEGIES:
    // Windows services run in Session 0, isolated from the desktop. WinAPI
    // WritePrinter succeeds (OpenPrinter returns a handle) but the bytes never
    // reach USB hardware because the driver context lives in the user's session.
    // This causes "local comm error". The fix: bypass the spooler entirely.
    //
    // Strategy order:
    //   1. TCP/IP direct  — network printers on port 9100 (most reliable, Session 0 safe)
    //   2. USB/COM direct — write raw bytes to the port device file (Session 0 safe)
    //   3. Spooler        — WinAPI WritePrinter (last resort, may fail in Session 0)

    /**
     * Look up the Windows port name for this printer.
     * Returns e.g. "COM3", "192.168.1.100", "USB001", or null.
     */
    getPrinterPort(printerName) {
        try {
            const safe = printerName.replace(/'/g, "''");
            const out  = execSync(
                `powershell -NoProfile -Command "(Get-Printer -Name '${safe}').PortName"`,
                { timeout: 8000, encoding: 'utf8' }
            ).trim();
            return out || null;
        } catch (err) {
            console.warn('⚠️  Could not get printer port:', err.message);
            return null;
        }
    }

    /**
     * Look up the IP address for a named printer port.
     * Returns e.g. "192.168.1.100" or null.
     */
    getPortAddress(portName) {
        try {
            const safe = portName.replace(/'/g, "''");
            const out  = execSync(
                `powershell -NoProfile -Command "(Get-PrinterPort -Name '${safe}').PrinterHostAddress"`,
                { timeout: 8000, encoding: 'utf8' }
            ).trim();
            return out || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Strategy 1: TCP/IP direct to port 9100.
     * Works from Session 0. Used for network-connected thermal printers.
     */
    printViaTcp(data, host, port = 9100) {
        return new Promise((resolve, reject) => {
            console.log(`🖨️  [Strategy 1] TCP direct → ${host}:${port}`);
            const net    = require('net');
            const client = new net.Socket();
            const timer  = setTimeout(() => {
                client.destroy();
                reject(new Error(`TCP connect timeout to ${host}:${port}`));
            }, 10000);

            client.connect(port, host, () => {
                client.write(data, (err) => {
                    if (err) { clearTimeout(timer); client.destroy(); return reject(err); }
                    client.end();
                    clearTimeout(timer);
                    console.log(`🖨️  TCP print OK (${data.length} bytes → ${host}:${port})`);
                    resolve();
                });
            });
            client.on('error', (err) => { clearTimeout(timer); reject(err); });
        });
    }

    /**
     * Strategy 2: Direct USB/COM port write.
     * Bypasses the Windows spooler. Session 0 CAN access \\.\COMx and \\.\USBx
     * device files directly. This is how most POS SDKs work under the hood.
     */
    printViaPort(data, portName) {
        return new Promise((resolve, reject) => {
            console.log(`🖨️  [Strategy 2] Direct port write → ${portName}`);

            // Normalise: "COM3" → "\\.\COM3", "USB001" → "\\.\USB001"
            // For USB ports, use direct path without UNC prefix
            const devicePath = portName.startsWith('\\\\.\\')
                ? portName
                : portName.startsWith('USB') || portName.startsWith('COM')
                    ? `\\\\.\\${portName}`
                    : `\\\\.\\${portName}`;

            // Use PowerShell to open the device stream and write raw bytes.
            // FileStream works in Session 0 because it goes to the device driver
            // directly, not through the spooler session boundary.
            const safePath = devicePath.replace(/\\/g, '\\\\');
            const b64      = data.toString('base64');

            const psScript = `
$devicePath = '${safePath}'
$bytes = [Convert]::FromBase64String('${b64}')
try {
    $stream = [System.IO.File]::Open($devicePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $stream.Close()
    Write-Host "PORT_PRINT_OK bytes=$($bytes.Length)"
} catch {
    throw "Port write failed: $_"
}
`;
            const tempFolder = this.config.bridge.tempFolder;
            const psFile     = path.join(tempFolder, `port_${Date.now()}.ps1`);

            fs.writeFile(psFile, psScript, 'utf8', (wErr) => {
                if (wErr) return reject(wErr);
                exec(
                    `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
                    { timeout: 15000 },
                    (err, stdout, stderr) => {
                        try { fs.unlinkSync(psFile); } catch (_) {}
                        if (err || !stdout.includes('PORT_PRINT_OK')) {
                            const msg = stderr?.trim() || err?.message || stdout?.trim();
                            return reject(new Error(`Port write failed: ${msg}`));
                        }
                        const m = stdout.match(/bytes=(\d+)/);
                        console.log(`🖨️  Port write OK (${m ? m[1] : '?'} bytes → ${portName})`);
                        resolve();
                    }
                );
            });
        });
    }

    /**
     * Strategy 3: Windows spooler via WinAPI WritePrinter.
     * Works reliably when service runs as a user account (not SYSTEM).
     * May fail in Session 0 with "local comm error" for USB printers.
     */
    printViaSpooler(data, printerName) {
        return new Promise((resolve, reject) => {
            console.log(`🖨️  [Strategy 3] Spooler/WritePrinter → "${printerName}"`);

            const tempFolder = this.config.bridge.tempFolder;
            const tag        = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const tempFile   = path.join(tempFolder, `fwd_${tag}.prn`);
            const psFile     = path.join(tempFolder, `print_${tag}.ps1`);
            const safePrinter = printerName.replace(/'/g, "''");

            const psScript = `
$printerName = '${safePrinter}'
$filePath    = '${tempFile}'

# Check printer state before attempting
$p = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if (-not $p) { throw "Printer not found: '$printerName'" }
if ($p.PrinterStatus -ne 'Normal') {
    Write-Warning "Printer status: $($p.PrinterStatus)"
    # Clear stuck jobs
    Get-PrintJob -PrinterName $printerName -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr h, int l, ref DOCINFO d);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
}
"@ -Language CSharp

$bytes   = [System.IO.File]::ReadAllBytes($filePath)
$h       = [IntPtr]::Zero
$doc     = New-Object RawPrint+DOCINFO
$doc.pDocName    = 'TabezaReceipt'
$doc.pOutputFile = $null
$doc.pDataType   = 'RAW'

if (-not [RawPrint]::OpenPrinter($printerName, [ref]$h, [IntPtr]::Zero)) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "OpenPrinter failed (Win32 error $err) for '$printerName'"
}
try {
    $id = [RawPrint]::StartDocPrinter($h, 1, [ref]$doc)
    if ($id -eq 0) { throw "StartDocPrinter failed" }
    [RawPrint]::StartPagePrinter($h) | Out-Null
    $written = 0
    if (-not [RawPrint]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written)) {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "WritePrinter failed (Win32 error $err) - Session 0 isolation? Try running service as a user account."
    }
    [RawPrint]::EndPagePrinter($h) | Out-Null
    [RawPrint]::EndDocPrinter($h) | Out-Null
    Write-Host "RAW_PRINT_OK bytes=$written"
} finally {
    [RawPrint]::ClosePrinter($h) | Out-Null
}
`;

            fs.writeFile(tempFile, data, (wErr) => {
                if (wErr) return reject(wErr);
                fs.writeFile(psFile, psScript, 'utf8', (wErr2) => {
                    if (wErr2) { try { fs.unlinkSync(tempFile); } catch (_) {} return reject(wErr2); }

                    exec(
                        `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
                        { timeout: 20000 },
                        (err, stdout, stderr) => {
                            try { fs.unlinkSync(tempFile); } catch (_) {}
                            try { fs.unlinkSync(psFile);   } catch (_) {}

                            if (err) {
                                if (stderr?.includes('0x80070005') || stderr?.includes('Access'))
                                    console.error('   → Access denied: service may be running as SYSTEM in Session 0.');
                                if (stderr?.includes('local comm'))
                                    console.error('   → Local comm error: Session 0 isolation. Switch service to a user account.');
                                return reject(new Error(stderr?.trim() || err.message));
                            }
                            if (stdout.includes('RAW_PRINT_OK')) {
                                const m = stdout.match(/bytes=(\d+)/);
                                console.log(`🖨️  Spooler print OK (${m ? m[1] : '?'} bytes)`);
                                return resolve();
                            }
                            reject(new Error('Spooler: unexpected output: ' + stdout.trim()));
                        }
                    );
                });
            });
        });
    }

    /**
     * Resolve the real hardware port from PnP when the Windows printer port
     * is a folder/file path (e.g. C:\TabezaPrints\receipt.prn).
     * Returns e.g. "USB001" or null.
     */
    getUsbPortFromPnp(printerName) {
        try {
            const safe = printerName.replace(/'/g, "''");
            // USBPRINT entries contain the USB port in their InstanceId e.g.
            // USBPRINT\EPSONL3210_SERIES\7&33EC6798&0&USB001  → USB001
            const out = execSync(
                `powershell -NoProfile -Command "` +
                `Get-PnpDevice | Where-Object { $_.FriendlyName -like '*${safe.split(' ')[0]}*' -and $_.InstanceId -like 'USBPRINT*' } | ` +
                `Select-Object -ExpandProperty InstanceId -First 1"`,
                { timeout: 10000, encoding: 'utf8' }
            ).trim();
            if (!out) return null;
            // Extract USBxxx from end of InstanceId
            const match = out.match(/&(USB\d+)$/i);
            return match ? match[1] : null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Main print dispatcher — tries strategies in order, stops at first success.
     *
     * Port type detection handles all real-world cases:
     *   - Folder port (e.g. C:\TabezaPrints\receipt.prn) → look up real USB via PnP
     *   - USB001 / COM3 / LPT1 → direct device file write
     *   - IP address / TCP port name → TCP socket to port 9100
     *   - Anything else → spooler fallback
     */
    async forwardToPhysicalPrinter(data) {
        const printerName = this.config.bridge.printerName;
        console.log(`\n🖨️  Print dispatch for: "${printerName}" (${data.length} bytes)`);

        // Look up the Windows port for this printer
        let portName = this.getPrinterPort(printerName);
        console.log(`   Configured port: ${portName || '(unknown)'}`);

        const errors = [];

        // ── Folder port? Resolve real hardware port via PnP ──────────────────
        // When port is a file/folder path (e.g. C:\TabezaPrints\receipt.prn)
        // the printer is physically connected via USB. Find the actual USB port.
        if (portName && (portName.includes('\\') || portName.includes('/') || portName.match(/^[A-Z]:\\/i))) {
            console.log('   Port is a folder/file path — resolving real USB port via PnP...');
            const usbPort = this.getUsbPortFromPnp(printerName);
            if (usbPort) {
                console.log(`   Real hardware port: ${usbPort}`);
                portName = usbPort;
            } else {
                console.warn('   Could not resolve USB port from PnP — will try spooler');
            }
        }

        // ── Strategy 1: TCP/IP direct (network printers) ─────────────────────
        if (portName) {
            let host = null;
            if (/^\d+\.\d+\.\d+\.\d+/.test(portName)) {
                host = portName.split(':')[0];
            } else if (portName.toUpperCase().startsWith('IP_') || portName.toUpperCase().startsWith('TCP')) {
                host = this.getPortAddress(portName);
            }
            if (host) {
                try {
                    await this.printViaTcp(data, host, 9100);
                    return;
                } catch (err) {
                    console.warn(`   Strategy 1 failed: ${err.message}`);
                    errors.push(`TCP: ${err.message}`);
                }
            }
        }

        // ── Strategy 2: Direct USB/COM/LPT device write ───────────────────────
        if (portName && /^(COM\d+|USB\d+|LPT\d+)$/i.test(portName)) {
            try {
                await this.printViaPort(data, portName);
                return;
            } catch (err) {
                console.warn(`   Strategy 2 failed: ${err.message}`);
                errors.push(`Port: ${err.message}`);
            }
        }

        // ── Strategy 3: Windows spooler (fallback) ────────────────────────────
        try {
            await this.printViaSpooler(data, printerName);
            return; // success
        } catch (err) {
            console.warn(`   Strategy 3 failed: ${err.message}`);
            errors.push(`Spooler: ${err.message}`);
        }

        // All strategies failed
        throw new Error(
            `All print strategies failed for "${printerName}":\n` +
            errors.map(e => `  • ${e}`).join('\n') + '\n' +
            `  Tip: If service runs as SYSTEM, change it to run as a local user account in services.msc`
        );
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    stop() {
        if (!this.isRunning) { console.log('⚠️  Bridge not running'); return; }
        console.log('🛑 Stopping bridge...');
        this.isShuttingDown = true;
        if (this.watcher) { this.watcher.close(); this.watcher = null; }
        this.processingFiles.clear();
        this.isRunning = false;
        console.log('✅ Bridge stopped');
    }

    /**
     * Switch to a different printer at runtime (e.g. from printer-settings UI).
     * Saves the new name to config.json immediately.
     */
    restart(newPrinterName) {
        console.log(`🔄 Switching printer to: "${newPrinterName}"`);
        this.stop();
        this.config.bridge.printerName = newPrinterName;
        this.savePrinterToConfig(newPrinterName);
        this.start();
    }
}

module.exports = FinalUniversalBridge;

// ─── Entry point ──────────────────────────────────────────────────────────────
if (require.main === module) {
    const bridge = new FinalUniversalBridge();
    bridge.start();

    const shutdown = (sig) => {
        console.log(`\n🛑 ${sig} — shutting down...`);
        bridge.stop();
        process.exit(0);
    };
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}