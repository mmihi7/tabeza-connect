# useNotifications Hook

## Overview

The `useNotifications` hook provides a comprehensive interface for managing browser notifications and notification sounds in the Staff PWA. It handles permission requests, notification display, sound playback, and preference persistence.

## Features

- **Permission Management**: Request and track browser notification permissions
- **Browser Notifications**: Display native browser notifications with custom content
- **Notification Sounds**: Play audio alerts with adjustable volume
- **Preference Persistence**: Save and load notification settings from localStorage
- **Click Handling**: Focus the app window when notifications are clicked
- **Error Handling**: Gracefully handle missing APIs and errors

## Usage

```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const {
    permission,
    preferences,
    requestPermission,
    showNotification,
    playSound,
    updatePreferences,
    permissionDenied,
  } = useNotifications();

  // Request permission on first use
  const handleEnableNotifications = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      console.log('Notifications enabled!');
    }
  };

  // Show a notification
  const handleShowNotification = async () => {
    await showNotification({
      title: 'New Receipt',
      body: 'Total: KES 812.00',
      tag: 'receipt-123',
      data: { receiptId: 'receipt-123' },
    });
  };

  // Play notification sound
  const handlePlaySound = () => {
    playSound();
  };

  // Update preferences
  const handleToggleSound = () => {
    updatePreferences({ soundEnabled: !preferences.soundEnabled });
  };

  return (
    <div>
      <p>Permission: {permission}</p>
      <p>Sound Enabled: {preferences.soundEnabled ? 'Yes' : 'No'}</p>
      <p>Volume: {Math.round(preferences.volume * 100)}%</p>
      
      {permission !== 'granted' && (
        <button onClick={handleEnableNotifications}>
          Enable Notifications
        </button>
      )}
      
      <button onClick={handleShowNotification}>
        Show Notification
      </button>
      
      <button onClick={handlePlaySound}>
        Play Sound
      </button>
      
      <button onClick={handleToggleSound}>
        Toggle Sound
      </button>
    </div>
  );
}
```

## API Reference

### Return Values

#### `permission: NotificationPermission`
Current notification permission status: `'default'`, `'granted'`, or `'denied'`.

#### `preferences: NotificationPreferences`
Current notification preferences:
```typescript
{
  enabled: boolean;      // Whether notifications are enabled
  soundEnabled: boolean; // Whether sound is enabled
  volume: number;        // Volume level (0.0 to 1.0)
}
```

#### `requestPermission(): Promise<NotificationPermission>`
Request notification permission from the user. Returns the permission result.

#### `showNotification(options: NotificationOptions): Promise<void>`
Display a browser notification with the specified options:
```typescript
{
  title: string;        // Notification title
  body: string;         // Notification body text
  icon?: string;        // Icon URL (defaults to /logo-192.png)
  tag?: string;         // Unique tag for notification
  data?: any;           // Custom data attached to notification
}
```

#### `playSound(): void`
Play the notification sound at the current volume level.

#### `updatePreferences(prefs: Partial<NotificationPreferences>): void`
Update notification preferences. Changes are persisted to localStorage.

#### `permissionDenied: boolean`
Whether notification permission has been explicitly denied by the user.

## Notification Sound

The hook expects a notification sound file at `/notification-sound.mp3`. This file should be:
- Format: MP3
- Duration: 1-2 seconds
- Volume: Normalized to -6dB
- Sample Rate: 44.1kHz
- Bitrate: 128kbps

## Preference Persistence

Preferences are automatically saved to localStorage under the key `tabeza_notification_preferences`. They are loaded on mount and updated whenever `updatePreferences` is called.

## Browser Compatibility

The hook gracefully handles missing browser APIs:
- **No Notification API**: Permission requests return 'denied'
- **No Audio API**: Sound playback is skipped
- **No localStorage**: Preferences are not persisted

## Requirements Validated

This hook validates the following requirements from Task 7:

- **Requirement 2.5**: Play notification sound when modal displays
- **Requirement 5.1**: Request notification permission appropriately
- **Requirement 5.2**: Display browser notification when tab is in background
- **Requirement 5.3**: Handle notification click to focus tab and show modal
- **Requirement 5.4**: Show fallback banner if permission denied
- **Requirement 5.5**: Persist notification preferences across sessions

## Testing

The hook includes comprehensive unit tests covering:
- Initialization and preference loading
- Permission request handling
- Notification display
- Sound playback
- Preference management
- Error handling
- Browser API compatibility

Run tests with:
```bash
npm test -- useNotifications.test.ts
```

## Related Components

- **NotificationPermissionBanner**: Banner component for requesting permission
- **NotificationSettings**: Settings UI for managing notification preferences
- **ReceiptAssignmentModal**: Uses notifications when receipts arrive

## Implementation Notes

1. **Auto-close Notifications**: Notifications automatically close after 10 seconds
2. **Window Focus**: Clicking a notification focuses the app window and dispatches a custom event
3. **Volume Control**: Audio volume is set when the audio element is created and updated
4. **Error Logging**: All errors are logged to console but don't throw exceptions
5. **SSR Safety**: The hook checks for `window` before accessing browser APIs
