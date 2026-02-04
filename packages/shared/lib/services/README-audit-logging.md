# Comprehensive Audit Logging Service

## Overview

The Audit Logging Service provides comprehensive audit trails for all configuration events in the Tabeza onboarding system. It implements Requirements 7.3 and 7.4 by logging onboarding completion events with user details, configuration changes with before/after states, and validation failures with detailed error information.

## Core Features

### 1. Onboarding Event Logging
- **Onboarding Completion**: Logs successful venue setup with comprehensive configuration details
- **Step Completion**: Tracks progress through onboarding flow steps
- **Onboarding Failures**: Records failures with recovery suggestions and error context
- **User Context**: Captures user agent, IP address, session ID, and timing information

### 2. Configuration Change Logging
- **Before/After States**: Complete configuration snapshots for change tracking
- **Change Impact Assessment**: Automatic assessment of change severity and impact
- **User Confirmation**: Tracks whether destructive changes were confirmed by users
- **Auto-Corrections**: Logs any automatic corrections applied during validation

### 3. Validation Failure Logging
- **Detailed Error Information**: Comprehensive validation error details and context
- **Constraint Violations**: Specific Core Truth constraint violations
- **Business Rule Violations**: Business logic rule violations
- **Recovery Guidance**: Suggested corrections and recovery paths for users

### 4. Migration Event Logging
- **Migration Lifecycle**: Start, completion, and failure events for venue migrations
- **Scope Tracking**: Number of venues affected by migration operations
- **Error Details**: Comprehensive error information for failed migrations
- **Configuration Defaults**: Default configurations applied during migrations

## Architecture

### Core Components

#### AuditLogger Class
The main audit logging service that handles all configuration events:

```typescript
const auditLogger = new AuditLogger(supabaseUrl, supabaseKey, defaultContext);

// Log onboarding completion
await auditLogger.logOnboardingCompletion({
  bar_id: 'venue-123',
  venue_mode: 'venue',
  authority_mode: 'tabeza',
  completion_percentage: 100,
  time_spent_seconds: 120
});

// Log configuration change
await auditLogger.logConfigurationChange({
  bar_id: 'venue-123',
  previous_config: { venue_mode: 'basic', authority_mode: 'pos' },
  new_config: { venue_mode: 'venue', authority_mode: 'tabeza' },
  change_reason: 'User upgrade to full service'
});
```

#### Convenience Functions
Simplified functions for common audit operations:

```typescript
import { 
  logOnboardingCompletion,
  logConfigurationChange,
  logValidationFailure,
  logOnboardingFailure,
  logMigrationEvent
} from '@tabeza/shared/lib/services/audit-logger';

// Simple onboarding completion logging
await logOnboardingCompletion({
  bar_id: 'venue-123',
  venue_mode: 'venue',
  authority_mode: 'tabeza'
});
```

### Data Models

#### OnboardingAuditData
Comprehensive data structure for onboarding events:

```typescript
interface OnboardingAuditData extends BaseAuditData {
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
  retry_attempts?: number;
}
```

#### ConfigurationChangeAuditData
Data structure for configuration change events:

```typescript
interface ConfigurationChangeAuditData extends BaseAuditData {
  // Before/after states
  previous_config?: VenueConfiguration;
  new_config?: VenueConfiguration;
  
  // Change metadata
  change_reason?: string;
  change_type?: 'user_initiated' | 'migration' | 'admin_override';
  destructive_change?: boolean;
  user_confirmed?: boolean;
  
  // Validation results
  validation_warnings?: string[];
  auto_corrections_applied?: string[];
}
```

#### ValidationFailureAuditData
Data structure for validation failure events:

```typescript
interface ValidationFailureAuditData extends BaseAuditData {
  // Validation context
  validation_type?: 'onboarding' | 'configuration_change' | 'migration';
  attempted_config?: Record<string, any>;
  
  // Failure details
  validation_errors?: string[];
  constraint_violations?: string[];
  business_rule_violations?: string[];
  
  // User impact
  user_action_blocked?: boolean;
  suggested_corrections?: string[];
}
```

## Integration Points

### API Endpoints
The audit logging service is integrated into all configuration-related API endpoints:

#### Onboarding Completion API
```typescript
// apps/staff/app/api/onboarding/complete/route.ts
import { logOnboardingCompletion, logOnboardingFailure } from '@tabeza/shared/lib/services/audit-logger';

export async function POST(request: NextRequest) {
  const userContext = {
    user_agent: request.headers.get('user-agent'),
    ip_address: request.headers.get('x-forwarded-for'),
    request_id: request.headers.get('x-request-id'),
    session_id: request.headers.get('x-session-id'),
    user_id: request.headers.get('x-user-id')
  };

  const result = await completeOnboarding(supabase, barId, configuration, userContext);
  
  if (!result.success) {
    await logOnboardingFailure({
      bar_id: barId,
      error_message: result.error,
      ...userContext
    });
  }
}
```

