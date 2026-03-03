# TabezaConnect Technical Names Verification Checklist

## Purpose
This checklist ensures all technical names use "TabezaConnect" (no space) while user-facing names use "Tabeza POS Connect" (with spaces).

## Requirement Reference
**Requirement 3.2**: Technical names must remain "TabezaConnect" (no space)

## Quick Verification

Run the automated verification script:
```powershell
.\verify-technical-names.ps1 -Verbose
```

## Manual Verification Checklist

### ✅ Installer Configuration (`installer.iss`)

#### Technical Names (NO SPACE - "TabezaConnect")

- [ ] **Executable Filename**
  - Location: `OutputBaseFilename`
  - Expected: `TabezaConnect-Setup-v1.3.0.exe`
  - Current: _______________

- [ ] **Installation Directory**
  - Location: `DefaultDirName`
  - Expected: `{autopf}\TabezaConnect`
  - Resolves to: `C:\Program Files\TabezaConnect`
  - Current: _______________

- [ ] **Windows Service Name**
  - Location: `sc.exe` commands
  - Expected: `TabezaConnect`
  - Current: _______________

- [ ] **Registry Keys**
  - Location: `[Registry]` section
  - Expected: `Software\Tabeza\Connect`
  - Current: _______________

- [ ] **Application Data Folders**
  - Location: `[Dirs]` section (if using technical paths)
  - Expected: `TabezaConnect` (if applicable)
  - Current: _______________

#### User-Facing Names (WITH SPACES - "Tabeza POS Connect")

- [ ] **Application Name**
  - Location: `AppName`
  - Expected: `Tabeza POS Connect`
  - Current: _______________

- [ ] **Service Display Name**
  - Location: PowerShell scripts or service configuration
  - Expected: `Tabeza POS Connect Service`
  - Current: _______________

- [ ] **Start Menu Group**
  - Location: `DefaultGroupName`
  - Expected: `Tabeza POS Connect`
  - Current: _______________

- [ ] **Uninstall Display Name**
  - Location: `UninstallDisplayName`
  - Expected: `Tabeza POS Connect`
  - Current: _______________

### ✅ PowerShell Scripts

Check all scripts in `src/installer/scripts/`:

- [ ] **register-service.ps1**
  - Service Name: `TabezaConnect` (no space)
  - Display Name: `Tabeza POS Connect Service` (with spaces)

- [ ] **configure-firewall.ps1**
  - Rule names can use either format (document which is used)

- [ ] **verify-installation.ps1**
  - Service checks use: `TabezaConnect` (no space)

### ✅ Configuration Files

- [ ] **config.template.json**
  - No hardcoded names expected, but verify if present

- [ ] **package.json** (if exists)
  - Package name: `tabezaconnect` or `tabeza-connect` (lowercase, no spaces)

### ✅ Documentation Files

- [ ] **README.md**
  - Technical references: `TabezaConnect`
  - User-facing references: `Tabeza POS Connect`

- [ ] **BUILD-AND-DEPLOY.md**
  - Build commands: `TabezaConnect-Setup-v1.3.0.exe`
  - Installation paths: `C:\Program Files\TabezaConnect`

### ✅ Post-Installation Verification

After building and installing, verify:

- [ ] **Windows Programs List**
  - Shows: `Tabeza POS Connect` ✓

- [ ] **Start Menu**
  - Shows: `Tabeza POS Connect` ✓

- [ ] **Installation Directory**
  - Path: `C:\Program Files\TabezaConnect` ✓

- [ ] **Windows Services**
  - Service Name: `TabezaConnect` ✓
  - Display Name: `Tabeza POS Connect Service` ✓

- [ ] **Registry**
  - Key: `HKLM\Software\Tabeza\Connect` ✓

- [ ] **Executable Name**
  - Downloaded as: `TabezaConnect-Setup-v1.3.0.exe` ✓

## Common Mistakes to Avoid

### ❌ WRONG - Space in Technical Names
```
OutputBaseFilename=Tabeza Connect-Setup-v1.3.0    ❌
DefaultDirName={autopf}\Tabeza Connect            ❌
sc.exe start "Tabeza Connect"                     ❌
Software\Tabeza Connect                           ❌
```

### ✅ CORRECT - No Space in Technical Names
```
OutputBaseFilename=TabezaConnect-Setup-v1.3.0     ✓
DefaultDirName={autopf}\TabezaConnect             ✓
sc.exe start TabezaConnect                        ✓
Software\Tabeza\Connect                           ✓
```

### ✅ CORRECT - Spaces in User-Facing Names
```
AppName=Tabeza POS Connect                        ✓
DefaultGroupName=Tabeza POS Connect               ✓
UninstallDisplayName=Tabeza POS Connect           ✓
DisplayName "Tabeza POS Connect Service"          ✓
```

## Automated Testing

### Script Usage

**Basic check:**
```powershell
.\verify-technical-names.ps1
```

**Verbose output:**
```powershell
.\verify-technical-names.ps1 -Verbose
```

**Custom installer path:**
```powershell
.\verify-technical-names.ps1 -InstallerPath "path\to\installer.iss"
```

### Expected Output

```
========================================
TabezaConnect Technical Name Verification
========================================

Checking installer.iss file...

[PASS] Executable filename format
[PASS] Installation directory name
[PASS] Registry key name
[PASS] Windows service name

Checking for incorrect spacing in technical names...

[PASS] No spacing errors in technical contexts

========================================
Verification Summary
========================================
Checks Passed: 5
Errors: 0
Warnings: 0

✓ All technical names verified successfully!
```

## Integration with CI/CD

Add to build pipeline:

```yaml
- name: Verify Technical Names
  run: |
    powershell -ExecutionPolicy Bypass -File verify-technical-names.ps1
  shell: pwsh
```

## Sign-Off

- [ ] Automated script passes all checks
- [ ] Manual checklist completed
- [ ] Post-installation verification completed
- [ ] Documentation reviewed and accurate

**Verified by:** _______________  
**Date:** _______________  
**Version:** 1.3.0
