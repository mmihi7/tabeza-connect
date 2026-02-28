# Task 2.5: Manual Browser Verification Checklist

## Overview
This document provides a comprehensive checklist for manually verifying the pending card styling changes implemented in tasks 2.2-2.4.

## Dev Server Status
✅ **Server Running**: `pnpm dev:staff` on port 3003
- Access URL: http://localhost:3003

## Pre-Verification Setup

### 1. Browser Setup
- [ ] Open browser (Chrome, Firefox, or Safari recommended)
- [ ] Navigate to http://localhost:3003
- [ ] Log in to staff dashboard
- [ ] Navigate to a view with tabs that have pending orders

### 2. Display Settings
- [ ] Set screen brightness to 100%
- [ ] Disable night mode/dark mode
- [ ] Disable any color filters or accessibility overlays
- [ ] Use standard color profile (not color-blind mode)

### 3. Test Data Requirements
You need tabs in the following states:
- [ ] At least one tab with pending orders (hasPendingOrders = true)
- [ ] At least one normal tab without pending orders
- [ ] Ideally, tabs with different balances and order counts

## Verification Checklist

### ✅ 1. Pending Card Background Color
**Expected**: Light amber background (NOT dark red/brown)

**Verification Steps:**
- [ ] Locate a tab card with pending orders
- [ ] Verify background is **light amber/yellow** color
- [ ] Verify background is **NOT dark red, brown, or any dark color**
- [ ] Verify gradient effect from amber-50 to amber-100 is visible
- [ ] Compare with normal cards (should be lighter than orange-tinted normal cards)

