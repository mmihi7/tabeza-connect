# Implementation Plan: POS Receipt Assignment Modal

## Overview

This implementation plan covers the development of a browser-based receipt assignment modal integrated into the Tabeza Staff PWA. The system uses **Supabase Realtime** (already in the stack) for real-time receipt delivery and **React state** for simple caching. The implementation leverages existing infrastructure (Tabeza Printer Service, Cloud API) and adds new React components and API endpoints to the Staff PWA.

**Timeline**: 2 weeks (10 working days)  
**Major Features**: 8 core features  
**Checkpoints**: After each feature for incremental validation

---

## Week 1: Core Features

### Day 1-2: Infrastructure Setup

- [x] 1. Database Schema and Realtime Setup (1 day)
  - Create `unmatched_receipts` table with proper indexes
  - Add columns: `id`, `bar_id`, `receipt_data` (JSONB), `status`, `created_at`, `assigned_at`, `assigned_to_tab_id`, `expires_at`
  - Create indexes on `(bar_id, status)` and `expires_at`
  - Enable Supabase Realtime publication for `unmatched_receipts` table
  - Write and test migration script
  - Insert sample receipt data for testing
  - **Acceptance Criteria:**
    - ✅ Table created with all columns and indexes
    - ✅ Realtime enabled and tested with Supabase client
    - ✅ Can insert and query receipts successfully
    - ✅ RLS policy allows service role and authenticated users
  - **Checkpoint:** Database ready for receipt storage ✅
  - _Requirements: 1.1, 1.2_
  - **Status:** COMPLETE - Realtime working, events received within 1 second

- [x] 2. Real-Time Receipt Delivery (1 day)
  - Create `useRealtimeReceipts` custom hook using Supabase Realtime
  - Subscribe to `INSERT` events on `unmatched_receipts` filtered by `bar_id`
  - Handle connection lifecycle (connect, disconnect, reconnect)
  - Parse incoming receipt events and update React state
  - Add connection status tracking (connected/reconnecting/disconnected)
  - Test event delivery with manual database inserts
  - Write unit tests for hook behavior
  - **Acceptance Criteria:**
    - ✅ Hook establishes Supabase Realtime subscription
    - ✅ Receives receipt events within 1 second of database insert
    - ✅ Automatically reconnects on connection loss
    - ✅ Only receives receipts for current venue
    - ✅ Connection status updates correctly
  - **Checkpoint:** Can receive real-time receipt events in browser console ✅
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.3_
  - **Status:** COMPLETE - Hook implemented with full test coverage

### Day 3-4: Modal MVP

- [x] 3. Basic Receipt Assignment Modal (1.5 days)
  - Create `ReceiptAssignmentModal` React component
  - Implement modal overlay with semi-transparent backdrop
  - Display receipt details: venue name, timestamp, line items, quantities, prices, subtotal, tax, total
  - Fetch and display list of open tabs (tab number, table number, customer identifier)
  - Add search input for filtering tabs by tab/table number
  - Sort tabs by creation time (newest first)
  - Implement "Cancel" button to dismiss modal
  - Implement "Send to Customer" button (disabled until tab selected)
  - Add loading, success, and error states
  - Style modal to match Staff PWA design
  - Make responsive for desktop and tablet
  - **Acceptance Criteria:**
    - ✅ Modal appears within 1 second of receipt event
    - ✅ Displays all receipt fields correctly
    - ✅ Shows list of open tabs sorted by time
    - ✅ Search filters tabs in real-time
    - ✅ Button states work correctly (disabled/enabled)
    - ✅ Modal is responsive and accessible
    - ✅ Works on Chrome, Safari, Firefox
  - **Checkpoint:** Modal displays correctly with all UI elements
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 7.5, 11.1, 11.2, 11.3, 13.2_

