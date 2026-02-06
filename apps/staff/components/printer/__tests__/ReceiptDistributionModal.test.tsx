/**
 * Unit tests for ReceiptDistributionModal
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceiptDistributionModal, type ReceiptData } from '../ReceiptDistributionModal';

describe('ReceiptDistributionModal', () => {
  const mockReceiptData: ReceiptData = {
    items: [
      { name: 'Burger', quantity: 2, unit_price: 500, total_price: 1000 },
      { name: 'Fries', quantity: 1, unit_price: 200, total_price: 200 }
    ],
    total: 1200,
    customerInfo: {
      tableNumber: 5
    },
    rawReceipt: 'Test receipt'
  };

  const mockHandlers = {
    onPhysicalReceipt: jest.fn(),
    onDigitalReceipt: jest.fn(),
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <ReceiptDistributionModal
        isOpen={false}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Receipt Distribution')).toBeInTheDocument();
    expect(screen.getByText('Order Summary')).toBeInTheDocument();
  });

  it('should display receipt items correctly', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/2x Burger/)).toBeInTheDocument();
    expect(screen.getByText(/1x Fries/)).toBeInTheDocument();
    expect(screen.getByText(/KES 1000.00/)).toBeInTheDocument();
    expect(screen.getByText(/KES 200.00/)).toBeInTheDocument();
  });

  it('should display total correctly', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/KES 1200.00/)).toBeInTheDocument();
  });

  it('should display table number when available', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/Table:/)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('should call onPhysicalReceipt when Physical Receipt button is clicked', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    const physicalButton = screen.getByText('Physical Receipt').closest('button');
    fireEvent.click(physicalButton!);

    expect(mockHandlers.onPhysicalReceipt).toHaveBeenCalledTimes(1);
  });

  it('should call onDigitalReceipt when Tabeza Digital Receipt button is clicked', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    const digitalButton = screen.getByText('Tabeza Digital Receipt').closest('button');
    fireEvent.click(digitalButton!);

    expect(mockHandlers.onDigitalReceipt).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);

    expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('should render both action buttons', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Physical Receipt')).toBeInTheDocument();
    expect(screen.getByText('Tabeza Digital Receipt')).toBeInTheDocument();
  });

  it('should display tip message', () => {
    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={mockReceiptData}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/💡 Tip:/)).toBeInTheDocument();
    expect(screen.getByText(/Choose "Physical Receipt" for walk-in customers/)).toBeInTheDocument();
  });

  it('should handle receipt without table number', () => {
    const receiptWithoutTable: ReceiptData = {
      ...mockReceiptData,
      customerInfo: {}
    };

    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={receiptWithoutTable}
        {...mockHandlers}
      />
    );

    expect(screen.queryByText(/Table:/)).not.toBeInTheDocument();
  });

  it('should format prices with two decimal places', () => {
    const receiptWithDecimals: ReceiptData = {
      items: [
        { name: 'Coffee', quantity: 1, unit_price: 150.5, total_price: 150.5 }
      ],
      total: 150.5,
      rawReceipt: 'Test'
    };

    render(
      <ReceiptDistributionModal
        isOpen={true}
        receiptData={receiptWithDecimals}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/KES 150.50/)).toBeInTheDocument();
  });
});
