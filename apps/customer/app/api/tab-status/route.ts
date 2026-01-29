/**
 * Tab Status API
 * Provides tab existence and status information for diagnostics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

interface TabStatusRequest {
  tabId: string;
}

interface TabStatusResponse {
  exists: boolean;
  status?: string;
  tabNumber?: number;
  barId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<TabStatusResponse>> {
  try {
    const { tabId }: TabStatusRequest = await request.json();

    if (!tabId || typeof tabId !== 'string') {
      return NextResponse.json(
        { exists: false, error: 'Invalid tab ID' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    
    const { data: tab, error } = await supabase
      .from('tabs')
      .select('id, status, tab_number, bar_id')
      .eq('id', tabId)
      .single();

    if (error || !tab) {
      return NextResponse.json({
        exists: false,
        error: 'Tab not found in database'
      });
    }

    return NextResponse.json({
      exists: true,
      status: tab.status,
      tabNumber: tab.tab_number,
      barId: tab.bar_id
    });

  } catch (error) {
    console.error('Tab status check error:', error);
    return NextResponse.json(
      { exists: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}