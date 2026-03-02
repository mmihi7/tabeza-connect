/**
 * Logs API Route
 * 
 * GET /api/logs - Returns last 100 lines of service.log
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const LOG_FILE_PATH = 'C:\\ProgramData\\Tabeza\\logs\\service.log';

/**
 * GET /api/logs
 * Returns recent log lines
 */
router.get('/', (req, res) => {
  try {
    // Check if log file exists
    if (!fs.existsSync(LOG_FILE_PATH)) {
      return res.json({
        lines: [],
        message: 'No logs available yet'
      });
    }

    // Read log file
    const content = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    
    // Split into lines and get last 100
    const allLines = content.split('\n').filter(line => line.trim() !== '');
    const recentLines = allLines.slice(-100);

    res.json({
      lines: recentLines,
      totalLines: allLines.length
    });
  } catch (error) {
    console.error('[LogsRoute] Error reading logs:', error);
    
    // Handle permission errors gracefully
    if (error.code === 'EACCES') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Cannot read log file due to insufficient permissions'
      });
    }

    res.status(500).json({
      error: 'Failed to read logs',
      message: error.message
    });
  }
});

module.exports = router;
