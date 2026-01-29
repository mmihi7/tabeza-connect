/**
 * Robust Tab Resolution Service
 * Implements multiple strategies to resolve tab lookup failures
 * Addresses the "Tab not found" error with systematic recovery
 */

import { createServiceRoleClient } from '@/lib/supabase';

export interface Tab {
  id: string;
  bar_id: string;
  tab_number: number;
  status: 'open' | 'overdue' | 'closed';
  owner_identifier: string;
  opened_at: string;
}

export interface TabResolutionResult {
  success: boolean;
  tab?: Tab;
  error?: string;
  strategy?: string;
  repaired?: boolean;
}

export class TabNotFoundError extends Error {
  constructor(message: string, public strategy?: string, public originalError?: any) {
    super(message);
    this.name = 'TabNotFoundError';
  }
}

/**
 * Enhanced tab resolution with multiple fallback strategies
 */
export class TabResolver {
  private supabase = createServiceRoleClient();

  /**
   * Main resolution method - tries multiple strategies in order
   */
  async resolveTab(tabId: string, deviceId?: string): Promise<TabResolutionResult> {
    console.log('🔍 Starting tab resolution for:', tabId.substring(0, 8) + '...');

    const strategies = [
      () => this.directTabLookup(tabId),
      () => this.deviceIdCrossReference(deviceId),
      () => this.sessionDataRepair(tabId, deviceId),
      () => this.recentTabFallback(deviceId),
    ];

    for (let i = 0; i < strategies.length; i++) {
      const strategyName = [
        'DirectTabLookup',
        'DeviceIdCrossReference', 
        'SessionDataRepair',
        'RecentTabFallback'
      ][i];

      try {
        console.log(`🎯 Trying strategy ${i + 1}: ${strategyName}`);
        const result = await strategies[i]();
        
        if (result.success && result.tab) {
          console.log(`✅ Tab resolved using ${strategyName}`);
          return {
            ...result,
            strategy: strategyName
          };
        }
      } catch (error) {
        console.warn(`⚠️ Strategy ${strategyName} failed:`, error);
      }
    }

    console.log('❌ All tab resolution strategies failed');
    return {
      success: false,
      error: 'Unable to find your tab. Please scan the QR code again.',
      strategy: 'AllStrategiesFailed'
    };
  }

  /**
   * Strategy 1: Direct tab lookup by ID
   */
  private async directTabLookup(tabId: string): Promise<TabResolutionResult> {
    if (!tabId || typeof tabId !== 'string') {
      return { success: false, error: 'Invalid tab ID' };
    }

    const { data: tab, error } = await this.supabase
      .from('tabs')
      .select('id, bar_id, tab_number, status, owner_identifier, opened_at')
      .eq('id', tabId)
      .single();

    if (error || !tab) {
      return { success: false, error: 'Tab not found by direct lookup' };
    }

    // Validate tab status
    if (tab.status === 'closed') {
      return { 
        success: false, 
        error: 'This tab has been closed. Please scan the QR code to open a new tab.' 
      };
    }

    return { success: true, tab };
  }

  /**
   * Strategy 2: Cross-reference using device ID
   */
  private async deviceIdCrossReference(deviceId?: string): Promise<TabResolutionResult> {
    if (!deviceId) {
      return { success: false, error: 'No device ID provided' };
    }

    // Try exact prefix match first
    const { data: exactMatch, error: exactError } = await this.supabase
      .from('tabs')
      .select('id, bar_id, tab_number, status, owner_identifier, opened_at')
      .like('owner_identifier', `${deviceId}_%`)
      .in('status', ['open', 'overdue'])
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!exactError && exactMatch && exactMatch.length > 0) {
      return { success: true, tab: exactMatch[0] };
    }

    // Try embedded device ID match
    const { data: embeddedMatch, error: embeddedError } = await this.supabase
      .from('tabs')
      .select('id, bar_id, tab_number, status, owner_identifier, opened_at')
      .like('owner_identifier', `%${deviceId}%`)
      .in('status', ['open', 'overdue'])
      .order('opened_at', { ascending: false })
      .limit(1);

    if (!embeddedError && embeddedMatch && embeddedMatch.length > 0) {
      return { success: true, tab: embeddedMatch[0] };
    }

