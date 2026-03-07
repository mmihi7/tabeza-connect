/**
 * Broadcast Manager
 * 
 * Manages broadcasting of state changes to all registered UI windows via IPC.
 * Handles destroyed windows gracefully and logs all operations for debugging.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Key Responsibilities:
 * - Broadcast state change events to all registered windows
 * - Handle destroyed/closed windows without throwing errors
 * - Log all broadcast operations for debugging
 * - Skip windows that fail to receive broadcasts
 * 
 * Requirements: Design "Key Functions" - BroadcastManager.broadcastStateChange()
 */

// ─────────────────────────────────────────────────────────────────────────────
// BroadcastManager Class
// ─────────────────────────────────────────────────────────────────────────────

class BroadcastManager {
  constructor() {
    // Reference to window registry (will be set via setWindowRegistry)
    this.windowRegistry = null;
    
    console.log('[BroadcastManager] Instance created');
  }
  
  /**
   * Set the window registry reference
   * 
   * This allows BroadcastManager to access registered windows without
   * creating a circular dependency during initialization.
   * 
   * @param {object} windowRegistry - WindowRegistry instance
   */
  setWindowRegistry(windowRegistry) {
    if (!windowRegistry) {
      throw new Error('WindowRegistry cannot be null or undefined');
    }
    
    this.windowRegistry = windowRegistry;
    console.log('[BroadcastManager] Window registry reference set');
  }
  
  /**
   * Calculate diff between old and new state
   * 
   * Compares two state objects and returns only the changed portions.
   * This optimization reduces the payload size and allows UI to update
   * only affected components.
   * 
   * Algorithm:
   * 1. If oldState is null/undefined, return entire newState (initial state)
   * 2. For each key in newState:
   *    a. If key doesn't exist in oldState, include in diff
   *    b. If value is object, recursively calculate diff
   *    c. If value is primitive and different, include in diff
   * 3. Return object containing only changed fields
   * 
   * @param {object} oldState - Previous state object
   * @param {object} newState - New state object
   * @returns {object} Object containing only changed fields
   * @private
   */
  _calculateStateDiff(oldState, newState) {
    // If no old state, entire new state is the diff
    if (!oldState || typeof oldState !== 'object') {
      return newState;
    }
    
    if (!newState || typeof newState !== 'object') {
      return newState;
    }
    
    const diff = {};
    let hasChanges = false;
    
    // Check each key in new state
    for (const key in newState) {
      if (!newState.hasOwnProperty(key)) {
        continue;
      }
      
      const newValue = newState[key];
      const oldValue = oldState[key];
      
      // If key doesn't exist in old state, it's a change
      if (!(key in oldState)) {
        diff[key] = newValue;
        hasChanges = true;
        continue;
      }
      
      // If both values are objects (but not null), recursively diff
      if (
        newValue !== null &&
        oldValue !== null &&
        typeof newValue === 'object' &&
        typeof oldValue === 'object' &&
        !Array.isArray(newValue) &&
        !Array.isArray(oldValue)
      ) {
        const nestedDiff = this._calculateStateDiff(oldValue, newValue);
        
        // Only include if there are nested changes
        if (Object.keys(nestedDiff).length > 0) {
          diff[key] = nestedDiff;
          hasChanges = true;
        }
        continue;
      }
      
      // For primitives, arrays, or null values, compare directly
      if (!this._deepEqual(oldValue, newValue)) {
        diff[key] = newValue;
        hasChanges = true;
      }
    }
    
    return hasChanges ? diff : {};
  }
  
