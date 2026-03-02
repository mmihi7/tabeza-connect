/**
 * ESC/POS Stripper
 * 
 * Removes binary control codes from raw printer data to produce plain text
 * suitable for regex parsing. Preserves printable ASCII and newlines while
 * removing ESC/POS command sequences.
 * 
 * Target performance: < 5ms for typical receipts (< 10KB)
 */

class ESCPOSStripper {
  /**
   * Check if byte is printable ASCII (0x20-0x7E)
   * @param {number} byte - Byte value
   * @returns {boolean} True if printable
   */
  static isPrintable(byte) {
    return byte >= 0x20 && byte <= 0x7E;
  }

  /**
   * Check if byte is newline (0x0A or 0x0D)
   * @param {number} byte - Byte value
   * @returns {boolean} True if newline
   */
  static isNewline(byte) {
    return byte === 0x0A || byte === 0x0D;
  }

  /**
   * Strip ESC/POS control codes from raw print data
   * @param {Buffer} rawData - Raw printer data
   * @returns {string} Plain text with control codes removed
   */
  static strip(rawData) {
    if (!Buffer.isBuffer(rawData)) {
      throw new TypeError('rawData must be a Buffer');
    }

    if (rawData.length === 0) {
      return '';
    }

    const result = [];
    let i = 0;

    while (i < rawData.length) {
      const byte = rawData[i];

      // ESC sequence (0x1B)
      if (byte === 0x1B) {
        i = this._skipESCSequence(rawData, i);
        continue;
      }

      // GS sequence (0x1D)
      if (byte === 0x1D) {
        i = this._skipGSSequence(rawData, i);
        continue;
      }

      // Preserve printable ASCII and newlines
      if (this.isPrintable(byte) || this.isNewline(byte)) {
        result.push(byte);
      }

      i++;
    }

    return Buffer.from(result).toString('utf8');
  }

  /**
   * Skip ESC sequence and return next position
   * @private
   * @param {Buffer} buffer - Data buffer
   * @param {number} pos - Current position (at 0x1B)
   * @returns {number} Position after sequence
   */
  static _skipESCSequence(buffer, pos) {
    if (pos + 1 >= buffer.length) {
      return pos + 1;
    }

    const command = buffer[pos + 1];

    // Common ESC sequences and their lengths
    // ESC @ - Initialize printer (2 bytes total)
    if (command === 0x40) {
      return pos + 2;
    }

    // ESC E - Bold on/off (3 bytes total)
    // ESC a - Alignment (3 bytes total)
    // ESC d - Feed lines (3 bytes total)
    if (command === 0x45 || command === 0x61 || command === 0x64) {
      return pos + 3;
    }

    // Default: skip ESC + command byte
    return pos + 2;
  }

  /**
   * Skip GS sequence and return next position
   * @private
   * @param {Buffer} buffer - Data buffer
   * @param {number} pos - Current position (at 0x1D)
   * @returns {number} Position after sequence
   */
  static _skipGSSequence(buffer, pos) {
    if (pos + 1 >= buffer.length) {
      return pos + 1;
    }

    const command = buffer[pos + 1];

    // Common GS sequences
    // GS ! - Character size (3 bytes total)
    // GS V - Cut paper (3 bytes total)
    if (command === 0x21 || command === 0x56) {
      return pos + 3;
    }

    // Default: skip GS + command byte
    return pos + 2;
  }
}

module.exports = ESCPOSStripper;
