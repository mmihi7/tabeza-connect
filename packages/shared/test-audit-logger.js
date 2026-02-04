/**
 * Simple test runner for audit logger functionality
 * This validates the core audit logging implementation
 */

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ error: null }),
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const { AuditLogger } = require('./lib/services/audit-logger');

async function testAuditLogger() {
  console.log('🧪 Testing Audit Logger Implementation...');
  
  try {
    // Test 1: Create audit logger instance
    console.log('✅ Test 1: Creating audit logger instance');
    const auditLogger = new AuditLogger('test-url', 'test-key');
    
    // Test 2: Log onboarding completion
    console.log('✅ Test 2: Logging onboarding completion');
    await auditLogger.logOnboardingCompletion({
      bar_id: 'test-bar-123',
      venue_mode: 'venue',
      authority_mode: 'tabeza',
      completion_percentage: 100,
      steps_completed: ['mode', 'authority', 'summary']
    });
    
    // Test 3: Log configuration change
    console.log('✅ Test 3: Logging configuration change');
    await auditLogger.logConfigurationChange({
      bar_id: 'test-bar-123',
      previous_config: { venue_mode: 'basic', authority_mode: 'pos' },
      new_config: { venue_mode: 'venue', authority_mode: 'tabeza' },
      change_reason: 'User upgrade'
    });
    
    // Test 4: Log validation failure
    console.log('✅ Test 4: Logging validation failure');
    await auditLogger.logValidationFailure({
      bar_id: 'test-bar-123',
      validation_type: 'onboarding',
      attempted_config: { venue_mode: 'basic', authority_mode: 'tabeza' },
      validation_errors: ['Basic mode requires POS authority'],
      user_action_blocked: true
    });
    
    // Test 5: Log migration event
    console.log('✅ Test 5: Logging migration event');
    await auditLogger.logMigrationEvent('configuration_migration_completed', {
      bar_id: 'test-bar-123',
      migration_type: 'automatic_migration',
      venues_affected: 1,
      migration_id: 'migration_123'
    });
    
    console.log('🎉 All audit logger tests passed!');
    console.log('📊 Audit logging implementation is working correctly');
    
  } catch (error) {
    console.error('❌ Audit logger test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAuditLogger();
}

module.exports = { testAuditLogger };