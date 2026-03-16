/**
 * Registry Reader Module
 * 
 * Loads configuration from multiple sources with priority cascade:
 * Priority: environment variables → registry → config.json → defaults
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Registry path for Tabeza Connect configuration
const REGISTRY_PATH = 'HKLM:\\SOFTWARE\\Tabeza\\TabezaConnect';

// Default configuration values
const DEFAULTS = {
  apiUrl: 'https://tabeza.co.ke',
  watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
  httpPort: 8765
};

// Config file path - check both locations
const CONFIG_FILE_PATH = 'C:\\ProgramData\\Tabeza\\config.json';
const CONFIG_FILE_PATH_ALT = 'C:\\TabezaPrints\\config.json';

class RegistryReader {
  /**
   * Read a single value from Windows Registry using PowerShell
   * @param {string} key - Registry key name (e.g., 'BarID', 'APIUrl', 'WatchFolder')
   * @returns {string|null} Value or null if not found
   */
  static readRegistryKey(key) {
    try {
      // Use PowerShell Get-ItemProperty to read registry value
      const command = `powershell -Command "Get-ItemProperty -Path '${REGISTRY_PATH}' -Name '${key}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty '${key}'"`;
      
      const result = execSync(command, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000 // 5 second timeout
      });

      const value = result.trim();
      
      // Return null if empty or undefined
      if (!value || value === '' || value.toLowerCase() === 'null') {
        return null;
      }

      return value;
    } catch (error) {
      // Log warning but don't throw - allow fallback to next priority
      console.warn(`[WARN] Failed to read registry key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Read config.json from disk
   * @returns {Object|null} Config object or null if not found/malformed
   */
  static readConfigFile() {
    try {
      // Check primary path first, then fallback
      const filePath = fs.existsSync(CONFIG_FILE_PATH) 
        ? CONFIG_FILE_PATH 
        : fs.existsSync(CONFIG_FILE_PATH_ALT) 
          ? CONFIG_FILE_PATH_ALT 
          : null;

      if (!filePath) return null;

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(fileContent);
      console.log(`[RegistryReader] Loaded config from: ${filePath}`);
      return config;
    } catch (error) {
      // Log warning for malformed JSON or read errors
      if (error instanceof SyntaxError) {
        console.warn(`[WARN] Malformed config.json at ${CONFIG_FILE_PATH}: ${error.message}`);
      } else {
        console.warn(`[WARN] Failed to read config.json: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Load configuration from all sources with priority cascade
   * Priority: env vars → registry → config.json → defaults
   * @returns {Object} Configuration object with source tracking
   */
  static loadConfig() {
    const config = {
      barId: null,
      apiUrl: null,
      watchFolder: null,
      httpPort: null,
      source: null
    };

    // Priority 1: Environment variables
    if (process.env.TABEZA_BAR_ID) {
      config.barId = process.env.TABEZA_BAR_ID;
      config.source = 'env';
    }
    if (process.env.TABEZA_API_URL) {
      config.apiUrl = process.env.TABEZA_API_URL;
    }
    if (process.env.TABEZA_WATCH_FOLDER) {
      config.watchFolder = process.env.TABEZA_WATCH_FOLDER;
    }
    if (process.env.TABEZA_HTTP_PORT) {
      config.httpPort = parseInt(process.env.TABEZA_HTTP_PORT, 10);
    }

    // Priority 2: Windows Registry
    if (!config.barId) {
      const registryBarId = this.readRegistryKey('BarID');
      if (registryBarId) {
        config.barId = registryBarId;
        config.source = 'registry';
      }
    }
    if (!config.apiUrl) {
      const registryApiUrl = this.readRegistryKey('APIUrl');
      if (registryApiUrl) {
        config.apiUrl = registryApiUrl;
      }
    }
    if (!config.watchFolder) {
      const registryWatchFolder = this.readRegistryKey('WatchFolder');
      if (registryWatchFolder) {
        config.watchFolder = registryWatchFolder;
      }
    }

    // Priority 3: Config file
    const fileConfig = this.readConfigFile();
    if (fileConfig) {
      if (!config.barId && fileConfig.barId) {
        config.barId = fileConfig.barId;
        config.source = 'config';
      }
      if (!config.apiUrl && fileConfig.apiUrl) {
        config.apiUrl = fileConfig.apiUrl;
      }
      if (!config.watchFolder && fileConfig.watchFolder) {
        config.watchFolder = fileConfig.watchFolder;
      }
      if (!config.httpPort && fileConfig.httpPort) {
        config.httpPort = fileConfig.httpPort;
      }
      if (!config.driverId && fileConfig.driverId) {
        config.driverId = fileConfig.driverId;
      }
    }

    // Priority 4: Defaults
    if (!config.apiUrl) {
      config.apiUrl = DEFAULTS.apiUrl;
      if (!config.source) {
        config.source = 'default';
      }
    }
    if (!config.watchFolder) {
      config.watchFolder = DEFAULTS.watchFolder;
    }
    if (!config.httpPort) {
      config.httpPort = DEFAULTS.httpPort;
    }

    // Log warning if Bar ID is still missing (required for uploads)
    if (!config.barId) {
      console.error('[ERROR] Bar ID not found in any configuration source. Uploads will fail until Bar ID is configured.');
    }

    return config;
  }
}

module.exports = RegistryReader;
