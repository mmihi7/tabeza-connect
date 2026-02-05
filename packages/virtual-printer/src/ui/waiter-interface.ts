/**
 * Waiter Interface for Tab Selection
 * Shows popup when POS receipt needs to be sent to customer
 */

export interface TabOption {
  id: string;
  tab_number: number;
  owner_identifier?: string;
  status: string;
}

export interface WaiterInterfaceConfig {
  onSendToCustomer: (tabId: string, tabNumber: number) => void;
  onPrintInternal: () => void;
  onBoth: (tabId: string, tabNumber: number) => void;
  onCancel: () => void;
}

export class WaiterInterface {
  private config: WaiterInterfaceConfig;
  private currentReceiptData: any;
  private availableTabs: TabOption[] = [];

  constructor(config: WaiterInterfaceConfig) {
    this.config = config;
  }

  /**
   * Show tab selection popup to waiter
   */
  showTabSelectionPopup(receiptData: any, availableTabs: TabOption[]): void {
    this.currentReceiptData = receiptData;
    this.availableTabs = availableTabs;

    // Create popup HTML
    const popup = this.createPopupHTML(receiptData, availableTabs);
    
    // Show popup (implementation depends on UI framework)
    this.displayPopup(popup);
  }

  /**
   * Create popup HTML content
   */
  private createPopupHTML(receiptData: any, availableTabs: TabOption[]): string {
    const { items, total } = receiptData;
    
    let html = `
      <div class="tabeza-waiter-popup">
        <div class="popup-header">
          <h3>🧾 Order Ready - Choose Action</h3>
        </div>
        
        <div class="receipt-preview">
          <h4>Order Summary:</h4>
          <ul>
    `;
    
    items.forEach((item: any) => {
      html += `<li>${item.quantity || 1}x ${item.name} - $${item.total_price.toFixed(2)}</li>`;
    });
    
    html += `
          </ul>
          <div class="total"><strong>Total: $${total.toFixed(2)}</strong></div>
        </div>

        <div class="action-section">
          <h4>What would you like to do?</h4>
          
          <div class="action-buttons">
            <button class="btn-send-customer" onclick="showTabSelection()">
              📱 Send to Customer
            </button>
            
            <button class="btn-print-internal" onclick="printInternal()">
              🖨️ Print Internal Only
            </button>
            
            <button class="btn-both" onclick="showTabSelectionForBoth()">
              📱🖨️ Send to Customer + Print
            </button>
            
            <button class="btn-cancel" onclick="cancelAction()">
              ❌ Cancel
            </button>
          </div>
        </div>

        <div class="tab-selection" id="tabSelection" style="display: none;">
          <h4>Select Customer Tab:</h4>
          <div class="tab-grid">
    `;
    
    availableTabs.forEach(tab => {
      const customerInfo = tab.owner_identifier ? ` (${tab.owner_identifier})` : '';
      html += `
        <button class="tab-option" onclick="selectTab('${tab.id}', ${tab.tab_number})">
          Table ${tab.tab_number}${customerInfo}
        </button>
      `;
    });
    
    html += `
          </div>
          <button class="btn-back" onclick="hideTabSelection()">← Back</button>
        </div>
      </div>

      <style>
        .tabeza-waiter-popup {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border: 2px solid #333;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 10000;
          max-width: 500px;
          font-family: Arial, sans-serif;
        }
        
        .popup-header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        
        .receipt-preview {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        
        .receipt-preview ul {
          list-style: none;
          padding: 0;
          margin: 10px 0;
        }
        
        .receipt-preview li {
          padding: 5px 0;
          border-bottom: 1px dotted #ccc;
        }
        
        .total {
          text-align: right;
          font-size: 18px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 2px solid #333;
        }
        
        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 15px 0;
        }
        
        .action-buttons button {
          padding: 15px;
          border: none;
          border-radius: 5px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .btn-send-customer {
          background: #4CAF50;
          color: white;
        }
        
        .btn-print-internal {
          background: #2196F3;
          color: white;
        }
        
        .btn-both {
          background: #FF9800;
          color: white;
          grid-column: span 2;
        }
        
        .btn-cancel {
          background: #f44336;
          color: white;
          grid-column: span 2;
        }
        
        .tab-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          margin: 15px 0;
        }
        
        .tab-option {
          padding: 15px;
          border: 2px solid #ddd;
          border-radius: 5px;
          background: white;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }
        
        .tab-option:hover {
          background: #e3f2fd;
          border-color: #2196F3;
        }
        
        .btn-back {
          background: #666;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        }
      </style>

      <script>
        let currentAction = '';
        
        function showTabSelection() {
          currentAction = 'send_to_customer';
          document.querySelector('.action-section').style.display = 'none';
          document.getElementById('tabSelection').style.display = 'block';
        }
        
        function showTabSelectionForBoth() {
          currentAction = 'both';
          document.querySelector('.action-section').style.display = 'none';
          document.getElementById('tabSelection').style.display = 'block';
        }
        
        function hideTabSelection() {
          document.querySelector('.action-section').style.display = 'block';
          document.getElementById('tabSelection').style.display = 'none';
        }
        
        function selectTab(tabId, tabNumber) {
          if (currentAction === 'send_to_customer') {
            window.waiterInterface.sendToCustomer(tabId, tabNumber);
          } else if (currentAction === 'both') {
            window.waiterInterface.both(tabId, tabNumber);
          }
          closePopup();
        }
        
        function printInternal() {
          window.waiterInterface.printInternal();
          closePopup();
        }
        
        function cancelAction() {
          window.waiterInterface.cancel();
          closePopup();
        }
        
        function closePopup() {
          document.querySelector('.tabeza-waiter-popup').remove();
        }
      </script>
    `;
    
    return html;
  }

  /**
   * Display popup (implementation depends on environment)
   */
  private displayPopup(html: string): void {
    // For web environment
    if (typeof document !== 'undefined') {
      const popupDiv = document.createElement('div');
      popupDiv.innerHTML = html;
      document.body.appendChild(popupDiv);
      
      // Set up global interface object for popup callbacks
      (window as any).waiterInterface = {
        sendToCustomer: (tabId: string, tabNumber: number) => {
          this.config.onSendToCustomer(tabId, tabNumber);
        },
        printInternal: () => {
          this.config.onPrintInternal();
        },
        both: (tabId: string, tabNumber: number) => {
          this.config.onBoth(tabId, tabNumber);
        },
        cancel: () => {
          this.config.onCancel();
        }
      };
    } else {
      // For Node.js/Electron environment, could use different popup method
      console.log('Popup HTML generated:', html);
      console.log('Available tabs:', this.availableTabs);
      
      // Could integrate with Electron dialog, terminal UI, etc.
      this.showConsoleInterface();
    }
  }

  /**
   * Console-based interface for non-web environments
   */
  private showConsoleInterface(): void {
    console.log('\n🧾 ORDER READY - Choose Action:');
    console.log('1. Send to Customer');
    console.log('2. Print Internal Only');
    console.log('3. Send to Customer + Print');
    console.log('4. Cancel');
    
    console.log('\nAvailable Tables:');
    this.availableTabs.forEach((tab, index) => {
      const customerInfo = tab.owner_identifier ? ` (${tab.owner_identifier})` : '';
      console.log(`  ${index + 1}. Table ${tab.tab_number}${customerInfo}`);
    });
    
    // In a real implementation, this would wait for user input
    // For now, just log the interface
  }
}