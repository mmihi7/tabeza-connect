/**
 * Database Error Handler Service
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service provides comprehensive error handling for database operations
 * with retry logic, user-friendly error messages, and detailed logging.
 */

export interface DatabaseError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  userMessage?: string;
  retryCount?: number;
  shouldRetry?: boolean;
}

export interface DatabaseOperationOptions {
  retryConfig?: Partial<RetryConfig>;
  operationName?: string;
  logContext?: Record<string, any>;
  userFriendlyContext?: string;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
};

// Error code mappings to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  // Connection errors
  'PGRST301': 'Database connection failed. Please check your internet connection and try again.',
  'PGRST302': 'Database is temporarily unavailable. Please try again in a few moments.',
  'ECONNREFUSED': 'Unable to connect to the database. Please check your internet connection.',
  'ETIMEDOUT': 'Database operation timed out. Please try again.',
  'ENOTFOUND': 'Database server not found. Please check your internet connection.',
  
  // Authentication errors
  'PGRST103': 'Authentication failed. Please log in again.',
  'PGRST301': 'Session expired. Please log in again.',
  'invalid_grant': 'Authentication failed. Please log in again.',
  
  // Permission errors
  'PGRST301': 'You do not have permission to perform this action.',
  'insufficient_privilege': 'You do not have permission to perform this action.',
  'row_security_violation': 'Access denied. Please contact support if this persists.',
  
  // Data validation errors
  'PGRST204': 'No data found. The requested item may have been deleted.',
  'PGRST116': 'Multiple records found when only one was expected.',
  'unique_violation': 'This item already exists. Please use a different value.',
  'foreign_key_violation': 'Cannot complete operation due to related data constraints.',
  'check_violation': 'Invalid data provided. Please check your input and try again.',
  'not_null_violation': 'Required field is missing. Please fill in all required fields.',
  
  // Onboarding-specific errors
  'onboarding_incomplete': 'Venue setup is incomplete. Please complete the onboarding process.',
  'invalid_venue_mode': 'Invalid venue configuration. Please select a valid setup option.',
  'migration_failed': 'Failed to update venue configuration. Please try again or contact support.',
  'configuration_conflict': 'Configuration conflict detected. Please review your settings.',
  
  // Generic fallback
  'unknown': 'An unexpected error occurred. Please try again or contact support if the problem persists.'
};

// Errors that should trigger a retry
const RETRYABLE_ERROR_CODES = new Set([
  'PGRST301', // Connection issues
  'PGRST302', // Temporary unavailability
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EPIPE',
  'ECONNRESET',
  'network_error',
  'timeout'
]);

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Extract error information from various error types
 */
function extractErrorInfo(error: any): DatabaseError {
  // Supabase error format
  if (error?.code && error?.message) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    };
  }
  
  // PostgreSQL error format
  if (error?.constraint || error?.table) {
    return {
      code: error.code || 'database_error',
      message: error.message || 'Database operation failed',
      details: `Table: ${error.table}, Constraint: ${error.constraint}`
    };
  }
  
  // Network/connection errors
  if (error?.code && typeof error.code === 'string') {
    return {
      code: error.code,
      message: error.message || 'Network error occurred'
    };
  }
  
  // Generic error
  return {
    code: 'unknown',
    message: error?.message || error?.toString() || 'Unknown error occurred'
  };
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(
  errorInfo: DatabaseError, 
  context?: string
): string {
  const baseMessage = ERROR_MESSAGES[errorInfo.code || 'unknown'] || ERROR_MESSAGES.unknown;
  
  if (context) {
    return `${context}: ${baseMessage}`;
  }
  
  return baseMessage;
}

/**
 * Check if error should trigger a retry
 */
function shouldRetryError(errorInfo: DatabaseError): boolean {
  if (!errorInfo.code) return false;
  return RETRYABLE_ERROR_CODES.has(errorInfo.code);
}

/**
 * Log error with context
 */
function logError(
  error: DatabaseError,
  operationName: string,
  attempt: number,
  context?: Record<string, any>
): void {
  const logData = {
    operation: operationName,
    attempt,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    },
    context,
    timestamp: new Date().toISOString()
  };
  
  console.error(`❌ Database operation failed [${operationName}] (attempt ${attempt}):`, logData);
}

