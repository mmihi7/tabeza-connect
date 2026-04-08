# test-clawpdf-printer.ps1
# Tests the clawPDF printer profile by sending a test print job
# Verifies that the printer captures the job to the spool folder

param(
    [string]$PrinterName = "Tabeza Agent",
    [string]$SpoolFolder = "C:\TabezaPrints\spool",
    [string]$LogPath = "$env:TEMP\TabezaConnect-clawPDF-test.log",
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"

Write-Host "=== Tabeza Connect - clawPDF Printer Test ===" -ForegroundColor Cyan
Write-Host "Printer Name: $PrinterName"
Write-Host "Spool Folder: $SpoolFolder"
Write-Host "Timeout: $TimeoutSeconds seconds"
Write-Host "Log: $LogPath"
Write-Host ""

# Start logging
Start-Transcript -Path $LogPath -Append

try {
    # Step 1: Verify printer exists
    Write-Host "[1/6] Checking if printer exists..." -ForegroundColor Yellow
    $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    
    if (-not $printer) {
        Write-Host "ERROR: Printer '$PrinterName' not found" -ForegroundColor Red
        Write-Host "Available printers:" -ForegroundColor Yellow
        Get-Printer | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
        Stop-Transcript
        exit 1
    }
    
    Write-Host "✓ Printer found: $($printer.Name)" -ForegroundColor Green
    Write-Host "  Driver: $($printer.DriverName)" -ForegroundColor Gray
    Write-Host "  Port: $($printer.PortName)" -ForegroundColor Gray
    Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor Gray
    Write-Host ""
    
    # Step 2: Verify spool folder exists
    Write-Host "[2/6] Checking spool folder..." -ForegroundColor Yellow
    if (-not (Test-Path $SpoolFolder)) {
        Write-Host "ERROR: Spool folder not found: $SpoolFolder" -ForegroundColor Red
        Stop-Transcript
        exit 1
    }
    
    Write-Host "✓ Spool folder exists: $SpoolFolder" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Count existing files in spool folder
    Write-Host "[3/6] Counting existing spool files..." -ForegroundColor Yellow
    $existingFiles = Get-ChildItem -Path $SpoolFolder -Filter "*.ps" -ErrorAction SilentlyContinue
    $initialCount = if ($existingFiles) { $existingFiles.Count } else { 0 }
    Write-Host "✓ Found $initialCount existing file(s)" -ForegroundColor Green
    Write-Host ""
    
    # Step 4: Create test print job content
    Write-Host "[4/6] Creating test print job..." -ForegroundColor Yellow
    
    # Create a simple ESC/POS test receipt
    $testContent = @"
========================================
    TABEZA CONNECT TEST RECEIPT
========================================

Test Printer: $PrinterName
Test Time: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Test ID: $(New-Guid)

----------------------------------------
ITEM                    QTY      PRICE
----------------------------------------
Test Item 1               2     100.00
Test Item 2               1     150.00
----------------------------------------
SUBTOTAL:                       250.00
TAX (16%):                       40.00
----------------------------------------
TOTAL:                          290.00
========================================

This is a test print job to verify
that the clawPDF printer profile is
correctly configured to capture print
jobs to the spool folder.

If you see this file in:
$SpoolFolder

Then the printer profile is working!

========================================
"@
    
    # Create temporary file for test print
    $tempFile = "$env:TEMP\tabeza-test-print-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    $testContent | Out-File -FilePath $tempFile -Encoding UTF8
    
    Write-Host "✓ Test content created: $tempFile" -ForegroundColor Green
    Write-Host ""
    
    # Step 5: Send test print job
    Write-Host "[5/6] Sending test print job to '$PrinterName'..." -ForegroundColor Yellow
    
    try {
        # Use Start-Process with notepad to print the file
        # This simulates a real print job from an application
        $printProcess = Start-Process -FilePath "notepad.exe" -ArgumentList "/p `"$tempFile`"" -PassThru -WindowStyle Hidden
        
        # Wait a moment for the print job to be spooled
        Start-Sleep -Seconds 2
        
        Write-Host "✓ Print job sent successfully" -ForegroundColor Green
        Write-Host ""
        
    } catch {
        Write-Host "ERROR: Failed to send print job" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        Stop-Transcript
        exit 1
    }
    
    # Step 6: Wait for file to appear in spool folder
    Write-Host "[6/6] Waiting for captured file in spool folder..." -ForegroundColor Yellow
    Write-Host "Timeout: $TimeoutSeconds seconds" -ForegroundColor Gray
    
    $startTime = Get-Date
    $fileFound = $false
    $capturedFile = $null
    
    while (((Get-Date) - $startTime).TotalSeconds -lt $TimeoutSeconds) {
        $currentFiles = Get-ChildItem -Path $SpoolFolder -Filter "*.ps" -ErrorAction SilentlyContinue
        $currentCount = if ($currentFiles) { $currentFiles.Count } else { 0 }
        
        if ($currentCount -gt $initialCount) {
            # New file detected!
            $newFiles = $currentFiles | Where-Object { 
                $_.CreationTime -gt $startTime.AddSeconds(-5) 
            } | Sort-Object CreationTime -Descending
            
            if ($newFiles) {
                $capturedFile = $newFiles[0]
                $fileFound = $true
                break
            }
        }
        
        # Show progress
        $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
        Write-Host "`rWaiting... ($elapsed/$TimeoutSeconds seconds)" -NoNewline -ForegroundColor Gray
        Start-Sleep -Milliseconds 500
    }
    
    Write-Host "" # New line after progress
    Write-Host ""
    
    # Clean up temp file
    Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    
    # Check results
    if ($fileFound) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✓ TEST PASSED!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Captured file details:" -ForegroundColor Cyan
        Write-Host "  Name: $($capturedFile.Name)" -ForegroundColor White
        Write-Host "  Path: $($capturedFile.FullName)" -ForegroundColor White
        Write-Host "  Size: $($capturedFile.Length) bytes" -ForegroundColor White
        Write-Host "  Created: $($capturedFile.CreationTime)" -ForegroundColor White
        Write-Host ""
        Write-Host "The clawPDF printer profile is working correctly!" -ForegroundColor Green
        Write-Host "Print jobs are being captured to: $SpoolFolder" -ForegroundColor Green
        Write-Host ""
        
        # Show file content preview
        if ($capturedFile.Length -lt 10000) {
            Write-Host "File content preview (first 500 bytes):" -ForegroundColor Cyan
            $content = Get-Content -Path $capturedFile.FullName -Raw -Encoding UTF8
            $preview = $content.Substring(0, [Math]::Min(500, $content.Length))
            Write-Host $preview -ForegroundColor Gray
            Write-Host ""
        }
        
        Stop-Transcript
        exit 0
        
    } else {
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "✗ TEST FAILED!" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "No captured file detected after $TimeoutSeconds seconds" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible issues:" -ForegroundColor Yellow
        Write-Host "  1. clawPDF printer profile not configured correctly" -ForegroundColor Yellow
        Write-Host "  2. Output directory not set to: $SpoolFolder" -ForegroundColor Yellow
        Write-Host "  3. Auto-save not enabled in clawPDF settings" -ForegroundColor Yellow
        Write-Host "  4. clawPDF service not running" -ForegroundColor Yellow
        Write-Host "  5. Permissions issue with spool folder" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Troubleshooting steps:" -ForegroundColor Cyan
        Write-Host "  1. Check clawPDF settings at: %APPDATA%\clawSoft\clawPDF\Settings.ini" -ForegroundColor Cyan
        Write-Host "  2. Verify registry settings at: HKCU:\Software\clawSoft\clawPDF" -ForegroundColor Cyan
        Write-Host "  3. Check Windows Event Viewer for clawPDF errors" -ForegroundColor Cyan
        Write-Host "  4. Try printing manually to '$PrinterName' from Notepad" -ForegroundColor Cyan
        Write-Host "  5. Re-run configure-clawpdf.ps1 script" -ForegroundColor Cyan
        Write-Host ""
        
        Stop-Transcript
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "✗ TEST ERROR!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Exception during test execution:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack trace:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    Write-Host ""
    
    Stop-Transcript
    exit 1
}
