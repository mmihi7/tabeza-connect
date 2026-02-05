# Requirements Document

## Introduction

The Tabeza Virtual Printer system is implemented and installed on Windows, but has specific TypeScript compilation errors and parameter mismatches that prevent the example code and test scripts from working correctly. The core functionality exists and the printer is installed - we need to fix the integration points to make it testable and usable.

## Glossary

- **Virtual_Printer**: The core system that intercepts POS print jobs and converts them to Tabeza orders
- **Tabeza_Print_Interface**: The popup UI that allows staff to select customer tabs for order delivery when printing to Tabeza
- **POS_System**: Point of Sale system that generates receipts for printing
- **Tab**: A customer's order session in the Tabeza system
- **Receipt_Parser**: Component that extracts order data from POS receipt text
- **Supabase_Client**: Database connection for storing orders in Tabeza schema
- **Factory_Function**: The createVirtualPrinter function that creates configured instances

## Requirements

### Requirement 1: Fix createVirtualPrinter Function Signature

**User Story:** As a developer, I want to call createVirtualPrinter with the correct parameters, so that I can create a working virtual printer instance.

#### Acceptance Criteria

1. WHEN calling createVirtualPrinter in pos-integration.ts, THE Function SHALL accept barId as the first parameter (not merchantId)
2. WHEN passing configuration options, THE Function SHALL accept the options object as the fifth parameter
3. WHEN the function is called with correct parameters, THE Function SHALL return a properly configured VirtualPrinterEngine
4. WHEN the VirtualPrinterEngine is created, THE Instance SHALL connect to Supabase using the provided barId

### Requirement 2: Export Tabeza Print Interface from Main Package

**User Story:** As a developer, I want to import the Tabeza Print Interface from the main package, so that I can use it in my integration code.

#### Acceptance Criteria

1. WHEN importing TabezaPrintInterface from the main index.ts, THE Import_System SHALL provide the class successfully
2. WHEN the TabezaPrintInterface is instantiated, THE Constructor SHALL accept the configuration object with callback functions
3. WHEN the main package is built, THE Export_System SHALL include TabezaPrintInterface in the public API
4. WHEN using TypeScript, THE Type_System SHALL provide correct type definitions for TabezaPrintInterface

### Requirement 3: Fix Test Script Parameter Order

**User Story:** As a developer, I want the test script to work with the installed printer, so that I can verify the system functionality.

#### Acceptance Criteria

1. WHEN running test-virtual-printer.js, THE Script SHALL call createVirtualPrinter with correct parameter order
2. WHEN the test script creates a virtual printer, THE Function_Call SHALL use barId instead of merchantId as first parameter
3. WHEN the test processes sample receipts, THE Processing_System SHALL handle them without errors
4. WHEN the test completes, THE Script SHALL display meaningful results and statistics

### Requirement 4: Remove Unused Parameters and Fix Types

**User Story:** As a developer, I want clean code without unused parameters or type errors, so that the system compiles and runs correctly.

#### Acceptance Criteria

1. WHEN compiling pos-integration.ts, THE TypeScript_Compiler SHALL complete without unused parameter warnings
2. WHEN event handlers are defined, THE Handler_Functions SHALL use correct parameter types
3. WHEN callback functions are called, THE Parameters SHALL match the expected function signatures
4. WHEN the code is built, THE Build_Process SHALL complete without TypeScript errors

### Requirement 5: Maintain Tabeza Print Interface Workflow

**User Story:** As a staff member, I want to receive a popup when a POS receipt is sent to Tabeza printer, so that I can choose which customer tab to send the order to.

#### Acceptance Criteria

1. WHEN a POS system prints to the Tabeza virtual printer, THE System SHALL intercept the job and trigger the print interface
2. WHEN the print interface popup is displayed, THE Interface SHALL show available customer tabs as large, touch-friendly buttons
3. WHEN displaying tabs, THE System SHALL show format: "Tab 5 (John)" or "Tab 3 (Table 12)" or "Tab 7" if no identifier
4. WHEN a staff member clicks/touches a customer tab button, THE System SHALL create an order in that tab's record
5. WHEN a staff member cancels the action, THE System SHALL discard the receipt without creating orders
6. WHEN no tab is selected, THE System SHALL not create any order and the receipt is discarded

### Requirement 6: Define POS Receipt Data Mapping

**User Story:** As a restaurant owner, I want to understand what data from my POS receipts will be captured and how it maps to Tabeza orders, so that I can configure the system correctly.

#### Acceptance Criteria

1. WHEN a POS receipt is processed, THE System SHALL extract item names, quantities, and unit prices from the receipt text
2. WHEN parsing receipt data, THE System SHALL calculate total prices for each item (quantity × unit_price)
3. WHEN storing items in tab_orders.items, THE System SHALL use JSONB format with fields: name, quantity, unit_price, total_price
4. WHEN calculating totals, THE System SHALL extract subtotal, tax, and final total from the receipt
5. WHEN tax information is available, THE System SHALL store it separately (may require adding tax column to tab_orders)

### Requirement 7: Preserve Database Integration with barId

**User Story:** As a system administrator, I want orders to be stored in the correct Tabeza database tables using barId, so that customers can see their orders in the app.

#### Acceptance Criteria

1. WHEN the virtual printer is configured with a barId, THE System SHALL query the database for tabs belonging to that bar
2. WHEN the print interface is triggered, THE System SHALL populate available tabs filtered by bar_id and status='open'
3. WHEN storing an order, THE System SHALL store it in the tab_orders table with correct tab_id reference
4. WHEN storing order items, THE System SHALL use the JSONB format: [{"name": "Item Name", "quantity": 1, "unit_price": 10.00, "total_price": 10.00}]
5. WHEN calculating order totals, THE System SHALL store the amount in the tab_orders.total column as numeric(10,2)

### Requirement 8: Provide Configurable Receipt Parsing

**User Story:** As a developer integrating a POS system, I want to configure how receipts are parsed, so that the system works with different POS formats.

#### Acceptance Criteria

1. WHEN different POS systems generate receipts, THE Parser SHALL support configurable parsing rules for item extraction
2. WHEN receipt formats vary, THE System SHALL provide examples of common POS receipt patterns
3. WHEN parsing fails, THE System SHALL provide clear error messages indicating what data could not be extracted
4. WHEN testing receipt parsing, THE System SHALL provide sample receipts that demonstrate successful parsing
5. WHEN configuring the parser, THE System SHALL document required fields: item name, quantity, unit price, and total

### Requirement 9: Enable Testing with Installed Printer

**User Story:** As a developer, I want to test the virtual printer with the installed Windows printer, so that I can verify the complete workflow.

#### Acceptance Criteria

1. WHEN the virtual printer is started, THE System SHALL connect to the Windows print system successfully
2. WHEN a test receipt is processed, THE System SHALL parse the receipt and trigger the waiter interface
3. WHEN the waiter interface is shown, THE Interface SHALL display available tabs from the database
4. WHEN an order is created, THE System SHALL store it in the Tabeza database and emit success events
5. WHEN the test is complete, THE System SHALL provide statistics and confirmation of successful operation