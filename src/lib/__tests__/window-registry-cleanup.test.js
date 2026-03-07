/**
 * Window Registry - Automatic Cleanup Tests
 * 
 * Tests for task 3.2: Implement automatic cleanup on window close
 * 
 * Validates:
 * - Window 'closed' event listener is attached
 * - Window is automatically unregistered when closed
 * - Destroyed windows are removed during getAllWindows()
 * 
 * Requirements: Design "Error Handling" - Window Registry Corruption
 */

const WindowRegistry = require('../window-registry');

// ─────────────────────────────────────────────────────────────────────────────
// Mock BrowserWindow
// ─────────────────────────────────────────────────────────────────────────────

class MockBrowserWindow {
  constructor(id, destroyed = false) {
    this.id = id;
    this._destroyed = destroyed;
    this._eventHandlers = new Map();
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

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('WindowRegistry - Automatic Cleanup (Task 3.2)', () => {
  let registry;
  
  beforeEach(() => {
    registry = new WindowRegistry();
  });
  
  afterEach(() => {
    registry.clearAll();
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Window 'closed' event listener is attached
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should attach closed event listener when registering window', () => {
    const mockWindow = new MockBrowserWindow('test-window-1');
    
    // Register window
    registry.registerWindow('test-window-1', mockWindow);
    
    // Verify event listener was attached
    expect(mockWindow._eventHandlers.has('closed')).toBe(true);
    expect(mockWindow._eventHandlers.get('closed').length).toBe(1);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: Window is automatically unregistered when closed
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should automatically unregister window when closed event fires', () => {
    const mockWindow = new MockBrowserWindow('test-window-2');
    
    // Register window
    registry.registerWindow('test-window-2', mockWindow);
    
    // Verify window is registered
    expect(registry.hasWindow('test-window-2')).toBe(true);
    expect(registry.getWindowCount()).toBe(1);
    
    // Simulate window close
    mockWindow.destroy();
    
    // Verify window is automatically unregistered
    expect(registry.hasWindow('test-window-2')).toBe(false);
    expect(registry.getWindowCount()).toBe(0);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: Multiple windows cleanup independently
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should cleanup windows independently when closed', () => {
    const window1 = new MockBrowserWindow('window-1');
    const window2 = new MockBrowserWindow('window-2');
    const window3 = new MockBrowserWindow('window-3');
    
    // Register all windows
    registry.registerWindow('window-1', window1);
    registry.registerWindow('window-2', window2);
    registry.registerWindow('window-3', window3);
    
    expect(registry.getWindowCount()).toBe(3);
    
    // Close window 2
    window2.destroy();
    
    // Verify only window 2 is removed
    expect(registry.hasWindow('window-1')).toBe(true);
    expect(registry.hasWindow('window-2')).toBe(false);
    expect(registry.hasWindow('window-3')).toBe(true);
    expect(registry.getWindowCount()).toBe(2);
    
    // Close window 1
    window1.destroy();
    
    // Verify only window 3 remains
    expect(registry.hasWindow('window-1')).toBe(false);
    expect(registry.hasWindow('window-2')).toBe(false);
    expect(registry.hasWindow('window-3')).toBe(true);
    expect(registry.getWindowCount()).toBe(1);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Destroyed windows are removed during getAllWindows()
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should remove destroyed windows during getAllWindows call', () => {
    const window1 = new MockBrowserWindow('window-1');
    const window2 = new MockBrowserWindow('window-2');
    
    // Register windows
    registry.registerWindow('window-1', window1);
    registry.registerWindow('window-2', window2);
    
    expect(registry.getWindowCount()).toBe(2);
    
    // Manually mark window 1 as destroyed (without firing closed event)
    window1._destroyed = true;
    
    // Call getAllWindows - should detect and remove destroyed window
    const activeWindows = registry.getAllWindows();
    
    // Verify only window 2 is returned
    expect(activeWindows.length).toBe(1);
    expect(activeWindows[0].id).toBe('window-2');
    
    // Verify window 1 was removed from registry
    expect(registry.hasWindow('window-1')).toBe(false);
    expect(registry.hasWindow('window-2')).toBe(true);
    expect(registry.getWindowCount()).toBe(1);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: getAllWindows handles multiple destroyed windows
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should remove all destroyed windows during getAllWindows call', () => {
    const window1 = new MockBrowserWindow('window-1');
    const window2 = new MockBrowserWindow('window-2');
    const window3 = new MockBrowserWindow('window-3');
    const window4 = new MockBrowserWindow('window-4');
    
    // Register all windows
    registry.registerWindow('window-1', window1);
    registry.registerWindow('window-2', window2);
    registry.registerWindow('window-3', window3);
    registry.registerWindow('window-4', window4);
    
    expect(registry.getWindowCount()).toBe(4);
    
    // Manually mark windows 1, 2, and 4 as destroyed
    window1._destroyed = true;
    window2._destroyed = true;
    window4._destroyed = true;
    
    // Call getAllWindows
    const activeWindows = registry.getAllWindows();
    
    // Verify only window 3 is returned
    expect(activeWindows.length).toBe(1);
    expect(activeWindows[0].id).toBe('window-3');
    
    // Verify destroyed windows were removed
    expect(registry.hasWindow('window-1')).toBe(false);
    expect(registry.hasWindow('window-2')).toBe(false);
    expect(registry.hasWindow('window-3')).toBe(true);
    expect(registry.hasWindow('window-4')).toBe(false);
    expect(registry.getWindowCount()).toBe(1);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Cleanup is idempotent (safe to call multiple times)
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should handle multiple unregister calls gracefully (idempotent)', () => {
    const mockWindow = new MockBrowserWindow('test-window');
    
    // Register window
    registry.registerWindow('test-window', mockWindow);
    expect(registry.getWindowCount()).toBe(1);
    
    // Close window (triggers automatic unregister)
    mockWindow.destroy();
    expect(registry.getWindowCount()).toBe(0);
    
    // Try to unregister again manually (should be safe)
    const result = registry.unregisterWindow('test-window');
    expect(result).toBe(false); // Returns false because already unregistered
    expect(registry.getWindowCount()).toBe(0);
  });
  
  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: Registry corruption prevention
  // ───────────────────────────────────────────────────────────────────────────
  
  test('should prevent registry corruption from destroyed windows', () => {
    const window1 = new MockBrowserWindow('window-1');
    const window2 = new MockBrowserWindow('window-2');
    const window3 = new MockBrowserWindow('window-3');
    
    // Register windows
    registry.registerWindow('window-1', window1);
    registry.registerWindow('window-2', window2);
    registry.registerWindow('window-3', window3);
    
    // Destroy window 2 without firing event (simulates crash)
    window2._destroyed = true;
    
    // Multiple calls to getAllWindows should consistently clean up
    let activeWindows = registry.getAllWindows();
    expect(activeWindows.length).toBe(2);
    
    activeWindows = registry.getAllWindows();
    expect(activeWindows.length).toBe(2);
    
    // Verify registry is consistent
    expect(registry.hasWindow('window-1')).toBe(true);
    expect(registry.hasWindow('window-2')).toBe(false);
    expect(registry.hasWindow('window-3')).toBe(true);
  });
});
