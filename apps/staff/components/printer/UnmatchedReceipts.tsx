'use client';

/**
 * Unmatched Receipts Component
 * 
 * Shows receipts from POS that need to be assigned to customer tabs
 * Staff manually selects which tab to deliver each receipt to
 * 
 * CORE TRUTH: Staff knows which customer ordered what - 100% accurate
 */

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

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
}

interface UnmatchedReceiptsProps {
  barId: string;
}

export default function UnmatchedReceipts({ barId }: UnmatchedReceiptsProps) {
  const [unmatchedReceipts, setUnmatchedReceipts] = useState<PrintJob[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<PrintJob | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch unmatched receipts and open tabs
  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
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
        () => {
          fetchData();
        }
      )
      .subscribe();

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
      setUnmatchedReceipts(data.unmatchedReceipts);
      setOpenTabs(data.openTabs);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }

  async function assignReceipt() {
    if (!selectedReceipt || !selectedTab) return;

    try {
      setAssigning(true);
      setError(null);

      const response = await fetch('/api/printer/assign-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printJobId: selectedReceipt.id,
          tabId: selectedTab,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign receipt');
      }

      // Success - refresh data and close modal
      await fetchData();
      setSelectedReceipt(null);
      setSelectedTab('');
    } catch (err) {
      console.error('Failed to assign receipt:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign receipt');
    } finally {
      setAssigning(false);
    }
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

  if (unmatchedReceipts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📄 Unmatched Receipts</h2>
        <p className="text-gray-500 text-center py-8">
          No unmatched receipts. All receipts have been delivered to customers.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">📄 Unmatched Receipts</h2>
          <span className="bg-orange-100 text-orange-800 text-sm font-medium px-3 py-1 rounded-full">
            {unmatchedReceipts.length} waiting
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {unmatchedReceipts.map((receipt) => (
            <div
              key={receipt.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => setSelectedReceipt(receipt)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-2">
                    KES {receipt.parsed_data.total.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {receipt.parsed_data.items.slice(0, 3).map((item, i) => (
                      <span key={i}>
                        {item.name}
                        {i < Math.min(2, receipt.parsed_data.items.length - 1) ? ', ' : ''}
                      </span>
                    ))}
                    {receipt.parsed_data.items.length > 3 && (
                      <span> +{receipt.parsed_data.items.length - 3} more</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(receipt.received_at).toLocaleString()}
                  </div>
                </div>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedReceipt(receipt);
                  }}
                >
                  Select Tab
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Selection Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">
                Select Tab for Receipt
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="font-semibold text-lg mb-2">
                  KES {selectedReceipt.parsed_data.total.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  {selectedReceipt.parsed_data.items.map((item, i) => (
                    <div key={i}>
                      {item.name} - KES {item.price.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>

              {openTabs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No open tabs available
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {openTabs.map((tab) => (
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
                        <div className="font-medium">Tab #{tab.tab_number}</div>
                        <div className="text-sm text-gray-500">
                          Opened {new Date(tab.opened_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedReceipt(null);
                    setSelectedTab('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  onClick={assignReceipt}
                  disabled={!selectedTab || assigning}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {assigning ? 'Delivering...' : 'Deliver Receipt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
