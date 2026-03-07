/**
 * Window Registry
 * 
 * Maintains a registry of all active BrowserWindows in the application.
 * Provides methods to register, unregister, and retrieve windows for
 * state synchronization and IPC broadcasting.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Key Responsibilities:
 * - Register windows with unique IDs
 * - Unregister windows when closed
 * - Provide access to all registered windows
 * - Automatically clean up destroyed windows
 * - Send initial state snapshot to newly registered windows
 * 
 * Requirements: Design "Key Functions" - WindowRegistry.registerWindow()
 */

// ─────────────────────────────────────────────────────────────────────────────
// WindowRegistry Class
// ─────────────────────────────────────────────────────────────────────────────

class WindowRegistry {
  constructor(stateManager = null) {
      // Map of windowId -> { id, window, registeredAt }
      this.windows = new Map();

      // Reference to StateManager for initial state sync
      // Can be set later via setStateManager() if not provided in constructor
      this.stateManager = stateManager;

      console.log('[WindowRegistry] Instance created');
    }

  
  /**
   * Register a window in the registry
   * 
   * Implements window registration with automatic cleanup on window close.
   * Follows the design specification for WindowRegistry.registerWindow().
   * 
   * Algorithm:
   * 1. Validate parameters (windowId and window)
   * 2. Check for duplicate registration
   * 3. Add window to registry with metadata
   * 4. Set up automatic cleanup on 'closed' event
   * 5. Send initial state snapshot to newly registered window (if StateManager available)
   * 6. Log registration
   * 
   * Preconditions:
   * - windowId is unique string identifier
   * - window is valid BrowserWindow instance
   * - Window is not already registered
   * 
   * Postconditions:
   * - Window is added to registry
   * - Window receives initial state snapshot via 'state-sync' IPC event (if StateManager available)
   * - Window is automatically unregistered on 'closed' event
   * - Registry size increases by 1
   * 
   * @param {string} windowId - Unique identifier for the window
   * @param {BrowserWindow} window - Electron BrowserWindow instance
   * @throws {Error} If windowId is invalid
   * @throws {Error} If window is invalid
   * @throws {Error} If window is already registered
   */
  registerWindow(windowId, window) {
    // Precondition: Validate windowId parameter
    if (!windowId || typeof windowId !== 'string') {
      const error = new Error('windowId must be a non-empty string');
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    // Precondition: Validate window parameter
    if (!window || typeof window !== 'object') {
      const error = new Error('window must be a valid BrowserWindow instance');
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    // Check if window has required methods (basic validation)
    if (typeof window.isDestroyed !== 'function' || typeof window.on !== 'function') {
      const error = new Error('window must be a valid BrowserWindow with isDestroyed() and on() methods');
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    // Precondition: Check for duplicate registration
    if (this.windows.has(windowId)) {
      const error = new Error(`Window already registered with ID: ${windowId}`);
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    // Check if window is already destroyed
    if (window.isDestroyed()) {
      const error = new Error(`Cannot register destroyed window: ${windowId}`);
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    console.log(`[WindowRegistry] Registering window: ${windowId}`);
    
    // Step 1: Add window to registry with metadata
    const windowInfo = {
      id: windowId,
      window: window,
      registeredAt: new Date().toISOString()
    };
    
    this.windows.set(windowId, windowInfo);
    
    // Postcondition: Registry size increased by 1
    console.log(`[WindowRegistry] Window registered successfully: ${windowId} (total: ${this.windows.size})`);
    
    // Step 2: Set up automatic cleanup on 'closed' event
    window.on('closed', () => {
      console.log(`[WindowRegistry] Window closed event received: ${windowId}`);
      this.unregisterWindow(windowId);
    });
    
    console.log(`[WindowRegistry] Automatic cleanup listener attached for window: ${windowId}`);
    
    // Step 3: Send initial state snapshot to newly registered window
    // Requirements: Design "Example Usage" - Window registration pattern
    if (this.stateManager) {
      try {
        console.log(`[WindowRegistry] Sending initial state sync to window: ${windowId}`);
        
        // Get complete current state from StateManager
        const currentState = this.stateManager.getState();
        
        // Create state sync event with full state snapshot
        const syncEvent = {
          type: 'initial-sync',
          data: currentState,
          timestamp: new Date().toISOString(),
          source: 'window-registry'
        };
        
        // Send 'state-sync' IPC event to newly registered window
        // Use webContents.send for one-way communication
        if (window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send('state-sync', syncEvent);
          console.log(`[WindowRegistry] Initial state sync sent successfully to window: ${windowId}`);
        } else {
          console.warn(`[WindowRegistry] Cannot send state sync - webContents unavailable for window: ${windowId}`);
        }
      } catch (error) {
        // Log error but don't throw - window registration should succeed even if sync fails
        console.error(`[WindowRegistry] Failed to send initial state sync to window ${windowId}:`, error.message);
      }
    } else {
      console.log(`[WindowRegistry] No StateManager available - skipping initial state sync for window: ${windowId}`);
    }
    
    // Postcondition: Window receives initial state snapshot (if StateManager available)
    // Postcondition: Window is automatically unregistered on 'closed' event
  }
  
  /**
   * Unregister a window from the registry
   * 
   * Removes a window from the registry. Safe to call multiple times with
   * the same windowId (idempotent operation).
   * 
   * Algorithm:
   * 1. Validate windowId parameter
   * 2. Check if window exists in registry
   * 3. Remove window from registry
   * 4. Log unregistration
   * 
   * Preconditions:
   * - windowId is a string
   * 
   * Postconditions:
   * - Window is removed from registry (if it existed)
   * - Registry size decreases by 1 (if window existed)
   * - Safe to call multiple times (idempotent)
   * 
   * @param {string} windowId - ID of the window to unregister
   * @returns {boolean} True if window was unregistered, false if not found
   */
  unregisterWindow(windowId) {
    // Precondition: Validate windowId parameter
    if (!windowId || typeof windowId !== 'string') {
      console.warn('[WindowRegistry] Invalid windowId parameter for unregister');
      return false;
    }
    
    // Step 1: Check if window exists in registry
    if (!this.windows.has(windowId)) {
      console.log(`[WindowRegistry] Window not found in registry (already unregistered?): ${windowId}`);
      return false;
    }
    
    console.log(`[WindowRegistry] Unregistering window: ${windowId}`);
    
    // Step 2: Remove window from registry
    const deleted = this.windows.delete(windowId);
    
    if (deleted) {
      // Postcondition: Registry size decreased by 1
      console.log(`[WindowRegistry] Window unregistered successfully: ${windowId} (remaining: ${this.windows.size})`);
      return true;
    } else {
      console.warn(`[WindowRegistry] Failed to delete window from registry: ${windowId}`);
      return false;
    }
  }
  
  /**
   * Get all registered windows
   * 
   * Returns an array of all registered window information objects.
   * Each object contains { id, window, registeredAt }.
   * 
   * Automatically filters out destroyed windows and removes them from registry.
   * 
   * Algorithm:
   * 1. Iterate through all registered windows
   * 2. Check if each window is destroyed
   * 3. If destroyed, unregister it
   * 4. If active, include in result array
   * 5. Return array of active windows
   * 
   * Preconditions:
   * - None (always safe to call)
   * 
   * Postconditions:
   * - Returns array of active window info objects
   * - Destroyed windows are automatically removed from registry
   * - Returns empty array if no windows registered
   * 
   * @returns {Array<{id: string, window: BrowserWindow, registeredAt: string}>} Array of window info objects
   */
  getAllWindows() {
    console.log(`[WindowRegistry] Getting all windows (total registered: ${this.windows.size})`);
    
    const activeWindows = [];
    const destroyedWindowIds = [];
    
    // Step 1: Iterate through all registered windows
    for (const [windowId, windowInfo] of this.windows.entries()) {
      const { window } = windowInfo;
      
      // Step 2: Check if window is destroyed
      if (!window || window.isDestroyed()) {
        console.warn(`[WindowRegistry] Found destroyed window during getAllWindows: ${windowId}`);
        destroyedWindowIds.push(windowId);
        continue;
      }
      
      // Step 3: Include active window in result
      activeWindows.push(windowInfo);
    }
    
    // Step 4: Clean up destroyed windows
    for (const windowId of destroyedWindowIds) {
      console.log(`[WindowRegistry] Auto-cleaning destroyed window: ${windowId}`);
      this.unregisterWindow(windowId);
    }
    
    console.log(`[WindowRegistry] Returning ${activeWindows.length} active window(s)`);
    
    // Postcondition: Returns array of active windows
    // Postcondition: Destroyed windows removed from registry
    return activeWindows;
  }
  
  /**
   * Get a specific window by ID
   * 
   * Returns the window information object for a specific window ID.
   * Returns null if window not found or is destroyed.
   * 
   * @param {string} windowId - ID of the window to retrieve
   * @returns {{id: string, window: BrowserWindow, registeredAt: string}|null} Window info or null
   */
  getWindow(windowId) {
    // Validate windowId parameter
    if (!windowId || typeof windowId !== 'string') {
      console.warn('[WindowRegistry] Invalid windowId parameter for getWindow');
      return null;
    }
    
    // Check if window exists in registry
    if (!this.windows.has(windowId)) {
      console.log(`[WindowRegistry] Window not found: ${windowId}`);
      return null;
    }
    
    const windowInfo = this.windows.get(windowId);
    const { window } = windowInfo;
    
    // Check if window is destroyed
    if (!window || window.isDestroyed()) {
      console.warn(`[WindowRegistry] Window is destroyed: ${windowId}`);
      this.unregisterWindow(windowId);
      return null;
    }
    
    return windowInfo;
  }
  
  /**
   * Check if a window is registered
   * 
   * @param {string} windowId - ID of the window to check
   * @returns {boolean} True if window is registered and active
   */
  hasWindow(windowId) {
    if (!windowId || typeof windowId !== 'string') {
      return false;
    }
    
    if (!this.windows.has(windowId)) {
      return false;
    }
    
    const windowInfo = this.windows.get(windowId);
    const { window } = windowInfo;
    
    // Check if window is destroyed
    if (!window || window.isDestroyed()) {
      this.unregisterWindow(windowId);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the count of registered windows
   * 
   * @returns {number} Number of registered windows
   */
  getWindowCount() {
    // Clean up destroyed windows first
    this.getAllWindows();
    
    return this.windows.size;
  }
  
  /**
   * Clear all registered windows
   * 
   * Removes all windows from the registry. Useful for testing or shutdown.
   * 
   * @returns {number} Number of windows that were cleared
   */
  clearAll() {
    const count = this.windows.size;
    console.log(`[WindowRegistry] Clearing all ${count} registered window(s)`);
    
    this.windows.clear();
    
    console.log('[WindowRegistry] All windows cleared');
    return count;
  }
  
  /**
   * Set the StateManager reference
   * 
   * Allows setting the StateManager after WindowRegistry construction.
   * This is useful when StateManager and WindowRegistry have circular dependencies
   * or when StateManager is initialized after WindowRegistry.
   * 
   * Once set, newly registered windows will receive initial state snapshots.
   * 
   * @param {StateManager} stateManager - StateManager instance
   * @throws {Error} If stateManager is invalid
   */
  setStateManager(stateManager) {
    // Validate stateManager parameter
    if (!stateManager || typeof stateManager !== 'object') {
      const error = new Error('stateManager must be a valid StateManager instance');
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    // Check if stateManager has required getState method
    if (typeof stateManager.getState !== 'function') {
      const error = new Error('stateManager must have a getState() method');
      console.error(`[WindowRegistry] ${error.message}`);
      throw error;
    }
    
    console.log('[WindowRegistry] Setting StateManager reference');
    this.stateManager = stateManager;
    console.log('[WindowRegistry] StateManager reference set successfully');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = WindowRegistry;
