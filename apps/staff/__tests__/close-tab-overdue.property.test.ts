/**
 * Property-Based Test for Staff Overdue Transition
 * Feature: fix-close-tab-errors
 * Task: 5.5 Write property test for staff overdue transition
 * Property 3: Positive Balance Overdue Transition for Staff
 * 
 * **Validates: Requirements 2.2, 5.4, 5.6**
 * 
 * For any tab with a positive balance, when staff closes the tab with a write-off
 * amount equal to the balance, the tab status should transition to 'overdue',
 * the moved_to_overdue_at timestamp should be set, and an audit log entry should be created.
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

describe('Feature: fix-close-tab-errors, Property 3: Positive Balance Overdue Transition for Staff', () => {
  /**
   * Property Test: Staff can push any tab with positive balance to overdue
   * 
   * For any tab with positive balance (orders > payments), when staff closes
   * with write-off equal to balance, tab should transition to overdue.
   */
  it('should push tab to overdue when staff closes with positive balance', async () => {
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
          
          const balance = orderTotal - paymentAmount;
          
          // Act: Push to overdue with write-off
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: balance,
            p_closed_by: 'staff'
          });
          
          // Assert: Should succeed without error
          expect(error).toBeNull();
          
          // Property: Tab status should be 'overdue'
          const { data: overdueTab } = await supabase
            .from('tabs')
            .select('status, moved_to_overdue_at, overdue_reason, closed_by')
            .eq('id', tabId)
            .single();
          
          expect(overdueTab?.status).toBe('overdue');
          
          // Property: moved_to_overdue_at timestamp should be set
          expect(overdueTab?.moved_to_overdue_at).toBeTruthy();
          expect(new Date(overdueTab?.moved_to_overdue_at).getTime()).toBeGreaterThan(0);
          
          // Property: overdue_reason should contain balance information
          expect(overdueTab?.overdue_reason).toMatch(/unpaid balance/i);
          expect(overdueTab?.overdue_reason).toContain(balance.toString());
          
          // Property: closed_by should be 'staff'
          expect(overdueTab?.closed_by).toBe('staff');
          
          // Property: Audit log entry should be created
          const { data: auditLogs } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('tab_id', tabId)
            .eq('action', 'tab_pushed_to_overdue')
            .order('created_at', { ascending: false })
            .limit(1);
          
          expect(auditLogs).toBeTruthy();
          expect(auditLogs?.length).toBeGreaterThan(0);
          
          const auditLog = auditLogs[0];
          expect(auditLog.details).toBeDefined();
          expect(auditLog.details.write_off_amount).toBe(balance);
          expect(auditLog.details.balance).toBe(balance);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Overdue transition with no payment
   * 
   * For any tab with orders but no payments, staff should be able to
   * push to overdue with write-off equal to total orders.
   */
  it('should push tab to overdue with full order amount when no payments made', async () => {
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
          // Setup: Create bar and tab with order but no payment
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
          
          // Create order with no payment
          await supabase.from('tab_orders').insert({
            tab_id: tabId,
            items: [{ name: 'Test Item', quantity: 1, price: orderTotal }],
            total: orderTotal,
            status: 'confirmed',
            initiated_by: 'customer',
          });
          
          // Act: Push to overdue with full amount
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: orderTotal,
            p_closed_by: 'staff'
          });
          
          // Assert: Should succeed
          expect(error).toBeNull();
          
          // Property: Tab should be overdue
          const { data: overdueTab } = await supabase
            .from('tabs')
            .select('status, moved_to_overdue_at')
            .eq('id', tabId)
            .single();
          
          expect(overdueTab?.status).toBe('overdue');
          expect(overdueTab?.moved_to_overdue_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Overdue transition with multiple orders
   * 
   * For any tab with multiple orders and partial payments, staff should
   * be able to push to overdue with write-off equal to remaining balance.
   */
  it('should push tab to overdue with correct balance for multiple orders', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          barName: fc.string({ minLength: 5, maxLength: 20 }),
          orderCount: fc.integer({ min: 2, max: 5 }),
          paymentRatio: fc.double({ min: 0, max: 0.9 }), // Pay 0-90% of total
          deviceId: uuidArb,
        }),
        async ({ barName, orderCount, paymentRatio, deviceId }) => {
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
          
          // Create partial payment
          const paymentAmount = Math.floor(totalOrders * paymentRatio);
          if (paymentAmount > 0) {
            await supabase.from('tab_payments').insert({
              tab_id: tabId,
              amount: paymentAmount,
              method: 'mpesa',
              status: 'success',
            });
          }
          
          const balance = totalOrders - paymentAmount;
          
          // Act: Push to overdue
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: balance,
            p_closed_by: 'staff'
          });
          
          // Assert: Should succeed
          expect(error).toBeNull();
          
          // Property: Tab should be overdue with correct balance
          const { data: overdueTab } = await supabase
            .from('tabs')
            .select('status, moved_to_overdue_at, overdue_reason')
            .eq('id', tabId)
            .single();
          
          expect(overdueTab?.status).toBe('overdue');
          expect(overdueTab?.moved_to_overdue_at).toBeTruthy();
          expect(overdueTab?.overdue_reason).toContain(balance.toString());
          
          // Property: Audit log should have correct balance
          const { data: auditLogs } = await supabase
            .from('audit_logs')
            .select('details')
            .eq('tab_id', tabId)
            .eq('action', 'tab_pushed_to_overdue')
            .single();
          
          expect(auditLogs?.details.write_off_amount).toBe(balance);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Cannot push to overdue with zero balance
   * 
   * For any tab with zero balance, attempting to push to overdue should
   * result in normal closure instead.
   */
  it('should close normally when write-off is zero even if specified', async () => {
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
          
          // Act: Try to push to overdue with zero write-off
          const { error } = await supabase.rpc('close_tab', {
            p_tab_id: tabId,
            p_write_off_amount: 0,
            p_closed_by: 'staff'
          });
          
          // Assert: Should succeed
          expect(error).toBeNull();
          
          // Property: Tab should be closed, not overdue
          const { data: closedTab } = await supabase
            .from('tabs')
            .select('status, closed_at, moved_to_overdue_at')
            .eq('id', tabId)
            .single();
          
          expect(closedTab?.status).toBe('closed');
          expect(closedTab?.closed_at).toBeTruthy();
          expect(closedTab?.moved_to_overdue_at).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
