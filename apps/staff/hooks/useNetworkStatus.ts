/**
 * useNetworkStatus Hook
 * Detects online/offline status and provides network connectivity information
 * 
 * Task 6: Comprehensive Error Handling
 * Requirements: 6.2, 9.1, 9.2, 9.3, 10.1
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean; // True if was offline and just came back online
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

interface UseNetworkStatusReturn extends NetworkStatus {
  resetWasOffline: () => void;
}

/**
 * Custom hook for monitoring network connectivity status
 * 
 * Features:
 * - Detects online/offline status using navigator.onLine
 * - Tracks when network goes offline/online
 * - Provides timestamps for last online/offline events
 * - Tracks "wasOffline" flag for showing reconnection messages
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      setWasOffline(true); // Mark that we were offline
      console.info('[useNetworkStatus] Network connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(new Date());
      console.warn('[useNetworkStatus] Network connection lost');
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial online timestamp if online
    if (navigator.onLine && !lastOnlineAt) {
      setLastOnlineAt(new Date());
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [lastOnlineAt]);

  const resetWasOffline = () => {
    setWasOffline(false);
  };

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    lastOfflineAt,
    resetWasOffline
  };
}
