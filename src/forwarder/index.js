/**
 * Printer Forwarder Module
 * 
 * Factory for creating printer forwarder instances based on configuration.
 * Exports all forwarder classes and a factory function.
 */

const PrinterForwarder = require('./PrinterForwarder');
const USBPrinterForwarder = require('./USBPrinterForwarder');
const NetworkPrinterForwarder = require('./NetworkPrinterForwarder');

/**
 * Create a printer forwarder instance based on configuration
 * @param {PrinterConfig} config - Printer configuration
 * @param {Object} logger - Winston logger instance
 * @returns {PrinterForwarder} Appropriate forwarder instance
 * @throws {Error} If printer type is invalid
 */
function createPrinterForwarder(config, logger) {
  if (!config || !config.type) {
    throw new Error('Printer configuration with type is required');
  }
  
  switch (config.type) {
    case 'usb':
    case 'serial':
      return new USBPrinterForwarder(config, logger);
      
    case 'network':
      return new NetworkPrinterForwarder(config, logger);
      
    default:
      throw new Error(`Unsupported printer type: ${config.type}`);
  }
}

module.exports = {
  PrinterForwarder,
  USBPrinterForwarder,
  NetworkPrinterForwarder,
  createPrinterForwarder
};
