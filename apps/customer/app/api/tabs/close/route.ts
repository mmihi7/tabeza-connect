/**
 * Close Tab API Endpoint
 * Handles customer requests to close their tabs
 * Requirements: 3.1, 3.2, 1.2, 3.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Extract tabId from request body (Requirement 3.1)
    const body = await request.json();
    const { tabId } = body;

    // Validate required fields
    if (!tabId) {
      console.error('❌ Close tab API: Missing tabId');
      return NextResponse.json(
        { error: 'Tab ID is required' },
        { status: 400 }
      );
    }

    console.log('🔒 Close tab API request:', { tabId });

    // Create Supabase client with service role for server-side operations
    const supabase = createServiceRoleClient();

    // Extract device identifier from request (Requirement 3.2)
    // Try multiple sources: header, cookie, or body
    let deviceIdentifier: string | null = null;

    // 1. Check request headers
    const headerDeviceId = request.headers.get('X-Device-ID') || 
                          request.headers.get('x-device-id');
    if (headerDeviceId) {
      deviceIdentifier = headerDeviceId;
      console.log('📱 Device ID from header:', deviceIdentifier);
    }

    // 2. Check cookies if not in header
    if (!deviceIdentifier) {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);
        
        deviceIdentifier = cookies['tabeza_device_id_v2'] || 
                          cookies['tabeza_device_id'] ||
                          null;
        
        if (deviceIdentifier) {
          console.log('🍪 Device ID from cookie:', deviceIdentifier);
        }
      }
    }

    // 3. Check request body as fallback
    if (!deviceIdentifier && body.deviceId) {
      deviceIdentifier = body.deviceId;
      console.log('📦 Device ID from body:', deviceIdentifier);
    }

    // Query the tab from database (Requirement 3.2)
    const { data: tab, error: tabError } = await supabase
      .from('tabs')
      .select('id, status, device_identifier, bar_id')
      .eq('id', tabId)
      .maybeSingle();

    if (tabError) {
      console.error('❌ Error fetching tab:', tabError);
      return NextResponse.json(
        { error: 'Failed to fetch tab', details: tabError.message },
        { status: 500 }
      );
    }

    if (!tab) {
      console.error('❌ Tab not found:', tabId);
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      );
    }

    // Validate device authorization (Requirement 3.2, 1.5)
    // Device identifier is required for authorization
    if (!deviceIdentifier) {
      console.error('❌ No device identifier provided');
      return NextResponse.json(
        { error: 'Device identifier is required for authorization' },
        { status: 401 }
      );
    }

    // Verify device identifier matches the tab's device
    if (!tab.device_identifier) {
      console.error('❌ Tab has no device identifier:', tabId);
      return NextResponse.json(
        { error: 'Tab is not associated with any device' },
        { status: 500 }
      );
    }

    if (deviceIdentifier !== tab.device_identifier) {
      console.error('❌ Device identifier mismatch:', {
        provided: deviceIdentifier,
        expected: tab.device_identifier
      });
      return NextResponse.json(
        { error: 'Unauthorized to close this tab' },
        { status: 401 }
      );
    }

    console.log('✅ Device authorization verified');

    // Check if tab is already closed
    if (tab.status === 'closed') {
      console.log('ℹ️ Tab already closed:', tabId);
      return NextResponse.json(
        { 
          success: true, 
          message: 'Tab is already closed',
          alreadyClosed: true 
        },
        { status: 200 }
      );
    }

    console.log('✅ Close tab API: Initial validation passed', {
      tabId,
      status: tab.status,
      deviceVerified: !!deviceIdentifier
    });

    // Calculate tab balance (Requirement 1.2, 3.4)
    // Get confirmed orders total
    const { data: orders, error: ordersError } = await supabase
      .from('tab_orders')
      .select('total')
      .eq('tab_id', tabId)
      .eq('status', 'confirmed');

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to calculate tab balance', details: ordersError.message },
        { status: 500 }
      );
    }

    const confirmedOrdersTotal = orders?.reduce((sum, order) => {
      return sum + parseFloat(order.total.toString());
    }, 0) || 0;

    // Get successful payments total
    const { data: payments, error: paymentsError } = await supabase
      .from('tab_payments')
      .select('amount')
      .eq('tab_id', tabId)
      .eq('status', 'success');

    if (paymentsError) {
      console.error('❌ Error fetching payments:', paymentsError);
      return NextResponse.json(
        { error: 'Failed to calculate tab balance', details: paymentsError.message },
        { status: 500 }
      );
    }

    const successfulPaymentsTotal = payments?.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount.toString());
    }, 0) || 0;

    const balance = confirmedOrdersTotal - successfulPaymentsTotal;

    console.log('💰 Tab balance calculated:', {
      confirmedOrdersTotal,
      successfulPaymentsTotal,
      balance
    });

    // Check if balance is positive (Requirement 1.2, 3.4)
    if (balance > 0) {
      console.error('❌ Cannot close tab with positive balance:', balance);
      return NextResponse.json(
        { 
          error: 'Cannot close tab with outstanding balance',
          details: {
            balance: balance,
            confirmedOrdersTotal,
            successfulPaymentsTotal
          }
        },
        { status: 400 }
      );
    }

    // Check for pending orders (Requirement 3.4)
    const { data: pendingOrders, error: pendingOrdersError } = await supabase
      .from('tab_orders')
      .select('id, status, initiated_by')
      .eq('tab_id', tabId)
      .eq('status', 'pending');

    if (pendingOrdersError) {
      console.error('❌ Error fetching pending orders:', pendingOrdersError);
      return NextResponse.json(
        { error: 'Failed to check pending orders', details: pendingOrdersError.message },
        { status: 500 }
      );
    }

    const staffOrders = pendingOrders?.filter(o => o.initiated_by === 'staff') || [];
    const customerOrders = pendingOrders?.filter(o => o.initiated_by === 'customer') || [];

    console.log('📋 Pending orders check:', {
      totalPending: pendingOrders?.length || 0,
      staffOrders: staffOrders.length,
      customerOrders: customerOrders.length
    });

    // Block closure if there are pending staff orders (awaiting customer approval)
    if (staffOrders.length > 0) {
      console.error('❌ Cannot close tab with pending staff orders:', staffOrders.length);
      return NextResponse.json(
        { 
          error: 'Cannot close tab with pending staff orders',
          details: {
            pendingStaffOrders: staffOrders.length,
            message: `${staffOrders.length} staff order(s) awaiting customer approval`
          }
        },
        { status: 400 }
      );
    }

    // Block closure if there are pending customer orders (not yet served)
    if (customerOrders.length > 0) {
      console.error('❌ Cannot close tab with pending customer orders:', customerOrders.length);
      return NextResponse.json(
        { 
          error: 'Cannot close tab with pending customer orders',
          details: {
            pendingCustomerOrders: customerOrders.length,
            message: `${customerOrders.length} customer order(s) not yet served`
          }
        },
        { status: 400 }
      );
    }

    console.log('✅ All checks passed - tab can be closed');

    // Call close_tab RPC function (Requirement 1.1, 3.3, 3.5, 3.6)
    try {
      const { error: rpcError } = await supabase.rpc('close_tab', {
        p_tab_id: tabId,
        p_write_off_amount: null,
        p_closed_by: 'customer'
      });

      if (rpcError) {
        console.error('❌ RPC error closing tab:', rpcError);
        
        // Categorize RPC errors
        if (rpcError.message?.includes('already closed')) {
          // Tab was closed by another process
          return NextResponse.json({
            success: true,
            message: 'Tab is already closed',
            alreadyClosed: true
          }, { status: 200 });
        }
        
        if (rpcError.message?.includes('not found')) {
          return NextResponse.json(
            { error: 'Tab not found' },
            { status: 404 }
          );
        }
        
        // Generic database error - sanitize message
        return NextResponse.json(
          { 
            error: 'Failed to close tab',
            message: 'A database error occurred. Please try again or contact support.'
          },
          { status: 500 }
        );
      }

      console.log('✅ Tab closed successfully:', tabId);

      // Return success response (Requirement 3.5)
      return NextResponse.json({
        success: true,
        message: 'Tab closed successfully'
      }, { status: 200 });

    } catch (rpcError: any) {
      console.error('❌ Exception calling close_tab RPC:', rpcError);
      
      // Handle network/connection errors
      if (rpcError.code === 'PGRST301' || rpcError.message?.includes('fetch')) {
        return NextResponse.json(
          { 
            error: 'Connection error',
            message: 'Unable to connect to database. Please check your connection and try again.'
          },
          { status: 503 }
        );
      }
      
      // Generic error - sanitize message (Requirement 3.6)
      return NextResponse.json(
        { 
          error: 'Failed to close tab',
          message: 'An unexpected error occurred. Please try again or contact support.'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Close tab API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
