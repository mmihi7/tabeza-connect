/**
 * Network Status Service Tests
 * 
 * Tests for network connectivity detection and monitoring functionality.
 */

import { NetworkStatusManager, getNetworkStatusManager, isOnline, testConnectivity } from '../network-status';

// Mock navigator and window objects
const mockNavigator = {
  onLine: true,
  connection: {
    type: 'wifi',
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }
};

const mockWindow = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock fetch for connectivity testing
global.fetch = jest.fn();

describe('NetworkStatusManager', () => {
  let manager: NetworkStatusManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock global objects
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true
    });
    
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true
    });

    manager = new NetworkStatusManager();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize with current network status', () => {
      const status = manager.getStatus();
      
      expect(status.isOnline).toBe(true);
      expect(status.connectionType).toBe('wifi');
      expect(status.effectiveType).toBe('4g');
      expect(status.downlink).toBe(10);
      expect(status.rtt).toBe(100);
      expect(status.saveData).toBe(false);
    });

    it('should handle missing navigator gracefully', () => {
      // @ts-ignore
      delete global.navigator;
      
      const serverManager = new NetworkStatusManager();
      const status = serverManager.getStatus();
      
      expect(status.isOnline).toBe(true); // Assumes online in server environment
      expect(status.connectionType).toBe('unknown');
      expect(status.effectiveType).toBe('unknown');
      
      serverManager.destroy();
    });
  });

  describe('network status detection', () => {
    it('should detect online status', () => {
      expect(manager.isOnline()).toBe(true);
    });

    it('should detect offline status', () => {
      mockNavigator.onLine = false;
      
      const offlineManager = new NetworkStatusManager();
      expect(offlineManager.isOnline()).toBe(false);
      
      offlineManager.destroy();
    });

    it('should detect slow connection', () => {
      mockNavigator.connection.effectiveType = '2g';
      mockNavigator.connection.downlink = 0.3;
      
      const slowManager = new NetworkStatusManager();
      expect(slowManager.isSlowConnection()).toBe(true);
      
      slowManager.destroy();
    });

    it('should detect fast connection', () => {
      mockNavigator.connection.effectiveType = '4g';
      mockNavigator.connection.downlink = 10;
      
      const fastManager = new NetworkStatusManager();
      expect(fastManager.isSlowConnection()).toBe(false);
      
      fastManager.destroy();
    });
  });

  describe('event listeners', () => {
    it('should add event listeners on initialization', () => {
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockNavigator.connection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove event listeners on destroy', () => {
      manager.destroy();
      
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(mockNavigator.connection.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should notify listeners on status change', () => {
      const listener = jest.fn();
      manager.addListener(listener);
      
      // Simulate network change
      mockNavigator.onLine = false;
      manager.refresh();
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        isOnline: false
      }));
    });
  });

  describe('monitoring', () => {
    it('should start monitoring', () => {
      manager.startMonitoring();
      expect(manager['isMonitoring']).toBe(true);
    });

    it('should stop monitoring', () => {
      manager.startMonitoring();
      manager.stopMonitoring();
      expect(manager['isMonitoring']).toBe(false);
    });

    it('should not start monitoring if already monitoring', () => {
      manager.startMonitoring();
      const firstTimer = manager['pollTimer'];
      
      manager.startMonitoring();
      expect(manager['pollTimer']).toBe(firstTimer);
    });
  });

  describe('connectivity testing', () => {
    it('should test connectivity successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true
      });

      const result = await manager.testConnectivity();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({
        method: 'HEAD',
        cache: 'no-cache'
      }));
    });

    it('should handle connectivity test failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await manager.testConnectivity();
      expect(result).toBe(false);
    });

    it('should handle connectivity test timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await manager.testConnectivity('/api/health', 100);
      expect(result).toBe(false);
    });
  });

  describe('connection type mapping', () => {
    it('should map wifi connection type', () => {
      mockNavigator.connection.type = 'wifi';
      const wifiManager = new NetworkStatusManager();
      
      expect(wifiManager.getStatus().connectionType).toBe('wifi');
      wifiManager.destroy();
    });

    it('should map cellular connection type', () => {
      mockNavigator.connection.type = 'cellular';
      const cellularManager = new NetworkStatusManager();
      
      expect(cellularManager.getStatus().connectionType).toBe('cellular');
      cellularManager.destroy();
    });

    it('should map unknown connection type', () => {
      mockNavigator.connection.type = 'unknown';
      const unknownManager = new NetworkStatusManager();
      
      expect(unknownManager.getStatus().connectionType).toBe('unknown');
      unknownManager.destroy();
    });
  });
});

describe('Global network status functions', () => {
  beforeEach(() => {
    // Reset global manager
    if ((global as any).globalNetworkManager) {
      (global as any).globalNetworkManager = null;
    }
    
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true
    });
    
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true
    });
  });

  it('should create global network manager', () => {
    const manager = getNetworkStatusManager();
    expect(manager).toBeInstanceOf(NetworkStatusManager);
    
    // Should return same instance on subsequent calls
    const manager2 = getNetworkStatusManager();
    expect(manager2).toBe(manager);
    
    manager.destroy();
  });

  it('should get network status', () => {
    mockNavigator.onLine = true;
    const status = isOnline();
    expect(status).toBe(true);
    
    getNetworkStatusManager().destroy();
  });

  it('should test connectivity', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    
    const result = await testConnectivity();
    expect(result).toBe(true);
    
    getNetworkStatusManager().destroy();
  });
});

describe('Edge cases', () => {
  it('should handle missing connection API', () => {
    const navigatorWithoutConnection = {
      onLine: true
    };
    
    Object.defineProperty(global, 'navigator', {
      value: navigatorWithoutConnection,
      writable: true
    });

    const manager = new NetworkStatusManager({ enableDetailedInfo: true });
    const status = manager.getStatus();
    
    expect(status.connectionType).toBe('unknown');
    expect(status.effectiveType).toBe('unknown');
    expect(status.downlink).toBe(10); // Default value
    expect(status.rtt).toBe(100); // Default value
    
    manager.destroy();
  });

  it('should handle disabled detailed info', () => {
    const manager = new NetworkStatusManager({ enableDetailedInfo: false });
    const status = manager.getStatus();
    
    expect(status.connectionType).toBe('unknown');
    expect(status.effectiveType).toBe('unknown');
    
    manager.destroy();
  });

  it('should handle listener errors gracefully', () => {
    const errorListener = jest.fn(() => {
      throw new Error('Listener error');
    });
    
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    manager.addListener(errorListener);
    manager.refresh(); // This should trigger the listener
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error in network status listener:', expect.any(Error));
    
    consoleErrorSpy.mockRestore();
  });
});