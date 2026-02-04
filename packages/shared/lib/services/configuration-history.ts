/**
 * Configuration History Service
 * Implements Task 10.2: Add configuration history display
 * Requirements: 7.5
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service provides configuration history retrieval and display functionality
 * for venue configuration audit trails and troubleshooting.
 */

import { createClient } from '@supabase/supabase-js';

// Configuration history event types
export type ConfigurationHistoryEventType = 
  | 'onboarding_completed'
  | 'configuration_changed'
  | 'configuration_validation_failed'
  | 'configuration_migration_completed'
  | 'configuration_reset'
  | 'admin_override_applied'
  | 'recovery_operation_completed';

// Configuration history entry interface
export interface ConfigurationHistoryEntry {
  id: string;
  action: ConfigurationHistoryEventType;
  bar_id: string;
  staff_id?: string;
  created_at: string;
  details: {
    // Configuration details
    venue_mode?: 'basic' | 'venue';
    authority_mode?: 'pos' | 'tabeza';
    pos_integration_enabled?: boolean;
    printer_required?: boolean;
    
    // Change tracking
    previous_config?: Record<string, any>;
    new_config?: Record<string, any>;
    change_summary?: string;
    change_reason?: string;
    change_type?: 'user_initiated' | 'migration' | 'admin_override' | 'system_correction';
    
    // User context
    user_agent?: string;
    ip_address?: string;
    session_id?: string;
    
    // Timing and performance
    operation_duration_ms?: number;
    completion_timestamp?: string;
    
    // Error information
    error_message?: string;
    validation_errors?: string[];
    recovery_suggestions?: string[];
    
    // Additional metadata
    [key: string]: any;
  };
}

// Formatted history entry for display
export interface FormattedHistoryEntry {
  id: string;
  timestamp: Date;
  action: ConfigurationHistoryEventType;
  title: string;
  description: string;
  details: {
    configurationBefore?: string;
    configurationAfter?: string;
    changeReason?: string;
    userContext?: string;
    errorDetails?: string;
    duration?: string;
  };
  severity: 'info' | 'success' | 'warning' | 'error';
  icon: string;
  user?: {
    id: string;
    email?: string;
  };
}

// History query options
export interface HistoryQueryOptions {
  barId: string;
  limit?: number;
  offset?: number;
  eventTypes?: ConfigurationHistoryEventType[];
  startDate?: Date;
  endDate?: Date;
  userId?: string;
}

// History query result
export interface HistoryQueryResult {
  entries: FormattedHistoryEntry[];
  totalCount: number;
  hasMore: boolean;
}

