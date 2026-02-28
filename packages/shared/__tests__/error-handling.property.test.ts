/**
 * Property-Based Tests for Error Handling Utilities
 * Feature: fix-close-tab-errors
 * Tasks: 6.4 (Error Message Safety) and 6.5 (Error Logging Completeness)
 * 
 * Property 8: Error Message Safety
 * Property 9: Error Logging Completeness
 * 
 * **Validates: Requirements 4.4, 4.5**
 */

import * as fc from 'fast-check';
import {
  sanitizeErrorMessage,
  categorizeError,
  createErrorLogEntry,
  logError,
  formatErrorForUser,
  isRetryableError,
} from '../error-handling';

describe('Feature: fix-close-tab-errors, Property 8: Error Message Safety', () => {
  /**
   * Property Test: Sanitized messages never contain SQL queries
   * 
   * For any error message containing SQL keywords, the sanitized version
   * should not expose the SQL query.
   */
  it('should remove SQL queries from error messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          sqlKeyword: fc.constantFrom('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'),
          tableName: fc.constantFrom('tabs', 'tab_orders', 'tab_payments', 'users'),
          condition: fc.string({ minLength: 5, maxLength: 20 }),
        }),
        ({ sqlKeyword, tableName, condition }) => {
          // Create error message with SQL query
          const errorMessage = `Database error: ${sqlKeyword} * FROM ${tableName} WHERE ${condition}`;
          const error = new Error(errorMessage);
          
          // Sanitize the message
          const sanitized = sanitizeErrorMessage(error);
          
          // Property: Sanitized message should not contain SQL keywords in query context
          expect(sanitized).not.toMatch(new RegExp(`${sqlKeyword}\\s+.*FROM`, 'i'));
          
          // Property: Sanitized message should not contain table names
          expect(sanitized.toLowerCase()).not.toContain(tableName.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Sanitized messages never contain stack traces
   * 
   * For any error with a stack trace, the sanitized version should not
   * expose file paths or line numbers.
   */
  it('should remove stack traces from error messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          functionName: fc.string({ minLength: 5, maxLength: 15 }),
          fileName: fc.string({ minLength: 5, maxLength: 15 }),
          lineNumber: fc.integer({ min: 1, max: 1000 }),
        }),
        ({ functionName, fileName, lineNumber }) => {
          // Create error message with stack trace
          const errorMessage = `Error in ${functionName}\n    at ${functionName} (${fileName}.ts:${lineNumber}:10)`;
          const error = new Error(errorMessage);
          
          // Sanitize the message
          const sanitized = sanitizeErrorMessage(error);
          
          // Property: Sanitized message should not contain "at" stack trace pattern
          expect(sanitized).not.toMatch(/\s+at\s+/);
          
          // Property: Sanitized message should not contain line numbers
          expect(sanitized).not.toContain(`:${lineNumber}:`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Sanitized messages never contain file paths
   * 
   * For any error containing file paths, the sanitized version should
   * replace them with placeholders.
   */
  it('should remove file paths from error messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          directory: fc.string({ minLength: 3, maxLength: 10 }),
          filename: fc.string({ minLength: 5, maxLength: 15 }),
        }),
        ({ directory, filename }) => {
          // Create error messages with different path formats
          const unixPath = `/home/user/${directory}/${filename}.ts`;
          const windowsPath = `C:\\Users\\user\\${directory}\\${filename}.ts`;
          
          const unixError = new Error(`File not found: ${unixPath}`);
          const windowsError = new Error(`File not found: ${windowsPath}`);
          
          // Sanitize the messages
          const sanitizedUnix = sanitizeErrorMessage(unixError);
          const sanitizedWindows = sanitizeErrorMessage(windowsError);
          
          // Property: Sanitized messages should not contain original paths
          expect(sanitizedUnix).not.toContain(unixPath);
          expect(sanitizedWindows).not.toContain(windowsPath);
          
          // Property: Sanitized messages should contain placeholder
          expect(sanitizedUnix).toContain('[path]');
          expect(sanitizedWindows).toContain('[path]');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Sanitized messages never contain database table names
   * 
   * For any error mentioning database tables, the sanitized version should
   * replace table names with placeholders.
   */
  it('should remove database table names from error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('tabs', 'tab_orders', 'tab_payments', 'bars', 'users', 'audit_logs'),
        (tableName) => {
          // Create error message with table name
          const errorMessage = `Constraint violation in table ${tableName}`;
          const error = new Error(errorMessage);
          
          // Sanitize the message
          const sanitized = sanitizeErrorMessage(error);
          
          // Property: Sanitized message should not contain table name
          expect(sanitized.toLowerCase()).not.toContain(tableName.toLowerCase());
          
          // Property: Sanitized message should contain placeholder
          expect(sanitized).toContain('[table]');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Sanitized messages never contain PostgreSQL error codes
   * 
   * For any error with PostgreSQL error codes, the sanitized version should
   * replace them with placeholders.
   */
  it('should remove PostgreSQL error codes from error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('23505', '23503', '42501', '42P01', 'P0001'),
        (errorCode) => {
          // Create error message with error code
          const errorMessage = `PostgreSQL error ${errorCode}: Constraint violation`;
          const error = new Error(errorMessage);
          
          // Sanitize the message
          const sanitized = sanitizeErrorMessage(error);
          
          // Property: Sanitized message should not contain error code
          expect(sanitized).not.toContain(errorCode);
          
          // Property: Sanitized message should contain placeholder
          expect(sanitized).toContain('[code]');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Sanitized messages are always non-empty
   * 
   * For any error, the sanitized version should always return a
   * meaningful message, never an empty string.
   */
  it('should always return non-empty sanitized messages', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({})
        ),
        (errorInput) => {
          // Create error from various inputs
          const error = errorInput ? new Error(errorInput.toString()) : new Error();
          
          // Sanitize the message
          const sanitized = sanitizeErrorMessage(error);
          
          // Property: Sanitized message should never be empty
          expect(sanitized).toBeTruthy();
          expect(sanitized.length).toBeGreaterThan(0);
          
          // Property: Sanitized message should be at least 10 characters
          expect(sanitized.length).toBeGreaterThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: fix-close-tab-errors, Property 9: Error Logging Completeness', () => {
  /**
   * Property Test: Error log entries always include required fields
   * 
   * For any error and context, the log entry should always include
   * timestamp, userType, errorType, and errorMessage.
   */
  it('should create complete log entries with all required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 10, maxLength: 100 }),
          userType: fc.constantFrom('customer', 'staff', 'system'),
          tabId: fc.uuid(),
          userId: fc.uuid(),
        }),
        ({ errorMessage, userType, tabId, userId }) => {
          // Create error
          const error = new Error(errorMessage);
          
          // Create log entry
          const logEntry = createErrorLogEntry(error, {
            tabId,
            userId,
            userType: userType as 'customer' | 'staff' | 'system',
          });
          
          // Property: Log entry should have timestamp
          expect(logEntry.timestamp).toBeTruthy();
          expect(new Date(logEntry.timestamp).getTime()).toBeGreaterThan(0);
          
          // Property: Log entry should have userType
          expect(logEntry.userType).toBe(userType);
          
          // Property: Log entry should have errorType
          expect(logEntry.errorType).toBeTruthy();
          expect(['network', 'validation', 'database', 'permission', 'unknown']).toContain(logEntry.errorType);
          
          // Property: Log entry should have errorMessage
          expect(logEntry.errorMessage).toBeTruthy();
          expect(logEntry.errorMessage.length).toBeGreaterThan(0);
          
          // Property: Log entry should have tabId and userId
          expect(logEntry.tabId).toBe(tabId);
          expect(logEntry.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Error categorization is consistent
   * 
   * For any error with specific characteristics, the categorization
   * should always return the same error type.
   */
  it('should consistently categorize errors by type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { code: 'PGRST301', expectedType: 'network' },
          { status: 401, expectedType: 'permission' },
          { status: 400, expectedType: 'validation' },
          { code: 'P0001', expectedType: 'database' }
        ),
        ({ code, status, expectedType }) => {
          // Create error with specific characteristics
          const error: any = new Error('Test error');
          if (code) error.code = code;
          if (status) error.status = status;
          
          // Categorize the error
          const categorized = categorizeError(error);
          
          // Property: Error type should match expected type
          expect(categorized.type).toBe(expectedType);
          
          // Property: Categorization should be idempotent
          const categorized2 = categorizeError(error);
          expect(categorized2.type).toBe(categorized.type);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Retryable errors are correctly identified
   * 
   * For any error, the retryable flag should be consistent with
   * the error type (network and database errors are retryable,
   * validation and permission errors are not).
   */
  it('should correctly identify retryable errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { code: 'PGRST301', shouldRetry: true },
          { status: 401, shouldRetry: false },
          { status: 400, shouldRetry: false },
          { code: 'P0001', shouldRetry: true }
        ),
        ({ code, status, shouldRetry }) => {
          // Create error
          const error: any = new Error('Test error');
          if (code) error.code = code;
          if (status) error.status = status;
          
          // Check if retryable
          const retryable = isRetryableError(error);
          
          // Property: Retryable flag should match expected value
          expect(retryable).toBe(shouldRetry);
          
          // Property: Categorized error should have same retryable flag
          const categorized = categorizeError(error);
          expect(categorized.retryable).toBe(shouldRetry);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: User-facing messages are always safe
   * 
   * For any error, the formatted user message should never contain
   * technical details like SQL, stack traces, or file paths.
   */
  it('should format safe user-facing messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          sqlQuery: fc.string({ minLength: 10, maxLength: 50 }),
          tableName: fc.constantFrom('tabs', 'tab_orders', 'users'),
          context: fc.constantFrom('customer', 'staff'),
        }),
        ({ sqlQuery, tableName, context }) => {
          // Create error with technical details
          const errorMessage = `SELECT * FROM ${tableName} WHERE ${sqlQuery}`;
          const error = new Error(errorMessage);
          
          // Format for user
          const userMessage = formatErrorForUser(error, context as 'customer' | 'staff');
          
          // Property: User message should not contain SQL keywords
          expect(userMessage).not.toMatch(/SELECT\s+.*FROM/i);
          
          // Property: User message should not contain table names
          expect(userMessage.toLowerCase()).not.toContain(tableName.toLowerCase());
          
          // Property: User message should be non-empty
          expect(userMessage.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Log entries preserve original error information
   * 
   * For any error, the log entry should preserve the original error
   * message for debugging purposes while providing a sanitized version
   * for users.
   */
  it('should preserve original error in log entries', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }),
        (originalMessage) => {
          // Create error
          const error = new Error(originalMessage);
          
          // Create log entry
          const logEntry = createErrorLogEntry(error, {
            userType: 'customer',
          });
          
          // Property: Log entry should have original error
          expect(logEntry.originalError).toBeTruthy();
          expect(logEntry.originalError).toContain(originalMessage);
          
          // Property: Error message (for users) may be different from original
          // (it should be sanitized)
          if (originalMessage.includes('SELECT') || originalMessage.includes('FROM')) {
            expect(logEntry.errorMessage).not.toBe(originalMessage);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
