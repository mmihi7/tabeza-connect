/**
 * State Synchronization Helper
 * 
 * Provides helper functions that connect StateManager and BroadcastManager
 * to automatically broadcast state changes after updates.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Key Function:
 * - updateStateAndBroadcast: Updates state and automatically broadcasts to all windows
 * 
 * Requirements: Design "Main Algorithm" - updateStateAndBroadcast
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update state and broadcast changes to all windows
 * 
 * This is the main integration point between StateManager and BroadcastManager.
 * It wraps StateManager.updateState() and automatically broadcasts the changes
 * to all registered windows via BroadcastManager.
 * 
 * Implements the core algorithm from the design specification:
 * 1. Get current state (for diff calculation)
 * 2. Update state via StateManager (validates, persists, updates cache)
 * 3. Create state change event with old and new state
 * 4. Broadcast to all windows via BroadcastManager
 * 5. Return updated state
 * 
 * Algorithm (from Design "Main Algorithm" - updateStateAndBroadcast):
 * ```
 * BEGIN
 *   ASSERT stateType IN ['setup', 'config', 'printer', 'template', 'window']
 *   ASSERT updates IS NOT NULL
 *   
 *   // Step 1: Load current state from memory (for diff)
 *   currentState ← stateManager.getState(stateType)
 *   
 *   // Step 2-5: Update state (merge, validate, persist, update cache)
 *   updatedState ← stateManager.updateState(stateType, updates, source)
 *   
 *   // Step 6: Create state change event with old and new state
 *   event ← {
 *     type: stateType,
 *     data: updatedState,
 *     oldData: currentState,
 *     timestamp: getCurrentTimestamp(),
 *     source: source
 *   }
 *   
 *   // Step 7: Broadcast to all windows
 *   broadcastManager.broadcastStateChange(event)
 *   
 *   RETURN updatedState
 * END
 * ```
 * 
 * Preconditions:
 * - State Manager is initialized
 * - Broadcast Manager is initialized
 * - Window Registry is set in Broadcast Manager
 * - stateType is valid ('setup' | 'config' | 'printer' | 'template' | 'window')
 * - updates object is well-formed
 * 
 * Postconditions:
 * - State is updated in memory and on disk (via StateManager)
 * - All windows are notified via IPC broadcast
 * - Returns updated state object
 * - No data loss occurs during update
 * 
 * Error Handling:
 * - If StateManager.updateState() fails (validation, persistence), error is thrown
 * - If broadcast fails, error is logged but not thrown (state update succeeds)
 * - Broadcast errors don't rollback state changes
 * 
 * @param {object} stateManager - StateManager instance
 * @param {object} broadcastManager - BroadcastManager instance
 * @param {string} stateType - Type of state to update ('setup' | 'config' | 'printer' | 'template' | 'window')
 * @param {object} updates - Partial state updates to apply (deep merged with current state)
 * @param {string} source - Source of the update (for logging and debugging)
 * @returns {object} Complete updated state object
 * @throws {Error} If stateType is invalid
 * @throws {Error} If updates object is null or undefined
 * @throws {Error} If validation fails after merge
 * @throws {Error} If persistence fails (for persistable state types)
 */
function updateStateAndBroadcast(stateManager, broadcastManager, stateType, updates, source = 'unknown') {
  // Precondition: Validate required parameters
  if (!stateManager) {
    const error = new Error('stateManager parameter is required');
    console.error(`[StateSyncHelper] ${error.message}`);
    throw error;
  }
  
  if (!broadcastManager) {
    const error = new Error('broadcastManager parameter is required');
    console.error(`[StateSyncHelper] ${error.message}`);
    throw error;
  }
  
  console.log(`[StateSyncHelper] updateStateAndBroadcast called: ${stateType} from ${source}`);
  
  try {
    // Step 1: Get current state from memory (for diff calculation)
    // This allows BroadcastManager to calculate selective diffs
    const currentState = stateManager.getState(stateType);
    console.log(`[StateSyncHelper] Current ${stateType} state retrieved for diff calculation`);
    
    // Step 2-5: Update state via StateManager
    // StateManager handles:
    // - Validation of stateType and updates
    // - Deep merge of updates with current state
    // - State validation
    // - Persistence to disk (if applicable)
    // - Update in-memory cache
    const updatedState = stateManager.updateState(stateType, updates, source);
    console.log(`[StateSyncHelper] ${stateType} state updated successfully via StateManager`);
    
    // Step 6: Create state change event with old and new state
    // Including oldData allows BroadcastManager to calculate selective diffs
    const event = {
      type: stateType,
      data: updatedState,
      oldData: currentState,
      timestamp: new Date().toISOString(),
      source: source
    };
    
    console.log(`[StateSyncHelper] State change event created for ${stateType}`);
    
    // Step 7: Broadcast to all windows via BroadcastManager
    try {
      broadcastManager.broadcastStateChange(event);
      console.log(`[StateSyncHelper] State change broadcast completed for ${stateType}`);
    } catch (broadcastError) {
      // Log broadcast errors but don't throw - state update succeeded
      // Broadcast failures shouldn't rollback state changes
      console.error(`[StateSyncHelper] Broadcast failed for ${stateType}: ${broadcastError.message}`);
      console.error(`[StateSyncHelper] State update succeeded, but windows may not be notified`);
      // Continue - return updated state even if broadcast failed
    }
    
    // Postcondition: Return complete updated state object
    console.log(`[StateSyncHelper] updateStateAndBroadcast completed successfully for ${stateType}`);
    return updatedState;
    
  } catch (error) {
    // StateManager.updateState() threw an error (validation, persistence, etc.)
    console.error(`[StateSyncHelper] updateStateAndBroadcast failed for ${stateType}: ${error.message}`);
    console.error(`[StateSyncHelper] Stack trace:`, error.stack);
    
    // Re-throw the error - state update failed
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  updateStateAndBroadcast
};
