/**
 * Template Generation Wizard - Client-side Logic
 * 
 * Implements the 3-step real-time receipt capture workflow:
 * 1. Prompt user to print receipt 1 → detect and show "✓ Receipt 1 received"
 * 2. Prompt user to print receipt 2 → detect and show "✓ Receipt 2 received"
 * 3. Prompt user to print receipt 3 → detect and show "✓ Receipt 3 received"
 * 4. Send all 3 to cloud AI → generate template → save locally
 * 5. Show success message
 * 
 * @module template-wizard
 */

// State management
const state = {
  currentStep: 1,
  receipts: [],
  capturedReceipts: [],
  timers: {},
  pollingInterval: null,
  lastReceiptCount: 0,
};

/**
 * Initialize the wizard
 */
function init() {
  console.log('[Template Wizard] Initializing...');
  
  // Start polling for new receipts
  startPolling();
  
  // Start timer for current step
  startTimer(1);
  
  // Check if template already exists
  checkExistingTemplate();
}

/**
 * Check if a template already exists
 */
async function checkExistingTemplate() {
  try {
    const response = await fetch('/api/template/status');
    const data = await response.json();
    
    if (data.exists && data.version !== 'malformed') {
      showAlert(
        `A template already exists (version ${data.version}). You can generate a new one to replace it.`,
        'warning'
      );
    }
  } catch (error) {
    console.error('[Template Wizard] Failed to check existing template:', error);
  }
}

/**
 * Start polling for new receipts
 */
function startPolling() {
  console.log('[Template Wizard] Starting receipt polling...');
  
  // Poll every 2 seconds
  state.pollingInterval = setInterval(async () => {
    await checkForNewReceipts();
  }, 2000);
}

/**
 * Stop polling for receipts
 */
function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
    console.log('[Template Wizard] Stopped receipt polling');
  }
}

/**
 * Check for new receipts in the queue
 */
async function checkForNewReceipts() {
  try {
    const response = await fetch('/api/receipts/recent');
    const data = await response.json();
    
    if (!data.receipts || !Array.isArray(data.receipts)) {
      return;
    }
    
    // Filter receipts captured during this wizard session
    // (only receipts newer than when wizard started)
    const newReceipts = data.receipts.filter(receipt => {
      const receiptTime = new Date(receipt.timestamp).getTime();
      const wizardStartTime = state.wizardStartTime || Date.now();
      return receiptTime >= wizardStartTime;
    });
    
    // Check if we have a new receipt
    if (newReceipts.length > state.capturedReceipts.length) {
      const latestReceipt = newReceipts[0];
      onReceiptCaptured(latestReceipt);
    }
  } catch (error) {
    console.error('[Template Wizard] Failed to check for receipts:', error);
  }
}

/**
 * Handle a newly captured receipt
 * @param {Object} receipt - Receipt data
 */
function onReceiptCaptured(receipt) {
  const step = state.currentStep;
  
  if (step > 3) {
    return; // Already past receipt capture steps
  }
  
  console.log(`[Template Wizard] Receipt ${step} captured:`, receipt);
  
  // Add to captured receipts
  state.capturedReceipts.push(receipt);
  state.receipts.push(receipt.receipt.rawText);
  
  // Update UI
  showReceiptReceived(step);
  
  // Stop timer for this step
  stopTimer(step);
  
  // Move to next step after a short delay
  setTimeout(() => {
    if (step < 3) {
      goToStep(step + 1);
    } else {
      // All receipts captured, move to generate step
      goToStep(4);
    }
  }, 1500);
}

/**
 * Show receipt received status
 * @param {number} step - Step number (1-3)
 */
function showReceiptReceived(step) {
  const statusEl = document.getElementById(`receipt${step}Status`);
  const circleEl = document.getElementById(`step${step}Circle`);
  
  if (statusEl) {
    statusEl.className = 'receipt-status received';
    statusEl.innerHTML = `
      <div class="receipt-icon">✅</div>
      <h3>Receipt ${step} received!</h3>
      <p>Moving to next step...</p>
    `;
  }
  
  if (circleEl) {
    circleEl.className = 'step-circle complete';
    circleEl.textContent = '✓';
  }
  
  // Update progress bar
  updateProgressBar();
}

/**
 * Go to a specific step
 * @param {number} step - Step number (1-5)
 */
function goToStep(step) {
  console.log(`[Template Wizard] Moving to step ${step}`);
  
  // Hide all steps
  document.querySelectorAll('.step-content').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show target step
  const stepEl = document.getElementById(`step${step}`);
  if (stepEl) {
    stepEl.classList.add('active');
  }
  
  // Update step circles
  for (let i = 1; i <= 4; i++) {
    const circleEl = document.getElementById(`step${i}Circle`);
    if (circleEl) {
      if (i < step) {
        circleEl.className = 'step-circle complete';
        if (i <= 3) circleEl.textContent = '✓';
      } else if (i === step) {
        circleEl.className = 'step-circle active';
      } else {
        circleEl.className = 'step-circle';
      }
    }
  }
  
  // Update state
  state.currentStep = step;
  
  // Start timer if on receipt capture step
  if (step >= 1 && step <= 3) {
    startTimer(step);
  }
  
  // Update progress bar
  updateProgressBar();
  
  // If on generate step, enable the button
  if (step === 4) {
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.disabled = false;
    }
  }
}

/**
 * Update progress bar fill
 */
function updateProgressBar() {
  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    const progress = (state.capturedReceipts.length / 3) * 75; // 75% for 3 receipts, 100% for complete
    progressFill.style.width = `${progress}%`;
  }
}

/**
 * Start timer for a step
 * @param {number} step - Step number
 */
