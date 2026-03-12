/**
 * USB Printer Forwarder
 * 
 * Forwards print jobs to USB-connected thermal printers using serialport.
 * Handles COM port communication with proper flow control and error handling.
 */

const { SerialPort } = require('serialport');
const PrinterForwarder = require('./PrinterForwarder');

class USBPrinterForwarder extends PrinterForwarder {
  /**
   * Create a new USBPrinterForwarder instance
   * @param {PrinterConfig} config - Printer configuration (must include port)
   * @param {Object} logger - Winston logger instance
   */
  constructor(config, logger) {
    // Ensure type is set to 'usb'
    super({ ...config, type: 'usb' }, logger);
    
    // SerialPort instance
    this.serialPort = null;
    
    // Connection state
    this.isConnected = false;
  }
  
  /**
   * Open serial port connection
   * @returns {Promise<void>}
   */
  async openConnection() {
    if (this.isConnected && this.serialPort && this.serialPort.isOpen) {
      return; // Already connected
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.serialPort = new SerialPort({
          path: this.config.port,
          baudRate: this.config.baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          autoOpen: false
        });
        
        // Set up event handlers
        this.serialPort.on('error', (error) => {
          this.logger.error('Serial port error', {
            port: this.config.port,
            error: error.message
          });
        });
        
        this.serialPort.on('close', () => {
          this.isConnected = false;
          this.logger.info('Serial port closed', {
            port: this.config.port
          });
        });
        
        // Open the port
        this.serialPort.open((error) => {
          if (error) {
            this.isConnected = false;
            reject(new Error(`Failed to open serial port ${this.config.port}: ${error.message}`));
          } else {
            this.isConnected = true;
            this.logger.info('Serial port opened successfully', {
              port: this.config.port,
              baudRate: this.config.baudRate
            });
            resolve();
          }
        });
        
      } catch (error) {
        reject(new Error(`Failed to create serial port: ${error.message}`));
      }
    });
  }
  
  /**
   * Forward data to USB printer via serial port
   * @param {Buffer} rawBytes - Raw ESC/POS data to send
   * @returns {Promise<void>}
   */
  async forwardToDevice(rawBytes) {
    // Ensure connection is open
    await this.openConnection();
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`USB printer forward timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
      
      // Write data to serial port
      this.serialPort.write(rawBytes, (writeError) => {
        if (writeError) {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to write to serial port: ${writeError.message}`));
          return;
        }
        
        // Wait for data to be transmitted
        this.serialPort.drain((drainError) => {
          clearTimeout(timeoutId);
          
          if (drainError) {
            reject(new Error(`Failed to drain serial port: ${drainError.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }
  
  /**
   * Close serial port connection
   * @returns {Promise<void>}
   */
  async closeConnection() {
    if (this.serialPort && this.serialPort.isOpen) {
      return new Promise((resolve, reject) => {
        this.serialPort.close((error) => {
          if (error) {
            reject(new Error(`Failed to close serial port: ${error.message}`));
          } else {
            this.isConnected = false;
            resolve();
          }
        });
      });
    }
  }
  
  /**
   * List available serial ports
   * @returns {Promise<Array>} List of available ports
   */
  static async listPorts() {
    try {
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        pnpId: port.pnpId,
        vendorId: port.vendorId,
        productId: port.productId
      }));
    } catch (error) {
      throw new Error(`Failed to list serial ports: ${error.message}`);
    }
  }
}

module.exports = USBPrinterForwarder;
