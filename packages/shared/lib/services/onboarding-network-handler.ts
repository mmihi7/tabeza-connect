/**
 * Onboarding Network Handler Service
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Provides network-aware onboarding operations with retry queue support,
 * offline state management, and graceful error handling.
 */

import { 
  getNetworkStatusManager, 
  getRetryQueueManager,
  NetworkStatus,
  NetworkStatusListener
} from './network-status';
import { 
  enqueueOperation,
  registerRetryHandler
} from './retry-queue';
import { 
  completeOnboarding,
  updateVenueConfiguration,
  checkOnboardingStatus,
  migrateExistingVenue,
  saveOnboardingProgress,
  restoreOnboardingProgress,
  clearOnboardingProgress,
  type OnboardingProgress,
  type VenueData,
  type VenueConfigurationInput
} from './onboarding-operations';
import { 
  validateVenueConfiguration,
  type VenueConfiguration
} from './venue-configuration-validation';

export interface NetworkAwareOnboardingOptions {
  enableRetryQueue?: boolean;
  maxRetries?: number;
  enableProgressPersistence?: boolean;
  onNetworkStatusChange?: NetworkStatusListener;
  onOperationQueued?: (operationType: string, operationId: string) => void;
  onOperationRetried?: (operationType: string, attempt: number) => void;
  onOperationCompleted?: (operationType: string, result: any) => void;
}

export interface OnboardingNetworkState {
  isOnline: boolean;
  isSlowConnection: boolean;
  queuedOperations: number;
  lastNetworkChange: number;
  connectionType: string;
  effectiveType: string;
}

export interface NetworkAwareOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isQueued?: boolean;
  queueId?: string;
  networkStatus: OnboardingNetworkState;
  canRetry: boolean;
}

/**
 * Network-Aware Onboarding Manager
 * Handles onboarding operations with network error handling and retry logic
 */
export class NetworkAwareOnboardingManager {
  private networkManager = getNetworkStatusManager();
  private retryQueue = getRetryQueueManager();
  private options: Required<NetworkAwareOnboardingOptions>;
  private supabaseClient: any;
  private lastNetworkChange = Date.now();

  constructor(supabaseClient: any, options: NetworkAwareOnboardingOptions = {}) {
    this.supabaseClient = supabaseClient;
    this.options = {
      enableRetryQueue: options.enableRetryQueue ?? true,
      maxRetries: options.maxRetries || 3,
      enableProgressPersistence: options.enableProgressPersistence ?? true,
      onNetworkStatusChange: options.onNetworkStatusChange || (() => {}),
      onOperationQueued: options.onOperationQueued || (() => {}),
      onOperationRetried: options.onOperationRetried || (() => {}),
      onOperationCompleted: options.onOperationCompleted || (() => {})
    };

    this.setupNetworkHandling();
    this.registerOperationHandlers();
  }

  /**
   * Get current network state
   */
  getNetworkState(): OnboardingNetworkState {
    const status = this.networkManager.getStatus();
    return {
      isOnline: status.isOnline,
      isSlowConnection: this.networkManager.isSlowConnection(),
      queuedOperations: this.retryQueue.getQueueSize(),
      lastNetworkChange: this.lastNetworkChange,
      connectionType: status.connectionType,
      effectiveType: status.effectiveType
    };
  }