- [x] 4. Assignment Flow Implementation (0.5 days)
  - Create `POST /api/receipts/:id/assign` API endpoint
  - Authenticate request with JWT token
  - Validate receipt exists and is unassigned
  - Validate tab exists and is open
  - Create order in `tab_orders` table with receipt items
  - Update receipt status to 'assigned' and set `assigned_to_tab_id`
  - Send push notification to customer (reuse existing notification system)
  - Connect modal "Send to Customer" button to API endpoint
  - Display loading spinner during assignment
  - Show success confirmation for 2 seconds with checkmark
  - Auto-close modal after success confirmation
  - Handle and display API errors with retry button
  - Write unit tests for API endpoint
  - Write integration test for end-to-end flow
  - **Acceptance Criteria:**
    - ✅ Assignment API completes within 3 seconds
    - ✅ Order created in database correctly
    - ✅ Receipt status updated to 'assigned'
    - ✅ Customer receives push notification
    - ✅ Success confirmation displays for exactly 2 seconds
    - ✅ Modal closes automatically after success
    - ✅ Errors display with clear messages and retry option
  - **Checkpoint:** Can assign receipt to tab end-to-end (POS → Modal → Assignment → Customer)
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4_

### Day 5: Tab Management

- [x] 5. Tab List Management and Caching (1 day)
  - Create `useTabList` custom hook
  - Fetch open tabs from `GET /api/tabs?venueId={id}&status=open` endpoint
  - Store tabs in React state (no IndexedDB needed)
  - Implement automatic refresh every 30 seconds using `setInterval`
  - Add loading state while fetching tabs
  - Display "Using cached data" indicator if data is stale (> 30 seconds old)
  - Handle empty tab list with "No open tabs available" message
  - Filter tabs by current venue ID
  - Write unit tests for hook
  - **Acceptance Criteria:**
    - ✅ Tabs fetch successfully on modal open
    - ✅ Tab list refreshes every 30 seconds automatically
    - ✅ Loading state displays during fetch
    - ✅ Stale data indicator shows when appropriate
    - ✅ Empty state displays correctly
    - ✅ Only shows tabs for current venue
  - **Checkpoint:** Tab list displays and refreshes correctly
  - _Requirements: 3.1, 6.1, 6.2, 6.5, 12.1, 12.2, 12.3_

---

## Week 2: Production Features

### Day 6-7: Error Handling & Notifications

- [x] 6. Comprehensive Error Handling (1 day)
  - Add offline detection using `navigator.onLine`
  - Display connection status indicator in header (green/yellow/red dot)
  - Show "Working offline" banner when network is unavailable
  - Handle assignment failures with clear error messages
  - Add "Retry" button for failed assignments
  - Handle incomplete receipt data (display available fields, mark missing as "N/A")
  - Add manual reconnect button for Supabase Realtime
  - Log all errors to console with sensitive data redacted
  - Add "Report Issue" button that captures error logs
  - Write unit tests for error scenarios
  - **Acceptance Criteria:**
    - ✅ Offline mode detected and displayed correctly
    - ✅ Connection status indicator updates in real-time
    - ✅ Assignment errors show user-friendly messages
    - ✅ Retry button works correctly
    - ✅ Incomplete receipts display gracefully
    - ✅ Manual reconnect button reestablishes connection
    - ✅ Errors logged without exposing sensitive data
  - **Checkpoint:** Error handling works gracefully for all failure scenarios
  - _Requirements: 6.2, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.4, 11.5_

- [x] 7. Browser Notifications and Sound (1 day)
  - Request notification permission on first receipt event
  - Display browser notification when receipt arrives and tab is in background
  - Include receipt total and item preview in notification
  - Play notification sound (add audio file with volume control)
  - Handle notification click to focus Staff PWA tab and show modal
  - Add in-app banner if notification permission denied
  - Add notification preferences toggle in settings
  - Persist notification preferences in localStorage
  - Test on multiple browsers (Chrome, Safari, Firefox)
  - Write unit tests for notification logic
  - **Acceptance Criteria:**
    - ✅ Notification permission requested appropriately
    - ✅ Notification displays when tab is in background
    - ✅ Notification shows receipt total and items
    - ✅ Sound plays with adjustable volume
    - ✅ Clicking notification focuses tab and shows modal
    - ✅ Fallback banner displays if permission denied
    - ✅ Preferences persist across sessions
    - ✅ Works on Chrome, Safari, Firefox
  - **Checkpoint:** Notifications and sound work correctly
  - _Requirements: 2.5, 5.1, 5.2, 5.3, 5.4, 5.5_

