/**
 * Assign Receipt to Tab API
 * 
 * Allows staff to manually assign an unmatched receipt to a customer tab
 * CORE TRUTH: Staff knows which customer ordered what - 100% accurate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

interface AssignReceiptRequest {
  printJobId: string;
  tabId: string;
}

/**
 * OPTIONS /api/printer/assign-receipt
 * 
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * POST /api/printer/assign-receipt
 * 
 * Assigns an unmatched receipt to a customer tab
 */
export async function POST(request: NextRequest) {
  try {
    const { printJobId, tabId }: AssignReceiptRequest = await request.json();

    // Validate input
    if (!printJobId || !tabId) {
      return NextResponse.json(
        { error: 'Missing required fields: printJobId, tabId' },
        { status: 400 }
      );
    }

    // Get print job
    const { data: printJob, error: printJobError } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', printJobId)
      .single();

    if (printJobError || !printJob) {
      return NextResponse.json(
        { error: 'Print job not found' },
        { status: 404 }
      );
    }

    // Verify tab exists and is open
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('id, tab_number, bar_id, status')
      .eq('id', tabId)
      .single();

    if (tabError || !tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      );
    }

    if (tab.status !== 'open') {
      return NextResponse.json(
        { error: 'Tab is not open' },
        { status: 400 }
      );
    }

    // Verify tab belongs to same bar as print job
    if (tab.bar_id !== printJob.bar_id) {
      return NextResponse.json(
        { error: 'Tab and receipt are from different venues' },
        { status: 400 }
      );
    }

    // Convert receipt to tab_order so it appears in customer's order history
    // CORE TRUTH: POS receipts become orders in Tabeza - customer sees them like any other order
    // Customer must approve POS orders just like staff-initiated orders
    const receiptData = printJob.parsed_data;
    const items = receiptData?.items || [];
    const total = receiptData?.total || 0;

    // Create tab_order from POS receipt - PENDING status requires customer approval
    const { data: tabOrder, error: orderError } = await supabase
      .from('tab_orders')
      .insert({
        tab_id: tabId,
        items: JSON.stringify(items),
        total: total,
        status: 'pending', // Customer must approve POS orders
        initiated_by: 'staff', // POS orders are initiated by staff
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create tab order from receipt:', orderError);
      return NextResponse.json(
        { error: 'Failed to deliver receipt as order' },
        { status: 500 }
      );
    }

    // Also store in digital_receipts for audit trail
    await supabase
      .from('digital_receipts')
      .insert({
        tab_id: tabId,
        bar_id: printJob.bar_id,
        print_job_id: printJobId,
        receipt_data: printJob.parsed_data,
        receipt_number: printJob.parsed_data?.receiptNumber,
        total_amount: total,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      });

    // Update print job status
    await supabase
      .from('print_jobs')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        matched_tab_id: tabId,
      })
      .eq('id', printJobId);

    return NextResponse.json({
      success: true,
      message: `Receipt delivered to Tab #${tab.tab_number} - awaiting customer approval`,
      tabOrderId: tabOrder.id,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Assign receipt error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

/**
 * GET /api/printer/assign-receipt?barId=xxx
 * 
 * Get unmatched receipts and open tabs for a bar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');

    if (!barId) {
      return NextResponse.json(
        { error: 'Missing barId parameter' },
        { status: 400 }
      );
    }

    // Get unmatched receipts
    const { data: unmatchedReceipts, error: receiptsError } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('bar_id', barId)
      .eq('status', 'no_match')
      .order('received_at', { ascending: false })
      .limit(20);

    if (receiptsError) {
      console.error('Failed to fetch unmatched receipts:', receiptsError);
      return NextResponse.json(
        { error: 'Failed to fetch receipts' },
        { status: 500 }
      );
    }

    // Get open tabs
    const { data: openTabs, error: tabsError } = await supabase
      .from('tabs')
      .select('id, tab_number, opened_at')
      .eq('bar_id', barId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (tabsError) {
      console.error('Failed to fetch open tabs:', tabsError);
      return NextResponse.json(
        { error: 'Failed to fetch tabs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      unmatchedReceipts: unmatchedReceipts || [],
      openTabs: openTabs || [],
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Get unmatched receipts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
