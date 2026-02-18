import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Template Generation Step - Staff onboarding UI
// Captures test receipts from POS and generates parsing templates

export default function TemplateGenerationStep({ barId, onComplete }) {
  const [receipts, setReceipts] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [template, setTemplate] = useState(null);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Listen for test receipts in real-time
  useEffect(() => {
    const subscription = supabase
      .from('raw_pos_receipts')
      .on('INSERT', (payload) => {
        if (payload.new.bar_id === barId) {
          setReceipts(prev => [...prev, payload.new]);
        }
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, [barId]);

  // Generate template from captured receipts
  async function generateTemplate() {
    if (receipts.length < 3) {
      alert('Please print at least 3 test receipts first');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/receipts/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          test_receipts: receipts.map(r => r.raw_text)
        })
      });

      const result = await response.json();
      if (result.success) {
        setTemplate(result.template);
        onComplete(result.template);
      }
    } catch (error) {
      alert('Failed to generate template: ' + error.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="template-generation">
      <h2>🧠 Generate Receipt Template</h2>
      
      <div className="instructions">
        <h3>Step 1: Print Test Receipts</h3>
        <p>Print 5-10 test receipts from your POS system with different items:</p>
        <ul>
          <li>Single items</li>
          <li>Multiple items</li>
          <li>Different quantities</li>
          <li>Various totals</li>
        </ul>
      </div>

      <div className="capture-status">
        <h3>Step 2: Capture Status</h3>
        <div className="progress">
          <div className="count">
            Captured: {receipts.length} / 5 minimum
          </div>
          {receipts.length >= 5 && (
            <div className="ready">✅ Ready to generate template</div>
          )}
        </div>
      </div>

      <div className="receipts-list">
        <h3>Recent Captures</h3>
        {receipts.slice(-3).map((receipt, i) => (
          <div key={receipt.id} className="receipt-preview">
            <div className="time">
              {new Date(receipt.captured_at).toLocaleTimeString()}
            </div>
            <div className="preview">
              {receipt.raw_text.slice(0, 100)}...
            </div>
          </div>
        ))}
      </div>

      <div className="actions">
        <button
          onClick={generateTemplate}
          disabled={receipts.length < 3 || generating}
          className="generate-btn"
        >
          {generating ? '🧠 Generating...' : '🚀 Generate Template'}
        </button>
      </div>

      {template && (
        <div className="template-result">
          <h3>✅ Template Generated!</h3>
          <div className="template-info">
            <p>Version: {template.version}</p>
            <p>Confidence: {(template.confidence_threshold * 100).toFixed(0)}%</p>
            <p>Patterns: {Object.keys(template.patterns).length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
