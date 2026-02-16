/**
 * Printer Drivers List Component
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Displays active printer drivers for a venue with real-time status updates.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Clock } from 'lucide-react';
import { getActiveDrivers, getAllDrivers, getDriverStatus, type PrinterDriver } from '@tabeza/shared';

interface PrinterDriversListProps {
  barId: string;
  showInactive?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function PrinterDriversList({
  barId,
  showInactive = false,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: PrinterDriversListProps) {
  const [drivers, setDrivers] = useState<PrinterDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(showInactive);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDrivers = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const result = showAll 
        ? await getAllDrivers(barId)
        : await getActiveDrivers(barId);

      if (result.error) {
        throw result.error;
      }

      setDrivers(result.data || []);
    } catch (err) {
      console.error('Error fetching printer drivers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch drivers');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [barId, showAll]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchDrivers, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, barId, showAll]);

  const toggleShowAll = () => {
    setShowAll(!showAll);
  };

  if (loading && !isRefreshing) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading drivers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Error loading drivers</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        <button
          onClick={fetchDrivers}
          className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm text-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-lg">
            Printer Drivers {showAll ? '(All)' : '(Active)'}
          </h3>
          {drivers.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
              {drivers.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleShowAll}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            title={showAll ? 'Show active only' : 'Show all drivers'}
          >
            {showAll ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAll ? 'Active Only' : 'Show All'}
          </button>

          <button
            onClick={fetchDrivers}
            disabled={isRefreshing}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Drivers List */}
      {drivers.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <Printer className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">
            {showAll ? 'No printer drivers found' : 'No active printer drivers'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {showAll 
              ? 'Install and start the Tabeza Printer Service to connect'
              : 'Active drivers will appear here when connected'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map((driver) => {
            const status = getDriverStatus(driver);
            
            return (
              <div
                key={driver.id}
                className={`p-4 rounded-lg border transition ${
                  status.isActive
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${
                      status.isActive ? 'bg-green-100' : 'bg-gray-200'
                    }`}>
                      <Printer className={`w-5 h-5 ${
                        status.isActive ? 'text-green-600' : 'text-gray-500'
                      }`} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {status.isActive ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <h4 className="font-medium text-gray-900">
                          {driver.driver_id}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          status.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {status.statusText}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Last heartbeat: {status.timeSince}</span>
                        </div>
                        <div>Version: {driver.version}</div>
                        {driver.metadata && Object.keys(driver.metadata).length > 0 && (
                          <div className="text-xs text-gray-500">
                            {JSON.stringify(driver.metadata)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