### Day 8: Additional Features

- [x] 8. Unmatched Receipts Page (1 day)
  - Create `UnmatchedReceipts` React component
  - Add "Unmatched Receipts" link to main navigation
  - Fetch unmatched receipts from `GET /api/receipts/unmatched?venueId={id}` endpoint
  - Display receipts from past hour in list view (timestamp, total, items preview)
  - Sort by timestamp (newest first)
  - Implement auto-refresh every 30 seconds
  - Click receipt to open assignment modal
  - Automatically remove receipts older than 1 hour (filter client-side)
  - Store dismissed receipts in unmatched list
  - Add empty state when no unmatched receipts exist
  - Write unit tests for component
  - **Acceptance Criteria:**
    - ✅ Unmatched receipts page accessible from navigation
    - ✅ Displays all receipts from past hour
    - ✅ Sorted by timestamp correctly
    - ✅ Auto-refreshes every 30 seconds
    - ✅ Clicking receipt opens modal
    - ✅ Old receipts automatically removed
    - ✅ Dismissed receipts appear in list
    - ✅ Empty state displays correctly
  - **Checkpoint:** Can recover and assign old receipts
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

### Day 9: Polish and Security

- [ ] 9. UI Polish and Accessibility (0.5 days)
  - Refine modal design to match Staff PWA style guide
  - Ensure responsive layout works on desktop, tablet, and mobile
  - Add ARIA labels for screen readers
  - Test keyboard navigation (Tab, Enter, Escape)
  - Add loading skeletons for better perceived performance
  - Optimize modal animations (fade in/out)
  - Test on multiple screen sizes
  - Run WAVE accessibility audit and fix issues
  - **Acceptance Criteria:**
    - ✅ Modal matches Staff PWA design system
    - ✅ Responsive on all screen sizes
    - ✅ Passes WAVE accessibility audit
    - ✅ Keyboard navigation works correctly
    - ✅ Loading states feel smooth
    - ✅ Animations are performant
  - **Checkpoint:** Production-quality UI
  - _Requirements: 15.1, 15.2, 15.3_

- [ ] 10. Security and Performance (0.5 days)
  - Enforce HTTPS-only for all API requests
  - Add JWT authentication to Supabase Realtime connection
  - Implement venue-based filtering on all API endpoints
  - Add rate limiting to assignment endpoint (max 10/minute per user)
  - Clear receipt data from state after successful assignment
  - Redact sensitive data (customer names, payment info) in console logs
  - Clear all cached data on user logout
  - Validate SSL certificates on API connections
  - Add React.memo to expensive components
  - Implement debouncing on search input (300ms)
  - Test with 100+ open tabs to ensure smooth performance
  - Measure and optimize modal display time (target < 1 second)
  - Write security tests
  - **Acceptance Criteria:**
    - ✅ All API requests use HTTPS
    - ✅ Realtime connection authenticated with JWT
    - ✅ Venue filtering prevents cross-venue access
    - ✅ Rate limiting prevents abuse
    - ✅ Receipt data cleared after assignment
    - ✅ Sensitive data redacted in logs
    - ✅ Cache cleared on logout
    - ✅ Modal displays in < 1 second
    - ✅ Search filters in < 100ms
    - ✅ Smooth performance with 100+ tabs
  - **Checkpoint:** Security validated and performance optimized
  - _Requirements: 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 14.4, 14.5_

### Day 10: Integration and Deployment

