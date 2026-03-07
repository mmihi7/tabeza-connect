# State Synchronization Usage Examples

This document provides examples of how to use the `updateStateAndBroadcast` helper function to update application state and automatically broadcast changes to all windows.

## Overview

The `updateStateAndBroadcast` function is the main integration point between StateManager and BroadcastManager. It:

1. Updates state via StateManager (validates, persists to disk, updates cache)
2. Automatically broadcasts the changes to all registered windows
3. Returns the updated state

## Basic Usage

```javascript
const { updateStateAndBroadcast } = require('./lib/state-sync-helper');

// Update config state and broadcast to all windows
const updatedConfig = updateStateAndBroadcast(
  stateManager,
  broadcastManager,
  'config',
  { barId: 'bar-123' },
  'setup-window'
);
```

## Example 1: Updating Bar ID from Setup Window

```javascript
// In IPC handler for save-bar-id
ipcMain.handle('save-bar-id', async (event, barId) => {
  try {
    // Update config state with new Bar ID
    const updatedConfig = updateStateAndBroadcast(
      stateManager,
      broadcastManager,
      'config',
      { barId: barId },
      'setup-window'
    );
    
    // Mark setup step as complete
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
      'setup-window'
    );
    
    // All windows automatically receive 'state-changed' events
    // No manual broadcast needed!
    
    return { success: true };
    
  } catch (error) {
    console.error('Failed to save Bar ID:', error.message);
    return { success: false, error: error.message };
  }
});
```

## Example 2: Updating Printer Status

```javascript
// After printer setup completes
async function onPrinterSetupComplete(printerName) {
  try {
    // Update printer state
    const updatedPrinter = updateStateAndBroadcast(
      stateManager,
      broadcastManager,
      'printer',
      {
        status: 'FullyConfigured',
        printerName: printerName,
        lastChecked: new Date().toISOString()
      },
      'printer-wizard'
    );
    
    // Mark setup step as complete
    const updatedSetup = updateStateAndBroadcast(
      stateManager,
      broadcastManager,
      'setup',
      {
        steps: {
          printer: {
            completed: true,
            completedAt: new Date().toISOString()
          }
        }
      },
      'printer-wizard'
    );
    
    // All windows now show updated printer status
    
  } catch (error) {
    console.error('Failed to update printer status:', error.message);
  }
}
```

## Example 3: Updating Template Status

```javascript
// After template generation completes
async function onTemplateGenerated(templatePath, version, posSystem) {
  try {
    // Update template state
    const updatedTemplate = updateStateAndBroadcast(
      stateManager,
      broadcastManager,
      'template',
      {
        exists: true,
        path: templatePath,
        version: version,
        posSystem: posSystem,
        lastChecked: new Date().toISOString()
      },
      'template-generator'
    );
    
    // Mark setup step as complete
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
      'template-generator'
    );
    
    // All windows now show template is configured
    
  } catch (error) {
    console.error('Failed to update template status:', error.message);
  }
}
```

## Example 4: Updating Window State

```javascript
// When window is resized or moved
function onWindowBoundsChanged(bounds) {
  try {
    updateStateAndBroadcast(
      stateManager,
      broadcastManager,
      'window',
      {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      },
      'window-manager'
    );
    
    // All windows receive updated window state
    
  } catch (error) {
    console.error('Failed to update window state:', error.message);
  }
}
```

## Example 5: Marking Setup Complete

```javascript
// When all setup steps are complete
async function markSetupComplete() {
  try {
    const updatedSetup = updateStateAndBroadcast(
      stateManager,
      broadcastManager,
      'setup',
      {
        firstRunComplete: true
      },
      'setup-wizard'
    );
    
    // All windows receive notification that setup is complete
    // UI can transition from Setup Mode to Normal Mode
    
    return updatedSetup;
    
  } catch (error) {
    console.error('Failed to mark setup complete:', error.message);
    throw error;
  }
}
```

## Error Handling

