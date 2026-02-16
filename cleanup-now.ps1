# Clean up Tabz workspace - PowerShell version
Write-Host "Cleaning Tabz workspace..." -ForegroundColor Cyan

# Development markdown files to delete
$mdFiles = @(
    "ARCHITECTURE-RESTRUCTURE.md",
    "CHEAP_LLM_COMPARISON_GUIDE.md",
    "CONFIGURE-PRINTER-FOR-LOCAL-DEV.md",
    "DEPLOYMENT-PROTECTION-DISABLED.md",
    "HOW-POS-CONNECTS.md",
    "HOW-TO-RELEASE.md",
    "MERGE-COMPLETE-NEXT-STEPS.md",
    "NEXT-STEPS-PRINTER-CONFIG.md",
    "NOTEPAD-TO-TABEZA-INTEGRATION.md",
    "PRINT-ONLY-FINAL-ARCHITECTURE.md",
    "PRINTER-ALTERNATIVES-ANALYSIS.md",
    "PRINTER-CONFIGURATION-COMPLETE-FLOW.md",
    "PRINTER-CONNECTION-AUDIT.md",
    "PRINTER-DRIVER-MYSTERY-SOLVED.md",
    "PRINTER-FILES-COMPLETE-LIST.md",
    "PRINTER-FIXES-APPLIED.md",
    "PRINTER-HEARTBEAT-AUDIT-RESPONSE.md",
    "PRINTER-PRODUCTION-FIXES.md",
    "PRINTER-PROTOTYPE-FIRST-APPROACH.md",
    "PRINTER-SERVICE-ARCHITECTURE.md",
    "PRINTER-SERVICE-CURRENT-STATE.md",
    "PRINTER-SERVICE-DETECTED.md",
    "PRINTER-SERVICE-QUICK-START.md",
    "PRINTER-SERVICE-UX-IMPROVEMENTS.md",
    "PRINTER-SETUP-REALITY.md",
    "PRINTER-STATUS-TESTING-QUICK-START.md",
    "PRINTER-SYSTEM-ARCHITECTURE.md",
    "PRINTER-SYSTEM-CLARITY.md",
    "PRINTER-SYSTEM-SIMPLE-EXPLANATION.md",
    "PRINTER-TEST-NEXT-STEPS.md",
    "PRINTER-UI-PRODUCTION-DEBUG.md",
    "PRODUCTION-SERVICE-CONFIG-LOCATION.md",
    "README-TABEZA-CONNECT.md",
    "READY-TO-TEST-RECEIPT-SYSTEM.md",
    "REALTIME-FIX-APPLIED.md",
    "RECEIPT-PARSING-FLOW.md",
    "SAVE-RECEIPT-TO-FOLDER.md",
    "SIMPLE-CONNECTION-DIAGRAM.md",
    "SOLUTION-PORT-8765-OCCUPIED.md",
    "SYSTEM-READY-TO-USE.md",
    "TAB-MATCHING-STRATEGY.md",
    "TABEZA-CONNECT-FINAL-STEPS.md",
    "TABEZA-CONNECT-FIX-AND-RUN.md",
    "TABEZA-CONNECT-READY-TO-RUN.md",
    "TABEZA-CONNECT-READY-TO-TEST.md",
    "TABEZA-SERVICE-INSTALLED-AS-WINDOWS-SERVICE.md",
    "TABEZACONNECT-AUTOMATED-SETUP.md",
    "TABEZACONNECT-ZIP-ISSUE-WORKAROUND.md",
    "VERCEL-AUTH-STILL-ACTIVE.md",
    "WHERE-IS-CONFIG-FILE.md"
)

# Test/utility files to delete
$utilFiles = @(
    "fix-database-schema.js",
    "setup-tabezaconnect.js",
    "show_functional_structure.py",
    "tabeza_parser_advisory.docx",
    "tabeza_parser_advisory.txt",
    "tabeza_pos_evaluation.py",
    "Tabeza_POS_Print_System_Evaluation.pdf"
)

Write-Host "`nDeleting markdown files..." -ForegroundColor Yellow
foreach ($file in $mdFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  Deleted $file" -ForegroundColor Green
    }
}

Write-Host "`nDeleting utility files..." -ForegroundColor Yellow
foreach ($file in $utilFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  Deleted $file" -ForegroundColor Green
    }
}

Write-Host "`nCleanup complete!" -ForegroundColor Green
Write-Host "`nKept important files:" -ForegroundColor Cyan
Write-Host "  - README.md" -ForegroundColor White
Write-Host "  - product.md" -ForegroundColor White
Write-Host "  - PRODUCTION-DEPLOYMENT-STRATEGY.md" -ForegroundColor White
Write-Host "  - PRINTER-DRIVER-TIMEOUT-REMOVED.md" -ForegroundColor White
Write-Host "  - BUILD-TABEZACONNECT.bat" -ForegroundColor White
