// network-printer.js
// Network Printer Connection - Forwards print jobs to network printers via raw TCP

const net = require('net');

class NetworkPrinterConnection {
    constructor(config) {
        this.host = config.host;
        this.port = config.port || 9100; // Standard raw printing port
        this.socket = null;
        this.timeout = config.timeout || 5000;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            
            this.socket.setTimeout(this.timeout);
            
            this.socket.on('timeout', () => {
                this.socket.destroy();
                reject(new Error('Connection timeout'));
            });
            
            this.socket.on('error', (err) => {
                reject(new Error(`Connection failed: ${err.message}`));
            });
            
            this.socket.connect(this.port, this.host, () => {
                console.log(`[NetworkPrinter] Connected to ${this.host}:${this.port}`);
                this.socket.setTimeout(0); // Disable timeout after connection
                resolve(true);
            });
        });
    }
    
    async send(data) {
        if (!this.socket || this.socket.destroyed) {
            throw new Error('Not connected');
        }
        
        return new Promise((resolve, reject) => {
            this.socket.write(data, (err) => {
                if (err) {
                    reject(new Error(`Send failed: ${err.message}`));
                } else {
                    // Wait for data to drain
                    this.socket.once('drain', () => {
                        resolve(data.length);
                    });
                    
                    // If already drained, resolve immediately
                    if (this.socket.bufferSize === 0) {
                        resolve(data.length);
                    }
                }
            });
        });
    }
    
    async getStatus() {
        // ESC/POS status query: ESC v
        const statusQuery = Buffer.from([0x1B, 0x76]);
        
        try {
            if (!this.socket || this.socket.destroyed) {
                return {
                    ready: false,
                    paperOut: false,
                    error: true,
                    errorMessage: 'Not connected'
                };
            }
            
            // Send status query
            await this.send(statusQuery);
            
            // Simplified status - actual implementation would parse response
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
        if (this.socket && !this.socket.destroyed) {
            return new Promise((resolve) => {
                this.socket.end(() => {
                    this.socket.destroy();
                    console.log('[NetworkPrinter] Disconnected');
                    resolve();
                });
            });
        }
    }
}

module.exports = NetworkPrinterConnection;
