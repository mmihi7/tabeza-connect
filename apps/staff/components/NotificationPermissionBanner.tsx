'use client';

import { useState } from 'react';
import { Bell, X } from 'lucide-react';

interface NotificationPermissionBannerProps {
  onRequestPermission: () => Promise<NotificationPermission>;
  onDismiss?: () => void;
}

/**
 * Banner component that prompts users to enable browser notifications
 * 
 * Displays when:
 * - Notification permission is denied or default
 * - User has not permanently dismissed the banner
 * 
 * Features:
 * - Clear call-to-action to enable notifications
 * - Dismissible with localStorage persistence
 * - Accessible keyboard navigation
 */
export function NotificationPermissionBanner({
  onRequestPermission,
  onDismiss,
}: NotificationPermissionBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      await onRequestPermission();
      setIsVisible(false);
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center flex-1">
            <Bell className="h-5 w-5 mr-3 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">
              Enable notifications to receive instant alerts when receipts arrive from the POS
            </p>
          </div>
          <div className="flex items-center space-x-3 mt-2 sm:mt-0">
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Enable notifications"
            >
              {isRequesting ? 'Requesting...' : 'Enable Notifications'}
            </button>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-blue-100 focus:outline-none focus:ring-2 focus:ring-white rounded-md p-1 transition-colors"
              aria-label="Dismiss notification banner"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
