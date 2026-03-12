/**
 * Physical Printer Configuration UI
 * 
 * Handles printer discovery, configuration, and testing for the Redmon-based
 * receipt capture system.
 */

// State
let currentPrinterType = 'usb';
let selectedUsbPrinter = null;
let availablePrinters = {
  usb: [],
  network: [],
  serial: []
};

/**
 * Initialize the page
 */
document.addEventListener('DOMContentLoaded', () => {
  loadCurrentConfig();
  loadAvailablePrinters();
  
  // Auto-refresh every 30 seconds
  setInterval(loadCurrentConfig, 30000);
});

/**
 * Show alert message
 */
function showAlert(message, type = 'success') {
  const alert = document.getElementById('alert');
  alert.textContent = message;
  alert.className = `alert ${type} show`;
  
  setTimeout(() => {
    alert.classList.remove('show');
  }, 5000);
}

/**
 * Load current printer configuration
 */
async function loadCurrentConfig() {
  try {
    const response = await fetch('/api/printers/config');
    const data = await response.json();
    
    if (data.success && data.config) {
      displayCurrentConfig(data.config);
    } else {
      displayNoConfig();
    }
  } catch (error) {
    console.error('Failed to load config:', error);
    displayNoConfig();
  }
}

/**
 * Display current configuration
 */
