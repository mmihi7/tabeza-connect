# Bugfix Requirements Document

## Introduction

Tabeza Connect v1.7.10 has multiple critical issues affecting the post-installation experience and core functionality. These issues prevent proper configuration persistence, printer setup, and cause user experience degradation through focus stealing and cascading error logs. The bugs impact the installer-to-runtime handoff, printer configuration workflow, window management, and error handling for missing dependencies.

## Bug Analysis

### Current Behavior (Defect)

#### 1. Bar ID Persistence Failure

1.1 WHEN user enters Bar ID correctly in the installer wizard and completes installation THEN the system fails to persist the Bar ID to config.json and the tray app config settings show "✗ Bar ID not configured"

1.2 WHEN the tray app loads after installation THEN the system does not read the Bar ID from the installer's environment variables or registry settings

#### 2. POS Printer Setup Failure

2.1 WHEN user attempts to configure the POS printer through the tray app THEN the system fails with exit code -196608 and displays "[Error] Setup failed (exit code -196608). Check C:\TabezaPrints\logs\electron.log for details."

2.2 WHEN printer setup fails THEN the system does not provide actionable error information or recovery steps to the user

#### 3. Window Focus Stealing

3.1 WHEN the Tabeza Connect tray app is open THEN the system repeatedly brings the window to the front and steals focus from other applications

3.2 WHEN focus is stolen THEN the system overrides user's active application context continuously during normal operation

#### 4. EPIPE Broken Pipe Errors

4.1 WHEN the RedMon registry check fails THEN the system generates cascading "EPIPE: broken pipe, write" errors originating from verifyRedMonRegistry function at electron-main.js:168:21

4.2 WHEN EPIPE errors occur THEN the system continues running but with degraded functionality and polluted error logs

#### 5. RedMon Registry Check Failure

5.1 WHEN the app performs RedMon registry check THEN the system shows "RedMon registry check failed: Command failed: reg query..." warnings

5.2 WHEN RedMon is not installed (a mandatory requirement for printer pooling capture) THEN the system continues in a broken state instead of blocking startup or guiding user to install RedMon

#### 6. Incomplete Uninstallation

6.1 WHEN user uninstalls Tabeza Connect via Windows Programs & Features THEN the system removes application files but leaves registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect

6.2 WHEN registry entries remain after uninstall THEN the system leaves configuration artifacts that may interfere with clean reinstallation

### Expected Behavior (Correct)

#### 1. Bar ID Persistence

2.1 WHEN user enters Bar ID correctly in the installer wizard and completes installation THEN the system SHALL persist the Bar ID to C:\ProgramData\Tabeza\config.json and the tray app config settings SHALL display the configured Bar ID with "✓ Bar ID configured"

2.2 WHEN the installer sets Bar ID via environment variable TABEZA_BAR_ID or registry key HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID THEN the system SHALL read and apply this value to config.json on first service startup

#### 2. POS Printer Setup

2.3 WHEN user attempts to configure the POS printer through the tray app THEN the system SHALL complete setup successfully and return exit code 0

2.4 WHEN printer setup encounters an error THEN the system SHALL provide specific error messages with actionable recovery steps (e.g., "Printer driver not found. Please install the printer driver and try again.")

#### 3. Window Focus Management

2.5 WHEN the Tabeza Connect tray app is open THEN the system SHALL NOT steal focus from other applications unless explicitly invoked by user action (clicking tray icon, opening dashboard)

2.6 WHEN the management UI is opened via tray icon THEN the system SHALL bring the window to front once and then respect user's focus management

#### 4. EPIPE Error Prevention

2.7 WHEN the RedMon registry check fails THEN the system SHALL handle the error gracefully without generating EPIPE broken pipe errors

2.8 WHEN console.log or child process operations fail THEN the system SHALL catch and suppress cascading pipe errors to prevent log pollution

#### 5. RedMon Registry Check Handling

2.9 WHEN the app performs RedMon registry check and RedMon is not installed THEN the system SHALL display a clear user-facing message: "RedMon port monitor is required but not installed. Please run the installer to configure RedMon."

2.10 WHEN RedMon is not installed THEN the system SHALL either block service startup with clear guidance OR enter a safe degraded mode that prevents receipt capture attempts until RedMon is configured

#### 6. Complete Uninstallation

2.11 WHEN user uninstalls Tabeza Connect via Windows Programs & Features THEN the system SHALL remove all registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect including BarID, APIUrl, and WatchFolder keys

2.12 WHEN uninstaller runs THEN the system SHALL clean up all configuration artifacts to ensure a clean slate for potential reinstallation

### Unchanged Behavior (Regression Prevention)

#### Receipt Capture & Processing

3.1 WHEN RedMon is properly installed and configured THEN the system SHALL CONTINUE TO capture print jobs from order.prn via the TabezaCapturePort Local Port

3.2 WHEN a receipt is captured THEN the system SHALL CONTINUE TO strip ESC/POS control bytes, parse with template.json, and write to queue\pending\ as before

#### Queue & Upload System

3.3 WHEN receipts are in queue\pending\ THEN the system SHALL CONTINUE TO upload them to the cloud with exponential backoff retry logic

3.4 WHEN internet connectivity is lost THEN the system SHALL CONTINUE TO queue receipts locally and resume upload when connectivity returns

#### Management UI & Template Generator

3.5 WHEN user accesses localhost:8765 THEN the system SHALL CONTINUE TO serve the management UI dashboard with service status, job count, and configuration options

3.6 WHEN user completes the 3-step template generator workflow THEN the system SHALL CONTINUE TO capture test receipts, send to cloud AI, and save template.json locally

#### System Tray Icon

3.7 WHEN Windows user logs in THEN the system SHALL CONTINUE TO launch the tray icon via registry Run key and display green (online) or grey (offline/unconfigured) status

3.8 WHEN user right-clicks the tray icon THEN the system SHALL CONTINUE TO show menu options: open dashboard, send test print, view logs, quit

#### Windows Service Operation

3.9 WHEN Windows boots THEN the TabezaConnect Windows Service SHALL CONTINUE TO auto-start under LocalService account

3.10 WHEN the service is running THEN the system SHALL CONTINUE TO send heartbeat to /api/printer/heartbeat every 30 seconds

#### Configuration Loading Priority

3.11 WHEN the service starts THEN the system SHALL CONTINUE TO load configuration in priority order: environment variables → Windows Registry → config.json

3.12 WHEN Bar ID is set via any configuration source THEN the system SHALL CONTINUE TO use it for all API requests to the cloud
