/**
 * Printers API Route
 * 
 * GET /api/printers - Returns virtual printer driver status and statistics
 * 
 * Task 4.3.1: Add virtual printer status section to main dashboard
 * Task 4.3.2: Display printer driver status and job counters
 * Provides real-time statistics for the virtual printer capture system
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/printers
 * Returns virtual printer driver status, job counters, and queue information
 * 
 * Response format:
 * {
 *   success: boolean,
 *   data: {
 *     stats: {
 *       jobsReceived: number,
 *       jobsForwarded: number,
 *       jobsFailed: number,
 *       avgForwardTime: number,
 *       queueDepth: number
 *     },
 *     queueDepth: number,
 *     printers: Array<{
 *       name: string,
 *       type: string,
 *       enabled: boolean,
 *       isDefault: boolean
 *     }>
 *   }
 * }
 */
router.get('/', (req, res) => {
  try {
    // Get capture service reference from app locals
    const captureService = req.app.locals.captureService;

    if (!captureService) {
      return res.status(503).json({
        success: false,
        error: 'Capture service not initialized'
      });
    }

    // Check if printer adapter is available
    if (!captureService.printerAdapter) {
      return res.status(503).json({
        success: false,
        error: 'Printer adapter not initialized'
      });
    }

    // Get printer adapter statistics
    const stats = captureService.printerAdapter.getStats();
    const queue = captureService.printerAdapter.getQueue();

    // Get configured printers information
    const printers = Array.from(captureService.printerAdapter.printers.entries()).map(([name, printer]) => ({
      name,
      type: printer.config.type,
      enabled: printer.enabled,
      isDefault: printer.isDefault
    }));

    res.json({
      success: true,
      data: {
        stats,
        queueDepth: queue.length,
        printers
      }
    });
  } catch (error) {
    console.error('[PrintersRoute] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get printer status',
      message: error.message
    });
  }
});

/**
 * GET /api/printers/failed-jobs
 * Returns list of failed forwarding jobs
 * 
 * Response format:
 * {
 *   success: boolean,
 *   data: {
 *     failedJobs: Array<{
 *       filename: string,
 *       jobId: string,
 *       timestamp: string,
 *       forwardAttempts: number,
 *       lastForwardError: string,
 *       dataSize: number
 *     }>,
 *     count: number
 *   }
 * }
 */
router.get('/failed-jobs', async (req, res) => {
  try {
    const captureService = req.app.locals.captureService;

    if (!captureService || !captureService.printerAdapter) {
      return res.status(503).json({
        success: false,
        error: 'Printer adapter not initialized'
      });
    }

    const failedJobs = await captureService.printerAdapter.getFailedJobs();

    res.json({
      success: true,
      data: {
        failedJobs,
        count: failedJobs.length
      }
    });
  } catch (error) {
    console.error('[PrintersRoute] Error getting failed jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get failed jobs',
      message: error.message
    });
  }
});

/**
 * POST /api/printers/retry-failed
 * Retry all failed forwarding jobs
 * 
 * Response format:
 * {
 *   success: boolean,
 *   data: {
 *     retriedCount: number,
 *     message: string
 *   }
 * }
 */
router.post('/retry-failed', async (req, res) => {
  try {
    const captureService = req.app.locals.captureService;

    if (!captureService || !captureService.printerAdapter) {
      return res.status(503).json({
        success: false,
        error: 'Printer adapter not initialized'
      });
    }

    const result = await captureService.printerAdapter.retryFailedJobs();

    res.json({
      success: result.success,
      data: {
        retriedCount: result.retriedCount,
        message: result.message
      }
    });
  } catch (error) {
    console.error('[PrintersRoute] Error retrying failed jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry failed jobs',
      message: error.message
    });
  }
});

/**
 * GET /api/printers/list/usb
 * List available USB printers
 * 
 * Response format:
 * {
 *   success: boolean,
 *   printers: Array<{
 *     name: string,
 *     port: string,
 *     manufacturer: string,
 *     status: string
 *   }>
 * }
 */
