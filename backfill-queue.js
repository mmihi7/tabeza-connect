/**
 * One-time backfill: reads existing text\ files and enqueues them for upload.
 * Run this once to recover receipts that were captured but never uploaded.
 * 
 * Usage: node backfill-queue.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const TEXT_DIR    = 'C:\\TabezaPrints\\text';
const PENDING_DIR = 'C:\\TabezaPrints\\queue\\pending';
const CONFIG_PATH = 'C:\\TabezaPrints\\config.json';

// Load config
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} else {
  // Fallback to project config
  const projectConfig = path.join(__dirname, 'config.json');
  if (fs.existsSync(projectConfig)) {
    config = JSON.parse(fs.readFileSync(projectConfig, 'utf8'));
  }
}

const barId    = config.barId    || process.env.TABEZA_BAR_ID;
const deviceId = config.driverId || `driver-${require('os').hostname()}`;

if (!barId) {
  console.error('ERROR: barId not found in config. Set TABEZA_BAR_ID env var or fix config.json.');
  process.exit(1);
}

// Ensure pending dir exists
if (!fs.existsSync(PENDING_DIR)) {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  console.log('Created pending dir:', PENDING_DIR);
}

// Find text files
const textFiles = fs.existsSync(TEXT_DIR)
  ? fs.readdirSync(TEXT_DIR).filter(f => f.endsWith('.txt'))
  : [];

if (textFiles.length === 0) {
  console.log('No text files found in', TEXT_DIR);
  process.exit(0);
}

console.log(`Found ${textFiles.length} text file(s) to backfill...\n`);

let enqueued = 0;
let skipped  = 0;

for (const file of textFiles) {
  const textPath = path.join(TEXT_DIR, file);
  const text = fs.readFileSync(textPath, 'utf8').trim();

  if (!text) {
    console.log(`  SKIP (empty): ${file}`);
    skipped++;
    continue;
  }

  // Build queue item matching LocalQueue.enqueue() format
  const id = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queueItem = {
    id,
    barId,
    deviceId,
    timestamp:         new Date().toISOString(),
    escposBytes:       null,
    text,
    metadata: {
      source:    'backfill',
      textFile:  file,
      backfilledAt: new Date().toISOString(),
    },
    enqueuedAt:        new Date().toISOString(),
    uploadAttempts:    0,
    lastUploadAttempt: null,
    lastUploadError:   null,
  };

  const outPath = path.join(PENDING_DIR, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(queueItem, null, 2), 'utf8');
  console.log(`  ENQUEUED: ${file} → ${id}.json`);
  enqueued++;

  // Small delay to ensure unique IDs
  // (timestamp-based, so sleep 1ms between items)
  const start = Date.now();
  while (Date.now() - start < 2) {}
}

console.log(`\nDone. Enqueued: ${enqueued}, Skipped: ${skipped}`);
console.log(`\nNow start the service (or restart it) and the upload worker will pick these up.`);
console.log(`Upload target: ${config.apiUrl}/api/printer/relay`);