/**
 * Execute database operation with retry logic and error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  options: DatabaseOperationOptions = {}
): Promise<DatabaseOperationResult<T>> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  const operationName = options.operationName || 'database_operation';
  
  let lastError: DatabaseError | null = null;
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry if this wasn't the first attempt
      if (attempt > 1) {
        console.log(`✅ Database operation succeeded after ${attempt} attempts [${operationName}]`);
      }
      
      return {
        success: true,
        data: result,
        retryCount: attempt - 1
      };
      
    } catch (error: any) {
      const errorInfo = extractErrorInfo(error);
      lastError = errorInfo;
      
      // Log the error
      logError(errorInfo, operationName, attempt, options.logContext);
      
      // Check if we should retry
      const shouldRetry = shouldRetryError(errorInfo) && attempt <= config.maxRetries;
      
      if (!shouldRetry) {
        break;
      }
      
      // Calculate delay and wait before retry
      const delay = calculateDelay(attempt, config);
      console.log(`⏳ Retrying ${operationName} in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);
      await sleep(delay);
    }
  }
  
  // All retries exhausted or non-retryable error
  const userMessage = getUserFriendlyMessage(lastError!, options.userFriendlyContext);
  
  return {
    success: false,
    error: lastError!.message,
    userMessage,
    retryCount: config.maxRetries,
    shouldRetry: shouldRetryError(lastError!)
  };
}

/**
 * Specialized error handler for onboarding operations
 */
export async function withOnboardingErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, any>
): Promise<DatabaseOperationResult<T>> {
  return withDatabaseErrorHandling(operation, {
    operationName: `onboarding_${operationName}`,
    userFriendlyContext: 'Venue setup',
    logContext: {
      ...context,
      operation_type: 'onboarding'
    },
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1500, // Slightly longer delay for onboarding operations
      maxDelay: 15000,
      backoffMultiplier: 2
    }
  });
}

/**
 * Specialized error handler for venue configuration operations
 */
export async function withVenueConfigErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, any>
): Promise<DatabaseOperationResult<T>> {
  return withDatabaseErrorHandling(operation, {
    operationName: `venue_config_${operationName}`,
    userFriendlyContext: 'Venue configuration',
    logContext: {
      ...context,
      operation_type: 'venue_configuration'
    },
    retryConfig: {
      maxRetries: 2, // Fewer retries for configuration changes
      baseDelay: 1000,
      maxDelay: 8000,
      backoffMultiplier: 2
    }
  });
}

/**
 * Specialized error handler for migration operations
 */
export async function withMigrationErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: Record<string, any>
): Promise<DatabaseOperationResult<T>> {
  return withDatabaseErrorHandling(operation, {
    operationName: `migration_${operationName}`,
    userFriendlyContext: 'Data migration',
    logContext: {
      ...context,
      operation_type: 'migration'
    },
    retryConfig: {
      maxRetries: 2, // Conservative retry for migrations
      baseDelay: 2000, // Longer delay for migrations
      maxDelay: 20000,
      backoffMultiplier: 2.5
    }
  });
}

/**
 * Create a user-friendly error message for UI display
 */
export function createUserErrorMessage(
  result: DatabaseOperationResult,
  fallbackMessage: string = 'An error occurred. Please try again.'
): string {
  if (result.success) return '';
  
  let message = result.userMessage || result.error || fallbackMessage;
  
  // Add retry suggestion if applicable
  if (result.shouldRetry && result.retryCount && result.retryCount > 0) {
    message += '\n\nThis appears to be a temporary issue. Please try again.';
  }
  
  return message;
}

/**
 * Check if an error result indicates a temporary issue that might resolve
 */
export function isTemporaryError(result: DatabaseOperationResult): boolean {
  return !result.success && (result.shouldRetry === true);
}

/**
 * Check if an error result indicates a permanent issue requiring user action
 */
export function isPermanentError(result: DatabaseOperationResult): boolean {
  return !result.success && (result.shouldRetry === false);
}