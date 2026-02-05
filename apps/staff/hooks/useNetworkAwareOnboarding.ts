/**
 * Network-Aware Onboarding Hook
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * React hook that provides network-aware onboarding operations with
 * retry queue support, offline state management, and progress persistence.
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  createNetworkAwareOnboardingManager,
  NetworkAwareOnboardingManager,
  NetworkAwareOperationResult,
  OnboardingNetworkState,
  type NetworkAwareOnboardingOptions
} from '@tabeza/shared/lib/services/onboarding-network-handler';
import { 
  getNetworkStatusManager,
  NetworkStatus,
  type NetworkStatusListener
} from '@tabeza/shared/lib/services/network-status';
import { 
  type OnboardingProgress,
  type VenueData,
  type VenueConfigurationInput
} from '@tabeza/shared/lib/services/onboarding-operations';
import { type VenueConfiguration } from '@tabeza/shared/lib/services/venue-configuration-validation';

export interface NetworkAwareOnboardingState {
  // Network status
  networkState: OnboardingNetworkState;
  isOnline: boolean;
  isSlowConnection: boolean;
  
  // Operation states
  isProcessing: boolean;
  processingOperation: string | null;
  
  // Queue status
  queuedOperations: number;
  hasQueuedOperations: boolean;
  
  // Progress persistence
  hasStoredProgress: boolean;
  storedProgress: OnboardingProgress | null;
  
  // Error handling
  lastError: string | null;
  canRetry: boolean;
  retryCount: number;
}

export interface NetworkAwareOnboardingActions {
  // Core operations
  checkOnboardingStatus: (barId: string) => Promise<NetworkAwareOperationResult<{ needsOnboarding: boolean; venue: VenueData | null }>>;
  completeOnboarding: (barId: string, configuration: VenueConfigurationInput) => Promise<NetworkAwareOperationResult<VenueData>>;
  updateVenueConfiguration: (barId: string, currentConfig: VenueConfiguration, newConfig: VenueConfigurationInput) => Promise<NetworkAwareOperationResult<VenueData>>;
  migrateExistingVenue: (barId: string) => Promise<NetworkAwareOperationResult<{ migrationCompleted: boolean; venue: VenueData }>>;
  
  // Progress management
  saveProgress: (progress: OnboardingProgress) => void;
  restoreProgress: (barId?: string) => OnboardingProgress | null;
  clearProgress: (barId?: string) => void;
  
  // Queue management
  processRetryQueue: () => Promise<void>;
  clearQueue: () => void;
  
  // Error handling
  clearError: () => void;
  retry: () => Promise<void>;
  
  // Network testing
  testConnectivity: () => Promise<boolean>;
  refreshNetworkStatus: () => void;
}

export interface UseNetworkAwareOnboardingOptions extends NetworkAwareOnboardingOptions {
  barId?: string;
  autoRestoreProgress?: boolean;
  enableNetworkStatusUpdates?: boolean;
}

export interface UseNetworkAwareOnboardingResult {
  state: NetworkAwareOnboardingState;
  actions: NetworkAwareOnboardingActions;
}

/**
 * Hook for network-aware onboarding operations
 */
