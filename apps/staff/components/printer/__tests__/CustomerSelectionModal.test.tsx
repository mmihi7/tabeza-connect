/**
 * Unit tests for CustomerSelectionModal
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerSelectionModal, type ConnectedCustomer } from '../CustomerSelectionModal';

describe('CustomerSelectionModal', () => {
  const mockCustomers: ConnectedCustomer[] = [
    {
      id: 'customer-1',
      tabId: 'tab-1',
      tabNumber: 1,
      customerIdentifier: 'Customer A',
      connectionStatus: 'connected',
      deviceInfo: {
        type: 'mobile',
        lastSeen: new Date(Date.now() - 60000) // 1 minute ago
      },
      ownerIdentifier: '+254712345678'
    },
    {
      id: 'customer-2',
      tabId: 'tab-2',
      tabNumber: 2,
      customerIdentifier: 'Customer B',
      connectionStatus: 'idle',
      deviceInfo: {
        type: 'mobile',
        lastSeen: new Date(Date.now() - 600000) // 10 minutes ago
      }
    }
  ];

  const mockHandlers = {
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    onFallbackToPhysical: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <CustomerSelectionModal
        isOpen={false}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Select Customer')).toBeInTheDocument();
  });

  it('should display all customers', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Tab #1')).toBeInTheDocument();
    expect(screen.getByText('Tab #2')).toBeInTheDocument();
    expect(screen.getByText('Customer A')).toBeInTheDocument();
    expect(screen.getByText('Customer B')).toBeInTheDocument();
  });

  it('should display receipt total', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/Total: KES 1200.00/)).toBeInTheDocument();
  });

  it('should allow selecting customers', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const customer1Button = screen.getByText('Tab #1').closest('button');
    fireEvent.click(customer1Button!);

    expect(screen.getByText(/1 customer selected/)).toBeInTheDocument();
  });

  it('should allow selecting multiple customers', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const customer1Button = screen.getByText('Tab #1').closest('button');
    const customer2Button = screen.getByText('Tab #2').closest('button');
    
    fireEvent.click(customer1Button!);
    fireEvent.click(customer2Button!);

    expect(screen.getByText(/2 customers selected/)).toBeInTheDocument();
  });

  it('should allow deselecting customers', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const customer1Button = screen.getByText('Tab #1').closest('button');
    
    // Select
    fireEvent.click(customer1Button!);
    expect(screen.getByText(/1 customer selected/)).toBeInTheDocument();
    
    // Deselect
    fireEvent.click(customer1Button!);
    expect(screen.getByText(/Select at least one customer/)).toBeInTheDocument();
  });

  it('should disable confirm button when no customers selected', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const confirmButton = screen.getByText(/Send Digital Receipt/);
    expect(confirmButton).toBeDisabled();
  });

  it('should enable confirm button when customers selected', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const customer1Button = screen.getByText('Tab #1').closest('button');
    fireEvent.click(customer1Button!);

    const confirmButton = screen.getByText(/Send Digital Receipt/);
    expect(confirmButton).not.toBeDisabled();
  });

  it('should call onConfirm with selected customer IDs', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const customer1Button = screen.getByText('Tab #1').closest('button');
    fireEvent.click(customer1Button!);

    const confirmButton = screen.getByText(/Send Digital Receipt/);
    fireEvent.click(confirmButton);

    expect(mockHandlers.onConfirm).toHaveBeenCalledWith(['customer-1']);
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onFallbackToPhysical when fallback button is clicked', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const fallbackButton = screen.getByText(/Print Physical Receipt Instead/);
    fireEvent.click(fallbackButton);

    expect(mockHandlers.onFallbackToPhysical).toHaveBeenCalledTimes(1);
  });

  it('should filter customers based on search query', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search by tab number/);
    fireEvent.change(searchInput, { target: { value: 'Customer A' } });

    expect(screen.getByText('Customer A')).toBeInTheDocument();
    expect(screen.queryByText('Customer B')).not.toBeInTheDocument();
  });

  it('should show no customers message when list is empty', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={[]}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('No Connected Customers')).toBeInTheDocument();
    expect(screen.getByText(/There are no customers currently connected/)).toBeInTheDocument();
  });

  it('should show fallback option when no customers available', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={[]}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    const fallbackButton = screen.getByText('Print Physical Receipt');
    expect(fallbackButton).toBeInTheDocument();
  });

  it('should display connection status indicators', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/Active/)).toBeInTheDocument();
    expect(screen.getByText(/Idle/)).toBeInTheDocument();
  });

  it('should display owner identifier when available', () => {
    render(
      <CustomerSelectionModal
        isOpen={true}
        customers={mockCustomers}
        receiptTotal={1200}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('+254712345678')).toBeInTheDocument();
  });
});
