'use client';

/**
 * Captain's Orders Component
 * 
 * Shows orders from POS that need to be assigned to customer tabs
 * The captain (staff) manually selects which tab to deliver each order to
 * 
 * CORE TRUTH: The captain knows which customer ordered what - 100% accurate
 * Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PrintJob {
  id: string;
  bar_id: string;
  parsed_data: {
    items: Array<{ name: string; price: number }>;
    total: number;
    rawText: string;
  };
  received_at: string;
}

interface Tab {
  id: string;
  tab_number: number;
  opened_at: string;
  notes: string | null;
}

interface CaptainsOrdersProps {
  barId: string;
}

export default function CaptainsOrders({ barId }: CaptainsOrdersProps) {
  const [captainsOrders, setCaptainsOrders] = useState<PrintJob[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PrintJob | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Fetch captain's orders and open tabs
  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates for both INSERT and UPDATE events
    const subscription = supabase
      .channel('print_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'print_jobs',
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          console.log('🔔 Real-time INSERT event received:', payload);
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'print_jobs',
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          console.log('🔔 Real-time UPDATE event received:', payload);
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [barId]);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await fetch(`/api/printer/assign-receipt?barId=${barId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      setCaptainsOrders(data.unmatchedReceipts);
      setOpenTabs(data.openTabs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch captain\'s orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function assignOrder() {
    if (!selectedOrder || !selectedTab) return;

    try {
      setAssigning(true);
      setError(null);

      const response = await fetch('/api/printer/assign-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printJobId: selectedOrder.id,
          tabId: selectedTab,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Assignment failed:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to assign order');
      }

      // Success - refresh data and close modal
      await fetchData();
      setSelectedOrder(null);
      setSelectedTab('');
    } catch (err) {
      console.error('Failed to assign order:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign order');
    } finally {
      setAssigning(false);
    }
  }

  async function deleteOrder(orderId: string) {
    try {
      setDeleting(orderId);
      setError(null);

      const response = await fetch('/api/printer/delete-receipt', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printJobId: orderId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete receipt');
      }

      // Success - refresh data
      await fetchData();
    } catch (err) {
      console.error('Failed to delete receipt:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete receipt');
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAllOrders() {
    const count = captainsOrders.length;
    
    if (!confirm(`Delete all ${count} receipt${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingAll(true);
      setError(null);

      // Delete all receipts in parallel
      const deletePromises = captainsOrders.map(order =>
        fetch('/api/printer/delete-receipt', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printJobId: order.id }),
        })
      );

      const results = await Promise.allSettled(deletePromises);
      
      // Check for failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} receipt(s)`);
      }

      // Success - refresh data
      await fetchData();
    } catch (err) {
      console.error('Failed to delete all receipts:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete all receipts');
    } finally {
      setDeletingAll(false);
    }
  }

  // Extract items from order (reusable function)
  function extractItemsFromOrder(order: PrintJob): string[] {
    let itemsList: string[] = [];
    
    // First, try to use parsed items if they exist and are valid
    if (order.parsed_data?.items && Array.isArray(order.parsed_data.items)) {
      const validItems = order.parsed_data.items.filter(item => 
        item.name && 
        !item.name.toLowerCase().includes('table no') &&
        !item.name.toLowerCase().includes('captain') &&
        !item.name.toLowerCase().includes('date') &&
        !item.name.toLowerCase().includes('time')
      );
      
      if (validItems.length > 0) {
        itemsList = validItems.map(item => {
          if (item.name.match(/^\d+x?\s/)) {
            return item.name;
          }
          return `1x ${item.name}`;
        });
      }
    }
    
    // If no valid parsed items, try extracting from rawText
    if (itemsList.length === 0 && order.parsed_data?.rawText) {
      const lines = order.parsed_data.rawText.split('\n');
      let inItemsSection = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.includes('QTY') && trimmed.includes('ITEM')) {
          inItemsSection = true;
          continue;
        }
        
        if (inItemsSection && (trimmed.startsWith('---') || trimmed.includes('Special Instructions'))) {
          break;
        }
        
        if (inItemsSection && trimmed.length > 0 && !trimmed.startsWith('-')) {
          const match = trimmed.match(/^(\d+)\s+(.+)$/);
          if (match) {
            itemsList.push(`${match[1]}x ${match[2]}`);
          }
        }
      }
    }
    
    return itemsList;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (captainsOrders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">⚓ Captain's Orders</h2>
        <p className="text-gray-500 text-center py-8">
          No pending orders. All orders have been assigned to tabs.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">⚓ Captain's Orders</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={deleteAllOrders}
              disabled={deletingAll || captainsOrders.length === 0}
              className="text-xs text-red-600 hover:text-red-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              title="Delete all receipts"
            >
              {deletingAll ? 'Deleting...' : 'Delete All'}
            </button>
            <span className="bg-orange-100 text-orange-800 text-sm font-medium px-3 py-1 rounded-full">
              {captainsOrders.length} waiting
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {captainsOrders.map((order) => {
            // Debug: log the order data to see what we're getting
            console.log('Order data:', order);
            console.log('Parsed items:', order.parsed_data?.items);
            console.log('Raw text preview:', order.parsed_data?.rawText?.substring(0, 200));
            
            // Extract items using reusable function
            const itemsList = extractItemsFromOrder(order);
            
            // Format items text for display
            const itemsText = itemsList.length > 0
              ? itemsList.slice(0, 2).join(', ') + (itemsList.length > 2 ? `, +${itemsList.length - 2} more` : '')
              : 'Order from POS';
            
            return (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Order Details (Items) - Primary heading */}
                    <div className="font-semibold text-base mb-2 text-gray-900 line-clamp-2">
                      {itemsText}
                    </div>
                    
                    {/* Total Amount */}
                    <div className="text-lg font-bold text-gray-900 mb-1">
                      Total: KES {order.parsed_data?.total?.toFixed(2) || '0.00'}
                    </div>
                    
                    {/* Time */}
                    <div className="text-xs text-gray-500">
                      {new Date(order.received_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this receipt? This action cannot be undone.')) {
                          deleteOrder(order.id);
                        }
                      }}
                      disabled={deleting === order.id}
                      title="Delete receipt (for non-Tabeza customers)"
                    >
                      {deleting === order.id ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                    >
                      Assign Tab
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Selection Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                Assign Order to Tab
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="font-semibold text-lg mb-3 text-gray-900">
                  Total: KES {selectedOrder.parsed_data.total.toFixed(2)}
                </div>
                
                {/* Display extracted items with prices */}
                <div className="text-sm space-y-2">
                  <div className="font-medium text-gray-700 mb-2">Order Items:</div>
                  {(() => {
                    // Extract items with prices from parsed data
                    if (selectedOrder.parsed_data?.items && Array.isArray(selectedOrder.parsed_data.items)) {
                      const validItems = selectedOrder.parsed_data.items.filter(item => 
                        item.name && 
                        !item.name.toLowerCase().includes('table no') &&
                        !item.name.toLowerCase().includes('captain') &&
                        !item.name.toLowerCase().includes('date') &&
                        !item.name.toLowerCase().includes('time')
                      );
                      
                      if (validItems.length > 0) {
                        return validItems.map((item, i) => {
                          // Extract quantity from name if present
                          const qtyMatch = item.name.match(/^(\d+)x?\s+(.+)$/);
                          const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
                          const itemName = qtyMatch ? qtyMatch[2] : item.name;
                          const price = item.price || 0;
                          const totalPrice = qty * price;
                          
                          return (
                            <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                              <div className="flex-1">
                                <span className="text-gray-700">• {qty}x {itemName}</span>
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-gray-900 font-medium">
                                  KES {totalPrice.toFixed(2)}
                                </div>
                                {qty > 1 && (
                                  <div className="text-xs text-gray-500">
                                    @ {price.toFixed(2)} each
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      }
                    }
                    
                    // Fallback: try extracting from rawText
                    if (selectedOrder.parsed_data?.rawText) {
                      const lines = selectedOrder.parsed_data.rawText.split('\n');
                      let inItemsSection = false;
                      const items: Array<{ qty: number; name: string; price: number }> = [];
                      
                      for (const line of lines) {
                        const trimmed = line.trim();
                        
                        if (trimmed.includes('QTY') && trimmed.includes('ITEM')) {
                          inItemsSection = true;
                          continue;
                        }
                        
                        if (inItemsSection && (trimmed.startsWith('---') || trimmed.includes('Special Instructions') || trimmed.includes('Subtotal'))) {
                          break;
                        }
                        
                        if (inItemsSection && trimmed.length > 0 && !trimmed.startsWith('-')) {
                          // Try to parse: "2    Tusker Lager 500ml    500.00"
                          const match = trimmed.match(/^(\d+)\s+(.+?)\s+(\d+\.?\d*)$/);
                          if (match) {
                            items.push({
                              qty: parseInt(match[1]),
                              name: match[2].trim(),
                              price: parseFloat(match[3])
                            });
                          }
                        }
                      }
                      
                      if (items.length > 0) {
                        return items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                            <div className="flex-1">
                              <span className="text-gray-700">• {item.qty}x {item.name}</span>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-gray-900 font-medium">
                                KES {item.price.toFixed(2)}
                              </div>
                              {item.qty > 1 && (
                                <div className="text-xs text-gray-500">
                                  @ {(item.price / item.qty).toFixed(2)} each
                                </div>
                              )}
                            </div>
                          </div>
                        ));
                      }
                    }
                    
                    // No items found
                    return (
                      <div className="text-gray-500 italic">
                        Order from POS (items not parsed)
                      </div>
                    );
                  })()}
                </div>
              </div>

              {openTabs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No open tabs available
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {openTabs.map((tab) => {
                    console.log('Tab data:', tab); // Debug: log each tab
                    
                    // Extract display name from notes
                    let displayName = `Tab #${tab.tab_number}`;
                    try {
                      if (tab.notes) {
                        const notes = typeof tab.notes === 'string' ? JSON.parse(tab.notes) : tab.notes;
                        if (notes.display_name && notes.has_nickname) {
                          displayName = notes.display_name;
                        }
                      }
                    } catch (e) {
                      // If parsing fails, use default
                      console.warn('Failed to parse tab notes:', e);
                    }
                    
                    return (
                      <label
                        key={tab.id}
                        className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedTab === tab.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tab"
                          value={tab.id}
                          checked={selectedTab === tab.id}
                          onChange={(e) => setSelectedTab(e.target.value)}
                          className="mr-3"
                        />
                        <div>
                          <div className="font-medium">{displayName}</div>
                          <div className="text-sm text-gray-500">
                            Tab #{tab.tab_number} • Opened {new Date(tab.opened_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setSelectedTab('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedOrder) return;
                    try {
                      setAssigning(true);
                      setError(null);
                      
                      // Call print endpoint
                      const response = await fetch(`/api/receipts/${selectedOrder.id}/print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      
                      if (!response.ok) {
                        throw new Error('Failed to print receipt');
                      }
                      
                      // Success - refresh and close
                      await fetchData();
                      setSelectedOrder(null);
                      setSelectedTab('');
                    } catch (err) {
                      console.error('Failed to print:', err);
                      setError('Failed to print receipt');
                    } finally {
                      setAssigning(false);
                    }
                  }}
                  disabled={assigning}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title="Print receipt for non-Tabeza customer"
                >
                  {assigning ? 'Printing...' : 'Print Only'}
                </button>
                <button
                  onClick={assignOrder}
                  disabled={!selectedTab || assigning}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {assigning ? 'Assigning...' : 'Assign to Tab'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
