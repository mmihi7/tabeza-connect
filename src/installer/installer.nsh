; Tabeza Connect - NSIS Installer Script
; This script adds custom actions during installation
; Handles: Install, Reinstall, Update scenarios

!macro customHeader
  !system "echo 'Building Tabeza Connect Installer...'"
!macroend

!macro customInit
  ; Check if running as administrator
  ${If} ${UAC_IsAdmin}
    ; Already admin, continue
  ${Else}
    ; Not admin, try to elevate
    MessageBox MB_ICONEXCLAMATION "Tabeza Connect requires Administrator privileges to configure printer pooling."
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; ═══════════════════════════════════════════════════════════════════════════
  ; STEP 1: Copy printer setup script FIRST so it's available
  ; ═══════════════════════════════════════════════════════════════════════════
  
  SetOutPath "$INSTDIR\installer"
  File /oname=printer-pooling-setup.ps1 "${PROJECT_DIR}\src\installer\printer-pooling-setup.ps1"
  
  ; ═══════════════════════════════════════════════════════════════════════════
  ; STEP 2: Create/Update TabezaPrints folder structure
  ; This runs on every install, reinstall, and update
  ; Safe to run multiple times - will not overwrite existing data
  ; ═══════════════════════════════════════════════════════════════════════════
  
  DetailPrint "Creating TabezaPrints folder structure..."
  
  ; Run the CreateFolders action - this creates all required directories
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\installer\printer-pooling-setup.ps1" -Action CreateFolders'
  Pop $0
  
  ${If} $0 == 0
    DetailPrint "✓ TabezaPrints folder structure ready"
  ${Else}
    DetailPrint "⚠ TabezaPrints folder creation had issues (may already exist)"
  ${EndIf}
  
  ; ═══════════════════════════════════════════════════════════════════════════
  ; STEP 3: SIMPLIFIED - Just ask if they want to configure printer pooling
  ; Skip the complex check that might fail
  ; ═══════════════════════════════════════════════════════════════════════════
  
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Would you like to configure printer pooling now?$\n$\n\
    This will create a 'Tabeza Agent' that sends jobs to both$\n\
    your physical receipt printer and Tabeza Connect for digital capture.$\n$\n\
    Capture file: C:\TabezaPrints\order.prn$\n$\n\
    You can also configure this later from the system tray menu.$\n$\n\
    Note: If printer pooling is already configured, this will detect it." \
    IDYES ConfigurePrinter IDNO SkipPrinter
    
  ConfigurePrinter:
    DetailPrint "Configuring printer pooling..."
    nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\installer\printer-pooling-setup.ps1" -Action Install -CaptureFilePath "C:\TabezaPrints\order.prn" -Silent'
    Pop $0
    
    ${If} $0 == 0
      DetailPrint "✓ Printer pooling configured successfully"
    ${Else}
      MessageBox MB_ICONEXCLAMATION \
        "Printer configuration encountered an issue (exit code: $0).$\n$\n\
        This may happen if printer pooling is already configured.$\n$\n\
        You can check or reconfigure it later from the Tabeza Connect tray menu."
    ${EndIf}
    Goto Done
    
  SkipPrinter:
    DetailPrint "Printer configuration skipped. Configure from tray menu later."
    
  Done:
!macroend

!macro customUnInstall
  ; ═══════════════════════════════════════════════════════════════════════════
  ; Ask about removing printer configuration
  ; ═══════════════════════════════════════════════════════════════════════════
  
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove Tabeza Agent configuration?$\n$\n\
    This will remove the virtual printer and capture port.$\n\
    Your original receipt printer will not be affected." \
    IDYES RemovePrinter IDNO SkipRemove
    
  RemovePrinter:
    nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\installer\printer-pooling-setup.ps1" -Action Uninstall'
    Pop $0
    DetailPrint "Printer configuration removed."
    Goto DoneRemove
    
  SkipRemove:
    DetailPrint "Printer configuration preserved."
    
  DoneRemove:
  
  ; ═══════════════════════════════════════════════════════════════════════════
  ; Ask about removing TabezaPrints data folder
  ; ═══════════════════════════════════════════════════════════════════════════
  
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove all Tabeza Connect data?$\n$\n\
    Location: C:\TabezaPrints\$\n$\n\
    This includes:$\n\
    • Logs$\n\
    • Queued receipts$\n\
    • Configuration$\n\
    • Templates$\n$\n\
    Select 'No' to keep your data for future installations." \
    IDYES RemoveData IDNO SkipRemoveData
    
  RemoveData:
    RMDir /r "C:\TabezaPrints"
    DetailPrint "Tabeza data removed."
    Goto DoneRemoveData
    
  SkipRemoveData:
    DetailPrint "Tabeza data preserved at C:\TabezaPrints\"
    
  DoneRemoveData:
!macroend

!macro customInstallMode
  ; Set to always install for all users (per-machine)
  StrCpy $hasPerMachineInstallation 1
!macroend

; ═══════════════════════════════════════════════════════════════════════════
; Additional: Run folder creation on update/reinstall
; This ensures the folder structure is always up-to-date
; ═══════════════════════════════════════════════════════════════════════════

!macro customPostInstall
  ; Always ensure folder structure exists after install
  DetailPrint "Verifying TabezaPrints folder structure..."
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\installer\printer-pooling-setup.ps1" -Action CreateFolders'
  Pop $0
  
  ; Show setup instructions
  MessageBox MB_OK|MB_ICONINFORMATION \
    "Tabeza Connect has been installed successfully!$\n$\n\
    Next steps:$\n\
    1. The app will open automatically$\n\
    2. Configure your Bar ID in the management UI$\n\
    3. Set up printer pooling from the system tray menu$\n$\n\
    The system tray icon will appear in the bottom-right corner."
!macroend