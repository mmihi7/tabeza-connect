/**
 * Tabeza POS Connect Tray Application Wrapper
 *
 * CORE TRUTH: Manual service always exists.
 * Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 *
 * Manages:
 *  - System tray icon (green / grey states - 2-state system)
 *  - Status window (BrowserWindow, show on double-click, hide on close)
 *  - IPC between renderer (status-window.html) and main process
 *  - Context menu
 *  - Service health monitoring via /api/status polling
 *  - Graceful shutdown
 *
 * Requirements covered: 2.1 – 2.8, 3.x (--minimized), 6.x (state machine), 9.x (shutdown)
 */

'use strict';

const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain, shell, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const { exec } = require('child_process');
const { forPrefix } = require('../utils/logger');

const trayLog = forPrefix('[TRAY]');

// ── Application state enum ───────────────────────────────────────────────────
const ApplicationState = {
  STARTING:     'starting',
  CONNECTED:    'connected',
  UNCONFIGURED: 'unconfigured',
  DISCONNECTED: 'disconnected',
  ERROR:        'error',
  SHUTTING_DOWN:'shutting_down',
};

// ── Valid state transitions ───────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  [ApplicationState.STARTING]:     ['connected','unconfigured','error','shutting_down'],
  [ApplicationState.CONNECTED]:    ['disconnected','error','shutting_down'],
  [ApplicationState.UNCONFIGURED]: ['connected','error','shutting_down'],
  [ApplicationState.DISCONNECTED]: ['connected','error','shutting_down'],
  [ApplicationState.ERROR]:        ['connected','unconfigured','starting','shutting_down'],
  [ApplicationState.SHUTTING_DOWN]: [],
};

// ── Icon paths (using full-size icons; Windows will downscale for tray) ─────
const ICON_PATHS = {
  green: path.join(__dirname, '../../../assets/icon-green.ico'),
  grey:  path.join(__dirname, '../../../assets/icon-grey.ico'),
};

// ── State → icon / tooltip mapping ───────────────────────────────────────────
const STATE_CONFIG = {
  [ApplicationState.STARTING]:     { icon: 'grey', tooltip: 'Tabeza POS Connect - Starting...' },
  [ApplicationState.CONNECTED]:    { icon: 'green', tooltip: 'Tabeza POS Connect - Connected' },
  [ApplicationState.UNCONFIGURED]: { icon: 'grey', tooltip: 'Tabeza POS Connect - Configuration required' },
  [ApplicationState.DISCONNECTED]: { icon: 'grey', tooltip: 'Tabeza POS Connect - Cloud disconnected' },
  [ApplicationState.ERROR]:        { icon: 'grey', tooltip: 'Tabeza POS Connect - Error' },
  [ApplicationState.SHUTTING_DOWN]:{ icon: 'grey', tooltip: 'Tabeza POS Connect - Shutting down...' },
};

// ── Status polling interval (ms) ──────────────────────────────────────────────
const MONITOR_INTERVAL_MS  = 10_000;
const MONITOR_INITIAL_MS   =  3_000;

class TrayApp {
  constructor(options = {}) {
    this.minimized = options.minimized || false;

    this.tray   = null;
    this.window = null;           // BrowserWindow for status popup
    this.wizardWindow = null;     // BrowserWindow for template wizard

    this.state        = ApplicationState.STARTING;
    this.barId        = null;
    this.errorMessage = null;

    this.monitorTimer = null;

    // Cached status for IPC replies
    this._lastStatus = null;

    trayLog.info(`Initialized — minimized=${this.minimized}`);
  }

  // ── Public entry point ────────────────────────────────────────────────────
  async start() {
    await app.whenReady();

    this._registerIPC();
    this._createTrayIcon();
    this._createStatusWindow();

    if (!this.minimized) {
      this._showWindow();
    }

    setTimeout(() => this._pollStatus(), MONITOR_INITIAL_MS);
    this.monitorTimer = setInterval(() => this._pollStatus(), MONITOR_INTERVAL_MS);

    trayLog.ok(`Started — minimized=${this.minimized}`);
  }

  // ── Tray icon ─────────────────────────────────────────────────────────────
  _createTrayIcon() {
    this._verifyIcons();

    const icon = nativeImage.createFromPath(ICON_PATHS.grey);
    if (icon.isEmpty()) throw new Error(`Cannot load icon: ${ICON_PATHS.grey}`);

    this.tray = new Tray(icon);
    this.tray.setToolTip('Tabeza POS Connect - Starting...');

    this.tray.on('double-click', () => this._showWindow());

    this._rebuildContextMenu();
    trayLog.ok('Tray icon created');
  }

