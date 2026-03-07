/**
 * What's New Manager
 * 
 * Manages the "What's New" dialog that appears after upgrades.
 * Shows users information about new features (like single-click tray behavior)
 * and allows them to dismiss it permanently.
 * 
 * State is persisted to app.getPath('userData')/whats-new-state.json
 * 
 * Requirements: 17.6
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WHATS_NEW_STATE_FILENAME = 'whats-new-state.json';
const CURRENT_VERSION = '1.7.10'; // Should match APP_VERSION in electron-main.js

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the path to the what's new state file
 * @returns {string} Full path to whats-new-state.json
 */
function getWhatsNewStatePath() {
  return path.join(app.getPath('userData'), WHATS_NEW_STATE_FILENAME);
}

/**
 * Get the default what's new state structure
 * @returns {object} Default state
 */
function getDefaultWhatsNewState() {
  return {
    lastSeenVersion: null,
    dontShowAgain: false,
    dismissedVersions: []
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load what's new state from disk
 * Handles file corruption gracefully by returning default state
 * 
 * @returns {object} What's new state object
 */
function loadWhatsNewState() {
  const statePath = getWhatsNewStatePath();
  
  try {
    // Check if file exists
    if (!fs.existsSync(statePath)) {
      console.log('[WhatsNew] No state file found, using default state');
      return getDefaultWhatsNewState();
    }
    
    // Read and parse file
    const data = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(data);
    
    console.log('[WhatsNew] Loaded state successfully');
    return state;
    
  } catch (error) {
    console.error(`[WhatsNew] Error loading state: ${error.message}`);
    console.error('[WhatsNew] Returning default state');
    return getDefaultWhatsNewState();
  }
}

/**
 * Save what's new state to disk
 * 
 * @param {object} state - What's new state object to save
 * @returns {boolean} True if save succeeded, false otherwise
 */
function saveWhatsNewState(state) {
  const statePath = getWhatsNewStatePath();
  
  try {
    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Write state to file
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    console.log('[WhatsNew] Saved state successfully');
    return true;
    
  } catch (error) {
    console.error(`[WhatsNew] Error saving state: ${error.message}`);
    return false;
  }
}

/**
 * Check if the "What's New" dialog should be shown
 * 
 * Returns true if:
 * - User hasn't checked "Don't show again"
 * - Current version is different from last seen version
 * - Current version hasn't been dismissed before
 * 
 * @returns {boolean} True if dialog should be shown
 */
function shouldShowWhatsNew() {
  const state = loadWhatsNewState();
  
  // If user checked "Don't show again", never show
  if (state.dontShowAgain) {
    console.log('[WhatsNew] User opted out, not showing dialog');
    return false;
  }
  
  // If this version was already dismissed, don't show
  if (state.dismissedVersions && state.dismissedVersions.includes(CURRENT_VERSION)) {
    console.log(`[WhatsNew] Version ${CURRENT_VERSION} already dismissed, not showing dialog`);
    return false;
  }
  
  // If last seen version is different from current, show dialog
  if (state.lastSeenVersion !== CURRENT_VERSION) {
    console.log(`[WhatsNew] Version changed from ${state.lastSeenVersion} to ${CURRENT_VERSION}, showing dialog`);
    return true;
  }
  
  console.log('[WhatsNew] No changes detected, not showing dialog');
  return false;
}

/**
 * Mark the current version as seen
 * Updates lastSeenVersion to current version
 * 
 * @param {boolean} dontShowAgain - If true, user opted out of future dialogs
 * @returns {object} Updated state
 */
function markVersionSeen(dontShowAgain = false) {
  const state = loadWhatsNewState();
  
  // Update last seen version
  state.lastSeenVersion = CURRENT_VERSION;
  
  // Add to dismissed versions if not already there
  if (!state.dismissedVersions) {
    state.dismissedVersions = [];
  }
  if (!state.dismissedVersions.includes(CURRENT_VERSION)) {
    state.dismissedVersions.push(CURRENT_VERSION);
  }
  
  // Update don't show again preference
  if (dontShowAgain) {
    state.dontShowAgain = true;
    console.log('[WhatsNew] User opted out of future dialogs');
  }
  
  // Save updated state
  saveWhatsNewState(state);
  
  console.log(`[WhatsNew] Marked version ${CURRENT_VERSION} as seen`);
  return state;
}

/**
 * Reset what's new state (for testing/debugging)
 * 
 * @returns {object} Default state
 */
function resetWhatsNewState() {
  const defaultState = getDefaultWhatsNewState();
  saveWhatsNewState(defaultState);
  console.log('[WhatsNew] Reset state to default');
  return defaultState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  loadWhatsNewState,
  saveWhatsNewState,
  shouldShowWhatsNew,
  markVersionSeen,
  resetWhatsNewState,
  // Export for testing
  getWhatsNewStatePath,
  getDefaultWhatsNewState
};
