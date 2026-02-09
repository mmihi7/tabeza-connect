/**
 * Mode Configuration Service
 * Task 2: Mode Configuration Service
 * 
 * Fetches and manages venue mode configuration from the database.
 * Provides feature availability checks based on mode configuration.
 */

import { createClient } from '@supabase/supabase-js';

// CORE TRUTH: Manual service always exists.
// Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.

export type VenueMode = 'basic' | 'venue';
export type AuthorityMode = 'pos' | 'tabeza';

export interface ModeConfiguration {
  venue_mode: VenueMode;
  authority_mode: AuthorityMode;
  pos_integration_enabled: boolean;
  printer_required: boolean;
  onboarding_completed: boolean;
  
  // Computed flags for convenience
  isBasic: boolean;
  isVenue: boolean;
  isPOSAuthority: boolean;
  isTabezaAuthority: boolean;
}

export type FeatureFlag = 
  | 'menu_management'
  | 'order_creation'
  | 'customer_ordering'
  | 'customer_requests'
  | 'messaging'
  | 'promotions'
  | 'printer_config'
  | 'timed_availability';

/**
 * Fetch mode configuration for a specific venue
 * @param barId - The venue's unique identifier
 * @returns Promise resolving to mode configuration
 * @throws Error if configuration cannot be fetched or is invalid
 */
export async function fetchModeConfig(barId: string): Promise<ModeConfiguration> {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
      : process.env.SUPABASE_SECRET_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query bars table for mode configuration
    const { data, error } = await supabase
      .from('bars')
      .select('venue_mode, authority_mode, pos_integration_enabled, printer_required, onboarding_completed')
      .eq('id', barId)
      .single();
    
    if (error) {
      console.error('Failed to fetch mode config:', error);
      throw new Error(`Failed to fetch mode configuration: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Venue not found');
    }
    
    // Validate configuration
    validateModeConfig(data);
    
    // Return configuration with computed flags
    return {
      venue_mode: data.venue_mode,
      authority_mode: data.authority_mode,
      pos_integration_enabled: data.pos_integration_enabled,
      printer_required: data.printer_required,
      onboarding_completed: data.onboarding_completed,
      isBasic: data.venue_mode === 'basic',
      isVenue: data.venue_mode === 'venue',
      isPOSAuthority: data.authority_mode === 'pos',
      isTabezaAuthority: data.authority_mode === 'tabeza',
    };
  } catch (error) {
    console.error('Error in fetchModeConfig:', error);
    
    // Fail safe: default to venue + tabeza (most permissive mode)
    // This ensures the app doesn't break if config fetch fails
    return {
      venue_mode: 'venue',
      authority_mode: 'tabeza',
      pos_integration_enabled: false,
      printer_required: false,
      onboarding_completed: false,
      isBasic: false,
      isVenue: true,
      isPOSAuthority: false,
      isTabezaAuthority: true,
    };
  }
}

/**
 * Validate mode configuration against business rules
 * @param config - Configuration to validate
 * @returns true if valid, throws Error with message if invalid
 */
export function validateModeConfig(config: Partial<ModeConfiguration>): boolean {
  const errors: string[] = [];
  
  // Basic mode must use POS authority
  if (config.venue_mode === 'basic' && config.authority_mode !== 'pos') {
    errors.push('Basic mode requires POS authority');
  }
  
  // Basic mode must require printer
  if (config.venue_mode === 'basic' && config.printer_required !== true) {
    errors.push('Basic mode must require printer');
  }
  
  // POS authority must have integration enabled
  if (config.authority_mode === 'pos' && config.pos_integration_enabled !== true) {
    errors.push('POS authority requires integration enabled');
  }
  
  // Tabeza authority must have integration disabled
  if (config.authority_mode === 'tabeza' && config.pos_integration_enabled !== false) {
    errors.push('Tabeza authority requires integration disabled');
  }
  
  if (errors.length > 0) {
    throw new Error(`Invalid mode configuration: ${errors.join(', ')}`);
  }
  
  return true;
}

/**
 * Check if a specific feature is available in the given mode
 * @param config - Current mode configuration
 * @param feature - Feature identifier
 * @returns true if feature is available
 */
export function isFeatureAvailable(config: ModeConfiguration, feature: FeatureFlag): boolean {
  const { isBasic, isVenue, isPOSAuthority, isTabezaAuthority } = config;
  
  switch (feature) {
    // Staff features
    case 'menu_management':
      return isVenue; // Available in Venue mode (view-only for POS, full for Tabeza)
    
    case 'order_creation':
      return isVenue && isTabezaAuthority; // Only Venue + Tabeza
    
    case 'customer_requests':
      return isVenue && isPOSAuthority; // Only Venue + POS
    
    case 'messaging':
      return isVenue; // Available in all Venue modes
    
    case 'promotions':
      return isVenue && isTabezaAuthority; // Only Venue + Tabeza
    
    case 'printer_config':
      return isPOSAuthority; // Available in Basic or Venue + POS
    
    case 'timed_availability':
      return isVenue; // Available in all Venue modes
    
    // Customer features
    case 'customer_ordering':
      return isVenue && isTabezaAuthority; // Only Venue + Tabeza
    
    default:
      return false;
  }
}
