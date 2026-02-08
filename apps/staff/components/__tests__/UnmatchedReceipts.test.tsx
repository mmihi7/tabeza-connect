/**
 * Unit Tests for UnmatchedReceipts Component
 * 
 * Tests the unmatched receipts list component that displays receipts
 * waiting for manual assignment to customer tabs.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnmatchedReceipts, type UnmatchedReceipt } from '../UnmatchedReceipts';

// Mock fetch
global.fetch = jest.fn();

// Mock ReceiptAssignmentModal
jest.mock('../ReceiptAssignmentModal', () => ({
  ReceiptAssignmentModal: ({ isOpen, onClose }: any) => (
    isOpen ? <div data-testid="assignment-modal" onClick={onClose}>Modal</div> : null
  )
}));

describe('UnmatchedReceipts Component', () => {
  const mockVenueId = 'venue-123';
  
  const mockReceipts: UnmatchedReceipt[] = [
    {
      id: 'receipt-1',
      bar_id: mockVenueId,
      receipt_data: {
        venueName: 'Test Venue',
        timestamp: new Date().toISOString(),
        items: [
          { name: 'Tusker', quantity: 2, unitPrice: 250, total: 500 },
          { name: 'Nyama Choma', quantity: 1, unitPrice: 800, total: 800 }
        ],
        subtotal: 1300,
        tax: 208,
        total: 1508
      },
      status: 'pending',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      assigned_at: null,
      assigned_to_tab_id: null,
      expires_at: new Date(Date.now() + 50 * 60 * 1000).toISOString()
    },
    {
      id: 'receipt-2',
      bar_id: mockVenueId,
      receipt_data: {
        venueName: 'Test Venue',
        timestamp: new Date().toISOString(),
        items: [
          { name: 'Pilsner', quantity: 3, unitPrice: 250, total: 750 }
        ],
        subtotal: 750,
        tax: 120,
        total: 870
      },
      status: 'pending',
      created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 minutes ago (old)
      assigned_at: null,
      assigned_to_tab_id: null,
      expires_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ receipts: mockReceipts })
    });
  });

  describe('Requirement 8.2: Unmatched Receipts Display', () => {
    it('should display all receipts sorted by timestamp', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText('Unmatched Receipts')).toBeInTheDocument();
      });

      // Should show both receipts
      expect(screen.getByText(/Tusker, Nyama Choma/)).toBeInTheDocument();
      expect(screen.getByText(/Pilsner/)).toBeInTheDocument();
      
      // Should show totals
      expect(screen.getByText('KES 1508.00')).toBeInTheDocument();
      expect(screen.getByText('KES 870.00')).toBeInTheDocument();
    });

    it('should display receipt count in header', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText('2 receipts waiting for assignment')).toBeInTheDocument();
      });
    });

    it('should show timestamp for each receipt', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/10m ago/)).toBeInTheDocument();
        expect(screen.getByText(/1h 30m ago/)).toBeInTheDocument();
      });
    });
  });

  describe('Requirement 8.3: Auto-refresh', () => {
    it('should auto-refresh every 30 seconds', async () => {
      jest.useFakeTimers();
      
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      jest.useRealTimers();
    });

    it('should allow manual refresh', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Requirement 8.4: Click to open modal', () => {
    it('should open assignment modal when receipt is clicked', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/Tusker, Nyama Choma/)).toBeInTheDocument();
      });

      // Click on first receipt
      const receiptCard = screen.getByText(/Tusker, Nyama Choma/).closest('div');
      fireEvent.click(receiptCard!);

      await waitFor(() => {
        expect(screen.getByTestId('assignment-modal')).toBeInTheDocument();
      });
    });

    it('should close modal and refresh receipts after assignment', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/Tusker, Nyama Choma/)).toBeInTheDocument();
      });

      // Click on receipt to open modal
      const receiptCard = screen.getByText(/Tusker, Nyama Choma/).closest('div');
      fireEvent.click(receiptCard!);

      await waitFor(() => {
        expect(screen.getByTestId('assignment-modal')).toBeInTheDocument();
      });

      // Close modal (simulates successful assignment)
      const modal = screen.getByTestId('assignment-modal');
      fireEvent.click(modal);

      await waitFor(() => {
        expect(screen.queryByTestId('assignment-modal')).not.toBeInTheDocument();
      });

      // Should refresh receipts
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Requirement 8.5: Empty state', () => {
    it('should display empty state when no receipts exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ receipts: [] })
      });

      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText('No unmatched receipts')).toBeInTheDocument();
        expect(screen.getByText('All receipts have been assigned to customer tabs')).toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state initially', () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      expect(screen.getByText('Loading unmatched receipts...')).toBeInTheDocument();
    });

    it('should show error state on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load unmatched receipts')).toBeInTheDocument();
      });

      // Should show retry button
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should retry on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load unmatched receipts')).toBeInTheDocument();
      });

      // Mock successful response for retry
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ receipts: mockReceipts })
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Unmatched Receipts')).toBeInTheDocument();
      });
    });
  });

  describe('Old Receipt Highlighting', () => {
    it('should highlight receipts older than 1 hour as urgent', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/URGENT - 1h old/)).toBeInTheDocument();
      });
    });

    it('should not highlight recent receipts', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/Tusker, Nyama Choma/)).toBeInTheDocument();
      });

      // Recent receipt should not have urgent badge
      const recentReceipt = screen.getByText(/Tusker, Nyama Choma/).closest('div');
      expect(recentReceipt).not.toHaveTextContent('URGENT');
    });
  });

  describe('Items Preview', () => {
    it('should show first 2 items with count for multiple items', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/Tusker, Nyama Choma/)).toBeInTheDocument();
      });
    });

    it('should show single item name for one item', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText(/Pilsner/)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch receipts with correct venue ID', async () => {
      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/receipts/unmatched?venueId=${mockVenueId}`
        );
      });
    });

    it('should handle API error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Server error' })
      });

      render(<UnmatchedReceipts venueId={mockVenueId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load unmatched receipts')).toBeInTheDocument();
      });
    });
  });
});
