# Bugfix Requirements Document

## Introduction

Two related bugs in `win-printer.js` and the `/api/printer/status` endpoint cause the template generation workflow to fail. Windows returns `"Unknown"` as the normal idle status for many printers, but the current code treats it as an error — blocking all print jobs with "Printer not ready". Separately, the status endpoint omits `PrinterStatus` from its PowerShell query and never resolves the integer enum Windows returns into a human-readable string, so the dashboard always shows "unknown". Together these bugs prevent the 3-test-print template generation workflow from completing.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN Windows `Get-Printer` returns `"Unknown"` as the printer status THEN the system treats the printer as not ready and blocks the print job with "Printer not ready: Printer status: Unknown"

1.2 WHEN the `/api/printer/status` endpoint is called THEN the system returns a response missing the `PrinterStatus` field because the PowerShell `Select-Object` clause does not include it

1.3 WHEN `PrinterStatus` is queried via PowerShell and Windows returns an integer enum value (e.g. `0` for Unknown, `3` for Idle, `4` for Printing) THEN the system does not resolve it to a human-readable string, so the dashboard displays "unknown"

### Expected Behavior (Correct)

2.1 WHEN Windows `Get-Printer` returns `"Unknown"` as the printer status THEN the system SHALL treat the printer as ready, because `"Unknown"` is the normal idle state for many Windows printers

2.2 WHEN the `/api/printer/status` endpoint is called THEN the system SHALL include `PrinterStatus` in the PowerShell query and return it in the response

2.3 WHEN `PrinterStatus` is an integer enum value THEN the system SHALL resolve it to a human-readable status string (e.g. `0` → `"ready"`, `3` → `"ready"`, `4` → `"printing"`, `5` → `"error"`, `6` → `"offline"`) before returning it to the dashboard

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Windows `Get-Printer` returns `"Error"` as the printer status THEN the system SHALL CONTINUE TO treat the printer as not ready and block the print job

3.2 WHEN Windows `Get-Printer` returns `"Offline"` as the printer status THEN the system SHALL CONTINUE TO treat the printer as not ready and block the print job

3.3 WHEN Windows `Get-Printer` returns `"OutOfPaper"` or `"PaperOut"` as the printer