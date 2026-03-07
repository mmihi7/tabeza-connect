/**
 * Window Registry - Initial State Sync Tests
 * 
 * Tests for task 3.3: Implement initial state sync on registration
 * 
 * Validates:
 * - Window receives initial state snapshot on registration
 * - 'state-sync' IPC event is sent with correct payload
 * - StateManager reference can be set via constructor or setStateManager()
 * - Registration succeeds even if state sync fails
 * 
 * Requirements: Design "Example Usage" - Window registration pattern
 */

const WindowRegistry = require('../window-registry');

// ─────────────────────────────────────────────────────────────────────────────
// Mock StateManager
// ─────────────────────────────────────────────────────────────────────────────

class MockStateManager {
  constructor(state = null) {
    this.state = state || {
      setup: {
        firstRunComplete: false,
        steps: {
          barId: { completed: false, completedAt: null },
          printer: { completed: false, completedAt: null },
          template: { completed: false, completedAt: null }
        }
      },
      config: {
        barId: 'test-bar-123',
        apiUrl: 'https://test.tabeza.co.ke',
        watchFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
        httpPort: 8765
      },
      printer: {
        status: 'NotConfigured',
        printerName: null,
        lastChecked: null
      },
      template: {
        exists: false,
        path: null,
        version: null,
        posSystem: null,
        lastChecked: null
      }
    };
  }
  
  getState(stateType = null) {
    if (stateType) {
      return this.state[stateType];
    }
    return this.state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock BrowserWindow
// ─────────────────────────────────────────────────────────────────────────────

class MockBrowserWindow {
  constructor(id, destroyed = false) {
    this.id = id;
    this._destroyed = destroyed;
    this._eventHandlers = new Map();
    this.webContents = new MockWebContents();
  }
  
  isDestroyed() {
    return this._destroyed;
  }
  
  on(event, handler) {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event).push(handler);
  }
  
  emit(event) {
    const handlers = this._eventHandlers.get(event) || [];
    handlers.forEach(handler => handler());
  }
  
  destroy() {
    this._destroyed = true;
    this.emit('closed');
  }
}

class MockWebContents {
  constructor() {
    this._destroyed = false;
    this.sentMessages = [];
  }
  
  isDestroyed() {
    return this._destroyed;
  }
  
  send(channel, data) {
    this.sentMessages.push({ channel, data });
  }
  