  _updateTrayIcon(state) {
    if (!this.tray) return;

    const cfg = STATE_CONFIG[state] || STATE_CONFIG[ApplicationState.STARTING];
    const iconPath = ICON_PATHS[cfg.icon];
    const icon = nativeImage.createFromPath(iconPath);

    if (!icon.isEmpty()) {
      this.tray.setImage(icon);
    } else {
      trayLog.warn(`Icon empty: ${iconPath}`);
    }

    let tooltip = cfg.tooltip;
    if (state === ApplicationState.CONNECTED && this.barId) {
      tooltip = `Tabeza POS Connect - Connected (Bar: ${this.barId})`;
    }
    if (state === ApplicationState.ERROR && this.errorMessage) {
      tooltip = `Tabeza POS Connect - Error: ${this.errorMessage}`;
    }
    this.tray.setToolTip(tooltip);
  }

  // ── Status window (BrowserWindow) ─────────────────────────────────────────
  _createStatusWindow() {
    this.window = new BrowserWindow({
      width:           900,
      height:          680,
      resizable:       true,
      maximizable:     true,
      fullscreenable:  false,
      show:            false,           // start hidden
      skipTaskbar:     true,            // don't appear in taskbar
      title:           'Tabeza POS Connect',
      icon:            path.join(__dirname, '../../assets/icon-green.ico'),
      backgroundColor: '#020617',       // dark background matches UI
      webPreferences: {
        nodeIntegration:  false,
        contextIsolation: true,
        preload:          path.join(__dirname, '../preload.js'),
      },
    });

    this.window.loadFile(path.join(__dirname, 'status-window.html'));

    // Minimise-to-tray instead of closing (Req 2.4)
    this.window.on('close', (e) => {
      if (this.state !== ApplicationState.SHUTTING_DOWN) {
        e.preventDefault();
        this.window.hide();
        trayLog.info('Status window hidden (minimised to tray)');
      }
    });

    // When the renderer finishes loading, push the current status
    this.window.webContents.on('did-finish-load', () => {
      if (this._lastStatus) {
        this.window.webContents.send('status-update', this._lastStatus);
      }
    });

    // Remove the default menu bar
    this.window.setMenuBarVisibility(false);

    trayLog.info('Status window created (hidden)');
  }

  _showWindow() {
    if (!this.window) return;
    if (!this.window.isVisible()) {
      this.window.show();
    }
    this.window.focus();
  }

  _hideWindow() {
    if (this.window && this.window.isVisible()) {
      this.window.hide();
    }
  }

  // ── Template wizard window ──────────────────────────────────────────────
  _createWizardWindow() {
    this.wizardWindow = new BrowserWindow({
      width:           850,
      height:          700,
      resizable:       true,
      maximizable:     true,
      fullscreenable:  false,
      show:            false,           // start hidden
      skipTaskbar:     false,           // appear in taskbar
      title:           'Tabeza Template Generator',
      icon:            path.join(__dirname, '../../assets/icon-green.ico'),
      webPreferences: {
        nodeIntegration:   true,        // needed for fetch API in renderer
        contextIsolation:  false,
      },
    });

    this.wizardWindow.loadFile(path.join(__dirname, 'template-wizard.html'));

    // Close wizard when window is closed
    this.wizardWindow.on('close', () => {
      this.wizardWindow = null;
    });

    // Remove the default menu bar
    this.wizardWindow.setMenuBarVisibility(false);

    trayLog.info('Template wizard window created (hidden)');
  }

  _showWizardWindow() {
    if (!this.wizardWindow) {
      this._createWizardWindow();
    }
    
    if (!this.wizardWindow.isVisible()) {
      this.wizardWindow.show();
    }
    this.wizardWindow.focus();
  }

  _hideWizardWindow() {
    if (this.wizardWindow && this.wizardWindow.isVisible()) {
      this.wizardWindow.hide();
    }
  }

  // Public alias used by main.js second-instance handler
  showWindow() { this._showWindow(); }

