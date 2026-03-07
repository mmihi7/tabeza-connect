/**
 * Shared Utilities for Tabeza Connect Management UI
 * 
 * Provides common functionality for:
 * - Notification display (Requirements 16.1-16.7)
 * - Error handling utilities
 * - IPC wrapper functions with error handling
 * - ARIA live region announcements for accessibility (Requirements 18.1-18.6)
 */

// ============================================================================
// NOTIFICATION SYSTEM (Requirements 16.1-16.4)
// ============================================================================

/**
 * Notification types with corresponding styles
 */
const NotificationType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Display a notification to the user
 * @param {string} message - The message to display
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds (default: 5000)
 * @returns {HTMLElement} The notification element
 */
function showNotification(message, type = NotificationType.INFO, duration = 5000) {
  // Ensure notification container exists
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.setAttribute('role', 'alert');
  
  // Icon based on type
  const icon = getNotificationIcon(type);
  
  // Message content
  const messageSpan = document.createElement('span');
  messageSpan.className = 'notification-message';
  messageSpan.textContent = message;
  
  // Close button (Requirement 16.4)
  const closeButton = document.createElement('button');
  closeButton.className = 'notification-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close notification');
  closeButton.onclick = () => dismissNotification(notification);
  
  // Assemble notification
  notification.appendChild(icon);
  notification.appendChild(messageSpan);
  notification.appendChild(closeButton);
  
  // Add to container
  container.appendChild(notification);
  
  // Announce to screen readers (Requirement 18.6)
  announceToScreenReader(message, type === NotificationType.ERROR ? 'assertive' : 'polite');
  
  // Auto-dismiss after duration (Requirement 16.3)
  if (duration > 0) {
    setTimeout(() => {
      dismissNotification(notification);
    }, duration);
  }
  
  return notification;
}

/**
 * Get icon element for notification type
 * @param {string} type - Notification type
 * @returns {HTMLElement} Icon element
 */
function getNotificationIcon(type) {
  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  icon.setAttribute('aria-hidden', 'true');
  
  switch (type) {
    case NotificationType.SUCCESS:
      icon.innerHTML = '✓';
      break;
    case NotificationType.ERROR:
      icon.innerHTML = '✕';
      break;
    case NotificationType.WARNING:
      icon.innerHTML = '⚠';
      break;
    case NotificationType.INFO:
    default:
      icon.innerHTML = 'ℹ';
      break;
  }
  
  return icon;
}

/**
 * Dismiss a notification
 * @param {HTMLElement} notification - The notification element to dismiss
 */
function dismissNotification(notification) {
  if (!notification || !notification.parentNode) return;
  
  notification.classList.add('notification-dismissing');
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300); // Match CSS transition duration
}

/**
 * Show success notification (Requirement 16.1)
 * @param {string} message - Success message
 */
function showSuccess(message) {
  return showNotification(message, NotificationType.SUCCESS);
}

/**
 * Show error notification (Requirement 16.2)
 * @param {string} message - Error message
 * @param {string} suggestedResolution - Optional suggested resolution
 */
function showError(message, suggestedResolution = null) {
  const fullMessage = suggestedResolution 
    ? `${message}. ${suggestedResolution}`
    : message;
  return showNotification(fullMessage, NotificationType.ERROR);
}

/**
 * Show warning notification
 * @param {string} message - Warning message
 */
function showWarning(message) {
  return showNotification(message, NotificationType.WARNING);
}

/**
 * Show info notification
 * @param {string} message - Info message
 */
function showInfo(message) {
  return showNotification(message, NotificationType.INFO);
}

// ============================================================================
// MODAL DIALOGS (Requirement 16.5)
// ============================================================================

/**
 * Show a modal dialog for critical errors
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} onConfirm - Callback when user acknowledges
 */
