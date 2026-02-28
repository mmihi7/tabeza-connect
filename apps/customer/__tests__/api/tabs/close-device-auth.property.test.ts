/**
 * Property-Based Test Suite for Close Tab API Device Authorization
 * Feature: fix-close-tab-errors
 * Task: 2.6 Write property test for device authorization
 * Property 5: Device Authorization Enforcement
 * 
 * **Validates: Requirements 1.5, 3.2**
 * 
 * This test verifies that for any tab and device identifier pair, when a customer
 * attempts to close a tab via the API endpoint, the system should only allow closure
 * if the tab's device_identifier matches the requesting device's identifier,
 * otherwise returning a 401 unauthorized error.
 */

import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/tabs/close/route';

// Mock Next.js request
const mockRequest = (body: any, headers: Record<string, string> = {}) => {
  const headersMap = new Map(Object.entries(headers));
  return {
    json: async () => body,
    headers: {
      get: (key: string) => {
        const lowerKey = key.toLowerCase();
        for (const [k, v] of headersMap.entries()) {
          if (k.toLowerCase() === lowerKey) {
            return v;
          }
        }
        return null;
      },
    },
  } as any;
};

// Test database setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const skipIfNoDb = () => {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  Skipping database-dependent tests: No Supabase credentials found');
    return true;
  }
  return false;
};

let supabase: any;

beforeAll(() => {
  if (!skipIfNoDb()) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
});

// Generators
const uuidArb = fc.uuid();
const deviceIdArb = fc.uuid();

// Test data cleanup
const createdTabIds: string[] = [];
const createdBarIds: string[] = [];

afterEach(async () => {
  if (!skipIfNoDb() && supabase) {
    if (createdTabIds.length > 0) {
      await supabase.from('tabs').delete().in('id', createdTabIds);
      createdTabIds.length = 0;
    }
    if (createdBarIds.length > 0) {
      await supabase.from('bars').delete().in('id', createdBarIds);
      createdBarIds.length = 0;
    }
  }
});

