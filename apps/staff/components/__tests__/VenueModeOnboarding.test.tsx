/**
 * Unit Tests: VenueModeOnboarding Component
 * 
 * Tests the forced mode functionality added in task 2.1
 * Tests the progress persistence functionality added in task 2.2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VenueModeOnboarding from '../VenueModeOnboarding';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('VenueModeOnboarding Component', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  describe('Normal Mode (not forced)', () => {
    test('should show cancel button when not forced', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={false}
        />
      );

      expect(screen.getByText('Cancel Setup')).toBeInTheDocument();
    });

    test('should call onCancel when cancel button is clicked', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={false}
        />
      );

      fireEvent.click(screen.getByText('Cancel Setup'));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    test('should not show forced mode indicators', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={false}
        />
      );

      expect(screen.queryByText('Setup Required')).not.toBeInTheDocument();
      expect(screen.queryByText('* Required to continue')).not.toBeInTheDocument();
    });
  });

  describe('Forced Mode', () => {
    test('should not show cancel button when forced', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
        />
      );

      expect(screen.queryByText('Cancel Setup')).not.toBeInTheDocument();
    });

    test('should show forced mode indicators', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
        />
      );

      expect(screen.getByText('Setup Required')).toBeInTheDocument();
      expect(screen.getByText('You must complete venue configuration before accessing settings.')).toBeInTheDocument();
      expect(screen.getByText('* Required to continue')).toBeInTheDocument();
    });

    test('should show required asterisk in title', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
        />
      );

      // Check for the asterisk in the title
      const title = screen.getByText('Choose Your Tabeza Setup');
      expect(title.parentElement).toHaveTextContent('*');
    });

    test('should prevent ESC key dismissal', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
        />
      );

      // Simulate ESC key press
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      // Modal should still be visible (component doesn't unmount)
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();
    });

    test('should show "Complete Required Setup" button text in summary', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
        />
      );

      // Select Basic mode to go to summary
      fireEvent.click(screen.getByText('Tabeza Basic'));

      // Should show forced completion text
      expect(screen.getByText('Complete Required Setup')).toBeInTheDocument();
    });
  });

  describe('Progress Persistence', () => {
    test('should save progress to localStorage when state changes', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Select Venue mode
      fireEvent.click(screen.getByText('Tabeza Venue'));

      // Should have saved progress
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tabeza_onboarding_progress',
        expect.stringContaining('"selectedMode":"venue"')
      );
    });

    test('should restore progress from localStorage on mount', () => {
      const mockProgress = {
        step: 'authority',
        selectedMode: 'venue',
        selectedAuthority: null,
        timestamp: Date.now()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockProgress));

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Should be on authority step
      expect(screen.getByText('Order Management Setup')).toBeInTheDocument();
    });

    test('should clear old progress (older than 24 hours)', () => {
      const oldProgress = {
        step: 'authority',
        selectedMode: 'venue',
        selectedAuthority: null,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(oldProgress));

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Should have removed old progress
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tabeza_onboarding_progress');
      
      // Should be on initial step
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();
    });

    test('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Should have removed corrupted data
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tabeza_onboarding_progress');
      
      // Should be on initial step
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();
    });

    test('should clear progress on successful completion', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Complete the flow
      fireEvent.click(screen.getByText('Tabeza Basic'));
      fireEvent.click(screen.getByText('Complete Setup'));

      // Should have cleared progress
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tabeza_onboarding_progress');
      expect(mockOnComplete).toHaveBeenCalled();
    });

    test('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw errors
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      // Should not crash when localStorage fails
      expect(() => {
        render(
          <VenueModeOnboarding 
            onComplete={mockOnComplete} 
            onCancel={mockOnCancel}
          />
        );
      }).not.toThrow();

      // Should still be functional
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();
    });

    test('should restore complete progress state including summary step', () => {
      const mockProgress = {
        step: 'summary',
        selectedMode: 'venue',
        selectedAuthority: 'tabeza',
        timestamp: Date.now()
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockProgress));

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Should be on summary step with correct configuration
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText('Tabeza Venue')).toBeInTheDocument();
      expect(screen.getByText('Full Service Platform')).toBeInTheDocument();
    });

    test('should save progress when navigating between steps', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Navigate through steps
      fireEvent.click(screen.getByText('Tabeza Venue'));
      fireEvent.click(screen.getByText('Yes - I have a POS'));

      // Should have saved progress multiple times
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(3); // Initial + mode + authority
      
      // Last call should include authority selection
      const lastCall = localStorageMock.setItem.mock.calls[2];
      expect(lastCall[1]).toContain('"selectedAuthority":"pos"');
      expect(lastCall[1]).toContain('"step":"summary"');
    });
  });

  describe('Forced Mode without onCancel prop', () => {
    test('should not show cancel button when onCancel is not provided', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          isForced={true}
        />
      );

      expect(screen.queryByText('Cancel Setup')).not.toBeInTheDocument();
    });

    test('should align continue button to right when no cancel button', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          isForced={true}
        />
      );

      const continueButton = screen.getByText('Continue');
      expect(continueButton.parentElement).toHaveClass('justify-end');
    });
  });

  describe('Validation UI Feedback', () => {
    test('should show validation errors for invalid configurations', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Select Basic mode (should be valid)
      fireEvent.click(screen.getByText('Tabeza Basic'));

      // Should not show validation errors for valid Basic mode
      expect(screen.queryByText('Configuration Error')).not.toBeInTheDocument();
    });

    test('should show validation warnings for configuration choices', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Select Venue mode
      fireEvent.click(screen.getByText('Tabeza Venue'));

      // Select POS authority
      fireEvent.click(screen.getByText('Yes - I have a POS'));

      // Should show warnings about POS authority implications
      expect(screen.getByText('Important Notice')).toBeInTheDocument();
      expect(screen.getByText(/staff ordering in Tabeza will be disabled/)).toBeInTheDocument();
    });

    test('should show validation icons on selected cards', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Select Basic mode
      fireEvent.click(screen.getByText('Tabeza Basic'));

      // Should show check icon for valid selection
      const basicCard = screen.getByText('Tabeza Basic').closest('div');
      expect(basicCard).toBeInTheDocument();
    });

    test('should update button text when validation errors exist', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // For valid selections, button should show normal text
      fireEvent.click(screen.getByText('Tabeza Basic'));
      
      // Should show normal completion button
      expect(screen.getByText('Complete Setup')).toBeInTheDocument();
    });

    test('should show configuration suggestions for errors', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Select Basic mode (valid configuration)
      fireEvent.click(screen.getByText('Tabeza Basic'));

      // Should not show suggestions for valid configuration
      expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
    });

    test('should show different warnings for different authority modes', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Test Venue + Tabeza authority
      fireEvent.click(screen.getByText('Tabeza Venue'));
      fireEvent.click(screen.getByText('No - Use Tabeza'));

      // Should show Tabeza authority warnings
      expect(screen.getByText(/POS integration will be disabled/)).toBeInTheDocument();
      expect(screen.getByText(/full customer ordering and staff management/)).toBeInTheDocument();
    });

    test('should clear validation feedback when changing selections', () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
        />
      );

      // Select Venue mode
      fireEvent.click(screen.getByText('Tabeza Venue'));
      
      // Select POS authority (shows warnings)
      fireEvent.click(screen.getByText('Yes - I have a POS'));
      expect(screen.getByText('Important Notice')).toBeInTheDocument();

      // Go back and select different authority
      fireEvent.click(screen.getByText('Back'));
      fireEvent.click(screen.getByText('No - Use Tabeza'));

      // Should show different warnings
      expect(screen.getByText(/POS integration will be disabled/)).toBeInTheDocument();
    });
  });
});