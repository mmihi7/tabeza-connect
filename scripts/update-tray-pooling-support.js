/**
 * Test script for SimpleCapture class
 * 
 * This script tests the basic functionality of SimpleCapture:
 * - Initialization
 * - File watching
 * - Stability detection
 * - File capture and enqueue
 */

const SimpleCapture = require('./src/service/simpleCapture');
const LocalQueue = require('./src/service/localQueue');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Test configuration
const TEST_DIR = path.join(__dirname, 'update-tray-pooling-support');
const CAPTURE_FILE = path.join(TEST_DIR, 'order.prn');
const TEMP_FOLDER = path.join(TEST_DIR, 'captures');
const QUEUE_PATH = path.join(TEST_DIR, 'queue');

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    console.log('🧹 Cleaned up test directory');
  } catch (error) {
    console.error('Failed to cleanup:', error.message);
  }
}

async function setup() {
  console.log('📋 Setting up test environment...');
  
  // Create test directory
  await fs.mkdir(TEST_DIR, { recursive: true });
  
  // Initialize LocalQueue
  const localQueue = new LocalQueue({ queuePath: QUEUE_PATH });
  await localQueue.initialize();
  
  return localQueue;
}

async function testBasicCapture() {
  console.log('\n=== Test 1: Basic File Capture ===\n');
  
  const localQueue = await setup();
  
  // Create SimpleCapture instance
  const simpleCapture = new SimpleCapture({
    captureFile: CAPTURE_FILE,
    tempFolder: TEMP_FOLDER,
    localQueue,
    barId: 'test-bar-123',
    deviceId: 'test-device-456',
    stabilityChecks: 3,
    stabilityDelay: 100,
  });
  
  // Listen to events
  simpleCapture.on('started', () => {
    console.log('✅ SimpleCapture started event received');
  });
  
  simpleCapture.on('file-captured', (receiptId) => {
    console.log(`✅ File captured event received: ${receiptId}`);
  });
  
  simpleCapture.on('error', (error) => {
    console.error(`❌ Error event received: ${error.message}`);
  });
  
  // Start capture
  await simpleCapture.start();
  
  console.log('📝 Writing test data to capture file...');
  
  // Write test data (simulate POS printing)
  const testData = Buffer.from('Test receipt data - ESC/POS bytes here');
  await fs.writeFile(CAPTURE_FILE, testData);
  
  // Wait for stability checks and processing
  console.log('⏳ Waiting for stability detection and processing...');
  await sleep(1000);
  
  // Check statistics
  const stats = simpleCapture.getStats();
  console.log('\n📊 Statistics:');
  console.log(`   Files detected: ${stats.filesDetected}`);
  console.log(`   Files captured: ${stats.filesCaptured}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Last capture: ${stats.lastCapture}`);
  
  // Check queue
  const queueSize = await localQueue.getQueueSize();
  console.log(`\n📦 Queue size: ${queueSize}`);
  
  // Check temp folder
  const tempFiles = await fs.readdir(TEMP_FOLDER);
  console.log(`📁 Temp files: ${tempFiles.length}`);
  if (tempFiles.length > 0) {
    console.log(`   Files: ${tempFiles.join(', ')}`);
  }
  
  // Verify original file still exists
  const originalExists = fsSync.existsSync(CAPTURE_FILE);
  console.log(`📄 Original file preserved: ${originalExists ? '✅' : '❌'}`);
  
  // Stop capture
  await simpleCapture.stop();
  
  console.log('\n✅ Test 1 completed\n');
}

async function testMultipleCaptures() {
  console.log('\n=== Test 2: Multiple File Captures ===\n');
  
  await cleanup();
  const localQueue = await setup();
  
  const simpleCapture = new SimpleCapture({
    captureFile: CAPTURE_FILE,
    tempFolder: TEMP_FOLDER,
    localQueue,
    barId: 'test-bar-123',
    deviceId: 'test-device-456',
  });
  
  let capturedCount = 0;
  simpleCapture.on('file-captured', () => {
    capturedCount++;
  });
  
  await simpleCapture.start();
  
  console.log('📝 Writing 5 test receipts...');
  
  // Write multiple receipts
  for (let i = 1; i <= 5; i++) {
    const testData = Buffer.from(`Receipt ${i} - Test data`);
    await fs.writeFile(CAPTURE_FILE, testData);
    console.log(`   Receipt ${i} written`);
    await sleep(500); // Wait for processing
  }
  
  // Wait for all processing to complete
  await sleep(1000);
  
  const stats = simpleCapture.getStats();
  console.log('\n📊 Statistics:');
  console.log(`   Files detected: ${stats.filesDetected}`);
  console.log(`   Files captured: ${stats.filesCaptured}`);
  console.log(`   Captured events: ${capturedCount}`);
  
  const queueSize = await localQueue.getQueueSize();
  console.log(`\n📦 Queue size: ${queueSize}`);
  
  const tempFiles = await fs.readdir(TEMP_FOLDER);
  console.log(`📁 Temp files: ${tempFiles.length}`);
  
  // Verify unique filenames
  const uniqueFiles = new Set(tempFiles);
  console.log(`🔍 All filenames unique: ${uniqueFiles.size === tempFiles.length ? '✅' : '❌'}`);
  
  await simpleCapture.stop();
  
  console.log('\n✅ Test 2 completed\n');
}

async function testGracefulShutdown() {
  console.log('\n=== Test 3: Graceful Shutdown ===\n');
  
  await cleanup();
  const localQueue = await setup();
  
  const simpleCapture = new SimpleCapture({
    captureFile: CAPTURE_FILE,
    tempFolder: TEMP_FOLDER,
    localQueue,
    barId: 'test-bar-123',
    deviceId: 'test-device-456',
  });
  
  simpleCapture.on('stopped', () => {
    console.log('✅ Stopped event received');
  });
  
  await simpleCapture.start();
  console.log('✅ Started');
  
  // Write file and immediately stop
  const testData = Buffer.from('Test receipt during shutdown');
  await fs.writeFile(CAPTURE_FILE, testData);
  
  console.log('🛑 Stopping during processing...');
  await simpleCapture.stop();
  
  console.log(`✅ Stopped gracefully (isRunning: ${simpleCapture.isRunning})`);
  
  console.log('\n✅ Test 3 completed\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllTests() {
  console.log('🚀 Starting SimpleCapture Tests\n');
  
  try {
    await testBasicCapture();
    await testMultipleCaptures();
    await testGracefulShutdown();
    
    console.log('✅ All tests completed successfully!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await cleanup();
  }
}

// Run tests
runAllTests();