function showModal(title, message, onConfirm = null) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');
  overlay.setAttribute('aria-describedby', 'modal-message');
  
  // Create modal content
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const modalTitle = document.createElement('h2');
  modalTitle.id = 'modal-title';
  modalTitle.textContent = title;
  
  const modalMessage = document.createElement('p');
  modalMessage.id = 'modal-message';
  modalMessage.textContent = message;
  
  const modalActions = document.createElement('div');
  modalActions.className = 'modal-actions';
  
  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn btn-primary';
  confirmButton.textContent = 'OK';
  confirmButton.onclick = () => {
    document.body.removeChild(overlay);
    if (onConfirm) onConfirm();
  };
  
  modalActions.appendChild(confirmButton);
  modal.appendChild(modalTitle);
  modal.appendChild(modalMessage);
  modal.appendChild(modalActions);
  overlay.appendChild(modal);
  
  document.body.appendChild(overlay);
  
  // Focus the confirm button
  confirmButton.focus();
  
  // Announce to screen readers
  announceToScreenReader(`${title}. ${message}`, 'assertive');
}

/**
 * Show a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Callback when user cancels
 */
function showConfirmDialog(title, message, onConfirm, onCancel = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');
  overlay.setAttribute('aria-describedby', 'modal-message');
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const modalTitle = document.createElement('h2');
  modalTitle.id = 'modal-title';
  modalTitle.textContent = title;
  
  const modalMessage = document.createElement('p');
  modalMessage.id = 'modal-message';
  modalMessage.textContent = message;
  
  const modalActions = document.createElement('div');
  modalActions.className = 'modal-actions';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'btn btn-secondary';
  cancelButton.textContent = 'Cancel';
  cancelButton.onclick = () => {
    document.body.removeChild(overlay);
    if (onCancel) onCancel();
  };
  
  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn btn-primary';
  confirmButton.textContent = 'Confirm';
  confirmButton.onclick = () => {
    document.body.removeChild(overlay);
    if (onConfirm) onConfirm();
  };
  
  modalActions.appendChild(cancelButton);
  modalActions.appendChild(confirmButton);
  modal.appendChild(modalTitle);
  modal.appendChild(modalMessage);
  modal.appendChild(modalActions);
  overlay.appendChild(modal);
  
  document.body.appendChild(overlay);
  
  // Focus the confirm button
  confirmButton.focus();
  
  // Announce to screen readers
  announceToScreenReader(`${title}. ${message}`, 'polite');
}

// ============================================================================
// IPC WRAPPER FUNCTIONS WITH ERROR HANDLING
// ============================================================================

/**
 * Safe IPC invoke wrapper with error handling
 * @param {string} channel - IPC channel name
 * @param {...any} args - Arguments to pass to IPC handler
 * @returns {Promise<any>} Result from IPC handler
 */
async function safeIpcInvoke(channel, ...args) {
  try {
    if (!window.electron || !window.electron.ipcRenderer) {
      throw new Error('IPC not available. Please restart the application.');
    }
    
    const result = await window.electron.ipcRenderer.invoke(channel, ...args);
    return result;
  } catch (error) {
    console.error(`IPC error on channel "${channel}":`, error);
    
    // User-friendly error message (Requirement 16.7)
    const friendlyMessage = getFriendlyErrorMessage(error, channel);
    showError(friendlyMessage, 'Please try again or restart the application.');
    
    throw error;
  }
}

/**
 * Get user-friendly error message (Requirement 16.7)
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 * @returns {string} User-friendly error message
 */
