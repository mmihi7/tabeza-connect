/**
 * Additional Property-Based Tests for Close Tab API
 * Feature: fix-close-tab-errors
 * Tasks: 8.1, 8.2, 8.3, 8.4
 * 
 * Property 2: Positive Balance Rejection for Customers
 * Property 4: Pending Orders Block Closure
 * Property 7: Success Response Format
 * Property 10: RPC Function Idempotency
 * 
 * **Validates: Requirements 1.2, 2.3, 2.4, 3.4, 3.5, 4.2, 5.3, 5.4**
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
const positiveNumberArb = fc.integer({ min: 100, max: 10000 });
const nonNegativeNumberArb = fc.integer({ min: 0, max: 10000 });

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

describe('Feature: fix-close-tab-errors, Property 2: Positive Balance Rejection for Customers', () => {
  /**
   * Property Test: Customer cannot close tab with positive balance
   * 
   * For any tab with positive balance (orders > payments), customer
   * attempts to close should be rejected with 400 and balance details.
   */
  it('should reject customer closure with positive balance', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderTotal: positiveNumberArb,
          paymentAmount: nonNegativeNumberArb,
          deviceId: uuidArb,
        }).filter(({ orderTotal, paymentAmount }) => 
          orderTotal > paymentAmount
        ),
        async ({ barName, orderTotal, paymentAmount, deviceId }) => {
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
            device_identifier: deviceId,
            status: 'open',
          });
          
          // Create order
          await supabase.from('tab_orders').insert({
            tab_id: tabId,
            items: [{ name: 'Test Item', quantity: 1, price: orderTotal }],
            total: orderTotal,
            status: 'confirmed',
            initiated_by: 'customer',
          });
          
          // Create partial or no payment
          if (paymentAmount > 0) {
            await supabase.from('tab_payments').insert({
              tab_id: tabId,
              amount: paymentAmount,
              method: 'cash',
              status: 'success',
            });
          }
          
          const expectedBalance = orderTotal - paymentAmount;
          
          // Act: Attempt to close
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should reject with 400
          expect(response.status).toBe(400);
          
          // Property: Error should mention balance
          expect(data.error).toMatch(/balance|outstanding/i);
          
          // Property: Details should include exact balance
          expect(data.details).toBeDefined();
          expect(data.details.balance).toBe(expectedBalance);
          
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
});

describe('Feature: fix-close-tab-errors, Property 4: Pending Orders Block Closure', () => {
  /**
   * Property Test: Pending staff orders block closure
   * 
   * For any tab with pending staff orders, closure should be blocked
   * with details about the pending orders.
   */
  it('should block closure when pending staff orders exist', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          pendingOrderCount: fc.integer({ min: 1, max: 5 }),
          deviceId: uuidArb,
        }),
        async ({ barName, pendingOrderCount, deviceId }) => {
          // Setup: Create bar and tab with pending staff orders
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
          
          // Create pending staff orders
          const orders = Array.from({ length: pendingOrderCount }, (_, i) => ({
            tab_id: tabId,
            items: [{ name: `Staff Item ${i}`, quantity: 1, price: 100 }],
            total: 100,
            status: 'pending',
            initiated_by: 'staff',
          }));
          
          await supabase.from('tab_orders').insert(orders);
          
          // Act: Attempt to close
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should reject with 400
          expect(response.status).toBe(400);
          
          // Property: Error should mention pending orders
          expect(data.error).toMatch(/pending.*order/i);
          
          // Property: Details should include count
          expect(data.details).toBeDefined();
          expect(data.details.pendingStaffOrders).toBe(pendingOrderCount);
          expect(data.details.message).toMatch(/staff.*order/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Pending customer orders block closure
   * 
   * For any tab with pending customer orders, closure should be blocked
   * with details about the pending orders.
   */
  it('should block closure when pending customer orders exist', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          pendingOrderCount: fc.integer({ min: 1, max: 5 }),
          deviceId: uuidArb,
        }),
        async ({ barName, pendingOrderCount, deviceId }) => {
          // Setup: Create bar and tab with pending customer orders
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
          
          // Create pending customer orders
          const orders = Array.from({ length: pendingOrderCount }, (_, i) => ({
            tab_id: tabId,
            items: [{ name: `Customer Item ${i}`, quantity: 1, price: 100 }],
            total: 100,
            status: 'pending',
            initiated_by: 'customer',
          }));
          
          await supabase.from('tab_orders').insert(orders);
          
          // Act: Attempt to close
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should reject with 400
          expect(response.status).toBe(400);
          
          // Property: Error should mention pending orders
          expect(data.error).toMatch(/pending.*order/i);
          
          // Property: Details should include count
          expect(data.details).toBeDefined();
          expect(data.details.pendingCustomerOrders).toBe(pendingOrderCount);
          expect(data.details.message).toMatch(/customer.*order/i);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: fix-close-tab-errors, Property 7: Success Response Format', () => {
  /**
   * Property Test: Successful closure returns correct format
   * 
   * For any successful tab closure, the response should have 200 status,
   * success flag, and confirmation message.
   */
  it('should return correct format for successful closure', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderTotal: positiveNumberArb,
          deviceId: uuidArb,
        }),
        async ({ barName, orderTotal, deviceId }) => {
          // Setup: Create bar and tab with zero balance
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
          
          // Create order and matching payment
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
          
          // Act: Close the tab
          const request = mockRequest(
            { tabId },
            { 'x-device-id': deviceId }
          );
          
          const response = await POST(request);
          const data = await response.json();
          
          // Property: Should return 200 status
          expect(response.status).toBe(200);
          
          // Property: Should have success flag
          expect(data.success).toBe(true);
          
          // Property: Should have confirmation message
          expect(data.message).toBeTruthy();
          expect(data.message).toMatch(/closed successfully|already closed/i);
          
          // Property: Should not have error field
          expect(data.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: fix-close-tab-errors, Property 10: RPC Function Idempotency', () => {
  /**
   * Property Test: Closing already-closed tab raises exception
   * 
   * For any tab that is already closed, attempting to close it again
   * should raise an exception indicating it's already closed.
   */
  it('should raise exception when closing already-closed tab', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          deviceId: uuidArb,
        }),
        async ({ barName, deviceId }) => {
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
          
          // Close the tab first time
          const { error: firstError } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: null,
            p_closed_by: 'customer'
          });
          
          expect(firstError).toBeNull();
          
          // Property: Tab should be closed
          const { data: closedTab } = await supabase
            .from('tabs')
            .select('status')
            .eq('id', tabId)
            .single();
          
          expect(closedTab?.status).toBe('closed');
          
          // Act: Try to close again
          const { error: secondError } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: null,
            p_closed_by: 'customer'
          });
          
          // Property: Should raise exception
          expect(secondError).toBeTruthy();
          expect(secondError.message).toMatch(/already closed/i);
          
          // Property: Tab should still be closed (not changed)
          const { data: stillClosedTab } = await supabase
            .from('tabs')
            .select('status, closed_at')
            .eq('id', tabId)
            .single();
          
          expect(stillClosedTab?.status).toBe('closed');
          expect(stillClosedTab?.closed_at).toBe(closedTab?.closed_at);
        }
      ),
      { numRuns: 100 }
    );
  });
});
