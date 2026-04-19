# Requirements Document

## Introduction

TabezaConnect currently suffers from three competing service systems running simultaneously: an NSSM Windows Service (`tabezaconnect.exe`), the Electron tray app (which also tries to start the service), and an older standalone compiled service (`src/service/dist/`). This causes 4+ Electron instances and 9+ Node processes on every launch, leading to duplicate uploads, resource waste, and instability.

This spec defines the requirements for a clean-architecture refactor that consolidates everything into a single Electron-only architecture. The Electron tray app becomes the sole owner of the service lifecycle. The NSSM Windows Service is decommissioned. Competing entry points are eliminated. The installer is updated to register only the Electron tray app via a registry Run key.

## Glossary

- **Electron_App**: The `TabezaConnect.exe` Electron desktop application, built from `electron-main.js`
- **Service**: The background Node.js worker (`src/service/index.js`) that watches for POS receipts and uploads them to the cloud
- **NSSM_Service**: The Windows Service Control Manager entry named `TabezaConnect`, managed by NSSM, running `src/service/index.js` via Node — to be decommissioned
- **Child_Process**: The Service process spawned by the Electron_App using `ELECTRON_RUN_AS_NODE=1` so the Electron binary runs as plain Node
- **Single_Instance_Lock**: Electron's `app.requestSingleInstanceLock()` mechanism that prevents duplicate Electron_App instances
- **Run_Key**: The Windows registry entry at `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` that launches the Electron_App at user login
- **Installer**: The Inno Setup script (`installer-pkg-v1.7.15.iss`) that installs TabezaConnect on a venue Windows PC
- **Daemon_Files**: The NSSM daemon directory at `src/service/daemon/` containing `tabezaconnect.exe`, config XML, and log files
- **Old_Service_Dist**: The compiled standalone service at `src/service/dist/` built in March, superseded by the Electron-managed service
- **Management_UI**: The Express HTTP server on `localhost:8765` serving the web dashboard, started by the Service
- **App_User_Model_ID**: The string `com.tabeza.tabezaconnect` set via `app.setAppUserModelId()` to ensure the Single_Instance_Lock works correctly across builds and paths
- **Config_Path**: The canonical runtime configuration file path: `C:\TabezaPrints\config.json`. This is the single source of truth for `barId`, `apiUrl`, and `watchFolder`. Both the Electron_App and the Child_Process SHALL read from and write to this path exclusively. Note: `C:\TabezaPrints` is the default data directory set at install time; if the operator chose a different drive during installation, this path reflects that choice. All requirements referencing config use Config_Path, not a hardcoded string.
- **Log_Dir**: The log directory at `C:\TabezaPrints\logs\`. All application and service logs are written here. The base path follows the same install-time data directory as Config_Path.

## Requirements

### Requirement 1: Single Entry Point

**User Story:** As a developer, I want a single authoritative entry point for the Electron application, so that there is no ambiguity about which file starts the app and no competing startup paths.

#### Acceptance Criteria

1. THE Electron_App SHALL use `electron-main.js` as the sole entry point, as declared in `package.json` `"main"` field
2. WHEN the Electron_App starts, THE Electron_App SHALL NOT execute any code from `src/main.js` or `src/tray/main.js` as independent entry points
3. THE `package.json` `"main"` field SHALL point to `electron-main.js` and no other file
4. WHEN `pnpm run build:win` is executed, THE build system SHALL produce a single `TabezaConnect.exe` whose entry point is `electron-main.js`

---

### Requirement 2: Single Build Configuration

**User Story:** As a developer, I want a single build configuration, so that `pnpm run build:win` always produces a deterministic, correct output without conflicting settings.

#### Acceptance Criteria

1. THE build system SHALL use only the `build` section in `package.json` as the source of truth for electron-builder configuration
2. THE `package.json` build section SHALL include `"npmRebuild": false` to prevent native module rebuild failures during CI
3. WHEN `pnpm run build:win` is executed, THE build system SHALL complete without errors and produce `dist/win-unpacked/TabezaConnect.exe`
4. THE build output SHALL include `electron-main.js`, `src/**/*`, and all `extraResources` as defined in the `package.json` build section

---

### Requirement 3: Electron-Owned Service Lifecycle

**User Story:** As a system operator, I want the Electron app to be the sole owner of the service process lifecycle, so that the service starts and stops exactly once with the Electron app and never accumulates background processes.

#### Acceptance Criteria

1. WHEN the Electron_App starts, THE Electron_App SHALL spawn exactly one Child_Process running `src/service/index.js`
2. THE Electron_App SHALL spawn the Child_Process using `ELECTRON_RUN_AS_NODE=1` as an environment variable so the Electron binary executes the service as plain Node without triggering Electron's GUI subsystem
3. THE Child_Process SHALL be spawned using `process.execPath` (the currently running Electron binary) as the executable, not a hardcoded path
4. WHEN the Electron_App quits, THE Electron_App SHALL terminate the Child_Process before the main process exits
5. IF the Child_Process exits unexpectedly, THEN THE Electron_App SHALL log the exit code and attempt to restart the Child_Process up to 3 times before showing an error in the system tray
6. WHILE the Electron_App is running, THE Electron_App SHALL maintain exactly one Child_Process at all times
7. THE Electron_App SHALL pass `TABEZA_BAR_ID`, `TABEZA_API_URL`, and `TABEZA_WATCH_FOLDER` environment variables to the Child_Process on spawn

---

### Requirement 4: Single Instance Guarantee

**User Story:** As a venue operator, I want TabezaConnect to run as exactly one instance regardless of how many times it is launched, so that receipts are never duplicated and system resources are not wasted.

#### Acceptance Criteria

1. THE Electron_App SHALL call `app.setAppUserModelId('com.tabeza.tabezaconnect')` before calling `app.requestSingleInstanceLock()`
2. THE Electron_App SHALL call `app.requestSingleInstanceLock()` before `app.whenReady()`
3. WHEN a second instance of the Electron_App is launched, THE Electron_App SHALL exit the second instance immediately via `app.quit()` and `process.exit(0)`
4. WHEN a second instance is launched, THE Electron_App SHALL focus the existing instance's window if one is open
5. WHEN `TabezaConnect.exe` is launched N times, THE operating system SHALL show the same number of TabezaConnect-related processes as when launched once — process count SHALL NOT scale with N

---

### Requirement 5: NSSM Service Decommissioned

**User Story:** As a system operator, I want the NSSM Windows Service completely removed, so that it can no longer start the service independently and compete with the Electron-managed Child_Process.

#### Acceptance Criteria

1. THE Installer SHALL stop the NSSM_Service if it is running before installing new files
2. THE Installer SHALL delete the NSSM_Service registration from Windows Service Control Manager during installation
3. THE Installer SHALL NOT register any new Windows Service during installation
4. THE Installer SHALL NOT include any NSSM binaries or configuration files in the installed output
5. IF the NSSM_Service is found running on an existing installation, THEN THE Installer SHALL stop and delete it before proceeding
6. THE Installer uninstall section SHALL stop and delete the NSSM_Service if it still exists
7. IF stopping the NSSM_Service fails (hung or access denied), THEN THE Installer SHALL forcefully terminate any node.exe processes associated with the service before proceeding

---

### Requirement 6: Daemon and Old Service Files Removed

**User Story:** As a developer, I want the NSSM daemon files and old compiled service removed from the repository and build output, so that the codebase is clean and the installer does not bundle obsolete files.

#### Acceptance Criteria

1. THE build output SHALL NOT include any files from `src/service/daemon/`
2. THE build output SHALL NOT include any files from `src/service/dist/`
3. THE `package.json` build `files` array SHALL explicitly exclude `src/service/daemon/**` and `src/service/dist/**`

---

### Requirement 7: Installer Registers Only the Electron Tray App

**User Story:** As a venue operator, I want TabezaConnect to start automatically when I log in to Windows, so that receipt capture begins without manual intervention after every reboot.

#### Acceptance Criteria

1. THE Installer SHALL write a Run_Key entry at `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` with value `"TabezaConnect"` pointing to `{app}\TabezaConnect.exe`
2. THE Installer SHALL NOT register any Windows Service during the `[Run]` section
3. THE Installer SHALL NOT call `sc.exe create`, `sc.exe start`, or any NSSM registration command during installation
4. THE Installer uninstall section SHALL remove the Run_Key entry
5. WHEN the Installer completes, THE Electron_App SHALL launch automatically via the Run_Key on the next Windows login
6. THE Installer documentation SHALL note that the Run_Key is written to HKCU (per-user) and assumes a single operator account per venue PC

---

### Requirement 8: HTTP Server Availability After Launch

**User Story:** As a venue operator, I want the management dashboard to be accessible within 10 seconds of launching TabezaConnect, so that I can check status and configure the app without waiting.

#### Acceptance Criteria

1. WHEN the Electron_App starts, THE Management_UI SHALL begin listening on `localhost:8765` within 10 seconds
2. WHEN a GET request is made to `http://localhost:8765`, THE Management_UI SHALL respond with HTTP 200
3. IF the port 8765 is already in use, THEN THE Electron_App SHALL log an error and display a notification in the system tray
4. THE Electron_App SHALL retry binding to port 8765 every 30 seconds, up to 5 attempts
5. IF all 5 binding attempts fail, THEN THE Electron_App SHALL display an error dialog and continue running without the Management_UI (receipt capture continues to operate normally)
6. THE Management_UI SHALL only bind to `127.0.0.1` and SHALL NOT be accessible from external network interfaces

---

### Requirement 9: Clean Shutdown

**User Story:** As a developer, I want the Electron app to shut down cleanly, so that no orphaned Node processes remain after the app exits.

#### Acceptance Criteria

1. WHEN the user selects "Exit" from the system tray menu, THE Electron_App SHALL terminate the Child_Process before calling `app.quit()`
2. WHEN `app.before-quit` fires, THE Electron_App SHALL send a termination signal to the Child_Process and wait up to 5 seconds for it to exit gracefully
3. IF the Child_Process does not exit within 5 seconds, THEN THE Electron_App SHALL forcefully kill the Child_Process
4. WHEN the Electron_App exits, THE operating system SHALL show zero remaining TabezaConnect-related Node processes

---

### Requirement 10: Configuration Migration on Upgrade

**User Story:** As a venue operator upgrading from a previous version, I want my existing Bar ID and configuration preserved after upgrade, so that receipt capture continues working without reconfiguration.

#### Acceptance Criteria

1. WHEN the Installer runs on a machine with an existing installation, THE Installer SHALL read the existing config from Config_Path before overwriting any files
2. THE Installer SHALL preserve the existing `barId`, `apiUrl`, and `watchFolder` values from the previous config
3. IF the previous config exists at Config_Path, THEN THE Installer SHALL NOT overwrite it with the default template config
4. IF the previous config does not exist, THEN THE Installer SHALL write the default config template to Config_Path
5. THE Electron_App SHALL read all runtime configuration exclusively from Config_Path — it SHALL NOT use `app.getPath('userData')` for any configuration that is also read by the Child_Process
6. THE Electron_App and the Child_Process SHALL both read from and write to Config_Path as the single canonical config location — there SHALL be no second config file at any other path

---

### Requirement 11: Upgrade from NSSM-based Installation

**User Story:** As a venue operator upgrading from v1.7.0 (which has the NSSM service), I want the upgrade to complete cleanly without manual intervention, so that the venue does not experience downtime.

#### Acceptance Criteria

1. WHEN the Installer detects an existing NSSM_Service registration, THE Installer SHALL stop the service using `sc stop TabezaConnect` before copying new files
2. WHEN the Installer detects an existing NSSM_Service registration, THE Installer SHALL delete the service using `sc delete TabezaConnect` after stopping it
3. IF `sc stop` fails, THEN THE Installer SHALL query the service PID via `sc queryex TabezaConnect`, extract the PID value, and kill it directly via `taskkill /F /PID {pid}`. If PID extraction fails, THE Installer SHALL kill all node.exe processes whose command line contains "tabeza" via `wmic process where "name='node.exe' and commandline like '%tabeza%'" call terminate`
4. IF `sc delete` fails after a successful stop, THEN THE Installer SHALL log the failure and continue installation (the service will be orphaned but not running)
5. THE Installer SHALL perform NSSM cleanup BEFORE copying new application files to avoid file-lock conflicts
6. WHEN the Installer completes on an upgrade, THE Windows Service Control Manager SHALL show no service named `TabezaConnect`
7. THE Installer SHALL handle the case where NSSM itself (`nssm.exe`) is not present — using only `sc.exe` commands which are always available on Windows

---

### Requirement 12: Log File Management

**User Story:** As a venue operator, I want log files to be automatically managed so that the venue PC disk does not silently fill up over months of operation.

#### Acceptance Criteria

1. THE Child_Process SHALL write all log output to `{Log_Dir}\service.log`
2. THE Electron_App SHALL write all main-process log output to `{Log_Dir}\electron.log`
3. WHEN a log file reaches 5MB, THE writing process SHALL rotate it by renaming it to `service.log.1` (or `electron.log.1`) and starting a new log file
4. THE log rotation SHALL keep a maximum of 3 rotated files per log (e.g. `service.log`, `service.log.1`, `service.log.2`, `service.log.3`) — older files SHALL be deleted
5. THE Electron_App system tray "View Logs" menu item SHALL open Log_Dir in Windows Explorer
6. THE Installer SHALL create Log_Dir during installation if it does not exist
7. THE Installer uninstall section SHALL NOT delete Log_Dir or its contents — logs SHALL be preserved for post-uninstall diagnostics
