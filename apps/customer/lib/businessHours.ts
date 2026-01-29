import { supabase } from './supabase';

// Type definitions
interface Bar {
  id: string;
  name: string;
  business_hours_mode?: string;
  business_hours_simple?: {
    openTime: string;
    closeTime: string;
    closeNextDay?: boolean;
  };
  business_24_hours?: boolean;
}

interface Tab {
  id: string;
  status: string;
  bar_id: string;
  bar: Bar;
}

interface Order {
  total: string;
}

interface Payment {
  amount: string;
}

// Business hours check for TypeScript - Updated to match database schema
export const isWithinBusinessHours = (bar: Bar): boolean => {
  try {
    // If 24 hours mode, always open
    if (bar.business_24_hours) {
      return true;
    }
    
    // If no business hours mode set or not simple mode, default to open
    if (!bar.business_hours_mode || bar.business_hours_mode !== 'simple') {
      return true;
    }
    
    // If no simple hours configured, default to open
    if (!bar.business_hours_simple) {
      return true;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    // Parse open time (format: "HH:MM")
    const [openHour, openMinute] = bar.business_hours_simple.openTime.split(':').map(Number);
    const openTotalMinutes = openHour * 60 + openMinute;
    
    // Parse close time
    const [closeHour, closeMinute] = bar.business_hours_simple.closeTime.split(':').map(Number);
    const closeTotalMinutes = closeHour * 60 + closeMinute;
    
    // Handle overnight hours (e.g., 20:00 to 04:00)
    if (bar.business_hours_simple.closeNextDay || closeTotalMinutes < openTotalMinutes) {
      // Venue is open overnight: current time >= open OR current time <= close
      return currentTotalMinutes >= openTotalMinutes || currentTotalMinutes <= closeTotalMinutes;
    } else {
      // Normal hours: current time between open and close
      return currentTotalMinutes >= openTotalMinutes && currentTotalMinutes <= closeTotalMinutes;
    }
  } catch (error) {
    console.error('Error checking business hours:', error);
    return true; // Default to open on error
  }
};

// Check if new tab can be created
export const canCreateNewTab = async (barId: string): Promise<{
  canCreate: boolean;
  message: string;
  openTime?: string;
}> => {
  try {
    const { data: bar, error } = await supabase
      .from('bars')
      .select('name, business_hours_mode, business_hours_simple, business_24_hours')
      .eq('id', barId)
      .single() as { data: Bar | null, error: any };
    
    if (error) throw error;
    
    if (!bar) {
      return {
        canCreate: false,
        message: 'Bar not found'
      };
    }
    
    const isOpen = isWithinBusinessHours(bar);
    
    if (!isOpen) {
      const openTime = bar.business_hours_simple?.openTime || 'tomorrow';
      return {
        canCreate: false,
        message: `${bar.name} is currently closed`,
        openTime
      };
    }
    
    return {
      canCreate: true,
      message: `${bar.name} is open` 
    };
  } catch (error) {
    console.error('Error checking if can create tab:', error);
    return {
      canCreate: true, // Default to allow on error
      message: 'Available'
    };
  }
};

// Check tab overdue status for customer
export const checkTabOverdueStatus = async (tabId: string): Promise<{
  isOverdue: boolean;
  balance: number;
  message: string;
}> => {
  try {
    // Get tab with bar info
    const { data: tab, error } = await supabase
      .from('tabs')
      .select(`
        *,
        bar:bars(
          id,
          name,
          business_hours_mode,
          business_hours_simple,
          business_24_hours
        )
      `)
      .eq('id', tabId)
      .single() as { data: Tab | null, error: any };
    
    if (error) throw error;
    
    if (!tab) {
      return {
        isOverdue: false,
        balance: 0,
        message: 'Tab not found'
      };
    }
    
    // Get tab balance
    const { data: orders } = await supabase
      .from('tab_orders')
      .select('total')
      .eq('tab_id', tabId)
      .eq('status', 'confirmed') as { data: Order[] | null, error: any };
    
    const { data: payments } = await supabase
      .from('tab_payments')
      .select('amount')
      .eq('tab_id', tabId)
      .eq('status', 'success') as { data: Payment[] | null, error: any };
    
    const ordersTotal = orders?.reduce((sum, order) => sum + parseFloat(order.total), 0) || 0;
    const paymentsTotal = payments?.reduce((sum, payment) => sum + parseFloat(payment.amount), 0) || 0;
    const balance = ordersTotal - paymentsTotal;
    
    // Check business hours
    const isOpen = isWithinBusinessHours(tab.bar);
    
    // Determine if overdue
    const isOverdue = balance > 0 && !isOpen && tab.status === 'open';
    
    return {
      isOverdue,
      balance,
      message: isOverdue 
        ? 'Tab is overdue - venue is closed with outstanding balance'
        : balance > 0 
          ? `Balance: KSh ${balance.toLocaleString()}` 
          : 'Tab is settled'
    };
  } catch (error) {
    console.error('Error checking tab overdue status:', error);
    return {
      isOverdue: false,
      balance: 0,
      message: 'Error checking status'
    };
  }
};
