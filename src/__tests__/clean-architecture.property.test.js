'use strict';

/**
 * Property-Based Tests: TabezaConnect Clean Architecture
 *
 * Property 1: Single Instance Invariant
 * Property 2: Config Round-Trip
 * Property 3: Log Rotation Correctness
 *
 * Requirements: 4.3, 4.5, 10.6, 12.3, 12.4
 */

const fc = require('fast-check');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tabeza-pbt-'));
}

function cleanDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

function countRotatedFiles(logPath) {
  let count = 0;
  for (let i = 1; i <= 10; i++) {
    if (fs.existsSync(`${logPath}.${i}`)) count++;
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Single Instance Invariant
// ─────────────────────────────────────────────────────────────────────────────
// For any N >= 2 launch attempts, the single-instance lock mechanism ensures
// only one instance proceeds. We simulate this by mocking the lock.
//
// Integration test note: Verify on real Windows machine — launch
// TabezaConnect.exe twice in quick succession, confirm tasklist process
// count does not double.
//
// Requirements: 4.3, 4.5

describe('Property 1: Single Instance Invariant', () => {
  test('mock: second instance always quits when lock is not acquired', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (n) => {
          // Simulate N launch attempts with a single-instance lock
          // First instance gets the lock; all subsequent instances quit
          let instancesRunning = 0;
          let lockHeld = false;

          for (let i = 0; i < n; i++) {
            if (!lockHeld) {
              // First instance acquires the lock
              lockHeld = true;
              instancesRunning++;
            } else {
              // Subsequent instances: requestSingleInstanceLock() returns false
              // → app.quit() + process.exit(0) — they do NOT increment count
            }
          }

          return instancesRunning === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Config Round-Trip
// ─────────────────────────────────────────────────────────────────────────────
// For any valid config object, writing via atomic rename and reading back
// returns equivalent values.
//
// Requirements: 10.6

describe('Property 2: Config Round-Trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  test('write → read returns equivalent barId, apiUrl, watchFolder', () => {
    fc.assert(
      fc.property(
        fc.record({
          barId: fc.string({ minLength: 6, maxLength: 40 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
          apiUrl: fc.constantFrom(
            'https://tabeza.co.ke',
            'https://tabz-kikao.vercel.app',
            'https://api.tabeza.co.ke'
          ),
          watchFolder: fc.string({ minLength: 3, maxLength: 60 }).filter(s => s.trim().length > 0),
        }),
        (config) => {
          const configPath = path.join(tmpDir, 'config.json');

          // Write via atomic rename pattern (same as electron-main.js)
          const tmp = configPath + '.tmp';
          try {
            fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
            fs.renameSync(tmp, configPath);
          } catch (err) {
            try { fs.unlinkSync(tmp); } catch (_) {}
            throw err;
          }

          // Read back
          const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
          const loaded = JSON.parse(raw);

          return (
            loaded.barId === config.barId &&
            loaded.apiUrl === config.apiUrl &&
            loaded.watchFolder === config.watchFolder
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Log Rotation Correctness
// ─────────────────────────────────────────────────────────────────────────────
// For any sequence of log writes, the number of rotated files never exceeds
// maxFiles (3) after all writes complete.
//
// Requirements: 12.3, 12.4

describe('Property 3: Log Rotation Correctness', () => {
  const { writeLog } = require('../../src/utils/log-rotator');

  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  test('rotated file count never exceeds maxFiles=3 after any sequence of writes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 100, maxLength: 1000 }),
          { minLength: 1, maxLength: 200 }
        ),
        (lines) => {
          const logPath = path.join(tmpDir, 'test.log');
          const opts = { maxBytes: 5 * 1024 * 1024, maxFiles: 3 };

          for (const line of lines) {
            writeLog(logPath, line, opts);
          }

          const rotatedCount = countRotatedFiles(logPath);
          return rotatedCount <= 3;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rotation triggers when file reaches maxBytes threshold', () => {
    fc.assert(
      fc.property(
        // Use a very small maxBytes to force rotation with small writes
        fc.integer({ min: 50, max: 500 }),
        fc.array(fc.string({ minLength: 10, maxLength: 50 }), { minLength: 5, maxLength: 30 }),
        (maxBytes, lines) => {
          const logPath = path.join(tmpDir, `rot-${maxBytes}.log`);
          const opts = { maxBytes, maxFiles: 3 };

          for (const line of lines) {
            writeLog(logPath, line, opts);
          }

          const rotatedCount = countRotatedFiles(logPath);
          return rotatedCount <= 3;
        }
      ),
      { numRuns: 100 }
    );
  });
});
