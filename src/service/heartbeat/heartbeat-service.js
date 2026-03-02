/**
 * Heartbeat Service
 * 
 * Sends periodic status updates to the cloud API to report device online status.
 * Runs every 30 seconds and includes barId, driverId, version, and status.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class HeartbeatService {
  constructor(config) {
    this.config = config;
    this.intervalId = null;
    this.isRunning = false;
    this.version = this._loadVersion();
    this.driverId = HeartbeatService.generateDriverId();
    
    // Use native fetch - no external dependencies
    this.fetchController = new AbortController();
  }

  /**
   * Get fetch options for heartbeat requests
   * @private
   */
  _getFetchOptions() {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `TabezaConnect/${this.version}`
      },
      signal: this.fetchController.signal
    };
  }

  /**
   * Load version from package.json
   * @private
   * @returns {string} Version string
   */
  _loadVersion() {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version || '1.0.0';
    } catch (error) {
      console.warn('[HeartbeatService] Failed to load version from package.json:', error.message);
      return '1.0.0';
    }
  }

  /**
   * Generate driver ID from hostname
   * Format: "driver-{HOSTNAME}"
   * @returns {string} Driver ID
   */
  static generateDriverId() {
    const hostname = os.hostname();
    return `driver-${hostname}`;
  }

  /**
   * Start sending heartbeats every 30 seconds
   */
  start() {
    if (this.isRunning) {
      console.warn('[HeartbeatService] Already running');
      return;
    }

    console.log(`[HeartbeatService] Starting heartbeat service (driverId: ${this.driverId}, version: ${this.version})`);
    this.isRunning = true;

    // Send initial heartbeat immediately
    this.sendHeartbeat().catch(error => {
      console.warn('[HeartbeatService] Initial heartbeat failed:', error.message);
    });

    // Then send every 30 seconds
    this.intervalId = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        console.warn('[HeartbeatService] Heartbeat failed:', error.message);
      });
    }, 30000); // 30 seconds
  }

  /**
   * Stop sending heartbeats
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('[HeartbeatService] Stopping heartbeat service');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Send single heartbeat to cloud
   * @returns {Promise<void>}
   */
  async sendHeartbeat() {
    if (!this.config.barId || this.config.barId.trim() === '') {
      console.warn('[HeartbeatService] Cannot send heartbeat: barId not configured');
      return;
    }

    const payload = {
      barId: this.config.barId,
      driverId: this.driverId,
      version: this.version,
      status: 'online'
    };

    const endpoint = `${this.config.apiUrl}/api/printer/heartbeat`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const options = this._getFetchOptions();
      const response = await fetch(endpoint, {
        ...options,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${result.message || 'Unknown error'}`);
      }

      console.log(`[HeartbeatService] Heartbeat sent successfully (status: ${response.status})`);
      return result;
    } catch (error) {
      // Log warning but don't throw - will retry on next interval
      if (error.response) {
        console.warn(`[HeartbeatService] Heartbeat rejected by server: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        console.warn('[HeartbeatService] Network error sending heartbeat:', error.message);
      } else {
        console.warn('[HeartbeatService] Error sending heartbeat:', error.message);
      }
    }
  }
}

module.exports = HeartbeatService;
