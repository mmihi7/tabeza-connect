/**
 * Configuration History Component Tests
 * Tests for Task 10.2: Add configuration history display
 * Requirements: 7.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationHistory from '../ConfigurationHistory';
import type { FormattedHistoryEntry } from '@tabeza/shared/lib/services/configuration-history';

// Mock the configuration history service
const mockGetVenueConfigurationHistory = jest.fn();
const mockGetConfigurationTimestamps = jest.fn();

jest.mock('@tabeza/shared/lib/services/configuration-history', () => ({
  getVenueConfigurationHistory: mockGetVenueConfigurationHistory,
  getConfigurationTimestamps: mockGetConfigurationTimestamps
}));

describe('ConfigurationHistory', () => {
  const mockBarId = 'test-bar-123';
  
  const mockHistoryEntries: FormattedHistoryEntry[] = [
    {
      id: 'entry-1',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      action: 'onboarding_completed',
      title: 'Onboarding Completed',
      description: 'Venue configured as venue mode with tabeza authority',
      details: {
        configurationAfter: 'Mode: Tabeza Venue, Authority: Tabeza',
        changeReason: 'Initial setup'
      },
      severity: 'success',
      icon: '✅',
      user: { id: 'user-123' }
    },
    {
      id: 'entry-2',
      timestamp: new Date('2024-01-20T15:30:00Z'),
      action: 'configuration_changed',
      title: 'Configuration Changed',
      description: 'Changed from Basic to Venue mode',
      details: {
        configurationBefore: 'Mode: Tabeza Basic, Authority: POS',
        configurationAfter: 'Mode: Tabeza Venue, Authority: Tabeza',
        changeReason: 'User upgrade to full service'
      },
      severity: 'info',
      icon: '⚙️'
    },
    {
      id: 'entry-3',
      timestamp: new Date('2024-01-18T12:00:00Z'),
      action: 'configuration_validation_failed',
      title: 'Validation Failed',
      description: 'Basic mode requires POS authority',
      details: {
        errorDetails: 'Basic mode requires POS authority, Invalid configuration combination'
      },
      severity: 'error',
      icon: '❌'
    }
  ];

  const mockTimestamps = {
    onboardingCompletedAt: new Date('2024-01-15T10:00:00Z'),
    authorityConfiguredAt: new Date('2024-01-15T10:00:00Z'),
    modeLastChangedAt: new Date('2024-01-20T15:30:00Z'),
    lastValidationFailure: new Date('2024-01-18T12:00:00Z')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGetVenueConfigurationHistory.mockResolvedValue({
      entries: mockHistoryEntries,
      totalCount: 3,
      hasMore: false
    });
    
    mockGetConfigurationTimestamps.mockResolvedValue(mockTimestamps);
  });

  describe('Basic Rendering', () => {
    it('should render configuration history with entries', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      // Check loading state initially
      expect(screen.getByText('Loading audit trail...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      // Check that entries are displayed
      expect(screen.getByText('Onboarding Completed')).toBeInTheDocument();
      expect(screen.getByText('Configuration Changed')).toBeInTheDocument();
      expect(screen.getByText('Validation Failed')).toBeInTheDocument();
    });

    it('should display configuration timestamps when showTimestamps is true', async () => {
      render(<ConfigurationHistory barId={mockBarId} showTimestamps={true} />);

      await waitFor(() => {
        expect(screen.getByText('Key Configuration Dates')).toBeInTheDocument();
      });

      expect(screen.getByText('Onboarding Completed:')).toBeInTheDocument();
      expect(screen.getByText('Authority Configured:')).toBeInTheDocument();
      expect(screen.getByText('Last Mode Change:')).toBeInTheDocument();
      expect(screen.getByText('Last Validation Failure:')).toBeInTheDocument();
    });

    it('should not display timestamps when showTimestamps is false', async () => {
      render(<ConfigurationHistory barId={mockBarId} showTimestamps={false} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      expect(screen.queryByText('Key Configuration Dates')).not.toBeInTheDocument();
    });

    it('should display entry count in header', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('3 of 3 events')).toBeInTheDocument();
      });
    });
  });

  describe('Entry Display', () => {
    it('should display entry details with correct severity styling', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      // Check success entry styling
      const successEntry = screen.getByText('Onboarding Completed').closest('div');
      expect(successEntry).toHaveClass('bg-green-50');

      // Check error entry styling
      const errorEntry = screen.getByText('Validation Failed').closest('div');
      expect(errorEntry).toHaveClass('bg-red-50');
    });

    it('should display relative time for recent entries', async () => {
      // Mock recent timestamp (1 hour ago)
      const recentEntry: FormattedHistoryEntry = {
        ...mockHistoryEntries[0],
        timestamp: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      };

      mockGetVenueConfigurationHistory.mockResolvedValue({
        entries: [recentEntry],
        totalCount: 1,
        hasMore: false
      });

      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('1h ago')).toBeInTheDocument();
      });
    });

    it('should display user information when available', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('User ID: user-123')).toBeInTheDocument();
      });
    });
  });

  describe('Entry Expansion', () => {
    it('should expand entry details when clicked', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration Changed')).toBeInTheDocument();
      });

      // Find and click the expand button for the configuration change entry
      const expandButtons = screen.getAllByRole('button');
      const expandButton = expandButtons.find(button => 
        button.querySelector('svg') && 
        button.closest('div')?.textContent?.includes('Configuration Changed')
      );

      expect(expandButton).toBeInTheDocument();
      fireEvent.click(expandButton!);

      // Check that details are now visible
      await waitFor(() => {
        expect(screen.getByText('Configuration Before:')).toBeInTheDocument();
        expect(screen.getByText('Configuration After:')).toBeInTheDocument();
        expect(screen.getByText('Change Reason:')).toBeInTheDocument();
      });

      expect(screen.getByText('Mode: Tabeza Basic, Authority: POS')).toBeInTheDocument();
      expect(screen.getByText('Mode: Tabeza Venue, Authority: Tabeza')).toBeInTheDocument();
      expect(screen.getByText('User upgrade to full service')).toBeInTheDocument();
    });

    it('should collapse entry details when clicked again', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration Changed')).toBeInTheDocument();
      });

      // Find and click the expand button
      const expandButtons = screen.getAllByRole('button');
      const expandButton = expandButtons.find(button => 
        button.querySelector('svg') && 
        button.closest('div')?.textContent?.includes('Configuration Changed')
      );

      // Expand
      fireEvent.click(expandButton!);
      await waitFor(() => {
        expect(screen.getByText('Configuration Before:')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(expandButton!);
      await waitFor(() => {
        expect(screen.queryByText('Configuration Before:')).not.toBeInTheDocument();
      });
    });

    it('should display error details for validation failures', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Validation Failed')).toBeInTheDocument();
      });

      // Find and click the expand button for the validation failure entry
      const expandButtons = screen.getAllByRole('button');
      const expandButton = expandButtons.find(button => 
        button.querySelector('svg') && 
        button.closest('div')?.textContent?.includes('Validation Failed')
      );

      fireEvent.click(expandButton!);

      await waitFor(() => {
        expect(screen.getByText('Error Details:')).toBeInTheDocument();
        expect(screen.getByText('Basic mode requires POS authority, Invalid configuration combination')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('should show filters when filter button is clicked', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      expect(screen.getByText('Search Events')).toBeInTheDocument();
      expect(screen.getByText('Event Types')).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
    });

    it('should filter entries by search term', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      // Enter search term
      const searchInput = screen.getByPlaceholderText('Search by title, description, or details...');
      fireEvent.change(searchInput, { target: { value: 'onboarding' } });

      // Wait for filter to apply
      await waitFor(() => {
        expect(mockGetVenueConfigurationHistory).toHaveBeenCalledWith(
          mockBarId,
          expect.objectContaining({
            barId: mockBarId
          })
        );
      });
    });

    it('should filter entries by event type', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      // Select event type
      const onboardingCheckbox = screen.getByLabelText('Onboarding Completed');
      fireEvent.click(onboardingCheckbox);

      await waitFor(() => {
        expect(mockGetVenueConfigurationHistory).toHaveBeenCalledWith(
          mockBarId,
          expect.objectContaining({
            eventTypes: ['onboarding_completed']
          })
        );
      });
    });

    it('should clear all filters when clear button is clicked', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      // Open filters
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      // Set some filters
      const searchInput = screen.getByPlaceholderText('Search by title, description, or details...');
      fireEvent.change(searchInput, { target: { value: 'test' } });

      const onboardingCheckbox = screen.getByLabelText('Onboarding Completed');
      fireEvent.click(onboardingCheckbox);

      // Clear filters
      const clearButton = screen.getByText('Clear All Filters');
      fireEvent.click(clearButton);

      expect(searchInput).toHaveValue('');
      expect(onboardingCheckbox).not.toBeChecked();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when loading fails', async () => {
      const errorMessage = 'Failed to load configuration history';
      mockGetVenueConfigurationHistory.mockRejectedValue(new Error(errorMessage));

      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Error loading history')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Check retry button is present
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should retry loading when retry button is clicked', async () => {
      const errorMessage = 'Failed to load configuration history';
      mockGetVenueConfigurationHistory.mockRejectedValueOnce(new Error(errorMessage));

      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Reset mock to return successful response
      mockGetVenueConfigurationHistory.mockResolvedValue({
        entries: mockHistoryEntries,
        totalCount: 3,
        hasMore: false
      });

      // Click retry
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
        expect(screen.getByText('Onboarding Completed')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no entries exist', async () => {
      mockGetVenueConfigurationHistory.mockResolvedValue({
        entries: [],
        totalCount: 0,
        hasMore: false
      });

      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('No Configuration History')).toBeInTheDocument();
        expect(screen.getByText('Configuration events will appear here as they occur.')).toBeInTheDocument();
      });
    });

    it('should display filtered empty state when filters return no results', async () => {
      mockGetVenueConfigurationHistory.mockResolvedValue({
        entries: [],
        totalCount: 0,
        hasMore: false
      });

      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      // Open filters and set a search term
      const filterButton = screen.getByText('Filters');
      fireEvent.click(filterButton);

      const searchInput = screen.getByPlaceholderText('Search by title, description, or details...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No events match your current filters.')).toBeInTheDocument();
      });
    });
  });

  describe('Compact Mode', () => {
    it('should not show filters in compact mode', async () => {
      render(<ConfigurationHistory barId={mockBarId} compact={true} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
    });

    it('should not show load more button in compact mode', async () => {
      mockGetVenueConfigurationHistory.mockResolvedValue({
        entries: mockHistoryEntries,
        totalCount: 10,
        hasMore: true
      });

      render(<ConfigurationHistory barId={mockBarId} compact={true} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      expect(screen.queryByText('Load More Events')).not.toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh data when refresh button is clicked', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      expect(mockGetVenueConfigurationHistory).toHaveBeenCalledTimes(2);
    });

    it('should disable refresh button while loading', async () => {
      render(<ConfigurationHistory barId={mockBarId} />);

      await waitFor(() => {
        expect(screen.getByText('Configuration History')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Refresh');
      
      // Mock a slow response
      mockGetVenueConfigurationHistory.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          entries: mockHistoryEntries,
          totalCount: 3,
          hasMore: false
        }), 100))
      );

      fireEvent.click(refreshButton);

      expect(refreshButton).toBeDisabled();
    });
  });
});