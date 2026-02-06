/**
 * Customer Selection Modal
 * Shows connected customers with active tabs for digital receipt delivery
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

'use client';

import { useState, useMemo } from 'react';
import { X, Search, Users, CheckCircle2, Circle, Smartphone, Clock } from 'lucide-react';

export interface ConnectedCustomer {
  id: string;
  tabId: string;
  tabNumber: number;
  customerIdentifier: string;
  connectionStatus: 'connected' | 'idle' | 'disconnected';
  deviceInfo: {
    type: 'mobile' | 'desktop';
    lastSeen: Date;
  };
  ownerIdentifier?: string;
}

export interface CustomerSelectionModalProps {
  isOpen: boolean;
  customers: ConnectedCustomer[];
  receiptTotal: number;
  onConfirm: (selectedCustomerIds: string[]) => void;
  onCancel: () => void;
  onFallbackToPhysical: () => void;
}

export function CustomerSelectionModal({
  isOpen,
  customers,
  receiptTotal,
  onConfirm,
  onCancel,
  onFallbackToPhysical
}: CustomerSelectionModalProps) {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    
    const query = searchQuery.toLowerCase();
    return customers.filter(customer => 
      customer.tabNumber.toString().includes(query) ||
      customer.customerIdentifier.toLowerCase().includes(query) ||
      customer.ownerIdentifier?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    if (selectedCustomerIds.size === 0) return;
    onConfirm(Array.from(selectedCustomerIds));
  };

  const getStatusColor = (status: ConnectedCustomer['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: ConnectedCustomer['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return 'Active';
      case 'idle':
        return 'Idle';
      case 'disconnected':
        return 'Offline';
    }
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  if (!isOpen) return null;

  // No customers available
  if (customers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
          <div className="bg-yellow-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6" />
              <h2 className="text-xl font-bold">No Connected Customers</h2>
            </div>
            <button
              onClick={onCancel}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Customers Connected
              </h3>
              <p className="text-gray-600 mb-6">
                There are no customers currently connected with active tabs. 
                Would you like to print a physical receipt instead?
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onFallbackToPhysical}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Print Physical Receipt
                </button>
                <button
                  onClick={onCancel}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Select Customer</h2>
              <p className="text-sm text-green-100">
                Choose customer(s) to receive digital receipt
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tab number or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No customers match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomerIds.has(customer.id);
                
                return (
                  <button
                    key={customer.id}
                    onClick={() => toggleCustomer(customer.id)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                      ${isSelected 
                        ? 'border-green-500 bg-green-50 shadow-md' 
                        : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm'
                      }
                    `}
                  >
                    {/* Selection Indicator */}
                    <div className="absolute top-3 right-3">
                      {isSelected ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </div>

                    {/* Customer Info */}
                    <div className="pr-8">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl font-bold text-gray-900">
                          Tab #{customer.tabNumber}
                        </span>
                        <span className={`
                          w-2 h-2 rounded-full ${getStatusColor(customer.connectionStatus)}
                        `} />
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Smartphone className="w-4 h-4" />
                          <span>{customer.customerIdentifier}</span>
                        </div>
                        
                        {customer.ownerIdentifier && (
                          <div className="text-gray-500">
                            {customer.ownerIdentifier}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>{formatLastSeen(customer.deviceInfo.lastSeen)}</span>
                          <span className="text-xs">
                            ({getStatusText(customer.connectionStatus)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {selectedCustomerIds.size === 0 ? (
                'Select at least one customer'
              ) : (
                <>
                  <span className="font-semibold text-gray-900">
                    {selectedCustomerIds.size}
                  </span>
                  {' '}customer{selectedCustomerIds.size !== 1 ? 's' : ''} selected
                </>
              )}
            </div>
            <div className="text-lg font-bold text-gray-900">
              Total: KES {receiptTotal.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={selectedCustomerIds.size === 0}
              className={`
                flex-1 py-3 rounded-lg font-medium transition-colors
                ${selectedCustomerIds.size === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }
              `}
            >
              Send Digital Receipt{selectedCustomerIds.size > 1 ? 's' : ''}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>

          <button
            onClick={onFallbackToPhysical}
            className="w-full mt-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Print Physical Receipt Instead
          </button>
        </div>
      </div>
    </div>
  );
}
