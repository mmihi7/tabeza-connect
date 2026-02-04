/**
 * Onboarding Completion API Route
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This API endpoint handles venue onboarding completion with comprehensive
 * error handling, retry logic, and detailed audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  completeOnboarding,
  createOnboardingErrorMessage,
  type VenueConfigurationInput
} from '@tabeza/shared/lib/services/onboarding-operations';
import { logOnboardingFailure } from '@tabeza/shared/lib/services/audit-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { barId, configuration } = await request.json();

    // Extract user context for audit logging
    const userContext = {
      user_agent: request.headers.get('user-agent') || undefined,
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  request.ip || undefined,
      request_id: request.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: request.headers.get('x-session-id') || undefined,
      user_id: request.headers.get('x-user-id') || undefined
    };

    // Validate required parameters
    if (!barId) {
      await logOnboardingFailure({
        bar_id: barId,
        error_message: 'Bar ID is required',
        error_code: 'MISSING_BAR_ID',
        validation_errors: ['Bar ID is required'],
        user_action_blocked: true,
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bar ID is required',
          userMessage: 'Invalid request. Please refresh the page and try again.'
        },
        { status: 400 }
      );
    }

    if (!configuration || !configuration.venue_mode) {
      await logOnboardingFailure({
        bar_id: barId,
        error_message: 'Configuration is required',
        error_code: 'MISSING_CONFIGURATION',
        validation_errors: ['Configuration is required'],
        user_action_blocked: true,
        attempted_config: configuration,
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuration is required',
          userMessage: 'Invalid configuration. Please complete the setup form and try again.'
        },
        { status: 400 }
      );
    }

    console.log('🚀 Starting onboarding completion for bar:', barId, 'with config:', configuration);

    // Complete onboarding using the error handling service with user context
    const result = await completeOnboarding(
      supabase, 
      barId, 
      configuration as VenueConfigurationInput,
      userContext
    );

    if (!result.success) {
      console.error('❌ Onboarding completion failed:', result.error);
      
      // Log the failure with comprehensive details
      await logOnboardingFailure({
        bar_id: barId,
        error_message: result.error,
        error_code: result.errorCode || 'ONBOARDING_FAILED',
        validation_errors: result.validationErrors || [],
        user_action_blocked: true,
        retry_attempts: result.retryCount || 0,
        attempted_config: configuration,
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });
      
      const userMessage = createOnboardingErrorMessage(result, 'complete venue setup');
      
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

    console.log('✅ Onboarding completed successfully for bar:', barId);

    return NextResponse.json({
      success: true,
      venue: result.data,
      message: 'Venue setup completed successfully!'
    });

  } catch (error: any) {
    console.error('❌ Onboarding completion API error:', error);
    
    // Log unexpected errors
    try {
      await logOnboardingFailure({
        bar_id: (await request.json().catch(() => ({})))?.barId,
        error_message: error.message || 'Internal server error',
        error_code: 'UNEXPECTED_ERROR',
        validation_errors: [error.message || 'Unknown error'],
        user_action_blocked: true,
        user_agent: request.headers.get('user-agent') || undefined,
        ip_address: request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip || undefined,
        operation_duration_ms: Date.now() - startTime
      });
    } catch (logError) {
      console.warn('Failed to log onboarding failure:', logError);
    }
    
    // Create user-friendly error message for unexpected errors
    const userMessage = 'An unexpected error occurred during venue setup. Please try again or contact support if the problem persists.';
    
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