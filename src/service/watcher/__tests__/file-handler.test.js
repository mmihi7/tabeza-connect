/**
 * Unit tests for File Handler
 */

const FileHandler = require('../file-handler');
const fs = require('fs').promises;
const path = require('path');

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    truncate: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('FileHandler', () => {
  let fileHandler;
  let config;

  beforeEach(() => {
    config = {
      watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints'
    };

    fileHandler = new FileHandler(config);
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    it('should create processed and failed folders', async () => {
      fs.mkdir.mockResolvedValue(undefined);

      await fileHandler.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(config.watchFolder, 'processed'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(config.watchFolder, 'failed'),
        { recursive: true }
      );
    });

    it('should throw error if folder creation fails', async () => {
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(fileHandler.initialize()).rejects.toThrow('Permission denied');
    });
  });

  describe('truncateOrderFile()', () => {
    it('should truncate file to 0 bytes', async () => {
      fs.truncate.mockResolvedValue(undefined);

      const filePath = 'C:\\ProgramData\\Tabeza\\TabezaPrints\\order.prn';
      await fileHandler.truncateOrderFile(filePath);

      expect(fs.truncate).toHaveBeenCalledWith(filePath, 0);
    });

    it('should throw error if truncation fails', async () => {
      fs.truncate.mockRejectedValue(new Error('File locked'));

      const filePath = 'C:\\ProgramData\\Tabeza\\TabezaPrints\\order.prn';
      await expect(fileHandler.truncateOrderFile(filePath)).rejects.toThrow('File locked');
    });
  });

  describe('archiveSuccess()', () => {
    it('should write timestamped copy to processed folder', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const rawData = Buffer.from('test receipt data');
      await fileHandler.archiveSuccess(rawData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/processed[\\/]\d{8}-\d{6}\.prn$/),
        rawData
      );
    });

    it('should not throw if archiving fails (log warning only)', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      const rawData = Buffer.from('test receipt data');
      await expect(fileHandler.archiveSuccess(rawData)).resolves.not.toThrow();
    });

    it('should use correct timestamp format YYYYMMDD-HHMMSS', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      // Mock Date to return fixed time
      const mockDate = new Date('2026-03-02T14:30:45');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const rawData = Buffer.from('test receipt data');
      await fileHandler.archiveSuccess(rawData);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('20260302-143045.prn'),
        rawData
      );

      global.Date.mockRestore();
    });
  });

  describe('archiveFailure()', () => {
    it('should write timestamped copy to failed folder', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const rawData = Buffer.from('test receipt data');
      const error = new Error('Parse error');
      await fileHandler.archiveFailure(rawData, error);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/failed[\\/]\d{8}-\d{6}\.prn$/),
        rawData
      );
    });

    it('should write error details to companion .txt file', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      const rawData = Buffer.from('test receipt data');
      const error = new Error('Parse error');
      error.stack = 'Error: Parse error\n  at test.js:10';

      await fileHandler.archiveFailure(rawData, error);

      // Should write both .prn and .txt files
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      
      // Check .txt file contains error details
      const txtCall = fs.writeFile.mock.calls.find(call => call[0].endsWith('.txt'));
      expect(txtCall).toBeDefined();
      expect(txtCall[1]).toContain('Error: Parse error');
      expect(txtCall[1]).toContain('Stack:');
      expect(txtCall[1]).toContain('Time:');
    });

    it('should not throw if archiving fails (log warning only)', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      const rawData = Buffer.from('test receipt data');
      const error = new Error('Parse error');
      await expect(fileHandler.archiveFailure(rawData, error)).resolves.not.toThrow();
    });
  });

  describe('_getTimestamp()', () => {
    it('should return timestamp in YYYYMMDD-HHMMSS format', () => {
      const mockDate = new Date('2026-03-02T14:30:45');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const timestamp = fileHandler._getTimestamp();

      expect(timestamp).toBe('20260302-143045');

      global.Date.mockRestore();
    });

    it('should pad single-digit values with zeros', () => {
      const mockDate = new Date('2026-01-05T08:09:07');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const timestamp = fileHandler._getTimestamp();

      expect(timestamp).toBe('20260105-080907');

      global.Date.mockRestore();
    });
  });
});
