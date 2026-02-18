/**
 * ESC/POS Byte Extraction and Conversion
 * 
 * This module extracts ESC/POS byte sequences from print files and converts
 * them to ASCII text while preserving line breaks and spacing.
 * 
 * ESC/POS is the standard command language for thermal receipt printers.
 * It uses escape sequences (starting with ESC byte 0x1B) to control printer
 * behavior like font size, alignment, cutting, etc.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

const fs = require('fs').promises;

// ESC/POS control bytes
const ESC = 0x1B;  // Escape character
const LF = 0x0A;   // Line feed (newline)
const CR = 0x0D;   // Carriage return
const FF = 0x0C;   // Form feed
const HT = 0x09;   // Horizontal tab
const GS = 0x1D;   // Group separator (used in ESC/POS)
const FS = 0x1C;   // File separator (used in ESC/POS)

// Printable ASCII range
const MIN_PRINTABLE = 0x20; // Space
const MAX_PRINTABLE = 0x7E; // Tilde (~)

class ESCPOSProcessor {
  constructor() {
    // Statistics
    this.stats = {
      filesProcessed: 0,
      escposDetected: 0,
      textOnly: 0,
      conversionErrors: 0,
    };
  }
  
  /**
   * Process a print file and extract ESC/POS data
   * 
   * @param {string} filePath - Path to the print file
   * @returns {Promise<Object>} - { isESCPOS, escposBytes, text, metadata }
   */
  async processFile(filePath) {
    try {
      // Read file as buffer
      const buffer = await fs.readFile(filePath);
      
      this.stats.filesProcessed++;
      
      // Detect if file contains ESC/POS commands
      const isESCPOS = this.detectESCPOS(buffer);
      
      if (isESCPOS) {
        this.stats.escposDetected++;
      } else {
        this.stats.textOnly++;
      }
      
      // Extract ESC/POS bytes (if present)
      const escposBytes = isESCPOS ? buffer : null;
      
      // Convert to text
      const text = this.convertToText(buffer);
      
      // Generate metadata
      const metadata = {
        fileSize: buffer.length,
        isESCPOS,
        hasControlChars: this.hasControlCharacters(buffer),
        lineCount: text.split('\n').length,
      };
      
      return {
        isESCPOS,
        escposBytes: escposBytes ? escposBytes.toString('base64') : null,
        text,
        metadata,
      };
      
    } catch (error) {
      this.stats.conversionErrors++;
      throw new Error(`Failed to process file: ${error.message}`);
    }
  }
  
  /**
   * Detect if buffer contains ESC/POS commands
   * 
   * ESC/POS commands start with ESC (0x1B) followed by command bytes.
   * Common sequences:
   * - ESC @ (0x1B 0x40) - Initialize printer
   * - ESC ! (0x1B 0x21) - Select print mode
   * - ESC d (0x1B 0x64) - Print and feed
   * - GS V (0x1D 0x56) - Cut paper
   * 
   * @param {Buffer} buffer - File buffer
   * @returns {boolean} - True if ESC/POS detected
   */
  detectESCPOS(buffer) {
    // Look for ESC byte (0x1B) in the first 1KB
    // Most ESC/POS commands appear at the start of the print job
    const searchLength = Math.min(buffer.length, 1024);
    
    for (let i = 0; i < searchLength; i++) {
      if (buffer[i] === ESC) {
        // Check if followed by valid ESC/POS command byte
        if (i + 1 < buffer.length) {
          const commandByte = buffer[i + 1];
          
          // Common ESC/POS command bytes
          // @ = Initialize, ! = Select mode, d = Feed, E = Bold, etc.
          if (this.isValidESCPOSCommand(commandByte)) {
            return true;
          }
        }
      }
      
      // Also check for GS (Group Separator) commands
      if (buffer[i] === GS) {
        if (i + 1 < buffer.length) {
          const commandByte = buffer[i + 1];
          // Common GS commands: V = Cut, L = Set left margin, etc.
          if (this.isValidGSCommand(commandByte)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if byte is a valid ESC/POS command
   * 
   * @param {number} byte - Command byte
   * @returns {boolean}
   */
  isValidESCPOSCommand(byte) {
    // Common ESC commands (not exhaustive, but covers most cases)
    const validCommands = [
      0x21, // ! - Select print mode
      0x40, // @ - Initialize printer
      0x45, // E - Bold on/off
      0x4A, // J - Print and feed
      0x4B, // K - Print and reverse feed
      0x52, // R - Select international character set
      0x61, // a - Select justification
      0x64, // d - Print and feed n lines
      0x70, // p - Generate pulse
    ];
    
    return validCommands.includes(byte) || (byte >= 0x20 && byte <= 0x7E);
  }
  
  /**
   * Check if byte is a valid GS command
   * 
   * @param {number} byte - Command byte
   * @returns {boolean}
   */
  isValidGSCommand(byte) {
    // Common GS commands
    const validCommands = [
      0x21, // ! - Select character size
      0x42, // B - Turn white/black reverse mode on/off
      0x4C, // L - Set left margin
      0x56, // V - Cut paper
      0x57, // W - Set print area width
    ];
    
    return validCommands.includes(byte);
  }
  
  /**
   * Convert ESC/POS bytes to ASCII text
   * 
   * This removes control characters while preserving:
   * - Line breaks (LF, CR)
   * - Spacing (spaces, tabs)
   * - Printable ASCII characters
   * 
   * @param {Buffer} buffer - ESC/POS buffer
   * @returns {string} - Converted text
   */
  convertToText(buffer) {
    const lines = [];
    let currentLine = '';
    let i = 0;
    
    while (i < buffer.length) {
      const byte = buffer[i];
      
      // Handle line breaks
      if (byte === LF) {
        lines.push(currentLine);
        currentLine = '';
        i++;
        continue;
      }
      
      // Skip carriage return (we use LF for line breaks)
      if (byte === CR) {
        i++;
        continue;
      }
      
      // Handle form feed (treat as line break)
      if (byte === FF) {
        lines.push(currentLine);
        currentLine = '';
        i++;
        continue;
      }
      
      // Handle horizontal tab (convert to spaces)
      if (byte === HT) {
        currentLine += '    '; // 4 spaces
        i++;
        continue;
      }
      
      // Skip ESC/POS command sequences
      if (byte === ESC) {
        i = this.skipESCSequence(buffer, i);
        continue;
      }
      
      // Skip GS command sequences
      if (byte === GS) {
        i = this.skipGSSequence(buffer, i);
        continue;
      }
      
      // Skip FS command sequences
      if (byte === FS) {
        i = this.skipFSSequence(buffer, i);
        continue;
      }
      
      // Add printable ASCII characters
      if (byte >= MIN_PRINTABLE && byte <= MAX_PRINTABLE) {
        currentLine += String.fromCharCode(byte);
      }
      // Skip other control characters
      
      i++;
    }
    
    // Add last line if not empty
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    // Join lines and trim trailing whitespace from each line
    return lines
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
  }
  
  /**
   * Skip ESC command sequence
   * 
   * ESC commands have variable length depending on the command byte.
   * This function skips the entire command sequence.
   * 
   * @param {Buffer} buffer - Buffer
   * @param {number} index - Current index (pointing to ESC byte)
   * @returns {number} - New index after command sequence
   */
  skipESCSequence(buffer, index) {
    if (index + 1 >= buffer.length) {
      return index + 1;
    }
    
    const commandByte = buffer[index + 1];
    
    // Commands with no parameters
    if ([0x40, 0x3C].includes(commandByte)) { // @ = Init, < = Return home
      return index + 2;
    }
    
    // Commands with 1 parameter
    if ([0x21, 0x45, 0x4A, 0x4B, 0x52, 0x61, 0x64].includes(commandByte)) {
      return index + 3;
    }
    
    // Commands with 2 parameters
    if ([0x24, 0x5C].includes(commandByte)) { // $ = Set absolute position, \ = Set relative position
      return index + 4;
    }
    
    // Commands with variable parameters (skip until next non-parameter byte)
    // For safety, skip up to 10 bytes
    let skipCount = 2;
    while (skipCount < 10 && index + skipCount < buffer.length) {
      const nextByte = buffer[index + skipCount];
      // Stop if we hit another control character
      if (nextByte === ESC || nextByte === GS || nextByte === LF || nextByte === CR) {
        break;
      }
      skipCount++;
    }
    
    return index + skipCount;
  }
  
  /**
   * Skip GS command sequence
   * 
   * @param {Buffer} buffer - Buffer
   * @param {number} index - Current index (pointing to GS byte)
   * @returns {number} - New index after command sequence
   */
  skipGSSequence(buffer, index) {
    if (index + 1 >= buffer.length) {
      return index + 1;
    }
    
    const commandByte = buffer[index + 1];
    
    // Commands with 1 parameter
    if ([0x21, 0x42, 0x56].includes(commandByte)) { // ! = Size, B = Reverse, V = Cut
      return index + 3;
    }
    
    // Commands with 2 parameters
    if ([0x4C, 0x57].includes(commandByte)) { // L = Left margin, W = Width
      return index + 4;
    }
    
    // Default: skip 2 bytes
    return index + 2;
  }
  
  /**
   * Skip FS command sequence
   * 
   * @param {Buffer} buffer - Buffer
   * @param {number} index - Current index (pointing to FS byte)
   * @returns {number} - New index after command sequence
   */
  skipFSSequence(buffer, index) {
    // FS commands are less common, skip 2 bytes by default
    return index + 2;
  }
  
  /**
   * Check if buffer has control characters
   * 
   * @param {Buffer} buffer - Buffer
   * @returns {boolean}
   */
  hasControlCharacters(buffer) {
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      
      // Check for control characters (excluding whitespace)
      if (byte < MIN_PRINTABLE && ![LF, CR, HT].includes(byte)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get processor statistics
   * 
   * @returns {Object}
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = ESCPOSProcessor;
