/**
 * Unit Test Suite for Close Tab API Endpoint
 * Feature: fix-close-tab-errors
 * Task: 3.3 Write unit tests for customer close tab flow
 * 
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
 * 
 * This test suite verifies specific examples and edge cases for the
 * customer close tab API endpoint, complementing the property-based tests.
 */

import { createClient } from '@supabase/supabase-js';

// Mock Next.js request/response
const mockRequest = (body: any, headers: Record<string, string> = {}) => {
  return {
    json: async () => body,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
    },
  } as any;
};

// Test database setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test data cleanup
const createdTabIds: string[] = [];
const createdBarIds: string[] = [];

// Helper function to generate UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Helper function to create test bar
const createTestBar = async (name: string = 'Test Bar') => {
  const barId = generateUUID();
  const slug = `test-bar-${Date.now()}-${Math.random()}`;
  
  await supabase.from('bars').insert({
    id: barId,
    name,
    slug,
  });
  
  createdBarIds.push(barId);
  return barId;
};

// Helper function to create test tab
const createTestTab = async (barId: string, deviceId: string, status: string = 'open') => {
  const tabId = generateUUID();
  
  await supabase.from('tabs').insert({
    id: tabId,
    bar_id: barId,
    device_identifier: deviceId,
    status,
  });
  
  createdTabIds.push(tabId);
  return tabId;
};

// Helper function to create test order
const createTestOrder = async (tabId: string, total: number, status: string = 'confirmed', initiatedBy: string = 'customer') => {
  await supabase.from('tab_orders').insert({
    tab_id: tabId,
    items: [{ name: 'Test Item', quantity: 1, price: total }],
    total,
    status,
    initiated_by: initiatedBy,
  });
};

// Helper function to create test payment
const createTestPayment = async (tabId: string, amount: number, status: string = 'success') => {
  await supabase.from('tab_payments').insert({
    tab_id: tabId,
    amount,
    method: 'cash',
    status,
  });
};

afterEach(async () => {
  // Clean up test data
  if (createdTabIds.length > 0) {
    await supabase.from('tabs').delete().in('id', createdTabIds);
    createdTabIds.length = 0;
  }
  if (createdBarIds.length > 0) {
    await supabase.from('bars').delete().in('id', createdBarIds);
    createdBarIds.length = 0;
  }
});

