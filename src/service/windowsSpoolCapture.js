// src/service/windowsSpoolCapture.js
/**
 * Windows Spool Capture via Pause/Copy/Resume
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module captures print jobs by:
 * 1. Monitoring print queue for new jobs
 * 2. Pausing printer automatically
 * 3. Copying .SPL/.SHD files
 * 4. Resuming printer (transparent to user)
 * 5. Processing captured files
 * 
 * Print latency: ~100-500ms (acceptable for POS receipts)
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

const SPOOL_PATH = 'C:\\Windows\\System32\\spool\\PRINTERS';
const CAPTURE_INTERVAL_MS = 500; // Check every 500ms

class WindowsSpoolCapture extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.printerName = options.printerName || 'EPSON L3210 Series';
    this.captureFolder = options.captureFolder || 'C:\\ProgramData\\Tabeza\\captured';
    this.spoolPath = options.spoolPath || SPOOL_PATH;
    
    this.isRunning = false;
    this.monitorInterval = null;
    this.processedJobs = new Set();
    
    // Statistics
    this.stats = {
      jobsDetected: 0,
      jobsCaptured: 0,
      captureErrors: 0,
      lastCapture: null,
      lastError: null,
    };
  }
  
  /**
   * Start monitoring print queue
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Spool capture already running');
      return;
    }
    
    console.log('🚀 Starting Windows spool capture (pause/copy/resume)...');
    console.log(`   Printer: ${this.printerName}`);
    console.log(`   Capture folder: ${this.captureFolder}`);
    console.log('');
    
    // Ensure capture folder exists
    await fs.mkdir(this.captureFolder, { recursive: true });
    
    this.isRunning = true;
    
    // Start monitoring
    this.monitorInterval = setInterval(async () => {
      await this.checkPrintQueue();
    }, CAPTURE_INTERVAL_MS);
    
    console.log('✅ Spool capture started successfully');
  }
  
  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('🛑 Stopping spool capture...');
    
    this.isRunning = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    console.log('✅ Spool capture stopped');
  }
  
  /**
   * Check print queue for new jobs
   */
  async checkPrintQueue() {
    try {
      // Get print queue status via PowerShell
      const psCommand = `Get-PrintJob -PrinterName "${this.printerName}" | Select-Object Id,JobStatus,DocumentName | ConvertTo-Json`;
      
      const { stdout } = await execAsync(`powershell -Command "${psCommand}"`, {
        windowsHide: true,
      });
      
      if (!stdout.trim()) {
        return; // No jobs
      }
      
      const jobs = JSON.parse(stdout);
      const jobList = Array.isArray(jobs) ? jobs : [jobs];
      
      // Process each new job
      for (const job of jobList) {
        const jobId = `${job.Id}`;
        
        if (!this.processedJobs.has(jobId) && job.JobStatus !== 'Printed') {
          await this.captureJob(job);
          this.processedJobs.add(jobId);
        }
      }
      
      // Clean up processed jobs set (keep last 1000)
      if (this.processedJobs.size > 1000) {
        const jobsArray = Array.from(this.processedJobs);
        this.processedJobs.clear();
        jobsArray.slice(-500).forEach(id => this.processedJobs.add(id));
      }
      
    } catch (error) {
      // Silently handle errors (printer might not have jobs)
      if (!error.message.includes('No print jobs')) {
        this.stats.lastError = {
          timestamp: new Date().toISOString(),
          error: error.message,
        };
      }
    }
  }
  
  /**
   * Capture a print job using pause/copy/resume
   */
  async captureJob(job) {
    const jobId = job.Id;
    const startTime = Date.now();
    
    console.log(`📄 New print job detected: ${job.DocumentName} (ID: ${jobId})`);
    
    this.stats.jobsDetected++;
    
    try {
      // Step 1: Pause the printer
      await this.pausePrinter();
      
      // Step 2: Wait a moment for file system to settle
      await this.sleep(100);
      
      // Step 3: Copy .SPL and .SHD files
      const capturedFiles = await this.copySpoolFiles(jobId);
      
      // Step 4: Resume the printer
      await this.resumePrinter();
      
      const captureTime = Date.now() - startTime;
      
      console.log(`✅ Job captured in ${captureTime}ms`);
      console.log(`   Files: ${capturedFiles.join(', ')}`);
      
      this.stats.jobsCaptured++;
      this.stats.lastCapture = new Date().toISOString();
      
      // Emit event with captured files
      this.emit('job-captured', {
        jobId,
        documentName: job.DocumentName,
        files: capturedFiles,
        captureTime,
      });
      
    } catch (error) {
      console.error(`❌ Failed to capture job ${jobId}:`, error.message);
      
      this.stats.captureErrors++;
      this.stats.lastError = {
        timestamp: new Date().toISOString(),
        jobId,
        error: error.message,
      };
      
      // Always try to resume printer even if capture failed
      try {
        await this.resumePrinter();
      } catch (resumeError) {
        console.error('❌ Failed to resume printer:', resumeError.message);
      }
    }
  }
  
  /**
   * Pause the printer
   */
  async pausePrinter() {
    const psCommand = `Suspend-PrintJob -PrinterName "${this.printerName}" -ID *`;
    await execAsync(`powershell -Command "${psCommand}"`, { windowsHide: true });
  }
  
  /**
   * Resume the printer
   */
  async resumePrinter() {
    const psCommand = `Resume-PrintJob -PrinterName "${this.printerName}" -ID *`;
    await execAsync(`powershell -Command "${psCommand}"`, { windowsHide: true });
  }
  
  /**
   * Copy .SPL and .SHD files from spooler
   */
  async copySpoolFiles(jobId) {
    const capturedFiles = [];
    
    // List all files in spooler
    const files = await fs.readdir(this.spoolPath);
    
    // Copy .SPL and .SHD files
    for (const file of files) {
      const ext = path.extname(file).toUpperCase();
      
      if (['.SPL', '.SHD'].includes(ext)) {
        const sourcePath = path.join(this.spoolPath, file);
        const destPath = path.join(this.captureFolder, `job${jobId}_${file}`);
        
        try {
          await fs.copyFile(sourcePath, destPath);
          capturedFiles.push(path.basename(destPath));
        } catch (error) {
          // File might be locked or deleted - continue with others
          console.warn(`⚠️  Could not copy ${file}:`, error.message);
        }
      }
    }
    
    return capturedFiles;
  }
  
  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get capture statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      printerName: this.printerName,
      captureFolder: this.captureFolder,
    };
  }
}

module.exports = WindowsSpoolCapture;
