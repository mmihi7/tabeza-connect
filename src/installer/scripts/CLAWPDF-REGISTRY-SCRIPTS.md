# ClawPDF Registry Configuration Scripts

This directory contains PowerShell scripts for configuring clawPDF registry settings for silent operation with Tabeza Connect.

## Scripts Overview

### 1. `set-clawpdf-registry.ps1`
**Purpose:** Configures all clawPDF registry keys for silent operation

**What it does:**
- Creates complete registry structure under `HKCU:\Software\clawSoft\clawPDF`
- Configures profile identification (GUID, name)
- Sets output format to PDF
- **Disables all UI prompts** (OpenViewer, ShowQuickActions, ShowProgress, OpenFile)
- Enables AutoSave with spool folder configuration
- Sets filename pattern with tokens (`<DateTime>_<JobID>`)
- Optimizes PDF settings for performance
- Configures application settings (logging, updates, language)
- Maps printer name to profile GUID

**Usage:**
```powershell
# Basic usage (uses defaults)
.\set-clawpdf-registry.ps1

# Custom spool folder and printer name
.\set-clawpdf-registry.ps1 -SpoolFolder "D:\Prints\spool" -PrinterName "My Printer"

# Specify profile number (default is 0)
.\set-clawpdf-registry.ps1 -ProfileNumber 1

# Custom log path
.\set-clawpdf-registry.ps1 -LogPath "C:\Logs\clawpdf-config.log"
```

**Parameters:**
- `SpoolFolder` (string) - Output directory for captured files (default: `C:\TabezaPrints\spool`)
- `PrinterName` (string) - Name of the clawPDF printer (default: `Tabeza POS Printer`)
- `ProfileNumber` (int) - Profile number to configure (default: `0`)
- `LogPath` (string) - Path to log file (default: `$env:TEMP\TabezaConnect-clawPDF-registry.log`)

**Returns:**
- Exit code `0` on success, `1` on failure
- Outputs profile GUID to stdout (can be captured by calling scripts)

**Example with output capture:**
```powershell
$profileGuid = .\set-clawpdf-registry.ps1 -SpoolFolder "C:\TabezaPrints\spool"
Write-Host "Profile GUID: $profileGuid"
```

---

### 2. `verify-clawpdf-registry.ps1`
**Purpose:** Verifies that clawPDF registry configuration is correct

**What it checks:**
- Registry structure exists
- Profile identification (GUID, name)
- Output format is PDF
- **All silent operation settings are disabled** (critical for no UI prompts)
- AutoSave is enabled with correct settings
- PDF settings are optimized
- Application settings are correct
- Printer mapping exists

**Usage:**
```powershell
# Basic verification
.\verify-clawpdf-registry.ps1

# Verbose output (shows registry paths and values)
.\verify-clawpdf-registry.ps1 -Verbose

# Custom spool folder and printer name
.\verify-clawpdf-registry.ps1 -SpoolFolder "D:\Prints\spool" -PrinterName "My Printer"
```

**Parameters:**
- `SpoolFolder` (string) - Expected spool folder path (default: `C:\TabezaPrints\spool`)
- `PrinterName` (string) - Expected printer name (default: `Tabeza POS Printer`)
- `ProfileNumber` (int) - Profile number to verify (default: `0`)
- `Verbose` (switch) - Show detailed registry paths and values

**Returns:**
- Exit code `0` if all checks pass
- Exit code `1` if any check fails

**Example in automation:**
```powershell
.\verify-clawpdf-registry.ps1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Configuration verified successfully"
} else {
    Write-Host "Configuration verification failed"
    exit 1
}
```

---

### 3. `configure-clawpdf.ps1`
**Purpose:** Main configuration script that orchestrates clawPDF setup

**What it does:**
- Checks if clawPDF is installed
- Creates spool folder with proper permissions
- Calls `set-clawpdf-registry.ps1` for registry configuration
- Falls back to basic registry configuration if script not found
- Creates clawPDF settings INI file (legacy support)

**Usage:**
```powershell
# Basic usage
.\configure-clawpdf.ps1

# Custom parameters
.\configure-clawpdf.ps1 -PrinterName "My Printer" -SpoolFolder "D:\Prints\spool"
```

**Parameters:**
- `PrinterName` (string) - Name of the clawPDF printer (default: `Tabeza POS Printer`)
- `SpoolFolder` (string) - Output directory (default: `C:\TabezaPrints\spool`)
- `LogPath` (string) - Path to log file (default: `$env:TEMP\TabezaConnect-clawPDF-config.log`)

---

## Registry Keys Configured

### Critical Keys for Silent Operation

These keys **MUST** be set to `0` (disabled) for silent operation:

```
HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\0\
  OpenViewer = 0           (DWORD) - Prevents PDF viewer from opening
  ShowQuickActions = 0     (DWORD) - Disables quick actions dialog
  ShowProgress = 0         (DWORD) - Disables progress window
  OpenFile = 0             (DWORD) - Disables "open file after saving"
```

### AutoSave Configuration

