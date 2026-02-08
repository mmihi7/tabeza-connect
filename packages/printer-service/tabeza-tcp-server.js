/**
 * TABEZA TCP SERVER - Production Integration
 * 
 * Receives print data from "TABEZA Test Printer" and sends to Tabeza cloud
 * This connects Notepad (or any app) → TCP Server → Tabeza → Captain's Orders
 * 
 * Usage:
 * 1. node tabeza-tcp-server.js
 * 2. Print from Notepad to "TABEZA Test Printer"
 * 3. Data appears in Captain's Orders on staff dashboard
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // TCP Server
  port: 9100,
  host: '127.0.0.1',
  
  // Tabeza Cloud API
  apiUrl: process.env.TABEZA_API_URL || 'http://localhost:3003',
  barId: process.env.TABEZA_BAR_ID || '',
  
  // Local storage
  outputDir: path.join(__dirname, 'received-prints'),
  
  // Logging
  verbose: true,
};

// Validate configuration
if (!CONFIG.barId) {
  console.error('❌ ERROR: TABEZA_BAR_ID environment variable is required!');
  console.error('');
  console.error('Set it like this:');
  console.error('  Windows: set TABEZA_BAR_ID=your-bar-id-here');
  console.error('  Linux/Mac: export TABEZA_BAR_ID=your-bar-id-here');
  console.error('');
  process.exit(1);
}

// Create output directory
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// ============================================================================
// TABEZA CLOUD CLIENT
// ============================================================================

/**
 * Send print data to Tabeza cloud API
 */
