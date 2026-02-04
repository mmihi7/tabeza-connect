// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  migrateExistingVenue,
  createOnboardingErrorMessage
} from '@tabeza/shared/lib/services/onboarding-operations';

export async function POST(request: NextRequest) {
  try {
    const { barId } = await request.json();

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

    console.log('🔄 Starting venue migration check for bar:', barId);

    // Migrate existing venue using the error handling service
    const result = await migrateExistingVenue(supabase, barId);

    if (!result.success) {
      console.error('❌ Venue migration failed:', result.error);
      
      const userMessage = createOnboardingErrorMessage(result, 'migrate venue configuration');
      
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

    const { migrationCompleted, venue } = result.data!;

    if (migrationCompleted) {
      console.log('✅ Venue migration completed successfully for bar:', barId);
      return NextResponse.json({
        success: true,
        migrationNeeded: true,
        migrationCompleted: true,
        venue,
        message: 'Venue migration completed successfully'
      });
    } else {
      console.log('✅ Venue does not need migration:', barId);
      return NextResponse.json({
        success: true,
        migrationNeeded: false,
        venue,
        message: 'Venue does not need migration'
      });
    }

  } catch (error: any) {
    console.error('❌ Venue migration API error:', error);
    
    // Create user-friendly error message for unexpected errors
    const userMessage = 'Failed to check or migrate venue configuration. Please try again or contact support if the problem persists.';
    
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