export function useNetworkAwareOnboarding(
  options: UseNetworkAwareOnboardingOptions = {}
): UseNetworkAwareOnboardingResult {
  const supabaseClient = supabase;
  const managerRef = useRef<NetworkAwareOnboardingManager | null>(null);
  const networkManager = getNetworkStatusManager();
  
  // State
  const [networkState, setNetworkState] = useState<OnboardingNetworkState>(() => ({
    isOnline: networkManager.isOnline(),
    isSlowConnection: networkManager.isSlowConnection(),
    queuedOperations: 0,
    lastNetworkChange: Date.now(),
    connectionType: networkManager.getStatus().connectionType,
    effectiveType: networkManager.getStatus().effectiveType
  }));
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingOperation, setProcessingOperation] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [storedProgress, setStoredProgress] = useState<OnboardingProgress | null>(null);
  
  // Last operation for retry
  const lastOperationRef = useRef<{
    type: string;
    args: any[];
  } | null>(null);

  // Initialize manager
  useEffect(() => {
    const managerOptions: NetworkAwareOnboardingOptions = {
      enableRetryQueue: options.enableRetryQueue ?? true,
      maxRetries: options.maxRetries || 3,
      enableProgressPersistence: options.enableProgressPersistence ?? true,
      
      onNetworkStatusChange: (status: NetworkStatus) => {
        setNetworkState(prev => ({
          ...prev,
          isOnline: status.isOnline,
          isSlowConnection: networkManager.isSlowConnection(),
          lastNetworkChange: Date.now(),
          connectionType: status.connectionType,
          effectiveType: status.effectiveType
        }));
        
        if (options.onNetworkStatusChange) {
          options.onNetworkStatusChange(status);
        }
      },
      
      onOperationQueued: (operationType: string, operationId: string) => {
        setNetworkState(prev => ({
          ...prev,
          queuedOperations: prev.queuedOperations + 1
        }));
        
        if (options.onOperationQueued) {
          options.onOperationQueued(operationType, operationId);
        }
      },
      
      onOperationRetried: (operationType: string, attempt: number) => {
        setRetryCount(attempt);
        
        if (options.onOperationRetried) {
          options.onOperationRetried(operationType, attempt);
        }
      },
      
      onOperationCompleted: (operationType: string, result: any) => {
        setNetworkState(prev => ({
          ...prev,
          queuedOperations: Math.max(0, prev.queuedOperations - 1)
        }));
        setRetryCount(0);
        
        if (options.onOperationCompleted) {
          options.onOperationCompleted(operationType, result);
        }
      }
    };

    managerRef.current = createNetworkAwareOnboardingManager(supabaseClient, managerOptions);
    
    // Update network state from manager
    const updateNetworkState = () => {
      if (managerRef.current) {
        setNetworkState(managerRef.current.getNetworkState());
      }
    };
    
    updateNetworkState();
    
    // Auto-restore progress if enabled
    if (options.autoRestoreProgress && options.barId) {
      const restored = managerRef.current.restoreProgress(options.barId);
      setStoredProgress(restored);
    }

    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, [options.barId]);

  // Network status updates
  useEffect(() => {
    if (!options.enableNetworkStatusUpdates) return;

    const handleNetworkChange: NetworkStatusListener = (status) => {
      setNetworkState(prev => ({
        ...prev,
        isOnline: status.isOnline,
        isSlowConnection: networkManager.isSlowConnection(),
        lastNetworkChange: Date.now(),
        connectionType: status.connectionType,
        effectiveType: status.effectiveType
      }));
    };

    networkManager.addListener(handleNetworkChange);
    
    return () => {
      networkManager.removeListener(handleNetworkChange);
    };
  }, [options.enableNetworkStatusUpdates]);

  // Helper to handle operation results
  const handleOperationResult = useCallback(<T>(
    result: NetworkAwareOperationResult<T>,
    operationType: string,
    args: any[]
  ): NetworkAwareOperationResult<T> => {
    setNetworkState(result.networkStatus);
    setCanRetry(result.canRetry);
    
    if (!result.success) {
      setLastError(result.error || 'Operation failed');
      lastOperationRef.current = { type: operationType, args };
    } else {
      setLastError(null);
      setRetryCount(0);
      lastOperationRef.current = null;
    }
    
    return result;
  }, []);

  // Actions
  const checkOnboardingStatus = useCallback(async (barId: string) => {
    if (!managerRef.current) throw new Error('Manager not initialized');
    
    setIsProcessing(true);
    setProcessingOperation('check_status');
    setLastError(null);
    
    try {
      const result = await managerRef.current.checkOnboardingStatus(barId);
      return handleOperationResult(result, 'checkOnboardingStatus', [barId]);
    } finally {
      setIsProcessing(false);
      setProcessingOperation(null);
    }
  }, [handleOperationResult]);

  const completeOnboarding = useCallback(async (barId: string, configuration: VenueConfigurationInput) => {
    if (!managerRef.current) throw new Error('Manager not initialized');
    
    setIsProcessing(true);
    setProcessingOperation('complete_onboarding');
    setLastError(null);
    
    try {
      const result = await managerRef.current.completeOnboarding(barId, configuration);
      return handleOperationResult(result, 'completeOnboarding', [barId, configuration]);
    } finally {
      setIsProcessing(false);
      setProcessingOperation(null);
    }
  }, [handleOperationResult]);

  const updateVenueConfiguration = useCallback(async (
    barId: string, 
    currentConfig: VenueConfiguration, 
    newConfig: VenueConfigurationInput
  ) => {
    if (!managerRef.current) throw new Error('Manager not initialized');
    
    setIsProcessing(true);
    setProcessingOperation('update_configuration');
    setLastError(null);
    
    try {
      const result = await managerRef.current.updateVenueConfiguration(barId, currentConfig, newConfig);
      return handleOperationResult(result, 'updateVenueConfiguration', [barId, currentConfig, newConfig]);
    } finally {
      setIsProcessing(false);
      setProcessingOperation(null);
    }
  }, [handleOperationResult]);

  const migrateExistingVenue = useCallback(async (barId: string) => {
    if (!managerRef.current) throw new Error('Manager not initialized');
    
    setIsProcessing(true);
    setProcessingOperation('migrate_venue');
    setLastError(null);
    
    try {
      const result = await managerRef.current.migrateExistingVenue(barId);
      return handleOperationResult(result, 'migrateExistingVenue', [barId]);
    } finally {
      setIsProcessing(false);
      setProcessingOperation(null);
    }
  }, [handleOperationResult]);

  const saveProgress = useCallback((progress: OnboardingProgress) => {
    if (!managerRef.current) return;
    
    managerRef.current.saveProgress(progress);
    setStoredProgress(progress);
  }, []);

  const restoreProgress = useCallback((barId?: string) => {
    if (!managerRef.current) return null;
    
    const restored = managerRef.current.restoreProgress(barId);
    setStoredProgress(restored);
    return restored;
  }, []);

  const clearProgress = useCallback((barId?: string) => {
    if (!managerRef.current) return;
    
    managerRef.current.clearProgress(barId);
    setStoredProgress(null);
  }, []);

  const processRetryQueue = useCallback(async () => {
    if (!managerRef.current) return;
    
    setIsProcessing(true);
    setProcessingOperation('process_queue');
    
    try {
      await managerRef.current.processRetryQueue();
      setNetworkState(prev => ({ ...prev, queuedOperations: 0 }));
    } catch (error: any) {
      setLastError(error.message || 'Failed to process retry queue');
    } finally {
      setIsProcessing(false);
      setProcessingOperation(null);
    }
  }, []);

  const clearQueue = useCallback(() => {
    if (!managerRef.current) return;
    
    // Clear the retry queue (this would need to be implemented in the manager)
    setNetworkState(prev => ({ ...prev, queuedOperations: 0 }));
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
    setCanRetry(false);
    setRetryCount(0);
    lastOperationRef.current = null;
  }, []);

  const retry = useCallback(async () => {
    if (!lastOperationRef.current || !canRetry) return;
    
    const { type, args } = lastOperationRef.current;
    
    switch (type) {
      case 'checkOnboardingStatus':
        await checkOnboardingStatus(args[0] as string);
        break;
      case 'completeOnboarding':
        await completeOnboarding(args[0] as string, args[1] as VenueConfigurationInput);
        break;
      case 'updateVenueConfiguration':
        await updateVenueConfiguration(args[0] as string, args[1] as VenueConfiguration, args[2] as VenueConfigurationInput);
        break;
      case 'migrateExistingVenue':
        await migrateExistingVenue(args[0] as string);
        break;
    }
  }, [canRetry, checkOnboardingStatus, completeOnboarding, updateVenueConfiguration, migrateExistingVenue]);

  const testConnectivity = useCallback(async () => {
    return networkManager.testConnectivity();
  }, []);

  const refreshNetworkStatus = useCallback(() => {
    const status = networkManager.refresh();
    setNetworkState(prev => ({
      ...prev,
      isOnline: status.isOnline,
      isSlowConnection: networkManager.isSlowConnection(),
      lastNetworkChange: Date.now(),
      connectionType: status.connectionType,
      effectiveType: status.effectiveType
    }));
  }, []);

  // Computed state
  const state: NetworkAwareOnboardingState = {
    networkState,
    isOnline: networkState.isOnline,
    isSlowConnection: networkState.isSlowConnection,
    isProcessing,
    processingOperation,
    queuedOperations: networkState.queuedOperations,
    hasQueuedOperations: networkState.queuedOperations > 0,
    hasStoredProgress: storedProgress !== null,
    storedProgress,
    lastError,
    canRetry,
    retryCount
  };

  // Memoize actions to prevent infinite loops
  const actions: NetworkAwareOnboardingActions = useMemo(() => ({
    checkOnboardingStatus,
    completeOnboarding,
    updateVenueConfiguration,
    migrateExistingVenue,
    saveProgress,
    restoreProgress,
    clearProgress,
    processRetryQueue,
    clearQueue,
    clearError,
    retry,
    testConnectivity,
    refreshNetworkStatus
  }), [
    checkOnboardingStatus,
    completeOnboarding,
    updateVenueConfiguration,
    migrateExistingVenue,
    saveProgress,
    restoreProgress,
    clearProgress,
    processRetryQueue,
    clearQueue,
    clearError,
    retry,
    testConnectivity,
    refreshNetworkStatus
  ]);

  return { state, actions };
}