  // ── IPC handlers ─────────────────────────────────────────────────────────
  _registerIPC() {
    const SVC = 'http://localhost:8765';

    // Helper: proxy a fetch to the service
    const proxy = async (method, path, body) => {
      try {
        const opts = {
          method,
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${SVC}${path}`, opts);
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    };

    // ── Legacy on() handlers ──────────────────────────────────────────────
    ipcMain.on('get-status', async (event) => {
      event.reply('status-reply', await this._buildStatusPayload());
    });
    ipcMain.on('open-config',          () => this._openConfiguration());
    ipcMain.on('test-print',           () => this._testPrint());
    ipcMain.on('open-template-wizard', () => this._showWizardWindow());
    ipcMain.on('open-printer-setup',   () => this._openPrinterSetup());
    ipcMain.on('hide-window',          () => this._hideWindow());

    // ── invoke() handlers (used by status-window.html) ───────────────────

    // Status / pipeline
    ipcMain.handle('get-pipeline-status', () => proxy('GET', '/api/status'));
    ipcMain.handle('get-bar-id', async () => {
      const r = await proxy('GET', '/api/config');
      return r?.barId || r?.config?.barId || null;
    });
    ipcMain.handle('get-config', () => proxy('GET', '/api/config'));

    // Template
    ipcMain.handle('get-samples-status', async () => {
      try {
        const statusRes = await fetch(`${SVC}/api/template/status`, {
          signal: AbortSignal.timeout(5000),
        });
        const status = await statusRes.json();

        // Also fetch the actual sample texts so the UI can deduplicate
        let samples = [];
        try {
          const samplesRes = await fetch(`${SVC}/api/template/samples`, {
            signal: AbortSignal.timeout(5000),
          });
          if (samplesRes.ok) {
            const data = await samplesRes.json();
            samples = data.samples || [];
          }
        } catch { /* samples endpoint may not exist yet */ }

        return {
          success: true,
          samples,
          hasTemplate:       status.templateGenerated || false,
          capturedReceipts:  status.capturedReceipts  || 0,
          receiptsNeeded:    Math.max(0, 3 - (status.capturedReceipts || 0)),
        };
      } catch (err) {
        return { success: false, error: err.message, samples: [], hasTemplate: false };
      }
    });
    ipcMain.handle('generate-template',  (_, args) => proxy('POST', '/api/template/generate', args || {}));
    ipcMain.handle('test-template',      () => proxy('GET', '/api/template/status'));

    // Bar ID save
    ipcMain.handle('save-bar-id', (_, barId) =>
      proxy('POST', '/api/configure', { barId })
    );

    // API settings save
    ipcMain.handle('save-api-settings', (_, { endpoint }) =>
      proxy('POST', '/api/configure', { apiUrl: endpoint })
    );

    // Printer
    ipcMain.handle('setup-printer', () => proxy('GET', '/api/printer/status'));
    ipcMain.handle('get-windows-printers', () => proxy('GET', '/api/printers/windows'));
    ipcMain.handle('select-printer', (_, name) =>
      proxy('POST', '/api/printers/select', { printerName: name })
    );

    // Test print (invoke version)
    ipcMain.handle('test-print-invoke', () =>
      proxy('POST', '/api/test-print', {})
    );

    // Logs
    ipcMain.handle('get-logs', () => proxy('GET', '/api/logs/recent'));

    // Action channels (used by triggerAction in status-window.html)
    ipcMain.handle('action-restart-service',   () => proxy('POST', '/api/restart', {}));
    ipcMain.handle('action-test-print',        () => proxy('POST', '/api/test-print', {}));
    ipcMain.handle('action-test-cloud',        () => proxy('GET',  '/api/status'));
    ipcMain.handle('action-verify-redmon',     () => proxy('GET',  '/api/printer/status'));
    ipcMain.handle('action-kill-processes',    () => proxy('POST', '/api/restart', {}));
    ipcMain.handle('action-export-diagnostics',() => proxy('GET',  '/api/status'));
  }

  // ── Context menu ─────────────────────────────────────────────────────────
  _rebuildContextMenu() {
    const shutting  = this.state === ApplicationState.SHUTTING_DOWN;
    const configured= !!(this.barId && this.barId !== 'NOT_CONFIGURED');

    // Get queue stats for display
    const queueStats = this._lastStatus?.queueStats;
    const queueSize = queueStats?.queueSize || 0;
    const pending = queueStats?.pending || 0;
    const uploaded = queueStats?.uploaded || 0;
    const printerName = this._lastStatus?.printerName || null;

    let statusLabel;
    switch (this.state) {
      case ApplicationState.CONNECTED:    statusLabel = '● Connected';           break;
      case ApplicationState.DISCONNECTED: statusLabel = '○ Disconnected';        break;
      case ApplicationState.ERROR:        statusLabel = '✕ Error';               break;
      case ApplicationState.UNCONFIGURED: statusLabel = '⚠ Not configured';      break;
      case ApplicationState.STARTING:     statusLabel = '⟳ Starting...';         break;
      case ApplicationState.SHUTTING_DOWN:statusLabel = '⟳ Shutting down...';    break;
      default:                            statusLabel = 'Unknown';
    }

    const menu = Menu.buildFromTemplate([
      { label: 'Tabeza POS Connect',                 enabled: false },
      { label: configured ? `Bar: ${this.barId}` : 'Bar: Not configured', enabled: false },
      { label: `${statusLabel}`, enabled: false },
      { label: `Queue: ${pending} pending, ${uploaded} uploaded`, enabled: false },
      { label: printerName ? `Printer: ${printerName}` : 'Printer: Not configured', enabled: false },
      { type: 'separator' },
      {
        label:   'Show Status Window',
        enabled: !shutting,
        click:   () => this._showWindow(),
      },
      { type: 'separator' },
      {
        label:   'Open Configuration',
        enabled: !shutting,
        click:   () => this._openConfiguration(),
      },
      {
        label:   'Open Staff Dashboard',
        enabled: !shutting && configured,
        click:   () => this._openStaffDashboard(),
      },
      { type: 'separator' },
      {
        label:   'Test Print',
        enabled: !shutting && configured,
        click:   () => this._testPrint(),
      },
      {
        label:   'Template Generator',
        enabled: !shutting && configured,
        click:   () => this._showWizardWindow(),
      },
      {
        label:   'Printer Setup Guide',
        enabled: !shutting,
        click:   () => this._openPrinterSetup(),
      },
      {
        label:   'View Logs',
        enabled: !shutting,
        click:   () => this._viewLogs(),
      },
      { type: 'separator' },
      {
        label:   'Restart Service',
        enabled: !shutting,
        click:   () => this._restartService(),
      },
      {
        label:   'About',
        enabled: !shutting,
        click:   () => this._showAbout(),
      },
      { type: 'separator' },
      {
        label:   'Exit',
        enabled: !shutting,
        click:   () => this.handleExit(),
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  // ── State machine ─────────────────────────────────────────────────────────
  async setState(newState, reason = '', errorMsg = null) {
    const valid = Object.values(ApplicationState);
    if (!valid.includes(newState)) {
      console.warn(`[TrayApp] Unknown state: ${newState}`);
      return false;
    }

    const allowed = VALID_TRANSITIONS[this.state] || [];
    if (!allowed.includes(newState)) {
      trayLog.warn(`Invalid transition ${this.state} → ${newState}`);
      return false;
    }

    trayLog.step(`State: ${this.state} → ${newState}${reason ? ' (' + reason + ')' : ''}`);

    this.state = newState;
    if (errorMsg) this.errorMessage = errorMsg;

    this._updateTrayIcon(newState);
    this._rebuildContextMenu();

    // Push update to open window
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('status-update', await this._buildStatusPayload());
    }

    return true;
  }

  // ── Status polling ────────────────────────────────────────────────────────
  async _pollStatus() {
    if (this.state === ApplicationState.SHUTTING_DOWN) return;

    try {
      const res = await fetch('http://localhost:8765/api/status', {
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Merge into cached status
      this._lastStatus = await this._buildStatusPayload(data);

      // Update barId from live data
      if (data.barId && data.barId !== this.barId) {
        this.barId = data.barId;
        trayLog.info(`Bar ID updated: ${this.barId}`);
      }

      // Determine desired app state
      if (!data.barId || data.barId === 'NOT_CONFIGURED') {
        if (this.state !== ApplicationState.UNCONFIGURED) {
          await this.setState(ApplicationState.UNCONFIGURED, 'Bar ID not configured');
        }
      } else if (this.state !== ApplicationState.CONNECTED) {
        await this.setState(ApplicationState.CONNECTED, 'Service healthy');
      } else {
        // Already connected — just refresh the menu/icon in case barId changed
        this._rebuildContextMenu();
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('status-update', this._lastStatus);
        }
      }

    } catch {
      if (
        this.state !== ApplicationState.ERROR &&
        this.state !== ApplicationState.SHUTTING_DOWN
      ) {
        trayLog.warn('Service unreachable — transitioning to ERROR');
        await this.setState(ApplicationState.ERROR, 'Service unreachable', 'Cannot connect to service');
      }
    }
  }

  // ── Build status payload for the renderer ────────────────────────────────
  async _buildStatusPayload(liveData = null) {
    let version = '1.1.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
      version = pkg.version || version;
    } catch { /* ignore */ }

    // Determine which mode is active and extract appropriate stats
    const captureMode = liveData?.captureMode || null;
    let lastActivity = null;
    let receiptsProcessed = 0;
    let queueStats = null;

    if (captureMode === 'pooling' && liveData?.pooling) {
      // Pooling (pause‑copy) mode uses pooling stats
      lastActivity = liveData.pooling.lastCapture || null;
      receiptsProcessed = liveData.pooling.jobsCaptured || 0;
    } else if (captureMode === 'spooler' && liveData?.spoolMonitor) {
      // Legacy passive spooler monitor
      lastActivity = liveData.spoolMonitor.lastDetection || null;
      receiptsProcessed = liveData.spoolMonitor.filesProcessed || 0;
    }

    // Try to get queue statistics from local queue
    const getQueueStats = async () => {
      try {
        const queueResponse = await fetch('http://localhost:8765/api/queue-stats', {
          signal: AbortSignal.timeout(2000)
        });
        
        if (queueResponse.ok) {
          return await queueResponse.json();
        }
      } catch (error) {
        console.warn('Failed to get queue stats:', error.message);
        return {
          pending: 0,
          uploaded: 0,
          failed: 0
        };
      }
    };

    const base = {
      appState:           this.state,
      barId:              this.barId || (liveData?.barId) || null,
      apiUrl:             liveData?.apiUrl                || null,
      driverId:           liveData?.driverId              || null,
      lastActivity:       lastActivity,
      receiptsProcessed:  receiptsProcessed,
      queueStats:          await getQueueStats(),
      port:               8765,
      captureMode:        captureMode,
      watchFolder:        liveData?.watchFolder           || null,
      printerName:        liveData?.printerName || null,
      version,
    };

    if (liveData) Object.assign(base, { barId: liveData.barId || base.barId });
    return base;
  }

  // ── Menu actions ─────────────────────────────────────────────────────────
  _openConfiguration() {
    shell.openExternal('http://localhost:8765/configure.html').catch(err => {
      dialog.showErrorBox('Cannot Open Configuration',
        `Failed to open configuration page.\nNavigate manually to: http://localhost:8765/configure.html\n\n${err.message}`);
    });
  }

  async _openStaffDashboard() {
    try {
      const res = await fetch('http://localhost:8765/api/status', {
        signal: AbortSignal.timeout(5000),
      });
      const data = res.ok ? await res.json() : null;
      const url  = data?.apiUrl || 'https://tabeza.co.ke';
      shell.openExternal(url).catch(() => {});
    } catch {
      dialog.showErrorBox('Cannot Open Dashboard',
        'Could not retrieve API URL from service.\nPlease ensure the service is running.');
    }
  }

  _openPrinterSetup() {
    const setupPath = path.join(__dirname, '../../docs/PRINTER_POOLING_SETUP.md');
    shell.openPath(setupPath).catch(err => {
      dialog.showErrorBox('Cannot Open Printer Setup Guide',
        `Failed to open setup guide.\nPlease open manually: docs/PRINTER_POOLING_SETUP.md\n\n${err.message}`);
    });
  }

  async _testPrint() {
    try {
      const res = await fetch('http://localhost:8765/api/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      dialog.showMessageBox({
        type:    'info',
        title:   'Test Print',
        message: 'Test print sent successfully',
        detail:  'Check your printer and cloud dashboard for the test receipt.',
        buttons: ['OK'],
      });
    } catch (err) {
      dialog.showErrorBox('Test Print Failed',
        `Failed to send test print.\n\nError: ${err.message}`);
    }
  }

