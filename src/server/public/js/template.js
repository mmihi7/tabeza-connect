/**
 * Tabeza Connect Template Generator
 * Manages the 3-step guided workflow for template generation
 */

// State management
let currentStep = 1;
let capturedReceipts = [];
let pollingInterval = null;
let lastReceiptCount = 0;

// DOM elements
const elements = {
  modal: null,
  generateBtn: null,
  displayStatus: null,
  displayVersion: null,
  displayPosSystem: null,
  progressCircles: [],
  stepContents: [],
  receiptStatuses: [],
  loadingState: null,
  successState: null,
  errorState: null,
  errorMessage: null,
  closeSuccessBtn: null,
  retryBtn: null,
  cancelBtn: null
};

/**
 * Initialize template generator on page load
 */
function init() {
  // Cache DOM elements
  elements.modal = document.getElementById('template-modal');
  elements.generateBtn = document.getElementById('generate-btn');
  elements.displayStatus = document.getElementById('display-status');
  elements.displayVersion = document.getElementById('display-version');
  elements.displayPosSystem = document.getElementById('display-pos-system');
  
  elements.progressCircles = [
    document.getElementById('progress-1'),
    document.getElementById('progress-2'),
    document.getElementById('progress-3')
  ];
  
  elements.stepContents = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3')
  ];
  
  elements.receiptStatuses = [
    document.getElementById('receipt-1-status'),
    document.getElementById('receipt-2-status'),
    document.getElementById('receipt-3-status')
  ];
  
  elements.loadingState = document.getElementById('loading-state');
  elements.successState = document.getElementById('success-state');
  elements.errorState = document.getElementById('error-state');
  elements.errorMessage = document.getElementById('error-message');
  
  elements.closeSuccessBtn = document.getElementById('close-success-btn');
  elements.retryBtn = document.getElementById('retry-btn');
  elements.cancelBtn = document.getElementById('cancel-btn');

  // Attach event listeners
  elements.generateBtn.addEventListener('click', startTemplateGeneration);
  elements.closeSuccessBtn.addEventListener('click', closeModal);
  elements.retryBtn.addEventListener('click', retryGeneration);
  elements.cancelBtn.addEventListener('click', closeModal);

  // Load initial template status
  fetchTemplateStatus();
}

/**
 * Fetch current template status
 */
async function fetchTemplateStatus() {
  try {
    const response = await fetch('/api/template/status');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    updateTemplateDisplay(data);
    
    // Auto-open modal if template doesn't exist
    if (!data.exists) {
      setTimeout(() => {
        openModal();
      }, 500);
    }
  } catch (error) {
    console.error('Failed to fetch template status:', error);
    elements.displayStatus.textContent = 'Error loading status';
    elements.displayStatus.className = 'template-info-value text-error';
  }
}

/**
 * Update template display with fetched data
 */
function updateTemplateDisplay(data) {
  if (data.exists) {
    elements.displayStatus.textContent = '✓ Template exists';
    elements.displayStatus.className = 'template-info-value text-success';
    elements.displayVersion.textContent = data.version || 'Unknown';
    elements.displayPosSystem.textContent = data.posSystem || 'Unknown';
    elements.generateBtn.textContent = 'Regenerate Template';
  } else {
    elements.displayStatus.textContent = '✗ Template missing';
    elements.displayStatus.className = 'template-info-value text-warning';
    elements.displayVersion.textContent = 'N/A';
    elements.displayPosSystem.textContent = 'N/A';
    elements.generateBtn.textContent = 'Generate New Template';
  }
}

/**
 * Start template generation workflow
 */
function startTemplateGeneration() {
  resetWorkflow();
  openModal();
  startPolling();
}

/**
 * Reset workflow to initial state
 */
