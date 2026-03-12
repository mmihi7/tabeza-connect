/**
 * ESC/POS Textifier Module
 * 
 * Converts raw ESC/POS bytes into clean plain text suitable for regex parsing.
 * 
 * Features:
 * - Decodes bytes using Windows-1252 encoding (common for thermal printers)
 * - Preserves line breaks (\r, \n, \t)
 * - Replaces non-printable characters with spaces
 * - Collapses multiple consecutive spaces
 * 
 * Performance target: < 10ms per receipt
 * 
 * @module textifier
 */

/**
 * Default textifier options
 * @typedef {Object} TextifierOptions
 * @property {string} encoding - Character encoding to use (default: 'windows-1252')
 * @property {string[]} preserveChars - Characters to preserve (default: ['\r', '\n', '\t'])
 * @property {boolean} collapseSpaces - Whether to collapse multiple spaces (default: true)
 */

/**
 * Default options for textification
 * @type {TextifierOptions}
 */
const DEFAULT_OPTIONS = {
  encoding: 'latin1', // Changed from 'windows-1252' for pkg compatibility
  preserveChars: ['\r', '\n', '\t'],
  collapseSpaces: true
};

/**
 * Check if a character is printable or should be preserved
 * 
 * @param {string} char - Single character to check
 * @param {string[]} preserveChars - Array of characters to preserve
 * @returns {boolean} True if character should be kept
 */
function isPrintableOrPreserved(char, preserveChars) {
  // Check if it's a character we want to preserve
  if (preserveChars.includes(char)) {
    return true;
  }
  
  // Get character code
  const code = char.charCodeAt(0);
  
  // Printable ASCII range: 32 (space) to 126 (~)
  // Extended ASCII printable: 160 to 255 (Windows-1252 specific characters)
  return (code >= 32 && code <= 126) || (code >= 160 && code <= 255);
}

/**
 * Convert raw ESC/POS bytes to plain text
 * 
 * This function:
 * 1. Decodes raw bytes using Windows-1252 encoding
 * 2. Replaces non-printable characters (except \r, \n, \t) with spaces
 * 3. Optionally collapses multiple consecutive spaces into single spaces
 * 4. Preserves line structure for regex parsing
 * 
 * @param {Buffer} rawBytes - Raw ESC/POS bytes from printer
 * @param {TextifierOptions} [options=DEFAULT_OPTIONS] - Textification options
 * @returns {string} Clean plain text suitable for parsing
 * 
 * @example
 * const rawBytes = Buffer.from([0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
 * const plainText = textify(rawBytes);
 * console.log(plainText); // "Hello"
 */
function textify(rawBytes, options = {}) {
  // Merge options with defaults
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Validate input
  if (!Buffer.isBuffer(rawBytes)) {
    throw new TypeError('rawBytes must be a Buffer');
  }
  
  if (rawBytes.length === 0) {
    return '';
  }
  
  // Step 1: Decode bytes using Windows-1252 encoding
  let text = rawBytes.toString(opts.encoding);
  
  // Step 2: Replace non-printable characters with spaces (except preserved chars)
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (isPrintableOrPreserved(char, opts.preserveChars)) {
      result += char;
    } else {
      result += ' ';
    }
  }
  
  // Step 3: Collapse multiple consecutive spaces (if enabled)
  if (opts.collapseSpaces) {
    result = result.replace(/ {2,}/g, ' ');
  }
  
  return result;
}

/**
 * Textify with performance timing
 * 
 * Same as textify() but returns both the result and timing information.
 * Useful for monitoring and diagnostics.
 * 
 * @param {Buffer} rawBytes - Raw ESC/POS bytes from printer
 * @param {TextifierOptions} [options=DEFAULT_OPTIONS] - Textification options
 * @returns {{text: string, timeMs: number}} Result and processing time
 * 
 * @example
 * const { text, timeMs } = textifyWithTiming(rawBytes);
 * console.log(`Processed in ${timeMs}ms: ${text}`);
 */
function textifyWithTiming(rawBytes, options = {}) {
  const startTime = process.hrtime.bigint();
  const text = textify(rawBytes, options);
  const endTime = process.hrtime.bigint();
  
  // Convert nanoseconds to milliseconds
  const timeMs = Number(endTime - startTime) / 1_000_000;
  
  return { text, timeMs };
}

module.exports = {
  textify,
  textifyWithTiming,
  DEFAULT_OPTIONS
};
