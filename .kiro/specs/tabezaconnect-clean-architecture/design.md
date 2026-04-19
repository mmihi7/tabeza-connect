# Design Document: TabezaConnect Clean Architecture

## Overview

TabezaConnect currently runs three competing service systems simultaneously — an NSSM Windows Service, the Electron tray app (which also tries to start the service in-process), and an older standalone compiled service. This produces 4+ Electron instances and 9+ Node processes on every launch, causing duplicate uploads, resource waste, and instability.

This design consolidates everything into a single **Electron-only architecture**. `electron-main.js` is the sole entry point. The Electron app spawns `src/service/index.js` as a child process using `ELECTRON_RUN_AS_NODE=1`. The NSSM Windows Service is decommissioned. The installer registers only the Electron tray app via a registry Run key.

### Key Design Decisions

**Child process over in-process service**: The current `src/tray/main.js` runs the service in-process by `require()`-ing `src/service/index.js` directly. This couples the service lifecycle to the Electron renderer process and makes clean shutdown difficult. Spawning as a child process gives process isolation, a clean restart mechanism, and a clear kill path on exit.

**`process.execPath` with `ELECTRON_RUN_AS_NODE=1`**: Rather than bundling a separate Node.js binary, the Electron binary itself is used as the Node runtime. Setting `ELECTRON_RUN_AS_NODE=1` suppresses Electron's GUI subsystem so the binary behaves as plain Node. This avoids shipping an extra ~80MB Node binary and ensures the child process uses the same Node version as the parent.

**Single canonical config path**: Both the Electron app and the child process read from and write to `C:\TabezaPrints\config.json`. The child process's `RegistryReader` already supports this path as its primary config file location. The Electron app must stop using `app.getPath('userData')` for any config that the child process also needs.

**HKCU Run key only**: The NSSM service ran under `LocalService` and started before any user logged in. The new architecture starts at user login via a Run key. This is appropriate for a venue PC where a single operator account is always logged in.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Venue Windows PC                           │
│                                                                 │
│  Windows Login                                                  │
│       │                                                         │
│       │  HKCU Run key                                           │
│       ▼                                                         │
│  TabezaConnect.exe  (electron-main.js)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Electron Main Process                                   │   │
│  │                                                          │   │
│  │  1. setAppUserModelId()                                  │   │
│  │  2. requestSingleInstanceLock()  ──► exits if not got    │   │
│  │  3. app.whenReady()                                      │   │
│  │  4. TrayApp.start()  (tray icon + status window)         │   │
│  │  5. spawn Child_Process                                  │   │
│  │       │                                                  │   │
│  │       │  process.execPath                                │   │
│  │       │  ELECTRON_RUN_AS_NODE=1                          │   │
│  │       │  src/service/index.js                            │   │
│  │       ▼                                                  │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Child_Process  (service/index.js)              │    │   │
│  │  │                                                 │    │   │
│  │  │  • chokidar watches C:\TabezaPrints\order.prn   │    │   │
│  │  │  • ESC/POS strip → regex parse → queue          │    │   │
│  │  │  • Upload worker (exponential backoff)          │    │   │
│  │  │  • Express HTTP on 127.0.0.1:8765               │    │   │
│  │  │  • Heartbeat every 30s                          │    │   │
│  │  │                                                 │    │   │
│  │  │  Reads/writes: C:\TabezaPrints\config.json      │    │   │
│  │  │  Logs to:      C:\TabezaPrints\logs\service.log │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  Electron_App polls http://127.0.0.1:8765/api/status     │   │
│  │  Reads/writes: C:\TabezaPrints\config.json               │   │
│  │  Logs to:      C:\TabezaPrints\logs\electron.log         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Status Window (BrowserWindow)  ◄──── IPC ────► Electron Main  │
│  http://127.0.0.1:8765          ◄──── HTTP ───► Child_Process   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
              ┌──────────────────────────────┐
              │       Tabeza Cloud           │
              │  tabeza.co.ke                │
              └──────────────────────────────┘
