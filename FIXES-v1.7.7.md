# Tabeza Connect v1.7.7 - PowerShell Elevation Fix

## Issue Fixed

### Installer Failing with PowerShell Command Error

**Problem**: The installer was failing during printer setup with this error:
```
Setup failed: Command failed: powershell.exe -Command "Start-Process powershell.exe 
-ArgumentList '-ExecutionPolicy Bypass -File "C:\Program Files\TabezaConnect\resources\
installer\printer-pooling-setup.ps1" -Action Install -CaptureFilePath "C:\TabezaPrints\
order.prn" -PhysicalPrinterName "EPSON L3210 Series" -Silent' -Verb RunAs -Wait 
-WindowStyle Hidden -PassThru | Select-Object -ExpandProperty ExitCode"

Process must exit before requested information can be determined.
At line:1 char:310
+ ... WindowStyle Hidden -PassThru | Select-Object -ExpandProperty ExitCode
+                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidResult: (System.Diagnostics.Process (powershell):PSObject)
   [Select-Object], GetValueInvocationException
```

**Root Cause**: 
The PowerShell command was trying to pipe the output of `Start-Process -PassThru` directly to `Select-Object -ExpandProperty ExitCode`. This doesn't work because:
1. `Start-Process -Wait` blocks until the process completes
2. The pipeline tries to access `ExitCode` before the process object is fully populated
3. PowerShell throws an error because the property isn't available yet

**Fix**:
Changed the approach to use a wrapper script that:
1. Starts the elevated process and captures it in a variable
2. Waits for it to complete
3. Exits with the same exit code
4. The parent process checks the exit code from the wrapper

### New Implementation

```javascript
// Create a wrapper script that runs elevated and returns exit code
const wrapperScript = `
  $process = Start-Process powershell.exe -ArgumentList '${scriptArgs}' -Verb RunAs -Wait -PassThru -WindowStyle Hidden
  exit $process.ExitCode
`;

// Execute the wrapper and check its exit code
exec(`powershell.exe -Command "${wrapperScript}"`, (error, stdout, stderr) => {
  const exitCode = error ? error.code : 0;
  // Handle success/failure based on exit code
});
```

This approach:
- Avoids the pipeline timing issue
- Properly captures the exit code from the elevated process
- Returns it to the parent process via the wrapper's exit code
- Works reliably with Node.js `exec()` error handling

## Changes Made

### Files Modified

1. **src/electron-main.js**
   - Incremented version to 1.7.7
   - Rewrote `setup-printer` IPC handler to use wrapper script approach
   - Added better logging for debugging
   - Improved error handling

2. **package.json**
   - Incremented version from 1.7.6 to 1.7.7

## Testing

The installer should now:
1. Successfully run the elevated PowerShell script
2. Capture the exit code correctly
3. Report success/failure to the UI
4. Broadcast printer setup completion to all windows

## Version History

- **1.7.0**: Initial version
- **1.7.1**: Fixed JSON output parsing
- **1.7.2**: Added elevation (had syntax errors)
- **1.7.3**: Fixed elevation syntax errors
- **1.7.4**: Fixed JSON BOM error, added IPC handlers
- **1.7.5**: Fixed printer setup notification
- **1.7.6**: Fixed state synchronization across all windows, fixed path mismatch
- **1.7.7**: Fixed PowerShell elevation exit code capture (CURRENT)

## Next Steps

1. Install `TabezaConnect-Setup-1.7.7.exe`
2. Complete printer setup wizard
3. Verify printer status updates in dashboard and template generator
4. Test Bar ID configuration
5. Check that all windows stay synchronized
