/**
 * Setup Mode JavaScript
 * 
 * Handles the setup flow logic for the tray-ui-simplification feature.
 * Manages the three critical setup steps:
 * - Bar ID Configuration
 * - Printer Setup
 * - Receipt Template Generation
 * 
 * This module provides:
 * - Setup progress tracking and UI updates
 * - Step navigation and configuration
 * - Integration with printer and template wizards
 * - Validation and error handling
 * 
 * Requirements: 2.1-2.7, 3.1-3.7, 9.1-9.7, 10.1-10.7
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEP_NAMES = {
  BAR_ID: 'barId',
  PRINTER: 'printer',
  TEMPLATE: 'template'
};

const STEP_ICONS = {
  NOT_STARTED: '⚪',
  IN_PROGRESS: '🟡',
  COMPLETE: '✅'
};

const STEP_STATUS_TEXT = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETE: 'Complete'
};

// ─────────────────────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────────────────────

let currentSetupState = null;
let stateChangedCleanup = null;
let stateSyncCleanup = null;

/**
 * Load current setup state from main process
 * Caches the result to avoid excessive IPC calls
 * 
 * @param {boolean} forceRefresh - Force reload from main process
 * @returns {Promise<object>} Setup state object
 */
async function loadCurrentSetupState(forceRefresh = false) {
  if (!forceRefresh && currentSetupState) {
    return currentSetupState;
  }
  
  try {
    currentSetupState = await window.electronAPI.getSetupState();
    return currentSetupState;
  } catch (error) {
    console.error('[SetupMode] Error loading setup state:', error);
    showNotification('Failed to load setup state', 'error');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup Progress UI Updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the setup progress UI to reflect current state
 * Updates progress bar, step icons, and status text
 * 
 * Requirements: 2.1, 2.2, 2.6
 */
async function updateSetupProgressInternal() {
  console.log('[SetupMode] Updating setup progress...');
  
  try {
    // Load current state
    const state = await loadCurrentSetupState(true);
    if (!state) {
      console.error('[SetupMode] No setup state available');
      return;
    }
    
    // Calculate progress
    const steps = Object.keys(state.steps);
    const completedSteps = steps.filter(stepName => state.steps[stepName].completed);
    const completedCount = completedSteps.length;
    const totalCount = steps.length;
    const progressPercent = (completedCount / totalCount) * 100;
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar) {
      progressBar.style.width = `${progressPercent}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${completedCount}/${totalCount} steps complete`;
    }
    
    // Update each step's UI
    for (const stepName of steps) {
      const stepData = state.steps[stepName];
      updateStepUI(stepName, stepData.completed);
    }
    
    // Check if all steps are complete
    if (completedCount === totalCount) {
      console.log('[SetupMode] All steps complete - showing success screen');
      showSetupCompleteInternal();
    }
    
    console.log(`[SetupMode] Progress updated: ${completedCount}/${totalCount} complete`);
    
  } catch (error) {
    console.error('[SetupMode] Error updating setup progress:', error);
    showNotification('Failed to update progress', 'error');
  }
}

/**
 * Update a single step's visual indicators
 * Updates icon, status text, and card styling
 * 
 * Requirements: 2.3, 2.5
 * 
 * @param {string} stepName - Name of the step to update
 * @param {boolean} completed - Whether the step is complete
 */
function updateStepUI(stepName, completed) {
  const stepElement = document.querySelector(`[data-step="${stepName}"]`);
  if (!stepElement) {
    console.warn(`[SetupMode] Step element not found: ${stepName}`);
    return;
  }
  
  const iconElement = stepElement.querySelector('.step-icon');
  const statusElement = stepElement.querySelector('.step-status');
  
  if (completed) {
    // Step is complete
    iconElement.textContent = STEP_ICONS.COMPLETE;
    statusElement.textContent = STEP_STATUS_TEXT.COMPLETE;
    statusElement.className = 'step-status complete';
    stepElement.classList.add('completed');
    stepElement.classList.remove('in-progress');
  } else {
    // Step is not started
    iconElement.textContent = STEP_ICONS.NOT_STARTED;
    statusElement.textContent = STEP_STATUS_TEXT.NOT_STARTED;
    statusElement.className = 'step-status not-started';
    stepElement.classList.remove('completed', 'in-progress');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Navigation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigate to a specific setup step's configuration panel
 * Hides progress tracker and shows the step's configuration UI
 * 
 * Requirements: 2.7
 * 
 * @param {string} stepName - Name of the step to navigate to
 */
async function goToStepInternal(stepName) {
  console.log(`[SetupMode] goToStep called with: ${stepName}`);
  
  try {
    // Validate step name
    if (!Object.values(STEP_NAMES).includes(stepName)) {
      console.error(`[SetupMode] Invalid step name: ${stepName}`);
      return;
    }
    
    // Hide progress tracker
    const setupProgress = document.getElementById('setup-progress');
    const stepPanels = document.getElementById('step-panels');
    
    if (setupProgress) {
      setupProgress.classList.add('hidden');
      console.log('[SetupMode] Hidden setup-progress');
    } else {
      console.error('[SetupMode] setup-progress element not found');
    }
    
    if (stepPanels) {
      stepPanels.classList.remove('hidden');
      console.log('[SetupMode] Shown step-panels');
    } else {
      console.error('[SetupMode] step-panels element not found');
    }
    
    // Hide all step panels
    const allPanels = document.querySelectorAll('.step-panel');
    console.log(`[SetupMode] Found ${allPanels.length} step panels`);
    allPanels.forEach(panel => panel.classList.remove('active'));
    
    // Show the target step panel
    const targetPanel = document.getElementById(`panel-${stepName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
      console.log(`[SetupMode] Activated panel-${stepName}`);
    } else {
      console.error(`[SetupMode] Panel not found: panel-${stepName}`);
    }
    
    // Load step-specific data
    await loadStepData(stepName);
    
  } catch (error) {
    console.error(`[SetupMode] Error navigating to step ${stepName}:`, error);
    showNotification('Failed to load step configuration', 'error');
  }
}

/**
 * Navigate back to the setup progress tracker
 * Hides step panels and shows progress tracker
 */
function backToProgressInternal() {
  console.log('[SetupMode] Returning to progress tracker');
  
  const setupProgress = document.getElementById('setup-progress');
  const stepPanels = document.getElementById('step-panels');
  
  if (setupProgress) {
    setupProgress.classList.remove('hidden');
  }
  
  if (stepPanels) {
    stepPanels.classList.add('hidden');
  }
  
  // Hide all step panels
  const allPanels = document.querySelectorAll('.step-panel');
  allPanels.forEach(panel => panel.classList.remove('active'));
  
  // Refresh progress display
  updateSetupProgressInternal();
}

/**
 * Load step-specific data into the configuration panel
 * 
 * @param {string} stepName - Name of the step to load data for
 */
async function loadStepData(stepName) {
  try {
    switch (stepName) {
      case STEP_NAMES.BAR_ID:
        await loadBarIdData();
        break;
        
      case STEP_NAMES.PRINTER:
        await loadPrinterData();
        break;
        
      case STEP_NAMES.TEMPLATE:
        await loadTemplateData();
        break;
        
      default:
        console.warn(`[SetupMode] No data loader for step: ${stepName}`);
    }
  } catch (error) {
    console.error(`[SetupMode] Error loading data for step ${stepName}:`, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar ID Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load existing Bar ID configuration
 * Requirements: 3.7
 */
async function loadBarIdData() {
  try {
    const config = await window.electronAPI.getConfig();
    const barIdInput = document.getElementById('input-barId');
    
    if (barIdInput && config && config.barId) {
      barIdInput.value = config.barId;
    }
  } catch (error) {
    console.error('[SetupMode] Error loading Bar ID:', error);
  }
}

/**
 * Save Bar ID configuration
 * Validates input and marks step as complete
 * 
 * Requirements: 3.1-3.7
 */
async function saveBarIdInternal() {
  console.log('[SetupMode] Saving Bar ID...');
  
  try {
    const barIdInput = document.getElementById('input-barId');
    if (!barIdInput) {
      console.error('[SetupMode] Bar ID input not found');
      return;
    }
    
    const barId = barIdInput.value.trim();
    
    // Validate Bar ID (Requirements: 3.3)
    if (!barId || barId.length === 0) {
      showNotification('Please enter a valid Bar ID', 'error');
      barIdInput.focus();
      return;
    }
    
    // Save Bar ID to configuration (Requirements: 3.4)
    const result = await window.electronAPI.saveBarId(barId);
    
    if (!result || !result.success) {
      showNotification('Failed to save Bar ID', 'error');
      return;
    }
    
    // Mark step as complete (Requirements: 3.5)
    await window.electronAPI.markStepComplete(STEP_NAMES.BAR_ID);
    
    // Show success notification
    showNotification('Bar ID saved successfully', 'success');
    
    // Return to progress tracker
    backToProgressInternal();
    
    console.log('[SetupMode] Bar ID saved successfully');
    
  } catch (error) {
    console.error('[SetupMode] Error saving Bar ID:', error);
    showNotification('Failed to save Bar ID', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Printer Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load printer configuration status
 * Requirements: 9.1, 9.4, 9.5
 */
async function loadPrinterData() {
  try {
    const printerStatus = await window.electronAPI.checkPrinterSetup();
    const statusElement = document.getElementById('printer-status-detail');
    
    if (statusElement && printerStatus) {
      if (printerStatus.status === 'FullyConfigured') {
        statusElement.textContent = 'Configured';
        statusElement.className = 'status-value online';
      } else if (printerStatus.status === 'PartiallyConfigured') {
        statusElement.textContent = 'Partially Configured';
        statusElement.className = 'status-value warning';
      } else {
        statusElement.textContent = 'Not Configured';
        statusElement.className = 'status-value warning';
      }
    }
  } catch (error) {
    console.error('[SetupMode] Error loading printer status:', error);
  }
}

/**
 * Launch the printer setup wizard
 * Opens the printer pooling configuration window
 * 
 * Requirements: 9.2, 9.3
 */
async function launchPrinterWizardInternal() {
  console.log('[SetupMode] Launching printer setup wizard...');
  
  try {
    // Launch printer setup wizard via IPC
    const result = await window.electronAPI.launchPrinterSetup();
    
    if (result && result.success) {
      // Mark step as complete (Requirements: 9.6)
      await window.electronAPI.markStepComplete(STEP_NAMES.PRINTER);
      
      showNotification('Printer setup completed successfully', 'success');
      
      // Return to progress tracker
      backToProgressInternal();
    } else {
      // Wizard was cancelled or failed
      console.log('[SetupMode] Printer setup was cancelled or failed');
      showNotification('Printer setup was not completed', 'error');
    }
    
  } catch (error) {
    console.error('[SetupMode] Error launching printer wizard:', error);
    showNotification('Failed to launch printer setup', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load template configuration status
 * Requirements: 10.1, 10.4, 10.5
 */
async function loadTemplateData() {
  try {
    const templateStatus = await window.electronAPI.checkTemplateStatus();
    const statusElement = document.getElementById('template-status-detail');
    
    if (statusElement && templateStatus) {
      if (templateStatus.exists) {
        statusElement.textContent = 'Generated';
        statusElement.className = 'status-value online';
      } else {
        statusElement.textContent = 'Not Generated';
        statusElement.className = 'status-value warning';
      }
    }
  } catch (error) {
    console.error('[SetupMode] Error loading template status:', error);
  }
}

/**
 * Launch the template generator wizard
 * Opens the template generation workflow
 * 
 * Requirements: 10.2, 10.3
 */
async function launchTemplateWizardInternal() {
  console.log('[SetupMode] Launching template generator wizard...');
  
  try {
    // Launch template generator wizard via IPC
    const result = await window.electronAPI.launchTemplateGenerator();
    
    if (result && result.success) {
      // Mark step as complete (Requirements: 10.6)
      await window.electronAPI.markStepComplete(STEP_NAMES.TEMPLATE);
      
      showNotification('Template generated successfully', 'success');
      
      // Return to progress tracker
      backToProgressInternal();
    } else {
      // Wizard was cancelled or failed
      console.log('[SetupMode] Template generation was cancelled or failed');
      showNotification('Template generation was not completed', 'error');
    }
    
  } catch (error) {
    console.error('[SetupMode] Error launching template wizard:', error);
    showNotification('Failed to launch template generator', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup Complete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show the setup complete success screen
 * Hides progress tracker and displays success message
 * 
 * Requirements: 1.7
 */
function showSetupCompleteInternal() {
  console.log('[SetupMode] Showing setup complete screen');
  
  const welcomeScreen = document.getElementById('welcome-screen');
  const setupProgress = document.getElementById('setup-progress');
  const stepPanels = document.getElementById('step-panels');
  const setupComplete = document.getElementById('setup-complete');
  
  if (welcomeScreen) welcomeScreen.classList.add('hidden');
  if (setupProgress) setupProgress.classList.add('hidden');
  if (stepPanels) stepPanels.classList.add('hidden');
  if (setupComplete) setupComplete.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Detection (for existing installations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-detect and mark steps as complete for existing installations
 * Checks existing configuration and marks steps accordingly
 * 
 * Requirements: 3.7, 9.1-9.7, 10.1-10.7
 */
async function autoDetectCompletedSteps() {
  console.log('[SetupMode] Auto-detecting completed steps...');
  
  try {
    // Check Bar ID
    const config = await window.electronAPI.getConfig();
    if (config && config.barId && config.barId.trim().length > 0) {
      console.log('[SetupMode] Bar ID detected, marking as complete');
      await window.electronAPI.markStepComplete(STEP_NAMES.BAR_ID);
    }
    
    // Check Printer Setup
    const printerStatus = await window.electronAPI.checkPrinterSetup();
    if (printerStatus && printerStatus.status === 'FullyConfigured') {
      console.log('[SetupMode] Printer detected, marking as complete');
      await window.electronAPI.markStepComplete(STEP_NAMES.PRINTER);
    }
    
    // Check Template
    const templateStatus = await window.electronAPI.checkTemplateStatus();
    if (templateStatus && templateStatus.exists) {
      console.log('[SetupMode] Template detected, marking as complete');
      await window.electronAPI.markStepComplete(STEP_NAMES.TEMPLATE);
    }
    
    // Refresh UI
    await updateSetupProgressInternal();
    
  } catch (error) {
    console.error('[SetupMode] Error auto-detecting steps:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-Time State Synchronization Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle state-changed events from main process
 * Updates UI components based on state type
 * 
 * Requirements: Design "Example Usage" - All UI windows listen
 * 
 * @param {object} stateChangeEvent - State change event from main process
 */
function handleStateChanged(stateChangeEvent) {
  console.log('[SetupMode] Received state-changed event:', stateChangeEvent);
  
  try {
    const { type, data, timestamp, source } = stateChangeEvent;
    
    // Update cached state
    if (currentSetupState) {
      if (type === 'setup') {
        currentSetupState = { ...currentSetupState, ...data };
      }
    }
    
    // Handle different state types
    switch (type) {
      case 'setup':
        // Setup state changed - update progress tracker
        if (data.steps) {
          console.log('[SetupMode] Setup steps updated:', data.steps);
          updateSetupProgressInternal();
        }
        break;
        
      case 'config':
        // Config state changed - update Bar ID display if visible
        if (data.barId) {
          console.log('[SetupMode] Bar ID updated:', data.barId);
          const barIdInput = document.getElementById('input-barId');
          if (barIdInput && barIdInput.value !== data.barId) {
            barIdInput.value = data.barId;
          }
        }
        break;
        
      case 'printer':
        // Printer state changed - update printer status if visible
        console.log('[SetupMode] Printer state updated:', data);
        const printerPanel = document.getElementById('panel-printer');
        if (printerPanel && printerPanel.classList.contains('active')) {
          loadPrinterData();
        }
        break;
        
      case 'template':
        // Template state changed - update template status if visible
        console.log('[SetupMode] Template state updated:', data);
        const templatePanel = document.getElementById('panel-template');
        if (templatePanel && templatePanel.classList.contains('active')) {
          loadTemplateData();
        }
        break;
        
      default:
        console.log(`[SetupMode] Unhandled state type: ${type}`);
    }
    
  } catch (error) {
    console.error('[SetupMode] Error handling state-changed event:', error);
  }
}

/**
 * Handle state-sync events from main process
 * Replaces entire displayed state with sync payload
 * 
 * Requirements: Design "Property 5" - Focus Sync Guarantee
 * 
 * @param {object} stateSyncEvent - State sync event from main process
 */
function handleStateSync(stateSyncEvent) {
  console.log('[SetupMode] Received state-sync event:', stateSyncEvent);
  
  try {
    const { type, data, timestamp, source } = stateSyncEvent;
    
    // Update cached state with complete state
    if (data.setup) {
      currentSetupState = data.setup;
    }
    
    // Re-render all UI components
    updateSetupProgressInternal();
    
    // Reload current step data if in a step panel
    const activePanel = document.querySelector('.step-panel.active');
    if (activePanel) {
      const stepName = activePanel.id.replace('panel-', '');
      loadStepData(stepName);
    }
    
    console.log('[SetupMode] State synchronized successfully');
    
  } catch (error) {
    console.error('[SetupMode] Error handling state-sync event:', error);
  }
}

/**
 * Register state event listeners
 * Called during initialization
 */
function registerStateEventListeners() {
  console.log('[SetupMode] Registering state event listeners...');
  
  try {
    // Register state-changed listener
    if (window.electronAPI && window.electronAPI.onStateChanged) {
      stateChangedCleanup = window.electronAPI.onStateChanged(handleStateChanged);
      console.log('[SetupMode] state-changed listener registered');
    } else {
      console.warn('[SetupMode] electronAPI.onStateChanged not available');
    }
    
    // Register state-sync listener
    if (window.electronAPI && window.electronAPI.onStateSync) {
      stateSyncCleanup = window.electronAPI.onStateSync(handleStateSync);
      console.log('[SetupMode] state-sync listener registered');
    } else {
      console.warn('[SetupMode] electronAPI.onStateSync not available');
    }
    
  } catch (error) {
    console.error('[SetupMode] Error registering state event listeners:', error);
  }
}

/**
 * Unregister state event listeners
 * Called during cleanup
 */
function unregisterStateEventListeners() {
  console.log('[SetupMode] Unregistering state event listeners...');
  
  try {
    if (stateChangedCleanup) {
      stateChangedCleanup();
      stateChangedCleanup = null;
      console.log('[SetupMode] state-changed listener unregistered');
    }
    
    if (stateSyncCleanup) {
      stateSyncCleanup();
      stateSyncCleanup = null;
      console.log('[SetupMode] state-sync listener unregistered');
    }
    
  } catch (error) {
    console.error('[SetupMode] Error unregistering state event listeners:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize setup mode
 * Called when setup mode UI is displayed
 */
async function initializeSetupModeInternal() {
  console.log('[SetupMode] Initializing...');
  
  try {
    // Register state event listeners
    registerStateEventListeners();
    
    // Auto-detect completed steps for existing installations
    await autoDetectCompletedSteps();
    
    // Update progress display
    await updateSetupProgressInternal();
    
    console.log('[SetupMode] Initialization complete');
    
  } catch (error) {
    console.error('[SetupMode] Initialization error:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Functions (called from HTML onclick handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize setup mode
 * Exposed globally for mode-router.js to call
 */
window.initializeSetupMode = function() {
  return initializeSetupModeInternal();
};

/**
 * Cleanup setup mode
 * Exposed globally for mode-router.js to call
 */
window.cleanupSetupMode = function() {
  console.log('[SetupMode] Cleaning up...');
  unregisterStateEventListeners();
};

/**
 * Navigate to a specific step
 * Called by onclick="goToStep('stepName')" in HTML
 */
window.goToStep = function(stepName) {
  console.log(`[SetupMode] window.goToStep called with: ${stepName}`);
  return goToStepInternal(stepName);
};

/**
 * Return to progress tracker
 * Called by onclick="backToProgress()" in HTML
 */
window.backToProgress = function() {
  console.log('[SetupMode] window.backToProgress called');
  return backToProgressInternal();
};

/**
 * Save Bar ID configuration
 * Called by onclick="saveBarId()" in HTML
 */
window.saveBarId = function() {
  console.log('[SetupMode] window.saveBarId called');
  return saveBarIdInternal();
};

/**
 * Launch printer setup wizard
 * Called by onclick="launchPrinterWizard()" in HTML
 */
window.launchPrinterWizard = function() {
  console.log('[SetupMode] window.launchPrinterWizard called');
  return launchPrinterWizardInternal();
};

/**
 * Launch template generator wizard
 * Called by onclick="launchTemplateWizard()" in HTML
 */
window.launchTemplateWizard = function() {
  console.log('[SetupMode] window.launchTemplateWizard called');
  return launchTemplateWizardInternal();
};

/**
 * Show setup complete screen
 * Called by onclick="showSetupComplete()" in HTML
 */
window.showSetupComplete = function() {
  console.log('[SetupMode] window.showSetupComplete called');
  return showSetupCompleteInternal();
};

/**
 * Update setup progress
 * Exposed for external calls (e.g., from mode-router.js)
 */
window.updateSetupProgress = function() {
  return updateSetupProgressInternal();
};

// Log that setup-mode.js has loaded and functions are available
console.log('[SetupMode] Module loaded - Global functions registered:', {
  initializeSetupMode: typeof window.initializeSetupMode,
  goToStep: typeof window.goToStep,
  backToProgress: typeof window.backToProgress,
  saveBarId: typeof window.saveBarId,
  launchPrinterWizard: typeof window.launchPrinterWizard,
  launchTemplateWizard: typeof window.launchTemplateWizard,
  showSetupComplete: typeof window.showSetupComplete,
  updateSetupProgress: typeof window.updateSetupProgress
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-initialize when setup mode is shown
// ─────────────────────────────────────────────────────────────────────────────

// Note: Initialization is triggered by mode-router.js when setup mode is displayed
// This ensures setup mode is only initialized when actually needed

