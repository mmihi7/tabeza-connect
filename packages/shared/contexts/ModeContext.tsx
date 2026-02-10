/**
 * Mode Context Provider
 * Task 4: Mode Context Provider
 * 
 * Provides mode configuration throughout the React component tree using Context API.
 * Fetches configuration on mount and caches it for the session.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ModeConfiguration, FeatureFlag, fetchModeConfig, isFeatureAvailable } from '../services/modeConfigService';

// CORE TRUTH: Manual service always exists.
// Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.

export interface ModeContextValue {
  config: ModeConfiguration | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isFeatureAvailable: (feature: FeatureFlag) => boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

export interface ModeProviderProps {
  barId: string;
  children: React.ReactNode;
}

/**
 * Provider component that fetches and caches mode configuration
 * Wraps the application to provide mode context to all components
 */
export function ModeProvider({ barId, children }: ModeProviderProps): React.JSX.Element {
  const [config, setConfig] = useState<ModeConfiguration | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch mode configuration
  const fetchConfig = useCallback(async () => {
    if (!barId) {
      setError(new Error('Bar ID is required'));
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const modeConfig = await fetchModeConfig(barId);
      setConfig(modeConfig);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch mode configuration');
      setError(error);
      console.error('Error fetching mode config:', error);
    } finally {
      setLoading(false);
    }
  }, [barId]);
  
  // Fetch on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);
  
  // Check if feature is available
  const checkFeatureAvailability = useCallback((feature: FeatureFlag): boolean => {
    if (!config) return false;
    return isFeatureAvailable(config, feature);
  }, [config]);
  
  const value: ModeContextValue = {
    config,
    loading,
    error,
    refetch: fetchConfig,
    isFeatureAvailable: checkFeatureAvailability,
  };
  
  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  );
}

/**
 * Hook to access mode configuration from context
 * @throws Error if used outside ModeProvider
 */
export function useModeConfig(): ModeContextValue {
  const context = useContext(ModeContext);
  
  if (context === undefined) {
    throw new Error('useModeConfig must be used within a ModeProvider');
  }
  
  return context;
}
