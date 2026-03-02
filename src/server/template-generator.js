const express = require('express');
const path = require('path');
const fs = require('fs');

// Add template generator route to existing HTTP server
function addTemplateGeneratorRoutes(app, service) {
  
  // Template generator page
  app.get('/template-generator', (req, res) => {
    const templateHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Tabeza POS - Receipt Template Generator</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        input, textarea, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        textarea { height: 100px; resize: vertical; }
        .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; margin-right: 10px; }
        .btn:hover { background: #0056b3; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #1e7e34; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; }
        .preview { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; margin-top: 20px; }
        .field-mapping { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧾 Receipt Template Generator</h1>
        
        <div id="status" class="status" style="display: none;"></div>
        
        <form id="templateForm">
          <div class="form-group">
            <label for="templateName">Template Name:</label>
            <input type="text" id="templateName" value="Default Receipt Template" required>
          </div>
          
          <div class="form-group">
            <label for="barId">Bar ID:</label>
            <input type="text" id="barId" value="438c80c1-fe11-4ac5-8a48-2fc45104ba31" required>
          </div>
          
          <div class="field-mapping">
            <div class="form-group">
              <label for="orderNumberRegex">Order Number Pattern:</label>
              <input type="text" id="orderNumberRegex" value="Order\\s*#?\\s*(\\d+)" placeholder="Regex to extract order number">
            </div>
            
            <div class="form-group">
              <label for="totalRegex">Total Amount Pattern:</label>
              <input type="text" id="totalRegex" value="TOTAL\\s*[:]?\\s*KES\\s*([\\d,]+\\.?\\d*)" placeholder="Regex to extract total">
            </div>
            
            <div class="form-group">
              <label for="dateRegex">Date Pattern:</label>
              <input type="text" id="dateRegex" value="(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})" placeholder="Regex to extract date">
            </div>
            
            <div class="form-group">
              <label for="timeRegex">Time Pattern:</label>
              <input type="text" id="timeRegex" value="(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)?)"> placeholder="Regex to extract time">
            </div>
          </div>
          
          <div class="form-group">
            <label for="sampleReceipt">Sample Receipt Text:</label>
            <textarea id="sampleReceipt" placeholder="Paste a sample receipt here for testing...">ORDER #1234
DATE: 03/02/2026
TIME: 3:45 PM
ITEM 1     KES 150.00
ITEM 2     KES 200.00
TOTAL KES 350.00</textarea>
          </div>
          
          <div class="preview">
            <h3>Preview Results:</h3>
            <div id="previewResults">Test your template above...</div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <button type="button" class="btn" onclick="testTemplate()">🧪 Test Template</button>
            <button type="submit" class="btn btn-success">💾 Save Template</button>
            <button type="button" class="btn btn-danger" onclick="clearTemplate()">🗑️ Clear</button>
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
        
        function testTemplate() {
          const template = {
            name: document.getElementById('templateName').value,
            barId: document.getElementById('barId').value,
            patterns: {
              orderNumber: document.getElementById('orderNumberRegex').value,
              total: document.getElementById('totalRegex').value,
              date: document.getElementById('dateRegex').value,
              time: document.getElementById('timeRegex').value
            }
          };
          
          const sampleText = document.getElementById('sampleReceipt').value;
          
          // Test the template
          const results = {
            orderNumber: extractField(sampleText, template.patterns.orderNumber),
            total: extractField(sampleText, template.patterns.total),
            date: extractField(sampleText, template.patterns.date),
            time: extractField(sampleText, template.patterns.time)
          };
          
          const previewDiv = document.getElementById('previewResults');
          previewDiv.innerHTML = \`
            <strong>Extracted Data:</strong><br>
            Order Number: \${results.orderNumber || 'Not found'}<br>
            Total: KES \${results.total || 'Not found'}<br>
            Date: \${results.date || 'Not found'}<br>
            Time: \${results.time || 'Not found'}
          \`;
          
          showStatus('Template tested successfully!', 'success');
        }
        
        function extractField(text, regex) {
          try {
            const match = text.match(new RegExp(regex, 'i'));
            return match ? match[1] || match[0] : null;
          } catch (e) {
            return null;
          }
        }
        
        async function saveTemplate() {
          const template = {
            name: document.getElementById('templateName').value,
            barId: document.getElementById('barId').value,
            patterns: {
              orderNumber: document.getElementById('orderNumberRegex').value,
              total: document.getElementById('totalRegex').value,
              date: document.getElementById('dateRegex').value,
              time: document.getElementById('timeRegex').value
            },
            version: "1.0",
            created: new Date().toISOString()
          };
          
          try {
            const response = await fetch('/api/templates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(template)
            });
            
            if (response.ok) {
              showStatus('Template saved successfully!', 'success');
            } else {
              showStatus('Failed to save template', 'error');
            }
          } catch (error) {
            showStatus('Error saving template: ' + error.message, 'error');
          }
        }
        
        function clearTemplate() {
          document.getElementById('templateForm').reset();
          document.getElementById('previewResults').innerHTML = 'Test your template above...';
        }
        
        // Form submission
        document.getElementById('templateForm').addEventListener('submit', (e) => {
          e.preventDefault();
          saveTemplate();
        });
        
        // Auto-test on field changes
        document.querySelectorAll('input[type="text"], textarea').forEach(field => {
          field.addEventListener('input', () => {
            if (document.getElementById('sampleReceipt').value) {
              testTemplate();
            }
          });
        });
      </script>
    </body>
    </html>
    `;
    
    res.send(templateHTML);
  });
  
  // Add template generator API endpoint
  app.post('/api/templates', (req, res) => {
    try {
      const template = req.body;
      
      // Save template to file system
      const templatesDir = 'C:\\ProgramData\\Tabeza\\templates';
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      
      const templatePath = path.join(templatesDir, 'template.json');
      fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
      
      res.json({ 
        success: true, 
        message: 'Template saved successfully',
        path: templatePath 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
  
  console.log('✅ Template generator routes added');
}

module.exports = addTemplateGeneratorRoutes;
