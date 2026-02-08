/**
 * Audio Unlock Manager
 * 
 * Manages Web Audio API context and handles browser autoplay policies.
 * Mobile browsers require user interaction before playing audio.
 * 
 * Requirements: 1, 3, 6, 14, 15
 */

export type AudioContextState = 'suspended' | 'running' | 'closed';

export interface AudioUnlockState {
  isUnlocked: boolean;
  contextState: AudioContextState;
  lastUnlockAttempt: Date | null;
  unlockMethod: 'user-gesture' | 'auto' | null;
}

export interface AudioUnlockManager {
  isUnlocked(): boolean;
  unlock(): Promise<boolean>;
  needsUnlock(): boolean;
  getState(): AudioContextState;
  getAudioContext(): AudioContext | null;
}

class AudioUnlockManagerImpl implements AudioUnlockManager {
  private audioContext: AudioContext | null = null;
  private unlocked: boolean = false;
  private unlockAttempts: number = 0;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      // Check if Web Audio API is supported
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        console.warn('🔇 Web Audio API not supported in this browser');
        return;
      }

      this.audioContext = new AudioContextClass();
      
      console.log('🔊 AudioContext initialized:', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate
      });
    } catch (error) {
      console.error('❌ Failed to initialize AudioContext:', error);
    }
  }

  isUnlocked(): boolean {
    if (!this.audioContext) return false;
    return this.unlocked && this.audioContext.state === 'running';
  }

  async unlock(): Promise<boolean> {
    this.unlockAttempts++;
    
    console.log(`🔓 Attempting to unlock audio (attempt ${this.unlockAttempts})...`);

    if (!this.audioContext) {
      console.error('❌ No AudioContext available');
      return false;
    }

    try {
      // If already running, mark as unlocked
      if (this.audioContext.state === 'running') {
        this.unlocked = true;
        console.log('✅ Audio already unlocked');
        return true;
      }

      // Resume the audio context (requires user gesture)
      await this.audioContext.resume();

      // Play a silent sound to fully unlock (iOS Safari workaround)
      await this.playSilentSound();

      this.unlocked = true;
      
      console.log('✅ Audio unlocked successfully:', {
        state: this.audioContext.state,
        attempts: this.unlockAttempts
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to unlock audio:', error);
      return false;
    }
  }

  private async playSilentSound(): Promise<void> {
    if (!this.audioContext) return;

    try {
      // Create a silent buffer
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      
      // Wait a tiny bit for the sound to "play"
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      console.warn('⚠️ Failed to play silent sound:', error);
    }
  }

  needsUnlock(): boolean {
    if (!this.audioContext) return false;
    return this.audioContext.state === 'suspended' && !this.unlocked;
  }

  getState(): AudioContextState {
    if (!this.audioContext) return 'closed';
    return this.audioContext.state as AudioContextState;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
}

/**
 * Factory function to create an AudioUnlockManager instance
 */
export function createAudioUnlockManager(): AudioUnlockManager {
  return new AudioUnlockManagerImpl();
}
