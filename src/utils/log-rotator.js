'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_FILES = 3;

/**
 * Rotate logPath → logPath.1 → logPath.2 → ... → logPath.{maxFiles}
 * Deletes logPath.{maxFiles} if it exists before shifting.
 *
 * @param {string} logPath  - Absolute path to the active log file
 * @param {number} maxFiles - Maximum number of rotated copies to keep
 */
function rotate(logPath, maxFiles) {
  // Delete the oldest rotated file if it exists
  const oldest = `${logPath}.${maxFiles}`;
  try {
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }
  } catch (_) {}

  // Rename files in reverse order: .{maxFiles-1} → .{maxFiles}, ..., .1 → .2
  for (let i = maxFiles - 1; i >= 1; i--) {
    const src = `${logPath}.${i}`;
    const dst = `${logPath}.${i + 1}`;
    try {
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    } catch (_) {}
  }

  // Rename active log → logPath.1
  try {
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, `${logPath}.1`);
    }
  } catch (_) {}

  // Create a new empty active log file
  fs.writeFileSync(logPath, '');
}

/**
 * Write a line to a log file, rotating when the file reaches maxBytes.
 *
 * @param {string} logPath  - Absolute path to the active log file
 * @param {string} line     - Log line to append (newline appended automatically)
 * @param {object} opts     - { maxBytes?: number, maxFiles?: number }
 */
function writeLog(logPath, line, opts = {}) {
  const maxBytes = opts.maxBytes !== undefined ? opts.maxBytes : DEFAULT_MAX_BYTES;
  const maxFiles = opts.maxFiles !== undefined ? opts.maxFiles : DEFAULT_MAX_FILES;

  // Ensure the log directory exists
  const dir = path.dirname(logPath);
  fs.mkdirSync(dir, { recursive: true });

  // Check current file size and rotate if needed
  try {
    const stat = fs.statSync(logPath);
    if (stat.size >= maxBytes) {
      rotate(logPath, maxFiles);
    }
  } catch (err) {
    // File does not exist yet — first write, no rotation needed
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  fs.appendFileSync(logPath, line + '\n');
}

module.exports = { writeLog, rotate };
