/**
 * Unit tests for NotificationPermissionBanner component
 * 
 * Task 7: Browser Notifications and Sound
 * Requirement 5.4: Fallback banner displays if permission denied
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPermissionBanner } from '../NotificationPermissionBanner';

describe('NotificationPermissionBanner', () => {
  const mockRequestPermission = jest.fn();
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render banner with correct content', () => {
    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    expect(screen.getByText(/Enable notifications to receive instant alerts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss notification banner/i })).toBeInTheDocument();
  });

  it('should call onRequestPermission when enable button clicked', async () => {
    mockRequestPermission.mockResolvedValue('granted');

    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const enableButton = screen.getByRole('button', { name: /Enable notifications/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });
  });

  it('should hide banner after permission granted', async () => {
    mockRequestPermission.mockResolvedValue('granted');

    const { container } = render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const enableButton = screen.getByRole('button', { name: /Enable notifications/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('should call onDismiss when dismiss button clicked', () => {
    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /Dismiss notification banner/i });
    fireEvent.click(dismissButton);

    expect(mockDismiss).toHaveBeenCalled();
  });

  it('should hide banner when dismissed', () => {
    const { container } = render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /Dismiss notification banner/i });
    fireEvent.click(dismissButton);

    expect(container.firstChild).toBeNull();
  });

  it('should disable button while requesting permission', async () => {
    let resolvePermission: (value: NotificationPermission) => void;
    const permissionPromise = new Promise<NotificationPermission>((resolve) => {
      resolvePermission = resolve;
    });
    mockRequestPermission.mockReturnValue(permissionPromise);

    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const enableButton = screen.getByRole('button', { name: /Enable notifications/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(enableButton).toBeDisabled();
      expect(screen.getByText('Requesting...')).toBeInTheDocument();
    });

    // Resolve the promise
    resolvePermission!('granted');

    await waitFor(() => {
      expect(enableButton).not.toBeInTheDocument();
    });
  });

  it('should handle permission request errors gracefully', async () => {
    mockRequestPermission.mockRejectedValue(new Error('Permission failed'));

    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const enableButton = screen.getByRole('button', { name: /Enable notifications/i });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });

    // Banner should still be visible after error
    expect(screen.getByText(/Enable notifications to receive instant alerts/i)).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('should be keyboard accessible', () => {
    render(
      <NotificationPermissionBanner
        onRequestPermission={mockRequestPermission}
        onDismiss={mockDismiss}
      />
    );

    const enableButton = screen.getByRole('button', { name: /Enable notifications/i });
    const dismissButton = screen.getByRole('button', { name: /Dismiss notification banner/i });

    // Both buttons should be focusable
    enableButton.focus();
    expect(document.activeElement).toBe(enableButton);

    dismissButton.focus();
    expect(document.activeElement).toBe(dismissButton);
  });
});
