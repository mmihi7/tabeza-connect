# Quick Start: Integrate Receipt Delivery into Staff Dashboard

## ✅ What's Already Done

- ✅ Database tables created and verified
- ✅ Node.js printer service running
- ✅ Cloud API endpoints working
- ✅ UnmatchedReceipts component created

## 🎯 What You Need to Do

### Step 1: Add UnmatchedReceipts to Staff Dashboard

**File:** `apps/staff/app/page.tsx`

Add the import at the top:
```typescript
import UnmatchedReceipts from '@/components/printer/UnmatchedReceipts';
```

Add the component in the render section, after the TAB CARDS section (around line 1350):
```typescript
{/* TAB CARDS */}
<div className="p-4 pb-24">
  {/* ... existing tab cards code ... */}
</div>

{/* UNMATCHED RECEIPTS - NEW SECTION */}
{bar && (
  <div className="p-4">
    <UnmatchedReceipts barId={bar.id} />
  </div>
)}

{/* HIGH VISIBILITY ALERT OVERLAY */}
<HighVisibilityAlert 
  isVisible={showAlert} 
  // ... rest of the code
```

That's it! The component will now show up on the dashboard.

### Step 2: Test the Complete Flow

1. **Open test page:**
   ```
   dev-tools/debug/test-receipt-delivery.html
   ```

2. **Get your Bar ID:**
   - Open staff dashboard
   - Check browser console or database
   - Or run: `SELECT id, name FROM bars;` in Supabase SQL Editor

3. **Send test receipt:**
   - Enter your Bar ID in the test page
   - Click "Send Test Receipt"
   - Should see success message

4. **Check dashboard:**
   - Refresh staff dashboard
   - Should see "Unmatched Receipts" section
   - Should show the test receipt

5. **Create a test tab:**
   - Open customer app: `http://localhost:3002`
   - Scan QR code or enter bar slug
   - Open a tab

6. **Assign receipt:**
   - Go back to staff dashboard
   - Click "Select Tab" on the receipt
   - Choose the tab you just created
   - Click "Deliver Receipt"
   - Success!

### Step 3: Configure Real POS (Optional)

1. **Open Windows Printers:**
   - Control Panel → Devices and Printers

2. **Find "TABEZA Virtual Printer":**
   - Right-click → Printer Properties
   - Go to Ports tab

3. **Add Local Port:**
   - Click "Add Port"
   - Select "Local Port"
   - Enter: `C:\Users\mwene\TabezaPrints\receipt.prn`
   - Click OK

4. **Select the new port:**
   - Check the box next to the port you just created
   - Click Apply

5. **Configure POS:**
   - Open your POS settings
   - Select printer: "TABEZA Virtual Printer"
   - Test print

6. **Verify:**
   - Complete a sale in POS
   - Check staff dashboard
   - Should see receipt in "Unmatched Receipts"
   - Assign to tab
   - Done!

## 🎉 That's It!

The complete receipt delivery system is now integrated:

```
POS → Windows Printer → Folder → Node.js → Cloud → Staff Dashboard → Customer
```

## 📝 Next Steps (Optional)

### Add Customer Receipt View

Create a component to show receipts in the customer app:

**File:** `apps/customer/components/DigitalReceipt.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function DigitalReceipt({ tabId }: { tabId: string }) {
  const [receipts, setReceipts] = useState<any[]>([]);

  useEffect(() => {
    loadReceipts();

    // Subscribe to new receipts
    const subscription = supabase
      .channel(`receipts-${tabId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'digital_receipts',
          filter: `tab_id=eq.${tabId}`,
        },
        () => {
          loadReceipts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tabId]);

  async function loadReceipts() {
    const { data } = await supabase
      .from('digital_receipts')
      .select('*')
      .eq('tab_id', tabId)
      .order('delivered_at', { ascending: false });

    setReceipts(data || []);
  }

  if (receipts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">📄 Your Receipts</h2>
      {receipts.map((receipt) => (
        <div key={receipt.id} className="bg-white rounded-lg shadow p-4">
          <div className="font-semibold text-lg mb-2">
            KES {receipt.total_amount.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">
            {receipt.receipt_data.items.map((item: any, i: number) => (
              <div key={i}>
                {item.name} - KES {item.price.toFixed(2)}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {new Date(receipt.delivered_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Then add it to the customer tab page.

## 🐛 Troubleshooting

### Receipt not appearing in dashboard?

1. Check Node.js service is running:
   ```bash
   curl http://localhost:8765/api/status
   ```

2. Check database tables exist:
   ```bash
   node dev-tools/scripts/verify-printer-tables.js
   ```

3. Check browser console for errors

### Can't assign receipt to tab?

1. Make sure tab is "open" (not closed or overdue)
2. Check tab belongs to same bar as receipt
3. Check browser console for API errors

### POS not printing to folder?

1. Check printer port configuration
2. Try printing from Notepad first
3. Check folder permissions
4. See `PRINTER-PORT-SETUP-GUIDE.md`

## 📚 Documentation

- **Complete Status:** `PRINTER-SERVICE-CURRENT-STATE.md`
- **How POS Connects:** `HOW-POS-CONNECTS.md`
- **Simple Solution:** `REAL-SIMPLE-SOLUTION.md`
- **Port Setup:** `PRINTER-PORT-SETUP-GUIDE.md`

## 🎯 Summary

You're 95% done! Just add the component to the dashboard and test.

The hard part (database, API, service) is complete and working. 🚀
