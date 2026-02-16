#!/usr/bin/env node
/**
 * Download Portable Node.js Runtime
 * Downloads Node.js v18.19.0 for Windows and extracts it for bundling
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_VERSION = 'v18.19.0';
const NODE_DIST_URL = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
const DOWNLOAD_DIR = path.join(__dirname, 'nodejs-bundle');
const ZIP_FILE = path.join(DOWNLOAD_DIR, 'node.zip');
const EXTRACT_DIR = path.join(DOWNLOAD_DIR, 'nodejs');

// Helper function for async sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('╔════════════════════════════════════════╗');
console.log('║  Downloading Node.js Runtime           ║');
console.log('╚════════════════════════════════════════╝\n');

// Create download directory
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Check if already downloaded
if (fs.existsSync(EXTRACT_DIR) && fs.existsSync(path.join(EXTRACT_DIR, 'node.exe'))) {
  console.log('✅ Node.js runtime already downloaded');
  console.log(`   Location: ${EXTRACT_DIR}\n`);
  process.exit(0);
}

console.log(`Downloading Node.js ${NODE_VERSION}...`);
console.log(`URL: ${NODE_DIST_URL}\n`);

// Download Node.js
const file = fs.createWriteStream(ZIP_FILE);
let downloadedBytes = 0;
let totalBytes = 0;

https.get(NODE_DIST_URL, (response) => {
  if (response.statusCode !== 200) {
    console.error(`❌ Download failed: HTTP ${response.statusCode}`);
    process.exit(1);
  }

  totalBytes = parseInt(response.headers['content-length'], 10);
  console.log(`Total size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB\n`);

  response.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
    const downloaded = (downloadedBytes / 1024 / 1024).toFixed(2);
    const total = (totalBytes / 1024 / 1024).toFixed(2);
    
    process.stdout.write(`\rProgress: ${percent}% (${downloaded}/${total} MB)`);
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close(async () => {
      console.log('\n\n✅ Download complete\n');
      // Wait a bit for file handle to be released
      await sleep(1000);
      await extractZip();
    });
  });
}).on('error', (err) => {
  fs.unlinkSync(ZIP_FILE);
  console.error(`❌ Download error: ${err.message}`);
  process.exit(1);
});

async function extractZip() {
  console.log('Extracting Node.js runtime...');

  try {
    // Use PowerShell to extract (built into Windows)
    const extractCmd = `powershell -Command "Expand-Archive -Path '${ZIP_FILE}' -DestinationPath '${DOWNLOAD_DIR}' -Force"`;
    execSync(extractCmd, { stdio: 'inherit' });

    // Wait for extraction to complete
    let attempts = 0;
    const maxAttempts = 10;
    const extractedFolder = path.join(DOWNLOAD_DIR, `node-${NODE_VERSION}-win-x64`);
    
    while (!fs.existsSync(extractedFolder) && attempts < maxAttempts) {
      console.log(`Waiting for extraction... (${attempts + 1}/${maxAttempts})`);
      await sleep(1000);
      attempts++;
    }

    if (!fs.existsSync(extractedFolder)) {
      throw new Error('Extraction completed but folder not found');
    }

    // Rename extracted folder to 'nodejs' with retry logic
    if (fs.existsSync(EXTRACT_DIR)) {
      // Remove old nodejs folder
      fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
    }
    
    // Retry rename operation if it fails
    let renameAttempts = 0;
    const maxRenameAttempts = 5;
    let renamed = false;
    
    while (!renamed && renameAttempts < maxRenameAttempts) {
      try {
        fs.renameSync(extractedFolder, EXTRACT_DIR);
        renamed = true;
      } catch (error) {
        renameAttempts++;
        if (renameAttempts < maxRenameAttempts) {
          console.log(`Rename attempt ${renameAttempts} failed, retrying...`);
          await sleep(2000);
        } else {
          throw error;
        }
      }
    }

    // Clean up zip file
    if (fs.existsSync(ZIP_FILE)) {
      fs.unlinkSync(ZIP_FILE);
    }

    console.log('✅ Extraction complete\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  Node.js Runtime Ready                 ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Location: ${EXTRACT_DIR}`);
    console.log(`Version: ${NODE_VERSION}`);
    console.log(`Size: ${getDirectorySize(EXTRACT_DIR)} MB\n`);

    // Verify node.exe exists
    const nodeExe = path.join(EXTRACT_DIR, 'node.exe');
    if (fs.existsSync(nodeExe)) {
      console.log('✅ node.exe verified');
      
      // Test node version
      try {
        const version = execSync(`"${nodeExe}" --version`, { encoding: 'utf8' }).trim();
        console.log(`✅ Node version: ${version}\n`);
      } catch (error) {
        console.warn('⚠️  Could not verify Node version');
      }
    } else {
      console.error('❌ node.exe not found after extraction');
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ Extraction failed: ${error.message}`);
    process.exit(1);
  }
}

function getDirectorySize(dirPath) {
  let size = 0;
  
  function calculateSize(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        calculateSize(filePath);
      } else {
        size += stats.size;
      }
    }
  }
  
  calculateSize(dirPath);
  return (size / 1024 / 1024).toFixed(2);
}
