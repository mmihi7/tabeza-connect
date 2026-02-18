import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Customer Receipt View - Customer app
// Shows receipts assigned to customer's tab in real-time

export default function CustomerReceipts({ tabId, customerId }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Load assigned receipts and listen for updates
  useEffect(() => {
    loadReceipts();
    
    // Real-time updates for new receipts
    const subscription = supabase
      .from('pos_receipts')
      .on('UPDATE', (payload) => {
        if (payload.new.claimed_by_tab_id === tabId && payload.new.status === 'CLAIMED') {
          setReceipts(prev => [payload.new, ...prev]);
        }
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [tabId]);

  async function loadReceipts() {
    const { data } = await supabase
      .from('pos_receipts')
      .select('*')
      .eq('claimed_by_tab_id', tabId)
      .eq('status', 'CLAIMED')
      .order('claimed_at', { ascending: false });
    
    if (data) {
      setReceipts(data);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="receipts-loading">
        <div className="spinner"></div>
        <p>Loading your receipts...</p>
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="no-receipts">
        <div className="icon">🧾</div>
        <h3>No receipts yet</h3>
        <p>Ask staff to assign your physical receipt to this tab</p>
      </div>
    );
  }

  return (
    <div className="customer-receipts">
      <h2>🧾 Your Receipts</h2>
      
      <div className="receipts-list">
        {receipts.map(receipt => (
          <div key={receipt.id} className="receipt-card">
            <div className="receipt-header">
              <div className="time">
                {new Date(receipt.claimed_at).toLocaleTimeString()}
              </div>
              <div className="total">
                KES {receipt.total?.toFixed(2)}
              </div>
            </div>
            
            <div className="receipt-items">
              {receipt.items?.map((item, i) => (
                <div key={i} className="item">
                  <div className="item-details">
                    <span className="quantity">{item.quantity}x</span>
                    <span className="name">{item.name}</span>
                  </div>
                  <div className="item-price">
                    KES {item.line_total?.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="receipt-footer">
              <div className="method">
                {receipt.parsing_method === 'regex' ? '🤖 Auto-parsed' : '🧠 AI-parsed'}
              </div>
              <div className="confidence">
                {(receipt.confidence_score * 100).toFixed(0)}% confidence
              </div>
            </div>
            
            <div className="receipt-actions">
              <button className="pay-btn">
                💳 Pay KES {receipt.total?.toFixed(2)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
