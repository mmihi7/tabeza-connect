/**
 * Notification Manager
 * 
 * Coordinates notification methods with fallback chain:
 * Audio → Vibration → Visual
 * 
 * Requirements: 1, 3, 8, 9, 14, 15
 */

import type { AudioUnlockManager } from './audio-unlock';
import type { BrowserCapabilities } from './browser-capabilities';
import { detectBrowserCapabilities } from './browser-capabilities';

export type NotificationMethod = 'audio' | 'vibration' | 'visual';
export type NotificationPriority = 'high' | 'normal' | 'low';

export interface NotificationOptions {
  sound?: 'bell' | 'alert';
  vibrate?: boolean;
  visual?: string;
  priority?: NotificationPriority;
}

export interface NotificationAttempt {
  timestamp: Date;
  type: NotificationMethod;
  success: boolean;
  error?: string;
  fallbackUsed?: NotificationMethod;
}

export interface NotificationManager {
  playSound(soundType: 'bell' | 'alert'): Promise<boolean>;
  vibrate(pattern?: number[]): boolean;
  showVisual(message: string): void;
  notify(options: NotificationOptions): Promise<void>;
  getAttempts(): NotificationAttempt[];
  getCapabilities(): BrowserCapabilities;
}

class NotificationManagerImpl implements NotificationManager {
  private audioManager: AudioUnlockManager;
  private attempts: NotificationAttempt[] = [];
  private maxAttempts: number = 100; // Keep last 100 attempts
  private capabilities: BrowserCapabilities;

  constructor(audioManager: AudioUnlockManager) {
    this.audioManager = audioManager;
    this.capabilities = detectBrowserCapabilities();
    
    console.log('🔔 NotificationManager initialized with capabilities:', {
      audio: this.capabilities.audioSupported,
      vibration: this.capabilities.vibrationSupported,
      notification: this.capabilities.notificationSupported,
      mobile: this.capabilities.isMobile,
      browser: this.capabilities.browser,
      platform: this.capabilities.platform
    });
  }

  async playSound(soundType: 'bell' | 'alert' = 'bell'): Promise<boolean> {
    const attempt: NotificationAttempt = {
      timestamp: new Date(),
      type: 'audio',
      success: false
    };

    try {
      // Check if audio is supported
      if (!this.capabilities.audioSupported) {
        throw new Error('Audio not supported in this browser');
      }

      console.log(`🔊 Attempting to play ${soundType} sound...`);

      // Check if audio is unlocked
      if (!this.audioManager.isUnlocked()) {
        throw new Error('Audio not unlocked - user interaction required');
      }

      const audioContext = this.audioManager.getAudioContext();
      if (!audioContext) {
        throw new Error('No AudioContext available');
      }

      // Play the sound using Web Audio API
      await this.playBellSound(audioContext);

      attempt.success = true;
      console.log(`✅ ${soundType} sound played successfully`);
      return true;
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to play ${soundType} sound:`, error);
      return false;
    } finally {
      this.logAttempt(attempt);
    }
  }

  private async playBellSound(audioContext: AudioContext): Promise<void> {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Bell-like sound (800Hz → 400Hz)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);

    // Volume envelope
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1);

    // Wait for sound to finish
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  vibrate(pattern: number[] = [200, 100, 200]): boolean {
    const attempt: NotificationAttempt = {
      timestamp: new Date(),
      type: 'vibration',
      success: false
    };

    try {
      // Check if vibration is supported
      if (!this.capabilities.vibrationSupported) {
        throw new Error('Vibration not supported in this browser');
      }

      console.log('📳 Attempting to vibrate...', pattern);

      // Type guard for navigator.vibrate
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const success = navigator.vibrate(pattern);
        attempt.success = success;

        if (success) {
          console.log('✅ Vibration triggered successfully');
        } else {
          console.warn('⚠️ Vibration failed (may be disabled in settings)');
        }

        return success;
      }

      throw new Error('Vibration API not available');
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to vibrate:', error);
      return false;
    } finally {
      this.logAttempt(attempt);
    }
  }

  showVisual(message: string): void {
    const attempt: NotificationAttempt = {
      timestamp: new Date(),
      type: 'visual',
      success: true
    };

    try {
      console.log('👁️ Showing visual notification:', message);
      
      // Visual notification is handled by the UI layer
      // This just logs that a visual notification should be shown
      // The actual UI component will display it
      
      console.log('✅ Visual notification logged');
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.success = false;
      console.error('❌ Failed to show visual notification:', error);
    } finally {
      this.logAttempt(attempt);
    }
  }

  async notify(options: NotificationOptions): Promise<void> {
    console.log('🔔 Notification requested:', options);
    console.log('📊 Available capabilities:', {
      audio: this.capabilities.audioSupported,
      vibration: this.capabilities.vibrationSupported,
      mobile: this.capabilities.isMobile
    });

    let audioSuccess = false;
    let vibrationSuccess = false;

    // Adapt strategy based on browser capabilities
    const shouldTryAudio = options.sound && this.capabilities.audioSupported;
    const shouldTryVibration = this.capabilities.vibrationSupported && 
                               (options.vibrate || this.capabilities.isMobile);

    // Try audio first (if supported and requested)
    if (shouldTryAudio) {
      audioSuccess = await this.playSound(options.sound!);
      
      if (!audioSuccess) {
        console.log('🔄 Audio failed, trying fallback methods...');
      }
    } else if (options.sound && !this.capabilities.audioSupported) {
      console.log('⚠️ Audio requested but not supported, skipping to fallback');
    }

    // Try vibration if audio failed or if explicitly requested
    if (shouldTryVibration && (!audioSuccess || options.vibrate)) {
      vibrationSuccess = this.vibrate();
      
      if (vibrationSuccess && !audioSuccess) {
        console.log('🔄 Fallback: Using vibration instead of audio');
      }
    }

    // Always show visual notification if provided
    if (options.visual) {
      this.showVisual(options.visual);
      
      if (!audioSuccess && !vibrationSuccess) {
        console.log('🔄 Fallback: Using visual notification only');
      }
    }

    // Log the final result
    console.log('📊 Notification result:', {
      audio: audioSuccess,
      vibration: vibrationSuccess,
      visual: !!options.visual,
      capabilities: {
        audioSupported: this.capabilities.audioSupported,
        vibrationSupported: this.capabilities.vibrationSupported
      }
    });
  }

  getAttempts(): NotificationAttempt[] {
    return [...this.attempts];
  }

  getCapabilities(): BrowserCapabilities {
    return { ...this.capabilities };
  }

  private logAttempt(attempt: NotificationAttempt): void {
    this.attempts.push(attempt);
    
    // Keep only the last N attempts
    if (this.attempts.length > this.maxAttempts) {
      this.attempts = this.attempts.slice(-this.maxAttempts);
    }
  }
}

/**
 * Factory function to create a NotificationManager instance
 */
export function createNotificationManager(
  audioManager: AudioUnlockManager
): NotificationManager {
  return new NotificationManagerImpl(audioManager);
}
