import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Receipt Assignment Component - Staff dashboard
// Shows unclaimed receipts and allows assignment to customer tabs

export default function ReceiptAssignment({ barId, staffId }) {
  const [unclaimedReceipts, setUnclaimedReceipts] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedTab, setSelectedTab] = useState(null);
  const [assigning, setAssigning] = useState(false);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Load unclaimed receipts and open tabs
  useEffect(() => {
    loadUnclaimedReceipts();
    loadOpenTabs();
    
    // Real-time updates
    const receiptsSub = supabase
      .from('pos_receipts')
      .on('INSERT', (payload) => {
        if (payload.new.bar_id === barId && payload.new.status === 'UNCLAIMED') {
          setUnclaimedReceipts(prev => [payload.new, ...prev]);
        }
      })
      .on('UPDATE', (payload) => {
        if (payload.new.status === 'CLAIMED') {
          setUnclaimedReceipts(prev => prev.filter(r => r.id !== payload.new.id));
        }
      })
      .subscribe();
      
    const tabsSub = supabase
      .from('tabs')
      .on('UPDATE', (payload) => {
        if (payload.new.status !== 'OPEN') {
          setOpenTabs(prev => prev.filter(t => t.id !== payload.new.id));
        }
      })
      .subscribe();
    
    return () => {
      receiptsSub.unsubscribe();
      tabsSub.unsubscribe();
    };
  }, [barId]);

  async function loadUnclaimedReceipts() {
    const { data } = await supabase
      .from('pos_receipts')
      .select('*')
      .eq('bar_id', barId)
      .eq('status', 'UNCLAIMED')
      .order('created_at', { ascending: false });
    
    if (data) setUnclaimedReceipts(data);
  }

  async function loadOpenTabs() {
    const { data } = await supabase
      .from('tabs')
      .select('*')
      .eq('bar_id', barId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });
    
    if (data) setOpenTabs(data);
  }

  async function assignReceipt() {
    if (!selectedReceipt || !selectedTab) return;
    
    setAssigning(true);
    try {
      const response = await fetch('/api/receipts/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_id: selectedReceipt.id,
          tab_id: selectedTab.id,
          staff_id: staffId
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSelectedReceipt(null);
        setSelectedTab(null);
      } else {
        alert('Failed to assign: ' + result.error);
      }
    } catch (error) {
      alert('Error assigning receipt: ' + error.message);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="receipt-assignment">
      <h2>📋 Receipt Assignment</h2>
      
      <div className="assignment-grid">
        {/* Unclaimed Receipts */}
        <div className="receipts-panel">
          <h3>Unclaimed Receipts ({unclaimedReceipts.length})</h3>
          <div className="receipts-list">
            {unclaimedReceipts.slice(0, 10).map(receipt => (
              <div 
                key={receipt.id}
                className={`receipt-item ${selectedReceipt?.id === receipt.id ? 'selected' : ''}`}
                onClick={() => setSelectedReceipt(receipt)}
              >
                <div className="receipt-header">
                  <span className="time">
                    {new Date(receipt.created_at).toLocaleTimeString()}
                  </span>
                  <span className="total">
                    KES {receipt.total?.toFixed(2)}
                  </span>
                </div>
                <div className="receipt-preview">
                  {receipt.items?.slice(0, 3).map((item, i) => (
                    <div key={i} className="item-line">
                      {item.quantity}x {item.name}
                    </div>
                  ))}
                  {receipt.items?.length > 3 && (
                    <div className="more-items">+{receipt.items.length - 3} more</div>
                  )}
                </div>
                <div className="receipt-method">
                  {receipt.parsing_method} • {(receipt.confidence_score * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Open Tabs */}
        <div className="tabs-panel">
          <h3>Open Tabs ({openTabs.length})</h3>
          <div className="tabs-list">
            {openTabs.map(tab => (
              <div 
                key={tab.id}
                className={`tab-item ${selectedTab?.id === tab.id ? 'selected' : ''}`}
                onClick={() => setSelectedTab(tab)}
              >
                <div className="tab-header">
                  <span className="tab-number">Tab #{tab.tab_number}</span>
                  <span className="customer">{tab.customer_name}</span>
                </div>
                <div className="tab-details">
                  <div className="time">
                    {new Date(tab.created_at).toLocaleTimeString()}
                  </div>
                  <div className="status">OPEN</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assignment Action */}
      <div className="assignment-action">
        {selectedReceipt && selectedTab && (
          <div className="assignment-preview">
            <h4>Assign Receipt to Tab #{selectedTab.tab_number}</h4>
            <div className="assignment-details">
              <div>
                <strong>Receipt:</strong> KES {selectedReceipt.total?.toFixed(2)}
                <span className="method"> ({selectedReceipt.parsing_method})</span>
              </div>
              <div>
                <strong>Tab:</strong> {selectedTab.customer_name} • Tab #{selectedTab.tab_number}
              </div>
            </div>
            <button 
              onClick={assignReceipt}
              disabled={assigning}
              className="assign-btn"
            >
              {assigning ? 'Assigning...' : '✅ Assign Receipt'}
            </button>
          </div>
        )}
        
        {!selectedReceipt && (
          <div className="instruction">
            Select a receipt from the left panel
          </div>
        )}
        
        {!selectedTab && selectedReceipt && (
          <div className="instruction">
            Select a tab from the right panel
          </div>
        )}
      </div>
    </div>
  );
}
