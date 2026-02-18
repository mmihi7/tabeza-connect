import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Receipt assignment API - assign unclaimed receipts to customer tabs
// Critical for staff workflow: capture → parse → assign → customer sees

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { receipt_id, tab_id, staff_id } = req.body;

    if (!receipt_id || !tab_id || !staff_id) {
      return res.status(400).json({ 
        error: 'receipt_id, tab_id, and staff_id are required' 
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`📋 Assigning receipt ${receipt_id} to tab ${tab_id}`);

    // 1. Validate tab exists and is open
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('*')
      .eq('id', tab_id)
      .eq('status', 'OPEN')
      .single();

    if (tabError || !tab) {
      return res.status(400).json({ 
        error: 'Tab not found or is not open' 
      });
    }

    // 2. Validate receipt is unclaimed
    const { data: receipt, error: receiptError } = await supabase
      .from('pos_receipts')
      .select('*')
      .eq('id', receipt_id)
      .eq('status', 'UNCLAIMED')
      .single();

    if (receiptError || !receipt) {
      return res.status(400).json({ 
        error: 'Receipt not found or already assigned' 
      });
    }

    // 3. Atomic assignment with double-check
    const { data: updatedReceipt, error: updateError } = await supabase
      .from('pos_receipts')
      .update({
        status: 'CLAIMED',
        claimed_by_tab_id: tab_id,
        claimed_at: new Date().toISOString(),
        assigned_by_staff_id: staff_id
      })
      .eq('id', receipt_id)
      .eq('status', 'UNCLAIMED') // Double-check still unclaimed
      .select()
      .single();

    if (updateError) {
      // Check if it was a race condition (already assigned)
      if (updateError.code === 'PGRST116') {
        return res.status(409).json({ 
          error: 'Receipt was already assigned by another staff member' 
        });
      }
      
      console.error('Failed to assign receipt:', updateError);
      return res.status(500).json({ 
        error: 'Failed to assign receipt' 
      });
    }

    // 4. Log assignment for audit trail
    await supabase
      .from('audit_logs')
      .insert({
        action: 'receipt_assigned',
        bar_id: receipt.bar_id,
        staff_id,
        metadata: { 
          receipt_id, 
          tab_id,
          tab_number: tab.tab_number,
          customer_name: tab.customer_name 
        }
      });

    console.log(`✅ Receipt assigned: tab=${tab.tab_number}, customer=${tab.customer_name}`);

    // 5. Trigger real-time update for customer app
    // This will automatically notify customers via Supabase Realtime
    console.log(`🔄 Real-time update triggered for tab ${tab_id}`);

    return res.status(200).json({
      success: true,
      receipt: {
        id: updatedReceipt.id,
        status: updatedReceipt.status,
        total: updatedReceipt.total,
        currency: updatedReceipt.currency,
        claimed_by_tab_id: updatedReceipt.claimed_by_tab_id,
        claimed_at: updatedReceipt.claimed_at,
        assigned_by_staff_id: updatedReceipt.assigned_by_staff_id,
        items: updatedReceipt.items || []
      },
      tab: {
        id: tab.id,
        tab_number: tab.tab_number,
        customer_name: tab.customer_name,
        status: tab.status
      }
    });

  } catch (error) {
    console.error('Receipt assignment error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