  destroy() {
    this._destroyed = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('WindowRegistry - Initial State Sync (Task 3.3)', () => {
  let registry;
  let stateManager;
  
  beforeEach(() => {
    stateManager = new MockStateManager();
  });
  
  afterEach(() => {
    if (registry) {
      registry.clearAll();
    }
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: StateManager can be provided via constructor
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should accept StateManager via constructor', () => {
    registry = new WindowRegistry(stateManager);
    
    expect(registry.stateManager).toBe(stateManager);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: StateManager can be set via setStateManager()
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should accept StateManager via setStateManager method', () => {
    registry = new WindowRegistry();
    
    expect(registry.stateManager).toBeNull();
    
    registry.setStateManager(stateManager);
    
    expect(registry.stateManager).toBe(stateManager);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: setStateManager validates parameter
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should throw error if setStateManager receives invalid parameter', () => {
    registry = new WindowRegistry();
    
    expect(() => registry.setStateManager(null)).toThrow('stateManager must be a valid StateManager instance');
    expect(() => registry.setStateManager(undefined)).toThrow('stateManager must be a valid StateManager instance');
    expect(() => registry.setStateManager('invalid')).toThrow('stateManager must be a valid StateManager instance');
    expect(() => registry.setStateManager({})).toThrow('stateManager must have a getState() method');
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Window receives initial state sync on registration
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should send initial state sync to newly registered window', () => {
    registry = new WindowRegistry(stateManager);
    const mockWindow = new MockBrowserWindow('test-window-1');
    
    // Register window
    registry.registerWindow('test-window-1', mockWindow);
    
    // Verify state-sync IPC event was sent
    expect(mockWindow.webContents.sentMessages.length).toBe(1);
    
    const message = mockWindow.webContents.sentMessages[0];
    expect(message.channel).toBe('state-sync');
    expect(message.data).toHaveProperty('type', 'initial-sync');
    expect(message.data).toHaveProperty('data');
    expect(message.data).toHaveProperty('timestamp');
    expect(message.data).toHaveProperty('source', 'window-registry');
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: State sync includes complete state snapshot
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should include complete state snapshot in sync event', () => {
    registry = new WindowRegistry(stateManager);
    const mockWindow = new MockBrowserWindow('test-window-2');
    
    // Register window
    registry.registerWindow('test-window-2', mockWindow);
    
    // Get the sent message
    const message = mockWindow.webContents.sentMessages[0];
    const syncData = message.data.data;
    
    // Verify complete state is included
    expect(syncData).toHaveProperty('setup');
    expect(syncData).toHaveProperty('config');
    expect(syncData).toHaveProperty('printer');
    expect(syncData).toHaveProperty('template');
    
    // Verify state values match StateManager
    expect(syncData.config.barId).toBe('test-bar-123');
    expect(syncData.config.apiUrl).toBe('https://test.tabeza.co.ke');
    expect(syncData.printer.status).toBe('NotConfigured');
    expect(syncData.template.exists).toBe(false);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: No state sync if StateManager not available
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should skip state sync if StateManager not available', () => {
    registry = new WindowRegistry(); // No StateManager
    const mockWindow = new MockBrowserWindow('test-window-3');
    
    // Register window
    registry.registerWindow('test-window-3', mockWindow);
    
    // Verify no IPC messages were sent
    expect(mockWindow.webContents.sentMessages.length).toBe(0);
    
    // Verify window is still registered successfully
    expect(registry.hasWindow('test-window-3')).toBe(true);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: Registration succeeds even if state sync fails
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should complete registration even if state sync fails', () => {
    // Create StateManager that throws error
    const faultyStateManager = {
      getState: () => {
        throw new Error('StateManager error');
      }
    };
    
    registry = new WindowRegistry(faultyStateManager);
    const mockWindow = new MockBrowserWindow('test-window-4');
    
    // Register window - should not throw
    expect(() => {
      registry.registerWindow('test-window-4', mockWindow);
    }).not.toThrow();
    
    // Verify window is registered despite sync failure
    expect(registry.hasWindow('test-window-4')).toBe(true);
    expect(registry.getWindowCount()).toBe(1);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 8: No state sync if webContents is destroyed
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should skip state sync if webContents is destroyed', () => {
    registry = new WindowRegistry(stateManager);
    const mockWindow = new MockBrowserWindow('test-window-5');
    
    // Destroy webContents before registration
    mockWindow.webContents.destroy();
    
    // Register window
    registry.registerWindow('test-window-5', mockWindow);
    
    // Verify no IPC messages were sent
    expect(mockWindow.webContents.sentMessages.length).toBe(0);
    
    // Verify window is still registered
    expect(registry.hasWindow('test-window-5')).toBe(true);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 9: Multiple windows each receive initial state sync
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should send initial state sync to each registered window', () => {
    registry = new WindowRegistry(stateManager);
    
    const window1 = new MockBrowserWindow('window-1');
    const window2 = new MockBrowserWindow('window-2');
    const window3 = new MockBrowserWindow('window-3');
    
    // Register all windows
    registry.registerWindow('window-1', window1);
    registry.registerWindow('window-2', window2);
    registry.registerWindow('window-3', window3);
    
    // Verify each window received state sync
    expect(window1.webContents.sentMessages.length).toBe(1);
    expect(window2.webContents.sentMessages.length).toBe(1);
    expect(window3.webContents.sentMessages.length).toBe(1);
    
    // Verify all received same state
    const state1 = window1.webContents.sentMessages[0].data.data;
    const state2 = window2.webContents.sentMessages[0].data.data;
    const state3 = window3.webContents.sentMessages[0].data.data;
    
    expect(state1.config.barId).toBe('test-bar-123');
    expect(state2.config.barId).toBe('test-bar-123');
    expect(state3.config.barId).toBe('test-bar-123');
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 10: State sync timestamp is recent
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should include recent timestamp in state sync event', () => {
    registry = new WindowRegistry(stateManager);
    const mockWindow = new MockBrowserWindow('test-window-6');
    
    const beforeTime = new Date().toISOString();
    
    // Register window
    registry.registerWindow('test-window-6', mockWindow);
    
    const afterTime = new Date().toISOString();
    
    // Get the sent message
    const message = mockWindow.webContents.sentMessages[0];
    const timestamp = message.data.timestamp;
    
    // Verify timestamp is between before and after
    expect(timestamp >= beforeTime).toBe(true);
    expect(timestamp <= afterTime).toBe(true);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 11: StateManager can be set after windows are registered
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should allow setting StateManager after windows are registered', () => {
    registry = new WindowRegistry(); // No StateManager initially
    
    const window1 = new MockBrowserWindow('window-1');
    const window2 = new MockBrowserWindow('window-2');
    
    // Register windows without StateManager
    registry.registerWindow('window-1', window1);
    registry.registerWindow('window-2', window2);
    
    // Verify no state sync was sent
    expect(window1.webContents.sentMessages.length).toBe(0);
    expect(window2.webContents.sentMessages.length).toBe(0);
    
    // Set StateManager
    registry.setStateManager(stateManager);
    
    // Register new window
    const window3 = new MockBrowserWindow('window-3');
    registry.registerWindow('window-3', window3);
    
    // Verify new window receives state sync
    expect(window3.webContents.sentMessages.length).toBe(1);
    expect(window3.webContents.sentMessages[0].channel).toBe('state-sync');
  });
});