#### Configuration Update API
```typescript
// apps/staff/app/api/venue-configuration/update/route.ts
import { logConfigurationChange } from '@tabeza/shared/lib/services/audit-logger';

export async function POST(request: NextRequest) {
  const result = await updateVenueConfiguration(
    supabase, 
    barId, 
    currentConfig, 
    newConfig, 
    userContext
  );
  
  // Logging is handled automatically within updateVenueConfiguration
}
```

### Service Layer Integration
The audit logging is deeply integrated into the onboarding operations service:

```typescript
// packages/shared/lib/services/onboarding-operations.ts
export async function completeOnboarding(
  supabaseClient: any,
  barId: string,
  configuration: VenueConfigurationInput,
  userContext?: UserContext
): Promise<DatabaseOperationResult<VenueData>> {
  // ... validation and processing ...
  
  // Log successful completion with comprehensive details
  await logOnboardingCompletion({
    bar_id: barId,
    venue_mode: correctedConfig.venue_mode,
    authority_mode: correctedConfig.authority_mode,
    completion_percentage: 100,
    steps_completed: ['mode', 'authority', 'summary'],
    time_spent_seconds: Math.round((Date.now() - startTime) / 1000),
    ...userContext
  });
}
```

## Database Schema

All audit logs are stored in the existing `audit_logs` table:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID REFERENCES bars(id),
  tab_id UUID REFERENCES tabs(id),
  staff_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_bar ON audit_logs(bar_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action);
```

### Audit Event Types
The service uses specific action types for configuration events:

- `onboarding_started` - User begins onboarding flow
- `onboarding_step_completed` - Individual step completion
- `onboarding_completed` - Successful onboarding completion
- `onboarding_failed` - Onboarding failure with error details
- `configuration_changed` - Configuration update with before/after states
- `configuration_validation_failed` - Validation failure with error details
- `configuration_migration_started` - Migration operation start
- `configuration_migration_completed` - Successful migration completion
- `configuration_migration_failed` - Migration failure with error details

## Security and Privacy

### Data Sanitization
The audit logger automatically sanitizes sensitive information:

```typescript
// Email addresses are masked
"user@example.com" → "u***r@example.com"

// Sensitive fields are removed or redacted
{
  user_password: "[REDACTED]",
  api_key: "[REDACTED]",
  user_email: "u***r@example.com"
}
```

### Access Control
- Audit logs are write-only for application services
- Read access requires appropriate database permissions
- Sensitive user context is logged but sanitized
- IP addresses and user agents are logged for security analysis

## Usage Examples

### Basic Onboarding Completion
```typescript
import { logOnboardingCompletion } from '@tabeza/shared/lib/services/audit-logger';

await logOnboardingCompletion({
  bar_id: 'venue-123',
  user_id: 'user-456',
  venue_mode: 'venue',
  authority_mode: 'tabeza',
  pos_integration_enabled: false,
  printer_required: false,
  completion_percentage: 100,
  steps_completed: ['mode', 'authority', 'summary'],
  time_spent_seconds: 180,
  user_agent: 'Mozilla/5.0...',
  ip_address: '192.168.1.1'
});
```

### Configuration Change with Context
```typescript
import { logConfigurationChange } from '@tabeza/shared/lib/services/audit-logger';

await logConfigurationChange({
  bar_id: 'venue-123',
  user_id: 'user-456',
  previous_config: {
    venue_mode: 'basic',
    authority_mode: 'pos',
    pos_integration_enabled: true,
    printer_required: true
  },
  new_config: {
    venue_mode: 'venue',
    authority_mode: 'tabeza',
    pos_integration_enabled: false,
    printer_required: false
  },
  change_reason: 'Upgrade to full service offering',
  change_type: 'user_initiated',
  destructive_change: true,
  user_confirmed: true,
  validation_warnings: ['This change will disable POS integration'],
  auto_corrections_applied: ['Updated printer_required to false']
});
```

### Validation Failure Logging
```typescript
import { logValidationFailure } from '@tabeza/shared/lib/services/audit-logger';

await logValidationFailure({
  bar_id: 'venue-123',
  user_id: 'user-456',
  validation_type: 'onboarding',
  attempted_config: {
    venue_mode: 'basic',
    authority_mode: 'tabeza' // Invalid combination
  },
  validation_errors: [
    'Basic mode requires POS authority',
    'Tabeza authority not supported for Basic mode'
  ],
  constraint_violations: ['Basic mode requires POS authority'],
  business_rule_violations: ['Tabeza authority not supported for Basic mode'],
  user_action_blocked: true,
  suggested_corrections: [
    'Change authority mode to POS',
    'Or change venue mode to Venue'
  ]
});
```

## Querying Audit Logs

### Recent Onboarding Events
```sql
SELECT 
  action,
  bar_id,
  details->>'venue_mode' as venue_mode,
  details->>'authority_mode' as authority_mode,
  details->>'completion_percentage' as progress,
  created_at
