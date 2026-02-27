/**
 * Delete Receipt API
 * 
 * Allows staff to dismiss/delete unmatched receipts from Captain's Orders
 * Use case: Receipts from customers who aren't using Tabeza
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  const supabase = createServiceRoleClient();
  
  try {
    const body = await request.json();
    const { printJobId } = body;

    // Validate required fields
    if (!printJobId) {
      return NextResponse.json(
        { error: 'Missing required field: printJobId' },
        { status: 400 }
      );
    }

    console.log('🗑️  Deleting print job:', printJobId);

    // Delete the print job
    const { error: deleteError } = await supabase
      .from('print_jobs')
      .delete()
      .eq('id', printJobId);

    if (deleteError) {
      console.error('Failed to delete print job:', deleteError);
      throw deleteError;
    }

    console.log('✅ Print job deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Receipt dismissed successfully',
    });

  } catch (error) {
    console.error('Error deleting print job:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete receipt',
    }, { status: 500 });
  }
}
