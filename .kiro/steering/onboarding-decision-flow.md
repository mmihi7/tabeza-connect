# Onboarding Decision Flow

## Purpose
Define the exact onboarding sequence that determines venue mode and authority configuration.

## Decision Tree (Enforced in UI)

### Step 1: Application Mode Selection
**Question: "What type of venue setup do you need?"**

#### Option A: Tabeza Basic
- **Label**: "I have a POS system and want digital receipts"
- **Description**: "Perfect for established venues with existing POS systems"
- **Icons**: 🖨️ Printer + 📱 Digital receipts
- **Sets**: `venue_mode = 'basic'`, `authority_mode = 'pos'`, `printer_required = true`

#### Option B: Tabeza Venue  
- **Label**: "I want full customer ordering and menus"
- **Description**: "Complete solution for customer interaction and ordering"
- **Icons**: 📋 Menus + 💬 Messaging + 💳 Payments
- **Sets**: `venue_mode = 'venue'`
- **Leads to**: Step 2

### Step 2: Authority Configuration (Venue Mode Only)
**Question: "Do you have an existing POS system?"**

#### Option A: Yes, I have a POS
- **Label**: "Yes - integrate with my POS"
- **Description**: "Tabeza will work alongside your existing POS system"
- **Sets**: `authority_mode = 'pos'`, `pos_integration_enabled = true`
- **Enables**: Customer requests, POS receipt mirroring
- **Disables**: Staff ordering in Tabeza

#### Option B: No POS system
- **Label**: "No - Tabeza will be my ordering system"  
- **Description**: "Tabeza will handle all orders and receipts"
- **Sets**: `authority_mode = 'tabeza'`, `pos_integration_enabled = false`
- **Enables**: Full Tabeza ordering, digital receipts
- **Disables**: POS integration features

## Configuration Matrix

| Venue Mode | Authority Mode | POS Integration | Staff Ordering | Customer Ordering | Printer Required |
|------------|----------------|-----------------|----------------|-------------------|------------------|
| Basic      | POS            | ✅ Required     | ❌ Disabled    | ❌ Disabled       | ✅ Required      |
| Venue      | POS            | ✅ Enabled      | ❌ Disabled    | 📝 Requests Only  | ⚠️ Optional      |
| Venue      | Tabeza         | ❌ Disabled     | ✅ Enabled     | ✅ Full Orders    | ❌ Not Used      |

## UI Implementation Requirements

### Onboarding Screens
1. **Welcome Screen**: Explain the two paths
2. **Mode Selection**: Clear visual distinction between Basic and Venue
3. **Authority Selection**: Only shown for Venue mode
4. **Configuration Summary**: Show what will be enabled/disabled
5. **Setup Completion**: Mode-specific next steps

### Settings Page Constraints
- Mode switching requires admin confirmation
- Authority mode changes must validate current state
- Invalid configurations must be prevented with clear messaging

### Visual Indicators
- **Basic Mode**: 🔵 Blue theme, printer-focused icons
- **Venue Mode + POS**: 🟡 Yellow theme, hybrid workflow icons  
- **Venue Mode + Tabeza**: 🟢 Green theme, full-service icons

## Error Prevention

### Invalid State Detection
```typescript
// Prevent invalid configurations
if (venue_mode === 'basic' && authority_mode !== 'pos') {
  throw new Error('Basic mode requires POS authority');
}

if (venue_mode === 'venue' && !['pos', 'tabeza'].includes(authority_mode)) {
  throw new Error('Venue mode requires valid authority selection');
}
```

### Migration Safeguards
- Changing from Venue→Basic requires data migration confirmation
- Authority mode changes must preserve existing orders/receipts
- Printer setup validation before enabling Basic mode

## Success Criteria
- No venue can be in an invalid state
- Onboarding path is clear and unambiguous  
- Settings prevent configuration drift
- Staff understand their workflow constraints
- Customers receive consistent experience