/**
 * Unit Tests: Error Logger Utility
 * 
 * Task 6: Comprehensive Error Handling
 * Tests Requirements: 10.4, 14.3
 */

import {
  logError,
  logWarning,
  logInfo,
  logDebug,
  getUserFriendlyErrorMessage,
  getErrorHistory,
  clearErrorHistory,
  addToErrorHistory
} from '../errorLogger';

describe('errorLogger', () => {
  beforeEach(() => {
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
    
    // Clear error history
    clearErrorHistory();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logError', () => {
    it('should log error with component and message', () => {
      const entry = logError('TestComponent', 'Test error message');

      expect(entry.level).toBe('ERROR');
      expect(entry.component).toBe('TestComponent');
      expect(entry.message).toBe('Test error message');
      expect(entry.timestamp).toBeDefined();
      expect(console.error).toHaveBeenCalled();
    });

    it('should include error stack trace', () => {
      const error = new Error('Test error');
      const entry = logError('TestComponent', 'Error occurred', error);

      expect(entry.stack).toBeDefined();
      expect(entry.stack).toContain('Error: Test error');
    });

    it('should include metadata', () => {
      const metadata = { userId: '123', action: 'submit' };
      const entry = logError('TestComponent', 'Error occurred', undefined, metadata);

      expect(entry.metadata).toEqual(metadata);
    });
  });

  describe('logWarning', () => {
    it('should log warning with correct level', () => {
      const entry = logWarning('TestComponent', 'Warning message');

      expect(entry.level).toBe('WARN');
      expect(entry.component).toBe('TestComponent');
      expect(entry.message).toBe('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('logInfo', () => {
    it('should log info with correct level', () => {
      const entry = logInfo('TestComponent', 'Info message');

      expect(entry.level).toBe('INFO');
      expect(entry.component).toBe('TestComponent');
      expect(entry.message).toBe('Info message');
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('logDebug', () => {
    it('should log debug with correct level', () => {
      const entry = logDebug('TestComponent', 'Debug message');

      expect(entry.level).toBe('DEBUG');
      expect(entry.component).toBe('TestComponent');
      expect(entry.message).toBe('Debug message');
      expect(console.debug).toHaveBeenCalled();
    });
  });

  describe('Sensitive Data Redaction', () => {
    it('should redact customer identifiers', () => {
      const message = 'Error for owner_identifier: John Doe';
      const entry = logError('TestComponent', message);

      expect(entry.message).toContain('[REDACTED]');
      expect(entry.message).not.toContain('John Doe');
    });

    it('should redact phone numbers', () => {
      const message = 'Payment from phone_number: +254712345678';
      const entry = logError('TestComponent', message);

      expect(entry.message).toContain('[REDACTED]');
      expect(entry.message).not.toContain('+254712345678');
    });

    it('should redact tokens', () => {
      const message = 'Auth failed with token: abc123xyz';
      const entry = logError('TestComponent', message);

      expect(entry.message).toContain('[REDACTED]');
      expect(entry.message).not.toContain('abc123xyz');
    });

    it('should redact sensitive keys in metadata', () => {
      const metadata = {
        userId: '123',
        password: 'secret123',
        apiKey: 'key-abc-123',
        normalField: 'visible'
      };

      const entry = logError('TestComponent', 'Error', undefined, metadata);

      expect(entry.metadata?.password).toBe('[REDACTED]');
      expect(entry.metadata?.apiKey).toBe('[REDACTED]');
      expect(entry.metadata?.normalField).toBe('visible');
    });

    it('should redact nested sensitive data', () => {
      const metadata = {
        user: {
          id: '123',
          token: 'secret-token',
          name: 'John'
        }
      };

      const entry = logError('TestComponent', 'Error', undefined, metadata);

      expect(entry.metadata?.user.token).toBe('[REDACTED]');
      expect(entry.metadata?.user.name).toBe('John');
    });

    it('should redact sensitive data in arrays', () => {
      const metadata = {
        users: [
          { name: 'John', password: 'pass1' },
          { name: 'Jane', password: 'pass2' }
        ]
      };

      const entry = logError('TestComponent', 'Error', undefined, metadata);

      expect(entry.metadata?.users[0].password).toBe('[REDACTED]');
      expect(entry.metadata?.users[1].password).toBe('[REDACTED]');
      expect(entry.metadata?.users[0].name).toBe('John');
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return friendly message for fetch errors', () => {
      const error = new Error('Failed to fetch');
      const message = getUserFriendlyErrorMessage(error);

      expect(message).toBe('Unable to connect to server. Please check your internet connection.');
    });

    it('should return friendly message for network errors', () => {
      const error = new Error('Network error occurred');
      const message = getUserFriendlyErrorMessage(error);

      expect(message).toBe('Network error occurred. Please try again.');
    });

    it('should return friendly message for not found errors', () => {
      const error = new Error('Resource Not Found');
      const message = getUserFriendlyErrorMessage(error);

      expect(message).toBe('The requested resource was not found.');
    });

    it('should return friendly message for unauthorized errors', () => {
      const error = new Error('Unauthorized access');
      const message = getUserFriendlyErrorMessage(error);

      expect(message).toBe('You are not authorized to perform this action.');
    });

    it('should return friendly message for timeout errors', () => {
      const error = new Error('Request timeout');
      const message = getUserFriendlyErrorMessage(error);

      expect(message).toBe('Request timed out. Please try again.');
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Some random error');
      const message = getUserFriendlyErrorMessage(error);

      expect(message).toBe('Some random error');
    });

    it('should handle non-Error objects', () => {
      const message = getUserFriendlyErrorMessage('string error');

      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('Error History', () => {
    it('should add errors to history', () => {
      const entry = logError('TestComponent', 'Error 1');
      addToErrorHistory(entry);

      const history = getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toBe('Error 1');
    });

    it('should maintain order (newest first)', () => {
      const entry1 = logError('TestComponent', 'Error 1');
      const entry2 = logError('TestComponent', 'Error 2');
      
      addToErrorHistory(entry1);
      addToErrorHistory(entry2);

      const history = getErrorHistory();
      expect(history[0].message).toBe('Error 2');
      expect(history[1].message).toBe('Error 1');
    });

    it('should limit history to 50 entries', () => {
      // Add 60 errors
      for (let i = 0; i < 60; i++) {
        const entry = logError('TestComponent', `Error ${i}`);
        addToErrorHistory(entry);
      }

      const history = getErrorHistory();
      expect(history).toHaveLength(50);
      expect(history[0].message).toBe('Error 59'); // Most recent
      expect(history[49].message).toBe('Error 10'); // 50th most recent
    });

    it('should clear error history', () => {
      const entry = logError('TestComponent', 'Error 1');
      addToErrorHistory(entry);

      expect(getErrorHistory()).toHaveLength(1);

      clearErrorHistory();

      expect(getErrorHistory()).toHaveLength(0);
    });

    it('should return copy of history array', () => {
      const entry = logError('TestComponent', 'Error 1');
      addToErrorHistory(entry);

      const history1 = getErrorHistory();
      const history2 = getErrorHistory();

      expect(history1).not.toBe(history2); // Different array instances
      expect(history1).toEqual(history2); // Same content
    });
  });

  describe('Edge Cases', () => {
    it('should handle null metadata', () => {
      const entry = logError('TestComponent', 'Error', undefined, undefined);

      expect(entry.metadata).toBeUndefined();
    });

    it('should handle empty metadata', () => {
      const entry = logError('TestComponent', 'Error', undefined, {});

      expect(entry.metadata).toEqual({});
    });

    it('should handle error without stack trace', () => {
      const error = { message: 'Error without stack' };
      const entry = logError('TestComponent', 'Error', error as Error);

      expect(entry.stack).toBeUndefined();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const entry = logError('TestComponent', longMessage);

      expect(entry.message).toBe(longMessage);
    });

    it('should handle special characters in messages', () => {
      const message = 'Error with special chars: <>&"\'';
      const entry = logError('TestComponent', message);

      expect(entry.message).toContain('special chars');
    });
  });
});