function getFriendlyErrorMessage(error, context = '') {
  const message = error.message || error.toString();
  
  // Map technical errors to user-friendly messages
  const errorMappings = {
    'ENOENT': 'File not found',
    'EACCES': 'Permission denied',
    'EPERM': 'Operation not permitted',
    'ECONNREFUSED': 'Cannot connect to service',
    'ETIMEDOUT': 'Connection timed out',
    'USB001': 'Couldn\'t connect to printer',
    'port unavailable': 'Couldn\'t connect to printer'
  };
  
  for (const [technical, friendly] of Object.entries(errorMappings)) {
    if (message.includes(technical)) {
      return friendly;
    }
  }
  
  // Generic friendly message
  if (context) {
    return `An error occurred while ${context}`;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Retry an async operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<any>} Result from operation
 */
async function retryOperation(operation, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ACCESSIBILITY - ARIA LIVE REGIONS (Requirements 18.1-18.6)
// ============================================================================

/**
 * Announce message to screen readers using ARIA live region
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
function announceToScreenReader(message, priority = 'polite') {
  let liveRegion = document.getElementById('aria-live-region');
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'aria-live-region';
    liveRegion.className = 'sr-only'; // Screen reader only
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }
  
  // Update priority if different
  if (liveRegion.getAttribute('aria-live') !== priority) {
    liveRegion.setAttribute('aria-live', priority);
  }
  
  // Clear and set new message
  liveRegion.textContent = '';
  
  // Use setTimeout to ensure screen reader picks up the change
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 100);
}

/**
 * Announce status change to screen readers (Requirement 18.6)
 * @param {string} status - New status
 * @param {string} context - Context of the status change
 */
function announceStatusChange(status, context = '') {
  const message = context 
    ? `${context} status changed to ${status}`
    : `Status changed to ${status}`;
  
  announceToScreenReader(message, 'polite');
}

// ============================================================================
// LOADING INDICATORS
// ============================================================================

/**
 * Show loading indicator
 * @param {string} message - Loading message
 * @returns {HTMLElement} Loading element
 */
function showLoading(message = 'Loading...') {
  let loadingOverlay = document.getElementById('loading-overlay');
  
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.setAttribute('role', 'status');
    loadingOverlay.setAttribute('aria-live', 'polite');
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'loading-message';
    loadingMessage.className = 'loading-message';
    loadingMessage.textContent = message;
    
    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(loadingMessage);
    document.body.appendChild(loadingOverlay);
  } else {
    document.getElementById('loading-message').textContent = message;
    loadingOverlay.style.display = 'flex';
  }
  
  announceToScreenReader(message, 'polite');
  
  return loadingOverlay;
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debounce function to limit rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit rate of function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Format timestamp to human-readable string
 * @param {Date|string|number} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleString();
  }
}

/**
 * Validate input is not empty
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid
 */
function isNotEmpty(value) {
  return value && value.trim().length > 0;
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export all functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Notification functions
    NotificationType,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissNotification,
    
    // Modal functions
    showModal,
    showConfirmDialog,
    
    // IPC functions
    safeIpcInvoke,
    retryOperation,
    getFriendlyErrorMessage,
    
    // Accessibility functions
    announceToScreenReader,
    announceStatusChange,
    
    // Loading functions
    showLoading,
    hideLoading,
    
    // Utility functions
    debounce,
    throttle,
    formatTimestamp,
    isNotEmpty,
    sanitizeHtml,
    sleep
  };
}

// Export functions globally for browser use
window.NotificationType = NotificationType;
window.showNotification = showNotification;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.dismissNotification = dismissNotification;
window.closeNotification = dismissNotification; // Alias for HTML onclick
window.showModal = showModal;
window.showConfirmDialog = showConfirmDialog;
window.safeIpcInvoke = safeIpcInvoke;
window.retryOperation = retryOperation;
window.getFriendlyErrorMessage = getFriendlyErrorMessage;
window.announceToScreenReader = announceToScreenReader;
window.announceStatusChange = announceStatusChange;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.debounce = debounce;
window.throttle = throttle;
window.formatTimestamp = formatTimestamp;
window.isNotEmpty = isNotEmpty;
window.sanitizeHtml = sanitizeHtml;
window.sleep = sleep;

// Log that shared.js has loaded
console.log('[Shared] Module loaded - Global functions registered:', {
  showNotification: typeof window.showNotification,
  showSuccess: typeof window.showSuccess,
  showError: typeof window.showError,
  announceToScreenReader: typeof window.announceToScreenReader,
  showLoading: typeof window.showLoading
});
