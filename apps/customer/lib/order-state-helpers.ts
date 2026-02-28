/**
 * Order State Management Helpers
 * 
 * Provides immutable state update functions for managing order lists in the customer app.
 * These helpers ensure proper ordering, duplicate prevention, and referential integrity.
 * 
 * Requirements: 5, 6, 10
 */

export interface TabOrder {
  id: string;
  tab_id: string;
  items: any[];
  total: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
  order_number?: number;
  initiated_by?: 'customer' | 'staff';
  confirmed_at?: string;
  cancelled_at?: string;
  rejection_reason?: string;
  cancelled_by?: 'customer' | 'staff' | 'system';
}

/**
 * Updates an existing order in the list
 * 
 * @param orders - Current orders array
 * @param updatedOrder - Order with updated fields
 * @returns New orders array with the updated order
 * 
 * Ensures:
 * - Immutability: Creates new array, doesn't mutate input
 * - Proper ordering: Maintains chronological order (newest first)
 * - Duplicate prevention: Updates existing order, doesn't create duplicate
 */
export function updateOrderInList(orders: TabOrder[], updatedOrder: TabOrder): TabOrder[] {
  console.log('📝 updateOrderInList called:', {
    ordersCount: orders.length,
    updatedOrderId: updatedOrder.id,
    updatedOrderStatus: updatedOrder.status
  });

  // Find the index of the order to update
  const index = orders.findIndex(o => o.id === updatedOrder.id);
  
  if (index === -1) {
    // Order not found - this might be a new order that we haven't seen yet
    // Add it to the list in chronological order
    console.log('⚠️ Order not found in list, adding as new order:', updatedOrder.id);
    return addOrderToList(orders, updatedOrder);
  }

  // Create new array with updated order
  const newOrders = [...orders];
  newOrders[index] = updatedOrder;

  console.log('✅ Order updated in list:', {
    orderId: updatedOrder.id,
    oldStatus: orders[index].status,
    newStatus: updatedOrder.status
  });

  // Maintain chronological order (newest first)
  return newOrders.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Adds a new order to the list
 * 
 * @param orders - Current orders array
 * @param newOrder - New order to add
 * @returns New orders array with the added order
 * 
 * Ensures:
 * - Immutability: Creates new array, doesn't mutate input
 * - Proper ordering: Inserts in chronological order (newest first)
 * - Duplicate prevention: Checks if order already exists before adding
 */
export function addOrderToList(orders: TabOrder[], newOrder: TabOrder): TabOrder[] {
  console.log('➕ addOrderToList called:', {
    ordersCount: orders.length,
    newOrderId: newOrder.id,
    newOrderStatus: newOrder.status
  });

  // Check for duplicate
  const exists = orders.some(o => o.id === newOrder.id);
  
  if (exists) {
    console.log('⚠️ Order already exists in list, updating instead:', newOrder.id);
    return updateOrderInList(orders, newOrder);
  }

  // Add new order and sort chronologically (newest first)
  const newOrders = [...orders, newOrder];
  const sorted = newOrders.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  console.log('✅ Order added to list:', {
    orderId: newOrder.id,
    totalOrders: sorted.length
  });

  return sorted;
}

/**
 * Removes an order from the list
 * 
 * @param orders - Current orders array
 * @param orderId - ID of order to remove
 * @returns New orders array without the removed order
 * 
 * Ensures:
 * - Immutability: Creates new array, doesn't mutate input
 * - Safe removal: Returns original array if order not found
 */
export function removeOrderFromList(orders: TabOrder[], orderId: string): TabOrder[] {
  console.log('🗑️ removeOrderFromList called:', {
    ordersCount: orders.length,
    orderIdToRemove: orderId
  });

  // Filter out the order
  const newOrders = orders.filter(o => o.id !== orderId);

  if (newOrders.length === orders.length) {
    console.log('⚠️ Order not found in list, returning original array:', orderId);
    return orders;
  }

  console.log('✅ Order removed from list:', {
    orderId,
    remainingOrders: newOrders.length
  });

  return newOrders;
}

/**
 * Validates that an order list has no duplicates
 * 
 * @param orders - Orders array to validate
 * @returns True if no duplicates found, false otherwise
 */
export function validateNoDuplicates(orders: TabOrder[]): boolean {
  const ids = orders.map(o => o.id);
  const uniqueIds = new Set(ids);
  
  const isValid = ids.length === uniqueIds.size;
  
  if (!isValid) {
    console.error('❌ Duplicate orders detected:', {
      totalOrders: ids.length,
      uniqueOrders: uniqueIds.size,
      duplicates: ids.filter((id, index) => ids.indexOf(id) !== index)
    });
  }
  
  return isValid;
}

/**
 * Validates that orders are in chronological order (newest first)
 * 
 * @param orders - Orders array to validate
 * @returns True if properly ordered, false otherwise
 */
export function validateChronologicalOrder(orders: TabOrder[]): boolean {
  for (let i = 0; i < orders.length - 1; i++) {
    const current = new Date(orders[i].created_at).getTime();
    const next = new Date(orders[i + 1].created_at).getTime();
    
    if (current < next) {
      console.error('❌ Orders not in chronological order:', {
        index: i,
        currentOrder: orders[i].id,
        currentTime: orders[i].created_at,
        nextOrder: orders[i + 1].id,
        nextTime: orders[i + 1].created_at
      });
      return false;
    }
  }
  
  return true;
}
