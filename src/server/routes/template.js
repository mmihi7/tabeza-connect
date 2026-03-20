/**
 * Template and Receipts API Routes
 * 
 * GET /api/template/status - Returns template existence and version
 * POST /api/template/generate - Initiates template generation workflow
 * GET /api/receipts/recent - Returns recent captured receipts
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const TEMPLATE_PATH = 'C:\\ProgramData\\Tabeza\\template.json';

/**
 * GET /api/template/status
 * Returns template file status
 */
router.get('/status', (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.json({
        exists: false,
        version: null,
        path: TEMPLATE_PATH
      });
    }

    // Read template to get version
    try {
      const content = fs.readFileSync(TEMPLATE_PATH, 'utf8');
      const template = JSON.parse(content);

      res.json({
        exists: true,
        version: template.version || 'unknown',
        posSystem: template.posSystem || 'unknown',
        path: TEMPLATE_PATH,
        patterns: Object.keys(template.patterns || {})
      });
    } catch (error) {
      // Template exists but is malformed
      res.json({
        exists: true,
        version: 'malformed',
        path: TEMPLATE_PATH,
        error: 'Template file is malformed'
      });
    }
  } catch (error) {
    console.error('[TemplateRoute] Error checking template status:', error);
    res.status(500).json({
      error: 'Failed to check template status',
      message: error.message
    });
  }
});

/**
 * POST /api/template/generate
 * Initiates template generation by sending receipts to cloud AI
 * 
 * Expected body: { receipts: [rawText1, rawText2, rawText3] }
 */
router.post('/generate', async (req, res) => {
  try {
    const { receipts } = req.body;

    // Validation: Must have exactly 3 receipts
    if (!receipts || !Array.isArray(receipts) || receipts.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Must provide exactly 3 receipt samples'
      });
    }

    // Validation: All receipts must be non-empty strings
    for (let i = 0; i < receipts.length; i++) {
      if (typeof receipts[i] !== 'string' || receipts[i].trim() === '') {
        return res.status(400).json({
          success: false,
          message: `Receipt ${i + 1} is empty or invalid`
        });
      }
    }

    const config = req.app.locals.config;
    if (!config || !config.apiUrl) {
      return res.status(500).json({
        success: false,
        message: 'API URL not configured'
      });
    }

    // Call cloud API to generate template
    const apiUrl = `${config.apiUrl}/api/receipts/generate-template`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test_receipts: receipts,
          bar_id: config.barId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();
      const template = result.template;

      if (!template || !template.patterns) {
        return res.status(500).json({
          success: false,
          message: 'Cloud API returned invalid template'
        });
      }

      // Save template to disk
      const templateDir = path.dirname(TEMPLATE_PATH);
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }

      fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(template, null, 2), 'utf8');

      res.json({
        success: true,
        message: 'Template generated and saved successfully',
        template: {
          version: template.version,
          posSystem: template.posSystem,
          patterns: Object.keys(template.patterns)
        }
      });
    } catch (apiError) {
      console.error('[TemplateRoute] Cloud API error:', apiError.message);
      
      // Handle specific API errors
      if (apiError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'Cannot connect to Tabeza cloud API. Check internet connection.'
        });
      }

      if (apiError.response) {
        return res.status(apiError.response.status).json({
          success: false,
          message: apiError.response.data?.message || 'Cloud API error',
          details: apiError.response.data
        });
      }

      throw apiError;
    }
  } catch (error) {
    console.error('[TemplateRoute] Error generating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message
    });
  }
});

/**
 * GET /api/receipts/recent
 * Returns recent captured receipts (from queue)
 */
router.get('/recent', (req, res) => {
  try {
    const captureService = req.app.locals.captureService;

    if (!captureService || !captureService.queueManager) {
      return res.status(500).json({
        error: 'Queue manager not initialized'
      });
    }

    const queueManager = captureService.queueManager;
    
    // Get recent receipts from both pending and uploaded folders
    const pendingPath = queueManager.pendingPath;
    const uploadedPath = queueManager.uploadedPath;

    const receipts = [];

    // Read pending receipts
    if (fs.existsSync(pendingPath)) {
      const pendingFiles = fs.readdirSync(pendingPath)
        .filter(f => f.endsWith('.json'))
        .slice(-10); // Last 10 pending

      pendingFiles.forEach(filename => {
        try {
          const filepath = path.join(pendingPath, filename);
          const content = fs.readFileSync(filepath, 'utf8');
          const data = JSON.parse(content);
          receipts.push({
            ...data,
            status: 'pending'
          });
        } catch (error) {
          // Skip corrupted files
        }
      });
    }

    // Read uploaded receipts
    if (fs.existsSync(uploadedPath)) {
      const uploadedFiles = fs.readdirSync(uploadedPath)
        .filter(f => f.endsWith('.json'))
        .slice(-10); // Last 10 uploaded

      uploadedFiles.forEach(filename => {
        try {
          const filepath = path.join(uploadedPath, filename);
          const content = fs.readFileSync(filepath, 'utf8');
          const data = JSON.parse(content);
          receipts.push({
            ...data,
            status: 'uploaded'
          });
        } catch (error) {
          // Skip corrupted files
        }
      });
    }

    // Sort by timestamp (most recent first)
    receipts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return last 20 receipts
    const recentReceipts = receipts.slice(0, 20);

    res.json({
      receipts: recentReceipts,
      count: recentReceipts.length
    });
  } catch (error) {
    console.error('[TemplateRoute] Error getting recent receipts:', error);
    res.status(500).json({
      error: 'Failed to get recent receipts',
      message: error.message
    });
  }
});

module.exports = router;
