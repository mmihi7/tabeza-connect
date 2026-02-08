'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Vibrate } from 'lucide-react';
import { createAudioUnlockManager, type AudioUnlockManager } from '@tabeza/shared';

export interface AudioUnlockPromptProps {
  onUnlock: (audioManager: AudioUnlockManager) => void;
  onDismiss?: () => void;
}

/**
 * AudioUnlockPrompt Component
 * 
 * Mobile-friendly prompt that requests user interaction to unlock audio.
 * Required for iOS Safari and other mobile browsers with autoplay restrictions.
 * 
 * Requirements: 1, 12, 13
 */
export function AudioUnlockPrompt({ onUnlock, onDismiss }: AudioUnlockPromptProps) {
  const [audioManager] = useState(() => createAudioUnlockManager());
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if audio is already unlocked
  useEffect(() => {
    if (audioManager.isUnlocked()) {
      console.log('✅ Audio already unlocked, calling onUnlock');
      onUnlock(audioManager);
    }
  }, [audioManager, onUnlock]);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    setError(null);

    try {
      console.log('🔓 User clicked unlock button');
      const success = await audioManager.unlock();

      if (success) {
        console.log('✅ Audio unlocked successfully');
        onUnlock(audioManager);
      } else {
        setError('Failed to unlock audio. Please try again.');
        console.error('❌ Audio unlock failed');
      }
    } catch (err) {
      setError('An error occurred while unlocking audio.');
      console.error('❌ Audio unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleDismiss = () => {
    console.log('ℹ️ User dismissed audio unlock prompt');
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="bg-orange-100 rounded-full p-4">
            <Volume2 size={48} className="text-orange-600" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enable Notifications
          </h2>
          <p className="text-gray-600">
            Tap below to enable sound and vibration alerts for new orders and messages.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-700">
            <div className="bg-orange-50 rounded-lg p-2">
              <Volume2 size={20} className="text-orange-600" />
            </div>
            <span className="text-sm">Sound alerts for new orders</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <div className="bg-orange-50 rounded-lg p-2">
              <Vibrate size={20} className="text-orange-600" />
            </div>
            <span className="text-sm">Vibration notifications</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleUnlock}
            disabled={isUnlocking}
            className="w-full bg-orange-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-orange-700 active:bg-orange-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUnlocking ? 'Enabling...' : 'Enable Notifications'}
          </button>

          {onDismiss && (
            <button
              onClick={handleDismiss}
              disabled={isUnlocking}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Maybe Later
            </button>
          )}
        </div>

        {/* Info text */}
        <p className="text-xs text-gray-500 text-center">
          This is required for mobile browsers to play notification sounds.
        </p>
      </div>
    </div>
  );
}
