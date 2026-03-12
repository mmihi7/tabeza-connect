/**
 * Run this from your project root:
 *   node fix-duplicates.js
 * 
 * It removes the second (duplicate) registration of:
 *   - printer-setup-wizard-complete
 *   - get-config
 *   - save-config
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'electron-main.js');
let src = fs.readFileSync(filePath, 'utf8');

// The exact duplicate block to remove (second occurrence)
const duplicate = `ipcMain.handle('printer-setup-wizard-complete', async () => {
  log('INFO', 'Printer setup wizard completed - broadcasting to all windows');
  
  // Broadcast to all windows
  if (mainWindow) {
    mainWindow.webContents.send('printer-setup-complete');
  }
  if (templateWindow) {
    templateWindow.webContents.send('printer-setup-complete');
  }
  
  // Update tray menu
  setTimeout(() => updateTrayMenu(), 500);
  
  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// Config Management IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('get-config', async () => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return {
        barId: '',
        apiUrl: 'https://tabeza.co.ke',
        watchFolder: TABEZA_PRINTS_DIR,
        httpPort: 8765
      };
    }
    
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    // Remove BOM if present
    const cleanData = configData.replace(/^\\uFEFF/, '');
    return JSON.parse(cleanData);
  } catch (error) {
    log('ERROR', \`Failed to read config: \${error.message}\`);
    return {
      barId: '',
      apiUrl: 'https://tabeza.co.ke',
      watchFolder: TABEZA_PRINTS_DIR,
      httpPort: 8765
    };
  }
});

ipcMain.handle('save-config', async (event, config) => {
  try {
    // Write without BOM
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: 'utf8', flag: 'w' });
    log('INFO', \`Config saved successfully to \${CONFIG_PATH}\`);
    
    // Broadcast config change to all windows
    if (mainWindow) {
      mainWindow.webContents.send('config-updated', config);
    }
    if (templateWindow) {
      templateWindow.webContents.send('config-updated', config);
    }
    if (setupWindow) {
      setupWindow.webContents.send('config-updated', config);
    }
    
    // Update tray menu to reflect changes
    updateTrayMenu();
    
    return { success: true };
  } catch (error) {
    log('ERROR', \`Failed to save config: \${error.message}\`);
    return { success: false, error: error.message };
  }
});`;

const firstIdx  = src.indexOf("ipcMain.handle('printer-setup-wizard-complete'");
const secondIdx = src.indexOf("ipcMain.handle('printer-setup-wizard-complete'", firstIdx + 1);

if (secondIdx === -1) {
  console.log('✅ No duplicate found — file is already clean.');
  process.exit(0);
}

// Find what comes right before the second block so we know where to cut
const before = src.slice(0, secondIdx).trimEnd();
// Find what comes after the duplicate block
const afterDuplicate = src.indexOf('\n/**\n * Launch printer setup wizard', secondIdx);
if (afterDuplicate === -1) {
  console.error('❌ Could not find safe cut point after duplicate. Manual fix needed.');
  process.exit(1);
}

const fixed = before + '\n\n' + src.slice(afterDuplicate);

// Backup original
fs.writeFileSync(filePath + '.bak', src, 'utf8');
fs.writeFileSync(filePath, fixed, 'utf8');

// Verify
const remaining = (fixed.match(/ipcMain\.handle\('printer-setup-wizard-complete'/g) || []).length;
console.log(`✅ Done. 'printer-setup-wizard-complete' registrations remaining: ${remaining}`);
console.log(`📁 Backup saved to: ${filePath}.bak`);
