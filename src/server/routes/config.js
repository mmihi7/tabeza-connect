/**
 * Configuration API Route
 * 
 * GET /api/config - Returns current configuration
 * POST /api/config - Updates configuration
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const CONFIG_FILE_PATH = 'C:\\ProgramData\\Tabeza\\config.json';

/**
 * GET /api/config
 * Returns current configuration
 */
router.get('/', (req, res) => {
  try {
    const config = req.app.locals.config;

    if (!config) {
      return res.status(500).json({
        error: 'Configuration not loaded'
      });
    }

    res.json({
      barId: config.barId || '',
      apiUrl: config.apiUrl || 'https://tabeza.co.ke',
      watchFolder: config.watchFolder || 'C:\\ProgramData\\Tabeza\\TabezaPrints',
      httpPort: config.httpPort || 8765,
      source: config.source || 'unknown'
    });
  } catch (error) {
    console.error('[ConfigRoute] Error getting config:', error);
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/config
 * Updates configuration (writes to config.json)
 */
router.post('/', (req, res) => {
  try {
    const { barId, apiUrl, watchFolder, httpPort } = req.body;

    // Validation: Bar ID must be non-empty
    if (barId !== undefined && (!barId || barId.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Bar ID cannot be empty'
      });
    }

    // Validation: API URL must be valid HTTPS
    if (apiUrl !== undefined) {
      try {
        const url = new URL(apiUrl);
        if (url.protocol !== 'https:') {
          return res.status(400).json({
            success: false,
            message: 'API URL must use HTTPS protocol'
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'API URL is not a valid URL'
        });
      }
    }

    // Validation: HTTP port must be a number between 1024 and 65535
    if (httpPort !== undefined) {
      const port = parseInt(httpPort, 10);
      if (isNaN(port) || port < 1024 || port > 65535) {
        return res.status(400).json({
          success: false,
          message: 'HTTP port must be a number between 1024 and 65535'
        });
      }
    }

    // Read existing config file or create new object
    let config = {};
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      try {
        const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
        config = JSON.parse(content);
      } catch (error) {
        console.warn('[ConfigRoute] Existing config.json is malformed, creating new');
      }
    }

    // Update config with new values
    if (barId !== undefined) {
      config.barId = barId.trim();
    }
    if (apiUrl !== undefined) {
      config.apiUrl = apiUrl.trim();
    }
    if (watchFolder !== undefined) {
      config.watchFolder = watchFolder.trim();
    }
    if (httpPort !== undefined) {
      config.httpPort = parseInt(httpPort, 10);
    }

    // Ensure config directory exists
    const configDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write config file
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');

    // Update in-memory config
    if (req.app.locals.config) {
      Object.assign(req.app.locals.config, config);
    }

    res.json({
      success: true,
      message: 'Configuration updated successfully. Restart service for changes to take effect.'
    });
  } catch (error) {
    console.error('[ConfigRoute] Error updating config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: error.message
    });
  }
});

module.exports = router;
