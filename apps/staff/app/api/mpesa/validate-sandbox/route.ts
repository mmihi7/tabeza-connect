import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadMpesaConfigFromBar, type BarMpesaData } from '@tabeza/shared/lib/services/mpesa-config';
import { 
  validateSandboxConfiguration, 
  validateSandboxPhoneNumber,
  getSandboxConfigurationSummary 
} from '@tabeza/shared/lib/services/mpesa-sandbox-validator';

export const runtime = 'nodejs';

/**
 * Validate M-Pesa sandbox configuration
 * Requirement 3.1: Validate request signature and origin
 * Requirement 6.1: Categorize errors by type and severity
 */
export async function POST(request: NextRequest) {
  try {
    const { barId, phoneNumber, strictMode = false } = await request.json();

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar ID is required' },
        { status: 400 }
      );
    }

    // Get bar data from database
    const { data: rawBarData, error: barError } = await supabase
      .from('bars')
      .select(`
        id,
        name,
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted
      `)
      .eq('id', barId)
      .single() as { 
        data: {
          id: string;
          name: string;
          mpesa_enabled: boolean;
          mpesa_environment: string;
          mpesa_business_shortcode: string;
          mpesa_consumer_key_encrypted: string | null;
          mpesa_consumer_secret_encrypted: string | null;
          mpesa_passkey_encrypted: string | null;
        } | null; 
        error: any;
      };

    if (barError || !rawBarData) {
      return NextResponse.json(
        { success: false, error: 'Bar not found' },
        { status: 404 }
      );
    }

    // Check if M-Pesa is enabled and in sandbox mode
    if (!rawBarData.mpesa_enabled) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'M-Pesa is not enabled for this bar',
          recommendation: 'Enable M-Pesa in your bar settings first'
        },
        { status: 400 }
      );
    }

    if (rawBarData.mpesa_environment !== 'sandbox') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'This validation is only for sandbox configurations',
          currentEnvironment: rawBarData.mpesa_environment
        },
        { status: 400 }
      );
    }

    // Convert to BarMpesaData format
    const barData: BarMpesaData = {
      mpesa_enabled: rawBarData.mpesa_enabled,
      mpesa_environment: rawBarData.mpesa_environment,
      mpesa_business_shortcode: rawBarData.mpesa_business_shortcode || '',
      mpesa_consumer_key_encrypted: rawBarData.mpesa_consumer_key_encrypted || '',
      mpesa_consumer_secret_encrypted: rawBarData.mpesa_consumer_secret_encrypted || '',
      mpesa_passkey_encrypted: rawBarData.mpesa_passkey_encrypted || ''
    };

    // Load M-Pesa configuration
    let mpesaConfig;
    try {
      mpesaConfig = loadMpesaConfigFromBar(barData);
    } catch (configError: any) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Configuration error: ${configError.message}`,
          details: configError.missingFields || [],
          type: 'configuration_error'
        },
        { status: 400 }
      );
    }

    // Perform comprehensive sandbox validation
    const validation = validateSandboxConfiguration(mpesaConfig, {
      strictMode: strictMode,
      validateCallbackUrl: true // Include callback URL accessibility checks
    });

    // Validate phone number if provided
    let phoneValidation = null;
    if (phoneNumber) {
      phoneValidation = validateSandboxPhoneNumber(phoneNumber);
    }

    // Get configuration summary
    const summary = getSandboxConfigurationSummary(mpesaConfig);

    // Prepare response
    const response = {
      success: validation.isValid && (!phoneValidation || phoneValidation.isValid),
      validation: {
        configuration: validation,
        phoneNumber: phoneValidation,
        summary: summary
      },
      recommendations: [
        ...validation.recommendations,
        ...(phoneValidation && !phoneValidation.isValid && phoneValidation.recommendation 
          ? [phoneValidation.recommendation] 
          : [])
      ]
    };

    // Add specific error categorization
    if (!response.success) {
      const errorCategories = categorizeValidationErrors(validation, phoneValidation);
      (response as any).errorCategories = errorCategories;
    }

    return NextResponse.json(response, { 
      status: response.success ? 200 : 400 
    });

  } catch (error: any) {
    console.error('Sandbox validation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during validation',
        type: 'internal_error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get sandbox validation status for a bar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar ID is required' },
        { status: 400 }
      );
    }

    // Get bar data
    const { data: rawBarData, error: barError } = await supabase
      .from('bars')
      .select(`
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted,
        mpesa_setup_completed,
        mpesa_test_status,
        mpesa_last_test_at
      `)
      .eq('id', barId)
      .single();

    if (barError || !rawBarData) {
      return NextResponse.json(
        { success: false, error: 'Bar not found' },
        { status: 404 }
      );
    }

    // Define the expected type for the bar data
    interface BarMpesaStatusData {
      mpesa_enabled: boolean;
      mpesa_environment: string;
      mpesa_business_shortcode: string;
      mpesa_consumer_key_encrypted: string;
      mpesa_consumer_secret_encrypted: string;
      mpesa_passkey_encrypted: string;
      mpesa_setup_completed: boolean;
      mpesa_test_status: string;
      mpesa_last_test_at: string;
    }

    // Type assertion to help TypeScript understand the structure
    const barData = rawBarData as BarMpesaStatusData;

    // Quick validation status
    const status = {
      mpesaEnabled: barData.mpesa_enabled,
      environment: barData.mpesa_environment,
      isSandbox: barData.mpesa_environment === 'sandbox',
      setupCompleted: barData.mpesa_setup_completed,
      lastTestStatus: barData.mpesa_test_status,
      lastTestAt: barData.mpesa_last_test_at,
      hasCredentials: !!(barData.mpesa_consumer_key_encrypted && barData.mpesa_consumer_secret_encrypted),
      businessShortcode: barData.mpesa_business_shortcode,
      isStandardSandboxShortcode: barData.mpesa_business_shortcode === '174379'
    };

    return NextResponse.json({
      success: true,
      status: status
    });

  } catch (error: any) {
    console.error('Get sandbox status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Categorize validation errors by type and severity
 * Requirement 6.1: Categorize errors by type and severity
 */
function categorizeValidationErrors(
  configValidation: any,
  phoneValidation: any
): {
  critical: string[];
  warning: string[];
  configuration: string[];
  credentials: string[];
  network: string[];
} {
  const categories = {
    critical: [] as string[],
    warning: [] as string[],
    configuration: [] as string[],
    credentials: [] as string[],
    network: [] as string[]
  };

  // Categorize configuration errors
  configValidation.errors.forEach((error: string) => {
    if (error.includes('Consumer key') || error.includes('Consumer secret')) {
      categories.credentials.push(error);
      categories.critical.push(error);
    } else if (error.includes('callback') || error.includes('URL')) {
      categories.network.push(error);
      categories.critical.push(error);
    } else if (error.includes('shortcode') || error.includes('passkey') || error.includes('environment')) {
      categories.configuration.push(error);
      categories.critical.push(error);
    } else {
      categories.critical.push(error);
    }
  });

  // Categorize configuration warnings
  configValidation.warnings.forEach((warning: string) => {
    categories.warning.push(warning);
    if (warning.includes('shortcode') || warning.includes('passkey')) {
      categories.configuration.push(warning);
    } else if (warning.includes('domain') || warning.includes('URL')) {
      categories.network.push(warning);
    }
  });

  // Categorize phone validation errors
  if (phoneValidation && !phoneValidation.isValid) {
    categories.critical.push(phoneValidation.error);
    categories.configuration.push(phoneValidation.error);
  }

  return categories;
}