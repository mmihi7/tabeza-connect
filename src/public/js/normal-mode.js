/**
 * Normal Mode JavaScript
 * 
 * Handles the dashboard logic for the tray-ui-simplification feature.
 * Provides full management interface after setup is complete.
 * 
 * This module provides:
 * - Tab navigation between sections
 * - Service control (start, stop, restart)
 * - Real-time status updates
 * - Log viewer with auto-refresh
 * - Keyboard shortcuts
 * 
 * Requirements: 7.1-7.9, 8.1-8.9, 11.1-11.7, 12.1-12.8, 15.1-15.8
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = {
  DASHBOARD: 'dashboard',
  PRINTER: 'printer',
  TEMPLATE: 'template',
  SYSTEM: 'system',
  LOGS: 'logs'
};

const STATUS_UPDATE_INTERVAL = 5000; // 5 seconds
const LOG_REFRESH_INTERVAL = 5000; // 5 seconds
const LOG_MAX_LINES = 100;

// ─────────────────────────────────────────────────────────────────────────────
// State Management
// ─────────────────────────────────────────────────────────────────────────────

let currentSection = SECTIONS.DASHBOARD;
let statusUpdateTimer = null;
let logRefreshTimer = null;
let isLogsVisible = false;
let stateChangedCleanup = null;
let stateSyncCleanup = null;

// Performance optimization: Queue DOM updates using requestAnimationFrame
let pendingDOMUpdates = [];
let rafScheduled = false;

// Virtual scroller for log viewer (Performance Optimization)
let logVirtualScroller = null;

// ─────────────────────────────────────────────────────────────────────────────
// Performance Optimization: requestAnimationFrame for DOM Updates
// Requirements: 19.1-19.5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedule a DOM update using requestAnimationFrame
 * Batches multiple updates into a single frame for better performance
 * 
 * @param {Function} updateFn - Function that performs DOM updates
 */
function scheduleDOMUpdate(updateFn) {
  pendingDOMUpdates.push(updateFn);
  
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(() => {
      // Execute all pending updates in a single frame
      const updates = pendingDOMUpdates.slice();
      pendingDOMUpdates = [];
      rafScheduled = false;
      
      for (const update of updates) {
        try {
          update();
        } catch (error) {
          console.error('[NormalMode] Error in scheduled DOM update:', error);
        }
      }
    });
  }
}

/**
 * Update a DOM element's text content using requestAnimationFrame
 * 
 * @param {string} elementId - ID of the element to update
 * @param {string} textContent - New text content
 */
function updateElementText(elementId, textContent) {
  scheduleDOMUpdate(() => {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = textContent;
    }
  });
}

/**
 * Update a DOM element's class name using requestAnimationFrame
 * 
 * @param {string} elementId - ID of the element to update
 * @param {string} className - New class name
 */
