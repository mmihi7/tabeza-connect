// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Extend NextRequest to include ip property
declare module 'next/server' {
  interface NextRequest {
    ip?: string;
  }
}

export const dynamic = 'force-dynamic';

/**
 * Admin API for onboarding recovery operations
 * Requirements: 6.5
 * 
 * Supported operations:
 * - diagnose: Get venues needing recovery
 * - reset-single: Reset single venue configuration
 * - reset-bulk: Reset all incomplete venues
 * - fix-configs: Fix invalid configurations
 * - validate: Validate all configurations
 */

interface RecoveryRequest {
  operation: 'diagnose' | 'reset-single' | 'reset-bulk' | 'fix-configs' | 'validate';
  venueId?: string;
  venueMode?: 'basic' | 'venue';
  authorityMode?: 'pos' | 'tabeza';
  dryRun?: boolean;
}

/**
 * Validate venue configuration against Core Truth constraints
 */
function validateVenueConfig(venue: any): string[] {
  const issues: string[] = [];
  
  // Check Core Truth constraints
  if (venue.venue_mode === 'basic' && venue.authority_mode !== 'pos') {
    issues.push('Basic mode must use POS authority');
  }
  
  if (venue.venue_mode === 'basic' && !venue.printer_required) {
    issues.push('Basic mode must require printer');
  }
  
  if (venue.authority_mode === 'pos' && !venue.pos_integration_enabled) {
    issues.push('POS authority must have integration enabled');
  }
  
  if (venue.authority_mode === 'tabeza' && venue.pos_integration_enabled) {
    issues.push('Tabeza authority must have integration disabled');
  }
  
  // Check for NULL values
  const requiredFields = ['venue_mode', 'authority_mode', 'pos_integration_enabled', 'printer_required', 'onboarding_completed'];
  const nullFields = requiredFields.filter(field => venue[field] === null || venue[field] === undefined);
  
  if (nullFields.length > 0) {
    issues.push(`Missing required fields: ${nullFields.join(', ')}`);
  }
  
  return issues;
}

/**
 * Get configuration for venue mode and authority
 */
function getVenueConfiguration(venueMode: string, authorityMode: string) {
  // Validate input
  if (!['basic', 'venue'].includes(venueMode)) {
    throw new Error(`Invalid venue mode: ${venueMode}. Must be 'basic' or 'venue'`);
  }
  
  if (!['pos', 'tabeza'].includes(authorityMode)) {
    throw new Error(`Invalid authority mode: ${authorityMode}. Must be 'pos' or 'tabeza'`);
  }
  
  // Enforce Core Truth constraints
  if (venueMode === 'basic' && authorityMode !== 'pos') {
    throw new Error('Basic mode requires POS authority');
  }
  
  return {
    venue_mode: venueMode,
    authority_mode: authorityMode,
    pos_integration_enabled: authorityMode === 'pos',
    printer_required: venueMode === 'basic',
    onboarding_completed: true,
    authority_configured_at: new Date().toISOString(),
    mode_last_changed_at: new Date().toISOString()
  };
}

/**
 * Log audit entry
 */
async function logAuditEntry(action: string, details: any) {
  try {
    const { error } = await (supabase as any)
      .from('audit_logs')
      .insert({
        action,
        details: {
          ...details,
          admin_action: true,
          api_endpoint: true,
          timestamp: new Date().toISOString()
        }
      });
    
    if (error) {
      console.warn('Failed to log audit entry:', error.message);
    }
  } catch (error) {
    console.warn('Failed to log audit entry:', error);
  }
}

/**
 * Diagnose venues needing recovery
 */
