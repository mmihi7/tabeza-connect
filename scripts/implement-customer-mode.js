/**
 * Implement Customer Mode for Trade Secret Protection
 * 
 * Adds role-based access control to hide sensitive information
 */

const fs = require('fs');
const path = require('path');

function implementCustomerMode() {
  console.log('🔒 Implementing Customer Mode (Trade Secret Protection)...');
  
  const statusWindowPath = path.join(__dirname, '../src/tray/status-window.html');
  
  if (!fs.existsSync(statusWindowPath)) {
    console.error('❌ status-window.html not found');
    return false;
  }
  
  let content = fs.readFileSync(statusWindowPath, 'utf8');
  
  // Add customer mode JavaScript
  const customerModeJS = `
// Role-Based Dashboard Access
const DASHBOARD_MODE = {
  CUSTOMER: 'customer',    // Limited view for staff
  ADMIN: 'admin',          // Full access for managers
  SETUP: 'setup'           // Installation mode only
};

// Current mode (stored in localStorage)
let currentMode = localStorage.getItem('dashboardMode') || DASHBOARD_MODE.CUSTOMER;

// Mode Management
function switchMode(mode) {
  if (Object.values(DASHBOARD_MODE).includes(mode)) {
    currentMode = mode;
    localStorage.setItem('dashboardMode', mode);
    updateDashboardForMode(mode);
    showNotification('Mode Changed', \`Switched to \${mode} mode\`);
  }
}

function getCurrentMode() {
  return currentMode;
}

function isAdminMode() {
  return currentMode === DASHBOARD_MODE.ADMIN;
}

function isCustomerMode() {
  return currentMode === DASHBOARD_MODE.CUSTOMER;
}

// Customer Mode - Hide Sensitive Information
function getCustomerView() {
  return {
    hideSensitiveConfigs: true,
    hideApiKeys: true,
    hideBarIds: true,
    hideServiceDetails: true,
    showSimpleStatus: true,
    allowBasicActions: ['view-status', 'test-print']
  };
}

// Admin Mode - Full Access
function getAdminView() {
  return {
    showAllConfigs: true,
    showApiKeys: true,
    showBarIds: true,
    showServiceDetails: true,
    allowAllActions: true,
    requireAuth: true
  };
}

// Update dashboard based on current mode
function updateDashboardForMode(mode) {
  const sensitiveElements = document.querySelectorAll('.sensitive-config');
  const adminOnlyElements = document.querySelectorAll('.admin-only');
  const customerOnlyElements = document.querySelectorAll('.customer-only');
  
  if (mode === DASHBOARD_MODE.CUSTOMER) {
    // Hide sensitive elements
    sensitiveElements.forEach(el => el.style.display = 'none');
    adminOnlyElements.forEach(el => el.classList.add('hidden'));
    customerOnlyElements.forEach(el => el.classList.remove('hidden'));
    
    // Show mode indicator
    updateModeIndicator('Customer Mode');
    
  } else if (mode === DASHBOARD_MODE.ADMIN) {
    // Show all elements
    sensitiveElements.forEach(el => el.style.display = '');
    adminOnlyElements.forEach(el => el.classList.remove('hidden'));
    customerOnlyElements.forEach(el => el.classList.add('hidden'));
    
    // Show mode indicator
    updateModeIndicator('Admin Mode');
    
    // Check authentication if required
    if (getAdminView().requireAuth) {
      checkAdminAuthentication();
    }
  }
}

// Mode toggle UI
function createModeToggle() {
  const modeToggle = \`
    <div class="mode-toggle">
      <div class="mode-indicator" id="mode-indicator">
        <span class="mode-icon">👁️</span>
        <span class="mode-text" id="mode-text">Customer Mode</span>
      </div>
      <div class="mode-actions">
        <button class="btn btn-secondary" onclick="switchMode('\${DASHBOARD_MODE.CUSTOMER}')" id="customer-btn">
          👁️ Customer
        </button>
        <button class="btn btn-primary" onclick="switchMode('\${DASHBOARD_MODE.ADMIN}')" id="admin-btn">
          🔐 Admin
        </button>
      </div>
    </div>
  \`;
  
  // Insert mode toggle into header
  const header = document.querySelector('.header');
  if (header) {
    header.insertAdjacentHTML('afterend', modeToggle);
  }
}

function updateModeIndicator(modeText) {
  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-indicator');
  
  if (modeText) {
    modeText.textContent = modeText;
    
    // Update icon and color based on mode
    if (modeText.includes('Customer')) {
      modeIcon.className = 'mode-indicator customer-mode';
    } else if (modeText.includes('Admin')) {
      modeIcon.className = 'mode-indicator admin-mode';
    }
  }
}

function checkAdminAuthentication() {
  // Simple password prompt for admin access
  const password = prompt('Enter admin password:');
  if (password === 'admin123') { // Change in production!
    showNotification('Access Granted', 'Admin mode activated');
  } else {
    showNotification('Access Denied', 'Incorrect password');
    switchMode(DASHBOARD_MODE.CUSTOMER);
  }
}

// Initialize mode system
document.addEventListener('DOMContentLoaded', () => {
  createModeToggle();
  updateDashboardForMode(currentMode);
});
  `;
  
  // Insert customer mode JavaScript before closing script tag
  content = content.replace('// ─────────────────────────────────────────────', customerModeJS + '// ─────────────────────────────────────────────');
  
  // Add customer mode CSS
  const customerModeCSS = `
  /* Customer Mode Styles */
  .mode-toggle {
    background: var(--surface2);
    border-radius: 8px;
    padding: 15px;
    margin: 20px 0;
    border: 1px solid var(--border);
  }
  
  .mode-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 15px;
    border-radius: 6px;
    font-weight: 600;
    margin-bottom: 15px;
  }
  
  .mode-indicator.customer-mode {
    background: linear-gradient(135deg, #22c55e 0%, #1ea34f 100%);
    color: white;
  }
  
  .mode-indicator.admin-mode {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    color: white;
  }
  
  .mode-actions {
    display: flex;
    gap: 10px;
  }
  
  .sensitive-config {
    display: none !important;
  }
  
  .customer-mode .sensitive-config {
    display: none !important;
  }
  
  .admin-mode .sensitive-config {
    display: block !important;
  }
  
  .admin-only {
    filter: blur(5px);
    pointer-events: none;
    user-select: none;
    transition: all 0.3s ease;
  }
  
  .admin-only.hidden {
    display: none !important;
  }
  
  .customer-only {
    display: block;
  }
  
  .customer-only.hidden {
    display: none !important;
  }
  
  /* Restricted section overlay */
  .restricted-overlay {
    position: relative;
  overflow: hidden;
  }
  
  .restricted-overlay::before {
    content: '🔒 Restricted - Admin Access Required';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 100;
    text-align: center;
  }
  `;
  
  // Insert CSS before closing style tag
  content = content.replace('</style>', customerModeCSS + '</style>');
  
  // Write updated file
  fs.writeFileSync(statusWindowPath, content, 'utf8');
  
  console.log('✅ Customer mode with trade secret protection implemented');
  return true;
}

if (require.main === module) {
  implementCustomerMode();
}

module.exports = { implementCustomerMode };
