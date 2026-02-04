# Venue Authority Modes (Applies to Basic & Venue)

## Purpose
To define exactly how Tabeza behaves under each valid authority configuration.
These modes are system-enforced.

## 🔵 Mode 1: POS-Authoritative Venue
**(Vendor has a POS)**

This is the default for established venues.

### System Behavior (Hard Rules)
- POS is the only system allowed to create financial orders
- Tabeza built-in waiter ordering → **Disabled**
- Tabeza menu ordering → **Customer requests only**
- Tabeza Print Service → **MUST BE ACTIVE**
- Receipt creation → **POS only**
- Receipts must print to the Tabeza printer
- **No exceptions.**

### What Tabeza Does
- Receives customer order requests
- Creates transaction contexts (Tabs)
- Mirrors POS receipts digitally
- Delivers digital receipts to customers
- Accepts payments
- Enables two-way messaging

**Tabeza never authors billable line items in this mode.**

### What Staff Does
- Takes orders verbally and/or receives customer-initiated requests
- Enters all confirmed orders into POS
- Uses Tabeza only to:
  - view requests
  - communicate with customers
  - send digital receipts
  - monitor payments

**Staff never builds orders in Tabeza.**

### Customer Experience
- Browse Tabeza menu
- Submit order requests
- Message staff and receive feedback
- View POS-confirmed digital receipt
- Pay via Tabeza

### Operational Reality
This mode works with:
- traditional waiter service
- physical menus
- printed receipts
- legacy POS systems

**Tabeza augments reality — it does not replace it.**

## 🟢 Mode 2: Tabeza-Authoritative Venue
**(Vendor has NO POS)**

This is the on-ramp for small or informal venues.

### System Behavior (Hard Rules)
- Tabeza built-in ordering → **Enabled**
- Tabeza menu ordering → **Active**
- Tabeza receipt generation → **Active**
- POS printer features → **Inactive**
- **Tabeza becomes the digital system of record.**

### What Tabeza Does
- Creates orders
- Generates receipts
- Accepts payments
- Tracks order history

### What Staff Does
- Accepts and fulfills orders in Tabeza
- Uses the dashboard as the primary system
- Continues manual service as normal

### Customer Experience
- Browse menu
- Place orders
- View digital receipt
- Pay

### Operational Reality
Manual ordering still exists, but resolves into Tabeza, not a POS.