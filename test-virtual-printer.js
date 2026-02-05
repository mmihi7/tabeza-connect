/**
 * Test script for Tabeza Virtual Printer
 * Demonstrates how POS receipts are converted to Tabeza orders
 */

const { createVirtualPrinter } = require('./packages/virtual-printer/dist/index.js');

// Test configuration (replace with your actual values)
const TEST_CONFIG = {
  barId: 'your-bar-uuid-here', // Replace with actual Tabeza bar ID
  supabaseUrl: 'https://your-project.supabase.co', // Replace with your Supabase URL
  supabaseKey: 'your-supabase-service-key' // Replace with your service role key
};

async function testVirtualPrinter() {
  console.log('🚀 Testing Tabeza Virtual Printer...\n');

  try {
    // Create virtual printer instance
    const virtualPrinter = createVirtualPrinter(
      TEST_CONFIG.barId,
      TEST_CONFIG.supabaseUrl,
      TEST_CONFIG.supabaseKey,
      {
        forwardToPhysicalPrinter: false, // Don't print to paper
        generateQRCode: false,           // Orders go directly to customer app
        printerFilters: ['*']            // Capture all print jobs
      }
    );

    // Set up event listeners
    virtualPrinter.on('started', () => {
      console.log('✅ Virtual printer started successfully');
    });

    virtualPrinter.on('orderCreated', (data) => {
      console.log('📦 Order created successfully:');
      console.log(`   Tab ID: ${data.tabId}`);
      console.log(`   Order ID: ${data.orderId}`);
      console.log(`   Items: ${data.items.length}`);
      console.log(`   Total: $${data.total.toFixed(2)}`);
    });

    virtualPrinter.on('customerNotified', (data) => {
      console.log('🔔 Customer notification sent:');
      console.log(`   Message: ${data.message}`);
    });

    // Start the virtual printer
    await virtualPrinter.start();

    // Test with sample POS receipts
    console.log('\n🧾 Testing with sample POS receipts...\n');

    // Sample receipt 1: Table service
    const tableReceipt = `
      MARIO'S PIZZERIA
      123 Main Street, Downtown
      Phone: (555) 123-4567
      
      Table: 12
      Server: Sarah
      Date: ${new Date().toLocaleDateString()}
      Time: ${new Date().toLocaleTimeString()}
      
      2x Margherita Pizza     24.00
      1x Caesar Salad         12.00
      3x Soft Drink            9.00
      1x Tiramisu              8.00
      
      Subtotal:               53.00
      Tax (8%):                4.24
      Total:                  57.24
      
      Thank you for dining with us!
    `;

    console.log('Processing table receipt...');
    await virtualPrinter.processPrintJob(tableReceipt);

    // Sample receipt 2: Phone order
    const phoneReceipt = `
      BURGER PALACE
      456 Oak Avenue
      
      Phone Order: 555-987-6543
      Customer: John Smith
      
      1x Double Cheeseburger  12.99
      1x Large Fries           4.99
      1x Chocolate Shake       5.99
      2x Onion Rings           7.98
      
      Subtotal:               31.95
      Tax:                     2.56
      Total:                  34.51
      
      Ready for pickup in 15 minutes
    `;

    console.log('\nProcessing phone order receipt...');
    await virtualPrinter.processPrintJob(phoneReceipt);

    // Display statistics
    console.log('\n📊 Processing Statistics:');
    const stats = virtualPrinter.getStats();
    console.log(`   Total jobs processed: ${stats.totalJobsProcessed}`);
    console.log(`   Successful parsing: ${stats.successfulParsing}`);
    console.log(`   Failed parsing: ${stats.failedParsing}`);
    console.log(`   Average processing time: ${stats.averageProcessingTime.toFixed(2)}ms`);

    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Replace test configuration with your actual Tabeza bar details');
    console.log('   2. Set up your POS system to print to the Tabeza Virtual Printer');
    console.log('   3. Configure receipt parsing rules for your specific POS format');
    console.log('   4. Test with real orders from your POS system');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Check your Supabase configuration');
    console.log('   - Verify the bar ID exists in your Tabeza system');
    console.log('   - Ensure the service role key has proper permissions');
  }
}

// Run the test
if (require.main === module) {
  testVirtualPrinter().catch(console.error);
}

module.exports = { testVirtualPrinter };