/**
 * Test: Verify Redmon files are present in installer assets
 * 
 * This test ensures that all required Redmon files are included
 * in the installer package for the Redmon-based receipt capture system.
 * 
 * Task: 2.3 Add Redmon to installer assets
 * Spec: redmon-receipt-capture
 */

const fs = require('fs');
const path = require('path');

describe('Redmon Installer Assets', () => {
  const REDMON_DIR = path.join(__dirname, '..', '..', 'redmon19');
  
  describe('Directory Structure', () => {
    test('redmon19 directory exists', () => {
      expect(fs.existsSync(REDMON_DIR)).toBe(true);
    });
  });
  
  describe('Required Installer Files', () => {
    test('setup.exe exists (32-bit installer)', () => {
      const setupPath = path.join(REDMON_DIR, 'setup.exe');
      expect(fs.existsSync(setupPath)).toBe(true);
    });
    
    test('setup64.exe exists (64-bit installer)', () => {
      const setup64Path = path.join(REDMON_DIR, 'setup64.exe');
      expect(fs.existsSync(setup64Path)).toBe(true);
    });
  });
  
  describe('Required DLL Files', () => {
    test('redmon32.dll exists (32-bit port monitor)', () => {
      const dll32Path = path.join(REDMON_DIR, 'redmon32.dll');
      expect(fs.existsSync(dll32Path)).toBe(true);
    });
    
    test('redmon64.dll exists (64-bit port monitor)', () => {
      const dll64Path = path.join(REDMON_DIR, 'redmon64.dll');
      expect(fs.existsSync(dll64Path)).toBe(true);
    });
  });
  
  describe('Required Utility Programs', () => {
    const utilities = [
      'redpr.exe',    // Redmon printer utility
      'redrun.exe',   // Redmon run utility
      'redfile.exe',  // Redmon file utility
      'enum.exe'      // Redmon enumeration utility
    ];
    
    utilities.forEach(utility => {
      test(`${utility} exists`, () => {
        const utilityPath = path.join(REDMON_DIR, utility);
        expect(fs.existsSync(utilityPath)).toBe(true);
      });
    });
  });
  
  describe('Required Uninstaller Files', () => {
    test('unredmon.exe exists (32-bit uninstaller)', () => {
      const uninstallPath = path.join(REDMON_DIR, 'unredmon.exe');
      expect(fs.existsSync(uninstallPath)).toBe(true);
    });
    
    test('unredmon64.exe exists (64-bit uninstaller)', () => {
      const uninstall64Path = path.join(REDMON_DIR, 'unredmon64.exe');
      expect(fs.existsSync(uninstall64Path)).toBe(true);
    });
  });
  
  describe('Documentation Files', () => {
    const docFiles = [
      'README.TXT',
      'LICENCE',
      'redmon.chm'  // Help file
    ];
    
    docFiles.forEach(docFile => {
      test(`${docFile} exists`, () => {
        const docPath = path.join(REDMON_DIR, docFile);
        expect(fs.existsSync(docPath)).toBe(true);
      });
    });
  });
  
  describe('File Sizes', () => {
    test('setup.exe is not empty', () => {
      const setupPath = path.join(REDMON_DIR, 'setup.exe');
      const stats = fs.statSync(setupPath);
      expect(stats.size).toBeGreaterThan(0);
    });
    
    test('setup64.exe is not empty', () => {
      const setup64Path = path.join(REDMON_DIR, 'setup64.exe');
      const stats = fs.statSync(setup64Path);
      expect(stats.size).toBeGreaterThan(0);
    });
    
    test('redmon64.dll is not empty', () => {
      const dll64Path = path.join(REDMON_DIR, 'redmon64.dll');
      const stats = fs.statSync(dll64Path);
      expect(stats.size).toBeGreaterThan(0);
    });
  });
});

describe('Inno Setup Configuration', () => {
  const INNO_SCRIPT = path.join(__dirname, '..', '..', 'TabezaConnect.iss');
  
  test('Inno Setup script exists', () => {
    expect(fs.existsSync(INNO_SCRIPT)).toBe(true);
  });
  
  test('Inno Setup script includes Redmon files', () => {
    const scriptContent = fs.readFileSync(INNO_SCRIPT, 'utf8');
    
    // Check for Redmon source directive
    expect(scriptContent).toMatch(/Source:\s*"redmon19\\\*"/);
    
    // Check for Redmon destination directive
    expect(scriptContent).toMatch(/DestDir:\s*"\{app\}\\redmon19"/);
    
    // Check for recursesubdirs flag
    expect(scriptContent).toMatch(/redmon19.*recursesubdirs/);
  });
  
  test('Inno Setup script creates redmon19 directory', () => {
    const scriptContent = fs.readFileSync(INNO_SCRIPT, 'utf8');
    
    // Check for directory creation
    expect(scriptContent).toMatch(/Name:\s*"\{app\}\\redmon19"/);
  });
});

describe('Build Script Configuration', () => {
  const BUILD_SCRIPT = path.join(__dirname, '..', '..', 'build-installer.js');
  
  test('build-installer.js exists', () => {
    expect(fs.existsSync(BUILD_SCRIPT)).toBe(true);
  });
  
  test('build-installer.js copies Redmon files', () => {
    const scriptContent = fs.readFileSync(BUILD_SCRIPT, 'utf8');
    
    // Check for Redmon source path
    expect(scriptContent).toMatch(/redmon19/);
    
    // Check for Redmon copy operation
    expect(scriptContent).toMatch(/REDMON_SRC|redmon19/);
  });
});

describe('Install Script Configuration', () => {
  const INSTALL_SCRIPT = path.join(__dirname, '..', 'install-redmon.ps1');
  
  test('install-redmon.ps1 exists', () => {
    expect(fs.existsSync(INSTALL_SCRIPT)).toBe(true);
  });
  
  test('install-redmon.ps1 expects correct path', () => {
    const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf8');
    
    // Check for expected Redmon path
    expect(scriptContent).toMatch(/C:\\Program Files\\TabezaConnect\\redmon19/);
  });
  
  test('install-redmon.ps1 handles both architectures', () => {
    const scriptContent = fs.readFileSync(INSTALL_SCRIPT, 'utf8');
    
    // Check for 32-bit and 64-bit handling
    expect(scriptContent).toMatch(/setup\.exe/);
    expect(scriptContent).toMatch(/setup64\.exe/);
  });
});
