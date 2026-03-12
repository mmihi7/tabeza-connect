/**
 * Run from project root:
 *   node fix-whenready.js
 *
 * Fixes two issues in src/electron-main.js:
 *  1. app.whenReady() never calls initialize()
 *  2. ASSETS_PATH re-declared as const inside whenReady (shadows global)
 */

const fs   = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'electron-main.js');
let src = fs.readFileSync(filePath, 'utf8');

// ── Fix 1: const ASSETS_PATH → let ASSETS_PATH ───────────────────────────────
if (src.includes("const ASSETS_PATH = path.join(__dirname, '../assets');")) {
  src = src.replace(
    "const ASSETS_PATH = path.join(__dirname, '../assets');",
    "let ASSETS_PATH = path.join(__dirname, '../assets'); // updated in whenReady"
  );
  console.log('✅ Fix 1: ASSETS_PATH changed from const to let');
} else if (src.includes("let ASSETS_PATH")) {
  console.log('⏭  Fix 1: ASSETS_PATH already a let — skipping');
} else {
  console.warn('⚠️  Fix 1: Could not find ASSETS_PATH declaration — check manually');
}

// ── Fix 2: whenReady block — add ASSETS_PATH assignment + await initialize() ─
const OLD_WHEN_READY = `app.whenReady().then(() => {
  log('INFO', 'Electron app ready - starting initialization sequence');
  
  // Set development mode now that app is ready
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // Update ASSETS_PATH based on development mode
  const ASSETS_PATH = isDev 
    ? path.join(__dirname, '../assets')
    : path.join(process.resourcesPath, 'assets');
  
  // Initialize state synchronization system FIRST
  initializeStateSync();
  
  // Continue with rest of app initialization...
  // (Other initialization code will follow)
});`;

const NEW_WHEN_READY = `app.whenReady().then(async () => {
  log('INFO', 'Electron app ready - starting initialization sequence');
  
  // Set development mode now that app is ready
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  // Update global ASSETS_PATH (assign, not re-declare)
  ASSETS_PATH = isDev 
    ? path.join(__dirname, '../assets')
    : path.join(process.resourcesPath, 'assets');

  log('INFO', \`isDev: \${isDev}, ASSETS_PATH: \${ASSETS_PATH}\`);
  
  // Initialize state synchronization system FIRST
  initializeStateSync();
  
  // Run full app initialization (tray, service, printer check, etc.)
  await initialize();
});`;

if (src.includes(OLD_WHEN_READY)) {
  src = src.replace(OLD_WHEN_READY, NEW_WHEN_READY);
  console.log('✅ Fix 2: whenReady now calls initialize()');
} else if (src.includes('await initialize()')) {
  console.log('⏭  Fix 2: initialize() already called in whenReady — skipping');
} else {
  // Fallback: find the block by key signature and patch it
  const marker = "// Continue with rest of app initialization...\n  // (Other initialization code will follow)\n});";
  if (src.includes(marker)) {
    src = src.replace(
      marker,
      "// Run full app initialization\n  await initialize();\n});"
    );
    // Also make it async
    src = src.replace(
      "app.whenReady().then(() => {",
      "app.whenReady().then(async () => {"
    );
    // Fix the const ASSETS_PATH inside whenReady
    src = src.replace(
      "  const ASSETS_PATH = isDev",
      "  ASSETS_PATH = isDev"
    );
    console.log('✅ Fix 2: Applied via fallback marker');
  } else {
    console.error('❌ Fix 2: Could not patch whenReady — check electron-main.js manually');
    console.error('   Find app.whenReady() and add: await initialize(); before the closing });');
    process.exit(1);
  }
}

// ── Write output ──────────────────────────────────────────────────────────────
fs.writeFileSync(filePath + '.bak2', fs.readFileSync(filePath), 'utf8');
fs.writeFileSync(filePath, src, 'utf8');

// ── Verify ────────────────────────────────────────────────────────────────────
const hasInit    = src.includes('await initialize()');
const hasLetAssets = src.includes('let ASSETS_PATH');
console.log(`\n📊 Verification:`);
console.log(`   await initialize() present: ${hasInit}`);
console.log(`   ASSETS_PATH is let:         ${hasLetAssets}`);
console.log(`\n📁 Backup saved to: ${filePath}.bak2`);
console.log(hasInit ? '\n✅ All good — run npm start' : '\n❌ initialize() still missing — manual fix needed');
