const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

console.log('=== DEBUGGING SPOOLER FILE WATCHER ===');

const spoolPath = 'C:\\Windows\\System32\\spool\\PRINTERS';
const fileTypes = ['.SPL', '.SHD'];

console.log(`Spooler path: ${spoolPath}`);
console.log(`File types: ${fileTypes.join(', ')}`);

// Check if directory exists and is accessible
try {
  const stats = fs.statSync(spoolPath);
  console.log(`✅ Directory exists: ${stats.isDirectory()}`);
  console.log(`✅ Directory accessible: Yes`);
} catch (error) {
  console.log(`❌ Directory error: ${error.message}`);
  process.exit(1);
}

// List current files
try {
  const files = fs.readdirSync(spoolPath);
  console.log(`📁 Current files in spooler: ${files.length}`);
  files.forEach(file => {
    const ext = path.extname(file).toUpperCase();
    const isTarget = fileTypes.includes(ext);
    console.log(`   ${file} ${isTarget ? '(TARGET)' : '(ignored)'}`);
  });
} catch (error) {
  console.log(`❌ Cannot list files: ${error.message}`);
}

// Create watcher with detailed logging
console.log('\n📡 Starting file watcher...');

const watcher = chokidar.watch(spoolPath, {
  ignored: (filePath) => {
    const ext = path.extname(filePath).toUpperCase();
    const shouldIgnore = !fileTypes.includes(ext) && filePath !== spoolPath;
    console.log(`🔍 File filter: ${filePath} -> ${shouldIgnore ? 'IGNORE' : 'WATCH'}`);
    return shouldIgnore;
  },
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: false,
  usePolling: true,
  interval: 500, // Poll every 500ms for faster testing
  depth: 0,
});

watcher
  .on('add', (filePath) => {
    console.log(`✅ FILE DETECTED: ${filePath}`);
  })
  .on('change', (filePath) => {
    console.log(`🔄 FILE CHANGED: ${filePath}`);
  })
  .on('unlink', (filePath) => {
    console.log(`🗑️  FILE DELETED: ${filePath}`);
  })
  .on('error', (error) => {
    console.error(`❌ WATCHER ERROR: ${error.message}`);
  })
  .on('ready', () => {
    console.log('📡 File watcher ready and watching');
  });

// Test file creation
setTimeout(() => {
  console.log('\n🧪 Creating test file...');
  const testFile = path.join(spoolPath, 'debug-test.SPL');
  
  try {
    fs.writeFileSync(testFile, 'debug test content');
    console.log(`✅ Created: ${testFile}`);
  } catch (error) {
    console.error(`❌ Failed to create test file: ${error.message}`);
  }
}, 2000);

// Check for test file
setTimeout(() => {
  console.log('\n🔍 Checking if test file exists...');
  const testFile = path.join(spoolPath, 'debug-test.SPL');
  
  try {
    const exists = fs.existsSync(testFile);
    console.log(`📁 Test file exists: ${exists}`);
    
    if (exists) {
      const stats = fs.statSync(testFile);
      console.log(`📊 File size: ${stats.size} bytes`);
    }
  } catch (error) {
    console.error(`❌ Cannot check test file: ${error.message}`);
  }
}, 3000);

// Cleanup
setTimeout(() => {
  console.log('\n🧹 Cleaning up test file...');
  const testFile = path.join(spoolPath, 'debug-test.SPL');
  
  try {
    fs.unlinkSync(testFile);
    console.log(`✅ Deleted: ${testFile}`);
  } catch (error) {
    console.error(`❌ Failed to delete test file: ${error.message}`);
  }
  
  console.log('\n🏁 Debug complete. Press Ctrl+C to exit.');
}, 5000);
