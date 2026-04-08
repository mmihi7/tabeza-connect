# ClawPDF Registry Keys Documentation

**Research Date:** 2026-03-07  
**ClawPDF Version:** 0.9.3  
**Purpose:** Document registry structure for silent operation configuration

---

## Registry Root Location

ClawPDF stores all user-specific settings in the Windows Registry under:

```
HKEY_CURRENT_USER\Software\clawSoft\clawPDF
```

**Note:** Settings are stored per-user (HKCU). For system-wide deployment (Terminal Server, RDS, services running under different accounts), the registry keys must be copied to `HKEY_USERS\.DEFAULT\Software\clawSoft\clawPDF`.

---

## Registry Structure Overview

```
HKCU\Software\clawSoft\clawPDF\
├── Settings\
│   ├── ApplicationSettings\
│   │   ├── PrinterMappings\
│   │   ├── TitleReplacement\
│   │   └── [various application-level settings]
│   └── ConversionProfiles\
│       ├── 0\                    (Default profile)
│       │   ├── Guid
│       │   ├── Name
│       │   ├── OutputFormat
│       │   ├── OpenViewer
│       │   ├── AutoSave\
│       │   │   ├── Enabled
│       │   │   ├── TargetDirectory
│       │   │   ├── Filename
│       │   │   └── EnsureUniqueFilenames
│       │   ├── PdfSettings\
│       │   ├── JpegSettings\
│       │   ├── PngSettings\
│       │   └── [other format settings]
│       ├── 1\                    (Additional profiles)
│       └── [n]\
└── [version and metadata keys]
```

---

## Key Registry Paths and Values

### 1. Application Settings

**Base Path:** `HKCU\Software\clawSoft\clawPDF\Settings\ApplicationSettings`

These control global application behavior.

| Key Name | Type | Purpose | Example Value |
|----------|------|---------|---------------|
| `UpdateInterval` | DWORD | Update check frequency (days) | `7` |
| `Language` | String | UI language code | `en` |
| `LoggingLevel` | String | Logging verbosity | `Error`, `Warn`, `Info` |

### 2. Conversion Profiles

**Base Path:** `HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\[ProfileNumber]`

Each profile is numbered starting from 0 (default profile). The profile number is used as a subkey.

#### Profile Identification

| Key Name | Type | Purpose | Example Value |
|----------|------|---------|---------------|
| `Guid` | String | Unique profile identifier (used in command line) | `f81ea998-3a76-4104-a574-9a66d6f3039b` |
| `Name` | String | User-friendly profile name | `Default Profile` |

#### Output Format Settings

| Key Name | Type | Purpose | Possible Values |
|----------|------|---------|-----------------|
| `OutputFormat` | String | Output file format | `Pdf`, `PdfA1b`, `PdfA2b`, `PdfA3b`, `PdfX`, `Jpeg`, `Png`, `Tif`, `Txt`, `PdfImage`, `Svg` |

**For Tabeza Connect:** We need `OutputFormat = Pdf` or raw PostScript output.

#### Viewer Control

| Key Name | Type | Purpose | Values |
|----------|------|---------|--------|
| `OpenViewer` | DWORD | Open file after conversion | `0` = disabled (silent), `1` = enabled |

**Critical for Silent Operation:** Must be set to `0` to prevent PDF viewer from opening.

#### Auto-Save Settings

**Base Path:** `HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\[ProfileNumber]\AutoSave`