- [ ] 11. Printer Service Integration (0.5 days)
  - Update Printer Service configuration to POST to `/api/printer/relay`
  - Ensure `bar_id` is included in relay payload
  - Verify receipt parsing still works correctly
  - Test connectivity to Tabeza Cloud API
  - Update Printer Service documentation
  - Deploy updated Printer Service to test venue
  - **Acceptance Criteria:**
    - ✅ Printer Service successfully posts to cloud
    - ✅ `bar_id` included in all requests
    - ✅ Receipt parsing works correctly
    - ✅ Cloud connectivity stable
    - ✅ Documentation updated
  - **Checkpoint:** Printer Service integrated
  - _Requirements: 1.2_

- [ ] 12. End-to-End Testing and Deployment (0.5 days)
  - Test complete flow: POS print → Printer Service → Cloud → Realtime → Modal → Assignment → Customer
  - Test with multiple concurrent receipts
  - Test venue switching
  - Test offline mode and reconnection
  - Test background tab notifications
  - Test unmatched receipts recovery
  - Test on multiple browsers (Chrome, Safari, Firefox)
  - Test on multiple devices (desktop, tablet, mobile)
  - Run performance benchmarks
  - Deploy Cloud API updates to production
  - Deploy Staff PWA updates to production
  - Monitor Supabase Realtime connections
  - Monitor assignment success rate
  - Monitor error rates
  - Create user documentation and troubleshooting guide
  - **Acceptance Criteria:**
    - ✅ End-to-end flow works flawlessly
    - ✅ Multiple receipts handled correctly
    - ✅ Venue switching works
    - ✅ Offline mode graceful
    - ✅ Notifications work on all browsers
    - ✅ Performance meets targets
    - ✅ Deployed to production successfully
    - ✅ Monitoring in place
    - ✅ Documentation complete
  - **Checkpoint:** Live in production ✅
  - _Requirements: All requirements validated_

---

## Testing Strategy

### Unit Tests
Write unit tests for:
- `useRealtimeReceipts` hook (connection, reconnection, event parsing)
- `useTabList` hook (fetching, caching, refresh)
- `ReceiptAssignmentModal` component (rendering, interactions, states)
- `UnmatchedReceipts` component (list display, filtering, refresh)
- Assignment API endpoint (validation, error handling)
- Error handling functions (offline detection, retry logic)
- Notification logic (permission, display, click handling)

### Integration Tests
Write integration tests for:
- Complete assignment flow (receipt event → modal → assignment → success)
- Offline mode with error handling
- Venue switching and data isolation
- Browser notifications end-to-end
- Unmatched receipts recovery

### Manual Testing
Test manually:
- Real POS printing to Printer Service
- Multiple concurrent receipts
- Network disconnection and reconnection
- Browser tab backgrounding
- Cross-browser compatibility
- Mobile responsiveness
- Accessibility with screen reader

---

## Technology Decisions

### ✅ Supabase Realtime (Not SSE)
**Why:** Already in the stack, two-way communication, built-in reconnection, mobile-friendly, scales well

### ✅ React State (Not IndexedDB)
**Why:** Simpler, tabs change constantly, no offline requirement, easier to debug

### ✅ Simple Retry (Not Queue for MVP)
**Why:** YAGNI principle - add queue later only if users complain about failures

### ✅ Polling Fallback
**Why:** If Realtime fails, fall back to polling every 5 seconds as backup

---

## Definition of Done

Each task is complete when:
1. ✅ All acceptance criteria met
2. ✅ Unit tests written and passing
3. ✅ Manual testing completed
4. ✅ Code reviewed (if applicable)
5. ✅ Checkpoint validated with user

---

## Notes

- **No optional tasks** - all tasks are required for production
- **Checkpoints after each feature** - validate before moving forward
- **Realistic timeline** - 2 weeks for 8 features
- **Simple tech choices** - Supabase Realtime + React state
- **Clear acceptance criteria** - know when task is done
- **Proper sequencing** - implement → test → validate → checkpoint
