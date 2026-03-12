/**
 * Automatic Template Generator
 * 
 * Automatically generates a receipt parsing template from the first 3 captured receipts.
 * This runs in the background without requiring user interaction.
 * 
 * Flow:
 * 1. Detects when no template exists
 * 2. Captures first 3 receipts automatically
 * 3. Sends them to cloud AI for template generation
 * 4. Saves generated template
 * 5. Notifies system to start parsing future receipts
 * 
 * Requirements: 12 (Template Generation Workflow)
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class AutoTemplateGenerator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = config;
    this.apiUrl = config.apiUrl || 'https://tabeza.co.ke';
    this.barId = config.barId;
    this.templatePath = config.templatePath || 'C:\\TabezaPrints\\templates\\template.json';
    
    // State
    this.isGenerating = false;
    this.capturedReceipts = [];
    this.requiredReceiptCount = 3;
    this.generationAttempts = 0;
    this.maxGenerationAttempts = 3;
    
    console.log('[AutoTemplateGenerator] Initialized');
  }
  
  /**
   * Check if template exists
   * @returns {Promise<boolean>} true if template exists
   */
  async templateExists() {
    try {
      await fs.access(this.templatePath);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Check if we need to generate a template
   * @returns {Promise<boolean>} true if template generation is needed
   */
  async needsTemplateGeneration() {
    const exists = await this.templateExists();
    return !exists && !this.isGenerating;
  }
  
  /**
   * Handle a captured receipt
   * Called by the service when a receipt is captured
   * 
   * @param {Object} receiptData - Receipt data
   * @param {string} receiptData.rawText - Plain text of the receipt
   * @param {string} receiptData.timestamp - Capture timestamp
   * @param {string} receiptData.captureFile - Path to capture file
   */
  async handleCapturedReceipt(receiptData) {
    try {
      // Check if we need to generate a template
      const needsGeneration = await this.needsTemplateGeneration();
      
      if (!needsGeneration) {
        // Template already exists or generation in progress
        return;
      }
      
      // Check if we already have this receipt
      const isDuplicate = this.capturedReceipts.some(r => 
        r.rawText === receiptData.rawText || 
        r.captureFile === receiptData.captureFile
      );
      
      if (isDuplicate) {
        console.log('[AutoTemplateGenerator] Skipping duplicate receipt');
        return;
      }
      
      // Add receipt to collection
      this.capturedReceipts.push({
        rawText: receiptData.rawText,
        timestamp: receiptData.timestamp,
        captureFile: receiptData.captureFile
      });
      
      console.log(`[AutoTemplateGenerator] Captured receipt ${this.capturedReceipts.length}/${this.requiredReceiptCount}`);
      
      // Emit progress event
      this.emit('progress', {
        count: this.capturedReceipts.length,
        required: this.requiredReceiptCount
      });
      
      // Check if we have enough receipts
      if (this.capturedReceipts.length >= this.requiredReceiptCount) {
        console.log('[AutoTemplateGenerator] Collected enough receipts, starting generation...');
        await this.generateTemplate();
      }
      
    } catch (error) {
      console.error('[AutoTemplateGenerator] Error handling captured receipt:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Generate template from captured receipts
   */
  async generateTemplate() {
    if (this.isGenerating) {
      console.log('[AutoTemplateGenerator] Generation already in progress');
      return;
    }
    
    if (this.capturedReceipts.length < this.requiredReceiptCount) {
      console.log(`[AutoTemplateGenerator] Not enough receipts: ${this.capturedReceipts.length}/${this.requiredReceiptCount}`);
      return;
    }
    
    this.isGenerating = true;
    this.generationAttempts++;
    
    console.log(`[AutoTemplateGenerator] Starting template generation (attempt ${this.generationAttempts}/${this.maxGenerationAttempts})`);
    
    // Emit generation started event
    this.emit('generationStarted', {
      receiptCount: this.capturedReceipts.length,
      attempt: this.generationAttempts
    });
    
    try {
      // Validate barId
      if (!this.barId) {
        throw new Error('barId not configured - cannot generate template');
      }
      
      // Extract raw text from receipts
      const receipts = this.capturedReceipts.map(r => r.rawText);
      
      // Call cloud API to generate template
      console.log('[AutoTemplateGenerator] Calling cloud API to generate template...');
      
      const apiUrl = `${this.apiUrl}/api/receipts/generate-template`;
      const payload = {
        barId: this.barId,
        receipts: receipts
      };
      
      const response = await this.callCloudAPI(apiUrl, payload);
      
      if (!response.success || !response.template) {
        throw new Error(response.message || 'Cloud API returned invalid response');
      }
      
      const template = response.template;
      
      console.log('[AutoTemplateGenerator] Template generated successfully');
      console.log(`[AutoTemplateGenerator] Template version: ${template.version}`);
      console.log(`[AutoTemplateGenerator] POS system: ${template.posSystem}`);
      
      // Save template to disk
      await this.saveTemplate(template);
      
      console.log(`[AutoTemplateGenerator] Template saved to: ${this.templatePath}`);
      
      // Emit success event
      this.emit('generationComplete', {
        template: {
          version: template.version,
          posSystem: template.posSystem,
          patterns: Object.keys(template.patterns || {})
        },
        receiptCount: this.capturedReceipts.length
      });
      
      // Reset state
      this.capturedReceipts = [];
      this.generationAttempts = 0;
      
    } catch (error) {
      console.error('[AutoTemplateGenerator] Template generation failed:', error.message);
      
      // Emit error event
      this.emit('generationFailed', {
        error: error.message,
        attempt: this.generationAttempts,
        maxAttempts: this.maxGenerationAttempts
      });
      
      // Check if we should retry
      if (this.generationAttempts < this.maxGenerationAttempts) {
        console.log(`[AutoTemplateGenerator] Will retry on next receipt capture`);
        // Keep captured receipts for retry
      } else {
        console.error(`[AutoTemplateGenerator] Max generation attempts reached (${this.maxGenerationAttempts})`);
        console.error('[AutoTemplateGenerator] Manual template generation required');
        
        // Reset state
        this.capturedReceipts = [];
        this.generationAttempts = 0;
        
        // Emit max attempts reached event
        this.emit('maxAttemptsReached', {
          error: error.message
        });
      }
      
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Call cloud API to generate template
   * @param {string} url - API URL
   * @param {Object} payload - Request payload
   * @returns {Promise<Object>} API response
   */
  async callCloudAPI(url, payload) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(JSON.stringify(payload))
        },
        timeout: 90000 // 90 second timeout for AI processing
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.message || `HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`API request failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('API request timed out after 90 seconds'));
      });
      
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
  
  /**
   * Save template to disk
   * @param {Object} template - Template object
   */
  async saveTemplate(template) {
    try {
      // Ensure directory exists
      const templateDir = path.dirname(this.templatePath);
      await fs.mkdir(templateDir, { recursive: true });
      
      // Write template file
      const templateJson = JSON.stringify(template, null, 2);
      await fs.writeFile(this.templatePath, templateJson, 'utf8');
      
      console.log(`[AutoTemplateGenerator] Template saved: ${this.templatePath}`);
      
    } catch (error) {
      console.error('[AutoTemplateGenerator] Failed to save template:', error);
      throw error;
    }
  }
  
  /**
   * Get current status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isGenerating: this.isGenerating,
      capturedCount: this.capturedReceipts.length,
      requiredCount: this.requiredReceiptCount,
      generationAttempts: this.generationAttempts,
      maxAttempts: this.maxGenerationAttempts
    };
  }
  
  /**
   * Reset state (for testing)
   */
  reset() {
    this.isGenerating = false;
    this.capturedReceipts = [];
    this.generationAttempts = 0;
    console.log('[AutoTemplateGenerator] State reset');
  }
}

module.exports = AutoTemplateGenerator;
