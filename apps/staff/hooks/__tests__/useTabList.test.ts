/**
 * Unit Tests: useTabList Hook
 * 
 * Task 5: Tab List Management and Caching
 * Tests Requirements: 3.1, 6.1, 6.2, 6.5, 12.1, 12.2, 12.3
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useTabList } from '../useTabList';

// Mock fetch globally
global.fetch = jest.fn();

describe('useTabList', () => {
  const mockVenueId = 'venue-123';
  
  const mockApiResponse = {
    tabs: [
      {
        id: 'tab-1',
        tab_number: 1,
        table_number: 'A1',
        owner_identifier: 'John Doe',
        opened_at: '2024-01-15T14:00:00.000Z',
        status: 'open'
      },
      {
        id: 'tab-2',
        tab_number: 2,
        table_number: 'B2',
        owner_identifier: 'Jane Smith',
        opened_at: '2024-01-15T14:30:00.000Z',
        status: 'open'
      },
      {
        id: 'tab-3',
        tab_number: 3,
        owner_identifier: 'Bob Johnson',
        opened_at: '2024-01-15T14:45:00.000Z',
        status: 'open'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock successful fetch by default
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Fetch', () => {
    it('should fetch tabs on mount', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.tabs).toEqual([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/tabs?venueId=${mockVenueId}&status=open`
      );
      expect(result.current.tabs).toHaveLength(3);
      expect(result.current.error).toBeNull();
    });

    it('should not fetch when enabled is false', async () => {
      renderHook(() => useTabList({ venueId: mockVenueId, enabled: false }));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not fetch when venueId is empty', async () => {
      renderHook(() => useTabList({ venueId: '' }));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Data Transformation', () => {
    it('should transform API response to Tab interface', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      const firstTab = result.current.tabs[0];
      expect(firstTab).toEqual({
        id: 'tab-1',
        tabNumber: 1,
        tableNumber: 'A1',
        customerIdentifier: 'John Doe',
        openedAt: expect.any(Date),
        status: 'open'
      });
    });

    it('should handle missing table_number', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      const tabWithoutTable = result.current.tabs[2];
      expect(tabWithoutTable.tableNumber).toBeUndefined();
    });

    it('should use fallback for missing owner_identifier', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tabs: [{
            id: 'tab-1',
            tab_number: 42,
            opened_at: '2024-01-15T14:00:00.000Z',
            status: 'open'
          }]
        })
      });

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(1);
      });

      expect(result.current.tabs[0].customerIdentifier).toBe('Tab #42');
    });
  });

  describe('Automatic Refresh', () => {
    it('should refresh tabs every 30 seconds by default', async () => {
      renderHook(() => useTabList({ venueId: mockVenueId }));

      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Advance another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
    });

    it('should use custom refresh interval', async () => {
      renderHook(() => useTabList({ 
        venueId: mockVenueId,
        refreshInterval: 10000 // 10 seconds
      }));

      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear interval on unmount', async () => {
      const { unmount } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Advance time - should not trigger more fetches
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual Refresh', () => {
    it('should allow manual refresh', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Manual refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should update loading state during manual refresh', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start manual refresh
      act(() => {
        result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Cache Staleness', () => {
    it('should mark cache as stale after 30 seconds', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Cache should be fresh initially
      expect(result.current.isStale).toBe(false);

      // Advance time by 31 seconds
      act(() => {
        jest.advanceTimersByTime(31000);
      });

      // Cache should now be stale
      expect(result.current.isStale).toBe(true);
    });

    it('should reset staleness after refresh', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Make cache stale
      act(() => {
        jest.advanceTimersByTime(31000);
      });

      expect(result.current.isStale).toBe(true);

      // Wait for automatic refresh to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Wait for state to update after fetch
      await waitFor(() => {
        expect(result.current.isStale).toBe(false);
      });
    });
  });

  describe('Cache Age', () => {
    it('should return cache age in milliseconds', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Cache age should be close to 0
      expect(result.current.getCacheAge()).toBeLessThan(100);

      // Advance time by 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // Cache age should be around 15 seconds
      expect(result.current.getCacheAge()).toBeGreaterThanOrEqual(15000);
      expect(result.current.getCacheAge()).toBeLessThan(16000);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
      expect(result.current.tabs).toEqual([]);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Not Found');
    });

    it('should clear error on successful retry', async () => {
      // First call fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });

      // Second call succeeds (automatic refresh)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.tabs).toHaveLength(3);
      });
    });
  });

  describe('Venue Filtering', () => {
    it('should include venueId in API request', async () => {
      renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/tabs?venueId=${mockVenueId}&status=open`
        );
      });
    });

    it('should refetch when venueId changes', async () => {
      const { rerender } = renderHook(
        ({ venueId }) => useTabList({ venueId }),
        { initialProps: { venueId: 'venue-1' } }
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tabs?venueId=venue-1&status=open');
      });

      // Change venueId
      rerender({ venueId: 'venue-2' });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tabs?venueId=venue-2&status=open');
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Loading State', () => {
    it('should set loading to true during fetch', async () => {
      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set loading to false after error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Empty State', () => {
    it('should handle empty tab list', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tabs: [] })
      });

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tabs).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle missing tabs property', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const { result } = renderHook(() => useTabList({ venueId: mockVenueId }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.tabs).toEqual([]);
    });
  });
});
