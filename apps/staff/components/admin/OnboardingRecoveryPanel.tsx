// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Settings, Database, Zap } from 'lucide-react';

interface RecoveryStats {
  total: number;
  completed: number;
  incomplete: number;
  invalid: number;
  basic: number;
  venue: number;
  pos: number;
  tabeza: number;
}

interface VenueIssue {
  id: string;
  name: string;
  slug?: string;
  issues: string[];
  venue_mode?: string;
  authority_mode?: string;
  onboarding_completed?: boolean;
}

interface RecoveryResult {
  incompleteVenues: VenueIssue[];
  invalidVenues: VenueIssue[];
  stats: RecoveryStats;
}

/**
 * Admin panel for onboarding recovery operations
 * Requirements: 6.5
 */
export default function OnboardingRecoveryPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [venueMode, setVenueMode] = useState<'basic' | 'venue'>('venue');
  const [authorityMode, setAuthorityMode] = useState<'pos' | 'tabeza'>('tabeza');
  const [dryRun, setDryRun] = useState(true);

  /**
   * Diagnose venues needing recovery
   */
  const diagnoseVenues = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/onboarding-recovery?operation=diagnose');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'Failed to diagnose venues');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset single venue configuration
   */
  const resetSingleVenue = async () => {
    if (!selectedVenue) {
      setError('Please select a venue to reset');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/onboarding-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'reset-single',
          venueId: selectedVenue,
          venueMode,
          authorityMode,
          dryRun
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      // Refresh diagnosis after successful reset
      if (!dryRun) {
        await diagnoseVenues();
      }
      
      alert(`Venue reset ${dryRun ? 'preview' : 'completed'} successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to reset venue');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Bulk reset incomplete venues
   */
  const resetBulkVenues = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/onboarding-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'reset-bulk',
          venueMode,
          authorityMode,
          dryRun
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      // Refresh diagnosis after successful reset
      if (!dryRun) {
        await diagnoseVenues();
      }
      
      alert(`Bulk reset ${dryRun ? 'preview' : 'completed'} successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk reset venues');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fix invalid configurations
   */
  const fixConfigurations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/onboarding-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'fix-configs',
          dryRun
        })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      // Refresh diagnosis after successful fix
      if (!dryRun) {
        await diagnoseVenues();
      }
      
      alert(`Configuration fixes ${dryRun ? 'preview' : 'completed'} successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to fix configurations');
    } finally {
      setLoading(false);
    }
  };

  // Load initial diagnosis on mount
  useEffect(() => {
    diagnoseVenues();
  }, []);

  const hasIssues = result && (result.stats.incomplete > 0 || result.stats.invalid > 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Onboarding Recovery Panel
            </h2>
          </div>
          <button
            onClick={diagnoseVenues}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Statistics Overview */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.stats.total}</div>
              <div className="text-sm text-gray-600">Total Venues</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.stats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{result.stats.incomplete}</div>
              <div className="text-sm text-gray-600">Incomplete</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.stats.invalid}</div>
              <div className="text-sm text-gray-600">Invalid</div>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="mb-6">
          {loading ? (
            <div className="flex items-center space-x-2 text-blue-600">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Checking venue configurations...</span>
            </div>
          ) : hasIssues ? (
            <div className="flex items-center space-x-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Some venues need attention</span>
            </div>
          ) : result ? (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>All venues have valid configurations</span>
            </div>
          ) : null}
        </div>

        {/* Recovery Controls */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recovery Operations</h3>
          
          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Venue Mode
              </label>
              <select
                value={venueMode}
                onChange={(e) => setVenueMode(e.target.value as 'basic' | 'venue')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="venue">Venue (Full Service)</option>
                <option value="basic">Basic (POS Bridge)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Authority Mode
              </label>
              <select
                value={authorityMode}
                onChange={(e) => setAuthorityMode(e.target.value as 'pos' | 'tabeza')}
                disabled={venueMode === 'basic'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="tabeza">Tabeza Authority</option>
                <option value="pos">POS Authority</option>
              </select>
              {venueMode === 'basic' && (
                <p className="text-xs text-gray-500 mt-1">Basic mode requires POS authority</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Execution Mode
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={dryRun}
                    onChange={() => setDryRun(true)}
                    className="mr-2"
                  />
                  <span className="text-sm">Dry Run</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!dryRun}
                    onChange={() => setDryRun(false)}
                    className="mr-2"
                  />
                  <span className="text-sm">Execute</span>
                </label>
              </div>
            </div>
          </div>

          {/* Single Venue Reset */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Reset Single Venue</h4>
            <div className="flex items-center space-x-4">
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a venue...</option>
                {result?.incompleteVenues.map(venue => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} (Incomplete)
                  </option>
                ))}
                {result?.invalidVenues.map(venue => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} (Invalid)
                  </option>
                ))}
              </select>
              <button
                onClick={resetSingleVenue}
                disabled={loading || !selectedVenue}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Reset Venue
              </button>
            </div>
          </div>

          {/* Bulk Operations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={resetBulkVenues}
              disabled={loading || !result?.stats.incomplete}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              <span>Reset Incomplete Venues ({result?.stats.incomplete || 0})</span>
            </button>
            
            <button
              onClick={fixConfigurations}
              disabled={loading || !result?.stats.invalid}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              <span>Fix Invalid Configs ({result?.stats.invalid || 0})</span>
            </button>
          </div>
        </div>

        {/* Issue Details */}
        {result && (result.incompleteVenues.length > 0 || result.invalidVenues.length > 0) && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Venue Issues</h3>
            
            {result.incompleteVenues.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-yellow-600 mb-3">
                  Incomplete Onboarding ({result.incompleteVenues.length})
                </h4>
                <div className="space-y-2">
                  {result.incompleteVenues.map(venue => (
                    <div key={venue.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="font-medium text-gray-900">{venue.name}</div>
                      <div className="text-sm text-gray-600">
                        ID: {venue.id} | Status: {venue.onboarding_completed === null ? 'NULL' : 'false'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {result.invalidVenues.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-red-600 mb-3">
                  Invalid Configurations ({result.invalidVenues.length})
                </h4>
                <div className="space-y-2">
                  {result.invalidVenues.map(venue => (
                    <div key={venue.id} className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-medium text-gray-900">{venue.name}</div>
                      <div className="text-sm text-gray-600 mb-1">
                        ID: {venue.id} | Mode: {venue.venue_mode} | Authority: {venue.authority_mode}
                      </div>
                      <div className="text-sm text-red-600">
                        Issues: {venue.issues.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}