async function diagnoseVenues() {
  // Get venues with incomplete onboarding
  const { data: incompleteVenues, error: incompleteError } = await (supabase as any)
    .from('bars')
    .select('id, name, slug, venue_mode, authority_mode, onboarding_completed, pos_integration_enabled, printer_required, created_at')
    .or('onboarding_completed.is.null,onboarding_completed.eq.false')
    .order('created_at', { ascending: false });
  
  if (incompleteError) {
    throw new Error(`Failed to query incomplete venues: ${incompleteError.message}`);
  }
  
  // Get all venues for validation
  const { data: allVenues, error: allError } = await (supabase as any)
    .from('bars')
    .select('id, name, slug, venue_mode, authority_mode, onboarding_completed, pos_integration_enabled, printer_required, created_at');
  
  if (allError) {
    throw new Error(`Failed to query all venues: ${allError.message}`);
  }
  
  // Find venues with invalid configurations
  const invalidVenues = (allVenues || []).filter((venue: any) => {
    const issues = validateVenueConfig(venue);
    return issues.length > 0;
  }).map((venue: any) => ({
    ...venue,
    issues: validateVenueConfig(venue)
  }));
  
  // Calculate statistics
  const stats = {
    total: (allVenues || []).length,
    completed: (allVenues || []).filter((v: any) => v.onboarding_completed === true).length,
    incomplete: (incompleteVenues || []).length,
    invalid: invalidVenues.length,
    basic: (allVenues || []).filter((v: any) => v.venue_mode === 'basic').length,
    venue: (allVenues || []).filter((v: any) => v.venue_mode === 'venue').length,
    pos: (allVenues || []).filter((v: any) => v.authority_mode === 'pos').length,
    tabeza: (allVenues || []).filter((v: any) => v.authority_mode === 'tabeza').length
  };
  
  return {
    incompleteVenues,
    invalidVenues,
    stats
  };
}

/**
 * Reset single venue configuration
 */
async function resetSingleVenue(venueId: string, venueMode: string, authorityMode: string, dryRun: boolean) {
  // Get current venue data
  const { data: venue, error: fetchError } = await (supabase as any)
    .from('bars')
    .select('id, name, slug, venue_mode, authority_mode, onboarding_completed, pos_integration_enabled, printer_required')
    .eq('id', venueId)
    .single();
  
  if (fetchError) {
    throw new Error(`Failed to fetch venue: ${fetchError.message}`);
  }
  
  if (!venue) {
    throw new Error(`Venue not found: ${venueId}`);
  }
  
  // Get new configuration
  const newConfig = getVenueConfiguration(venueMode, authorityMode);
  
  if (dryRun) {
    return {
      venue,
      newConfig,
      message: 'Dry run - no changes made'
    };
  }
  
  // Log audit entry
  await logAuditEntry('admin_recovery_single_venue_api', {
    venue_id: venueId,
    venue_name: (venue as any)?.name,
    recovery_type: 'reset_single',
    old_config: venue,
    new_config: newConfig
  });
  
  // Update venue
  const { error: updateError } = await (supabase as any)
    .from('bars')
    .update(newConfig)
    .eq('id', venueId);
  
  if (updateError) {
    throw new Error(`Failed to update venue: ${updateError.message}`);
  }
  
  // Verify update
  const { data: updatedVenue, error: verifyError } = await (supabase as any)
    .from('bars')
    .select('venue_mode, authority_mode, onboarding_completed, pos_integration_enabled, printer_required')
    .eq('id', venueId)
    .single();
  
  if (verifyError) {
    throw new Error(`Failed to verify update: ${verifyError.message}`);
  }
  
  const issues = validateVenueConfig(updatedVenue);
  
  return {
    venue,
    newConfig,
    updatedVenue,
    valid: issues.length === 0,
    issues,
    message: 'Venue reset completed successfully'
  };
}

/**
 * Reset all venues with incomplete onboarding
 */