describe('Feature: fix-close-tab-errors - Customer Close Tab Unit Tests', () => {
  
  describe('Successful Closure Scenarios (Requirement 1.1)', () => {
    
    it('should successfully close tab with zero balance (no orders, no payments)', async () => {
      // Setup: Create bar and tab with no orders or payments
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
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
    
    it('should successfully close tab with zero balance (orders equal payments)', async () => {
      // Setup: Create bar, tab, order, and matching payment
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order for 500
      await createTestOrder(tabId, 500);
      
      // Create payment for 500
      await createTestPayment(tabId, 500);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify tab is closed in database
      const { data: closedTab } = await supabase
        .from('tabs')
        .select('status, closed_at')
        .eq('id', tabId)
        .single();
      
      expect(closedTab?.status).toBe('closed');
      expect(closedTab?.closed_at).toBeTruthy();
    });
    
    it('should successfully close tab with multiple orders and payments that balance to zero', async () => {
      // Setup: Create bar, tab, multiple orders and payments
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create multiple orders totaling 1500
      await createTestOrder(tabId, 500);
      await createTestOrder(tabId, 700);
      await createTestOrder(tabId, 300);
      
      // Create multiple payments totaling 1500
      await createTestPayment(tabId, 1000);
      await createTestPayment(tabId, 500);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
    
    it('should return success if tab is already closed', async () => {
      // Setup: Create bar and tab that is already closed
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId, 'closed');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed with already closed message
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/already closed/i);
      expect(data.alreadyClosed).toBe(true);
    });
  });
  
  describe('Positive Balance Rejection (Requirement 1.2)', () => {
    
    it('should reject closure when balance is positive (orders > payments)', async () => {
      // Setup: Create bar, tab with positive balance
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order for 1000
      await createTestOrder(tabId, 1000);
      
      // Create payment for 600 (balance = 400)
      await createTestPayment(tabId, 600);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 400
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/balance|outstanding/i);
      expect(data.details).toBeDefined();
      expect(data.details.balance).toBe(400);
      expect(data.details.confirmedOrdersTotal).toBe(1000);
      expect(data.details.successfulPaymentsTotal).toBe(600);
    });
    
    it('should reject closure when balance is positive (no payments)', async () => {
      // Setup: Create bar, tab with order but no payment
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order for 500
      await createTestOrder(tabId, 500);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 400
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/balance|outstanding/i);
      expect(data.details.balance).toBe(500);
    });
    
    it('should reject closure with small positive balance (edge case)', async () => {
      // Setup: Create bar, tab with very small positive balance
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order for 100.50
      await createTestOrder(tabId, 100.50);
      
      // Create payment for 100.49 (balance = 0.01)
      await createTestPayment(tabId, 100.49);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject even with tiny balance
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/balance|outstanding/i);
      expect(data.details.balance).toBeGreaterThan(0);
    });
  });
  
  describe('Authorization Validation (Requirement 1.5)', () => {
    
    it('should reject closure when device identifier does not match', async () => {
      // Setup: Create bar and tab with one device ID
      const correctDeviceId = generateUUID();
      const wrongDeviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, correctDeviceId);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request with wrong device ID
      const request = mockRequest(
        { tabId },
        { 'x-device-id': wrongDeviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 401
      expect(response.status).toBe(401);
      expect(data.error).toMatch(/unauthorized/i);
    });
    
    it('should reject closure when no device identifier is provided', async () => {
      // Setup: Create bar and tab
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request without device ID
      const request = mockRequest({ tabId }, {});
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 401
      expect(response.status).toBe(401);
      expect(data.error).toMatch(/device identifier is required/i);
    });
    
    it('should accept device ID from cookie header', async () => {
      // Setup: Create bar and tab
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request with device ID in cookie
      const request = mockRequest(
        { tabId },
        { 'cookie': `tabeza_device_id_v2=${deviceId}` }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed (or fail for other reasons, but not authorization)
      expect(response.status).not.toBe(401);
    });
    
    it('should accept device ID from request body', async () => {
      // Setup: Create bar and tab
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request with device ID in body
      const request = mockRequest(
        { tabId, deviceId },
        {}
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed (or fail for other reasons, but not authorization)
      expect(response.status).not.toBe(401);
    });
  });
  
  describe('Pending Orders Validation (Requirement 1.4)', () => {
    
    it('should reject closure when pending staff orders exist', async () => {
      // Setup: Create bar, tab with pending staff order
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create pending staff order
      await createTestOrder(tabId, 300, 'pending', 'staff');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 400
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/pending.*staff.*order/i);
      expect(data.details).toBeDefined();
      expect(data.details.pendingStaffOrders).toBe(1);
      expect(data.details.message).toMatch(/staff.*order.*awaiting.*approval/i);
    });
    
    it('should reject closure when pending customer orders exist', async () => {
      // Setup: Create bar, tab with pending customer order
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create pending customer order
      await createTestOrder(tabId, 200, 'pending', 'customer');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 400
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/pending.*customer.*order/i);
      expect(data.details).toBeDefined();
      expect(data.details.pendingCustomerOrders).toBe(1);
      expect(data.details.message).toMatch(/customer.*order.*not yet served/i);
    });
    
    it('should reject closure when multiple pending orders exist', async () => {
      // Setup: Create bar, tab with multiple pending orders
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create multiple pending staff orders
      await createTestOrder(tabId, 100, 'pending', 'staff');
      await createTestOrder(tabId, 200, 'pending', 'staff');
      await createTestOrder(tabId, 300, 'pending', 'staff');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 400
      expect(response.status).toBe(400);
      expect(data.details.pendingStaffOrders).toBe(3);
    });
    
    it('should allow closure when only confirmed orders exist (no pending)', async () => {
      // Setup: Create bar, tab with confirmed orders and matching payments
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create confirmed orders
      await createTestOrder(tabId, 500, 'confirmed', 'customer');
      await createTestOrder(tabId, 300, 'confirmed', 'staff');
      
      // Create matching payments
      await createTestPayment(tabId, 800);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
    
    it('should allow closure when only cancelled orders exist', async () => {
      // Setup: Create bar, tab with cancelled orders
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create cancelled orders
      await createTestOrder(tabId, 500, 'cancelled', 'customer');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
  
  describe('Error Handling (Requirement 1.4)', () => {
    
    it('should return 400 when tab ID is missing', async () => {
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request without tab ID
      const request = mockRequest(
        {},
        { 'x-device-id': generateUUID() }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 400
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/tab id is required/i);
    });
    
    it('should return 404 when tab does not exist', async () => {
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request with non-existent tab ID
      const request = mockRequest(
        { tabId: generateUUID() },
        { 'x-device-id': generateUUID() }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject with 404
      expect(response.status).toBe(404);
      expect(data.error).toMatch(/tab not found/i);
    });
    
    it('should provide clear error messages without technical details', async () => {
      // Setup: Create bar, tab with positive balance
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order with positive balance
      await createTestOrder(tabId, 500);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Error message should be user-friendly
      expect(data.error).toBeDefined();
      expect(data.error).not.toMatch(/sql|query|database|table|column/i);
      expect(data.error).not.toMatch(/stack|trace|exception/i);
      
      // Should provide helpful details
      expect(data.details).toBeDefined();
      expect(data.details.balance).toBeDefined();
    });
  });
  
  describe('Edge Cases', () => {
    
    it('should handle tab with failed payments (not counted in balance)', async () => {
      // Setup: Create bar, tab with order and failed payment
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order for 500
      await createTestOrder(tabId, 500);
      
      // Create failed payment (should not count)
      await createTestPayment(tabId, 500, 'failed');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject because failed payment doesn't count
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/balance|outstanding/i);
      expect(data.details.balance).toBe(500);
    });
    
    it('should handle tab with pending payments (not counted in balance)', async () => {
      // Setup: Create bar, tab with order and pending payment
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create order for 500
      await createTestOrder(tabId, 500);
      
      // Create pending payment (should not count)
      await createTestPayment(tabId, 500, 'pending');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should reject because pending payment doesn't count
      expect(response.status).toBe(400);
      expect(data.error).toMatch(/balance|outstanding/i);
      expect(data.details.balance).toBe(500);
    });
    
    it('should handle tab with cancelled orders (not counted in balance)', async () => {
      // Setup: Create bar, tab with cancelled order
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create cancelled order (should not count)
      await createTestOrder(tabId, 500, 'cancelled');
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed because cancelled order doesn't count
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
    
    it('should handle decimal amounts correctly', async () => {
      // Setup: Create bar, tab with decimal amounts
      const deviceId = generateUUID();
      const barId = await createTestBar();
      const tabId = await createTestTab(barId, deviceId);
      
      // Create orders with decimal amounts
      await createTestOrder(tabId, 123.45);
      await createTestOrder(tabId, 67.89);
      
      // Create matching payment
      await createTestPayment(tabId, 191.34);
      
      // Import the API route handler
      const { POST } = await import('@/app/api/tabs/close/route');
      
      // Create request
      const request = mockRequest(
        { tabId },
        { 'x-device-id': deviceId }
      );
      
      // Act: Call the API
      const response = await POST(request);
      const data = await response.json();
      
      // Assert: Should succeed with correct decimal handling
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
