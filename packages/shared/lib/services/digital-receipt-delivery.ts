/**
 * Digital Receipt Delivery Service
 * Handles conversion of POS print data to digital receipts and delivery to customers
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

export interface PrintDataReceipt {
  items: ReceiptItem[];
  total: number;
  subtotal?: number;
  tax?: number;
  customerInfo?: {
    tableNumber?: number;
    phone?: string;
    name?: string;
  };
  metadata?: {
    posSystemId?: string;
    transactionId?: string;
    timestamp: Date;
  };
  rawReceipt?: string;
}

export interface DigitalReceipt {
  id: string;
  barId: string;
  tabId: string;
  orderId: string;
  items: ReceiptItem[];
  total: number;
  subtotal?: number;
  tax?: number;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
}

export interface DeliveryAttempt {
  attemptNumber: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface DeliveryResult {
  receiptId: string;
  tabId: string;
  tabNumber: number;
  customerIdentifier: string;
  success: boolean;
  orderId?: string;
  error?: string;
  deliveredAt?: Date;
}

export interface DeliveryHistoryEntry {
  id: string;
  barId: string;
  receiptId: string;
  tabId: string;
  tabNumber: number;
  customerIdentifier: string;
  deliveryStatus: 'delivered' | 'failed' | 'retrying';
  attempts: DeliveryAttempt[];
  finalStatus: 'success' | 'failure';
  createdAt: Date;
  completedAt?: Date;
}

export interface RetryConfig {
  maxRetries: number;
  retryIntervals: number[]; // milliseconds between retries
  exponentialBackoff: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryIntervals: [1000, 5000, 15000], // 1s, 5s, 15s
  exponentialBackoff: false
};

export class DigitalReceiptDeliveryService {
  private supabase: SupabaseClient;
  private retryConfig: RetryConfig;
  private deliveryHistory: Map<string, DeliveryHistoryEntry> = new Map();

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.retryConfig = retryConfig;
  }

  /**
   * Convert POS print data to digital receipt format
   */
  convertPrintDataToDigitalReceipt(
    printData: PrintDataReceipt,
    barId: string,
    tabId: string
  ): Omit<DigitalReceipt, 'id' | 'orderId' | 'createdAt'> {
    return {
      barId,
      tabId,
      items: printData.items.map(item => ({
        name: item.name,
        quantity: item.quantity || 1,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes
      })),
      total: printData.total,
      subtotal: printData.subtotal,
      tax: printData.tax,
      deliveryStatus: 'pending',
      retryCount: 0
    };
  }

  /**
   * Deliver digital receipt to a single customer
   */
  async deliverToCustomer(
    receipt: PrintDataReceipt,
    tabId: string,
    tabNumber: number,
    customerIdentifier: string,
    barId: string
  ): Promise<DeliveryResult> {
    const deliveryId = `delivery-${Date.now()}-${tabId}`;
    
    try {
      // Create order in tab_orders table (this is the digital receipt)
      const { data: order, error: orderError } = await this.supabase
        .from('tab_orders')
        .insert({
          tab_id: tabId,
          items: receipt.items,
          total: receipt.total,
          status: 'confirmed', // POS orders are pre-confirmed
          initiated_by: 'staff', // Digital receipts are staff-initiated
          confirmed_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // Log successful delivery
      await this.logDeliveryAttempt(deliveryId, barId, tabId, tabNumber, customerIdentifier, {
        attemptNumber: 1,
        timestamp: new Date(),
        success: true
      });

      return {
        receiptId: deliveryId,
        tabId,
        tabNumber,
        customerIdentifier,
        success: true,
        orderId: order.id,
        deliveredAt: new Date()
      };
    } catch (error) {
      // Log failed delivery
      await this.logDeliveryAttempt(deliveryId, barId, tabId, tabNumber, customerIdentifier, {
        attemptNumber: 1,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        receiptId: deliveryId,
        tabId,
        tabNumber,
        customerIdentifier,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deliver digital receipts to multiple customers
   */
  async deliverToMultipleCustomers(
    receipt: PrintDataReceipt,
    customers: Array<{
      tabId: string;
      tabNumber: number;
      customerIdentifier: string;
    }>,
    barId: string
  ): Promise<DeliveryResult[]> {
    const deliveryPromises = customers.map(customer =>
      this.deliverToCustomer(
        receipt,
        customer.tabId,
        customer.tabNumber,
        customer.customerIdentifier,
        barId
      )
    );

    return Promise.all(deliveryPromises);
  }

  /**
   * Retry failed delivery
   */
  async retryFailedDelivery(
    receipt: PrintDataReceipt,
    tabId: string,
    tabNumber: number,
    customerIdentifier: string,
    barId: string,
    previousAttempts: number = 0
  ): Promise<DeliveryResult> {
    if (previousAttempts >= this.retryConfig.maxRetries) {
      return {
        receiptId: `retry-${Date.now()}-${tabId}`,
        tabId,
        tabNumber,
        customerIdentifier,
        success: false,
        error: 'Max retry attempts exceeded'
      };
    }

    // Wait before retrying
    const retryDelay = this.calculateRetryDelay(previousAttempts);
    await this.sleep(retryDelay);

    // Attempt delivery
    const result = await this.deliverToCustomer(
      receipt,
      tabId,
      tabNumber,
      customerIdentifier,
      barId
    );

    // If still failed and retries remaining, try again
    if (!result.success && previousAttempts + 1 < this.retryConfig.maxRetries) {
      return this.retryFailedDelivery(
        receipt,
        tabId,
        tabNumber,
        customerIdentifier,
        barId,
        previousAttempts + 1
      );
    }

    return result;
  }

  /**
   * Calculate retry delay based on configuration
   */
  private calculateRetryDelay(attemptNumber: number): number {
    if (attemptNumber >= this.retryConfig.retryIntervals.length) {
      return this.retryConfig.retryIntervals[this.retryConfig.retryIntervals.length - 1];
    }

    const baseDelay = this.retryConfig.retryIntervals[attemptNumber];

    if (this.retryConfig.exponentialBackoff) {
      return baseDelay * Math.pow(2, attemptNumber);
    }

    return baseDelay;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log delivery attempt to history
   */
  private async logDeliveryAttempt(
    deliveryId: string,
    barId: string,
    tabId: string,
    tabNumber: number,
    customerIdentifier: string,
    attempt: DeliveryAttempt
  ): Promise<void> {
    try {
      let historyEntry = this.deliveryHistory.get(deliveryId);

      if (!historyEntry) {
        historyEntry = {
          id: deliveryId,
          barId,
          receiptId: deliveryId,
          tabId,
          tabNumber,
          customerIdentifier,
          deliveryStatus: attempt.success ? 'delivered' : 'retrying',
          attempts: [],
          finalStatus: attempt.success ? 'success' : 'failure',
          createdAt: new Date()
        };
      }

      historyEntry.attempts.push(attempt);

      if (attempt.success) {
        historyEntry.deliveryStatus = 'delivered';
        historyEntry.finalStatus = 'success';
        historyEntry.completedAt = new Date();
      } else if (historyEntry.attempts.length >= this.retryConfig.maxRetries) {
        historyEntry.deliveryStatus = 'failed';
        historyEntry.finalStatus = 'failure';
        historyEntry.completedAt = new Date();
      }

      this.deliveryHistory.set(deliveryId, historyEntry);

      // Optionally persist to database
      await this.persistDeliveryHistory(historyEntry);
    } catch (error) {
      console.error('Failed to log delivery attempt:', error);
    }
  }

  /**
   * Persist delivery history to database
   */
  private async persistDeliveryHistory(entry: DeliveryHistoryEntry): Promise<void> {
    try {
      // Store in audit_logs table
      await this.supabase
        .from('audit_logs')
        .insert({
          bar_id: entry.barId,
          tab_id: entry.tabId,
          action: 'digital_receipt_delivery',
          details: {
            receiptId: entry.receiptId,
            tabNumber: entry.tabNumber,
            customerIdentifier: entry.customerIdentifier,
            deliveryStatus: entry.deliveryStatus,
            attempts: entry.attempts,
            finalStatus: entry.finalStatus,
            completedAt: entry.completedAt
          }
        });
    } catch (error) {
      console.error('Failed to persist delivery history:', error);
    }
  }

  /**
   * Get delivery history for a specific receipt
   */
  getDeliveryHistory(receiptId: string): DeliveryHistoryEntry | undefined {
    return this.deliveryHistory.get(receiptId);
  }

  /**
   * Get all delivery history for a bar
   */
  getAllDeliveryHistory(barId: string): DeliveryHistoryEntry[] {
    return Array.from(this.deliveryHistory.values())
      .filter(entry => entry.barId === barId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Clear delivery history (for testing or cleanup)
   */
  clearDeliveryHistory(): void {
    this.deliveryHistory.clear();
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(barId: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageAttempts: number;
  } {
    const history = this.getAllDeliveryHistory(barId);
    const totalDeliveries = history.length;
    const successfulDeliveries = history.filter(h => h.finalStatus === 'success').length;
    const failedDeliveries = history.filter(h => h.finalStatus === 'failure').length;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;
    const averageAttempts = totalDeliveries > 0
      ? history.reduce((sum, h) => sum + h.attempts.length, 0) / totalDeliveries
      : 0;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate,
      averageAttempts
    };
  }
}

/**
 * Create a digital receipt delivery service instance
 */
export function createDigitalReceiptDeliveryService(
  supabaseUrl: string,
  supabaseKey: string,
  retryConfig?: RetryConfig
): DigitalReceiptDeliveryService {
  return new DigitalReceiptDeliveryService(supabaseUrl, supabaseKey, retryConfig);
}