  /**
   * Check onboarding status with network awareness
   */
  async checkOnboardingStatus(barId: string): Promise<NetworkAwareOperationResult<{ needsOnboarding: boolean; venue: VenueData | null }>> {
    const networkState = this.getNetworkState();

    if (!networkState.isOnline) {
      return {
        success: false,
        error: 'No internet connection. Please check your connection and try again.',
        networkStatus: networkState,
        canRetry: true
      };
    }

    try {
      const result = await checkOnboardingStatus(this.supabaseClient, barId);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        networkStatus: networkState,
        canRetry: !result.success && result.canRetry
      };
    } catch (error: any) {
      const isNetworkError = this.isNetworkError(error);
      
      return {
        success: false,
        error: isNetworkError 
          ? 'Connection lost while checking venue status. Please try again.'
          : error.message || 'Failed to check onboarding status',
        networkStatus: networkState,
        canRetry: true
      };
    }
  }

  /**
   * Complete onboarding with network awareness and retry queue
   */
  async completeOnboarding(
    barId: string, 
    configuration: VenueConfigurationInput
  ): Promise<NetworkAwareOperationResult<VenueData>> {
    const networkState = this.getNetworkState();

    // Validate configuration first (offline validation)
    const validationResult = validateVenueConfiguration(configuration);
    if (!validationResult.isValid) {
      return {
        success: false,
        error: `Invalid configuration: ${validationResult.errors.join(', ')}`,
        networkStatus: networkState,
        canRetry: false
      };
    }

    if (!networkState.isOnline) {
      // Queue operation for retry when online
      if (this.options.enableRetryQueue) {
        const queueId = enqueueOperation('complete_onboarding', {
          barId,
          configuration
        }, {
          priority: 'high',
          maxRetries: this.options.maxRetries
        });

        this.options.onOperationQueued('complete_onboarding', queueId);

        return {
          success: false,
          error: 'No internet connection. Your setup will be completed automatically when connection is restored.',
          isQueued: true,
          queueId,
          networkStatus: networkState,
          canRetry: true
        };
      } else {
        return {
          success: false,
          error: 'No internet connection. Please check your connection and try again.',
          networkStatus: networkState,
          canRetry: true
        };
      }
    }

    try {
      const result = await completeOnboarding(this.supabaseClient, barId, configuration);
      
      if (result.success) {
        this.options.onOperationCompleted('complete_onboarding', result.data);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        networkStatus: networkState,
        canRetry: !result.success && result.canRetry
      };
    } catch (error: any) {
      const isNetworkError = this.isNetworkError(error);
      
      if (isNetworkError && this.options.enableRetryQueue) {
        // Queue for retry
        const queueId = enqueueOperation('complete_onboarding', {
          barId,
          configuration
        }, {
          priority: 'high',
          maxRetries: this.options.maxRetries
        });

        this.options.onOperationQueued('complete_onboarding', queueId);

        return {
          success: false,
          error: 'Connection lost during setup. Your configuration will be completed automatically when connection is restored.',
          isQueued: true,
          queueId,
          networkStatus: networkState,
          canRetry: true
        };
      }

      return {
        success: false,
        error: isNetworkError 
          ? 'Connection lost during setup. Please try again.'
          : error.message || 'Failed to complete onboarding',
        networkStatus: networkState,
        canRetry: true
      };
    }
  }

  /**
   * Update venue configuration with network awareness
   */
  async updateVenueConfiguration(
    barId: string,
    currentConfig: VenueConfiguration,
    newConfig: VenueConfigurationInput
  ): Promise<NetworkAwareOperationResult<VenueData>> {
    const networkState = this.getNetworkState();

    if (!networkState.isOnline) {
      if (this.options.enableRetryQueue) {
        const queueId = enqueueOperation('update_configuration', {
          barId,
          currentConfig,
          newConfig
        }, {
          priority: 'normal',
          maxRetries: this.options.maxRetries
        });

        this.options.onOperationQueued('update_configuration', queueId);

        return {
          success: false,
          error: 'No internet connection. Your configuration changes will be saved automatically when connection is restored.',
          isQueued: true,
          queueId,
          networkStatus: networkState,
          canRetry: true
        };
      } else {
        return {
          success: false,
          error: 'No internet connection. Please check your connection and try again.',
          networkStatus: networkState,
          canRetry: true
        };
      }
    }

    try {
      const result = await updateVenueConfiguration(this.supabaseClient, barId, currentConfig, newConfig);
      
      if (result.success) {
        this.options.onOperationCompleted('update_configuration', result.data);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        networkStatus: networkState,
        canRetry: !result.success && result.canRetry
      };
    } catch (error: any) {
      const isNetworkError = this.isNetworkError(error);
      
      if (isNetworkError && this.options.enableRetryQueue) {
        const queueId = enqueueOperation('update_configuration', {
          barId,
          currentConfig,
          newConfig
        }, {
          priority: 'normal',
          maxRetries: this.options.maxRetries
        });

        this.options.onOperationQueued('update_configuration', queueId);

        return {
          success: false,
          error: 'Connection lost while saving changes. Your configuration will be updated automatically when connection is restored.',
          isQueued: true,
          queueId,
          networkStatus: networkState,
          canRetry: true
        };
      }

      return {
        success: false,
        error: isNetworkError 
          ? 'Connection lost while saving changes. Please try again.'
          : error.message || 'Failed to update configuration',
        networkStatus: networkState,
        canRetry: true
      };
    }
  }

  /**
   * Migrate existing venue with network awareness
   */
  async migrateExistingVenue(barId: string): Promise<NetworkAwareOperationResult<{ migrationCompleted: boolean; venue: VenueData }>> {
    const networkState = this.getNetworkState();

    if (!networkState.isOnline) {
      if (this.options.enableRetryQueue) {
        const queueId = enqueueOperation('migrate_venue', {
          barId
        }, {
          priority: 'normal',
          maxRetries: this.options.maxRetries
        });

        this.options.onOperationQueued('migrate_venue', queueId);

        return {
          success: false,
          error: 'No internet connection. Venue migration will be completed automatically when connection is restored.',
          isQueued: true,
          queueId,
          networkStatus: networkState,
          canRetry: true
        };
      } else {
        return {
          success: false,
          error: 'No internet connection. Please check your connection and try again.',
          networkStatus: networkState,
          canRetry: true
        };
      }
    }

    try {
      const result = await migrateExistingVenue(this.supabaseClient, barId);
      
      if (result.success) {
        this.options.onOperationCompleted('migrate_venue', result.data);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        networkStatus: networkState,
        canRetry: !result.success && result.canRetry
      };
    } catch (error: any) {
      const isNetworkError = this.isNetworkError(error);
      
      if (isNetworkError && this.options.enableRetryQueue) {
        const queueId = enqueueOperation('migrate_venue', {
          barId
        }, {
          priority: 'normal',
          maxRetries: this.options.maxRetries
        });

        this.options.onOperationQueued('migrate_venue', queueId);

        return {
          success: false,
          error: 'Connection lost during migration. The process will be completed automatically when connection is restored.',
          isQueued: true,
          queueId,
          networkStatus: networkState,
          canRetry: true
        };
      }

      return {
        success: false,
        error: isNetworkError 
          ? 'Connection lost during migration. Please try again.'
          : error.message || 'Failed to migrate venue',
        networkStatus: networkState,
        canRetry: true
      };
    }
  }

  /**
   * Save onboarding progress with network awareness
   */
  saveProgress(progress: OnboardingProgress): void {
    if (this.options.enableProgressPersistence) {
      saveOnboardingProgress(progress);
    }
  }

  /**
   * Restore onboarding progress
   */
  restoreProgress(barId?: string): OnboardingProgress | null {
    if (this.options.enableProgressPersistence) {
      return restoreOnboardingProgress(barId);
    }
    return null;
  }

  /**
   * Clear onboarding progress
   */
  clearProgress(barId?: string): void {
    if (this.options.enableProgressPersistence) {
      clearOnboardingProgress(barId);
    }
  }

  /**
   * Get queued operations count
   */
  getQueuedOperationsCount(): number {
    return this.retryQueue.getQueueSize();
  }

  /**
   * Get queued operations by type
   */
  getQueuedOperations(type?: string): any[] {
    if (type) {
      return this.retryQueue.getOperationsByType(type);
    }
    return this.retryQueue.getAllOperations();
  }

  /**
   * Force process retry queue
   */
  async processRetryQueue(): Promise<void> {
    if (this.networkManager.isOnline()) {
      await this.retryQueue.processNow();
    } else {
      throw new Error('Cannot process retry queue while offline');
    }
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    // Common network error patterns
    const networkErrorPatterns = [
      'fetch',
      'network',
      'connection',
      'timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE'
    ];

    return networkErrorPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
      errorCode.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Setup network status monitoring
   */
  private setupNetworkHandling(): void {
    this.networkManager.addListener((status: NetworkStatus) => {
      this.lastNetworkChange = Date.now();
      this.options.onNetworkStatusChange(status);
      
      if (status.isOnline) {
        console.log('Network restored, processing queued onboarding operations');
      } else {
        console.log('Network lost, onboarding operations will be queued');
      }
    });
  }

  /**
   * Register operation handlers for retry queue
   */
  private registerOperationHandlers(): void {
    if (!this.options.enableRetryQueue) return;

    // Complete onboarding handler
    registerRetryHandler('complete_onboarding', async (data) => {
      this.options.onOperationRetried('complete_onboarding', data.retryCount || 1);
      const result = await completeOnboarding(this.supabaseClient, data.barId, data.configuration);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete onboarding');
      }
      
      this.options.onOperationCompleted('complete_onboarding', result.data);
      return result.data;
    });

    // Update configuration handler
    registerRetryHandler('update_configuration', async (data) => {
      this.options.onOperationRetried('update_configuration', data.retryCount || 1);
      const result = await updateVenueConfiguration(
        this.supabaseClient, 
        data.barId, 
        data.currentConfig, 
        data.newConfig
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update configuration');
      }
      
      this.options.onOperationCompleted('update_configuration', result.data);
      return result.data;
    });

    // Migrate venue handler
    registerRetryHandler('migrate_venue', async (data) => {
      this.options.onOperationRetried('migrate_venue', data.retryCount || 1);
      const result = await migrateExistingVenue(this.supabaseClient, data.barId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to migrate venue');
      }
      
      this.options.onOperationCompleted('migrate_venue', result.data);
      return result.data;
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.retryQueue.destroy();
  }
}

/**
 * Create network-aware onboarding manager
 */
export function createNetworkAwareOnboardingManager(
  supabaseClient: any,
  options?: NetworkAwareOnboardingOptions
): NetworkAwareOnboardingManager {
  return new NetworkAwareOnboardingManager(supabaseClient, options);
}