/**
 * Comprehensive Audit Logging Service
 * Implements Task 10.1: Add comprehensive audit logging for configuration events
 * Requirements: 7.3, 7.4
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service provides structured audit logging for all configuration events
 * including onboarding completion, configuration changes, and validation failures.
 */

import { createClient } from '@supabase/supabase-js';

// Core audit event types for configuration events
export type ConfigurationAuditAction = 
  // Onboarding events
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_failed'
  | 'onboarding_abandoned'
  
  // Configuration change events
  | 'configuration_changed'
  | 'configuration_validation_passed'
  | 'configuration_validation_failed'
  | 'configuration_migration_started'
  | 'configuration_migration_completed'
  | 'configuration_migration_failed'
  
  // Recovery and admin events
  | 'configuration_reset'
  | 'admin_override_applied'
  | 'recovery_operation_started'
  | 'recovery_operation_completed'
  
  // System events
  | 'configuration_loaded'
  | 'configuration_cache_updated'
  | 'configuration_sync_failed';

// Base audit data structure
export interface BaseAuditData {
  // Core identifiers
  bar_id?: string;
  user_id?: string;
  session_id?: string;
  
  // Request context
  user_agent?: string;
  ip_address?: string;
  request_id?: string;
  
  // Timing information
  operation_duration_ms?: number;
  timestamp?: string;
  
  // Additional context
  [key: string]: any;
}

// Onboarding-specific audit data
export interface OnboardingAuditData extends BaseAuditData {
  // Onboarding flow data
  onboarding_step?: 'mode' | 'authority' | 'summary';
  selected_mode?: 'basic' | 'venue';
  selected_authority?: 'pos' | 'tabeza';
  
  // Configuration details
  venue_mode?: 'basic' | 'venue';
  authority_mode?: 'pos' | 'tabeza';
  pos_integration_enabled?: boolean;
  printer_required?: boolean;
  
  // Progress tracking
  completion_percentage?: number;
  steps_completed?: string[];
  time_spent_seconds?: number;
  
  // Error information
  error_message?: string;
  error_code?: string;
  validation_errors?: string[];
  
  // User interaction data
  form_interactions?: number;
  help_accessed?: boolean;
  retry_attempts?: number;
}

// Configuration change audit data
export interface ConfigurationChangeAuditData extends BaseAuditData {
  // Before/after states
  previous_config?: {
    venue_mode?: 'basic' | 'venue';
    authority_mode?: 'pos' | 'tabeza';
    pos_integration_enabled?: boolean;
    printer_required?: boolean;
    onboarding_completed?: boolean;
  };
  
  new_config?: {
    venue_mode?: 'basic' | 'venue';
    authority_mode?: 'pos' | 'tabeza';
    pos_integration_enabled?: boolean;
    printer_required?: boolean;
    onboarding_completed?: boolean;
  };
  
  // Change metadata
  change_reason?: string;
  change_type?: 'user_initiated' | 'migration' | 'admin_override' | 'system_correction';
  destructive_change?: boolean;
  confirmation_required?: boolean;
  user_confirmed?: boolean;
  
  // Validation results
  validation_warnings?: string[];
  validation_errors?: string[];
  auto_corrections_applied?: string[];
}

// Validation failure audit data
export interface ValidationFailureAuditData extends BaseAuditData {
  // Validation context
  validation_type?: 'onboarding' | 'configuration_change' | 'migration' | 'system_check';
  attempted_config?: Record<string, any>;
  
  // Failure details
  validation_errors?: string[];
  constraint_violations?: string[];
  business_rule_violations?: string[];
  
  // User impact
  user_action_blocked?: boolean;
  suggested_corrections?: string[];
  help_provided?: boolean;
  
  // System state
  current_config?: Record<string, any>;
  system_constraints?: Record<string, any>;
}

export class AuditLogger {
  private supabase: any;
  private defaultContext: Partial<BaseAuditData>;

  constructor(supabaseUrl?: string, supabaseKey?: string, defaultContext?: Partial<BaseAuditData>) {
    // Use provided credentials or environment variables
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SECRET_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required for audit logging');
    }
    
