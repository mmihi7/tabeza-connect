/**
 * Unit tests for File Watcher
 */

const FileWatcher = require('../file-watcher');
const fs = require('fs').promises;
const path = require('path');

// Mock chokidar
jest.mock('chokidar');
const chokidar = require('chokidar');

describe('FileWatcher', () => {
  let fileWatcher;
  let mockCallback;
  let mockWatcher;
  let config;

  beforeEach(() => {
    config = {
      watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints'
    };

    mockCallback = jest.fn().mockResolvedValue(undefined);

    // Mock chokidar watcher
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined)
    };

    chokidar.watch = jest.fn().mockReturnValue(mockWatcher);

    fileWatcher = new FileWatcher(config, mockCallback);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start()', () => {
    it('should initialize chokidar watcher with correct path', () => {
      fileWatcher.start();

      const expectedPath = path.join(config.watchFolder, 'order.prn');
      expect(chokidar.watch).toHaveBeenCalledWith(
        expectedPath,
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 1500,
            pollInterval: 100
          }
        })
      );
    });

    it('should register event handlers', () => {
      fileWatcher.start();

      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('stop()', () => {
    it('should close the watcher', async () => {
      fileWatcher.start();
      await fileWatcher.stop();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileWatcher.watcher).toBeNull();
    });

    it('should clear debounce timer if active', async () => {
      fileWatcher.start();
      fileWatcher.debounceTimer = setTimeout(() => {}, 1000);
      
      await fileWatcher.stop();

      expect(fileWatcher.debounceTimer).toBeNull();
    });
  });

  describe('debouncing logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('test data'));
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should debounce multiple rapid file changes', async () => {
      fileWatcher.start();

      // Get the change handler
      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      // Trigger multiple changes rapidly
      changeHandler('order.prn');
      changeHandler('order.prn');
      changeHandler('order.prn');

      // Fast-forward through debounce period
      jest.advanceTimersByTime(500);

      // Wait for async operations
      await Promise.resolve();

      // Callback should only be called once
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should wait 500ms before processing after last change', async () => {
      fileWatcher.start();

      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      changeHandler('order.prn');

      // Before 500ms
      jest.advanceTimersByTime(400);
      await Promise.resolve();
      expect(mockCallback).not.toHaveBeenCalled();

      // After 500ms
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should prevent processing same file within 2 seconds', async () => {
      fileWatcher.start();

      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      // First change
      changeHandler('order.prn');
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Second change within 2 seconds
      jest.advanceTimersByTime(1000); // Total 1.5 seconds
      changeHandler('order.prn');
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      expect(mockCallback).toHaveBeenCalledTimes(1); // Still 1

      // Third change after 2 seconds
      jest.advanceTimersByTime(1000); // Total 3 seconds
      changeHandler('order.prn');
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      expect(mockCallback).toHaveBeenCalledTimes(2); // Now 2
    });

    it('should prevent concurrent processing', async () => {
      fileWatcher.start();

      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      // Make callback slow
      mockCallback.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      // First change
      changeHandler('order.prn');
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Second change while first is still processing
      jest.advanceTimersByTime(100);
      changeHandler('order.prn');
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      // Should only process once
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should handle file read errors', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File read error'));

      fileWatcher.start();

      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      changeHandler('order.prn');
      jest.advanceTimersByTime(500);

      await expect(Promise.resolve()).resolves.not.toThrow();
    });

    it('should skip empty files', async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from([]));

      fileWatcher.start();

      const changeHandler = mockWatcher.on.mock.calls.find(
        call => call[0] === 'change'
      )[1];

      changeHandler('order.prn');
      jest.advanceTimersByTime(500);
      await Promise.resolve();

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});
