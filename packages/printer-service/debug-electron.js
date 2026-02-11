// debug-electron.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const servicePath = path.join(__dirname, 'index.js');

console.log('Testing service spawn...');
console.log('Service path:', servicePath);
console.log('Exists:', fs.existsSync(servicePath));

const env = {
  ...process.env,
  TABEZA_BAR_ID: 'test-bar-id',
  TABEZA_API_URL: 'http://localhost:3003'
};

// Try with node
console.log('\n--- Testing with node ---');
const proc1 = spawn('node', [servicePath], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  cwd: __dirname
});

proc1.stdout.on('data', (data) => console.log(`[node stdout] ${data}`));
proc1.stderr.on('data', (data) => console.log(`[node stderr] ${data}`));
proc1.on('error', (err) => console.error('[node error]', err));
proc1.on('exit', (code) => console.log('[node exit]', code));

// Wait a bit and try with Electron executable
setTimeout(() => {
  console.log('\n--- Testing with Electron executable ---');
  const proc2 = spawn(process.execPath, [servicePath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: __dirname
  });
  
  proc2.stdout.on('data', (data) => console.log(`[electron stdout] ${data}`));
  proc2.stderr.on('data', (data) => console.log(`[electron stderr] ${data}`));
  proc2.on('error', (err) => console.error('[electron error]', err));
  proc2.on('exit', (code) => console.log('[electron exit]', code));
}, 1000);
