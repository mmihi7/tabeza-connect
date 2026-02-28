/**
 * Property-Based Test Suite for Close Tab API Validation Chain
 * Feature: fix-close-tab-errors
 * Task: 2.5 Write property test for API endpoint validation chain
 * Property 6: API Endpoint Validation Chain
 * 
 * **Validates: Requirements 3.2, 3.3, 3.6**
 * 
 * This test verifies that for any request to the `/api/tabs/close` endpoint,
 * the system validates in order:
 * 1. Tab ID is provided
 * 2. Tab exists
 * 3. Device authorization
 * 4. Balance is zero
 * 5. No pending orders exist
 * 
 * And should return the first validation failure encountered with an appropriate
 * error code and message.
 */

import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/tabs/close/route';

// Mock Next.js request/response
const mockRequest = (body: any, headers: Record<string, string> = {}) => {
  const headersMap = new Map(Object.entries(headers));
  return {
    json: async () => body,
    headers: {
      get: (key: string) => {
        // Case-insensitive header lookup
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

// Skip tests if no database connection is available
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

// Generators for test data
const uuidArb = fc.uuid();
const deviceIdArb = fc.uuid();
const positiveNumberArb = fc.integer({ min: 1, max: 10000 });
const nonNegativeNumberArb = fc.integer({ min: 0, max: 10000 });

// Test data cleanup
const createdTabIds: string[] = [];
const createdBarIds: string[] = [];

afterEach(async () => {
  // Clean up test data
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

describe('Feature: fix-close-tab-errors, Property 6: API Endpoint Validation Chain', () => {
  /**
   * Property Test: Validation Order - Missing Tab ID
   * 
   * For any request without a tab ID, the API should fail at step 1
   * and return a 400 error before checking anything else.
   */
  it('should fail at step 1 when tab ID is missing', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deviceId: deviceIdArb,
          // Intentionally omit tabId or set to null/undefined
          tabId: fc.constantFrom(null, undefined, ''),
        }),
        async ({ deviceId, tabId }) => {
          // Create request without valid tab ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should fail at validation step 1 (missing tab ID)
          expect(response.status).toBe(400);
          expect(data.error).toMatch(/tab id is required/i);
          
          // Property: Should not proceed to check tab existence or other validations
          // (verified by the fact that we get the "missing tab ID" error)
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Validation Order - Tab Not Found
   * 
   * For any request with a valid tab ID format but non-existent tab,
   * the API should fail at step 2 and return a 404 error.
   */
  it('should fail at step 2 when tab does not exist', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tabId: uuidArb,
          deviceId: deviceIdArb,
        }),
        async ({ tabId, deviceId }) => {
          // Ensure tab doesn't exist by using a random UUID
          // (extremely unlikely to collide with existing tab)
          
          // Create request with non-existent tab ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should fail at validation step 2 (tab not found)
          expect(response.status).toBe(404);
          expect(data.error).toMatch(/tab not found/i);
          
          // Property: Should not proceed to device authorization check
          // (verified by getting 404 instead of 401)
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Validation Order - Device Authorization Failure
   * 
   * For any request with an existing tab but wrong device ID,
   * the API should fail at step 3 and return a 401 error.
   */
  it('should fail at step 3 when device is not authorized', async () => {
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
          // Setup: Create a test bar and tab
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
          
          // Property: Should fail at validation step 3 (unauthorized device)
          expect(response.status).toBe(401);
          expect(data.error).toMatch(/unauthorized/i);
          
          // Property: Should not proceed to balance or pending orders check
          // (verified by getting 401 instead of 400)
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Validation Order - Positive Balance
   * 
   * For any request with correct tab ID and device but positive balance,
   * the API should fail at step 4 and return a 400 error with balance details.
   */
  it('should fail at step 4 when balance is positive', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderTotal: positiveNumberArb,
          paymentAmount: nonNegativeNumberArb,
        }).filter(({ orderTotal, paymentAmount }) => 
          orderTotal > paymentAmount
        ),
        async ({ deviceId, barName, orderTotal, paymentAmount }) => {
          // Setup: Create a test bar, tab, order, and payment with positive balance
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
          
          // Create confirmed order
          await supabase.from('tab_orders').insert({
            tab_id: tabId,
            items: [{ name: 'Test Item', quantity: 1, price: orderTotal }],
            total: orderTotal,
            status: 'confirmed',
            initiated_by: 'customer',
          });
          
          // Create payment (less than order total)
          if (paymentAmount > 0) {
            await supabase.from('tab_payments').insert({
              tab_id: tabId,
              amount: paymentAmount,
              method: 'cash',
              status: 'success',
            });
          }
          
          // Create request
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should fail at validation step 4 (positive balance)
          expect(response.status).toBe(400);
          expect(data.error).toMatch(/balance|outstanding/i);
          expect(data.details).toBeDefined();
          expect(data.details.balance).toBeGreaterThan(0);
          
          // Property: Balance should equal orders minus payments
          const expectedBalance = orderTotal - paymentAmount;
          expect(data.details.balance).toBe(expectedBalance);
          
          // Property: Should not proceed to pending orders check
          // (verified by getting balance error instead of pending orders error)
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Validation Order - Pending Orders
   * 
   * For any request with correct tab ID, device, zero balance, but pending orders,
   * the API should fail at step 5 and return a 400 error with pending order details.
   */
  it('should fail at step 5 when pending orders exist', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderInitiator: fc.constantFrom('customer', 'staff'),
          pendingOrderCount: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ deviceId, barName, orderInitiator, pendingOrderCount }) => {
          // Setup: Create a test bar, tab with zero balance but pending orders
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
          
          // Create pending orders
          const pendingOrders = Array.from({ length: pendingOrderCount }, (_, i) => ({
            tab_id: tabId,
            items: [{ name: `Pending Item ${i}`, quantity: 1, price: 100 }],
            total: 100,
            status: 'pending',
            initiated_by: orderInitiator,
          }));
          
          await supabase.from('tab_orders').insert(pendingOrders);
          
          // Create request
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should fail at validation step 5 (pending orders)
          expect(response.status).toBe(400);
          expect(data.error).toMatch(/pending.*order/i);
          expect(data.details).toBeDefined();
          
          // Property: Error should indicate the type of pending orders
          if (orderInitiator === 'staff') {
            expect(data.details.pendingStaffOrders).toBe(pendingOrderCount);
            expect(data.details.message).toMatch(/staff.*order/i);
          } else {
            expect(data.details.pendingCustomerOrders).toBe(pendingOrderCount);
            expect(data.details.message).toMatch(/customer.*order/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Validation Success Path
   * 
   * For any request that passes all validations (correct tab ID, exists, authorized device,
   * zero balance, no pending orders), the API should successfully close the tab.
   */
  it('should succeed when all validations pass', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deviceId: deviceIdArb,
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderTotal: positiveNumberArb,
        }),
        async ({ deviceId, barName, orderTotal }) => {
          // Setup: Create a test bar, tab with zero balance and no pending orders
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
          
          // Create confirmed order and matching payment (zero balance)
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
          
          // Create request
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should pass all validations and succeed
          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          expect(data.message).toMatch(/closed successfully|already closed/i);
          
          // Property: Tab should be closed in database
          const { data: closedTab } = await supabase
            .from('tabs')
            .select('status, closed_at')
            .eq('id', tabId)
            .single();
          
          expect(closedTab?.status).toBe('closed');
          expect(closedTab?.closed_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: First Failure Wins
   * 
   * For any request with multiple validation failures, the API should return
   * the error for the first validation that fails in the chain.
   */
  it('should return first validation failure in chain order', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Test case: missing tab ID (should fail at step 1)
          // Even if we provide wrong device ID, positive balance, etc.
          tabId: fc.constantFrom(null, undefined, ''),
          deviceId: deviceIdArb,
        }),
        async ({ tabId, deviceId }) => {
          // Create request with missing tab ID
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          // Call the API
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should fail at step 1 (missing tab ID)
          // Not at any later validation step
          expect(response.status).toBe(400);
          expect(data.error).toMatch(/tab id is required/i);
          
          // Property: Should not return errors about tab not found,
          // unauthorized device, balance, or pending orders
          expect(data.error).not.toMatch(/not found/i);
          expect(data.error).not.toMatch(/unauthorized/i);
          expect(data.error).not.toMatch(/balance/i);
          expect(data.error).not.toMatch(/pending/i);
        }
      ),
      { numRuns: 100 }
    );
  });
});
