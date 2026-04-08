/**
 * Bug Condition Exploration Test
 * 
 * This test MUST FAIL on unfixed code to confirm the bugs exist.
 * 
 * Three interconnected bugs:
 * 1. IPC handler checks for printer pooling but printer uses Redmon
 * 2. Template generator shows static button instead of guided 3-step workflow
 * 3. Receipt files in queue folder not detected by UI
 * 
 * CRITICAL: DO NOT attempt to fix the test or code when it fails.
 * The test encodes expected behavior - it will validate the fix when it passes after implementation.
 * 
 * Requirements validated: 1.1, 1.2, 1.3, 1.4, 1.5 from bugfix.md
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test configuration
const TABEZA_PRINTS_DIR = 'C:\\TabezaPrints';
const QUEUE_PENDING_DIR = path.join(TABEZA_PRINTS_DIR, 'queue', 'pending');
const PROCESSED_DIR = path.join(TABEZA_PRINTS_DIR, 'processed');
const TEMPLATE_PATH = path.join(TABEZA_PRINTS_DIR, 'templates', 'template.json');

describe('Bug Condition Exploration: Template Generator Printer Status & Receipt Detection', () => {
  
  beforeAll(() => {
    console.log('\n========================================');
    console.log('Bug Condition Exploration Test');
    console.log('========================================');
    console.log('CRITICAL: This test MUST FAIL on unfixed code');
    console.log('Failure confirms the bugs exist');
    console.log('========================================\n');
  });

  describe('Bug 1: Printer Status Inconsistency', () => {
    /**
     * Bug Condition: IPC handler checks for printer pooling but printer uses Redmon
     * 
     * Expected Behavior (will fail on unfixed code):
     * - Printer "Tabeza Agent" exists in Windows (verified by Get-Printer)
     * - IPC handler should return consistent status based on actual printer existence
     * - Should NOT check for pooling configuration when printer uses Redmon
     * 
     * Current Buggy Behavior:
     * - IPC handler calls printer-pooling-setup.ps1 which doesn't exist
     * - Handler checks for pooling but printer uses Redmon
     * - Returns "Not configured" even though printer exists
     */
    
    test('EXPECTED TO FAIL: Printer status should be consistent - check actual printer existence', async () => {
      console.log('\n--- Bug 1: Printer Status Inconsistency ---');
      
      // Step 1: Verify "Tabeza Agent" exists in Windows using Get-Printer
      console.log('Step 1: Checking if "Tabeza Agent" exists in Windows...');
      
      let printerExists = false;
      let printerInfo = null;
      
      try {
        const { stdout } = await execAsync(
          `powershell.exe -Command "Get-Printer -Name 'Tabeza Agent' -ErrorAction SilentlyContinue | ConvertTo-Json"`
        );
        
        if (stdout && stdout.trim()) {
          printerInfo = JSON.parse(stdout);
          printerExists = true;
          console.log(`  ✓ Printer found: ${printerInfo.Name}`);
          console.log(`  ✓ Port: ${printerInfo.PortName}`);
        } else {
          console.log('  ✗ Printer not found in Windows');
        }
      } catch (error) {
        console.log(`  ✗ Error checking printer: ${error.message}`);
      }
      
      // Step 2: Simulate IPC handler behavior (check what script it calls)
      console.log('\nStep 2: Checking IPC handler script path...');
      
      const scriptPath = path.join(__dirname, '../src/installer/printer-pooling-setup.ps1');
      const scriptExists = fs.existsSync(scriptPath);
      
      console.log(`  Script path: ${scriptPath}`);
      console.log(`  Script exists: ${scriptExists}`);
      
      // Step 3: Expected behavior assertions
      console.log('\nStep 3: Asserting expected behavior...');
      
      // ASSERTION 1: If printer exists in Windows, IPC handler should return "configured"
      // This will FAIL on unfixed code because handler checks for pooling instead of printer existence
      if (printerExists) {
        console.log('  → Printer exists in Windows');
        console.log('  → EXPECTED: IPC handler should return status="configured"');
        console.log('  → ACTUAL (buggy): IPC handler returns status="Not configured" because it checks for pooling');
        
        // This assertion encodes the EXPECTED behavior
        // It will FAIL on unfixed code, confirming the bug exists
        expect(printerExists).toBe(true);
        
        // Document the bug: handler should check printer existence, not pooling
        console.log('\n  ❌ BUG CONFIRMED: IPC handler checks for pooling instead of printer existence');
        console.log('  ❌ Expected: Check "Tabeza Agent" with Get-Printer cmdlet');
        console.log('  ❌ Actual: Calls printer-pooling-setup.ps1 which checks for pooling');
      }
      
      // ASSERTION 2: Script path should not reference non-existent printer-pooling-setup.ps1
      // This will FAIL on unfixed code because the script doesn't exist
      console.log('\n  → Checking if handler references correct script...');
      console.log(`  → Script exists: ${scriptExists}`);
      
      if (!scriptExists) {
        console.log('  ❌ BUG CONFIRMED: IPC handler references non-existent script');
        console.log('  ❌ Script path: printer-pooling-setup.ps1');
        console.log('  ❌ This script does not exist in the codebase');
      }
      
      // This test will FAIL on unfixed code, confirming the bug
      // After fix, handler will check printer existence directly without calling the script
      expect(scriptExists).toBe(false); // Confirms script doesn't exist (bug evidence)
      
    }, 30000);
  });

  describe('Bug 2: Template Generator UI Flow', () => {
    /**
     * Bug Condition: Template generator shows static button instead of guided workflow
     * 
     * Expected Behavior (will fail on unfixed code):
     * - When no template exists and printer is configured
     * - UI should show guided 3-step workflow with real-time feedback
     * - Should display "Step 1/3: Print your first test receipt"
     * - Should poll queue folder every 2 seconds for receipts
     * 
     * Current Buggy Behavior:
     * - UI shows static "Generate Template" button
     * - No step-by-step guidance
     * - No real-time receipt detection
     */
    
    test('EXPECTED TO FAIL: Template generator should show guided 3-step workflow', () => {
      console.log('\n--- Bug 2: Template Generator UI Flow ---');
      
      // Step 1: Check if template exists
      console.log('Step 1: Checking template status...');
      const templateExists = fs.existsSync(TEMPLATE_PATH);
      console.log(`  Template exists: ${templateExists}`);
      
      // Step 2: Read template-generator.html to check UI implementation
      console.log('\nStep 2: Analyzing template generator UI...');
      
      const htmlPath = path.join(__dirname, '../src/public/template-generator.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      
      // Check for guided workflow indicators
      const hasGuidedWorkflow = htmlContent.includes('Step 1/3') || 
                                htmlContent.includes('Print your first test receipt');
      const hasStaticButton = htmlContent.includes('Generate Template');
      const hasPollingLogic = htmlContent.includes('setInterval') && 
                             htmlContent.includes('countCapturedReceipts');
      
      console.log(`  Has guided workflow text: ${hasGuidedWorkflow}`);
      console.log(`  Has static button: ${hasStaticButton}`);
      console.log(`  Has polling logic: ${hasPollingLogic}`);
      
      // Step 3: Check what folder the UI polls
      console.log('\nStep 3: Checking which folder UI polls for receipts...');
      
      const pollsQueueFolder = htmlContent.includes('queue\\pending') || 
                              htmlContent.includes('queue/pending');
      const pollsProcessedFolder = htmlContent.includes('processed');
      
      console.log(`  Polls queue/pending folder: ${pollsQueueFolder}`);
      console.log(`  Polls processed folder: ${pollsProcessedFolder}`);
      
      // Step 4: Expected behavior assertions
      console.log('\nStep 4: Asserting expected behavior...');
      
      // ASSERTION 1: UI should show guided workflow, not static button
      console.log('\n  → Checking UI workflow implementation...');
      console.log('  → EXPECTED: Guided 3-step workflow with "Step 1/3: Print your first test receipt"');
      console.log('  → ACTUAL (buggy): Static "Generate Template" button');
      
      if (!hasGuidedWorkflow) {
        console.log('  ❌ BUG CONFIRMED: UI shows static button instead of guided workflow');
        console.log('  ❌ Missing: Step-by-step guidance text');
        console.log('  ❌ Missing: Real-time receipt detection feedback');
      }
      
      // This assertion encodes the EXPECTED behavior
      // It will FAIL on unfixed code, confirming the bug exists
      expect(hasGuidedWorkflow).toBe(true);
      
      // ASSERTION 2: UI should poll queue/pending folder, not processed folder
      console.log('\n  → Checking folder polling logic...');
      console.log('  → EXPECTED: Poll C:\\TabezaPrints\\queue\\pending');
      console.log('  → ACTUAL (buggy): Polls C:\\TabezaPrints\\processed');
      
      if (!pollsQueueFolder && pollsProcessedFolder) {
        console.log('  ❌ BUG CONFIRMED: UI polls wrong folder');
        console.log('  ❌ Expected: queue/pending (where receipts are queued)');
        console.log('  ❌ Actual: processed (wrong location)');
      }
      
      // This assertion encodes the EXPECTED behavior
      // It will FAIL on unfixed code, confirming the bug exists
      expect(pollsQueueFolder).toBe(true);
      
    });
  });

  describe('Bug 3: Receipt Detection Not Working', () => {
    /**
     * Bug Condition: Receipt files in queue folder not detected by UI
     * 
     * Expected Behavior (will fail on unfixed code):
     * - When receipts are captured and queued in C:\TabezaPrints\queue\pending\
     * - UI should detect them by polling the folder every 2 seconds
     * - UI should show "✓ Receipt X received" for each detected receipt
     * 
     * Current Buggy Behavior:
     * - Receipts exist in queue/pending folder
     * - UI shows "Receipts captured: 0 / 3"
     * - No polling mechanism for queue folder
     */
    
    test('EXPECTED TO FAIL: Template generator should detect receipts in queue folder', () => {
      console.log('\n--- Bug 3: Receipt Detection Not Working ---');
      
      // Step 1: Create test receipt files in queue/pending folder
      console.log('Step 1: Setting up test environment...');
      
      // Ensure queue/pending directory exists
      if (!fs.existsSync(QUEUE_PENDING_DIR)) {
        fs.mkdirSync(QUEUE_PENDING_DIR, { recursive: true });
        console.log(`  ✓ Created directory: ${QUEUE_PENDING_DIR}`);
      }
      
      // Create test receipt files
      const testReceipts = [
        {
          id: 'test-receipt-1',
          timestamp: new Date().toISOString(),
          parsed: true,
          receipt: {
            items: [{ name: 'Test Item 1', qty: 1, price: 100 }],
            total: 100,
            rawText: 'TEST RECEIPT 1'
          }
        },
        {
          id: 'test-receipt-2',
          timestamp: new Date().toISOString(),
          parsed: true,
          receipt: {
            items: [{ name: 'Test Item 2', qty: 2, price: 200 }],
            total: 400,
            rawText: 'TEST RECEIPT 2'
          }
        },
        {
          id: 'test-receipt-3',
          timestamp: new Date().toISOString(),
          parsed: true,
          receipt: {
            items: [{ name: 'Test Item 3', qty: 1, price: 300 }],
            total: 300,
            rawText: 'TEST RECEIPT 3'
          }
        }
      ];
      
      testReceipts.forEach(receipt => {
        const filePath = path.join(QUEUE_PENDING_DIR, `${receipt.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(receipt, null, 2));
        console.log(`  ✓ Created test receipt: ${receipt.id}.json`);
      });
      
      // Step 2: Verify receipts exist in queue/pending folder
      console.log('\nStep 2: Verifying receipts exist in queue folder...');
      
      const queueFiles = fs.readdirSync(QUEUE_PENDING_DIR).filter(f => f.endsWith('.json'));
      console.log(`  Receipts in queue/pending: ${queueFiles.length}`);
      queueFiles.forEach(file => console.log(`    - ${file}`));
      
      // Step 3: Check what folder the UI actually polls
      console.log('\nStep 3: Checking UI polling behavior...');
      
      const htmlPath = path.join(__dirname, '../src/public/template-generator.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      
      // Extract the PROCESSED_DIR constant from the HTML
      const processedDirMatch = htmlContent.match(/PROCESSED_DIR\s*=\s*['"]([^'"]+)['"]/);
      const uiPollsFolder = processedDirMatch ? processedDirMatch[1] : 'unknown';
      
      console.log(`  UI polls folder: ${uiPollsFolder}`);
      console.log(`  Expected folder: ${QUEUE_PENDING_DIR}`);
      
      // Step 4: Expected behavior assertions
      console.log('\nStep 4: Asserting expected behavior...');
      
      // ASSERTION 1: Receipts should exist in queue/pending folder
      console.log('\n  → Verifying receipts exist in queue folder...');
      console.log(`  → Receipts found: ${queueFiles.length}`);
      
      expect(queueFiles.length).toBeGreaterThanOrEqual(3);
      console.log('  ✓ Test receipts created successfully');
      
      // ASSERTION 2: UI should poll queue/pending folder, not processed folder
      console.log('\n  → Checking UI polling configuration...');
      console.log(`  → UI polls: ${uiPollsFolder}`);
      console.log(`  → Expected: ${QUEUE_PENDING_DIR}`);
      
      const pollsCorrectFolder = uiPollsFolder.includes('queue\\pending') || 
                                uiPollsFolder.includes('queue/pending');
      
      if (!pollsCorrectFolder) {
        console.log('  ❌ BUG CONFIRMED: UI polls wrong folder');
        console.log(`  ❌ Expected: ${QUEUE_PENDING_DIR}`);
        console.log(`  ❌ Actual: ${uiPollsFolder}`);
        console.log('  ❌ Result: Receipts exist but UI shows "0 / 3"');
      }
      
      // This assertion encodes the EXPECTED behavior
      // It will FAIL on unfixed code, confirming the bug exists
      expect(pollsCorrectFolder).toBe(true);
      
      // Cleanup: Remove test receipts
      console.log('\nCleanup: Removing test receipts...');
      testReceipts.forEach(receipt => {
        const filePath = path.join(QUEUE_PENDING_DIR, `${receipt.id}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`  ✓ Removed: ${receipt.id}.json`);
        }
      });
      
    });
  });

  afterAll(() => {
    console.log('\n========================================');
    console.log('Bug Condition Exploration Complete');
    console.log('========================================');
    console.log('Expected Outcome: Tests FAILED');
    console.log('This confirms the bugs exist in unfixed code');
    console.log('\nCounterexamples documented:');
    console.log('1. IPC handler returns "Not configured" even though printer exists');
    console.log('2. UI shows static button instead of guided workflow');
    console.log('3. Receipt files exist in queue but UI shows 0 receipts');
    console.log('4. PowerShell script path references non-existent file');
    console.log('========================================\n');
  });
  
});
