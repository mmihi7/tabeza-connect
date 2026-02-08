/**
 * Subscription Error Handler
 * 
 * Provides graceful error handling for real-time subscriptions.
 * Implements exponential backoff and error recovery strategies.
 * 
 * Requirements: 7, 8, 9, 11
 */

export type SubscriptionErrorType = 
  | 'connection_failed'
  | 'timeout'
  | 'invalid_payload'
  | 'permission_denied'
  | 'network_error'
  | 'unknown';

export interface SubscriptionError {
  type: SubscriptionErrorType;
  message: string;
  timestamp: Date;
  retryable: boolean;
  originalError?: Error;
}

export interface ErrorHandlerOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onError?: (error: SubscriptionError) => void;
  onRetry?: (attempt: number, delay: number) => void;
  onMaxRetriesReached?: () => void;
}

export interface SubscriptionErrorHandler {
  handleError(error: Error, context?: string): SubscriptionError;
  shouldRetry(error: SubscriptionError, attemptCount: number): boolean;
  getRetryDelay(attemptCount: number): number;
  logError(error: SubscriptionError, context?: string): void;
}

class SubscriptionErrorHandlerImpl implements SubscriptionErrorHandler {
  private options: Required<ErrorHandlerOptions>;
  private errorLog: SubscriptionError[] = [];
  private maxLogSize = 50;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 5,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      onError: options.onError ?? (() => {}),
      onRetry: options.onRetry ?? (() => {}),
      onMaxRetriesReached: options.onMaxRetriesReached ?? (() => {})
    };
  }

  handleError(error: Error, context?: string): SubscriptionError {
    const subscriptionError = this.classifyError(error);
    
    this.logError(subscriptionError, context);
    this.options.onError(subscriptionError);
    
    return subscriptionError;
  }

  private classifyError(error: Error): SubscriptionError {
    const message = error.message.toLowerCase();
    
    let type: SubscriptionErrorType = 'unknown';
    let retryable = true;

    if (message.includes('timeout') || message.includes('timed out')) {
      type = 'timeout';
      retryable = true;
    } else if (message.includes('connection') || message.includes('websocket')) {
      type = 'connection_failed';
      retryable = true;
    } else if (message.includes('network') || message.includes('offline')) {
      type = 'network_error';
      retryable = true;
    } else if (message.includes('permission') || message.includes('unauthorized')) {
      type = 'permission_denied';
      retryable = false;
    } else if (message.includes('invalid') || message.includes('malformed')) {
      type = 'invalid_payload';
      retryable = false;
    }

    return {
      type,
      message: error.message,
      timestamp: new Date(),
      retryable,
      originalError: error
    };
  }

  shouldRetry(error: SubscriptionError, attemptCount: number): boolean {
    if (!error.retryable) {
      console.log('❌ Error is not retryable:', error.type);
      return false;
    }

    if (attemptCount >= this.options.maxRetries) {
      console.log('❌ Max retries reached:', attemptCount);
      this.options.onMaxRetriesReached();
      return false;
    }

    return true;
  }

  getRetryDelay(attemptCount: number): number {
    // Exponential backoff: baseDelay * 2^attemptCount
    const exponentialDelay = this.options.baseDelay * Math.pow(2, attemptCount);
    
    // Add jitter (±20%) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
    
    // Cap at maxDelay
    const delay = Math.min(exponentialDelay + jitter, this.options.maxDelay);
    
    console.log(`⏱️ Retry delay for attempt ${attemptCount + 1}: ${Math.round(delay)}ms`);
    this.options.onRetry(attemptCount + 1, delay);
    
    return delay;
  }

  logError(error: SubscriptionError, context?: string): void {
    const logEntry = {
      ...error,
      context
    };

    console.error('🔴 Subscription error:', {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      context,
      timestamp: error.timestamp.toISOString()
    });

    this.errorLog.push(error);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  getErrorLog(): SubscriptionError[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}

/**
 * Factory function to create a SubscriptionErrorHandler instance
 */
export function createSubscriptionErrorHandler(
  options?: ErrorHandlerOptions
): SubscriptionErrorHandler {
  return new SubscriptionErrorHandlerImpl(options);
}

/**
 * Utility function to wrap a subscription handler with error handling
 */
export function withErrorHandling<T>(
  handler: (payload: T) => void,
  errorHandler: SubscriptionErrorHandler,
  context?: string
): (payload: T) => void {
  return (payload: T) => {
    try {
      handler(payload);
    } catch (error) {
      const subscriptionError = errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        context
      );
      
      // Don't throw - let the application continue
      console.error('🔴 Handler error (continuing):', subscriptionError);
    }
  };
}

/**
 * Utility function to validate payload structure
 */
export function validatePayload<T>(
  payload: any,
  requiredFields: string[]
): T {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: not an object');
  }

  for (const field of requiredFields) {
    if (!(field in payload)) {
      throw new Error(`Invalid payload: missing required field "${field}"`);
    }
  }

  return payload as T;
}
