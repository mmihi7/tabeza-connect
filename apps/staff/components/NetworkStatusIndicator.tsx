/**
 * Network Status Indicator Component
 * 
 * Displays current network status and queued operations during onboarding.
 * Provides clear feedback about connectivity and pending operations.
 */

'use client';

import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  SignalLow, 
  SignalMedium, 
  SignalHigh,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { OnboardingNetworkState } from '@tabeza/shared/lib/services/onboarding-network-handler';

export interface NetworkStatusIndicatorProps {
  networkState: OnboardingNetworkState;
  queuedOperations?: number;
  isProcessing?: boolean;
  processingOperation?: string | null;
  onRetryQueue?: () => void;
  onRefreshStatus?: () => void;
  className?: string;
  compact?: boolean;
}

export function NetworkStatusIndicator({
  networkState,
  queuedOperations = 0,
  isProcessing = false,
  processingOperation = null,
  onRetryQueue,
  onRefreshStatus,
  className = '',
  compact = false
}: NetworkStatusIndicatorProps) {
  const { isOnline, isSlowConnection, connectionType, effectiveType } = networkState;

  // Get connection strength icon
  const getConnectionIcon = () => {
    if (!isOnline) {
      return <WifiOff size={16} className="text-red-500" />;
    }

    if (connectionType === 'wifi') {
      return <Wifi size={16} className="text-green-500" />;
    }

    // For cellular connections, show signal strength
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        return <SignalLow size={16} className="text-yellow-500" />;
      case '3g':
        return <SignalMedium size={16} className="text-yellow-500" />;
      case '4g':
        return <SignalHigh size={16} className="text-green-500" />;
      default:
        return <Signal size={16} className="text-gray-500" />;
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600 bg-red-50 border-red-200';
    if (isSlowConnection) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (queuedOperations > 0) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  // Get status message
  const getStatusMessage = () => {
    if (isProcessing && processingOperation) {
      const operationNames: Record<string, string> = {
        'check_status': 'Checking venue status',
        'complete_onboarding': 'Completing setup',
        'update_configuration': 'Saving configuration',
        'migrate_venue': 'Migrating venue',
        'process_queue': 'Processing queued operations'
      };
      
      return operationNames[processingOperation] || 'Processing';
    }

    if (!isOnline) {
      return queuedOperations > 0 
        ? `Offline - ${queuedOperations} operation${queuedOperations === 1 ? '' : 's'} queued`
        : 'Offline - Changes will be saved when connection is restored';
    }

    if (queuedOperations > 0) {
      return `${queuedOperations} operation${queuedOperations === 1 ? '' : 's'} queued`;
    }

    if (isSlowConnection) {
      return 'Slow connection detected';
    }

    return 'Connected';
  };

  // Get connection type display
  const getConnectionTypeDisplay = () => {
    if (!isOnline) return 'Offline';
    
    const typeMap: Record<string, string> = {
      'wifi': 'Wi-Fi',
      'cellular': 'Cellular',
      'ethernet': 'Ethernet',
      'unknown': 'Connected'
    };
    
    const type = typeMap[connectionType] || 'Connected';
    
    if (connectionType === 'cellular' && effectiveType !== 'unknown') {
      return `${type} (${effectiveType.toUpperCase()})`;
    }
    
    return type;
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs ${getStatusColor()} ${className}`}>
        {isProcessing ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          getConnectionIcon()
        )}
        <span className="font-medium">
          {isProcessing ? 'Processing...' : isOnline ? 'Online' : 'Offline'}
        </span>
        {queuedOperations > 0 && (
          <span className="bg-white bg-opacity-70 px-1 rounded text-xs font-medium">
            {queuedOperations}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {isProcessing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              getConnectionIcon()
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">
                {getStatusMessage()}
              </h4>
              
              {queuedOperations > 0 && !isProcessing && (
                <div className="flex items-center gap-1 text-xs bg-white bg-opacity-70 px-2 py-1 rounded">
                  <Clock size={12} />
                  <span>{queuedOperations} queued</span>
                </div>
              )}
            </div>
            
            <p className="text-xs opacity-75 mt-1">
              {getConnectionTypeDisplay()}
              {isSlowConnection && isOnline && ' • Slow connection'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Refresh button */}
          {onRefreshStatus && (
            <button
              onClick={onRefreshStatus}
              disabled={isProcessing}
              className="p-1 rounded hover:bg-white hover:bg-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh network status"
            >
              <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Retry queue button */}
          {queuedOperations > 0 && isOnline && onRetryQueue && (
            <button
              onClick={onRetryQueue}
              disabled={isProcessing}
              className="text-xs px-2 py-1 bg-white bg-opacity-70 rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title="Process queued operations now"
            >
              Process Now
            </button>
          )}
        </div>
      </div>

      {/* Additional info for queued operations */}
      {queuedOperations > 0 && !isOnline && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Operations queued for retry</p>
              <p className="opacity-75 mt-1">
                Your changes will be saved automatically when internet connection is restored.
                You can continue working - all progress is preserved locally.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success message for completed operations */}
      {queuedOperations === 0 && isOnline && !isProcessing && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <CheckCircle size={14} />
          <span>All operations completed successfully</span>
        </div>
      )}
    </div>
  );
}