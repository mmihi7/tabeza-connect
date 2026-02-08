/**
 * Venue Configuration Validation API
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This API endpoint validates venue configurations against Core Truth constraints
 * and provides corrected configurations for the onboarding flow with comprehensive audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  validateVenueConfiguration,
  validateConfigurationChange,
  generateCorrectedConfiguration,
  isValidCoreConfiguration,
  getConfigurationDescription,
  getThemeConfiguration,
  type VenueConfiguration,
  type VenueConfigurationInput
} from '@tabeza/shared';
import { logValidationFailure } from '@tabeza/shared/lib/services/audit-logger';

// Extend NextRequest to include ip property
declare module 'next/server' {
  interface NextRequest {
    ip?: string;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      configuration, 
      currentConfiguration, 
      validationType = 'new',
      barId
    } = body;

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

    if (!configuration) {
      // Log validation failure for missing configuration
      if (barId) {
        await logValidationFailure({
          bar_id: barId,
          validation_type: validationType === 'change' ? 'configuration_change' : 'onboarding',
          attempted_config: {} as Record<string, any>,
          validation_errors: ['Configuration is required'],
          user_action_blocked: true,
          ...userContext,
          operation_duration_ms: Date.now() - startTime
        });
      }
      
      return NextResponse.json(
        { success: false, error: 'Configuration is required' },
        { status: 400 }
      );
    }

    let validationResult;

    // Validate based on type
    if (validationType === 'change' && currentConfiguration) {
      // Validate configuration change
      validationResult = validateConfigurationChange(
        currentConfiguration as VenueConfiguration,
        configuration as VenueConfigurationInput
      );
    } else {
      // Validate new configuration
      validationResult = validateVenueConfiguration(
        configuration as VenueConfigurationInput
      );
    }

    // If validation failed, log the failure with detailed information
    if (!validationResult.isValid && barId) {
      await logValidationFailure({
        bar_id: barId,
        validation_type: validationType === 'change' ? 'configuration_change' : 'onboarding',
        attempted_config: configuration,
        validation_errors: validationResult.errors,
        constraint_violations: validationResult.errors.filter(e => e.includes('constraint') || e.includes('requires')),
        business_rule_violations: validationResult.errors.filter(e => e.includes('rule') || e.includes('authority')),
        user_action_blocked: true,
        suggested_corrections: validationResult.warnings || [],
        current_config: currentConfiguration || null,
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });
    }

    // If validation passed, add additional metadata
    if (validationResult.isValid && validationResult.correctedConfig) {
      const description = getConfigurationDescription(validationResult.correctedConfig);
      const theme = getThemeConfiguration(validationResult.correctedConfig);
      
      return NextResponse.json({
        success: true,
        validation: {
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        },
        configuration: validationResult.correctedConfig,
        metadata: {
          description,
          theme,
          isValidCoreConfiguration: isValidCoreConfiguration(validationResult.correctedConfig)
        }
      });
    }

    // Validation failed
    return NextResponse.json({
      success: false,
      validation: {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      },
      configuration: null,
      metadata: null
    });

  } catch (error: any) {
    console.error('❌ Venue configuration validation API error:', error);
    
    // Log unexpected validation errors
    try {
      const body = await request.json().catch(() => ({}));
      if (body.barId) {
        await logValidationFailure({
          bar_id: body.barId,
          validation_type: body.validationType === 'change' ? 'configuration_change' : 'onboarding',
          attempted_config: body.configuration,
          validation_errors: [error.message || 'Unknown validation error'],
          user_action_blocked: true,
          user_agent: request.headers.get('user-agent') || undefined,
          ip_address: request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      request.ip || undefined,
          operation_duration_ms: Date.now() - startTime
        });
      }
    } catch (logError) {
      console.warn('Failed to log validation failure:', logError);
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueMode = searchParams.get('venue_mode') as 'basic' | 'venue' | null;
    const authorityMode = searchParams.get('authority_mode') as 'pos' | 'tabeza' | null;

    if (!venueMode) {
      return NextResponse.json(
        { success: false, error: 'venue_mode parameter is required' },
        { status: 400 }
      );
    }

    // Generate corrected configuration for the given parameters
    const correctedConfig = generateCorrectedConfiguration({
      venue_mode: venueMode,
      authority_mode: authorityMode || undefined
    });

    const description = getConfigurationDescription(correctedConfig);
    const theme = getThemeConfiguration(correctedConfig);

    return NextResponse.json({
      success: true,
      configuration: correctedConfig,
      metadata: {
        description,
        theme,
        isValidCoreConfiguration: isValidCoreConfiguration(correctedConfig)
      }
    });

  } catch (error: any) {
    console.error('❌ Venue configuration generation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}