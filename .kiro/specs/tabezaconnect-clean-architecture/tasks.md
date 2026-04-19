# Implementation Plan: TabezaConnect Clean Architecture (v2)

## Overview

Consolidate TabezaConnect from three competing service systems into a single Electron-only
architecture. The WinSW Windows Service (installed by Inno Setup via
`src/service/daemon/tabezaconnect.exe`) is decommissioned. The Electron tray app becomes the
sole owner of the service lifecycle. Print capture continues via Redmon + Windows Print API —
the capture pipeline is unchanged. Tasks follow the required sequence: cleanup → build config →
log rotator → electron-main.js refactor → installer update → tests → verify.

## Glossary

- **Windows_Service**: The SCM entry named `TabezaConnect`, managed by a WinSW wrapper binary
  (`src/service/daemon/tabezaconnect.exe`), installed by Inno Setup. Not NSSM.
- **WinSW_Binary**: `src/service/daemon/tabezaconnect.exe` — the WinSW wrapper that registers
  and manages the Windows Service.
- **Capture_Script**: `src/capture/index.js` (compiled to `capture.exe`). Invoked directly by
  Redmon for each print job. Receives raw ESC/POS bytes via **stdin**, writes parsed receipt
  JSON to `C:\TabezaPrints\queue\pending\`. This is a separate short-lived process — NOT the
  Child_Process managed by Electron.
- **Child_Process**: `src/service/index.js` — the upload worker + HTTP server on port 8765.
  Reads from `queue\pending\`, POSTs to cloud, serves the management UI. Spawned and supervised
  by `electron-main.js`.
- **Print_Capture**: Receipt data enters via Redmon piping stdin to `capture.exe`. The
  Child_Process (`service/index.js`) does NOT watch files or use chokidar. `TABEZA_WATCH_FOLDER`
  is not consumed by the Child_Process and must NOT be passed in the spawn env.

## Tasks

### Phase 1 — Cleanup and Build Config

- [x] 1.1 Exclude daemon and old service dist from build output
  - In `package.json` build `files` array, add after existing exclusions:
    ```
    "!src/service/daemon/**",
    "!src/service/dist/**"
    ```
  - Verify `pnpm run build:win` does not include these paths in `dist/win-unpacked/`
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 1.2 Verify single entry point
  - Confirm `package.json` `"main"` field is `"electron-main.js"` and only `"electron-main.js"`
  - Confirm neither `src/main.js` nor `src/tray/main.js` appears as a build entry point in
    `package.json`
  - Confirm `electron-builder.json` and `src/electron-builder.yml` have been deleted — verify
    they are gone
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.3 Verify build config completeness
  - Confirm `"npmRebuild": false` is present in the `build` section
  - Confirm `"asar": true` is present in the `build` section
  - Confirm `asarUnpack` includes `"**/*.node"` covering usb, serialport, and better-sqlite3
  - Confirm ia32 arch is removed — x64 only
  - Confirm `nsis` section is removed (project uses Inno Setup, not electron-builder NSIS)
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 1.4 Inspect and clear `build/afterPack.js`
  - Read `build/afterPack.js` in full
  - Confirm it only removes ffmpeg files and creates an empty `ffmpeg.dll` stub
  - Confirm it does NOT register any Windows Service, does NOT modify entry points, does NOT
    rebuild native modules
  - If it does anything else: document it here and decide whether to retain or remove before
    proceeding
  - No changes expected — retain as-is if confirmed safe
  - _Requirements: 2.3 (build determinism)_

- [x] 1.5 Confirm Redmon integration point in `src/service/index.js`
  - **CONFIRMED** (pre-verified before writing this document):
    - `src/capture/index.js` is the Capture_Script invoked by Redmon per print job
    - It reads raw ESC/POS bytes from **stdin** (Redmon pipes the job directly)
    - It writes parsed receipt JSON to `C:\TabezaPrints\queue\pending\`
    - `src/service/index.js` is the upload worker + HTTP server — reads queue, POSTs to cloud
    - `TABEZA_WATCH_FOLDER` is **not consumed** by `service/index.js` — do NOT pass it in spawn env
  - Action: Add a comment in `electron-main.js` near the spawn call documenting this architecture
  - _Requirements: 3.7_

---

### Phase 2 — Log Rotation Utility

- [x] 2.1 Implement `src/utils/log-rotator.js`
  - Create `src/utils/log-rotator.js` with two exported functions:
    ```javascript
    // writeLog(logPath, line, opts)
    // opts defaults: { maxBytes: 5 * 1024 * 1024, maxFiles: 3 }
    // - Ensure log directory exists: fs.mkdirSync(path.dirname(logPath), { recursive: true })
    // - If file exists and size >= maxBytes: call rotate(logPath, opts.maxFiles)
    // - fs.appendFileSync(logPath, line + '\n', 'utf8')

    // rotate(logPath, maxFiles)
    // - Delete logPath.{maxFiles} if exists
    // - Rename in reverse: .2→.3, .1→.2, active→.1
    // - fs.writeFileSync(logPath, '') — create new empty active file
    ```
  - Handle first write when log file does not yet exist — skip size check, go straight to append
  - Export `{ writeLog, rotate }`
  - _Requirements: 12.3, 12.4_

- [x]* 2.2 Write property test for log rotation (Property 3)
  - In `src/__tests__/clean-architecture.property.test.js`
  - For any array of strings (100–1000 chars each, up to 200 entries), write each via `writeLog`
    with `maxBytes: 5MB, maxFiles: 3` to a temp directory
  - Assert `countRotatedFiles(logPath) <= 3` after all writes
  - `countRotatedFiles`: count files matching `logPath + '.1'`, `'.2'`, `'.3'` that exist on disk
  - Minimum 100 runs (`numRuns: 100`)
  - _Requirements: 12.3, 12.4_

---

### Phase 3 — electron-main.js Refactor

- [x] 3.1 Single instance lock and app identity
  - Ensure this exact ordering at the top of the file, before any other `app` calls:
    ```javascript
    app.setAppUserModelId('com.tabeza.tabezaconnect');
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      process.exit(0);
    }
    ```
  - On `second-instance` event: if a status window exists, restore and focus it
  - Remove any previous ternary or conditional form of `requestSingleInstanceLock`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3.2 Centralise config path and log constants
  - Define at module level:
    ```javascript
    const CONFIG_PATH        = 'C:\\TabezaPrints\\config.json';
    const LOG_DIR            = 'C:\\TabezaPrints\\logs';
    const ELECTRON_LOG_PATH  = path.join(LOG_DIR, 'electron.log');
    const SERVICE_LOG_PATH   = path.join(LOG_DIR, 'service.log');
    const LOG_OPTS           = { maxBytes: 5 * 1024 * 1024, maxFiles: 3 };
    ```
  - Replace all usage of `app.getPath('userData')` for `barId`, `apiUrl`, or `watchFolder` with
    reads from `CONFIG_PATH`
  - All config writes must use the atomic rename pattern:
    ```javascript
    const tmp = CONFIG_PATH + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
      fs.renameSync(tmp, CONFIG_PATH);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch (_) {}
      throw err;
    }
    ```
  - _Requirements: 10.5, 10.6_

- [x] 3.3 Implement child process spawn
  - Define supervisor state object at module level:
    ```javascript
    const supervisor = {
      child: null,
      restartAttempts: 0,
      lastStartTime: 0,
      state: 'stopped',  // 'stopped' | 'running' | 'restarting' | 'error' | 'unconfigured'
      isQuitting: false,
    };
    ```
  - Implement `spawnChild()`:
    - Read config from `CONFIG_PATH` — if file missing or `barId` is empty/null, set
      `supervisor.state = 'unconfigured'`, update tray icon to unconfigured state, return without
      spawning
    - Ensure `LOG_DIR` exists: `fs.mkdirSync(LOG_DIR, { recursive: true })`
    - Check port 8765 conflict (task 3.4) before spawning
    - Spawn:
      ```javascript
      // Architecture note: Redmon invokes capture.exe directly per print job via stdin.
      // service/index.js is the upload worker + HTTP server only.
      // TABEZA_WATCH_FOLDER is NOT consumed by service/index.js — omitted intentionally.
      const child = spawn(
        process.execPath,
        [path.join(__dirname, 'src/service/index.js')],
        {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            TABEZA_BAR_ID: config.barId,
            TABEZA_API_URL: config.apiUrl || 'https://tabeza.co.ke',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      ```
    - Pipe child output to log rotator:
      ```javascript
      child.stdout.on('data', (data) => {
        writeLog(SERVICE_LOG_PATH, data.toString().trim(), LOG_OPTS);
      });
      child.stderr.on('data', (data) => {
        writeLog(SERVICE_LOG_PATH, '[STDERR] ' + data.toString().trim(), LOG_OPTS);
      });
      ```
    - Set `supervisor.child = child`, `supervisor.lastStartTime = Date.now()`,
      `supervisor.state = 'running'`
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_

- [x] 3.4 Implement port 8765 conflict check
  - Call this inside `spawnChild()` before the spawn call
  - Steps:
    1. `exec('netstat -ano | findstr :8765')` — extract PID from output
    2. If PID found: `exec('wmic process where processid={pid} get name,commandline')`
    3. If `name === 'node.exe'` AND `commandline` contains `'tabeza'` (case-insensitive):
       kill by PID via `taskkill /F /PID {pid}`, wait 1000ms, proceed with spawn
    4. If process is unrelated: log the conflict, set tray to ERROR state with message
       "Port 8765 is in use by another application. Receipt capture cannot start.", return
       without spawning
    5. If no PID found: proceed normally
  - _Requirements: 8.3, 8.4_

- [x] 3.5 Implement restart supervisor state machine
  - Wire `child.on('exit', (code) => { ... })` inside `spawnChild()`:
    ```
    if supervisor.isQuitting → return (expected, do not restart)
    if code === 0 → log "Child exited cleanly", set state = 'stopped', return
    if code !== 0:
      if Date.now() - supervisor.lastStartTime > 60000:
        supervisor.restartAttempts = 0  // stable run threshold reset
      if supervisor.restartAttempts < 3:
        supervisor.restartAttempts++
        supervisor.state = 'restarting'
        delay = Math.pow(2, supervisor.restartAttempts) * 1000  // 2s, 4s, 8s
        setTimeout(() => spawnChild(), delay)
      else:
        supervisor.state = 'error'
        trayApp.onServiceError(new Error('Service failed after 3 restart attempts'))
        show tray notification: "TabezaConnect service failed to start. Click to view logs."
    ```
  - Remove any unconditional auto-restart loop previously in the file
  - _Requirements: 3.4, 3.5, 3.6_

- [x] 3.6 Implement graceful shutdown
  - Implement `killChildProcess()`:
    ```javascript
    async function killChildProcess() {
      if (!supervisor.child || supervisor.isQuitting) return;
      supervisor.isQuitting = true;
      supervisor.child.kill('SIGTERM');
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (supervisor.child.exitCode !== null) return;
        await new Promise(r => setTimeout(r, 100));
      }
      supervisor.child.kill('SIGKILL');
    }
    ```
  - Wire tray exit callback:
    ```javascript
    trayApp.onExitRequested = async () => {
      await killChildProcess();
      app.quit();
    };
    ```
  - Wire `before-quit` with `isQuitting` guard to prevent double-kill:
    ```javascript
    app.on('before-quit', async (e) => {
      if (!supervisor.isQuitting) {
        e.preventDefault();
        await killChildProcess();
        app.quit();
      }
    });
    ```
  - _Requirements: 3.4, 9.1, 9.2, 9.3, 9.4_

- [x] 3.7 Route Electron main process logs through log rotator
  - Import `writeLog` from `src/utils/log-rotator.js`
  - Replace all `console.log` / `console.error` calls in `electron-main.js` with:
    ```javascript
    writeLog(ELECTRON_LOG_PATH, `[${new Date().toISOString()}][INFO] ${message}`, LOG_OPTS);
    writeLog(ELECTRON_LOG_PATH, `[${new Date().toISOString()}][ERROR] ${message}`, LOG_OPTS);
    ```
  - Ensure `LOG_DIR` is created before the first write (already handled in task 3.3 — verify
    ordering)
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 3.8 Checkpoint — verify Electron refactor before touching installer
  - Run `pnpm test` — all existing tests must pass
  - Run `pnpm run build:win` — must complete without errors
  - Smoke checks:
    - `package.json` `"main"` === `"electron-main.js"`
    - `dist/win-unpacked/TabezaConnect.exe` exists
    - `electron-main.js` contains `app.setAppUserModelId('com.tabeza.tabezaconnect')` before
      `requestSingleInstanceLock()`
    - `electron-main.js` contains `ELECTRON_RUN_AS_NODE: '1'` in spawn env
    - `electron-main.js` contains `CONFIG_PATH` constant
    - `electron-main.js` does NOT contain `TABEZA_WATCH_FOLDER` in spawn env
  - Launch `dist/win-unpacked/TabezaConnect.exe` and run
    `tasklist | findstr /i "tabeza electron node"` — verify process count matches a single
    launch, not 3× previous count
  - **Do not proceed to Phase 4 until this checkpoint passes**

---

### Phase 4 — Installer Update

- [x] 4.1 Add WinSW service decommission to `InitializeSetup()`
  - The existing Windows Service was installed by Inno Setup using a WinSW wrapper binary
    (`src/service/daemon/tabezaconnect.exe`). Decommission using the WinSW binary first, with
    `sc.exe` as fallback.
  - Add this block at the start of `InitializeSetup()`, before any existing process-kill logic:
    ```pascal
    // Step 1: Write pre-upgrade backup before touching anything
    SaveStringToFile(
      'C:\TabezaPrints\logs\pre-upgrade-service-backup.txt',
      'Service: TabezaConnect' + #13#10 +
      'Wrapper: src\service\daemon\tabezaconnect.exe' + #13#10 +
      'Date: ' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':'),
      False
    );

    // Step 2: Stop via WinSW binary (primary path)
    // WinSW stop is cleaner than sc stop — it waits for the process to exit
    Exec(ExpandConstant('{app}\daemon\tabezaconnect.exe'),
      'stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Step 3: If WinSW binary not present or stop failed, fall back to sc.exe
    if ResultCode <> 0 then begin
      Exec(ExpandConstant('{sys}\sc.exe'),
        'stop TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(3000);

      // Step 3a: If sc stop also failed, kill by PID
      if ResultCode <> 0 then begin
        // sc queryex TabezaConnect → extract PID → taskkill /F /PID {pid}
        // If PID extraction fails:
        Exec('wmic.exe',
          'process where "name=''node.exe'' and commandline like ''%tabeza%''" call terminate',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
    end;

    // Step 4: Unregister via WinSW (primary path)
    Exec(ExpandConstant('{app}\daemon\tabezaconnect.exe'),
      'uninstall', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Step 5: If WinSW uninstall failed, fall back to sc delete
    if ResultCode <> 0 then begin
      Exec(ExpandConstant('{sys}\sc.exe'),
        'delete TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      // If sc delete also fails: log and continue — service is stopped but not deleted.
      // It will not auto-start without the wrapper, so installation can safely proceed.
    end;

    // Step 6: Kill any remaining TabezaConnect.exe tray instances
    // Safe — installer process is ISCC.exe or the setup .exe, not TabezaConnect.exe
    Exec('taskkill.exe', '/F /IM TabezaConnect.exe',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(2000);
    ```
  - Verify no duplicate `sc stop TabezaConnect` block exists elsewhere in `InitializeSetup()`
    — merge into this unified sequence
  - _Requirements: 5.1, 5.2, 5.5, 5.7, 11.1, 11.2, 11.3, 11.5, 11.7_

- [x] 4.2 Remove service registration from `[Run]` section
  - Remove the step calling `register-service-pkg.ps1`
  - Remove the step calling `sc.exe start TabezaConnect`
  - Keep all remaining `[Run]` steps: folder creation, Bar ID write, Redmon install,
    Redmon printer config, verify, launch tray, show docs
  - Confirm Redmon port registration step is still present and untouched — Redmon config is
    NOT part of this refactor
  - _Requirements: 5.3, 7.2, 7.3_

- [x] 4.3 Update `[UninstallRun]` section
  - Replace any `sc stop` / `sc delete` only approach with WinSW-first uninstall:
    1. `{app}\daemon\tabezaconnect.exe stop`
    2. `{app}\daemon\tabezaconnect.exe uninstall`
    3. `sc stop TabezaConnect` (fallback if WinSW binary gone)
    4. `sc delete TabezaConnect` (fallback)
  - Verify HKCU Run key entry in `[Registry]` has `Flags: uninsdeletevalue`
  - _Requirements: 5.6, 7.4_

- [x] 4.4 Verify config preservation on upgrade
  - Confirm the `[Files]` entry for `config.template.json` → `C:\TabezaPrints\config.json`
    uses `Flags: onlyifdoesntexist`
  - Confirm `InitializeSetup()` does NOT overwrite `C:\TabezaPrints\config.json` if it already
    exists
  - Confirm `barId`, `apiUrl` are preserved across upgrade
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 4.5 Verify log directory creation
  - Confirm `[Dirs]` section includes `C:\TabezaPrints\logs\` — add if missing
  - Confirm `[UninstallDelete]` does NOT delete `C:\TabezaPrints\logs\` or its contents
  - _Requirements: 12.6, 12.7_

- [x] 4.6 Checkpoint — verify installer changes
  - Smoke checks:
    - `[Run]` section contains no `register-service-pkg.ps1` and no `sc.exe start TabezaConnect`
    - `[Run]` section still contains Redmon install and Redmon printer config steps (untouched)
    - `[Registry]` HKCU Run key is present with `Flags: uninsdeletevalue`
    - `[Files]` config template entry uses `onlyifdoesntexist`
    - `[Dirs]` includes `C:\TabezaPrints\logs\`
  - Build installer with ISCC and install on a test machine
  - Run `sc query TabezaConnect` — must return "service does not exist"
  - Run `tasklist | findstr /i "tabeza node"` — must show only the Electron tray processes

---

### Phase 5 — Tests

- [x] 5.1 Set up property test file
  - Create `src/__tests__/clean-architecture.property.test.js`
  - Run `pnpm add -D fast-check` if not already in `devDependencies`
  - Verify Jest config picks up `**/__tests__/**/*.test.js`
  - _Requirements: test infrastructure_

- [x]* 5.2 Unit test: single instance lock (Property 1)
  - Mock `app.requestSingleInstanceLock` to return `false`
  - Assert `app.quit` is called exactly once
  - Assert `process.exit` is called with `0`
  - Add integration test note in comments: "Verify on real Windows machine: launch
    `TabezaConnect.exe` twice in quick succession, confirm tasklist process count does not double"
  - _Requirements: 4.3, 4.5_

- [x]* 5.3 Property test: config round-trip (Property 2)
  - Generate `{ barId, apiUrl, watchFolder }` via `fc.record`
  - Write via atomic rename to a temp `CONFIG_PATH`
  - Read back via `RegistryReader.loadConfig()` pointed at temp path
  - Assert all three fields round-trip exactly
  - `barId` generator: `fc.string({ minLength: 6 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s))`
  - 100 runs minimum
  - _Requirements: 10.6_

- [x]* 5.4 Property test: log rotation correctness (Property 3)
  - Skip if already implemented in task 2.2
  - Generate arrays of 1–200 strings (100–1000 chars each)
  - Write each via `writeLog` with `maxBytes: 5MB, maxFiles: 3` to temp directory
  - Assert rotated file count `<= 3` after all writes
  - 100 runs minimum
  - _Requirements: 12.3, 12.4_

---

### Phase 6 — Final Verification

- [x] 6.1 Full test run
  - `pnpm test` — all tests pass including property tests
  - `pnpm run build:win` — completes without errors

- [ ] 6.2 Process count verification
  - Kill all existing TabezaConnect processes
  - Launch `dist/win-unpacked/TabezaConnect.exe` once
  - Wait 15 seconds
  - Run `tasklist | findstr /i "tabeza electron node"` — record process count as N
  - Launch `dist/win-unpacked/TabezaConnect.exe` a second time
  - Wait 5 seconds
  - Run `tasklist | findstr /i "tabeza electron node"` again
  - Assert process count is still N (not 2×N)
  - _Requirements: 4.5_

- [ ] 6.3 HTTP server availability
  - After launching, wait 10 seconds
  - Run `curl http://127.0.0.1:8765` — assert HTTP 200 response
  - _Requirements: 8.1, 8.2_

- [x] 6.4 Full smoke checklist
  - `package.json` `"main"` === `"electron-main.js"`
  - `package.json` build `files` excludes `src/service/daemon/**` and `src/service/dist/**`
  - `"npmRebuild": false` and `"asar": true` in build section
  - `asarUnpack` covers `**/*.node`
  - `src/utils/log-rotator.js` exists and exports `{ writeLog, rotate }`
  - `electron-main.js` contains `app.setAppUserModelId('com.tabeza.tabezaconnect')` before lock
  - `electron-main.js` contains `ELECTRON_RUN_AS_NODE: '1'` in spawn env
  - `electron-main.js` does NOT contain `TABEZA_WATCH_FOLDER` in spawn env
  - `electron-main.js` contains `CONFIG_PATH = 'C:\\TabezaPrints\\config.json'`
  - `installer-pkg-v1.7.15.iss` `[Run]` has no `register-service-pkg.ps1`, no
    `sc.exe start TabezaConnect`
  - `installer-pkg-v1.7.15.iss` `[Run]` still has Redmon install and printer config (untouched)
  - `sc query TabezaConnect` returns "service does not exist" on test machine
  - `C:\TabezaPrints\logs\` exists after install
  - HKCU Run key points to `{app}\TabezaConnect.exe`

---

## Notes

- Tasks marked `*` are optional — skip for faster MVP
- **WinSW, not NSSM**: all service decommission commands use the WinSW wrapper binary as
  primary path, with `sc.exe` as fallback only
- **Redmon config is untouched**: the Redmon install and printer port registration steps stay
  in `[Run]` — this refactor only removes the Windows Service registration steps
- **`TABEZA_WATCH_FOLDER` is omitted** from the spawn env — confirmed not consumed by
  `service/index.js`. Redmon delivers print data directly to `capture.exe` via stdin.
- `src/main.js` and `src/tray/main.js` are NOT deleted — they remain in the repo but are not
  entry points (per non-destructive code rule)
- All config writes must use the atomic rename pattern — no direct `writeFileSync` to
  `config.json`
- The Child_Process (`src/service/index.js`) requires no structural changes — parent pipes its
  stdio to the log rotator
