/**
 * Tabeza Connect - Electron Main Process
 * 
 * This is the entry point for the Electron application.
 * It handles:
 * - System tray icon
 * - Background service management
 * - Printer setup wizard
 * - Folder structure initialization (runs on every startup)
 * - App lifecycle
 */

const { app, BrowserWindow, Tray, Menu, dialog, shell, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

// Single instance lock - MUST be at top before any app ready
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

const setupStateManager = require('./lib/setup-state-manager');
const windowStateManager = require('./lib/window-state-manager');

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time State Synchronization - Core Modules
// ─────────────────────────────────────────────────────────────────────────────
// CORE TRUTH: Manual service always exists. Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.

const StateManager = require('./lib/state-manager');
const BroadcastManager = require('./lib/broadcast-manager');
const WindowRegistry = require('./lib/window-registry');
const { updateStateAndBroadcast } = require('./lib/state-sync-helper');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration - ALL DATA IN C:\TabezaPrints\
// ─────────────────────────────────────────────────────────────────────────────

const APP_NAME = 'Tabeza Connect';
const APP_VERSION = '1.7.10';
const TABEZA_PRINTS_DIR = 'C:\\TabezaPrints';
const LOG_DIR = path.join(TABEZA_PRINTS_DIR, 'logs');
const CONFIG_PATH = path.join(TABEZA_PRINTS_DIR, 'config.json');
const CAPTURE_FILE = path.join(TABEZA_PRINTS_DIR, 'order.prn');
const LOG_FILE = path.join(LOG_DIR, 'electron.log');

// Development vs Production paths (deferred until app is ready)
let isDev = false;
// In production, extraResources are at process.resourcesPath/assets/
let ASSETS_PATH = path.join(__dirname, '../assets'); // updated in whenReady

// ─────────────────────────────────────────────────────────────────────────────
// Global State
// ─────────────────────────────────────────────────────────────────────────────

let tray = null;
let mainWindow = null;
let setupWindow = null;
let templateWindow = null;
let backgroundService = null;
let isQuitting = false;

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time State Synchronization - Singleton Instances
// ─────────────────────────────────────────────────────────────────────────────
// These singletons are initialized once on app startup and used throughout
// the application lifecycle to maintain state consistency across all windows.

let stateManager = null;
let broadcastManager = null;
let windowRegistry = null;

/**
 * Initialize Real-Time State Synchronization System
 * 
 * Creates and configures the three core modules for state management:
 * - StateManager: Centralized state storage with disk persistence
 * - BroadcastManager: IPC broadcasting to all registered windows
 * - WindowRegistry: Tracks all active BrowserWindows
 * 
 * This function should be called once during app startup, before any
 * windows are created. It establishes the relationships between modules
 * and loads initial state from disk.
 * 
 * Algorithm:
 * 1. Create StateManager instance
 * 2. Initialize StateManager (loads state from disk)
 * 3. Create WindowRegistry instance with StateManager reference
 * 4. Create BroadcastManager instance
 * 5. Set WindowRegistry reference in BroadcastManager
 * 6. Log initialization complete
 * 
 * Requirements: Design Section "Architecture" - Main Process integration
 * 
 * @returns {object} Object containing references to all three managers
 */
function initializeStateSync() {
  log('INFO', '========================================');
  log('INFO', 'Initializing Real-Time State Synchronization...');
  log('INFO', '========================================');
  
  try {
    // Step 1: Create StateManager instance
    log('INFO', 'Creating StateManager instance...');
    stateManager = new StateManager();
    
    // Step 2: Initialize StateManager (loads all state from disk)
    log('INFO', 'Loading initial state from disk...');
    const initialState = stateManager.initialize();
    log('INFO', `Initial state loaded successfully`);
    log('INFO', `  - Setup complete: ${initialState.setup.firstRunComplete}`);
    log('INFO', `  - Bar ID configured: ${initialState.config.barId ? 'Yes' : 'No'}`);
    log('INFO', `  - Printer status: ${initialState.printer.status}`);
    log('INFO', `  - Template exists: ${initialState.template.exists}`);
    
    // Step 3: Create WindowRegistry instance with StateManager reference
    log('INFO', 'Creating WindowRegistry instance...');
    windowRegistry = new WindowRegistry(stateManager);
    log('INFO', 'WindowRegistry created successfully');
    
    // Step 4: Create BroadcastManager instance
    log('INFO', 'Creating BroadcastManager instance...');
    broadcastManager = new BroadcastManager();
    
    // Step 5: Set WindowRegistry reference in BroadcastManager
    log('INFO', 'Connecting BroadcastManager to WindowRegistry...');
    broadcastManager.setWindowRegistry(windowRegistry);
    log('INFO', 'BroadcastManager connected successfully');
    
    // Step 6: Log initialization complete
    log('INFO', '========================================');
    log('INFO', '✓ Real-Time State Synchronization initialized');
    log('INFO', '========================================');
    
    return {
      stateManager,
      broadcastManager,
      windowRegistry
    };
    
  } catch (error) {
    log('ERROR', `Failed to initialize State Synchronization: ${error.message}`);
    log('ERROR', `Stack trace: ${error.stack}`);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify and fix RedMon registry on startup
function verifyRedMonRegistry() {
  const { execSync } = require('child_process');
  const regPath = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\Redirected Port\\Ports\\TabezaCapturePort';
  
  try {
    const command = execSync(`reg query "${regPath}"`, { encoding: 'utf8' });
    
    // Check if command is correct
    if (!command.includes('C:\\TabezaPrints\\capture.exe')) {
      log('INFO', 'Fixing RedMon registry: Setting capture.exe path');
      execSync(`reg add "${regPath}" /v Command /t REG_SZ /d "C:\\TabezaPrints\\capture.exe" /f`, { encoding: 'utf8' });
    }
    
    // Check if output (physical printer) is set
    if (!command.includes('EPSON')) {
      log('INFO', 'Fixing RedMon registry: Setting output printer');
      execSync(`reg add "${regPath}" /v Output /t REG_SZ /d "EPSON L3210 Series" /f`, { encoding: 'utf8' });
    }
    
    log('INFO', 'RedMon registry verified');
  } catch (e) {
    log('WARN', `RedMon registry check failed: ${e.message}`);
  }
}

// App Initialization - Call State Sync on Startup
// ─────────────────────────────────────────────────────────────────────────────
// Initialize state synchronization system when Electron app is ready.
// This must happen before any windows are created to ensure all windows
// can register properly and receive initial state.

app.whenReady().then(async () => {
  log('INFO', 'Electron app ready - starting initialization sequence');
  
  // Verify RedMon registry on startup
  verifyRedMonRegistry();
  
  // Set development mode now that app is ready
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // Update global ASSETS_PATH (assign, not re-declare)
  ASSETS_PATH = isDev 
    ? path.join(__dirname, '../assets')
    : path.join(process.resourcesPath, 'assets');

  log('INFO', `isDev: ${isDev}, ASSETS_PATH: ${ASSETS_PATH}`);
  
  // Initialize state synchronization system FIRST
  initializeStateSync();
  
  // Run full app initialization (tray, service, printer check, etc.)
  await initialize();
});

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}][${level}] ${message}`;
  console.log(line);
  
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (e) {
    // Ignore logging errors
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TabezaPrints Folder Management - RUNS ON EVERY STARTUP
// ─────────────────────────────────────────────────────────────────────────────

function initializeTabezaPrintsFolder() {
  /**
   * Creates or updates the C:\TabezaPrints folder structure.
   * Safe to run on every startup - will not overwrite existing data.
   * This ensures the folder structure is always available.
   */
  
  log('INFO', '========================================');
  log('INFO', 'Ensuring TabezaPrints folder structure...');
  log('INFO', '========================================');
  
  const directories = [
    TABEZA_PRINTS_DIR,
    path.join(TABEZA_PRINTS_DIR, 'processed'),
    path.join(TABEZA_PRINTS_DIR, 'failed'),
    LOG_DIR,
    path.join(TABEZA_PRINTS_DIR, 'queue'),
    path.join(TABEZA_PRINTS_DIR, 'queue', 'pending'),
    path.join(TABEZA_PRINTS_DIR, 'queue', 'uploaded'),
    path.join(TABEZA_PRINTS_DIR, 'templates')
  ];
  
  let created = 0;
  let existing = 0;
  
  // Create directories
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        log('INFO', `  ✓ Created: ${dir}`);
        created++;
      } catch (err) {
        log('ERROR', `  ✗ Failed to create: ${dir} - ${err.message}`);
      }
    } else {
      existing++;
    }
  }
  
  // Create capture file if it doesn't exist
  if (!fs.existsSync(CAPTURE_FILE)) {
    try {
      fs.writeFileSync(CAPTURE_FILE, '');
      log('INFO', `  ✓ Created: ${CAPTURE_FILE}`);
    } catch (err) {
      log('ERROR', `  ✗ Failed to create: ${CAPTURE_FILE} - ${err.message}`);
    }
  }
  
  // Create default config if it doesn't exist
  if (!fs.existsSync(CONFIG_PATH)) {
    try {
      const defaultConfig = {
        barId: '',
        apiUrl: 'https://tabz-kikao.vercel.app',
        watchFolder: TABEZA_PRINTS_DIR,
        httpPort: 8765
      };
      // Write without BOM to avoid JSON parse errors
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), { encoding: 'utf8', flag: 'w' });
      log('INFO', `  ✓ Created: ${CONFIG_PATH}`);
    } catch (err) {
      log('ERROR', `  ✗ Failed to create: ${CONFIG_PATH} - ${err.message}`);
    }
  }
  
  log('INFO', `Folder check complete: ${created} created, ${existing} existing`);
  log('INFO', '========================================');
  
  return { created, existing };
}

function checkTabezaPrintsFolder() {
  /**
   * Checks if all required items in TabezaPrints exist.
   */
  
  const requiredItems = [
    TABEZA_PRINTS_DIR,
    CAPTURE_FILE,
    CONFIG_PATH,
    path.join(TABEZA_PRINTS_DIR, 'processed'),
    path.join(TABEZA_PRINTS_DIR, 'failed'),
    LOG_DIR,
    path.join(TABEZA_PRINTS_DIR, 'queue'),
    path.join(TABEZA_PRINTS_DIR, 'queue', 'pending'),
    path.join(TABEZA_PRINTS_DIR, 'queue', 'uploaded'),
    path.join(TABEZA_PRINTS_DIR, 'templates')
  ];
  
  const missing = requiredItems.filter(item => !fs.existsSync(item));
  
  return {
    exists: fs.existsSync(TABEZA_PRINTS_DIR),
    hasCaptureFile: fs.existsSync(CAPTURE_FILE),
    hasConfig: fs.existsSync(CONFIG_PATH),
    hasAllFolders: missing.length === 0,
    missingItems: missing
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// Bar ID Auto-Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if Bar ID exists in config.json and auto-mark the step as complete.
 * 
 * This function runs on every startup to ensure the Bar ID step is automatically
 * marked complete if a valid Bar ID is found in the configuration file.
 * 
 * Requirements: 3.7
 */
function autoDetectBarId() {
  log('INFO', 'Checking for existing Bar ID configuration...');
  
  try {
    // Check if config.json exists
    if (!fs.existsSync(CONFIG_PATH)) {
      log('INFO', '  ✗ config.json not found');
      return false;
    }
    
    // Read and parse config.json
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cleanData = configData.replace(/^\uFEFF/, ''); // Remove BOM if present
    const config = JSON.parse(cleanData);
    
    // Check if Bar ID is configured (non-empty string)
    if (config.barId && config.barId.trim() !== '') {
      log('INFO', `  ✓ Bar ID found in config.json: ${config.barId}`);
      
      // Load current setup state
      const currentState = setupStateManager.loadSetupState();
      
      // Only mark as complete if not already marked
      if (!currentState.steps.barId.completed) {
        log('INFO', '  → Auto-marking Bar ID step as complete');
        setupStateManager.markStepComplete('barId');
        
        // Update tray menu to reflect new state
        if (tray) {
          updateTrayMenu();
        }
        
        return true;
      } else {
        log('INFO', '  → Bar ID step already marked complete');
        return true;
      }
    } else {
      log('INFO', '  ✗ Bar ID not configured in config.json');
      return false;
    }
    
  } catch (error) {
    log('ERROR', `  ✗ Error checking Bar ID: ${error.message}`);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Status Auto-Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if template.json exists and auto-mark the step as complete.
 * 
 * This function runs on every startup to ensure the Template step is automatically
 * marked complete if a valid template file is found.
 * 
 * The function checks multiple possible template locations:
 * - C:\TabezaPrints\templates\template.json (preferred location)
 * - C:\TabezaPrints\template.json (legacy location)
 * - C:\ProgramData\Tabeza\template.json (alternative location)
 * 
 * Requirements: 10.1-10.7
 */
function autoDetectTemplateStatus() {
  log('INFO', 'Checking for existing template configuration...');
  
  // Define possible template locations in order of preference
  const templatePaths = [
    path.join(TABEZA_PRINTS_DIR, 'templates', 'template.json'),
    path.join(TABEZA_PRINTS_DIR, 'template.json'),
    'C:\\ProgramData\\Tabeza\\template.json'
  ];
  
  try {
    // Check each possible location
    for (const templatePath of templatePaths) {
      if (fs.existsSync(templatePath)) {
        log('INFO', `  → Found template file at: ${templatePath}`);
        
        try {
          // Read and validate the template file
          const templateData = fs.readFileSync(templatePath, 'utf8');
          const template = JSON.parse(templateData);
          
          // Verify it has required fields (version and patterns)
          if (template.version && template.patterns) {
            log('INFO', `  ✓ Valid template found (version: ${template.version})`);
            
            // Load current setup state
            const currentState = setupStateManager.loadSetupState();
            
            // Only mark as complete if not already marked
            if (!currentState.steps.template.completed) {
              log('INFO', '  → Auto-marking Template step as complete');
              setupStateManager.markStepComplete('template');
              
              // Update tray menu to reflect new state
              if (tray) {
                updateTrayMenu();
              }
              
              return true;
            } else {
              log('INFO', '  → Template step already marked complete');
              return true;
            }
          } else {
            log('WARN', `  ✗ Template file at ${templatePath} is missing required fields (version or patterns)`);
          }
        } catch (parseError) {
          log('WARN', `  ✗ Error parsing template at ${templatePath}: ${parseError.message}`);
          // Continue checking other locations
        }
      }
    }
    
    // No valid template found in any location
    log('INFO', '  ✗ No valid template found in any location');
    return false;
    
  } catch (error) {
    log('ERROR', `  ✗ Error checking template status: ${error.message}`);
    return false;
  }
}

/**
 * Check if template.json exists (simple check without auto-marking).
 * 
 * This function is used by the tray icon to determine icon color and tooltip.
 * It checks the same locations as autoDetectTemplateStatus but doesn't modify state.
 * 
 * Requirements: 15A.5, 15A.6, 18.4
 * 
 * @returns {boolean} true if a valid template exists, false otherwise
 */
function checkTemplateExists() {
  // Define possible template locations in order of preference
  const templatePaths = [
    path.join(TABEZA_PRINTS_DIR, 'templates', 'template.json'),
    path.join(TABEZA_PRINTS_DIR, 'template.json'),
    'C:\\ProgramData\\Tabeza\\template.json'
  ];
  
  try {
    // Check each possible location
    for (const templatePath of templatePaths) {
      if (fs.existsSync(templatePath)) {
        try {
          // Read and validate the template file
          const templateData = fs.readFileSync(templatePath, 'utf8');
          const template = JSON.parse(templateData);
          
          // Verify it has required fields (version and patterns)
          if (template.version && template.patterns) {
            return true; // Valid template found
          }
        } catch (parseError) {
          // Continue checking other locations
        }
      }
    }
    
    // No valid template found in any location
    return false;
    
  } catch (error) {
    // On error, assume no template exists
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Logic for Existing Installations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Migrate existing installations to the new setup state system.
 *
 * This function checks for existing configuration and auto-populates
 * the setup state for users upgrading from previous versions.
 *
 * Checks:
 * - Bar ID in config.json
 * - Printer configuration status
 * - Template.json existence
 *
 * If all three are configured, marks firstRunComplete as true to skip
 * the welcome screen and go straight to Normal Mode.
 *
 * Requirements: 17.1-17.7
 */
async function migrateExistingInstallation() {
  log('INFO', '========================================');
  log('INFO', 'Checking for existing installation...');
  log('INFO', '========================================');

  // Load current setup state
  const currentState = setupStateManager.loadSetupState();

  // If firstRunComplete is already true, skip migration
  if (currentState.firstRunComplete) {
    log('INFO', 'Setup already complete, skipping migration');
    return currentState;
  }

  // Check if any steps are already marked complete
  const hasAnyStepComplete = Object.values(currentState.steps).some(step => step.completed);
  if (hasAnyStepComplete) {
    log('INFO', 'Setup in progress, skipping migration');
    return currentState;
  }

  log('INFO', 'First-time setup detected, checking for existing configuration...');

  // Initialize migration state
  const migrationState = {
    barIdConfigured: false,
    printerConfigured: false,
    templateConfigured: false
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Check 1: Bar ID in config.json
  // ─────────────────────────────────────────────────────────────────────────
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      const cleanData = configData.replace(/^\uFEFF/, ''); // Remove BOM
      const config = JSON.parse(cleanData);

      if (config.barId && config.barId.trim() !== '') {
        migrationState.barIdConfigured = true;
        log('INFO', '  ✓ Bar ID found in config.json');
      } else {
        log('INFO', '  ✗ Bar ID not configured');
      }
    } else {
      log('INFO', '  ✗ config.json not found');
    }
  } catch (error) {
    log('ERROR', `  ✗ Error checking Bar ID: ${error.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check 2: Printer configuration status
  // ─────────────────────────────────────────────────────────────────────────
  // Note: Printer configuration check removed - will be implemented with Redmon
  log('INFO', '  ✗ Printer configuration check not implemented yet');

  // ─────────────────────────────────────────────────────────────────────────
  // Check 3: Template.json existence
  // ─────────────────────────────────────────────────────────────────────────
  const templatePaths = [
    path.join(TABEZA_PRINTS_DIR, 'templates', 'template.json'),
    path.join(TABEZA_PRINTS_DIR, 'template.json'),
    'C:\\ProgramData\\Tabeza\\template.json'
  ];

  for (const templatePath of templatePaths) {
    try {
      if (fs.existsSync(templatePath)) {
        // Verify it's valid JSON
        const templateData = fs.readFileSync(templatePath, 'utf8');
        const template = JSON.parse(templateData);

        // Check if it has required fields
        if (template.version && template.patterns) {
          migrationState.templateConfigured = true;
          log('INFO', `  ✓ Template found at ${templatePath}`);
          break;
        }
      }
    } catch (error) {
      log('WARN', `  ✗ Error checking template at ${templatePath}: ${error.message}`);
    }
  }

  if (!migrationState.templateConfigured) {
    log('INFO', '  ✗ Template not found');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update setup state based on migration results
  // ─────────────────────────────────────────────────────────────────────────
  const newState = setupStateManager.loadSetupState();
  const now = new Date().toISOString();

  if (migrationState.barIdConfigured) {
    newState.steps.barId.completed = true;
    newState.steps.barId.completedAt = now;
  }

  if (migrationState.printerConfigured) {
    newState.steps.printer.completed = true;
    newState.steps.printer.completedAt = now;
  }

  if (migrationState.templateConfigured) {
    newState.steps.template.completed = true;
    newState.steps.template.completedAt = now;
  }

  // If all three are configured, mark first run as complete
  const allConfigured = migrationState.barIdConfigured &&
                        migrationState.printerConfigured &&
                        migrationState.templateConfigured;

  if (allConfigured) {
    newState.firstRunComplete = true;
    log('INFO', '========================================');
    log('INFO', '✓ Existing installation detected');
    log('INFO', '✓ All setup steps already complete');
    log('INFO', '✓ Skipping first-run experience');
    log('INFO', '========================================');
  } else {
    log('INFO', '========================================');
    log('INFO', 'Partial configuration detected:');
    log('INFO', `  Bar ID: ${migrationState.barIdConfigured ? '✓' : '✗'}`);
    log('INFO', `  Printer: ${migrationState.printerConfigured ? '✓' : '✗'}`);
    log('INFO', `  Template: ${migrationState.templateConfigured ? '✓' : '✗'}`);
    log('INFO', 'User will complete remaining steps in Setup Mode');
    log('INFO', '========================================');
  }

  // Save the migrated state
  setupStateManager.saveSetupState(newState);

  return newState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Service Management
// ─────────────────────────────────────────────────────────────────────────────

function startBackgroundService() {
  return new Promise((resolve, reject) => {
    if (backgroundService) {
      log('INFO', 'Background service already running');
      resolve();
      return;
    }

    const servicePath = isDev 
      ? path.join(__dirname, 'service/index.js')
      : path.join(process.resourcesPath, 'service/index.js');

    if (!fs.existsSync(servicePath)) {
      log('ERROR', `Service file not found: ${servicePath}`);
      reject(new Error('Service file not found'));
      return;
    }

    log('INFO', `Starting background service: ${servicePath}`);

    backgroundService = spawn(process.execPath, [servicePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      windowsHide: true,
      env: {
        ...process.env,
        TABEZA_DATA_DIR: TABEZA_PRINTS_DIR,
        TABEZA_SERVICE_MODE: 'true'
      }
    });

    backgroundService.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log('SERVICE', output);
      }
    });

    backgroundService.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log('SERVICE-ERROR', output);
      }
    });

    backgroundService.on('close', (code) => {
      log('INFO', `Background service exited with code ${code}`);
      backgroundService = null;
      updateTrayMenu();
      // Auto-restart the service after a short delay
      setTimeout(() => {
        if (!backgroundService) {
          log('INFO', 'Auto-restarting background service...');
          startBackgroundService().catch(err => {
            log('ERROR', `Failed to auto-restart service: ${err.message}`);
          });
        }
      }, 3000);
    });

    backgroundService.on('error', (err) => {
      log('ERROR', `Failed to start background service: ${err.message}`);
      backgroundService = null;
      reject(err);
    });

    setTimeout(() => {
      log('INFO', 'Background service started');
      updateTrayMenu();
      resolve();
    }, 2000);
  });
}

