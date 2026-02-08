/**
 * TABEZA PRINTER MODAL - 1-DAY PROTOTYPE
 * 
 * Purpose: Validate the network printer proxy approach before committing to full build
 * 
 * What this tests:
 * 1. Can we receive print data from Windows network printer?
 * 2. What format is the data? (ESC/POS, plain text, etc.)
 * 3. Can we parse receipt information?
 * 4. Does it work reliably?
 * 
 * Setup Instructions:
 * 1. Run this script: node test-tcp-server.js
 * 2. Run setup script: powershell -File setup-test-printer.ps1
 * 3. Print something from Notepad to "TABEZA Test Printer"
 * 4. Check console output to see what data is received
 * 
 * Success Criteria:
 * ✅ Data arrives at TCP server
 * ✅ Can see text content
 * ✅ No major errors or blocks
 * 
 * If successful: Continue with network proxy approach (12-17 days)
 * If failed: Pivot to PDF printer or improve file watcher
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = 9100;
const HOST = '127.0.0.1';
const OUTPUT_DIR = path.join(__dirname, 'test-receipts');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  TABEZA PRINTER MODAL - TCP SERVER PROTOTYPE              ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📋 Purpose: Validate network printer proxy approach');
console.log('');

// Create TCP server
const server = net.createServer((socket) => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📄 NEW PRINT JOB RECEIVED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`🔌 From: ${socket.remoteAddress}:${socket.remotePort}`);
  console.log('');
  
  let data = Buffer.alloc(0);
  let chunkCount = 0;
  
  // Receive data chunks
  socket.on('data', (chunk) => {
    chunkCount++;
    data = Buffer.concat([data, chunk]);
    console.log(`📦 Chunk ${chunkCount}: Received ${chunk.length} bytes`);
  });
  
  // Process complete print job
  socket.on('end', () => {
    console.log('');
    console.log('✅ Print job complete');
    console.log(`📊 Total size: ${data.length} bytes in ${chunkCount} chunks`);
    console.log('');
    
    // Save raw data
    const timestamp = Date.now();
    const filename = `receipt-${timestamp}.bin`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, data);
    console.log(`💾 Raw data saved to: ${filename}`);
    console.log('');
    
    // Analyze data
    analyzeData(data, timestamp);
    
    // Close connection
    socket.end();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  });
  
  socket.on('error', (err) => {
    console.error('❌ Socket error:', err.message);
  });
});

// Start server
server.listen(PORT, HOST, () => {
  console.log('✅ TCP Server started successfully!');
  console.log('');
  console.log(`🌐 Listening on: ${HOST}:${PORT}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('NEXT STEPS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('1. Run: powershell -File setup-test-printer.ps1');
  console.log('2. Open Notepad and type some text');
  console.log('3. Print to "TABEZA Test Printer"');
  console.log('4. Watch this console for output');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('⏳ Waiting for print jobs...');
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
    console.error('2. Change PORT constant in this file');
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

/**
 * Analyze received print data
 */
