/**
 * ConnectionStatusIndicator Component
 * Displays connection status with color-coded indicator
 * 
 * Task 6: Comprehensive Error Handling
 * Requirements: 9.1, 9.2, 9.3
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import React from 'react';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  className?: string;
  showLabel?: boolean;
}

/**
 * Connection status indicator component
 * 
 * Features:
 * - Green dot for connected
 * - Yellow dot for reconnecting
 * - Red dot for disconnected
 * - Optional text label
 * - Pulsing animation for reconnecting state
 */
export function ConnectionStatusIndicator({
  status,
  className = '',
  showLabel = false
}: ConnectionStatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const isPulsing = status === 'reconnecting';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div
          className={`w-3 h-3 rounded-full ${getStatusColor()} ${
            isPulsing ? 'animate-pulse' : ''
          }`}
          title={getStatusLabel()}
        />
        {isPulsing && (
          <div
            className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor()} opacity-50 animate-ping`}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getStatusLabel()}
        </span>
      )}
    </div>
  );
}