```

### Component Relationships

| Component | Role | Communicates With |
|---|---|---|
| `electron-main.js` | Sole entry point; owns child process lifecycle | TrayApp (direct require), Child_Process (SIGTERM/SIGKILL via `child.kill()`), Status Window (IPC) |
| `src/tray/tray-app.js` | Tray icon, status window, context menu | Electron main (callback via `onExitRequested`), Child_Process (HTTP polling on :8765) |
| `src/service/index.js` | Receipt capture, upload queue, HTTP API | Tabeza cloud (HTTPS), Electron_App (HTTP on :8765) |
| `src/tray/status-window.html` | Management UI renderer | Electron main (IPC via preload) |

**Note on shutdown signalling**: The Child_Process is spawned with `stdio: ['ignore', 'pipe', 'pipe']` — three entries, no IPC channel. Therefore `child.send()` is NOT used. Shutdown is signalled exclusively via `child.kill('SIGTERM')` followed by `child.kill('SIGKILL')` if needed. The graceful shutdown sequence below reflects this.

`src/main.js` and `src/tray/main.js` remain in the repository but are **not entry points**. `electron-main.js` requires `tray-app.js` directly. Neither `src/main.js` nor `src/tray/main.js` is referenced by `package.json` `"main"` or by any build target.

---

## Components and Interfaces

### 1. Electron Main Process (`electron-main.js`)

Responsibilities after refactor:
- Call `app.setAppUserModelId('com.tabeza.tabezaconnect')` before `requestSingleInstanceLock()`
- Call `requestSingleInstanceLock()` before `app.whenReady()`
- Require `./src/tray/tray-app.js` and start the tray
- Spawn and supervise the Child_Process
- Write logs to `C:\TabezaPrints\logs\electron.log` with rotation

**Child process spawn interface:**

```javascript
const child = spawn(
  process.execPath,                    // Electron binary as Node runtime
  [path.join(__dirname, 'src/service/index.js')],
  {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',       // Suppress Electron GUI subsystem
      TABEZA_BAR_ID:      config.barId,
      TABEZA_API_URL:     config.apiUrl,
      TABEZA_WATCH_FOLDER: config.watchFolder,
    },
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr for logging
  }
);
```

**Restart supervisor state machine:**

```
STOPPED ──spawn──► RUNNING
RUNNING ──exit(0)──► STOPPED          (clean shutdown, no restart)
RUNNING ──exit(N)──► RESTARTING       (unexpected exit, attempt restart)
RESTARTING ──attempt < 3──► RUNNING
RESTARTING ──attempt >= 3──► ERROR    (show tray error, stop retrying)
ERROR ──user restart──► RUNNING       (manual recovery via tray menu)
```

Restart attempts reset to 0 after the child process has been running for more than 60 seconds (stable run threshold).

**Graceful shutdown sequence:**

```
1. isQuitting = true
2. child.kill('SIGTERM')              // signal child to shut down (no IPC channel)
3. Wait up to 5000ms for child.exitCode !== null
4. If still running: child.kill('SIGKILL')
5. app.quit()
```

### 2. TrayApp (`src/tray/tray-app.js`)

No structural changes required. The existing `TrayApp` class already:
- Manages the tray icon and status window
- Polls `http://localhost:8765/api/status` every 10 seconds
- Exposes `handleExit()` for graceful shutdown
- Exposes `onServiceError()` for error state transitions

The only change: `handleExit()` must signal the Electron main process to kill the child process before calling `app.quit()`. This is done by emitting an event on a shared `EventEmitter` or by calling a registered callback.

**Interface between electron-main.js and TrayApp:**

```javascript
// electron-main.js registers a shutdown callback
trayApp.onExitRequested = async () => {
  await killChildProcess();  // 5s grace + force kill
  app.quit();
};
```

### 3. Child Process (`src/service/index.js`)

No structural changes required. The service already:
- Reads config via `RegistryReader.loadConfig()` (env vars → registry → Config_Path)
- Binds Express to `127.0.0.1:8765`

**Log routing**: The Child_Process's stdout and stderr are captured by `electron-main.js` via the `stdio: ['ignore', 'pipe', 'pipe']` spawn option. `electron-main.js` pipes these streams through the log rotator and writes them to `{Log_Dir}\service.log`. The Child_Process itself does NOT need to be modified to use the log rotator — the parent process handles all log writing for it.

