/**
 * Tabeza Connect Dashboard
 * Manages real-time status display and auto-refresh
 */

// State management
let refreshInterval = null;
let countdownInterval = null;
let countdownSeconds = 5;

// DOM elements
const elements = {
  statusIndicator: null,
  statusText: null,
  jobCount: null,
  lastActivity: null,
  barId: null,
  apiUrl: null,
  watchFolder: null,
  templateStatus: null,
  templateVersion: null,
  refreshCountdown: null
};

/**
 * Initialize dashboard on page load
 */
function init() {
  // Cache DOM elements
  elements.statusIndicator = document.getElementById('status-indicator');
  elements.statusText = document.getElementById('status-text');
  elements.jobCount = document.getElementById('job-count');
  elements.lastActivity = document.getElementById('last-activity');
  elements.barId = document.getElementById('bar-id');
  elements.apiUrl = document.getElementById('api-url');
  elements.watchFolder = document.getElementById('watch-folder');
  elements.templateStatus = document.getElementById('template-status');
  elements.templateVersion = document.getElementById('template-version');
  elements.refreshCountdown = document.getElementById('refresh-countdown');

  // Initial data fetch
  fetchStatus();

  // Start auto-refresh (every 5 seconds)
  startAutoRefresh();

  // Start countdown timer
  startCountdown();
}

/**
 * Fetch status from API
 */
async function fetchStatus() {
  try {
    const response = await fetch('/api/status');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    console.error('Failed to fetch status:', error);
    showError();
  }
}

/**
 * Update dashboard with fetched data
 */
function updateDashboard(data) {
  // Update service status indicator
  if (data.status === 'online') {
    elements.statusIndicator.className = 'status-indicator status-green';
    elements.statusText.textContent = 'Online';
    elements.statusText.className = 'status-text text-success';
  } else {
    elements.statusIndicator.className = 'status-indicator status-grey';
    elements.statusText.textContent = 'Offline';
    elements.statusText.className = 'status-text text-muted';
  }

  // Update job count
  elements.jobCount.textContent = data.jobCount !== undefined ? data.jobCount : '-';

  // Update last activity
  if (data.lastActivity) {
    const activityDate = new Date(data.lastActivity);
    elements.lastActivity.textContent = formatDateTime(activityDate);
  } else {
    elements.lastActivity.textContent = 'No activity yet';
  }

  // Update Bar ID
  elements.barId.textContent = data.barId || 'Not configured';

  // Update API URL
  elements.apiUrl.textContent = data.apiUrl || '-';

  // Update watch folder
  elements.watchFolder.textContent = data.watchFolder || '-';

  // Update template status
  if (data.templateStatus) {
    if (data.templateStatus.exists) {
      elements.templateStatus.textContent = '✓ Template exists';
      elements.templateStatus.className = 'template-value text-success';
      elements.templateVersion.textContent = data.templateStatus.version || 'Unknown';
    } else {
      elements.templateStatus.textContent = '✗ Template missing';
      elements.templateStatus.className = 'template-value text-warning';
      elements.templateVersion.textContent = 'N/A';
    }
  } else {
    elements.templateStatus.textContent = 'Unknown';
    elements.templateStatus.className = 'template-value text-muted';
    elements.templateVersion.textContent = 'N/A';
  }
}

/**
 * Show error state
 */
function showError() {
  elements.statusIndicator.className = 'status-indicator status-grey';
  elements.statusText.textContent = 'Connection Error';
  elements.statusText.className = 'status-text text-error';
  
  elements.jobCount.textContent = '-';
  elements.lastActivity.textContent = '-';
  elements.barId.textContent = '-';
  elements.apiUrl.textContent = '-';
  elements.watchFolder.textContent = '-';
  elements.templateStatus.textContent = 'Unable to fetch';
  elements.templateStatus.className = 'template-value text-error';
  elements.templateVersion.textContent = '-';
}

/**
 * Format date and time for display
 */
function formatDateTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Show relative time for recent activity
  if (diffSecs < 60) {
    return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`;
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  // Show absolute time for older activity
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleString('en-US', options);
}

/**
 * Start auto-refresh interval
 */
function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(() => {
    fetchStatus();
    resetCountdown();
  }, 5000); // 5 seconds
}

/**
 * Start countdown timer
 */
function startCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    countdownSeconds--;
    
    if (countdownSeconds < 0) {
      countdownSeconds = 5;
    }
    
    elements.refreshCountdown.textContent = countdownSeconds;
  }, 1000);
}

/**
 * Reset countdown to 5 seconds
 */
function resetCountdown() {
  countdownSeconds = 5;
  elements.refreshCountdown.textContent = countdownSeconds;
}

/**
 * Stop all intervals (cleanup)
 */
function cleanup() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
