/**
 * Browser Capabilities Detection
 * 
 * Detects browser capabilities for audio, vibration, and notifications.
 * Identifies browser type, platform, and autoplay policies.
 * 
 * Requirements: 7, 8, 9
 */

export type AutoplayPolicy = 'allowed' | 'user-gesture-required' | 'blocked';

export interface BrowserCapabilities {
  audioSupported: boolean;
  vibrationSupported: boolean;
  notificationSupported: boolean;
  autoplayPolicy: AutoplayPolicy;
  isMobile: boolean;
  browser: string;
  platform: string;
}

export interface BrowserCapabilityDetector {
  detect(): BrowserCapabilities;
  isAudioSupported(): boolean;
  isVibrationSupported(): boolean;
  isNotificationSupported(): boolean;
  detectAutoplayPolicy(): Promise<AutoplayPolicy>;
  isMobileDevice(): boolean;
  getBrowserName(): string;
  getPlatform(): string;
}

// Type guard to check if we're in a browser environment
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

class BrowserCapabilityDetectorImpl implements BrowserCapabilityDetector {
  private cachedCapabilities: BrowserCapabilities | null = null;

  detect(): BrowserCapabilities {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    console.log('🔍 Detecting browser capabilities...');

    const capabilities: BrowserCapabilities = {
      audioSupported: this.isAudioSupported(),
      vibrationSupported: this.isVibrationSupported(),
      notificationSupported: this.isNotificationSupported(),
      autoplayPolicy: 'user-gesture-required', // Will be updated async
      isMobile: this.isMobileDevice(),
      browser: this.getBrowserName(),
      platform: this.getPlatform()
    };

    this.cachedCapabilities = capabilities;

    console.log('✅ Browser capabilities detected:', capabilities);

    return capabilities;
  }

  isAudioSupported(): boolean {
    if (!isBrowser()) return false;
    
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      return !!AudioContextClass;
    } catch {
      return false;
    }
  }

  isVibrationSupported(): boolean {
    if (!isBrowser()) return false;
    return 'vibrate' in navigator;
  }

  isNotificationSupported(): boolean {
    if (!isBrowser()) return false;
    return 'Notification' in window;
  }

  async detectAutoplayPolicy(): Promise<AutoplayPolicy> {
    if (!isBrowser()) return 'blocked';
    
    console.log('🔍 Detecting autoplay policy...');

    if (!this.isAudioSupported()) {
      console.log('❌ Audio not supported - autoplay blocked');
      return 'blocked';
    }

    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const testContext = new AudioContextClass();

      // Check initial state
      const initialState = testContext.state;
      console.log('📊 Initial AudioContext state:', initialState);

      if (initialState === 'running') {
        // Audio can start without user gesture
        testContext.close();
        console.log('✅ Autoplay allowed');
        return 'allowed';
      }

      // Try to resume without user gesture
      try {
        await testContext.resume();
        
        if (testContext.state === 'running') {
          testContext.close();
          console.log('✅ Autoplay allowed after resume');
          return 'allowed';
        }
      } catch (error) {
        console.log('⚠️ Resume failed without user gesture:', error);
      }

      testContext.close();
      console.log('🔒 User gesture required for autoplay');
      return 'user-gesture-required';
    } catch (error) {
      console.error('❌ Failed to detect autoplay policy:', error);
      return 'blocked';
    }
  }

  isMobileDevice(): boolean {
    if (!isBrowser()) return false;
    
    // Check user agent for mobile indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android',
      'webos',
      'iphone',
      'ipad',
      'ipod',
      'blackberry',
      'windows phone',
      'mobile'
    ];

    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));

    // Check for touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check screen size (mobile typically < 768px)
    const isSmallScreen = window.innerWidth < 768;

    // Consider it mobile if any two conditions are true
    const mobileIndicators = [isMobileUA, hasTouch, isSmallScreen].filter(Boolean).length;

    return mobileIndicators >= 2;
  }

  getBrowserName(): string {
    if (!isBrowser()) return 'Unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('edg/')) {
      return 'Edge';
    } else if (userAgent.includes('chrome/') && !userAgent.includes('edg/')) {
      return 'Chrome';
    } else if (userAgent.includes('safari/') && !userAgent.includes('chrome/')) {
      return 'Safari';
    } else if (userAgent.includes('firefox/')) {
      return 'Firefox';
    } else if (userAgent.includes('opera/') || userAgent.includes('opr/')) {
      return 'Opera';
    } else {
      return 'Unknown';
    }
  }

  getPlatform(): string {
    if (!isBrowser()) return 'Unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('win')) {
      return 'Windows';
    } else if (userAgent.includes('mac')) {
      return 'macOS';
    } else if (userAgent.includes('linux')) {
      return 'Linux';
    } else if (userAgent.includes('android')) {
      return 'Android';
    } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'iOS';
    } else {
      return 'Unknown';
    }
  }
}

/**
 * Factory function to create a BrowserCapabilityDetector instance
 */
export function createBrowserCapabilityDetector(): BrowserCapabilityDetector {
  return new BrowserCapabilityDetectorImpl();
}

/**
 * Convenience function to get browser capabilities
 */
export function detectBrowserCapabilities(): BrowserCapabilities {
  const detector = createBrowserCapabilityDetector();
  return detector.detect();
}

/**
 * Async function to get complete capabilities including autoplay policy
 */
export async function detectBrowserCapabilitiesAsync(): Promise<BrowserCapabilities> {
  const detector = createBrowserCapabilityDetector();
  const capabilities = detector.detect();
  
  // Update autoplay policy asynchronously
  capabilities.autoplayPolicy = await detector.detectAutoplayPolicy();
  
  return capabilities;
}
