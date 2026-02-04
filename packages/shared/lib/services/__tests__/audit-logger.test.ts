/**
 * Audit Logger Service Tests
 * Tests comprehensive audit logging for configuration events
 * Requirements: 7.3, 7.4
 */

import { 
  AuditLogger,
  getAuditLogger,
  logOnboardingCompletion,
  logConfigurationChange,
  logValidationFailure,
  logOnboardingFailure,
  logMigrationEvent,
  type OnboardingAuditData,
  type ConfigurationChangeAuditData,
  type ValidationFailureAuditData
} from '../audit-logger';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ error: null }),
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  
  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AuditLogger('test-url', 'test-key');
  });

  describe('Onboarding Completion Logging', () => {
    it('should log onboarding completion with comprehensive details', async () => {
      const onboardingData: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        user_id: 'user-456',
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        selected_mode: 'venue',
        selected_authority: 'tabeza',
        completion_percentage: 100,
        steps_completed: ['mode', 'authority', 'summary'],
        time_spent_seconds: 120,
        user_agent: 'Mozilla/5.0 Test Browser',
        ip_address: '192.168.1.1',
        session_id: 'session-789',
        operation_duration_ms: 2500
      };

      await auditLogger.logOnboardingCompletion(onboardingData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'onboarding_completed',
          bar_id: 'test-bar-123',
          staff_id: 'user-456',
          details: expect.objectContaining({
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false,
            completion_percentage: 100,
            steps_completed: ['mode', 'authority', 'summary'],
            time_spent_seconds: 120,
            user_agent: 'Mozilla/5.0 Test Browser',
            ip_address: '192.168.1.1',
            session_id: 'session-789',
            operation_duration_ms: 2500,
            completion_timestamp: expect.any(String),
            success: true,
            final_configuration: expect.objectContaining({
              venue_mode: 'venue',
              authority_mode: 'tabeza'
            }),
            logged_at: expect.any(String),
            log_version: '1.0',
            audit_source: 'configuration_audit_logger'
          })
        })
      );
    });

    it('should handle onboarding completion with minimal data', async () => {
      const minimalData: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      await auditLogger.logOnboardingCompletion(minimalData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'onboarding_completed',
          bar_id: 'test-bar-123',
          details: expect.objectContaining({
            venue_mode: 'basic',
            authority_mode: 'pos',
            final_configuration: expect.objectContaining({
              venue_mode: 'basic',
              authority_mode: 'pos'
            })
          })
        })
      );
    });
  });

  describe('Configuration Change Logging', () => {
    it('should log configuration changes with before/after states', async () => {
      const changeData: ConfigurationChangeAuditData = {
        bar_id: 'test-bar-123',
        user_id: 'user-456',
        previous_config: {
          venue_mode: 'venue',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: false,
          onboarding_completed: true
        },
        new_config: {
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          pos_integration_enabled: false,
          printer_required: false,
          onboarding_completed: true
        },
        change_reason: 'User switched from POS to Tabeza authority',
        change_type: 'user_initiated',
        destructive_change: false,
        confirmation_required: true,
        user_confirmed: true,
        validation_warnings: ['Authority mode change affects workflow'],
        auto_corrections_applied: ['Updated pos_integration_enabled to false'],
        operation_duration_ms: 1500
      };

      await auditLogger.logConfigurationChange(changeData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_changed',
          bar_id: 'test-bar-123',
          staff_id: 'user-456',
          details: expect.objectContaining({
            previous_config: changeData.previous_config,
            new_config: changeData.new_config,
            change_reason: 'User switched from POS to Tabeza authority',
            change_type: 'user_initiated',
            destructive_change: false,
            confirmation_required: true,
            user_confirmed: true,
            validation_warnings: ['Authority mode change affects workflow'],
            auto_corrections_applied: ['Updated pos_integration_enabled to false'],
            operation_duration_ms: 1500,
            change_timestamp: expect.any(String),
            change_summary: expect.stringContaining('Authority mode: pos → tabeza'),
            impact_assessment: expect.any(String)
          })
        })
      );
    });

    it('should assess destructive changes correctly', async () => {
      const destructiveChangeData: ConfigurationChangeAuditData = {
        bar_id: 'test-bar-123',
        previous_config: {
          venue_mode: 'venue',
          authority_mode: 'tabeza'
        },
        new_config: {
          venue_mode: 'basic',
          authority_mode: 'pos'
        },
        destructive_change: true,
        change_type: 'user_initiated'
      };

      await auditLogger.logConfigurationChange(destructiveChangeData);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.details.impact_assessment).toBe('High - Destructive change that may affect existing data');
    });
  });

  describe('Validation Failure Logging', () => {
    it('should log validation failures with detailed error information', async () => {
      const validationData: ValidationFailureAuditData = {
        bar_id: 'test-bar-123',
        user_id: 'user-456',
        validation_type: 'onboarding',
        attempted_config: {
          venue_mode: 'basic',
          authority_mode: 'tabeza' // Invalid combination
        },
        validation_errors: [
          'Basic mode requires POS authority',
          'Invalid authority mode for basic venue'
        ],
        constraint_violations: ['Basic mode requires POS authority'],
        business_rule_violations: ['Invalid authority mode for basic venue'],
        user_action_blocked: true,
        suggested_corrections: [
          'Change authority mode to POS',
          'Or change venue mode to Venue'
        ],
        current_config: null,
        operation_duration_ms: 500
      };

      await auditLogger.logValidationFailure(validationData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_validation_failed',
          bar_id: 'test-bar-123',
          staff_id: 'user-456',
          details: expect.objectContaining({
            validation_type: 'onboarding',
            attempted_config: validationData.attempted_config,
            validation_errors: validationData.validation_errors,
            constraint_violations: validationData.constraint_violations,
            business_rule_violations: validationData.business_rule_violations,
            user_action_blocked: true,
            suggested_corrections: validationData.suggested_corrections,
            operation_duration_ms: 500,
            validation_timestamp: expect.any(String),
            failure_severity: 'high',
            user_guidance_provided: 2,
            system_recovery_possible: true
          })
        })
      );
    });

    it('should assess validation severity correctly', async () => {
      const lowSeverityData: ValidationFailureAuditData = {
        bar_id: 'test-bar-123',
        validation_type: 'configuration_change',
        attempted_config: { venue_mode: 'venue' },
        validation_errors: ['Minor validation warning'],
        user_action_blocked: false
      };

      await auditLogger.logValidationFailure(lowSeverityData);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.details.failure_severity).toBe('low');
    });
  });

  describe('Onboarding Failure Logging', () => {
    it('should log onboarding failures with recovery suggestions', async () => {
      const failureData: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        user_id: 'user-456',
        error_message: 'Network connection failed',
        error_code: 'NETWORK_ERROR',
        validation_errors: ['Unable to connect to server'],
        retry_attempts: 2,
        selected_mode: 'venue',
        selected_authority: 'tabeza',
        completion_percentage: 75,
        steps_completed: ['mode', 'authority'],
        operation_duration_ms: 5000
      };

      await auditLogger.logOnboardingFailure(failureData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'onboarding_failed',
          bar_id: 'test-bar-123',
          staff_id: 'user-456',
          details: expect.objectContaining({
            error_message: 'Network connection failed',
            error_code: 'NETWORK_ERROR',
            validation_errors: ['Unable to connect to server'],
            retry_attempts: 2,
            completion_percentage: 75,
            steps_completed: ['mode', 'authority'],
            operation_duration_ms: 5000,
            failure_timestamp: expect.any(String),
            failure_reason: 'Network connection failed',
            recovery_suggestions: expect.arrayContaining([
              'Check internet connection and retry',
              'Progress has been saved and can be resumed'
            ])
          })
        })
      );
    });
  });

  describe('Migration Event Logging', () => {
    it('should log migration start events', async () => {
      const migrationData = {
        bar_id: 'test-bar-123',
        migration_type: 'automatic_migration',
        venues_affected: 1,
        migration_id: 'migration_123_456',
        default_config: {
          venue_mode: 'venue',
          authority_mode: 'tabeza'
        }
      };

      await auditLogger.logMigrationEvent('configuration_migration_started', migrationData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_migration_started',
          bar_id: 'test-bar-123',
          details: expect.objectContaining({
            migration_type: 'automatic_migration',
            venues_affected: 1,
            migration_id: 'migration_123_456',
            default_config: migrationData.default_config,
            migration_timestamp: expect.any(String),
            migration_scope: 1,
            migration_strategy: 'automatic'
          })
        })
      );
    });

    it('should log migration completion events', async () => {
      const migrationData = {
        bar_id: 'test-bar-123',
        migration_type: 'automatic_migration',
        venues_affected: 5,
        migration_id: 'migration_123_456'
      };

      await auditLogger.logMigrationEvent('configuration_migration_completed', migrationData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_migration_completed',
          bar_id: 'test-bar-123',
          details: expect.objectContaining({
            migration_type: 'automatic_migration',
            venues_affected: 5,
            migration_id: 'migration_123_456',
            migration_scope: 5
          })
        })
      );
    });

    it('should log migration failure events', async () => {
      const migrationData = {
        bar_id: 'test-bar-123',
        migration_type: 'automatic_migration',
        venues_affected: 1,
        migration_errors: ['Database connection failed', 'Validation error']
      };

      await auditLogger.logMigrationEvent('configuration_migration_failed', migrationData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_migration_failed',
          bar_id: 'test-bar-123',
          details: expect.objectContaining({
            migration_type: 'automatic_migration',
            venues_affected: 1,
            migration_errors: ['Database connection failed', 'Validation error'],
            migration_scope: 1
          })
        })
      );
    });
  });

  describe('Data Sanitization', () => {
    it('should mask email addresses in audit data', async () => {
      const dataWithEmail: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        user_email: 'test.user@example.com'
      };

      await auditLogger.logOnboardingCompletion(dataWithEmail);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.details.user_email).toBe('t*******r@example.com');
    });

    it('should handle short email addresses', async () => {
      const dataWithShortEmail: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        user_email: 'a@b.com'
      };

      await auditLogger.logOnboardingCompletion(dataWithShortEmail);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.details.user_email).toBe('*@b.com');
    });

    it('should handle invalid email addresses', async () => {
      const dataWithInvalidEmail: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        user_email: 'invalid-email'
      };

      await auditLogger.logOnboardingCompletion(dataWithInvalidEmail);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.details.user_email).toBe('[MASKED_EMAIL]');
    });
  });

  describe('Error Handling', () => {
    it('should handle database insertion errors gracefully', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'Database error' } });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const onboardingData: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      // Should not throw an error
      await expect(auditLogger.logOnboardingCompletion(onboardingData)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create configuration audit log:',
        expect.objectContaining({
          action: 'onboarding_completed',
          error: 'Database error',
          bar_id: 'test-bar-123'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle unexpected errors during logging', async () => {
      mockSupabase.insert.mockRejectedValueOnce(new Error('Unexpected error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const onboardingData: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      // Should not throw an error
      await expect(auditLogger.logOnboardingCompletion(onboardingData)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error creating configuration audit log:',
        expect.objectContaining({
          action: 'onboarding_completed',
          error: 'Unexpected error',
          bar_id: 'test-bar-123'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance from getAuditLogger', () => {
      const logger1 = getAuditLogger();
      const logger2 = getAuditLogger();
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('Convenience Functions', () => {
    it('should provide working convenience functions', async () => {
      const onboardingData: OnboardingAuditData = {
        bar_id: 'test-bar-123',
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      await logOnboardingCompletion(onboardingData);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'onboarding_completed'
        })
      );

      const changeData: ConfigurationChangeAuditData = {
        bar_id: 'test-bar-123',
        previous_config: { venue_mode: 'basic' },
        new_config: { venue_mode: 'venue' }
      };

      await logConfigurationChange(changeData);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_changed'
        })
      );

      const validationData: ValidationFailureAuditData = {
        bar_id: 'test-bar-123',
        validation_type: 'onboarding',
        attempted_config: { venue_mode: 'invalid' },
        validation_errors: ['Invalid venue mode']
      };

      await logValidationFailure(validationData);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'configuration_validation_failed'
        })
      );
    });
  });
});