/**
 * Real-Time Receipt Delivery Hook
 * 
 * React hook that manages Supabase Realtime connection for receiving
 * POS receipt events in real-time. Handles connection lifecycle,
 * automatic reconnection, and receipt state management.
 * 
 * Task 2: Real-Time Receipt Delivery
 * Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.3
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

// Types
export interface Receipt {
  id: string;
  bar_id: string;
  receipt_data: {
    venueName: string;
    timestamp: string;
    items: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
  };
  status: 'pending' | 'assigned' | 'expired';
  created_at: string;
  assigned_at: string | null;
  assigned_to_tab_id: string | null;
  expires_at: string;
}

export interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface UseRealtimeReceiptsOptions {
  barId: string;
  supabaseUrl: string;
  supabaseKey: string;
  onReceiptReceived?: (receipt: Receipt) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number; // milliseconds
}

export interface UseRealtimeReceiptsResult {
  receipts: Receipt[];
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  reconnect: () => void;
  disconnect: () => void;
  clearReceipts: () => void;
}

/**
 * Hook for managing real-time receipt delivery via Supabase Realtime
 */
export function useRealtimeReceipts(
  options: UseRealtimeReceiptsOptions
): UseRealtimeReceiptsResult {
  const {
    barId,
    supabaseUrl,
    supabaseKey,
    onReceiptReceived,
    onConnectionStatusChange,
    autoReconnect = true,
    reconnectInterval = 5000
  } = options;

  // State
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  
  // Refs
  const supabaseClientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);

  // Update connection status with callback
  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    if (onConnectionStatusChange) {
      onConnectionStatusChange(status);
    }
    
    // Log connection events to console (Requirement 9.5)
    console.log(`[useRealtimeReceipts] Connection status: ${status}`, {
      barId,
      timestamp: new Date().toISOString(),
      reconnectAttempts: reconnectAttemptsRef.current
    });
  }, [barId, onConnectionStatusChange]);

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || isManualDisconnectRef.current) return;
    
    clearReconnectTimeout();
    
    updateConnectionStatus('reconnecting');
    reconnectAttemptsRef.current += 1;
    
    // Reconnect after interval (Requirement 1.4: every 5 seconds)
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`[useRealtimeReceipts] Attempting reconnection (attempt ${reconnectAttemptsRef.current})`);
      
      // Cleanup old channel
      if (channelRef.current) {
        supabaseClientRef.current?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Trigger re-subscription by updating a dependency
      // The useEffect will handle the actual reconnection
    }, reconnectInterval);
  }, [autoReconnect, reconnectInterval, updateConnectionStatus, clearReconnectTimeout]);

  // Disconnect
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();
    
    if (channelRef.current && supabaseClientRef.current) {
      supabaseClientRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    updateConnectionStatus('disconnected');
  }, [clearReconnectTimeout, updateConnectionStatus]);

  // Reconnect manually
  const reconnect = useCallback(() => {
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    // Cleanup existing connection
    if (channelRef.current && supabaseClientRef.current) {
      supabaseClientRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    updateConnectionStatus('connecting');
    
    // The useEffect will handle the actual reconnection
  }, [updateConnectionStatus]);

  // Clear receipts
  const clearReceipts = useCallback(() => {
    setReceipts([]);
  }, []);

  // Main effect: Establish Supabase Realtime connection
  useEffect(() => {
    // Skip if manually disconnected
    if (isManualDisconnectRef.current) return;
    
    // Initialize Supabase client (Requirement 1.1)
    if (!supabaseClientRef.current) {
      supabaseClientRef.current = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }

    const supabase = supabaseClientRef.current;
    
    // Create channel and subscribe to INSERT events (Requirement 1.2)
    const channel = supabase
      .channel(`unmatched-receipts-${barId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'unmatched_receipts',
          filter: `bar_id=eq.${barId}` // Filter by venue (Requirement 12.3)
        },
        (payload) => {
          console.log('[useRealtimeReceipts] Receipt event received:', {
            receiptId: payload.new.id,
            barId: payload.new.bar_id,
            timestamp: new Date().toISOString()
          });
          
          const receipt = payload.new as Receipt;
          
          // Add to receipts list
          setReceipts(prev => [receipt, ...prev]);
          
          // Reset reconnect attempts on successful event
          reconnectAttemptsRef.current = 0;
          
          // Callback
          if (onReceiptReceived) {
            onReceiptReceived(receipt);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeReceipts] Subscription status:', status);
        
        // Map Supabase status to our ConnectionStatus
        switch (status) {
          case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
            updateConnectionStatus('connected');
            reconnectAttemptsRef.current = 0;
            clearReconnectTimeout();
            break;
            
          case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
            updateConnectionStatus('error');
            scheduleReconnect();
            break;
            
          case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
            updateConnectionStatus('error');
            scheduleReconnect();
            break;
            
          case REALTIME_SUBSCRIBE_STATES.CLOSED:
            if (!isManualDisconnectRef.current) {
              updateConnectionStatus('disconnected');
              scheduleReconnect();
            }
            break;
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or dependency change
    return () => {
      clearReconnectTimeout();
      
      if (channelRef.current && supabaseClientRef.current) {
        supabaseClientRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    barId,
    supabaseUrl,
    supabaseKey,
    onReceiptReceived,
    updateConnectionStatus,
    scheduleReconnect,
    clearReconnectTimeout
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    receipts,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    reconnect,
    disconnect,
    clearReceipts
  };
}
