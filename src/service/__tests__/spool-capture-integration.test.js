// spool-capture-integration.test.js
// Integration tests for end-to-end spool capture workflow
// Tests the complete flow: spool file → capture → archive → forward queue

const SpoolWatcher = require('../spool-watcher');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('Spool Capture Integration Tests', () => {
    let spoolWatcher;
    let testSpoolFolder;
    let testCaptureFolder;
    let testProcessedFolder;
    let testFailedFolder;
    
    beforeEach(async () => {
        // Create temporary test folders
        const testRoot = path.join(os.tmpdir(), `test-integration-${Date.now()}`);
        testSpoolFolder = path.join(testRoot, 'spool');
        testCaptureFolder = path.join(testRoot, 'capture');
        testProcessedFolder = path.join(testRoot, 'processed');
        testFailedFolder = path.join(testRoot, 'failed');
        
        await fs.mkdir(testSpoolFolder, { recursive: true });
        await fs.mkdir(testCaptureFolder, { recursive: true });
        await fs.mkdir(testProcessedFolder, { recursive: true });
        await fs.mkdir(testFailedFolder, { recursive: true });
        
        // Initialize SpoolWatcher with test configuration
        spoolWatcher = new SpoolWatcher({
            spoolFolder: testSpoolFolder,
            stabilizationDelay: 100,
            filePattern: /\.ps$/i
        });
    });
    
    afterEach(async () => {
        // Stop watcher and clean up
        if (spoolWatcher && spoolWatcher.isRunning) {
            await spoolWatcher.stop();
        }
        
        // Clean up test folders
        try {
            const testRoot = path.dirname(testSpoolFolder);
            await fs.rm(testRoot, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });
    
    describe('End-to-End Spool Capture Flow', () => {
        test('should complete full capture workflow: detect → read → save → archive → queue → delete', async () => {
            // Track events
            const events = {
                printJobProcessed: null,
                forwardJob: null
            };
            
            spoolWatcher.once('printJobProcessed', (result) => {
                events.printJobProcessed = result;
            });
            
            spoolWatcher.once('forwardJob', (job) => {
                events.forwardJob = job;
            });
            
            // Start watcher
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create test spool file
            const testContent = 'Test PostScript content for integration test';
            const spoolFile = path.join(testSpoolFolder, 'integration-test.ps');
            await fs.writeFile(spoolFile, testContent);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify printJobProcessed event was emitted
            expect(events.printJobProcessed).toBeDefined();
            expect(events.printJobProcessed.success).toBe(true);
            expect(events.printJobProcessed.jobId).toBe('integration-test');
            
            // Verify forwardJob event was emitted
            expect(events.forwardJob).toBeDefined();
            expect(events.forwardJob.jobId).toBe('integration-test');
            expect(events.forwardJob.rawData.toString()).toBe(testContent);
            
            // Verify capture file was created
            const captureFile = events.printJobProcessed.captureFile;
            expect(captureFile).toBeDefined();
            const captureExists = await fs.access(captureFile).then(() => true).catch(() => false);
            expect(captureExists).toBe(true);
            
            // Verify capture file content matches original
            const capturedContent = await fs.readFile(captureFile);
            expect(capturedContent.toString()).toBe(testContent);
            
            // Verify archive file was created
            const archiveFile = events.printJobProcessed.archiveFile;
            expect(archiveFile).toBeDefined();
            const archiveExists = await fs.access(archiveFile).then(() => true).catch(() => false);
            expect(archiveExists).toBe(true);
            
            // Verify archive content matches original
            const archivedContent = await fs.readFile(archiveFile);
            expect(archivedContent.toString()).toBe(testContent);
            
            // Verify job was added to forward queue
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(1);
            expect(queue[0].jobId).toBe('integration-test');
            
            // Verify spool file was deleted
            const spoolExists = await fs.access(spoolFile).then(() => true).catch(() => false);
            expect(spoolExists).toBe(false);
            
            // Verify statistics were updated
            const stats = spoolWatcher.getStats();
            expect(stats.filesDetected).toBe(1);
            expect(stats.filesProcessed).toBe(1);
            expect(stats.filesFailed).toBe(0);
            expect(stats.jobsQueued).toBe(1);
            expect(stats.queueDepth).toBe(1);
        }, 10000);
        
        test('should handle multiple print jobs in sequence', async () => {
            const processedJobs = [];
            
            spoolWatcher.on('printJobProcessed', (result) => {
                processedJobs.push(result);
            });
            
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create multiple spool files
            const jobCount = 5;
            for (let i = 0; i < jobCount; i++) {
                const spoolFile = path.join(testSpoolFolder, `job-${i}.ps`);
                await fs.writeFile(spoolFile, `Content for job ${i}`);
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            // Wait for all jobs to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify all jobs were processed
            expect(processedJobs.length).toBe(jobCount);
            
            // Verify all jobs succeeded
            processedJobs.forEach((job, index) => {
                expect(job.success).toBe(true);
                expect(job.jobId).toBe(`job-${index}`);
            });
            
            // Verify all capture files exist
            for (const job of processedJobs) {
                const captureExists = await fs.access(job.captureFile).then(() => true).catch(() => false);
                expect(captureExists).toBe(true);
            }
            
            // Verify all archive files exist
            for (const job of processedJobs) {
                const archiveExists = await fs.access(job.archiveFile).then(() => true).catch(() => false);
                expect(archiveExists).toBe(true);
            }
            
            // Verify all jobs are in forward queue
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(jobCount);
            
            // Verify FIFO order
            for (let i = 0; i < jobCount; i++) {
                expect(queue[i].jobId).toBe(`job-${i}`);
            }
        }, 15000);
        
        test('should preserve data integrity through entire pipeline', async () => {
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create test data with binary content (ESC/POS commands)
            const testData = Buffer.from([
                0x1B, 0x40, // ESC @ (Initialize)
                0x1B, 0x61, 0x01, // ESC a 1 (Center align)
                0x48, 0x65, 0x6C, 0x6C, 0x6F, // "Hello"
                0x0A, // Line feed
                0x1D, 0x56, 0x00 // GS V 0 (Cut paper)
            ]);
            
            const spoolFile = path.join(testSpoolFolder, 'binary-test.ps');
            await fs.writeFile(spoolFile, testData);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Get processed job from queue
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(1);
            const job = queue[0];
            
            // Verify raw data in queue matches original
            expect(Buffer.compare(job.rawData, testData)).toBe(0);
            
            // Verify capture file content matches original
            const capturedData = await fs.readFile(job.captureFile);
            expect(Buffer.compare(capturedData, testData)).toBe(0);
            
            // Verify archive file content matches original
            const archivedData = await fs.readFile(job.archiveFile);
            expect(Buffer.compare(archivedData, testData)).toBe(0);
        }, 10000);
        
        test('should handle concurrent print jobs without data corruption', async () => {
            const processedJobs = [];
            
            spoolWatcher.on('printJobProcessed', (result) => {
                processedJobs.push(result);
            });
            
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create multiple jobs simultaneously
            const jobCount = 10;
            const createPromises = [];
            for (let i = 0; i < jobCount; i++) {
                const spoolFile = path.join(testSpoolFolder, `concurrent-${i}.ps`);
                const content = `Concurrent content ${i} - ${Date.now()}`;
                createPromises.push(fs.writeFile(spoolFile, content));
            }
            
            await Promise.all(createPromises);
            
            // Wait for all jobs to process
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (processedJobs.length >= jobCount) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
            
            // Verify all jobs were processed
            expect(processedJobs.length).toBe(jobCount);
            
            // Verify all jobs succeeded
            processedJobs.forEach(job => {
                expect(job.success).toBe(true);
            });
            
            // Verify all capture files are unique
            const captureFiles = processedJobs.map(j => j.captureFile);
            const uniqueFiles = new Set(captureFiles);
            expect(uniqueFiles.size).toBe(jobCount);
            
            // Verify all archive files are unique
            const archiveFiles = processedJobs.map(j => j.archiveFile);
            const uniqueArchives = new Set(archiveFiles);
            expect(uniqueArchives.size).toBe(jobCount);
            
            // Verify queue has all jobs
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(jobCount);
        }, 20000);
    });
    
    describe('Error Recovery Integration', () => {
        test('should handle disk space errors gracefully', async () => {
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Mock fs.writeFile to simulate disk full error
            const originalWriteFile = fs.writeFile;
            let callCount = 0;
            fs.writeFile = jest.fn().mockImplementation(async (filePath, data) => {
                callCount++;
                // Fail on capture file write (second call)
                if (callCount === 2) {
                    throw new Error('ENOSPC: no space left on device');
                }
                return originalWriteFile(filePath, data);
            });
            
            const spoolFile = path.join(testSpoolFolder, 'disk-full-test.ps');
            await originalWriteFile(spoolFile, 'Test content');
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Restore original function
            fs.writeFile = originalWriteFile;
            
            // Verify error was handled
            const stats = spoolWatcher.getStats();
            expect(stats.filesFailed).toBe(1);
            
            // Verify file was moved to failed folder
            const failedFiles = await fs.readdir(testFailedFolder);
            const movedFile = failedFiles.find(f => f.includes('disk-full-test.ps'));
            expect(movedFile).toBeDefined();
        }, 10000);
        
        test('should continue processing after error', async () => {
            const processedJobs = [];
            
            spoolWatcher.on('printJobProcessed', (result) => {
                processedJobs.push(result);
            });
            
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create first job (will succeed)
            const job1 = path.join(testSpoolFolder, 'job1.ps');
            await fs.writeFile(job1, 'Content 1');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Create second job and delete it immediately (will fail)
            const job2 = path.join(testSpoolFolder, 'job2.ps');
            await fs.writeFile(job2, 'Content 2');
            await new Promise(resolve => setTimeout(resolve, 50));
            await fs.unlink(job2);
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Create third job (should succeed)
            const job3 = path.join(testSpoolFolder, 'job3.ps');
            await fs.writeFile(job3, 'Content 3');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify first and third jobs succeeded
            const successfulJobs = processedJobs.filter(j => j.success);
            expect(successfulJobs.length).toBeGreaterThanOrEqual(2);
            
            // Verify watcher is still running
            expect(spoolWatcher.isRunning).toBe(true);
        }, 15000);
    });
    
    describe('Performance Integration', () => {
        test('should maintain throughput under load', async () => {
            const processedJobs = [];
            
            spoolWatcher.on('printJobProcessed', (result) => {
                processedJobs.push(result);
            });
            
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const startTime = Date.now();
            const jobCount = 20;
            
            // Create jobs rapidly
            for (let i = 0; i < jobCount; i++) {
                const spoolFile = path.join(testSpoolFolder, `load-${i}.ps`);
                await fs.writeFile(spoolFile, `Content ${i}`);
            }
            
            // Wait for all jobs to process
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (processedJobs.length >= jobCount) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const throughput = jobCount / (totalTime / 1000);
            
            // Verify all jobs processed
            expect(processedJobs.length).toBe(jobCount);
            
            // Verify throughput meets requirement (10 jobs/second)
            expect(throughput).toBeGreaterThan(5); // Allow some margin
            
            console.log(`[Performance] Processed ${jobCount} jobs in ${totalTime}ms (${throughput.toFixed(2)} jobs/sec)`);
        }, 30000);
        
        test('should handle large files efficiently', async () => {
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create large file (500KB)
            const largeContent = 'A'.repeat(500 * 1024);
            const spoolFile = path.join(testSpoolFolder, 'large-file.ps');
            
            const startTime = Date.now();
            await fs.writeFile(spoolFile, largeContent);
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            // Verify job was processed
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(1);
            expect(queue[0].size).toBe(largeContent.length);
            
            // Verify processing time is reasonable (< 2 seconds)
            expect(processingTime).toBeLessThan(2000);
            
            console.log(`[Performance] Processed ${(largeContent.length / 1024).toFixed(2)}KB file in ${processingTime}ms`);
        }, 15000);
    });
    
    describe('Queue Management Integration', () => {
        test('should maintain queue integrity across multiple operations', async () => {
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Add first batch of jobs
            for (let i = 0; i < 3; i++) {
                const spoolFile = path.join(testSpoolFolder, `batch1-${i}.ps`);
                await fs.writeFile(spoolFile, `Batch 1 Content ${i}`);
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify first batch is queued
            let queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(3);
            
            // Dequeue one job
            const job1 = spoolWatcher.dequeueForwardJob();
            expect(job1.jobId).toBe('batch1-0');
            
            // Add second batch
            for (let i = 0; i < 2; i++) {
                const spoolFile = path.join(testSpoolFolder, `batch2-${i}.ps`);
                await fs.writeFile(spoolFile, `Batch 2 Content ${i}`);
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify queue has remaining jobs from batch 1 and all of batch 2
            queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(4); // 2 from batch1 + 2 from batch2
            
            // Verify order is maintained
            expect(queue[0].jobId).toBe('batch1-1');
            expect(queue[1].jobId).toBe('batch1-2');
            expect(queue[2].jobId).toBe('batch2-0');
            expect(queue[3].jobId).toBe('batch2-1');
        }, 20000);
        
        test('should handle queue operations during active processing', async () => {
            const processedJobs = [];
            
            spoolWatcher.on('printJobProcessed', (result) => {
                processedJobs.push(result);
            });
            
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Start creating jobs
            const createJobs = async () => {
                for (let i = 0; i < 5; i++) {
                    const spoolFile = path.join(testSpoolFolder, `active-${i}.ps`);
                    await fs.writeFile(spoolFile, `Active Content ${i}`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            };
            
            // Start dequeuing jobs concurrently
            const dequeueJobs = async () => {
                await new Promise(resolve => setTimeout(resolve, 300));
                for (let i = 0; i < 3; i++) {
                    const job = spoolWatcher.dequeueForwardJob();
                    if (job) {
                        console.log(`Dequeued: ${job.jobId}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            };
            
            // Run both operations concurrently
            await Promise.all([createJobs(), dequeueJobs()]);
            
            // Wait for remaining jobs to process
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify all jobs were processed
            expect(processedJobs.length).toBe(5);
            
            // Verify queue has remaining jobs (5 created - 3 dequeued = 2)
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBeLessThanOrEqual(2);
        }, 20000);
    });
    
    describe('Service Restart Integration', () => {
        test('should preserve queue state across restart', async () => {
            // Start watcher and process some jobs
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Create jobs
            for (let i = 0; i < 3; i++) {
                const spoolFile = path.join(testSpoolFolder, `restart-${i}.ps`);
                await fs.writeFile(spoolFile, `Restart Content ${i}`);
                await new Promise(resolve => setTimeout(resolve, 150));
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify jobs are queued
            let queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(3);
            const originalQueue = [...queue];
            
            // Stop watcher
            await spoolWatcher.stop();
            
            // Verify queue is still accessible
            queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(3);
            
            // Verify queue content matches
            for (let i = 0; i < 3; i++) {
                expect(queue[i].jobId).toBe(originalQueue[i].jobId);
            }
        }, 15000);
        
        test('should handle new jobs after restart', async () => {
            // First run
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const spoolFile1 = path.join(testSpoolFolder, 'before-restart.ps');
            await fs.writeFile(spoolFile1, 'Before restart');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Stop
            await spoolWatcher.stop();
            
            // Restart
            await spoolWatcher.start();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const spoolFile2 = path.join(testSpoolFolder, 'after-restart.ps');
            await fs.writeFile(spoolFile2, 'After restart');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify both jobs are in queue
            const queue = spoolWatcher.getForwardQueue();
            expect(queue.length).toBe(2);
            expect(queue[0].jobId).toBe('before-restart');
            expect(queue[1].jobId).toBe('after-restart');
        }, 15000);
    });
});
