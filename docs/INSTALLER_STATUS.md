# TabezaConnect Installer Status - February 20, 2026

## Current Situation

### Available Installers

1. **v1.3.0** (16:54) - 12,768,156 bytes
   - ✅ Works correctly
   - ✅ Has terms acceptance checkbox
   - ❌ No scroll-to-enable behavior
   - ❌ Abbreviated terms (not full text from file)
   - ❌ No terms acceptance logging
   - ❌ Page may open scrolled to bottom

2. **v1.4.0** (17:25) - 12,772,154 bytes
   - ⚠️ Built successfully but needs testing
   - ⚠️ Scroll behavior implementation uncertain
   - ⚠️ May have issues with scroll detection

## Issues Encountered

### Problem 1: Page Opens at Bottom
The terms page opens with the scroll position at the bottom, meaning users see the end of the terms first instead of the beginning.

**Root Cause**: `TRichEditViewer` in Inno Setup may default to bottom position when content is loaded.

**Solution Attempted**: Use `SendMessage` with `WM_VSCROLL` and `SB_TOP` to force scroll to top.

### Problem 2: Scroll Detection Not Working
The checkbox doesn't enable when user scrolls to bottom.

**Root Cause**: `TRichEditViewer.OnChange` event doesn't fire for scrolling. Need to use Windows API `GetScrollInfo` with a timer.

**Solution Attempted**: Implement timer-based scroll position checking using `GetScrollInfo` API.

### Problem 3: File Reverted
The installer-pkg-v1.4.0.iss file appears to have been reverted to an older version, losing the scroll detection code.

## Recommendations

### Option 1: Test v1.4.0 Installer (RECOMMENDED)
The v1.4.0 installer at `dist/TabezaConnect-Setup-v1.4.0.exe` was successfully built. We should:
1. Test it on a clean Windows VM
2. Verify if scroll behavior works
3. Check if terms display correctly
4. Confirm checkbox enables after scrolling

### Option 2: Use v1.3.0 with Manual Review
Accept that v1.3.0 works but requires users to manually read terms:
- Checkbox is always enabled
- Users can check it without scrolling
- Relies on user honesty to read terms
- Still legally binding

### Option 3: Simplify Terms Acceptance
Instead of scroll-to-enable, use a simpler approach:
- Display abbreviated terms in installer
- Add prominent link to full terms at https://tabeza.co.ke/terms
- Require checkbox to proceed
- Log acceptance with timestamp

## Privacy Policy Importance

**CRITICAL**: The privacy policy is especially important for TabezaConnect because:
- Captures receipt data from POS systems
- Transmits data to Tabeza cloud
- Collects venue identifiers and transaction metadata
- Users MUST understand what data is collected and how it's used

The full terms in `src/installer/TERMS_AND_PRIVACY.txt` include comprehensive privacy information:
- Section 4: DATA COLLECTION AND PRIVACY
- What we collect vs. what we don't collect
- How data is used, stored, and shared
- Data retention policies
- User rights regarding their data

## Next Steps

1. **Immediate**: Test the v1.4.0 installer (17:25 build)
2. **If v1.4.0 works**: Deploy it
3. **If v1.4.0 fails**: Decide between Option 2 or Option 3 above
4. **Document**: Whatever solution is chosen, document it clearly for users

## Technical Notes

### Scroll Detection Implementation (for future reference)
To properly implement scroll-to-enable in Inno Setup:

```pascal
[Code]
const
  WM_VSCROLL = $0115;
  SB_TOP = 6;
  SB_VERT = 1;
  SIF_RANGE = $0001;
  SIF_PAGE = $0002;
  SIF_POS = $0004;

type
  TScrollInfo = record
    cbSize: UINT;
    fMask: UINT;
    nMin: Integer;
    nMax: Integer;
    nPage: UINT;
    nPos: Integer;
    nTrackPos: Integer;
  end;

function GetScrollInfo(hWnd: HWND; nBar: Integer; var lpsi: TScrollInfo): BOOL;
  external 'GetScrollInfo@user32.dll stdcall';

function SendMessage(hWnd: HWND; Msg: UINT; wParam: Longint; lParam: Longint): Longint;
  external 'SendMessageW@user32.dll stdcall';

var
  ScrollCheckTimer: TTimer;
  HasScrolledToBottom: Boolean;

procedure CheckScrollPosition(Sender: TObject);
var
  ScrollInfo: TScrollInfo;
begin
  if HasScrolledToBottom then Exit;
  
  ScrollInfo.cbSize := SizeOf(ScrollInfo);
  ScrollInfo.fMask := SIF_RANGE or SIF_PAGE or SIF_POS;
  
  if GetScrollInfo(TermsMemo.Handle, SB_VERT, ScrollInfo) then
  begin
    if (ScrollInfo.nPos + Integer(ScrollInfo.nPage) >= ScrollInfo.nMax - 5) then
    begin
      HasScrolledToBottom := True;
      AcceptCheckbox.Enabled := True;
      ScrollHintLabel.Visible := False;
      ScrollCheckTimer.Enabled := False;
    end;
  end;
end;

procedure InitializeWizard;
begin
  // Create terms page
  // Load terms
  // Scroll to top
  SendMessage(TermsMemo.Handle, WM_VSCROLL, SB_TOP, 0);
  
  // Create timer
  ScrollCheckTimer := TTimer.Create(TermsPage);
  ScrollCheckTimer.Interval := 200;
  ScrollCheckTimer.OnTimer := @CheckScrollPosition;
  ScrollCheckTimer.Enabled := True;
end;
```

## Files

- `installer-pkg.iss` - v1.3.0 (working, no scroll-to-enable)
- `installer-pkg-v1.4.0.iss` - v1.4.0 (has issues, needs fixing)
- `dist/TabezaConnect-Setup-v1.3.0.exe` - Working installer
- `dist/TabezaConnect-Setup-v1.4.0.exe` - Needs testing
- `src/installer/TERMS_AND_PRIVACY.txt` - Full terms (TabezaConnect-specific)

## Contact

For questions about installer implementation:
- Technical: Check Inno Setup documentation
- Privacy: Ensure terms clearly explain data collection
- Legal: Verify terms are legally binding
