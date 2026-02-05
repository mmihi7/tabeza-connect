/**
 * Virtual Printer Engine - Waiter-Initiated Digital Orders
 * Intercepts POS receipts and provides waiter interface to send orders to customer tabs
 */

import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';

export interface TabSelectionRequest {
  receiptData: any;
  availableTabs: Array<{
    id: string;
    tab_number: number;
    owner_identifier?: string;
    status: string;
  }>;
}

export interface WaiterAction {
  action: 'send_to_customer' | 'print_internal' | 'both';
  selectedTabId?: string;
  selectedTabNumber?: number;
}

// Placeholder implementations - these would need to be properly implemented
export interface PrintCaptureConfig {
  platform: string;
  captureMethod: string;
  barId: string;
  printerFilters: string[];
}

export interface DualOutputConfig {
  forwardToPhysicalPrinter: boolean;
  generateQRCode: boolean;
  qrCodeFormat: string;
  deliveryMethods: string[];
  physicalPrinterSettings: any;
}

export interface SyncConfig {
  maxQueueSize: number;
  retryIntervals: number[];
  batchSize: number;
  connectionCheckInterval: number;
  priorityWeights: any;
}

export interface SecurityConfig {
  hashAlgorithm: string;
  signatureAlgorithm: string;
  secretKey: string;
  enableTimestampValidation: boolean;
  maxReceiptAge: number;
  enableIntegrityChecks: boolean;
}

export interface VirtualPrinterConfig {
  barId: string; // Tabeza bar ID to send orders to
  supabaseUrl: string;
  supabaseKey: string;
  printCapture: PrintCaptureConfig;
  dualOutput: DualOutputConfig;
  sync: SyncConfig;
  security: SecurityConfig;
}

export interface ProcessingStats {
  totalJobsProcessed: number;
  successfulParsing: number;
  failedParsing: number;
  queuedForSync: number;
  averageProcessingTime: number;
  lastProcessedAt?: string;
}

export class VirtualPrinterEngine extends EventEmitter {
  private config: VirtualPrinterConfig;
  private supabase: any;
  private isRunning = false;
  private stats: ProcessingStats = {
    totalJobsProcessed: 0,
    successfulParsing: 0,
    failedParsing: 0,
    queuedForSync: 0,
    averageProcessingTime: 0
  };

  constructor(config: VirtualPrinterConfig) {
    super();
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log(`🖨️ Tabeza Virtual Printer started for bar: ${this.config.barId}`);
    
    // Start listening for print jobs
    this.startPrintCapture();
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('🖨️ Tabeza Virtual Printer stopped');
    this.emit('stopped');
  }

  /**
   * Start capturing print jobs from POS systems
   */
  private startPrintCapture(): void {
    // This would integrate with the actual print capture mechanism
    // For now, we'll simulate with a method that can be called manually
    console.log('📡 Print capture started - listening for POS receipts...');
  }

