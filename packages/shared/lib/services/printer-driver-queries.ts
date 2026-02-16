/**
 * Printer Driver Queries
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module provides query functions for retrieving printer driver information
 * from the database, including active driver detection and status monitoring.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Constants
// ============================================================================

const ACTIVE_THRESHOLD_MINUTES = 5;

// ============================================================================
// Types
// ============================================================================

export interface PrinterDriver {
  id: string;
  bar_id: string;
  driver_id: string;
  version: string;
  status: 'online' | 'offline' | 'error';
  last_heartbeat: string;
  first_seen: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DriverQueryResult {
  data: PrinterDriver[] | null;
  error: Error | null;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get active drivers for a bar (heartbeat within last 5 minutes)
 * 
 * @param barId - The bar ID to query drivers for
 * @returns Promise with active drivers data or error
 */
export async function getActiveDrivers(barId: string): Promise<DriverQueryResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
  
  const thresholdTime = new Date(
    Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000
  ).toISOString();
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', barId)
    .gte('last_heartbeat', thresholdTime)
    .order('last_heartbeat', { ascending: false });
  
  return { data, error };
}

/**
 * Get all drivers for a bar (including stale/inactive)
 * Useful for debugging and administrative purposes
 * 
 * @param barId - The bar ID to query drivers for
 * @returns Promise with all drivers data or error
 */
export async function getAllDrivers(barId: string): Promise<DriverQueryResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', barId)
    .order('last_heartbeat', { ascending: false });
  
  return { data, error };
}

/**
 * Check if a driver is currently active based on last heartbeat
 * 
 * @param lastHeartbeat - ISO timestamp of last heartbeat
 * @returns true if driver is active (heartbeat within threshold)
 */
export function isDriverActive(lastHeartbeat: string): boolean {
  const heartbeatTime = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  const diffMinutes = (now - heartbeatTime) / (60 * 1000);
  
  return diffMinutes <= ACTIVE_THRESHOLD_MINUTES;
}

/**
 * Get time since last heartbeat in human-readable format
 * 
 * @param lastHeartbeat - ISO timestamp of last heartbeat
 * @returns Human-readable time string (e.g., "2 minutes ago")
 */
export function getTimeSinceHeartbeat(lastHeartbeat: string): string {
  const heartbeatTime = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  const diffMs = now - heartbeatTime;
  
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
}

/**
 * Get driver status with additional metadata
 * 
 * @param driver - Printer driver object
 * @returns Enhanced driver status information
 */
export function getDriverStatus(driver: PrinterDriver) {
  const isActive = isDriverActive(driver.last_heartbeat);
  const timeSince = getTimeSinceHeartbeat(driver.last_heartbeat);
  
  return {
    isActive,
    timeSince,
    statusText: isActive ? 'Online' : 'Offline',
    statusColor: isActive ? 'green' : 'gray',
  };
}
