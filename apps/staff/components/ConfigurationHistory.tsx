/**
 * Configuration History Display Component
 * Implements Task 10.2: Add configuration history display
 * Requirements: 7.5
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This component displays venue configuration history with timestamps,
 * change details, and audit trail information for troubleshooting.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Filter, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Info,
  User,
  Calendar,
  Settings,
  RefreshCw
} from 'lucide-react';
import {
  getVenueConfigurationHistory,
  getConfigurationTimestamps,
  type FormattedHistoryEntry,
  type ConfigurationHistoryEventType,
  type HistoryQueryOptions
} from '@tabeza/shared/lib/services/configuration-history';

interface ConfigurationHistoryProps {
  barId: string;
  className?: string;
  showTimestamps?: boolean;
  maxEntries?: number;
  compact?: boolean;
}

interface FilterOptions {
  eventTypes: ConfigurationHistoryEventType[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  searchTerm: string;
}

export function ConfigurationHistory({
  barId,
  className = '',
  showTimestamps = true,
  maxEntries = 50,
  compact = false
}: ConfigurationHistoryProps) {
  // State management
  const [historyEntries, setHistoryEntries] = useState<FormattedHistoryEntry[]>([]);
  const [timestamps, setTimestamps] = useState<{
    authorityConfiguredAt?: Date;
    modeLastChangedAt?: Date;
    onboardingCompletedAt?: Date;
    lastValidationFailure?: Date;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    eventTypes: [],
    dateRange: {},
    searchTerm: ''
  });

  // Load configuration history
  const loadHistory = async (options?: Partial<HistoryQueryOptions>) => {
    try {
      setLoading(true);
      setError(null);

      const queryOptions: HistoryQueryOptions = {
        barId,
        limit: maxEntries,
        ...options
      };

      // Apply filters
      if (filters.eventTypes.length > 0) {
        queryOptions.eventTypes = filters.eventTypes;
      }
      if (filters.dateRange.start) {
        queryOptions.startDate = filters.dateRange.start;
      }
      if (filters.dateRange.end) {
        queryOptions.endDate = filters.dateRange.end;
      }

      const result = await getVenueConfigurationHistory(barId, queryOptions);
      
      // Apply search filter client-side
      let filteredEntries = result.entries;
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredEntries = result.entries.filter(entry =>
          entry.title.toLowerCase().includes(searchLower) ||
          entry.description.toLowerCase().includes(searchLower) ||
          Object.values(entry.details).some(detail => 
            detail && detail.toString().toLowerCase().includes(searchLower)
          )
        );
      }

      setHistoryEntries(filteredEntries);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);

      // Load timestamps if requested
      if (showTimestamps) {
        const timestampData = await getConfigurationTimestamps(barId);
        setTimestamps(timestampData);
      }

    } catch (err) {
      console.error('Error loading configuration history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configuration history');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [barId, maxEntries]);

  // Reload when filters change
  useEffect(() => {
    loadHistory();
  }, [filters]);

  // Toggle entry expansion
  const toggleEntryExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  // Get severity icon and color
  const getSeverityDisplay = (severity: FormattedHistoryEntry['severity']) => {
    switch (severity) {
      case 'success':
        return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'warning':
        return { icon: AlertCircle, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'error':
        return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' };
      default:
        return { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50' };
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Event type options for filter
  const eventTypeOptions: { value: ConfigurationHistoryEventType; label: string }[] = [
    { value: 'onboarding_completed', label: 'Onboarding Completed' },
    { value: 'configuration_changed', label: 'Configuration Changed' },
    { value: 'configuration_validation_failed', label: 'Validation Failed' },
    { value: 'configuration_migration_completed', label: 'Migration Completed' },
    { value: 'configuration_reset', label: 'Configuration Reset' },
    { value: 'admin_override_applied', label: 'Admin Override' },
    { value: 'recovery_operation_completed', label: 'Recovery Completed' }
  ];

  if (loading && historyEntries.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Clock size={20} className="text-gray-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Configuration History</h3>
            <p className="text-sm text-gray-500">Loading audit trail...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <XCircle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Configuration History</h3>
            <p className="text-sm text-gray-500">Error loading history</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
          <button
            onClick={() => loadHistory()}
            className="mt-2 text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Clock size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Configuration History</h3>
            <p className="text-sm text-gray-500">
              {totalCount > 0 ? `${historyEntries.length} of ${totalCount} events` : 'Audit trail and change history'}
            </p>
          </div>
        </div>
        
        {!compact && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <Filter size={16} />
              Filters
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={() => loadHistory()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Configuration Timestamps */}
      {showTimestamps && Object.keys(timestamps).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Calendar size={16} />
            Key Configuration Dates
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {timestamps.onboardingCompletedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Onboarding Completed:</span>
                <span className="font-medium text-gray-800">
                  {timestamps.onboardingCompletedAt.toLocaleDateString()} at {timestamps.onboardingCompletedAt.toLocaleTimeString()}
                </span>
              </div>
            )}
            {timestamps.authorityConfiguredAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Authority Configured:</span>
                <span className="font-medium text-gray-800">
                  {timestamps.authorityConfiguredAt.toLocaleDateString()} at {timestamps.authorityConfiguredAt.toLocaleTimeString()}
                </span>
              </div>
            )}
            {timestamps.modeLastChangedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Last Mode Change:</span>
                <span className="font-medium text-gray-800">
                  {timestamps.modeLastChangedAt.toLocaleDateString()} at {timestamps.modeLastChangedAt.toLocaleTimeString()}
                </span>
              </div>
            )}
            {timestamps.lastValidationFailure && (
              <div className="flex justify-between">
                <span className="text-gray-600">Last Validation Failure:</span>
                <span className="font-medium text-red-600">
                  {timestamps.lastValidationFailure.toLocaleDateString()} at {timestamps.lastValidationFailure.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && !compact && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Events</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                placeholder="Search by title, description, or details..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Event Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Types</label>
            <div className="flex flex-wrap gap-2">
              {eventTypeOptions.map(option => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.eventTypes.includes(option.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters({
                          ...filters,
                          eventTypes: [...filters.eventTypes, option.value]
                        });
                      } else {
                        setFilters({
                          ...filters,
                          eventTypes: filters.eventTypes.filter(t => t !== option.value)
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    start: e.target.value ? new Date(e.target.value) : undefined
                  }
                })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: {
                    ...filters.dateRange,
                    end: e.target.value ? new Date(e.target.value) : undefined
                  }
                })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex justify-end">
            <button
              onClick={() => setFilters({ eventTypes: [], dateRange: {}, searchTerm: '' })}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* History Entries */}
      <div className="space-y-4">
        {historyEntries.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-800 mb-2">No Configuration History</h4>
            <p className="text-gray-600 text-sm">
              {filters.searchTerm || filters.eventTypes.length > 0 || filters.dateRange.start || filters.dateRange.end
                ? 'No events match your current filters.'
                : 'Configuration events will appear here as they occur.'}
            </p>
          </div>
        ) : (
          historyEntries.map((entry) => {
            const { icon: SeverityIcon, color, bgColor } = getSeverityDisplay(entry.severity);
            const isExpanded = expandedEntries.has(entry.id);
            const hasDetails = Object.keys(entry.details).length > 0;

            return (
              <div key={entry.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className={`p-4 ${bgColor} border-l-4 ${color.replace('text-', 'border-')}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex-shrink-0 mt-0.5">
                        <SeverityIcon size={20} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-800 text-sm">
                            {entry.icon} {entry.title}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{entry.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{entry.timestamp.toLocaleString()}</span>
                          {entry.user && (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              User ID: {entry.user.id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {hasDetails && (
                      <button
                        onClick={() => toggleEntryExpansion(entry.id)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && hasDetails && (
                  <div className="bg-white p-4 border-t border-gray-200">
                    <div className="space-y-3 text-sm">
                      {entry.details.configurationBefore && (
                        <div>
                          <span className="font-medium text-gray-700">Configuration Before:</span>
                          <p className="text-gray-600 mt-1 pl-4 border-l-2 border-gray-200">
                            {entry.details.configurationBefore}
                          </p>
                        </div>
                      )}
                      
                      {entry.details.configurationAfter && (
                        <div>
                          <span className="font-medium text-gray-700">Configuration After:</span>
                          <p className="text-gray-600 mt-1 pl-4 border-l-2 border-green-200">
                            {entry.details.configurationAfter}
                          </p>
                        </div>
                      )}
                      
                      {entry.details.changeReason && (
                        <div>
                          <span className="font-medium text-gray-700">Change Reason:</span>
                          <p className="text-gray-600 mt-1">{entry.details.changeReason}</p>
                        </div>
                      )}
                      
                      {entry.details.userContext && (
                        <div>
                          <span className="font-medium text-gray-700">User Context:</span>
                          <p className="text-gray-600 mt-1">{entry.details.userContext}</p>
                        </div>
                      )}
                      
                      {entry.details.errorDetails && (
                        <div>
                          <span className="font-medium text-red-700">Error Details:</span>
                          <p className="text-red-600 mt-1 bg-red-50 p-2 rounded border border-red-200">
                            {entry.details.errorDetails}
                          </p>
                        </div>
                      )}
                      
                      {entry.details.duration && (
                        <div>
                          <span className="font-medium text-gray-700">Duration:</span>
                          <p className="text-gray-600 mt-1">{entry.details.duration}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {hasMore && !compact && (
        <div className="text-center mt-6">
          <button
            onClick={() => loadHistory({ offset: historyEntries.length })}
            disabled={loading}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More Events'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ConfigurationHistory;