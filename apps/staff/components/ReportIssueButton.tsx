/**
 * ReportIssueButton Component
 * Allows users to report issues with error logs
 * 
 * Task 6: Comprehensive Error Handling
 * Requirements: 10.5
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import React, { useState } from 'react';
import { getErrorHistory } from '../utils/errorLogger';

interface ReportIssueButtonProps {
  className?: string;
}

/**
 * Report issue button component
 * 
 * Features:
 * - Captures error logs from history
 * - Allows user to add description
 * - Copies logs to clipboard
 * - Shows success/error feedback
 */
export function ReportIssueButton({ className = '' }: ReportIssueButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  const handleReport = async () => {
    setStatus('copying');
    
    try {
      const errorHistory = getErrorHistory();
      const report = {
        timestamp: new Date().toISOString(),
        description,
        userAgent: navigator.userAgent,
        url: window.location.href,
        errors: errorHistory.slice(0, 10) // Last 10 errors
      };
      
      const reportText = JSON.stringify(report, null, 2);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(reportText);
      
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setIsOpen(false);
        setDescription('');
      }, 2000);
    } catch (error) {
      console.error('Failed to copy error report:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${className}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Report Issue
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Report an Issue
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Describe the issue you encountered. Error logs will be included automatically.
              </p>
              
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What were you trying to do?"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
              />
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={status === 'copying'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReport}
                  disabled={status === 'copying' || !description.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'copying' && 'Copying...'}
                  {status === 'success' && '✓ Copied!'}
                  {status === 'error' && 'Failed'}
                  {status === 'idle' && 'Copy Report'}
                </button>
              </div>
              
              {status === 'success' && (
                <p className="mt-3 text-sm text-green-600">
                  Report copied to clipboard. Please paste it in your support ticket.
                </p>
              )}
              
              {status === 'error' && (
                <p className="mt-3 text-sm text-red-600">
                  Failed to copy report. Please try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