```
HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\0\AutoSave\
  Enabled = 1                                    (DWORD)
  TargetDirectory = "C:\TabezaPrints\spool\"    (REG_SZ)
  Filename = "<DateTime>_<JobID>"                (REG_SZ)
  EnsureUniqueFilenames = 1                      (DWORD)
```

### Profile Settings

```
HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\0\
  Guid = "[generated-guid]"                      (REG_SZ)
  Name = "Tabeza POS Printer Profile"           (REG_SZ)
  OutputFormat = "Pdf"                           (REG_SZ)
```

### Printer Mapping

```
HKCU\Software\clawSoft\clawPDF\Settings\ApplicationSettings\PrinterMappings\
  Tabeza POS Printer = "[profile-guid]"         (REG_SZ)
```

---

## Workflow

### Initial Setup

1. Install clawPDF MSI
2. Run `configure-clawpdf.ps1` (calls `set-clawpdf-registry.ps1` internally)
3. Run `verify-clawpdf-registry.ps1` to confirm configuration
4. Test print to verify silent operation

### Verification After Installation

```powershell
# Run verification
.\verify-clawpdf-registry.ps1 -Verbose

# If verification fails, reconfigure
if ($LASTEXITCODE -ne 0) {
    .\set-clawpdf-registry.ps1
    .\verify-clawpdf-registry.ps1
}
```

### Troubleshooting

If silent operation is not working (PDF viewer opens):

1. **Check registry settings:**
   ```powershell
   .\verify-clawpdf-registry.ps1 -Verbose
   ```

2. **Reconfigure registry:**
   ```powershell
   .\set-clawpdf-registry.ps1
   ```

3. **Restart clawPDF service:**
   ```powershell
   Restart-Service -Name "clawPDF" -Force
   ```

4. **Test print:**
   ```powershell
   # Print test file to clawPDF printer
   notepad /p "test.txt"
   ```

5. **Check spool folder:**
   ```powershell
   Get-ChildItem "C:\TabezaPrints\spool\"
   ```

---

## Integration with Inno Setup

### Example Inno Setup Script

```pascal
[Run]
; Configure clawPDF registry for silent operation
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\set-clawpdf-registry.ps1"" -SpoolFolder ""C:\TabezaPrints\spool"" -PrinterName ""Tabeza POS Printer"""; \
  StatusMsg: "Configuring clawPDF for silent operation..."; \
  Flags: runhidden waituntilterminated

; Verify configuration
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\verify-clawpdf-registry.ps1"""; \
  StatusMsg: "Verifying clawPDF configuration..."; \
  Flags: runhidden waituntilterminated
```

---

## System-Wide Deployment (Multi-User)

For Terminal Server, RDS, or services running under different accounts:

1. **Configure for current user:**
   ```powershell
   .\set-clawpdf-registry.ps1
   ```

2. **Export registry keys:**
   ```powershell
   reg export "HKCU\Software\clawSoft" "C:\Temp\clawpdf-config.reg"
   ```

3. **Modify for .DEFAULT user:**
   ```powershell
   # Open in text editor and replace:
   # [HKEY_CURRENT_USER\Software
   # with:
   # [HKEY_USERS\.DEFAULT\Software
   ```

4. **Import to .DEFAULT:**
   ```powershell
   reg import "C:\Temp\clawpdf-config-default.reg"
   ```

---

## Testing

### Manual Test

1. Configure registry:
   ```powershell
   .\set-clawpdf-registry.ps1
   ```

2. Print test file:
   ```powershell
   # Create test file
   "Test print job" | Out-File "C:\Temp\test.txt"
   
   # Print to clawPDF printer
   Get-Content "C:\Temp\test.txt" | Out-Printer -Name "Tabeza POS Printer"
   ```

3. Verify output:
   ```powershell
   # Check spool folder
   Get-ChildItem "C:\TabezaPrints\spool\"
   
   # Should see file like: 20260307-143022_abc123.pdf
   # PDF viewer should NOT open (silent operation)
   ```

### Automated Test

```powershell
# Configure
.\set-clawpdf-registry.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Configuration failed"
    exit 1
}

# Verify
.\verify-clawpdf-registry.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Verification failed"
    exit 1
}

Write-Host "✅ ClawPDF configured and verified successfully"
```

---

## References

- [ClawPDF GitHub Repository](https://github.com/clawsoftware/clawPDF)
- [CLAWPDF-REGISTRY-KEYS.md](./CLAWPDF-REGISTRY-KEYS.md) - Complete registry documentation
- [Silent Print in Auto Mode Guide](https://dorion.nl/silent-print-in-auto-mode-clawpdf/)

---

## Changelog

### 2026-03-07
- Created `set-clawpdf-registry.ps1` - Complete registry configuration script
- Created `verify-clawpdf-registry.ps1` - Registry verification script
- Updated `configure-clawpdf.ps1` - Integrated registry configuration
- Documented all scripts and workflows

---

**Maintained By:** Tabeza Development Team  
**Last Updated:** 2026-03-07
