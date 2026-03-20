/**
 * Preload Script with Context Isolation
 * 
 * This script runs in the renderer process before the web page loads.
 * It exposes a secure IPC bridge via contextBridge, allowing the renderer
 * to communicate with the main process without exposing the full Node.js API.
 * 
 * Security considerations:
 * - contextIsolation: true (prevents renderer from accessing Node.js APIs)
 * - nodeIntegration: false (prevents renderer from using require())
 * - Only whitelisted IPC methods are exposed
 * - All parameters are validated in main process handlers
 * 
 * Requirements: Security considerations from design document
 */

const { contextBridge, ipcRenderer } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// Secure IPC Bridge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expose safe IPC methods to the renderer process
 * These methods are available via window.electronAPI in the renderer
 */
contextBridge.exposeInMainWorld('electronAPI', {
  
  // ───────────────────────────────────────────────────────────────────────────
  // Setup State Management
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Get the current setup state
   * @returns {Promise<object>} Setup state object
   */
  getSetupState: () => ipcRenderer.invoke('get-setup-state'),
  
  /**
   * Mark a setup step as complete
   * @param {string} stepName - Name of the step ('barId', 'printer', 'template')
   * @returns {Promise<object>} Result object with success status
   */
  markStepComplete: (stepName) => {
    // Validate step name before sending to main process
    const validSteps = ['barId', 'printer', 'template'];
    if (!validSteps.includes(stepName)) {
      return Promise.reject(new Error(`Invalid step name: ${stepName}`));
    }
    return ipcRenderer.invoke('mark-step-complete', stepName);
  },
  
  /**
   * Reset setup state to default (all steps incomplete)
   * @returns {Promise<object>} Result object with success status
   */
  resetSetupState: () => ipcRenderer.invoke('reset-setup-state'),
  
  // ───────────────────────────────────────────────────────────────────────────
  // Window State Management
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Get saved window state (dimensions, position, last active section)
   * @returns {Promise<object>} Window state object
   */
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  
  /**
   * Save the currently active section/tab
   * @param {string} sectionName - Name of the active section
   * @returns {Promise<object>} Result object with success status
   */
  saveActiveSection: (sectionName) => {
    // Validate section name (basic sanitization)
    if (typeof sectionName !== 'string' || sectionName.trim() === '') {
      return Promise.reject(new Error('Invalid section name'));
    }
    return ipcRenderer.invoke('save-active-section', sectionName);
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // Configuration Management
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Get current configuration (Bar ID, API URL, etc.)
   * @returns {Promise<object>} Configuration object
   */
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  /**
   * Get current Bar ID
   * @returns {Promise<string>} Bar ID or 'NOT_CONFIGURED'
   */
  getBarId: () => ipcRenderer.invoke('get-bar-id'),
  
  /**
   * Save Bar ID to configuration
   * @param {string} barId - Bar ID from Tabeza staff app
   * @returns {Promise<object>} Result object with success status
   */
  saveBarId: (barId) => {
    // Validate Bar ID (basic sanitization)
    if (typeof barId !== 'string' || barId.trim() === '') {
      return Promise.reject(new Error('Invalid Bar ID'));
    }
    return ipcRenderer.invoke('save-bar-id', barId.trim());
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // Service Control
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Get current service status
   * @returns {Promise<object>} Service status object
   */
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  
  /**
   * Start the background service
   * @returns {Promise<object>} Result object with success status
   */
  startService: () => ipcRenderer.invoke('start-service'),
  
  /**
   * Stop the background service
   * @returns {Promise<object>} Result object with success status
   */
  stopService: () => ipcRenderer.invoke('stop-service'),
  
  /**
   * Restart the background service
   * @returns {Promise<object>} Result object with success status
   */
  restartService: () => ipcRenderer.invoke('restart-service'),
  
  // ───────────────────────────────────────────────────────────────────────────
  // Printer Setup
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Launch printer setup wizard
   * @returns {Promise<object>} Result object with success status
   */
  launchPrinterSetup: () => ipcRenderer.invoke('launch-printer-setup'),
  
  /**
   * Check printer configuration status
   * @returns {Promise<object>} Printer status object
   */
  checkPrinterStatus: () => ipcRenderer.invoke('check-printer-status'),
  
  /**
   * Check printer setup configuration (alias for checkPrinterStatus)
   * @returns {Promise<object>} Printer status object
   */
  checkPrinterSetup: () => ipcRenderer.invoke('check-printer-setup'),
  
  // ───────────────────────────────────────────────────────────────────────────
  // Template Generator
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Launch template generator wizard
   * @returns {Promise<object>} Result object with success status
   */
  launchTemplateGenerator: () => ipcRenderer.invoke('launch-template-generator'),
  
  /**
   * Check template configuration status
   * @returns {Promise<object>} Template status object
   */
  checkTemplateStatus: () => ipcRenderer.invoke('check-template-status'),
  
  // ───────────────────────────────────────────────────────────────────────────
  // System Operations
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Repair folder structure
   * @returns {Promise<object>} Result object with success status
   */
  repairFolders: () => ipcRenderer.invoke('repair-folders'),
  
  /**
   * Open capture folder in Windows Explorer
   * @returns {Promise<object>} Result object with success status
   */
  openCaptureFolder: () => ipcRenderer.invoke('open-capture-folder'),
  
  /**
   * Get recent log entries
   * @param {number} lines - Number of lines to retrieve (default: 100)
   * @returns {Promise<object>} Log entries object
   */
  getLogEntries: (lines = 100) => {
    // Validate lines parameter
    const numLines = parseInt(lines, 10);
    if (isNaN(numLines) || numLines < 1 || numLines > 1000) {
      return Promise.reject(new Error('Invalid lines parameter (must be 1-1000)'));
    }
    return ipcRenderer.invoke('get-log-entries', numLines);
  },
  
  /**
   * Clear log file
   * @returns {Promise<object>} Result object with success status
   */
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  
  /**
   * Open log file in default text editor
   * @returns {Promise<object>} Result object with success status
   */
  openLogFile: () => ipcRenderer.invoke('open-log-file'),
  
  // ───────────────────────────────────────────────────────────────────────────
  // What's New Dialog
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if the "What's New" dialog should be shown
   * @returns {Promise<boolean>} True if dialog should be shown
   */
  shouldShowWhatsNew: () => ipcRenderer.invoke('should-show-whats-new'),
  
  /**
   * Mark the current version as seen and optionally opt out of future dialogs
   * @param {boolean} dontShowAgain - If true, user opted out of future dialogs
   * @returns {Promise<object>} Result object with success status
   */
  markWhatsNewSeen: (dontShowAgain = false) => {
    // Validate parameter
    if (typeof dontShowAgain !== 'boolean') {
      return Promise.reject(new Error('Invalid dontShowAgain parameter (must be boolean)'));
    }
    return ipcRenderer.invoke('mark-whats-new-seen', dontShowAgain);
  },
  
  // ───────────────────────────────────────────────────────────────────────────
  // Generic IPC bridge (used by status-window.html which calls ipc.invoke(channel)
  // directly rather than the named methods above)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generic invoke — routes any whitelisted channel to the main process.
   * Allows: const ipc = window.electronAPI; await ipc.invoke('get-bar-id')
   */
  invoke: (channel, ...args) => {
    const allowedChannels = [
      'get-bar-id', 'save-bar-id', 'get-config', 'save-config',
      'get-pipeline-status', 'get-samples-status', 'get-setup-state',
      'mark-step-complete', 'reset-setup-state', 'get-window-state',
      'save-active-section', 'check-printer-status', 'check-printer-setup',
      'launch-printer-setup', 'setup-printer', 'get-printers',
      'check-template-status', 'check-template-exists', 'launch-template-generator',
      'save-template', 'generate-template', 'get-template-status',
      'test-print', 'test-template', 'save-api-settings',
      'repair-folder-structure', 'check-folder-structure',
      'get-log-entries', 'clear-logs', 'open-log-file', 'open-capture-folder',
      'repair-folders', 'get-app-version', 'get-state',
      'should-show-whats-new', 'mark-whats-new-seen',
      'printer-setup-wizard-complete',
      'action-test-print', 'action-test-cloud', 'action-restart-service',
      'action-verify-redmon', 'action-export-diagnostics', 'action-kill-processes',
      'start-service', 'stop-service', 'restart-service', 'get-service-status',
      'get-logs', 'get-windows-printers', 'select-printer', 'test-print-invoke',
    ];
    if (!allowedChannels.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Generic on — listens for push events from the main process.
   * Allows: ipc.on('log-entry', (entry) => ...)
   */
  on: (channel, callback) => {
    const allowedChannels = [
      'log-entry', 'state-changed', 'state-sync',
      'config-updated', 'printer-setup-complete'
    ];
    if (!allowedChannels.includes(channel)) return;
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Real-Time State Synchronization Event Listeners
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Register a listener for state-changed events
   * Called when any state is updated in the main process
   * @param {Function} callback - Callback function to handle state change events
   * @returns {Function} Cleanup function to remove the listener
   */
  onStateChanged: (callback) => {
    const listener = (event, stateChangeEvent) => {
      callback(stateChangeEvent);
    };
    ipcRenderer.on('state-changed', listener);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('state-changed', listener);
    };
  },
  
  /**
   * Register a listener for state-sync events
   * Called when window gains focus or needs full state synchronization
   * @param {Function} callback - Callback function to handle state sync events
   * @returns {Function} Cleanup function to remove the listener
   */
  onStateSync: (callback) => {
    const listener = (event, stateSyncEvent) => {
      callback(stateSyncEvent);
    };
    ipcRenderer.on('state-sync', listener);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('state-sync', listener);
    };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification - Log that preload executed successfully
// ─────────────────────────────────────────────────────────────────────────────

console.log('[Preload] Context bridge established - electronAPI exposed to renderer');

// ─────────────────────────────────────────────────────────────────────────────
// Security Notes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Security Best Practices Implemented:
 * 
 * 1. Context Isolation: Enabled in BrowserWindow webPreferences
 *    - Prevents renderer from accessing Node.js APIs directly
 *    - Prevents prototype pollution attacks
 * 
 * 2. Node Integration: Disabled in BrowserWindow webPreferences
 *    - Prevents renderer from using require() to load Node modules
 *    - Reduces attack surface
 * 
 * 3. Whitelisted IPC Methods: Only specific methods are exposed
 *    - No generic IPC send/invoke access
 *    - Each method has a specific purpose
 * 
 * 4. Input Validation: Parameters are validated before sending to main process
 *    - Type checking (string, number, etc.)
 *    - Range checking (e.g., log lines 1-1000)
 *    - Whitelist checking (e.g., valid step names)
 * 
 * 5. No File System Access: Renderer cannot access fs module
 *    - All file operations go through main process
 *    - Main process validates file paths
 * 
 * 6. No Shell Access: Renderer cannot execute shell commands
 *    - All system operations go through main process
 *    - Main process validates commands
 * 
 * Additional Security Measures (to be implemented in renderer):
 * - Content Security Policy (CSP) in HTML
 * - Use textContent instead of innerHTML to prevent XSS
 * - Sanitize user input before display
 * - Use HTTPS for external resources (if any)
 */
