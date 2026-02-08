/**
 * Unmatched Receipts Page
 * 
 * Displays ALL unmatched receipts that need manual assignment.
 * Provides a recovery mechanism for receipts that were dismissed or missed.
 * 
 * IMPORTANT: Shows all pending receipts regardless of age. Staff must
 * manually assign or cancel each receipt. Receipts older than 1 hour are
 * highlighted as URGENT.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { UnmatchedReceipts } from '@/components/UnmatchedReceipts';

export default function UnmatchedReceiptsPage() {
  const router = useRouter();
  const { bar, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!bar) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">No venue selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Unmatched Receipts</h1>
            <p className="text-orange-200 text-sm">{bar.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <UnmatchedReceipts venueId={bar.id} />
      </div>
    </div>
  );
}
