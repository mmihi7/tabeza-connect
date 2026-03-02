/**
 * Unit Tests for Heartbeat Service
 */

const HeartbeatService = require('../heartbeat-service');
const os = require('os');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('HeartbeatService', () => {
  let service;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockConfig = {
      barId: 'test-bar-123',
      apiUrl: 'https://test.tabeza.co.ke'
    };

    service = new HeartbeatService(mockConfig);
  });

  afterEach(() => {
    if (service.isRunning) {
      service.stop();
    }
    jest.useRealTimers();
  });

  describe('generateDriverId', () => {
    it('should generate driver ID with format "driver-{HOSTNAME}"', () => {
      const driverId = HeartbeatService.generateDriverId();
      const hostname = os.hostname();

      expect(driverId).toBe(`driver-${hostname}`);
      expect(driverId).toMatch(/^driver-.+$/);
    });

    it('should use actual hostname from os.hostname()', () => {
      const hostname = os.hostname();
      const driverId = HeartbeatService.generateDriverId();

      expect(driverId).toContain(hostname);
    });

    it('should generate consistent driver ID for same hostname', () => {
      const driverId1 = HeartbeatService.generateDriverId();
      const driverId2 = HeartbeatService.generateDriverId();

      expect(driverId1).toBe(driverId2);
    });
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(service.config).toBe(mockConfig);
      expect(service.isRunning).toBe(false);
      expect(service.intervalId).toBeNull();
    });

    it('should generate driver ID on construction', () => {
      expect(service.driverId).toMatch(/^driver-.+$/);
    });

    it('should load version from package.json', () => {
      expect(service.version).toBeDefined();
      expect(typeof service.version).toBe('string');
    });
  });

  describe('start', () => {
    it('should start heartbeat service', () => {
      axios.post.mockResolvedValue({ status: 200 });

      service.start();

      expect(service.isRunning).toBe(true);
      expect(service.intervalId).not.toBeNull();
    });

    it('should send initial heartbeat immediately', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      service.start();

      // Wait for initial heartbeat promise to resolve
      await Promise.resolve();

      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should send heartbeat every 30 seconds', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      service.start();
      await Promise.resolve(); // Initial heartbeat

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(axios.post).toHaveBeenCalledTimes(2);

      // Advance another 30 seconds
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(axios.post).toHaveBeenCalledTimes(3);
    });

    it('should not start if already running', () => {
      axios.post.mockResolvedValue({ status: 200 });

      service.start();
      const firstIntervalId = service.intervalId;

      service.start(); // Try to start again

      expect(service.intervalId).toBe(firstIntervalId);
    });
  });

  describe('stop', () => {
    it('should stop heartbeat service', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      service.start();
      await Promise.resolve();

      service.stop();

      expect(service.isRunning).toBe(false);
      expect(service.intervalId).toBeNull();
    });

    it('should clear interval when stopped', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      service.start();
      await Promise.resolve();

      const callCountBeforeStop = axios.post.mock.calls.length;

      service.stop();

      // Advance time - should not trigger more heartbeats
      jest.advanceTimersByTime(60000);
      await Promise.resolve();

      expect(axios.post).toHaveBeenCalledTimes(callCountBeforeStop);
    });

    it('should do nothing if not running', () => {
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('sendHeartbeat', () => {
    it('should send heartbeat with correct payload structure', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await service.sendHeartbeat();

      expect(axios.post).toHaveBeenCalledWith(
        'https://test.tabeza.co.ke/api/printer/heartbeat',
        {
          barId: 'test-bar-123',
          driverId: service.driverId,
          version: service.version,
          status: 'online'
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should include barId in payload', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await service.sendHeartbeat();

      const payload = axios.post.mock.calls[0][1];
      expect(payload.barId).toBe('test-bar-123');
    });

    it('should include driverId in payload', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await service.sendHeartbeat();

      const payload = axios.post.mock.calls[0][1];
      expect(payload.driverId).toMatch(/^driver-.+$/);
    });

    it('should include version in payload', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await service.sendHeartbeat();

      const payload = axios.post.mock.calls[0][1];
      expect(payload.version).toBeDefined();
      expect(typeof payload.version).toBe('string');
    });

    it('should set status to "online" in payload', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await service.sendHeartbeat();

      const payload = axios.post.mock.calls[0][1];
      expect(payload.status).toBe('online');
    });

    it('should use 10 second timeout', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await service.sendHeartbeat();

      const config = axios.post.mock.calls[0][2];
      expect(config.timeout).toBe(10000);
    });

    it('should not throw on network error', async () => {
      const networkError = new Error('Network error');
      networkError.request = {};
      axios.post.mockRejectedValue(networkError);

      await expect(service.sendHeartbeat()).resolves.not.toThrow();
    });

    it('should not throw on server error (4xx)', async () => {
      const serverError = new Error('Bad request');
      serverError.response = { status: 400, statusText: 'Bad Request' };
      axios.post.mockRejectedValue(serverError);

      await expect(service.sendHeartbeat()).resolves.not.toThrow();
    });

    it('should not throw on server error (5xx)', async () => {
      const serverError = new Error('Internal server error');
      serverError.response = { status: 500, statusText: 'Internal Server Error' };
      axios.post.mockRejectedValue(serverError);

      await expect(service.sendHeartbeat()).resolves.not.toThrow();
    });

    it('should not send heartbeat if barId is missing', async () => {
      service.config.barId = null;

      await service.sendHeartbeat();

      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should not send heartbeat if barId is empty string', async () => {
      service.config.barId = '';

      await service.sendHeartbeat();

      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should log warning on network failure and continue', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const networkError = new Error('ECONNREFUSED');
      networkError.request = {};
      axios.post.mockRejectedValue(networkError);

      await service.sendHeartbeat();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Network error sending heartbeat'),
        expect.any(String)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should log warning on server rejection and continue', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const serverError = new Error('Unauthorized');
      serverError.response = { status: 401, statusText: 'Unauthorized' };
      axios.post.mockRejectedValue(serverError);

      await service.sendHeartbeat();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Heartbeat rejected by server')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should continue sending heartbeats after failure', async () => {
      // First call fails
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      // Second call succeeds
      axios.post.mockResolvedValueOnce({ status: 200 });

      service.start();
      await Promise.resolve(); // Initial heartbeat (fails)

      jest.advanceTimersByTime(30000);
      await Promise.resolve(); // Second heartbeat (succeeds)

      expect(axios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('version loading', () => {
    it('should use default version if package.json cannot be read', () => {
      // Create service with invalid package.json path
      const serviceWithBadPath = new HeartbeatService(mockConfig);
      
      // Mock fs.readFileSync to throw error
      const originalReadFileSync = require('fs').readFileSync;
      require('fs').readFileSync = jest.fn(() => {
        throw new Error('File not found');
      });

      const version = serviceWithBadPath._loadVersion();
      expect(version).toBe('1.0.0');

      // Restore
      require('fs').readFileSync = originalReadFileSync;
    });
  });
});
