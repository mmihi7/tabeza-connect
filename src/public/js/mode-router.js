/**
 * Mode Router
 * 
 * Determines which UI mode to display based on setup state:
 * - FIRST_RUN: Welcome screen for brand new installations
 * - SETUP_MODE: Setup progress tracker when some steps are incomplete
 * - NORMAL_MODE: Full dashboard when all steps are complete
 * 
 * This module is the entry point for the Management UI and handles
 * mode transitions based on setup completion state.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODE = {
  FIRST_RUN: 'FIRST_RUN',
  SETUP_MODE: 'SETUP_MODE',
  NORMAL_MODE: 'NORMAL_MODE'
};

// ─────────────────────────────────────────────────────────────────────────────
// Mode Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine which UI mode to display based on setup state
 * 
 * Decision logic:
 * 1. If firstRunComplete is false → FIRST_RUN (show welcome screen)
 * 2. If any step is incomplete → SETUP_MODE (show progress tracker)
 * 3. If all steps complete → NORMAL_MODE (show full dashboard)
 * 
 * @returns {Promise<string>} One of MODE.FIRST_RUN, MODE.SETUP_MODE, or MODE.NORMAL_MODE
 */
async function determineMode() {
  try {
    // Get setup state from main process
    const setupState = await window.electronAPI.getSetupState();
    
    if (!setupState) {
      console.error('[ModeRouter] Failed to get setup state, defaulting to FIRST_RUN');
      return MODE.FIRST_RUN;
    }
    
    // Check if this is the first run
    if (!setupState.firstRunComplete) {
      console.log('[ModeRouter] First run detected → FIRST_RUN mode');
      return MODE.FIRST_RUN;
    }
    
    // Check if all steps are complete
    const allStepsComplete = 
      setupState.steps.barId.completed &&
      setupState.steps.printer.completed &&
      setupState.steps.template.completed;
    
    if (!allStepsComplete) {
      console.log('[ModeRouter] Some steps incomplete → SETUP_MODE');
      return MODE.SETUP_MODE;
    }
    
    console.log('[ModeRouter] All steps complete → NORMAL_MODE');
    return MODE.NORMAL_MODE;
    
  } catch (error) {
    console.error('[ModeRouter] Error determining mode:', error);
    // Default to FIRST_RUN on error to ensure user can complete setup
    return MODE.FIRST_RUN;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Rendering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show the appropriate UI mode
 * Hides loading screen and displays the correct mode container
 * 
 * @param {string} mode - One of MODE.FIRST_RUN, MODE.SETUP_MODE, or MODE.NORMAL_MODE
 */
function showMode(mode) {
  // Hide loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  // Get mode containers
  const setupModeContainer = document.getElementById('setup-mode');
  const normalModeContainer = document.getElementById('normal-mode');
  
  if (!setupModeContainer || !normalModeContainer) {
    console.error('[ModeRouter] Mode containers not found in DOM');
    return;
  }
  
  // Hide all modes first
  setupModeContainer.classList.remove('active');
  normalModeContainer.classList.remove('active');
  
  // Show appropriate mode
  switch (mode) {
    case MODE.FIRST_RUN:
      console.log('[ModeRouter] Showing FIRST_RUN (welcome screen)');
      setupModeContainer.classList.add('active');
      showWelcomeScreen();
      break;
      
    case MODE.SETUP_MODE:
      console.log('[ModeRouter] Showing SETUP_MODE (progress tracker)');
      setupModeContainer.classList.add('active');
      showSetupProgress();
      break;
      
    case MODE.NORMAL_MODE:
      console.log('[ModeRouter] Showing NORMAL_MODE (dashboard)');
      normalModeContainer.classList.add('active');
      initializeNormalMode();
      break;
      
    default:
      console.error(`[ModeRouter] Unknown mode: ${mode}`);
      // Default to first run
      setupModeContainer.classList.add('active');
      showWelcomeScreen();
  }
}

/**
 * Show the welcome screen (first run only)
 * Hides progress tracker and step panels
 */
function showWelcomeScreen() {
  const welcomeScreen = document.getElementById('welcome-screen');
  const setupProgress = document.getElementById('setup-progress');
  const stepPanels = document.getElementById('step-panels');
  const setupComplete = document.getElementById('setup-complete');
  
  if (welcomeScreen) welcomeScreen.classList.remove('hidden');
  if (setupProgress) setupProgress.classList.add('hidden');
  if (stepPanels) stepPanels.classList.add('hidden');
  if (setupComplete) setupComplete.classList.add('hidden');
}

/**
 * Show the setup progress tracker
 * Hides welcome screen and displays progress
 */
function showSetupProgress() {
  const welcomeScreen = document.getElementById('welcome-screen');
  const setupProgress = document.getElementById('setup-progress');
  const stepPanels = document.getElementById('step-panels');
  const setupComplete = document.getElementById('setup-complete');
  
  if (welcomeScreen) welcomeScreen.classList.add('hidden');
  if (setupProgress) setupProgress.classList.remove('hidden');
  if (stepPanels) stepPanels.classList.add('hidden');
  if (setupComplete) setupComplete.classList.add('hidden');
  
  // Initialize setup mode UI (defined in setup-mode.js)
  // Call initializeSetupMode which handles auto-detection and progress updates
  if (typeof window.initializeSetupMode === 'function') {
    window.initializeSetupMode();
  } else {
    console.error('[ModeRouter] initializeSetupMode not found - setup-mode.js may not be loaded');
  }
}

/**
 * Initialize normal mode UI
 * Loads the last active section and updates status
 */
function initializeNormalMode() {
  // Initialize normal mode (defined in normal-mode.js)
  // Check if the init function exists before calling
  if (typeof window.initNormalMode === 'function') {
    window.initNormalMode();
  } else {
    console.warn('[ModeRouter] initNormalMode not found in normal-mode.js - using fallback initialization');
    // Fallback: just switch to dashboard section
    if (typeof window.switchSection === 'function') {
      window.switchSection('dashboard');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Transitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transition from FIRST_RUN to SETUP_MODE
 * Called when user clicks "Start Setup" button
 */
async function transitionToSetupMode() {
  console.log('[ModeRouter] Transitioning from FIRST_RUN to SETUP_MODE');
  
  try {
    // Show setup progress immediately
    // Note: firstRunComplete will be set to true automatically when all steps are complete
    showMode(MODE.SETUP_MODE);
    
  } catch (error) {
    console.error('[ModeRouter] Error transitioning to setup mode:', error);
    showNotification('Failed to start setup. Please try again.', 'error');
  }
}

/**
 * Transition from SETUP_MODE to NORMAL_MODE
 * Called when all setup steps are complete
 */
async function transitionToNormalMode() {
  console.log('[ModeRouter] Transitioning from SETUP_MODE to NORMAL_MODE');
  
  try {
    // Verify all steps are actually complete
    const setupState = await window.electronAPI.getSetupState();
    const allComplete = 
      setupState.steps.barId.completed &&
      setupState.steps.printer.completed &&
      setupState.steps.template.completed;
    
    if (!allComplete) {
      console.warn('[ModeRouter] Cannot transition to normal mode - not all steps complete');
      showNotification('Please complete all setup steps first.', 'error');
      return;
    }
    
    // Show normal mode
    showMode(MODE.NORMAL_MODE);
    
  } catch (error) {
    console.error('[ModeRouter] Error transitioning to normal mode:', error);
    showNotification('Failed to load dashboard. Please try again.', 'error');
  }
}

/**
 * Reload the current mode
 * Useful after configuration changes
 */
async function reloadMode() {
  console.log('[ModeRouter] Reloading mode...');
  const mode = await determineMode();
  showMode(mode);
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the mode router
 * Called when the page loads
 */
async function initializeModeRouter() {
  console.log('[ModeRouter] Initializing...');
  
  try {
    // Determine which mode to show
    const mode = await determineMode();
    
    // Show the appropriate UI
    showMode(mode);
    
    console.log('[ModeRouter] Initialization complete');
    
  } catch (error) {
    console.error('[ModeRouter] Initialization error:', error);
    
    // Show error message
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.innerHTML = `
        <div style="text-align: center; color: #ef4444;">
          <h2>Failed to Load</h2>
          <p>Could not initialize Tabeza Connect Management UI.</p>
          <p style="font-size: 14px; color: #666; margin-top: 16px;">
            Error: ${error.message}
          </p>
          <button class="btn" onclick="location.reload()" style="margin-top: 20px;">
            Retry
          </button>
        </div>
      `;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-initialize when DOM is ready
// ─────────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeModeRouter);
} else {
  // DOM is already ready
  initializeModeRouter();
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Functions (called from HTML onclick handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start setup - transition from welcome screen to progress tracker
 * Called by onclick="startSetup()" in HTML
 */
window.startSetup = function() {
  console.log('[ModeRouter] window.startSetup called');
  transitionToSetupMode();
};

/**
 * Go to normal mode - transition from setup complete to dashboard
 * Called by onclick="goToNormalMode()" in HTML
 */
window.goToNormalMode = function() {
  console.log('[ModeRouter] window.goToNormalMode called');
  transitionToNormalMode();
};

/**
 * Reload the current mode
 * Useful for testing and after configuration changes
 */
window.reloadMode = function() {
  console.log('[ModeRouter] window.reloadMode called');
  reloadMode();
};

// Log that mode-router.js has loaded
console.log('[ModeRouter] Module loaded - Global functions registered:', {
  startSetup: typeof window.startSetup,
  goToNormalMode: typeof window.goToNormalMode,
  reloadMode: typeof window.reloadMode
});
