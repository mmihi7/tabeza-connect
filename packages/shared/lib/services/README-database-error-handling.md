# Database Error Handling for Onboarding Operations

## Overview

This implementation provides comprehensive database error handling for onboarding operations with retry logic, user-friendly error messages, and detailed logging. It addresses **Requirement 6.1** and **6.4** from the onboarding-flow-fix specification.

## Core Components

### 1. Database Error Handler Service (`database-error-handler.ts`)

The main service that provides:
- **Exponential backoff retry logic** with configurable parameters
- **User-friendly error message mapping** from technical error codes
- **Detailed logging** for debugging and monitoring
- **Error classification** (temporary vs permanent errors)

#### Key Features:

- **Retry Configuration**: Customizable retry attempts, delays, and backoff multipliers
- **Error Code Mapping**: Maps database/network error codes to user-friendly messages
- **Context-Aware Messaging**: Includes operation context in error messages
- **Comprehensive Logging**: Structured logging with operation details and context

#### Usage Example:

```typescript
import { withDatabaseErrorHandling } from './database-error-handler';

const result = await withDatabaseErrorHandling(
  async () => {
    // Your database operation here
    return await supabase.from('bars').update(data).eq('id', barId);
  },
  {
    operationName: 'update_venue_config',
    userFriendlyContext: 'Venue configuration',
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    }
  }
);

if (!result.success) {
  console.error('Operation failed:', result.error);
  showUserMessage(result.userMessage);
}
```

### 2. Onboarding Operations Service (`onboarding-operations.ts`)

Specialized service for onboarding-specific database operations:
- **Venue onboarding status checking**
- **Onboarding completion with validation**
- **Venue configuration updates**
- **Existing venue migration**
- **Progress persistence** across page reloads

#### Key Functions:

- `checkOnboardingStatus()`: Check if venue needs onboarding
- `completeOnboarding()`: Complete venue onboarding with configuration
- `updateVenueConfiguration()`: Update venue config after onboarding
- `migrateExistingVenue()`: Migrate existing venues to onboarding system
- `saveOnboardingProgress()` / `restoreOnboardingProgress()`: Progress management

### 3. Enhanced API Routes

Updated API routes that use the error handling services:
- `/api/onboarding/complete` - Complete venue onboarding
- `/api/onboarding/status` - Check onboarding status
- `/api/venue-migration` - Handle venue migration

### 4. Enhanced UI Components

Updated React components with error handling:
- **VenueModeOnboarding**: Shows error messages with retry options
- **Settings Page**: Handles migration errors gracefully

## Error Handling Strategy

### 1. Error Classification

Errors are classified into two categories:

**Temporary Errors (Retryable):**
- Connection timeouts (`ETIMEDOUT`)
- Connection refused (`ECONNREFUSED`)
- Network errors (`ENOTFOUND`)
- Database unavailability (`PGRST302`)

**Permanent Errors (Non-retryable):**
- Authentication failures (`PGRST103`)
- Validation errors (`unique_violation`, `check_violation`)
- Permission errors (`insufficient_privilege`)
- Data not found (`PGRST204`)

### 2. Retry Logic

**Exponential Backoff Algorithm:**
```
delay = baseDelay * (backoffMultiplier ^ (attempt - 1))
finalDelay = min(delay, maxDelay)
```

**Default Configuration:**
- Max Retries: 3
- Base Delay: 1000ms
- Max Delay: 10000ms
- Backoff Multiplier: 2

**Specialized Configurations:**
- **Onboarding**: Slightly longer delays (1500ms base)
- **Venue Config**: Fewer retries (2 max) for configuration changes
- **Migration**: Conservative retries (2 max) with longer delays

### 3. User-Friendly Error Messages

Technical error codes are mapped to user-friendly messages:

```typescript
const ERROR_MESSAGES = {
  'ETIMEDOUT': 'Database operation timed out. Please try again.',
  'PGRST103': 'Authentication failed. Please log in again.',
  'unique_violation': 'This item already exists. Please use a different value.',
  'check_violation': 'Invalid data provided. Please check your input and try again.'
};
```

### 4. Progress Persistence

Onboarding progress is automatically saved to localStorage and restored:
- **Automatic saving** after each step completion
- **24-hour expiration** for stored progress
- **Graceful handling** of localStorage errors
- **Per-venue storage** using venue ID as key

## Implementation Details

### Database Operations with Error Handling