  _viewLogs() {
    const logPath = 'C:\\ProgramData\\Tabeza\\logs\\tabezaconnect.log';
    if (!fs.existsSync(logPath)) {
      dialog.showMessageBox({
        type:    'warning',
        title:   'Log File Not Found',
        message: 'Log file does not exist yet.',
        detail:  `Expected location:\n${logPath}`,
        buttons: ['OK'],
      });
      return;
    }
    exec(`start "" "${logPath}"`, (err) => {
      if (err) dialog.showErrorBox('Cannot Open Log File', err.message);
    });
  }

  async _restartService() {
    await this.setState(ApplicationState.STARTING, 'User requested restart');

    try {
      const res = await fetch('http://localhost:8765/api/restart', {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      if (res && res.ok) {
        dialog.showMessageBox({
          type:    'info',
          title:   'Service Restart',
          message: 'Service is restarting...',
          buttons: ['OK'],
        });
      } else {
        const choice = dialog.showMessageBoxSync({
          type:      'question',
          title:     'Restart Service',
          message:   'Restart requires a full application restart.',
          detail:    'Exit and restart Tabeza POS Connect now?',
          buttons:   ['Restart Now', 'Cancel'],
          defaultId: 0,
          cancelId:  1,
        });
        if (choice === 0) await this.handleExit();
      }
    } catch (err) {
      dialog.showErrorBox('Restart Failed', err.message);
    }
  }

  _showAbout() {
    let version = '1.1.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
      version = pkg.version || version;
    } catch { /* ignore */ }

    dialog.showMessageBox({
      type:    'info',
      title:   'About Tabeza POS Connect',
      message: `Tabeza POS Connect v${version}`,
      detail:
        'POS Printer Capture Service\n\n' +
        'Copyright © 2024 Tabeza\nAll rights reserved.\n\n' +
        'Website: https://tabeza.co.ke\n' +
        'Support: support@tabeza.co.ke',
      buttons: ['OK'],
    });
  }

  // ── Graceful shutdown ────────────────────────────────────────────────────
  async handleExit() {
    trayLog.step('Graceful exit requested...');

    await this.setState(ApplicationState.SHUTTING_DOWN, 'User requested exit');

    // Stop polling
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    // 5-second hard-exit safety net
    const timer = setTimeout(() => {
      console.warn('[TrayApp] Shutdown timeout, forcing exit');
      app.exit(0);
    }, 5000);

    try {
      const serviceModule = require.cache[require.resolve('../service/index.js')];
      if (serviceModule?.exports?.shutdown) {
        await serviceModule.exports.shutdown();
        trayLog.ok('Service shutdown OK');
      }
    } catch (err) {
      trayLog.warn(`Service shutdown error: ${err.message}`);
    }

    clearTimeout(timer);

    // Destroy window without triggering close-to-tray handler
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }

    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    app.quit();
  }