**Visual Reference:**
- Background should be: `bg-gradient-to-br from-amber-50 to-amber-100`
- Amber-50: Very light amber/cream color (#FFFBEB)
- Amber-100: Slightly darker amber (#FEF3C7)

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 2. Text Readability (Dark on Light)
**Expected**: All text should be dark colors on light background

**Verification Steps:**

#### 2a. Card Title/Tab Number
- [ ] Tab name/number is **dark gray** (text-gray-900)
- [ ] Table number is **dark gray** (text-gray-900)
- [ ] Text is easily readable at 100% brightness
- [ ] No squinting required to read text

**✅ PASS** / **❌ FAIL**: _______

#### 2b. Timestamp
- [ ] "Opened X ago" text is **medium gray** (text-gray-700)
- [ ] Text is clearly visible and readable

**✅ PASS** / **❌ FAIL**: _______

#### 2c. Balance Amount
- [ ] Large balance number is **dark amber** (text-amber-900)
- [ ] "Balance" label is **medium gray** (text-gray-700)
- [ ] Numbers are bold and highly visible

**✅ PASS** / **❌ FAIL**: _______

#### 2d. Footer Text
- [ ] "X orders" text is **dark gray** (text-gray-800)
- [ ] "X pending" text is **dark amber** (text-amber-900) and bold
- [ ] All footer text is readable

**✅ PASS** / **❌ FAIL**: _______

#### 2e. Balance Section Background
- [ ] Inner balance section has **light amber** background (bg-amber-200)
- [ ] Background is lighter than card background
- [ ] Text remains readable on this background

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 3. Icon Indicator
**Expected**: AlertCircle icon in top-right corner

**Verification Steps:**
- [ ] Icon appears in **top-right corner** of pending cards
- [ ] Icon is **AlertCircle** (⚠️ warning symbol)
- [ ] Icon color is **dark amber** (text-amber-900)
- [ ] Icon size is appropriate (24px × 24px)
- [ ] Icon does not overlap with other elements
- [ ] Icon does not appear on normal (non-pending) cards

**Visual Check:**
- [ ] Icon is clearly visible at 100% brightness
- [ ] Icon provides visual distinction beyond color
- [ ] Icon position is consistent across all pending cards

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 4. Border Styling
**Expected**: Thick amber border with ring effect

**Verification Steps:**
- [ ] Border is **4px thick** (border-4)
- [ ] Border color is **dark amber** (border-amber-700)
- [ ] Ring effect is visible (ring-4 ring-amber-400/50)
- [ ] Border is clearly visible at 100% brightness
- [ ] Border is thicker than normal cards (which have border-2)

**Comparison:**
- [ ] Pending cards have noticeably thicker borders than normal cards
- [ ] Border provides strong visual hierarchy

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 5. Pulse Animation
**Expected**: Subtle pulsing animation on pending cards

**Verification Steps:**
- [ ] Pending cards have subtle pulse animation
- [ ] Animation is smooth and not jarring
- [ ] Animation does not cause layout shifts
- [ ] Animation is visible but not distracting

**Reduced Motion Test:**
- [ ] Open browser DevTools (F12)
- [ ] Go to Rendering tab (may need to enable in "More tools")
- [ ] Enable "Emulate CSS media feature prefers-reduced-motion"
- [ ] Verify animation stops or is significantly reduced
- [ ] Verify card remains functional without animation

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 6. High Brightness Visibility Test
**Expected**: All elements remain visible at maximum brightness

**Verification Steps:**
- [ ] Set device brightness to 100%
- [ ] View dashboard in well-lit environment (or outdoors if possible)
- [ ] Verify pending cards are immediately distinguishable from normal cards
- [ ] Verify all text is readable without strain
- [ ] Verify borders are clearly visible
- [ ] Verify icon is visible

**Outdoor Test (Optional but Recommended):**
- [ ] Take device outdoors in daylight
- [ ] Verify pending cards are still visible
- [ ] Verify text remains readable
- [ ] Note any visibility issues

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 7. Comparison with Normal Cards
**Expected**: Clear visual distinction between pending and normal cards

**Verification Steps:**
- [ ] Normal cards have **orange tint** (from-white to-orange-50)
- [ ] Normal cards have **2px orange border** (border-2 border-orange-500)
- [ ] Pending cards are clearly **more amber/yellow** than normal cards
- [ ] Pending cards have **thicker borders** than normal cards
- [ ] Pending cards have **pulse animation**, normal cards do not
- [ ] Pending cards have **icon indicator**, normal cards do not

**Visual Hierarchy:**
- [ ] Pending cards "pop out" more than normal cards
- [ ] Visual priority is clear: Pending > Normal

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 8. Layout and Spacing
**Expected**: No layout issues from border changes

**Verification Steps:**
- [ ] Cards maintain consistent spacing in grid
- [ ] Thicker borders (4px) do not cause alignment issues
- [ ] Cards do not overflow container
- [ ] Grid layout remains intact
- [ ] No horizontal scrolling on desktop
- [ ] Hover effects work correctly (shadow-xl, scale-[1.02])

**Responsive Test:**
- [ ] Test on mobile viewport (< 640px)
- [ ] Test on tablet viewport (640-1024px)
- [ ] Test on desktop viewport (> 1024px)
- [ ] Verify layout works at all breakpoints

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 9. Interaction Testing
**Expected**: All interactive elements work correctly

**Verification Steps:**
- [ ] Click on pending card navigates to tab detail page
- [ ] Hover effect works (shadow increases, slight scale)
- [ ] Cursor changes to pointer on hover
- [ ] No console errors when interacting with cards
- [ ] Transition animations are smooth

**✅ PASS** / **❌ FAIL**: _______

---

### ✅ 10. Accessibility Testing
**Expected**: Screen reader support and keyboard navigation

**Verification Steps:**

#### Screen Reader Test (Optional)
- [ ] Enable screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Navigate to pending card
- [ ] Verify "Pending orders" is announced when icon is focused
- [ ] Verify card content is properly announced

#### Keyboard Navigation
- [ ] Tab through cards using keyboard
- [ ] Verify pending cards are focusable
- [ ] Verify focus indicator is visible
- [ ] Verify Enter/Space activates card

**✅ PASS** / **❌ FAIL**: _______

---

## Summary Results

### Overall Status
- **Total Checks**: 10 major categories
- **Passed**: _____ / 10
- **Failed**: _____ / 10

### Critical Issues Found
List any critical issues that prevent task completion:
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Minor Issues Found
List any minor issues or improvements:
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Screenshots Captured
- [ ] Pending card at 100% brightness
- [ ] Pending card vs normal card comparison
- [ ] Icon indicator close-up
- [ ] Full dashboard view with multiple cards

## Decision

Based on the verification results:

- [ ] **✅ APPROVE**: All checks passed, ready to mark task 2.5 as complete
- [ ] **⚠️ MINOR ISSUES**: Some minor issues found, but acceptable to proceed
- [ ] **❌ REJECT**: Critical issues found, need to fix before proceeding

## Next Steps

If approved:
1. Mark task 2.5 as complete
2. Proceed to task 3.1: Visual verification checklist
3. Prepare for checkpoint review

If rejected:
1. Document specific issues
2. Create fix tasks
3. Re-run verification after fixes

## Notes

Add any additional observations or comments:

_______________________________________
_______________________________________
_______________________________________

---

## Implementation Reference

### Code Location
- **File**: `apps/staff/app/page.tsx`
- **Lines**: 1175-1260 (approximate)

### Key Changes Implemented
1. **Task 2.2**: Background changed from dark red to light amber
2. **Task 2.3**: All text colors changed from light to dark
3. **Task 2.4**: AlertCircle icon added to top-right corner

### Expected Visual Appearance
```
┌─────────────────────────────────────┐
│ 🔔 (icon)                           │ ← AlertCircle icon (top-right)
│                                     │
│ Tab #123                            │ ← Dark gray text
│ Table 5                             │ ← Dark gray text
│ Opened 5 minutes ago                │ ← Medium gray text
│                                     │
│ ┌─────────────────────────────┐   │
│ │     KES 1,500.00            │   │ ← Dark amber text
│ │     Balance                 │   │ ← Medium gray text
│ └─────────────────────────────┘   │ ← Light amber background
│                                     │
│ 3 orders          2 pending        │ ← Dark gray / dark amber text
└─────────────────────────────────────┘
  ↑ Light amber background (amber-50 to amber-100)
  ↑ Thick amber border (4px, amber-700)
  ↑ Pulse animation
```