function startTimer(step) {
  const timerEl = document.getElementById(`receipt${step}Timer`);
  if (!timerEl) return;
  
  let seconds = 0;
  state.timers[step] = setInterval(() => {
    seconds++;
    timerEl.textContent = `${seconds}s`;
  }, 1000);
}

/**
 * Stop timer for a step
 * @param {number} step - Step number
 */
function stopTimer(step) {
  if (state.timers[step]) {
    clearInterval(state.timers[step]);
    delete state.timers[step];
  }
}

/**
 * Generate template from captured receipts
 */
async function generateTemplate() {
  console.log('[Template Wizard] Generating template...');
  
  const generateBtn = document.getElementById('generateBtn');
  const generateStatus = document.getElementById('generateStatus');
  
  // Disable button
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  }
  
  // Update status
  if (generateStatus) {
    generateStatus.innerHTML = `
      <div class="loading-spinner"></div>
      <h3>Generating template...</h3>
      <p>Analyzing your receipts with AI (this may take 30-60 seconds)</p>
    `;
  }
  
  try {
    // Validate we have 3 receipts
    if (state.receipts.length !== 3) {
      throw new Error(`Expected 3 receipts, but have ${state.receipts.length}`);
    }
    
    // Send to cloud API
    const response = await fetch('/api/template/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receipts: state.receipts,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to generate template');
    }
    
    if (!result.success) {
      throw new Error(result.message || 'Template generation failed');
    }
    
    console.log('[Template Wizard] Template generated successfully:', result);
    
    // Show success
    showSuccess(result.template);
    
  } catch (error) {
    console.error('[Template Wizard] Template generation failed:', error);
    
    // Show error
    showAlert(
      `Failed to generate template: ${error.message}. Please try again or contact support.`,
      'error'
    );
    
    // Re-enable button
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Retry Generation';
    }
    
    // Update status
    if (generateStatus) {
      generateStatus.innerHTML = `
        <div class="receipt-icon">❌</div>
        <h3>Generation failed</h3>
        <p>${error.message}</p>
      `;
    }
  }
}

/**
 * Show success screen
 * @param {Object} template - Generated template metadata
 */
function showSuccess(template) {
  console.log('[Template Wizard] Showing success screen');
  
  // Stop polling
  stopPolling();
  
  // Update progress bar to 100%
  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    progressFill.style.width = '100%';
  }
  
  // Mark final step as complete
  const step4Circle = document.getElementById('step4Circle');
  if (step4Circle) {
    step4Circle.className = 'step-circle complete';
  }
  
  // Show success step
  goToStep(5);
  
  // Load and display template
  loadTemplatePreview();
  
  // Show success alert
  showAlert(
    'Template created successfully! All future receipts will be parsed automatically.',
    'success'
  );
}

/**
 * Load and display template preview
 */
async function loadTemplatePreview() {
  try {
    const response = await fetch('/api/template/status');
    const data = await response.json();
    
    const previewEl = document.getElementById('templatePreview');
    if (previewEl && data.exists) {
      previewEl.innerHTML = `
        <pre>${JSON.stringify({
          version: data.version,
          posSystem: data.posSystem,
          patterns: data.patterns,
        }, null, 2)}</pre>
      `;
    }
  } catch (error) {
    console.error('[Template Wizard] Failed to load template preview:', error);
  }
}

/**
 * Restart the wizard
 */
function restartWizard() {
  console.log('[Template Wizard] Restarting wizard...');
  
  // Reset state
  state.currentStep = 1;
  state.receipts = [];
  state.capturedReceipts = [];
  state.wizardStartTime = Date.now();
  
  // Clear all timers
  Object.keys(state.timers).forEach(step => {
    stopTimer(parseInt(step));
  });
  
  // Restart polling
  stopPolling();
  startPolling();
  
  // Go to step 1
  goToStep(1);
  
  // Reset progress bar
  const progressFill = document.getElementById('progressFill');
  if (progressFill) {
    progressFill.style.width = '0%';
  }
  
  // Reset step circles
  for (let i = 1; i <= 4; i++) {
    const circleEl = document.getElementById(`step${i}Circle`);
    if (circleEl) {
      circleEl.className = i === 1 ? 'step-circle active' : 'step-circle';
      if (i <= 3) {
        circleEl.textContent = i.toString();
      } else {
        circleEl.textContent = '✓';
      }
    }
  }
  
  // Reset receipt status displays
  for (let i = 1; i <= 3; i++) {
    const statusEl = document.getElementById(`receipt${i}Status`);
    if (statusEl) {
      statusEl.className = 'receipt-status waiting';
      statusEl.innerHTML = `
        <div class="receipt-icon">🖨️</div>
        <h3>Waiting for receipt...</h3>
        <p>Print a receipt from your POS now</p>
        <div class="receipt-counter" id="receipt${i}Timer">0s</div>
      `;
    }
  }
  
  // Hide alert
  hideAlert();
}

/**
 * Show alert message
 * @param {string} message - Alert message
 * @param {string} type - Alert type (success, error, warning)
 */
function showAlert(message, type = 'success') {
  const alertEl = document.getElementById('alert');
  if (alertEl) {
    alertEl.textContent = message;
    alertEl.className = `alert ${type} show`;
    
    // Auto-hide after 5 seconds for success/warning
    if (type !== 'error') {
      setTimeout(() => {
        hideAlert();
      }, 5000);
    }
  }
}

/**
 * Hide alert message
 */
function hideAlert() {
  const alertEl = document.getElementById('alert');
  if (alertEl) {
    alertEl.className = 'alert';
  }
}

// Initialize wizard when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Set wizard start time
  state.wizardStartTime = Date.now();
  
  // Initialize
  init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopPolling();
  Object.keys(state.timers).forEach(step => {
    stopTimer(parseInt(step));
  });
});
