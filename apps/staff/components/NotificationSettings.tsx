'use client';

import { Bell, Volume2, VolumeX } from 'lucide-react';
import { NotificationPreferences } from '../hooks/useNotifications';

interface NotificationSettingsProps {
  preferences: NotificationPreferences;
  permission: NotificationPermission;
  onUpdatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  onRequestPermission: () => Promise<NotificationPermission>;
}

/**
 * Settings component for managing notification preferences
 * 
 * Features:
 * - Toggle notifications on/off
 * - Toggle sound on/off
 * - Adjust volume with slider
 * - Request permission if not granted
 * - Visual feedback for current state
 */
export function NotificationSettings({
  preferences,
  permission,
  onUpdatePreferences,
  onRequestPermission,
}: NotificationSettingsProps) {
  const handleToggleNotifications = () => {
    if (permission !== 'granted') {
      onRequestPermission();
    } else {
      onUpdatePreferences({ enabled: !preferences.enabled });
    }
  };

  const handleToggleSound = () => {
    onUpdatePreferences({ soundEnabled: !preferences.soundEnabled });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    onUpdatePreferences({ volume });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Bell className="h-5 w-5 mr-2" aria-hidden="true" />
        Notification Settings
      </h3>

      <div className="space-y-6">
        {/* Browser Notifications Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label htmlFor="notifications-toggle" className="text-sm font-medium text-gray-700">
              Browser Notifications
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {permission === 'granted'
                ? 'Receive alerts when receipts arrive'
                : permission === 'denied'
                ? 'Permission denied - check browser settings'
                : 'Enable to receive receipt alerts'}
            </p>
          </div>
          <button
            id="notifications-toggle"
            onClick={handleToggleNotifications}
            disabled={permission === 'denied'}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              preferences.enabled && permission === 'granted'
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={preferences.enabled && permission === 'granted'}
            aria-label="Toggle browser notifications"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                preferences.enabled && permission === 'granted'
                  ? 'translate-x-5'
                  : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label htmlFor="sound-toggle" className="text-sm font-medium text-gray-700 flex items-center">
              {preferences.soundEnabled ? (
                <Volume2 className="h-4 w-4 mr-2" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Notification Sound
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Play sound when receipts arrive
            </p>
          </div>
          <button
            id="sound-toggle"
            onClick={handleToggleSound}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              preferences.soundEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={preferences.soundEnabled}
            aria-label="Toggle notification sound"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                preferences.soundEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Volume Slider */}
        {preferences.soundEnabled && (
          <div>
            <label htmlFor="volume-slider" className="text-sm font-medium text-gray-700 block mb-2">
              Volume: {Math.round(preferences.volume * 100)}%
            </label>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={preferences.volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Adjust notification volume"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Permission Status */}
        {permission === 'denied' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>Notifications blocked:</strong> To enable notifications, please allow them in your browser settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
