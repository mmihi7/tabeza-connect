// usb-printer.js
// USB Printer Connection - Forwards print jobs to USB thermal printers

const usb = require('usb');

class USBPrinterConnection {
    constructor(config) {
        this.vendorId = config.vendorId;
        this.productId = config.productId;
        this.device = null;
        this.endpoint = null;
        this.interface = null;
    }
    
    async connect() {
        try {
            // Find USB device
            this.device = usb.findByIds(this.vendorId, this.productId);
            
            if (!this.device) {
                throw new Error(`USB printer not found: ${this.vendorId}:${this.productId}`);
            }
            
            // Open device
            this.device.open();
            
            // Get first interface
            this.interface = this.device.interface(0);
            
            // Claim interface
            if (this.interface.isKernelDriverActive()) {
                this.interface.detachKernelDriver();
            }
            this.interface.claim();
            
            // Find bulk OUT endpoint
            const endpoints = this.interface.endpoints;
            this.endpoint = endpoints.find(ep => 
                ep.direction === 'out' && ep.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK
            );
            
            if (!this.endpoint) {
                throw new Error('No bulk OUT endpoint found');
            }
            
            console.log(`[USBPrinter] Connected to ${this.vendorId}:${this.productId}`);
            return true;
            
        } catch (err) {
            console.error('[USBPrinter] Connection failed:', err.message);
            throw err;
        }
    }
    
    async send(data) {
        if (!this.endpoint) {
            throw new Error('Not connected');
        }
        
        return new Promise((resolve, reject) => {
            this.endpoint.transfer(data, (err) => {
                if (err) {
                    reject(new Error(`USB transfer failed: ${err.message}`));
                } else {
                    resolve(data.length);
                }
            });
        });
    }
    
    async getStatus() {
        // ESC/POS status query: ESC v
        const statusQuery = Buffer.from([0x1B, 0x76]);
        
        try {
            await this.send(statusQuery);
            
            // Read response (simplified - actual implementation would read from IN endpoint)
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
        try {
            if (this.interface) {
                this.interface.release(() => {
                    if (this.device) {
                        this.device.close();
                    }
                });
            }
            console.log('[USBPrinter] Disconnected');
        } catch (err) {
            console.error('[USBPrinter] Disconnect error:', err.message);
        }
    }
}

module.exports = USBPrinterConnection;
