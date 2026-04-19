// serial-printer.js
// Serial Printer Connection - Forwards print jobs to serial port printers
// NOTE: serialport native module is optional — degrades gracefully if ABI mismatch.

let SerialPort = null;
try {
  SerialPort = require('serialport').SerialPort;
} catch (e) {
  // Native module not available for this runtime — serial printing disabled
}

class SerialPrinterConnection {
    constructor(config) {
        this.portName = config.portName; // e.g., "COM1"
        this.baudRate = config.baudRate || 9600;
        this.dataBits = config.dataBits || 8;
        this.stopBits = config.stopBits || 1;
        this.parity = config.parity || 'none';
        this.port = null;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: this.portName,
                baudRate: this.baudRate,
                dataBits: this.dataBits,
                stopBits: this.stopBits,
                parity: this.parity,
                autoOpen: false
            });
            
            this.port.on('error', (err) => {
                reject(new Error(`Serial port error: ${err.message}`));
            });
            
            this.port.open((err) => {
                if (err) {
                    reject(new Error(`Failed to open ${this.portName}: ${err.message}`));
                } else {
                    console.log(`[SerialPrinter] Connected to ${this.portName} at ${this.baudRate} baud`);
                    resolve(true);
                }
            });
        });
    }
    
    async send(data) {
        if (!this.port || !this.port.isOpen) {
            throw new Error('Port not open');
        }
        
        return new Promise((resolve, reject) => {
            this.port.write(data, (err) => {
                if (err) {
                    reject(new Error(`Write failed: ${err.message}`));
                } else {
                    this.port.drain((drainErr) => {
                        if (drainErr) {
                            reject(new Error(`Drain failed: ${drainErr.message}`));
                        } else {
                            resolve(data.length);
                        }
                    });
                }
            });
        });
    }
    
    async getStatus() {
        // ESC/POS status query: ESC v
        const statusQuery = Buffer.from([0x1B, 0x76]);
        
        try {
            if (!this.port || !this.port.isOpen) {
                return {
                    ready: false,
                    paperOut: false,
                    error: true,
                    errorMessage: 'Port not open'
                };
            }
            
            // Send status query
            await this.send(statusQuery);
            
            // Simplified status - actual implementation would read response
            return {
                ready: true,
                paperOut: false,
                error: false
            };
        } catch (err) {
            return {
                ready: false,
                paperOut: false,
                error: true,
                errorMessage: err.message
            };
        }
    }
    
    async disconnect() {
        if (this.port && this.port.isOpen) {
            return new Promise((resolve) => {
                this.port.close((err) => {
                    if (err) {
                        console.error('[SerialPrinter] Close error:', err.message);
                    } else {
                        console.log('[SerialPrinter] Disconnected');
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = SerialPrinterConnection;
