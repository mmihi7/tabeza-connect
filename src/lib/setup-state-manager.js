/**
 * Setup State Manager
 * 
 * Manages the setup completion state for the tray-ui-simplification feature.
 * Tracks which of the three critical setup steps are complete:
 * - Bar ID Configuration
 * - Printer Setup
 * - Receipt Template Generation
 * 
 * State is persisted to app.getPath('userData')/setup-state.json
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SETUP_STATE_FILENAME = 'setup-state.json';

// Valid step names
const VALID_STEPS = ['barId', 'printer', 'template'];

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Cache (Performance Optimization - Requirement 19.1-19.5)
// ─────────────────────────────────────────────────────────────────────────────

let cachedState = null;
let cacheTimestamp = null;
const CACHE_TTL = 5000; // Cache for 5 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the path to the setup state file
 * @returns {string} Full path to setup-state.json
 */
function getSetupStatePath() {
  return path.join(app.getPath('userData'), SETUP_STATE_FILENAME);
}

/**
 * Get the default setup state structure
 * @returns {object} Default state with all steps incomplete
 */
function getDefaultSetupState() {
  return {
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
}

/**
 * Validate step name
 * @param {string} stepName - Name of the step to validate
 * @throws {Error} If step name is invalid
 */
function validateStepName(stepName) {
  if (!VALID_STEPS.includes(stepName)) {
    throw new Error(`Invalid step name: ${stepName}. Valid steps are: ${VALID_STEPS.join(', ')}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load setup state from disk
 * Handles file corruption gracefully by returning default state
 * Uses in-memory cache to reduce disk I/O (Performance Optimization)
 * 
 * @returns {object} Setup state object
 */
function loadSetupState() {
  // Check if we have a valid cached state
  if (cachedState && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    console.log('[SetupState] Returning cached state');
    return cachedState;
  }
  
  const statePath = getSetupStatePath();
  
  try {
    // Check if file exists
    if (!fs.existsSync(statePath)) {
      console.log('[SetupState] No setup state file found, using default state');
      const defaultState = getDefaultSetupState();
      // Cache the default state
      cachedState = defaultState;
      cacheTimestamp = Date.now();
      return defaultState;
    }
    
    // Read and parse file
    const data = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(data);
    
    // Validate structure
    if (!state.steps || typeof state.steps !== 'object') {
      console.warn('[SetupState] Invalid state structure, using default state');
      const defaultState = getDefaultSetupState();
      cachedState = defaultState;
      cacheTimestamp = Date.now();
      return defaultState;
    }
    
    // Ensure all required steps exist
    const defaultState = getDefaultSetupState();
    for (const stepName of VALID_STEPS) {
      if (!state.steps[stepName]) {
        console.warn(`[SetupState] Missing step ${stepName}, adding default`);
        state.steps[stepName] = defaultState.steps[stepName];
      }
    }
    
    console.log('[SetupState] Loaded setup state successfully');
    
    // Cache the loaded state
    cachedState = state;
    cacheTimestamp = Date.now();
    
    return state;
    
  } catch (error) {
    console.error(`[SetupState] Error loading setup state: ${error.message}`);
    console.error('[SetupState] Returning default state');
    const defaultState = getDefaultSetupState();
    cachedState = defaultState;
    cacheTimestamp = Date.now();
    return defaultState;
  }
}

/**
 * Save setup state to disk
 * Invalidates cache after saving
 * 
 * @param {object} state - Setup state object to save
 * @returns {boolean} True if save succeeded, false otherwise
 */
function saveSetupState(state) {
  const statePath = getSetupStatePath();
  
  try {
    // Ensure userData directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Write state to file
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    console.log('[SetupState] Saved setup state successfully');
    
    // Update cache with new state
    cachedState = state;
    cacheTimestamp = Date.now();
    
    return true;
    
  } catch (error) {
    console.error(`[SetupState] Error saving setup state: ${error.message}`);
    return false;
  }
}

/**
 * Check if all setup steps are complete
 * 
 * @returns {boolean} True if all three steps are complete
 */
function isSetupComplete() {
  const state = loadSetupState();
  
  const allComplete = VALID_STEPS.every(stepName => {
    return state.steps[stepName] && state.steps[stepName].completed === true;
  });
  
  return allComplete;
}

/**
 * Mark a specific step as complete
 * Updates the step's completed flag and completedAt timestamp
 * If all steps become complete, sets firstRunComplete to true
 * 
 * @param {string} stepName - Name of the step ('barId', 'printer', or 'template')
 * @returns {object} Updated setup state
 * @throws {Error} If step name is invalid
 */
function markStepComplete(stepName) {
  validateStepName(stepName);
  
  const state = loadSetupState();
  
  // Mark step as complete
  state.steps[stepName].completed = true;
  state.steps[stepName].completedAt = new Date().toISOString();
  
  // Check if all steps are now complete
  const allComplete = VALID_STEPS.every(step => state.steps[step].completed);
  
  if (allComplete) {
    state.firstRunComplete = true;
    console.log('[SetupState] All steps complete - marking first run as complete');
  }
  
  // Save updated state
  saveSetupState(state);
  
  console.log(`[SetupState] Marked step '${stepName}' as complete`);
  return state;
}

/**
 * Get setup progress information
 * 
 * @returns {object} Progress object with completed count, total, and step details
 */
function getSetupProgress() {
  const state = loadSetupState();
  
  const completedSteps = VALID_STEPS.filter(stepName => {
    return state.steps[stepName] && state.steps[stepName].completed === true;
  });
  
  return {
    completed: completedSteps.length,
    total: VALID_STEPS.length,
    steps: state.steps,
    firstRunComplete: state.firstRunComplete
  };
}

/**
 * Reset setup state to default (for testing/debugging)
 * 
 * @returns {object} Default setup state
 */
function resetSetupState() {
  const defaultState = getDefaultSetupState();
  saveSetupState(defaultState);
  console.log('[SetupState] Reset setup state to default');
  return defaultState;
}

/**
 * Invalidate the in-memory cache
 * Forces next loadSetupState() to read from disk
 * 
 * @returns {void}
 */
function invalidateCache() {
  cachedState = null;
  cacheTimestamp = null;
  console.log('[SetupState] Cache invalidated');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  loadSetupState,
  saveSetupState,
  isSetupComplete,
  markStepComplete,
  getSetupProgress,
  resetSetupState,
  invalidateCache,
  // Export for testing
  getSetupStatePath,
  getDefaultSetupState
};
