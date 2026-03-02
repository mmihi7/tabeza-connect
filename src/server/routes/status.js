/**
 * Status API Route
 * 
 * GET /api/status - Returns service status, job count, last activity, Bar ID, template status
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * GET /api/status
 * Returns current service status and statistics
 */
router.get('/', (req, res) => {
  try {
    // Get capture service reference from app locals
    const captureService = req.app.locals.captureService;
    const config = req.app.locals.config;

    if (!captureService || !config) {
      return res.status(500).json({
        error: 'Service not initialized'
      });
    }

    // Get queue statistics
    const queueStats = captureService.queueManager 
      ? captureService.queueManager.getStats() 
      : { pending: 0, uploaded: 0, failed: 0 };

    // Check template status
    const templatePath = path.join('C:\\ProgramData\\Tabeza', 'template.json');
    let templateStatus = {
      exists: false,
      version: null
    };

    if (fs.existsSync(templatePath)) {
      try {
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const template = JSON.parse(templateContent);
        templateStatus = {
          exists: true,
          version: template.version || 'unknown'
        };
      } catch (error) {
        templateStatus = {
          exists: true,
          version: 'malformed'
        };
      }
    }

    // Get last activity timestamp
    const lastActivity = captureService.lastActivity || null;

    // Determine service status
    const status = captureService.isRunning ? 'online' : 'offline';

    res.json({
      status,
      jobCount: queueStats.uploaded,
      lastActivity,
      barId: config.barId || null,
      templateStatus,
      queueStats
    });
  } catch (error) {
    console.error('[StatusRoute] Error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    });
  }
});

module.exports = router;
