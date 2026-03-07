#!/usr/bin/env node
/**
 * Create desktop shortcuts for Tabeza Connect key features
 * This script creates shortcuts on the user's desktop for easy access
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DESKTOP = path.join(process.env.USERPROFILE || '', 'Desktop');
const PROGRAM_FILES = 'C:\\Program Files\\TabezaConnect';

const shortcuts = [
  {
    name: 'Tabeza Connect Status',
    target: path.join(PROGRAM_FILES, 'TabezaConnect.exe'),
    args: '',
    icon: path.join(PROGRAM_FILES, 'icon-green.ico'),
    description: 'Open Tabeza Connect Status Window'
  },
  {
    name: 'Tabeza Template Generator',
    target: path.join(PROGRAM_FILES, 'TabezaConnect.exe'),
    args: '',
    icon: path.join(PROGRAM_FILES, 'icon-green.ico'),
    description: 'Open Tabeza Template Generator',
    url: 'http://localhost:8765/template.html'
  },
  {
    name: 'Tabeza Configuration',
    target: path.join(PROGRAM_FILES, 'TabezaConnect.exe'),
    args: '',
    icon: path.join(PROGRAM_FILES, 'icon-green.ico'),
    description: 'Configure Tabeza Connect',
    url: 'http://localhost:8765/configure.html'
  }
];

function createShortcut(shortcut) {
  return new Promise((resolve, reject) => {
    const shortcutPath = path.join(DESKTOP, `${shortcut.name}.lnk`);
    
    // Use PowerShell to create shortcut
    const psScript = `
      $WshShell = New-Object -comObject WScript.Shell
      $Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
      $Shortcut.TargetPath = "${shortcut.target}"
      $Shortcut.Arguments = "${shortcut.args}"
      $Shortcut.WorkingDirectory = "${PROGRAM_FILES}"
      $Shortcut.IconLocation = "${shortcut.icon}"
      $Shortcut.Description = "${shortcut.description}"
      $Shortcut.Save()
    `;

    exec(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Failed to create ${shortcut.name}:`, error);
        reject(error);
      } else {
        console.log(`✅ Created: ${shortcut.name}`);
        resolve();
      }
    });
  });
}

async function createAllShortcuts() {
  console.log('Creating Tabeza Connect desktop shortcuts...');
  
  try {
    // Check if TabezaConnect is installed
    if (!fs.existsSync(PROGRAM_FILES)) {
      console.error('❌ TabezaConnect not found in Program Files');
      process.exit(1);
    }

    // Create each shortcut
    for (const shortcut of shortcuts) {
      await createShortcut(shortcut);
    }

    console.log('\n✅ All shortcuts created successfully!');
    console.log(`📍 Location: ${DESKTOP}`);
    console.log('\nShortcuts created:');
    shortcuts.forEach(s => console.log(`  - ${s.name}`));
    
  } catch (error) {
    console.error('❌ Failed to create shortcuts:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  createAllShortcuts();
}

module.exports = { createAllShortcuts, shortcuts };
