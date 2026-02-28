# Task 4 Verification Guide: Overdue Tab Card Styling

## Quick Start

```bash
# Start the staff development server
pnpm dev:staff

# Navigate to: http://localhost:3003
```

## What to Look For

### 1. Overdue Card Visual Appearance

**Expected Styling**:
- **Background**: Very light red (almost white with subtle red tint)
- **Border**: Thick 4px dark red border (much thicker than normal cards)
- **Ring**: Subtle red glow effect around the border
- **Icon**: Red triangle with exclamation mark (AlertTriangle) in top-right corner
- **Animation**: Gentle pulsing effect (entire card pulses)

**Color Palette**:
- Background: `from-red-50 to-red-100` (very light red gradient)
- Border: `border-red-700` (dark red)
- Ring: `ring-red-400/50` (medium red with 50% opacity)
- Icon: `text-red-900` (very dark red)

### 2. Text Contrast Verification

All text on overdue cards should be **dark on light background**:

| Element | Expected Color | Contrast |
|---------|---------------|----------|
| Card Title | `text-gray-900` | Very dark gray |
| Table Number | `text-gray-900` | Very dark gray |
| Timestamp | `text-gray-700` | Medium dark gray |
| Balance Amount | `text-red-900` | Very dark red |
| Balance Label | `text-gray-700` | Medium dark gray |
| Footer Text | `text-gray-800` | Dark gray |
| Pending Count | `text-red-900` | Very dark red |

### 3. Visual Distinction Test

Compare three card types side-by-side:

| Card Type | Background | Border | Icon | Animation |
|-----------|------------|--------|------|-----------|
| **Normal** | White → Orange-50 | 2px Orange-500 | None | None |
| **Pending** | Amber-50 → Amber-100 | 4px Amber-700 | AlertCircle (amber) | Pulse |
| **Overdue** | Red-50 → Red-100 | 4px Red-700 | AlertTriangle (red) | Pulse |

**Key Differences**:
- Overdue uses **red** color scheme (vs amber for pending)
- Overdue shows **AlertTriangle** icon (vs AlertCircle for pending)
- Both pending and overdue have **4px borders** (vs 2px for normal)
- Both pending and overdue have **pulse animation**

### 4. Icon Indicator Verification

**Overdue Icon**:
- ✅ AlertTriangle icon (triangle with exclamation mark)
- ✅ Positioned in top-right corner (absolute top-2 right-2)
- ✅ Dark red color (text-red-900)
- ✅ Size: 24x24px (w-6 h-6)
- ✅ Screen reader text: "Overdue tab"

**Priority Logic**:
- If tab is overdue → Show AlertTriangle (red)
- Else if tab has pending orders → Show AlertCircle (amber)
- Else → No icon

### 5. Hover Effects

When hovering over an overdue card:
- ✅ Shadow increases: `shadow-lg` → `shadow-xl`
- ✅ Card scales up slightly: `scale-[1.02]`
- ✅ Smooth transition (200ms duration)
- ✅ Cursor changes to pointer

### 6. High Brightness Testing

**Critical Test**: View at 100% screen brightness

1. Increase screen brightness to maximum
2. View dashboard in bright room or near window
3. Verify:
   - ✅ Overdue cards are clearly visible
   - ✅ Red border stands out strongly
   - ✅ Text is easily readable
   - ✅ Icon is clearly visible
   - ✅ Visual distinction from pending cards is obvious

**Optional**: Test outdoors in sunlight if possible

### 7. Animation Testing

**Pulse Animation**:
- ✅ Card gently pulses (opacity/scale changes)
- ✅ Animation is smooth and not jarring
- ✅ Animation respects prefers-reduced-motion

**Test Reduced Motion**:
1. Open Chrome DevTools
2. Press Cmd/Ctrl + Shift + P
3. Type "Emulate CSS prefers-reduced-motion"
4. Select "prefers-reduced-motion: reduce"
5. Verify pulse animation stops or becomes minimal

### 8. Accessibility Testing

**Screen Reader Test**:
1. Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. Navigate to overdue card
3. Verify screen reader announces: "Overdue tab"

**Keyboard Navigation**:
1. Tab through cards using keyboard
2. Verify overdue cards are focusable
3. Verify focus indicator is visible
4. Press Enter to open tab details

### 9. Responsive Testing

Test at different viewport sizes:

**Mobile (< 640px)**:
- ✅ Cards stack in single column
- ✅ Styling remains consistent
- ✅ Icon remains visible
- ✅ Text remains readable

**Tablet (640px - 1024px)**:
- ✅ Cards display in 2 columns
- ✅ All styling preserved

**Desktop (> 1024px)**:
- ✅ Cards display in 3-4 columns
- ✅ All styling preserved

## Common Issues to Check

### Issue 1: Dark Background Instead of Light
**Problem**: Overdue cards have dark red background
**Expected**: Very light red background (almost white)
**Fix**: Verify using `from-red-50 to-red-100` (not red-900/800)

### Issue 2: Text Not Readable
**Problem**: Text is too light or blends with background
**Expected**: All text should be dark (gray-900, gray-800, red-900)
**Fix**: Verify all text classes use dark colors

### Issue 3: No Visual Distinction from Pending
**Problem**: Can't tell overdue from pending cards
**Expected**: Red vs amber color scheme, different icons
**Fix**: Verify color classes and icon components

### Issue 4: Icon Not Showing
**Problem**: AlertTriangle icon doesn't appear
**Expected**: Red triangle icon in top-right corner
**Fix**: Verify `isOverdue` condition and icon import

### Issue 5: Animation Too Aggressive
**Problem**: Pulse animation is distracting
**Expected**: Subtle, gentle pulsing
**Fix**: Verify using Tailwind's `animate-pulse` (not custom animation)

## Test Scenarios

### Scenario 1: Single Overdue Tab
1. Create a tab
2. Wait for it to become overdue (or manually set status)
3. Verify all styling is correct
4. Compare with normal tabs

### Scenario 2: Mixed Tab States
1. Have normal, pending, and overdue tabs on screen
2. Verify clear visual hierarchy
3. Verify each state is distinguishable
4. Test at high brightness

### Scenario 3: Overdue Tab with Pending Orders
1. Create overdue tab with pending orders
2. Verify overdue styling takes priority
3. Verify AlertTriangle shows (not AlertCircle)
4. Verify pending count still displays

### Scenario 4: Overdue Tab Fully Paid
1. Create overdue tab
2. Add payment to cover full balance
3. Verify "PAID" sticker appears
4. Verify overdue styling remains
5. Verify both indicators are visible

## Success Criteria

All of the following must be true:

- ✅ Overdue cards have light red background (visible in bright conditions)
- ✅ All text is dark and easily readable
- ✅ AlertTriangle icon appears in top-right corner
- ✅ Visual distinction from pending cards is clear (red vs amber)
- ✅ Pulse animation works smoothly
- ✅ Hover effects work correctly
- ✅ Cards are visible at 100% screen brightness
- ✅ Accessibility features work (screen reader, keyboard nav)
- ✅ Responsive design works at all breakpoints
- ✅ No TypeScript or console errors

## Reporting Issues

If any issues are found:

1. Take screenshots showing the problem
2. Note the browser and OS version
3. Note the screen brightness level
4. Describe expected vs actual behavior
5. Check browser console for errors

## Next Steps After Verification

Once all checks pass:
1. ✅ Mark task 4.5 as complete
2. ✅ Update task 4 parent task as complete
3. ✅ Proceed to task 5 (Accessibility enhancements)
4. ✅ Consider creating before/after screenshots for documentation
