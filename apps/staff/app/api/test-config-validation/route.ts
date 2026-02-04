/**
 * Test API endpoint for configuration change validation
 * This endpoint can be used to test the validation logic manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  validateConfigurationChange,
  type VenueConfiguration,
  type VenueConfigurationInput
} from '@tabeza/shared';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentConfig, newConfig } = body;

    if (!currentConfig || !newConfig) {
      return NextResponse.json(
        { success: false, error: 'Both currentConfig and newConfig are required' },
        { status: 400 }
      );
    }

    // Test the configuration change validation
    const validationResult = validateConfigurationChange(
      currentConfig as VenueConfiguration,
      newConfig as VenueConfigurationInput
    );

    return NextResponse.json({
      success: true,
      validation: validationResult,
      testScenario: {
        current: currentConfig,
        new: newConfig,
        hasDestructiveChanges: validationResult.warnings.length > 0,
        requiresConfirmation: validationResult.warnings.length > 0 && validationResult.isValid
      }
    });

  } catch (error: any) {
    console.error('❌ Configuration validation test error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return test scenarios for manual testing
  const testScenarios = [
    {
      name: 'Valid change without warnings',
      description: 'Venue Tabeza → Venue POS (should have POS integration warning)',
      currentConfig: {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      },
      newConfig: {
        venue_mode: 'venue',
        authority_mode: 'pos'
      }
    },
    {
      name: 'Destructive change',
      description: 'Venue → Basic (should require confirmation)',
      currentConfig: {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      },
      newConfig: {
        venue_mode: 'basic',
        authority_mode: 'pos'
      }
    },
    {
      name: 'Invalid configuration',
      description: 'Basic + Tabeza (should fail validation)',
      currentConfig: {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      },
      newConfig: {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      }
    },
    {
      name: 'Authority change with warnings',
      description: 'Tabeza → POS (should warn about POS integration)',
      currentConfig: {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      },
      newConfig: {
        venue_mode: 'venue',
        authority_mode: 'pos'
      }
    }
  ];

  return NextResponse.json({
    success: true,
    message: 'Configuration validation test scenarios',
    scenarios: testScenarios,
    usage: {
      method: 'POST',
      endpoint: '/api/test-config-validation',
      body: {
        currentConfig: 'VenueConfiguration object',
        newConfig: 'VenueConfigurationInput object'
      }
    }
  });
}