# Staff Receipt Delete Feature

## Purpose
Add ability for staff to delete/discard unclaimed receipts that won't be assigned to tabs, preventing database clutter.

## Use Cases
1. **Test receipts** during onboarding or testing
2. **Duplicate receipts** from POS errors
3. **Void receipts** that were cancelled
4. **Orphaned receipts** that don't match any customer

## Implementation

### Database Changes
**Status enum update**: Add 'VOID' status to receipt_status enum
```sql
ALTER TYPE receipt_status ADD VALUE 'VOID';
```

**Soft delete approach**: Update status to 'VOID' instead of hard delete to preserve audit trail

### API Endpoint
```typescript
// DELETE /api/receipts/:id
export default async function handler(req, res) {
  const { id } = req.query;
  const { staff_id } = req.body;
  
  // Validate receipt is UNCLAIMED
  const { data: receipt } = await supabase
    .from('pos_receipts')
    .select('*')
    .eq('id', id)
    .eq('status', 'UNCLAIMED')
    .single();
    
  if (!receipt) {
    return res.status(400).json({ 
      error: 'Receipt not found or already assigned' 
    });
  }
  
  // Soft delete: update status to VOID
  const { data, error } = await supabase
    .from('pos_receipts')
    .update({
      status: 'VOID',
      voided_at: new Date().toISOString(),
      voided_by_staff_id: staff_id
    })
    .eq('id', id)
    .eq('status', 'UNCLAIMED')  // Double-check still unclaimed
    .select()
    .single();
    
  if (error) {
    return res.status(409).json({ 
      error: 'Receipt already assigned or deleted' 
    });
  }
  
  // Log deletion for audit trail
  await supabase
    .from('audit_logs')
    .insert({
      action: 'receipt_voided',
      bar_id: receipt.bar_id,
      staff_id: staff_id,
      metadata: { receipt_id: id, reason: 'staff_discard' }
    });
    
  res.json({ success: true });
}
```

### UI Component
```typescript
function ReceiptCard({ receipt, tabs, onAssign, onDelete }) {
  const [selectedTab, setSelectedTab] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(receipt.id);
      // Receipt removed from list by parent component
    } catch (error) {
      alert('Failed to delete receipt: ' + error.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }
  
  return (
    <div className="receipt-card">
      <div className="receipt-details">
        <span className="time">{formatTime(receipt.created_at)}</span>
        <span className="total">{receipt.currency} {receipt.total}</span>
        <span className="confidence">
          {receipt.parsing_method === 'regex' ? '✓' : 'AI'} 
          {(receipt.confidence_score * 100).toFixed(0)}%
        </span>
      </div>
      
      <div className="assignment-controls">
        <select 
          value={selectedTab}
          onChange={(e) => setSelectedTab(e.target.value)}
          disabled={assigning || deleting}
        >
          <option value="">Select Tab...</option>
          {tabs.map(tab => (
            <option key={tab.id} value={tab.id}>
              Tab {tab.tab_number} - {tab.customer_name || 'Unnamed'}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => handleAssign()}
          disabled={!selectedTab || assigning || deleting}
          className="btn-primary"
        >
          {assigning ? 'Assigning...' : 'Assign to Tab'}
        </button>
        
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={assigning || deleting}
          className="btn-danger"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="confirm-dialog">
          <p>Delete this receipt? This cannot be undone.</p>
          <button onClick={handleDelete} className="btn-danger">
            Confirm Delete
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Show receipt items preview */}
      <div className="items-preview">
        {receipt.items?.slice(0, 3).map((item, i) => (
          <div key={i}>{item.quantity}× {item.name}</div>
        ))}
      </div>
    </div>
  );
}
```

### Receipt List View
Show voided receipts with badge:
```typescript
function ReceiptList({ barId }) {
  const [filter, setFilter] = useState('UNCLAIMED');
  
  // Filter options: All, Unclaimed, Claimed, Void, Failed
  const { data: receipts } = await supabase
    .from('pos_receipts')
    .select('*')
    .eq('bar_id', barId)
    .eq('status', filter === 'All' ? undefined : filter)
    .order('created_at', { ascending: false });
    
  return (
    <div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="All">All Receipts</option>
        <option value="UNCLAIMED">Unclaimed</option>
        <option value="CLAIMED">Claimed</option>
        <option value="VOID">Voided</option>
        <option value="PARSE_FAILED">Failed</option>
      </select>
      
      {receipts.map(receipt => (
        <div key={receipt.id} className="receipt-row">
          <span>{receipt.total}</span>
          <span className={`badge badge-${receipt.status.toLowerCase()}`}>
            {receipt.status}
          </span>
          {receipt.status === 'VOID' && (
            <span className="void-info">
              Deleted {formatTime(receipt.voided_at)} 
              by {receipt.voided_by_staff_id}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Benefits
1. **Cleaner database**: Remove test/duplicate receipts
2. **Better UX**: Staff can manage receipt list
3. **Audit trail**: Soft delete preserves history
4. **Prevents errors**: Can't delete claimed receipts

## Constraints
- Can only delete UNCLAIMED receipts
- Cannot delete CLAIMED receipts (use unassign first)
- Soft delete (status = VOID) preserves audit trail
- Requires staff authentication
- Logs all deletions in audit_logs

## Task Updates Required
Add to your minimal plan:

**Task 5.2**: Add DELETE endpoint alongside assign endpoint
**Task 5.3**: Add delete button next to assign button in UI
**Task 6.1**: Show VOID status badge in receipt list
**Task 6.2**: Add delete button in receipt detail view (unclaimed only)
