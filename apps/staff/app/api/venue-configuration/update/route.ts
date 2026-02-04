/**
 * Venue Configuration Update API
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This API endpoint handles venue configuration updates after initial onboarding
 * with comprehensive audit logging and validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  updateVenueConfiguration,
  checkOnboardingStatus,
  createOnboardingErrorMessage,
  type VenueConfigurationInput
} from '@tabeza/shared/lib/services/onboarding-operations';
import { logConfigurationChange, logValidationFailure } from '@tabeza/shared/lib/services/audit-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { barId, configuration, changeReason } = await request.json();

    // Extract user context for audit logging
    const userContext = {
      user_agent: request.headers.get('user-agent') || undefined,
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  request.ip || undefined,
      request_id: request.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: request.headers.get('x-session-id') || undefined,
      user_id: request.headers.get('x-user-id') || undefined,
      change_reason: changeReason || 'User initiated change'
    };

    // Validate required parameters
    if (!barId) {
      await logValidationFailure({
        bar_id: barId,
        validation_type: 'configuration_change',
        attempted_config: configuration,
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
      await logValidationFailure({
        bar_id: barId,
        validation_type: 'configuration_change',
        attempted_config: configuration,
        validation_errors: ['Configuration is required'],
        user_action_blocked: true,
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

    console.log('🔄 Starting configuration update for bar:', barId, 'with config:', configuration);

    // Get current configuration
    const statusResult = await checkOnboardingStatus(supabase, barId);
    
    if (!statusResult.success || !statusResult.data?.venue) {
      await logValidationFailure({
        bar_id: barId,
        validation_type: 'configuration_change',
        attempted_config: configuration,
        validation_errors: ['Unable to load current configuration'],
        user_action_blocked: true,
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unable to load current configuration',
          userMessage: 'Unable to load venue settings. Please refresh the page and try again.'
        },
        { status: 500 }
      );
    }

    const currentVenue = statusResult.data.venue;
    
    // Ensure venue has completed onboarding
    if (!currentVenue.onboarding_completed) {
      await logValidationFailure({
        bar_id: barId,
        validation_type: 'configuration_change',
        attempted_config: configuration,
        validation_errors: ['Venue must complete onboarding before configuration changes'],
        user_action_blocked: true,
        current_config: {
          venue_mode: currentVenue.venue_mode,
          authority_mode: currentVenue.authority_mode,
          onboarding_completed: currentVenue.onboarding_completed
        },
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Venue must complete onboarding first',
          userMessage: 'Please complete the initial venue setup before making configuration changes.'
        },
        { status: 400 }
      );
    }

    // Build current configuration object
    const currentConfig = {
      venue_mode: currentVenue.venue_mode!,
      authority_mode: currentVenue.authority_mode!,
      pos_integration_enabled: currentVenue.pos_integration_enabled || false,
      printer_required: currentVenue.printer_required || false,
      onboarding_completed: currentVenue.onboarding_completed,
      authority_configured_at: currentVenue.authority_configured_at || new Date().toISOString(),
      mode_last_changed_at: currentVenue.mode_last_changed_at || new Date().toISOString()
    };

    // Update venue configuration using the error handling service
    const result = await updateVenueConfiguration(
      supabase, 
      barId, 
      currentConfig,
      configuration as VenueConfigurationInput,
      userContext
    );

    if (!result.success) {
      console.error('❌ Configuration update failed:', result.error);
      
      const userMessage = createOnboardingErrorMessage(result, 'update venue configuration');
      
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

    console.log('✅ Configuration updated successfully for bar:', barId);

    return NextResponse.json({
      success: true,
      venue: result.data,
      message: 'Venue configuration updated successfully!'
    });

  } catch (error: any) {
    console.error('❌ Configuration update API error:', error);
    
    // Log unexpected errors
    try {
      const body = await request.json().catch(() => ({}));
      await logValidationFailure({
        bar_id: body.barId,
        validation_type: 'configuration_change',
        attempted_config: body.configuration,
        validation_errors: [error.message || 'Unknown error'],
        user_action_blocked: true,
        user_agent: request.headers.get('user-agent') || undefined,
        ip_address: request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip || undefined,
        operation_duration_ms: Date.now() - startTime
      });
    } catch (logError) {
      console.warn('Failed to log configuration update failure:', logError);
    }
    
    // Create user-friendly error message for unexpected errors
    const userMessage = 'An unexpected error occurred while updating venue configuration. Please try again or contact support if the problem persists.';
    
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