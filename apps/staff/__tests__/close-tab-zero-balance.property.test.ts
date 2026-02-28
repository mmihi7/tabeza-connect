/**
 * Property-Based Test for Staff Close Tab with Zero Balance
 * Feature: fix-close-tab-errors
 * Task: 5.4 Write property test for staff close tab with zero balance
 * Property 1: Zero Balance Tab Closure
 * 
 * **Validates: Requirements 1.1, 2.1, 5.3, 5.5**
 * 
 * For any tab with zero balance (confirmed orders total equals successful payments total),
 * when a close request is made by an authorized user (customer or staff), the tab status
 * should transition to 'closed' and the closed_at timestamp should be set.
 */

import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

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

describe('Feature: fix-close-tab-errors, Property 1: Zero Balance Tab Closure', () => {
  /**
   * Property Test: Staff can close any tab with zero balance
   * 
   * For any tab where confirmed orders total equals successful payments total,
   * staff should be able to close the tab successfully.
   */
  it('should close any tab with zero balance when requested by staff', async () => {
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
          
          // Create order and matching payment (zero balance)
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
          
          // Act: Close the tab using RPC function (as staff would)
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: null,
            p_closed_by: 'staff'
          });
          
          // Assert: Should succeed without error
          expect(error).toBeNull();
          
          // Property: Tab status should be 'closed'
          const { data: closedTab } = await supabase
            .from('tabs')
            .select('status, closed_at, closed_by')
            .eq('id', tabId)
            .single();
          
          expect(closedTab?.status).toBe('closed');
          
          // Property: closed_at timestamp should be set
          expect(closedTab?.closed_at).toBeTruthy();
          expect(new Date(closedTab?.closed_at).getTime()).toBeGreaterThan(0);
          
          // Property: closed_by should be 'staff'
          expect(closedTab?.closed_by).toBe('staff');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Customer can close their own tab with zero balance
   * 
   * For any tab where confirmed orders total equals successful payments total,
   * the customer (device owner) should be able to close the tab successfully.
   */
  it('should close any tab with zero balance when requested by customer', async () => {
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
          
          // Create order and matching payment (zero balance)
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
            method: 'mpesa',
            status: 'success',
          });
          
          // Act: Close the tab using RPC function (as customer would)
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: null,
            p_closed_by: 'customer'
          });
          
          // Assert: Should succeed without error
          expect(error).toBeNull();
          
          // Property: Tab status should be 'closed'
          const { data: closedTab } = await supabase
            .from('tabs')
            .select('status, closed_at, closed_by')
            .eq('id', tabId)
            .single();
          
          expect(closedTab?.status).toBe('closed');
          
          // Property: closed_at timestamp should be set
          expect(closedTab?.closed_at).toBeTruthy();
          
          // Property: closed_by should be 'customer'
          expect(closedTab?.closed_by).toBe('customer');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Zero balance with multiple orders and payments
   * 
   * For any combination of orders and payments that sum to zero balance,
   * the tab should be closeable.
   */
  it('should close tab with multiple orders and payments totaling zero', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderCount: fc.integer({ min: 2, max: 5 }),
          paymentCount: fc.integer({ min: 1, max: 3 }),
          deviceId: uuidArb,
        }),
        async ({ barName, orderCount, paymentCount, deviceId }) => {
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
          
          // Create multiple orders
          let totalOrders = 0;
          const orders = [];
          for (let i = 0; i < orderCount; i++) {
            const amount = fc.sample(fc.integer({ min: 100, max: 1000 }), 1)[0];
            totalOrders += amount;
            orders.push({
              tab_id: tabId,
              items: [{ name: `Item ${i}`, quantity: 1, price: amount }],
              total: amount,
              status: 'confirmed',
              initiated_by: 'customer',
            });
          }
          await supabase.from('tab_orders').insert(orders);
          
          // Create payments that match total
          const payments = [];
          let remainingAmount = totalOrders;
          for (let i = 0; i < paymentCount; i++) {
            const amount = i === paymentCount - 1 
              ? remainingAmount 
              : Math.min(remainingAmount, fc.sample(fc.integer({ min: 100, max: remainingAmount }), 1)[0]);
            remainingAmount -= amount;
            payments.push({
              tab_id: tabId,
              amount: amount,
              method: i % 2 === 0 ? 'cash' : 'mpesa',
              status: 'success',
            });
          }
          await supabase.from('tab_payments').insert(payments);
          
          // Act: Close the tab
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: null,
            p_closed_by: 'staff'
          });
          
          // Assert: Should succeed
          expect(error).toBeNull();
          
          // Property: Tab should be closed
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
});