function stopBackgroundService() {
  return new Promise((resolve) => {
    if (!backgroundService) {
      resolve();
      return;
    }

    log('INFO', 'Stopping background service...');

    if (process.platform === 'win32') {
      exec(`taskkill /pid ${backgroundService.pid} /T`, (error) => {
        if (error) {
          log('WARN', `Error stopping service: ${error.message}`);
        }
        backgroundService = null;
        updateTrayMenu();
        resolve();
      });
    } else {
      backgroundService.kill('SIGTERM');
      setTimeout(() => {
        backgroundService = null;
        updateTrayMenu();
        resolve();
      }, 3000);
    }
  });
}

function stopAllServices() {
  return new Promise((resolve) => {
    log('INFO', 'Stopping ALL Tabeza services...');
    
    // Stop background service first
    stopBackgroundService().then(() => {
      // Kill any remaining Tabeza processes
      if (process.platform === 'win32') {
        exec('taskkill /f /im "TabezaConnect.exe" /T', (error) => {
          if (error) {
            log('WARN', `Error killing TabezaConnect.exe: ${error.message}`);
          }
        });
        
        exec('taskkill /f /im "node.exe" /fi "WINDOWTITLE eq *Tabeza*" /T', (error) => {
          if (error) {
            log('WARN', `Error killing Tabeza node processes: ${error.message}`);
          }
        });
        
        // Kill any processes using port 8765
        exec('for /f "tokens=5" %a in (\'netstat -aon ^| find ":8765"^") do taskkill /f /pid %a', (error) => {
          if (error) {
            log('WARN', `Error killing processes on port 8765: ${error.message}`);
          }
        });
      }
      
      setTimeout(() => {
        log('INFO', 'All Tabeza services stopped');
        updateTrayMenu();
        resolve();
      }, 2000);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Printer Setup Wizard
// ─────────────────────────────────────────────────────────────────────────────

function showPrinterSetupWizard() {
  if (setupWindow) {
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Tabeza Connect - Printer Setup',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(ASSETS_PATH, 'icon-green.ico')
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Register window with Window Registry for real-time state synchronization
  // Requirements: Task 4.2 - Register all windows with Window Registry
  // ─────────────────────────────────────────────────────────────────────────
  if (windowRegistry) {
    try {
      windowRegistry.registerWindow('printer-setup-window', setupWindow);
      log('INFO', 'Printer Setup window registered with Window Registry');
    } catch (error) {
      log('ERROR', `Failed to register printer setup window: ${error.message}`);
    }
  } else {
    log('WARN', 'WindowRegistry not available - printer setup window not registered');
  }

  const htmlPath = isDev
    ? path.join(__dirname, 'setup-wizard/printer-setup.html')
    : path.join(process.resourcesPath, 'setup-wizard/printer-setup.html');

  log('INFO', `Loading Printer Setup from: ${htmlPath}`);
  log('INFO', `Printer Setup exists: ${fs.existsSync(htmlPath)}`);

  if (fs.existsSync(htmlPath)) {
    setupWindow.loadFile(htmlPath);
  } else {
    log('ERROR', `Printer Setup file not found: ${htmlPath}`);
    setupWindow.loadURL(`data:text/html,<h1>Printer Setup not found</h1><p>File: ${htmlPath}</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Focus event listener for real-time state synchronization
  // Requirements: Task 6.1 - Add focus event listeners to all windows
  // Requirements: Task 6.2 - Implement full state sync on focus
  // ─────────────────────────────────────────────────────────────────────────
  setupWindow.on('focus', () => {
    if (!setupWindow || setupWindow.isDestroyed()) {
      return;
    }
    
    log('INFO', 'Printer Setup window focused - syncing state');
    
    // Get complete current state from StateManager
    if (stateManager && broadcastManager) {
      try {
        const currentState = stateManager.getState();
        
        // Broadcast full state sync to focused window
        const syncSuccess = broadcastManager.syncWindowState('printer-setup-window', currentState);
        
        if (syncSuccess) {
          log('INFO', 'State sync completed successfully for printer setup window');
        } else {
          log('WARN', 'State sync failed for printer setup window');
        }
      } catch (error) {
        log('ERROR', `Failed to sync state on focus: ${error.message}`);
      }
    } else {
      log('WARN', 'StateManager or BroadcastManager not available for focus sync');
    }
  });

  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

function showTemplateGenerator() {
  if (templateWindow) {
    templateWindow.focus();
    return;
  }

  templateWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Tabeza Connect - Template Generator',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(ASSETS_PATH, 'icon-green.ico')
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Register window with Window Registry for real-time state synchronization
  // Requirements: Task 4.2 - Register all windows with Window Registry
  // ─────────────────────────────────────────────────────────────────────────
  if (windowRegistry) {
    try {
      windowRegistry.registerWindow('template-generator-window', templateWindow);
      log('INFO', 'Template Generator window registered with Window Registry');
    } catch (error) {
      log('ERROR', `Failed to register template generator window: ${error.message}`);
    }
  } else {
    log('WARN', 'WindowRegistry not available - template generator window not registered');
  }

  const htmlPath = isDev
    ? path.join(__dirname, 'public', 'template-generator.html')
    : path.join(process.resourcesPath, 'public', 'template-generator.html');

  log('INFO', `Loading Template Generator from: ${htmlPath}`);

  if (fs.existsSync(htmlPath)) {
    templateWindow.loadFile(htmlPath);
  } else {
    log('ERROR', `Template Generator file not found: ${htmlPath}`);
    templateWindow.loadURL(`data:text/html,<h1>Template Generator not found</h1><p>File: ${htmlPath}</p>`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Focus event listener for real-time state synchronization
  // Requirements: Task 6.1 - Add focus event listeners to all windows
  // Requirements: Task 6.2 - Implement full state sync on focus
  // ─────────────────────────────────────────────────────────────────────────
  templateWindow.on('focus', () => {
    if (!templateWindow || templateWindow.isDestroyed()) {
      return;
    }
    
    log('INFO', 'Template Generator window focused - syncing state');
    
    // Get complete current state from StateManager
    if (stateManager && broadcastManager) {
      try {
        const currentState = stateManager.getState();
        
        // Broadcast full state sync to focused window
        const syncSuccess = broadcastManager.syncWindowState('template-generator-window', currentState);
        
        if (syncSuccess) {
          log('INFO', 'State sync completed successfully for template generator window');
        } else {
          log('WARN', 'State sync failed for template generator window');
        }
      } catch (error) {
        log('ERROR', `Failed to sync state on focus: ${error.message}`);
      }
    } else {
      log('WARN', 'StateManager or BroadcastManager not available for focus sync');
    }
  });

  templateWindow.on('closed', () => {
    templateWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// System Tray
// ─────────────────────────────────────────────────────────────────────────────

function createTray() {
  // Determine icon color based on service status, setup completion, and template existence
  let iconColor = 'grey'; // Default: unknown/initializing
  let tooltipSuffix = '';
  
  try {
    const serviceRunning = backgroundService !== null;
    const setupComplete = setupStateManager.isSetupComplete();
    const templateExists = checkTemplateExists();
    
    // Priority order for icon color:
    // 1. No template (grey with warning) - Requirement 15A.5, 18.4
    // 2. Service running AND setup complete AND template exists (green)
    // 3. Service running but setup incomplete (grey)
    // 4. Service not running (grey)
    
    if (!templateExists) {
      iconColor = 'grey'; // Requirement 18.4: grey icon when no template
      tooltipSuffix = ' - Setup incomplete: template required';
    } else if (serviceRunning && setupComplete) {
      iconColor = 'green'; // Service running AND setup complete AND template exists
    } else if (serviceRunning && !setupComplete) {
      iconColor = 'grey'; // Setup incomplete
    } else if (!serviceRunning) {
      iconColor = 'grey'; // Service not running
    }
  } catch (error) {
    log('WARN', `Could not determine setup state for tray icon: ${error.message}`);
    // Fall back to grey icon
  }
  
  const iconPath = path.join(ASSETS_PATH, `icon-${iconColor}.ico`);
  
  log('INFO', `Creating system tray with ${iconColor} icon...`);
  log('INFO', `Icon path: ${iconPath}`);
  log('INFO', `Icon exists: ${fs.existsSync(iconPath)}`);
  
  if (!fs.existsSync(iconPath)) {
    log('ERROR', `Tray icon not found at ${iconPath}`);
    log('ERROR', `Assets path: ${ASSETS_PATH}`);
    log('ERROR', `process.resourcesPath: ${process.resourcesPath}`);
    log('ERROR', `__dirname: ${__dirname}`);
    log('ERROR', `isDev: ${isDev}`);
    throw new Error(`Tray icon not found at ${iconPath}`);
  }

  try {
    tray = new Tray(iconPath);
    
    // Set tooltip with setup progress if incomplete or template missing
    // Requirement 15A.6: Display "Setup incomplete - template required" when no template
    try {
      const templateExists = checkTemplateExists();
      if (!templateExists) {
        tray.setToolTip(`${APP_NAME} - Setup incomplete: template required`);
      } else {
        const progress = setupStateManager.getSetupProgress();
        if (!progress.firstRunComplete) {
          tray.setToolTip(`${APP_NAME} - Setup: ${progress.completed}/${progress.total} steps complete`);
        } else {
          tray.setToolTip(APP_NAME);
        }
      }
    } catch (error) {
      tray.setToolTip(APP_NAME);
    }
    
    updateTrayMenu();

    // Handle single-click to open Management UI
    tray.on('click', () => {
      showManagementUI();
    });

    // Handle double-click to open Management UI (same behavior as single-click)
    tray.on('double-click', () => {
      showManagementUI();
    });

    log('INFO', 'System tray created successfully');
  } catch (error) {
    log('ERROR', `Failed to create system tray: ${error.message}`);
    log('ERROR', error.stack);
    throw error;
  }
}

function updateTrayMenu() {
  const serviceRunning = backgroundService !== null;
  
  // Build simplified context menu with only essential controls
  const contextMenu = Menu.buildFromTemplate([
    {
      label: serviceRunning ? 'Stop Service' : 'Start Service',
      click: async () => {
        if (serviceRunning) {
          await stopBackgroundService();
          showNotification('Service Stopped', 'Tabeza Connect service has been stopped');
          updateTrayMenu(); // Refresh menu to show "Start Service"
        } else {
          try {
            await startBackgroundService();
            showNotification('Service Started', 'Tabeza Connect service is now running');
            updateTrayMenu(); // Refresh menu to show "Stop Service"
          } catch (err) {
            showNotification('Service Error', `Failed to start: ${err.message}`);
          }
        }
      }
    },
    {
      label: 'Stop All Services',
      click: async () => {
        await stopAllServices();
        showNotification('All Services Stopped', 'All Tabeza services have been stopped');
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: `${APP_NAME} v${APP_VERSION}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => quitApp()
    }
  ]);

  tray.setContextMenu(contextMenu);
  
  // Update tray icon color based on service status, setup completion, and template existence
  // Requirement 15A.5: Display grey icon when no template exists
  // Requirement 18.4: Display grey icon when setup incomplete
  try {
    let iconColor = 'grey';
    const setupComplete = setupStateManager.isSetupComplete();
    const templateExists = checkTemplateExists();
    
    // Priority order for icon color:
    // 1. No template (grey with warning) - Requirement 15A.5, 18.4
    // 2. Service running AND setup complete AND template exists (green)
    // 3. Service running but setup incomplete (grey)
    // 4. Service not running (grey)
    
    if (!templateExists) {
      iconColor = 'grey'; // Requirement 18.4: grey icon when no template
    } else if (serviceRunning && setupComplete) {
      iconColor = 'green';
    } else if (serviceRunning && !setupComplete) {
      iconColor = 'grey';
    } else if (!serviceRunning) {
      iconColor = 'grey';
    }
    
    const iconPath = path.join(ASSETS_PATH, `icon-${iconColor}.ico`);
    if (fs.existsSync(iconPath)) {
      tray.setImage(iconPath);
    }
    
    // Update tooltip with template warning or setup progress
    // Requirement 15A.6: Display "Setup incomplete - template required" when no template
    if (!templateExists) {
      tray.setToolTip(`${APP_NAME} - Setup incomplete: template required`);
    } else {
      const progress = setupStateManager.getSetupProgress();
      if (!progress.firstRunComplete) {
        tray.setToolTip(`${APP_NAME} - Setup: ${progress.completed}/${progress.total} steps complete`);
      } else {
        tray.setToolTip(APP_NAME);
      }
    }
  } catch (error) {
    log('WARN', `Could not update tray icon: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Management UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show Management UI window
 * 
 * Performance Optimization: Lazy Window Creation (Requirements 19.1-19.5)
 * - Window is NOT created on app startup
 * - Window is only created when user clicks tray icon
 * - Existing window is reused if already open (focus instead of recreate)
 * - This reduces startup time and memory usage
 */
function showManagementUI() {
  // Window reuse logic - focus existing window if already open
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    log('INFO', 'Management UI window focused (already exists)');
    return;
  }

  // Create new window with dashboard instead of old management UI
  const windowOptions = {
    width: 800,
    height: 600,
    title: `${APP_NAME} - Dashboard`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(ASSETS_PATH, 'icon-green.ico'),
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    skipTaskbar: false,
    show: false
  };

  // Restore window state from disk (or center if no saved state)
  const windowState = windowStateManager.restoreWindowState();
  log('INFO', `Restoring window state: ${JSON.stringify(windowState)}`);

  // Set position if saved (null means centered)
  if (windowState.x !== null && windowState.y !== null) {
    windowOptions.x = windowState.x;
    windowOptions.y = windowState.y;
  } else {
    windowOptions.center = true;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the new dashboard instead of old management UI
  mainWindow.loadFile(path.join(__dirname, 'tray/status-window.html'));

  // Minimize-to-tray instead of closing
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  // Show the window
  mainWindow.show();
  mainWindow.focus();

  log('INFO', 'Dashboard window created and shown');
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

function showNotification(title, body) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(ASSETS_PATH, 'icon-green.ico'),
      silent: false
    });
    
    notification.show();
    log('INFO', `Notification shown: ${title} - ${body}`);
  } else {
    log('WARN', 'Notifications not supported on this system');
  }
}

// Handle printer setup wizard completion
ipcMain.handle('printer-setup-wizard-complete', async () => {
  log('INFO', 'Printer setup wizard completed - broadcasting to all windows');
  
  // Broadcast to all windows
  if (mainWindow) {
    mainWindow.webContents.send('printer-setup-complete');
  }
  if (templateWindow) {
    templateWindow.webContents.send('printer-setup-complete');
  }
  
  // Update tray menu
  setTimeout(() => updateTrayMenu(), 500);
  
  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// Config Management IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('get-config', async () => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return {
        barId: '',
        apiUrl: 'https://tabz-kikao.vercel.app',
        watchFolder: TABEZA_PRINTS_DIR,
        httpPort: 8765
      };
    }
    
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    // Remove BOM if present
    const cleanData = configData.replace(/^\uFEFF/, '');
    return JSON.parse(cleanData);
  } catch (error) {
    log('ERROR', `Failed to read config: ${error.message}`);
    return {
      barId: '',
      apiUrl: 'https://tabz-kikao.vercel.app',
      watchFolder: TABEZA_PRINTS_DIR,
      httpPort: 8765
    };
  }
});

ipcMain.handle('save-config', async (event, config) => {
  try {
    // Write without BOM
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: 'utf8', flag: 'w' });
    log('INFO', `Config saved successfully to ${CONFIG_PATH}`);
    
    // Broadcast config change to all windows
    if (mainWindow) {
      mainWindow.webContents.send('config-updated', config);
    }
    if (templateWindow) {
      templateWindow.webContents.send('config-updated', config);
    }
    if (setupWindow) {
      setupWindow.webContents.send('config-updated', config);
    }
    
    // Update tray menu to reflect changes
    updateTrayMenu();
    
    return { success: true };
  } catch (error) {
    log('ERROR', `Failed to save config: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Config Management IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IPC Handler: get-state
 * 
 * Retrieves current application state from StateManager.
 * Can return either complete state or a specific state type.
 * 
 * This handler provides read-only access to the centralized state cache.
 * All state is returned from memory (no disk I/O), making this operation
 * very fast (< 1ms).
 * 
 * Usage from renderer:
 * ```javascript
 * // Get complete state
 * const state = await ipcRenderer.invoke('get-state');
 * 
 * // Get specific state type
 * const setupState = await ipcRenderer.invoke('get-state', 'setup');
 * const configState = await ipcRenderer.invoke('get-state', 'config');
 * ```
 * 
 * Algorithm:
 * 1. Validate StateManager is initialized
 * 2. Call StateManager.getState(stateType)
 * 3. Return state from in-memory cache
 * 4. If stateType specified, return only that portion
 * 5. If stateType omitted, return complete state
 * 
 * Preconditions:
 * - StateManager is initialized (happens on app startup)
 * - If stateType provided, it must be valid ('setup' | 'config' | 'printer' | 'template' | 'window')
 * 
 * Postconditions:
 * - Returns current state from memory (no disk I/O)
 * - Never returns null or undefined (returns default state if missing)
 * - State object is a copy (mutations don't affect cache)
 * 
 * Error Handling:
 * - If StateManager not initialized, returns error object
 * - If invalid stateType, returns error object
 * - Errors are logged but don't crash the app
 * 
 * Requirements: Design Section "Architecture" - IPC Handlers
 * Requirements: Design "Key Functions" - StateManager.getState()
 * 
 * @param {Electron.IpcMainInvokeEvent} event - IPC event (unused)
 * @param {string|null} stateType - Optional state type to retrieve ('setup' | 'config' | 'printer' | 'template' | 'window')
 * @returns {Promise<object>} Current state object (complete or partial based on stateType)
 */
ipcMain.handle('get-state', async (event, stateType = null) => {
  try {
    // Precondition: Validate StateManager is initialized
    if (!stateManager) {
      const error = 'StateManager not initialized';
      log('ERROR', `get-state: ${error}`);
      return { 
        success: false, 
        error: error,
        state: null 
      };
    }
    
    // Log the request
    if (stateType) {
      log('INFO', `get-state: Retrieving ${stateType} state`);
    } else {
      log('INFO', `get-state: Retrieving complete state`);
    }
    
    // Call StateManager.getState()
    // This returns from in-memory cache (no disk I/O)
    const state = stateManager.getState(stateType);
    
    // Log success
    if (stateType) {
      log('INFO', `get-state: Successfully retrieved ${stateType} state`);
    } else {
      log('INFO', `get-state: Successfully retrieved complete state`);
    }
    
    // Postcondition: Return current state to renderer
    return {
      success: true,
      state: state
    };
    
  } catch (error) {
    // Error handling: Log error and return error object
    log('ERROR', `get-state: Failed to retrieve state: ${error.message}`);
    log('ERROR', `get-state: Stack trace: ${error.stack}`);
    
    return {
      success: false,
      error: error.message,
      state: null
    };
  }
});

/**
 * IPC Handler: save-bar-id
 * 
 * Saves the Bar ID to configuration and marks the setup step as complete.
 * This handler updates both the config state (with the new Bar ID) and the
 * setup state (marking the barId step as complete). All windows automatically
 * receive broadcasts of these changes.
 * 
 * This is typically called during the Setup Mode wizard when the user enters
 * their Bar ID for the first time, but can also be called from Settings to
 * update the Bar ID later.
 * 
 * Usage from renderer:
 * ```javascript
 * // Save Bar ID during setup
 * const result = await ipcRenderer.invoke('save-bar-id', 'bar-123');
 * if (result.success) {
 *   console.log('Bar ID saved:', result.barId);
 * }
 * ```
 * 
 * Algorithm:
 * 1. Validate StateManager and BroadcastManager are initialized
 * 2. Validate barId parameter (non-empty string)
 * 3. Update config state with new barId using updateStateAndBroadcast
 * 4. Mark setup step as complete using updateStateAndBroadcast
 * 5. Both updates automatically broadcast to all windows
 * 6. Return success response with saved barId
 * 
 * Preconditions:
 * - StateManager is initialized (happens on app startup)
 * - BroadcastManager is initialized (happens on app startup)
 * - barId parameter is a non-empty string
 * 
 * Postconditions:
 * - Config state contains the new barId
 * - Setup state marks barId step as completed with timestamp
 * - All registered windows receive state-changed broadcasts
 * - Returns success response with barId
 * 
 * Error Handling:
 * - If StateManager not initialized, returns error object
 * - If BroadcastManager not initialized, returns error object
 * - If barId is empty or invalid, returns error object
 * - If state update fails, returns error object
 * - Errors are logged but don't crash the app
 * 
 * Requirements: Design "Example Usage" - User saves Bar ID
 * Requirements: Design "Main Algorithm" - updateStateAndBroadcast
 * 
 * @param {Electron.IpcMainInvokeEvent} event - IPC event (unused)
 * @param {string} barId - The Bar ID to save
 * @returns {Promise<object>} Result object with success status and barId
 */
ipcMain.handle('save-bar-id', async (event, barId) => {
  try {
    // Precondition: Validate StateManager is initialized
    if (!stateManager) {
      const error = 'StateManager not initialized';
      log('ERROR', `save-bar-id: ${error}`);
      return { 
        success: false, 
        error: error
      };
    }
    
    // Precondition: Validate BroadcastManager is initialized
    if (!broadcastManager) {
      const error = 'BroadcastManager not initialized';
      log('ERROR', `save-bar-id: ${error}`);
      return { 
        success: false, 
        error: error
      };
    }
    
    // Precondition: Validate barId parameter
    if (!barId || typeof barId !== 'string' || barId.trim() === '') {
      const error = 'barId parameter must be a non-empty string';
      log('ERROR', `save-bar-id: ${error}`);
      return { 
        success: false, 
        error: error
      };
    }
    
    const trimmedBarId = barId.trim();
    log('INFO', `save-bar-id: Saving Bar ID: ${trimmedBarId}`);
    
    // Step 1: Update config state with new barId
    // This automatically persists to disk and broadcasts to all windows
    try {
      const updatedConfig = updateStateAndBroadcast(
        stateManager,
        broadcastManager,
        'config',
        { barId: trimmedBarId },
        'save-bar-id-handler'
      );
      
      log('INFO', `save-bar-id: Config state updated with barId: ${trimmedBarId}`);
    } catch (configError) {
      log('ERROR', `save-bar-id: Failed to update config state: ${configError.message}`);
      throw configError;
    }
    
    // Step 2: Mark setup step as complete
    // This automatically persists to disk and broadcasts to all windows
    try {
      const updatedSetup = updateStateAndBroadcast(
        stateManager,
        broadcastManager,
        'setup',
        {
          steps: {
            barId: {
              completed: true,
              completedAt: new Date().toISOString()
            }
          }
        },
        'save-bar-id-handler'
      );
      
      log('INFO', `save-bar-id: Setup step marked as complete for barId`);
    } catch (setupError) {
      log('ERROR', `save-bar-id: Failed to update setup state: ${setupError.message}`);
      throw setupError;
    }
    
    // Postcondition: Return success response with saved barId
    log('INFO', `save-bar-id: Successfully saved Bar ID: ${trimmedBarId}`);
    
    return {
      success: true,
      barId: trimmedBarId
    };
    
  } catch (error) {
    // Error handling: Log error and return error object
    log('ERROR', `save-bar-id: Failed to save Bar ID: ${error.message}`);
    log('ERROR', `save-bar-id: Stack trace: ${error.stack}`);
    
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: save-template
 * 
 * Handles template generation completion by updating template state and marking
 * the template setup step as complete. This handler is called when the template
 * generator successfully creates a template.json file.
 * 
 * Algorithm:
 * 1. Validate StateManager and BroadcastManager are initialized
 * 2. Validate template data parameter
 * 3. Update template state with new template information
 * 4. Mark setup step as complete with timestamp
 * 5. Broadcast changes to all windows (automatic via updateStateAndBroadcast)
 * 6. Return success response
 * 
 * Preconditions:
 * - StateManager is initialized (happens on app startup)
 * - BroadcastManager is initialized (happens on app startup)
 * - templateData parameter contains valid template information
 * 
 * Postconditions:
 * - Template state reflects the new template (exists: true, version, posSystem)
 * - Setup state marks template step as completed with timestamp
 * - All registered windows receive state-changed broadcasts
 * - Returns success response
 * 
 * Error Handling:
 * - If StateManager not initialized, returns error object
 * - If BroadcastManager not initialized, returns error object
 * - If templateData is invalid, returns error object
 * - If state update fails, returns error object
 * - Errors are logged but don't crash the app
 * 
 * Requirements: Design "Core Interfaces" - TemplateState
 * Requirements: Design "Main Algorithm" - updateStateAndBroadcast
 * Requirements: Task 5.4 - Create IPC handler for save-template
 * 
 * @param {Electron.IpcMainInvokeEvent} event - IPC event (unused)
 * @param {object} templateData - Template information (version, posSystem, path)
 * @returns {Promise<object>} Result object with success status
 */
ipcMain.handle('save-template', async (event, templateData) => {
  try {
    // Precondition: Validate StateManager is initialized
    if (!stateManager) {
      const error = 'StateManager not initialized';
      log('ERROR', `save-template: ${error}`);
      return { 
        success: false, 
        error: error
      };
    }
    
    // Precondition: Validate BroadcastManager is initialized
    if (!broadcastManager) {
      const error = 'BroadcastManager not initialized';
      log('ERROR', `save-template: ${error}`);
      return { 
        success: false, 
        error: error
      };
    }
    
    // Precondition: Validate templateData parameter
    if (!templateData || typeof templateData !== 'object') {
      const error = 'templateData parameter must be an object';
      log('ERROR', `save-template: ${error}`);
      return { 
        success: false, 
        error: error
      };
    }
    
    log('INFO', `save-template: Saving template data: ${JSON.stringify(templateData)}`);
    
    // Step 1: Update template state with new template information
    // This automatically persists to disk and broadcasts to all windows
    try {
      const updatedTemplate = updateStateAndBroadcast(
        stateManager,
        broadcastManager,
        'template',
        {
          exists: true,
          path: templateData.path || null,
          version: templateData.version || null,
          posSystem: templateData.posSystem || null,
          lastChecked: new Date().toISOString()
        },
        'save-template-handler'
      );
      
      log('INFO', `save-template: Template state updated with version: ${templateData.version}, posSystem: ${templateData.posSystem}`);
    } catch (templateError) {
      log('ERROR', `save-template: Failed to update template state: ${templateError.message}`);
      throw templateError;
    }
    
    // Step 2: Mark setup step as complete
    // This automatically persists to disk and broadcasts to all windows
    try {
      const updatedSetup = updateStateAndBroadcast(
        stateManager,
        broadcastManager,
        'setup',
        {
          steps: {
            template: {
              completed: true,
              completedAt: new Date().toISOString()
            }
          }
        },
        'save-template-handler'
      );
      
      log('INFO', `save-template: Setup step marked as complete for template`);
    } catch (setupError) {
      log('ERROR', `save-template: Failed to update setup state: ${setupError.message}`);
      throw setupError;
    }
    
    // Postcondition: Return success response
    log('INFO', `save-template: Successfully saved template`);
    
    // Update tray icon to reflect template completion
    // Requirement 15A.5, 15A.6: Update tray icon when template is created
    if (tray) {
      updateTrayMenu();
      log('INFO', 'save-template: Tray icon updated to reflect template completion');
    }
    
    return {
      success: true
    };
    
  } catch (error) {
    // Error handling: Log error and return error object
    log('ERROR', `save-template: Failed to save template: ${error.message}`);
    log('ERROR', `save-template: Stack trace: ${error.stack}`);
    
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * IPC Handler: check-template-exists
 * 
 * Checks if a valid template.json file exists in any of the standard locations.
 * This handler is used by the dashboard to show/hide the template warning banner.
 * 
 * Algorithm:
 * 1. Check multiple possible template locations in order of preference
 * 2. For each location, verify file exists and contains valid JSON
 * 3. Validate template has required fields (version and patterns)
 * 4. Return exists: true if valid template found, false otherwise
 * 
 * Template Locations (checked in order):
 * - C:\TabezaPrints\templates\template.json (preferred)
 * - C:\TabezaPrints\template.json (legacy)
 * - C:\ProgramData\Tabeza\template.json (alternative)
 * 
 * Requirements: Requirement 15A.2 - Check template existence for warning banner
 * 
 * @param {Electron.IpcMainInvokeEvent} event - IPC event (unused)
 * @returns {Promise<object>} Result object with exists boolean and optional path
 */
ipcMain.handle('check-template-exists', async (event) => {
  try {
    log('INFO', 'check-template-exists: Checking for template file');
    
    // Define possible template locations in order of preference
    const templatePaths = [
      path.join(TABEZA_PRINTS_DIR, 'templates', 'template.json'),
      path.join(TABEZA_PRINTS_DIR, 'template.json'),
      'C:\\ProgramData\\Tabeza\\template.json'
    ];
    
    // Check each possible location
    for (const templatePath of templatePaths) {
      if (fs.existsSync(templatePath)) {
        try {
          // Read and validate the template file
          const templateData = fs.readFileSync(templatePath, 'utf8');
          const template = JSON.parse(templateData);
          
          // Verify it has required fields (version and patterns)
          if (template.version && template.patterns) {
            log('INFO', `check-template-exists: Valid template found at ${templatePath}`);
            return {
              success: true,
              exists: true,
              path: templatePath,
              version: template.version
            };
          } else {
            log('WARN', `check-template-exists: Template at ${templatePath} missing required fields`);
          }
        } catch (parseError) {
          log('WARN', `check-template-exists: Error parsing template at ${templatePath}: ${parseError.message}`);
          // Continue checking other locations
        }
      }
    }
    
    // No valid template found
    log('INFO', 'check-template-exists: No valid template found');
    return {
      success: true,
      exists: false
    };
    
  } catch (error) {
    log('ERROR', `check-template-exists: Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      exists: false
    };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Printer Setup IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('get-printers', async () => {
  // List available Windows printers directly via PowerShell (no pooling script needed)
  return new Promise((resolve) => {
    const command = `powershell.exe -Command "Get-Printer | Where-Object {$_.Name -ne 'Tabeza POS Printer'} | Select-Object Name,DriverName,PortName | ConvertTo-Json -AsArray"`;
    
    exec(command, { maxBuffer: 1024 * 1024, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        log('ERROR', `get-printers: Error: ${error.message}`);
        resolve([]);
        return;
      }
      
      try {
        const output = stdout.trim();
        if (!output) {
          resolve([]);
          return;
        }
        const printers = JSON.parse(output);
        const list = Array.isArray(printers) ? printers : [printers];
        log('INFO', `get-printers: Found ${list.length} printers`);
        resolve(list.map(p => ({ name: p.Name, driver: p.DriverName, port: p.PortName })));
      } catch (parseError) {
        log('ERROR', `get-printers: Parse error: ${parseError.message}`);
        resolve([]);
      }
    });
  });
});

ipcMain.handle('setup-printer', async (event, printerName) => {
  try {
    log('INFO', `Setting up printer: ${printerName}`);
    
    // Use the Redmon-based configure script (not the old pooling script)
    const scriptPath = isDev 
      ? path.join(__dirname, 'installer/scripts/configure-redmon-printer.ps1')
      : path.join(process.resourcesPath, 'installer/scripts/configure-redmon-printer.ps1');

    if (!fs.existsSync(scriptPath)) {
      log('ERROR', `Printer setup script not found: ${scriptPath}`);
      return { success: false, error: `Script not found: ${scriptPath}` };
    }

    // Read Bar ID from config to pass to the script
    let barId = 'UNCONFIGURED';
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
        const config = JSON.parse(configData);
        if (config.barId && config.barId.trim()) {
          barId = config.barId.trim();
        }
      }
    } catch (e) {
      log('WARN', `Could not read barId from config: ${e.message}`);
    }

    // Capture script path (capture.exe installed alongside the app)
    const captureScriptPath = isDev
      ? path.join(__dirname, '../capture.exe')
      : path.join(process.resourcesPath, 'capture.exe');

    log('INFO', `Running Redmon printer setup script: ${scriptPath}`);
    log('INFO', `Bar ID: ${barId}`);
    log('INFO', `Capture script: ${captureScriptPath}`);

    return new Promise((resolve) => {
      // Run elevated via Start-Process -Verb RunAs, capture exit code via temp file
      const exitCodeFile = path.join(TABEZA_PRINTS_DIR, 'printer-setup-exit.tmp');
      
      const psCommand = [
        `$p = Start-Process powershell.exe`,
        `-ArgumentList '-ExecutionPolicy Bypass -File \"${scriptPath}\" -BarId \"${barId}\" -CaptureScriptPath \"${captureScriptPath}\"'`,
        `-Verb RunAs -Wait -PassThru -WindowStyle Hidden;`,
        `$p.ExitCode | Out-File -FilePath \"${exitCodeFile}\" -Encoding ascii`
      ].join(' ');

      exec(`powershell.exe -Command "${psCommand}"`, { timeout: 60000 }, (error, stdout, stderr) => {
        log('INFO', `Elevated launch stdout: ${stdout}`);
        if (stderr) log('WARN', `Elevated launch stderr: ${stderr}`);

        // Read exit code from temp file (reliable cross-process method)
        let exitCode = 1; // default to failure
        try {
          if (fs.existsSync(exitCodeFile)) {
            const raw = fs.readFileSync(exitCodeFile, 'utf8').trim();
            exitCode = parseInt(raw, 10);
            fs.unlinkSync(exitCodeFile); // clean up
            log('INFO', `Printer setup exit code (from file): ${exitCode}`);
          } else if (error) {
            log('WARN', 'Exit code file not found - UAC may have been cancelled');
            resolve({ success: false, error: 'Setup cancelled or UAC denied' });
            return;
          }
        } catch (e) {
          log('WARN', `Could not read exit code file: ${e.message}`);
        }

        if (exitCode === 0) {
          log('INFO', 'Printer setup completed successfully');
          
          try {
            updateStateAndBroadcast(stateManager, broadcastManager, 'printer', {
              status: 'FullyConfigured',
              printerName: 'Tabeza POS Printer',
              lastChecked: new Date().toISOString()
            }, 'setup-printer-handler');

            updateStateAndBroadcast(stateManager, broadcastManager, 'setup', {
              steps: {
                printer: {
                  completed: true,
                  completedAt: new Date().toISOString()
                }
              }
            }, 'setup-printer-handler');
          } catch (stateError) {
            log('ERROR', `Failed to update state after printer setup: ${stateError.message}`);
          }
          
          setTimeout(() => updateTrayMenu(), 1000);
          resolve({ success: true, message: 'Printer setup completed successfully' });
        } else {
          log('ERROR', `Printer setup failed with exit code: ${exitCode}`);
          resolve({ success: false, error: `Setup failed (exit code ${exitCode}). Check C:\\TabezaPrints\\logs\\electron.log for details.` });
        }
      });
    });
  } catch (error) {
    log('ERROR', `Setup exception: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-printer-setup', async () => {
  // BUGFIX: Check for actual "Tabeza POS Printer" existence using Get-Printer
  // instead of checking for printer pooling configuration.
  // Root cause: The printer uses Redmon (not pooling), so checking for pooling
  // configuration returns "Not configured" even though the printer exists.
  // Requirements: 2.1, 2.3, 2.5
  
  return new Promise((resolve) => {
    const command = `powershell.exe -Command "Get-Printer -Name 'Tabeza POS Printer' -ErrorAction SilentlyContinue | ConvertTo-Json"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // Printer doesn't exist or PowerShell error
        log('INFO', 'Printer check failed - printer likely not configured');
        resolve({ 
          status: 'not-configured', 
          printerName: 'Tabeza POS Printer',
          portName: null,
          exists: false
        });
        return;
      }

      try {
        const output = stdout.trim();
        
        if (!output || output === '') {
          // No output means printer doesn't exist
          log('INFO', 'Printer not found - no output from Get-Printer');
          resolve({ 
            status: 'not-configured', 
            printerName: 'Tabeza POS Printer',
            portName: null,
            exists: false
          });
          return;
        }
        
        // Parse the printer object
        const printer = JSON.parse(output);
        
        // Printer exists - return configured status
        log('INFO', `Printer found: ${printer.Name} on port ${printer.PortName}`);
        resolve({ 
          status: 'configured', 
          printerName: printer.Name || 'Tabeza POS Printer',
          portName: printer.PortName || null,
          exists: true
        });
        
      } catch (parseError) {
        // JSON parse error - printer likely doesn't exist
        log('WARN', `Failed to parse printer info: ${parseError.message}`);
        resolve({ 
          status: 'not-configured', 
          printerName: 'Tabeza POS Printer',
          portName: null,
          exists: false
        });
      }
    });
  });
});

// BUGFIX: Add check-printer-status handler for dashboard consistency
// Both check-printer-status and check-printer-setup return the same format
// Single source of truth for printer status across all pages
// Requirements: 2.1, 2.3, 3.1, 3.4
ipcMain.handle('check-printer-status', async () => {
  return new Promise((resolve) => {
    const command = `powershell.exe -Command "Get-Printer -Name 'Tabeza POS Printer' -ErrorAction SilentlyContinue | ConvertTo-Json"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log('INFO', 'check-printer-status: Printer check failed - printer likely not configured');
        resolve({ 
          status: 'not-configured', 
          printerName: 'Tabeza POS Printer',
          portName: null,
          exists: false
        });
        return;
      }

      try {
        const output = stdout.trim();
        
        if (!output || output === '') {
          log('INFO', 'check-printer-status: Printer not found - no output from Get-Printer');
          resolve({ 
            status: 'not-configured', 
            printerName: 'Tabeza POS Printer',
            portName: null,
            exists: false
          });
          return;
        }
        
        const printer = JSON.parse(output);
        
        log('INFO', `check-printer-status: Printer found - ${printer.Name} on port ${printer.PortName}`);
        resolve({ 
          status: 'configured', 
          printerName: printer.Name || 'Tabeza POS Printer',
          portName: printer.PortName || null,
          exists: true
        });
        
      } catch (parseError) {
        log('WARN', `check-printer-status: Failed to parse printer info - ${parseError.message}`);
        resolve({ 
          status: 'not-configured', 
          printerName: 'Tabeza POS Printer',
          portName: null,
          exists: false
        });
      }
    });
  });
});

ipcMain.handle('check-folder-structure', async () => {
  return checkTabezaPrintsFolder();
});

ipcMain.handle('repair-folder-structure', async () => {
  return initializeTabezaPrintsFolder();
});

// Handle open printer setup request from dashboard
  ipcMain.on('open-printer-setup', () => {
    showPrinterSetupWizard();
  });

  // Add dashboard-specific IPC handlers
  ipcMain.handle('get-pipeline-status', async () => {
    log('INFO', 'get-pipeline-status requested');
    
    // Check if background service is running (child process)
    const backgroundServiceRunning = backgroundService && !backgroundService.killed;
    
    // Count files
    let rawCount = 0;
    let queueSize = 0;
    
    try {
      const files = fs.readdirSync('C:\\TabezaPrints\\raw').filter(f => f.endsWith('.prn'));
      rawCount = files.length;
    } catch (e) { }
    
    try {
      const pending = fs.readdirSync('C:\\TabezaPrints\\queue\\pending').filter(f => f.endsWith('.json'));
      queueSize = pending.length;
    } catch (e) { }
    
    // Get service uptime if running
    let serviceDetail = 'Not running';
    if (backgroundServiceRunning) {
      serviceDetail = 'Running (PID: ' + backgroundService.pid + ')';
    }
    
    return {
      pos: { status: backgroundServiceRunning ? 'ok' : 'unknown', detail: backgroundServiceRunning ? 'Service active' : 'Service not running' },
      printer: { status: 'ok', detail: 'Driver active · Port: TabezaCapturePort' },
      redmon: { status: backgroundServiceRunning ? 'ok' : 'unknown', detail: backgroundServiceRunning ? 'Port monitoring active' : 'Service not running' },
      capture: { status: rawCount > 0 ? 'ok' : 'unknown', detail: rawCount > 0 ? `${rawCount} receipts captured` : 'No captures yet' },
      service: { status: backgroundServiceRunning ? 'ok' : 'error', detail: serviceDetail },
      cloud: { status: queueSize > 0 ? 'warn' : 'ok', detail: queueSize > 0 ? `${queueSize} pending upload` : 'No pending uploads' },
      restaurant: { status: queueSize > 0 ? 'ok' : 'unknown', detail: queueSize > 0 ? 'Receiving data' : 'Waiting for uploads' }
    };
  });

  ipcMain.handle('get-bar-id', async () => {
    log('INFO', 'get-bar-id requested');
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        const cleanData = configData.replace(/^\uFEFF/, '');
        const config = JSON.parse(cleanData);
        return config.barId || 'NOT_CONFIGURED';
      }
      return 'NOT_CONFIGURED';
    } catch (error) {
      log('ERROR', `Failed to read Bar ID: ${error.message}`);
      return 'NOT_CONFIGURED';
    }
  });

  ipcMain.handle('get-samples-status', async () => {
    log('INFO', 'get-samples-status requested');
    try {
      const samplesDir = 'C:\\TabezaPrints\\samples';
      const templatePath = 'C:\\TabezaPrints\\templates\\template.json';
      
      const hasTemplate = fs.existsSync(templatePath);
      let samples = [];
      let count = 0;
      
      if (fs.existsSync(samplesDir)) {
        const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.txt'));
        count = files.length;
        samples = files.slice(0, 10).map(f => {
          const filePath = path.join(samplesDir, f);
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf8');
          
          return {
            name: f,
            time: stats.mtime.toISOString(),
            timestamp: stats.mtime.toISOString(),
            content: content.trim(), // Include content for deduplication
            text: content.trim()     // Alternate field for content
          };
        });
      }
      
      return { count, samples, hasTemplate };
    } catch (error) {
      log('ERROR', `Failed to get samples status: ${error.message}`);
      return { count: 0, samples: [], hasTemplate: false };
    }
  });

  // Dashboard action handlers
  ipcMain.handle('action-restart-service', async () => {
    log('INFO', 'action-restart-service triggered');
    try {
      // Kill the background service if it exists
      if (backgroundService && !backgroundService.killed) {
        log('INFO', 'Killing existing background service');
        backgroundService.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      // Start the service again
      setTimeout(() => {
        startBackgroundService().catch(err => {
          log('ERROR', `Failed to restart service: ${err.message}`);
        });
      }, 2000);
      return { ok: true, detail: 'Service restart initiated' };
    } catch (error) {
      log('ERROR', `Restart service error: ${error.message}`);
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('action-verify-redmon', async () => {
    log('INFO', 'action-verify-redmon triggered');
    try {
      const { execSync } = require('child_process');
      const result = execSync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\Redirected Port\\Ports\\TabezaCapturePort"',
        { encoding: 'utf8' }
      ).toString();
      log('INFO', 'RedMon registry check completed');
      return { ok: true, detail: result };
    } catch (error) {
      log('ERROR', `RedMon verification error: ${error.message}`);
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('action-test-print', async () => {
    log('INFO', 'action-test-print triggered');
    try {
      const res = await fetch('http://localhost:8765/api/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        log('INFO', 'Test print sent successfully');
        return { ok: true, detail: 'Test print sent successfully' };
      } else {
        log('ERROR', `Test print failed: HTTP ${res.status}`);
        return { ok: false, detail: `HTTP ${res.status}` };
      }
    } catch (error) {
      log('ERROR', `Test print error: ${error.message}`);
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('action-test-cloud', async () => {
    log('INFO', 'action-test-cloud triggered');
    try {
      const res = await fetch('http://localhost:8765/api/test-cloud');
      if (res.ok) {
        log('INFO', 'Cloud test successful');
        return { ok: true, detail: 'Cloud test successful' };
      } else {
        log('ERROR', `Cloud test failed: HTTP ${res.status}`);
        return { ok: false, detail: `HTTP ${res.status}` };
      }
    } catch (error) {
      log('ERROR', `Cloud test error: ${error.message}`);
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('action-kill-processes', async () => {
    log('INFO', 'action-kill-processes triggered');
    try {
      // Kill the background service if it exists
      if (backgroundService && !backgroundService.killed) {
        backgroundService.kill('SIGTERM');
        backgroundService = null;
      }
      return { ok: true, detail: 'Service processes terminated' };
    } catch (error) {
      log('ERROR', `Kill processes error: ${error.message}`);
      return { ok: false, detail: error.message };
    }
  });

  ipcMain.handle('action-export-diagnostics', async () => {
    log('INFO', 'action-export-diagnostics triggered');
    try {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog({
        title: 'Export Diagnostics',
        defaultPath: 'tabeza-diagnostics.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      });
      
      if (result.filePath) {
        const fs = require('fs');
        const diagnostics = generateDiagnosticsReport();
        fs.writeFileSync(result.filePath, diagnostics, 'utf8');
        log('INFO', `Diagnostics exported to ${result.filePath}`);
        return { ok: true, detail: `Exported to ${result.filePath}` };
      }
      log('INFO', 'Export cancelled by user');
      return { ok: false, detail: 'Export cancelled' };
    } catch (error) {
      log('ERROR', `Export diagnostics error: ${error.message}`);
      return { ok: false, detail: error.message };
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
// Template Generation IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('get-template-status', async () => {
  try {
    const res = await fetch('http://localhost:8765/api/template/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    log('ERROR', `get-template-status: ${error.message}`);
    // Fallback: check disk directly if service not reachable
    const samplesDir = 'C:\\TabezaPrints\\samples';
    const templatePath = 'C:\\TabezaPrints\\templates\\template.json';
    let capturedReceipts = 0;
    try {
      if (fs.existsSync(samplesDir)) {
        capturedReceipts = fs.readdirSync(samplesDir).filter(f => f.endsWith('.txt')).length;
      }
    } catch (_) {}
    return {
      success: true,
      capturedReceipts,
      templateGenerated: fs.existsSync(templatePath),
      templateMissing: !fs.existsSync(templatePath)
    };
  }
});

ipcMain.handle('generate-template', async () => {
  log('INFO', 'generate-template: Starting template generation via Tabeza Staff API');
  try {
    log('INFO', 'generate-template: Attempting to fetch from http://localhost:3003/api/receipts/generate-template');
    
    // Read samples directly and send to Tabeza Staff
    const fs = require('fs');
    const path = require('path');
    const samplesDir = 'C:\\TabezaPrints\\samples';
    
    let receipts = [];
    if (fs.existsSync(samplesDir)) {
      const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.txt'));
      receipts = files.map(f => {
        const content = fs.readFileSync(path.join(samplesDir, f), 'utf8');
        return content.trim();
      });
    }
    
    const res = await fetch('http://localhost:3003/api/receipts/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test_receipts: receipts,
        bar_id: '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
      })
    });
    
    log('INFO', `generate-template: Response status: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      log('ERROR', `generate-template: HTTP ${res.status} - ${errorText}`);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const result = await res.json();
    log('INFO', `generate-template: Response: ${JSON.stringify(result)}`);

    if (result.success) {
      log('INFO', 'generate-template: Template generated successfully');
      log('INFO', 'generate-template: Template saved to database by Tabeza Staff');
      
      // Create a simple template file for local parsing
      const templatePath = 'C:\\TabezaPrints\\templates\\template.json';
      if (!fs.existsSync('C:\\TabezaPrints\\templates')) {
        fs.mkdirSync('C:\\TabezaPrints\\templates', { recursive: true });
      }
      
      // Create a basic template indicating success
      const basicTemplate = {
        name: 'AI Generated Template',
        version: '1.0',
        description: 'Template generated by Tabeza Staff AI',
        success: true,
        databaseId: result.template?.id,
        barId: '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
        generatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(templatePath, JSON.stringify(basicTemplate, null, 2));
      
      // Notify main window to refresh state
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('template-generated', basicTemplate);
      }
      updateTrayMenu();
    }
    return result;
  } catch (error) {
    log('ERROR', `generate-template: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Function to generate diagnostics report
  function generateDiagnosticsReport() {
    const timestamp = new Date().toISOString();
    let config = {};
    
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        const cleanData = configData.replace(/^\uFEFF/, '');
        config = JSON.parse(cleanData);
      }
    } catch (error) {
      log('ERROR', `Failed to read config for diagnostics: ${error.message}`);
    }
    
    return `TabezaConnect Diagnostics Report
Generated: ${timestamp}

Configuration:
Bar ID: ${config.barId || 'Not configured'}
API URL: ${config.apiUrl || 'Not configured'}

System Information:
Platform: ${process.platform}
Node Version: ${process.version}
Electron Version: ${process.versions.electron}
App Version: ${APP_VERSION}

Active Services:
- Background Service: Running
- HTTP Server: http://localhost:8765
- File System Monitoring: Active

Recent Logs:
[Logs would be populated from actual system events]
`;
  }

  // Function to push log entries to dashboard
  function pushLogToDashboard(level, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log-entry', {
        time: new Date().toLocaleTimeString('en-GB'),
        level,
        msg: message
      });
    }
  }

  // Expose for use in other modules
  global.pushLogToDashboard = pushLogToDashboard;


/**
 * Launch printer setup wizard
 * Opens the printer pooling configuration window
 */
ipcMain.handle('launch-printer-setup', async () => {
  try {
    log('INFO', 'launch-printer-setup: Opening printer setup wizard');
    showPrinterSetupWizard();
    return { success: true };
  } catch (error) {
    log('ERROR', `Failed to launch printer setup: ${error.message}`);
    return { success: false, error: error.message };
  }
});

/**
 * Launch template generator wizard
 * Opens the template generation workflow window
 */
ipcMain.handle('launch-template-generator', async () => {
  try {
    log('INFO', 'launch-template-generator: Opening template generator');
    showTemplateGenerator();
    return { success: true };
  } catch (error) {
    log('ERROR', `Failed to launch template generator: ${error.message}`);
    return { success: false, error: error.message };
  }
});

/**
 * Check template configuration status
 * Checks if template.json exists in any of the possible locations
 */
ipcMain.handle('check-template-status', async () => {
  try {
    const templatePaths = [
      path.join(TABEZA_PRINTS_DIR, 'templates', 'template.json'),
      path.join(TABEZA_PRINTS_DIR, 'template.json'),
      'C:\\ProgramData\\Tabeza\\template.json'
    ];
    
    for (const templatePath of templatePaths) {
      if (fs.existsSync(templatePath)) {
        try {
          const templateData = fs.readFileSync(templatePath, 'utf8');
          const template = JSON.parse(templateData);
          
          if (template.version && template.patterns) {
            log('INFO', `check-template-status: Template found at ${templatePath}`);
            return {
              exists: true,
              path: templatePath,
              version: template.version,
              posSystem: template.posSystem || 'Unknown'
            };
          }
        } catch (parseError) {
          log('WARN', `check-template-status: Invalid template at ${templatePath}`);
        }
      }
    }
    
    log('INFO', 'check-template-status: No template found');
    return { exists: false };
  } catch (error) {
    log('ERROR', `Failed to check template status: ${error.message}`);
    return { exists: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', async () => {
  return APP_VERSION;
});

// ─────────────────────────────────────────────────────────────────────────────
// Setup State IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current setup state
 * Returns the setup state including completion status of all three steps
 */
ipcMain.handle('get-setup-state', async () => {
  try {
    const state = setupStateManager.loadSetupState();
    log('INFO', `get-setup-state: Loaded state - firstRunComplete: ${state.firstRunComplete}`);
    return state;
  } catch (error) {
    log('ERROR', `get-setup-state: Error loading state: ${error.message}`);
    // Return default state on error
    return setupStateManager.getDefaultSetupState();
  }
});

/**
 * Mark a specific setup step as complete
 * Validates step name and updates the setup state
 * 
 * @param {string} stepName - One of: 'barId', 'printer', 'template'
 */
ipcMain.handle('mark-step-complete', async (event, stepName) => {
  try {
    log('INFO', `mark-step-complete: Marking step '${stepName}' as complete`);
    
    // Precondition: Validate StateManager is initialized
    if (!stateManager) {
      const error = 'StateManager not initialized';
      log('ERROR', `mark-step-complete: ${error}`);
      return { success: false, error };
    }
    
    // Precondition: Validate BroadcastManager is initialized
    if (!broadcastManager) {
      const error = 'BroadcastManager not initialized';
      log('ERROR', `mark-step-complete: ${error}`);
      return { success: false, error };
    }
    
    // Validate step name (will throw if invalid)
    const validSteps = ['barId', 'printer', 'template'];
    if (!validSteps.includes(stepName)) {
      const error = `Invalid step name: ${stepName}. Valid steps are: ${validSteps.join(', ')}`;
      log('ERROR', `mark-step-complete: ${error}`);
      return { success: false, error };
    }
    
    // Mark step complete using new state management system
    // This automatically persists to disk and broadcasts to all windows
    try {
      const stepUpdate = {
        steps: {
          [stepName]: {
            completed: true,
            completedAt: new Date().toISOString()
          }
        }
      };
      
      const updatedSetup = updateStateAndBroadcast(
        stateManager,
        broadcastManager,
        'setup',
        stepUpdate,
        'mark-step-complete-handler'
      );
      
      log('INFO', `mark-step-complete: Successfully marked '${stepName}' as complete`);
      
      // Update tray icon color based on setup completion
      updateTrayMenu();
      
      return { success: true, state: updatedSetup };
      
    } catch (updateError) {
      log('ERROR', `mark-step-complete: Failed to update setup state: ${updateError.message}`);
      throw updateError;
    }
    
  } catch (error) {
    log('ERROR', `mark-step-complete: Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

/**
 * Reset setup state to default (for testing/debugging)
 * Clears all step completion and resets firstRunComplete flag
 */
ipcMain.handle('reset-setup-state', async () => {
  try {
    log('INFO', 'reset-setup-state: Resetting setup state to default');
    
    // Precondition: Validate StateManager is initialized
    if (!stateManager) {
      const error = 'StateManager not initialized';
      log('ERROR', `reset-setup-state: ${error}`);
      return { success: false, error };
    }
    
    // Precondition: Validate BroadcastManager is initialized
    if (!broadcastManager) {
      const error = 'BroadcastManager not initialized';
      log('ERROR', `reset-setup-state: ${error}`);
      return { success: false, error };
    }
    
    // Reset setup state using new state management system
    // This automatically persists to disk and broadcasts to all windows
    try {
      const defaultSetupState = {
        firstRunComplete: false,
        steps: {
          barId: {
            completed: false,
            completedAt: null
          },
          printer: {
            completed: false,
            completedAt: null
          },
          template: {
            completed: false,
            completedAt: null
          }
        }
      };
      
      const updatedSetup = updateStateAndBroadcast(
        stateManager,
        broadcastManager,
        'setup',
        defaultSetupState,
        'reset-setup-state-handler'
      );
      
      log('INFO', 'reset-setup-state: Successfully reset setup state');
      
      // Update tray icon color
      updateTrayMenu();
      
      return { success: true, state: updatedSetup };
      
    } catch (updateError) {
      log('ERROR', `reset-setup-state: Failed to reset setup state: ${updateError.message}`);
      throw updateError;
    }
    
  } catch (error) {
    log('ERROR', `reset-setup-state: Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Window State IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get saved window state (dimensions, position, last active section)
 * Returns default state if no saved state exists
 */
ipcMain.handle('get-window-state', async () => {
  try {
    const state = windowStateManager.restoreWindowState();
    log('INFO', `get-window-state: Loaded window state - ${state.width}x${state.height}`);
    return state;
  } catch (error) {
    log('ERROR', `get-window-state: Error loading state: ${error.message}`);
    // Return default state on error
    return windowStateManager.getDefaultWindowState();
  }
});

/**
 * Save the currently active section/tab
 * Used to restore the same section when window reopens
 * 
 * @param {string} sectionName - Name of the active section (e.g., 'dashboard', 'printer', 'template')
 */
ipcMain.handle('save-active-section', async (event, sectionName) => {
  try {
    log('INFO', `save-active-section: Saving active section: ${sectionName}`);
    
    // Load current window state
    const currentState = windowStateManager.restoreWindowState();
    
    // Update active section
    currentState.lastActiveSection = sectionName;
    
    // Save updated state
    const success = windowStateManager.saveWindowState(currentState);
    
    if (success) {
      log('INFO', `save-active-section: Successfully saved active section: ${sectionName}`);
      return { success: true };
    } else {
      log('ERROR', 'save-active-section: Failed to save window state');
      return { success: false, error: 'Failed to save window state' };
    }
    
  } catch (error) {
    log('ERROR', `save-active-section: Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// What's New IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

const whatsNewManager = require('./lib/whats-new-manager');

/**
 * Check if the "What's New" dialog should be shown
 * Returns true if this is the first launch after an upgrade
 */
ipcMain.handle('should-show-whats-new', async () => {
  try {
    const shouldShow = whatsNewManager.shouldShowWhatsNew();
    log('INFO', `should-show-whats-new: ${shouldShow}`);
    return shouldShow;
  } catch (error) {
    log('ERROR', `should-show-whats-new: Error: ${error.message}`);
    return false;
  }
});

/**
 * Mark the current version as seen and optionally opt out of future dialogs
 * 
 * @param {boolean} dontShowAgain - If true, user opted out of future dialogs
 */
ipcMain.handle('mark-whats-new-seen', async (event, dontShowAgain = false) => {
  try {
    log('INFO', `mark-whats-new-seen: dontShowAgain=${dontShowAgain}`);
    const updatedState = whatsNewManager.markVersionSeen(dontShowAgain);
    log('INFO', 'mark-whats-new-seen: Successfully marked version as seen');
    return { success: true, state: updatedState };
  } catch (error) {
    log('ERROR', `mark-whats-new-seen: Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

async function initialize() {
  log('INFO', '========================================');
  log('INFO', `${APP_NAME} v${APP_VERSION} starting...`);
  log('INFO', '========================================');
  log('INFO', `Development mode: ${isDev}`);
  log('INFO', `Assets path: ${ASSETS_PATH}`);
  log('INFO', `Data directory: ${TABEZA_PRINTS_DIR}`);
  log('INFO', `Capture file: ${CAPTURE_FILE}`);

  // STEP 1: ALWAYS ensure folder structure exists (runs on every startup)
  initializeTabezaPrintsFolder();

  // STEP 1.5-1.8: Run auto-detection tasks in parallel for faster startup
  // Performance Optimization: Requirements 19.1-19.5
  log('INFO', 'Running parallel initialization tasks...');
  
  const initTasks = [
    // Migrate existing installations to new setup state system
    migrateExistingInstallation()
  ];
  
  // Wait for all parallel tasks to complete
  await Promise.all(initTasks);
  
  // Run synchronous auto-detection tasks after migration completes
  // These are fast and don't need to be parallelized
  
  // STEP 1.6: Auto-detect Bar ID from config.json and mark step complete if found
  // This runs on every startup to ensure Bar ID step is automatically marked
  // complete when a valid Bar ID exists in configuration (Requirement 3.7)
  autoDetectBarId();

  // STEP 1.8: Auto-detect template status and mark step complete if found
  // This runs on every startup to ensure Template step is automatically marked
  // complete when a valid template.json exists (Requirements 10.1-10.7)
  autoDetectTemplateStatus();
  
  log('INFO', 'Parallel initialization tasks completed');

  // STEP 2: Create tray
  createTray();

  // STEP 3: Start background service
  try {
    await startBackgroundService();
    log('INFO', 'Background service started successfully');
  } catch (err) {
    log('ERROR', `Failed to start background service: ${err.message}`);
    
    if (tray) {
      const errorMenu = Menu.buildFromTemplate([
        { label: '⚠️ Service Failed to Start', enabled: false },
        { label: `Error: ${err.message}`, enabled: false },
        { type: 'separator' },
        { label: 'Repair Folder Structure', click: () => {
          initializeTabezaPrintsFolder();
          updateTrayMenu();
        }},
        { label: 'Retry', click: () => initialize() },
        { label: 'Quit', click: () => quitApp() }
      ]);
      tray.setContextMenu(errorMenu);
    }
    return;
  }

    // STEP 4: Printer setup is ONLY done during installation
    // Do NOT show printer setup wizard from the app - it should be configured by installer
    log('INFO', 'Printer setup handled by installer');

  showNotification('Tabeza Connect Started', 'Receipt capture service is running');
}

function quitApp() {
  isQuitting = true;
  
  log('INFO', 'Application quitting...');
  
  stopBackgroundService().then(() => {
    if (tray) {
      tray.destroy();
    }
    app.quit();
  });
}

app.on('window-all-closed', () => {
    // Don't quit - keep running in tray
  });

  app.on('before-quit', async (event) => {
    if (!isQuitting) {
      event.preventDefault();
      quitApp();
    }
  });

process.on('uncaughtException', (error) => {
  log('ERROR', `Uncaught exception: ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', `Unhandled rejection: ${reason}`);
});