function resetWorkflow() {
  currentStep = 1;
  capturedReceipts = [];
  lastReceiptCount = 0;
  
  // Reset progress circles
  elements.progressCircles.forEach((circle, index) => {
    circle.className = 'progress-circle';
    if (index === 0) {
      circle.classList.add('active');
    }
  });
  
  // Reset step contents
  elements.stepContents.forEach((content, index) => {
    content.classList.remove('active');
    if (index === 0) {
      content.classList.add('active');
    }
  });
  
  // Reset receipt statuses
  elements.receiptStatuses.forEach((status) => {
    status.classList.remove('captured');
    const stateText = status.querySelector('.receipt-state');
    stateText.textContent = 'Waiting for receipt...';
    stateText.className = 'receipt-state';
  });
  
  // Hide loading, success, and error states
  elements.loadingState.classList.remove('active');
  elements.successState.classList.remove('active');
  elements.errorState.classList.remove('active');
}

/**
 * Open modal
 */
function openModal() {
  elements.modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Close modal
 */
function closeModal() {
  elements.modal.classList.remove('active');
  document.body.style.overflow = '';
  stopPolling();
  
  // Refresh template status
  fetchTemplateStatus();
}

/**
 * Start polling for new receipts
 */
function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Poll every 2 seconds
  pollingInterval = setInterval(checkForNewReceipts, 2000);
  
  // Initial check
  checkForNewReceipts();
}

/**
 * Stop polling
 */
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Check for new receipts
 */
async function checkForNewReceipts() {
  try {
    const response = await fetch('/api/receipts/recent');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if we have new receipts
    if (data.receipts && data.receipts.length > lastReceiptCount) {
      const newReceipts = data.receipts.slice(lastReceiptCount);
      
      for (const receipt of newReceipts) {
        handleNewReceipt(receipt);
      }
      
      lastReceiptCount = data.receipts.length;
    }
  } catch (error) {
    console.error('Failed to check for new receipts:', error);
  }
}

/**
 * Handle a newly captured receipt
 */
function handleNewReceipt(receipt) {
  // Only capture receipts during the workflow
  if (currentStep > 3) {
    return;
  }
  
  // Add to captured receipts
  capturedReceipts.push(receipt);
  
  // Update UI for current step
  const receiptIndex = currentStep - 1;
  const statusElement = elements.receiptStatuses[receiptIndex];
  const stateText = statusElement.querySelector('.receipt-state');
  
  statusElement.classList.add('captured');
  stateText.textContent = `✓ Receipt ${currentStep} received`;
  stateText.className = 'receipt-state captured';
  
  // Mark progress circle as completed
  elements.progressCircles[receiptIndex].classList.remove('active');
  elements.progressCircles[receiptIndex].classList.add('completed');
  
  // Advance to next step
  setTimeout(() => {
    advanceStep();
  }, 1000);
}

/**
 * Advance to next step
 */
function advanceStep() {
  if (currentStep < 3) {
    // Move to next step
    currentStep++;
    
    // Update step content
    elements.stepContents.forEach((content, index) => {
      content.classList.remove('active');
      if (index === currentStep - 1) {
        content.classList.add('active');
      }
    });
    
    // Update progress circle
    elements.progressCircles[currentStep - 1].classList.add('active');
  } else if (currentStep === 3 && capturedReceipts.length === 3) {
    // All receipts captured, generate template
    currentStep++;
    generateTemplate();
  }
}

/**
 * Generate template from captured receipts
 */
async function generateTemplate() {
  // Stop polling
  stopPolling();
  
  // Show loading state
  elements.stepContents.forEach(content => content.classList.remove('active'));
  elements.loadingState.classList.add('active');
  
  try {
    const response = await fetch('/api/template/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receipts: capturedReceipts
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      showSuccess();
    } else {
      showError(data.message || 'Template generation failed');
    }
  } catch (error) {
    console.error('Failed to generate template:', error);
    showError(error.message || 'Network error occurred');
  }
}

/**
 * Show success state
 */
function showSuccess() {
  elements.loadingState.classList.remove('active');
  elements.successState.classList.add('active');
}

/**
 * Show error state
 */
function showError(message) {
  elements.loadingState.classList.remove('active');
  elements.errorState.classList.add('active');
  elements.errorMessage.textContent = message;
}

/**
 * Retry generation
 */
function retryGeneration() {
  resetWorkflow();
  startPolling();
}

/**
 * Cleanup on page unload
 */
function cleanup() {
  stopPolling();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