function analyzeData(data, timestamp) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 DATA ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // 1. Check if data is empty
  if (data.length === 0) {
    console.log('⚠️  WARNING: No data received!');
    console.log('');
    return;
  }
  
  // 2. Try to extract text
  const text = data.toString('utf8');
  const cleanText = text.replace(/[^\x20-\x7E\n\r]/g, ''); // Remove non-printable
  
  console.log('📝 TEXT CONTENT:');
  console.log('───────────────────────────────────────────────────────────');
  if (cleanText.trim().length > 0) {
    console.log(cleanText.substring(0, 500)); // First 500 chars
    if (cleanText.length > 500) {
      console.log(`... (${cleanText.length - 500} more characters)`);
    }
  } else {
    console.log('⚠️  No readable text found (might be binary/ESC-POS)');
  }
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  
  // 3. Show hex dump (first 200 bytes)
  console.log('🔢 HEX DUMP (first 200 bytes):');
  console.log('───────────────────────────────────────────────────────────');
  const hexDump = data.slice(0, 200).toString('hex').match(/.{1,2}/g).join(' ');
  console.log(hexDump);
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  
  // 4. Detect format
  console.log('🔍 FORMAT DETECTION:');
  console.log('───────────────────────────────────────────────────────────');
  
  const hasESCPOS = data.includes(Buffer.from([0x1B])); // ESC character
  const hasPlainText = cleanText.length > data.length * 0.5;
  const hasPDF = data.includes(Buffer.from('%PDF'));
  
  if (hasESCPOS) {
    console.log('✅ ESC/POS commands detected');
    console.log('   → This is thermal printer format');
    console.log('   → Will need ESC/POS parser library');
  }
  
  if (hasPlainText) {
    console.log('✅ Plain text detected');
    console.log('   → Easy to parse');
    console.log('   → Can extract items and total with regex');
  }
  
  if (hasPDF) {
    console.log('✅ PDF format detected');
    console.log('   → Will need PDF parser');
  }
  
  if (!hasESCPOS && !hasPlainText && !hasPDF) {
    console.log('⚠️  Unknown format');
    console.log('   → Check hex dump above');
    console.log('   → May need custom parser');
  }
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  
  // 5. Try to extract receipt info (heuristic)
  console.log('💰 RECEIPT PARSING (HEURISTIC):');
  console.log('───────────────────────────────────────────────────────────');
  
  const totalMatch = cleanText.match(/total[:\s]*[\$]?([\d,]+\.?\d*)/i);
  if (totalMatch) {
    console.log(`✅ Total found: ${totalMatch[1]}`);
  } else {
    console.log('⚠️  Could not find total');
  }
  
  const itemMatches = cleanText.match(/(\d+)\s*x\s*([^\n]+)/gi);
  if (itemMatches && itemMatches.length > 0) {
    console.log(`✅ Items found: ${itemMatches.length}`);
    itemMatches.slice(0, 3).forEach(item => {
      console.log(`   - ${item.trim()}`);
    });
    if (itemMatches.length > 3) {
      console.log(`   ... and ${itemMatches.length - 3} more`);
    }
  } else {
    console.log('⚠️  Could not find items');
  }
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
  
  // 6. Save analysis report
  const report = {
    timestamp,
    size: data.length,
    format: {
      hasESCPOS,
      hasPlainText,
      hasPDF
    },
    text: cleanText.substring(0, 1000),
    hexDump: data.slice(0, 200).toString('hex'),
    parsed: {
      total: totalMatch ? totalMatch[1] : null,
      itemCount: itemMatches ? itemMatches.length : 0
    }
  };
  
  const reportPath = path.join(OUTPUT_DIR, `receipt-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Analysis report saved to: receipt-${timestamp}.json`);
  console.log('');
  
  // 7. Verdict
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 VERDICT:');
  console.log('═══════════════════════════════════════════════════════════');
  
  if (data.length > 0 && (hasPlainText || hasESCPOS)) {
    console.log('✅ SUCCESS! Network printer proxy approach is VIABLE');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test with your actual POS system');
    console.log('2. If POS data looks similar, proceed with full build');
    console.log('3. Estimated timeline: 12-17 days');
  } else if (data.length === 0) {
    console.log('❌ FAILED: No data received');
    console.log('');
    console.log('Possible issues:');
    console.log('1. Printer not configured correctly');
    console.log('2. Firewall blocking connection');
    console.log('3. POS doesn\'t support network printing');
    console.log('');
    console.log('Recommendation: Pivot to PDF printer or file watcher');
  } else {
    console.log('⚠️  UNCERTAIN: Data received but format unclear');
    console.log('');
    console.log('Next steps:');
    console.log('1. Review hex dump above');
    console.log('2. Test with actual POS system');
    console.log('3. May need custom parser');
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('');
  console.log('🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

console.log('💡 TIP: Press Ctrl+C to stop the server');
console.log('');
