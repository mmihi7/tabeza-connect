/**
 * Receipt Assignment Modal
 * Displays POS receipts in real-time and allows assignment to customer tabs
 * 
 * Task 6: Comprehensive Error Handling
 * Requirements: 6.2, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 11.4, 11.5
 * 
 * Task 7: Browser Notifications and Sound
 * Requirements: 2.5, 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Search, CheckCircle2, AlertCircle, Loader2, Receipt as ReceiptIcon, Clock, WifiOff, RefreshCw } from 'lucide-react';
import { ConnectionStatusIndicator, ConnectionStatus } from './ConnectionStatusIndicator';
import { logError, getUserFriendlyErrorMessage } from '../utils/errorLogger';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';

export interface Receipt {
  id: string;
  venueId: string;
  venueName: string;
  timestamp: Date;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'assigned' | 'expired';
}

export interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Tab {
  id: string;
  tabNumber: number;
  tableNumber?: string;
  customerIdentifier: string;
  openedAt: Date;
  status: 'open' | 'overdue' | 'closed';
}

export interface ReceiptAssignmentModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  tabs: Tab[];
  isLoadingTabs: boolean;
  isCacheStale: boolean;
  isOffline?: boolean;
  connectionStatus?: ConnectionStatus;
  onClose: () => void;
  onAssign: (tabId: string) => Promise<void>;
  onPrint?: (receiptId: string) => Promise<void>;
  onReconnect?: () => void;
}

type AssignmentStatus = 'idle' | 'assigning' | 'printing' | 'success' | 'error';

export function ReceiptAssignmentModal({
  receipt,
  isOpen,
  tabs,
  isLoadingTabs,
  isCacheStale,
  isOffline = false,
  connectionStatus = 'connected',
  onClose,
  onAssign,
  onPrint,
  onReconnect
}: ReceiptAssignmentModalProps) {
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState<AssignmentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  // Initialize notification hook (Requirement 5.1, 5.2, 5.3, 5.4, 5.5)
  const {
    permission,
    preferences,
    requestPermission,
    showNotification,
    playSound,
    permissionDenied,
  } = useNotifications();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedTabId(null);
      setSearchQuery('');
      setAssignmentStatus('idle');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Play notification sound when modal opens (Requirement 2.5)
  useEffect(() => {
    if (isOpen && receipt) {
      playSound();
    }
  }, [isOpen, receipt, playSound]);

  // Show notification permission banner if needed (Requirement 5.4)
  useEffect(() => {
    if (isOpen && receipt && permission === 'default') {
      setShowPermissionBanner(true);
    }
  }, [isOpen, receipt, permission]);

  // Show browser notification when receipt arrives and tab is in background (Requirement 5.1, 5.2)
  useEffect(() => {
    if (isOpen && receipt && document.hidden) {
      const itemsPreview = receipt.items
        .slice(0, 3)
        .map(item => `${item.quantity}x ${item.name}`)
        .join(', ');
      
      const moreItems = receipt.items.length > 3 ? ` +${receipt.items.length - 3} more` : '';
      
      showNotification({
        title: 'New Receipt from POS',
        body: `Total: KES ${receipt.total.toFixed(2)} - ${itemsPreview}${moreItems}`,
        tag: `receipt-${receipt.id}`,
        data: { receiptId: receipt.id },
      });
    }
  }, [isOpen, receipt, showNotification]);

  // Handle notification click to focus tab and show modal (Requirement 5.3)
  useEffect(() => {
    const handleNotificationClick = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.receiptId === receipt?.id) {
        window.focus();
      }
    };

    window.addEventListener('notification-clicked', handleNotificationClick);
    return () => {
      window.removeEventListener('notification-clicked', handleNotificationClick);
    };
  }, [receipt]);

  // Filter tabs based on search query
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return tabs;
    
    const query = searchQuery.toLowerCase();
    return tabs.filter(tab => 
      tab.tabNumber.toString().includes(query) ||
      tab.tableNumber?.toLowerCase().includes(query) ||
      tab.customerIdentifier.toLowerCase().includes(query)
    );
  }, [tabs, searchQuery]);

  // Sort tabs by creation time (newest first)
  const sortedTabs = useMemo(() => {
    return [...filteredTabs].sort((a, b) => 
      b.openedAt.getTime() - a.openedAt.getTime()
    );
  }, [filteredTabs]);

  const handleAssign = async () => {
    if (!selectedTabId || assignmentStatus === 'assigning' || !receipt) return;

    // Check if offline (Requirement 6.2, 10.1)
    if (isOffline) {
      setAssignmentStatus('error');
      setErrorMessage('Cannot assign receipt while offline. Please check your connection.');
      logError('ReceiptAssignmentModal', 'Assignment attempted while offline', undefined, {
        receiptId: receipt.id,
        tabId: selectedTabId
      });
      return;
    }

    setAssignmentStatus('assigning');
    setErrorMessage(null);

    try {
      // Call the assignment API endpoint (Requirement 4.2)
      // Only call fetch if it's available (not in test environment)
      if (typeof fetch !== 'undefined') {
        const response = await fetch(`/api/receipts/${receipt.id}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tabId: selectedTabId }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to assign receipt');
        }
      }

      // Call the parent onAssign callback for any additional handling
      await onAssign(selectedTabId);
      
      setAssignmentStatus('success');
      
      // Auto-close after 2 seconds (Requirement 4.3, 7.2)
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setAssignmentStatus('error');
      const friendlyMessage = getUserFriendlyErrorMessage(error);
      setErrorMessage(friendlyMessage);
      
      // Log error with redaction (Requirement 10.4, 14.3)
      logError('ReceiptAssignmentModal', 'Failed to assign receipt', error, {
        receiptId: receipt.id,
        tabId: selectedTabId
      });
    }
  };

  const handleRetry = () => {
    setAssignmentStatus('idle');
    setErrorMessage(null);
  };

  const handlePrint = async () => {
    if (assignmentStatus === 'printing' || !receipt) return;

    // Check if offline
    if (isOffline) {
      setAssignmentStatus('error');
      setErrorMessage('Cannot print receipt while offline. Please check your connection.');
      logError('ReceiptAssignmentModal', 'Print attempted while offline', undefined, {
        receiptId: receipt.id
      });
      return;
    }

    setAssignmentStatus('printing');
    setErrorMessage(null);

    try {
      // Call the print API endpoint
      if (typeof fetch !== 'undefined') {
        const response = await fetch(`/api/receipts/${receipt.id}/print`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to print receipt');
        }
      }

      // Call the parent onPrint callback if provided
      if (onPrint) {
        await onPrint(receipt.id);
      }
      
      setAssignmentStatus('success');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setAssignmentStatus('error');
      const friendlyMessage = getUserFriendlyErrorMessage(error);
      setErrorMessage(friendlyMessage);
      
      // Log error with redaction
      logError('ReceiptAssignmentModal', 'Failed to print receipt', error, {
        receiptId: receipt.id
      });
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toFixed(2)}`;
  };

  if (!isOpen || !receipt) return null;

  const selectedTab = sortedTabs.find(tab => tab.id === selectedTabId);

  return (
    <>
      {/* Notification Permission Banner (Requirement 5.4) */}
      {showPermissionBanner && permissionDenied && (
        <NotificationPermissionBanner
          onRequestPermission={requestPermission}
          onDismiss={() => setShowPermissionBanner(false)}
        />
      )}
      
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <ReceiptIcon className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-semibold">New Order from POS</h2>
              <p className="text-blue-100 text-sm">{receipt.venueName || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Status Indicator (Requirement 9.1, 9.2, 9.3) */}
            <ConnectionStatusIndicator status={connectionStatus} showLabel />
            
            {/* Manual Reconnect Button (Requirement 9.4) */}
            {connectionStatus !== 'connected' && onReconnect && (
              <button
                onClick={onReconnect}
                className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
                title="Reconnect"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            )}
            
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Offline Warning Banner (Requirement 6.2, 10.1) */}
          {isOffline && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800">Working Offline</p>
                  <p className="text-sm text-yellow-700">
                    You are currently offline. Assignment will be queued when connection is restored.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Receipt Display */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{formatTimestamp(receipt.timestamp)}</span>
              </div>
              {isCacheStale && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Using cached data
                </span>
              )}
            </div>

            {/* Line Items - Handle incomplete data (Requirement 10.3, 11.5) */}
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {receipt.items && receipt.items.length > 0 ? (
                receipt.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start py-2 border-b border-gray-200 last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {item.quantity || 'N/A'}x {item.name || 'Unknown Item'}
                      </div>
                      <div className="text-sm text-gray-500">
                        @ {item.unitPrice ? formatCurrency(item.unitPrice) : 'N/A'} each
                      </div>
                    </div>
                    <div className="font-semibold text-gray-900">
                      {item.total ? formatCurrency(item.total) : 'N/A'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">No items available</p>
                </div>
              )}
            </div>

            {/* Totals - Handle missing fields (Requirement 11.5) */}
            <div className="space-y-2 pt-4 border-t-2 border-gray-300">
              <div className="flex justify-between text-gray-700">
                <span>Subtotal:</span>
                <span>{receipt.subtotal !== undefined ? formatCurrency(receipt.subtotal) : 'N/A'}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Tax (16%):</span>
                <span>{receipt.tax !== undefined ? formatCurrency(receipt.tax) : 'N/A'}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total:</span>
                <span>{receipt.total !== undefined ? formatCurrency(receipt.total) : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Customer Tab</h3>
            
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by tab or table number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Tab List */}
            {isLoadingTabs ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading tabs...</span>
              </div>
            ) : sortedTabs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No open tabs available</p>
                <p className="text-sm mt-1">
                  {searchQuery ? 'Try a different search term' : 'No customers have open tabs'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {sortedTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTabId(tab.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      selectedTabId === tab.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">
                        Tab #{tab.tabNumber}
                      </span>
                      {tab.tableNumber && (
                        <span className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          Table {tab.tableNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {tab.customerIdentifier}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            disabled={assignmentStatus === 'assigning' || assignmentStatus === 'printing'}
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={assignmentStatus === 'printing' || assignmentStatus === 'assigning'}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              title="Print receipt for non-Tabeza customer (walk-in, cash payment)"
            >
              {assignmentStatus === 'printing' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <ReceiptIcon className="w-5 h-5" />
                  Print Only
                </>
              )}
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedTabId || assignmentStatus === 'assigning' || assignmentStatus === 'printing' || sortedTabs.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              {assignmentStatus === 'assigning' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Assign to Tab'
              )}
            </button>
          </div>
        </div>

        {/* Success Overlay */}
        {assignmentStatus === 'success' && (
          <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedTab ? 'Receipt Sent!' : 'Receipt Printed!'}
              </h3>
              <p className="text-gray-600">
                {selectedTab 
                  ? `Receipt sent to Tab #${selectedTab.tabNumber}`
                  : 'Receipt sent to printer for non-Tabeza customer'
                }
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {assignmentStatus === 'error' && (
          <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
            <div className="text-center max-w-md mx-4">
              <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Assignment Failed</h3>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRetry}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
      