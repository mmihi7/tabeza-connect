/**
 * State Manager
 * 
 * Centralized state management system with real-time broadcast capabilities.
 * Maintains an in-memory cache of all application state and provides methods
 * to load, update, and persist state across multiple UI windows.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * State Types:
 * - setup: Setup completion state (steps, firstRunComplete)
 * - config: Application configuration (barId, apiUrl, watchFolder, httpPort)
 * - printer: Printer status and configuration
 * - template: Receipt template state
 * - window: Window dimensions and position
 * 
 * Requirements: Design Section "Architecture" - State Manager component
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATE_FILES = {
  setup: 'setup-state.json',
  config: 'config.json',
  printer: 'printer-state.json',
  template: 'template-state.json',
  window: 'window-state.json'
};

const VALID_STATE_TYPES = ['setup', 'config', 'printer', 'template', 'window'];

// ─────────────────────────────────────────────────────────────────────────────
// Default State Structures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get default state for each state type
 * @param {string} stateType - Type of state to get default for
 * @returns {object} Default state object
 */
function getDefaultState(stateType) {
  switch (stateType) {
    case 'setup':
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
    
    case 'config':
      return {
        barId: '',
        apiUrl: 'https://tabeza.co.ke',
        watchFolder: path.join('C:', 'ProgramData', 'Tabeza', 'TabezaPrints'),
        httpPort: 8765
      };
    
    case 'printer':
      return {
        status: 'NotConfigured',
        printerName: null,
        lastChecked: null
      };
    
    case 'template':
      return {
        exists: false,
        path: null,
        version: null,
        posSystem: null,
        lastChecked: null
      };
    
    case 'window':
      return {
        width: 900,
        height: 700,
        x: null,
        y: null,
        lastActiveSection: 'dashboard'
      };
    
    default:
      throw new Error(`Unknown state type: ${stateType}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// StateManager Class
// ─────────────────────────────────────────────────────────────────────────────

class StateManager {
  constructor() {
    // In-memory cache for all state types
    this.cache = {
      setup: null,
      config: null,
      printer: null,
      template: null,
      window: null
    };
    
    // Initialization flag
    this.initialized = false;
    
    console.log('[StateManager] Instance created');
  }
  
  /**
   * Initialize the state manager by loading all state from disk
   * This should be called once on app startup
   * 
   * @returns {object} Complete application state
   */
  initialize() {
    if (this.initialized) {
      console.log('[StateManager] Already initialized, skipping');
      return this.cache;
    }
    
    console.log('[StateManager] Initializing - loading all state from disk');
    
    // Load each state type from disk
    for (const stateType of VALID_STATE_TYPES) {
      try {
        this.cache[stateType] = this._loadStateFromDisk(stateType);
        console.log(`[StateManager] Loaded ${stateType} state successfully`);
      } catch (error) {
        console.error(`[StateManager] Error loading ${stateType} state: ${error.message}`);
        this.cache[stateType] = getDefaultState(stateType);
      }
    }
    
    this.initialized = true;
    console.log('[StateManager] Initialization complete');
    
    return this.cache;
  }
  
  /**
   * Get current state from in-memory cache (no disk I/O)
   * 
   * Implements the state retrieval method with support for both full and partial state access.
   * Follows the design specification for StateManager.getState().
   * 
   * Preconditions:
   * - State Manager is initialized (auto-initializes if not)
   * - If stateType provided, it must be valid
   * 
   * Postconditions:
   * - Returns current state from memory (no disk I/O)
   * - If stateType specified, returns only that portion
   * - If stateType omitted, returns complete state
   * - Never returns null or undefined (returns default state if missing)
   * 
   * @param {string} [stateType] - Optional state type to retrieve ('setup' | 'config' | 'printer' | 'template' | 'window')
   * @returns {object} Complete state or specific state portion
   * @throws {Error} If stateType is provided but invalid
   */
  getState(stateType = null) {
    // Ensure State Manager is initialized
    if (!this.initialized) {
      console.warn('[StateManager] Not initialized, initializing now');
      this.initialize();
    }
    
    // Return specific state type if requested
    if (stateType) {
      // Precondition: Validate state type
      this._validateStateType(stateType);
      
      // Postcondition: Return from cache, or default if not loaded (never null/undefined)
      if (this.cache[stateType] === null) {
        console.warn(`[StateManager] ${stateType} state not in cache, returning default`);
        return getDefaultState(stateType);
      }
      
      // Postcondition: Return only the requested state portion
      return this.cache[stateType];
    }
    
    // Postcondition: Return complete state (shallow copy to prevent external mutation)
    return { ...this.cache };
  }
  
  /**
   * Update state in memory and persist to disk
   * 
   * Implements the core state update algorithm with validation and persistence.
   * Follows the design specification for StateManager.updateState().
   * 
   * Preconditions:
   * - stateType is one of the valid state types
   * - updates object contains valid fields for the specified state type
   * - State Manager is initialized
   * 
   * Postconditions:
   * - State is updated in memory
   * - State is persisted to appropriate JSON file (if applicable)
   * - Returns complete updated state object
   * - No data loss occurs during update
   * 
   * @param {string} stateType - Type of state to update ('setup' | 'config' | 'printer' | 'template' | 'window')
   * @param {object} updates - Partial state updates to apply (deep merged with current state)
   * @param {string} source - Source of the update (for logging and debugging)
   * @returns {object} Complete updated state object
   * @throws {Error} If stateType is invalid
   * @throws {Error} If updates object is null or undefined
   * @throws {Error} If validation fails after merge
   * @throws {Error} If persistence fails (for persistable state types)
   */
  updateState(stateType, updates, source = 'unknown') {
    // Precondition: Validate state type
    this._validateStateType(stateType);
    
    // Precondition: Validate updates parameter
    if (updates === null || updates === undefined) {
      const error = new Error(`Updates parameter cannot be null or undefined for ${stateType}`);
      console.error(`[StateManager] ${error.message}`);
      throw error;
    }
    
    if (typeof updates !== 'object') {
      const error = new Error(`Updates parameter must be an object for ${stateType}`);
      console.error(`[StateManager] ${error.message}`);
      throw error;
    }
    
    // Precondition: Ensure State Manager is initialized
    if (!this.initialized) {
      console.warn('[StateManager] Not initialized, initializing now');
      this.initialize();
    }
    
    console.log(`[StateManager] Updating ${stateType} state from source: ${source}`);
    console.log(`[StateManager] Updates:`, JSON.stringify(updates, null, 2));
    
    // Step 1: Load current state from memory
    const currentState = this.cache[stateType] || getDefaultState(stateType);
    console.log(`[StateManager] Current ${stateType} state:`, JSON.stringify(currentState, null, 2));
    
    // Step 2: Merge updates with current state (deep merge)
    const updatedState = this._deepMerge(currentState, updates);
    console.log(`[StateManager] Merged ${stateType} state:`, JSON.stringify(updatedState, null, 2));
    
    // Step 3: Validate updated state
    if (!this._validateState(stateType, updatedState)) {
      const error = new Error(`Invalid state update for ${stateType}: validation failed`);
      console.error(`[StateManager] ${error.message}`);
      throw error;
    }
    
    console.log(`[StateManager] ${stateType} state validation passed`);
    
    // Step 4: Update in-memory cache
    this.cache[stateType] = updatedState;
    console.log(`[StateManager] ${stateType} state updated in memory cache`);
    
    // Step 5: Persist to disk (if applicable for this state type)
    const filePath = this._getStateFilePath(stateType);
    
    if (filePath !== null) {
      try {
        this._persistStateToDisk(stateType, updatedState);
        console.log(`[StateManager] ${stateType} state persisted to disk successfully`);
      } catch (error) {
        console.error(`[StateManager] Failed to persist ${stateType} state: ${error.message}`);
        console.error(`[StateManager] Stack trace:`, error.stack);
        
        // Rollback in-memory cache on persistence failure
        this.cache[stateType] = currentState;
        console.warn(`[StateManager] Rolled back ${stateType} state in memory due to persistence failure`);
        
        throw error;
      }
    } else {
      console.log(`[StateManager] ${stateType} state is runtime-only, skipping disk persistence`);
    }
    
    // Postcondition: Return complete updated state object
    console.log(`[StateManager] ${stateType} state update complete from source: ${source}`);
    return updatedState;
  }
  
  /**
   * Load state from disk
   * 
   * @param {string} stateType - Type of state to load
   * @returns {object} Loaded state or default state
   * @private
   */
  _loadStateFromDisk(stateType) {
    this._validateStateType(stateType);
    
    // Get file path for this state type
    const filePath = this._getStateFilePath(stateType);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`[StateManager] No ${stateType} state file found at ${filePath}`);
      return getDefaultState(stateType);
    }
    
    try {
      // Read and parse file
      const data = fs.readFileSync(filePath, 'utf8');
      const state = JSON.parse(data);
      
      // Validate structure
      if (!this._validateState(stateType, state)) {
        console.warn(`[StateManager] Invalid ${stateType} state structure, using default`);
        return getDefaultState(stateType);
      }
      
      return state;
      
    } catch (error) {
      console.error(`[StateManager] Error reading ${stateType} state file: ${error.message}`);
      return getDefaultState(stateType);
    }
  }
  
  /**
   * Persist state to disk using atomic write operation
   * 
   * Implements atomic write pattern to prevent corruption:
   * 1. Write to temporary file (.tmp)
   * 2. Rename to final path (atomic operation on Windows)
   * 3. Clean up temp file on error
   * 
   * This ensures state files are never partially written or corrupted,
   * even if the process crashes during write.
   * 
   * Error Handling:
   * - ENOSPC (disk full): Throws descriptive error
   * - Permission errors: Throws with details
   * - Temp file cleanup: Best-effort, ignores cleanup failures
   * 
   * @param {string} stateType - Type of state to persist
   * @param {object} state - State object to persist
   * @throws {Error} If disk is full (ENOSPC)
   * @throws {Error} If write or rename fails
   * @private
   */
  _persistStateToDisk(stateType, state) {
    this._validateStateType(stateType);
    
    const filePath = this._getStateFilePath(stateType);
    
    // Skip persistence for runtime-only state types
    if (filePath === null) {
      console.log(`[StateManager] ${stateType} is runtime-only, skipping persistence`);
      return;
    }
    
    const tempPath = `${filePath}.tmp`;
    
    try {
      // Ensure TabezaPrints directory exists
      const tabezaPrintsPath = path.dirname(filePath);
      if (!fs.existsSync(tabezaPrintsPath)) {
        fs.mkdirSync(tabezaPrintsPath, { recursive: true });
        console.log(`[StateManager] Created TabezaPrints directory: ${tabezaPrintsPath}`);
      }
      
      // Step 1: Write to temporary file
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
      console.log(`[StateManager] Wrote ${stateType} state to temp file: ${tempPath}`);
      
      // Step 2: Rename to final path (atomic operation on Windows)
      fs.renameSync(tempPath, filePath);
      console.log(`[StateManager] Atomically renamed temp file to: ${filePath}`);
      
      console.log(`[StateManager] Successfully persisted ${stateType} state to ${filePath}`);
      
    } catch (error) {
      console.error(`[StateManager] Error persisting ${stateType} state: ${error.message}`);
      console.error(`[StateManager] Error code: ${error.code}`);
      console.error(`[StateManager] Stack trace:`, error.stack);
      
      // Step 3: Clean up temp file if it exists (best-effort)
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
          console.log(`[StateManager] Cleaned up temp file: ${tempPath}`);
        } catch (cleanupError) {
          // Ignore cleanup errors - temp file will be overwritten on next write
          console.warn(`[StateManager] Failed to clean up temp file (non-critical): ${cleanupError.message}`);
        }
      }
      
      // Check for disk full error and provide descriptive message
      if (error.code === 'ENOSPC') {
        const diskFullError = new Error(`Disk full - cannot persist ${stateType} state to ${filePath}`);
        diskFullError.code = 'ENOSPC';
        diskFullError.originalError = error;
        throw diskFullError;
      }
      
      // Check for permission errors
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        const permissionError = new Error(`Permission denied - cannot write ${stateType} state to ${filePath}`);
        permissionError.code = error.code;
        permissionError.originalError = error;
        throw permissionError;
      }
      
      // Re-throw original error for other cases
      throw error;
    }
  }
  
  /**
   * Get file path for a state type
   * 
   * @param {string} stateType - Type of state
   * @returns {string} Full file path
   * @private
   */
  _getStateFilePath(stateType) {
    // Use TabezaPrints directory for all state files
    const fileName = STATE_FILES[stateType];
    if (!fileName) {
      throw new Error(`No file mapping for state type: ${stateType}`);
    }
    
    // Return path in C:\TabezaPrints directory
    return path.join('C:\\TabezaPrints', fileName);
  }
  
  /**
   * Validate state type
   * 
   * @param {string} stateType - Type to validate
   * @throws {Error} If state type is invalid
   * @private
   */
  _validateStateType(stateType) {
    if (!VALID_STATE_TYPES.includes(stateType)) {
      throw new Error(`Invalid state type: ${stateType}. Valid types: ${VALID_STATE_TYPES.join(', ')}`);
    }
  }
  
  /**
   * Validate state structure
   * 
   * Performs comprehensive validation for each state type to ensure data integrity.
   * Validates both structure and value constraints.
   * 
   * @param {string} stateType - Type of state
   * @param {object} state - State object to validate
   * @returns {boolean} True if valid
   * @private
   */
  _validateState(stateType, state) {
    if (typeof state !== 'object' || state === null) {
      console.error(`[StateManager] Validation failed: state is not an object`);
      return false;
    }
    
    // Type-specific validation
    switch (stateType) {
      case 'setup':
        // Validate firstRunComplete
        if (typeof state.firstRunComplete !== 'boolean') {
          console.error(`[StateManager] Validation failed: setup.firstRunComplete must be boolean`);
          return false;
        }
        
        // Validate steps object exists
        if (typeof state.steps !== 'object' || state.steps === null) {
          console.error(`[StateManager] Validation failed: setup.steps must be an object`);
          return false;
        }
        
        // Validate each step has correct structure
        const requiredSteps = ['barId', 'printer', 'template'];
        for (const stepName of requiredSteps) {
          const step = state.steps[stepName];
          if (!step || typeof step !== 'object') {
            console.error(`[StateManager] Validation failed: setup.steps.${stepName} must be an object`);
            return false;
          }
          
          if (typeof step.completed !== 'boolean') {
            console.error(`[StateManager] Validation failed: setup.steps.${stepName}.completed must be boolean`);
            return false;
          }
          
          if (step.completedAt !== null && typeof step.completedAt !== 'string') {
            console.error(`[StateManager] Validation failed: setup.steps.${stepName}.completedAt must be string or null`);
            return false;
          }
          
          // Validate ISO 8601 timestamp format if completedAt is provided
          if (step.completedAt !== null) {
            const timestamp = new Date(step.completedAt);
            if (isNaN(timestamp.getTime())) {
              console.error(`[StateManager] Validation failed: setup.steps.${stepName}.completedAt is not a valid ISO 8601 timestamp`);
              return false;
            }
          }
        }
        
        return true;
      
      case 'config':
        // Validate barId
        if (typeof state.barId !== 'string') {
          console.error(`[StateManager] Validation failed: config.barId must be string`);
          return false;
        }
        
        // Validate apiUrl
        if (typeof state.apiUrl !== 'string') {
          console.error(`[StateManager] Validation failed: config.apiUrl must be string`);
          return false;
        }
        
        // Validate apiUrl format (basic URL validation)
        if (state.apiUrl && !state.apiUrl.match(/^https?:\/\/.+/)) {
          console.error(`[StateManager] Validation failed: config.apiUrl must be a valid URL`);
          return false;
        }
        
        // Validate watchFolder
        if (typeof state.watchFolder !== 'string') {
          console.error(`[StateManager] Validation failed: config.watchFolder must be string`);
          return false;
        }
        
        // Validate httpPort
        if (typeof state.httpPort !== 'number') {
          console.error(`[StateManager] Validation failed: config.httpPort must be number`);
          return false;
        }
        
        // Validate httpPort range (1-65535)
        if (state.httpPort < 1 || state.httpPort > 65535) {
          console.error(`[StateManager] Validation failed: config.httpPort must be between 1 and 65535`);
          return false;
        }
        
        return true;
      
      case 'printer':
        // Validate status
        if (typeof state.status !== 'string') {
          console.error(`[StateManager] Validation failed: printer.status must be string`);
          return false;
        }
        
        const validStatuses = ['NotConfigured', 'PartiallyConfigured', 'FullyConfigured', 'Error'];
        if (!validStatuses.includes(state.status)) {
          console.error(`[StateManager] Validation failed: printer.status must be one of: ${validStatuses.join(', ')}`);
          return false;
        }
        
        // Validate printerName
        if (state.printerName !== null && typeof state.printerName !== 'string') {
          console.error(`[StateManager] Validation failed: printer.printerName must be string or null`);
          return false;
        }
        
        // Validate lastChecked
        if (state.lastChecked !== null && typeof state.lastChecked !== 'string') {
          console.error(`[StateManager] Validation failed: printer.lastChecked must be string or null`);
          return false;
        }
        
        // Validate ISO 8601 timestamp format if lastChecked is provided
        if (state.lastChecked !== null) {
          const timestamp = new Date(state.lastChecked);
          if (isNaN(timestamp.getTime())) {
            console.error(`[StateManager] Validation failed: printer.lastChecked is not a valid ISO 8601 timestamp`);
            return false;
          }
        }
        
        return true;
      
      case 'template':
        // Validate exists
        if (typeof state.exists !== 'boolean') {
          console.error(`[StateManager] Validation failed: template.exists must be boolean`);
          return false;
        }
        
        // Validate path
        if (state.path !== null && typeof state.path !== 'string') {
          console.error(`[StateManager] Validation failed: template.path must be string or null`);
          return false;
        }
        
        // Validate version
        if (state.version !== null && typeof state.version !== 'string') {
          console.error(`[StateManager] Validation failed: template.version must be string or null`);
          return false;
        }
        
        // Validate posSystem
        if (state.posSystem !== null && typeof state.posSystem !== 'string') {
          console.error(`[StateManager] Validation failed: template.posSystem must be string or null`);
          return false;
        }
        
        // Validate lastChecked
        if (state.lastChecked !== null && typeof state.lastChecked !== 'string') {
          console.error(`[StateManager] Validation failed: template.lastChecked must be string or null`);
          return false;
        }
        
        // Validate ISO 8601 timestamp format if lastChecked is provided
        if (state.lastChecked !== null) {
          const timestamp = new Date(state.lastChecked);
          if (isNaN(timestamp.getTime())) {
            console.error(`[StateManager] Validation failed: template.lastChecked is not a valid ISO 8601 timestamp`);
            return false;
          }
        }
        
        return true;
      
      case 'window':
        // Validate width
        if (typeof state.width !== 'number') {
          console.error(`[StateManager] Validation failed: window.width must be number`);
          return false;
        }
        
        // Validate width range (minimum 400, maximum 4000)
        if (state.width < 400 || state.width > 4000) {
          console.error(`[StateManager] Validation failed: window.width must be between 400 and 4000`);
          return false;
        }
        
        // Validate height
        if (typeof state.height !== 'number') {
          console.error(`[StateManager] Validation failed: window.height must be number`);
          return false;
        }
        
        // Validate height range (minimum 300, maximum 3000)
        if (state.height < 300 || state.height > 3000) {
          console.error(`[StateManager] Validation failed: window.height must be between 300 and 3000`);
          return false;
        }
        
        // Validate x position
        if (state.x !== null && typeof state.x !== 'number') {
          console.error(`[StateManager] Validation failed: window.x must be number or null`);
          return false;
        }
        
        // Validate y position
        if (state.y !== null && typeof state.y !== 'number') {
          console.error(`[StateManager] Validation failed: window.y must be number or null`);
          return false;
        }
        
        // Validate lastActiveSection
        if (typeof state.lastActiveSection !== 'string') {
          console.error(`[StateManager] Validation failed: window.lastActiveSection must be string`);
          return false;
        }
        
        return true;
      
      default:
        console.warn(`[StateManager] Unknown state type: ${stateType}, skipping validation`);
        return true;
    }
  }
  
  /**
   * Deep merge two objects
   * 
   * Recursively merges source object into target object, creating a new object.
   * Handles nested objects, arrays, primitives, and null values correctly.
   * 
   * Merge Rules:
   * - Primitives (string, number, boolean): Direct assignment from source
   * - null: Direct assignment from source
   * - Arrays: Direct assignment from source (no element-wise merge)
   * - Objects: Recursive deep merge
   * - undefined: Ignored (target value preserved)
   * 
   * @param {object} target - Target object (base state)
   * @param {object} source - Source object with updates
   * @returns {object} New merged object (does not mutate inputs)
   * @private
   */
  _deepMerge(target, source) {
    // Handle null or undefined inputs
    if (target === null || target === undefined) {
      target = {};
    }
    
    if (source === null || source === undefined) {
      return { ...target };
    }
    
    // Create shallow copy of target as base
    const result = { ...target };
    
    // Iterate over source properties
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        
        // Skip undefined values in source (preserve target value)
        if (sourceValue === undefined) {
          continue;
        }
        
        // Check if both values are objects (and not null or arrays)
        const isSourceObject = typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue);
        const isTargetObject = typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue);
        
        if (isSourceObject && isTargetObject) {
          // Recursively merge nested objects
          result[key] = this._deepMerge(targetValue, sourceValue);
        } else {
          // Direct assignment for:
          // - Primitives (string, number, boolean)
          // - null
          // - Arrays (replace entire array, no element-wise merge)
          // - Objects where target is not an object
          result[key] = sourceValue;
        }
      }
    }
    
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = StateManager;