```javascript
// In electron-main.js, after spawn:
child.stdout.on('data', (data) => {
  writeLog(SERVICE_LOG_PATH, data.toString().trim(), LOG_OPTS);
});
child.stderr.on('data', (data) => {
  writeLog(SERVICE_LOG_PATH, '[STDERR] ' + data.toString().trim(), LOG_OPTS);
});
```

The only change to `src/service/index.js`: ensure it does not `require('electron')` — it is plain Node and must have no Electron-specific dependencies.

### 4. Log Rotation Module

A shared utility used by both `electron-main.js` and `src/service/index.js`.

```javascript
// src/utils/log-rotator.js

/**
 * Write a line to a log file, rotating at maxBytes.
 * Keeps at most maxFiles rotated copies.
 *
 * @param {string} logPath   - Absolute path to the active log file
 * @param {string} line      - Log line to append (newline appended automatically)
 * @param {object} opts      - { maxBytes: 5*1024*1024, maxFiles: 3 }
 */
function writeLog(logPath, line, opts = {}) { ... }

/**
 * Rotate logPath → logPath.1 → logPath.2 → logPath.3
 * Delete logPath.{maxFiles+1} if it exists.
 *
 * @param {string} logPath
 * @param {number} maxFiles
 */
function rotate(logPath, maxFiles) { ... }
```

Rotation algorithm:
1. Check `fs.statSync(logPath).size`
2. If `size >= maxBytes`: call `rotate(logPath, maxFiles)`
3. Append `line + '\n'` to `logPath`

`rotate()` renames files in reverse order: `.3` → deleted, `.2` → `.3`, `.1` → `.2`, active → `.1`, then creates a new empty active file.

### 5. Installer (`installer-pkg-v1.7.15.iss`)

Changes required:

**Remove from `[Run]`:**
- Step 3: `register-service-pkg.ps1` (Windows Service registration)
- Step 4: `sc.exe start TabezaConnect`

**Add to `[Run]` (NSSM decommission, runs before file copy):**
```
; Decommission NSSM service if present
Filename: "{sys}\sc.exe"; Parameters: "stop TabezaConnect";
  Flags: runhidden waituntilterminated; RunOnceId: "StopNSSM"

Filename: "{sys}\sc.exe"; Parameters: "delete TabezaConnect";
  Flags: runhidden waituntilterminated; RunOnceId: "DeleteNSSM"
```

The NSSM decommission runs in `InitializeSetup()` (before file copy), not in `[Run]` (after file copy), to avoid file-lock conflicts.

**Keep in `[Registry]`:**
```
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run";
  ValueType: string; ValueName: "TabezaConnect";
  ValueData: """{app}\TabezaConnect.exe""";
  Flags: uninsdeletevalue
```

**Config preservation on upgrade:**
```pascal
// In InitializeSetup() — before files are copied
if FileExists('C:\TabezaPrints\config.json') then
  // Do NOT overwrite — the [Files] entry uses Flags: onlyifdoesntexist
```

The `config.template.json` → `config.json` copy already uses `Flags: onlyifdoesntexist`, which preserves existing config on upgrade.

**Remove from build output (`package.json` `files` array):**
```json
"!src/service/daemon/**",
"!src/service/dist/**"
```

---

## Data Models

### Config File (`C:\TabezaPrints\config.json`)

Single canonical config shared by Electron_App and Child_Process:

```json
{
  "barId":       "venue-bar-id",
  "apiUrl":      "https://tabeza.co.ke",
  "watchFolder": "C:\\TabezaPrints",
  "driverId":    "driver-HOSTNAME",
  "httpPort":    8765,
  "printers":    [{ "name": "EPSON L3210 Series", "isDefault": true }]
}
```

Both processes read this file. The Electron_App writes it when the user saves config via the status window. The Child_Process writes it when the user saves config via the HTTP API (`POST /api/configure`). Both writes use `JSON.stringify(config, null, 2)` with UTF-8 encoding.