async function resetBulkVenues(venueMode: string, authorityMode: string, dryRun: boolean) {
  // Get venues needing reset
  const { data: venues, error: fetchError } = await (supabase as any)
    .from('bars')
    .select('id, name, slug, venue_mode, authority_mode, onboarding_completed, created_at')
    .or('onboarding_completed.is.null,onboarding_completed.eq.false')
    .order('created_at', { ascending: false });
  
  if (fetchError) {
    throw new Error(`Failed to fetch venues: ${fetchError.message}`);
  }
  
  if (venues.length === 0) {
    return {
      venues: [],
      message: 'No venues need bulk reset. All venues have completed onboarding.'
    };
  }
  
  // Get new configuration
  const newConfig = getVenueConfiguration(venueMode, authorityMode);
  
  if (dryRun) {
    return {
      venues,
      newConfig,
      message: `Dry run - would reset ${venues.length} venues`
    };
  }
  
  // Log audit entry
  await logAuditEntry('admin_recovery_bulk_start_api', {
    recovery_type: 'bulk_reset_incomplete',
    venues_to_reset: venues.length,
    target_config: newConfig
  });
  
  // Update all venues
  const venueIds = venues.map((v: any) => v.id);
  const { error: updateError } = await (supabase as any)
    .from('bars')
    .update(newConfig)
    .in('id', venueIds);
  
  if (updateError) {
    throw new Error(`Failed to update venues: ${updateError.message}`);
  }
  
  // Log completion
  await logAuditEntry('admin_recovery_bulk_complete_api', {
    recovery_type: 'bulk_reset_incomplete',
    venues_reset: venues.length,
    target_config: newConfig
  });
  
  return {
    venues,
    newConfig,
    message: `Bulk reset completed successfully! Updated ${venues.length} venues.`
  };
}

/**
 * Fix invalid configurations
 */
async function fixInvalidConfigurations(dryRun: boolean) {
  // Get all venues
  const { data: venues, error: fetchError } = await (supabase as any)
    .from('bars')
    .select('id, name, slug, venue_mode, authority_mode, onboarding_completed, pos_integration_enabled, printer_required');
  
  if (fetchError) {
    throw new Error(`Failed to fetch venues: ${fetchError.message}`);
  }
  
  // Find venues with invalid configurations
  const invalidVenues = venues.filter(venue => {
    const issues = validateVenueConfig(venue);
    return issues.length > 0;
  });
  
  if (invalidVenues.length === 0) {
    return {
      venues: [],
      message: 'All venue configurations are valid. No fixes needed.'
    };
  }
  
  // Determine fixes needed
  const fixes = [];
  
  for (const venue of invalidVenues) {
    const fix = {
      id: (venue as any).id,
      name: (venue as any).name,
      updates: {} as any,
      reasons: [] as string[]
    };
    
    // Fix Basic mode with wrong authority
    if ((venue as any).venue_mode === 'basic' && (venue as any).authority_mode !== 'pos') {
      fix.updates.authority_mode = 'pos';
      fix.updates.pos_integration_enabled = true;
      fix.reasons.push('Basic mode requires POS authority');
    }
    
    // Fix Basic mode with wrong printer setting
    if ((venue as any).venue_mode === 'basic' && !(venue as any).printer_required) {
      fix.updates.printer_required = true;
      fix.reasons.push('Basic mode requires printer');
    }
    
    // Fix POS authority with wrong integration setting
    if ((venue as any).authority_mode === 'pos' && !(venue as any).pos_integration_enabled) {
      fix.updates.pos_integration_enabled = true;
      fix.reasons.push('POS authority requires integration enabled');
    }
    
    // Fix Tabeza authority with wrong integration setting
    if ((venue as any).authority_mode === 'tabeza' && (venue as any).pos_integration_enabled) {
      fix.updates.pos_integration_enabled = false;
      fix.reasons.push('Tabeza authority requires integration disabled');
    }
    
    // Add timestamp if any updates are needed
    if (Object.keys(fix.updates).length > 0) {
      fix.updates.mode_last_changed_at = new Date().toISOString();
      fixes.push(fix);
    }
  }
  
  if (fixes.length === 0) {
    return {
      venues: invalidVenues,
      fixes: [],
      message: 'No fixable configuration issues found.'
    };
  }
  
  if (dryRun) {
    return {
      venues: invalidVenues,
      fixes,
      message: `Dry run - would fix ${fixes.length} venues`
    };
  }
  
  // Log audit entry
  await logAuditEntry('admin_recovery_fix_configurations_start_api', {
    recovery_type: 'fix_invalid_configurations',
    venues_to_fix: fixes.length
  });
  
  // Apply fixes
  let fixedCount = 0;
  const results = [];
  
  for (const fix of fixes) {
    try {
      const { error: updateError } = await (supabase as any)
        .from('bars')
        .update(fix.updates)
        .eq('id', fix.id);
      
      if (updateError) {
        results.push({
          venue: fix.name,
          success: false,
          error: updateError.message
        });
      } else {
        results.push({
          venue: fix.name,
          success: true,
          reasons: fix.reasons
        });
        fixedCount++;
      }
    } catch (error: any) {
      results.push({
        venue: fix.name,
        success: false,
        error: error.message
      });
    }
  }
  
  // Log completion
  await logAuditEntry('admin_recovery_fix_configurations_complete_api', {
    recovery_type: 'fix_invalid_configurations',
    venues_fixed: fixedCount,
    venues_attempted: fixes.length
  });
  
  return {
    venues: invalidVenues,
    fixes,
    results,
    fixedCount,
    message: `Configuration fixes completed! Fixed ${fixedCount}/${fixes.length} venues.`
  };
}

