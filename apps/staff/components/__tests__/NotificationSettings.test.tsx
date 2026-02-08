/**
 * Unit tests for NotificationSettings component
 * 
 * Task 7: Browser Notifications and Sound
 * Requirement 5.5: Notification preferences toggle and persistence
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSettings } from '../NotificationSettings';
import { NotificationPreferences } from '../../hooks/useNotifications';

describe('NotificationSettings', () => {
  const defaultPreferences: NotificationPreferences = {
    enabled: true,
    soundEnabled: true,
    volume: 0.8,
  };

  const mockUpdatePreferences = jest.fn();
  const mockRequestPermission = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all settings controls', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
      expect(screen.getByText('Browser Notifications')).toBeInTheDocument();
      expect(screen.getByText('Notification Sound')).toBeInTheDocument();
      expect(screen.getByLabelText(/Adjust notification volume/i)).toBeInTheDocument();
    });

    it('should show correct permission status messages', () => {
      const { rerender } = render(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByText(/Receive alerts when receipts arrive/i)).toBeInTheDocument();

      rerender(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="denied"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByText(/Permission denied - check browser settings/i)).toBeInTheDocument();

      rerender(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="default"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByText(/Enable to receive receipt alerts/i)).toBeInTheDocument();
    });

    it('should show volume slider only when sound is enabled', () => {
      const { rerender } = render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByLabelText(/Adjust notification volume/i)).toBeInTheDocument();

      rerender(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: false }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.queryByLabelText(/Adjust notification volume/i)).not.toBeInTheDocument();
    });

    it('should show warning when permission is denied', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="denied"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByText(/Notifications blocked/i)).toBeInTheDocument();
      expect(screen.getByText(/please allow them in your browser settings/i)).toBeInTheDocument();
    });
  });

  describe('Notification Toggle', () => {
    it('should toggle notifications when permission granted', () => {
      render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, enabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const toggle = screen.getByRole('switch', { name: /Toggle browser notifications/i });
      fireEvent.click(toggle);

      expect(mockUpdatePreferences).toHaveBeenCalledWith({ enabled: false });
    });

    it('should request permission when toggling if not granted', () => {
      render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, enabled: false }}
          permission="default"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const toggle = screen.getByRole('switch', { name: /Toggle browser notifications/i });
      fireEvent.click(toggle);

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });

    it('should disable toggle when permission denied', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="denied"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const toggle = screen.getByRole('switch', { name: /Toggle browser notifications/i });
      expect(toggle).toBeDisabled();
    });

    it('should reflect enabled state correctly', () => {
      const { rerender } = render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, enabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      let toggle = screen.getByRole('switch', { name: /Toggle browser notifications/i });
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      rerender(
        <NotificationSettings
          preferences={{ ...defaultPreferences, enabled: false }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      toggle = screen.getByRole('switch', { name: /Toggle browser notifications/i });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Sound Toggle', () => {
    it('should toggle sound on and off', () => {
      render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const toggle = screen.getByRole('switch', { name: /Toggle notification sound/i });
      fireEvent.click(toggle);

      expect(mockUpdatePreferences).toHaveBeenCalledWith({ soundEnabled: false });
    });

    it('should reflect sound enabled state correctly', () => {
      const { rerender } = render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      let toggle = screen.getByRole('switch', { name: /Toggle notification sound/i });
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      rerender(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: false }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      toggle = screen.getByRole('switch', { name: /Toggle notification sound/i });
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Volume Control', () => {
    it('should update volume when slider changed', () => {
      render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const slider = screen.getByLabelText(/Adjust notification volume/i);
      fireEvent.change(slider, { target: { value: '0.5' } });

      expect(mockUpdatePreferences).toHaveBeenCalledWith({ volume: 0.5 });
    });

    it('should display current volume percentage', () => {
      render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, volume: 0.6, soundEnabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByText('Volume: 60%')).toBeInTheDocument();
    });

    it('should have correct slider attributes', () => {
      render(
        <NotificationSettings
          preferences={{ ...defaultPreferences, soundEnabled: true }}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const slider = screen.getByLabelText(/Adjust notification volume/i) as HTMLInputElement;
      expect(slider).toHaveAttribute('type', 'range');
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '1');
      expect(slider).toHaveAttribute('step', '0.1');
      expect(slider.value).toBe('0.8');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      expect(screen.getByRole('switch', { name: /Toggle browser notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /Toggle notification sound/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Adjust notification volume/i)).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(
        <NotificationSettings
          preferences={defaultPreferences}
          permission="granted"
          onUpdatePreferences={mockUpdatePreferences}
          onRequestPermission={mockRequestPermission}
        />
      );

      const notificationToggle = screen.getByRole('switch', { name: /Toggle browser notifications/i });
      const soundToggle = screen.getByRole('switch', { name: /Toggle notification sound/i });
      const volumeSlider = screen.getByLabelText(/Adjust notification volume/i);

      notificationToggle.focus();
      expect(document.activeElement).toBe(notificationToggle);

      soundToggle.focus();
      expect(document.activeElement).toBe(soundToggle);

      volumeSlider.focus();
      expect(document.activeElement).toBe(volumeSlider);
    });
  });
});