FROM audit_logs 
WHERE action LIKE 'onboarding_%'
ORDER BY created_at DESC
LIMIT 50;
```

### Configuration Changes for a Venue
```sql
SELECT 
  action,
  details->>'change_reason' as reason,
  details->>'previous_config' as before_config,
  details->>'new_config' as after_config,
  details->>'impact_assessment' as impact,
  created_at
FROM audit_logs 
WHERE bar_id = 'venue-123' 
  AND action = 'configuration_changed'
ORDER BY created_at DESC;
```

### Validation Failures Analysis
```sql
SELECT 
  bar_id,
  details->>'validation_type' as validation_type,
  details->>'failure_severity' as severity,
  details->>'validation_errors' as errors,
  details->>'suggested_corrections' as suggestions,
  created_at
FROM audit_logs 
WHERE action = 'configuration_validation_failed'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Error Handling

The audit logging service is designed to never fail the primary operation:

```typescript
try {
  await auditLogger.logOnboardingCompletion(data);
} catch (error) {
  // Audit logging errors are logged but don't throw
  console.error('Audit logging failed:', error);
  // Primary operation continues
}
```

### Graceful Degradation
- Database connection failures are handled gracefully
- Invalid data is sanitized rather than rejected
- Logging errors are logged to console but don't propagate
- Primary operations continue even if audit logging fails

## Testing

The audit logging service includes comprehensive unit tests:

```bash
# Run audit logger tests
cd packages/shared
pnpm test audit-logger

# Run with coverage
pnpm test:coverage audit-logger
```

### Test Coverage
- ✅ Onboarding completion logging with various data scenarios
- ✅ Configuration change logging with before/after states
- ✅ Validation failure logging with error details
- ✅ Migration event logging for all lifecycle stages
- ✅ Data sanitization and privacy protection
- ✅ Error handling and graceful degradation
- ✅ Singleton pattern and convenience functions

## Monitoring and Alerting

### Key Metrics to Monitor
- **Onboarding Success Rate**: Ratio of completed to failed onboarding events
- **Configuration Change Frequency**: Rate of configuration changes per venue
- **Validation Failure Rate**: Percentage of validation failures by type
- **Migration Success Rate**: Success rate of venue migrations

### Alert Conditions
- High validation failure rate (>10% in 1 hour)
- Multiple onboarding failures for same venue
- Destructive configuration changes without confirmation
- Migration failures affecting multiple venues

### Log Analysis Queries
```sql
-- Onboarding success rate in last 24 hours
SELECT 
  COUNT(CASE WHEN action = 'onboarding_completed' THEN 1 END) as completed,
  COUNT(CASE WHEN action = 'onboarding_failed' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN action = 'onboarding_completed' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(CASE WHEN action IN ('onboarding_completed', 'onboarding_failed') THEN 1 END), 0),
    2
  ) as success_rate_percent
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND action IN ('onboarding_completed', 'onboarding_failed');
```

## Best Practices

### When to Log
- ✅ **Always log**: Onboarding completions, configuration changes, validation failures
- ✅ **Log with context**: Include user context, timing, and operation details
- ✅ **Log failures**: Capture error details and recovery suggestions
- ❌ **Don't log**: Sensitive authentication data, passwords, API keys

### Data Quality
- Use structured data formats (avoid free-form text in critical fields)
- Include operation timing for performance analysis
- Capture user context for security and debugging
- Sanitize sensitive information before logging

### Performance Considerations
- Audit logging is asynchronous and non-blocking
- Use batch inserts for high-volume operations
- Index audit logs appropriately for query performance
- Consider log retention policies for large deployments

## Troubleshooting

### Common Issues

#### Audit Logs Not Appearing
1. Check Supabase connection configuration
2. Verify audit_logs table permissions
3. Check for JavaScript errors in browser console
4. Verify API endpoint is calling audit logging functions

#### Missing User Context
1. Ensure API endpoints extract user context from headers
2. Check that frontend sends appropriate headers
3. Verify session management is working correctly

#### Performance Issues
1. Check audit_logs table indexes
2. Consider log retention and archival
3. Monitor database connection pool usage
4. Review query patterns and optimize as needed

### Debug Mode
Enable debug logging for troubleshooting:

```typescript
const auditLogger = new AuditLogger(url, key, {
  debug_mode: true,
  environment: 'development'
});
```

This comprehensive audit logging system provides complete visibility into all configuration events, enabling effective troubleshooting, compliance reporting, and system monitoring for the Tabeza onboarding flow.