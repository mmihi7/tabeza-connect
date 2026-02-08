/**
 * OfflineBanner Component
 * Displays banner when network is unavailable
 * 
 * Task 6: Comprehensive Error Handling
 * Requirements: 6.2, 10.1
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import React from 'react';

interface OfflineBannerProps {
  isVisible: boolean;
  onDismiss?: () => void;
}

/**
 * Offline banner component
 * 
 * Features:
 * - Displays when network is unavailable
 * - Shows warning icon and message
 * - Optional dismiss button
 * - Slides in/out with animation
 */
export function OfflineBanner({ isVisible, onDismiss }: OfflineBannerProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 shadow-lg animate-slide-down"
      role="alert"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6"
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
          <div>
            <p className="font-semibold">Working Offline</p>
            <p className="text-sm">
              You are currently offline. Some features may be unavailable.
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 text-white hover:text-yellow-100 transition-colors"
            aria-label="Dismiss offline banner"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