router.get('/list/usb', async (req, res) => {
  try {
    const usb = require('usb');
    const printers = [];
    
    // Scan for USB devices with printer class (0x07)
    const devices = usb.getDeviceList();
    
    for (const device of devices) {
      try {
        device.open();
        const config = device.configDescriptor;
        
        // Check if device has printer interface
        const hasPrinterInterface = config.interfaces.some(iface =>
          iface.some(alt => alt.bInterfaceClass === 0x07)
        );
        
        if (hasPrinterInterface) {
          // Try to get manufacturer and product strings
          let manufacturer = 'Unknown';
          let product = 'USB Printer';
          
          try {
            if (device.deviceDescriptor.iManufacturer) {
              manufacturer = await new Promise((resolve, reject) => {
                device.getStringDescriptor(device.deviceDescriptor.iManufacturer, (err, data) => {
                  if (err) reject(err);
                  else resolve(data);
                });
              });
            }
            
            if (device.deviceDescriptor.iProduct) {
              product = await new Promise((resolve, reject) => {
                device.getStringDescriptor(device.deviceDescriptor.iProduct, (err, data) => {
                  if (err) reject(err);
                  else resolve(data);
                });
              });
            }
          } catch (err) {
            // Ignore string descriptor errors
          }
          
          printers.push({
            name: product,
            manufacturer: manufacturer,
            vendorId: device.deviceDescriptor.idVendor,
            productId: device.deviceDescriptor.idProduct,
            status: 'online'
          });
        }
        
        device.close();
      } catch (err) {
        // Skip devices we can't open
        try {
          device.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }
    
    res.json({
      success: true,
      printers
    });
  } catch (error) {
    console.error('[PrintersRoute] Error listing USB printers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list USB printers',
      message: error.message,
      printers: []
    });
  }
});

/**
 * GET /api/printers/list/serial
 * List available serial ports
 * 
 * Response format:
 * {
 *   success: boolean,
 *   ports: Array<{
 *     path: string,
 *     manufacturer: string,
 *     serialNumber: string,
 *     pnpId: string
 *   }>
 * }
 */
router.get('/list/serial', async (req, res) => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    
    res.json({
      success: true,
      ports: ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        pnpId: port.pnpId
      }))
    });
  } catch (error) {
    console.error('[PrintersRoute] Error listing serial ports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list serial ports',
      message: error.message,
      ports: []
    });
  }
});

/**
 * GET /api/printers/config
 * Get current printer configuration
 * 
 * Response format:
 * {
 *   success: boolean,
 *   config: {
 *     printer: {
 *       type: string,
 *       port: string,
 *       ip: string,
 *       networkPort: number,
 *       online: boolean,
 *       lastSuccess: string,
 *       totalForwarded: number
 *     }
 *   }
 * }
 */
router.get('/config', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const configPath = path.join('C:\\TabezaPrints', 'config.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Get printer status from adapter if available
      const captureService = req.app.locals.captureService;
      let printerStatus = {};
      
      if (captureService && captureService.printerAdapter) {
        const status = captureService.printerAdapter.getStatus();
        printerStatus = {
          online: status.online,
          lastSuccess: status.lastSuccess,
          totalForwarded: status.totalForwarded
        };
      }
      
      res.json({
        success: true,
        config: {
          printer: {
            ...config.printer,
            ...printerStatus
          }
        }
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.json({
          success: true,
          config: null
        });
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('[PrintersRoute] Error getting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/printers/config
 * Save printer configuration
 * 
 * Request body:
 * {
 *   type: 'usb' | 'network' | 'serial',
 *   port: string (for USB/serial),
 *   ip: string (for network),
 *   networkPort: number (for network),
 *   baudRate: number (for USB/serial),
 *   timeout: number
 * }
 * 
 * Response format:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/config', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const configPath = path.join('C:\\TabezaPrints', 'config.json');
    
    // Validate printer configuration
    const printerConfig = req.body;
    
    if (!printerConfig.type || !['usb', 'network', 'serial'].includes(printerConfig.type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid printer type'
      });
    }
    
    // Type-specific validation
    if (printerConfig.type === 'network' && !printerConfig.ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required for network printers'
      });
    }
    
    if ((printerConfig.type === 'usb' || printerConfig.type === 'serial') && !printerConfig.port) {
      return res.status(400).json({
        success: false,
        error: 'Port is required for USB/serial printers'
      });
    }
    
    // Load existing config
    let config = {};
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    
    // Update printer configuration
    config.printer = printerConfig;
    
    // Save config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    // Reload printer adapter if available
    const captureService = req.app.locals.captureService;
    if (captureService && captureService.printerAdapter) {
      await captureService.printerAdapter.reloadConfig();
    }
    
    res.json({
      success: true,
      message: 'Printer configuration saved successfully'
    });
  } catch (error) {
    console.error('[PrintersRoute] Error saving config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/printers/test
 * Send test print to configured printer
 * 
 * Response format:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/test', async (req, res) => {
  try {
    const captureService = req.app.locals.captureService;
    
    if (!captureService || !captureService.printerAdapter) {
      return res.status(503).json({
        success: false,
        error: 'Printer adapter not initialized'
      });
    }
    
    // Generate test receipt
    const testReceipt = Buffer.from(`
\x1B\x40
\x1B\x61\x01
================================
   TABEZA CONNECT TEST PRINT
================================

Date: ${new Date().toLocaleString()}

This is a test print from
Tabeza Connect.

If you can read this, your
printer is configured correctly!

================================
\x1B\x61\x00

\x1B\x64\x05
`, 'utf8');
    
    // Send to printer
    await captureService.printerAdapter.forward(testReceipt, {
      filename: 'test-print.prn',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Test print sent successfully'
    });
  } catch (error) {
    console.error('[PrintersRoute] Error sending test print:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test print',
      message: error.message
    });
  }
});

module.exports = router;
