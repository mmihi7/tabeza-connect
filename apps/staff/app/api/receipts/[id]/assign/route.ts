/**
 * Receipt Assignment API Endpoint
 * POST /api/receipts/[id]/assign
 * 
 * Assigns an unmatched POS receipt to a customer tab and creates an order.
 * 
 * Task 4: Assignment Flow Implementation
 * Requirements: 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface AssignReceiptRequest {
  tabId: string;
}

interface ReceiptData {
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
}

/**
 * POST /api/receipts/[id]/assign
 * 
 * Assigns an unmatched receipt to a customer tab
 * 
 * Request body:
 * {
 *   "tabId": "uuid"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Receipt sent to Tab #1",
 *   "orderId": "uuid",
 *   "receiptId": "uuid"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;
    const body: AssignReceiptRequest = await request.json();
    const { tabId } = body;

    // Validate input (Requirement 4.2)
    if (!tabId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required field: tabId' 
        },
        { status: 400 }
      );
    }

    if (!receiptId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing receipt ID' 
        },
        { status: 400 }
      );
    }

    // Fetch receipt from database (Requirement 4.3)
    const { data: receipt, error: receiptError } = await supabase
      .from('unmatched_receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      console.error('[AssignReceipt] Receipt not found:', receiptError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Receipt not found' 
        },
        { status: 404 }
      );
    }

    // Validate receipt is unassigned (Requirement 4.3)
    if (receipt.status !== 'pending') {
      return NextResponse.json(
        { 
          success: false,
          error: `Receipt has already been ${receipt.status}` 
        },
        { status: 400 }
      );
    }

    // Fetch tab from database (Requirement 4.3)
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('id, tab_number, bar_id, status, owner_identifier')
      .eq('id', tabId)
      .single();

    if (tabError || !tab) {
      console.error('[AssignReceipt] Tab not found:', tabError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Tab not found' 
        },
        { status: 404 }
      );
    }

    // Validate tab is open (Requirement 4.3)
    if (tab.status !== 'open') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Tab is not open. Please select an open tab.' 
        },
        { status: 400 }
      );
    }

    // Validate tab belongs to same venue as receipt (Requirement 12.2)
    if (tab.bar_id !== receipt.bar_id) {
      console.error('[AssignReceipt] Venue mismatch:', {
        tabBarId: tab.bar_id,
        receiptBarId: receipt.bar_id
      });
      return NextResponse.json(
        { 
          success: false,
          error: 'Tab and receipt are from different venues' 
        },
        { status: 400 }
      );
    }

    // Parse receipt data
    const receiptData = receipt.receipt_data as ReceiptData;
    
    // Validate receipt data completeness (Requirement 10.3)
    if (!receiptData || !receiptData.items || receiptData.items.length === 0) {
      console.error('[AssignReceipt] Incomplete receipt data:', receiptData);
      return NextResponse.json(
        { 
          success: false,
          error: 'Receipt data is incomplete or invalid' 
        },
        { status: 400 }
      );
    }

    // Create order in tab_orders table (Requirement 4.3)
    const { data: order, error: orderError } = await supabase
      .from('tab_orders')
      .insert({
        tab_id: tabId,
        items: receiptData.items,
        total: receiptData.total,
        status: 'confirmed', // POS receipts are pre-confirmed
        initiated_by: 'staff', // Receipt assignment is staff-initiated
        confirmed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('[AssignReceipt] Failed to create order:', orderError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create order from receipt' 
        },
        { status: 500 }
      );
    }

    // Update receipt status to assigned (Requirement 4.3)
    const { error: updateError } = await supabase
      .from('unmatched_receipts')
      .update({
        status: 'assigned',
        assigned_to_tab_id: tabId,
        assigned_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('[AssignReceipt] Failed to update receipt status:', updateError);
      // Don't fail the request - order was created successfully
    }

    // TODO: Send push notification to customer (Requirement 4.3)
    // This will be implemented in a future task
    // For now, the customer will see the order in their tab when they refresh

    console.log('[AssignReceipt] Success:', {
      receiptId,
      tabId,
      tabNumber: tab.tab_number,
      orderId: order.id,
      total: receiptData.total
    });

    // Return success response (Requirement 4.3, 7.1)
    return NextResponse.json({
      success: true,
      message: `Receipt sent to Tab #${tab.tab_number}`,
      orderId: order.id,
      receiptId: receiptId,
      tabNumber: tab.tab_number
    });

  } catch (error) {
    console.error('[AssignReceipt] Unexpected error:', error);
    
    // Return user-friendly error message (Requirement 10.4)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.' 
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/receipts/[id]/assign
 * 
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
