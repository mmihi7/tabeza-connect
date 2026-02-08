/**
 * Unit Tests: ReceiptAssignmentModal Component
 * 
 * Tests for receipt assignment modal including:
 * - Modal display and rendering
 * - Receipt details display
 * - Tab selection interface
 * - Search/filter functionality
 * - Assignment flow
 * - Success and error states
 * - Loading states
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReceiptAssignmentModal, type Receipt, type Tab } from '../ReceiptAssignmentModal';

describe('ReceiptAssignmentModal', () => {
  const mockReceipt: Receipt = {
    id: 'receipt-1',
    venueId: 'venue-123',
    venueName: 'Test Venue',
    timestamp: new Date('2026-02-07T20:00:00Z'),
    items: [
      { name: 'Beer', quantity: 2, unitPrice: 300, total: 600 },
      { name: 'Burger', quantity: 1, unitPrice: 500, total: 500 }
    ],
    subtotal: 1100,
    tax: 176,
    total: 1276,
    status: 'pending'
  };

  const mockTabs: Tab[] = [
    {
      id: 'tab-1',
      tabNumber: 1,
      tableNumber: 'A1',
      customerIdentifier: 'John Doe',
      openedAt: new Date('2026-02-07T19:00:00Z'),
      status: 'open'
    },
    {
      id: 'tab-2',
      tabNumber: 2,
      tableNumber: 'B2',
      customerIdentifier: 'Jane Smith',
      openedAt: new Date('2026-02-07T19:30:00Z'),
      status: 'open'
    },
    {
      id: 'tab-3',
      tabNumber: 3,
      customerIdentifier: 'Bob Johnson',
      openedAt: new Date('2026-02-07T19:45:00Z'),
      status: 'open'
    }
  ];

  const defaultProps = {
    receipt: mockReceipt,
    isOpen: true,
    tabs: mockTabs,
    isLoadingTabs: false,
    isCacheStale: false,
    onClose: jest.fn(),
    onAssign: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Display', () => {
    it('should not render when isOpen is false', () => {
      render(<ReceiptAssignmentModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('New Order from POS')).not.toBeInTheDocument();
    });

    it('should not render when receipt is null', () => {
      render(<ReceiptAssignmentModal {...defaultProps} receipt={null} />);
      
      expect(screen.queryByText('New Order from POS')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true and receipt exists', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('New Order from POS')).toBeInTheDocument();
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
    });

    it('should display close button', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Cancel button is clicked', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Receipt Display', () => {
    it('should display venue name', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
    });

    it('should display receipt timestamp', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      // Timestamp should be formatted as HH:MM:SS
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('should display all line items', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText(/2x Beer/)).toBeInTheDocument();
      expect(screen.getByText(/1x Burger/)).toBeInTheDocument();
    });

    it('should display item prices', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText(/@ KES 300\.00 each/)).toBeInTheDocument();
      expect(screen.getByText(/@ KES 500\.00 each/)).toBeInTheDocument();
    });

    it('should display item totals', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('KES 600.00')).toBeInTheDocument();
      expect(screen.getByText('KES 500.00')).toBeInTheDocument();
    });

    it('should display subtotal', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Subtotal:')).toBeInTheDocument();
      expect(screen.getByText('KES 1100.00')).toBeInTheDocument();
    });

    it('should display tax', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Tax (16%):')).toBeInTheDocument();
      expect(screen.getByText('KES 176.00')).toBeInTheDocument();
    });

    it('should display total', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Total:')).toBeInTheDocument();
      expect(screen.getByText('KES 1276.00')).toBeInTheDocument();
    });

    it('should display stale cache indicator when cache is stale', () => {
      render(<ReceiptAssignmentModal {...defaultProps} isCacheStale={true} />);
      
      expect(screen.getByText('Using cached data')).toBeInTheDocument();
    });

    it('should not display stale cache indicator when cache is fresh', () => {
      render(<ReceiptAssignmentModal {...defaultProps} isCacheStale={false} />);
      
      expect(screen.queryByText('Using cached data')).not.toBeInTheDocument();
    });
  });

  describe('Tab Selection Interface', () => {
    it('should display tab selection heading', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Select Customer Tab')).toBeInTheDocument();
    });

    it('should display search input', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should display all tabs', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Tab #1')).toBeInTheDocument();
      expect(screen.getByText('Tab #2')).toBeInTheDocument();
      expect(screen.getByText('Tab #3')).toBeInTheDocument();
    });

    it('should display table numbers when available', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('Table A1')).toBeInTheDocument();
      expect(screen.getByText('Table B2')).toBeInTheDocument();
    });

    it('should display customer identifiers', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should sort tabs by creation time (newest first)', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const tabButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent?.includes('Tab #')
      );
      
      // Tab #3 should be first (most recent)
      expect(tabButtons[0]).toHaveTextContent('Tab #3');
      // Tab #2 should be second
      expect(tabButtons[1]).toHaveTextContent('Tab #2');
      // Tab #1 should be last (oldest)
      expect(tabButtons[2]).toHaveTextContent('Tab #1');
    });

    it('should display loading state when tabs are loading', () => {
      render(<ReceiptAssignmentModal {...defaultProps} isLoadingTabs={true} />);
      
      expect(screen.getByText('Loading tabs...')).toBeInTheDocument();
    });

    it('should display empty state when no tabs exist', () => {
      render(<ReceiptAssignmentModal {...defaultProps} tabs={[]} />);
      
      expect(screen.getByText('No open tabs available')).toBeInTheDocument();
      expect(screen.getByText('No customers have open tabs')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter tabs by tab number', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      fireEvent.change(searchInput, { target: { value: '1' } });
      
      expect(screen.getByText('Tab #1')).toBeInTheDocument();
      expect(screen.queryByText('Tab #2')).not.toBeInTheDocument();
      expect(screen.queryByText('Tab #3')).not.toBeInTheDocument();
    });

    it('should filter tabs by table number', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      fireEvent.change(searchInput, { target: { value: 'B2' } });
      
      expect(screen.queryByText('Tab #1')).not.toBeInTheDocument();
      expect(screen.getByText('Tab #2')).toBeInTheDocument();
      expect(screen.queryByText('Tab #3')).not.toBeInTheDocument();
    });

    it('should filter tabs by customer identifier', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      fireEvent.change(searchInput, { target: { value: 'Jane' } });
      
      expect(screen.queryByText('Tab #1')).not.toBeInTheDocument();
      expect(screen.getByText('Tab #2')).toBeInTheDocument();
      expect(screen.queryByText('Tab #3')).not.toBeInTheDocument();
    });

    it('should be case-insensitive', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      fireEvent.change(searchInput, { target: { value: 'JANE' } });
      
      expect(screen.getByText('Tab #2')).toBeInTheDocument();
    });

    it('should display empty state when search has no results', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      expect(screen.getByText('No open tabs available')).toBeInTheDocument();
      expect(screen.getByText('Try a different search term')).toBeInTheDocument();
    });

    it('should clear search when modal reopens', () => {
      const { rerender } = render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      // Close and reopen modal
      rerender(<ReceiptAssignmentModal {...defaultProps} isOpen={false} />);
      rerender(<ReceiptAssignmentModal {...defaultProps} isOpen={true} />);
      
      const newSearchInput = screen.getByPlaceholderText('Search by tab or table number...');
      expect(newSearchInput).toHaveValue('');
    });
  });

  describe('Tab Selection', () => {
    it('should select tab when clicked', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      expect(tab1Button).toHaveClass('border-blue-600', 'bg-blue-50');
    });

    it('should enable Send button when tab is selected', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const sendButton = screen.getByText('Send to Customer');
      expect(sendButton).toBeDisabled();
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      expect(sendButton).not.toBeDisabled();
    });

    it('should clear selection when modal reopens', () => {
      const { rerender } = render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      // Close and reopen modal
      rerender(<ReceiptAssignmentModal {...defaultProps} isOpen={false} />);
      rerender(<ReceiptAssignmentModal {...defaultProps} isOpen={true} />);
      
      const sendButton = screen.getByText('Send to Customer');
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Assignment Flow', () => {
    it('should call onAssign with selected tab ID', async () => {
      const mockOnAssign = jest.fn().mockResolvedValue(undefined);
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockOnAssign).toHaveBeenCalledWith('tab-1');
      });
    });

    it('should display loading state during assignment', async () => {
      const mockOnAssign = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(sendButton).toBeDisabled();
    });

    it('should display success state after successful assignment', async () => {
      const mockOnAssign = jest.fn().mockResolvedValue(undefined);
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Receipt Sent!')).toBeInTheDocument();
        expect(screen.getByText('Receipt sent to Tab #1')).toBeInTheDocument();
      });
    });

    it('should auto-close modal after successful assignment', async () => {
      jest.useFakeTimers();
      const mockOnAssign = jest.fn().mockResolvedValue(undefined);
      const mockOnClose = jest.fn();
      
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} onClose={mockOnClose} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Receipt Sent!')).toBeInTheDocument();
      });
      
      // Fast-forward 2 seconds
      jest.advanceTimersByTime(2000);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });

    it('should display error state on assignment failure', async () => {
      const mockOnAssign = jest.fn().mockRejectedValue(new Error('Network error'));
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Assignment Failed')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should provide retry button on error', async () => {
      const mockOnAssign = jest.fn().mockRejectedValue(new Error('Network error'));
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should reset state when retry is clicked', async () => {
      const mockOnAssign = jest.fn().mockRejectedValue(new Error('Network error'));
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(screen.queryByText('Assignment Failed')).not.toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable Send button when no tab is selected', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const sendButton = screen.getByText('Send to Customer');
      expect(sendButton).toBeDisabled();
    });

    it('should disable Send button when tabs are loading', () => {
      render(<ReceiptAssignmentModal {...defaultProps} isLoadingTabs={true} />);
      
      const sendButton = screen.getByText('Send to Customer');
      expect(sendButton).toBeDisabled();
    });

    it('should disable Send button when no tabs exist', () => {
      render(<ReceiptAssignmentModal {...defaultProps} tabs={[]} />);
      
      const sendButton = screen.getByText('Send to Customer');
      expect(sendButton).toBeDisabled();
    });

    it('should disable Cancel button during assignment', async () => {
      const mockOnAssign = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<ReceiptAssignmentModal {...defaultProps} onAssign={mockOnAssign} />);
      
      const tab1Button = screen.getByText('Tab #1').closest('button');
      fireEvent.click(tab1Button!);
      
      const sendButton = screen.getByText('Send to Customer');
      fireEvent.click(sendButton);
      
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible close button', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('should autofocus search input', () => {
      render(<ReceiptAssignmentModal {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by tab or table number...');
      expect(searchInput).toHaveFocus();
    });
  });
});
