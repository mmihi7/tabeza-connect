/**
 * Shared Error Handling Utilities
 * Feature: fix-close-tab-errors
 * Task: 6.1 Create shared error handling utilities
 * 
 * **Validates: Requirements 4.4, 4.5**
 * 
 * Provides error types, interfaces, sanitization, and logging functions
 * for consistent error handling across customer and staff applications.
 */

/**
 * Error types for categorization
 */
export type ErrorType = 'network' | 'validation' | 'database' | 'permission' | 'unknown';

/**
 * Error interface for structured error information
 */
export interface TabezaError {
  type: ErrorType;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  troubleshooting?: string;
  originalError?: any;
}

/**
 * Sanitizes error messages to remove technical implementation details
 * 
 * **Requirement 4.5**: Error messages should not expose technical details
 * 
 * @param error - The error to sanitize
 * @returns User-friendly error message
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return 'An unexpected error occurred';
  }

  const errorMessage = error.message || error.toString();

  // Remove SQL queries
  const sqlPattern = /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+.*/gi;
  let sanitized = errorMessage.replace(sqlPattern, '[SQL query removed]');

  // Remove stack traces
  const stackPattern = /\s+at\s+.*/g;
  sanitized = sanitized.replace(stackPattern, '');

  // Remove file paths
  const pathPattern = /[A-Za-z]:\\[\w\\.-]+|\/[\w\/.-]+/g;
  sanitized = sanitized.replace(pathPattern, '[path]');

  // Remove database table names (common patterns)
  const tablePattern = /\b(tabs|tab_orders|tab_payments|bars|users|audit_logs)\b/gi;
  sanitized = sanitized.replace(tablePattern, '[table]');

  // Remove function names (PostgreSQL pattern)
  const functionPattern = /\bfunction\s+[\w_]+\(/gi;
  sanitized = sanitized.replace(functionPattern, 'function(');

  // Remove error codes (PostgreSQL pattern)
  const errorCodePattern = /\b[0-9A-Z]{5}\b/g;
  sanitized = sanitized.replace(errorCodePattern, '[code]');

  // If the message is now empty or too short, provide a generic message
  if (!sanitized || sanitized.trim().length < 10) {
    return 'An error occurred while processing your request';
  }

  return sanitized.trim();
}

/**
 * Categorizes an error and provides user-friendly information
 * 
 * @param error - The error to categorize
 * @param context - Context about where the error occurred ('customer' | 'staff')
 * @returns Structured error information
 */
export function categorizeError(error: any, context: 'customer' | 'staff' = 'customer'): TabezaError {
  // Network/connection errors
  if (
    error.code === 'PGRST301' ||
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.name === 'TypeError'
  ) {
    return {
      type: 'network',
      message: 'Connection error. Please check your internet connection.',
      retryable: true,
      troubleshooting: 'Ensure you have a stable internet connection and try again.',
      originalError: error,
    };
  }

  // Permission/authorization errors
  if (
    error.code === '42501' ||
    error.status === 401 ||
    error.status === 403 ||
    error.message?.includes('permission') ||
    error.message?.includes('unauthorized')
  ) {
    return {
      type: 'permission',
      message:
        context === 'customer'
          ? 'This tab does not belong to your device'
          : 'You do not have permission to perform this action',
      retryable: false,
      troubleshooting:
        context === 'customer'
          ? 'Make sure you are using the same device that opened this tab.'
          : 'Contact your bar manager or administrator to verify your permissions.',
      originalError: error,
    };
  }

  // Validation errors
  if (
    error.status === 400 ||
    error.message?.includes('validation') ||
    error.message?.includes('invalid') ||
    error.message?.includes('required')
  ) {
    return {
      type: 'validation',
      message: sanitizeErrorMessage(error),
      details: error.details,
      retryable: false,
      troubleshooting: 'Please check the information provided and try again.',
      originalError: error,
    };
  }

  // Database errors
  if (
    error.code?.startsWith('P') || // PostgreSQL error codes
    error.code?.startsWith('23') || // Integrity constraint violations
    error.message?.includes('database') ||
    error.message?.includes('query') ||
    error.message?.includes('relation')
  ) {
    return {
      type: 'database',
      message: 'A database error occurred. Please try again or contact support.',
      retryable: true,
      troubleshooting: 'If the problem persists, please contact support with the time this error occurred.',
      originalError: error,
    };
  }

  // Unknown/generic errors
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: true,
    troubleshooting: 'Please try again. If the problem persists, contact support.',
    originalError: error,
  };
}

/**
 * Error log entry interface
 */
export interface ErrorLogEntry {
  timestamp: string;
  tabId?: string;
  userId?: string;
  userType: 'customer' | 'staff' | 'system';
  errorType: ErrorType;
  errorMessage: string;
  originalError?: string;
  context?: Record<string, any>;
}

/**
 * Creates a structured error log entry
 * 
 * **Requirement 4.4**: Log error details for debugging
 * 
 * @param error - The error to log
 * @param options - Additional context for the log entry
 * @returns Structured log entry
 */
export function createErrorLogEntry(
  error: any,
  options: {
    tabId?: string;
    userId?: string;
    userType: 'customer' | 'staff' | 'system';
    context?: Record<string, any>;
  }
): ErrorLogEntry {
  const categorized = categorizeError(error, options.userType === 'customer' ? 'customer' : 'staff');

  return {
    timestamp: new Date().toISOString(),
    tabId: options.tabId,
    userId: options.userId,
    userType: options.userType,
    errorType: categorized.type,
    errorMessage: categorized.message,
    originalError: error.message || error.toString(),
    context: options.context,
  };
}

/**
 * Logs an error to the console with structured information
 * 
 * @param error - The error to log
 * @param options - Additional context for logging
 */
export function logError(
  error: any,
  options: {
    tabId?: string;
    userId?: string;
    userType: 'customer' | 'staff' | 'system';
    context?: Record<string, any>;
  }
): void {
  const logEntry = createErrorLogEntry(error, options);

  console.error('🚨 Tabeza Error:', {
    ...logEntry,
    // Include stack trace in development
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
}

/**
 * Formats an error for display to the user
 * 
 * @param error - The error to format
 * @param context - Context about where the error occurred
 * @returns User-friendly error message
 */
export function formatErrorForUser(error: any, context: 'customer' | 'staff' = 'customer'): string {
  const categorized = categorizeError(error, context);
  
  let message = categorized.message;
  
  if (categorized.troubleshooting) {
    message += `\n\n${categorized.troubleshooting}`;
  }
  
  return message;
}

/**
 * Determines if an error is retryable
 * 
 * @param error - The error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: any): boolean {
  const categorized = categorizeError(error);
  return categorized.retryable;
}