**Atomic write pattern (mandatory for all config writes):** To prevent race conditions and JSON corruption from concurrent writes, all config writes MUST use atomic rename:

```javascript
// Write to a temp file first, then atomically rename to config.json
// fs.renameSync is atomic on NTFS — the file is either the old version or the new version, never truncated mid-write
const tmp = configPath + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
fs.renameSync(tmp, configPath);
```

This pattern is used by both the Electron_App and the Child_Process for all config writes. There is no file locking mechanism — atomic rename is sufficient because the write is a single syscall from the OS perspective.

The Electron_App **must not** use `app.getPath('userData')` for `barId`, `apiUrl`, or `watchFolder`. These fields live exclusively in Config_Path.

### Child Process Supervisor State

Held in memory in `electron-main.js`:

```javascript
{
  child: ChildProcess | null,
  restartAttempts: number,       // 0–3
  lastStartTime: number,         // Date.now() at last spawn
  state: 'stopped' | 'running' | 'restarting' | 'error',
  isQuitting: boolean,
}
```

### Log Entry Format

```
[2026-03-02T10:00:00.000Z][INFO] Message text here
[2026-03-02T10:00:00.000Z][WARN] Warning message
[2026-03-02T10:00:00.000Z][ERROR] Error message
```

### Log File Layout

```
C:\TabezaPrints\logs\
├── electron.log        ← active Electron main process log
├── electron.log.1      ← previous rotation
├── electron.log.2
├── electron.log.3
├── service.log         ← active Child_Process log
├── service.log.1
├── service.log.2
└── service.log.3
```

Max 4 files per log name (1 active + 3 rotated). Each file capped at 5MB. Maximum disk usage: 8 files × 5MB = 40MB.

### NSSM Decommission Sequence

