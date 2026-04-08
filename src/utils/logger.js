'use strict';

/**
 * Shared terminal logger — coloured, prefixed, timestamped.
 * Used across the entire pipeline so every stage is visible in one terminal.
 *
 * Pipeline stages and their prefixes:
 *   [REDMON]   – Redmon port monitor / capture.exe invocation
 *   [RAW]      – Saving raw .prn bytes to disk
 *   [SPOOL]    – SpoolWatcher detecting / processing files
 *   [FORWARD]  – PhysicalPrinterAdapter forwarding to EPSON
 *   [PRINTER]  – WindowsPrinterConnection send/status
 *   [TEMPLATE] – Template load / generation
 *   [PARSER]   – ReceiptParser parse results
 *   [QUEUE]    – LocalQueue enqueue / dequeue
 *   [UPLOAD]   – UploadWorker cloud upload
 *   [SERVICE]  – IntegratedCaptureService lifecycle
 */

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

const COLOURS = {
  ERROR : '\x1b[31m',   // red
  WARN  : '\x1b[33m',   // yellow
  INFO  : '\x1b[36m',   // cyan
  DEBUG : '\x1b[90m',   // grey
  OK    : '\x1b[32m',   // green
  STEP  : '\x1b[35m',   // magenta  (pipeline step markers)
};

const LEVEL_COLOUR = {
  ERROR : COLOURS.ERROR,
  WARN  : COLOURS.WARN,
  INFO  : COLOURS.INFO,
  DEBUG : COLOURS.DEBUG,
};

function ts() {
  return new Date().toTimeString().slice(0, 8); // HH:MM:SS
}

function fmt(level, prefix, msg) {
  const lc = LEVEL_COLOUR[level] || COLOURS.INFO;
  return `${DIM}${ts()}${RESET} ${lc}${BOLD}[${level}]${RESET} ${COLOURS.STEP}${BOLD}${prefix}${RESET} ${msg}`;
}

function log(level, prefix, msg, extra) {
  // Only show ERROR, WARN, and OK messages - filter out INFO and DEBUG
  if (level === 'ERROR' || level === 'WARN' || level === 'OK') {
    const line = fmt(level, prefix, msg);
    if (level === 'ERROR') {
      console.error(line, extra !== undefined ? extra : '');
    } else {
      console.log(line, extra !== undefined ? extra : '');
    }
  }
}

/**
 * Create a logger bound to a pipeline prefix.
 * Usage:
 *   const log = require('../utils/logger').forPrefix('[SPOOL]');
 *   log.info('Detected file', { name: 'order.prn' });
 */
function forPrefix(prefix) {
  return {
    error : (msg, extra) => log('ERROR', prefix, msg, extra),
    warn  : (msg, extra) => log('WARN',  prefix, msg, extra),
    info  : (msg, extra) => log('INFO',  prefix, msg, extra),
    debug : (msg, extra) => log('DEBUG', prefix, msg, extra),
    ok    : (msg, extra) => {
      const line = `${DIM}${ts()}${RESET} ${COLOURS.OK}${BOLD}[OK]${RESET} ${COLOURS.STEP}${BOLD}${prefix}${RESET} ${msg}`;
      console.log(line, extra !== undefined ? extra : '');
    },
    step  : (msg, extra) => {
      const line = `${DIM}${ts()}${RESET} ${COLOURS.STEP}${BOLD}[STEP]${RESET} ${COLOURS.STEP}${BOLD}${prefix}${RESET} ${msg}`;
      console.log(line, extra !== undefined ? extra : '');
    },
  };
}

module.exports = { forPrefix };