  // ── External event hooks (called by main.js) ──────────────────────────────
  async onServiceReady(config) {
    if (config?.barId && config.barId !== 'NOT_CONFIGURED') {
      this.barId = config.barId;
      await this.setState(ApplicationState.CONNECTED, 'Service started');
    } else {
      await this.setState(ApplicationState.UNCONFIGURED, 'Service started but not configured');
    }
  }

  async onServiceError(error) {
    let msg = 'Service error';
    if (error?.code === 'EADDRINUSE')     msg = 'Port 8765 already in use';
    else if (error?.message)              msg = error.message.substring(0, 60);
    await this.setState(ApplicationState.ERROR, 'Service error', msg);
  }

  async onConfigurationChanged(config) {
    if (config?.barId && config.barId !== 'NOT_CONFIGURED') {
      this.barId = config.barId;
      if (this.state === ApplicationState.UNCONFIGURED)
        await this.setState(ApplicationState.CONNECTED, 'Configuration completed');
    } else {
      if (this.state === ApplicationState.CONNECTED)
        await this.setState(ApplicationState.UNCONFIGURED, 'Configuration cleared');
    }
  }

  async onHeartbeatFailure() {
    if (this.state === ApplicationState.CONNECTED)
      await this.setState(ApplicationState.DISCONNECTED, 'Cloud connection lost');
  }

  async onHeartbeatSuccess() {
    if (this.state === ApplicationState.DISCONNECTED)
      await this.setState(ApplicationState.CONNECTED, 'Cloud connection restored');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _verifyIcons() {
    for (const [color, p] of Object.entries(ICON_PATHS)) {
      if (!fs.existsSync(p)) {
        trayLog.warn(`Missing icon (${color}): ${p}`);
      }
    }
  }

  // ── Legacy public API aliases ─────────────────────────────────────────────
  setBarId(barId) {
    this.barId = barId;
    if (this.state === ApplicationState.CONNECTED) this._updateTrayIcon(ApplicationState.CONNECTED);
    this._rebuildContextMenu();
  }
}

module.exports = TrayApp;
module.exports.ApplicationState  = ApplicationState;
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;