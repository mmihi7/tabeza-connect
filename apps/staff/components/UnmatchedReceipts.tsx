/**
 * UnmatchedReceipts Component
 * 
 * Displays ALL unmatched receipts that were dismissed or missed and need 
 * manual assignment to customer tabs. Provides recovery mechanism for
 * receipts that weren't assigned immediately.
 * 
 * IMPORTANT: Shows ALL pending receipts regardless of age. Staff must
 * manually assign or cancel each receipt. No automatic filtering by time.
 * 
 * Features:
 * - Displays ALL unmatched receipts (no time limit)
 * - Sorted by timestamp (newest first)
 * - Auto-refreshes every 30 seconds
 * - Click receipt to open assignment modal
 * - Shows age indicator (e.g., "2h 15m ago" for old receipts)
 * - Empty state when no unmatched receipts exist
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Receipt, Clock, DollarSign, Package, AlertCircle } from 'lucide-react';
import { ReceiptAssignmentModal } from './ReceiptAssignmentModal';

export interface UnmatchedReceipt {
  id: string;
  bar_id: string;
  receipt_data: {
    venueName: string;
    timestamp: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
  };
  status: 'pending' | 'assigned' | 'printed' | 'expired';
  created_at: string;
  assigned_at: string | null;
  assigned_to_tab_id: string | null;
  expires_at: string;
}

export interface UnmatchedReceiptsProps {
  venueId: string;
}

export function UnmatchedReceipts({ venueId }: UnmatchedReceiptsProps) {
  const [receipts, setReceipts] = useState<UnmatchedReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<UnmatchedReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch unmatched receipts
  const fetchReceipts = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/receipts/unmatched?venueId=${venueId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch unmatched receipts');
      }

      const data = await response.json();
      
      // Show ALL receipts - no time filtering
      // Staff must manually assign or cancel each receipt
      setReceipts(data.receipts || []);
    } catch (err) {
      console.error('Error fetching unmatched receipts:', err);
      setError('Failed to load unmatched receipts');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchReceipts();
  }, [venueId]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchReceipts();
    }, 30000);

    return () => clearInterval(interval);
  }, [venueId]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `KES ${amount.toFixed(2)}`;
  };

  // Format timestamp with better handling for old receipts
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
    return `${days}d ${hours % 24}h ago`;
  };

  // Get items preview (first 2 items)
  const getItemsPreview = (items: UnmatchedReceipt['receipt_data']['items']): string => {
    if (items.length === 0) return 'No items';
    if (items.length === 1) return items[0].name;
    if (items.length === 2) return `${items[0].name}, ${items[1].name}`;
    return `${items[0].name}, ${items[1].name} +${items.length - 2} more`;
  };

  // Handle receipt click
  const handleReceiptClick = (receipt: UnmatchedReceipt) => {
    setSelectedReceipt(receipt);
  };

  // Handle modal close
  const handleModalClose = () => {
    setSelectedReceipt(null);
    // Refresh receipts after modal closes
    fetchReceipts();
  };

  // Handle successful assignment
  const handleAssignmentSuccess = () => {
    setSelectedReceipt(null);
    // Refresh receipts to remove assigned receipt
    fetchReceipts();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading unmatched receipts...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchReceipts}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (receipts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Receipt size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">No unmatched receipts</p>
          <p className="text-sm text-gray-400 mt-2">
            All receipts have been assigned to customer tabs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Unmatched Receipts</h2>
          <p className="text-sm text-gray-500">
            {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} waiting for assignment
          </p>
        </div>
        <button
          onClick={fetchReceipts}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          Refresh
        </button>
      </div>

      {/* Receipt List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {receipts.map((receipt) => {
          const createdAt = new Date(receipt.created_at).getTime();
          const ageInHours = (Date.now() - createdAt) / (60 * 60 * 1000);
          const isOld = ageInHours > 1; // Highlight receipts older than 1 hour
          
          return (
            <div
              key={receipt.id}
              onClick={() => handleReceiptClick(receipt)}
              className={`border rounded-lg p-4 hover:shadow-lg cursor-pointer transition transform hover:scale-105 ${
                isOld 
                  ? 'bg-red-50 border-red-300 border-2' 
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Urgent Badge for Old Receipts */}
              {isOld && (
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
                    <AlertCircle size={12} />
                    URGENT - {Math.floor(ageInHours)}h old
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={20} className={isOld ? 'text-red-600' : 'text-orange-600'} />
                  <span className="text-sm font-medium text-gray-700">
                    {receipt.receipt_data.venueName}
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-xs ${isOld ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                  <Clock size={14} />
                  {formatTimestamp(receipt.created_at)}
                </div>
              </div>

              {/* Items Preview */}
              <div className="mb-3">
                <div className="flex items-start gap-2">
                  <Package size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {getItemsPreview(receipt.receipt_data.items)}
                  </p>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-gray-500">
                  <DollarSign size={16} />
                  <span className="text-xs">Total</span>
                </div>
                <span className={`text-lg font-bold ${isOld ? 'text-red-600' : 'text-orange-600'}`}>
                  {formatCurrency(receipt.receipt_data.total)}
                </span>
              </div>

              {/* Item Count */}
              <div className="mt-2 text-xs text-gray-400">
                {receipt.receipt_data.items.length} item{receipt.receipt_data.items.length !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Assignment Modal */}
      {selectedReceipt && (
        <ReceiptAssignmentModal
          receipt={{
            id: selectedReceipt.id,
            venueId: selectedReceipt.bar_id,
            venueName: selectedReceipt.receipt_data.venueName,
            timestamp: new Date(selectedReceipt.receipt_data.timestamp),
            items: selectedReceipt.receipt_data.items,
            subtotal: selectedReceipt.receipt_data.subtotal,
            tax: selectedReceipt.receipt_data.tax,
            total: selectedReceipt.receipt_data.total,
            status: selectedReceipt.status
          }}
          isOpen={true}
          onClose={handleModalClose}
          onAssign={handleAssignmentSuccess}
        />
      )}
    </div>
  );
}
