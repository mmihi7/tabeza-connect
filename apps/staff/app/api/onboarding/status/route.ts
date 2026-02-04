/**
 * Onboarding Status Check API Route
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This API endpoint checks if a venue needs onboarding with comprehensive
 * error handling and detailed logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  checkOnboardingStatus,
  createOnboardingErrorMessage
} from '@tabeza/shared/lib/services/onboarding-operations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');

    // Validate required parameters
    if (!barId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bar ID is required',
          userMessage: 'Invalid request. Please refresh the page and try again.'
        },
        { status: 400 }
      );
    }

    console.log('🔍 Checking onboarding status for bar:', barId);

    // Check onboarding status using the error handling service
    const result = await checkOnboardingStatus(supabase, barId);

    if (!result.success) {
      console.error('❌ Onboarding status check failed:', result.error);
      
      const userMessage = createOnboardingErrorMessage(result, 'check venue status');
      
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          userMessage,
          canRetry: result.shouldRetry,
          retryCount: result.retryCount
        },
        { status: 500 }
      );
    }

    const { needsOnboarding, venue } = result.data!;

    console.log(`✅ Onboarding status check completed for bar: ${barId}, needs onboarding: ${needsOnboarding}`);

    return NextResponse.json({
      success: true,
      needsOnboarding,
      venue,
      message: needsOnboarding ? 'Venue needs onboarding' : 'Venue onboarding is complete'
    });

  } catch (error: any) {
    console.error('❌ Onboarding status check API error:', error);
    
    // Create user-friendly error message for unexpected errors
    const userMessage = 'Unable to check venue status. Please refresh the page and try again.';
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        userMessage,
        canRetry: true
      },
      { status: 500 }
    );
  }
}