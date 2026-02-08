import { useState, useEffect, useCallback, useRef } from 'react';

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  volume: number;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  preferences: NotificationPreferences;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (options: NotificationOptions) => Promise<void>;
  playSound: () => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  permissionDenied: boolean;
}

const STORAGE_KEY = 'tabeza_notification_preferences';
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  volume: 0.8,
};

/**
 * Hook for managing browser notifications and notification sounds
 * 
 * Features:
 * - Request notification permission
 * - Display browser notifications
 * - Play notification sound with volume control
 * - Persist notification preferences
 * - Handle notification clicks
 * 
 * @returns Notification state and control functions
 */
export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error('Failed to parse notification preferences:', error);
      }
    }

    // Check current permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      setPermissionDenied(Notification.permission === 'denied');
    }
  }, []);

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.volume = preferences.volume;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [preferences.volume]);

  /**
   * Request notification permission from the user
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setPermissionDenied(result === 'denied');
      return result;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }, []);

  /**
   * Display a browser notification
   */
  const showNotification = useCallback(async (options: NotificationOptions): Promise<void> => {
    // Check if notifications are enabled in preferences
    if (!preferences.enabled) {
      return;
    }

    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return;
    }

    // Request permission if not already granted
    if (Notification.permission === 'default') {
      const result = await requestPermission();
      if (result !== 'granted') {
        return;
      }
    }

    // Don't show notification if permission is denied
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/logo-192.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: false,
      });

      // Handle notification click - focus the window
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Dispatch custom event for modal display
        if (options.data?.receiptId) {
          window.dispatchEvent(new CustomEvent('notification-clicked', {
            detail: { receiptId: options.data.receiptId }
          }));
        }
      };

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }, [preferences.enabled, requestPermission]);

  /**
   * Play notification sound
   */
  const playSound = useCallback(() => {
    if (!preferences.soundEnabled || !audioRef.current) {
      return;
    }

    try {
      audioRef.current.volume = preferences.volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.error('Failed to play notification sound:', error);
      });
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, [preferences.soundEnabled, preferences.volume]);

  /**
   * Update notification preferences
   */
  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setPreferences(current => {
      const updated = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    permission,
    preferences,
    requestPermission,
    showNotification,
    playSound,
    updatePreferences,
    permissionDenied,
  };
}
