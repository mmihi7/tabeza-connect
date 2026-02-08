/**
 * Error Logger Utility
 * Logs errors to console with sensitive data redaction
 * 
 * Task 6: Comprehensive Error Handling
 * Requirements: 10.4, 14.3
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

export interface ErrorLogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  component: string;
  message: string;
  metadata?: Record<string, any>;
  stack?: string;
}

/**
 * Sensitive data patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  // Customer names (common patterns)
  /owner_identifier['":\s]+([^,}"'\s]+)/gi,
  /customerIdentifier['":\s]+([^,}"'\s]+)/gi,
  /customer_name['":\s]+([^,}"'\s]+)/gi,
  
  // Payment information
  /card[_\s]?number['":\s]+([^,}"'\s]+)/gi,
  /cvv['":\s]+([^,}"'\s]+)/gi,
  /mpesa[_\s]?receipt['":\s]+([^,}"'\s]+)/gi,
  /phone[_\s]?number['":\s]+([^,}"'\s]+)/gi,
  
  // Authentication tokens
  /token['":\s]+([^,}"'\s]+)/gi,
  /authorization['":\s]+([^,}"'\s]+)/gi,
  /api[_\s]?key['":\s]+([^,}"'\s]+)/gi,
];

/**
 * Redact sensitive information from a string
 */
function redactSensitiveData(text: string): string {
  let redacted = text;
  
  SENSITIVE_PATTERNS.forEach(pattern => {
    redacted = redacted.replace(pattern, (match, group) => {
      return match.replace(group, '[REDACTED]');
    });
  });
  
  return redacted;
}

/**
 * Redact sensitive data from objects recursively
 */
function redactObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return redactSensitiveData(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  
  if (typeof obj === 'object') {
    const redacted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Redact known sensitive keys
      if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('key')
      ) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactObject(value);
      }
    }
    
    return redacted;
  }
  
  return obj;
}

/**
 * Log an error with sensitive data redaction
 */
export function logError(
  component: string,
  message: string,
  error?: Error | unknown,
  metadata?: Record<string, any>
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    component,
    message: redactSensitiveData(message),
    metadata: metadata ? redactObject(metadata) : undefined,
    stack: error instanceof Error ? redactSensitiveData(error.stack || '') : undefined
  };
  
  console.error(`[${entry.component}] ${entry.message}`, {
    ...entry,
    error: error instanceof Error ? {
      name: error.name,
      message: redactSensitiveData(error.message)
    } : error
  });
  
  return entry;
}

/**
 * Log a warning with sensitive data redaction
 */
export function logWarning(
  component: string,
  message: string,
  metadata?: Record<string, any>
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    component,
    message: redactSensitiveData(message),
    metadata: metadata ? redactObject(metadata) : undefined
  };
  
  console.warn(`[${entry.component}] ${entry.message}`, entry);
  
  return entry;
}

/**
 * Log an info message with sensitive data redaction
 */
export function logInfo(
  component: string,
  message: string,
  metadata?: Record<string, any>
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    component,
    message: redactSensitiveData(message),
    metadata: metadata ? redactObject(metadata) : undefined
  };
  
  console.info(`[${entry.component}] ${entry.message}`, entry);
  
  return entry;
}

/**
 * Log a debug message with sensitive data redaction
 */
export function logDebug(
  component: string,
  message: string,
  metadata?: Record<string, any>
): ErrorLogEntry {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'DEBUG',
    component,
    message: redactSensitiveData(message),
    metadata: metadata ? redactObject(metadata) : undefined
  };
  
  console.debug(`[${entry.component}] ${entry.message}`, entry);
  
  return entry;
}

/**
 * Get user-friendly error message from error object
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Map common error messages to user-friendly versions
    if (error.message.includes('Failed to fetch')) {
      return 'Unable to connect to server. Please check your internet connection.';
    }
    
    if (error.message.includes('Network error')) {
      return 'Network error occurred. Please try again.';
    }
    
    if (error.message.includes('Not Found')) {
      return 'The requested resource was not found.';
    }
    
    if (error.message.includes('Unauthorized')) {
      return 'You are not authorized to perform this action.';
    }
    
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    // Return redacted error message
    return redactSensitiveData(error.message);
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Store error logs in memory for "Report Issue" functionality
 * Limited to last 50 errors
 */
const errorLogHistory: ErrorLogEntry[] = [];
const MAX_LOG_HISTORY = 50;

export function addToErrorHistory(entry: ErrorLogEntry): void {
  errorLogHistory.unshift(entry);
  
  // Keep only last MAX_LOG_HISTORY entries
  if (errorLogHistory.length > MAX_LOG_HISTORY) {
    errorLogHistory.pop();
  }
}

export function getErrorHistory(): ErrorLogEntry[] {
  return [...errorLogHistory];
}

export function clearErrorHistory(): void {
  errorLogHistory.length = 0;
}

// Automatically add errors to history
const originalLogError = logError;
export { originalLogError as logErrorWithHistory };

// Override logError to add to history
export function logErrorWithHistory(
  component: string,
  message: string,
  error?: Error | unknown,
  metadata?: Record<string, any>
): ErrorLogEntry {
  const entry = originalLogError(component, message, error, metadata);
  addToErrorHistory(entry);
  return entry;
}