async function sendToTabeza(printData, metadata) {
  const payload = {
    driverId: 'tcp-server-' + require('os').hostname(),
    barId: CONFIG.barId,
    timestamp: new Date().toISOString(),
    rawData: printData.toString('base64'),
    printerName: 'TABEZA Test Printer',
    documentName: metadata.documentName || 'Print Job',
    metadata: {
      source: 'tcp-server',
      size: printData.length,
      ...metadata,
    },
  };

  return new Promise((resolve, reject) => {
    const url = new URL('/api/printer/relay', CONFIG.apiUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? require('https') : require('http');

    const postData = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (err) {
            resolve({ success: true, raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// ============================================================================
// TCP SERVER
// ============================================================================

const server = net.createServer((socket) => {
  const connectionId = Date.now();
  
  log('');
  log('═══════════════════════════════════════════════════════════');
  log('📄 NEW PRINT JOB RECEIVED');
  log('═══════════════════════════════════════════════════════════');
  log(`⏰ Time: ${new Date().toLocaleString()}`);
  log(`🔌 From: ${socket.remoteAddress}:${socket.remotePort}`);
  log(`🆔 Connection ID: ${connectionId}`);
  log('');
  
  let printData = Buffer.alloc(0);
  let chunkCount = 0;
  
  // Receive data chunks
  socket.on('data', (chunk) => {
    chunkCount++;
    printData = Buffer.concat([printData, chunk]);
    log(`📦 Chunk ${chunkCount}: Received ${chunk.length} bytes`);
  });
  
  // Process complete print job
  socket.on('end', async () => {
    log('');
    log('✅ Print job complete');
    log(`📊 Total size: ${printData.length} bytes in ${chunkCount} chunks`);
    log('');
    
    try {
      // Save locally
      const filename = `print-${connectionId}.bin`;
      const filepath = path.join(CONFIG.outputDir, filename);
      fs.writeFileSync(filepath, printData);
      log(`💾 Saved locally: ${filename}`);
      
      // Extract text preview
      const textPreview = extractTextPreview(printData);
      log('');
      log('📝 TEXT PREVIEW:');
      log('───────────────────────────────────────────────────────────');
      log(textPreview.substring(0, 200));
      if (textPreview.length > 200) {
        log(`... (${textPreview.length - 200} more characters)`);
      }
      log('───────────────────────────────────────────────────────────');
      log('');
      
      // Send to Tabeza cloud
      log('☁️  Sending to Tabeza cloud...');
      const response = await sendToTabeza(printData, {
        connectionId,
        textPreview: textPreview.substring(0, 500),
      });
      
      log('✅ Successfully sent to Tabeza!');
      log(`📋 Job ID: ${response.jobId || 'N/A'}`);
      log('');
      log('🎯 Next steps:');
      log('   1. Open staff dashboard');
      log('   2. Go to Captain\'s Orders');
      log('   3. Assign this order to a tab');
      log('');
      
    } catch (error) {
      log('');
      log('❌ ERROR sending to Tabeza:');
      log(error.message);
      log('');
      log('💡 Troubleshooting:');
      log('   1. Check TABEZA_API_URL is correct');
      log('   2. Check TABEZA_BAR_ID is valid');
      log('   3. Check network connection');
      log('   4. Check API is running');
      log('');
    }
    
    socket.end();
    log('═══════════════════════════════════════════════════════════');
    log('');
  });
  
  socket.on('error', (err) => {
    log(`❌ Socket error: ${err.message}`);
  });
});

// Start server
server.listen(CONFIG.port, CONFIG.host, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         TABEZA TCP SERVER - Production Ready              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('✅ Server started successfully!');
  console.log('');
  console.log(`🌐 Listening on: ${CONFIG.host}:${CONFIG.port}`);
  console.log(`☁️  Tabeza API: ${CONFIG.apiUrl}`);
  console.log(`🏪 Bar ID: ${CONFIG.barId}`);
  console.log(`📁 Output directory: ${CONFIG.outputDir}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('HOW TO USE:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('1. Make sure "TABEZA Test Printer" is installed');
  console.log('   Run: powershell -File setup-test-printer.ps1');
  console.log('');
  console.log('2. Print from any application:');
  console.log('   - Notepad: File → Print → TABEZA Test Printer');
  console.log('   - Word: File → Print → TABEZA Test Printer');
  console.log('   - Any app that can print');
  console.log('');
  console.log('3. Watch this console for output');
  console.log('');
  console.log('4. Check Captain\'s Orders in staff dashboard');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('⏳ Waiting for print jobs...');
  console.log('💡 Press Ctrl+C to stop');
  console.log('');
});

server.on('error', (err) => {
  console.error('');
  console.error('❌ SERVER ERROR:', err.message);
  console.error('');
  
  if (err.code === 'EADDRINUSE') {
    console.error('⚠️  Port 9100 is already in use!');
    console.error('');
    console.error('Solutions:');
    console.error('1. Stop any other service using port 9100');
    console.error('2. Change CONFIG.port in this file');
    console.error('3. Run: netstat -ano | findstr :9100');
  } else if (err.code === 'EACCES') {
    console.error('⚠️  Permission denied!');
    console.error('');
    console.error('Solutions:');
    console.error('1. Run as Administrator');
    console.error('2. Use a port > 1024');
  }
  
  console.error('');
  process.exit(1);
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extract readable text from print data
 */
function extractTextPreview(data) {
  let text = '';
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    
    // Skip ESC sequences
    if (byte === 0x1B) {
      i++; // Skip ESC
      continue;
    }
    
    // Skip other control codes except newlines
    if (byte < 0x20 && byte !== 0x0A && byte !== 0x0D) {
      continue;
    }
    
    // Add printable characters
    if (byte >= 0x20 && byte <= 0x7E) {
      text += String.fromCharCode(byte);
    } else if (byte === 0x0A) {
      text += '\n';
    }
  }
  
  return text.trim();
}

/**
 * Log with timestamp
 */
function log(message) {
  if (CONFIG.verbose) {
    console.log(message);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('');
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    console.log('');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('');
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('');
  console.error('❌ UNHANDLED REJECTION:', err);
  console.error('');
});