export class ConfigurationHistoryService {
  private supabase: any;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    // Use provided credentials or environment variables
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required for configuration history service');
    }
    
    this.supabase = createClient(url, key);
  }

  /**
   * Get configuration history for a venue
   * Requirements: 7.5 - Display configuration history timestamps
   */
  async getConfigurationHistory(options: HistoryQueryOptions): Promise<HistoryQueryResult> {
    try {
      const {
        barId,
        limit = 50,
        offset = 0,
        eventTypes,
        startDate,
        endDate,
        userId
      } = options;

      // Build query
      let query = this.supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('bar_id', barId)
        .in('action', this.getConfigurationEventTypes(eventTypes))
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Add date filters
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      // Add user filter
      if (userId) {
        query = query.eq('staff_id', userId);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching configuration history:', error);
        throw new Error(`Failed to fetch configuration history: ${error.message}`);
      }

      // Format entries for display
      const formattedEntries = (data || []).map(entry => 
        this.formatHistoryEntry(entry as ConfigurationHistoryEntry)
      );

      return {
        entries: formattedEntries,
        totalCount: count || 0,
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      console.error('Error in getConfigurationHistory:', error);
      throw error;
    }
  }

  /**
   * Get recent configuration changes (last 7 days)
   */
  async getRecentConfigurationChanges(barId: string): Promise<FormattedHistoryEntry[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.getConfigurationHistory({
      barId,
      limit: 10,
      startDate: sevenDaysAgo,
      eventTypes: ['configuration_changed', 'onboarding_completed']
    });

    return result.entries;
  }

  /**
   * Get configuration timestamps for display
   * Requirements: 7.5 - Show timestamps for when configuration was last changed
   */
  async getConfigurationTimestamps(barId: string): Promise<{
    authorityConfiguredAt?: Date;
    modeLastChangedAt?: Date;
    onboardingCompletedAt?: Date;
    lastValidationFailure?: Date;
  }> {
    try {
      // Get the most recent configuration events
      const result = await this.getConfigurationHistory({
        barId,
        limit: 100, // Get enough history to find all relevant timestamps
        eventTypes: [
          'onboarding_completed',
          'configuration_changed',
          'configuration_validation_failed'
        ]
      });

      const timestamps: {
        authorityConfiguredAt?: Date;
        modeLastChangedAt?: Date;
        onboardingCompletedAt?: Date;
        lastValidationFailure?: Date;
      } = {};

      // Find relevant timestamps
      for (const entry of result.entries) {
        if (entry.action === 'onboarding_completed' && !timestamps.onboardingCompletedAt) {
          timestamps.onboardingCompletedAt = entry.timestamp;
          // First configuration is also when authority was configured
          if (!timestamps.authorityConfiguredAt) {
            timestamps.authorityConfiguredAt = entry.timestamp;
          }
        }

        if (entry.action === 'configuration_changed' && !timestamps.modeLastChangedAt) {
          timestamps.modeLastChangedAt = entry.timestamp;
        }

        if (entry.action === 'configuration_validation_failed' && !timestamps.lastValidationFailure) {
          timestamps.lastValidationFailure = entry.timestamp;
        }
      }

      return timestamps;

    } catch (error) {
      console.error('Error fetching configuration timestamps:', error);
      return {};
    }
  }

  /**
   * Get configuration event types to query
   */
  private getConfigurationEventTypes(eventTypes?: ConfigurationHistoryEventType[]): string[] {
    if (eventTypes && eventTypes.length > 0) {
      return eventTypes;
    }

    // Default configuration-related event types
    return [
      'onboarding_completed',
      'configuration_changed',
      'configuration_validation_failed',
      'configuration_migration_completed',
      'configuration_reset',
      'admin_override_applied',
      'recovery_operation_completed'
    ];
  }

  /**
   * Format history entry for display
   */
  private formatHistoryEntry(entry: ConfigurationHistoryEntry): FormattedHistoryEntry {
    const timestamp = new Date(entry.created_at);
    const details = entry.details || {};

    // Generate title and description based on action type
    const { title, description, severity, icon } = this.getActionDisplayInfo(entry.action, details);

    // Format additional details
    const formattedDetails: FormattedHistoryEntry['details'] = {};

    // Configuration before/after
    if (details.previous_config && details.new_config) {
      formattedDetails.configurationBefore = this.formatConfiguration(details.previous_config);
      formattedDetails.configurationAfter = this.formatConfiguration(details.new_config);
    }

    // Change reason
    if (details.change_reason) {
      formattedDetails.changeReason = details.change_reason;
    }

    // User context
    if (details.user_agent || details.ip_address) {
      const userAgent = details.user_agent ? this.formatUserAgent(details.user_agent) : '';
      const ipAddress = details.ip_address ? `IP: ${details.ip_address}` : '';
      formattedDetails.userContext = [userAgent, ipAddress].filter(Boolean).join(', ');
    }

    // Error details
    if (details.error_message || details.validation_errors) {
      const errorMsg = details.error_message || '';
      const validationErrors = details.validation_errors ? details.validation_errors.join(', ') : '';
      formattedDetails.errorDetails = [errorMsg, validationErrors].filter(Boolean).join('; ');
    }

    // Duration
    if (details.operation_duration_ms) {
      formattedDetails.duration = `${details.operation_duration_ms}ms`;
    }

    return {
      id: entry.id,
      timestamp,
      action: entry.action,
      title,
      description,
      details: formattedDetails,
      severity,
      icon,
      user: entry.staff_id ? { id: entry.staff_id } : undefined
    };
  }

  /**
   * Get display information for action types
   */
  private getActionDisplayInfo(action: ConfigurationHistoryEventType, details: any): {
    title: string;
    description: string;
    severity: 'info' | 'success' | 'warning' | 'error';
    icon: string;
  } {
    switch (action) {
      case 'onboarding_completed':
        return {
          title: 'Onboarding Completed',
          description: `Venue configured as ${details.venue_mode || 'unknown'} mode with ${details.authority_mode || 'unknown'} authority`,
          severity: 'success',
          icon: '✅'
        };

      case 'configuration_changed':
        const changeSummary = details.change_summary || 'Configuration updated';
        return {
          title: 'Configuration Changed',
          description: changeSummary,
          severity: details.destructive_change ? 'warning' : 'info',
          icon: '⚙️'
        };

      case 'configuration_validation_failed':
        return {
          title: 'Validation Failed',
          description: details.validation_errors?.join(', ') || 'Configuration validation failed',
          severity: 'error',
          icon: '❌'
        };

      case 'configuration_migration_completed':
        return {
          title: 'Migration Completed',
          description: 'Venue migrated to new configuration system',
          severity: 'success',
          icon: '🔄'
        };

      case 'configuration_reset':
        return {
          title: 'Configuration Reset',
          description: 'Venue configuration was reset to defaults',
          severity: 'warning',
          icon: '🔄'
        };

      case 'admin_override_applied':
        return {
          title: 'Admin Override',
          description: 'Administrator applied configuration override',
          severity: 'warning',
          icon: '👨‍💼'
        };

      case 'recovery_operation_completed':
        return {
          title: 'Recovery Completed',
          description: 'Configuration recovery operation completed',
          severity: 'success',
          icon: '🛠️'
        };

      default:
        return {
          title: 'Configuration Event',
          description: 'Configuration event occurred',
          severity: 'info',
          icon: '📝'
        };
    }
  }

  /**
   * Format configuration object for display
   */
  private formatConfiguration(config: Record<string, any>): string {
    const parts: string[] = [];

    if (config.venue_mode) {
      parts.push(`Mode: ${config.venue_mode === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue'}`);
    }

    if (config.authority_mode) {
      parts.push(`Authority: ${config.authority_mode === 'pos' ? 'POS' : 'Tabeza'}`);
    }

    if (config.pos_integration_enabled !== undefined) {
      parts.push(`POS Integration: ${config.pos_integration_enabled ? 'Enabled' : 'Disabled'}`);
    }

    if (config.printer_required !== undefined) {
      parts.push(`Printer: ${config.printer_required ? 'Required' : 'Optional'}`);
    }

    return parts.join(', ') || 'Configuration details not available';
  }

  /**
   * Format user agent for display
   */
  private formatUserAgent(userAgent: string): string {
    // Extract browser and OS information
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
    
    const browser = browserMatch ? browserMatch[1] : 'Unknown Browser';
    const os = osMatch ? osMatch[1] : 'Unknown OS';
    
    return `${browser} on ${os}`;
  }
}

/**
 * Create a singleton configuration history service instance
 */
let configHistoryServiceInstance: ConfigurationHistoryService | null = null;

export function getConfigurationHistoryService(): ConfigurationHistoryService {
  if (!configHistoryServiceInstance) {
    configHistoryServiceInstance = new ConfigurationHistoryService();
  }
  return configHistoryServiceInstance;
}

/**
 * Convenience functions for common history operations
 */

export async function getVenueConfigurationHistory(
  barId: string,
  options?: Partial<HistoryQueryOptions>
): Promise<HistoryQueryResult> {
  const service = getConfigurationHistoryService();
  return service.getConfigurationHistory({
    barId,
    ...options
  });
}

export async function getRecentConfigurationChanges(barId: string): Promise<FormattedHistoryEntry[]> {
  const service = getConfigurationHistoryService();
  return service.getRecentConfigurationChanges(barId);
}

export async function getConfigurationTimestamps(barId: string): Promise<{
  authorityConfiguredAt?: Date;
  modeLastChangedAt?: Date;
  onboardingCompletedAt?: Date;
  lastValidationFailure?: Date;
}> {
  const service = getConfigurationHistoryService();
  return service.getConfigurationTimestamps(barId);
}