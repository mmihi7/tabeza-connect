/**
 * Example: Waiter-Initiated POS Integration with Tabeza
 * 
 * This example shows the complete workflow:
 * 1. Waiter creates order in POS
 * 2. Instead of printing receipt, waiter gets popup
 * 3. Waiter selects customer tab to send order to
 * 4. Order appears in customer's Tabeza app
 * 5. Optional internal printing for kitchen/records
 */

import { createVirtualPrinter } from '../src/index';
import { WaiterInterface } from '../src/ui/waiter-interface';
import type { WaiterAction } from '../src/core/virtual-printer-engine';

// Configuration - replace with your actual Tabeza bar details
const BAR_ID = 'your-bar-uuid-here'; // Replace with actual Tabeza bar ID
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-supabase-service-key';

async function setupWaiterWorkflow() {
  console.log('🚀 Setting up Waiter-Initiated Tabeza Integration...');
  
  // Create virtual printer instance
  const virtualPrinter = createVirtualPrinter(
    BAR_ID,
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      forwardToPhysicalPrinter: false, // Waiter chooses when to print
      generateQRCode: false,           // Orders go directly to customer app
      printerFilters: ['*']            // Capture all print jobs
    }
  );

  // Create waiter interface
  const waiterInterface = new WaiterInterface({
    onSendToCustomer: async (tabId: string, tabNumber: number) => {
      console.log(`� Sending order to Table ${tabNumber}...`);
      // This will be handled by the virtual printer
    },
    
    onPrintInternal: async () => {
      console.log('🖨️ Printing internal receipt...');
      // This will trigger kitchen/receipt printer
    },
    
    onBoth: async (tabId: string, tabNumber: number) => {
      console.log(`�🖨️ Sending to Table ${tabNumber} AND printing internal...`);
      // This will do both actions
    },
    
    onCancel: () => {
      console.log('❌ Order cancelled by waiter');
    }
  });

  // Set up event listeners
  virtualPrinter.on('started', () => {
    console.log('✅ Tabeza Virtual Printer ready for waiter orders');
  });

  // When POS receipt is captured, show waiter interface
  virtualPrinter.on('waiterActionRequired', (data) => {
    console.log('🔔 Waiter action required - showing tab selection...');
    
    // Show popup to waiter
    waiterInterface.showTabSelectionPopup(
      data.receiptData,
      data.availableTabs
    );
    
    // Set up action handler
    const originalOnAction = data.onAction;
    data.onAction = (action: WaiterAction) => {
      console.log('👨‍💼 Waiter selected action:', action.action);
      if (action.selectedTabNumber) {
        console.log(`📋 Selected Table: ${action.selectedTabNumber}`);
      }
      originalOnAction(action);
    };
  });

  virtualPrinter.on('orderSentToCustomer', (data) => {
    console.log('✅ Order successfully sent to customer:');
    console.log(`   Table: ${data.tabNumber}`);
    console.log(`   Order ID: ${data.orderId}`);
    console.log(`   Items: ${data.items.length}`);
    console.log(`   Total: $${data.total.toFixed(2)}`);
    
    // Could trigger notification sound, update POS display, etc.
  });

  virtualPrinter.on('internalReceiptPrinted', (data) => {
    console.log('🖨️ Internal receipt printed for kitchen/records');
    console.log(`   Receipt data: ${JSON.stringify(data.receiptData, null, 2)}`);
  });

  // Start the virtual printer
  await virtualPrinter.start();

  return { virtualPrinter, waiterInterface };
}

// Example: Simulate waiter creating order in POS
async function simulateWaiterOrder(virtualPrinter: any) {
  console.log('\n👨‍💼 Waiter creates order in POS...');
  
  const posReceipt = `
    MARIO'S RESTAURANT
    Table Service Order
    
    Server: Sarah
    Time: ${new Date().toLocaleTimeString()}
    
    2x Chicken Parmesan     32.00
    1x Caesar Salad         12.00
    2x Garlic Bread          8.00
    3x Soft Drink           12.00
    1x Tiramisu              9.00
    
    Subtotal:               73.00
    Tax (8%):                5.84
    Total:                  78.84
    
    --- END OF ORDER ---
  `;

  // This simulates the POS "printing" the receipt
  // In reality, this would be triggered when waiter hits "Print" or "Send"
  console.log('🧾 POS receipt ready - triggering waiter interface...');
  await virtualPrinter.processPrintJob(posReceipt);
}

// Main execution
async function main() {
  try {
    const { virtualPrinter } = await setupWaiterWorkflow();
    
    console.log('\n📋 System ready! Waiters can now:');
    console.log('   1. Create orders in POS as normal');
    console.log('   2. Choose "Send to Customer" instead of printing');
    console.log('   3. Select which table to send the order to');
    console.log('   4. Customer receives order in their Tabeza app');
    console.log('   5. Optional: Print internal copy for kitchen');
    console.log('   6. Interface will be shown automatically when needed');
    
    // Simulate a waiter order
    setTimeout(() => {
      simulateWaiterOrder(virtualPrinter);
    }, 2000);
    
    console.log('\n⏳ Virtual printer is running. Waiters can now send orders to customers...');
    console.log('Press Ctrl+C to stop');
    
  } catch (error) {
    console.error('❌ Error setting up waiter workflow:', error);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { setupWaiterWorkflow, simulateWaiterOrder };