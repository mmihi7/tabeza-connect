# Technical Solution: Virtual Printer Driver for Tabeza Basic

## The Problem You're Solving

**Goal**: Allow venues to serve BOTH traditional walk-in customers (who get physical receipts) AND Tabeza customers (who get digital receipts) using the same POS system, without requiring staff to manually choose different workflows.

**Challenge**: How do we intercept POS print jobs to give staff the choice between physical and digital receipts?

## The Solution: Virtual Printer Driver

### How Traditional POS Systems Work

1. **POS Software** generates receipt data
2. **Sends to Printer**: POS prints to a named printer (e.g., "Epson TM-T88V")
3. **Windows Print Spooler**: Queues the print job
4. **Printer Driver**: Converts data to ESC/POS commands
5. **Physical Printer**: Prints the receipt

### How Tabeza Intercepts This Flow

Instead of printing directly to the physical printer, we insert ourselves in the middle:

```
Traditional Flow:
POS → Windows Spooler → Physical Printer Driver → Thermal Printer

Tabeza Flow:
POS → Windows Spooler → TABEZA VIRTUAL PRINTER → Modal Choice
                                                      ↓
                                    Physical: Forward to Real Printer
                                    Digital: Send to Customer App
```

## Technical Implementation

### 1. Virtual Printer Installation

**What it is**: A Windows printer driver that appears in the printer list as "Tabeza Receipt Printer"

**How it works**:
- During Tabeza setup, we install a virtual printer driver
- This printer appears in Windows just like any other printer
- The venue configures their POS to print to "Tabeza Receipt Printer" instead of the physical printer

**User sees**: 
```
Printers & Scanners:
- Epson TM-T88V (Real thermal printer)
- Tabeza Receipt Printer (Virtual - intercepts jobs)
```

### 2. Print Job Interception

**When POS prints**:
1. POS sends print job to "Tabeza Receipt Printer"
2. Our virtual driver receives the print job data
3. Instead of printing, we trigger our modal interface
4. Staff makes the choice: Physical or Digital

**Technical Details**:
- Virtual driver runs as a Windows service
- Captures raw print data (ESC/POS commands or text)
- Parses receipt content (items, total, transaction ID)
- Communicates with Tabeza web app to show modal

### 3. Receipt Distribution Modal

**Physical Receipt Choice**:
- Staff clicks "Physical Receipt"
- Virtual driver forwards the print job to the real thermal printer
- Receipt prints normally
- Modal closes

**Digital Receipt Choice**:
- Staff clicks "Tabeza Digital Receipt"
- System queries database for connected customers with active tabs
- Shows customer selection modal
- Staff selects customer(s)
- Receipt data is sent to customer's Tabeza app
- Confirmation shown to staff

### 4. Customer Selection

**What staff sees**:
```
Connected Customers:
☑ Table 5 - Tab #1234 (Connected 2 min ago)
☐ Table 7 - Tab #1235 (Connected 5 min ago)
☐ Bar - Tab #1236 (Idle - 10 min ago)

[Cancel] [Send Digital Receipt]
```

**Technical flow**:
1. Query `tabs` table for active tabs at this venue
2. Check connection status from real-time subscriptions
3. Display customer identifiers (tab numbers, table numbers)
4. Allow multi-select for split bills
5. Send receipt data to selected customers via Supabase real-time

## Real-World Usage Scenarios

### Scenario 1: Walk-in Customer (No Tabeza)
1. Customer orders at bar
2. Bartender rings up order in POS
3. Bartender clicks "Print" in POS
4. Modal appears: "Physical Receipt" vs "Tabeza Digital Receipt"
5. Bartender clicks "Physical Receipt"
6. Receipt prints from thermal printer
7. Customer gets paper receipt

### Scenario 2: Tabeza Customer
1. Customer has active tab in Tabeza app
2. Customer orders drinks
3. Bartender rings up order in POS
4. Bartender clicks "Print" in POS
5. Modal appears with options
6. Bartender clicks "Tabeza Digital Receipt"
7. Customer selection modal shows: "Table 5 - Tab #1234"
8. Bartender selects the customer
9. Digital receipt appears in customer's Tabeza app
10. No paper receipt printed

### Scenario 3: Mixed Group
1. Group of 4 people, 2 have Tabeza, 2 don't
2. Bartender rings up order
3. Bartender clicks "Print"
4. Bartender clicks "Physical Receipt" for the 2 walk-ins
5. Bartender clicks "Print" again for the Tabeza users
6. Bartender clicks "Tabeza Digital Receipt"
7. Selects both Tabeza customers
8. Both get digital receipts

## Technical Components to Build

### 1. Windows Virtual Printer Driver (C++/C#)
- Install as Windows printer driver
- Intercept print jobs from Windows spooler
- Parse ESC/POS or raw print data
- Communicate with Tabeza web service

### 2. Tabeza Print Service (Node.js/Electron)
- Windows service that runs in background
- Receives print jobs from virtual driver
- Shows modal UI when print job arrives
- Forwards jobs to physical printer or Tabeza API

### 3. Receipt Distribution Modal (React)
- Electron window that appears on print
- "Physical" vs "Digital" choice
- Customer selection interface
- Delivery confirmation

### 4. Digital Receipt Delivery API
- Receives receipt data from print service
- Formats for display in customer app
- Sends via Supabase real-time to customer devices
- Tracks delivery status

## Installation Process

### For Venue Owners:

1. **Download Tabeza Printer Drivers** from tabeza.co.ke
2. **Run Installer**: Installs virtual printer driver
3. **Configure POS**: Change printer from "Epson TM-T88V" to "Tabeza Receipt Printer"
4. **Configure Physical Printer**: Tell Tabeza which real printer to forward to
5. **Test**: Print test receipt, verify modal appears
6. **Done**: POS now prints through Tabeza

## Benefits of This Approach

✅ **No POS Changes**: POS system doesn't need any modifications
✅ **Seamless**: Staff just prints normally from POS
✅ **Flexible**: Works with any POS system that can print
✅ **Backward Compatible**: Can always fall back to physical printing
✅ **Universal**: Works with all thermal printers (Epson, Star, etc.)

## Alternative Approaches (Why We Didn't Choose Them)

### ❌ POS API Integration
- **Problem**: Every POS has different API
- **Problem**: Many POS systems don't have APIs
- **Problem**: Requires custom integration per POS

### ❌ Browser Extension
- **Problem**: Only works for web-based POS
- **Problem**: Can't intercept native print jobs
- **Problem**: Security restrictions

### ❌ Network Print Server
- **Problem**: Requires network configuration
- **Problem**: Doesn't work for USB printers
- **Problem**: Complex setup

## Next Steps

1. **Research Windows printer driver development** (or find existing virtual printer SDK)
2. **Build proof-of-concept** virtual printer that captures print jobs
3. **Create modal UI** in Electron
4. **Implement print forwarding** to physical printer
5. **Build digital receipt delivery** system
6. **Test with real POS systems** (Square, Toast, Clover, etc.)

## Resources

- [Windows Print Driver Development](https://learn.microsoft.com/en-us/windows-hardware/drivers/print/)
- [Virtual Printer SDK Options](https://www.colorpilot.com/virtualprinter.html)
- [ESC/POS Protocol Documentation](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [Print Spooler API](https://learn.microsoft.com/en-us/windows/win32/printdocs/print-spooler-api)

---

**Content was rephrased for compliance with licensing restrictions**
