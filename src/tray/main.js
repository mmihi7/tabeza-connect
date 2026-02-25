#!/usr/bin/env node
/**
 * TabezaConnect Tray Application Entry Point
 *
 * CORE TRUTH: Manual service always exists.
 * Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 *
 * This is the Electron main-process entry point.
 * It boots the tray icon first (so the app is immediately visible),
 * then starts the existing service logic (src/service/index.js) in-process.
 *
 * Command-line arguments:
 *   --minimized   Start directly in system tray without showing the status window.
 */

const { app } = require('electron');
const path = require('path');

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Parse command-line arguments (Electron passes its own flags before user flags)
const userArgs = process.argv.slice(2).filter(a => !a.startsWith('--inspect') && !a.startsWith('--remote-debugging'));
const isMinimized = userArgs.includes('--minimized');

console.log('TabezaConnect Tray Application starting...');
console.log(`Startup mode: ${isMinimized ? 'minimized (auto-start)' : 'normal'}`);

// Prevent Electron from quitting when all windows are closed — we live in the tray
app.on('window-all-closed', (e) => {
  // Do nothing — tray keeps the app alive
});

// Handle second-instance launch (bring existing window to front)
app.on('second-instance', () => {
  if (global.trayApp) {
    global.trayApp.showWindow();
  }
});

async function main() {
  try {
    // Wait for Electron to be ready before touching any GUI APIs
    await app.whenReady();

    // Boot the tray wrapper first — icon shows up immediately
    const TrayApp = require('./tray-app.js');
    const trayApp = new TrayApp({ minimized: isMinimized });
    global.trayApp = trayApp;
    await trayApp.start();

    // Now start the service (Express + monitors).
    // The service's process.exit() calls on fatal config errors are intercepted
    // by our uncaughtException handler so the tray can show an error icon.
    console.log('Loading service core...');
    try {
      // Monkey-patch process.exit so a service-level fatal doesn't kill Electron
      const _origExit = process.exit.bind(process);
      process.exit = (code) => {
        if (code !== 0) {
          console.error(`Service called process.exit(${code}) — showing error in tray`);
          trayApp.onServiceError(new Error(`Service exited with code ${code}`));
          // Restore and don't actually exit — tray stays alive
          process.exit = _origExit;
          return;
        }
        _origExit(code);
      };

      require('../service/index.js');

      // Restore normal exit after service bootstrapped
      process.exit = _origExit;
      console.log('Service core loaded successfully');
    } catch (serviceErr) {
      console.error('Service failed to start:', serviceErr);
      trayApp.onServiceError(serviceErr);
    }

  } catch (error) {
    console.error('Fatal error starting TabezaConnect:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions — show in tray rather than crashing silently
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  if (global.trayApp) {
    global.trayApp.onServiceError(error);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  if (global.trayApp) {
    global.trayApp.onServiceError(reason instanceof Error ? reason : new Error(String(reason)));
  }
});

// Graceful shutdown on signals
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  if (global.trayApp) {
    await global.trayApp.handleExit();
  } else {
    app.quit();
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  if (global.trayApp) {
    await global.trayApp.handleExit();
  } else {
    app.quit();
  }
});

main();