  /**
   * Process a captured print job - shows waiter interface for tab selection
   */
  async processPrintJob(printData: Buffer | string, metadata?: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🧾 Processing POS receipt...');
      
      // Parse the receipt data
      const parsedReceipt = await this.parseReceiptData(printData);
      
      if (!parsedReceipt.success) {
        console.error('❌ Failed to parse receipt:', parsedReceipt.error);
        this.stats.failedParsing++;
        return;
      }

      // Get available tabs for waiter selection
      const availableTabs = await this.getAvailableTabs();
      
      // Emit event for waiter interface to show tab selection popup
      this.emit('waiterActionRequired', {
        receiptData: parsedReceipt.data,
        availableTabs: availableTabs,
        onAction: (action: WaiterAction) => this.handleWaiterAction(action, parsedReceipt.data)
      });

    } catch (error) {
      console.error('❌ Error processing print job:', error);
      this.stats.failedParsing++;
    } finally {
      this.stats.totalJobsProcessed++;
      const processingTime = Date.now() - startTime;
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.totalJobsProcessed - 1) + processingTime) / 
        this.stats.totalJobsProcessed;
    }
  }

  /**
   * Get available tabs for waiter selection
   */
  private async getAvailableTabs(): Promise<Array<{
    id: string;
    tab_number: number;
    owner_identifier?: string;
    status: string;
  }>> {
    try {
      const { data: tabs, error } = await this.supabase
        .from('tabs')
        .select('id, tab_number, owner_identifier, status')
        .eq('bar_id', this.config.barId)
        .eq('status', 'open')
        .order('tab_number', { ascending: true });

      if (error) {
        console.error('Failed to get available tabs:', error);
        return [];
      }

      return tabs || [];
    } catch (error) {
      console.error('Error getting available tabs:', error);
      return [];
    }
  }

  /**
   * Handle waiter's action choice
   */
  private async handleWaiterAction(action: WaiterAction, receiptData: any): Promise<void> {
    try {
      if (action.action === 'send_to_customer' || action.action === 'both') {
        if (!action.selectedTabId) {
          console.error('❌ No tab selected for customer order');
          return;
        }

        // Send order to customer tab
        const orderResult = await this.createTabezaOrder(action.selectedTabId, receiptData);
        
        if (orderResult.success) {
          console.log(`✅ Order sent to customer tab ${action.selectedTabNumber}`);
          this.stats.successfulParsing++;
          
          this.emit('orderSentToCustomer', {
            tabId: action.selectedTabId,
            tabNumber: action.selectedTabNumber,
            orderId: orderResult.orderId,
            items: receiptData.items,
            total: receiptData.total
          });
        } else {
          console.error('❌ Failed to send order to customer:', orderResult.error);
          this.stats.failedParsing++;
        }
      }

      if (action.action === 'print_internal' || action.action === 'both') {
        // Handle internal printing (kitchen, records)
        await this.printInternalReceipt(receiptData);
        console.log('🖨️ Internal receipt printed');
        
        this.emit('internalReceiptPrinted', {
          receiptData: receiptData
        });
      }

    } catch (error) {
      console.error('❌ Error handling waiter action:', error);
      this.stats.failedParsing++;
    }
  }

  /**
   * Print internal receipt for kitchen/records
   */
  private async printInternalReceipt(receiptData: any): Promise<void> {
    // This would send to actual printer for internal use
    // Implementation depends on the physical printer setup
    console.log('📄 Printing internal receipt...');
    
    // Could format and send to kitchen printer, receipt printer, etc.
    const internalReceipt = this.formatInternalReceipt(receiptData);
    
    // Emit event that printer driver can listen to
    this.emit('printInternal', {
      receiptText: internalReceipt,
      printerType: 'kitchen' // or 'receipt', 'both'
    });
  }

  /**
   * Format receipt for internal printing
   */
  private formatInternalReceipt(receiptData: any): string {
    const { items, total, customerInfo } = receiptData;
    
    let receipt = '\n=== KITCHEN COPY ===\n';
    receipt += `Time: ${new Date().toLocaleString()}\n`;
    if (customerInfo.tableNumber) {
      receipt += `Table: ${customerInfo.tableNumber}\n`;
    }
    receipt += '\n--- ITEMS ---\n';
    
    items.forEach((item: any) => {
      receipt += `${item.quantity || 1}x ${item.name.padEnd(20)} ${item.total_price.toFixed(2)}\n`;
    });
    
    receipt += '\n--- TOTAL ---\n';
    receipt += `Total: ${total.toFixed(2)}\n`;
    receipt += '\n=== END ===\n\n';
    
    return receipt;
  }

  /**
   * Parse receipt data from POS system
   */
  private async parseReceiptData(printData: Buffer | string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const receiptText = typeof printData === 'string' ? printData : printData.toString();
      
      // Basic receipt parsing - this would be enhanced based on POS format
      const lines = receiptText.split('\n').map(line => line.trim()).filter(line => line);
      
      const items: any[] = [];
      let total = 0;
      let customerInfo: any = {};
      
      // Simple parsing logic - would need to be customized per POS system
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for customer info (table number, phone, etc.)
        if (line.toLowerCase().includes('table') || line.toLowerCase().includes('tab')) {
          const tableMatch = line.match(/(?:table|tab)\s*:?\s*(\d+)/i);
          if (tableMatch) {
            customerInfo.tableNumber = parseInt(tableMatch[1]);
          }
        }
        
        // Look for phone number
        const phoneMatch = line.match(/(?:phone|tel|mobile)\s*:?\s*([\d\s\-\+]+)/i);
        if (phoneMatch) {
          customerInfo.phone = phoneMatch[1].replace(/\s/g, '');
        }
        
        // Look for items (basic pattern: name + price)
        const itemMatch = line.match(/^(.+?)\s+(\d+(?:\.\d{2})?)\s*$/);
        if (itemMatch && !line.toLowerCase().includes('total') && !line.toLowerCase().includes('subtotal')) {
          const name = itemMatch[1].trim();
          const price = parseFloat(itemMatch[2]);
          
          if (name && price > 0) {
            items.push({
              name,
              quantity: 1, // Default to 1, could be enhanced
              unit_price: price,
              total_price: price
            });
          }
        }
        
        // Look for total
        const totalMatch = line.match(/(?:total|amount)\s*:?\s*(\d+(?:\.\d{2})?)/i);
        if (totalMatch) {
          total = parseFloat(totalMatch[1]);
        }
      }
      
      // Calculate total if not found
      if (total === 0 && items.length > 0) {
        total = items.reduce((sum, item) => sum + item.total_price, 0);
      }
      
      if (items.length === 0) {
        return {
          success: false,
          error: 'No items found in receipt'
        };
      }
      
      return {
        success: true,
        data: {
          items,
          total,
          customerInfo,
          rawReceipt: receiptText
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse receipt: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find existing customer tab or create a new one
   */
  private async findOrCreateCustomerTab(receiptData: any): Promise<{
    success: boolean;
    tabId: string;
    error?: string;
  }> {
    try {
      const { customerInfo } = receiptData;
      
      // Try to find existing open tab for this customer
      let existingTab = null;
      
      if (customerInfo.tableNumber) {
        // Look for tab by table number
        const { data: tabByTable } = await this.supabase
          .from('tabs')
          .select('id, status')
          .eq('bar_id', this.config.barId)
          .eq('status', 'open')
          .ilike('notes', `%table ${customerInfo.tableNumber}%`)
          .single();
          
        existingTab = tabByTable;
      }
      
      if (!existingTab && customerInfo.phone) {
        // Look for tab by phone number
        const { data: tabByPhone } = await this.supabase
          .from('tabs')
          .select('id, status')
          .eq('bar_id', this.config.barId)
          .eq('status', 'open')
          .eq('owner_identifier', customerInfo.phone)
          .single();
          
        existingTab = tabByPhone;
      }
      
      if (existingTab) {
        console.log(`📋 Using existing tab: ${existingTab.id}`);
        return {
          success: true,
          tabId: existingTab.id
        };
      }
      
      // Create new tab
      const { data: newTab, error } = await this.supabase
        .from('tabs')
        .insert({
          bar_id: this.config.barId,
          owner_identifier: customerInfo.phone || `pos_${Date.now()}`,
          status: 'open',
          notes: customerInfo.tableNumber ? `Table ${customerInfo.tableNumber} - POS Order` : 'POS Order',
          device_identifier: `pos_printer_${this.config.barId}`
        })
        .select('id')
        .single();
      
      if (error) {
        throw new Error(`Failed to create tab: ${error.message}`);
      }
      
      console.log(`📋 Created new tab: ${newTab.id}`);
      return {
        success: true,
        tabId: newTab.id
      };
      
    } catch (error) {
      throw new Error(`Tab creation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create order in Tabeza system
   */
  private async createTabezaOrder(tabId: string, receiptData: any): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    try {
      const { items, total } = receiptData;
      
      // Create the order
      const { data: order, error } = await this.supabase
        .from('tab_orders')
        .insert({
          tab_id: tabId,
          items: items,
          total: total,
          status: 'confirmed', // POS orders are pre-confirmed
          initiated_by: 'staff', // Orders from POS are staff-initiated
          confirmed_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) {
        return {
          success: false,
          error: `Failed to create order: ${error.message}`
        };
      }
      
      console.log(`📦 Order created: ${order.id} for tab ${tabId}`);
      
      // Optionally send notification to customer
      await this.notifyCustomer(tabId, order.id, items, total);
      
      return {
        success: true,
        orderId: order.id
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Order creation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Send notification to customer about new order
   */
  private async notifyCustomer(tabId: string, orderId: string, items: any[], total: number): Promise<void> {
    try {
      // This could integrate with push notifications, SMS, etc.
      console.log(`🔔 Notifying customer about order ${orderId} on tab ${tabId}`);
      
      this.emit('customerNotified', {
        tabId,
        orderId,
        items,
        total,
        message: `Your order has been placed! Total: ${total.toFixed(2)}`
      });
      
    } catch (error) {
      console.error('Failed to notify customer:', error);
    }
  }

  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      components: {
        printCapture: { status: 'active' },
        syncQueue: { status: 'active' },
        dualOutput: { status: 'active' }
      },
      stats: this.getStats()
    };
  }

  async processReceiptManually(rawData: Buffer | string, merchantId: string, deliveryOptions?: any[]): Promise<any> {
    // Placeholder implementation
    return {
      receipt: {},
      signature: {},
      qrCode: {},
      deliveryResults: []
    };
  }

  async forceSync(): Promise<void> {
    // Placeholder implementation
  }

  verifyReceiptIntegrity(receipt: any, signature: any): any {
    // Placeholder implementation
    return true;
  }

  updateConfig(newConfig: Partial<VirtualPrinterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    const { security, ...config } = this.config;
    return {
      ...config,
      security: { ...security, secretKey: '[REDACTED]' }
    };
  }
}

export function createDefaultConfig(merchantId: string, barId: string, supabaseUrl: string, supabaseKey: string, secretKey: string): VirtualPrinterConfig {
  return {
    barId,
    supabaseUrl,
    supabaseKey,
    printCapture: {
      platform: 'linux',
      captureMethod: 'cups',
      barId,
      printerFilters: []
    },
    dualOutput: {
      forwardToPhysicalPrinter: false,
      generateQRCode: true,
      qrCodeFormat: 'both',
      deliveryMethods: ['qr_code'],
      physicalPrinterSettings: {
        preserveFormatting: true,
        addQRToReceipt: true,
        qrPosition: 'bottom'
      }
    },
    sync: {
      maxQueueSize: 1000,
      retryIntervals: [1000, 5000, 15000],
      batchSize: 10,
      connectionCheckInterval: 30000,
      priorityWeights: {
        critical: 1.0,
        high: 0.8,
        medium: 0.5,
        low: 0.2
      }
    },
    security: {
      hashAlgorithm: 'sha256',
      signatureAlgorithm: 'hmac-sha256',
      secretKey,
      enableTimestampValidation: true,
      maxReceiptAge: 86400000, // 24 hours
      enableIntegrityChecks: true
    }
  };
}