The function throws errors if:
- State validation fails
- Disk persistence fails (for persistable state types)
- StateManager or BroadcastManager parameters are missing

Broadcast errors are logged but don't throw - state update succeeds even if broadcast fails.

```javascript
try {
  const updatedState = updateStateAndBroadcast(
    stateManager,
    broadcastManager,
    'config',
    { barId: 'bar-123' },
    'my-source'
  );
  
  console.log('State updated successfully:', updatedState);
  
} catch (error) {
  if (error.code === 'ENOSPC') {
    console.error('Disk full - cannot save state');
  } else if (error.code === 'EACCES') {
    console.error('Permission denied - cannot write state file');
  } else {
    console.error('State update failed:', error.message);
  }
}
```

## Receiving State Changes in Renderer Processes

All UI windows automatically receive `state-changed` events:

```javascript
// In renderer process (HTML/JavaScript)
const { ipcRenderer } = require('electron');

// Listen for state changes
ipcRenderer.on('state-changed', (event, stateChange) => {
  console.log('State changed:', stateChange.type);
  console.log('New data:', stateChange.data);
  console.log('Source:', stateChange.source);
  console.log('Timestamp:', stateChange.timestamp);
  
  // Update UI based on state type
  if (stateChange.type === 'config') {
    updateBarIdDisplay(stateChange.data.barId);
  }
  
  if (stateChange.type === 'setup') {
    updateProgressTracker(stateChange.data.steps);
  }
  
  if (stateChange.type === 'printer') {
    updatePrinterStatus(stateChange.data.status);
  }
  
  if (stateChange.type === 'template') {
    updateTemplateStatus(stateChange.data.exists);
  }
});

// Listen for full state sync (on window focus)
ipcRenderer.on('state-sync', (event, syncEvent) => {
  console.log('Full state sync received');
  console.log('Complete state:', syncEvent.data);
  
  // Re-render entire UI with current state
  renderUI(syncEvent.data);
});
```

## Best Practices

1. **Always use updateStateAndBroadcast instead of calling StateManager.updateState directly**
   - This ensures all windows stay synchronized
   - Broadcast happens automatically

2. **Provide meaningful source identifiers**
   - Use descriptive source names like 'setup-window', 'printer-wizard', 'template-generator'
   - This helps with debugging and logging

3. **Handle errors appropriately**
   - Wrap calls in try-catch blocks
   - Show user-friendly error messages
   - Log errors for debugging

4. **Use partial updates**
   - Only include fields that changed
   - Deep merge handles nested updates automatically

5. **Don't worry about broadcast failures**
   - State update succeeds even if broadcast fails
   - Windows will sync on next focus event

## Migration from Old Code

If you have existing code that updates state directly:

```javascript
// OLD CODE (don't use)
const updatedState = stateManager.updateState('config', { barId: 'bar-123' }, 'source');
// Windows are NOT notified!

// NEW CODE (use this)
const updatedState = updateStateAndBroadcast(
  stateManager,
  broadcastManager,
  'config',
  { barId: 'bar-123' },
  'source'
);
// Windows are automatically notified!
```

## Testing

When testing, you can mock the managers:

```javascript
const mockStateManager = {
  getState: jest.fn(() => ({ barId: '' })),
  updateState: jest.fn((type, updates) => ({ barId: updates.barId }))
};

const mockBroadcastManager = {
  broadcastStateChange: jest.fn()
};

const result = updateStateAndBroadcast(
  mockStateManager,
  mockBroadcastManager,
  'config',
  { barId: 'test-bar' },
  'test'
);

expect(mockStateManager.updateState).toHaveBeenCalledWith(
  'config',
  { barId: 'test-bar' },
  'test'
);

expect(mockBroadcastManager.broadcastStateChange).toHaveBeenCalled();
```

## See Also

- [State Manager Documentation](./state-manager.md)
- [Broadcast Manager Documentation](./broadcast-manager.md)
- [Window Registry Documentation](./window-registry.md)
- [Design Document](../.kiro/specs/real-time-state-sync/design.md)