function displayCurrentConfig(config) {
  const container = document.getElementById('currentConfig');
  
  if (!config.printer || !config.printer.type) {
    displayNoConfig();
    return;
  }
  
  const printer = config.printer;
  const statusClass = printer.online ? 'online' : 'offline';
  const statusText = printer.online ? 'Online' : 'Offline';
  
  let connectionDetails = '';
  if (printer.type === 'usb' || printer.type === 'serial') {
    connectionDetails = printer.port || 'Auto-detect';
  } else if (printer.type === 'network') {
    connectionDetails = `${printer.ip}:${printer.networkPort || 9100}`;
  }
  
  container.innerHTML = `
    <div class="current-config">
      <div class="config-item">
        <span class="config-label">Printer Type</span>
        <span class="config-value">${printer.type.toUpperCase()}</span>
      </div>
      <div class="config-item">
        <span class="config-label">Connection</span>
        <span class="config-value">${connectionDetails}</span>
      </div>
      <div class="config-item">
        <span class="config-label">Status</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      ${printer.lastSuccess ? `
        <div class="config-item">
          <span class="config-label">Last Successful Print</span>
          <span class="config-value">${new Date(printer.lastSuccess).toLocaleString()}</span>
        </div>
      ` : ''}
      ${printer.totalForwarded ? `
        <div class="config-item">
          <span class="config-label">Total Prints Forwarded</span>
          <span class="config-value">${printer.totalForwarded}</span>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Display no configuration message
 */
function displayNoConfig() {
  const container = document.getElementById('currentConfig');
  container.innerHTML = `
    <div class="help-text">
      <strong>No printer configured.</strong> Please configure a physical printer below to enable print forwarding.
    </div>
  `;
}

/**
 * Load available printers
 */
async function loadAvailablePrinters() {
  await Promise.all([
    loadUsbPrinters(),
    loadSerialPorts()
  ]);
}

/**
 * Load USB printers
 */
async function loadUsbPrinters() {
  try {
    const response = await fetch('/api/printers/list/usb');
    const data = await response.json();
    
    if (data.success && data.printers) {
      availablePrinters.usb = data.printers;
      displayUsbPrinters(data.printers);
    } else {
      displayNoUsbPrinters();
    }
  } catch (error) {
    console.error('Failed to load USB printers:', error);
    displayNoUsbPrinters();
  }
}

/**
 * Display USB printers
 */
function displayUsbPrinters(printers) {
  const container = document.getElementById('usbPrinterList');
  
  if (!printers || printers.length === 0) {
    displayNoUsbPrinters();
    return;
  }
  
  container.innerHTML = printers.map((printer, index) => `
    <div class="printer-item" onclick="selectUsbPrinter(${index})">
      <div class="printer-info">
        <div class="printer-name">${printer.name || 'Unknown Printer'}</div>
        <div class="printer-details">
          ${printer.port ? `Port: ${printer.port}` : ''}
          ${printer.manufacturer ? ` | ${printer.manufacturer}` : ''}
        </div>
      </div>
      <span class="status-badge ${printer.status || 'unknown'}">${printer.status || 'Unknown'}</span>
    </div>
  `).join('');
}

/**
 * Display no USB printers message
 */
function displayNoUsbPrinters() {
  const container = document.getElementById('usbPrinterList');
  container.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #64748b;">
      No USB printers detected. Make sure your printer is connected and powered on.
    </div>
  `;
}

/**
 * Load serial ports
 */
async function loadSerialPorts() {
  try {
    const response = await fetch('/api/printers/list/serial');
    const data = await response.json();
    
    if (data.success && data.ports) {
      displaySerialPorts(data.ports);
    } else {
      displayNoSerialPorts();
    }
  } catch (error) {
    console.error('Failed to load serial ports:', error);
    displayNoSerialPorts();
  }
}

/**
 * Display serial ports
 */
function displaySerialPorts(ports) {
  const select = document.getElementById('serialPort');
  
  if (!ports || ports.length === 0) {
    displayNoSerialPorts();
    return;
  }
  
  select.innerHTML = '<option value="">-- Select a port --</option>' +
    ports.map(port => `
      <option value="${port.path}">
        ${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}
      </option>
    `).join('');
}

/**
 * Display no serial ports message
 */
function displayNoSerialPorts() {
  const select = document.getElementById('serialPort');
  select.innerHTML = '<option value="">No serial ports found</option>';
}

/**
 * Switch printer type tab
 */
function switchPrinterType(type) {
  currentPrinterType = type;
  
  // Update tabs
  document.querySelectorAll('.printer-type-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === type);
  });
  
  // Update content
  document.querySelectorAll('.printer-type-content').forEach(content => {
    content.classList.toggle('active', content.id === `${type}-config`);
  });
}

/**
 * Select USB printer
 */
function selectUsbPrinter(index) {
  selectedUsbPrinter = availablePrinters.usb[index];
  
  // Update UI
  document.querySelectorAll('.printer-item').forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });
  
  // Auto-fill port if available
  if (selectedUsbPrinter.port) {
    document.getElementById('usbPort').value = selectedUsbPrinter.port;
  }
}

/**
 * Save printer configuration
 */
async function savePrinterConfig() {
  try {
    const config = buildPrinterConfig();
    
    if (!config) {
      return; // Validation failed
    }
    
    const response = await fetch('/api/printers/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showAlert('✅ Printer configuration saved successfully!', 'success');
      loadCurrentConfig();
    } else {
      showAlert(`❌ ${data.error || 'Failed to save configuration'}`, 'error');
    }
  } catch (error) {
    console.error('Failed to save config:', error);
    showAlert('❌ Failed to save configuration', 'error');
  }
}

/**
 * Build printer configuration from form
 */
function buildPrinterConfig() {
  const config = {
    type: currentPrinterType,
    timeout: 5000
  };
  
  switch (currentPrinterType) {
    case 'usb':
      const usbPort = document.getElementById('usbPort').value.trim();
      if (!usbPort && !selectedUsbPrinter) {
        showAlert('Please select a USB printer or enter a COM port', 'warning');
        return null;
      }
      config.port = usbPort || selectedUsbPrinter?.port;
      config.baudRate = 9600;
      break;
      
    case 'network':
      const networkIp = document.getElementById('networkIp').value.trim();
      if (!networkIp) {
        showAlert('Please enter a printer IP address', 'warning');
        return null;
      }
      // Validate IP format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(networkIp)) {
        showAlert('Invalid IP address format', 'error');
        return null;
      }
      config.ip = networkIp;
      config.networkPort = parseInt(document.getElementById('networkPort').value) || 9100;
      break;
      
    case 'serial':
      const serialPort = document.getElementById('serialPort').value;
      if (!serialPort) {
        showAlert('Please select a serial port', 'warning');
        return null;
      }
      config.port = serialPort;
      config.baudRate = parseInt(document.getElementById('serialBaudRate').value) || 9600;
      break;
      
    default:
      showAlert('Invalid printer type', 'error');
      return null;
  }
  
  return config;
}

/**
 * Send test print
 */
async function testPrint() {
  try {
    showAlert('Sending test print...', 'info');
    
    const response = await fetch('/api/printers/test', {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showAlert('✅ Test print sent successfully! Check your printer.', 'success');
    } else {
      showAlert(`❌ ${data.error || 'Test print failed'}`, 'error');
    }
  } catch (error) {
    console.error('Failed to send test print:', error);
    showAlert('❌ Failed to send test print', 'error');
  }
}

/**
 * Refresh printer list
 */
async function refreshPrinters() {
  showAlert('Refreshing printer list...', 'info');
  await loadAvailablePrinters();
  showAlert('✅ Printer list refreshed', 'success');
}
