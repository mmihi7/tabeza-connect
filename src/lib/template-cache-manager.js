/**
 * Template Cache Manager
 * 
 * Manages template downloads, caching, validation, and automatic updates.
 * Implements offline-first architecture with daily update checks.
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Requirements: Requirement 5 (Template Caching and Updates)
 * Design: Component 6 (Template Cache Manager)
 * 
 * Features:
 * - Template download from cloud API
 * - Local template caching
 * - Template validation
 * - Daily update check scheduler
 * - Offline fallback to cached template
 * - Version tracking
 * 
 * @module template-cache-manager
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { EventEmitter } = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE_PATH = path.join('C:', 'ProgramData', 'Tabeza', 'template.json');
const DEFAULT_API_URL = 'https://tabeza.co.ke';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const UPDATE_CHECK_TIME = { hour: 3, minute: 0 }; // 3:00 AM local time
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds
const RETRY_DELAYS = [5000, 10000, 20000]; // Exponential backoff for retries

// ─────────────────────────────────────────────────────────────────────────────
// TemplateCacheManager Class
// ─────────────────────────────────────────────────────────────────────────────

class TemplateCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.templatePath = options.templatePath || DEFAULT_TEMPLATE_PATH;
    this.apiUrl = options.apiUrl || DEFAULT_API_URL;
    this.barId = options.barId || null;
    
    // State
    this.cachedTemplate = null;
    this.lastUpdateCheck = null;
    this.updateCheckTimer = null;
    this.isInitialized = false;
    
    // Statistics
    this.stats = {
      downloadsAttempted: 0,
      downloadsSucceeded: 0,
      downloadsFailed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastDownloadAttempt: null,
      lastDownloadSuccess: null,
      lastValidation: null,
    };
    
    console.log('[TemplateCacheManager] Instance created', {
      templatePath: this.templatePath,
      apiUrl: this.apiUrl,
    });
  }
  
  /**
   * Initialize the template cache manager
   * Loads cached template and schedules update checks
   * 
   * Requirements: 5.2, 5.3
   * 
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[TemplateCacheManager] Already initialized');
      return { success: true, cached: true };
    }
    
    console.log('[TemplateCacheManager] Initializing...');
    
    try {
      // Ensure template directory exists
      await this._ensureTemplateDirectory();
      
      // Try to load cached template
      const hasCache = await this._loadCachedTemplate();
      
      // If no cached template exists, try to download
      if (!hasCache) {
        console.log('[TemplateCacheManager] No cached template found, attempting download');
        await this.updateTemplate();
      }
      
      // Schedule daily update checks
      this._scheduleUpdateChecks();
      
      this.isInitialized = true;
      
      console.log('[TemplateCacheManager] Initialization complete', {
        hasCachedTemplate: !!this.cachedTemplate,
        version: this.cachedTemplate?.version,
      });
      
      this.emit('initialized', {
        success: true,
        hasCachedTemplate: !!this.cachedTemplate,
      });
      
      return {
        success: true,
        hasCachedTemplate: !!this.cachedTemplate,
        template: this.cachedTemplate,
      };
      
    } catch (error) {
      console.error('[TemplateCacheManager] Initialization failed:', error.message);
      this.emit('error', {
        type: 'initialization',
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Load template from cache or download if needed
   * Implements offline-first strategy
   * 
   * Requirements: 5.3, 5.4, 5.7
   * 
   * @returns {Promise<Object>} Template object
   */
  async loadTemplate() {
    // If we have a cached template, return it immediately
    if (this.cachedTemplate) {
      this.stats.cacheHits++;
      console.log('[TemplateCacheManager] Returning cached template', {
        version: this.cachedTemplate.version,
        cacheHits: this.stats.cacheHits,
      });
      return this.cachedTemplate;
    }
    
    this.stats.cacheMisses++;
    
    // Try to load from disk
    const loaded = await this._loadCachedTemplate();
    if (loaded) {
      console.log('[TemplateCacheManager] Loaded template from disk');
      return this.cachedTemplate;
    }
    
    // No cached template - try to download
    console.log('[TemplateCacheManager] No cached template, attempting download');
    const downloadResult = await this.updateTemplate();
    
    if (downloadResult.success) {
      return this.cachedTemplate;
    }
    
    // Download failed and no cache available
    throw new Error('No template available: download failed and no cached version exists');
  }
  
  /**
   * Download template from cloud API
   * Implements retry logic with exponential backoff
   * 
   * Requirements: 5.1, 5.2
   * 
   * @param {number} retryCount - Current retry attempt (internal use)
   * @returns {Promise<Object>} Download result
   */
  async downloadTemplate(retryCount = 0) {
    if (!this.barId) {
      throw new Error('Bar ID is required for template download');
    }
    
    this.stats.downloadsAttempted++;
    this.stats.lastDownloadAttempt = new Date().toISOString();
    
    const endpoint = `/api/receipts/template/${this.barId}`;
    const url = `${this.apiUrl}${endpoint}`;
    
    console.log('[TemplateCacheManager] Downloading template', {
      url,
      attempt: retryCount + 1,
    });
    
    try {
      const response = await this._httpRequest(url, {
        method: 'GET',
        timeout: DOWNLOAD_TIMEOUT,
      });
      
      const template = JSON.parse(response);
      
      // Validate downloaded template
      this._validateTemplate(template);
      
      this.stats.downloadsSucceeded++;
      this.stats.lastDownloadSuccess = new Date().toISOString();
      
      console.log('[TemplateCacheManager] Template downloaded successfully', {
        version: template.version,
        posSystem: template.posSystem,
      });
      
      this.emit('template-downloaded', {
        version: template.version,
        posSystem: template.posSystem,
      });
      
      return {
        success: true,
        template,
      };
      
    } catch (error) {
      this.stats.downloadsFailed++;
      
      console.error('[TemplateCacheManager] Template download failed', {
        error: error.message,
        attempt: retryCount + 1,
      });
      
      // Retry with exponential backoff
      if (retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryCount];
        console.log(`[TemplateCacheManager] Retrying in ${delay}ms...`);
        
        await this._sleep(delay);
        return this.downloadTemplate(retryCount + 1);
      }
      
      // All retries exhausted
      this.emit('download-failed', {
        error: error.message,
        attempts: retryCount + 1,
      });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Update template (download and cache)
   * Downloads new template and saves to cache
   * 
   * Requirements: 5.1, 5.3, 5.5
   * 
   * @returns {Promise<Object>} Update result
   */
  async updateTemplate() {
    console.log('[TemplateCacheManager] Checking for template updates...');
    
    try {
      // Download template from cloud
      const downloadResult = await this.downloadTemplate();
      
      if (!downloadResult.success) {
        console.warn('[TemplateCacheManager] Template download failed, using cached version');
        return {
          success: false,
          error: downloadResult.error,
          usingCache: !!this.cachedTemplate,
        };
      }
      
      const newTemplate = downloadResult.template;
      
      // Check if this is a newer version
      if (this.cachedTemplate && this.cachedTemplate.version === newTemplate.version) {
        console.log('[TemplateCacheManager] Template is up to date', {
          version: newTemplate.version,
        });
        
        this.lastUpdateCheck = new Date().toISOString();
        
        return {
          success: true,
          updated: false,
          version: newTemplate.version,
        };
      }
      
      // Save new template to cache
      await this._saveToCacheFile(newTemplate);
      
      // Update in-memory cache
      this.cachedTemplate = newTemplate;
      this.lastUpdateCheck = new Date().toISOString();
      
      console.log('[TemplateCacheManager] Template updated successfully', {
        oldVersion: this.cachedTemplate?.version || 'none',
        newVersion: newTemplate.version,
      });
      
      this.emit('template-updated', {
        oldVersion: this.cachedTemplate?.version || 'none',
        newVersion: newTemplate.version,
      });
      
      return {
        success: true,
        updated: true,
        oldVersion: this.cachedTemplate?.version || 'none',
        newVersion: newTemplate.version,
      };
      
    } catch (error) {
      console.error('[TemplateCacheManager] Template update failed:', error.message);
      
      this.emit('update-failed', {
        error: error.message,
      });
      
      return {
        success: false,
        error: error.message,
        usingCache: !!this.cachedTemplate,
      };
    }
  }
  
  /**
   * Get template information
   * Returns metadata about the current template
   * 
   * Requirements: 5.8
   * 
   * @returns {Object} Template information
   */
  getTemplateInfo() {
    if (!this.cachedTemplate) {
      return {
        exists: false,
        version: null,
        posSystem: null,
        lastUpdate: null,
        lastCheck: this.lastUpdateCheck,
      };
    }
    
    return {
      exists: true,
      version: this.cachedTemplate.version,
      posSystem: this.cachedTemplate.posSystem,
      lastUpdate: this.cachedTemplate.lastUpdated,
      lastCheck: this.lastUpdateCheck,
      patternsCount: Object.keys(this.cachedTemplate.patterns || {}).length,
      confidenceThreshold: this.cachedTemplate.confidence_threshold,
    };
  }
  
  /**
   * Get current cached template
   * 
   * @returns {Object|null} Cached template or null
   */
  getCachedTemplate() {
    return this.cachedTemplate;
  }
  
  /**
   * Check if template exists in cache
   * 
   * @returns {boolean} True if template exists
   */
  hasTemplate() {
    return !!this.cachedTemplate;
  }
  
  /**
   * Get statistics
   * 
   * @returns {Object} Manager statistics
   */
  getStats() {
    return {
      ...this.stats,
      hasTemplate: this.hasTemplate(),
      templateInfo: this.getTemplateInfo(),
      downloadSuccessRate: this.stats.downloadsAttempted > 0
        ? Math.round((this.stats.downloadsSucceeded / this.stats.downloadsAttempted) * 100)
        : 0,
      validationSuccessRate: this.stats.validationsPassed + this.stats.validationsFailed > 0
        ? Math.round((this.stats.validationsPassed / (this.stats.validationsPassed + this.stats.validationsFailed)) * 100)
        : 0,
    };
  }
  
  /**
   * Set Bar ID
   * 
   * @param {string} barId - Venue Bar ID
   */
  setBarId(barId) {
    this.barId = barId;
    console.log('[TemplateCacheManager] Bar ID updated:', barId);
  }
  
  /**
   * Stop the manager and clean up resources
   */
  stop() {
    if (this.updateCheckTimer) {
      clearTimeout(this.updateCheckTimer);
      this.updateCheckTimer = null;
      console.log('[TemplateCacheManager] Update check timer stopped');
    }
    
    this.isInitialized = false;
    this.emit('stopped');
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ───────────────────────────────────────────────────────────────────────────
  
  /**
   * Ensure template directory exists
   * 
   * @private
   */
  async _ensureTemplateDirectory() {
    const templateDir = path.dirname(this.templatePath);
    
    try {
      await fs.access(templateDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[TemplateCacheManager] Creating template directory:', templateDir);
        await fs.mkdir(templateDir, { recursive: true });
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Load template from cache file
   * 
   * Requirements: 5.3, 5.4
   * 
   * @private
   * @returns {Promise<boolean>} True if template was loaded
   */
  async _loadCachedTemplate() {
    try {
      const templateData = await fs.readFile(this.templatePath, 'utf8');
      const template = JSON.parse(templateData);
      
      // Validate cached template
      this._validateTemplate(template);
      
      this.cachedTemplate = template;
      
      console.log('[TemplateCacheManager] Cached template loaded', {
        version: template.version,
        posSystem: template.posSystem,
      });
      
      return true;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[TemplateCacheManager] No cached template file found');
        return false;
      }
      
      console.error('[TemplateCacheManager] Failed to load cached template:', error.message);
      return false;
    }
  }
  
  /**
   * Save template to cache file
   * Uses atomic write pattern to prevent corruption
   * 
   * Requirements: 5.3
   * 
   * @private
   * @param {Object} template - Template to save
   */
  async _saveToCacheFile(template) {
    const tempPath = `${this.templatePath}.tmp`;
    
    try {
      // Write to temporary file
      await fs.writeFile(tempPath, JSON.stringify(template, null, 2), 'utf8');
      
      // Atomic rename
      await fs.rename(tempPath, this.templatePath);
      
      console.log('[TemplateCacheManager] Template saved to cache:', this.templatePath);
      
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      throw new Error(`Failed to save template to cache: ${error.message}`);
    }
  }
  
  /**
   * Validate template structure
   * 
   * Requirements: 5.6
   * 
   * @private
   * @param {Object} template - Template to validate
   * @throws {Error} If template is invalid
   */
  _validateTemplate(template) {
    this.stats.lastValidation = new Date().toISOString();
    
    try {
      // Check basic structure
      if (!template || typeof template !== 'object') {
        throw new Error('Template must be an object');
      }
      
      // Check required fields
      if (!template.version || typeof template.version !== 'string') {
        throw new Error('Template must have a version string');
      }
      
      if (!template.patterns || typeof template.patterns !== 'object') {
        throw new Error('Template must have a patterns object');
      }
      
      // Validate patterns
      const requiredPatterns = ['item_line', 'total_line', 'receipt_number'];
      for (const patternName of requiredPatterns) {
        if (!template.patterns[patternName]) {
          throw new Error(`Template missing required pattern: ${patternName}`);
        }
        
        // Test regex validity
        try {
          new RegExp(template.patterns[patternName]);
        } catch (regexError) {
          throw new Error(`Invalid regex for pattern ${patternName}: ${regexError.message}`);
        }
      }
      
      // Validate confidence threshold
      if (template.confidence_threshold !== undefined) {
        const threshold = template.confidence_threshold;
        if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
          throw new Error('Confidence threshold must be a number between 0 and 1');
        }
      }
      
      this.stats.validationsPassed++;
      console.log('[TemplateCacheManager] Template validation passed');
      
    } catch (error) {
      this.stats.validationsFailed++;
      console.error('[TemplateCacheManager] Template validation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Schedule daily update checks
   * Checks for updates at 3:00 AM local time
   * 
   * Requirements: 5.1
   * 
   * @private
   */
  _scheduleUpdateChecks() {
    // Calculate time until next 3:00 AM
    const now = new Date();
    const next3AM = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      UPDATE_CHECK_TIME.hour,
      UPDATE_CHECK_TIME.minute,
      0,
      0
    );
    
    // If 3:00 AM has already passed today, schedule for tomorrow
    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1);
    }
    
    const timeUntilNext = next3AM.getTime() - now.getTime();
    
    console.log('[TemplateCacheManager] Scheduling next update check', {
      nextCheck: next3AM.toISOString(),
      timeUntil: Math.round(timeUntilNext / 1000 / 60) + ' minutes',
    });
    
    // Schedule the check
    this.updateCheckTimer = setTimeout(() => {
      this._performScheduledUpdateCheck();
    }, timeUntilNext);
  }
  
  /**
   * Perform scheduled update check
   * 
   * @private
   */
  async _performScheduledUpdateCheck() {
    console.log('[TemplateCacheManager] Performing scheduled update check');
    
    try {
      await this.updateTemplate();
    } catch (error) {
      console.error('[TemplateCacheManager] Scheduled update check failed:', error.message);
    }
    
    // Schedule next check (24 hours from now)
    this._scheduleUpdateChecks();
  }
  
  /**
   * Make HTTPS request
   * 
   * @private
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<string>} Response body
   */
  _httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || DOWNLOAD_TIMEOUT;
      
      const req = https.request(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TabezaConnect/1.0',
          ...options.headers,
        },
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      // Set timeout
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }
  
  /**
   * Sleep for specified milliseconds
   * 
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = TemplateCacheManager;
