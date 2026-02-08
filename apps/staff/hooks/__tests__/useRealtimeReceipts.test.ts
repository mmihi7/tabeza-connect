/**
 * Unit Tests: useRealtimeReceipts Hook
 * 
 * Tests for real-time receipt delivery hook including:
 * - Connection establishment
 * - Receipt event handling
 * - Automatic reconnection
 * - Connection status tracking
 * - Manual reconnection
 * - Cleanup and disconnection
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeReceipts, type Receipt, type ConnectionStatus } from '../useRealtimeReceipts';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

// Mock Supabase
const mockRemoveChannel = jest.fn();
const mockSubscribe = jest.fn();
const mockOn = jest.fn();
const mockChannel = jest.fn();

const mockCreateClient = jest.fn(() => ({
  channel: mockChannel,
  removeChannel: mockRemoveChannel
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
  REALTIME_SUBSCRIBE_STATES: {
    SUBSCRIBED: 'SUBSCRIBED',
    CHANNEL_ERROR: 'CHANNEL_ERROR',
    TIMED_OUT: 'TIMED_OUT',
    CLOSED: 'CLOSED'
  }
}));

describe('useRealtimeReceipts', () => {
  const mockOptions = {
    barId: 'test-bar-123',
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key'
  };

  let subscribeCallback: (status: string) => void;
  let receiptCallback: (payload: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock chain
    mockOn.mockImplementation((event, config, callback) => {
      receiptCallback = callback;
      return {
        subscribe: (cb: (status: string) => void) => {
          subscribeCallback = cb;
          mockSubscribe(cb);
          return {};
        }
      };
    });

    mockChannel.mockImplementation(() => ({
      on: mockOn
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Connection Establishment', () => {
    it('should establish Supabase Realtime connection on mount', () => {
      renderHook(() => useRealtimeReceipts(mockOptions));

      expect(mockCreateClient).toHaveBeenCalledWith(
        mockOptions.supabaseUrl,
        mockOptions.supabaseKey,
        expect.objectContaining({
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
      );

      expect(mockChannel).toHaveBeenCalledWith(`unmatched-receipts-${mockOptions.barId}`);
    });

    it('should subscribe to INSERT events on unmatched_receipts table', () => {
      renderHook(() => useRealtimeReceipts(mockOptions));

      expect(mockOn).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'unmatched_receipts',
          filter: `bar_id=eq.${mockOptions.barId}`
        }),
        expect.any(Function)
      );
    });

    it('should filter receipts by bar_id', () => {
      renderHook(() => useRealtimeReceipts(mockOptions));

      const onCall = mockOn.mock.calls[0];
      const config = onCall[1];

      expect(config.filter).toBe(`bar_id=eq.${mockOptions.barId}`);
    });

    it('should start with connecting status', () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      expect(result.current.connectionStatus).toBe('connecting');
      expect(result.current.isConnected).toBe(false);
    });

    it('should update to connected status when subscription succeeds', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('Receipt Event Handling', () => {
    it('should receive and store receipt events', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      // Connect first
      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      const mockReceipt: Receipt = {
        id: 'receipt-1',
        bar_id: mockOptions.barId,
        receipt_data: {
          venueName: 'Test Venue',
          timestamp: '2026-02-07T20:00:00Z',
          items: [
            { name: 'Beer', quantity: 2, unitPrice: 300, total: 600 }
          ],
          subtotal: 600,
          tax: 96,
          total: 696
        },
        status: 'pending',
        created_at: '2026-02-07T20:00:00Z',
        assigned_at: null,
        assigned_to_tab_id: null,
        expires_at: '2026-02-07T21:00:00Z'
      };

      act(() => {
        receiptCallback({ new: mockReceipt });
      });

      await waitFor(() => {
        expect(result.current.receipts).toHaveLength(1);
        expect(result.current.receipts[0]).toEqual(mockReceipt);
      });
    });

    it('should add new receipts to the beginning of the list', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      const receipt1: Receipt = {
        id: 'receipt-1',
        bar_id: mockOptions.barId,
        receipt_data: {
          venueName: 'Test Venue',
          timestamp: '2026-02-07T20:00:00Z',
          items: [],
          subtotal: 100,
          tax: 16,
          total: 116
        },
        status: 'pending',
        created_at: '2026-02-07T20:00:00Z',
        assigned_at: null,
        assigned_to_tab_id: null,
        expires_at: '2026-02-07T21:00:00Z'
      };

      const receipt2: Receipt = {
        ...receipt1,
        id: 'receipt-2',
        created_at: '2026-02-07T20:01:00Z'
      };

      act(() => {
        receiptCallback({ new: receipt1 });
      });

      act(() => {
        receiptCallback({ new: receipt2 });
      });

      await waitFor(() => {
        expect(result.current.receipts).toHaveLength(2);
        expect(result.current.receipts[0].id).toBe('receipt-2'); // Most recent first
        expect(result.current.receipts[1].id).toBe('receipt-1');
      });
    });

    it('should call onReceiptReceived callback when receipt arrives', async () => {
      const onReceiptReceived = jest.fn();
      
      renderHook(() => useRealtimeReceipts({
        ...mockOptions,
        onReceiptReceived
      }));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      const mockReceipt: Receipt = {
        id: 'receipt-1',
        bar_id: mockOptions.barId,
        receipt_data: {
          venueName: 'Test Venue',
          timestamp: '2026-02-07T20:00:00Z',
          items: [],
          subtotal: 100,
          tax: 16,
          total: 116
        },
        status: 'pending',
        created_at: '2026-02-07T20:00:00Z',
        assigned_at: null,
        assigned_to_tab_id: null,
        expires_at: '2026-02-07T21:00:00Z'
      };

      act(() => {
        receiptCallback({ new: mockReceipt });
      });

      await waitFor(() => {
        expect(onReceiptReceived).toHaveBeenCalledWith(mockReceipt);
      });
    });
  });

  describe('Connection Status Tracking', () => {
    it('should update status to error on CHANNEL_ERROR', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
    });

    it('should update status to error on TIMED_OUT', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
    });

    it('should update status to disconnected on CLOSED', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CLOSED);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('disconnected');
      });
    });

    it('should call onConnectionStatusChange callback', async () => {
      const onConnectionStatusChange = jest.fn();
      
      renderHook(() => useRealtimeReceipts({
        ...mockOptions,
        onConnectionStatusChange
      }));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      await waitFor(() => {
        expect(onConnectionStatusChange).toHaveBeenCalledWith('connected');
      });
    });
  });

  describe('Automatic Reconnection', () => {
    it('should schedule reconnection after connection error', async () => {
      const { result } = renderHook(() => useRealtimeReceipts({
        ...mockOptions,
        reconnectInterval: 5000
      }));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });

      // Should transition to reconnecting
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('reconnecting');
      });
    });

    it('should reconnect after 5 seconds by default', async () => {
      renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
      });

      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should have attempted to remove old channel
      await waitFor(() => {
        expect(mockRemoveChannel).toHaveBeenCalled();
      });
    });

    it('should not reconnect if autoReconnect is false', async () => {
      const { result } = renderHook(() => useRealtimeReceipts({
        ...mockOptions,
        autoReconnect: false
      }));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      // Fail first
      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
      });

      // Then succeed
      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });

      // Receiving a receipt should also reset attempts
      const mockReceipt: Receipt = {
        id: 'receipt-1',
        bar_id: mockOptions.barId,
        receipt_data: {
          venueName: 'Test',
          timestamp: '2026-02-07T20:00:00Z',
          items: [],
          subtotal: 100,
          tax: 16,
          total: 116
        },
        status: 'pending',
        created_at: '2026-02-07T20:00:00Z',
        assigned_at: null,
        assigned_to_tab_id: null,
        expires_at: '2026-02-07T21:00:00Z'
      };

      act(() => {
        receiptCallback({ new: mockReceipt });
      });

      // Should not schedule reconnection
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  describe('Manual Reconnection', () => {
    it('should provide reconnect function', () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should cleanup old connection and reconnect', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(mockRemoveChannel).toHaveBeenCalled();
        expect(result.current.connectionStatus).toBe('connecting');
      });
    });
  });

  describe('Disconnection and Cleanup', () => {
    it('should provide disconnect function', () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should disconnect and update status', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      act(() => {
        result.current.disconnect();
      });

      await waitFor(() => {
        expect(mockRemoveChannel).toHaveBeenCalled();
        expect(result.current.connectionStatus).toBe('disconnected');
      });
    });

    it('should not auto-reconnect after manual disconnect', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        result.current.disconnect();
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.connectionStatus).toBe('disconnected');
    });

    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeReceipts(mockOptions));

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it('should provide clearReceipts function', () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      expect(typeof result.current.clearReceipts).toBe('function');
    });

    it('should clear receipts list', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      const mockReceipt: Receipt = {
        id: 'receipt-1',
        bar_id: mockOptions.barId,
        receipt_data: {
          venueName: 'Test',
          timestamp: '2026-02-07T20:00:00Z',
          items: [],
          subtotal: 100,
          tax: 16,
          total: 116
        },
        status: 'pending',
        created_at: '2026-02-07T20:00:00Z',
        assigned_at: null,
        assigned_to_tab_id: null,
        expires_at: '2026-02-07T21:00:00Z'
      };

      act(() => {
        receiptCallback({ new: mockReceipt });
      });

      await waitFor(() => {
        expect(result.current.receipts).toHaveLength(1);
      });

      act(() => {
        result.current.clearReceipts();
      });

      await waitFor(() => {
        expect(result.current.receipts).toHaveLength(0);
      });
    });
  });

  describe('Connection Persistence', () => {
    it('should maintain connection as long as component is mounted', async () => {
      const { result } = renderHook(() => useRealtimeReceipts(mockOptions));

      act(() => {
        subscribeCallback(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      });

      // Simulate time passing
      act(() => {
        jest.advanceTimersByTime(60000); // 1 minute
      });

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected');
      });
    });
  });
});