```
InitializeSetup() {
  1. sc query TabezaConnect              (check if NSSM service exists)
  2. IF exists:
     a. sc stop TabezaConnect            (graceful stop — releases file locks first)
     b. Sleep 3000ms
     c. IF stop failed:
        - sc queryex TabezaConnect       (get PID)
        - taskkill /F /PID {pid}         (kill by PID)
        - IF PID extraction failed:
          wmic process where "name='node.exe' and commandline like '%tabeza%'" call terminate
     d. sc delete TabezaConnect
     e. IF delete failed: log and continue (orphaned but not running)
  3. taskkill /F /IM TabezaConnect.exe   (stop running tray instances AFTER service stopped)
     NOTE: This kills all TabezaConnect.exe processes. The installer itself is not
     TabezaConnect.exe so this is safe. If the user launched the installer from the
     tray, the tray process is killed here — the Inno Setup wizard continues independently.
  4. Sleep 2000ms                        (allow processes to fully terminate)
  5. [Files] section copies new application files
  6. [Run] section: create folders, configure printer, write Bar ID, launch tray
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single Instance Invariant

*For any* number N ≥ 1 of `TabezaConnect.exe` launch attempts, the number of running TabezaConnect Electron processes SHALL equal the count observed after a single launch — process count SHALL NOT increase with N.

**Validates: Requirements 3.6, 4.5**

### Property 2: Config Round-Trip

*For any* valid configuration object containing `barId`, `apiUrl`, and `watchFolder` values, writing that configuration to `Config_Path` via the Electron_App's config write path and then reading it back via `RegistryReader.loadConfig()` SHALL return an object with equivalent `barId`, `apiUrl`, and `watchFolder` values.

**Validates: Requirements 10.6**

### Property 3: Log Rotation Correctness

*For any* sequence of log writes that causes a log file to reach or exceed 5MB, the log rotation function SHALL rename the active file to `.1` (shifting existing rotated files), start a new active log file, and ensure the total number of rotated files for that log name never exceeds 3 (deleting the oldest when the limit is exceeded).

**Validates: Requirements 12.3, 12.4**

---

## Error Handling

### Child Process Crash

| Scenario | Handling |
|---|---|
| Exit code 0 (clean) | No restart. Log "Child process exited cleanly." |
| Exit code ≠ 0, attempts < 3 | Increment counter. Wait 2^attempt × 1000ms. Respawn. Log attempt number. |
| Exit code ≠ 0, attempts = 3 | Transition tray to ERROR state. Show notification: "Service failed to start after 3 attempts. Click to view logs." Stop retrying. |
| Running > 60s then crash | Reset attempt counter to 0 before restarting (treat as fresh start). |
| `isQuitting = true` | Do not restart. This is expected. |

### Port 8765 Already In Use

The Child_Process handles this internally — it logs `EADDRINUSE` and the Electron_App's status polling will detect the service as unreachable. The tray transitions to ERROR state. The user can use "Restart Service" from the tray menu to attempt recovery.

If the port is occupied by a leftover process from a previous crash, the Electron_App may attempt to clear it on startup — but ONLY after verifying the occupying process is a TabezaConnect/Node process:

```javascript
// On startup, before spawning child:
// 1. netstat -ano | findstr :8765  → extract PID
// 2. wmic process where processid={pid} get name,commandline
// 3. ONLY kill if name === 'node.exe' AND commandline contains 'tabeza'
// 4. If process is unrelated: log the conflict, skip the kill,
//    transition tray to ERROR state with message "Port 8765 is in use by another application"
```

Blindly killing by PID is forbidden — port 8765 could be occupied by an unrelated process on the venue PC.

### Config File Missing or Malformed

`RegistryReader.loadConfig()` already handles this gracefully — it falls through to defaults and logs a warning. The Child_Process starts without a `barId`, the tray transitions to UNCONFIGURED state, and the user is prompted to configure via the status window.

### NSSM Service Decommission Failures

| Failure | Recovery |
|---|---|
| `sc stop` fails (hung) | Extract PID via `sc queryex`, kill by PID. If PID extraction fails, kill all `node.exe` with "tabeza" in command line via `wmic`. |
| `sc delete` fails after stop | Log failure, continue installation. Service is stopped but not deleted — it will not auto-start. |
| `nssm.exe` not present | Use only `sc.exe` commands (always available on Windows). No dependency on NSSM binary. |

### Graceful Shutdown Timeout

If the Child_Process does not exit within 5 seconds of receiving the shutdown signal:
1. Send `SIGTERM` (Windows: equivalent via `child.kill()`)
2. Wait 1 second
3. Send `SIGKILL` (`child.kill('SIGKILL')` / `taskkill /F /PID`)
4. Proceed with `app.quit()`

This ensures no orphaned Node processes remain after the Electron app exits.

---

## Testing Strategy

### Unit Tests

Focus on the new components introduced by this refactor:

- **Child process supervisor**: Test the restart state machine — verify that 3 consecutive crashes transition to ERROR state, that a clean exit does not trigger restart, and that `isQuitting = true` suppresses restart.
- **Log rotation**: Test `rotate()` with a mock filesystem — verify file renaming sequence, verify files beyond `maxFiles` are deleted, verify a new active file is created.
- **Config round-trip**: Test that writing a config object to `Config_Path` and reading it back via `RegistryReader.loadConfig()` returns equivalent values.
- **NSSM decommission logic**: Test the fallback PID extraction and kill sequence using mocked `exec` calls.

### Property-Based Tests

Property-based testing is appropriate for this feature. The log rotation and config round-trip behaviors have universal properties that hold across a wide range of inputs. The single-instance invariant is testable as a property over N launch attempts.

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (JavaScript PBT library, compatible with Jest)

**Minimum iterations**: 100 per property test.

**Property 1 test** — Single Instance Invariant:
```javascript
// Feature: tabezaconnect-clean-architecture, Property 1: single instance invariant
// For any N in [2..10], launching TabezaConnect N times results in the same
// process count as launching once.
// Uses a mock for app.requestSingleInstanceLock() to simulate the lock mechanism.
fc.assert(fc.property(
  fc.integer({ min: 2, max: 10 }),
  (n) => {
    const processCount = simulateNLaunches(n);
    return processCount === 1;
  }
), { numRuns: 100 });
```

**Property 2 test** — Config Round-Trip:
```javascript
// Feature: tabezaconnect-clean-architecture, Property 2: config round-trip
// For any valid config, write → read returns equivalent values.
fc.assert(fc.property(
  fc.record({
    barId:       fc.string({ minLength: 6 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
    apiUrl:      fc.webUrl(),
    watchFolder: fc.string({ minLength: 3 }),
  }),
  (config) => {
    writeConfigToPath(CONFIG_PATH, config);
    const loaded = RegistryReader.loadConfig();
    return loaded.barId === config.barId
      && loaded.apiUrl === config.apiUrl
      && loaded.watchFolder === config.watchFolder;
  }
), { numRuns: 100 });
```

**Property 3 test** — Log Rotation Correctness:
```javascript
// Feature: tabezaconnect-clean-architecture, Property 3: log rotation correctness
// For any sequence of writes that exceeds 5MB, rotation keeps <= 3 rotated files.
fc.assert(fc.property(
  fc.array(fc.string({ minLength: 100, maxLength: 1000 }), { minLength: 1, maxLength: 200 }),
  (lines) => {
    const logPath = tmpLogPath();
    for (const line of lines) {
      writeLog(logPath, line, { maxBytes: 5 * 1024 * 1024, maxFiles: 3 });
    }
    const rotatedCount = countRotatedFiles(logPath);
    return rotatedCount <= 3;
  }
), { numRuns: 100 });
```

### Integration Tests

- **NSSM decommission**: On a Windows VM with a running NSSM service, run the installer and verify `sc query TabezaConnect` returns "service does not exist" after completion.
- **Single instance lock**: Launch `TabezaConnect.exe` twice in quick succession on a real Windows machine; verify only one process remains.
- **Child process spawn**: Launch the app and verify `ELECTRON_RUN_AS_NODE=1` is set in the child process environment (via `wmic process get commandline`).
- **Config preservation on upgrade**: Install v1.7.0, configure a Bar ID, run the new installer, verify Bar ID is preserved in `C:\TabezaPrints\config.json`.

### Smoke Tests

- `package.json` `"main"` field equals `"electron-main.js"`
- `package.json` build `files` array excludes `src/service/daemon/**` and `src/service/dist/**`
- `dist/win-unpacked/TabezaConnect.exe` exists after `pnpm run build:win`
- `C:\TabezaPrints\logs\` directory is created by installer
- Run key exists at `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\TabezaConnect` after installation
- No Windows Service named `TabezaConnect` exists after installation

---

## Build Hook: `build/afterPack.js`

`package.json` references `"afterPack": "build/afterPack.js"`. This hook runs after electron-builder packages the app. Its current responsibilities:

1. Removes any `ffmpeg`-related files from the build output (TabezaConnect does not use media playback)
2. Creates an empty `ffmpeg.dll` stub to prevent Electron from showing a missing-DLL error dialog on startup

**This hook is retained as-is.** It does not register any Windows Service, does not modify native modules, and does not interfere with the clean architecture refactor. No changes required.

---

## Upgrade Rollback Policy

The NSSM decommission sequence in `InitializeSetup()` stops and deletes the NSSM service **before** the `[Files]` section copies new application files. This creates a window where, if the file copy fails (disk full, file locked, UAC denial), the machine is left with:
- No running NSSM service (stopped and deleted)
- No working new Electron app (file copy incomplete)

**Policy: Accept the risk, rely on Inno Setup's built-in rollback.**

Inno Setup automatically rolls back file copies on failure — it tracks every file written and deletes them if the installation fails. However, it does NOT restore the deleted NSSM service registration.

This means on a failed upgrade:
- New files are rolled back by Inno Setup ✅
- NSSM service registration is NOT restored ❌
- The machine has no TabezaConnect running

**Mitigation**: The installer writes a pre-upgrade backup of the NSSM service name and binary path to `C:\TabezaPrints\logs\pre-upgrade-service-backup.txt` before decommissioning. If the upgrade fails, a venue operator or support engineer can use this file to manually re-register the service. This is documented in the installer's failure dialog.

This risk is acceptable because: (a) Inno Setup file copy failures are rare on a healthy disk, (b) the venue still has paper receipts as fallback, and (c) re-running the installer will complete the upgrade successfully.
