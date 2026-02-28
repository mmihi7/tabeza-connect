/**
 * Unit Tests for Customer Close Tab Flow
 * Feature: fix-close-tab-errors
 * Task: 3.3 Write unit tests for customer close tab flow
 * 
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
 * 
 * These tests verify specific examples and edge cases for the customer
 * close tab functionality.
 */

import { POST } from '@/app/api/tabs/close/route';
import { createClient } from '@supabase/supabase-js';

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

describe('Customer Close Tab Flow - Unit Tests', () => {
  /**
   * Test: Successful closure with zero balance
   * Requirement 1.1: Customer with zero balance can close tab
   */
  it('should successfully close tab with zero balance', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab with zero balance
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
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
      items: [{ name: 'Beer', quantity: 1, price: 200 }],
      total: 200,
      status: 'confirmed',
      initiated_by: 'customer',
    });
    
    await supabase.from('tab_payments').insert({
      tab_id: tabId,
      amount: 200,
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
    
    // Assert: Should succeed
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toMatch(/closed successfully|already closed/i);
    
    // Verify tab is closed in database
    const { data: closedTab } = await supabase
      .from('tabs')
      .select('status, closed_at, closed_by')
      .eq('id', tabId)
      .single();
    
    expect(closedTab?.status).toBe('closed');
    expect(closedTab?.closed_at).toBeTruthy();
    expect(closedTab?.closed_by).toBe('customer');
  });

  /**
   * Test: Rejection with positive balance
   * Requirement 1.2: Customer with positive balance cannot close tab
   */
  it('should reject closure with positive balance', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab with positive balance
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    createdTabIds.push(tabId);
    
    await supabase.from('tabs').insert({
      id: tabId,
      bar_id: barId,
      device_identifier: deviceId,
      status: 'open',
    });
    
    // Create order with NO payment (positive balance)
    await supabase.from('tab_orders').insert({
      tab_id: tabId,
      items: [{ name: 'Beer', quantity: 2, price: 400 }],
      total: 400,
      status: 'confirmed',
      initiated_by: 'customer',
    });
    
    // Act: Attempt to close the tab
    const request = mockRequest(
      { tabId },
      { 'x-device-id': deviceId }
    );
    
    const response = await POST(request);
    const data = await response.json();
    
    // Assert: Should reject with 400
    expect(response.status).toBe(400);
    expect(data.error).toMatch(/balance|outstanding/i);
    expect(data.details).toBeDefined();
    expect(data.details.balance).toBe(400);
    
    // Verify tab remains open
    const { data: tab } = await supabase
      .from('tabs')
      .select('status')
      .eq('id', tabId)
      .single();
    
    expect(tab?.status).toBe('open');
  });

  /**
   * Test: Rejection with pending orders
   * Requirement 1.4: Clear error message when closure fails
   */
  it('should reject closure with pending orders', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab with pending orders
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    createdTabIds.push(tabId);
    
    await supabase.from('tabs').insert({
      id: tabId,
      bar_id: barId,
      device_identifier: deviceId,
      status: 'open',
    });
    
    // Create pending order
    await supabase.from('tab_orders').insert({
      tab_id: tabId,
      items: [{ name: 'Pizza', quantity: 1, price: 500 }],
      total: 500,
      status: 'pending',
      initiated_by: 'customer',
    });
    
    // Act: Attempt to close the tab
    const request = mockRequest(
      { tabId },
      { 'x-device-id': deviceId }
    );
    
    const response = await POST(request);
    const data = await response.json();
    
    // Assert: Should reject with 400 and clear message
    expect(response.status).toBe(400);
    expect(data.error).toMatch(/pending.*order/i);
    expect(data.details).toBeDefined();
    expect(data.details.pendingCustomerOrders).toBe(1);
    expect(data.details.message).toMatch(/customer.*order/i);
    
    // Verify tab remains open
    const { data: tab } = await supabase
      .from('tabs')
      .select('status')
      .eq('id', tabId)
      .single();
    
    expect(tab?.status).toBe('open');
  });

  /**
   * Test: Authorization failure
   * Requirement 1.5: Validate tab belongs to requesting device
   */
  it('should reject closure with wrong device identifier', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const correctDeviceId = crypto.randomUUID();
    const wrongDeviceId = crypto.randomUUID();
    createdTabIds.push(tabId);
    
    await supabase.from('tabs').insert({
      id: tabId,
      bar_id: barId,
      device_identifier: correctDeviceId,
      status: 'open',
    });
    
    // Act: Attempt to close with wrong device ID
    const request = mockRequest(
      { tabId },
      { 'x-device-id': wrongDeviceId }
    );
    
    const response = await POST(request);
    const data = await response.json();
    
    // Assert: Should reject with 401
    expect(response.status).toBe(401);
    expect(data.error).toMatch(/unauthorized/i);
    
    // Verify tab remains open
    const { data: tab } = await supabase
      .from('tabs')
      .select('status')
      .eq('id', tabId)
      .single();
    
    expect(tab?.status).toBe('open');
  });

  /**
   * Test: Edge case - Tab with partial payment
   * Requirement 1.2: Positive balance prevents closure
   */
  it('should reject closure with partial payment (positive balance)', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab with partial payment
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    createdTabIds.push(tabId);
    
    await supabase.from('tabs').insert({
      id: tabId,
      bar_id: barId,
      device_identifier: deviceId,
      status: 'open',
    });
    
    // Create order with partial payment
    await supabase.from('tab_orders').insert({
      tab_id: tabId,
      items: [{ name: 'Meal', quantity: 1, price: 1000 }],
      total: 1000,
      status: 'confirmed',
      initiated_by: 'customer',
    });
    
    await supabase.from('tab_payments').insert({
      tab_id: tabId,
      amount: 600,
      method: 'mpesa',
      status: 'success',
    });
    
    // Act: Attempt to close the tab
    const request = mockRequest(
      { tabId },
      { 'x-device-id': deviceId }
    );
    
    const response = await POST(request);
    const data = await response.json();
    
    // Assert: Should reject with remaining balance
    expect(response.status).toBe(400);
    expect(data.error).toMatch(/balance|outstanding/i);
    expect(data.details.balance).toBe(400); // 1000 - 600
  });

  /**
   * Test: Edge case - Multiple orders and payments
   * Requirement 1.1: Zero balance allows closure
   */
  it('should close tab with multiple orders and payments totaling zero', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab with multiple orders and payments
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    createdTabIds.push(tabId);
    
    await supabase.from('tabs').insert({
      id: tabId,
      bar_id: barId,
      device_identifier: deviceId,
      status: 'open',
    });
    
    // Create multiple orders
    await supabase.from('tab_orders').insert([
      {
        tab_id: tabId,
        items: [{ name: 'Beer', quantity: 2, price: 400 }],
        total: 400,
        status: 'confirmed',
        initiated_by: 'customer',
      },
      {
        tab_id: tabId,
        items: [{ name: 'Fries', quantity: 1, price: 150 }],
        total: 150,
        status: 'confirmed',
        initiated_by: 'customer',
      },
      {
        tab_id: tabId,
        items: [{ name: 'Soda', quantity: 1, price: 100 }],
        total: 100,
        status: 'confirmed',
        initiated_by: 'customer',
      },
    ]);
    
    // Create multiple payments totaling the same
    await supabase.from('tab_payments').insert([
      {
        tab_id: tabId,
        amount: 400,
        method: 'cash',
        status: 'success',
      },
      {
        tab_id: tabId,
        amount: 250,
        method: 'mpesa',
        status: 'success',
      },
    ]);
    
    // Act: Close the tab
    const request = mockRequest(
      { tabId },
      { 'x-device-id': deviceId }
    );
    
    const response = await POST(request);
    const data = await response.json();
    
    // Assert: Should succeed
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify tab is closed
    const { data: closedTab } = await supabase
      .from('tabs')
      .select('status')
      .eq('id', tabId)
      .single();
    
    expect(closedTab?.status).toBe('closed');
  });

  /**
   * Test: Edge case - Tab with cancelled orders
   * Requirement 1.1: Only confirmed orders count toward balance
   */
  it('should ignore cancelled orders when calculating balance', async () => {
    if (skipIfNoDb()) {
      console.log('⏭️  Skipping test: No database connection');
      return;
    }

    // Setup: Create bar and tab with cancelled orders
    const barId = crypto.randomUUID();
    createdBarIds.push(barId);
    
    await supabase.from('bars').insert({
      id: barId,
      name: 'Test Bar',
      slug: `test-bar-${Date.now()}`,
    });
    
    const tabId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    createdTabIds.push(tabId);
    
    await supabase.from('tabs').insert({
      id: tabId,
      bar_id: barId,
      device_identifier: deviceId,
      status: 'open',
    });
    
    // Create confirmed and cancelled orders
    await supabase.from('tab_orders').insert([
      {
        tab_id: tabId,
        items: [{ name: 'Beer', quantity: 1, price: 200 }],
        total: 200,
        status: 'confirmed',
        initiated_by: 'customer',
      },
      {
        tab_id: tabId,
        items: [{ name: 'Wine', quantity: 1, price: 500 }],
        total: 500,
        status: 'cancelled',
        initiated_by: 'customer',
      },
    ]);
    
    // Payment only for confirmed order
    await supabase.from('tab_payments').insert({
      tab_id: tabId,
      amount: 200,
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
    
    // Assert: Should succeed (cancelled order not counted)
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