/**
 * Validate all venue configurations
 */
async function validateConfigurations() {
  // Get all venues
  const { data: venues, error: fetchError } = await (supabase as any)
    .from('bars')
    .select('id, name, slug, venue_mode, authority_mode, onboarding_completed, pos_integration_enabled, printer_required');
  
  if (fetchError) {
    throw new Error(`Failed to fetch venues: ${fetchError.message}`);
  }
  
  // Validate each venue
  const validVenues: any[] = [];
  const invalidVenues: any[] = [];
  
  for (const venue of (venues || [])) {
    const issues = validateVenueConfig(venue);
    if (issues.length === 0) {
      validVenues.push(venue);
    } else {
      invalidVenues.push({ ...venue, issues });
    }
  }
  
  // Calculate statistics
  const completedOnboarding = (venues || []).filter((v: any) => v.onboarding_completed === true).length;
  const incompleteOnboarding = (venues || []).filter((v: any) => v.onboarding_completed === false || v.onboarding_completed === null).length;
  
  return {
    total: (venues || []).length,
    valid: validVenues.length,
    invalid: invalidVenues.length,
    completed: completedOnboarding,
    incomplete: incompleteOnboarding,
    validVenues,
    invalidVenues
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: RecoveryRequest = await request.json();
    const { operation, venueId, venueMode = 'venue', authorityMode = 'tabeza', dryRun = false } = body;

    console.log(`🔧 Admin recovery operation: ${operation}`, { venueId, venueMode, authorityMode, dryRun });

    let result;

    switch (operation) {
      case 'diagnose':
        result = await diagnoseVenues();
        break;

      case 'reset-single':
        if (!venueId) {
          return NextResponse.json(
            { success: false, error: 'Venue ID is required for reset-single operation' },
            { status: 400 }
          );
        }
        result = await resetSingleVenue(venueId, venueMode, authorityMode, dryRun);
        break;

      case 'reset-bulk':
        result = await resetBulkVenues(venueMode, authorityMode, dryRun);
        break;

      case 'fix-configs':
        result = await fixInvalidConfigurations(dryRun);
        break;

      case 'validate':
        result = await validateConfigurations();
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    console.log(`✅ Admin recovery operation completed: ${operation}`);

    return NextResponse.json({
      success: true,
      operation,
      dryRun,
      result
    });

  } catch (error: any) {
    console.error('❌ Admin recovery operation failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        operation: (await request.json().catch(() => ({})))?.operation || 'unknown'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get('operation') || 'diagnose';

    console.log(`🔍 Admin recovery GET operation: ${operation}`);

    let result;

    switch (operation) {
      case 'diagnose':
        result = await diagnoseVenues();
        break;

      case 'validate':
        result = await validateConfigurations();
        break;

      default:
        return NextResponse.json(
          { success: false, error: `GET operation not supported: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      operation,
      result
    });

  } catch (error: any) {
    console.error('❌ Admin recovery GET operation failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}