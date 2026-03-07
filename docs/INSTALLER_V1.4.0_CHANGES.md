# TabezaConnect Installer v1.4.0 - Complete Rebuild

## Overview
This is a complete rebuild of the TabezaConnect installer addressing ALL previous concerns and requirements.

## Critical Changes from v1.3.0

### 1. ✅ Scroll-to-Enable Terms Acceptance
**Problem**: Previous installer had a simple checkbox that users could click without reading terms.

**Solution**:
- Terms displayed in scrollable `TRichEditViewer` component
- Checkbox is initially **disabled** (grayed out)
- User MUST scroll to the bottom of terms to enable checkbox
- Visual hint label: "Please scroll to the bottom to enable the acceptance checkbox"
- Hint disappears once user scrolls to bottom
- Checkbox remains enabled even if user scrolls back up
- Cannot proceed without both scrolling AND checking the box

**Implementation**:
```pascal
procedure OnTermsScroll(Sender: TObject);
begin
  if (Memo.ScrollTop + Memo.ClientHeight >= Memo.ScrollHeight - 10) then
  begin
    HasScrolledToBottom := True;
    AcceptCheckbox.Enabled := True;
    ScrollHintLabel.Visible := False;
  end;
end;
```

### 2. ✅ Full Terms Text Embedded
**Problem**: Previous installer had abbreviated terms with external link.

**Solution**:
- Full terms loaded from `src/installer/TERMS_AND_PRIVACY.txt`
- Terms are TabezaConnect-specific (not general Tabeza platform terms)
- No internet connection required to view terms
- Terms file is extracted during installation and loaded into memo
- Fallback terms included in script if file not found

**File Reference**:
```pascal
Source: "src\installer\TERMS_AND_PRIVACY.txt"; DestDir: "{app}\docs"; 
```

### 3. ✅ Terms Acceptance Logging
**Problem**: No compliance logging of terms acceptance.

**Solution**:
- Acceptance logged to `C:\ProgramData\Tabeza\logs\terms-acceptance.log`
- Log includes: timestamp, Bar ID, terms version, installer version
- Log created during `ssPostInstall` step
- Format: `[2026-02-20 10:30:00] Bar ID: xxx | Terms v1.0 | Installer v1.4.0 | Accepted`

**Implementation**:
```pascal
procedure LogTermsAcceptance;
var
  LogFile: String;
  Timestamp: String;
begin
  LogFile := ExpandConstant('{commonappdata}\Tabeza\logs\terms-acceptance.log');
  Timestamp := GetDateTimeString('yyyy-mm-dd hh:nn:ss', #0, #0);
  LogContent := Format('[%s] Bar ID: %s | Terms v1.0 | Installer v1.4.0 | Accepted', 
                       [Timestamp, BarId]);
  SaveStringToFile(LogFile, LogContent + #13#10, True);
end;
```

### 4. ✅ Branding Consistency
**User-Facing Names** (with space):
- Application Name: "Tabeza POS Connect"
- Service Display Name: "Tabeza POS Connect Service"  
- Windows Programs List: "Tabeza POS Connect"
- Start Menu: "Tabeza POS Connect"
- Installer Title: "Tabeza POS Connect Setup"

**Technical Names** (no space):
- Executable: `TabezaConnect-Setup-v1.4.0.exe`
- Service Name: `TabezaConnect`
- Install Directory: `C:\Program Files\TabezaConnect`
- Registry Key: `Software\Tabeza\Connect`

### 5. ✅ Admin Rights Handling
- `PrivilegesRequired=admin` - Forces UAC elevation
- `PrivilegesRequiredOverridesAllowed=dialog` - Clear error if declined
- Uses `{autopf}` (Program Files) for installation
- Uses `{tmp}` for temporary files with proper cleanup
- Fallback to `{usertmp}` if system temp is locked

### 6. ✅ Antivirus Compatibility
- Retry logic for file operations (3 attempts with 1-second delay)
- Standard Windows installer patterns
- Proper temp directory handling
- No rapid file operations that trigger AV

### 7. ✅ Bar ID Validation
- Minimum 6 characters
- Alphanumeric + hyphens only
- No spaces allowed
- Clear error messages
- Saved to registry and config.json

## File Structure

```
TabezaConnect/
├── installer-pkg-v1.4.0.iss          ← NEW installer script
├── build-installer-v1.4.0.bat        ← NEW build script
├── TabezaConnect.exe                 ← Compiled service (from build-pkg.bat)
├── src/
│   └── installer/
│       ├── TERMS_AND_PRIVACY.txt     ← Full terms (embedded)
│       └── scripts/
│           ├── create-folders.ps1
│           ├── configure-printer.ps1
│           ├── register-service-pkg.ps1
│           └── verify-installation.ps1
├── Plan/
│   ├── README.txt
│   ├── BEFORE-INSTALL.txt
│   └── AFTER-INSTALL.txt
├── LICENSE.txt
├── icon-green.ico
└── config.template.json
```

