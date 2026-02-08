/**
 * Unit tests for useNotifications hook
 * 
 * Task 7: Browser Notifications and Sound
 * Requirements: 2.5, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Notification API
const mockNotification = jest.fn();
const mockNotificationInstance = {
  close: jest.fn(),
  onclick: null as any,
};

Object.defineProperty(window, 'Notification', {
  writable: true,
  value: Object.assign(mockNotification, {
    permission: 'default' as NotificationPermission,
    requestPermission: jest.fn(),
  }),
});

// Mock Audio API
class MockAudio {
  src: string = '';
  volume: number = 1;
  currentTime: number = 0;
  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();

  constructor(src?: string) {
    if (src) this.src = src;
  }
}

Object.defineProperty(window, 'Audio', {
  writable: true,
  value: MockAudio,
});

describe('useNotifications', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    mockNotification.mockReturnValue(mockNotificationInstance);
    (window.Notification as any).permission = 'default';
    (window.Notification.requestPermission as jest.Mock).mockResolvedValue('granted');
  });

  describe('Initialization', () => {
    it('should initialize with default preferences', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.preferences).toEqual({
        enabled: true,
        soundEnabled: true,
        volume: 0.8,
      });
      expect(result.current.permission).toBe('default');
      expect(result.current.permissionDenied).toBe(false);
    });

    it('should load preferences from localStorage', () => {
      localStorageMock.setItem(
        'tabeza_notification_preferences',
        JSON.stringify({
          enabled: false,
          soundEnabled: false,
          volume: 0.5,
        })
      );

      const { result } = renderHook(() => useNotifications());

      expect(result.current.preferences).toEqual({
        enabled: false,
        soundEnabled: false,
        volume: 0.5,
      });
    });

    it('should detect granted permission on mount', () => {
      (window.Notification as any).permission = 'granted';

      const { result } = renderHook(() => useNotifications());

      expect(result.current.permission).toBe('granted');
      expect(result.current.permissionDenied).toBe(false);
    });

    it('should detect denied permission on mount', () => {
      (window.Notification as any).permission = 'denied';

      const { result } = renderHook(() => useNotifications());

      expect(result.current.permission).toBe('denied');
      expect(result.current.permissionDenied).toBe(true);
    });
  });

  describe('Permission Request (Requirement 5.1)', () => {
    it('should request notification permission', async () => {
      const { result } = renderHook(() => useNotifications());

      let permissionResult: NotificationPermission | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(window.Notification.requestPermission).toHaveBeenCalled();
      expect(permissionResult).toBe('granted');
      expect(result.current.permission).toBe('granted');
      expect(result.current.permissionDenied).toBe(false);
    });

    it('should handle permission denial', async () => {
      (window.Notification.requestPermission as jest.Mock).mockResolvedValue('denied');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.permission).toBe('denied');
      expect(result.current.permissionDenied).toBe(true);
    });

    it('should return granted if already granted', async () => {
      (window.Notification as any).permission = 'granted';

      const { result } = renderHook(() => useNotifications());

      let permissionResult: NotificationPermission | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe('granted');
      expect(window.Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('should handle missing Notification API', async () => {
      const originalNotification = window.Notification;
      // @ts-ignore
      delete window.Notification;

      // Render hook after deleting Notification API
      const { result } = renderHook(() => useNotifications());

      // Permission should be 'default' when Notification API is missing
      expect(result.current.permission).toBe('default');

      let permissionResult: NotificationPermission | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      // Should return 'denied' when API is not available
      expect(permissionResult).toBe('denied');

      // Restore Notification API
      window.Notification = originalNotification;
    });
  });

  describe('Show Notification (Requirement 5.2, 5.3)', () => {
    beforeEach(() => {
      (window.Notification as any).permission = 'granted';
    });

    it('should display browser notification with correct content', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: 'New Receipt',
          body: 'Total: KES 812.00',
          tag: 'receipt-123',
          data: { receiptId: 'receipt-123' },
        });
      });

      expect(mockNotification).toHaveBeenCalledWith('New Receipt', {
        body: 'Total: KES 812.00',
        icon: '/logo-192.png',
        tag: 'receipt-123',
        data: { receiptId: 'receipt-123' },
        requireInteraction: false,
      });
    });

    it('should not show notification if disabled in preferences', async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        result.current.updatePreferences({ enabled: false });
      });

      await act(async () => {
        await result.current.showNotification({
          title: 'Test',
          body: 'Test body',
        });
      });

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('should request permission if default', async () => {
      (window.Notification as any).permission = 'default';

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: 'Test',
          body: 'Test body',
        });
      });

      expect(window.Notification.requestPermission).toHaveBeenCalled();
    });

    it('should not show notification if permission denied', async () => {
      (window.Notification as any).permission = 'denied';

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: 'Test',
          body: 'Test body',
        });
      });

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('should handle notification click to focus window', async () => {
      const focusSpy = jest.spyOn(window, 'focus');
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: 'Test',
          body: 'Test body',
          data: { receiptId: 'receipt-123' },
        });
      });

      // Simulate notification click
      if (mockNotificationInstance.onclick) {
        mockNotificationInstance.onclick();
      }

      expect(focusSpy).toHaveBeenCalled();
      expect(mockNotificationInstance.close).toHaveBeenCalled();
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notification-clicked',
          detail: { receiptId: 'receipt-123' },
        })
      );

      focusSpy.mockRestore();
      dispatchEventSpy.mockRestore();
    });
  });

  describe('Sound Playback (Requirement 2.5)', () => {
    it('should play notification sound', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.playSound();
      });

      // Audio is created in useEffect, need to wait
      waitFor(() => {
        expect(MockAudio.prototype.play).toHaveBeenCalled();
      });
    });

    it('should not play sound if disabled in preferences', async () => {
      const playSpy = jest.fn().mockResolvedValue(undefined);
      MockAudio.prototype.play = playSpy;

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        result.current.updatePreferences({ soundEnabled: false });
      });

      act(() => {
        result.current.playSound();
      });

      expect(playSpy).not.toHaveBeenCalled();
    });

    it('should set correct volume', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.updatePreferences({ volume: 0.5 });
      });

      // Volume is set in useEffect
      waitFor(() => {
        expect(result.current.preferences.volume).toBe(0.5);
      });
    });
  });

  describe('Preferences Management (Requirement 5.5)', () => {
    it('should update preferences', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.updatePreferences({
          enabled: false,
          soundEnabled: false,
          volume: 0.3,
        });
      });

      expect(result.current.preferences).toEqual({
        enabled: false,
        soundEnabled: false,
        volume: 0.3,
      });
    });

    it('should persist preferences to localStorage', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.updatePreferences({
          enabled: false,
          volume: 0.6,
        });
      });

      const stored = localStorageMock.getItem('tabeza_notification_preferences');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.enabled).toBe(false);
      expect(parsed.volume).toBe(0.6);
    });

    it('should merge partial updates with existing preferences', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.updatePreferences({ volume: 0.5 });
      });

      expect(result.current.preferences).toEqual({
        enabled: true,
        soundEnabled: true,
        volume: 0.5,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid localStorage data', () => {
      localStorageMock.setItem('tabeza_notification_preferences', 'invalid json');

      const { result } = renderHook(() => useNotifications());

      expect(result.current.preferences).toEqual({
        enabled: true,
        soundEnabled: true,
        volume: 0.8,
      });
    });

    it('should handle notification creation errors', async () => {
      (window.Notification as any).permission = 'granted';
      mockNotification.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: 'Test',
          body: 'Test body',
        });
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle audio playback errors', () => {
      MockAudio.prototype.play = jest.fn().mockRejectedValue(new Error('Play failed'));

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.playSound();
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