  /**
   * Deep equality check for values
   * 
   * Compares two values for deep equality. Handles primitives, arrays,
   * and objects. Used by diff calculation to determine if values changed.
   * 
   * @param {*} a - First value
   * @param {*} b - Second value
   * @returns {boolean} True if values are deeply equal
   * @private
   */
  _deepEqual(a, b) {
    // Same reference or both null/undefined
    if (a === b) {
      return true;
    }
    
    // One is null/undefined and the other isn't
    if (a == null || b == null) {
      return false;
    }
    
    // Different types
    if (typeof a !== typeof b) {
      return false;
    }
    
    // Primitives (already checked === above)
    if (typeof a !== 'object') {
      return false;
    }
    
    // Arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEqual(a[i], b[i])) {
          return false;
        }
      }
      
      return true;
    }
    
    // One is array, other is not
    if (Array.isArray(a) || Array.isArray(b)) {
      return false;
    }
    
    // Objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) {
      return false;
    }
    
    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }
      
      if (!this._deepEqual(a[key], b[key])) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Broadcast state change to all registered windows
   * 
   * Implements the core broadcast algorithm that sends state change events
   * to all registered windows via IPC. Follows the design specification for
   * BroadcastManager.broadcastStateChange().
   * 
   * Enhanced with selective state diff broadcasting to reduce payload size
   * and improve performance. Only changed portions of state are included
   * in the broadcast event.
   * 
   * Algorithm:
   * 1. Calculate diff between old and new state (if oldState provided)
   * 2. Get all registered windows from window registry
   * 3. Log broadcast start with event type and window count
   * 4. For each window:
   *    a. Check if window is destroyed
   *    b. If destroyed, log warning and unregister window
   *    c. If active, send 'state-changed' IPC event with diff
   *    d. Log success or error for each window
   * 5. Log broadcast completion
   * 
   * Error Handling:
   * - Destroyed windows are skipped and unregistered automatically
   * - IPC send errors are caught and logged, but don't stop other broadcasts
   * - No exceptions are thrown - all errors are logged and handled gracefully
   * 
   * Preconditions:
   * - event contains valid state change information
   * - At least one window is registered (if none, logs warning and returns)
   * - Window registry is set
   * 
   * Postconditions:
   * - All registered windows receive the event via IPC
   * - Windows that are closed/destroyed are skipped without error
   * - Event is logged for debugging
   * - No exceptions thrown if broadcast fails
   * 
   * Loop Invariants:
   * - For each window in registered windows: attempt broadcast, continue on failure
   * 
   * @param {object} event - State change event to broadcast
   * @param {string} event.type - Type of state that changed ('setup' | 'config' | 'printer' | 'template' | 'window')
   * @param {object} event.data - Updated state data
   * @param {object} [event.oldData] - Previous state data (for diff calculation)
   * @param {string} event.timestamp - ISO 8601 timestamp of the change
   * @param {string} event.source - Source of the state change (for debugging)
   * @returns {void}
   */
  broadcastStateChange(event) {
    // Precondition: Validate event parameter
    if (!event || typeof event !== 'object') {
      console.error('[BroadcastManager] Invalid event parameter: must be an object');
      return;
    }
    
    if (!event.type) {
      console.error('[BroadcastManager] Invalid event: missing type field');
      return;
    }
    
    // Precondition: Ensure window registry is set
    if (!this.windowRegistry) {
      console.error('[BroadcastManager] Window registry not set, cannot broadcast');
      return;
    }
    
    // Step 1: Get all registered windows
    const registeredWindows = this.windowRegistry.getAllWindows();
    
    // Precondition: Check if any windows are registered
    if (!registeredWindows || registeredWindows.length === 0) {
      console.warn('[BroadcastManager] No windows registered, skipping broadcast');
      return;
    }
    
    // Step 2: Log broadcast start
    console.log(`[BroadcastManager] Broadcasting state change: ${event.type} to ${registeredWindows.length} window(s)`);
    console.log(`[BroadcastManager] Event source: ${event.source || 'unknown'}`);
    console.log(`[BroadcastManager] Event timestamp: ${event.timestamp || 'not provided'}`);
    
    // Step 1.5: Calculate state diff if oldData is provided
    let broadcastData = event.data;
    let diffSize = 0;
    
    if (event.oldData) {
      const diff = this._calculateStateDiff(event.oldData, event.data);
      diffSize = Object.keys(diff).length;
      
      // Only use diff if it's smaller than full data
      if (diffSize > 0 && diffSize < Object.keys(event.data).length) {
        broadcastData = diff;
        console.log(`[BroadcastManager] Using selective diff: ${diffSize} changed field(s) out of ${Object.keys(event.data).length} total`);
      } else if (diffSize === 0) {
        console.log(`[BroadcastManager] No changes detected, skipping broadcast`);
        return;
      } else {
        console.log(`[BroadcastManager] Using full state (diff not smaller)`);
      }
    }
    
    // Create optimized broadcast event with diff data
    const broadcastEvent = {
      type: event.type,
      data: broadcastData,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source || 'unknown',
      isDiff: !!(event.oldData && diffSize > 0 && diffSize < Object.keys(event.data).length)
    };
    
    // Step 3: Broadcast to each window
    let successCount = 0;
    let errorCount = 0;
    let destroyedCount = 0;
    
    for (const windowInfo of registeredWindows) {
      // Loop Invariant: All previously processed windows have received broadcast or been removed
      
      const { id, window } = windowInfo;
      
      if (!window) {
        console.warn(`[BroadcastManager] Window info missing window reference for ID: ${id}`);
        errorCount++;
        continue;
      }
      
      try {
        // Step 3a: Check if window is destroyed
        if (window.isDestroyed()) {
          console.warn(`[BroadcastManager] Window destroyed, skipping: ${id}`);
          
          // Step 3b: Unregister destroyed window
          this.windowRegistry.unregisterWindow(id);
          destroyedCount++;
          continue;
        }
        
        // Step 3c: Send 'state-changed' IPC event to window
        window.webContents.send('state-changed', broadcastEvent);
        
        // Step 3d: Log success
        console.log(`[BroadcastManager] Broadcast sent successfully to window: ${id}`);
        successCount++;
        
      } catch (error) {
        // Step 3d: Log error and continue to next window
        console.error(`[BroadcastManager] Failed to broadcast to window ${id}: ${error.message}`);
        console.error(`[BroadcastManager] Error stack:`, error.stack);
        errorCount++;
        
        // Postcondition: Errors in individual broadcasts don't stop others
        // Continue to next window
      }
    }
    
    // Step 4: Log broadcast completion with statistics
    console.log(`[BroadcastManager] Broadcast complete - Success: ${successCount}, Errors: ${errorCount}, Destroyed: ${destroyedCount}`);
    
    // Postcondition: All active windows received the event
    // Postcondition: Destroyed windows were removed from registry
    // Postcondition: Event was logged for debugging
    // Postcondition: No exceptions thrown
  }
  
  /**
   * Broadcast full state sync to a specific window
   * 
   * Used when a window gains focus or needs to be synchronized with current state.
   * Sends a 'state-sync' event instead of 'state-changed' to indicate full sync.
   * 
   * @param {string} windowId - ID of the window to sync
   * @param {object} fullState - Complete application state
   * @returns {boolean} True if sync was successful, false otherwise
   */
  syncWindowState(windowId, fullState) {
    if (!windowId) {
      console.error('[BroadcastManager] Invalid windowId parameter');
      return false;
    }
    
    if (!fullState || typeof fullState !== 'object') {
      console.error('[BroadcastManager] Invalid fullState parameter: must be an object');
      return false;
    }
    
    if (!this.windowRegistry) {
      console.error('[BroadcastManager] Window registry not set, cannot sync');
      return false;
    }
    
    console.log(`[BroadcastManager] Syncing full state to window: ${windowId}`);
    
    // Get the specific window
    const windowInfo = this.windowRegistry.getWindow(windowId);
    
    if (!windowInfo) {
      console.warn(`[BroadcastManager] Window not found in registry: ${windowId}`);
      return false;
    }
    
    const { window } = windowInfo;
    
    if (!window) {
      console.error(`[BroadcastManager] Window reference missing for ID: ${windowId}`);
      return false;
    }
    
    try {
      // Check if window is destroyed
      if (window.isDestroyed()) {
        console.warn(`[BroadcastManager] Window destroyed, cannot sync: ${windowId}`);
        this.windowRegistry.unregisterWindow(windowId);
        return false;
      }
      
      // Create sync event
      const syncEvent = {
        type: 'full-sync',
        data: fullState,
        timestamp: new Date().toISOString(),
        source: 'focus-handler'
      };
      
      // Send 'state-sync' IPC event
      window.webContents.send('state-sync', syncEvent);
      
      console.log(`[BroadcastManager] State sync sent successfully to window: ${windowId}`);
      return true;
      
    } catch (error) {
      console.error(`[BroadcastManager] Failed to sync state to window ${windowId}: ${error.message}`);
      console.error(`[BroadcastManager] Error stack:`, error.stack);
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = BroadcastManager;