## Build Instructions

### Prerequisites
1. Inno Setup 6.x installed at `C:\Program Files (x86)\Inno Setup 6\`
2. `TabezaConnect.exe` compiled (run `build-pkg.bat` first)
3. All required files present (see File Structure above)

### Build Steps
```cmd
cd TabezaConnect
build-installer-v1.4.0.bat
```

### Output
- `dist/TabezaConnect-Setup-v1.4.0.exe` (~45-50 MB)

## Testing Checklist

### Terms Acceptance
- [ ] Terms page displays after welcome screen
- [ ] Terms text is fully visible and scrollable
- [ ] Checkbox is initially disabled (grayed out)
- [ ] Scroll hint label is visible: "Please scroll to the bottom..."
- [ ] Scrolling to bottom enables checkbox
- [ ] Scroll hint disappears when checkbox is enabled
- [ ] Checkbox remains enabled if user scrolls back up
- [ ] Cannot click Next without scrolling to bottom
- [ ] Cannot click Next without checking the checkbox
- [ ] Error message shown if trying to proceed without acceptance

### Bar ID Input
- [ ] Bar ID page displays after terms acceptance
- [ ] Instructions are clear
- [ ] Validation rejects empty input
- [ ] Validation rejects input < 6 characters
- [ ] Validation rejects input with spaces
- [ ] Validation accepts valid alphanumeric + hyphens
- [ ] Bar ID saved to config.json
- [ ] Bar ID saved to registry

### Installation
- [ ] UAC prompt appears (admin rights)
- [ ] Files extracted to `C:\Program Files\TabezaConnect`
- [ ] Folders created in `C:\ProgramData\Tabeza`
- [ ] Service registered as "TabezaConnect"
- [ ] Service display name is "Tabeza POS Connect Service"
- [ ] Service starts automatically
- [ ] Terms acceptance logged to `C:\ProgramData\Tabeza\logs\terms-acceptance.log`

### Branding
- [ ] Installer title shows "Tabeza POS Connect Setup"
- [ ] Windows Programs list shows "Tabeza POS Connect"
- [ ] Start menu shows "Tabeza POS Connect"
- [ ] Service display name is "Tabeza POS Connect Service"
- [ ] Install directory is `C:\Program Files\TabezaConnect` (no space)

### Uninstallation
- [ ] Service stops gracefully
- [ ] Service is deleted
- [ ] Printer removed (optional)
- [ ] Files removed from Program Files
- [ ] Registry keys removed
- [ ] Logs preserved (optional cleanup)

## Comparison with Previous Versions

| Feature | v1.2.0 | v1.3.0 | v1.4.0 |
|---------|--------|--------|--------|
| Scroll-to-enable checkbox | ❌ | ❌ | ✅ |
| Full terms embedded | ❌ | ❌ | ✅ |
| Terms acceptance logging | ❌ | ❌ | ✅ |
| Branding consistency | ❌ | ✅ | ✅ |
| Admin rights handling | ⚠️ | ✅ | ✅ |
| Antivirus compatibility | ⚠️ | ✅ | ✅ |
| Bar ID validation | ✅ | ✅ | ✅ |

## Known Limitations

1. **Unsigned Installer**: Windows SmartScreen will show "Unknown Publisher" warning (acceptable for MVP)
2. **Antivirus Warnings**: Some antivirus software may flag the installer (acceptable for MVP)
3. **Single Language**: English only (multi-language support is future enhancement)
4. **No Silent Mode**: Interactive installation only (silent mode is future enhancement)

## Future Enhancements

1. **Code Signing**: Obtain certificate to eliminate SmartScreen warnings
2. **Auto-Updates**: Check for updates and prompt user
3. **Silent Installation**: Support `/SILENT` flag for IT deployments
4. **Multi-language**: Support additional languages
5. **Telemetry**: Send installation success/failure metrics

## Support

For installation issues:
- Email: support@tabeza.co.ke
- Website: https://tabeza.co.ke/support

For terms/privacy questions:
- Email: privacy@tabeza.co.ke
- Full terms: https://tabeza.co.ke/terms

## Version History

- **v1.4.0** (2026-02-20): Complete rebuild with scroll-to-enable terms, full terms embedded, logging
- **v1.3.0** (2026-02-19): Branding fixes, admin rights improvements
- **v1.2.0** (2026-02-18): Initial PKG version with basic terms
- **v1.1.0** (2026-02-17): NSSM-based installer (deprecated)
- **v1.0.0** (2026-02-16): Initial release (deprecated)
