# Virtual Printer UI Components

React-based UI components for the Tabeza Virtual Printer integration. These components provide the staff interface for the POS receipt distribution workflow.

## Overview

The virtual printer system allows POS systems to send receipts to Tabeza, where staff can choose to either:
1. **Print Physical Receipt** - Forward to thermal printer (traditional workflow)
2. **Send Digital Receipt** - Deliver to customer's Tabeza app

## Components

### 1. VirtualPrinterIntegration

Main integration component that manages the complete workflow and integrates with the `@tabeza/virtual-printer` package.

```tsx
import { VirtualPrinterIntegration } from '@/components/printer';

<VirtualPrinterIntegration
  barId="your-bar-id"
  supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
  supabaseKey={process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
  enabled={authorityMode === 'pos'} // Only enabled for POS authority
/>
```

**Props:**
- `barId` - The venue's bar ID
- `supabaseUrl` - Supabase project URL
- `supabaseKey` - Supabase publishable key
- `enabled` - Whether virtual printer is enabled (POS authority only)

### 2. ReceiptDistributionModal

Modal that appears when POS sends a print job. Allows staff to choose between physical and digital receipt.

```tsx
import { ReceiptDistributionModal } from '@/components/printer';

<ReceiptDistributionModal
  isOpen={true}
  receiptData={receiptData}
  onPhysicalReceipt={() => console.log('Print physical')}
  onDigitalReceipt={() => console.log('Send digital')}
  onClose={() => console.log('Close')}
/>
```

### 3. CustomerSelectionModal

Modal for selecting which connected customers should receive the digital receipt.

```tsx
import { CustomerSelectionModal } from '@/components/printer';

<CustomerSelectionModal
  isOpen={true}
  customers={connectedCustomers}
  receiptTotal={150.00}
  onConfirm={(selectedIds) => console.log('Selected:', selectedIds)}
  onCancel={() => console.log('Cancel')}
  onFallbackToPhysical={() => console.log('Fallback to physical')}
/>
```

### 4. DeliveryConfirmationModal

Modal showing delivery results after digital receipts are sent.

```tsx
import { DeliveryConfirmationModal } from '@/components/printer';

<DeliveryConfirmationModal
  isOpen={true}
  deliveryResult={deliveryResult}
  onClose={() => console.log('Close')}
  onRetryFailed={() => console.log('Retry failed deliveries')}
/>
```

## Workflow

### Complete POS Receipt Distribution Flow

1. **POS Print Job** → Tabeza Virtual Printer intercepts
2. **Receipt Distribution Modal** → Staff chooses physical or digital
3. **If Physical** → Forward to thermal printer → Done
4. **If Digital** → Customer Selection Modal → Staff selects customer(s)
5. **Digital Delivery** → Send receipt to selected customers
6. **Delivery Confirmation** → Show success/failure results

## Integration with Staff App

Add the `VirtualPrinterIntegration` component to your staff app layout:

```tsx
// apps/staff/app/layout.tsx or dashboard page

import { VirtualPrinterIntegration } from '@/components/printer';

export default function StaffLayout({ children }) {
  const { barId, authorityMode } = useVenueConfig();
  
  return (
    <div>
      {children}
      
      {/* Virtual Printer Integration - only for POS authority */}
      <VirtualPrinterIntegration
        barId={barId}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        supabaseKey={process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}
        enabled={authorityMode === 'pos'}
      />
    </div>
  );
}
```

## Authority Mode Compliance

**CRITICAL:** These components should ONLY be active when `authority_mode = 'pos'`.

```typescript
// CORE TRUTH: Manual service always exists. Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.

// ✅ Correct - Only enabled for POS authority
<VirtualPrinterIntegration enabled={authorityMode === 'pos'} />

// ❌ Wrong - Should not be enabled for Tabeza authority
<VirtualPrinterIntegration enabled={true} />
```

## Styling

Components use Tailwind CSS and are designed to match the Tabeza Basic blue theme:
- Primary color: Blue (`bg-blue-600`)
- Success color: Green (`bg-green-600`)
- Warning color: Yellow (`bg-yellow-600`)
- Error color: Red (`bg-red-600`)

## Testing

Test the complete workflow:

```bash
# Run component tests
cd apps/staff
npm test components/printer

# Test with virtual printer package
cd packages/virtual-printer
npm test
```

## Environment Variables

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-key
NEXT_PUBLIC_PRINTER_SECRET_KEY=your-printer-secret-key
```

## Troubleshooting

### Modal not appearing
- Check that `enabled={true}` is set
- Verify virtual printer engine is initialized
- Check browser console for errors

### Customers not loading
- Verify Supabase connection
- Check that tabs exist with `status='open'`
- Verify `bar_id` matches

### Digital delivery failing
- Check customer connection status
- Verify tab_orders table permissions
- Check network connectivity

## Related Documentation

- [Virtual Printer Package](../../../../packages/virtual-printer/README.md)
- [POS Integration Guide](../../../../packages/virtual-printer/docs/POS-INTEGRATION-GUIDE.md)
- [Printer Driver Implementation Spec](.kiro/specs/printer-driver-implementation/)
