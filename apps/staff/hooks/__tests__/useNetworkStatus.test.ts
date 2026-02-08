/**
 * Unit Tests: useNetworkStatus Hook
 * 
 * Task 6: Comprehensive Error Handling
 * Tests Requirements: 6.2, 9.1, 10.1
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useNetworkStatus } from '../useNetworkStatus';

describe('useNetworkStatus', () => {
  let onlineCallback: (() => void) | null = null;
  let offlineCallback: (() => void) | null = null;

  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    // Mock window event listeners
    onlineCallback = null;
    offlineCallback = null;

    window.addEventListener = jest.fn((event: string, callback: any) => {
      if (event === 'online') {
        onlineCallback = callback;
      } else if (event === 'offline') {
        offlineCallback = callback;
      }
    });

    window.removeEventListener = jest.fn();

    // Mock console methods
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with online status', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(false);
      expect(result.current.lastOnlineAt).toBeInstanceOf(Date);
      expect(result.current.lastOfflineAt).toBeNull();
    });

    it('should initialize with offline status when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);
    });
  });

  describe('Online/Offline Events', () => {
    it('should detect when network goes offline', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);

      // Simulate offline event
      act(() => {
        if (offlineCallback) offlineCallback();
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.lastOfflineAt).toBeInstanceOf(Date);
      expect(console.warn).toHaveBeenCalledWith(
        '[useNetworkStatus] Network connection lost'
      );
    });

    it('should detect when network comes back online', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Go offline first
      act(() => {
        if (offlineCallback) offlineCallback();
      });

      expect(result.current.isOnline).toBe(false);

      // Come back online
      act(() => {
        if (onlineCallback) onlineCallback();
      });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(true);
      expect(result.current.lastOnlineAt).toBeInstanceOf(Date);
      expect(console.info).toHaveBeenCalledWith(
        '[useNetworkStatus] Network connection restored'
      );
    });

    it('should set wasOffline flag when coming back online', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Go offline
      act(() => {
        if (offlineCallback) offlineCallback();
      });

      // Come back online
      act(() => {
        if (onlineCallback) onlineCallback();
      });

      expect(result.current.wasOffline).toBe(true);
    });
  });

  describe('Timestamp Tracking', () => {
    it('should update lastOfflineAt when going offline', () => {
      const { result } = renderHook(() => useNetworkStatus());

      const beforeOffline = new Date();

      act(() => {
        if (offlineCallback) offlineCallback();
      });

      expect(result.current.lastOfflineAt).toBeInstanceOf(Date);
      expect(result.current.lastOfflineAt!.getTime()).toBeGreaterThanOrEqual(
        beforeOffline.getTime()
      );
    });

    it('should update lastOnlineAt when coming back online', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Go offline first
      act(() => {
        if (offlineCallback) offlineCallback();
      });

      const beforeOnline = new Date();

      // Come back online
      act(() => {
        if (onlineCallback) onlineCallback();
      });

      expect(result.current.lastOnlineAt).toBeInstanceOf(Date);
      expect(result.current.lastOnlineAt!.getTime()).toBeGreaterThanOrEqual(
        beforeOnline.getTime()
      );
    });
  });

  describe('resetWasOffline', () => {
    it('should reset wasOffline flag', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Go offline and back online
      act(() => {
        if (offlineCallback) offlineCallback();
      });

      act(() => {
        if (onlineCallback) onlineCallback();
      });

      expect(result.current.wasOffline).toBe(true);

      // Reset flag
      act(() => {
        result.current.resetWasOffline();
      });

      expect(result.current.wasOffline).toBe(false);
    });
  });

  describe('Event Listener Cleanup', () => {
    it('should add event listeners on mount', () => {
      renderHook(() => useNetworkStatus());

      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useNetworkStatus());

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Multiple Online/Offline Cycles', () => {
    it('should handle multiple offline/online cycles', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Cycle 1: offline -> online
      act(() => {
        if (offlineCallback) offlineCallback();
      });
      expect(result.current.isOnline).toBe(false);

      act(() => {
        if (onlineCallback) onlineCallback();
      });
      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(true);

      // Reset flag
      act(() => {
        result.current.resetWasOffline();
      });

      // Cycle 2: offline -> online
      act(() => {
        if (offlineCallback) offlineCallback();
      });
      expect(result.current.isOnline).toBe(false);

      act(() => {
        if (onlineCallback) onlineCallback();
      });
      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(true);
    });
  });
});
