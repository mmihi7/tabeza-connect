/**
 * Implement Multi-POS Terminal Selector
 * 
 * Adds support for multiple POS terminals in hospitality environments
 */

const fs = require('fs');
const path = require('path');

function implementTerminalSelector() {
  console.log('🖥️ Implementing Multi-POS Terminal Selector...');
  
  const statusWindowPath = path.join(__dirname, '../src/tray/status-window.html');
  
  if (!fs.existsSync(statusWindowPath)) {
    console.error('❌ status-window.html not found');
    return false;
  }
  
  let content = fs.readFileSync(statusWindowPath, 'utf8');
  
  // Add terminal selector JavaScript
  const terminalJS = `
// Multi-POS Terminal Support
const POS_TERMINALS = [
  { id: 'pos-1', name: 'Bar Terminal', location: 'Main Bar' },
  { id: 'pos-2', name: 'Restaurant Terminal', location: 'Dining Area' },
  { id: 'pos-3', name: 'Kitchen Terminal', location: 'Kitchen' },
  { id: 'pos-4', name: 'Terrace Terminal', location: 'Outdoor' }
];

// Terminal Manager Class
class POSManager {
  constructor() {
    this.terminals = new Map();
    this.activeTerminal = 'pos-1'; // Default to first terminal
    this.initializeTerminals();
  }
  
  initializeTerminals() {
    POS_TERMINALS.forEach(terminal => {
      this.terminals.set(terminal.id, {
        ...terminal,
        status: 'offline',
        lastSeen: null,
        receiptCount: 0
      });
    });
  }
  
  switchToTerminal(terminalId) {
    if (this.terminals.has(terminalId)) {
      this.activeTerminal = terminalId;
      this.updateDashboard();
      this.notifyTerminalSwitch(terminalId);
    }
  }
  
  getActiveTerminal() {
    return this.terminals.get(this.activeTerminal);
  }
  
  updateTerminalStatus(terminalId, status) {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.status = status;
      terminal.lastSeen = new Date();
      this.updateDashboard();
    }
  }
  
  updateDashboard() {
    // Update UI to reflect current terminal
    const activeTerminal = this.getActiveTerminal();
    if (activeTerminal) {
      document.getElementById('current-terminal').textContent = activeTerminal.name;
      document.getElementById('current-location').textContent = activeTerminal.location;
    }
  }
  
  notifyTerminalSwitch(terminalId) {
    const terminal = this.terminals.get(terminalId);
    showNotification('Terminal Switched', \`Now using \${terminal.name} (\${terminal.location})\`);
  }
}

// Initialize POS Manager
const posManager = new POSManager();

// Terminal Selector UI
function showTerminalSelector() {
  const modal = document.createElement('div');
  modal.className = 'terminal-selector-modal';
  modal.innerHTML = \`
    <div class="modal-content">
      <h3>📍 Select POS Terminal</h3>
      <div class="terminal-grid">
        \${POS_TERMINALS.map(terminal => \`
          <div class="terminal-card" data-terminal="\${terminal.id}" onclick="selectTerminal('\${terminal.id}')">
            <div class="terminal-icon">🖥️</div>
            <div class="terminal-info">
              <div class="terminal-name">\${terminal.name}</div>
              <div class="terminal-location">\${terminal.location}</div>
              <div class="terminal-status" id="status-\${terminal.id}">
                <span class="status-dot"></span>
                <span class="status-text">Checking...</span>
              </div>
            </div>
          </div>
        \`).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeTerminalSelector()">Cancel</button>
      </div>
    </div>
  \`;
  
  document.body.appendChild(modal);
}

function selectTerminal(terminalId) {
  posManager.switchToTerminal(terminalId);
  closeTerminalSelector();
}

function closeTerminalSelector() {
  const modal = document.querySelector('.terminal-selector-modal');
  if (modal) {
    modal.remove();
  }
}
  `;
  
  // Insert terminal selector JavaScript before closing script tag
  content = content.replace('// ─────────────────────────────────────────────', terminalJS + '// ─────────────────────────────────────────────');
  
  // Add terminal selector CSS
  const terminalCSS = `
  /* Terminal Selector Styles */
  .terminal-selector-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--surface);
    border-radius: 12px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  
  .terminal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
  }
  
  .terminal-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .terminal-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    border-color: var(--ok);
  }
  
  .terminal-icon {
    font-size: 24px;
    margin-bottom: 10px;
  }
  
  .terminal-name {
    font-weight: 600;
    color: var(--text);
    margin-bottom: 5px;
  }
  
  .terminal-location {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
  `;
  
  // Insert CSS before closing style tag
  content = content.replace('</style>', terminalCSS + '</style>');
  
  // Write updated file
  fs.writeFileSync(statusWindowPath, content, 'utf8');
  
  console.log('✅ Multi-POS terminal selector implemented');
  return true;
}

if (require.main === module) {
  implementTerminalSelector();
}

module.exports = { implementTerminalSelector };
