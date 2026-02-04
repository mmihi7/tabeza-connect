/**
 * Database Error Handler Service Tests
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import {
  withDatabaseErrorHandling,
  withOnboardingErrorHandling,
  withVenueConfigErrorHandling,
  withMigrationErrorHandling,
  createUserErrorMessage,
  isTemporaryError,
  isPermanentError,
  type DatabaseOperationResult
} from '../database-error-handler';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeEach(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

describe('Database Error Handler Service', () => {
  describe('withDatabaseErrorHandling', () => {
    it('should return success result for successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ id: '123', name: 'Test' });
      
      const result = await withDatabaseErrorHandling(mockOperation, {
        operationName: 'test_operation'
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', name: 'Test' });
      expect(result.retryCount).toBe(0);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors with exponential backoff', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Connection timeout' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Connection timeout' })
        .mockResolvedValue({ id: '123', name: 'Test' });
      
      const startTime = Date.now();
      const result = await withDatabaseErrorHandling(mockOperation, {
        operationName: 'test_operation',
        retryConfig: {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2
        }
      });
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', name: 'Test' });
      expect(result.retryCount).toBe(2);
      expect(mockOperation).toHaveBeenCalledTimes(3);
      
      // Should have waited for retries (at least 100ms + 200ms = 300ms)
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'unique_violation', message: 'Duplicate key' });
      
      const result = await withDatabaseErrorHandling(mockOperation, {
        operationName: 'test_operation'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Duplicate key');
      expect(result.userMessage).toContain('This item already exists');
      expect(result.shouldRetry).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries for persistent retryable errors', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'ETIMEDOUT', message: 'Connection timeout' });
      
      const result = await withDatabaseErrorHandling(mockOperation, {
        operationName: 'test_operation',
        retryConfig: {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 100,
          backoffMultiplier: 2
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
      expect(result.userMessage).toContain('Database operation timed out');
      expect(result.shouldRetry).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle unknown errors gracefully', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue(new Error('Unknown error'));
      
      const result = await withDatabaseErrorHandling(mockOperation, {
        operationName: 'test_operation'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.userMessage).toContain('An unexpected error occurred');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should include user-friendly context in error messages', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'PGRST103', message: 'Auth failed' });
      
      const result = await withDatabaseErrorHandling(mockOperation, {
        operationName: 'test_operation',
        userFriendlyContext: 'User login'
      });
      
      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('User login:');
      expect(result.userMessage).toContain('Authentication failed');
    });
  });

  describe('withOnboardingErrorHandling', () => {
    it('should use onboarding-specific configuration', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
        .mockResolvedValue({ success: true });
      
      const result = await withOnboardingErrorHandling(
        mockOperation,
        'complete_setup',
        { barId: '123' }
      );
      
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('withVenueConfigErrorHandling', () => {
    it('should use venue config-specific configuration', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'check_violation', message: 'Invalid config' });
      
      const result = await withVenueConfigErrorHandling(
        mockOperation,
        'update_mode',
        { venueId: '123' }
      );
      
      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Venue configuration:');
      expect(result.userMessage).toContain('Invalid data provided');
    });
  });

  describe('withMigrationErrorHandling', () => {
    it('should use migration-specific configuration with conservative retries', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
        .mockRejectedValue({ code: 'ETIMEDOUT', message: 'Timeout' });
      
      const result = await withMigrationErrorHandling(
        mockOperation,
        'migrate_venue',
        { venueId: '123' }
      );
      
      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(2); // Migration uses maxRetries: 2
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('createUserErrorMessage', () => {
    it('should return user message when available', () => {
      const result: DatabaseOperationResult = {
        success: false,
        error: 'Database error',
        userMessage: 'User-friendly message'
      };
      
      const message = createUserErrorMessage(result);
      expect(message).toBe('User-friendly message');
    });

    it('should fall back to error message when user message not available', () => {
      const result: DatabaseOperationResult = {
        success: false,
        error: 'Database error'
      };
      
      const message = createUserErrorMessage(result);
      expect(message).toBe('Database error');
    });

    it('should use fallback message when no error info available', () => {
      const result: DatabaseOperationResult = {
        success: false
      };
      
      const message = createUserErrorMessage(result, 'Custom fallback');
      expect(message).toBe('Custom fallback');
    });

    it('should add retry suggestion for retryable errors', () => {
      const result: DatabaseOperationResult = {
        success: false,
        error: 'Connection failed',
        userMessage: 'Connection failed',
        shouldRetry: true,
        retryCount: 2
      };
      
      const message = createUserErrorMessage(result);
      expect(message).toContain('Connection failed');
      expect(message).toContain('This appears to be a temporary issue');
    });

    it('should return empty string for successful results', () => {
      const result: DatabaseOperationResult = {
        success: true,
        data: { id: '123' }
      };
      
      const message = createUserErrorMessage(result);
      expect(message).toBe('');
    });
  });

  describe('isTemporaryError', () => {
    it('should return true for retryable errors', () => {
      const result: DatabaseOperationResult = {
        success: false,
        shouldRetry: true
      };
      
      expect(isTemporaryError(result)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const result: DatabaseOperationResult = {
        success: false,
        shouldRetry: false
      };
      
      expect(isTemporaryError(result)).toBe(false);
    });

    it('should return false for successful results', () => {
      const result: DatabaseOperationResult = {
        success: true
      };
      
      expect(isTemporaryError(result)).toBe(false);
    });
  });

  describe('isPermanentError', () => {
    it('should return true for non-retryable errors', () => {
      const result: DatabaseOperationResult = {
        success: false,
        shouldRetry: false
      };
      
      expect(isPermanentError(result)).toBe(true);
    });

    it('should return false for retryable errors', () => {
      const result: DatabaseOperationResult = {
        success: false,
        shouldRetry: true
      };
      
      expect(isPermanentError(result)).toBe(false);
    });

    it('should return false for successful results', () => {
      const result: DatabaseOperationResult = {
        success: true
      };
      
      expect(isPermanentError(result)).toBe(false);
    });
  });

  describe('Error code mapping', () => {
    it('should map Supabase connection errors correctly', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'PGRST301', message: 'Connection failed' });
      
      const result = await withDatabaseErrorHandling(mockOperation);
      
      expect(result.userMessage).toContain('Database connection failed');
    });

    it('should map authentication errors correctly', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'PGRST103', message: 'Auth failed' });
      
      const result = await withDatabaseErrorHandling(mockOperation);
      
      expect(result.userMessage).toContain('Authentication failed');
    });

    it('should map validation errors correctly', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'unique_violation', message: 'Duplicate' });
      
      const result = await withDatabaseErrorHandling(mockOperation);
      
      expect(result.userMessage).toContain('This item already exists');
    });

    it('should handle network errors correctly', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValue({ code: 'ECONNREFUSED', message: 'Connection refused' });
      
      const result = await withDatabaseErrorHandling(mockOperation);
      
      expect(result.userMessage).toContain('Unable to connect to the database');
      expect(result.shouldRetry).toBe(true);
    });
  });
});