describe('Feature: fix-close-tab-errors, Property 5: Device Authorization Enforcement', () => {
  /**
   * Property Test: Authorized Device Can Close Tab
   * 
   * For any tab with a device_identifier, when a request is made with the
   * matching device identifier, the system should allow the closure (assuming
   * all other validations pass).
   */
  it('should allow closure when device identifier matches', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderTotal: fc.integer({ min: 100, max: 10000 }),
        }),
        async ({ deviceId, barName, orderTotal }) => {
          // Setup: Create bar and tab with specific device identifier
          const barId = fc.sample(uuidArb, 1)[0];
          createdBarIds.push(barId);
          
          await supabase.from('bars').insert({
            id: barId,
            name: barName,
            slug: `test-bar-${Date.now()}-${Math.random()}`,
          });
          
          const tabId = fc.sample(uuidArb, 1)[0];
          createdTabIds.push(tabId);
          
          await supabase.from('tabs').insert({
            id: tabId,
            bar_id: barId,
            device_identifier: deviceId,
            status: 'open',
          });
          
          // Create order and payment with zero balance
          await supabase.from('tab_orders').insert({
            tab_id: tabId,
            items: [{ name: 'Test Item', quantity: 1, price: orderTotal }],
            total: orderTotal,
            status: 'confirmed',
            initiated_by: 'customer',
          });
          
          await supabase.from('tab_payments').insert({
            tab_id: tabId,
            amount: orderTotal,
            method: 'cash',
            status: 'success',
          });
          
          // Create request with matching device ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should allow closure with matching device
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          
          // Verify tab is closed
          const { data: closedTab } = await supabase
            .from('tabs')
            .select('status, closed_by')
            .eq('id', tabId)
            .single();
          
          expect(closedTab?.status).toBe('closed');
          expect(closedTab?.closed_by).toBe('customer');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Unauthorized Device Cannot Close Tab
   * 
   * For any tab with a device_identifier, when a request is made with a
   * different device identifier, the system should reject the closure with
   * a 401 unauthorized error.
   */
  it('should reject closure when device identifier does not match', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          correctDeviceId: deviceIdArb,
          wrongDeviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
        }).filter(({ correctDeviceId, wrongDeviceId }) => 
          correctDeviceId !== wrongDeviceId
        ),
        async ({ correctDeviceId, wrongDeviceId, barName }) => {
          // Setup: Create bar and tab with specific device identifier
          const barId = fc.sample(uuidArb, 1)[0];
          createdBarIds.push(barId);
          
          await supabase.from('bars').insert({
            id: barId,
            name: barName,
            slug: `test-bar-${Date.now()}-${Math.random()}`,
          });
          
          const tabId = fc.sample(uuidArb, 1)[0];
          createdTabIds.push(tabId);
          
          await supabase.from('tabs').insert({
            id: tabId,
            bar_id: barId,
            device_identifier: correctDeviceId,
            status: 'open',
          });
          
          // Create request with wrong device ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': wrongDeviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should reject with 401 unauthorized
          expect(response.status).toBe(401);
          expect(data.error).toMatch(/unauthorized/i);
          
          // Property: Tab should remain open (not closed)
          const { data: tab } = await supabase
            .from('tabs')
            .select('status')
            .eq('id', tabId)
            .single();
          
          expect(tab?.status).toBe('open');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Missing Device Identifier Rejects Closure
   * 
   * For any tab, when a request is made without a device identifier,
   * the system should reject the closure with a 401 unauthorized error.
   */
  it('should reject closure when no device identifier provided', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
        }),
        async ({ deviceId, barName }) => {
          // Setup: Create bar and tab
          const barId = fc.sample(uuidArb, 1)[0];
          createdBarIds.push(barId);
          
          await supabase.from('bars').insert({
            id: barId,
            name: barName,
            slug: `test-bar-${Date.now()}-${Math.random()}`,
          });
          
          const tabId = fc.sample(uuidArb, 1)[0];
          createdTabIds.push(tabId);
          
          await supabase.from('tabs').insert({
            id: tabId,
            bar_id: barId,
            device_identifier: deviceId,
            status: 'open',
          });
          
          // Create request WITHOUT device ID
          const request = mockRequest({ tabId }, {});
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should reject with 401 unauthorized
          expect(response.status).toBe(401);
          expect(data.error).toMatch(/device identifier|required|authorization/i);
          
          // Property: Tab should remain open
          const { data: tab } = await supabase
            .from('tabs')
            .select('status')
            .eq('id', tabId)
            .single();
          
          expect(tab?.status).toBe('open');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Device Authorization Checked Before Balance
   * 
   * For any tab with wrong device ID and positive balance, the system
   * should return 401 (unauthorized) before checking the balance.
   */
  it('should check device authorization before balance validation', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          correctDeviceId: deviceIdArb,
          wrongDeviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderTotal: fc.integer({ min: 100, max: 10000 }),
        }).filter(({ correctDeviceId, wrongDeviceId }) => 
          correctDeviceId !== wrongDeviceId
        ),
        async ({ correctDeviceId, wrongDeviceId, barName, orderTotal }) => {
          // Setup: Create bar and tab with positive balance
          const barId = fc.sample(uuidArb, 1)[0];
          createdBarIds.push(barId);
          
          await supabase.from('bars').insert({
            id: barId,
            name: barName,
            slug: `test-bar-${Date.now()}-${Math.random()}`,
          });
          
          const tabId = fc.sample(uuidArb, 1)[0];
          createdTabIds.push(tabId);
          
          await supabase.from('tabs').insert({
            id: tabId,
            bar_id: barId,
            device_identifier: correctDeviceId,
            status: 'open',
          });
          
          // Create order with NO payment (positive balance)
          await supabase.from('tab_orders').insert({
            tab_id: tabId,
            items: [{ name: 'Test Item', quantity: 1, price: orderTotal }],
            total: orderTotal,
            status: 'confirmed',
            initiated_by: 'customer',
          });
          
          // Create request with wrong device ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': wrongDeviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should return 401 (unauthorized) not 400 (balance error)
          expect(response.status).toBe(401);
          expect(data.error).toMatch(/unauthorized/i);
          expect(data.error).not.toMatch(/balance/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Device Authorization Checked Before Pending Orders
   * 
   * For any tab with wrong device ID and pending orders, the system
   * should return 401 (unauthorized) before checking pending orders.
   */
  it('should check device authorization before pending orders validation', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          correctDeviceId: deviceIdArb,
          wrongDeviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
        }).filter(({ correctDeviceId, wrongDeviceId }) => 
          correctDeviceId !== wrongDeviceId
        ),
        async ({ correctDeviceId, wrongDeviceId, barName }) => {
          // Setup: Create bar and tab with pending orders
          const barId = fc.sample(uuidArb, 1)[0];
          createdBarIds.push(barId);
          
          await supabase.from('bars').insert({
            id: barId,
            name: barName,
            slug: `test-bar-${Date.now()}-${Math.random()}`,
          });
          
          const tabId = fc.sample(uuidArb, 1)[0];
          createdTabIds.push(tabId);
          
          await supabase.from('tabs').insert({
            id: tabId,
            bar_id: barId,
            device_identifier: correctDeviceId,
            status: 'open',
          });
          
          // Create pending order
          await supabase.from('tab_orders').insert({
            tab_id: tabId,
            items: [{ name: 'Pending Item', quantity: 1, price: 100 }],
            total: 100,
            status: 'pending',
            initiated_by: 'customer',
          });
          
          // Create request with wrong device ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': wrongDeviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should return 401 (unauthorized) not 400 (pending orders error)
          expect(response.status).toBe(401);
          expect(data.error).toMatch(/unauthorized/i);
          expect(data.error).not.toMatch(/pending/i);
        }
      ),
      { numRuns: 100 }
    );
  });
});
