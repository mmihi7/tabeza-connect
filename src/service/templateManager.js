/**
 * Template Manager
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to venue — never the reverse.
 * 
 * This module handles template operations including loading, saving,
 * and AI-powered template generation using DeepSeek API.
 * 
 * Template Storage: C:\ProgramData\Tabeza\template.json
 * API Endpoint: https://api.tabeza.co.ke/api/template/generate
 * 
 * Requirements: Design "Component 6: Template Generator", "Function 3: generateParsingTemplate()"
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class TemplateManager {
  constructor(options = {}) {
    this.templatePath = options.templatePath || path.join('C:', 'ProgramData', 'Tabeza', 'template.json');
    this.apiUrl = options.apiUrl || 'https://api.tabeza.co.ke'; // This should be the Tabeza API URL
    this.deepseekApiUrl = 'https://api.deepseek.com/v1'; // DeepSeek API URL
    this.apiKey = options.apiKey || null;
    
    // Current template in memory
    this.currentTemplate = null;
    
    // Statistics
    this.stats = {
      templatesGenerated: 0,
      templatesSaved: 0,
      templatesLoaded: 0,
      apiCalls: 0,
      apiErrors: 0,
      lastGenerated: null,
      lastSaved: null,
      lastLoaded: null,
    };
  }

  /**
   * Initialize template manager
   */
  async initialize() {
    console.log('🔧 Initializing template manager...');
    
    try {
      await this.ensureTemplateDirectory();
      await this.loadCurrentTemplate();
      console.log('✅ Template manager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize template manager:', error.message);
      throw error;
    }
  }

  /**
   * Ensure template directory exists
   */
  async ensureTemplateDirectory() {
    const templateDir = path.dirname(this.templatePath);
    try {
      await fs.access(templateDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`📁 Creating template directory: ${templateDir}`);
        await fs.mkdir(templateDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Load current template from disk
   */
  async loadCurrentTemplate() {
    try {
      const templateData = await fs.readFile(this.templatePath, 'utf8');
      this.currentTemplate = JSON.parse(templateData);
      
      this.stats.templatesLoaded++;
      this.stats.lastLoaded = new Date().toISOString();
      
      console.log(`✅ Template loaded: ${this.currentTemplate.name || 'Unknown'}`);
      console.log(`   Version: ${this.currentTemplate.version || 'Unknown'}`);
      console.log(`   Fields: ${this.currentTemplate.fields?.length || 0}`);
      
      return this.currentTemplate;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn('⚠️  No existing template found');
        this.currentTemplate = null;
        return null;
      } else {
        throw new Error(`Failed to load template: ${error.message}`);
      }
    }
  }

  /**
   * Generate template using DeepSeek API
   * 
   * @param {Array<string>} sampleReceipts - Array of sample receipt texts
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated template
   */
  async generateTemplate(sampleReceipts, options = {}) {
    if (!sampleReceipts || sampleReceipts.length === 0) {
      throw new Error('At least one sample receipt is required');
    }

    if (!this.apiKey) {
      throw new Error('API key is required for template generation');
    }

    console.log(`🤖 Generating template from ${sampleReceipts.length} sample receipts...`);
    
    try {
      // Call DeepSeek API for template generation
      const prompt = `Generate a JSON receipt parsing template from these sample receipts. 
The template should extract common fields like total, date, items, payment method, etc.
Return only valid JSON with this structure:
{
  "name": "Generated Template",
  "version": "1.0.0",
  "fields": [
    {
      "name": "field_name",
      "type": "text|number|date|array",
      "pattern": "regex_pattern",
      "required": true|false
    }
  ]
}

Sample receipts:
${sampleReceipts.map((sample, i) => `Sample ${i + 1}:\n${sample}`).join('\n\n')}`;

      const requestData = {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a receipt parsing expert. Generate regex patterns to extract data from thermal printer receipts. Return only valid JSON."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      };

      const response = await this.callDeepSeekAPI('/chat/completions', 'POST', requestData);
      const aiResponse = JSON.parse(response);
      
      if (!aiResponse.choices || !aiResponse.choices[0]?.message?.content) {
        throw new Error('Invalid response from DeepSeek API');
      }
      
      // Extract JSON from AI response
      const content = aiResponse.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const generatedTemplate = JSON.parse(jsonMatch[0]);

      // Normalize field names - ensure all fields have 'pattern' property
      if (generatedTemplate.fields) {
        generatedTemplate.fields = generatedTemplate.fields.map(field => ({
          ...field,
          pattern: field.pattern || field.regex, // Use pattern or fallback to regex
          regex: undefined // Remove regex property to avoid confusion
        }));
      }

      // Validate generated template
      this.validateTemplate(generatedTemplate);

      // Add metadata
      generatedTemplate.generatedAt = new Date().toISOString();
      generatedTemplate.generatedFrom = sampleReceipts.length;
      generatedTemplate.version = this.getNextVersion();

      this.stats.templatesGenerated++;
      this.stats.lastGenerated = new Date().toISOString();

      console.log(`✅ Template generated: ${generatedTemplate.name}`);
      console.log(`   Fields: ${generatedTemplate.fields?.length || 0}`);
      console.log(`   Confidence: ${generatedTemplate.confidence || 'Unknown'}`);

      return {
        success: true,
        template: generatedTemplate,
        metadata: {
          generatedAt: new Date().toISOString(),
          samplesUsed: sampleReceipts.length,
          fieldsGenerated: generatedTemplate.fields?.length || 0
        }
      };

    } catch (error) {
      this.stats.apiErrors++;
      throw new Error(`Template generation failed: ${error.message}`);
    }
  }

  /**
   * Test template against sample receipts
   * 
   * @param {Object} template - Template to test
   * @param {Array<string>} testSamples - Test sample receipts
   * @returns {Promise<Object>} - Test results
   */
  async testTemplate(template, testSamples) {
    if (!template || !template.fields) {
      throw new Error('Invalid template for testing');
    }

    if (!testSamples || testSamples.length === 0) {
      throw new Error('Test samples are required');
    }

    console.log(`🧪 Testing template against ${testSamples.length} samples...`);

    const results = {
      template: {
        name: template.name,
        version: template.version,
        fields: template.fields.length
      },
      samples: testSamples.length,
      tests: [],
      summary: {
        total: testSamples.length,
        successful: 0,
        failed: 0,
        avgConfidence: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        issues: []
      }
    };

    let totalConfidence = 0;

    for (let i = 0; i < testSamples.length; i++) {
      const sample = testSamples[i];
      const testResult = this.testSingleSample(template, sample);
      
      results.tests.push({
        sampleIndex: i,
        success: testResult.success,
        confidence: testResult.confidence,
        extractedFields: testResult.extractedFields,
        missingFields: testResult.missingFields,
        issues: testResult.issues
      });

      if (testResult.success) {
        results.summary.successful++;
      } else {
        results.summary.failed++;
      }

      totalConfidence += testResult.confidence;

      // Categorize confidence levels
      if (testResult.confidence >= 80) {
        results.summary.highConfidence++;
      } else if (testResult.confidence >= 60) {
        results.summary.mediumConfidence++;
      } else {
        results.summary.lowConfidence++;
      }

      // Collect common issues
      results.summary.issues.push(...testResult.issues);
    }

    results.summary.avgConfidence = Math.round(totalConfidence / testSamples.length);
    
    // Remove duplicate issues
    results.summary.issues = [...new Set(results.summary.issues)];

    console.log(`✅ Template testing complete`);
    console.log(`   Success rate: ${Math.round((results.summary.successful / results.summary.total) * 100)}%`);
    console.log(`   Avg confidence: ${results.summary.avgConfidence}%`);

    return results;
  }

  /**
   * Test a single sample against template
   * 
   * @param {Object} template - Template to test
   * @param {string} sample - Sample receipt text
   * @returns {Object} - Test result
   */
  testSingleSample(template, sample) {
    const result = {
      success: false,
      confidence: 0,
      extractedFields: [],
      missingFields: [],
      issues: []
    };

    try {
      let fieldMatches = 0;
      let totalConfidence = 0;

      for (const field of template.fields) {
        try {
          const regex = new RegExp(field.regex, 'gim');
          const matches = [...sample.matchAll(regex)];
          
          if (matches.length > 0) {
            result.extractedFields.push(field.name);
            fieldMatches++;
            
            // Calculate field confidence
            const fieldConfidence = this.calculateFieldConfidence(sample, field, matches);
            totalConfidence += fieldConfidence;
          } else if (field.required) {
            result.missingFields.push(field.name);
            result.issues.push(`Missing required field: ${field.name}`);
          }
        } catch (regexError) {
          result.issues.push(`Invalid regex for field ${field.name}: ${regexError.message}`);
        }
      }

      result.confidence = template.fields.length > 0 
        ? Math.round(totalConfidence / template.fields.length)
        : 0;
      
      result.success = result.issues.length === 0 && fieldMatches > 0;

    } catch (error) {
      result.issues.push(`Test error: ${error.message}`);
    }

    return result;
  }

  /**
   * Calculate confidence score for field match
   * 
   * @param {string} sample - Sample text
   * @param {Object} field - Field configuration
   * @param {Array} matches - Regex matches
   * @returns {number} - Confidence score (0-100)
   */
  calculateFieldConfidence(sample, field, matches) {
    let confidence = 50; // Base confidence
    
    // Boost for required fields
    if (field.required) {
      confidence += 20;
    }
    
    // Boost for multiple matches (good for arrays)
    if (matches.length > 1) {
      confidence += Math.min(matches.length * 5, 20);
    }
    
    // Boost for exact text matches
    if (field.type === 'text' && matches[0] && sample.includes(matches[0][0])) {
      confidence += 15;
    }
    
    // Boost for valid numbers
    if (field.type === 'number') {
      const hasValidNumber = matches.some(match => {
        const numStr = match[1] || match[0];
        return !isNaN(parseFloat(numStr.replace(/[^0-9.]/g, '')));
      });
      if (hasValidNumber) {
        confidence += 15;
      }
    }
    
    return Math.min(confidence, 100);
  }

  /**
   * Save template to disk
   * 
   * @param {Object} template - Template to save
   * @returns {Promise<void>}
   */
  async saveTemplate(template) {
    try {
      this.validateTemplate(template);
      
      // Add metadata
      template.savedAt = new Date().toISOString();
      template.version = template.version || this.getNextVersion();
      
      const templateData = JSON.stringify(template, null, 2);
      await fs.writeFile(this.templatePath, templateData, 'utf8');
      
      this.currentTemplate = template;
      this.stats.templatesSaved++;
      this.stats.lastSaved = new Date().toISOString();
      
      console.log(`✅ Template saved: ${template.name || 'Unknown'}`);
      console.log(`   Version: ${template.version}`);
      console.log(`   Fields: ${template.fields?.length || 0}`);
      
      return {
        success: true,
        path: this.templatePath,
        template: template
      };
      
    } catch (error) {
      console.error('Template save error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate template structure
   * 
   * @param {Object} template - Template to validate
   * @throws {Error} - If template is invalid
   */
  validateTemplate(template) {
    if (!template || typeof template !== 'object') {
      throw new Error('Template must be an object');
    }

    if (!template.fields || !Array.isArray(template.fields)) {
      throw new Error('Template must have fields array');
    }

    if (template.fields.length === 0) {
      throw new Error('Template must have at least one field');
    }

    // Validate each field
    template.fields.forEach((field, index) => {
      if (!field.name || typeof field.name !== 'string') {
        throw new Error(`Field ${index} must have a name`);
      }

      // Accept both 'pattern' and 'regex' field names
      const regexPattern = field.pattern || field.regex;
      if (!regexPattern || typeof regexPattern !== 'string') {
        throw new Error(`Field ${field.name} must have a regex pattern`);
      }

      // Test regex validity
      try {
        new RegExp(regexPattern);
      } catch (regexError) {
        throw new Error(`Invalid regex for field ${field.name}: ${regexError.message}`);
      }

      if (!field.type || !['text', 'number', 'date', 'array'].includes(field.type)) {
        throw new Error(`Field ${field.name} has invalid type: ${field.type}`);
      }
    });
  }

  /**
   * Get next version number
   * 
   * @returns {string} - Next version
   */
  getNextVersion() {
    if (this.currentTemplate && this.currentTemplate.version) {
      const currentVersion = this.currentTemplate.version;
      const match = currentVersion.match(/(\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        return `${major}.${minor + 1}`;
      }
    }
    return '1.0';
  }

  /**
   * Call DeepSeek API endpoint
   * 
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Promise<string>} - Response data
   */
  async callDeepSeekAPI(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = `${this.deepseekApiUrl}${endpoint}`;
      
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'TabezaConnect/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          this.stats.apiCalls++;
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            this.stats.apiErrors++;
            reject(new Error(`DeepSeek API error: ${res.statusCode} - ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        this.stats.apiErrors++;
        reject(new Error(`DeepSeek API request failed: ${error.message}`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Call API endpoint
   * 
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Promise<string>} - Response data
   */
  async callAPI(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = `${this.apiUrl}${endpoint}`;
      
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'TabezaConnect/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          this.stats.apiCalls++;
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`API request failed: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        this.stats.apiErrors++;
        reject(new Error(`API request error: ${error.message}`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Get current template
   * 
   * @returns {Object|null} - Current template
   */
  getCurrentTemplate() {
    return this.currentTemplate;
  }

  /**
   * Check if template exists
   * 
   * @returns {Promise<boolean>} - True if template exists
   */
  async hasTemplate() {
    try {
      await fs.access(this.templatePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get template statistics
   * 
   * @returns {Object} - Template manager statistics
   */
  getStats() {
    return {
      ...this.stats,
      templatePath: this.templatePath,
      hasCurrentTemplate: !!this.currentTemplate,
      currentTemplateInfo: this.currentTemplate ? {
        name: this.currentTemplate.name,
        version: this.currentTemplate.version,
        fields: this.currentTemplate.fields?.length || 0
      } : null,
      apiSuccessRate: this.stats.apiCalls > 0 
        ? Math.round(((this.stats.apiCalls - this.stats.apiErrors) / this.stats.apiCalls) * 100)
        : 0
    };
  }

  /**
   * Set API key
   * 
   * @param {string} apiKey - API key
   */
  setAPIKey(apiKey) {
    this.apiKey = apiKey;
    console.log('🔑 API key updated');
  }

  /**
   * Set API URL
   * 
   * @param {string} apiUrl - API base URL
   */
  setAPIUrl(apiUrl) {
    this.apiUrl = apiUrl;
    console.log(`🌐 API URL updated: ${apiUrl}`);
  }
}

module.exports = TemplateManager;