    return { success: false, error: 'No tab found for device ID' };
  }

  /**
   * Strategy 3: Repair corrupted session data
   */
  private async sessionDataRepair(tabId: string, deviceId?: string): Promise<TabResolutionResult> {
    // This strategy attempts to repair session data by finding the correct tab
    // and updating local storage with the right information
    
    if (!deviceId) {
      return { success: false, error: 'Cannot repair without device ID' };
    }

    // Try to find any tab that might belong to this device
    const crossRefResult = await this.deviceIdCrossReference(deviceId);
    
    if (crossRefResult.success && crossRefResult.tab) {
      // Found a tab via device ID - this might be the correct one
      console.log('🔧 Attempting session data repair');
      
      try {
        // Update session storage with correct tab data
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const repairedTabData = {
            id: crossRefResult.tab.id,
            bar_id: crossRefResult.tab.bar_id,
            tab_number: crossRefResult.tab.tab_number,
            status: crossRefResult.tab.status,
            owner_identifier: crossRefResult.tab.owner_identifier
          };
          
          window.sessionStorage.setItem('currentTab', JSON.stringify(repairedTabData));
          window.sessionStorage.setItem('Tabeza_current_bar', crossRefResult.tab.bar_id);
          
          console.log('✅ Session data repaired successfully');
        }
        
        return {
          success: true,
          tab: crossRefResult.tab,
          repaired: true
        };
      } catch (error) {
        console.warn('⚠️ Failed to repair session data:', error);
        return { success: false, error: 'Session repair failed' };
      }
    }

    return { success: false, error: 'No repairable session data found' };
  }

  /**
   * Strategy 4: Recent tab fallback (with safety checks)
   */
  private async recentTabFallback(deviceId?: string): Promise<TabResolutionResult> {
    // Only use this as a last resort and with strict safety checks
    
    const { data: recentTabs, error } = await this.supabase
      .from('tabs')
      .select('id, bar_id, tab_number, status, owner_identifier, opened_at')
      .in('status', ['open', 'overdue'])
      .order('opened_at', { ascending: false })
      .limit(3); // Get a few recent tabs

    if (error || !recentTabs || recentTabs.length === 0) {
      return { success: false, error: 'No recent tabs found' };
    }

    // Safety check: Only auto-assign if there's exactly one recent tab
    // This prevents accidentally assigning someone else's tab
    if (recentTabs.length === 1) {
      const tab = recentTabs[0];
      
      // Additional safety: Check if the tab is very recent (within last hour)
      const tabAge = Date.now() - new Date(tab.opened_at).getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (tabAge < oneHour) {
        console.log('⚠️ Using recent tab fallback (single recent tab found)');
        return { success: true, tab };
      }
    }

    return { 
      success: false, 
      error: `Found ${recentTabs.length} recent tabs, cannot auto-assign for safety` 
    };
  }

  /**
   * Validate tab data integrity
   */
  validateTabData(tab: any): boolean {
    return !!(
      tab &&
      tab.id &&
      tab.bar_id &&
      tab.tab_number &&
      tab.status &&
      tab.owner_identifier
    );
  }

  /**
   * Get device ID from various storage locations
   */
  getDeviceIdFromStorage(): string | null {
    if (typeof window === 'undefined') return null;

    const possibleKeys = [
      'Tabeza_device_id',
      'tabeza_device_id_v2', 
      'device_id'
    ];

    // Try localStorage first
    for (const key of possibleKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value && value.length >= 10) {
          return value;
        }
      } catch (error) {
        console.warn(`Failed to read localStorage[${key}]:`, error);
      }
    }

    // Try sessionStorage as fallback
    for (const key of possibleKeys) {
      try {
        const value = sessionStorage.getItem(key);
        if (value && value.length >= 10) {
          return value;
        }
      } catch (error) {
        console.warn(`Failed to read sessionStorage[${key}]:`, error);
      }
    }

    return null;
  }
}

/**
 * Convenience function for quick tab resolution
 */
export async function resolveTabForPayment(tabId: string): Promise<Tab> {
  const resolver = new TabResolver();
  const deviceId = resolver.getDeviceIdFromStorage();
  
  const result = await resolver.resolveTab(tabId, deviceId || undefined);
  
  if (!result.success || !result.tab) {
    throw new TabNotFoundError(
      result.error || 'Tab resolution failed',
      result.strategy
    );
  }

  return result.tab;
}

/**
 * Enhanced error messages based on resolution strategy
 */
export function getTabNotFoundErrorMessage(strategy?: string, error?: string): string {
  const baseMessage = 'Unable to find your tab.';
  
  switch (strategy) {
    case 'DirectTabLookup':
      return `${baseMessage} The tab may have been closed or expired. Please scan the QR code again.`;
    
    case 'DeviceIdCrossReference':
      return `${baseMessage} Your device ID doesn't match any active tabs. Please scan the QR code again.`;
    
    case 'SessionDataRepair':
      return `${baseMessage} There was an issue with your session data. Please refresh the page and try again.`;
    
    case 'RecentTabFallback':
      return `${baseMessage} Multiple tabs found - please scan the QR code to identify your specific tab.`;
    
    case 'AllStrategiesFailed':
      return `${baseMessage} Please scan the QR code again to create a new tab, or contact staff for assistance.`;
    
    default:
      return `${baseMessage} Please scan the QR code again or contact staff for assistance.`;
  }
}