    this.supabase = createClient(url, key);
    this.defaultContext = defaultContext || {};
  }

  /**
   * Log onboarding completion event with comprehensive user details
   * Requirements: 7.3 - Log onboarding completion events with user details
   */
  async logOnboardingCompletion(data: OnboardingAuditData): Promise<void> {
    await this.logConfigurationEvent('onboarding_completed', data, {
      completion_timestamp: new Date().toISOString(),
      success: true,
      final_configuration: {
        venue_mode: data.venue_mode,
        authority_mode: data.authority_mode,
        pos_integration_enabled: data.pos_integration_enabled,
        printer_required: data.printer_required
      }
    });
  }

  /**
   * Log onboarding step completion for progress tracking
   */
  async logOnboardingStepCompletion(data: OnboardingAuditData): Promise<void> {
    await this.logConfigurationEvent('onboarding_step_completed', data, {
      step_completed_at: new Date().toISOString(),
      progress_percentage: data.completion_percentage || 0
    });
  }

  /**
   * Log onboarding failure with detailed error information
   */
  async logOnboardingFailure(data: OnboardingAuditData): Promise<void> {
    await this.logConfigurationEvent('onboarding_failed', data, {
      failure_timestamp: new Date().toISOString(),
      failure_reason: data.error_message || 'Unknown error',
      recovery_suggestions: this.generateRecoverySuggestions(data)
    });
  }

  /**
   * Log configuration changes with before/after states
   * Requirements: 7.4 - Log configuration changes with before/after states
   */
  async logConfigurationChange(data: ConfigurationChangeAuditData): Promise<void> {
    await this.logConfigurationEvent('configuration_changed', data, {
      change_timestamp: new Date().toISOString(),
      change_summary: this.generateChangeSummary(data.previous_config, data.new_config),
      impact_assessment: this.assessChangeImpact(data)
    });
  }

  /**
   * Log validation failures with detailed error information
   * Requirements: 7.4 - Log validation failures with detailed error information
   */
  async logValidationFailure(data: ValidationFailureAuditData): Promise<void> {
    await this.logConfigurationEvent('configuration_validation_failed', data, {
      validation_timestamp: new Date().toISOString(),
      failure_severity: this.assessValidationSeverity(data),
      user_guidance_provided: data.suggested_corrections?.length || 0,
      system_recovery_possible: this.canSystemRecover(data)
    });
  }

  /**
   * Log migration events with comprehensive details
   */
  async logMigrationEvent(
    action: 'configuration_migration_started' | 'configuration_migration_completed' | 'configuration_migration_failed',
    data: BaseAuditData & {
      migration_type?: string;
      venues_affected?: number;
      migration_id?: string;
      default_config?: Record<string, any>;
      migration_errors?: string[];
    }
  ): Promise<void> {
    await this.logConfigurationEvent(action, data, {
      migration_timestamp: new Date().toISOString(),
      migration_scope: data.venues_affected || 1,
      migration_strategy: data.migration_type || 'automatic'
    });
  }

  /**
   * Log admin recovery operations
   */
  async logRecoveryOperation(
    action: 'recovery_operation_started' | 'recovery_operation_completed',
    data: BaseAuditData & {
      recovery_type?: string;
      recovery_reason?: string;
      affected_venues?: string[];
      recovery_steps?: string[];
    }
  ): Promise<void> {
    await this.logConfigurationEvent(action, data, {
      recovery_timestamp: new Date().toISOString(),
      recovery_scope: data.affected_venues?.length || 1,
      admin_intervention: true
    });
  }

  /**
   * Core logging method that handles all configuration events
   */
  private async logConfigurationEvent(
    action: ConfigurationAuditAction,
    data: BaseAuditData,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    try {
      // Prepare audit log entry with comprehensive details
      const auditLogEntry = {
        action,
        bar_id: data.bar_id || null,
        tab_id: null, // Configuration events are not tab-specific
        staff_id: data.user_id || null,
        details: {
          // Core event data
          ...this.sanitizeAuditData(data),
          
          // Request context
          user_agent: data.user_agent,
          ip_address: data.ip_address,
          request_id: data.request_id,
          session_id: data.session_id,
          
          // Performance metrics
          operation_duration_ms: data.operation_duration_ms,
          
          // Additional context
          ...additionalContext,
          
          // Default context from constructor
          ...this.defaultContext,
          
          // Audit metadata
          logged_at: new Date().toISOString(),
          log_version: '1.0',
          audit_source: 'configuration_audit_logger'
        },
        created_at: new Date().toISOString()
      };

      // Insert audit log
      const { error } = await this.supabase
        .from('audit_logs')
        .insert(auditLogEntry);

      if (error) {
        console.error('Failed to create configuration audit log:', {
          action,
          error: error.message,
          bar_id: data.bar_id
        });
      }

    } catch (error) {
      console.error('Error creating configuration audit log:', {
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        bar_id: data.bar_id || 'unknown'
      });
    }
  }

  /**
   * Sanitize audit data to remove sensitive information
   */
  private sanitizeAuditData(data: BaseAuditData): Record<string, any> {
    const sanitized = { ...data };
    
    // Remove sensitive fields that shouldn't be logged
    delete sanitized.user_agent; // Will be added separately
    delete sanitized.ip_address; // Will be added separately
    delete sanitized.request_id; // Will be added separately
    delete sanitized.session_id; // Will be added separately
    
    // Mask any potential PII
    if (sanitized.user_email) {
      sanitized.user_email = this.maskEmail(sanitized.user_email);
    }
    
    return sanitized;
  }

  /**
   * Generate change summary for configuration changes
   */
  private generateChangeSummary(
    previousConfig?: Record<string, any>,
    newConfig?: Record<string, any>
  ): string {
    if (!previousConfig || !newConfig) {
      return 'Configuration change details not available';
    }

    const changes: string[] = [];
    
    if (previousConfig.venue_mode !== newConfig.venue_mode) {
      changes.push(`Venue mode: ${previousConfig.venue_mode} → ${newConfig.venue_mode}`);
    }
    
    if (previousConfig.authority_mode !== newConfig.authority_mode) {
      changes.push(`Authority mode: ${previousConfig.authority_mode} → ${newConfig.authority_mode}`);
    }
    
    if (previousConfig.pos_integration_enabled !== newConfig.pos_integration_enabled) {
      changes.push(`POS integration: ${previousConfig.pos_integration_enabled} → ${newConfig.pos_integration_enabled}`);
    }
    
    if (previousConfig.printer_required !== newConfig.printer_required) {
      changes.push(`Printer required: ${previousConfig.printer_required} → ${newConfig.printer_required}`);
    }

    return changes.length > 0 ? changes.join(', ') : 'No significant changes detected';
  }

  /**
   * Assess the impact of configuration changes
   */
  private assessChangeImpact(data: ConfigurationChangeAuditData): string {
    if (data.destructive_change) {
      return 'High - Destructive change that may affect existing data';
    }
    
    if (data.previous_config?.venue_mode !== data.new_config?.venue_mode) {
      return 'Medium - Venue mode change affects available features';
    }
    
    if (data.previous_config?.authority_mode !== data.new_config?.authority_mode) {
      return 'Medium - Authority mode change affects workflow';
    }
    
    return 'Low - Minor configuration adjustment';
  }

  /**
   * Assess validation failure severity
   */
  private assessValidationSeverity(data: ValidationFailureAuditData): 'low' | 'medium' | 'high' | 'critical' {
    if (data.constraint_violations?.length || data.business_rule_violations?.length) {
      return 'high';
    }
    
    if (data.user_action_blocked) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Determine if system can recover from validation failure
   */
  private canSystemRecover(data: ValidationFailureAuditData): boolean {
    return !!(data.suggested_corrections?.length || data.auto_corrections_applied?.length);
  }

  /**
   * Generate recovery suggestions for onboarding failures
   */
  private generateRecoverySuggestions(data: OnboardingAuditData): string[] {
    const suggestions: string[] = [];
    
    if (data.error_code === 'NETWORK_ERROR') {
      suggestions.push('Check internet connection and retry');
      suggestions.push('Progress has been saved and can be resumed');
    }
    
    if (data.error_code === 'VALIDATION_ERROR') {
      suggestions.push('Review configuration selections');
      suggestions.push('Ensure all required fields are completed');
    }
    
    if (data.retry_attempts && data.retry_attempts > 2) {
      suggestions.push('Contact support for assistance');
      suggestions.push('Provide error details and venue information');
    }
    
    return suggestions;
  }

  /**
   * Mask email addresses for privacy
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '[MASKED_EMAIL]';
    
    const maskedLocal = localPart.length > 2 
      ? `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`
      : '*'.repeat(localPart.length);
    
    return `${maskedLocal}@${domain}`;
  }
}

/**
 * Create a singleton audit logger instance
 */
let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(defaultContext?: Partial<BaseAuditData>): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(undefined, undefined, defaultContext);
  }
  return auditLoggerInstance;
}

/**
 * Convenience functions for common audit events
 */

export async function logOnboardingCompletion(data: OnboardingAuditData): Promise<void> {
  const logger = getAuditLogger();
  await logger.logOnboardingCompletion(data);
}

export async function logConfigurationChange(data: ConfigurationChangeAuditData): Promise<void> {
  const logger = getAuditLogger();
  await logger.logConfigurationChange(data);
}

export async function logValidationFailure(data: ValidationFailureAuditData): Promise<void> {
  const logger = getAuditLogger();
  await logger.logValidationFailure(data);
}

export async function logOnboardingFailure(data: OnboardingAuditData): Promise<void> {
  const logger = getAuditLogger();
  await logger.logOnboardingFailure(data);
}

export async function logMigrationEvent(
  action: 'configuration_migration_started' | 'configuration_migration_completed' | 'configuration_migration_failed',
  data: BaseAuditData & {
    migration_type?: string;
    venues_affected?: number;
    migration_id?: string;
    default_config?: Record<string, any>;
    migration_errors?: string[];
  }
): Promise<void> {
  const logger = getAuditLogger();
  await logger.logMigrationEvent(action, data);
}