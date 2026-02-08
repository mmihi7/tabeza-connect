# Staff Bell Notification Fix - Requirements

## Problem Statement

When staff receives a bell notification for a new order or message on multiple devices, the continuous bell sound does not stop across all devices when any staff member clicks on the relevant tab. Currently:

1. **Single device issue**: Clicking a tab card doesn't stop the sound on that device
2. **Multi-device issue**: If Device A and Device B both have alerts for the same tab (e.g., Tab #5 has a new order), and staff clicks Tab #5 on Device A, the alert sound continues playing on Device B

The alert is tab-specific - when staff addresses a tab by clicking on it, all devices should recognize that the alert for that specific tab has been acknowledged and stop playing the sound.

This creates a poor user experience where staff must manually dismiss alerts on every device, even after the issue has been addressed on one device.

## User Story

**As a** bar staff member  
**I want** the bell notification sound to stop on all devices when any staff member clicks on the tab that triggered the alert  
**So that** once someone is handling the order/message, all devices stop alerting and we can focus on serving customers efficiently

## Current Behavior

1. New order/message arrives for Tab #5 → continuous bell sound starts on all staff devices
2. High-visibility alert overlay appears on all devices
3. Staff member on Device A clicks Tab #5 to view details
4. Navigation occurs to tab detail page on Device A
5. ❌ Bell sound continues playing on Device A
6. ❌ Bell sound continues playing on Device B, Device C, etc.
7. Staff must manually dismiss the alert overlay on every device

## Expected Behavior

1. New order/message arrives for Tab #5 → continuous bell sound starts on all staff devices
2. High-visibility alert overlay appears on all devices
3. Staff member on Device A clicks Tab #5 to view details
4. ✅ Bell sound stops immediately on Device A
5. ✅ Bell sound stops on Device B, Device C, etc. (all devices)
6. ✅ Alert overlay is dismissed on all devices
7. Navigation occurs to tab detail page on Device A

## Acceptance Criteria

### 1.1 Local Device: Tab Click Stops Sound
**Given** a continuous bell notification is playing on a device  
**When** staff clicks on the tab card that triggered the alert  
**Then** the continuous bell sound must stop immediately on that device  
**And** the alert overlay must be dismissed on that device  
**And** navigation to the tab detail page must proceed

### 1.2 Cross-Device: Alert Acknowledgment Propagation
**Given** multiple staff devices are showing alerts for the same tab  
**When** staff clicks on that tab on any one device  
**Then** all devices must stop playing the bell sound for that tab  
**And** all devices must dismiss the alert overlay for that tab  
**And** the acknowledgment must propagate within 500ms

### 1.3 Tab-Specific Alert Tracking
**Given** Device A has alerts for Tab #5 and Tab #7  
**And** Device B has alerts for Tab #5 and Tab #9  
**When** staff clicks Tab #5 on Device A  
**Then** both devices stop the alert for Tab #5  
**And** Device A still shows alert for Tab #7  
**And** Device B still shows alert for Tab #9

### 1.4 Sound Cleanup on Navigation
**Given** a continuous bell notification is playing  
**When** staff navigates to any tab (by clicking a tab card)  
**Then** all continuous alert sounds must be stopped  
**And** the `continuousBellActive` flag must be set to false  
**And** the `continuousBellTimeout` must be cleared

### 1.5 No Sound Leakage
**Given** staff has clicked on a tab while bell was playing  
**When** they return to the main tabs page  
**Then** no residual bell sound should be playing  
**And** the alert system should be in a clean state

### 1.6 Existing Dismissal Methods Still Work
**Given** a continuous bell notification is playing  
**When** staff uses any existing dismissal method (clicking overlay, ESC key, etc.)  
**Then** the sound must stop on that device  
**And** all dismissal methods must continue to work correctly  
**Note:** Manual dismissal (overlay click, ESC) only affects the local device, not all devices

### 1.7 Real-Time Subscription Efficiency
**Given** the system uses Supabase real-time subscriptions  
**When** a tab is clicked and acknowledged  
**Then** the acknowledgment event must be broadcast efficiently  
**And** no unnecessary database writes should occur  
**And** the system must handle multiple simultaneous acknowledgments gracefully

## Technical Context

### Current Implementation
- Bell notification system in `apps/staff/app/page.tsx`
- `startContinuousBellSound()` - starts looping bell sound
- `stopContinuousAlertSound()` - stops all continuous sounds
- `HighVisibilityAlert` component - handles alert overlay dismissal
- Tab cards have `onClick={() => router.push(\`/tabs/${tab.id}\`)}` handler
- Real-time subscriptions for orders and messages via Supabase

### Root Cause
1. **Local issue**: Tab card click handler navigates directly without calling `stopContinuousAlertSound()`
2. **Cross-device issue**: No mechanism to broadcast tab acknowledgment to other devices

### Solution Approach

#### Option 1: Database-Backed Alert Acknowledgment (Recommended)
- Create `staff_alert_acknowledgments` table to track which tabs have been acknowledged
- When tab is clicked, insert acknowledgment record with tab_id and timestamp
- All devices subscribe to acknowledgment events via Supabase real-time
- On acknowledgment event, stop sound and dismiss overlay for matching tab

#### Option 2: Lightweight Event Broadcasting
- Use existing real-time channels to broadcast tab click events
- No database writes, purely ephemeral events
- Simpler but less reliable (events could be missed if device is temporarily offline)

#### Option 3: Implicit Acknowledgment via Tab Navigation
- Track when staff navigates to tab detail page (`/tabs/[id]`)
- Broadcast navigation event to other devices
- Other devices infer acknowledgment from navigation

**Recommendation**: Option 1 provides the most reliable solution with audit trail benefits.

## Non-Functional Requirements

### Performance
- Sound stopping must be immediate (< 50ms) on local device
- Cross-device alert dismissal must propagate within 500ms
- No delay in navigation after sound stops
- Real-time subscription overhead must be minimal

### Compatibility
- Must work on all browsers (Chrome, Firefox, Safari, Edge)
- Must work on mobile devices (iOS, Android)
- Must work with both custom audio and default bell sound
- Must handle network latency gracefully

### Reliability
- Sound must always stop when tab is clicked (local device)
- Cross-device acknowledgment must be reliable (99%+ delivery)
- System must handle race conditions (multiple staff clicking same tab simultaneously)
- No edge cases where sound continues playing
- Proper cleanup of all audio resources
- Must work even if some devices are offline (local stop always works)

### Scalability
- Must support multiple bars with isolated alert acknowledgments
- Must handle high-frequency alert scenarios (busy bar with many orders)
- Database writes should be minimal and efficient

## Out of Scope

- Changing the alert overlay design
- Modifying the bell sound itself
- Adding new dismissal methods beyond tab clicks
- Changing notification trigger logic
- Implementing read receipts or "who acknowledged" tracking
- Alert history or analytics
