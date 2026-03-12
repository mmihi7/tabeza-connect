/**
 * Network Printer Forwarder
 * 
 * Forwards print jobs to network-connected thermal printers using raw TCP sockets.
 * Typically connects to port 9100 (standard for network printers).
 */

const net = require('net');
const PrinterForwarder = require('./PrinterForwarder');

class NetworkPrinterForwarder extends PrinterForwarder {
  /**
   * Create a new NetworkPrinterForwarder instance
   * @param {PrinterConfig} config - Printer configuration (must include ip)
   * @param {Object} logger - Winston logger instance
   */
  constructor(config, logger) {
    // Ensure type is set to 'network'
    super({ ...config, type: 'network' }, logger);
    
    // TCP socket instance
    this.socket = null;
    
    // Connection state
    this.isConnected = false;
  }
  
  /**
   * Create TCP connection to network printer
   * @returns {Promise<void>}
   */
  async openConnection() {
    if (this.isConnected && this.socket && !this.socket.destroyed) {
      return; // Already connected
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.socket = new net.Socket();
        
        // Set timeout
        this.socket.setTimeout(this.config.timeout);
        
        // Set up event handlers
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.logger.info('Network printer connected', {
            ip: this.config.ip,
            port: this.config.networkPort
          });
          resolve();
        });
        
        this.socket.on('error', (error) => {
          this.isConnected = false;
          this.logger.error('Network printer socket error', {
            ip: this.config.ip,
            port: this.config.networkPort,
            error: error.message
          });
          
          // Clean up socket
          if (this.socket) {
            this.socket.destroy();
            this.socket = null;
          }
          
          reject(new Error(`Network printer connection error: ${error.message}`));
        });
        
        this.socket.on('timeout', () => {
          this.isConnected = false;
          this.logger.error('Network printer connection timeout', {
            ip: this.config.ip,
            port: this.config.networkPort,
            timeout: this.config.timeout
          });
          
          // Clean up socket
          if (this.socket) {
            this.socket.destroy();
            this.socket = null;
          }
          
          reject(new Error(`Network printer connection timeout after ${this.config.timeout}ms`));
        });
        
        this.socket.on('close', () => {
          this.isConnected = false;
          this.logger.info('Network printer connection closed', {
            ip: this.config.ip,
            port: this.config.networkPort
          });
        });
        
        // Connect to printer
        this.socket.connect(this.config.networkPort, this.config.ip);
        
      } catch (error) {
        reject(new Error(`Failed to create network socket: ${error.message}`));
      }
    });
  }
  
  /**
   * Forward data to network printer via TCP socket
   * @param {Buffer} rawBytes - Raw ESC/POS data to send
   * @returns {Promise<void>}
   */
  async forwardToDevice(rawBytes) {
    // Create new connection for each print job (more reliable than keeping connection open)
    await this.openConnection();
    
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.closeConnection().catch(() => {}); // Clean up
          reject(new Error(`Network printer forward timeout after ${this.config.timeout}ms`));
        }
      }, this.config.timeout);
      
      // Handle errors during write
      const errorHandler = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          this.closeConnection().catch(() => {}); // Clean up
          reject(new Error(`Network printer write error: ${error.message}`));
        }
      };
      
      this.socket.once('error', errorHandler);
      
      // Write data to socket
      this.socket.write(rawBytes, (writeError) => {
        if (writeError) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            this.closeConnection().catch(() => {}); // Clean up
            reject(new Error(`Failed to write to network printer: ${writeError.message}`));
          }
          return;
        }
        
        // Wait a moment for data to be transmitted, then close connection
        setTimeout(async () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            
            try {
              await this.closeConnection();
              resolve();
            } catch (closeError) {
              // Connection closed successfully but with error - still consider it success
              this.logger.warn('Error closing connection after successful write', {
                error: closeError.message
              });
              resolve();
            }
          }
        }, 100); // Small delay to ensure data is transmitted
      });
    });
  }
  
  /**
   * Close network socket connection
   * @returns {Promise<void>}
   */
  async closeConnection() {
    if (this.socket && !this.socket.destroyed) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.socket) {
            this.socket.destroy();
          }
          this.isConnected = false;
          resolve();
        }, 1000);
        
        this.socket.once('close', () => {
          clearTimeout(timeout);
          this.isConnected = false;
          resolve();
        });
        
        this.socket.once('error', (error) => {
          clearTimeout(timeout);
          this.isConnected = false;
          // Don't reject on close error - connection is closed anyway
          resolve();
        });
        
        this.socket.end();
      });
    }
  }
  
  /**
   * Test network printer connectivity
   * @param {string} ip - Printer IP address
   * @param {number} [port=9100] - Printer port
   * @param {number} [timeout=5000] - Connection timeout in ms
   * @returns {Promise<boolean>} True if printer is reachable
   */
  static async testConnection(ip, port = 9100, timeout = 5000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, ip);
    });
  }
}

module.exports = NetworkPrinterForwarder;