| Key Name | Type | Purpose | Example Value |
|----------|------|---------|---------------|
| `Enabled` | DWORD | Enable automatic saving | `1` = enabled, `0` = disabled |
| `TargetDirectory` | String | Output folder path | `C:\TabezaPrints\spool\` |
| `Filename` | String | Output filename pattern (supports tokens) | `<DateTime>_<JobID>` |
| `EnsureUniqueFilenames` | DWORD | Prevent filename collisions | `1` = enabled, `0` = disabled |

**Filename Tokens:**
- `<DateTime>` - Current date/time
- `<JobID>` - Print job ID
- `<PrinterName>` - Name of the printer
- `<Title>` - Document title
- `<Author>` - Document author
- `<ClientComputer>` - Client computer name

**For Tabeza Connect:**
```
Enabled = 1
TargetDirectory = C:\TabezaPrints\spool\
Filename = <DateTime>_<JobID>
EnsureUniqueFilenames = 1
```

#### PDF-Specific Settings

**Base Path:** `HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\[ProfileNumber]\PdfSettings`

| Key Name | Type | Purpose | Values |
|----------|------|---------|--------|
| `CompressColorAndGray` | DWORD | Compress images | `0` = no compression, `1` = compress |
| `Security\Enabled` | DWORD | Enable password protection | `0` = disabled, `1` = enabled |
| `Security\EncryptionLevel` | String | Encryption strength | `Aes128Bit`, `Aes256Bit` |

**For Tabeza Connect:** We want minimal processing, so compression should be disabled for speed.

### 3. Printer Mappings

**Base Path:** `HKCU\Software\clawSoft\clawPDF\Settings\ApplicationSettings\PrinterMappings`

Maps physical printer names to conversion profiles.

| Key Name | Type | Purpose | Example Value |
|----------|------|---------|---------------|
| `[PrinterName]` | String | Profile GUID for this printer | `f81ea998-3a76-4104-a574-9a66d6f3039b` |

**Example:**
```
PrinterMappings\
  └── Tabeza Agent = f81ea998-3a76-4104-a574-9a66d6f3039b
```

---

## Critical Keys for Silent Operation

For Tabeza Connect's use case (silent capture to spool folder), these are the **essential registry keys** that must be configured:

### Profile 0 (Default Profile)

```
HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\0\
  OutputFormat = "Pdf"                                    (REG_SZ)
  OpenViewer = 0                                          (REG_DWORD)
  
  AutoSave\
    Enabled = 1                                           (REG_DWORD)
    TargetDirectory = "C:\TabezaPrints\spool\"           (REG_SZ)
    Filename = "<DateTime>_<JobID>"                       (REG_SZ)
    EnsureUniqueFilenames = 1                             (REG_DWORD)
```

### Printer Mapping

```
HKCU\Software\clawSoft\clawPDF\Settings\ApplicationSettings\PrinterMappings\
  Tabeza Agent = [Profile 0 GUID]                  (REG_SZ)
```

---

## PowerShell Configuration Script

Based on the research, here's how to configure these keys via PowerShell:

```powershell
# Set registry path
$regPath = "HKCU:\Software\clawSoft\clawPDF\Settings\ConversionProfiles\0"

# Ensure path exists
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}

# Configure output format
Set-ItemProperty -Path $regPath -Name "OutputFormat" -Value "Pdf" -Type String

# Disable viewer (silent operation)
Set-ItemProperty -Path $regPath -Name "OpenViewer" -Value 0 -Type DWord

# Configure AutoSave
$autoSavePath = "$regPath\AutoSave"
if (-not (Test-Path $autoSavePath)) {
    New-Item -Path $autoSavePath -Force | Out-Null
}

