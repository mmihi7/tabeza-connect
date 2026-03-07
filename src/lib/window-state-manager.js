/**
 * Window State Manager
 * 
 * Manages window state persistence for the Management UI.
 * Tracks window dimensions, position, and last active section.
 * 
 * State is persisted to app.getPath('userData')/window-state.json
 * Saves are debounced by 500ms to prevent excessive disk writes.
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_STATE_FILENAME = 'window-state.json';
const DEBOUNCE_DELAY_MS = 500;

// Default window dimensions
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 700;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let saveTimeout = null;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the path to the window state file
 * @returns {string} Full path to window-state.json
 */
function getWindowStatePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILENAME);
}

/**
 * Get the default window state structure
 * @returns {object} Default state with centered window
 */
function getDefaultWindowState() {
  return {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: null,  // null means centered
    y: null,  // null means centered
    lastActiveSection: 'dashboard'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restore window state from disk
 * Handles file corruption gracefully by returning default state
 * 
 * @returns {object} Window state object
 */
function restoreWindowState() {
  const statePath = getWindowStatePath();
  
  try {
    // Check if file exists
    if (!fs.existsSync(statePath)) {
      console.log('[WindowState] No window state file found, using default state');
      return getDefaultWindowState();
    }
    
    // Read and parse file
    const data = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(data);
    
    // Validate structure
    if (typeof state !== 'object' || state === null) {
      console.warn('[WindowState] Invalid state structure, using default state');
      return getDefaultWindowState();
    }
    
    // Ensure required fields exist with defaults
    const defaultState = getDefaultWindowState();
    const restoredState = {
      width: typeof state.width === 'number' ? state.width : defaultState.width,
      height: typeof state.height === 'number' ? state.height : defaultState.height,
      x: typeof state.x === 'number' ? state.x : defaultState.x,
      y: typeof state.y === 'number' ? state.y : defaultState.y,
      lastActiveSection: typeof state.lastActiveSection === 'string' 
        ? state.lastActiveSection 
        : defaultState.lastActiveSection
    };
    
    console.log('[WindowState] Restored window state successfully');
    return restoredState;
    
  } catch (error) {
    console.error(`[WindowState] Error restoring window state: ${error.message}`);
    console.error('[WindowState] Returning default state');
    return getDefaultWindowState();
  }
}

/**
 * Save window state to disk (debounced)
 * Debounces saves by 500ms to prevent excessive disk writes
 * 
 * @param {object} state - Window state object to save
 * @param {number} state.width - Window width in pixels
 * @param {number} state.height - Window height in pixels
 * @param {number|null} state.x - Window x position (null for centered)
 * @param {number|null} state.y - Window y position (null for centered)
 * @param {string} [state.lastActiveSection] - Last active section name
 */
function saveWindowState(state) {
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Debounce the save operation
  saveTimeout = setTimeout(() => {
    const statePath = getWindowStatePath();
    
    try {
      // Ensure userData directory exists
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      // Validate state object
      if (typeof state !== 'object' || state === null) {
        console.error('[WindowState] Invalid state object provided');
        return;
      }
      
      // Ensure required fields exist
      const stateToSave = {
        width: typeof state.width === 'number' ? state.width : DEFAULT_WIDTH,
        height: typeof state.height === 'number' ? state.height : DEFAULT_HEIGHT,
        x: typeof state.x === 'number' ? state.x : null,
        y: typeof state.y === 'number' ? state.y : null,
        lastActiveSection: state.lastActiveSection || 'dashboard'
      };
      
      // Write state to file
      fs.writeFileSync(statePath, JSON.stringify(stateToSave, null, 2), 'utf8');
      console.log('[WindowState] Saved window state successfully');
      
    } catch (error) {
      console.error(`[WindowState] Error saving window state: ${error.message}`);
    }
  }, DEBOUNCE_DELAY_MS);
}

/**
 * Save window state immediately without debouncing
 * Use this for critical saves (e.g., before app quit)
 * 
 * @param {object} state - Window state object to save
 */
function saveWindowStateImmediate(state) {
  // Clear any pending debounced save
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  
  const statePath = getWindowStatePath();
  
  try {
    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Validate state object
    if (typeof state !== 'object' || state === null) {
      console.error('[WindowState] Invalid state object provided');
      return;
    }
    
    // Ensure required fields exist
    const stateToSave = {
      width: typeof state.width === 'number' ? state.width : DEFAULT_WIDTH,
      height: typeof state.height === 'number' ? state.height : DEFAULT_HEIGHT,
      x: typeof state.x === 'number' ? state.x : null,
      y: typeof state.y === 'number' ? state.y : null,
      lastActiveSection: state.lastActiveSection || 'dashboard'
    };
    
    // Write state to file
    fs.writeFileSync(statePath, JSON.stringify(stateToSave, null, 2), 'utf8');
    console.log('[WindowState] Saved window state immediately');
    
  } catch (error) {
    console.error(`[WindowState] Error saving window state: ${error.message}`);
  }
}

/**
 * Update only the last active section
 * Loads current state, updates section, and saves
 * 
 * @param {string} sectionName - Name of the active section
 */
function saveActiveSection(sectionName) {
  const currentState = restoreWindowState();
  currentState.lastActiveSection = sectionName;
  saveWindowState(currentState);
  console.log(`[WindowState] Updated active section to: ${sectionName}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  saveWindowState,
  saveWindowStateImmediate,
  restoreWindowState,
  getDefaultWindowState,
  saveActiveSection,
  // Export for testing
  getWindowStatePath
};
