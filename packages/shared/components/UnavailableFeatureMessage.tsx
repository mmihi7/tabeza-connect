/**
 * Unavailable Feature Message Component
 * Task 6: Simple Unavailable Feature Message Component
 * 
 * Displays a simple message when a feature is not available in the current mode.
 */

'use client';

import React from 'react';
import Link from 'next/link';

export interface UnavailableFeatureMessageProps {
  feature: string;
}

/**
 * Component that displays why a feature is unavailable
 * Shows a simple message with a "View My Tab" button
 */
export function UnavailableFeatureMessage({ feature }: UnavailableFeatureMessageProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      <div className="mb-4 text-6xl">🚫</div>
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        {feature} Not Available
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        This venue uses POS ordering. Please place your order with a staff member who will add it to your tab.
      </p>
      <Link 
        href="/tab"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        View My Tab
      </Link>
    </div>
  );
}