Set-ItemProperty -Path $autoSavePath -Name "Enabled" -Value 1 -Type DWord
Set-ItemProperty -Path $autoSavePath -Name "TargetDirectory" -Value "C:\TabezaPrints\spool\" -Type String
Set-ItemProperty -Path $autoSavePath -Name "Filename" -Value "<DateTime>_<JobID>" -Type String
Set-ItemProperty -Path $autoSavePath -Name "EnsureUniqueFilenames" -Value 1 -Type DWord
```

---

## Deployment for All Users (System-Wide)

For Terminal Server, RDS, or services running under different accounts:

1. **Export the configured registry keys:**
   ```powershell
   reg export "HKCU\Software\clawSoft" "C:\Temp\clawpdf-config.reg"
   ```

2. **Modify the exported .reg file:**
   - Open in text editor
   - Find and replace: `[HKEY_CURRENT_USER\Software` → `[HKEY_USERS\.DEFAULT\Software`

3. **Import to .DEFAULT user:**
   ```powershell
   reg import "C:\Temp\clawpdf-config-default.reg"
   ```

This makes the configuration available to all users and system services.

---

## Registry Behavior Notes

### Dynamic Registry Manipulation

Research (Issue #57 on GitHub) indicates that clawPDF.exe performs registry operations during print job processing:
- Reads settings from registry
- May delete and recreate keys during migration from old versions
- Writes temporary job information

**Implication:** Registry keys should be set **before** the first print job, and should not be modified while clawPDF is processing a job.

### Profile GUID Location

The profile GUID (used in command-line operations) is stored at:
```
HKCU\Software\clawSoft\clawPDF\Settings\ConversionProfiles\[ProfileNumber]\Guid
```

This GUID can be used with the `/profile` parameter:
```cmd
clawPDF.exe /PrintFile=D:\example.pdf /profile=f81ea998-3a76-4104-a574-9a66d6f3039b
```

---

## Verification Script

To verify the configuration is correct:

```powershell
function Test-ClawPDFConfig {
    $regPath = "HKCU:\Software\clawSoft\clawPDF\Settings\ConversionProfiles\0"
    
    $checks = @{
        "OutputFormat" = "Pdf"
        "OpenViewer" = 0
    }
    
    $autoSaveChecks = @{
        "Enabled" = 1
        "TargetDirectory" = "C:\TabezaPrints\spool\"
        "EnsureUniqueFilenames" = 1
    }
    
    $allPassed = $true
    
    # Check main settings
    foreach ($key in $checks.Keys) {
        $value = Get-ItemProperty -Path $regPath -Name $key -ErrorAction SilentlyContinue
        if ($value.$key -ne $checks[$key]) {
            Write-Warning "❌ $key is not set correctly"
            $allPassed = $false
        } else {
            Write-Host "✓ $key is configured correctly" -ForegroundColor Green
        }
    }
    
    # Check AutoSave settings
    $autoSavePath = "$regPath\AutoSave"
    foreach ($key in $autoSaveChecks.Keys) {
        $value = Get-ItemProperty -Path $autoSavePath -Name $key -ErrorAction SilentlyContinue
        if ($value.$key -ne $autoSaveChecks[$key]) {
            Write-Warning "❌ AutoSave\$key is not set correctly"
            $allPassed = $false
        } else {
            Write-Host "✓ AutoSave\$key is configured correctly" -ForegroundColor Green
        }
    }
    
    return $allPassed
}

# Run verification
if (Test-ClawPDFConfig) {
    Write-Host "`n✅ ClawPDF configuration is correct for Tabeza Connect" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ ClawPDF configuration needs adjustment" -ForegroundColor Yellow
}
```

---

## References

- [ClawPDF GitHub Repository](https://github.com/clawsoftware/clawPDF)
- [Silent Print in Auto Mode Guide](https://dorion.nl/silent-print-in-auto-mode-clawpdf/)
- [ClawPDF Issue #25 - OpenViewer Setting](https://github.com/clawsoftware/clawPDF/issues/25)
- [ClawPDF Issue #57 - Registry Behavior](https://github.com/clawsoftware/clawPDF/issues/57)
- [ClawPDF Issue #6 - Prevent PDF Popup](https://github.com/clawsoftware/clawPDF/issues/6)

---

## Next Steps

1. ✅ Registry structure documented
2. ⏭️ Integrate registry configuration into `configure-clawpdf.ps1` script
3. ⏭️ Test configuration on Windows 10 and Windows 11
4. ⏭️ Add registry cleanup to uninstaller
5. ⏭️ Verify registry persistence across reboots

---

**Document Status:** Complete  
**Last Updated:** 2026-03-07  
**Maintained By:** Tabeza Development Team