All database operations use the error handling wrapper:

```typescript
// Before (vulnerable to errors)
const { data, error } = await supabase
  .from('bars')
  .update(config)
  .eq('id', barId);

if (error) {
  console.error('Update failed:', error);
  alert('Something went wrong');
  return;
}

// After (with comprehensive error handling)
const result = await withOnboardingErrorHandling(
  async () => {
    const { data, error } = await supabase
      .from('bars')
      .update(config)
      .eq('id', barId);
    
    if (error) throw error;
    return data;
  },
  'update_venue_config',
  { barId, config }
);

if (!result.success) {
  setErrorMessage(result.userMessage);
  setCanRetry(result.shouldRetry);
  return;
}
```

### API Route Error Handling

API routes return structured error responses:

```typescript
// Success response
{
  success: true,
  data: { ... },
  message: "Operation completed successfully"
}

// Error response
{
  success: false,
  error: "Technical error message",
  userMessage: "User-friendly error message",
  canRetry: true,
  retryCount: 2
}
```

### UI Error Display

Components show contextual error messages with retry options:

```typescript
const ErrorDisplay = ({ error, canRetry, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="text-red-600" />
      <div>
        <h4 className="font-medium text-red-800">Setup Error</h4>
        <p className="text-sm text-red-700">{error}</p>
        {canRetry && (
          <button onClick={onRetry} className="mt-2 btn-retry">
            Try Again
          </button>
        )}
      </div>
    </div>
  </div>
);
```

## Testing

Comprehensive test suites cover:
- **Retry logic** with various error scenarios
- **Error message mapping** for all error codes
- **Progress persistence** across page reloads
- **API error handling** with network failures
- **UI error display** and retry functionality

### Running Tests

```bash
# Run database error handler tests
cd packages/shared && npm test database-error-handler.test.ts

# Run onboarding operations tests
cd packages/shared && npm test onboarding-operations.test.ts

# Run all tests with coverage
cd packages/shared && npm run test:coverage
```

## Monitoring and Debugging

### Structured Logging

All operations include structured logging:

```typescript
console.error('❌ Database operation failed [update_venue_config] (attempt 2):', {
  operation: 'update_venue_config',
  attempt: 2,
  error: {
    code: 'ETIMEDOUT',
    message: 'Connection timeout',
    details: 'Network request timed out after 30s'
  },
  context: {
    barId: '123',
    operation_type: 'onboarding'
  },
  timestamp: '2024-01-15T10:30:00.000Z'
});
```

### Audit Logging

Critical operations are logged to the audit_logs table:

```sql
INSERT INTO audit_logs (bar_id, action, details) VALUES (
  '123',
  'onboarding_completed',
  '{
    "venue_mode": "venue",
    "authority_mode": "tabeza",
    "completion_timestamp": "2024-01-15T10:30:00.000Z"
  }'
);
```

## Configuration

### Environment Variables

No additional environment variables required. The service uses existing Supabase configuration.

### Customization

Error handling can be customized per operation:

```typescript
// Custom retry configuration for critical operations
const result = await withDatabaseErrorHandling(operation, {
  retryConfig: {
    maxRetries: 5,        // More retries for critical ops
    baseDelay: 2000,      // Longer initial delay
    maxDelay: 30000,      // Higher max delay
    backoffMultiplier: 3  // More aggressive backoff
  }
});
```

## Best Practices

1. **Always use error handling wrappers** for database operations
2. **Provide context** in operation names and logging
3. **Show user-friendly messages** instead of technical errors
4. **Implement retry UI** for temporary errors
5. **Log errors with sufficient detail** for debugging
6. **Test error scenarios** thoroughly
7. **Monitor error rates** and patterns in production

## Core Truth Compliance

This implementation adheres to the Core Truth model:

```typescript
// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.
```

- **Manual service preservation**: Error handling never disrupts manual operations
- **Digital authority singularity**: Configuration validation ensures only one digital authority
- **Venue adaptation**: Error messages and retry logic adapt to venue-specific contexts

## Future Enhancements

Potential improvements for future iterations:

1. **Circuit breaker pattern** for repeated failures
2. **Exponential backoff with jitter** to prevent thundering herd
3. **Error rate monitoring** with alerting
4. **Automatic error reporting** to monitoring services
5. **User-configurable retry settings** in admin panel
6. **Offline operation support** with sync when online
7. **Error analytics dashboard** for operations teams