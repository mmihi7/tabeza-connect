/**
 * Network Status Detection Service
 * 
 * Provides network connectivity monitoring and status detection
 * for robust offline/online handling during onboarding and other operations.
 */

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // milliseconds
  saveData: boolean;
}

export interface NetworkStatusListener {
  (status: NetworkStatus): void;
}

export interface NetworkStatusOptions {
  pollInterval?: number; // milliseconds
  enableDetailedInfo?: boolean;
  onStatusChange?: NetworkStatusListener;
}

/**
 * Network Status Manager
 * Handles network connectivity detection and monitoring
 */
export class NetworkStatusManager {
  private listeners: Set<NetworkStatusListener> = new Set();
  private currentStatus: NetworkStatus;
  private pollInterval: number;
  private enableDetailedInfo: boolean;
  private pollTimer: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(options: NetworkStatusOptions = {}) {
    this.pollInterval = options.pollInterval || 5000; // 5 seconds default
    this.enableDetailedInfo = options.enableDetailedInfo ?? true;
    
    if (options.onStatusChange) {
      this.listeners.add(options.onStatusChange);
    }

    // Initialize current status
    this.currentStatus = this.detectNetworkStatus();
    
    // Set up event listeners for immediate status changes
    this.setupEventListeners();
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentStatus.isOnline;
  }

  /**
   * Check if connection is slow
   */
  isSlowConnection(): boolean {
    const { effectiveType, downlink } = this.currentStatus;
    return effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5;
  }

  /**
   * Add status change listener
   */
  addListener(listener: NetworkStatusListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove status change listener
   */
  removeListener(listener: NetworkStatusListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Start monitoring network status
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.pollTimer = setInterval(() => {
      this.checkAndUpdateStatus();
    }, this.pollInterval);
  }

  /**
   * Stop monitoring network status
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Manually refresh network status
   */
  refresh(): NetworkStatus {
    this.checkAndUpdateStatus();
    return this.getStatus();
  }

  /**
   * Test network connectivity with a ping
   */
  async testConnectivity(url = '/api/health', timeout = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect current network status
   */
  private detectNetworkStatus(): NetworkStatus {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        isOnline: true, // Assume online in server environment
        connectionType: 'unknown',
        effectiveType: 'unknown',
        downlink: 10,
        rtt: 100,
        saveData: false
      };
    }

    const isOnline = navigator.onLine;
    let connectionType: NetworkStatus['connectionType'] = 'unknown';
    let effectiveType: NetworkStatus['effectiveType'] = 'unknown';
    let downlink = 10; // Default to 10 Mbps
    let rtt = 100; // Default to 100ms
    let saveData = false;

    // Get detailed connection info if available and enabled
    if (this.enableDetailedInfo && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        connectionType = this.mapConnectionType(connection.type);
        effectiveType = connection.effectiveType || 'unknown';
        downlink = connection.downlink || 10;
        rtt = connection.rtt || 100;
        saveData = connection.saveData || false;
      }
    }

    return {
      isOnline,
      connectionType,
      effectiveType,
      downlink,
      rtt,
      saveData
    };
  }

  /**
   * Map connection type from navigator.connection
   */
  private mapConnectionType(type: string): NetworkStatus['connectionType'] {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'ethernet':
        return 'ethernet';
      default:
        return 'unknown';
    }
  }

  /**
   * Set up event listeners for network status changes
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnlineEvent);
    window.addEventListener('offline', this.handleOfflineEvent);

    // Listen for connection changes if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.addEventListener) {
        connection.addEventListener('change', this.handleConnectionChange);
      }
    }
  }

  /**
   * Handle online event
   */
  private handleOnlineEvent = (): void => {
    this.checkAndUpdateStatus();
  };

  /**
   * Handle offline event
   */
  private handleOfflineEvent = (): void => {
    this.checkAndUpdateStatus();
  };

  /**
   * Handle connection change event
   */
  private handleConnectionChange = (): void => {
    this.checkAndUpdateStatus();
  };

  /**
   * Check and update network status, notify listeners if changed
   */
  private checkAndUpdateStatus(): void {
    const newStatus = this.detectNetworkStatus();
    
    // Check if status has changed
    const hasChanged = 
      newStatus.isOnline !== this.currentStatus.isOnline ||
      newStatus.connectionType !== this.currentStatus.connectionType ||
      newStatus.effectiveType !== this.currentStatus.effectiveType ||
      Math.abs(newStatus.downlink - this.currentStatus.downlink) > 0.5 ||
      Math.abs(newStatus.rtt - this.currentStatus.rtt) > 50;

    if (hasChanged) {
      this.currentStatus = newStatus;
      this.notifyListeners(newStatus);
    }
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(status: NetworkStatus): void {
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.stopMonitoring();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);

      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection && connection.removeEventListener) {
          connection.removeEventListener('change', this.handleConnectionChange);
        }
      }
    }

    this.listeners.clear();
  }
}

/**
 * Global network status manager instance
 */
let globalNetworkManager: NetworkStatusManager | null = null;

/**
 * Get or create global network status manager
 */
export function getNetworkStatusManager(options?: NetworkStatusOptions): NetworkStatusManager {
  if (!globalNetworkManager) {
    globalNetworkManager = new NetworkStatusManager(options);
    globalNetworkManager.startMonitoring();
  }
  return globalNetworkManager;
}

/**
 * Simple hook-like function to get current network status
 */
export function getNetworkStatus(): NetworkStatus {
  return getNetworkStatusManager().getStatus();
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return getNetworkStatusManager().isOnline();
}

/**
 * Check if connection is slow
 */
export function isSlowConnection(): boolean {
  return getNetworkStatusManager().isSlowConnection();
}

/**
 * Test network connectivity
 */
export async function testConnectivity(url?: string, timeout?: number): Promise<boolean> {
  return getNetworkStatusManager().testConnectivity(url, timeout);
}