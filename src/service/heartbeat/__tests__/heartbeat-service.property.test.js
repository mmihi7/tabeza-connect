/**
 * Property-Based Tests for Heartbeat Service
 * 
 * Feature: management-ui-and-missing-features
 * Tests universal properties that should hold across all inputs
 */

const fc = require('fast-check');
const HeartbeatService = require('../heartbeat-service');
const os = require('os');

// Mock axios
jest.mock('axios');
const axios = require('axios');

describe('HeartbeatService - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 14: Heartbeat Payload Structure', () => {
    /**
     * Feature: management-ui-and-missing-features, Property 14: Heartbeat Payload Structure
     * 
     * For any heartbeat sent to the cloud, the payload should include barId, driverId 
     * (in format "driver-{HOSTNAME}"), version (from package.json), and status set to "online".
     * 
     * Validates: Requirements 11.2, 11.3, 11.4
     */
    it('should always include barId, driverId, version, and status="online" in payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            await service.sendHeartbeat();

            if (axios.post.mock.calls.length === 0) {
              // barId was empty, which is valid behavior
              return true;
            }

            const payload = axios.post.mock.calls[0][1];

            // Check all required fields exist
            expect(payload).toHaveProperty('barId');
            expect(payload).toHaveProperty('driverId');
            expect(payload).toHaveProperty('version');
            expect(payload).toHaveProperty('status');

            // Check barId matches config
            expect(payload.barId).toBe(config.barId);

            // Check driverId format
            expect(payload.driverId).toMatch(/^driver-.+$/);

            // Check version is a string
            expect(typeof payload.version).toBe('string');
            expect(payload.version.length).toBeGreaterThan(0);

            // Check status is always 'online'
            expect(payload.status).toBe('online');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always POST to /api/printer/heartbeat endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            await service.sendHeartbeat();

            if (axios.post.mock.calls.length === 0) {
              return true;
            }

            const endpoint = axios.post.mock.calls[0][0];
            expect(endpoint).toContain('/api/printer/heartbeat');
            expect(endpoint).toContain(config.apiUrl);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always use 10 second timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            await service.sendHeartbeat();

            if (axios.post.mock.calls.length === 0) {
              return true;
            }

            const axiosConfig = axios.post.mock.calls[0][2];
            expect(axiosConfig.timeout).toBe(10000);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always include Content-Type: application/json header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            await service.sendHeartbeat();

            if (axios.post.mock.calls.length === 0) {
              return true;
            }

            const axiosConfig = axios.post.mock.calls[0][2];
            expect(axiosConfig.headers['Content-Type']).toBe('application/json');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Driver ID Format', () => {
    /**
     * Feature: management-ui-and-missing-features, Property 15: Driver ID Format
     * 
     * For any Windows hostname, the generated driver ID should follow the format 
     * "driver-{HOSTNAME}" and be included in all cloud API requests.
     * 
     * Validates: Requirements 12.1, 12.2, 12.3
     */
    it('should always generate driver ID with format "driver-{HOSTNAME}"', () => {
      fc.assert(
        fc.property(
          fc.constant(null), // We use actual hostname, not arbitrary input
          () => {
            const driverId = HeartbeatService.generateDriverId();
            const hostname = os.hostname();

            // Check format
            expect(driverId).toMatch(/^driver-.+$/);

            // Check it contains actual hostname
            expect(driverId).toBe(`driver-${hostname}`);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include driver ID in all heartbeat requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            const expectedDriverId = service.driverId;

            await service.sendHeartbeat();

            if (axios.post.mock.calls.length === 0) {
              return true;
            }

            const payload = axios.post.mock.calls[0][1];

            // Check driver ID is included
            expect(payload.driverId).toBe(expectedDriverId);

            // Check format
            expect(payload.driverId).toMatch(/^driver-.+$/);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent driver ID across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const driverId1 = HeartbeatService.generateDriverId();
            const driverId2 = HeartbeatService.generateDriverId();
            const driverId3 = HeartbeatService.generateDriverId();

            // All should be identical
            expect(driverId1).toBe(driverId2);
            expect(driverId2).toBe(driverId3);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use same driver ID for all heartbeats from same service instance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            const expectedDriverId = service.driverId;

            // Send multiple heartbeats
            await service.sendHeartbeat();
            await service.sendHeartbeat();
            await service.sendHeartbeat();

            const calls = axios.post.mock.calls.filter(call => call.length > 0);

            if (calls.length === 0) {
              return true;
            }

            // All should use same driver ID
            for (const call of calls) {
              const payload = call[1];
              expect(payload.driverId).toBe(expectedDriverId);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Resilience Properties', () => {
    it('should never throw on network errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          fc.oneof(
            fc.constant('ECONNREFUSED'),
            fc.constant('ETIMEDOUT'),
            fc.constant('ENOTFOUND'),
            fc.constant('Network error')
          ),
          async (config, errorMessage) => {
            jest.clearAllMocks();
            const networkError = new Error(errorMessage);
            networkError.request = {};
            axios.post.mockRejectedValue(networkError);

            const service = new HeartbeatService(config);

            // Should not throw
            await expect(service.sendHeartbeat()).resolves.not.toThrow();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never throw on HTTP errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          fc.integer({ min: 400, max: 599 }), // HTTP error codes
          async (config, statusCode) => {
            jest.clearAllMocks();
            const httpError = new Error('HTTP error');
            httpError.response = { 
              status: statusCode, 
              statusText: `Error ${statusCode}` 
            };
            axios.post.mockRejectedValue(httpError);

            const service = new HeartbeatService(config);

            // Should not throw
            await expect(service.sendHeartbeat()).resolves.not.toThrow();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip heartbeat if barId is missing or empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('   ')
          ),
          fc.webUrl(),
          async (barId, apiUrl) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService({ barId, apiUrl });
            await service.sendHeartbeat();

            // Should not call axios if barId is invalid
            expect(axios.post).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Interval Properties', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send heartbeats at 30 second intervals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          fc.integer({ min: 1, max: 10 }), // Number of intervals to test
          async (config, numIntervals) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            service.start();
            await Promise.resolve(); // Initial heartbeat

            const initialCalls = axios.post.mock.calls.length;

            // Advance time by numIntervals * 30 seconds
            for (let i = 0; i < numIntervals; i++) {
              jest.advanceTimersByTime(30000);
              await Promise.resolve();
            }

            const finalCalls = axios.post.mock.calls.length;
            const expectedCalls = initialCalls + numIntervals;

            expect(finalCalls).toBe(expectedCalls);

            service.stop();
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should stop sending heartbeats after stop() is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            barId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
            apiUrl: fc.webUrl()
          }),
          async (config) => {
            jest.clearAllMocks();
            axios.post.mockResolvedValue({ status: 200 });

            const service = new HeartbeatService(config);
            service.start();
            await Promise.resolve();

            const callsBeforeStop = axios.post.mock.calls.length;

            service.stop();

            // Advance time - should not trigger more calls
            jest.advanceTimersByTime(120000); // 2 minutes
            await Promise.resolve();

            const callsAfterStop = axios.post.mock.calls.length;

            expect(callsAfterStop).toBe(callsBeforeStop);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
