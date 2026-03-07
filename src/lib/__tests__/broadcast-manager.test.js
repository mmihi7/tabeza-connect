/**
 * Unit Tests for BroadcastManager
 * 
 * Tests the selective state diff broadcasting functionality
 * to ensure only changed portions are included in broadcasts.
 */

const BroadcastManager = require('../broadcast-manager');

describe('BroadcastManager - State Diff Calculation', () => {
  let broadcastManager;
  
  beforeEach(() => {
    broadcastManager = new BroadcastManager();
  });
  
  describe('_calculateStateDiff', () => {
    test('should return entire new state when old state is null', () => {
      const newState = { barId: 'bar-123', apiUrl: 'https://api.example.com' };
      const diff = broadcastManager._calculateStateDiff(null, newState);
      
      expect(diff).toEqual(newState);
    });
    
    test('should return entire new state when old state is undefined', () => {
      const newState = { barId: 'bar-123', apiUrl: 'https://api.example.com' };
      const diff = broadcastManager._calculateStateDiff(undefined, newState);
      
      expect(diff).toEqual(newState);
    });
    
    test('should return empty object when states are identical', () => {
      const state = { barId: 'bar-123', apiUrl: 'https://api.example.com' };
      const diff = broadcastManager._calculateStateDiff(state, state);
      
      expect(diff).toEqual({});
    });
    
    test('should return only changed fields for primitive values', () => {
      const oldState = { barId: 'bar-123', apiUrl: 'https://api.example.com', port: 8765 };
      const newState = { barId: 'bar-456', apiUrl: 'https://api.example.com', port: 8765 };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({ barId: 'bar-456' });
    });
    
    test('should detect new fields added to state', () => {
      const oldState = { barId: 'bar-123' };
      const newState = { barId: 'bar-123', apiUrl: 'https://api.example.com' };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({ apiUrl: 'https://api.example.com' });
    });
    
    test('should handle nested object changes', () => {
      const oldState = {
        setup: {
          firstRunComplete: false,
          steps: { barId: { completed: false } }
        }
      };
      const newState = {
        setup: {
          firstRunComplete: false,
          steps: { barId: { completed: true } }
        }
      };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({
        setup: {
          steps: { barId: { completed: true } }
        }
      });
    });
    
    test('should detect array changes', () => {
      const oldState = { items: [1, 2, 3] };
      const newState = { items: [1, 2, 3, 4] };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({ items: [1, 2, 3, 4] });
    });
    
    test('should handle null to value changes', () => {
      const oldState = { printerName: null };
      const newState = { printerName: 'HP LaserJet' };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({ printerName: 'HP LaserJet' });
    });
    
    test('should handle value to null changes', () => {
      const oldState = { printerName: 'HP LaserJet' };
      const newState = { printerName: null };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({ printerName: null });
    });
    
    test('should handle multiple nested changes', () => {
      const oldState = {
        config: { barId: 'bar-123', apiUrl: 'https://old.com' },
        printer: { status: 'NotConfigured', printerName: null }
      };
      const newState = {
        config: { barId: 'bar-456', apiUrl: 'https://old.com' },
        printer: { status: 'FullyConfigured', printerName: 'HP LaserJet' }
      };
      const diff = broadcastManager._calculateStateDiff(oldState, newState);
      
      expect(diff).toEqual({
        config: { barId: 'bar-456' },
        printer: { status: 'FullyConfigured', printerName: 'HP LaserJet' }
      });
    });
  });
  
  describe('_deepEqual', () => {
    test('should return true for identical primitives', () => {
      expect(broadcastManager._deepEqual(123, 123)).toBe(true);
      expect(broadcastManager._deepEqual('test', 'test')).toBe(true);
      expect(broadcastManager._deepEqual(true, true)).toBe(true);
    });
    
    test('should return false for different primitives', () => {
      expect(broadcastManager._deepEqual(123, 456)).toBe(false);
      expect(broadcastManager._deepEqual('test', 'other')).toBe(false);
      expect(broadcastManager._deepEqual(true, false)).toBe(false);
    });
    
    test('should return true for identical arrays', () => {
      expect(broadcastManager._deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(broadcastManager._deepEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });
    
    test('should return false for different arrays', () => {
      expect(broadcastManager._deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(broadcastManager._deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });
    
    test('should return true for identical objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      expect(broadcastManager._deepEqual(obj1, obj2)).toBe(true);
    });
    
    test('should return false for different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      expect(broadcastManager._deepEqual(obj1, obj2)).toBe(false);
    });
    
    test('should handle nested objects', () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };
      
      expect(broadcastManager._deepEqual(obj1, obj2)).toBe(true);
      expect(broadcastManager._deepEqual(obj1, obj3)).toBe(false);
    });
    
    test('should handle null and undefined', () => {
      expect(broadcastManager._deepEqual(null, null)).toBe(true);
      expect(broadcastManager._deepEqual(undefined, undefined)).toBe(true);
      expect(broadcastManager._deepEqual(null, undefined)).toBe(false);
      expect(broadcastManager._deepEqual(null, 0)).toBe(false);
    });
  });
  
  describe('broadcastStateChange with diff optimization', () => {
    let mockWindowRegistry;
    let mockWindow;
    
    beforeEach(() => {
      // Create mock window
      mockWindow = {
        isDestroyed: jest.fn().mockReturnValue(false),
        webContents: {
          send: jest.fn()
        }
      };
      
      // Create mock window registry
      mockWindowRegistry = {
        getAllWindows: jest.fn().mockReturnValue([
          { id: 'window-1', window: mockWindow }
        ]),
        unregisterWindow: jest.fn()
      };
      
      // Set window registry
      broadcastManager.setWindowRegistry(mockWindowRegistry);
      
      // Suppress console logs during tests
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    test('should broadcast full state when no oldData provided', () => {
      const event = {
        type: 'config',
        data: { barId: 'bar-123', apiUrl: 'https://api.example.com' },
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test'
      };
      
      broadcastManager.broadcastStateChange(event);
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('state-changed', {
        type: 'config',
        data: { barId: 'bar-123', apiUrl: 'https://api.example.com' },
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test',
        isDiff: false
      });
    });
    
    test('should broadcast diff when oldData provided and diff is smaller', () => {
      const event = {
        type: 'config',
        data: { barId: 'bar-456', apiUrl: 'https://api.example.com', port: 8765 },
        oldData: { barId: 'bar-123', apiUrl: 'https://api.example.com', port: 8765 },
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test'
      };
      
      broadcastManager.broadcastStateChange(event);
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('state-changed', {
        type: 'config',
        data: { barId: 'bar-456' }, // Only changed field
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test',
        isDiff: true
      });
    });
    
    test('should skip broadcast when no changes detected', () => {
      const event = {
        type: 'config',
        data: { barId: 'bar-123', apiUrl: 'https://api.example.com' },
        oldData: { barId: 'bar-123', apiUrl: 'https://api.example.com' },
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test'
      };
      
      broadcastManager.broadcastStateChange(event);
      
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });
    
    test('should use full state when diff is not smaller', () => {
      const event = {
        type: 'config',
        data: { barId: 'bar-456' },
        oldData: { barId: 'bar-123' },
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test'
      };
      
      broadcastManager.broadcastStateChange(event);
      
      // When diff size equals full size, use full state
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('state-changed', {
        type: 'config',
        data: { barId: 'bar-456' },
        timestamp: '2024-01-01T00:00:00.000Z',
        source: 'test',
        isDiff: false
      });
    });
    
    test('should add timestamp if not provided', () => {
      const event = {
        type: 'config',
        data: { barId: 'bar-123' },
        source: 'test'
      };
      
      broadcastManager.broadcastStateChange(event);
      
      const call = mockWindow.webContents.send.mock.calls[0];
      expect(call[1].timestamp).toBeDefined();
      expect(typeof call[1].timestamp).toBe('string');
    });
  });
});
