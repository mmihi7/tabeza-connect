/**
 * Network-Aware Onboarding Hook Tests
 * 
 * Tests for the React hook that provides network-aware onboarding operations.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useNetworkAwareOnboarding } from '../useNetworkAwareOnboarding';

// Mock the network-aware onboarding manager
jest.mock('@tabeza/shared/lib/services/onboarding-network-handler', () => ({
  createNetworkAwareOnboardingManager: jest.fn(() => ({
    getNetworkState: jest.fn(() => ({
      isOnline: true,
      isSlowConnection: false,
      queuedOperations: 0,
      lastNetworkChange: Date.now(),
      connectionType: 'wifi',
      effectiveType: '4g'
    })),
    checkOnboardingStatus: jest.fn(),
    completeOnboarding: jest.fn(),
    updateVenueConfiguration: jest.fn(),
    migrateExistingVenue: jest.fn(),
    saveProgress: jest.fn(),
    restoreProgress: jest.fn(),
    clearProgress: jest.fn(),
    processRetryQueue: jest.fn(),
    destroy: jest.fn()
  }))
}));

// Mock the network status manager
jest.mock('@tabeza/shared/lib/services/network-status', () => ({
  getNetworkStatusManager: jest.fn(() => ({
    isOnline: jest.fn(() => true),
    isSlowConnection: jest.fn(() => false),
    getStatus: jest.fn(() => ({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g'
    })),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    testConnectivity: jest.fn(() => Promise.resolve(true)),
    refresh: jest.fn(() => ({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g'
    }))
  }))
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({}))
}));

describe('useNetworkAwareOnboarding', () => {
  const mockManager = {
    getNetworkState: jest.fn(() => ({
      isOnline: true,
      isSlowConnection: false,
      queuedOperations: 0,
      lastNetworkChange: Date.now(),
      connectionType: 'wifi',
      effectiveType: '4g'
    })),
    checkOnboardingStatus: jest.fn(),
    completeOnboarding: jest.fn(),
    updateVenueConfiguration: jest.fn(),
    migrateExistingVenue: jest.fn(),
    saveProgress: jest.fn(),
    restoreProgress: jest.fn(),
    clearProgress: jest.fn(),
    processRetryQueue: jest.fn(),
    destroy: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    const { createNetworkAwareOnboardingManager } = require('@tabeza/shared/lib/services/onboarding-network-handler');
    createNetworkAwareOnboardingManager.mockReturnValue(mockManager);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useNetworkAwareOnboarding());

      expect(result.current.state.isOnline).toBe(true);
      expect(result.current.state.isSlowConnection).toBe(false);
      expect(result.current.state.queuedOperations).toBe(0);
      expect(result.current.state.hasQueuedOperations).toBe(false);
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.hasStoredProgress).toBe(false);
      expect(result.current.state.lastError).toBeNull();
      expect(result.current.state.canRetry).toBe(false);
    });

    it('should initialize with custom options', () => {
      const onNetworkStatusChange = jest.fn();
      const onOperationQueued = jest.fn();

      renderHook(() => useNetworkAwareOnboarding({
        barId: 'test-bar-id',
        autoRestoreProgress: true,
        enableNetworkStatusUpdates: true,
        onNetworkStatusChange,
        onOperationQueued
      }));

      const { createNetworkAwareOnboardingManager } = require('@tabeza/shared/lib/services/onboarding-network-handler');
      
      expect(createNetworkAwareOnboardingManager).toHaveBeenCalledWith(
        expect.any(Object), // supabase client
        expect.objectContaining({
          enableRetryQueue: true,
          maxRetries: 3,
          enableProgressPersistence: true,
          onNetworkStatusChange: expect.any(Function),
          onOperationQueued: expect.any(Function)
        })
      );
    });

    it('should auto-restore progress when enabled', () => {
      const mockProgress = {
        step: 'authority' as const,
        selectedMode: 'venue' as const,
        selectedAuthority: 'pos' as const,
        timestamp: Date.now(),
        barId: 'test-bar-id'
      };

      mockManager.restoreProgress.mockReturnValue(mockProgress);

      const { result } = renderHook(() => useNetworkAwareOnboarding({
        barId: 'test-bar-id',
        autoRestoreProgress: true
      }));

      expect(mockManager.restoreProgress).toHaveBeenCalledWith('test-bar-id');
      expect(result.current.state.storedProgress).toEqual(mockProgress);
    });
  });

  describe('network status updates', () => {
    it('should update network state when status changes', async () => {
      const { result } = renderHook(() => useNetworkAwareOnboarding({
        enableNetworkStatusUpdates: true
      }));

      const { getNetworkStatusManager } = require('@tabeza/shared/lib/services/network-status');
      const mockNetworkManager = getNetworkStatusManager();
      
      // Simulate network status change
      const networkListener = mockNetworkManager.addListener.mock.calls[0][0];
      
      act(() => {
        networkListener({
          isOnline: false,
          connectionType: 'cellular',
          effectiveType: '2g'
        });
      });

      await waitFor(() => {
        expect(result.current.state.networkState.isOnline).toBe(false);
        expect(result.current.state.networkState.connectionType).toBe('cellular');
        expect(result.current.state.networkState.effectiveType).toBe('2g');
      });
    });
  });

  describe('onboarding operations', () => {
    it('should check onboarding status', async () => {
      const mockResult = {
        success: true,
        data: { needsOnboarding: true, venue: null },
        networkStatus: {
          isOnline: true,
          isSlowConnection: false,
          queuedOperations: 0,
          lastNetworkChange: Date.now(),
          connectionType: 'wifi',
          effectiveType: '4g'
        },
        canRetry: false
      };

      mockManager.checkOnboardingStatus.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      let operationResult;
      await act(async () => {
        operationResult = await result.current.actions.checkOnboardingStatus('test-bar-id');
      });

      expect(mockManager.checkOnboardingStatus).toHaveBeenCalledWith('test-bar-id');
      expect(operationResult).toEqual(mockResult);
      expect(result.current.state.lastError).toBeNull();
    });

    it('should complete onboarding', async () => {
      const mockResult = {
        success: true,
        data: { id: 'test-bar-id', name: 'Test Bar' },
        networkStatus: {
          isOnline: true,
          isSlowConnection: false,
          queuedOperations: 0,
          lastNetworkChange: Date.now(),
          connectionType: 'wifi',
          effectiveType: '4g'
        },
        canRetry: false
      };

      mockManager.completeOnboarding.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      const configuration = {
        venue_mode: 'venue' as const,
        authority_mode: 'pos' as const
      };

      let operationResult;
      await act(async () => {
        operationResult = await result.current.actions.completeOnboarding('test-bar-id', configuration);
      });

      expect(mockManager.completeOnboarding).toHaveBeenCalledWith('test-bar-id', configuration);
      expect(operationResult).toEqual(mockResult);
    });

    it('should handle operation errors', async () => {
      const mockResult = {
        success: false,
        error: 'Network connection failed',
        networkStatus: {
          isOnline: false,
          isSlowConnection: false,
          queuedOperations: 1,
          lastNetworkChange: Date.now(),
          connectionType: 'unknown',
          effectiveType: 'unknown'
        },
        canRetry: true
      };

      mockManager.completeOnboarding.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      const configuration = {
        venue_mode: 'venue' as const,
        authority_mode: 'pos' as const
      };

      await act(async () => {
        await result.current.actions.completeOnboarding('test-bar-id', configuration);
      });

      expect(result.current.state.lastError).toBe('Network connection failed');
      expect(result.current.state.canRetry).toBe(true);
      expect(result.current.state.networkState.queuedOperations).toBe(1);
    });

    it('should handle queued operations', async () => {
      const mockResult = {
        success: false,
        error: 'No internet connection. Your setup will be completed automatically when connection is restored.',
        isQueued: true,
        queueId: 'queue-123',
        networkStatus: {
          isOnline: false,
          isSlowConnection: false,
          queuedOperations: 1,
          lastNetworkChange: Date.now(),
          connectionType: 'unknown',
          effectiveType: 'unknown'
        },
        canRetry: true
      };

      mockManager.completeOnboarding.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      const configuration = {
        venue_mode: 'venue' as const,
        authority_mode: 'pos' as const
      };

      let operationResult;
      await act(async () => {
        operationResult = await result.current.actions.completeOnboarding('test-bar-id', configuration);
      });

      expect(operationResult.isQueued).toBe(true);
      expect(operationResult.queueId).toBe('queue-123');
      expect(result.current.state.networkState.queuedOperations).toBe(1);
      expect(result.current.state.hasQueuedOperations).toBe(true);
    });
  });

  describe('progress management', () => {
    it('should save progress', () => {
      const { result } = renderHook(() => useNetworkAwareOnboarding());

      const progress = {
        step: 'authority' as const,
        selectedMode: 'venue' as const,
        selectedAuthority: 'pos' as const,
        timestamp: Date.now(),
        barId: 'test-bar-id'
      };

      act(() => {
        result.current.actions.saveProgress(progress);
      });

      expect(mockManager.saveProgress).toHaveBeenCalledWith(progress);
      expect(result.current.state.storedProgress).toEqual(progress);
    });

    it('should restore progress', () => {
      const mockProgress = {
        step: 'summary' as const,
        selectedMode: 'basic' as const,
        selectedAuthority: 'pos' as const,
        timestamp: Date.now(),
        barId: 'test-bar-id'
      };

      mockManager.restoreProgress.mockReturnValue(mockProgress);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      let restoredProgress;
      act(() => {
        restoredProgress = result.current.actions.restoreProgress('test-bar-id');
      });

      expect(mockManager.restoreProgress).toHaveBeenCalledWith('test-bar-id');
      expect(restoredProgress).toEqual(mockProgress);
      expect(result.current.state.storedProgress).toEqual(mockProgress);
    });

    it('should clear progress', () => {
      const { result } = renderHook(() => useNetworkAwareOnboarding());

      act(() => {
        result.current.actions.clearProgress('test-bar-id');
      });

      expect(mockManager.clearProgress).toHaveBeenCalledWith('test-bar-id');
      expect(result.current.state.storedProgress).toBeNull();
    });
  });

  describe('queue management', () => {
    it('should process retry queue', async () => {
      mockManager.processRetryQueue.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      await act(async () => {
        await result.current.actions.processRetryQueue();
      });

      expect(mockManager.processRetryQueue).toHaveBeenCalled();
    });

    it('should handle queue processing errors', async () => {
      mockManager.processRetryQueue.mockRejectedValue(new Error('Queue processing failed'));

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      await act(async () => {
        await result.current.actions.processRetryQueue();
      });

      expect(result.current.state.lastError).toBe('Queue processing failed');
    });
  });

  describe('error handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useNetworkAwareOnboarding());

      // Set an error first
      act(() => {
        result.current.state.lastError = 'Test error';
        result.current.state.canRetry = true;
      });

      act(() => {
        result.current.actions.clearError();
      });

      expect(result.current.state.lastError).toBeNull();
      expect(result.current.state.canRetry).toBe(false);
    });

    it('should retry last operation', async () => {
      const mockResult = {
        success: true,
        data: { id: 'test-bar-id' },
        networkStatus: {
          isOnline: true,
          isSlowConnection: false,
          queuedOperations: 0,
          lastNetworkChange: Date.now(),
          connectionType: 'wifi',
          effectiveType: '4g'
        },
        canRetry: false
      };

      mockManager.completeOnboarding.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      const configuration = {
        venue_mode: 'venue' as const,
        authority_mode: 'pos' as const
      };

      // First, perform an operation that can be retried
      await act(async () => {
        await result.current.actions.completeOnboarding('test-bar-id', configuration);
      });

      // Then retry it
      await act(async () => {
        await result.current.actions.retry();
      });

      expect(mockManager.completeOnboarding).toHaveBeenCalledTimes(2);
    });
  });

  describe('network testing', () => {
    it('should test connectivity', async () => {
      const { getNetworkStatusManager } = require('@tabeza/shared/lib/services/network-status');
      const mockNetworkManager = getNetworkStatusManager();
      mockNetworkManager.testConnectivity.mockResolvedValue(true);

      const { result } = renderHook(() => useNetworkAwareOnboarding());

      let connectivityResult;
      await act(async () => {
        connectivityResult = await result.current.actions.testConnectivity();
      });

      expect(mockNetworkManager.testConnectivity).toHaveBeenCalled();
      expect(connectivityResult).toBe(true);
    });

    it('should refresh network status', () => {
      const { getNetworkStatusManager } = require('@tabeza/shared/lib/services/network-status');
      const mockNetworkManager = getNetworkStatusManager();
      
      const { result } = renderHook(() => useNetworkAwareOnboarding());

      act(() => {
        result.current.actions.refreshNetworkStatus();
      });

      expect(mockNetworkManager.refresh).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useNetworkAwareOnboarding());

      unmount();

      expect(mockManager.destroy).toHaveBeenCalled();
    });
  });
});