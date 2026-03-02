const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Simple HTTP server without axios dependency
class SimpleHTTPServer {
  constructor(config, service) {
    this.config = config;
    this.service = service;
    this.app = express();
    this.server = null;
    this.port = config.httpPort || 8765;
  }

  async start() {
    // Basic middleware
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));

    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // API Routes
    this.setupRoutes();

    // Start server
    return new Promise((resolve, reject) => {
      console.log(`=== PKG TEST: Attempting to bind to port: ${this.port} ===`);
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`=== PKG TEST: Simple HTTP server started on http://127.0.0.1:${this.port} ===`);
        resolve();
      });
      
      this.server.on('error', (err) => {
        console.error(`Failed to start HTTP server: ${err.message}`);
        console.error(`Error code: ${err.code}`);
        reject(err);
      });
    });
  }

  setupRoutes() {
    // Status endpoint
    this.app.get('/api/status', async (req, res) => {
      try {
        const stats = await this.service.getStats();
        res.json({
          success: true,
          data: {
            service: stats.service,
            queue: stats.queue,
            upload: stats.upload,
            parser: stats.parser,
            escpos: stats.escpos,
            system: {
              hostname: os.hostname(),
              platform: os.platform(),
              uptime: os.uptime(),
              memory: process.memoryUsage()
            }
          }
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Configuration endpoint
    this.app.get('/api/config', (req, res) => {
      res.json({
        success: true,
        data: {
          barId: this.config.barId,
          apiUrl: this.config.apiUrl,
          watchFolder: this.config.watchFolder,
          driverId: this.config.driverId,
          httpPort: this.config.httpPort
        }
      });
    });

    // Template endpoints
    this.app.get('/api/templates', (req, res) => {
      try {
        const templatePath = path.join('C:\\ProgramData\\Tabeza\\templates', 'template.json');
        if (fs.existsSync(templatePath)) {
          const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
          res.json({
            success: true,
            data: template
          });
        } else {
          res.json({
            success: true,
            data: null,
            message: 'No template found'
          });
        }
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    this.app.post('/api/templates', (req, res) => {
      try {
        const template = req.body;
        const templatesDir = 'C:\\ProgramData\\Tabeza\\templates';
        
        if (!fs.existsSync(templatesDir)) {
          fs.mkdirSync(templatesDir, { recursive: true });
        }
        
        const templatePath = path.join(templatesDir, 'template.json');
        fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
        
        res.json({
          success: true,
          message: 'Template saved successfully'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Template generation endpoint
    this.app.post('/api/template/generate', async (req, res) => {
      try {
        const { receipts } = req.body;
        
        if (!receipts || !Array.isArray(receipts) || receipts.length < 3) {
          return res.status(400).json({
            success: false,
            error: 'At least 3 sample receipts are required for template generation'
          });
        }

        // Call cloud API to generate template
        const apiUrl = `${this.config.apiUrl}/api/receipts/generate-template`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            receipts,
            barId: this.config.barId
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const result = await response.json();
        const template = result.template;

        if (!template || !template.patterns) {
          return res.status(500).json({
            success: false,
            error: 'Cloud API returned invalid template'
          });
        }

        // Save template to disk
        const templateDir = path.dirname('C:\\ProgramData\\Tabeza\\template.json');
        if (!fs.existsSync(templateDir)) {
          fs.mkdirSync(templateDir, { recursive: true });
        }

        fs.writeFileSync('C:\\ProgramData\\Tabeza\\template.json', JSON.stringify(template, null, 2), 'utf8');

        res.json({
          success: true,
          message: 'Template generated and saved successfully',
          template: {
            version: template.version,
            posSystem: template.posSystem,
            patterns: Object.keys(template.patterns)
          }
        });
      } catch (error) {
        console.error('[SimpleHTTPServer] Template generation error:', error);
        
        if (error.name === 'AbortError') {
          return res.status(504).json({
            success: false,
            error: 'Template generation timeout (60 seconds)'
          });
        }

        if (error.response) {
          return res.status(error.response.status || 500).json({
            success: false,
            error: `Cloud API error: ${error.response.status} ${error.response.statusText}`
          });
        }

        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Template HTML page
    this.app.get('/template.html', (req, res) => {
      try {
        // Serve a basic template generator inline
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tabeza Connect - Template Generator</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        textarea { width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; }
        .btn:hover { background: #0056b3; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧾 Template Generator</h1>
        <p>Create custom receipt parsing templates with AI</p>
        
        <div id="status" class="status" style="display: none;"></div>
        
        <form id="templateForm">
            <div class="form-group">
                <label for="templateName">Template Name:</label>
                <input type="text" id="templateName" value="Default Receipt Template" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div class="form-group">
                <label for="sampleReceipts">Sample Receipts (at least 3):</label>
                <textarea id="sampleReceipts" placeholder="Paste sample receipts here, one per line..."></textarea>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button type="button" class="btn" onclick="generateTemplate()">🤖 Generate Template</button>
                <button type="button" class="btn" onclick="saveTemplate()" style="margin-left: 10px;">💾 Save Template</button>
            </div>
        </form>
    </div>
    
    <script>
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = message;
            statusDiv.className = 'status ' + type;
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
        
        async function generateTemplate() {
            const receipts = document.getElementById('sampleReceipts').value.trim().split('\\n').filter(r => r.trim());
            
            if (receipts.length < 3) {
                showStatus('Please provide at least 3 sample receipts', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/template/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ receipts })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Template generated successfully!', 'success');
                } else {
                    showStatus('Template generation failed: ' + result.error, 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
        
        async function saveTemplate() {
            const templateName = document.getElementById('templateName').value;
            
            if (!templateName.trim()) {
                showStatus('Please enter a template name', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: templateName })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Template saved successfully!', 'success');
                } else {
                    showStatus('Failed to save template: ' + result.error, 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Queue management
    this.app.get('/api/queue', async (req, res) => {
      try {
        const stats = await this.service.localQueue.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Test print endpoint
    this.app.post('/api/test-print', (req, res) => {
      try {
        const testData = req.body;
        const orderPrnPath = path.join(this.config.watchFolder, 'order.prn');
        
        // Create test receipt data
        const testReceipt = `TEST RECEIPT
================
Date: ${new Date().toLocaleString()}
Bar ID: ${this.config.barId}
Test Data: ${JSON.stringify(testData)}
================`;

        fs.writeFileSync(orderPrnPath, testReceipt);
        
        res.json({
          success: true,
          message: 'Test print sent to order.prn'
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message
        });
      }
    });

    // Serve static files for Management UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../server/public/index.html'));
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

module.exports = SimpleHTTPServer;