function updateElementClass(elementId, className) {
  scheduleDOMUpdate(() => {
    const element = document.getElementById(elementId);
    if (element) {
      element.className = className;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Navigation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Switch to a different section
 * Updates tab highlighting and shows the target section
 * 
 * Requirements: 7.8, 15.1-15.5, 18.1-18.6 (Accessibility)
 * 
 * @param {string} sectionName - Name of the section to switch to
 */
async function switchSection(sectionName) {
  console.log(`[NormalMode] Switching to section: ${sectionName}`);
  
  try {
    // Validate section name
    if (!Object.values(SECTIONS).includes(sectionName)) {
      console.error(`[NormalMode] Invalid section name: ${sectionName}`);
      return;
    }
    
    // Hide all sections
    const allSections = document.querySelectorAll('.section');
    allSections.forEach(section => {
      section.classList.remove('active');
      section.setAttribute('hidden', '');
      section.setAttribute('aria-hidden', 'true');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
      targetSection.classList.add('active');
      targetSection.removeAttribute('hidden');
      targetSection.setAttribute('aria-hidden', 'false');
      
      // Focus the section for keyboard navigation (Requirement 18.2)
      targetSection.focus();
    } else {
      console.error(`[NormalMode] Section not found: ${sectionName}-section`);
      return;
    }
    
    // Update tab highlighting and ARIA attributes (Requirement 18.1)
    const allTabs = document.querySelectorAll('.tab');
    allTabs.forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    });
    
    const targetTab = document.querySelector(`[data-section="${sectionName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
      targetTab.setAttribute('aria-selected', 'true');
      targetTab.setAttribute('tabindex', '0');
    }
    
    // Update current section
    currentSection = sectionName;
    
    // Announce section change to screen readers (Requirement 18.6)
    const sectionTitles = {
      [SECTIONS.DASHBOARD]: 'Dashboard',
      [SECTIONS.PRINTER]: 'Printer Setup',
      [SECTIONS.TEMPLATE]: 'Template Generator',
      [SECTIONS.SYSTEM]: 'System Maintenance',
      [SECTIONS.LOGS]: 'Service Logs'
    };
    
    if (typeof announceToScreenReader === 'function') {
      announceToScreenReader(`Switched to ${sectionTitles[sectionName]} section`, 'polite');
    }
    
    // Save active section for persistence (Requirements: 14.5, 14.6)
    try {
      await window.electronAPI.saveActiveSection(sectionName);
    } catch (error) {
      console.warn('[NormalMode] Failed to save active section:', error);
    }
    
    // Load section-specific data
    await loadSectionData(sectionName);
    
    // Manage log auto-refresh
    if (sectionName === SECTIONS.LOGS) {
      isLogsVisible = true;
      startLogRefresh();
    } else {
      isLogsVisible = false;
      stopLogRefresh();
    }
    
    console.log(`[NormalMode] Switched to section: ${sectionName}`);
    
  } catch (error) {
    console.error(`[NormalMode] Error switching to section ${sectionName}:`, error);
    showNotification('Failed to switch section', 'error');
  }
}

/**
 * Load section-specific data
 * Called when switching to a section
 * 
 * @param {string} sectionName - Name of the section to load data for
 */
async function loadSectionData(sectionName) {
  try {
    switch (sectionName) {
      case SECTIONS.DASHBOARD:
        await updateDashboardStatus();
        break;
        
      case SECTIONS.PRINTER:
        await updatePrinterStatus();
        break;
        
      case SECTIONS.TEMPLATE:
        await updateTemplateStatus();
        break;
        
      case SECTIONS.SYSTEM:
        await updateSystemStatus();
        break;
        
      case SECTIONS.LOGS:
        await refreshLogs();
        break;
        
      default:
        console.warn(`[NormalMode] No data loader for section: ${sectionName}`);
    }
  } catch (error) {
    console.error(`[NormalMode] Error loading data for section ${sectionName}:`, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Control Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the Tabeza Connect service
 * Requirements: 8.5
 */
async function startService() {
  console.log('[NormalMode] Starting service...');
  
  try {
    const result = await window.electronAPI.startService();
    
    if (result && result.success) {
      showNotification('Service started successfully', 'success');
      await updateServiceStatus();
    } else {
      const errorMsg = result?.error || 'Unknown error';
      showNotification(`Failed to start service: ${errorMsg}`, 'error');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error starting service:', error);
    showNotification('Failed to start service', 'error');
  }
}

/**
 * Stop the Tabeza Connect service
 * Requirements: 8.6
 */
async function stopService() {
  console.log('[NormalMode] Stopping service...');
  
  try {
    const result = await window.electronAPI.stopService();
    
    if (result && result.success) {
      showNotification('Service stopped successfully', 'success');
      await updateServiceStatus();
    } else {
      const errorMsg = result?.error || 'Unknown error';
      showNotification(`Failed to stop service: ${errorMsg}`, 'error');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error stopping service:', error);
    showNotification('Failed to stop service', 'error');
  }
}

/**
 * Restart the Tabeza Connect service
 * Requirements: 8.7, 15.6
 */
async function restartService() {
  console.log('[NormalMode] Restarting service...');
  
  try {
    showNotification('Restarting service...', 'success');
    
    // Stop service
    const stopResult = await window.electronAPI.stopService();
    if (!stopResult || !stopResult.success) {
      throw new Error('Failed to stop service');
    }
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start service
    const startResult = await window.electronAPI.startService();
    if (!startResult || !startResult.success) {
      throw new Error('Failed to start service');
    }
    
    showNotification('Service restarted successfully', 'success');
    await updateServiceStatus();
    
  } catch (error) {
    console.error('[NormalMode] Error restarting service:', error);
    showNotification('Failed to restart service', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-time Status Updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update service status display
 * Uses requestAnimationFrame for optimized DOM updates
 * Requirements: 8.1, 8.8, 19.1-19.5
 */
async function updateServiceStatus() {
  try {
    const status = await window.electronAPI.getServiceStatus();
    
    if (status) {
      const statusText = status.running ? 'Running' : 'Stopped';
      const statusClass = status.running ? 'status-value online' : 'status-value offline';
      
      // Use optimized DOM update
      updateElementText('service-status', statusText);
      updateElementClass('service-status', statusClass);
    }
    
  } catch (error) {
    console.error('[NormalMode] Error updating service status:', error);
  }
}

/**
 * Update dashboard status information
 * Requirements: 8.1-8.4, 8.8
 */
async function updateDashboardStatus() {
  console.log('[NormalMode] Updating dashboard status...');
  
  try {
    // Update service status
    await updateServiceStatus();
    
    // Update version
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      const version = await window.electronAPI.getVersion();
      versionElement.textContent = version || '1.7.0';
    }
    
    // Update folder status
    const folderStatus = await window.electronAPI.checkFolderStatus();
    const folderStatusElement = document.getElementById('folder-status');
    const captureFileStatusElement = document.getElementById('capture-file-status');
    
    if (folderStatusElement && folderStatus) {
      folderStatusElement.textContent = folderStatus.mainFolder ? 'OK' : 'Missing';
      folderStatusElement.className = folderStatus.mainFolder ? 'status-value online' : 'status-value offline';
    }
    
    if (captureFileStatusElement && folderStatus) {
      captureFileStatusElement.textContent = folderStatus.captureFile ? 'OK' : 'Missing';
      captureFileStatusElement.className = folderStatus.captureFile ? 'status-value online' : 'status-value offline';
    }
    
    // Update recent activity
    const activity = await window.electronAPI.getRecentActivity();
    const lastReceiptElement = document.getElementById('last-receipt');
    const todayCountElement = document.getElementById('today-count');
    
    if (lastReceiptElement && activity) {
      lastReceiptElement.textContent = activity.lastReceipt || 'Never';
    }
    
    if (todayCountElement && activity) {
      todayCountElement.textContent = activity.todayCount || '0';
    }
    
    // Update configuration
    const config = await window.electronAPI.getConfig();
    const barIdElement = document.getElementById('dashboard-bar-id');
    const watchFolderElement = document.getElementById('dashboard-watch-folder');
    
    if (barIdElement && config) {
      barIdElement.textContent = config.barId || 'Not set';
    }
    
    if (watchFolderElement && config) {
      watchFolderElement.textContent = config.watchFolder || 'C:\\TabezaPrints';
    }
    
    console.log('[NormalMode] Dashboard status updated');
    
  } catch (error) {
    console.error('[NormalMode] Error updating dashboard status:', error);
  }
}

/**
 * Update printer status display
 * Requirements: 9.1, 9.4, 9.5
 */
async function updatePrinterStatus() {
  console.log('[NormalMode] Updating printer status...');
  
  try {
    const printerStatus = await window.electronAPI.checkPrinterSetup();
    const statusElement = document.getElementById('printer-section-status');
    const physicalPrinterElement = document.getElementById('physical-printer');
    const tabezaPrinterElement = document.getElementById('tabeza-printer');
    
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
    
    if (physicalPrinterElement && printerStatus) {
      physicalPrinterElement.textContent = printerStatus.physicalPrinter || 'Not configured';
    }
    
    if (tabezaPrinterElement && printerStatus) {
      tabezaPrinterElement.textContent = printerStatus.tabezaPrinter || 'Not configured';
    }
    
    console.log('[NormalMode] Printer status updated');
    
  } catch (error) {
    console.error('[NormalMode] Error updating printer status:', error);
  }
}

/**
 * Update template status display
 * Requirements: 10.1, 10.4, 10.5
 */
async function updateTemplateStatus() {
  console.log('[NormalMode] Updating template status...');
  
  try {
    const templateStatus = await window.electronAPI.checkTemplateStatus();
    const statusElement = document.getElementById('template-section-status');
    const posSystemElement = document.getElementById('pos-system');
    const confidenceScoreElement = document.getElementById('confidence-score');
    
    if (statusElement && templateStatus) {
      if (templateStatus.exists) {
        statusElement.textContent = 'Generated';
        statusElement.className = 'status-value online';
      } else {
        statusElement.textContent = 'Not Generated';
        statusElement.className = 'status-value warning';
      }
    }
    
    if (posSystemElement && templateStatus) {
      posSystemElement.textContent = templateStatus.posSystem || 'Unknown';
    }
    
    if (confidenceScoreElement && templateStatus) {
      if (templateStatus.confidence) {
        const confidencePercent = (templateStatus.confidence * 100).toFixed(1);
        confidenceScoreElement.textContent = `${confidencePercent}%`;
      } else {
        confidenceScoreElement.textContent = 'N/A';
      }
    }
    
    console.log('[NormalMode] Template status updated');
    
  } catch (error) {
    console.error('[NormalMode] Error updating template status:', error);
  }
}

/**
 * Update system status display
 * Requirements: 11.4
 */
async function updateSystemStatus() {
  console.log('[NormalMode] Updating system status...');
  
  try {
    const folderStatus = await window.electronAPI.checkFolderStatus();
    const statusElement = document.getElementById('system-folder-status');
    
    if (statusElement && folderStatus) {
      const allOk = folderStatus.mainFolder && folderStatus.captureFile;
      statusElement.textContent = allOk ? 'OK' : 'Issues Detected';
      statusElement.className = allOk ? 'status-value online' : 'status-value warning';
    }
    
    console.log('[NormalMode] System status updated');
    
  } catch (error) {
    console.error('[NormalMode] Error updating system status:', error);
  }
}

/**
 * Start automatic status updates
 * Updates status every 5 seconds
 * 
 * Requirements: 8.8, 19.3
 */
function startStatusUpdates() {
  console.log('[NormalMode] Starting automatic status updates');
  
  // Clear any existing timer
  if (statusUpdateTimer) {
    clearInterval(statusUpdateTimer);
  }
  
  // Update immediately
  updateDashboardStatus();
  
  // Set up interval
  statusUpdateTimer = setInterval(() => {
    if (currentSection === SECTIONS.DASHBOARD) {
      updateDashboardStatus();
    }
  }, STATUS_UPDATE_INTERVAL);
}

/**
 * Stop automatic status updates
 */
function stopStatusUpdates() {
  console.log('[NormalMode] Stopping automatic status updates');
  
  if (statusUpdateTimer) {
    clearInterval(statusUpdateTimer);
    statusUpdateTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Log Viewer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refresh log viewer content
 * Uses virtual scrolling for better performance with large log files
 * Requirements: 12.1, 12.2, 12.3, 12.7, 19.1-19.5
 */
async function refreshLogs() {
  console.log('[NormalMode] Refreshing logs...');
  
  try {
    const logs = await window.electronAPI.getLogs(LOG_MAX_LINES);
    const logViewer = document.getElementById('log-viewer');
    
    if (!logViewer) {
      console.error('[NormalMode] Log viewer element not found');
      return;
    }
    
    // Initialize virtual scroller if not already created
    if (!logVirtualScroller) {
      logVirtualScroller = new VirtualScroller(logViewer, {
        itemHeight: 24, // Height of each log line
        bufferSize: 20, // Render 20 extra items above/below viewport
        renderItem: (log, index) => {
          const timestamp = log.timestamp || '';
          const level = log.level || 'INFO';
          const message = log.message || log;
          
          let color = '#333';
          if (level === 'ERROR') color = '#ef4444';
          else if (level === 'WARN') color = '#f59e0b';
          else if (level === 'INFO') color = '#10b981';
          
          return `<div style="height: 24px; line-height: 24px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <span style="color: #666;">${timestamp}</span>
            <span style="color: ${color}; font-weight: 600;">[${level}]</span>
            <span style="color: #333;">${message}</span>
          </div>`;
        }
      });
    }
    
    if (logs && logs.length > 0) {
      // Update virtual scroller with new logs
      logVirtualScroller.setItems(logs);
    } else {
      // No logs available
      logViewer.innerHTML = '<p style="color: #666;">No logs available</p>';
    }
    
    console.log('[NormalMode] Logs refreshed');
    
  } catch (error) {
    console.error('[NormalMode] Error refreshing logs:', error);
    const logViewer = document.getElementById('log-viewer');
    if (logViewer) {
      logViewer.innerHTML = '<p style="color: #ef4444;">Failed to load logs</p>';
    }
  }
}

/**
 * Start automatic log refresh
 * Refreshes logs every 5 seconds while logs section is visible
 * 
 * Requirements: 12.2
 */
function startLogRefresh() {
  console.log('[NormalMode] Starting automatic log refresh');
  
  // Clear any existing timer
  if (logRefreshTimer) {
    clearInterval(logRefreshTimer);
  }
  
  // Refresh immediately
  refreshLogs();
  
  // Set up interval
  logRefreshTimer = setInterval(() => {
    if (isLogsVisible) {
      refreshLogs();
    }
  }, LOG_REFRESH_INTERVAL);
}

/**
 * Stop automatic log refresh
 */
function stopLogRefresh() {
  console.log('[NormalMode] Stopping automatic log refresh');
  
  if (logRefreshTimer) {
    clearInterval(logRefreshTimer);
    logRefreshTimer = null;
  }
}

/**
 * Open log file in default text editor
 * Requirements: 12.4
 */
async function openLogsFolder() {
  console.log('[NormalMode] Opening log file...');
  
  try {
    const result = await window.electronAPI.openLogFile();
    
    if (!result || !result.success) {
      showNotification('Failed to open log file', 'error');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error opening log file:', error);
    showNotification('Failed to open log file', 'error');
  }
}

/**
 * Clear log file
 * Requirements: 12.5, 12.6
 */
async function clearLogs() {
  console.log('[NormalMode] Clearing logs...');
  
  try {
    // Prompt for confirmation
    const confirmed = confirm('Are you sure you want to clear all logs? This action cannot be undone.');
    
    if (!confirmed) {
      console.log('[NormalMode] Log clear cancelled by user');
      return;
    }
    
    const result = await window.electronAPI.clearLogs();
    
    if (result && result.success) {
      showNotification('Logs cleared successfully', 'success');
      await refreshLogs();
    } else {
      showNotification('Failed to clear logs', 'error');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error clearing logs:', error);
    showNotification('Failed to clear logs', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Repair folder structure
 * Requirements: 11.1, 11.2, 11.3
 */
async function repairFolders() {
  console.log('[NormalMode] Repairing folders...');
  
  try {
    showNotification('Repairing folder structure...', 'success');
    
    const result = await window.electronAPI.repairFolders();
    
    if (result && result.success) {
      showNotification('Folder structure repaired successfully', 'success');
      await updateSystemStatus();
    } else {
      const errorMsg = result?.error || 'Unknown error';
      showNotification(`Failed to repair folders: ${errorMsg}`, 'error');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error repairing folders:', error);
    showNotification('Failed to repair folders', 'error');
  }
}

/**
 * Open capture folder in Windows Explorer
 * Requirements: 11.5, 11.6
 */
async function openCaptureFolder() {
  console.log('[NormalMode] Opening capture folder...');
  
  try {
    const result = await window.electronAPI.openCaptureFolder();
    
    if (!result || !result.success) {
      showNotification('Failed to open capture folder', 'error');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error opening capture folder:', error);
    showNotification('Failed to open capture folder', 'error');
  }
}

/**
 * Refresh all status information
 */
async function refreshStatus() {
  console.log('[NormalMode] Refreshing all status...');
  
  try {
    showNotification('Refreshing status...', 'success');
    await loadSectionData(currentSection);
    showNotification('Status refreshed', 'success');
  } catch (error) {
    console.error('[NormalMode] Error refreshing status:', error);
    showNotification('Failed to refresh status', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Shortcuts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle keyboard shortcuts
 * Requirements: 15.1-15.8, 18.2 (Keyboard Navigation)
 */
function handleKeyboardShortcuts(event) {
  // Only handle Ctrl key combinations
  if (!event.ctrlKey) {
    return;
  }
  
  // Prevent default browser behavior for our shortcuts
  const handledKeys = ['1', '2', '3', '4', '5', 'r', 'w'];
  if (handledKeys.includes(event.key.toLowerCase())) {
    event.preventDefault();
  }
  
  switch (event.key) {
    case '1':
      // Ctrl+1: Switch to Dashboard
      switchSection(SECTIONS.DASHBOARD);
      break;
      
    case '2':
      // Ctrl+2: Switch to Printer Setup
      switchSection(SECTIONS.PRINTER);
      break;
      
    case '3':
      // Ctrl+3: Switch to Template Generator
      switchSection(SECTIONS.TEMPLATE);
      break;
      
    case '4':
      // Ctrl+4: Switch to System
      switchSection(SECTIONS.SYSTEM);
      break;
      
    case '5':
      // Ctrl+5: Switch to Logs
      switchSection(SECTIONS.LOGS);
      break;
      
    case 'r':
    case 'R':
      // Ctrl+R: Restart Service
      restartService();
      break;
      
    case 'w':
    case 'W':
      // Ctrl+W: Close Window (handled by Electron)
      // This is just for documentation - Electron handles this natively
      break;
      
    default:
      // Not a handled shortcut
      break;
  }
}

/**
 * Handle arrow key navigation in tab list
 * Requirements: 18.2 (Keyboard Navigation)
 */
function handleTabNavigation(event) {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const currentTab = document.activeElement;
  const currentIndex = tabs.indexOf(currentTab);
  
  if (currentIndex === -1) return;
  
  let nextIndex = currentIndex;
  
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault();
      nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      break;
      
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault();
      nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      break;
      
    case 'Home':
      event.preventDefault();
      nextIndex = 0;
      break;
      
    case 'End':
      event.preventDefault();
      nextIndex = tabs.length - 1;
      break;
      
    default:
      return;
  }
  
  // Focus and activate the next tab
  const nextTab = tabs[nextIndex];
  if (nextTab) {
    nextTab.focus();
    const sectionName = nextTab.getAttribute('data-section');
    if (sectionName) {
      switchSection(sectionName);
    }
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
  console.log('[NormalMode] Received state-changed event:', stateChangeEvent);
  
  try {
    const { type, data, timestamp, source } = stateChangeEvent;
    
    // Handle different state types
    switch (type) {
      case 'config':
        // Config state changed - update Bar ID display
        if (data.barId) {
          console.log('[NormalMode] Bar ID updated:', data.barId);
          updateElementText('dashboard-bar-id', data.barId);
        }
        
        // Update watch folder display
        if (data.watchFolder) {
          console.log('[NormalMode] Watch folder updated:', data.watchFolder);
          updateElementText('dashboard-watch-folder', data.watchFolder);
        }
        break;
        
      case 'printer':
        // Printer state changed - update printer status
        console.log('[NormalMode] Printer state updated:', data);
        
        if (currentSection === SECTIONS.PRINTER || currentSection === SECTIONS.DASHBOARD) {
          // Refresh printer status display
          updatePrinterStatus();
        }
        break;
        
      case 'template':
        // Template state changed - update template status
        console.log('[NormalMode] Template state updated:', data);
        
        if (currentSection === SECTIONS.TEMPLATE || currentSection === SECTIONS.DASHBOARD) {
          // Refresh template status display
          updateTemplateStatus();
        }
        break;
        
      case 'setup':
        // Setup state changed - may affect dashboard display
        console.log('[NormalMode] Setup state updated:', data);
        
        if (currentSection === SECTIONS.DASHBOARD) {
          updateDashboardStatus();
        }
        break;
        
      case 'window':
        // Window state changed - no UI updates needed
        console.log('[NormalMode] Window state updated:', data);
        break;
        
      default:
        console.log(`[NormalMode] Unhandled state type: ${type}`);
    }
    
  } catch (error) {
    console.error('[NormalMode] Error handling state-changed event:', error);
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
  console.log('[NormalMode] Received state-sync event:', stateSyncEvent);
  
  try {
    const { type, data, timestamp, source } = stateSyncEvent;
    
    // Re-render all UI components for current section
    loadSectionData(currentSection);
    
    console.log('[NormalMode] State synchronized successfully');
    
  } catch (error) {
    console.error('[NormalMode] Error handling state-sync event:', error);
  }
}

/**
 * Register state event listeners
 * Called during initialization
 */
function registerStateEventListeners() {
  console.log('[NormalMode] Registering state event listeners...');
  
  try {
    // Register state-changed listener
    if (window.electronAPI && window.electronAPI.onStateChanged) {
      stateChangedCleanup = window.electronAPI.onStateChanged(handleStateChanged);
      console.log('[NormalMode] state-changed listener registered');
    } else {
      console.warn('[NormalMode] electronAPI.onStateChanged not available');
    }
    
    // Register state-sync listener
    if (window.electronAPI && window.electronAPI.onStateSync) {
      stateSyncCleanup = window.electronAPI.onStateSync(handleStateSync);
      console.log('[NormalMode] state-sync listener registered');
    } else {
      console.warn('[NormalMode] electronAPI.onStateSync not available');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error registering state event listeners:', error);
  }
}

/**
 * Unregister state event listeners
 * Called during cleanup
 */
function unregisterStateEventListeners() {
  console.log('[NormalMode] Unregistering state event listeners...');
  
  try {
    if (stateChangedCleanup) {
      stateChangedCleanup();
      stateChangedCleanup = null;
      console.log('[NormalMode] state-changed listener unregistered');
    }
    
    if (stateSyncCleanup) {
      stateSyncCleanup();
      stateSyncCleanup = null;
      console.log('[NormalMode] state-sync listener unregistered');
    }
    
  } catch (error) {
    console.error('[NormalMode] Error unregistering state event listeners:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize normal mode
 * Called when normal mode UI is displayed
 * 
 * Requirements: 14.5, 14.6, 18.1-18.6 (Accessibility)
 */
async function initNormalMode() {
  console.log('[NormalMode] Initializing...');
  
  try {
    // Register state event listeners
    registerStateEventListeners();
    
    // Restore last active section
    const windowState = await window.electronAPI.getWindowState();
    if (windowState && windowState.lastActiveSection) {
      const lastSection = windowState.lastActiveSection;
      console.log(`[NormalMode] Restoring last active section: ${lastSection}`);
      await switchSection(lastSection);
    } else {
      // Default to dashboard
      await switchSection(SECTIONS.DASHBOARD);
    }
    
    // Start automatic status updates
    startStatusUpdates();
    
    // Set up keyboard shortcuts (Requirement 15.1-15.8)
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Set up tab navigation (Requirement 18.2)
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('keydown', handleTabNavigation);
    });
    
    console.log('[NormalMode] Initialization complete');
    
  } catch (error) {
    console.error('[NormalMode] Initialization error:', error);
    // Default to dashboard on error
    await switchSection(SECTIONS.DASHBOARD);
  }
}

/**
 * Cleanup normal mode
 * Called when switching away from normal mode
 */
function cleanupNormalMode() {
  console.log('[NormalMode] Cleaning up...');
  
  // Unregister state event listeners
  unregisterStateEventListeners();
  
  // Stop timers
  stopStatusUpdates();
  stopLogRefresh();
  
  // Destroy virtual scroller
  if (logVirtualScroller) {
    logVirtualScroller.destroy();
    logVirtualScroller = null;
  }
  
  // Remove event listeners
  document.removeEventListener('keydown', handleKeyboardShortcuts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Functions (called from HTML onclick handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Switch section
 * Called by onclick="switchSection('sectionName')" in HTML
 */
window.switchSection = function(sectionName) {
  switchSection(sectionName);
};

/**
 * Service control functions
 */
window.startService = function() {
  startService();
};

window.stopService = function() {
  stopService();
};

window.restartService = function() {
  restartService();
};

/**
 * System actions
 */
window.repairFolders = function() {
  repairFolders();
};

window.openCaptureFolder = function() {
  openCaptureFolder();
};

window.refreshStatus = function() {
  refreshStatus();
};

/**
 * Log viewer actions
 */
window.refreshLogs = function() {
  refreshLogs();
};

window.openLogsFolder = function() {
  openLogsFolder();
};

window.clearLogs = function() {
  clearLogs();
};

/**
 * Initialize normal mode
 * Exposed for external calls (e.g., from mode-router.js)
 */
window.initNormalMode = function() {
  return initNormalMode();
};

/**
 * Cleanup normal mode
 * Exposed for external calls
 */
window.cleanupNormalMode = function() {
  cleanupNormalMode();
};
