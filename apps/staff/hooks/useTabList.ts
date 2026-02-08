/**
 * useTabList Hook
 * Manages fetching and caching of open tabs for receipt assignment
 * 
 * Task 5: Tab List Management and Caching
 * Requirements: 3.1, 6.1, 6.2, 6.5, 12.1, 12.2, 12.3
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Tab {
  id: string;
  tabNumber: number;
  tableNumber?: string;
  customerIdentifier: string;
  openedAt: Date;
  status: 'open' | 'overdue' | 'closed';
}

interface UseTabListOptions {
  venueId: string;
  enabled?: boolean;
  refreshInterval?: number; // in milliseconds, default 30000 (30 seconds)
}

interface UseTabListReturn {
  tabs: Tab[];
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  getCacheAge: () => number;
}

const CACHE_TTL = 30000; // 30 seconds in milliseconds

/**
 * Custom hook for managing tab list with automatic refresh and caching
 * 
 * Features:
 * - Fetches open tabs from API
 * - Stores tabs in React state (no IndexedDB needed per design decision)
 * - Automatic refresh every 30 seconds
 * - Stale data indicator when cache is > 30 seconds old
 * - Loading state management
 * - Error handling
 * - Venue-specific filtering
 */
export function useTabList({
  venueId,
  enabled = true,
  refreshInterval = CACHE_TTL
}: UseTabListOptions): UseTabListReturn {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Calculate if cache is stale (> 30 seconds old)
  const isStale = Date.now() - lastFetchTime > CACHE_TTL;

  // Get cache age in milliseconds
  const getCacheAge = useCallback(() => {
    return Date.now() - lastFetchTime;
  }, [lastFetchTime]);

  // Fetch tabs from API
  const fetchTabs = useCallback(async () => {
    if (!venueId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tabs?venueId=${venueId}&status=open`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tabs: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform API response to Tab interface
      const transformedTabs: Tab[] = (data.tabs || []).map((tab: any) => ({
        id: tab.id,
        tabNumber: tab.tab_number,
        tableNumber: tab.table_number || undefined,
        customerIdentifier: tab.owner_identifier || `Tab #${tab.tab_number}`,
        openedAt: new Date(tab.opened_at),
        status: tab.status
      }));

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setTabs(transformedTabs);
        setLastFetchTime(Date.now());
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error fetching tabs');
        setError(error);
        setIsLoading(false);
        console.error('[useTabList] Error fetching tabs:', error);
      }
    }
  }, [venueId, enabled]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchTabs();
  }, [fetchTabs]);

  // Initial fetch on mount or when venueId changes
  useEffect(() => {
    if (enabled && venueId) {
      fetchTabs();
    }
  }, [enabled, venueId, fetchTabs]);

  // Set up automatic refresh interval
  useEffect(() => {
    if (!enabled || !venueId) return;

    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval for automatic refresh
    refreshIntervalRef.current = setInterval(() => {
      fetchTabs();
    }, refreshInterval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [enabled, venueId, refreshInterval, fetchTabs]);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    tabs,
    isLoading,
    isStale,
    error,
    refresh,
    getCacheAge
  };
}
